import asyncio
import json
import logging
from datetime import datetime
from uuid import UUID as PyUUID, uuid4
from typing import List, Optional

from sqlalchemy.exc import IntegrityError

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

import config
from models.chat import (
    ConversacionChat, LecturaConversacion, MensajeChat, PESO_URGENCIA,
    TipoConversacion, TipoMensajeChat, UrgenciaSoporte,
)
from models.documental import Archivo, MensajeAdjunto
from schemas.chat import (
    MensajeChatCreate, MensajeChatResponse, ConversacionChatResponse, IniciarChatRequest,
    IniciarChatInternoRequest, AbrirSoporteRequest, CerrarTicketRequest,
    EscalarTicketRequest, CalificarSoporteRequest,
)
from services.mesa_soporte import acotar_nivel, elegir_agente, nivel_inicial
from schemas.features import TraducirRequest, TraducirResponse
from utils.dependencies import get_db, get_current_user, require_rol_in
from utils.security import decode_access_token, JWTError
from services.token_revocation import crear_ticket_ws, consumir_ticket_ws, jti_revocado
from services.notificacion_service import crear_notificacion_best_effort
from services.documental_service import (
    clonar_archivo_para_chat,
    create_document_file,
    ensure_folder_path,
)
from models.usuario import ROLES_PLATAFORMA, Usuario
from models.cotizacion import Cotizacion
from models.propuesta import Propuesta, EstadoPropuesta
from pydantic import BaseModel
from utils.limiter import limiter, RATE_LIMIT_CHAT_MESSAGE

logger = logging.getLogger("importacionesq8")

router = APIRouter(prefix="/chat", tags=["Chat"])
ws_router = APIRouter(tags=["Chat"])


class WsTicketRequest(BaseModel):
    conversacion_id: str


class WsTicketResponse(BaseModel):
    ticket: str
    expires_in_seconds: int = 60


@router.post("/ws-ticket", response_model=WsTicketResponse)
async def emitir_ticket_ws(
    body: WsTicketRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Emite un ticket opaco de un solo uso (60s) para el handshake WebSocket.
    Preferir `?ticket=` frente a pasar el JWT en la query (OWASP A07).
    """
    conversacion = db.query(ConversacionChat).filter(ConversacionChat.id == body.conversacion_id).first()
    if not conversacion or not _verificar_acceso_conversacion(conversacion, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    ticket = crear_ticket_ws(current_user["user_id"], body.conversacion_id, ttl_seconds=60)
    return WsTicketResponse(ticket=ticket)


def _es_equipo_plataforma(rol: str) -> bool:
    """¿Es una cuenta interna de ImportacionesQ8 (administración o soporte)?

    Los agentes de soporte atienden los mismos hilos que un administrador; lo
    que no pueden es administrar la plataforma. Esa distinción vive en los
    endpoints, no aquí.
    """
    return rol in ROLES_PLATAFORMA


def _tipo_de(conversacion: ConversacionChat) -> str:
    return str(conversacion.tipo or TipoConversacion.negociacion.value)


def _es_interna(conversacion: ConversacionChat) -> bool:
    return _tipo_de(conversacion) == TipoConversacion.interna.value


def _es_soporte(conversacion: ConversacionChat) -> bool:
    return _tipo_de(conversacion) == TipoConversacion.soporte.value


def _verificar_acceso_conversacion(
    conversacion: ConversacionChat,
    current_user: dict,
    db: Optional[Session] = None,
) -> bool:
    """Solo el solicitante y el usuario de la empresa (dueño o asesor asignado)
    de esa conversación pueden leer/escribir mensajes en ella (evita IDOR entre
    conversaciones de otros clientes/empresas)."""
    user_id = current_user["user_id"]
    rol = current_user["rol"]

    if _es_soporte(conversacion):
        # Un ticket lo ven quien lo abrió y el equipo de la plataforma. Nadie más:
        # el usuario puede haber contado ahí datos de su operación.
        return _es_equipo_plataforma(rol) or conversacion.solicitante_id == user_id

    if _es_interna(conversacion):
        # Canal de coordinación de la empresa: el cliente nunca entra, ni
        # siquiera al hilo interno de la orden que él mismo encargó.
        if rol == "asesor":
            return conversacion.importador_usuario_id == user_id
        if rol == "importador":
            return bool(
                conversacion.importador_id
                and current_user.get("importador_id") == conversacion.importador_id
            )
        return _es_equipo_plataforma(rol)

    if rol == "solicitante":
        return conversacion.solicitante_id == user_id
    if rol == "asesor":
        return conversacion.importador_usuario_id == user_id
    if rol == "importador":
        if conversacion.importador_usuario_id == user_id:
            return True
        # El dueño supervisa las conversaciones de sus asesores: sin esto, un
        # asesor desactivado dejaba el hilo ilegible para toda la empresa.
        importador_id = current_user.get("importador_id")
        if db is None or not importador_id:
            return False
        contraparte = db.query(Usuario).filter(
            Usuario.id == conversacion.importador_usuario_id
        ).first()
        return bool(contraparte and contraparte.importador_id == importador_id)
    return _es_equipo_plataforma(rol)


def _nombre_de_usuario(db: Session, usuario_id: Optional[str]) -> Optional[str]:
    if not usuario_id:
        return None
    usuario = db.query(Usuario).filter(Usuario.id == str(usuario_id)).first()
    if not usuario:
        return None
    return usuario.nombre or usuario.email


def _contar_no_leidos(db: Session, conversacion_id: str, usuario_id: str) -> int:
    """Mensajes ajenos posteriores a la última lectura de este usuario.

    Sin marca de lectura cuentan todos los ajenos: una conversación que nunca se
    ha abierto está entera sin leer.
    """
    lectura = (
        db.query(LecturaConversacion)
        .filter(
            LecturaConversacion.conversacion_id == conversacion_id,
            LecturaConversacion.usuario_id == str(usuario_id),
        )
        .first()
    )

    consulta = db.query(func.count(MensajeChat.id)).filter(
        MensajeChat.conversacion_id == conversacion_id,
        MensajeChat.remitente_id != str(usuario_id),
    )
    if lectura is not None:
        consulta = consulta.filter(MensajeChat.fecha_envio > lectura.fecha_ultima_lectura)

    return int(consulta.scalar() or 0)


def _nombre_contraparte(db: Session, conversacion: ConversacionChat, current_user: dict) -> Optional[str]:
    """Con quién habla quien consulta.

    Se resuelve en el backend porque el frontend solo tiene ids de usuario, y
    pedir el directorio de la empresa entera para poner un nombre en la lista de
    chats sería exponer más de lo necesario.
    """
    user_id = current_user.get("user_id")

    if _es_soporte(conversacion):
        # Para el equipo de soporte la contraparte es quien pidió ayuda; para el
        # usuario, la plataforma.
        if conversacion.solicitante_id == user_id:
            return "Soporte ImportacionesQ8"
        return _nombre_de_usuario(db, conversacion.solicitante_id)

    if _es_interna(conversacion):
        if conversacion.importador_usuario_id == user_id:
            from models.importador import Importador

            empresa = (
                db.query(Importador).filter(Importador.id == conversacion.importador_id).first()
                if conversacion.importador_id
                else None
            )
            return empresa.nombre_empresa if empresa else "Mi empresa"
        return _nombre_de_usuario(db, conversacion.importador_usuario_id)

    if conversacion.solicitante_id == user_id:
        return _nombre_de_usuario(db, conversacion.importador_usuario_id)
    return _nombre_de_usuario(db, conversacion.solicitante_id)


def _respuesta_conversacion(
    db: Session,
    conversacion: ConversacionChat,
    current_user: dict,
    ultimo: Optional[MensajeChat] = None,
) -> ConversacionChatResponse:
    rol_solicitante = None
    if _es_soporte(conversacion) and conversacion.solicitante_id:
        autor = db.query(Usuario).filter(Usuario.id == conversacion.solicitante_id).first()
        rol_solicitante = autor.rol if autor else None

    return ConversacionChatResponse(
        id=str(conversacion.id),
        tipo=_tipo_de(conversacion),
        cerrada=bool(conversacion.cerrada),
        resolucion=conversacion.resolucion,
        cerrada_por_nombre=_nombre_de_usuario(db, conversacion.cerrada_por_usuario_id),
        fecha_cierre=conversacion.fecha_cierre,
        nivel=conversacion.nivel,
        agente_asignado_id=conversacion.agente_asignado_id,
        agente_nombre=_nombre_de_usuario(db, conversacion.agente_asignado_id),
        agente_nivel=(
            db.query(Usuario.nivel_soporte)
            .filter(Usuario.id == conversacion.agente_asignado_id)
            .scalar()
            if conversacion.agente_asignado_id
            else None
        ),
        calificacion=conversacion.calificacion,
        comentario_calificacion=conversacion.comentario_calificacion,
        cotizacion_id=conversacion.cotizacion_id,
        orden_id=conversacion.orden_id,
        solicitante_id=conversacion.solicitante_id,
        importador_usuario_id=conversacion.importador_usuario_id,
        importador_id=conversacion.importador_id,
        contraparte_nombre=_nombre_contraparte(db, conversacion, current_user),
        asunto=conversacion.asunto,
        urgencia=conversacion.urgencia,
        solicitante_rol=rol_solicitante,
        no_leidos=_contar_no_leidos(db, str(conversacion.id), current_user["user_id"]),
        fecha_creacion=conversacion.fecha_creacion,
        ultimo_mensaje=ultimo,
    )


def _persistir_adjuntos_chat(
    db: Session,
    *,
    mensaje: MensajeChat,
    owner_user_id: str,
    metadata: Optional[dict],
) -> None:
    if mensaje.tipo != TipoMensajeChat.archivo.value:
        return

    meta = metadata or {}
    linked_ids = []
    conversation_folder_id = ensure_folder_path(
        db,
        owner_user_id=owner_user_id,
        segments=["Chats", f"Conversacion-{mensaje.conversacion_id[:8]}"],
    )

    conversacion = (
        db.query(ConversacionChat)
        .filter(ConversacionChat.id == mensaje.conversacion_id)
        .first()
    )
    # Una copia por participante: el receptor la ve en su gestión documental y
    # queda autorizado a descargarla.
    destinatarios = {owner_user_id}
    if conversacion:
        destinatarios.add(conversacion.solicitante_id)
        destinatarios.add(conversacion.importador_usuario_id)

    for archivo_id in meta.get("archivo_ids", []) if isinstance(meta.get("archivo_ids"), list) else []:
        archivo = (
            db.query(Archivo)
            .filter(
                Archivo.id == str(archivo_id),
                # Solo se puede adjuntar lo propio: sin este filtro bastaba con
                # conocer un UUID ajeno para clonarlo dentro de una conversación
                # y darse acceso de descarga a un documento de otro usuario.
                Archivo.owner_user_id == owner_user_id,
                Archivo.deleted_at.is_(None),
            )
            .first()
        )
        if not archivo:
            continue
        for destinatario_id in destinatarios:
            cloned = clonar_archivo_para_chat(
                db,
                archivo=archivo,
                destinatario_id=destinatario_id,
                conversacion_id=mensaje.conversacion_id,
            )
            db.add(MensajeAdjunto(id=str(uuid4()), mensaje_id=mensaje.id, archivo_id=cloned.id))
            linked_ids.append(cloned.id)

    file_info = meta.get("file") if isinstance(meta.get("file"), dict) else None
    if file_info and not linked_ids:
        nombre = str(file_info.get("name") or f"adjunto_{mensaje.id}.txt").strip()[:255]
        extension = str(file_info.get("extension") or "").strip() or None
        mime_type = str(file_info.get("mime_type") or "").strip() or None
        size_bytes_raw = file_info.get("size_bytes")
        size_bytes = int(size_bytes_raw) if isinstance(size_bytes_raw, (int, float, str)) and str(size_bytes_raw).isdigit() else None
        storage_url = file_info.get("storage_url")
        if storage_url is not None:
            storage_url = str(storage_url).strip()[:500] or None

        archivo = create_document_file(
            db,
            owner_user_id=owner_user_id,
            nombre=nombre,
            carpeta_id=conversation_folder_id,
            extension=extension,
            mime_type=mime_type,
            size_bytes=size_bytes,
            storage_url=storage_url,
            storage_path=None,
            origen="chat",
        )
        db.add(MensajeAdjunto(id=str(uuid4()), mensaje_id=mensaje.id, archivo_id=archivo.id))


@router.post("/iniciar", response_model=ConversacionChatResponse, status_code=status.HTTP_201_CREATED)
async def iniciar_chat(
    datos: IniciarChatRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol_in("importador", "asesor")),
):
    """
    Inicia (o reutiliza) la conversación de negociación desde el lado de la empresa.

    Pensado para que el asesor abra el chat al enviar su propuesta, sin esperar
    a que el solicitante invoque `PUT /cotizaciones/{id}/propuestas/aceptar`.

    Alias conceptual del gap frontend: `POST /chats/iniciar` → implementado como
    `POST /chat/iniciar` (prefijo REST existente del módulo).
    """
    importador_id = current_user.get("importador_id")
    if not importador_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cuenta no está asociada a ninguna empresa importadora",
        )

    propuesta = None
    cotizacion = None

    if datos.propuesta_id:
        propuesta = db.query(Propuesta).filter(Propuesta.id == datos.propuesta_id).first()
        if not propuesta or propuesta.importador_id != importador_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Propuesta no encontrada")
        if propuesta.estado == EstadoPropuesta.borrador.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Envía la propuesta al solicitante antes de iniciar el chat",
            )
        cotizacion = db.query(Cotizacion).filter(Cotizacion.id == propuesta.cotizacion_id).first()
    else:
        cotizacion = db.query(Cotizacion).filter(Cotizacion.id == datos.cotizacion_id).first()
        if not cotizacion:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada")
        # Debe existir una propuesta enviada de esta empresa
        propuesta = db.query(Propuesta).filter(
            Propuesta.cotizacion_id == cotizacion.id,
            Propuesta.importador_id == importador_id,
            Propuesta.estado.in_([
                EstadoPropuesta.pendiente.value,
                EstadoPropuesta.aceptada.value,
            ]),
        ).first()
        if not propuesta:
            # 404 genérico: no revelar si la cotización existe a terceros (A01 enumeration)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cotización no encontrada o sin propuesta de tu empresa",
            )

    if not cotizacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada")

    # Autorización: asesor solo si está asignado (o nadie asignado aún)
    user_id = current_user["user_id"]
    rol = current_user["rol"]
    if rol == "asesor":
        if cotizacion.asesor_asignado_id and cotizacion.asesor_asignado_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo el asesor asignado puede iniciar esta negociación",
            )
        # Si nadie reclamó, el asesor que inicia queda como participante de empresa
        if not cotizacion.asesor_asignado_id:
            cotizacion.asesor_asignado_id = user_id

    conversacion = db.query(ConversacionChat).filter(
        ConversacionChat.cotizacion_id == cotizacion.id
    ).first()

    if not conversacion:
        # Preferir asesor asignado; si no, el usuario que inicia (dueño o asesor)
        importador_usuario_id = cotizacion.asesor_asignado_id or user_id
        conversacion = ConversacionChat(
            id=str(uuid4()),
            cotizacion_id=cotizacion.id,
            solicitante_id=cotizacion.solicitante_id,
            importador_usuario_id=importador_usuario_id,
        )
        db.add(conversacion)

        crear_notificacion_best_effort(
            db,
            usuario_id=cotizacion.solicitante_id,
            tipo="negociacion",
            titulo="Nueva conversación de negociación",
            mensaje="Un asesor abrió el chat de tu cotización.",
            data={
                "cotizacion_id": str(cotizacion.id),
                "conversacion_id": str(conversacion.id),
                "propuesta_id": str(propuesta.id) if propuesta else None,
            },
        )

    # Solo el participante de empresa de la conversación (o el dueño al crear) puede
    # adjuntar mensaje_inicial — evita inyección de mensajes por cuentas no participantes.
    puede_escribir = (
        conversacion.importador_usuario_id == user_id
        or (rol == "importador" and current_user.get("importador_id") == importador_id)
    )
    # Si el dueño escribe y no es el participante, traspasa el hilo al dueño
    # (mismo patrón de supervisión que el pre-aceptar).
    if rol == "importador" and conversacion.importador_usuario_id != user_id:
        conversacion.importador_usuario_id = user_id
        puede_escribir = True

    if datos.mensaje_inicial and datos.mensaje_inicial.strip():
        if not puede_escribir:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No autorizado para escribir en esta conversación",
            )
        db.flush()
        msg = MensajeChat(
            id=str(uuid4()),
            conversacion_id=conversacion.id,
            remitente_id=user_id,
            contenido=datos.mensaje_inicial.strip()[:2000],
            tipo=TipoMensajeChat.texto.value,
        )
        db.add(msg)

    db.commit()
    db.refresh(conversacion)

    ultimo = db.query(MensajeChat).filter(
        MensajeChat.conversacion_id == conversacion.id
    ).order_by(MensajeChat.fecha_envio.desc()).first()

    return _respuesta_conversacion(db, conversacion, current_user, ultimo)


@router.post("/interno", response_model=ConversacionChatResponse, status_code=status.HTTP_201_CREATED)
async def iniciar_chat_interno(
    datos: IniciarChatInternoRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol_in("importador", "asesor")),
):
    """Abre (o reutiliza) el canal de coordinación entre la empresa y un asesor.

    Es donde la empresa le dice al asesor cuándo mover el estado de una orden
    ("ya salió de fábrica", "está en aduana"). Va aparte del hilo de negociación
    porque el solicitante no debe leer la coordinación interna del equipo.

    Hay un único canal por asesor, no uno por orden: así el asesor no acaba con
    una lista de hilos idénticos y el historial de instrucciones queda junto.
    """
    importador_id = current_user.get("importador_id")
    if not importador_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cuenta no está asociada a ninguna empresa importadora",
        )

    user_id = current_user["user_id"]
    rol = current_user["rol"]

    if rol == "asesor":
        # El asesor solo puede abrir el suyo; indicar otro `asesor_id` sería
        # colarse en la coordinación de un compañero.
        asesor_id = user_id
    else:
        if not datos.asesor_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Indica el asesor con el que quieres abrir el canal interno",
            )
        asesor = db.query(Usuario).filter(
            Usuario.id == str(datos.asesor_id),
            Usuario.importador_id == importador_id,
            Usuario.rol == "asesor",
        ).first()
        if not asesor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ese asesor no pertenece a tu empresa",
            )
        asesor_id = str(asesor.id)

    conversacion = db.query(ConversacionChat).filter(
        ConversacionChat.tipo == TipoConversacion.interna.value,
        ConversacionChat.importador_id == importador_id,
        ConversacionChat.importador_usuario_id == asesor_id,
    ).first()

    if not conversacion:
        conversacion = ConversacionChat(
            id=str(uuid4()),
            tipo=TipoConversacion.interna.value,
            importador_id=importador_id,
            importador_usuario_id=asesor_id,
        )
        db.add(conversacion)
        db.flush()

    if datos.mensaje_inicial and datos.mensaje_inicial.strip():
        db.add(MensajeChat(
            id=str(uuid4()),
            conversacion_id=conversacion.id,
            remitente_id=user_id,
            contenido=datos.mensaje_inicial.strip()[:2000],
            tipo=TipoMensajeChat.texto.value,
        ))

    db.commit()
    db.refresh(conversacion)

    ultimo = db.query(MensajeChat).filter(
        MensajeChat.conversacion_id == conversacion.id
    ).order_by(MensajeChat.fecha_envio.desc()).first()

    return _respuesta_conversacion(db, conversacion, current_user, ultimo)


@router.post("/soporte", response_model=ConversacionChatResponse, status_code=status.HTTP_201_CREATED)
async def abrir_ticket_soporte(
    datos: AbrirSoporteRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol_in("solicitante", "importador", "asesor")),
):
    """Abre un ticket de soporte con el equipo de la plataforma.

    Lo puede pedir cualquier usuario de la plataforma —cliente, cuenta dueña o
    asesor—; hasta ahora no había ningún camino para hacerlo y las dudas se
    quedaban sin canal.

    Cada petición es un ticket propio: agrupar todo en un único hilo por usuario
    mezclaría problemas distintos y haría imposible priorizar por urgencia.
    """
    user_id = current_user["user_id"]

    # El nivel de partida sale de la urgencia; el agente que lo reciba puede
    # escalarlo al leerlo (ver POST /chat/soporte/{id}/escalar).
    nivel = nivel_inicial(datos.urgencia)
    agente = elegir_agente(db, nivel)

    conversacion = ConversacionChat(
        id=str(uuid4()),
        tipo=TipoConversacion.soporte.value,
        solicitante_id=user_id,
        asunto=datos.asunto.strip()[:160],
        urgencia=datos.urgencia,
        nivel=nivel,
        agente_asignado_id=str(agente.id) if agente else None,
    )
    db.add(conversacion)
    db.flush()

    if datos.mensaje and datos.mensaje.strip():
        db.add(MensajeChat(
            id=str(uuid4()),
            conversacion_id=conversacion.id,
            remitente_id=user_id,
            contenido=datos.mensaje.strip()[:2000],
            tipo=TipoMensajeChat.texto.value,
        ))

    quien = db.query(Usuario).filter(Usuario.id == user_id).first()
    nombre = (quien.nombre or quien.email) if quien else "Un usuario"

    from services.notificacion_service import crear_notificacion_best_effort

    if agente:
        # Con dueño asignado, el aviso va a quien tiene que actuar. Avisar a
        # todos convertiría la responsabilidad en tierra de nadie.
        destinatarios = [agente]
        titulo = f"Ticket nivel {nivel} ({datos.urgencia}): {datos.asunto.strip()[:70]}"
    else:
        # Sin nadie de ese nivel en la mesa, lo ve toda la administración para
        # que alguien lo tome o suba a alguien de nivel.
        destinatarios = db.query(Usuario).filter(
            Usuario.rol == "admin",
            Usuario.activo.is_(True),
        ).all()
        titulo = f"Ticket nivel {nivel} SIN AGENTE: {datos.asunto.strip()[:60]}"

    for destinatario in destinatarios:
        crear_notificacion_best_effort(
            db,
            usuario_id=str(destinatario.id),
            tipo="soporte",
            titulo=titulo,
            mensaje=f"{nombre} pidió ayuda.",
            data={
                "conversacion_id": str(conversacion.id),
                "urgencia": datos.urgencia,
                "nivel": nivel,
            },
        )

    db.commit()
    db.refresh(conversacion)

    ultimo = db.query(MensajeChat).filter(
        MensajeChat.conversacion_id == conversacion.id
    ).order_by(MensajeChat.fecha_envio.desc()).first()

    return _respuesta_conversacion(db, conversacion, current_user, ultimo)


def _ticket_o_404(db: Session, conversacion_id: str) -> ConversacionChat:
    conversacion = db.query(ConversacionChat).filter(ConversacionChat.id == conversacion_id).first()
    if not conversacion or not _es_soporte(conversacion):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket de soporte no encontrado")
    return conversacion


@router.post("/soporte/{conversacion_id}/cerrar", response_model=ConversacionChatResponse)
async def cerrar_ticket_soporte(
    conversacion_id: str,
    datos: CerrarTicketRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol_in("admin", "soporte")),
):
    """Cierra un ticket dejando escrito qué se hizo.

    El hilo no se borra ni se oculta a quien lo abrió: baja del listado de
    pendientes y queda consultable, que es lo que hace falta cuando el mismo
    problema reaparece semanas después.
    """
    conversacion = _ticket_o_404(db, conversacion_id)
    if conversacion.cerrada:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El ticket ya está cerrado")

    conversacion.cerrada = True
    conversacion.resolucion = datos.resolucion.strip()[:2000]
    conversacion.cerrada_por_usuario_id = current_user["user_id"]
    conversacion.fecha_cierre = datetime.utcnow()

    quien = db.query(Usuario).filter(Usuario.id == current_user["user_id"]).first()
    nombre = (quien.nombre or quien.email) if quien else "El equipo de soporte"

    db.add(MensajeChat(
        id=str(uuid4()),
        conversacion_id=conversacion.id,
        remitente_id=current_user["user_id"],
        contenido=f"Ticket cerrado por {nombre}. Resolución: {conversacion.resolucion}",
        tipo=TipoMensajeChat.sistema.value,
    ))

    from services.notificacion_service import notificar

    if conversacion.solicitante_id:
        notificar(
            db,
            usuario_id=str(conversacion.solicitante_id),
            tipo="soporte",
            titulo="Tu solicitud de soporte quedó resuelta",
            mensaje=conversacion.resolucion[:160],
            data={"conversacion_id": str(conversacion.id)},
            enlace_relativo="/chats",
        )

    db.commit()
    db.refresh(conversacion)

    ultimo = db.query(MensajeChat).filter(
        MensajeChat.conversacion_id == conversacion.id
    ).order_by(MensajeChat.fecha_envio.desc()).first()
    return _respuesta_conversacion(db, conversacion, current_user, ultimo)


@router.post("/soporte/{conversacion_id}/escalar", response_model=ConversacionChatResponse)
async def escalar_ticket_soporte(
    conversacion_id: str,
    datos: EscalarTicketRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol_in("admin", "soporte")),
):
    """Sube el ticket de nivel y lo reasigna a alguien que pueda con él.

    El nivel inicial se deduce de la urgencia que marcó el usuario, que sabe
    cuánta prisa le corre pero no lo difícil que es. Esta es la corrección: el
    agente que lo lee y ve que le queda grande lo escala, y el ticket pasa a
    otra persona en lugar de quedarse encallado.
    """
    conversacion = _ticket_o_404(db, conversacion_id)

    nivel_nuevo = acotar_nivel(datos.nivel)
    if nivel_nuevo <= (conversacion.nivel or 1):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Escalar es subir de nivel; para bajarlo, ciérralo y resuélvelo tú.",
        )

    anterior = conversacion.nivel or 1
    conversacion.nivel = nivel_nuevo

    agente = elegir_agente(db, nivel_nuevo)
    conversacion.agente_asignado_id = str(agente.id) if agente else None

    quien = db.query(Usuario).filter(Usuario.id == current_user["user_id"]).first()
    nombre = (quien.nombre or quien.email) if quien else "Un agente"
    destino = (agente.nombre or agente.email) if agente else "nadie todavía"

    detalle = f" Motivo: {datos.motivo.strip()}" if datos.motivo and datos.motivo.strip() else ""
    db.add(MensajeChat(
        id=str(uuid4()),
        conversacion_id=conversacion.id,
        remitente_id=current_user["user_id"],
        contenido=(
            f"{nombre} escaló el ticket de nivel {anterior} a nivel {nivel_nuevo}. "
            f"Pasa a {destino}.{detalle}"
        ),
        tipo=TipoMensajeChat.sistema.value,
    ))

    from services.notificacion_service import crear_notificacion_best_effort

    if agente:
        crear_notificacion_best_effort(
            db,
            usuario_id=str(agente.id),
            tipo="soporte",
            titulo=f"Ticket escalado a nivel {nivel_nuevo}: {conversacion.asunto or 'sin asunto'}",
            mensaje=f"{nombre} te lo pasó.",
            data={"conversacion_id": str(conversacion.id), "nivel": nivel_nuevo},
        )

    db.commit()
    db.refresh(conversacion)

    ultimo = db.query(MensajeChat).filter(
        MensajeChat.conversacion_id == conversacion.id
    ).order_by(MensajeChat.fecha_envio.desc()).first()
    return _respuesta_conversacion(db, conversacion, current_user, ultimo)


@router.post("/soporte/{conversacion_id}/calificar", response_model=ConversacionChatResponse)
async def calificar_soporte(
    conversacion_id: str,
    datos: CalificarSoporteRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Puntúa el servicio recibido, de 1 a 5.

    Solo quien pidió la ayuda, y solo con el ticket cerrado: antes del cierre se
    estaría puntuando una promesa. Se puntúa una vez; permitir cambiarla haría
    que la nota dependiera del último enfado y no del servicio.
    """
    conversacion = _ticket_o_404(db, conversacion_id)

    if conversacion.solicitante_id != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo quien pidió el soporte puede calificarlo",
        )
    if not conversacion.cerrada:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Podrás calificar cuando el ticket esté cerrado",
        )
    if conversacion.calificacion is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este ticket ya fue calificado",
        )

    conversacion.calificacion = datos.calificacion
    conversacion.comentario_calificacion = (datos.comentario or "").strip()[:1000] or None
    conversacion.fecha_calificacion = datetime.utcnow()

    db.add(MensajeChat(
        id=str(uuid4()),
        conversacion_id=conversacion.id,
        remitente_id=current_user["user_id"],
        contenido=(
            f"El usuario calificó la atención con {datos.calificacion} de 5."
            + (f" Comentario: {conversacion.comentario_calificacion}" if conversacion.comentario_calificacion else "")
        ),
        tipo=TipoMensajeChat.sistema.value,
    ))

    db.commit()
    db.refresh(conversacion)

    ultimo = db.query(MensajeChat).filter(
        MensajeChat.conversacion_id == conversacion.id
    ).order_by(MensajeChat.fecha_envio.desc()).first()
    return _respuesta_conversacion(db, conversacion, current_user, ultimo)


@router.post("/soporte/{conversacion_id}/reabrir", response_model=ConversacionChatResponse)
async def reabrir_ticket_soporte(
    conversacion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Reabre un ticket cerrado.

    Lo puede hacer el equipo de la plataforma o quien lo abrió: si el problema no
    quedó resuelto, obligarle a empezar un ticket nuevo pierde todo el hilo de lo
    ya hablado.
    """
    conversacion = _ticket_o_404(db, conversacion_id)

    es_dueño = conversacion.solicitante_id == current_user["user_id"]
    if not _es_equipo_plataforma(current_user["rol"]) and not es_dueño:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado sobre este ticket")

    if not conversacion.cerrada:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El ticket ya está abierto")

    conversacion.cerrada = False
    conversacion.fecha_cierre = None
    conversacion.cerrada_por_usuario_id = None

    quien = db.query(Usuario).filter(Usuario.id == current_user["user_id"]).first()
    nombre = (quien.nombre or quien.email) if quien else "Un participante"

    db.add(MensajeChat(
        id=str(uuid4()),
        conversacion_id=conversacion.id,
        remitente_id=current_user["user_id"],
        contenido=f"{nombre} reabrió el ticket: el asunto sigue sin resolverse.",
        tipo=TipoMensajeChat.sistema.value,
    ))

    if es_dueño:
        from services.notificacion_service import crear_notificacion_best_effort

        for miembro in db.query(Usuario).filter(
            Usuario.rol.in_(ROLES_PLATAFORMA), Usuario.activo.is_(True)
        ).all():
            crear_notificacion_best_effort(
                db,
                usuario_id=str(miembro.id),
                tipo="soporte",
                titulo=f"Ticket reabierto: {conversacion.asunto or 'sin asunto'}",
                mensaje=f"{nombre} indica que el problema sigue.",
                data={"conversacion_id": str(conversacion.id)},
            )

    db.commit()
    db.refresh(conversacion)

    ultimo = db.query(MensajeChat).filter(
        MensajeChat.conversacion_id == conversacion.id
    ).order_by(MensajeChat.fecha_envio.desc()).first()
    return _respuesta_conversacion(db, conversacion, current_user, ultimo)


@router.post("/conversaciones/{conversacion_id}/leida", status_code=status.HTTP_204_NO_CONTENT)
async def marcar_conversacion_leida(
    conversacion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Deja constancia de que este usuario ya leyó el hilo hasta ahora."""
    conversacion = db.query(ConversacionChat).filter(ConversacionChat.id == conversacion_id).first()
    if not conversacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversación no encontrada")
    if not _verificar_acceso_conversacion(conversacion, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado para ver esta conversación")

    user_id = str(current_user["user_id"])
    lectura = (
        db.query(LecturaConversacion)
        .filter(
            LecturaConversacion.conversacion_id == conversacion_id,
            LecturaConversacion.usuario_id == user_id,
        )
        .first()
    )
    if lectura is None:
        db.add(LecturaConversacion(
            id=str(uuid4()),
            conversacion_id=conversacion_id,
            usuario_id=user_id,
            fecha_ultima_lectura=datetime.utcnow(),
        ))
    else:
        lectura.fecha_ultima_lectura = datetime.utcnow()

    try:
        db.commit()
    except IntegrityError:
        # Dos pestañas abriendo el mismo hilo a la vez: la marca ya existe y da
        # igual cuál de las dos ganó.
        db.rollback()

    return None


@router.get("/conversaciones", response_model=List[ConversacionChatResponse])
async def listar_mis_conversaciones(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Lista las conversaciones de chat del usuario autenticado (solicitante o cuenta de empresa)."""
    try:
        user_id_str = str(PyUUID(current_user["user_id"]))
    except (KeyError, ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario autenticado inválido")

    try:
        rol = current_user["rol"]

        query = db.query(ConversacionChat)
        if rol == "soporte":
            # Un agente ve lo suyo y lo que nadie ha tomado. Enseñarle los
            # tickets de sus compañeros convertiría la asignación en decorado.
            query = query.filter(
                ConversacionChat.tipo == TipoConversacion.soporte.value,
                or_(
                    ConversacionChat.agente_asignado_id == user_id_str,
                    ConversacionChat.agente_asignado_id.is_(None),
                ),
            )
        elif rol == "admin":
            # La bandeja del equipo de la plataforma son los tickets de soporte,
            # no las conversaciones ajenas: para supervisar existe el panel de
            # administración, que además pagina y filtra.
            query = query.filter(ConversacionChat.tipo == TipoConversacion.soporte.value)
        elif rol == "solicitante":
            # `solicitante_id` es NULL en las internas, así que este filtro ya
            # las deja fuera por sí solo; sus tickets de soporte sí entran,
            # porque en ellos es quien pidió ayuda.
            query = query.filter(ConversacionChat.solicitante_id == user_id_str)
        elif rol == "asesor":
            query = query.filter(
                or_(
                    ConversacionChat.importador_usuario_id == user_id_str,
                    # Sus propios tickets de soporte.
                    and_(
                        ConversacionChat.tipo == TipoConversacion.soporte.value,
                        ConversacionChat.solicitante_id == user_id_str,
                    ),
                )
            )
        elif rol == "importador":
            # El dueño ve además las conversaciones de sus asesores: si un asesor
            # queda desactivado, su hilo seguía existiendo pero desaparecía de la
            # bandeja de la empresa y nadie podía retomarlo.
            importador_id = current_user.get("importador_id")
            cuentas_empresa = [user_id_str]
            if importador_id:
                cuentas_empresa = [
                    str(fila[0])
                    for fila in db.query(Usuario.id).filter(
                        Usuario.importador_id == importador_id
                    ).all()
                ] or [user_id_str]
            query = query.filter(
                or_(
                    ConversacionChat.importador_usuario_id.in_(cuentas_empresa),
                    and_(
                        ConversacionChat.tipo == TipoConversacion.soporte.value,
                        ConversacionChat.solicitante_id == user_id_str,
                    ),
                )
            )
        else:
            query = query.limit(50)

        conversaciones = query.order_by(ConversacionChat.fecha_creacion.desc()).all()

        resultado = [
            _respuesta_conversacion(
                db,
                c,
                current_user,
                db.query(MensajeChat)
                .filter(MensajeChat.conversacion_id == c.id)
                .order_by(MensajeChat.fecha_envio.desc())
                .first(),
            )
            for c in conversaciones
        ]

        # Los tickets de soporte se atienden por urgencia, no por antigüedad: uno
        # crítico abierto hace un minuto va antes que uno bajo de la semana
        # pasada. Lo ya cerrado baja del todo. El resto conserva el orden por
        # fecha.
        resultado.sort(
            key=lambda r: (
                0 if r.cerrada else 1,
                PESO_URGENCIA.get(r.urgencia or "", 0),
                r.fecha_creacion.timestamp() if r.fecha_creacion else 0,
            ),
            reverse=True,
        )
        return resultado
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error listando conversaciones para user_id=%s", user_id_str)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudieron listar las conversaciones") from exc


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

    if not _verificar_acceso_conversacion(conversacion, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado para ver esta conversación")

    mensajes = db.query(MensajeChat).filter(
        MensajeChat.conversacion_id == conversacion_id
    ).order_by(MensajeChat.fecha_envio.asc()).all()

    return mensajes


def _notificar_mensaje_chat(
    db: Session,
    *,
    conversacion: ConversacionChat,
    remitente_id: str,
    contenido: str,
    tipo: str,
) -> None:
    """Avisa al otro participante de que tiene un mensaje sin leer.

    Los canales externos (WhatsApp/correo) se silencian si ya hay un aviso de
    chat sin leer reciente: una conversación activa generaría un WhatsApp por
    cada frase enviada.
    """
    from datetime import datetime, timedelta

    from models.notificacion import Notificacion
    from services.notificacion_service import notificar

    if _es_soporte(conversacion):
        # Escribe el usuario: contesta el equipo de la plataforma (todos, porque
        # los tickets no se asignan a nadie en concreto).
        if str(conversacion.solicitante_id) == str(remitente_id):
            for admin in db.query(Usuario).filter(
                Usuario.rol.in_(ROLES_PLATAFORMA), Usuario.activo.is_(True)
            ).all():
                notificar(
                    db,
                    usuario_id=str(admin.id),
                    tipo="soporte",
                    titulo=f"Soporte: {conversacion.asunto or 'nuevo mensaje'}",
                    mensaje=(contenido or "")[:160],
                    data={"conversacion_id": str(conversacion.id), "urgencia": conversacion.urgencia},
                    enlace_relativo="/chats",
                )
            return
        destinatario_id = conversacion.solicitante_id
    elif _es_interna(conversacion):
        if str(conversacion.importador_usuario_id) == str(remitente_id):
            # Escribe el asesor: contesta la cuenta dueña de la empresa.
            dueño = db.query(Usuario).filter(
                Usuario.importador_id == conversacion.importador_id,
                Usuario.rol == "importador",
            ).first()
            destinatario_id = str(dueño.id) if dueño else None
        else:
            destinatario_id = conversacion.importador_usuario_id
    else:
        destinatario_id = (
            conversacion.importador_usuario_id
            if str(conversacion.solicitante_id) == str(remitente_id)
            else conversacion.solicitante_id
        )
    if not destinatario_id or str(destinatario_id) == str(remitente_id):
        return

    remitente = db.query(Usuario).filter(Usuario.id == str(remitente_id)).first()
    quien = (remitente.nombre or remitente.email) if remitente else "Tu contraparte"

    reciente = (
        db.query(Notificacion.id)
        .filter(
            Notificacion.usuario_id == str(destinatario_id),
            Notificacion.tipo == "chat",
            Notificacion.leida.is_(False),
            Notificacion.fecha_creacion >= datetime.utcnow() - timedelta(minutes=10),
        )
        .first()
        is not None
    )

    resumen = "Te envió un archivo." if tipo == TipoMensajeChat.archivo.value else (contenido or "")[:160]

    notificar(
        db,
        usuario_id=str(destinatario_id),
        tipo="chat",
        titulo=f"Nuevo mensaje de {quien}",
        mensaje=resumen,
        data={
            "conversacion_id": str(conversacion.id),
            "cotizacion_id": str(conversacion.cotizacion_id) if conversacion.cotizacion_id else None,
        },
        enlace_relativo="/chats",
        whatsapp=not reciente,
        email=not reciente,
    )


@router.post("/conversaciones/{conversacion_id}/mensajes", response_model=MensajeChatResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(RATE_LIMIT_CHAT_MESSAGE)
async def enviar_mensaje(
    request: Request,
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

    if not _verificar_acceso_conversacion(conversacion, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado para escribir en esta conversación")

    user_id_str = str(PyUUID(current_user["user_id"]))
    nuevo_mensaje = MensajeChat(
        id=str(uuid4()),
        conversacion_id=conversacion_id,
        remitente_id=user_id_str,
        contenido=datos.contenido,
        tipo=datos.tipo,
        metadata_json=datos.metadata,
    )
    db.add(nuevo_mensaje)
    db.flush()
    _persistir_adjuntos_chat(
        db,
        mensaje=nuevo_mensaje,
        owner_user_id=user_id_str,
        metadata=datos.metadata,
    )
    if nuevo_mensaje.tipo != TipoMensajeChat.sistema.value:
        _notificar_mensaje_chat(
            db,
            conversacion=conversacion,
            remitente_id=user_id_str,
            contenido=nuevo_mensaje.contenido,
            tipo=str(nuevo_mensaje.tipo),
        )
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
                    "metadata": nuevo_mensaje.metadata_json,
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
    if not conversacion or not _verificar_acceso_conversacion(conversacion, current_user, db):
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
    ticket: Optional[str] = Query(None),
    token: Optional[str] = Query(None, deprecated=True),
    db: Session = Depends(get_db)
):
    """
    Canal de negociación en tiempo real.

    Auth preferida: `?ticket=` (ticket de un solo uso vía POST /chat/ws-ticket).
    `?token=` JWT se acepta por compatibilidad pero está deprecado (fuga en logs).
    """
    current_user = None

    if ticket:
        consumed = consumir_ticket_ws(ticket)
        if not consumed:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        user_id, ticket_conv = consumed
        if ticket_conv != conversacion_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        usuario = db.query(Usuario).filter(Usuario.id == user_id, Usuario.activo == True).first()  # noqa: E712
        if not usuario:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        current_user = {
            "user_id": str(usuario.id),
            "rol": usuario.rol,
            "importador_id": usuario.importador_id,
        }
    elif token:
        try:
            payload = decode_access_token(token)
            jti = payload.get("jti")
            if jti_revocado(db, jti):
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
            usuario = db.query(Usuario).filter(
                Usuario.id == str(payload.get("sub")),
                Usuario.activo == True,  # noqa: E712
            ).first()
            if not usuario:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
            current_user = {
                "user_id": str(usuario.id),
                "rol": usuario.rol,
                "importador_id": usuario.importador_id,
            }
        except (JWTError, Exception):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    else:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    conversacion = db.query(ConversacionChat).filter(ConversacionChat.id == conversacion_id).first()
    if not conversacion or not _verificar_acceso_conversacion(conversacion, current_user, db):
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
                metadata = payload_msg.get("metadata") if isinstance(payload_msg.get("metadata"), dict) else None
            except (json.JSONDecodeError, AttributeError):
                contenido = data
                tipo = "texto"
                metadata = None

            if not contenido:
                continue

            user_id_str = str(PyUUID(current_user["user_id"]))
            nuevo_mensaje = MensajeChat(
                id=str(uuid4()),
                conversacion_id=conversacion_id,
                remitente_id=user_id_str,
                contenido=contenido,
                tipo=tipo,
                metadata_json=metadata,
            )
            db.add(nuevo_mensaje)
            db.flush()
            _persistir_adjuntos_chat(
                db,
                mensaje=nuevo_mensaje,
                owner_user_id=user_id_str,
                metadata=metadata,
            )
            if nuevo_mensaje.tipo != TipoMensajeChat.sistema.value:
                _notificar_mensaje_chat(
                    db,
                    conversacion=conversacion,
                    remitente_id=user_id_str,
                    contenido=nuevo_mensaje.contenido,
                    tipo=str(nuevo_mensaje.tipo),
                )
            db.commit()
            db.refresh(nuevo_mensaje)

            mensaje_json = json.dumps({
                "id": str(nuevo_mensaje.id),
                "conversacion_id": conversacion_id,
                "remitente_id": user_id_str,
                "contenido": nuevo_mensaje.contenido,
                "tipo": nuevo_mensaje.tipo,
                "metadata": nuevo_mensaje.metadata_json,
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
