"""Conexión a la base del módulo (MongoDB) y sus colecciones.

Un solo `MongoClient` por proceso: el cliente ya mantiene su propio pool de
conexiones y es seguro entre hilos, así que crear uno por petición solo
añadiría latencia. Se crea al primer uso para que importar el módulo (tests,
scripts) no exija tener Mongo levantado.

Colecciones:
- `activaciones`: una por cuenta (`empresa:<id>` o `usuario:<id>`).
- `lotes`, `operaciones`, `mensajes`.
- `configuracion`: parámetros del módulo que edita el admin.
- GridFS `medios` (fotos y videos) y `documentos` (fichas técnicas,
  comprobantes de pago, facturas, RUT).
"""
from __future__ import annotations

import logging
import threading
from typing import Optional

from gridfs import GridFSBucket
from pymongo import ASCENDING, DESCENDING, MongoClient, TEXT
from pymongo.database import Database

import config

logger = logging.getLogger("importacionesq8")

_cliente: Optional[MongoClient] = None
_candado = threading.Lock()

BUCKET_MEDIOS = "medios"
BUCKET_DOCUMENTOS = "documentos"
BUCKETS = (BUCKET_MEDIOS, BUCKET_DOCUMENTOS)


def cliente() -> MongoClient:
    global _cliente
    if _cliente is None:
        with _candado:
            if _cliente is None:
                _cliente = MongoClient(config.MONGO_URL, serverSelectionTimeoutMS=3000, uuidRepresentation="standard")
    return _cliente


def obtener_db() -> Database:
    return cliente()[config.MONGO_DB]


def get_mongo() -> Database:
    """Dependencia de FastAPI. Los tests la sustituyen si necesitan otra base."""
    return obtener_db()


def bucket(db: Database, nombre: str) -> GridFSBucket:
    if nombre not in BUCKETS:
        raise ValueError(f"Bucket desconocido: {nombre}")
    return GridFSBucket(db, bucket_name=nombre)


def asegurar_indices(db: Optional[Database] = None) -> None:
    """Crea los índices si faltan. Es idempotente: se llama en cada arranque."""
    db = db if db is not None else obtener_db()
    db.lotes.create_index([("estado", ASCENDING), ("destacado", DESCENDING), ("cierra_en", ASCENDING)])
    db.lotes.create_index([("cuenta_vendedor", ASCENDING), ("estado", ASCENDING)])
    db.lotes.create_index([("nombre", TEXT), ("descripcion", TEXT)], default_language="spanish")
    # Una sola reserva viva por lote: segunda barrera, además de la actualización
    # condicional del lote, contra dos compradores que dan clic a la vez.
    db.operaciones.create_index(
        [("lote_id", ASCENDING)],
        unique=True,
        partialFilterExpression={"estado": "activa"},
        name="una_reserva_activa_por_lote",
    )
    db.operaciones.create_index([("cuenta_comprador", ASCENDING), ("reservada_en", DESCENDING)])
    db.operaciones.create_index([("cuenta_vendedor", ASCENDING), ("reservada_en", DESCENDING)])
    db.mensajes.create_index([("operacion_id", ASCENDING), ("fecha", ASCENDING)])


def ping() -> bool:
    try:
        return bool(cliente().admin.command("ping").get("ok"))
    except Exception:
        return False
