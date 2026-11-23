"""Chat entre el cliente y una maquiladora.

Hay un hilo por pareja solicitud–maquiladora (`<solicitud_id>:<maquiladora_id>`):
empieza en la negociación y, si esa maquiladora gana, sigue en el pedido. Los
eventos importantes (propuesta, muestra, pagos…) dejan un mensaje de sistema en
el mismo hilo para que la conversación cuente la historia completa.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import status
from pymongo.database import Database
from sqlalchemy.orm import Session

from maquilas import acceso, archivos, avisos
from maquilas.comun import ahora, error, iso, nuevo_id
from maquilas.esquemas import MensajeEntrada
from maquilas.identidad import es_maquiladora, maquiladora_id_de

MAX_MENSAJES = 500


def hilo_de(solicitud_id: str, maquiladora_id: str) -> str:
    return f"{solicitud_id}:{maquiladora_id}"


def sistema(db: Database, hilo: str, contenido: str) -> None:
    db.mensajes.insert_one({"_id": nuevo_id(), "hilo": hilo, "tipo": "sistema", "contenido": contenido,
                            "remitente_id": None, "lado": None, "fecha": ahora()})


def a_mensaje(doc: Dict) -> Dict:
    return {
        "id": doc["_id"],
        "tipo": doc.get("tipo", "texto"),
        "contenido": doc.get("contenido") or "",
        "lado": doc.get("lado"),
        "remitente_nombre": doc.get("remitente_nombre"),
        "remitente_id": doc.get("remitente_id"),
        "archivo": archivos.con_url(doc.get("archivo")),
        "fecha": iso(doc.get("fecha")),
    }


def listar(db: Database, hilo: str, usuario: dict) -> List[Dict]:
    if not acceso.puede_usar_hilo(db, hilo, usuario):
        raise error(status.HTTP_404_NOT_FOUND, "Conversación no encontrada")
    filas = db.mensajes.find({"hilo": hilo}).sort("fecha", 1).limit(MAX_MENSAJES)
    return [a_mensaje(m) for m in filas]


def enviar(db: Database, sql: Session, hilo: str, usuario: dict, datos: MensajeEntrada, nombre: str) -> Dict:
    """El cliente o la maquiladora escriben; el equipo de Zarpi solo lee (por ahora)."""
    if not acceso.puede_usar_hilo(db, hilo, usuario, incluir_equipo=False):
        raise error(status.HTTP_404_NOT_FOUND, "Conversación no encontrada")
    contenido = (datos.contenido or "").strip()
    if not contenido and not datos.archivo_id:
        raise error(status.HTTP_400_BAD_REQUEST, "Escribe un mensaje o adjunta un archivo")
    solicitud_id, _, maquiladora_id = hilo.partition(":")
    lado = "maquiladora" if es_maquiladora(usuario) else "cliente"
    cuenta = f"maquiladora:{maquiladora_id_de(db, usuario)}" if lado == "maquiladora" else acceso.cuenta_cliente(usuario)
    archivo: Optional[Dict] = None
    if datos.archivo_id:
        try:
            archivo = archivos.ligar(db, ids=[datos.archivo_id], tipo="adjunto", cuenta=cuenta, contexto={"hilo": hilo})[0]
        except archivos.ArchivoInvalido as exc:
            raise error(status.HTTP_400_BAD_REQUEST, str(exc))
    doc = {"_id": nuevo_id(), "hilo": hilo, "tipo": "archivo" if archivo else "texto", "contenido": contenido,
           "archivo": archivo, "remitente_id": usuario["user_id"], "remitente_nombre": nombre, "lado": lado, "fecha": ahora()}
    db.mensajes.insert_one(doc)

    solicitud = db.solicitudes.find_one({"_id": solicitud_id}, {"titulo": 1, "cuenta_cliente": 1})
    destinatarios = (avisos.usuarios_de_cliente(sql, solicitud["cuenta_cliente"]) if lado == "maquiladora"
                     else avisos.usuarios_de_maquiladora(db, maquiladora_id))
    avisos.avisar(sql, destinatarios, tipo="maquila_mensaje", titulo="Nuevo mensaje en Zarpi Maquilas",
                  mensaje=f"{nombre}: {contenido[:120] or 'te envió un archivo'}",
                  data={"evento": "maquila_mensaje", "solicitud_id": solicitud_id, "maquiladora_id": maquiladora_id,
                        "lado_destino": "cliente" if lado == "maquiladora" else "maquiladora"})
    return a_mensaje(doc)
