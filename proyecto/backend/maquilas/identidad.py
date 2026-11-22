"""Quién es quién dentro del módulo, a partir del usuario del JWT.

- La maquiladora (rol `maquiladora`) atiende como empresa: su dueño y sus
  colaboradores comparten la cuenta `maquiladora:<id>`. El vínculo usuario →
  maquiladora vive en la colección `miembros` (la tabla de usuarios de MySQL no
  sabe nada de maquiladoras).
- Los clientes son los de siempre: el cotizante con su cuenta y la empresa
  importadora (dueña y asesores) con la de su empresa, igual que en Liquidaciones.
"""
from __future__ import annotations

from typing import Dict, Optional

from fastapi import HTTPException, status
from pymongo.database import Database

ROLES_MAQUILADORA = ("maquiladora",)
ROLES_CLIENTE = ("solicitante", "importador", "asesor")
ROLES_EQUIPO = ("admin", "soporte")
# Quien entra al módulo. El diseñador no (en la fase de marca tendrá su cola propia).
ROLES_MODULO = ROLES_CLIENTE + ROLES_MAQUILADORA + ROLES_EQUIPO


def es_equipo(usuario: Optional[dict]) -> bool:
    return bool(usuario) and usuario.get("rol") in ROLES_EQUIPO


def es_maquiladora(usuario: Optional[dict]) -> bool:
    return bool(usuario) and usuario.get("rol") in ROLES_MAQUILADORA


def membresia(db: Database, usuario: dict) -> Optional[Dict]:
    if not es_maquiladora(usuario):
        return None
    return db.miembros.find_one({"_id": usuario["user_id"]})


def maquiladora_id_de(db: Database, usuario: dict) -> Optional[str]:
    fila = membresia(db, usuario)
    return fila["maquiladora_id"] if fila else None


def requerir_maquiladora_id(db: Database, usuario: dict) -> str:
    maquiladora_id = maquiladora_id_de(db, usuario)
    if not maquiladora_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Tu cuenta no está vinculada a ninguna maquiladora")
    return maquiladora_id


def cuenta_de(db: Database, usuario: dict) -> str:
    if es_maquiladora(usuario):
        return f"maquiladora:{requerir_maquiladora_id(db, usuario)}"
    if usuario.get("rol") in ("importador", "asesor") and usuario.get("importador_id"):
        return f"empresa:{usuario['importador_id']}"
    return f"usuario:{usuario['user_id']}"
