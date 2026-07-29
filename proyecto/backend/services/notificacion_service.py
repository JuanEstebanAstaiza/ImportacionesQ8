"""Creación y consulta de notificaciones persistentes in-app."""
from __future__ import annotations

import logging
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
