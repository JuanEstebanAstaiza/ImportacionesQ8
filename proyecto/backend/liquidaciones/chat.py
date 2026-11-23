"""Vínculo entre las reservas de MongoDB y las conversaciones de la suite."""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from pymongo.database import Database
from pymongo.errors import PyMongoError
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from liquidaciones.identidad import cuenta_de
from models.chat import ConversacionChat, MensajeChat, TipoConversacion, TipoMensajeChat
from models.usuario import Usuario

logger = logging.getLogger("importacionesq8")


def actualizar_resumen(mongo: Database, sql: Session, operacion_id: str) -> None:
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
    cuenta = cuenta_de(usuario)
    return cuenta in (operacion["cuenta_comprador"], operacion["cuenta_vendedor"])


def operacion_de_conversacion(mongo: Database, conversacion: ConversacionChat) -> Optional[Dict]:
    if conversacion.tipo != TipoConversacion.reserva.value:
        return None
    return mongo.operaciones.find_one({"_id": str(conversacion.id)})


def sincronizar(mongo: Database, sql: Session, operacion: Dict) -> ConversacionChat:
    """Crea el hilo y copia idempotentemente los mensajes anteriores de Mongo."""
    ident = str(operacion["_id"])
    conversacion = sql.get(ConversacionChat, ident)
    if conversacion is None:
        cuenta_vendedor = operacion["cuenta_vendedor"]
        empresa_id = cuenta_vendedor.removeprefix("empresa:") if cuenta_vendedor.startswith("empresa:") else None
        comprador_id = operacion.get("comprador_usuario_id")
        if not comprador_id:
            cuenta = operacion["cuenta_comprador"]
            if cuenta.startswith("usuario:"):
                comprador_id = cuenta.removeprefix("usuario:")
            else:
                activacion = mongo.activaciones.find_one({"_id": cuenta}) or {}
                comprador_id = activacion.get("activada_por")
        if not comprador_id or not sql.get(Usuario, str(comprador_id)):
            raise ValueError(f"No se encontró el comprador de la reserva {ident}")
        conversacion = ConversacionChat(
            id=ident,
            tipo=TipoConversacion.reserva.value,
            solicitante_id=comprador_id,
            importador_id=empresa_id,
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
            conversacion = sql.get(ConversacionChat, ident)
            if conversacion is None or conversacion.tipo != TipoConversacion.reserva.value:
                raise
    elif conversacion.tipo != TipoConversacion.reserva.value:
        raise ValueError(f"El identificador de reserva {ident} ya pertenece a otro chat")

    mensajes = list(mongo.mensajes.find({"operacion_id": ident}).sort("fecha", 1))
    ids = [str(m["_id"]) for m in mensajes]
    existentes = dict(sql.query(MensajeChat.id, MensajeChat.conversacion_id)
                      .filter(MensajeChat.id.in_(ids)).all()) if ids else {}
    nuevos = []
    for mensaje in mensajes:
        mid = str(mensaje["_id"])
        if mid in existentes:
            if existentes[mid] != ident:
                raise ValueError(f"El mensaje {mid} ya pertenece a otro chat")
            continue
        remitente = mensaje.get("remitente_id") or conversacion.solicitante_id
        if not sql.get(Usuario, str(remitente)):
            remitente = conversacion.solicitante_id
        meta = {"liquidaciones": {"archivo": mensaje.get("archivo"), "autor": mensaje.get("remitente_nombre")}}
        nuevo = MensajeChat(
            id=mid, conversacion_id=ident, remitente_id=str(remitente),
            contenido=mensaje["contenido"], tipo=mensaje["tipo"], metadata_json=meta,
            fecha_envio=mensaje["fecha"],
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
    sql.commit()
    actualizar_resumen(mongo, sql, ident)
    if nuevos:
        from routers.chat import _publicar_mensaje

        for mensaje in nuevos:
            _publicar_mensaje(mensaje)
    return conversacion
