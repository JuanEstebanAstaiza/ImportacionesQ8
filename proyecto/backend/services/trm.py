"""Dólar del día (pesos colombianos por dólar) para guardar los montos en COP.

Fuente principal: la cotización USD/COP de Google Finance. Google no tiene API
pública: se le pide el dato al mismo servicio interno que usa su página
(`batchexecute`, `RPC_COTIZACION`) y, si eso falla, se lee de la página
(`config.TRM_GOOGLE_FINANCE_URL`), que a veces lo trae embebido. Si nada de eso
funciona (sin red, Google cambia el formato, pide consentimiento de cookies…),
se usa la TRM oficial de la Superintendencia Financiera en datos.gov.co
(`config.TRM_URL`).

Se consulta como mucho cada `config.TRM_REFRESCO_MINUTOS` por proceso: el valor
queda en memoria y en `configuracion_plataforma`, para que los demás procesos y
los reinicios no vuelvan a salir a la red.

Si las dos consultas fallan, el orden de respaldo es:
1. el valor que fijó el admin en el panel (`trm.respaldo`);
2. la última cotización que se llegó a consultar;
3. `config.TRM_RESPALDO_COP`.

Cada resultado dice de dónde salió (`fuente`), y esa fuente se guarda con cada
evento para poder separar después los montos convertidos con un valor consultado.
"""
import json
import logging
import re
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

import config
from services import configuracion

logger = logging.getLogger("importacionesq8")

CLAVE_OFICIAL_VALOR = "trm.oficial.valor"
CLAVE_OFICIAL_VIGENCIA = "trm.oficial.vigencia"
CLAVE_OFICIAL_CONSULTA = "trm.oficial.fecha_consulta"
# De qué fuente salió el último valor consultado y cuándo (UTC, ISO).
CLAVE_OFICIAL_FUENTE = "trm.oficial.fuente"
CLAVE_OFICIAL_CONSULTADA_EN = "trm.oficial.consultada_en"
CLAVE_RESPALDO = "trm.respaldo"

FUENTE_GOOGLE = "google_finance"
FUENTE_OFICIAL = "oficial"
FUENTE_RESPALDO_ADMIN = "respaldo_admin"
FUENTE_ULTIMA_OFICIAL = "ultima_oficial"
FUENTE_POR_DEFECTO = "por_defecto"
FUENTES_CONSULTADAS = (FUENTE_GOOGLE, FUENTE_OFICIAL)

# Tras un fallo no se vuelve a intentar enseguida: cada evento registrado
# esperaría el timeout de la red.
ESPERA_TRAS_FALLO = timedelta(minutes=15)

# Google Finance no bloquea a un navegador; a un cliente sin User-Agent, a veces sí.
CABECERAS_GOOGLE = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"),
    "Accept-Language": "es-CO,es;q=0.9",
}
# Servicio interno de Google Finance: devuelve la cotización como JSON.
URL_GOOGLE_RPC = "https://www.google.com/finance/_/GoogleFinanceUi/data/batchexecute"
RPC_COTIZACION = "xh8wxf"
PEDIDO_USD_COP = '[[[null,null,["USD","COP"]]],1]'
# La respuesta del servicio y la página traen la cotización en el mismo formato:
#   ["/g/…",null,"USD / COP",3,null,[3214.8614,5.01,0.15,…],null,3209.84,…,[1791755479],…
PATRON_GOOGLE = re.compile(r'"USD / COP",\s*\d+,\s*null,\s*\[\s*(\d+(?:\.\d+)?)\s*,')
PATRON_GOOGLE_HORA = re.compile(r"\[(\d{10})\]")
# Versión anterior de la página: el precio en un atributo.
PATRON_GOOGLE_ATRIBUTO = re.compile(r'data-last-price="(\d+(?:\.\d+)?)"')

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


def _en_rango(valor: Optional[float]) -> bool:
    # Un dólar fuera de este rango es un error de la fuente, no del mercado.
    return valor is not None and 500 <= valor <= 50000


def leer_google_finance(html: str) -> Optional[dict]:
    """El precio USD/COP de la página de Google Finance, o None si no está."""
    m = PATRON_GOOGLE.search(html or "")
    if m:
        valor = _a_float(m.group(1))
        hora = PATRON_GOOGLE_HORA.search(html, m.end(), m.end() + 400)
    else:
        m = PATRON_GOOGLE_ATRIBUTO.search(html or "")
        valor = _a_float(m.group(1)) if m else None
        hora = None
    if not _en_rango(valor):
        return None
    vigencia = None
    if hora:
        vigencia = hoy_local(datetime.utcfromtimestamp(int(hora.group(1)))).isoformat()
    return {"valor": valor, "vigencia": vigencia}


def leer_respuesta_rpc(texto: str) -> Optional[dict]:
    """La cotización dentro de la respuesta de `batchexecute`: líneas JSON con
    `["wrb.fr", "<rpc>", "<datos como texto JSON>", …]`."""
    for linea in (texto or "").splitlines():
        if not linea.startswith("[["):
            continue
        try:
            filas = json.loads(linea)
        except ValueError:
            continue
        for fila in filas:
            if isinstance(fila, list) and len(fila) > 2 and fila[0] == "wrb.fr" and isinstance(fila[2], str):
                resultado = leer_google_finance(fila[2])
                if resultado:
                    return resultado
    return None


def consultar_google_finance() -> Optional[dict]:
    """Cotización USD/COP de Google Finance, o None si no se pudo obtener."""
    import httpx

    try:
        respuesta = httpx.post(
            URL_GOOGLE_RPC,
            params={"rpcids": RPC_COTIZACION, "hl": "es", "rt": "c"},
            data={"f.req": json.dumps([[[RPC_COTIZACION, PEDIDO_USD_COP, None, "generic"]]])},
            headers=CABECERAS_GOOGLE,
            timeout=config.TRM_TIMEOUT_SEGUNDOS,
        )
        respuesta.raise_for_status()
        resultado = leer_respuesta_rpc(respuesta.text)
        if resultado:
            return resultado
    except Exception as exc:  # red, TLS, bloqueo...
        logger.warning("No se pudo consultar el dólar en Google Finance: %s", exc)

    # Respaldo: la página, que a veces trae el dato embebido.
    try:
        respuesta = httpx.get(config.TRM_GOOGLE_FINANCE_URL, headers=CABECERAS_GOOGLE,
                              timeout=config.TRM_TIMEOUT_SEGUNDOS, follow_redirects=True)
        respuesta.raise_for_status()
        resultado = leer_google_finance(respuesta.text)
    except Exception as exc:
        logger.warning("No se pudo leer la página de Google Finance: %s", exc)
        return None
    if resultado is None:
        logger.warning("Google Finance no trajo la cotización USD/COP (¿cambió el formato o pidió consentimiento?)")
    return resultado


def consultar_trm_oficial() -> Optional[dict]:
    """Última TRM publicada en datos.gov.co, o None si no se pudo obtener."""
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
    if not _en_rango(valor):
        logger.warning("TRM oficial descartada por valor fuera de rango: %r", filas[0].get("valor"))
        return None
    vigencia = str(filas[0].get("vigenciadesde") or "")[:10] or None
    return {"valor": valor, "vigencia": vigencia}


def consultar_cotizacion() -> Optional[dict]:
    """Google Finance y, si falla, la TRM oficial. Con la `fuente` de donde salió."""
    for fuente, consultar in ((FUENTE_GOOGLE, consultar_google_finance), (FUENTE_OFICIAL, consultar_trm_oficial)):
        resultado = consultar()
        if resultado:
            return {**resultado, "fuente": fuente}
    return None


def _resultado(valor: float, fuente: str, vigencia: Optional[str] = None, consultada: Optional[str] = None) -> dict:
    return {"valor": round(float(valor), 2), "fuente": fuente, "vigencia": vigencia, "fecha_consulta": consultada}


def _fecha(valor: Optional[str]) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(valor) if valor else None
    except ValueError:
        return None


def _vigente(consultada_en: Optional[datetime], ahora: datetime) -> bool:
    return consultada_en is not None and ahora - consultada_en < timedelta(minutes=config.TRM_REFRESCO_MINUTOS)


def obtener_trm(db: Session, ahora: Optional[datetime] = None) -> dict:
    """Dólar a usar ahora: `{"valor", "fuente", "vigencia", "fecha_consulta"}`.

    No hace commit: si consulta deja el valor en la sesión y lo confirma la
    transacción de quien llama (normalmente, la del evento).
    """
    global _ultimo_fallo
    ahora = ahora or datetime.utcnow()
    hoy = hoy_local(ahora).isoformat()

    if _vigente(_cache.get("_consultada_en"), ahora):
        return {k: v for k, v in _cache.items() if not k.startswith("_")}

    guardado_valor = _a_float(configuracion.obtener(db, CLAVE_OFICIAL_VALOR))
    guardado_vigencia = configuracion.obtener(db, CLAVE_OFICIAL_VIGENCIA)
    guardado_consulta = configuracion.obtener(db, CLAVE_OFICIAL_CONSULTA)
    guardado_fuente = configuracion.obtener(db, CLAVE_OFICIAL_FUENTE) or FUENTE_OFICIAL
    guardado_en = _fecha(configuracion.obtener(db, CLAVE_OFICIAL_CONSULTADA_EN))
    if guardado_valor and _vigente(guardado_en, ahora):
        _cache.clear()
        _cache.update(_resultado(guardado_valor, guardado_fuente, guardado_vigencia, guardado_consulta),
                      _consultada_en=guardado_en)
        return {k: v for k, v in _cache.items() if not k.startswith("_")}

    puede_consultar = config.TRM_CONSULTA_AUTOMATICA and (
        _ultimo_fallo is None or datetime.utcnow() - _ultimo_fallo >= ESPERA_TRAS_FALLO
    )
    if puede_consultar:
        cotizacion = consultar_cotizacion()
        if cotizacion:
            _ultimo_fallo = None
            vigencia = cotizacion.get("vigencia") or hoy
            configuracion.guardar(db, CLAVE_OFICIAL_VALOR, str(cotizacion["valor"]))
            configuracion.guardar(db, CLAVE_OFICIAL_VIGENCIA, vigencia)
            configuracion.guardar(db, CLAVE_OFICIAL_CONSULTA, hoy)
            configuracion.guardar(db, CLAVE_OFICIAL_FUENTE, cotizacion["fuente"])
            configuracion.guardar(db, CLAVE_OFICIAL_CONSULTADA_EN, ahora.isoformat(timespec="seconds"))
            _cache.clear()
            _cache.update(_resultado(cotizacion["valor"], cotizacion["fuente"], vigencia, hoy), _consultada_en=ahora)
            return {k: v for k, v in _cache.items() if not k.startswith("_")}
        _ultimo_fallo = datetime.utcnow()

    respaldo = _a_float(configuracion.obtener(db, CLAVE_RESPALDO))
    if respaldo:
        return _resultado(respaldo, FUENTE_RESPALDO_ADMIN)
    if guardado_valor:
        return _resultado(guardado_valor, FUENTE_ULTIMA_OFICIAL, guardado_vigencia, guardado_consulta)
    return _resultado(config.TRM_RESPALDO_COP, FUENTE_POR_DEFECTO)


def estado_trm(db: Session) -> dict:
    """Lo que muestra el panel de admin: el dólar vigente y el respaldo."""
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
