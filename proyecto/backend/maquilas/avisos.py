"""Avisos del módulo en la campana de la plataforma (MySQL, común a la suite).

Un aviso a una maquiladora llega a todos sus miembros activos (dueño y
colaboradores). Best-effort: un fallo de la campana nunca deshace la operación.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Iterable, List, Optional

from pymongo.database import Database
from sqlalchemy.orm import Session

from models.usuario import Usuario
from services.notificacion_service import crear_notificacion_best_effort, notificar

logger = logging.getLogger("importacionesq8")


def usuarios_de_maquiladora(db: Database, maquiladora_id: str) -> List[str]:
    return [str(f["_id"]) for f in db.miembros.find({"maquiladora_id": maquiladora_id}, {"_id": 1})]


def usuarios_del_equipo(sql: Session, roles: Iterable[str] = ("admin",)) -> List[str]:
    filas = sql.query(Usuario.id).filter(Usuario.rol.in_(tuple(roles)), Usuario.activo.is_(True)).all()
    return [str(f.id) for f in filas]


def avisar(
    sql: Optional[Session],
    usuarios: Iterable[str],
    *,
    tipo: str,
    titulo: str,
    mensaje: str = "",
    data: Optional[Dict[str, Any]] = None,
    enlace: str = "",
    correo: bool = False,
) -> None:
    """`correo` también manda el aviso por email (para decisiones como la verificación)."""
    if sql is None:
        return
    try:
        for usuario_id in dict.fromkeys(usuarios):
            if correo:
                notificar(sql, usuario_id=usuario_id, tipo=tipo, titulo=titulo, mensaje=mensaje,
                          data=data, enlace_relativo=enlace, whatsapp=False, email=True)
            else:
                crear_notificacion_best_effort(sql, usuario_id=usuario_id, tipo=tipo, titulo=titulo,
                                               mensaje=mensaje, data=data)
        sql.commit()
    except Exception:
        sql.rollback()
        logger.warning("No se pudo avisar en la campana (%s)", tipo, exc_info=True)
