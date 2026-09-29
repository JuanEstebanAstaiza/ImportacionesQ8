"""CMS por bloques de la Landing Page.

La vista pública (sin sesión) solo ve bloques/aliados/noticias `activo`. La
administración de todo esto es exclusiva del rol admin.
"""
import logging
from html import escape
from typing import List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

import config
from models.landing import LandingAlly, LandingBlock, LandingNews
from schemas.landing import (
    ContactoRequest,
    ContactoResponse,
    LandingAllyCreate,
    LandingAllyResponse,
    LandingAllyUpdate,
    LandingBlockResponse,
    LandingBlocksSaveRequest,
    LandingDynamicContentResponse,
    LandingNewsCreate,
    LandingNewsResponse,
    LandingNewsUpdate,
)
from utils.dependencies import get_db, require_rol_in
from utils.email import construir_html_zarpi, enviar_correo
from utils.limiter import limiter

logger = logging.getLogger("importacionesq8")

router = APIRouter(prefix="/landing", tags=["Landing CMS"])

require_admin = require_rol_in("admin")


# ==================== Vista pública ====================

@router.get("/dynamic-content", response_model=LandingDynamicContentResponse)
async def obtener_contenido_dinamico(db: Session = Depends(get_db)):
    """Bloques, aliados y noticias activos, listos para `LandingScreen`."""
    bloques = (
        db.query(LandingBlock)
        .filter(LandingBlock.activo.is_(True))
        .order_by(LandingBlock.seccion.asc(), LandingBlock.orden.asc())
        .all()
    )
    aliados = (
        db.query(LandingAlly)
        .filter(LandingAlly.activo.is_(True))
        .order_by(LandingAlly.orden.asc(), LandingAlly.nombre.asc())
        .all()
    )
    noticias = (
        db.query(LandingNews)
        .filter(LandingNews.activo.is_(True))
        .order_by(LandingNews.orden.asc(), LandingNews.fecha_publicacion.desc())
        .all()
    )

    return LandingDynamicContentResponse(
        blocks=[LandingBlockResponse.model_validate(b) for b in bloques],
        allies=[LandingAllyResponse.model_validate(a) for a in aliados],
        news=[LandingNewsResponse.model_validate(n) for n in noticias],
    )


@router.post("/contacto", response_model=ContactoResponse)
@limiter.limit(config.RATE_LIMIT_PUBLIC_WRITE)
async def enviar_contacto(request: Request, datos: ContactoRequest):
    """Formulario de contacto público: reenvía el mensaje al buzón de administración.

    Antes esto solo marcaba `enviado` en el estado local del formulario y nunca
    llamaba al backend, así que ningún correo llegaba de verdad. `enviar_correo`
    ya resuelve el caso sin SMTP configurado (lo deja en el log en vez de fallar
    en silencio); aquí solo se propaga si el envío SMTP real fue intentado y
    falló, para que el formulario no diga "enviado" cuando no fue así.
    """
    perfil_label = "Nacionalizadora" if datos.perfil == "nacionalizadora" else "Comprador"
    asunto = f"Contacto Landing Zarpi — {perfil_label} — {datos.nombre.strip()}"
    cuerpo_texto = (
        f"Nuevo mensaje desde el formulario de contacto de la Landing.\n\n"
        f"Perfil: {perfil_label}\n"
        f"Nombre: {datos.nombre.strip()}\n"
        f"Email: {datos.email.strip()}\n"
        f"Teléfono: {(datos.telefono or '').strip() or 'No indicado'}\n\n"
        f"Mensaje:\n{datos.mensaje.strip()}\n"
    )
    cuerpo_html = construir_html_zarpi(
        asunto,
        f"<p><strong>Nuevo mensaje desde el formulario de contacto de la Landing.</strong></p>"
        f"<p><strong>Perfil:</strong> {escape(perfil_label)}<br/>"
        f"<strong>Nombre:</strong> {escape(datos.nombre.strip())}<br/>"
        f"<strong>Email:</strong> {escape(datos.email.strip())}<br/>"
        f"<strong>Teléfono:</strong> {escape((datos.telefono or '').strip() or 'No indicado')}</p>"
        f"<p><strong>Mensaje:</strong><br/>{escape(datos.mensaje.strip())}</p>",
    )

    try:
        enviado = enviar_correo(config.CONTACT_EMAIL, asunto, cuerpo_texto, cuerpo_html)
    except Exception:
        logger.exception("Fallo inesperado enviando el correo de contacto de la Landing")
        enviado = False

    if not enviado:
        logger.error(
            "No se pudo enviar el correo de contacto de la Landing (email=%s, perfil=%s)",
            datos.email, datos.perfil,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No se pudo enviar tu mensaje en este momento. Intenta nuevamente en unos minutos.",
        )

    return ContactoResponse(enviado=True, mensaje="Mensaje enviado. Te responderemos pronto.")


# ==================== Administración de bloques ====================

@router.get("/dynamic-content/admin", response_model=LandingDynamicContentResponse)
async def obtener_contenido_dinamico_admin(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Igual que la vista pública, pero incluye lo inactivo/borrador para editar."""
    bloques = db.query(LandingBlock).order_by(LandingBlock.seccion.asc(), LandingBlock.orden.asc()).all()
    aliados = db.query(LandingAlly).order_by(LandingAlly.orden.asc(), LandingAlly.nombre.asc()).all()
    noticias = db.query(LandingNews).order_by(LandingNews.orden.asc(), LandingNews.fecha_publicacion.desc()).all()

    return LandingDynamicContentResponse(
        blocks=[LandingBlockResponse.model_validate(b) for b in bloques],
        allies=[LandingAllyResponse.model_validate(a) for a in aliados],
        news=[LandingNewsResponse.model_validate(n) for n in noticias],
    )


@router.put("/dynamic-content", response_model=List[LandingBlockResponse])
async def guardar_bloques(
    datos: LandingBlocksSaveRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Reemplaza la estructura completa de bloques enviada por el editor.

    El editor manda siempre el estado completo (agregar/reordenar/editar/
    eliminar son todo ediciones locales hasta que se guarda), así que aquí se
    sincroniza la tabla contra esa lista en vez de aplicar diffs.
    """
    ids_enviados = {b.id for b in datos.blocks if b.id}
    existentes = {b.id: b for b in db.query(LandingBlock).all()}

    for id_existente in existentes:
        if id_existente not in ids_enviados:
            db.delete(existentes[id_existente])

    resultado: List[LandingBlock] = []
    for bloque in datos.blocks:
        fila = existentes.get(bloque.id) if bloque.id else None
        if fila is None:
            fila = LandingBlock(id=bloque.id or str(uuid4()))
            db.add(fila)

        fila.seccion = bloque.seccion.strip()
        fila.tipo = bloque.tipo.strip()
        fila.contenido = (bloque.contenido or "").strip() or None
        fila.alineacion = bloque.alineacion.strip()
        fila.tamano_fuente = bloque.tamano_fuente.strip()
        fila.accion_boton = (bloque.accion_boton or "").strip() or None
        fila.accion_url = (bloque.accion_url or "").strip() or None
        fila.token_color = bloque.token_color.strip()
        fila.fuente = bloque.fuente.strip()
        fila.orden = bloque.orden
        fila.activo = bloque.activo
        resultado.append(fila)

    db.commit()
    for fila in resultado:
        db.refresh(fila)

    resultado.sort(key=lambda b: (b.seccion, b.orden))
    return [LandingBlockResponse.model_validate(b) for b in resultado]


# ==================== Administración de aliados ====================

@router.get("/allies", response_model=List[LandingAllyResponse])
async def listar_aliados(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    filas = db.query(LandingAlly).order_by(LandingAlly.orden.asc(), LandingAlly.nombre.asc()).all()
    return [LandingAllyResponse.model_validate(a) for a in filas]


@router.post("/allies", response_model=LandingAllyResponse, status_code=status.HTTP_201_CREATED)
async def crear_aliado(
    datos: LandingAllyCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    aliado = LandingAlly(
        id=str(uuid4()),
        nombre=datos.nombre.strip(),
        logo_url=(datos.logo_url or "").strip() or None,
        categoria=(datos.categoria or "").strip() or None,
        enlace=(datos.enlace or "").strip() or None,
        orden=datos.orden,
        activo=datos.activo,
    )
    db.add(aliado)
    db.commit()
    db.refresh(aliado)
    return LandingAllyResponse.model_validate(aliado)


@router.put("/allies/{aliado_id}", response_model=LandingAllyResponse)
async def editar_aliado(
    aliado_id: str,
    datos: LandingAllyUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    aliado = db.query(LandingAlly).filter(LandingAlly.id == aliado_id).first()
    if not aliado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aliado no encontrado")

    cambios = datos.model_dump(exclude_unset=True)
    if "nombre" in cambios and cambios["nombre"] is not None:
        aliado.nombre = str(cambios["nombre"]).strip()
    for campo in ("logo_url", "categoria", "enlace"):
        if campo in cambios:
            setattr(aliado, campo, (cambios[campo] or "").strip() or None)
    if cambios.get("orden") is not None:
        aliado.orden = cambios["orden"]
    if cambios.get("activo") is not None:
        aliado.activo = cambios["activo"]

    db.commit()
    db.refresh(aliado)
    return LandingAllyResponse.model_validate(aliado)


@router.delete("/allies/{aliado_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_aliado(
    aliado_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    aliado = db.query(LandingAlly).filter(LandingAlly.id == aliado_id).first()
    if not aliado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aliado no encontrado")
    db.delete(aliado)
    db.commit()
    return None


# ==================== Administración de novedades ====================

@router.get("/news", response_model=List[LandingNewsResponse])
async def listar_noticias(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    filas = db.query(LandingNews).order_by(LandingNews.orden.asc(), LandingNews.fecha_publicacion.desc()).all()
    return [LandingNewsResponse.model_validate(n) for n in filas]


@router.post("/news", response_model=LandingNewsResponse, status_code=status.HTTP_201_CREATED)
async def crear_noticia(
    datos: LandingNewsCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    noticia = LandingNews(
        id=str(uuid4()),
        titulo=datos.titulo.strip(),
        resumen=datos.resumen.strip(),
        contenido=(datos.contenido or "").strip() or None,
        imagen_url=(datos.imagen_url or "").strip() or None,
        orden=datos.orden,
        activo=datos.activo,
    )
    db.add(noticia)
    db.commit()
    db.refresh(noticia)
    return LandingNewsResponse.model_validate(noticia)


@router.put("/news/{noticia_id}", response_model=LandingNewsResponse)
async def editar_noticia(
    noticia_id: str,
    datos: LandingNewsUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    noticia = db.query(LandingNews).filter(LandingNews.id == noticia_id).first()
    if not noticia:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Noticia no encontrada")

    cambios = datos.model_dump(exclude_unset=True)
    if "titulo" in cambios and cambios["titulo"] is not None:
        noticia.titulo = str(cambios["titulo"]).strip()
    if "resumen" in cambios and cambios["resumen"] is not None:
        noticia.resumen = str(cambios["resumen"]).strip()
    if "contenido" in cambios:
        noticia.contenido = (cambios["contenido"] or "").strip() or None
    if "imagen_url" in cambios:
        noticia.imagen_url = (cambios["imagen_url"] or "").strip() or None
    if cambios.get("orden") is not None:
        noticia.orden = cambios["orden"]
    if cambios.get("activo") is not None:
        noticia.activo = cambios["activo"]

    db.commit()
    db.refresh(noticia)
    return LandingNewsResponse.model_validate(noticia)


@router.delete("/news/{noticia_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_noticia(
    noticia_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    noticia = db.query(LandingNews).filter(LandingNews.id == noticia_id).first()
    if not noticia:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Noticia no encontrada")
    db.delete(noticia)
    db.commit()
    return None
