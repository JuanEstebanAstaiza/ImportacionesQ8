"""Avisos del módulo en la campana de la plataforma.

La campana es común a toda la suite (MySQL), así que es lo único que este
módulo escribe fuera de su base. Un aviso a una cuenta de empresa llega a todo
su equipo activo (dueña y asesores): cualquiera de ellos puede atender el lote.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from models.usuario import Usuario
from services.notificacion_service import crear_notificacion_best_effort, notificar

logger = logging.getLogger("importacionesq8")


def usuarios_de_cuenta(sql: Session, cuenta: str) -> List[str]:
    tipo, _, ident = cuenta.partition(":")
    if tipo == "empresa":
        filas = sql.query(Usuario.id).filter(Usuario.importador_id == ident, Usuario.activo.is_(True)).all()
        return [str(f.id) for f in filas]
    return [ident] if ident else []


def usuarios_del_equipo(sql: Session, roles=("admin",)) -> List[str]:
    filas = sql.query(Usuario.id).filter(Usuario.rol.in_(roles), Usuario.activo.is_(True)).all()
    return [str(f.id) for f in filas]


def avisar(
    sql: Optional[Session],
    *,
    cuenta: Optional[str] = None,
    usuarios: Optional[List[str]] = None,
    tipo: str,
    titulo: str,
    mensaje: str = "",
    data: Optional[Dict[str, Any]] = None,
    enlace: str = "",
    externo: bool = False,
    excepto: Optional[str] = None,
) -> None:
    """Best-effort: un fallo de la campana nunca deshace la operación del módulo.

    `externo` también manda correo (no WhatsApp) para lo que tiene plazo, como
    una reserva que hay que confirmar en 48 h.
    """
    if sql is None:
        return
    destinatarios = list(usuarios or [])
    if cuenta:
        destinatarios += usuarios_de_cuenta(sql, cuenta)
    try:
        for usuario_id in dict.fromkeys(destinatarios):
            if usuario_id == excepto:
                continue
            if externo:
                notificar(sql, usuario_id=usuario_id, tipo=tipo, titulo=titulo, mensaje=mensaje,
                          data=data, enlace_relativo=enlace, whatsapp=False, email=True)
            else:
                crear_notificacion_best_effort(sql, usuario_id=usuario_id, tipo=tipo, titulo=titulo,
                                               mensaje=mensaje, data=data)
        sql.commit()
    except Exception:
        sql.rollback()
        logger.warning("No se pudo avisar en la campana (%s)", tipo, exc_info=True)
