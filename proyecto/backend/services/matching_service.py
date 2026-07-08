from sqlalchemy.orm import Session
import redis as redis_lib
from datetime import datetime, timedelta

from config import COTIZACION_ABIERTA_TTL
from models.importador import Importador

def _get_redis_client():
    """Obtiene el cliente de Redis desde config"""
    from config import redis_client
    return redis_client

def _redis_available() -> bool:
    """Verifica si Redis está disponible"""
    client = _get_redis_client()
    if client is None:
        return False
    try:
        client.ping()
        return True
    except Exception:
        return False

def json_contains_column(column, value):
    """Helper para buscar en columnas JSON - compatible con MySQL y SQLite
    
    En MySQL usa json_contains. En SQLite usa LIKE porque no tiene json_contains.
    """
    # Usar LIKE para buscar el valor dentro del JSON (compatible con ambos)
    return column.like(f'%"{value}"%')

def matching_cotizacion_abierta(cotizacion_id: str, pais_importacion: str, linea_producto: str, db: Session) -> list:
    """
    Encuentra todos los importadores activos que aplican a una cotización abierta.
    
    Un importador recibe la cotización si cumple AMBAS condiciones:
    - El importador opera desde el país de origen del producto
    - El importador tiene la categoría de producto como especialidad
    
    Args:
        cotizacion_id: ID de la cotización (como string)
        pais_importacion: País de importación de la cotización
        linea_producto: Línea/categoría de producto de la cotización
        db: Sesión de base de datos
        
    Returns:
        Lista de importadores que aplican a la cotización
    """
    # Buscar importadores activos que cumplan ambas condiciones (usar LIKE para compatibilidad).
    # Las empresas con solo_cotizaciones_directas=True quedan fuera de la red abierta:
    # a cambio de poder personalizar su formulario, solo reciben cotizaciones dirigidas.
    importadores = db.query(Importador).filter(
        Importador.estado == "activo",
        Importador.solo_cotizaciones_directas == False,
        json_contains_column(Importador.paises_origen, pais_importacion),
        json_contains_column(Importador.especialidad_producto, linea_producto)
    ).all()
    
    # Guardar en Redis con TTL de 72 horas (259200 segundos) solo si Redis está disponible.
    # `hset` con un mapping vacío lanza `DataError`, así que si no hay ningún
    # importador candidato simplemente no se escribe el hash (nada que trackear).
    if _redis_available() and importadores:
        client = _get_redis_client()
        client.hset(f"cotizacion_abierta:{cotizacion_id}", mapping={
            str(importador.id): "pendiente" for importador in importadores
        })
        client.setex(
            f"cotizacion_abierta:{cotizacion_id}:expiracion",
            COTIZACION_ABIERTA_TTL,  # 72 horas en segundos
            str(datetime.now() + timedelta(hours=72))
        )
    
    return importadores

def obtener_importadores_matching(cotizacion_id: str) -> dict:
    """
    Obtiene los importadores que aplican a una cotización abierta desde Redis.
    
    Args:
        cotizacion_id: ID de la cotización (como string)
        
    Returns:
        Diccionario con el estado de respuestas por importador y métricas
    """
    if not _redis_available():
        return {
            "total_matching": 0,
            "pendientes": 0,
            "respondidos": 0
        }
    
    client = _get_redis_client()
    clave = f"cotizacion_abierta:{cotizacion_id}"
    
    # Obtener todos los importadores matching
    importadores_matching = client.hgetall(clave)
    
    # Contar pendientes y respondidos
    pendientes = sum(1 for estado in importadores_matching.values() if estado == "pendiente")
    respondidos = sum(1 for estado in importadores_matching.values() if estado == "respondido")
    
    return {
        "total_matching": len(importadores_matching),
        "pendientes": pendientes,
        "respondidos": respondidos
    }

def obtener_estado_matching_detallado(cotizacion_id: str) -> dict:
    """
    Similar a `obtener_importadores_matching`, pero además devuelve los IDs de los
    importadores que aún no han respondido, para poder mostrar sus datos (nombre,
    logo) en el panel de "Propuestas Recibidas" del solicitante (wireframe Pantalla 6).

    Si Redis no está disponible se responde con valores en cero (best-effort: no se
    bloquea la consulta de un listado, solo queda temporalmente sin datos).

    Args:
        cotizacion_id: ID de la cotización (como string)

    Returns:
        Diccionario con total_matching, pendientes, respondidos e ids_pendientes
    """
    vacio = {
        "total_matching": 0,
        "pendientes": 0,
        "respondidos": 0,
        "ids_pendientes": []
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
        "ids_pendientes": ids_pendientes
    }

def registrar_respuesta_importador(cotizacion_id: str, importador_id: str) -> bool:
    """
    Registra que un importador ha respondido a una cotización abierta.
    
    Args:
        cotizacion_id: ID de la cotización (como string)
        importador_id: ID del importador (como string)
        
    Returns:
        True si se registró correctamente, False en caso contrario
    """
    if not _redis_available():
        return False
    
    client = _get_redis_client()
    clave = f"cotizacion_abierta:{cotizacion_id}"
    
    # Actualizar estado a "respondido"
    client.hset(clave, importador_id, "respondido")
    
    # Incrementar contador de respuestas
    client.incr(f"cotizacion_abierta:{cotizacion_id}:respuestas")
    
    return True

def verificar_cotizacion_abierta_activa(cotizacion_id: str) -> dict:
    """
    Verifica si una cotización abierta está activa (no expirada).
    
    Args:
        cotizacion_id: ID de la cotización (como string)
        
    Returns:
        Diccionario con el estado de la cotización abierta
    """
    if not _redis_available():
        return {
            "esta_activa": False,
            "expirada": True,
            "tiempo_restante_segundos": 0,
            "propuestas_recibidas": 0
        }
    
    client = _get_redis_client()
    clave = f"cotizacion_abierta:{cotizacion_id}"
    clave_expiracion = f"cotizacion_abierta:{cotizacion_id}:expiracion"
    
    # Verificar si la cotización existe en Redis
    if not client.exists(clave):
        return {
            "esta_activa": False,
            "expirada": True,
            "tiempo_restante_segundos": 0,
            "propuestas_recibidas": 0
        }
    
    # Obtener tiempo restante del TTL
    ttl = client.ttl(clave)
    
    # Obtener contador de respuestas
    respuestas_clave = f"cotizacion_abierta:{cotizacion_id}:respuestas"
    propuestas_recibidas = int(client.get(respuestas_clave) or 0)
    
    return {
        "esta_activa": ttl > 0,
        "expirada": ttl <= 0,
        "tiempo_restante_segundos": max(0, ttl),
        "propuestas_recibidas": propuestas_recibidas
    }

def expirar_cotizacion_abierta(cotizacion_id: str) -> bool:
    """
    Expira manualmente una cotización abierta (elimina las claves de Redis).
    
    Args:
        cotizacion_id: ID de la cotización (como string)
        
    Returns:
        True si se eliminaron las claves, False en caso contrario
    """
    if not _redis_available():
        return False
    
    client = _get_redis_client()
    clave = f"cotizacion_abierta:{cotizacion_id}"
    clave_expiracion = f"cotizacion_abierta:{cotizacion_id}:expiracion"
    clave_respuestas = f"cotizacion_abierta:{cotizacion_id}:respuestas"
    
    # Eliminar todas las claves relacionadas
    client.delete(clave)
    client.delete(clave_expiracion)
    client.delete(clave_respuestas)
    
    return True

def obtener_propuestas_recibidas(cotizacion_id: str) -> int:
    """
    Obtiene el número de propuestas recibidas para una cotización abierta.
    
    Args:
        cotizacion_id: ID de la cotización (como string)
        
    Returns:
        Número de propuestas recibidas
    """
    if not _redis_available():
        return 0
    
    client = _get_redis_client()
    clave = f"cotizacion_abierta:{cotizacion_id}:respuestas"
    return int(client.get(clave) or 0)
