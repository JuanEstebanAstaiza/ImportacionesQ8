"""Ajustes de operación guardados en `configuracion_plataforma`.

Cada lectura cae al valor de `config.py` cuando la clave no existe, así que una
base recién creada funciona sin sembrar nada. Las escrituras quedan en la
sesión: hace commit quien llama.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

import config
from models.configuracion import ConfiguracionPlataforma

CLAVE_MODO_ASIGNACION = "asignacion.modo"
CLAVE_CUPO_POR_SOLICITUD = "asignacion.cupo_por_solicitud"
MODOS_ASIGNACION = ("manual", "automatica")
CUPO_MAXIMO_POR_SOLICITUD = 20


def obtener(db: Session, clave: str, defecto: Optional[str] = None) -> Optional[str]:
    fila = db.query(ConfiguracionPlataforma).filter(ConfiguracionPlataforma.clave == clave).first()
    if fila is None or fila.valor is None or fila.valor == "":
        return defecto
    return fila.valor


def guardar(db: Session, clave: str, valor: Optional[str], usuario_id: Optional[str] = None) -> None:
    fila = db.query(ConfiguracionPlataforma).filter(ConfiguracionPlataforma.clave == clave).first()
    if fila is None:
        fila = ConfiguracionPlataforma(clave=clave)
        db.add(fila)
    fila.valor = valor
    fila.actualizado_por = usuario_id
    fila.fecha_actualizacion = datetime.utcnow()


def modo_asignacion(db: Session) -> str:
    modo = (obtener(db, CLAVE_MODO_ASIGNACION, config.ASIGNACION_COTIZACIONES) or "manual").lower()
    return modo if modo in MODOS_ASIGNACION else "manual"


def cupo_por_solicitud(db: Session) -> int:
    valor = obtener(db, CLAVE_CUPO_POR_SOLICITUD)
    try:
        cupo = int(valor) if valor is not None else int(config.ASIGNACION_CUPO_POR_SOLICITUD)
    except (TypeError, ValueError):
        cupo = int(config.ASIGNACION_CUPO_POR_SOLICITUD)
    return max(1, cupo)
