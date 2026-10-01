"""Modo mantenimiento: la API deja de atender mientras se restaura una copia.

Restaurar vacía y recarga todas las tablas. Si mientras tanto alguien crea una
cotización o envía un mensaje, esa escritura se pierde o queda a medias. Con el
modo activo, `MantenimientoMiddleware` responde 503 a todo salvo la salud y la
propia restauración.

El estado vive en Redis para que lo vean todos los workers de Uvicorn. Sin Redis
(desarrollo, tests) se usa un indicador del proceso, que con un solo worker es
equivalente. Cada worker consulta Redis como mucho una vez por
`CACHE_SEGUNDOS`; por eso quien activa el modo espera ese tiempo antes de tocar
la base (`PAUSA_ANTES_DE_RESTAURAR`).
"""
from __future__ import annotations

import threading
import time
from typing import Optional

CLAVE = "mantenimiento:restauracion"
# Si el proceso que restaura muere sin desactivarlo, el modo caduca solo.
TTL_SEGUNDOS = 2 * 60 * 60
CACHE_SEGUNDOS = 1.0
PAUSA_ANTES_DE_RESTAURAR = CACHE_SEGUNDOS + 0.5

_local_lock = threading.Lock()
_local_motivo: Optional[str] = None
_cache: dict = {"hasta": 0.0, "motivo": None}


def _redis():
    from config import redis_client

    return redis_client


def activar(motivo: str) -> bool:
    """Activa el modo. Devuelve False si ya estaba activo (otra restauración en curso)."""
    global _local_motivo
    cliente = _redis()
    if cliente is not None:
        try:
            activado = bool(cliente.set(CLAVE, motivo, nx=True, ex=TTL_SEGUNDOS))
            _cache.update(hasta=0.0)
            return activado
        except Exception:
            pass
    with _local_lock:
        if _local_motivo is not None:
            return False
        _local_motivo = motivo
        _cache.update(hasta=0.0)
        return True


def desactivar() -> None:
    global _local_motivo
    cliente = _redis()
    if cliente is not None:
        try:
            cliente.delete(CLAVE)
        except Exception:
            pass
    with _local_lock:
        _local_motivo = None
    _cache.update(hasta=0.0, motivo=None)


def motivo_activo() -> Optional[str]:
    """Motivo del mantenimiento en curso, o None. Cacheado `CACHE_SEGUNDOS` por proceso."""
    ahora = time.monotonic()
    if ahora < _cache["hasta"]:
        return _cache["motivo"]

    motivo = _local_motivo
    cliente = _redis()
    if motivo is None and cliente is not None:
        try:
            valor = cliente.get(CLAVE)
            if isinstance(valor, bytes):
                valor = valor.decode("utf-8", "replace")
            motivo = valor if isinstance(valor, str) and valor else None
        except Exception:
            motivo = None
    _cache.update(hasta=ahora + CACHE_SEGUNDOS, motivo=motivo)
    return motivo
