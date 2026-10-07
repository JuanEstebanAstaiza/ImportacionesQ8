"""Búsqueda de personas por nombre o correo, para los autocompletados.

Se usa donde alguien tiene que elegir a un usuario existente y puede recordar
solo parte de su correo o de su nombre: el admin al regalar acceso o asignar un
curador, la empresa al abrir un catálogo a un cliente.
"""
from __future__ import annotations

import unicodedata
from typing import Iterable, List

from sqlalchemy import func, or_

from models.usuario import Usuario
from utils.query_safety import like_contains_pattern

LONGITUD_MINIMA = 2
LIMITE_MAXIMO = 20


def normalizar(texto: str) -> str:
    """Minúsculas y sin tildes: «Andrés» encuentra «andres» y al revés."""
    descompuesto = unicodedata.normalize("NFKD", texto or "")
    return "".join(c for c in descompuesto if not unicodedata.combining(c)).lower().strip()


def terminos(consulta: str) -> List[str]:
    return [t for t in normalizar(consulta).split() if t][:5]


def filtro_sql(consulta: str):
    """Cada palabra de la búsqueda debe aparecer en el correo, el nombre o el
    apellido. En MySQL la intercalación utf8mb4_unicode_ci ya ignora tildes y
    mayúsculas; en SQLite (tests) solo mayúsculas."""
    condiciones = []
    # Las tildes se dejan como se escribieron: MySQL ya las ignora al comparar,
    # y quitarlas aquí haría que en SQLite «julián» no encontrara a «Julián».
    for termino in [t for t in (consulta or "").lower().split() if t][:5]:
        patron = like_contains_pattern(termino)
        condiciones.append(or_(
            func.lower(Usuario.email).like(patron, escape="\\"),
            func.lower(func.coalesce(Usuario.nombre, "")).like(patron, escape="\\"),
            func.lower(func.coalesce(Usuario.apellido, "")).like(patron, escape="\\"),
        ))
    return condiciones


def coincide(consulta: str, campos: Iterable[str]) -> bool:
    """La misma regla, en memoria, para listas ya cargadas."""
    texto = " ".join(normalizar(c) for c in campos if c)
    return all(t in texto for t in terminos(consulta))


def prioridad(consulta: str, email: str, nombre: str) -> tuple:
    """Primero quien empieza por lo escrito (correo o nombre); luego el resto."""
    q = normalizar(consulta)
    e, n = normalizar(email), normalizar(nombre)
    return (0 if e.startswith(q) or n.startswith(q) else 1, e)


def enmascarar_correo(email: str) -> str:
    """«juanastaiza@gmail.com» → «ju•••••••za@gmail.com». Basta para distinguir
    a dos clientes con el mismo nombre sin revelar el correo completo."""
    if not email or "@" not in email:
        return ""
    usuario, dominio = email.split("@", 1)
    if len(usuario) <= 4:
        visible = usuario[:1] + "•" * max(len(usuario) - 1, 1)
    else:
        visible = usuario[:2] + "•" * (len(usuario) - 4) + usuario[-2:]
    return f"{visible}@{dominio}"
