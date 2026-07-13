from datetime import datetime
from typing import List, Optional
from uuid import UUID as PyUUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from models.disputa import (
    Disputa, EvidenciaDisputa, MensajeDisputa,
    EstadoDisputa, TipoMensajeDisputa,
)
from models.orden import Orden
from models.usuario import Usuario
from schemas.features import (
    DisputaResponse, EvidenciaDisputaCreate, EvidenciaDisputaResponse,
    MensajeDisputaCreate, MensajeDisputaResponse, ResolverDisputaRoomRequest,
)
from utils.dependencies import get_db, get_current_user, require_rol

router = APIRouter(prefix="/disputas", tags=["Disputas"])


def _cargar_disputa_completa(db: Session, disputa: Disputa) -> DisputaResponse:
    evidencias = db.query(EvidenciaDisputa).filter(EvidenciaDisputa.disputa_id == disputa.id).order_by(EvidenciaDisputa.fecha).all()
    mensajes = db.query(MensajeDisputa).filter(MensajeDisputa.disputa_id == disputa.id).order_by(MensajeDisputa.fecha).all()
    return DisputaResponse(
        id=disputa.id,
        orden_id=disputa.orden_id,
        abierta_por_usuario_id=disputa.abierta_por_usuario_id,
        estado=disputa.estado,
        motivo=disputa.motivo,
        resolucion_admin=disputa.resolucion_admin,
        fecha_apertura=disputa.fecha_apertura,
        fecha_resolucion=disputa.fecha_resolucion,
        evidencias=evidencias,
        mensajes=mensajes,
    )


def _autorizado_en_orden(db: Session, orden: Orden, current_user: dict) -> bool:
    uid = current_user["user_id"]
    rol = current_user["rol"]
    if rol == "admin":
        return True
    if rol == "solicitante":
        return orden.solicitante_id == uid
    if rol == "importador":
        return orden.importador_id == current_user.get("importador_id")
    return False


@router.get("/{disputa_id}", response_model=DisputaResponse)
async def obtener_disputa(
    disputa_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        did = str(PyUUID(disputa_id))
    except ValueError:
        raise HTTPException(status_code=404, detail="Disputa no encontrada")
    disputa = db.query(Disputa).filter(Disputa.id == did).first()
    if not disputa:
        raise HTTPException(status_code=404, detail="Disputa no encontrada")
    orden = db.query(Orden).filter(Orden.id == disputa.orden_id).first()
    if not orden or not _autorizado_en_orden(db, orden, current_user):
        raise HTTPException(status_code=403, detail="No autorizado")
    return _cargar_disputa_completa(db, disputa)


@router.get("/orden/{orden_id}", response_model=DisputaResponse)
async def disputa_por_orden(
    orden_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        oid = str(PyUUID(orden_id))
    except ValueError:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    orden = db.query(Orden).filter(Orden.id == oid).first()
    if not orden or not _autorizado_en_orden(db, orden, current_user):
        raise HTTPException(status_code=403, detail="No autorizado")
    disputa = db.query(Disputa).filter(Disputa.orden_id == oid).first()
    if not disputa:
        raise HTTPException(status_code=404, detail="No hay disputa para esta orden")
    return _cargar_disputa_completa(db, disputa)


@router.post("/{disputa_id}/evidencias", response_model=EvidenciaDisputaResponse, status_code=201)
async def subir_evidencia_disputa(
    disputa_id: str,
    datos: EvidenciaDisputaCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["rol"] not in ("solicitante", "importador", "admin"):
        raise HTTPException(status_code=403, detail="No autorizado")
    disputa = db.query(Disputa).filter(Disputa.id == disputa_id).first()
    if not disputa:
        raise HTTPException(status_code=404, detail="Disputa no encontrada")
    if disputa.estado in (EstadoDisputa.resuelta.value, EstadoDisputa.cerrada.value):
        raise HTTPException(status_code=400, detail="La disputa ya está cerrada")
    orden = db.query(Orden).filter(Orden.id == disputa.orden_id).first()
    if not orden or not _autorizado_en_orden(db, orden, current_user):
        raise HTTPException(status_code=403, detail="No autorizado")

    ev = EvidenciaDisputa(
        id=str(uuid4()),
        disputa_id=disputa.id,
        subido_por_usuario_id=current_user["user_id"],
        url=datos.url,
        tipo=datos.tipo,
        descripcion=datos.descripcion,
    )
    if disputa.estado == EstadoDisputa.abierta.value:
        disputa.estado = EstadoDisputa.en_mediacion.value
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


@router.post("/{disputa_id}/mensajes", response_model=MensajeDisputaResponse, status_code=201)
async def mensaje_disputa(
    disputa_id: str,
    datos: MensajeDisputaCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    disputa = db.query(Disputa).filter(Disputa.id == disputa_id).first()
    if not disputa:
        raise HTTPException(status_code=404, detail="Disputa no encontrada")
    if disputa.estado in (EstadoDisputa.resuelta.value, EstadoDisputa.cerrada.value):
        raise HTTPException(status_code=400, detail="La disputa ya está cerrada")
    orden = db.query(Orden).filter(Orden.id == disputa.orden_id).first()
    if not orden or not _autorizado_en_orden(db, orden, current_user):
        raise HTTPException(status_code=403, detail="No autorizado")

    tipo = TipoMensajeDisputa.admin.value if current_user["rol"] == "admin" else TipoMensajeDisputa.texto.value
    msg = MensajeDisputa(
        id=str(uuid4()),
        disputa_id=disputa.id,
        autor_id=current_user["user_id"],
        contenido=datos.contenido,
        tipo=tipo,
    )
    if disputa.estado == EstadoDisputa.abierta.value:
        disputa.estado = EstadoDisputa.en_mediacion.value
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg
