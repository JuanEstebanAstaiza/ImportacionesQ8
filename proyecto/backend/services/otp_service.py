"""Servicio central de OTP: verificación de email y login tardío (>72h)."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import NamedTuple, Optional, Tuple
from uuid import uuid4

from sqlalchemy.orm import Session

import config
from models.otp import CodigoOtp, PropositoOtp
from models.usuario import Usuario
from utils.security import generar_otp, generar_token_seguro, hash_token
from utils.email import enviar_correo_otp


def invalidar_otps_pendientes(db: Session, usuario_id: str, proposito: str) -> None:
    db.query(CodigoOtp).filter(
        CodigoOtp.usuario_id == usuario_id,
        CodigoOtp.proposito == proposito,
        CodigoOtp.usado == False,  # noqa: E712
    ).update({"usado": True})


class OtpEmitido(NamedTuple):
    otp: str
    challenge: Optional[str]
    # False si el correo no salió (SMTP caído o sin configurar en producción).
    enviado: bool


def emitir_otp(
    db: Session,
    usuario: Usuario,
    proposito: str,
    *,
    con_challenge: bool = False,
) -> "OtpEmitido":
    """
    Invalida OTPs previos del mismo propósito, genera uno nuevo, lo persiste
    hasheado y envía el correo. Devuelve el OTP plano, el challenge (o None) y
    si el correo salió.
    """
    if proposito not in (PropositoOtp.verificacion_email.value, PropositoOtp.login_tardio.value):
        raise ValueError(f"Propósito OTP inválido: {proposito}")

    invalidar_otps_pendientes(db, usuario.id, proposito)

    otp = generar_otp()
    challenge = generar_token_seguro() if con_challenge else None

    registro = CodigoOtp(
        id=str(uuid4()),
        usuario_id=str(usuario.id),
        proposito=proposito,
        otp_hash=hash_token(otp),
        challenge_token_hash=hash_token(challenge) if challenge else None,
        expira_en=datetime.utcnow() + timedelta(minutes=config.OTP_EXPIRE_MINUTES),
        usado=False,
    )
    db.add(registro)
    db.commit()

    enviado = enviar_correo_otp(usuario.email, otp, proposito)
    return OtpEmitido(otp, challenge, enviado)


def consumir_otp(
    db: Session,
    *,
    proposito: str,
    otp: str,
    usuario: Optional[Usuario] = None,
    challenge_token: Optional[str] = None,
) -> Usuario:
    """
    Valida OTP (+ challenge si aplica), marca usado y devuelve el usuario.
    """
    otp_h = hash_token(otp)
    q = db.query(CodigoOtp).filter(
        CodigoOtp.proposito == proposito,
        CodigoOtp.usado == False,  # noqa: E712
    )

    if challenge_token:
        q = q.filter(CodigoOtp.challenge_token_hash == hash_token(challenge_token))
    elif usuario:
        q = q.filter(CodigoOtp.usuario_id == usuario.id)
    else:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP inválido o expirado")

    registro = q.first()
    from fastapi import HTTPException, status

    if (
        not registro
        or registro.otp_hash != otp_h
        or registro.expira_en < datetime.utcnow()
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP inválido o expirado")

    user = db.query(Usuario).filter(Usuario.id == registro.usuario_id).first()
    if not user or not user.activo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP inválido o expirado")

    registro.usado = True
    db.commit()
    return user


def requiere_login_tardio(usuario: Usuario) -> bool:
    """True si hubo un login previo y ya pasaron LOGIN_TARDIO_HORAS."""
    if usuario.ultimo_login_at is None:
        return False
    limite = datetime.utcnow() - timedelta(hours=config.LOGIN_TARDIO_HORAS)
    return usuario.ultimo_login_at < limite


def marcar_login_exitoso(db: Session, usuario: Usuario) -> None:
    usuario.ultimo_login_at = datetime.utcnow()
    db.commit()
