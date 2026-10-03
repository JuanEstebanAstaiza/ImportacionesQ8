"""TRM del día (pesos colombianos por dólar) para guardar los montos en COP.

Fuente oficial: el conjunto "Tasa de Cambio Representativa del Mercado" de la
Superintendencia Financiera publicado en datos.gov.co (`config.TRM_URL`). Se
consulta como mucho una vez al día por proceso: el valor queda en memoria y en
`configuracion_plataforma`, para que los demás procesos y los reinicios no
vuelvan a salir a la red.

Si la consulta falla (sin red, el servicio caído, una respuesta rara), el orden
de respaldo es:
1. el valor que fijó el admin en el panel (`trm.respaldo`);
2. la última TRM oficial que se llegó a consultar;
3. `config.TRM_RESPALDO_COP`.

Cada resultado dice de dónde salió (`fuente`), y esa fuente se guarda con cada
evento para poder separar después los montos convertidos con un valor oficial.
"""
import logging
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

import config
from services import configuracion

logger = logging.getLogger("importacionesq8")

CLAVE_OFICIAL_VALOR = "trm.oficial.valor"
CLAVE_OFICIAL_VIGENCIA = "trm.oficial.vigencia"
CLAVE_OFICIAL_CONSULTA = "trm.oficial.fecha_consulta"
CLAVE_RESPALDO = "trm.respaldo"

FUENTE_OFICIAL = "oficial"
FUENTE_RESPALDO_ADMIN = "respaldo_admin"
FUENTE_ULTIMA_OFICIAL = "ultima_oficial"
FUENTE_POR_DEFECTO = "por_defecto"

# Tras un fallo no se vuelve a intentar enseguida: cada evento registrado
# esperaría el timeout de la red.
ESPERA_TRAS_FALLO = timedelta(minutes=15)

_cache: dict = {}
_ultimo_fallo: Optional[datetime] = None


def hoy_local(ahora: Optional[datetime] = None) -> date:
    ahora = ahora or datetime.utcnow()
    return (ahora + timedelta(hours=config.CUPO_COTIZACIONES_UTC_OFFSET_HORAS)).date()


def reiniciar_cache() -> None:
    """Para los tests y para el botón "Consultar ahora" del panel."""
    global _ultimo_fallo
    _cache.clear()
    _ultimo_fallo = None


def _a_float(valor) -> Optional[float]:
    try:
        numero = float(valor)
    except (TypeError, ValueError):
        return None
    return numero if numero > 0 else None


def consultar_trm_oficial() -> Optional[dict]:
    """Última TRM publicada, o None si no se pudo obtener."""
    import httpx

    try:
        respuesta = httpx.get(
            config.TRM_URL,
            params={"$limit": 1, "$order": "vigenciadesde DESC"},
            timeout=config.TRM_TIMEOUT_SEGUNDOS,
        )
        respuesta.raise_for_status()
        filas = respuesta.json()
    except Exception as exc:  # red, TLS, JSON inválido...
        logger.warning("No se pudo consultar la TRM oficial: %s", exc)
        return None

    if not isinstance(filas, list) or not filas or not isinstance(filas[0], dict):
        logger.warning("Respuesta inesperada al consultar la TRM oficial: %r", filas)
        return None
    valor = _a_float(filas[0].get("valor"))
    # Una TRM fuera de este rango es un error de la fuente, no del mercado.
    if valor is None or not (500 <= valor <= 50000):
        logger.warning("TRM oficial descartada por valor fuera de rango: %r", filas[0].get("valor"))
        return None
    vigencia = str(filas[0].get("vigenciadesde") or "")[:10] or None
    return {"valor": valor, "vigencia": vigencia}


def _resultado(valor: float, fuente: str, vigencia: Optional[str] = None, consultada: Optional[str] = None) -> dict:
    return {"valor": round(float(valor), 2), "fuente": fuente, "vigencia": vigencia, "fecha_consulta": consultada}


def obtener_trm(db: Session, ahora: Optional[datetime] = None) -> dict:
    """TRM a usar ahora: `{"valor", "fuente", "vigencia", "fecha_consulta"}`.

    No hace commit: si consulta la oficial deja el valor en la sesión y lo
    confirma la transacción de quien llama (normalmente, la del evento).
    """
    global _ultimo_fallo
    hoy = hoy_local(ahora).isoformat()

    if _cache.get("fecha_consulta") == hoy:
        return dict(_cache)

    guardado_valor = _a_float(configuracion.obtener(db, CLAVE_OFICIAL_VALOR))
    guardado_vigencia = configuracion.obtener(db, CLAVE_OFICIAL_VIGENCIA)
    guardado_consulta = configuracion.obtener(db, CLAVE_OFICIAL_CONSULTA)
    if guardado_valor and guardado_consulta == hoy:
        _cache.update(_resultado(guardado_valor, FUENTE_OFICIAL, guardado_vigencia, guardado_consulta))
        return dict(_cache)

    puede_consultar = config.TRM_CONSULTA_AUTOMATICA and (
        _ultimo_fallo is None or datetime.utcnow() - _ultimo_fallo >= ESPERA_TRAS_FALLO
    )
    if puede_consultar:
        oficial = consultar_trm_oficial()
        if oficial:
            _ultimo_fallo = None
            configuracion.guardar(db, CLAVE_OFICIAL_VALOR, str(oficial["valor"]))
            configuracion.guardar(db, CLAVE_OFICIAL_VIGENCIA, oficial["vigencia"])
            configuracion.guardar(db, CLAVE_OFICIAL_CONSULTA, hoy)
            _cache.clear()
            _cache.update(_resultado(oficial["valor"], FUENTE_OFICIAL, oficial["vigencia"], hoy))
            return dict(_cache)
        _ultimo_fallo = datetime.utcnow()

    respaldo = _a_float(configuracion.obtener(db, CLAVE_RESPALDO))
    if respaldo:
        return _resultado(respaldo, FUENTE_RESPALDO_ADMIN)
    if guardado_valor:
        return _resultado(guardado_valor, FUENTE_ULTIMA_OFICIAL, guardado_vigencia, guardado_consulta)
    return _resultado(config.TRM_RESPALDO_COP, FUENTE_POR_DEFECTO)


def estado_trm(db: Session) -> dict:
    """Lo que muestra el panel de admin: la TRM vigente y el respaldo."""
    vigente = obtener_trm(db)
    return {
        **vigente,
        "consulta_automatica": config.TRM_CONSULTA_AUTOMATICA,
        "respaldo_admin": _a_float(configuracion.obtener(db, CLAVE_RESPALDO)),
        "ultima_oficial": _a_float(configuracion.obtener(db, CLAVE_OFICIAL_VALOR)),
        "ultima_oficial_vigencia": configuracion.obtener(db, CLAVE_OFICIAL_VIGENCIA),
        "ultima_oficial_consulta": configuracion.obtener(db, CLAVE_OFICIAL_CONSULTA),
        "valor_por_defecto": config.TRM_RESPALDO_COP,
    }
