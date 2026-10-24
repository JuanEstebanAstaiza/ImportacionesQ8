"""API de Zarpi Liquidaciones (`/liquidaciones/*`).

Los endpoints son `def` (no `async`) a propósito: pymongo es síncrono y FastAPI
los corre en su pool de hilos, igual que hace con SQLAlchemy en el resto de la API.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from pymongo.database import Database
from sqlalchemy.orm import Session

from liquidaciones import archivos, parametros, servicio
from liquidaciones.db import BUCKETS, get_mongo
from liquidaciones.esquemas import (
    ActivacionEntrada, AdjuntoEntrada, DespublicarEntrada, DestacarEntrada, LoteEntrada, MensajeEntrada,
    MotivoEntrada, ParametrosEntrada, RechazoEntrada, SuspensionEntrada,
)
from liquidaciones.identidad import ROLES_CLIENTE, ROLES_EMPRESA, ROLES_EQUIPO, cuenta_de
from utils.dependencies import get_current_user, get_db, get_optional_current_user, require_rol, require_rol_in
from utils.limiter import RATE_LIMIT_PUBLIC_READ, limiter


def _modulo_activo(db: Session = Depends(get_db)) -> None:
    """Apagado desde *Módulos*, el módulo entero responde 404 (como cursos)."""
    from services import modulos

    if not modulos.activo(db, "liquidaciones"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Zarpi Liquidaciones no está habilitado en esta instalación")


router = APIRouter(prefix="/liquidaciones", tags=["Liquidaciones"], dependencies=[Depends(_modulo_activo)])

require_cliente = require_rol_in(*ROLES_CLIENTE)
require_empresa = require_rol_in(*ROLES_EMPRESA)
require_equipo = require_rol_in(*ROLES_EQUIPO)
require_admin = require_rol("admin")


# ==================== Público ====================

@router.get("/publico/lotes")
@limiter.limit(RATE_LIMIT_PUBLIC_READ)
def vista_publica(request: Request, limite: int = Query(8, ge=1, le=24), mongo: Database = Depends(get_mongo)):
    """Vista previa de la landing: lotes publicados, destacados primero."""
    return servicio.vista_publica(mongo, limite)


@router.get("/archivos/{bucket}/{archivo_id}")
def descargar(
    bucket: str,
    archivo_id: str,
    range_: Optional[str] = Header(default=None, alias="Range"),
    mongo: Database = Depends(get_mongo),
    usuario: Optional[dict] = Depends(get_optional_current_user),
):
    """Sirve un archivo de GridFS. Admite `Range` para que el video se pueda adelantar."""
    fila = archivos.buscar(mongo, bucket, archivo_id) if bucket in BUCKETS else None
    if not fila or not archivos.puede_ver(mongo, fila, usuario):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado")

    meta = fila.get("metadata") or {}
    tamano = int(fila.get("length", 0))
    nombre = (meta.get("nombre_original") or "archivo").replace('"', "")
    cabeceras = {
        "Accept-Ranges": "bytes",
        "Content-Disposition": f'inline; filename="{nombre}"',
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
    }
    tramo = archivos.rango(range_, tamano)
    if tramo:
        inicio, fin = tramo
        cabeceras["Content-Range"] = f"bytes {inicio}-{fin}/{tamano}"
        cabeceras["Content-Length"] = str(fin - inicio + 1)
        return StreamingResponse(archivos.leer_trozos(mongo, bucket, fila["_id"], inicio, fin),
                                 status_code=status.HTTP_206_PARTIAL_CONTENT,
                                 media_type=meta.get("content_type"), headers=cabeceras)
    cabeceras["Content-Length"] = str(tamano)
    return StreamingResponse(archivos.leer_trozos(mongo, bucket, fila["_id"]),
                             media_type=meta.get("content_type"), headers=cabeceras)


# ==================== Cuenta del módulo ====================

@router.get("/parametros")
def ver_parametros(mongo: Database = Depends(get_mongo), usuario: dict = Depends(get_current_user)):
    """Lo que el formulario de publicación necesita saber (mínimos, categorías...)."""
    p = parametros.leer(mongo)
    return {k: p[k] for k in ("dias_max_cierre", "horas_para_confirmar", "fotos_min", "fotos_max", "videos_max",
                              "mb_max_foto", "mb_max_video", "mb_max_documento", "categorias")}


@router.get("/activacion")
def ver_activacion(
    mongo: Database = Depends(get_mongo),
    db: Session = Depends(get_db),
    usuario: dict = Depends(get_current_user),
):
    doc = servicio.obtener_activacion(mongo, cuenta_de(usuario))
    return {
        "activa": bool(doc) and not doc.get("suspendida"),
        "activacion": servicio.a_activacion(doc) if doc else None,
        "prellenado": servicio.prellenado(db, usuario),
        "puede_publicar": usuario["rol"] in ROLES_EMPRESA,
    }


@router.post("/activacion")
def activar(
    datos: ActivacionEntrada,
    mongo: Database = Depends(get_mongo),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_cliente),
):
    return servicio.activar(mongo, db, usuario, datos)


@router.post("/archivos/{bucket}", status_code=status.HTTP_201_CREATED)
def subir_archivo(
    bucket: str,
    tipo: str = Form(...),
    archivo: UploadFile = File(...),
    mongo: Database = Depends(get_mongo),
    usuario: dict = Depends(require_cliente),
):
    if tipo not in archivos.TIPOS or archivos.TIPOS[tipo][0] != bucket:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de archivo no admitido aquí")
    if tipo in ("foto", "video", "ficha_tecnica") and usuario["rol"] not in ROLES_EMPRESA:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo las empresas suben archivos de lotes")
    try:
        return archivos.subir(mongo, tipo=tipo, nombre_original=archivo.filename or "", contenido=archivo.file,
                              usuario=usuario)
    except archivos.ArchivoDemasiadoGrande as exc:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc))
    except archivos.ArchivoInvalido as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ==================== Catálogo y compra ====================

@router.get("/lotes")
def catalogo(
    q: Optional[str] = None,
    categoria: Optional[str] = None,
    ciudad: Optional[str] = None,
    condicion: Optional[str] = None,
    entrega: Optional[str] = None,
    mongo: Database = Depends(get_mongo),
    db: Session = Depends(get_db),
    usuario: dict = Depends(get_current_user),
):
    return servicio.catalogo(mongo, db, usuario, q=q, categoria=categoria, ciudad=ciudad, condicion=condicion,
                             entrega=entrega)


@router.get("/lotes/{lote_id}")
def detalle_lote(
    lote_id: str,
    mongo: Database = Depends(get_mongo),
    db: Session = Depends(get_db),
    usuario: dict = Depends(get_current_user),
):
    return servicio.detalle_lote(mongo, db, usuario, lote_id)


@router.post("/lotes/{lote_id}/reservar", status_code=status.HTTP_201_CREATED)
def reservar(
    lote_id: str,
    mongo: Database = Depends(get_mongo),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_cliente),
):
    return servicio.reservar(mongo, db, usuario, lote_id)


# ==================== Operaciones ====================

@router.get("/operaciones")
def listar_operaciones(
    lado: str = Query("comprador", pattern="^(comprador|vendedor)$"),
    mongo: Database = Depends(get_mongo),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_cliente),
):
    return servicio.operaciones(mongo, db, usuario, lado)


@router.get("/operaciones/{operacion_id}")
def detalle_operacion(
    operacion_id: str,
    mongo: Database = Depends(get_mongo),
    db: Session = Depends(get_db),
    usuario: dict = Depends(get_current_user),
):
    return servicio.detalle_operacion(mongo, db, usuario, operacion_id)


@router.post("/operaciones/{operacion_id}/mensajes", status_code=status.HTTP_201_CREATED)
def enviar_mensaje(
    operacion_id: str,
    datos: MensajeEntrada,
    mongo: Database = Depends(get_mongo),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_cliente),
):
    return servicio.enviar_mensaje(mongo, db, usuario, operacion_id, datos.contenido)


@router.post("/operaciones/{operacion_id}/vendido")
def marcar_vendido(
    operacion_id: str,
    mongo: Database = Depends(get_mongo),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_empresa),
):
    return servicio.marcar_vendido(mongo, db, usuario, operacion_id)


@router.post("/operaciones/{operacion_id}/cancelar")
def cancelar(
    operacion_id: str,
    datos: MotivoEntrada,
    mongo: Database = Depends(get_mongo),
    db: Session = Depends(get_db),
    usuario: dict = Depends(get_current_user),
):
    return servicio.cancelar(mongo, db, usuario, operacion_id, datos.motivo)


@router.post("/operaciones/{operacion_id}/comprobante")
def adjuntar_comprobante(
    operacion_id: str,
    datos: AdjuntoEntrada,
    mongo: Database = Depends(get_mongo),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_cliente),
):
    return servicio.adjuntar(mongo, db, usuario, operacion_id, datos.archivo_id, "comprobante_pago")


@router.post("/operaciones/{operacion_id}/factura")
def adjuntar_factura(
    operacion_id: str,
    datos: AdjuntoEntrada,
    mongo: Database = Depends(get_mongo),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_empresa),
):
    return servicio.adjuntar(mongo, db, usuario, operacion_id, datos.archivo_id, "factura")


# ==================== Vendedor ====================

@router.get("/mis-lotes")
def mis_lotes(mongo: Database = Depends(get_mongo), db: Session = Depends(get_db),
              usuario: dict = Depends(require_empresa)):
    return servicio.mis_lotes(mongo, db, usuario)


@router.post("/mis-lotes", status_code=status.HTTP_201_CREATED)
def crear_lote(datos: LoteEntrada, mongo: Database = Depends(get_mongo), db: Session = Depends(get_db),
               usuario: dict = Depends(require_empresa)):
    return servicio.crear_lote(mongo, db, usuario, datos)


@router.put("/mis-lotes/{lote_id}")
def editar_lote(lote_id: str, datos: LoteEntrada, mongo: Database = Depends(get_mongo),
                db: Session = Depends(get_db), usuario: dict = Depends(require_empresa)):
    return servicio.editar_lote(mongo, db, usuario, lote_id, datos)


# ==================== Equipo de Zarpi (panel admin) ====================

@router.get("/admin/revision")
def cola_revision(mongo: Database = Depends(get_mongo), usuario: dict = Depends(require_equipo)):
    return {"lotes": servicio.cola_revision(mongo, usuario), "parametros": {
        k: parametros.leer(mongo)[k] for k in ("motivos_rechazo", "checklist_revision")}}


@router.post("/admin/lotes/{lote_id}/aprobar")
def aprobar(lote_id: str, mongo: Database = Depends(get_mongo), db: Session = Depends(get_db),
            usuario: dict = Depends(require_equipo)):
    return servicio.aprobar(mongo, db, usuario, lote_id)


@router.post("/admin/lotes/{lote_id}/rechazar")
def rechazar(lote_id: str, datos: RechazoEntrada, mongo: Database = Depends(get_mongo),
             db: Session = Depends(get_db), usuario: dict = Depends(require_equipo)):
    return servicio.rechazar(mongo, db, usuario, lote_id, datos.motivos, datos.nota)


@router.get("/admin/lotes")
def lotes_admin(
    estado: Optional[str] = None,
    q: Optional[str] = None,
    limite: int = Query(25, ge=1, le=100),
    desde: int = Query(0, ge=0),
    mongo: Database = Depends(get_mongo),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_equipo),
):
    return servicio.lotes_admin(mongo, db, usuario, estado=estado, q=q, limite=limite, desde=desde)


@router.post("/admin/lotes/{lote_id}/despublicar")
def despublicar(lote_id: str, datos: DespublicarEntrada, mongo: Database = Depends(get_mongo),
                db: Session = Depends(get_db), usuario: dict = Depends(require_equipo)):
    return servicio.despublicar(mongo, db, usuario, lote_id, datos.motivo)


@router.post("/admin/lotes/{lote_id}/destacar")
def destacar(lote_id: str, datos: DestacarEntrada, mongo: Database = Depends(get_mongo),
             usuario: dict = Depends(require_equipo)):
    return servicio.destacar(mongo, usuario, lote_id, datos.destacado)


@router.get("/admin/operaciones")
def operaciones_admin(
    q: Optional[str] = None,
    estado: Optional[str] = None,
    limite: int = Query(25, ge=1, le=100),
    desde: int = Query(0, ge=0),
    mongo: Database = Depends(get_mongo),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_equipo),
):
    return servicio.operaciones_admin(mongo, db, q=q, estado=estado, limite=limite, desde=desde)


@router.post("/admin/operaciones/{operacion_id}/intervenir")
def intervenir(operacion_id: str, datos: MensajeEntrada, mongo: Database = Depends(get_mongo),
               db: Session = Depends(get_db), usuario: dict = Depends(require_equipo)):
    return servicio.intervenir(mongo, db, usuario, operacion_id, datos.contenido)


@router.get("/admin/metricas")
def metricas(mongo: Database = Depends(get_mongo), db: Session = Depends(get_db),
             usuario: dict = Depends(require_admin)):
    return servicio.metricas(mongo, db)


@router.get("/admin/cuentas")
def cuentas(
    q: Optional[str] = None,
    limite: int = Query(25, ge=1, le=100),
    desde: int = Query(0, ge=0),
    mongo: Database = Depends(get_mongo),
    usuario: dict = Depends(require_admin),
):
    return servicio.cuentas_admin(mongo, q=q, limite=limite, desde=desde)


@router.put("/admin/cuentas/{cuenta}/suspension")
def suspender(cuenta: str, datos: SuspensionEntrada, mongo: Database = Depends(get_mongo),
              db: Session = Depends(get_db), usuario: dict = Depends(require_admin)):
    return servicio.suspender(mongo, db, usuario, cuenta, datos.suspendida, datos.motivo)


@router.get("/admin/configuracion")
def ver_configuracion(mongo: Database = Depends(get_mongo), usuario: dict = Depends(require_admin)):
    return parametros.leer(mongo)


@router.put("/admin/configuracion")
def guardar_configuracion(datos: ParametrosEntrada, mongo: Database = Depends(get_mongo),
                          usuario: dict = Depends(require_admin)):
    try:
        return parametros.guardar(mongo, datos.model_dump(exclude_none=True), usuario["user_id"])
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
