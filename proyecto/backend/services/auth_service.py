from sqlalchemy.orm import Session
from uuid import uuid4
from datetime import datetime, timedelta
from typing import Optional
import secrets
import string

import config
from models.usuario import Usuario
from models.password_reset import PasswordResetToken
from models.organizacion import OrganizacionSolicitante, MiembroOrganizacion, RolOrganizacion
from models.referido import CodigoReferido, ReferidoUso
from models.credito import MovimientoCredito, TipoMovimientoCredito
from schemas.auth import (
    RegistroRequest, LoginRequest, TokenResponse, LoginResponse,
    ForgotPasswordRequest, ForgotPasswordResponse, ResetPasswordRequest,
    RegistroPendienteResponse, VerificarEmailRequest, ReenviarOtpRequest,
    ReenviarOtpResponse, LoginOtpRequest,
)
from utils.security import hash_password, verify_password, create_access_token, generar_otp, generar_token_seguro, hash_token
from utils.email import enviar_correo_recuperacion_password
from services.credito_wallet import obtener_wallet, acreditar
from services.otp_service import (
    emitir_otp, consumir_otp, requiere_login_tardio, marcar_login_exitoso,
)
from models.otp import PropositoOtp
from fastapi import HTTPException, status


def _respuesta_login(usuario: Usuario) -> LoginResponse:
    access_token = create_access_token(
        str(usuario.id),
        usuario.rol,
        importador_id=usuario.importador_id,
    )
    return LoginResponse(
        access_token=access_token,
        user_id=str(usuario.id),
        rol=usuario.rol,
        perfil_completo=usuario.perfil_completo,
        requiere_otp=False,
    )


def _generar_codigo_referido() -> str:
    alfabeto = string.ascii_uppercase + string.digits
    return "Q8" + "".join(secrets.choice(alfabeto) for _ in range(8))


def aplicar_referido_si_aplica(db: Session, nuevo_usuario: Usuario, codigo: Optional[str]) -> None:
    if not codigo:
        return
    codigo_row = db.query(CodigoReferido).filter(
        CodigoReferido.codigo == codigo.strip().upper(),
        CodigoReferido.activo == True,  # noqa: E712
    ).first()
    if not codigo_row:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código de referido inválido")
    if codigo_row.usuario_id == nuevo_usuario.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No puedes usar tu propio código")

    referidor = db.query(Usuario).filter(Usuario.id == codigo_row.usuario_id).first()
    if not referidor or referidor.rol != "solicitante":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código de referido inválido")

    ya_usado = db.query(ReferidoUso).filter(ReferidoUso.usuario_referido_id == nuevo_usuario.id).first()
    if ya_usado:
        return

    bono_ref = float(config.CREDITO_BONO_REFERIDO)
    bono_dor = float(config.CREDITO_BONO_REFERIDOR)

    wallet_nuevo = obtener_wallet(db, nuevo_usuario)
    wallet_dor = obtener_wallet(db, referidor)
    acreditar(
        db, wallet_nuevo, bono_ref,
        tipo=TipoMovimientoCredito.bono_referido.value,
        descripcion=f"Bono por registro con código {codigo_row.codigo}",
    )
    acreditar(
        db, wallet_dor, bono_dor,
        tipo=TipoMovimientoCredito.bono_referidor.value,
        descripcion=f"Bono por referir a {nuevo_usuario.email}",
    )
    db.add(ReferidoUso(
        id=str(uuid4()),
        codigo_id=codigo_row.id,
        usuario_referido_id=nuevo_usuario.id,
        bono_referidor=bono_dor,
        bono_referido=bono_ref,
    ))


def register_user(registro: RegistroRequest, db: Session) -> RegistroPendienteResponse:
    """
    Registra un nuevo solicitante. Persona jurídica crea OrganizaciónSolicitante
    con wallet corporativo. Persona natural usa wallet personal.

    No emite JWT: el usuario debe verificar el email con OTP
    (`POST /auth/verificar-email`) antes de iniciar sesión.
    """
    if registro.rol != "solicitante":
        detalle = "Rol inválido. El auto-registro público solo permite el rol 'solicitante'"
        if registro.rol == "importador":
            detalle = "Contáctese con el equipo administrativo para registrar tu empresa importadora"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detalle
        )

    usuario_existente = db.query(Usuario).filter(Usuario.email == registro.email).first()
    if usuario_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El email ya está registrado"
        )

    password_hash = hash_password(registro.password)
    nombre_registro = registro.nombre if registro.tipo_persona == "natural" else registro.razon_social
    bono = float(config.CREDITO_BONO_REGISTRO)

    # Jurídica: bono va al wallet de la org; natural: al personal.
    saldo_personal_inicial = 0.0 if registro.tipo_persona == "juridica" else bono

    nuevo_usuario = Usuario(
        id=str(uuid4()),
        email=registro.email,
        password_hash=password_hash,
        rol=registro.rol,
        tipo_persona=registro.tipo_persona,
        tipo_documento=registro.tipo_documento,
        numero_documento=registro.numero_documento,
        nit=registro.nit,
        razon_social=registro.razon_social,
        nombre=nombre_registro,
        apellido=registro.apellido,
        indicativo_pais_telefono=registro.indicativo_pais_telefono,
        telefono=registro.telefono,
        acepto_politica_datos=registro.acepto_politica_datos,
        fecha_aceptacion_politica=datetime.utcnow(),
        creditos_balance=saldo_personal_inicial,
        perfil_completo=True,
        email_verificado=False,
    )
    db.add(nuevo_usuario)
    db.flush()

    if registro.tipo_persona == "juridica":
        org = OrganizacionSolicitante(
            id=str(uuid4()),
            razon_social=registro.razon_social,
            nit=registro.nit,
            creditos_balance=bono,
            owner_usuario_id=nuevo_usuario.id,
            activo=True,
        )
        db.add(org)
        db.flush()
        nuevo_usuario.organizacion_id = org.id
        db.add(MiembroOrganizacion(
            id=str(uuid4()),
            organizacion_id=org.id,
            usuario_id=nuevo_usuario.id,
            rol_org=RolOrganizacion.owner.value,
            activo=True,
        ))
        db.add(MovimientoCredito(
            id=str(uuid4()),
            usuario_id=nuevo_usuario.id,
            organizacion_id=org.id,
            tipo=TipoMovimientoCredito.bono_registro.value,
            monto=bono,
            descripcion="Bono de registro (organización)",
        ))
    else:
        if bono > 0:
            db.add(MovimientoCredito(
                id=str(uuid4()),
                usuario_id=nuevo_usuario.id,
                tipo=TipoMovimientoCredito.bono_registro.value,
                monto=bono,
                descripcion="Bono de registro",
            ))

    aplicar_referido_si_aplica(db, nuevo_usuario, registro.codigo_referido)

    db.commit()
    db.refresh(nuevo_usuario)

    emitir_otp(db, nuevo_usuario, PropositoOtp.verificacion_email.value)

    return RegistroPendienteResponse(
        user_id=str(nuevo_usuario.id),
        email=nuevo_usuario.email,
    )


def verificar_email(solicitud: VerificarEmailRequest, db: Session) -> LoginResponse:
    usuario = db.query(Usuario).filter(Usuario.email == solicitud.email).first()
    if not usuario or not usuario.activo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP inválido o expirado")

    if usuario.email_verificado:
        marcar_login_exitoso(db, usuario)
        return _respuesta_login(usuario)

    usuario = consumir_otp(
        db,
        proposito=PropositoOtp.verificacion_email.value,
        otp=solicitud.otp,
        usuario=usuario,
    )
    usuario.email_verificado = True
    marcar_login_exitoso(db, usuario)
    return _respuesta_login(usuario)


def reenviar_otp(solicitud: ReenviarOtpRequest, db: Session) -> ReenviarOtpResponse:
    if solicitud.proposito not in (
        PropositoOtp.verificacion_email.value,
        PropositoOtp.login_tardio.value,
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Propósito OTP inválido")

    challenge = None
    usuario = db.query(Usuario).filter(Usuario.email == solicitud.email).first()
    if usuario and usuario.activo:
        if solicitud.proposito == PropositoOtp.verificacion_email.value and not usuario.email_verificado:
            emitir_otp(db, usuario, PropositoOtp.verificacion_email.value)
        elif (
            solicitud.proposito == PropositoOtp.login_tardio.value
            and usuario.email_verificado
            and requiere_login_tardio(usuario)
        ):
            _, challenge = emitir_otp(
                db, usuario, PropositoOtp.login_tardio.value, con_challenge=True
            )

    return ReenviarOtpResponse(challenge_token=challenge)


def login_user(login: LoginRequest, db: Session) -> LoginResponse:
    usuario = db.query(Usuario).filter(Usuario.email == login.email).first()

    if not usuario or not verify_password(login.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cuenta desactivada. Contacta al administrador de tu cuenta",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not usuario.email_verificado:
        emitir_otp(db, usuario, PropositoOtp.verificacion_email.value)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Debes verificar tu correo con el código OTP enviado antes de iniciar sesión",
        )

    if requiere_login_tardio(usuario):
        _, challenge = emitir_otp(
            db, usuario, PropositoOtp.login_tardio.value, con_challenge=True
        )
        return LoginResponse(
            requiere_otp=True,
            motivo_otp=PropositoOtp.login_tardio.value,
            challenge_token=challenge,
            mensaje="Por seguridad, confirma el código OTP enviado a tu correo",
            user_id=str(usuario.id),
            rol=usuario.rol,
            perfil_completo=usuario.perfil_completo,
        )

    marcar_login_exitoso(db, usuario)
    return _respuesta_login(usuario)


def verificar_login_otp(solicitud: LoginOtpRequest, db: Session) -> LoginResponse:
    usuario = consumir_otp(
        db,
        proposito=PropositoOtp.login_tardio.value,
        otp=solicitud.otp,
        challenge_token=solicitud.challenge_token,
    )
    if not usuario.email_verificado:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Correo no verificado")
    marcar_login_exitoso(db, usuario)
    return _respuesta_login(usuario)


def refresh_token(token: str, db: Session) -> TokenResponse:
    """Renueva un token JWT si el usuario sigue activo."""
    from utils.security import decode_access_token

    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        rol = payload.get("rol")

        if user_id is None or rol is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token inválido o expirado: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    usuario = db.query(Usuario).filter(Usuario.id == str(user_id)).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cuenta desactivada",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(str(usuario.id), usuario.rol, importador_id=usuario.importador_id)

    return TokenResponse(
        access_token=access_token,
        user_id=str(usuario.id),
        rol=usuario.rol
    )


def forgot_password(solicitud: ForgotPasswordRequest, db: Session) -> ForgotPasswordResponse:
    """
    Inicia la recuperación de contraseña: genera un OTP + token de un solo uso,
    los guarda hasheados, y envía por correo el enlace + el OTP.

    Siempre responde el mismo mensaje genérico exista o no el email, para no
    permitir enumeración de cuentas registradas.
    """
    usuario = db.query(Usuario).filter(Usuario.email == solicitud.email).first()

    if usuario and usuario.activo:
        otp = generar_otp()
        token = generar_token_seguro()

        db.query(PasswordResetToken).filter(
            PasswordResetToken.usuario_id == usuario.id,
            PasswordResetToken.usado == False  # noqa: E712
        ).update({"usado": True})

        nuevo_token = PasswordResetToken(
            id=str(uuid4()),
            usuario_id=str(usuario.id),
            token_hash=hash_token(token),
            otp_hash=hash_token(otp),
            expira_en=datetime.utcnow() + timedelta(minutes=config.PASSWORD_RESET_EXPIRE_MINUTES),
            usado=False
        )
        db.add(nuevo_token)
        db.commit()

        enviar_correo_recuperacion_password(usuario.email, otp, token)

    return ForgotPasswordResponse()


def reset_password(solicitud: ResetPasswordRequest, db: Session) -> None:
    """
    Completa la recuperación de contraseña validando el token + OTP.
    """
    token_hash = hash_token(solicitud.token)
    otp_hash = hash_token(solicitud.otp)

    registro_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.usado == False  # noqa: E712
    ).first()

    if (
        not registro_token
        or registro_token.otp_hash != otp_hash
        or registro_token.expira_en < datetime.utcnow()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token u OTP inválido o expirado"
        )

    usuario = db.query(Usuario).filter(Usuario.id == registro_token.usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token u OTP inválido o expirado")

    usuario.password_hash = hash_password(solicitud.nueva_password)
    registro_token.usado = True
    db.commit()
