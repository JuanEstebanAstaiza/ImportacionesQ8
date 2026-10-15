"""Video de cada plan, el que se reproduce en su tarjeta de la sección «Planes».

Se guarda **sin tocar el esquema**: en un único bloque de la Landing
(`landing_blocks`, tipo `videos_planes`, sección `planes`) cuyo `contenido` es
JSON, igual que el carrusel de «Quiénes somos»:

    {"planes": {"<plan_id>": {"horizontal": "/documentos/archivos/<id>/descargar",
                               "vertical": null, "titulo": "…"}}}

Así no hace falta migración, la copia de seguridad y la restauración lo llevan
como cualquier otro bloque, y los videos quedan públicos por la regla de
recursos de la Landing (`routers/documentos.py::_es_recurso_publico_de_landing`:
un bloque activo que nombra el archivo). Quitar el video de un plan deja de
publicar el archivo.

El editor de la Landing no ve este bloque: `dynamic-content` lo omite y
«Guardar estructura» no lo borra ni lo reescribe.
"""
from __future__ import annotations

import json
import logging
from typing import Dict, Optional
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.landing import SECCION_PLANES, TIPO_VIDEOS_PLANES, LandingBlock
from models.plan import Plan

logger = logging.getLogger("importacionesq8")


def _bloque(db: Session) -> Optional[LandingBlock]:
    return (
        db.query(LandingBlock)
        .filter(LandingBlock.tipo == TIPO_VIDEOS_PLANES, LandingBlock.seccion == SECCION_PLANES)
        .first()
    )


def _leer(bloque: Optional[LandingBlock]) -> Dict[str, dict]:
    if bloque is None or not bloque.contenido:
        return {}
    try:
        datos = json.loads(bloque.contenido)
    except (TypeError, ValueError):
        logger.warning("El bloque de videos de los planes no es JSON válido; se ignora")
        return {}
    planes = datos.get("planes") if isinstance(datos, dict) else None
    return {str(k): v for k, v in (planes or {}).items() if isinstance(v, dict)}


def videos_por_plan(db: Session) -> Dict[str, dict]:
    """`{plan_id: {horizontal, vertical, titulo}}` de los planes con video."""
    return _leer(_bloque(db))


def guardar(db: Session, plan_id: str, video: Optional[dict]) -> Optional[dict]:
    """Pone (o quita, con `video=None`) el video de un plan. No hace commit."""
    if db.query(Plan.id).filter(Plan.id == plan_id).first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan no encontrado")

    bloque = _bloque(db)
    videos = _leer(bloque)
    if video is None:
        videos.pop(plan_id, None)
    else:
        videos[plan_id] = {
            "horizontal": video.get("horizontal"),
            "vertical": video.get("vertical"),
            "titulo": video.get("titulo"),
        }

    if bloque is None:
        if not videos:
            return None
        bloque = LandingBlock(id=str(uuid4()), seccion=SECCION_PLANES, tipo=TIPO_VIDEOS_PLANES, orden=0)
        db.add(bloque)
    bloque.contenido = json.dumps({"planes": videos}, ensure_ascii=False)
    # Sin videos no hay nada que publicar: el bloque queda inactivo y los
    # archivos dejan de ser públicos.
    bloque.activo = bool(videos)
    return videos.get(plan_id)
