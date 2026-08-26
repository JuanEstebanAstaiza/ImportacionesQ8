"""Envío de WhatsApp a través de una instancia de open-wa (wa-automate).

open-wa expone una "EASY API" HTTP local: se llama `POST {OPENWA_API_URL}/sendText`
con cabecera `api_key` y cuerpo `{"args": {"to": "<numero>@c.us", "content": "..."}}`.

Igual que `utils.email`, el envío es *best-effort*: si la instancia no está
configurada o no responde, se registra en el log y el flujo de negocio continúa.
Nunca debe romper una cotización o un pago porque el WhatsApp no salió.
"""
from __future__ import annotations

import json
import logging
import re
import urllib.error
import urllib.request
from typing import Optional

import config

logger = logging.getLogger("importacionesq8")

_SOLO_DIGITOS = re.compile(r"\D+")


def normalizar_numero_whatsapp(
    numero: Optional[str],
    indicativo: Optional[str] = None,
) -> Optional[str]:
    """Deja el número en dígitos con indicativo de país, sin `+` ni separadores.

    open-wa identifica los chats como `<numero>@c.us`, y ese número debe ir en
    formato internacional. Los teléfonos se guardan sin validar (`Usuario.whatsapp`
    es texto libre), así que hay que tolerar "+57 300 123 4567", "300-1234567", etc.
    """
    if not numero:
        return None

    digitos = _SOLO_DIGITOS.sub("", str(numero))
    if not digitos:
        return None

    prefijo = _SOLO_DIGITOS.sub("", str(indicativo or config.WHATSAPP_INDICATIVO_POR_DEFECTO or ""))

    # Un móvil colombiano son 10 dígitos; si vienen "pelados", se antepone el país.
    if prefijo and len(digitos) <= 10:
        digitos = f"{prefijo}{digitos}"

    # Menos de 8 dígitos no es un número marcable: mejor no intentar el envío.
    if len(digitos) < 8:
        return None

    return digitos


def whatsapp_configurado() -> bool:
    return bool(config.NOTIFICACIONES_WHATSAPP and config.OPENWA_API_URL)


def enviar_whatsapp(
    numero: Optional[str],
    mensaje: str,
    *,
    indicativo: Optional[str] = None,
) -> bool:
    """Envía un mensaje de texto. Devuelve True si open-wa lo aceptó.

    Devuelve False (sin lanzar) cuando no hay número utilizable, la integración
    está apagada o la instancia responde con error.
    """
    if not whatsapp_configurado():
        logger.info(
            "WhatsApp no configurado (OPENWA_API_URL vacío o NOTIFICACIONES_WHATSAPP=false): "
            "se omite el envío a %s",
            numero,
        )
        return False

    destino = normalizar_numero_whatsapp(numero, indicativo)
    if not destino:
        logger.info("WhatsApp omitido: el usuario no tiene un número utilizable (%r)", numero)
        return False

    url = f"{config.OPENWA_API_URL}{config.OPENWA_SEND_PATH}"
    cuerpo = json.dumps({
        "args": {
            "to": f"{destino}@c.us",
            "content": mensaje,
        }
    }).encode("utf-8")

    peticion = urllib.request.Request(url, data=cuerpo, method="POST")
    peticion.add_header("Content-Type", "application/json")
    if config.OPENWA_API_KEY:
        peticion.add_header("api_key", config.OPENWA_API_KEY)
        # Algunas builds de open-wa esperan el esquema Bearer en vez de `api_key`.
        peticion.add_header("Authorization", f"Bearer {config.OPENWA_API_KEY}")

    try:
        with urllib.request.urlopen(peticion, timeout=config.OPENWA_TIMEOUT_SECONDS) as respuesta:
            return 200 <= respuesta.status < 300
    except urllib.error.HTTPError as exc:
        logger.warning("open-wa rechazó el envío a %s: HTTP %s", destino, exc.code)
        return False
    except Exception:
        logger.warning("No se pudo contactar la instancia de open-wa en %s", url, exc_info=True)
        return False
