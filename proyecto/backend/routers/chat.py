import asyncio
import json
import logging
from uuid import UUID as PyUUID, uuid4
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

import config
from models.chat import ConversacionChat, MensajeChat
from schemas.chat import MensajeChatCreate, MensajeChatResponse, ConversacionChatResponse
from schemas.features import TraducirRequest, TraducirResponse
from utils.dependencies import get_db, get_current_user
from utils.security import decode_access_token

logger = logging.getLogger("importacionesq8")

router = APIRouter(prefix="/chat", tags=["Chat"])
ws_router = APIRouter(tags=["Chat"])


def _verificar_acceso_conversacion(conversacion: ConversacionChat, current_user: dict) -> bool:
    """Solo el solicitante y el usuario de la empresa (dueño o asesor asignado)
    de esa conversación pueden leer/escribir mensajes en ella (evita IDOR entre
    conversaciones de otros clientes/empresas)."""
    user_id = current_user["user_id"]
    if current_user["rol"] == "solicitante":
        return conversacion.solicitante_id == user_id
    if current_user["rol"] in ("importador", "asesor"):
        return conversacion.importador_usuario_id == user_id
    return current_user["rol"] == "admin"


@router.get("/conversaciones", response_model=List[ConversacionChatResponse])
async def listar_mis_conversaciones(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Lista las conversaciones de chat del usuario autenticado (solicitante o cuenta de empresa)."""
    user_id_str = str(PyUUID(current_user["user_id"]))
    rol = current_user["rol"]

    query = db.query(ConversacionChat)
    if rol == "solicitante":
        query = query.filter(ConversacionChat.solicitante_id == user_id_str)
    elif rol in ("importador", "asesor"):
        query = query.filter(ConversacionChat.importador_usuario_id == user_id_str)
    else:
        query = query.limit(50)

    conversaciones = query.order_by(ConversacionChat.fecha_creacion.desc()).all()

    resultado = []
    for c in conversaciones:
        ultimo = db.query(MensajeChat).filter(
            MensajeChat.conversacion_id == c.id
        ).order_by(MensajeChat.fecha_envio.desc()).first()
        resultado.append(ConversacionChatResponse(
            id=str(c.id),
            cotizacion_id=c.cotizacion_id,
            orden_id=c.orden_id,
            solicitante_id=c.solicitante_id,
            importador_usuario_id=c.importador_usuario_id,
            fecha_creacion=c.fecha_creacion,
            ultimo_mensaje=ultimo
        ))
    return resultado


@router.get("/conversaciones/{conversacion_id}/mensajes", response_model=List[MensajeChatResponse])
async def listar_mensajes(
    conversacion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Historial de mensajes de una conversación (fallback REST sin WebSocket)."""
    conversacion = db.query(ConversacionChat).filter(ConversacionChat.id == conversacion_id).first()
    if not conversacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversación no encontrada")

    if not _verificar_acceso_conversacion(conversacion, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado para ver esta conversación")

    mensajes = db.query(MensajeChat).filter(
        MensajeChat.conversacion_id == conversacion_id
    ).order_by(MensajeChat.fecha_envio.asc()).all()

    return mensajes


@router.post("/conversaciones/{conversacion_id}/mensajes", response_model=MensajeChatResponse, status_code=status.HTTP_201_CREATED)
async def enviar_mensaje(
    conversacion_id: str,
    datos: MensajeChatCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Envía un mensaje por REST (fallback cuando el cliente no usa WebSocket).
    También publica el mensaje en Redis para que quien esté conectado por WS lo reciba."""
    conversacion = db.query(ConversacionChat).filter(ConversacionChat.id == conversacion_id).first()
    if not conversacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversación no encontrada")

    if not _verificar_acceso_conversacion(conversacion, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado para escribir en esta conversación")

    user_id_str = str(PyUUID(current_user["user_id"]))
    nuevo_mensaje = MensajeChat(
        id=str(uuid4()),
        conversacion_id=conversacion_id,
        remitente_id=user_id_str,
        contenido=datos.contenido,
        tipo=datos.tipo
    )
    db.add(nuevo_mensaje)
    db.commit()
    db.refresh(nuevo_mensaje)

    if config.redis_client:
        try:
            config.redis_client.publish(
                f"chat:{conversacion_id}",
                json.dumps({
                    "id": str(nuevo_mensaje.id),
                    "conversacion_id": conversacion_id,
                    "remitente_id": user_id_str,
                    "contenido": nuevo_mensaje.contenido,
                    "tipo": nuevo_mensaje.tipo,
                    "fecha_envio": nuevo_mensaje.fecha_envio.isoformat()
                })
            )
        except Exception:
            logger.warning("No se pudo publicar mensaje de chat en Redis para conversación %s", conversacion_id)

    return nuevo_mensaje


@router.post("/traducir", response_model=TraducirResponse)
async def traducir_preview(
    datos: TraducirRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Traduce texto libre (preview) sin asociarlo a un mensaje."""
    from services.translation_service import traducir_texto
    from schemas.features import TraducirResponse

    if not datos.texto:
        raise HTTPException(status_code=400, detail="texto es obligatorio")
    original, traducido, origen = traducir_texto(db, datos.texto, datos.idioma_destino)
    return TraducirResponse(
        original=original,
        traducido=traducido,
        idioma_origen_detectado=origen,
        idioma_destino=datos.idioma_destino,
    )


@router.post("/mensajes/{mensaje_id}/traducir", response_model=TraducirResponse)
async def traducir_mensaje(
    mensaje_id: str,
    datos: TraducirRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Traduce un mensaje existente y cachea el resultado en metadata del mensaje."""
    from services.translation_service import traducir_texto
    from schemas.features import TraducirResponse

    mensaje = db.query(MensajeChat).filter(MensajeChat.id == mensaje_id).first()
    if not mensaje:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    conversacion = db.query(ConversacionChat).filter(ConversacionChat.id == mensaje.conversacion_id).first()
    if not conversacion or not _verificar_acceso_conversacion(conversacion, current_user):
        raise HTTPException(status_code=403, detail="No autorizado")

    meta = dict(mensaje.metadata_json or {})
    traducciones = dict(meta.get("traducciones") or {})
    if datos.idioma_destino in traducciones:
        return TraducirResponse(
            original=mensaje.contenido,
            traducido=traducciones[datos.idioma_destino],
            idioma_origen_detectado=meta.get("idioma_origen", "es"),
            idioma_destino=datos.idioma_destino,
        )

    original, traducido, origen = traducir_texto(db, mensaje.contenido, datos.idioma_destino)
    traducciones[datos.idioma_destino] = traducido
    meta["traducciones"] = traducciones
    meta["idioma_origen"] = origen
    mensaje.metadata_json = meta
    db.commit()

    return TraducirResponse(
        original=original,
        traducido=traducido,
        idioma_origen_detectado=origen,
        idioma_destino=datos.idioma_destino,
    )


@ws_router.websocket("/ws/chat/{conversacion_id}")
async def websocket_chat(
    websocket: WebSocket,
    conversacion_id: str,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Canal de negociación en tiempo real de una cotización aceptada/rechazada.

    Autenticación: el token JWT se pasa como query param (?token=...) porque los
    navegadores no permiten headers personalizados en el handshake de WebSocket.
    Solo el solicitante y el usuario de la empresa de esa conversación pueden conectarse.
    """
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        payload = decode_access_token(token)
        current_user = {
            "user_id": payload.get("sub"),
            "rol": payload.get("rol"),
            "importador_id": payload.get("importador_id")
        }
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    conversacion = db.query(ConversacionChat).filter(ConversacionChat.id == conversacion_id).first()
    if not conversacion or not _verificar_acceso_conversacion(conversacion, current_user):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()

    pubsub = None
    listener_task = None

    async def escuchar_redis():
        """Reenvía al cliente WS los mensajes publicados en Redis por otros procesos/pestañas."""
        loop = asyncio.get_event_loop()
        while True:
            mensaje = await loop.run_in_executor(None, pubsub.get_message, True, 1.0)
            if mensaje and mensaje.get("type") == "message":
                await websocket.send_text(mensaje["data"])
            await asyncio.sleep(0.01)

    if config.redis_client:
        try:
            pubsub = config.redis_client.pubsub()
            pubsub.subscribe(f"chat:{conversacion_id}")
            listener_task = asyncio.create_task(escuchar_redis())
        except Exception:
            logger.warning("Redis no disponible para el canal de chat %s, funcionando solo en memoria", conversacion_id)
            pubsub = None

    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload_msg = json.loads(data)
                contenido = payload_msg.get("contenido", "")
                tipo = payload_msg.get("tipo", "texto")
            except (json.JSONDecodeError, AttributeError):
                contenido = data
                tipo = "texto"

            if not contenido:
                continue

            user_id_str = str(PyUUID(current_user["user_id"]))
            nuevo_mensaje = MensajeChat(
                id=str(uuid4()),
                conversacion_id=conversacion_id,
                remitente_id=user_id_str,
                contenido=contenido,
                tipo=tipo
            )
            db.add(nuevo_mensaje)
            db.commit()
            db.refresh(nuevo_mensaje)

            mensaje_json = json.dumps({
                "id": str(nuevo_mensaje.id),
                "conversacion_id": conversacion_id,
                "remitente_id": user_id_str,
                "contenido": nuevo_mensaje.contenido,
                "tipo": nuevo_mensaje.tipo,
                "fecha_envio": nuevo_mensaje.fecha_envio.isoformat()
            })

            if config.redis_client:
                try:
                    config.redis_client.publish(f"chat:{conversacion_id}", mensaje_json)
                except Exception:
                    logger.warning("No se pudo publicar mensaje de chat en Redis para conversación %s", conversacion_id)
                    await websocket.send_text(mensaje_json)
            else:
                # Sin Redis, al menos se le confirma el mensaje a quien lo envió
                await websocket.send_text(mensaje_json)
    except WebSocketDisconnect:
        pass
    finally:
        if listener_task:
            listener_task.cancel()
        if pubsub:
            try:
                pubsub.close()
            except Exception:
                pass
