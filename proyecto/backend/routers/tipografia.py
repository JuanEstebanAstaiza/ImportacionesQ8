"""Tipografía de la plataforma. Ver services/tipografia.py."""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from services import tipografia as svc
from utils.dependencies import get_db, require_rol

router = APIRouter(tags=["Tipografía"])

Categoria = Literal["sans-serif", "serif", "display", "handwriting", "monospace"]


class AplicarTipografia(BaseModel):
    # Vacío: volver a la tipografía de marca.
    texto_id: Optional[str] = Field(None, max_length=80)
    # Vacío: los títulos usan la misma fuente del texto.
    titulos_id: Optional[str] = Field(None, max_length=80)


def _error(exc: svc.ErrorTipografia) -> HTTPException:
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


# ── Público: lo carga toda la plataforma ─────────────────────────────────────

@router.get("/tipografia/activa.css")
def hoja_activa(db: Session = Depends(get_db)):
    """Hoja que reemplaza la tipografía de marca por la elegida por el admin.
    Las fuentes se sirven desde este mismo servidor."""
    return Response(
        content=svc.css(db),
        media_type="text/css",
        # Se revalida en cada carga: si el admin cambia la fuente, se nota sin
        # esperar a que caduque una caché.
        headers={"Cache-Control": "no-cache"},
    )


@router.get("/tipografia/archivos/{fuente_id}/{archivo}")
def archivo_fuente(fuente_id: str, archivo: str):
    ruta = svc.ruta_archivo(fuente_id, archivo)
    if ruta is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado")
    # El nombre no cambia mientras la fuente esté instalada: caché larga.
    return FileResponse(ruta, media_type="font/woff2", headers={"Cache-Control": "public, max-age=604800"})


# ── Administración ───────────────────────────────────────────────────────────

@router.get("/admin/tipografia")
def ver(db: Session = Depends(get_db), current_user: dict = Depends(require_rol("admin"))):
    return svc.activa(db)


@router.get("/admin/tipografia/catalogo")
def catalogo(
    q: str = Query("", max_length=80),
    categoria: Optional[Categoria] = None,
    pagina: int = Query(1, ge=1, le=200),
    current_user: dict = Depends(require_rol("admin")),
):
    try:
        return svc.buscar(q, categoria, pagina)
    except svc.ErrorTipografia as exc:
        raise _error(exc)


@router.get("/admin/tipografia/vista-previa/{fuente_id}")
def vista_previa(
    fuente_id: str,
    peso: int = Query(400, ge=100, le=900),
    current_user: dict = Depends(require_rol("admin")),
):
    """Un WOFF2 de la fuente para previsualizarla en el panel. Pasa por el
    servidor para que el navegador del admin no dependa del CDN externo."""
    if not svc.id_valido(fuente_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Identificador de fuente inválido")
    try:
        contenido = svc.vista_previa(fuente_id, peso)
    except svc.ErrorTipografia as exc:
        raise _error(exc)
    return Response(content=contenido, media_type="font/woff2", headers={"Cache-Control": "private, max-age=86400"})


@router.put("/admin/tipografia")
def aplicar(
    datos: AplicarTipografia,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    """Instala en el servidor las fuentes elegidas (si no lo estaban) y las
    deja activas para toda la plataforma."""
    for valor in (datos.texto_id, datos.titulos_id):
        if valor and not svc.id_valido(valor):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Identificador de fuente inválido")
    try:
        resultado = svc.aplicar(db, datos.texto_id, datos.titulos_id, current_user["user_id"])
    except svc.ErrorTipografia as exc:
        db.rollback()
        raise _error(exc)
    db.commit()
    return resultado
