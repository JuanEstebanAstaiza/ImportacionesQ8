"""Creación y consulta de notificaciones persistentes in-app."""
from __future__ import annotations

import logging
import threading
from datetime import datetime
from typing import Any, Dict, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from models.notificacion import Notificacion

logger = logging.getLogger("importacionesq8")


def crear_notificacion(
    db: Session,
    *,
    usuario_id: str,
    tipo: str,
    titulo: str,
    mensaje: str = "",
    data: Optional[Dict[str, Any]] = None,
    commit: bool = False,
) -> Notificacion:
    """
    Persiste una notificación para el usuario.
    Por defecto no hace commit (el caller decide la transacción).
    """
    notif = Notificacion(
        id=str(uuid4()),
        usuario_id=str(usuario_id),
        tipo=tipo,
        titulo=titulo,
        mensaje=mensaje or "",
        data=data,
        leida=False,
        fecha_creacion=datetime.utcnow(),
    )
    db.add(notif)
    if commit:
        try:
            db.commit()
            db.refresh(notif)
        except Exception:
            db.rollback()
            logger.exception("No se pudo persistir notificación para usuario %s", usuario_id)
            raise
    return notif


def _despachar_canales_externos(
    db: Session,
    *,
    usuario_id: str,
    titulo: str,
    mensaje: str,
    enlace_relativo: str = "",
    whatsapp: bool = True,
    email: bool = True,
) -> None:
    """Réplica la notificación por WhatsApp y correo. Nunca lanza.

    Los datos del usuario se leen en el hilo del request (la sesión de SQLAlchemy
    no es thread-safe), pero el envío se hace en un hilo aparte: SMTP tiene 10 s
    de timeout por destinatario y un aviso en abanico —por ejemplo una cotización
    abierta que llega a varias empresas— dejaría la petición colgada minutos.
    """
    import config
    from models.usuario import Usuario

    if not (whatsapp or email):
        return

    try:
        usuario = db.query(Usuario).filter(Usuario.id == str(usuario_id)).first()
    except Exception:
        logger.warning("No se pudo cargar el usuario %s para notificarlo por canales externos", usuario_id)
        return

    if not usuario:
        return

    destino_whatsapp = usuario.whatsapp or usuario.telefono
    indicativo = usuario.indicativo_pais_telefono
    destino_email = usuario.email

    def _enviar() -> None:
        if whatsapp and config.NOTIFICACIONES_WHATSAPP:
            try:
                from services.whatsapp_service import enviar_whatsapp

                texto = f"*{titulo}*\n{mensaje}" if mensaje else titulo
                if enlace_relativo:
                    texto = f"{texto}\n{config.FRONTEND_URL}{enlace_relativo}"
                enviar_whatsapp(destino_whatsapp, texto, indicativo=indicativo)
            except Exception:
                logger.warning("Fallo enviando WhatsApp de notificación a %s", usuario_id, exc_info=True)

        if email and config.NOTIFICACIONES_EMAIL and destino_email:
            try:
                from utils.email import enviar_correo_notificacion

                enviar_correo_notificacion(destino_email, titulo, mensaje, enlace_relativo)
            except Exception:
                logger.warning("Fallo enviando correo de notificación a %s", usuario_id, exc_info=True)

    if config.APP_ENV == "test":
        # En tests se ejecuta en línea para que los monkeypatch sigan siendo
        # observables y no queden hilos sueltos entre casos.
        _enviar()
        return

    threading.Thread(target=_enviar, name=f"notif-{usuario_id}", daemon=True).start()


def notificar(
    db: Session,
    *,
    usuario_id: Optional[str],
    tipo: str,
    titulo: str,
    mensaje: str = "",
    data: Optional[Dict[str, Any]] = None,
    enlace_relativo: str = "",
    whatsapp: bool = True,
    email: bool = True,
) -> Optional[Notificacion]:
    """Notificación in-app + WhatsApp + correo, todo best-effort.

    Punto único de entrada para los eventos de negocio: la fila in-app se crea
    dentro de la transacción del caller (que debe hacer commit), y los canales
    externos se disparan aparte.
    """
    if not usuario_id:
        return None

    notificacion = crear_notificacion_best_effort(
        db,
        usuario_id=usuario_id,
        tipo=tipo,
        titulo=titulo,
        mensaje=mensaje,
        data=data,
    )

    _despachar_canales_externos(
        db,
        usuario_id=usuario_id,
        titulo=titulo,
        mensaje=mensaje,
        enlace_relativo=enlace_relativo,
        whatsapp=whatsapp,
        email=email,
    )

    return notificacion


def crear_notificacion_best_effort(
    db: Session,
    *,
    usuario_id: Optional[str],
    tipo: str,
    titulo: str,
    mensaje: str = "",
    data: Optional[Dict[str, Any]] = None,
) -> Optional[Notificacion]:
    """Igual que crear_notificacion pero traga errores (no rompe el flujo de negocio)."""
    if not usuario_id:
        return None
    try:
        return crear_notificacion(
            db,
            usuario_id=usuario_id,
            tipo=tipo,
            titulo=titulo,
            mensaje=mensaje,
            data=data,
            commit=False,
        )
    except Exception:
        logger.warning("Fallo best-effort al crear notificación para %s", usuario_id)
        return None
