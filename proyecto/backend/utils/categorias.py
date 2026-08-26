"""Vocabulario de líneas de producto / especialidades y su comparación.

Por qué existe este módulo
--------------------------
La congruencia de categoría (`una empresa solo responde cotizaciones de su
especialidad`) y el motor de matching comparaban cadenas **exactas**:

    cotizacion.linea_producto not in importador.especialidad_producto
    Importador.especialidad_producto LIKE '%"Químicos"%'

El formulario de cotización y el perfil de empresa ofrecían listas distintas
("Químicos" frente a "Química", "Textiles" frente a "Textil"), así que había
combinaciones que **nunca** podían coincidir: la empresa veía la cotización en
su bandeja y al responder recibía un 400/403 que parecía un problema de
permisos. Aquí se centraliza el vocabulario y una comparación tolerante a
mayúsculas, tildes, plurales y variantes léxicas, para que los datos que ya
están guardados sigan funcionando.

El mismo listado canónico vive en el frontend en
`proyecto/frontend/src/lib/categorias.ts`, que alimenta tanto el selector
"Línea de producto" de la cotización como las "Categorías" del perfil de la
empresa. Si se añade una categoría, hay que tocar los dos ficheros.
"""
from __future__ import annotations

import unicodedata
from typing import Iterable, Optional

# Vocabulario ofrecido en la interfaz. No es una lista cerrada a efectos de
# validación: los datos históricos pueden traer cualquier texto y se comparan
# igualmente de forma normalizada.
CATEGORIAS_CANONICAS = (
    "Tecnología",
    "Electrónica",
    "Software",
    "Textil",
    "Confección",
    "Alimentos",
    "Bebidas",
    "Agroindustria",
    "Maquinaria",
    "Industrial",
    "Automotriz",
    "Construcción",
    "Química",
    "Farmacéutico",
    "Consumo masivo",
    "Seguridad",
)

# Variantes léxicas que no se resuelven quitando tildes ni el plural. La clave y
# el valor son claves ya normalizadas (ver `clave_categoria`).
_SINONIMOS = {
    "quimico": "quimica",
    "quimicos": "quimica",
    "textil": "textil",
    "textiles": "textil",
    "tecnologico": "tecnologia",
    "tecnologia de la informacion": "tecnologia",
    "ti": "tecnologia",
    "electronico": "electronica",
    "farmaceutica": "farmaceutico",
    "farmacia": "farmaceutico",
    "alimento": "alimentos",
    "alimentacion": "alimentos",
    "agroindustrial": "agroindustria",
    "agro": "agroindustria",
    "industria": "industrial",
    "construccion civil": "construccion",
    "consumo": "consumo masivo",
    "maquinas": "maquinaria",
    "maquina": "maquinaria",
    "automotor": "automotriz",
    "automocion": "automotriz",
}


def _sin_tildes(valor: str) -> str:
    descompuesto = unicodedata.normalize("NFD", valor)
    return "".join(c for c in descompuesto if unicodedata.category(c) != "Mn")


def _slug(valor: str) -> str:
    """minúsculas, sin tildes, sin puntuación y con espacios colapsados."""
    limpio = _sin_tildes(valor).lower()
    limpio = "".join(c if c.isalnum() else " " for c in limpio)
    return " ".join(limpio.split())


def _singular(palabra: str) -> str:
    """Plural español aproximado: "textiles"→"textil", "bebidas"→"bebida"."""
    if palabra.endswith("es") and len(palabra) > 4:
        return palabra[:-2]
    if palabra.endswith("s") and len(palabra) > 3:
        return palabra[:-1]
    return palabra


def clave_categoria(valor: Optional[str]) -> str:
    """Clave comparable de una categoría. Cadena vacía si no hay valor útil."""
    if not valor or not isinstance(valor, str):
        return ""

    slug = _slug(valor)
    if not slug:
        return ""

    # El sinónimo se busca antes y después de singularizar: así "químicos"
    # (entrada directa) y "quimicos" (ya singularizado a "quimico") caen ambos
    # en "quimica".
    if slug in _SINONIMOS:
        slug = _SINONIMOS[slug]

    singular = " ".join(_singular(p) for p in slug.split())
    return _SINONIMOS.get(singular, singular)


def claves_categorias(valores: Optional[Iterable]) -> set:
    """Conjunto de claves comparables, ignorando entradas vacías o no textuales."""
    if not valores:
        return set()
    return {clave for clave in (clave_categoria(v) for v in valores) if clave}


def categoria_en(linea_producto: Optional[str], especialidades: Optional[Iterable]) -> bool:
    """¿La línea de producto encaja con alguna de las especialidades declaradas?

    Una empresa **sin especialidades declaradas no queda bloqueada**: no se
    puede afirmar que la categoría le sea ajena, y bloquearla la dejaba sin
    poder responder absolutamente nada. El motor de matching sí exige
    especialidad declarada, porque ahí hay que elegir a quién avisar
    (ver `matching_service.matching_cotizacion_abierta`).
    """
    claves = claves_categorias(especialidades)
    if not claves:
        return True

    clave = clave_categoria(linea_producto)
    if not clave:
        return True

    return clave in claves


def texto_en(valor: Optional[str], opciones: Optional[Iterable]) -> bool:
    """Igual que `categoria_en` pero sin sinónimos: para países de origen.

    Aquí no hay lista canónica compartida, solo hace falta tolerar mayúsculas,
    tildes y espacios sobrantes ("Japón" / "japon").
    """
    if not opciones:
        return False
    objetivo = _slug(valor or "")
    if not objetivo:
        return False
    return any(_slug(str(opcion)) == objetivo for opcion in opciones)
