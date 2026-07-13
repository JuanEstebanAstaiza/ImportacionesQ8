from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from config import (
    COTIZACION_ABIERTA_TTL,
    INDICE_COTIZACIONES_ABIERTAS,
    indice_importador_abiertas,
)
from models.importador import Importador

def _get_redis_client():
    from config import redis_client
    return redis_client

def _redis_available() -> bool:
    client = _get_redis_client()
    if client is None:
        return False
    try:
        client.ping()
        return True
    except Exception:
        return False

def json_contains_column(column, value):
    """Helper para buscar en columnas JSON - compatible con MySQL y SQLite."""
    return column.like(f'%"{value}"%')


def _indexar_matching(client, cotizacion_id: str, importador_ids) -> None:
    """
    Mantiene SETs índice para consultas O(1)/O(k) por importador.
    Evita Redis KEYS (O(N) bloqueante) en pool-empresa / inbox abierta.
    """
    pipe = client.pipeline()
    pipe.sadd(INDICE_COTIZACIONES_ABIERTAS, cotizacion_id)
    pipe.expire(INDICE_COTIZACIONES_ABIERTAS, COTIZACION_ABIERTA_TTL)
    for importador_id in importador_ids:
        clave = indice_importador_abiertas(importador_id)
        pipe.sadd(clave, cotizacion_id)
        pipe.expire(clave, COTIZACION_ABIERTA_TTL)
    pipe.execute()


def _desindexar_matching(client, cotizacion_id: str, importador_ids=None) -> None:
    pipe = client.pipeline()
    pipe.srem(INDICE_COTIZACIONES_ABIERTAS, cotizacion_id)
    ids = importador_ids
    if ids is None:
        try:
            ids = list(client.hgetall(f"cotizacion_abierta:{cotizacion_id}").keys())
        except Exception:
            ids = []
    for importador_id in ids:
        pipe.srem(indice_importador_abiertas(importador_id), cotizacion_id)
    pipe.execute()


def listar_cotizaciones_matching_importador(importador_id: str) -> set:
    """IDs de cotizaciones abiertas indexadas para un importador (sin KEYS)."""
    if not _redis_available():
        return set()
    client = _get_redis_client()
    try:
        members = client.smembers(indice_importador_abiertas(importador_id))
        if not members:
            return set()
        if isinstance(members, (set, list, tuple, frozenset)):
            return set(members)
        return set()
    except Exception:
        return set()


def matching_cotizacion_abierta(cotizacion_id: str, pais_importacion: str, linea_producto: str, db: Session) -> list:
    """
    Encuentra importadores activos que aplican a una cotización abierta
    (país + especialidad) y los registra en Redis + índice por importador.
    """
    importadores = db.query(Importador).filter(
        Importador.estado == "activo",
        Importador.solo_cotizaciones_directas == False,
        json_contains_column(Importador.paises_origen, pais_importacion),
        json_contains_column(Importador.especialidad_producto, linea_producto)
    ).all()

    if _redis_available() and importadores:
        client = _get_redis_client()
        importador_ids = [str(importador.id) for importador in importadores]
        client.hset(
            f"cotizacion_abierta:{cotizacion_id}",
            mapping={imp_id: "pendiente" for imp_id in importador_ids},
        )
        client.setex(
            f"cotizacion_abierta:{cotizacion_id}:expiracion",
            COTIZACION_ABIERTA_TTL,
            str(datetime.now() + timedelta(hours=72)),
        )
        _indexar_matching(client, cotizacion_id, importador_ids)

    return importadores

def obtener_importadores_matching(cotizacion_id: str) -> dict:
    if not _redis_available():
        return {"total_matching": 0, "pendientes": 0, "respondidos": 0}

    client = _get_redis_client()
    clave = f"cotizacion_abierta:{cotizacion_id}"
    importadores_matching = client.hgetall(clave)
    pendientes = sum(1 for estado in importadores_matching.values() if estado == "pendiente")
    respondidos = sum(1 for estado in importadores_matching.values() if estado == "respondido")

    return {
        "total_matching": len(importadores_matching),
        "pendientes": pendientes,
        "respondidos": respondidos,
    }

def obtener_estado_matching_detallado(cotizacion_id: str) -> dict:
    vacio = {
        "total_matching": 0,
        "pendientes": 0,
        "respondidos": 0,
        "ids_pendientes": [],
    }

    if not _redis_available():
        return vacio

    client = _get_redis_client()
    clave = f"cotizacion_abierta:{cotizacion_id}"

    try:
        importadores_matching = client.hgetall(clave)
    except Exception:
        return vacio

    ids_pendientes = [
        importador_id for importador_id, estado in importadores_matching.items()
        if estado == "pendiente"
    ]
    respondidos = sum(1 for estado in importadores_matching.values() if estado == "respondido")

    return {
        "total_matching": len(importadores_matching),
        "pendientes": len(ids_pendientes),
        "respondidos": respondidos,
        "ids_pendientes": ids_pendientes,
    }

def registrar_respuesta_importador(cotizacion_id: str, importador_id: str) -> bool:
    if not _redis_available():
        return False

    client = _get_redis_client()
    clave = f"cotizacion_abierta:{cotizacion_id}"
    client.hset(clave, importador_id, "respondido")
    client.incr(f"cotizacion_abierta:{cotizacion_id}:respuestas")
    return True

def verificar_cotizacion_abierta_activa(cotizacion_id: str) -> dict:
    if not _redis_available():
        return {
            "esta_activa": False,
            "expirada": True,
            "tiempo_restante_segundos": 0,
            "propuestas_recibidas": 0,
        }

    client = _get_redis_client()
    clave = f"cotizacion_abierta:{cotizacion_id}"

    if not client.exists(clave):
        return {
            "esta_activa": False,
            "expirada": True,
            "tiempo_restante_segundos": 0,
            "propuestas_recibidas": 0,
        }

    ttl = client.ttl(clave)
    propuestas_recibidas = int(client.get(f"cotizacion_abierta:{cotizacion_id}:respuestas") or 0)

    return {
        "esta_activa": ttl > 0,
        "expirada": ttl <= 0,
        "tiempo_restante_segundos": max(0, ttl),
        "propuestas_recibidas": propuestas_recibidas,
    }

def expirar_cotizacion_abierta(cotizacion_id: str) -> bool:
    if not _redis_available():
        return False

    client = _get_redis_client()
    clave = f"cotizacion_abierta:{cotizacion_id}"
    try:
        importador_ids = list(client.hgetall(clave).keys())
    except Exception:
        importador_ids = []

    _desindexar_matching(client, cotizacion_id, importador_ids)
    client.delete(clave)
    client.delete(f"cotizacion_abierta:{cotizacion_id}:expiracion")
    client.delete(f"cotizacion_abierta:{cotizacion_id}:respuestas")
    return True

def obtener_propuestas_recibidas(cotizacion_id: str) -> int:
    if not _redis_available():
        return 0

    client = _get_redis_client()
    return int(client.get(f"cotizacion_abierta:{cotizacion_id}:respuestas") or 0)
