"""Composición del shipping mark (marca de embarque).

Es la etiqueta que va rotulada en las cajas para distinguir la mercancía de un
cliente dentro del contenedor de la empresa importadora. Se forma con dos
partes:

- el **prefijo de la empresa**, fijo en su perfil (p. ej. "ctl"),
- el **sufijo del cliente**, que este escribe al pedir la cotización
  (p. ej. "prendas control").

El resultado es `ctl-prendascontrol`: dos empresas pueden tener un cliente que
se llame igual y sus cajas siguen siendo distinguibles, y dentro de una misma
empresa cada cliente tiene su propio sufijo.

El texto se normaliza a `[a-z0-9]` porque acaba impreso o estarcido sobre
cartón y leído por operarios de bodega y agentes de aduana en varios países:
las tildes, la eñe y los espacios se pierden o se transcriben mal.
"""
from __future__ import annotations

import unicodedata
from typing import Optional

SEPARADOR = "-"
LONGITUD_MAX_PREFIJO = 12
LONGITUD_MAX_SUFIJO = 40


def normalizar_segmento(valor: Optional[str]) -> str:
    """Deja solo minúsculas y dígitos ASCII. Cadena vacía si no queda nada."""
    if not valor or not isinstance(valor, str):
        return ""

    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", valor)
        if unicodedata.category(c) != "Mn"
    )
    # La eñe se descompone en "n" + tilde, así que NFD ya la resuelve; el resto
    # de caracteres no ASCII (ç, símbolos, emojis) simplemente se descartan.
    return "".join(c for c in sin_tildes.lower() if c.isascii() and c.isalnum())


def componer_shipping_mark(prefijo: Optional[str], sufijo: Optional[str]) -> Optional[str]:
    """`("ctl", "prendas control")` → `"ctl-prendascontrol"`.

    Devuelve `None` si falta cualquiera de las dos partes: un shipping mark a
    medias no sirve para rotular nada, y es preferible a que aparezca un
    "ctl-" suelto en un documento de embarque.
    """
    inicio = normalizar_segmento(prefijo)
    final = normalizar_segmento(sufijo)
    if not inicio or not final:
        return None
    return f"{inicio}{SEPARADOR}{final}"
