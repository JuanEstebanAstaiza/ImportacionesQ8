from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional

from config import (
    COTIZACION_ABIERTA_TTL,
    INDICE_COTIZACIONES_ABIERTAS,
    indice_importador_abiertas,
)
from models.importador import Importador
from utils.categorias import categoria_en, claves_categorias, texto_en

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


def _candidatos_por_criterio(db: Session, pais_importacion: str, linea_producto: str) -> list:
    """Empresas activas del circuito abierto que trabajan ese país y esa línea."""
    candidatos = db.query(Importador).filter(
        Importador.estado == "activo",
        Importador.solo_cotizaciones_directas == False,  # noqa: E712
    ).all()
    return [
        importador for importador in candidatos
        if texto_en(pais_importacion, importador.paises_origen)
        and claves_categorias(importador.especialidad_producto)
        and categoria_en(linea_producto, importador.especialidad_producto)
    ]


def matching_cotizacion_abierta(cotizacion_id: str, pais_importacion: str, linea_producto: str, db: Session) -> list:
    """
    Encuentra importadores activos que aplican a una cotización abierta
    (país + especialidad) y los registra en Redis + índice por importador.

    El cruce se hace en Python y no con un `LIKE '%"Textiles"%'` sobre la
    columna JSON: ese LIKE exigía que la cadena guardada por la empresa fuera
    idéntica a la que eligió el cliente, y bastaba un "Químicos" frente a un
    "Química" para que la cotización no llegara a nadie. El universo a filtrar
    son las empresas importadoras activas, así que el coste es irrelevante
    frente al de perder la difusión.

    A diferencia de la validación al responder, aquí una empresa **sin**
    especialidad declarada no entra en el reparto: hay que decidir a quién se
    avisa, y sin especialidad no hay criterio.

    Tampoco entran las que ya agotaron su cupo diario
    (`limite_cotizaciones_diarias`); quedan registradas como omitidas para que
    no les aparezca después en la bandeja. Ver `services/cupo_cotizaciones.py`.
    """
    from services.cupo_cotizaciones import cupo_agotado, recibidas_hoy, registrar_reparto_abierta

    importadores = _candidatos_por_criterio(db, pais_importacion, linea_producto)

    con_limite = [imp for imp in importadores if imp.limite_cotizaciones_diarias is not None]
    conteo = recibidas_hoy(db, [imp.id for imp in con_limite])
    omitidos = [
        imp for imp in con_limite
        if cupo_agotado(imp.limite_cotizaciones_diarias, conteo.get(str(imp.id), 0))
    ]
    importadores = [imp for imp in importadores if imp not in omitidos]
    registrar_reparto_abierta(
        db,
        cotizacion_id=cotizacion_id,
        entregadas=[str(imp.id) for imp in importadores],
        omitidas=[str(imp.id) for imp in omitidos],
    )

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


def reconstruir_matching_abiertas(db: Session, ahora: Optional[datetime] = None) -> int:
    """Rehace en Redis el reparto de las cotizaciones abiertas vigentes, desde la base.

    Tras restaurar una copia desde el panel, Redis guarda el reparto de los
    datos ANTERIORES: las abiertas restauradas no estarían en el pool de nadie
    y, con el matching estricto de producción, ninguna empresa podría
    responderlas. Aquí se borra ese estado y se reconstruye:

    - a quién se entregó cada abierta sale de `recepciones_cotizacion`; si no
      hay recepciones (copias anteriores a esa tabla), del mismo criterio de
      país y línea que usa el matching, sin aplicar cupos;
    - "respondido" para las empresas que ya enviaron propuesta;
    - el TTL es lo que le quedaba a cada una de sus 72 h.

    Devuelve cuántas cotizaciones reindexó (0 si Redis no está disponible).
    """
    from models.cotizacion import Cotizacion, EstadoCotizacion
    from models.propuesta import EstadoPropuesta, Propuesta
    from models.recepcion_cotizacion import RecepcionCotizacion

    if not _redis_available():
        return 0
    client = _get_redis_client()
    ahora = ahora or datetime.utcnow()
    ventana = timedelta(seconds=COTIZACION_ABIERTA_TTL)

    for patron in ("cotizacion_abierta:*", indice_importador_abiertas("*")):
        for clave in list(client.scan_iter(match=patron, count=500)):
            client.delete(clave)
    client.delete(INDICE_COTIZACIONES_ABIERTAS)

    abiertas = db.query(Cotizacion).filter(
        Cotizacion.modalidad == "abierta",
        Cotizacion.estado.in_([EstadoCotizacion.abierta.value, EstadoCotizacion.propuestas_recibidas.value]),
        Cotizacion.fecha_creacion >= ahora - ventana,
    ).all()

    reindexadas = 0
    for cotizacion in abiertas:
        ttl = int((cotizacion.fecha_creacion + ventana - ahora).total_seconds())
        if ttl <= 0:
            continue
        cotizacion_id = str(cotizacion.id)
        destinatarios = [
            importador_id for (importador_id,) in db.query(RecepcionCotizacion.importador_id).filter(
                RecepcionCotizacion.cotizacion_id == cotizacion_id,
                RecepcionCotizacion.entregada.is_(True),
            )
        ]
        if not destinatarios:
            destinatarios = [
                str(imp.id) for imp in _candidatos_por_criterio(db, cotizacion.pais_importacion, cotizacion.linea_producto)
            ]
        if not destinatarios:
            continue
        respondieron = {
            importador_id for (importador_id,) in db.query(Propuesta.importador_id).filter(
                Propuesta.cotizacion_id == cotizacion_id,
                Propuesta.estado != EstadoPropuesta.borrador.value,
            )
        }

        clave = f"cotizacion_abierta:{cotizacion_id}"
        pipe = client.pipeline()
        pipe.hset(clave, mapping={
            importador_id: ("respondido" if importador_id in respondieron else "pendiente")
            for importador_id in destinatarios
        })
        pipe.expire(clave, ttl)
        pipe.setex(f"{clave}:expiracion", ttl, str(cotizacion.fecha_creacion + ventana))
        pipe.setex(f"{clave}:respuestas", ttl, len(respondieron & set(destinatarios)))
        pipe.execute()
        _indexar_matching(client, cotizacion_id, destinatarios)
        reindexadas += 1
    return reindexadas
