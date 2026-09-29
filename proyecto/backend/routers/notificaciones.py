"""Bandeja de notificaciones in-app del usuario autenticado."""
import asyncio
import logging
from datetime import datetime
from typing import AsyncIterator, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.orm import Session

import config

from models.notificacion import Notificacion
from schemas.notificacion import (
    NotificacionResponse,
    NotificacionesListaResponse,
    MarcarLeidasResponse,
)
from services import notificaciones_tiempo_real as tiempo_real
from services.token_revocation import consumir_ticket_ws, crear_ticket_ws
from utils.dependencies import get_db, get_current_user, security
from utils.limiter import limiter, RATE_LIMIT_NOTIFICACIONES

logger = logging.getLogger("importacionesq8")

router = APIRouter(prefix="/notificaciones", tags=["Notificaciones"])

# Los tickets de WS y de este stream comparten almacén; este "destino" evita
# que un ticket emitido para un chat sirva aquí y viceversa.
_DESTINO_TICKET_STREAM = "stream-notificaciones"
# Comentario SSE periódico: mantiene viva la conexión a través de proxies y
# permite notar que el cliente se fue.
_HEARTBEAT_SEGUNDOS = 25


class StreamTicketResponse(BaseModel):
    ticket: str
    expires_in_seconds: int = 60


@router.get("", response_model=NotificacionesListaResponse)
@limiter.limit(RATE_LIMIT_NOTIFICACIONES)
async def listar_notificaciones(
    request: Request,
    solo_no_leidas: Optional[bool] = Query(False, description="Si true, solo no leídas"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0, le=10_000),
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


def _marcar_leida(db: Session, notificacion_id: str, usuario_id: str) -> NotificacionResponse:
    notif = db.query(Notificacion).filter(
        Notificacion.id == notificacion_id,
        Notificacion.usuario_id == usuario_id,
    ).first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notificación no encontrada")

    if not notif.leida:
        notif.leida = True
        notif.fecha_lectura = datetime.utcnow()
        db.commit()
        db.refresh(notif)

    return NotificacionResponse.model_validate(notif)


@router.put("/{notificacion_id}/leer", response_model=NotificacionResponse)
async def marcar_leida(
    notificacion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Marca una notificación propia como leída."""
    return _marcar_leida(db, notificacion_id, current_user["user_id"])


@router.patch("/{notificacion_id}/leida", response_model=NotificacionResponse)
async def actualizar_leida(
    notificacion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Pone `leida = True` cuando el usuario interactúa con la notificación. Idempotente."""
    return _marcar_leida(db, notificacion_id, current_user["user_id"])


# ==================== Tiempo real (Server-Sent Events) ====================

@router.post("/stream-ticket", response_model=StreamTicketResponse)
async def emitir_ticket_stream(current_user: dict = Depends(get_current_user)):
    """Ticket de un solo uso (60 s) para abrir el stream con `EventSource`, que no
    permite mandar el header Authorization. Evita poner el JWT en la URL."""
    ticket = crear_ticket_ws(current_user["user_id"], _DESTINO_TICKET_STREAM, ttl_seconds=60)
    return StreamTicketResponse(ticket=ticket)


async def _usuario_del_stream(
    ticket: Optional[str],
    credentials: Optional[HTTPAuthorizationCredentials],
    db: Session,
) -> str:
    if ticket:
        consumido = consumir_ticket_ws(ticket)
        if not consumido or consumido[1] != _DESTINO_TICKET_STREAM:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Ticket inválido o expirado")
        from models.usuario import Usuario

        activo = db.query(Usuario.id).filter(Usuario.id == consumido[0], Usuario.activo.is_(True)).first()
        if not activo:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario inactivo")
        return consumido[0]
    usuario = await get_current_user(credentials, db)
    return usuario["user_id"]


async def _eventos_memoria(request: Request, usuario_id: str) -> AsyncIterator[str]:
    cola = tiempo_real.suscribir(usuario_id)
    try:
        while not await request.is_disconnected():
            try:
                mensaje = await asyncio.wait_for(cola.get(), timeout=_HEARTBEAT_SEGUNDOS)
            except asyncio.TimeoutError:
                yield ": ping\n\n"
                continue
            yield f"event: notificacion\ndata: {mensaje}\n\n"
    finally:
        tiempo_real.desuscribir(usuario_id, cola)


async def _eventos_redis(request: Request, usuario_id: str) -> AsyncIterator[str]:
    pubsub = config.redis_client.pubsub()
    pubsub.subscribe(tiempo_real.canal_usuario(usuario_id))
    loop = asyncio.get_running_loop()
    silencio = 0.0
    try:
        while not await request.is_disconnected():
            mensaje = await loop.run_in_executor(None, pubsub.get_message, True, 1.0)
            if mensaje and mensaje.get("type") == "message":
                silencio = 0.0
                yield f"event: notificacion\ndata: {mensaje['data']}\n\n"
                continue
            silencio += 1.0
            if silencio >= _HEARTBEAT_SEGUNDOS:
                silencio = 0.0
                yield ": ping\n\n"
    finally:
        try:
            pubsub.close()
        except Exception:
            pass


@router.get("/stream")
async def stream_notificaciones(
    request: Request,
    ticket: Optional[str] = Query(None, description="Ticket de POST /notificaciones/stream-ticket"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
):
    """
    Stream SSE con las notificaciones nuevas del usuario, en cuanto se confirman
    en BD. Cada evento es `event: notificacion` con el JSON de `NotificacionResponse`.

    Auth: `?ticket=` (para `EventSource`) o header `Authorization: Bearer`.
    """
    usuario_id = await _usuario_del_stream(ticket, credentials, db)
    # La conexión dura lo que el usuario tenga la app abierta: cerrar la
    # transacción de lectura devuelve la conexión al pool mientras tanto.
    db.rollback()

    async def eventos() -> AsyncIterator[str]:
        yield "retry: 5000\n: conectado\n\n"
        fuente = _eventos_memoria
        if config.redis_client:
            try:
                await asyncio.to_thread(config.redis_client.ping)
                fuente = _eventos_redis
            except Exception:
                logger.warning("Redis no disponible; stream de notificaciones en memoria")
        async for evento in fuente(request, usuario_id):
            yield evento

    return StreamingResponse(
        eventos(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            # GZipMiddleware (Starlette 0.27) acumula el cuerpo antes de
            # enviarlo; declarar la codificación hace que lo deje pasar tal cual.
            "Content-Encoding": "identity",
        },
    )
