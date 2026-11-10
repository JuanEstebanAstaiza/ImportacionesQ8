"""Quién es quién dentro del módulo, a partir del usuario del JWT.

La empresa publica y compra como empresa: su cuenta dueña y sus asesores
comparten la misma cuenta del módulo, así que la empresa se activa una sola vez
y cualquiera de su equipo puede atender sus lotes y operaciones. El cotizante
opera con su propia cuenta.
"""
from __future__ import annotations

ROLES_EMPRESA = ("importador", "asesor")
ROLES_EQUIPO = ("admin", "soporte")
ROLES_CLIENTE = ("solicitante", "importador", "asesor")
# Quien entra al módulo: los clientes y el equipo. El diseñador no.
ROLES_MODULO = ROLES_CLIENTE + ROLES_EQUIPO


def cuenta_de(usuario: dict) -> str:
    if usuario.get("rol") in ROLES_EMPRESA and usuario.get("importador_id"):
        return f"empresa:{usuario['importador_id']}"
    return f"usuario:{usuario['user_id']}"


def es_empresa(usuario: dict) -> bool:
    return usuario.get("rol") in ROLES_EMPRESA and bool(usuario.get("importador_id"))


def es_equipo(usuario: dict) -> bool:
    return usuario.get("rol") in ROLES_EQUIPO
