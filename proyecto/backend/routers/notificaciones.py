"""Bandeja de notificaciones in-app del usuario autenticado."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from models.notificacion import Notificacion
from schemas.notificacion import (
    NotificacionResponse,
    NotificacionesListaResponse,
    MarcarLeidasResponse,
)
from utils.dependencies import get_db, get_current_user

router = APIRouter(prefix="/notificaciones", tags=["Notificaciones"])


@router.get("", response_model=NotificacionesListaResponse)
async def listar_notificaciones(
    solo_no_leidas: Optional[bool] = Query(False, description="Si true, solo no leídas"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Lista las notificaciones reales del usuario logueado (persistidas en BD)."""
    usuario_id = current_user["user_id"]
    base = db.query(Notificacion).filter(Notificacion.usuario_id == usuario_id)

    no_leidas = base.filter(Notificacion.leida.is_(False)).count()
    total = base.count()

    query = base
    if solo_no_leidas:
        query = query.filter(Notificacion.leida.is_(False))

    items = (
        query.order_by(Notificacion.fecha_creacion.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return NotificacionesListaResponse(
        items=[NotificacionResponse.model_validate(n) for n in items],
        total=total,
        no_leidas=no_leidas,
    )


@router.put("/leer-todas", response_model=MarcarLeidasResponse)
async def marcar_todas_leidas(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Marca todas las notificaciones del usuario como leídas."""
    usuario_id = current_user["user_id"]
    ahora = datetime.utcnow()
    actualizadas = (
        db.query(Notificacion)
        .filter(Notificacion.usuario_id == usuario_id, Notificacion.leida.is_(False))
        .update({"leida": True, "fecha_lectura": ahora}, synchronize_session=False)
    )
    db.commit()
    return MarcarLeidasResponse(actualizadas=actualizadas)


@router.put("/{notificacion_id}/leer", response_model=NotificacionResponse)
async def marcar_leida(
    notificacion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Marca una notificación propia como leída."""
    notif = db.query(Notificacion).filter(
        Notificacion.id == notificacion_id,
        Notificacion.usuario_id == current_user["user_id"],
    ).first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notificación no encontrada")

    if not notif.leida:
        notif.leida = True
        notif.fecha_lectura = datetime.utcnow()
        db.commit()
        db.refresh(notif)

    return NotificacionResponse.model_validate(notif)
