"""API de Zarpi Maquilas (`/maquilas/*`).

Los endpoints son `def` (no `async`) a propósito: pymongo es síncrono y FastAPI
los corre en su pool de hilos, igual que hace con SQLAlchemy en el resto de la API.
"""
# Sin `from __future__ import annotations`: con el decorador del limitador,
# FastAPI no resolvería el modelo del cuerpo escrito como texto.
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from pymongo.database import Database
from sqlalchemy.orm import Session

from config import RATE_LIMIT_REGISTER
from maquilas import archivos, parametros, servicio
from maquilas.db import BUCKETS, get_mongo
from maquilas.esquemas import (
    AdminCrearMaquilaEntrada, DocumentosEntrada, MotivoEntrada, PerfilEntrada, RegistroMaquilaEntrada,
)
from maquilas.identidad import ROLES_EQUIPO, ROLES_MAQUILADORA
from schemas.auth import RegistroPendienteResponse
from utils.dependencies import get_db, get_optional_current_user, require_rol, require_rol_in
from utils.limiter import RATE_LIMIT_PUBLIC_READ, limiter


def _modulo_activo(db: Session = Depends(get_db)) -> None:
    """Apagado desde *Módulos*, el módulo entero responde 404 (como Liquidaciones)."""
    from services import modulos

    if not modulos.activo(db, "maquilas"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Zarpi Maquilas no está habilitado en esta instalación")


router = APIRouter(prefix="/maquilas", tags=["Maquilas"], dependencies=[Depends(_modulo_activo)])

require_maquiladora = require_rol_in(*ROLES_MAQUILADORA)
require_equipo = require_rol_in(*ROLES_EQUIPO)
require_admin = require_rol("admin")


# ==================== Público ====================

@router.get("/parametros")
@limiter.limit(RATE_LIMIT_PUBLIC_READ)
def ver_parametros(request: Request, mongo: Database = Depends(get_mongo)):
    """Categorías, procesos y certificaciones: los usa el formulario de registro."""
    return parametros.publicos(mongo)


@router.post("/registro", response_model=RegistroPendienteResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(RATE_LIMIT_REGISTER)
def registrar(
    request: Request,
    datos: RegistroMaquilaEntrada,
    mongo: Database = Depends(get_mongo),
    db: Session = Depends(get_db),
):
    """Registro de una maquiladora. Después confirma el correo con
    `POST /auth/verificar-email`, como cualquier cuenta."""
    return servicio.registrar(mongo, db, datos)


@router.get("/archivos/{bucket}/{archivo_id}")
def descargar(
    bucket: str,
    archivo_id: str,
    range_: Optional[str] = Header(default=None, alias="Range"),
    mongo: Database = Depends(get_mongo),
    usuario: Optional[dict] = Depends(get_optional_current_user),
):
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


# ==================== La maquiladora ====================

@router.post("/archivos/{bucket}", status_code=status.HTTP_201_CREATED)
def subir_archivo(
    bucket: str,
    tipo: str = Form(...),
    archivo: UploadFile = File(...),
    mongo: Database = Depends(get_mongo),
    usuario: dict = Depends(require_maquiladora),
):
    if tipo not in archivos.TIPOS_EXPEDIENTE or archivos.TIPOS[tipo][0] != bucket:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de archivo no admitido aquí")
    try:
        return archivos.subir(mongo, tipo=tipo, nombre_original=archivo.filename or "", contenido=archivo.file,
                              usuario=usuario)
    except archivos.ArchivoDemasiadoGrande as exc:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc))
    except archivos.ArchivoInvalido as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/mi-maquiladora")
def mi_maquiladora(mongo: Database = Depends(get_mongo), usuario: dict = Depends(require_maquiladora)):
    return servicio.mi_maquiladora(mongo, usuario)


@router.put("/mi-maquiladora")
def actualizar_perfil(datos: PerfilEntrada, mongo: Database = Depends(get_mongo),
                      usuario: dict = Depends(require_maquiladora)):
    return servicio.actualizar_perfil(mongo, usuario, datos)


@router.put("/mi-maquiladora/documentos")
def actualizar_documentos(datos: DocumentosEntrada, mongo: Database = Depends(get_mongo),
                          usuario: dict = Depends(require_maquiladora)):
    try:
        return servicio.actualizar_documentos(mongo, usuario, datos)
    except archivos.ArchivoInvalido as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/mi-maquiladora/enviar-verificacion")
def enviar_a_verificacion(mongo: Database = Depends(get_mongo), db: Session = Depends(get_db),
                          usuario: dict = Depends(require_maquiladora)):
    return servicio.enviar_a_verificacion(mongo, db, usuario)


# ==================== Equipo Zarpi ====================

@router.post("/admin/maquiladoras", status_code=status.HTTP_201_CREATED)
def crear_maquiladora(datos: AdminCrearMaquilaEntrada, mongo: Database = Depends(get_mongo),
                      db: Session = Depends(get_db), usuario: dict = Depends(require_admin)):
    """Alta desde Admin › Usuarios (el panel puede crear cualquier tipo de cuenta)."""
    return servicio.crear_por_equipo(mongo, db, usuario, datos)


@router.get("/admin/maquiladoras")
def listar_maquiladoras(
    estado: Optional[str] = Query(None, max_length=20),
    q: Optional[str] = Query(None, max_length=80),
    mongo: Database = Depends(get_mongo),
    usuario: dict = Depends(require_equipo),
):
    return servicio.listar_para_equipo(mongo, estado=estado, q=q)


@router.get("/admin/maquiladoras/{maquiladora_id}")
def ver_maquiladora(maquiladora_id: str, mongo: Database = Depends(get_mongo), usuario: dict = Depends(require_equipo)):
    return servicio.detalle_para_equipo(mongo, maquiladora_id)


@router.post("/admin/maquiladoras/{maquiladora_id}/aprobar")
def aprobar(maquiladora_id: str, mongo: Database = Depends(get_mongo), db: Session = Depends(get_db),
            usuario: dict = Depends(require_equipo)):
    return servicio.aprobar(mongo, db, usuario, maquiladora_id)


@router.post("/admin/maquiladoras/{maquiladora_id}/rechazar")
def rechazar(maquiladora_id: str, datos: MotivoEntrada, mongo: Database = Depends(get_mongo),
             db: Session = Depends(get_db), usuario: dict = Depends(require_equipo)):
    return servicio.rechazar(mongo, db, usuario, maquiladora_id, datos.motivo)


@router.post("/admin/maquiladoras/{maquiladora_id}/suspender")
def suspender(maquiladora_id: str, datos: MotivoEntrada, mongo: Database = Depends(get_mongo),
              db: Session = Depends(get_db), usuario: dict = Depends(require_admin)):
    return servicio.suspender(mongo, db, usuario, maquiladora_id, datos.motivo)


@router.post("/admin/maquiladoras/{maquiladora_id}/reactivar")
def reactivar(maquiladora_id: str, mongo: Database = Depends(get_mongo), db: Session = Depends(get_db),
              usuario: dict = Depends(require_admin)):
    return servicio.reactivar(mongo, db, usuario, maquiladora_id)
