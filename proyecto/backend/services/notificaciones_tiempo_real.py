"""Entrega en tiempo real de notificaciones (Server-Sent Events).

Las notificaciones se crean dentro de la transacción del caller, así que no se
pueden emitir en ese instante: si luego hubiera rollback, el usuario vería un
aviso de algo que no pasó. Se encolan en `session.info` y se publican en el
`after_commit` de la sesión.

Con Redis el aviso viaja por el canal `usuario:{id}:notificaciones` y llega a
cualquier worker; sin Redis se reparte en memoria, dentro del mismo proceso.
"""
from __future__ import annotations

import asyncio
import json
import logging
import threading
import time
from collections import defaultdict
from typing import Any, Dict, List, Set, Tuple

from sqlalchemy import event
from sqlalchemy.orm import Session

logger = logging.getLogger("importacionesq8")

_CLAVE_PENDIENTES = "notificaciones_tiempo_real_pendientes"

_suscriptores: Dict[str, Set[Tuple[asyncio.AbstractEventLoop, asyncio.Queue]]] = defaultdict(set)
_candado = threading.Lock()

# Tras un fallo de Redis no se reintenta durante un rato: esto corre dentro del
# request (after_commit) y cada intento contra un Redis caído cuesta el timeout
# de conexión entero.
_REINTENTO_REDIS_SEGUNDOS = 30
_redis_caido_hasta = 0.0


def canal_usuario(usuario_id: str) -> str:
    return f"usuario:{usuario_id}:notificaciones"


def encolar_para_commit(db: Session, usuario_id: str, payload: Dict[str, Any]) -> None:
    db.info.setdefault(_CLAVE_PENDIENTES, []).append((str(usuario_id), payload))


def publicar(usuario_id: str, payload: Dict[str, Any]) -> None:
    """Entrega inmediata, sin esperar a ningún commit. Nunca lanza."""
    import config

    global _redis_caido_hasta

    mensaje = json.dumps(payload, default=str)
    if config.redis_client and time.monotonic() >= _redis_caido_hasta:
        try:
            config.redis_client.publish(canal_usuario(usuario_id), mensaje)
            return
        except Exception:
            _redis_caido_hasta = time.monotonic() + _REINTENTO_REDIS_SEGUNDOS
            logger.warning("Redis no disponible para notificar a %s; se entrega en memoria", usuario_id)
    _publicar_en_memoria(str(usuario_id), mensaje)


def _publicar_en_memoria(usuario_id: str, mensaje: str) -> None:
    with _candado:
        destinos = list(_suscriptores.get(usuario_id, ()))
    for loop, cola in destinos:
        try:
            loop.call_soon_threadsafe(cola.put_nowait, mensaje)
        except RuntimeError:
            # El loop del suscriptor ya se cerró; se limpia al desuscribirse.
            pass


def suscribir(usuario_id: str) -> asyncio.Queue:
    cola: asyncio.Queue = asyncio.Queue(maxsize=100)
    with _candado:
        _suscriptores[str(usuario_id)].add((asyncio.get_running_loop(), cola))
    return cola


def desuscribir(usuario_id: str, cola: asyncio.Queue) -> None:
    with _candado:
        destinos = _suscriptores.get(str(usuario_id))
        if not destinos:
            return
        for entrada in [e for e in destinos if e[1] is cola]:
            destinos.discard(entrada)
        if not destinos:
            _suscriptores.pop(str(usuario_id), None)


@event.listens_for(Session, "after_commit")
def _emitir_tras_commit(session: Session) -> None:
    pendientes: List[Tuple[str, Dict[str, Any]]] = session.info.pop(_CLAVE_PENDIENTES, [])
    for usuario_id, payload in pendientes:
        publicar(usuario_id, payload)


@event.listens_for(Session, "after_rollback")
def _descartar_tras_rollback(session: Session) -> None:
    session.info.pop(_CLAVE_PENDIENTES, None)
