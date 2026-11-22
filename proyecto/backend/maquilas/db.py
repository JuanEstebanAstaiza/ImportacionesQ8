"""Base del módulo (MongoDB) y sus colecciones.

Colecciones:
- `maquiladoras`: la empresa, su expediente y su estado de verificación.
- `solicitudes`, `propuestas`, `pedidos` y `mensajes`: el flujo de fabricación.
- `miembros`: qué usuarios (dueño y colaboradores) atienden cada maquiladora;
  `_id` es el id del usuario, así un usuario pertenece a una sola.
- `configuracion`: parámetros del módulo que edita el admin.
- GridFS `medios` (galería de trabajos) y `documentos` (RUT, cámara de
  comercio, certificaciones).

El cliente es el mismo de los demás módulos (`utils/mongo.py`); cambia la base.
"""
from __future__ import annotations

from typing import Optional

from gridfs import GridFSBucket
from pymongo import ASCENDING, DESCENDING, TEXT
from pymongo.database import Database

import config
from utils.mongo import cliente

BUCKET_MEDIOS = "medios"
BUCKET_DOCUMENTOS = "documentos"
BUCKETS = (BUCKET_MEDIOS, BUCKET_DOCUMENTOS)


def obtener_db() -> Database:
    return cliente()[config.MONGO_DB_MAQUILAS]


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
    # Una empresa (NIT) se registra una sola vez como maquiladora.
    db.maquiladoras.create_index([("nit_normalizado", ASCENDING)], unique=True, name="un_nit_por_maquiladora")
    db.maquiladoras.create_index([("estado", ASCENDING), ("enviada_en", ASCENDING)])
    db.maquiladoras.create_index([("categorias", ASCENDING), ("estado", ASCENDING)])
    db.maquiladoras.create_index(
        [("razon_social", TEXT), ("nombre_comercial", TEXT), ("descripcion", TEXT)], default_language="spanish")
    db.miembros.create_index([("maquiladora_id", ASCENDING), ("creado_en", DESCENDING)])
    # Fase 2: solicitudes, propuestas, pedidos y chat.
    db.solicitudes.create_index([("cuenta_cliente", ASCENDING), ("creado_en", DESCENDING)])
    db.solicitudes.create_index([("destinos.maquiladora_id", ASCENDING), ("creado_en", DESCENDING)])
    # Una propuesta por maquiladora y solicitud (se edita, no se duplica).
    db.propuestas.create_index([("solicitud_id", ASCENDING), ("maquiladora_id", ASCENDING)], unique=True,
                               name="una_propuesta_por_maquiladora")
    db.pedidos.create_index([("cuenta_cliente", ASCENDING), ("creado_en", DESCENDING)])
    db.pedidos.create_index([("maquiladora_id", ASCENDING), ("creado_en", DESCENDING)])
    db.mensajes.create_index([("hilo", ASCENDING), ("fecha", ASCENDING)])
