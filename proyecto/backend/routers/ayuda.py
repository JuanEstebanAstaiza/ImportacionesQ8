"""Documentación de la plataforma.

Se lee desde cualquier perfil, filtrada por el rol de quien pregunta, y la
escribe el equipo de la plataforma desde el panel. Vivía en un archivo del
frontend, así que añadir una respuesta obligaba a desplegar: en la práctica la
documentación no crecía aunque el soporte viera la misma duda cada semana.
"""
import logging
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from models.ayuda import CATEGORIAS_AYUDA, ArticuloAyuda
from schemas.ayuda import (
    ArticuloAyudaCreate,
    ArticuloAyudaResponse,
    ArticuloAyudaUpdate,
    ArticulosAyudaResponse,
    VotoArticuloRequest,
)
from utils.dependencies import get_current_user, get_db, require_rol_in

logger = logging.getLogger("importacionesq8")

router = APIRouter(prefix="/ayuda", tags=["Ayuda y soporte"])

# Quien escribe la documentación es quien atiende los tickets.
require_equipo = require_rol_in("admin", "soporte")

# El rol de la sesión, traducido al vocabulario de los artículos.
_ROL_A_PUBLICO = {
    "solicitante": "solicitante",
    "importador": "importadora",
    "asesor": "asesor",
}


def _publico_de(rol: str) -> Optional[str]:
    """A qué perfil de lector corresponde este rol.

    `None` para el equipo de la plataforma: ve toda la documentación, porque
    para ayudar a alguien hay que poder leer lo que esa persona está leyendo.
    """
    return _ROL_A_PUBLICO.get(rol)


def _visible_para(articulo: ArticuloAyuda, publico: Optional[str]) -> bool:
    roles = articulo.roles if isinstance(articulo.roles, list) else []
    if not roles:
        return True
    if publico is None:
        return True
    return publico in roles


@router.get("/articulos", response_model=ArticulosAyudaResponse)
async def listar_articulos(
    buscar: Optional[str] = Query(None, max_length=120),
    categoria: Optional[str] = Query(None, max_length=60),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Documentación aplicable a quien pregunta.

    La búsqueda mira título, resumen y cuerpo: alguien con un problema teclea lo
    que le pasa ("no me llega la propuesta"), no el título del artículo.
    """
    publico = _publico_de(current_user["rol"])
    es_equipo = current_user["rol"] in ("admin", "soporte")

    consulta = db.query(ArticuloAyuda)
    if not es_equipo:
        # Lo despublicado solo lo ve quien lo mantiene.
        consulta = consulta.filter(ArticuloAyuda.publicado.is_(True))

    if categoria:
        consulta = consulta.filter(ArticuloAyuda.categoria == categoria)

    if buscar and buscar.strip():
        patron = f"%{buscar.strip()}%"
        consulta = consulta.filter(
            or_(
                ArticuloAyuda.titulo.ilike(patron),
                ArticuloAyuda.resumen.ilike(patron),
                ArticuloAyuda.contenido.ilike(patron),
            )
        )

    filas = consulta.order_by(
        ArticuloAyuda.categoria.asc(), ArticuloAyuda.orden.asc(), ArticuloAyuda.titulo.asc()
    ).all()

    visibles = [a for a in filas if _visible_para(a, publico)]

    # Las categorías que se ofrecen como filtro son las que de verdad tienen
    # algo que leer para este perfil, no la lista teórica completa.
    con_contenido = {a.categoria for a in visibles}
    categorias = [c for c in CATEGORIAS_AYUDA if c in con_contenido]
    categorias += sorted(con_contenido - set(CATEGORIAS_AYUDA))

    return ArticulosAyudaResponse(
        articulos=[ArticuloAyudaResponse.model_validate(a) for a in visibles],
        categorias=categorias,
        total=len(visibles),
    )


@router.post("/articulos/{articulo_id}/visto", status_code=status.HTTP_204_NO_CONTENT)
async def marcar_visto(
    articulo_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Suma una lectura. Sirve para saber qué se consulta de verdad."""
    articulo = db.query(ArticuloAyuda).filter(ArticuloAyuda.id == articulo_id).first()
    if not articulo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artículo no encontrado")

    articulo.vistas = (articulo.vistas or 0) + 1
    db.commit()
    return None


@router.post("/articulos/{articulo_id}/voto", response_model=ArticuloAyudaResponse)
async def votar_articulo(
    articulo_id: str,
    datos: VotoArticuloRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Marca si el artículo resolvió la duda.

    Es la señal que le dice al equipo qué documentación reescribir: un artículo
    muy leído y votado como inútil es exactamente donde se están generando los
    tickets.
    """
    articulo = db.query(ArticuloAyuda).filter(ArticuloAyuda.id == articulo_id).first()
    if not articulo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artículo no encontrado")

    if datos.util:
        articulo.votos_util = (articulo.votos_util or 0) + 1
    else:
        articulo.votos_inutil = (articulo.votos_inutil or 0) + 1

    db.commit()
    db.refresh(articulo)
    return ArticuloAyudaResponse.model_validate(articulo)


# ==================== Mantenimiento por el equipo de la plataforma ====================

@router.get("/categorias", response_model=List[str])
async def listar_categorias(current_user: dict = Depends(require_equipo)):
    """Categorías sugeridas al redactar. No es una lista cerrada."""
    return list(CATEGORIAS_AYUDA)


@router.post("/articulos", response_model=ArticuloAyudaResponse, status_code=status.HTTP_201_CREATED)
async def crear_articulo(
    datos: ArticuloAyudaCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_equipo),
):
    """Publica un artículo nuevo. Sin desplegar nada."""
    articulo = ArticuloAyuda(
        id=str(uuid4()),
        titulo=datos.titulo.strip(),
        resumen=datos.resumen.strip(),
        contenido=(datos.contenido or "").strip() or None,
        categoria=datos.categoria.strip(),
        roles=datos.roles or [],
        orden=datos.orden,
        publicado=datos.publicado,
        autor_id=current_user["user_id"],
    )
    db.add(articulo)
    db.commit()
    db.refresh(articulo)
    return ArticuloAyudaResponse.model_validate(articulo)


@router.put("/articulos/{articulo_id}", response_model=ArticuloAyudaResponse)
async def editar_articulo(
    articulo_id: str,
    datos: ArticuloAyudaUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_equipo),
):
    """Corrige un artículo. Lo que no se envía se deja como estaba."""
    articulo = db.query(ArticuloAyuda).filter(ArticuloAyuda.id == articulo_id).first()
    if not articulo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artículo no encontrado")

    cambios = datos.model_dump(exclude_unset=True)
    for campo in ("titulo", "resumen", "categoria"):
        if campo in cambios and cambios[campo] is not None:
            setattr(articulo, campo, str(cambios[campo]).strip())
    if "contenido" in cambios:
        articulo.contenido = (cambios["contenido"] or "").strip() or None
    if "roles" in cambios:
        articulo.roles = cambios["roles"] or []
    if cambios.get("orden") is not None:
        articulo.orden = cambios["orden"]
    if cambios.get("publicado") is not None:
        articulo.publicado = cambios["publicado"]

    db.commit()
    db.refresh(articulo)
    return ArticuloAyudaResponse.model_validate(articulo)


@router.delete("/articulos/{articulo_id}", response_model=ArticuloAyudaResponse)
async def despublicar_articulo(
    articulo_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_equipo),
):
    """Retira un artículo de la vista pública sin borrarlo.

    Un artículo retirado puede seguir siendo la respuesta correcta a un ticket
    de hace meses; borrarlo dejaría esa conversación sin sentido.
    """
    articulo = db.query(ArticuloAyuda).filter(ArticuloAyuda.id == articulo_id).first()
    if not articulo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artículo no encontrado")

    articulo.publicado = False
    db.commit()
    db.refresh(articulo)
    return ArticuloAyudaResponse.model_validate(articulo)
