"""Chat de las reservas de Liquidaciones.

Dónde viven los mensajes: en el chat compartido de la suite (MySQL,
`conversaciones_chat` de tipo "reserva" con `modulo="liquidaciones"`), igual que
la mesa de ayuda. Así salen en «Chats» con tiempo real, adjuntos y avisos, sin
repetir esa infraestructura en cada módulo. Los datos del negocio (lotes,
operaciones, comprobantes y facturas) siguen en la base propia del módulo (Mongo).

La conversación lleva el mismo id que la operación. La colección `mensajes` de
Mongo solo guarda el historial anterior a este cambio: la primera vez que se toca
una reserva vieja se copia al chat y la operación queda marcada con
`CAMPO_EN_SUITE`, así que no se vuelve a leer. Las reservas nuevas nacen marcadas.

Quién escribe: comprador y vendedor (desde la reserva o desde «Chats»). El equipo
de Zarpi lee, pero interviene solo desde el monitoreo de Liquidaciones, donde su
mensaje queda firmado como `AUTOR_EQUIPO`.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional
from uuid import uuid4

from pymongo.database import Database
from pymongo.errors import PyMongoError
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from liquidaciones.identidad import cuenta_de
from models.chat import ConversacionChat, MensajeChat, TipoConversacion
from models.usuario import Usuario

logger = logging.getLogger("importacionesq8")

CAMPO_EN_SUITE = "chat_en_suite"
AUTOR_EQUIPO = "Soporte Zarpi"
# Clave de `metadata` que solo escribe el backend (nombre del autor y documento
# adjunto). Lo que mande el cliente con esta clave se descarta.
CLAVE_METADATA = "liquidaciones"
ERRORES_CHAT = (SQLAlchemyError, PyMongoError, ValueError)


def _cuenta_de_usuario(usuario: Usuario) -> str:
    return cuenta_de({"user_id": str(usuario.id), "rol": usuario.rol, "importador_id": usuario.importador_id})


def actualizar_resumen(mongo: Database, sql: Session, operacion_id: str) -> None:
    """Contador y fecha del último mensaje en la operación (para el monitoreo)."""
    total, ultimo = sql.query(func.count(MensajeChat.id), func.max(MensajeChat.fecha_envio)).filter(
        MensajeChat.conversacion_id == operacion_id
    ).one()
    valores: Dict[str, Any] = {"total_mensajes": total}
    if ultimo:
        valores["ultimo_mensaje_en"] = ultimo
    try:
        mongo.operaciones.update_one({"_id": operacion_id}, {"$max": valores})
    except PyMongoError:
        logger.exception("No se pudo actualizar el resumen del chat de reserva %s", operacion_id)


def cuenta_participa(operacion: Dict, usuario: dict) -> bool:
    return lado_de_cuenta(operacion, cuenta_de(usuario)) is not None


def lado_de_cuenta(operacion: Dict, cuenta: str) -> Optional[str]:
    if cuenta == operacion["cuenta_comprador"]:
        return "comprador"
    if cuenta == operacion["cuenta_vendedor"]:
        return "vendedor"
    return None


def lados_de_usuarios(sql: Session, operacion: Dict, usuario_ids: Iterable[Any]) -> Dict[str, str]:
    """Lado de cada usuario (comprador, vendedor o equipo) en una sola consulta."""
    ids = {str(i) for i in usuario_ids if i}
    if not ids:
        return {}
    return {str(u.id): lado_de_cuenta(operacion, _cuenta_de_usuario(u)) or "equipo"
            for u in sql.query(Usuario).filter(Usuario.id.in_(ids)).all()}


def operacion_de_conversacion(mongo: Database, conversacion: ConversacionChat) -> Optional[Dict]:
    if conversacion.tipo != TipoConversacion.reserva.value:
        return None
    return mongo.operaciones.find_one({"_id": str(conversacion.id)})


def _comprador_id(mongo: Database, operacion: Dict) -> Optional[str]:
    comprador_id = operacion.get("comprador_usuario_id")
    if comprador_id:
        return str(comprador_id)
    cuenta = operacion["cuenta_comprador"]
    if cuenta.startswith("usuario:"):
        return cuenta.removeprefix("usuario:")
    activacion = mongo.activaciones.find_one({"_id": cuenta}) or {}
    return activacion.get("activada_por")


def _crear_conversacion(mongo: Database, sql: Session, operacion: Dict) -> ConversacionChat:
    ident = str(operacion["_id"])
    cuenta_vendedor = operacion["cuenta_vendedor"]
    comprador_id = _comprador_id(mongo, operacion)
    if not comprador_id or not sql.get(Usuario, comprador_id):
        raise ValueError(f"No se encontró el comprador de la reserva {ident}")
    conversacion = ConversacionChat(
        id=ident,
        tipo=TipoConversacion.reserva.value,
        solicitante_id=comprador_id,
        importador_id=cuenta_vendedor.removeprefix("empresa:") if cuenta_vendedor.startswith("empresa:") else None,
        modulo="liquidaciones",
        referencia=f"operacion:{ident}",
        asunto=operacion["lote"]["nombre"][:160],
        fecha_creacion=operacion["reservada_en"],
    )
    try:
        with sql.begin_nested():
            sql.add(conversacion)
            sql.flush()
    except IntegrityError:
        # Otra petición la creó al mismo tiempo.
        conversacion = sql.get(ConversacionChat, ident)
        if conversacion is None or conversacion.tipo != TipoConversacion.reserva.value:
            raise
    return conversacion


def _copiar_historial(mongo: Database, sql: Session, conversacion: ConversacionChat) -> List[MensajeChat]:
    """Copia (idempotente) los mensajes que la reserva tenía en Mongo."""
    ident = str(conversacion.id)
    mensajes = list(mongo.mensajes.find({"operacion_id": ident}).sort("fecha", 1))
    ids = [str(m["_id"]) for m in mensajes]
    existentes = dict(sql.query(MensajeChat.id, MensajeChat.conversacion_id)
                      .filter(MensajeChat.id.in_(ids)).all()) if ids else {}
    remitentes = {str(m.get("remitente_id")) for m in mensajes if m.get("remitente_id")}
    validos = {str(u.id) for u in sql.query(Usuario.id).filter(Usuario.id.in_(remitentes)).all()} if remitentes else set()
    nuevos: List[MensajeChat] = []
    for mensaje in mensajes:
        mid = str(mensaje["_id"])
        if mid in existentes:
            if existentes[mid] != ident:
                raise ValueError(f"El mensaje {mid} ya pertenece a otro chat")
            continue
        remitente = str(mensaje.get("remitente_id") or "")
        es_equipo = mensaje.get("tipo") == "sistema" and mensaje.get("remitente_id")
        meta = {k: v for k, v in (("archivo", mensaje.get("archivo")),
                                  ("autor", AUTOR_EQUIPO if es_equipo else mensaje.get("remitente_nombre"))) if v}
        nuevo = MensajeChat(
            id=mid, conversacion_id=ident,
            remitente_id=remitente if remitente in validos else conversacion.solicitante_id,
            contenido=mensaje["contenido"], tipo=mensaje["tipo"],
            metadata_json={CLAVE_METADATA: meta} if meta else None, fecha_envio=mensaje["fecha"],
        )
        try:
            with sql.begin_nested():
                sql.add(nuevo)
                sql.flush()
            nuevos.append(nuevo)
        except IntegrityError:
            existente = sql.get(MensajeChat, mid)
            if existente is None or existente.conversacion_id != ident:
                raise
    return nuevos


def asegurar_conversacion(mongo: Database, sql: Session, operacion: Dict) -> ConversacionChat:
    """El chat de la reserva, creándolo si falta y trayendo su historial viejo una
    sola vez. En el caso normal es una sola lectura de MySQL."""
    ident = str(operacion["_id"])
    conversacion = sql.get(ConversacionChat, ident)
    if conversacion is not None and conversacion.tipo != TipoConversacion.reserva.value:
        raise ValueError(f"El identificador de reserva {ident} ya pertenece a otro chat")
    migrada = bool(operacion.get(CAMPO_EN_SUITE))
    if conversacion is not None and migrada:
        return conversacion

    if conversacion is None:
        conversacion = _crear_conversacion(mongo, sql, operacion)
    nuevos = [] if migrada else _copiar_historial(mongo, sql, conversacion)
    sql.commit()
    if not migrada:
        try:
            mongo.operaciones.update_one({"_id": ident}, {"$set": {CAMPO_EN_SUITE: True}})
            operacion[CAMPO_EN_SUITE] = True
        except PyMongoError:
            logger.exception("No se pudo marcar el chat de la reserva %s como migrado", ident)
        actualizar_resumen(mongo, sql, ident)
    if nuevos:
        from routers.chat import _publicar_mensaje

        for mensaje in nuevos:
            _publicar_mensaje(mensaje)
    return conversacion


def registrar_mensaje(mongo: Database, sql: Session, operacion: Dict, *, contenido: str, tipo: str = "texto",
                      remitente_id: Optional[str] = None, autor: Optional[str] = None,
                      archivo: Optional[Dict] = None) -> MensajeChat:
    """Guarda un mensaje en el chat de la reserva y lo publica en tiempo real."""
    conversacion = asegurar_conversacion(mongo, sql, operacion)
    meta = {k: v for k, v in (("autor", autor), ("archivo", archivo)) if v}
    mensaje = MensajeChat(
        id=str(uuid4()), conversacion_id=str(conversacion.id),
        # Los avisos automáticos no tienen autor; la columna lo exige, así que van
        # a nombre del comprador y la interfaz los pinta como aviso, no como burbuja.
        remitente_id=str(remitente_id or conversacion.solicitante_id),
        contenido=contenido, tipo=tipo,
        metadata_json={CLAVE_METADATA: meta} if meta else None,
        fecha_envio=datetime.utcnow(),
    )
    sql.add(mensaje)
    sql.commit()
    sql.refresh(mensaje)
    actualizar_resumen(mongo, sql, str(conversacion.id))
    from routers.chat import _publicar_mensaje

    _publicar_mensaje(mensaje)
    return mensaje


def avisar_en_chat(mongo: Database, sql: Optional[Session], operacion: Dict, contenido: str, *,
                   tipo: str = "sistema", remitente_id: Optional[str] = None,
                   archivo: Optional[Dict] = None) -> None:
    """Mensaje informativo que acompaña una acción ya hecha (reservar, cancelar,
    vencer, adjuntar). Si el chat falla, la acción no se deshace ni responde con
    error: se registra en el log y el resto sigue."""
    if sql is None:
        logger.warning("Sin sesión SQL: no se registró el aviso en el chat de la reserva %s", operacion["_id"])
        return
    try:
        registrar_mensaje(mongo, sql, operacion, contenido=contenido, tipo=tipo,
                          remitente_id=remitente_id, archivo=archivo)
    except ERRORES_CHAT:
        sql.rollback()
        logger.exception("No se pudo registrar el aviso en el chat de la reserva %s", operacion["_id"])


def reservas_de_cuenta(mongo: Database, sql: Session, usuario: dict) -> Dict[str, Dict]:
    """Reservas de la cuenta para la bandeja de «Chats», por id, con su operación
    (así la bandeja no vuelve a Mongo por cada conversación).

    Abre el chat de las que aún no lo tienen (reservas viejas o una cuyo chat falló
    al crearse). Si una falla se omite y queda en el log: no tumba la bandeja."""
    cuenta = cuenta_de(usuario)
    operaciones = {str(op["_id"]): op for op in mongo.operaciones.find(
        {"$or": [{"cuenta_comprador": cuenta}, {"cuenta_vendedor": cuenta}]},
        {"comprobantes_pago": 0, "facturas": 0},
    )}
    if not operaciones:
        return {}
    existentes = {fila[0] for fila in sql.query(ConversacionChat.id)
                  .filter(ConversacionChat.id.in_(list(operaciones))).all()}
    for ident, operacion in list(operaciones.items()):
        if ident in existentes and operacion.get(CAMPO_EN_SUITE):
            continue
        try:
            asegurar_conversacion(mongo, sql, operacion)
        except ERRORES_CHAT:
            sql.rollback()
            logger.exception("No se pudo abrir el chat de la reserva %s", ident)
            if ident not in existentes:
                operaciones.pop(ident)
    return operaciones


def limpiar_metadata_cliente(metadata: Optional[Dict]) -> Optional[Dict]:
    """Quita de la metadata que manda un cliente la clave reservada al backend:
    con ella se podía firmar un mensaje como «Soporte Zarpi» o poner un enlace
    cualquiera con apariencia de documento de la reserva."""
    if not isinstance(metadata, dict) or CLAVE_METADATA not in metadata:
        return metadata
    return {k: v for k, v in metadata.items() if k != CLAVE_METADATA} or None
