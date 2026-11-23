"""Cliente de MongoDB compartido por los módulos de la suite.

Cada módulo (Liquidaciones, Maquilas...) guarda sus datos en su propia base de
la misma instancia; el `MongoClient` es uno solo por proceso porque ya mantiene
su pool de conexiones y es seguro entre hilos. Se crea al primer uso para que
importar un módulo (tests, scripts) no exija tener Mongo levantado.
"""
from __future__ import annotations

import threading
from typing import Optional

from pymongo import MongoClient

import config

_cliente: Optional[MongoClient] = None
_candado = threading.Lock()


def cliente() -> MongoClient:
    global _cliente
    if _cliente is None:
        with _candado:
            if _cliente is None:
                _cliente = MongoClient(config.MONGO_URL, serverSelectionTimeoutMS=3000, uuidRepresentation="standard")
    return _cliente


def ping() -> bool:
    try:
        return bool(cliente().admin.command("ping").get("ok"))
    except Exception:
        return False
