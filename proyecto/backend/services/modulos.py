"""Módulos de la plataforma que el admin enciende o apaga sin redesplegar.

Cada módulo tiene su valor por defecto en el `.env` (p. ej.
`MODULO_EDUCATIVO_HABILITADO`); lo que el admin elija en *Módulos* se guarda en
`configuracion_plataforma` y manda sobre el `.env`.
"""
from __future__ import annotations

from typing import Dict

from sqlalchemy.orm import Session

import config
from services import configuracion

# clave pública → (clave en configuracion_plataforma, nombre, descripción)
MODULOS = {
    "academico": (
        "modulos.academico",
        "Módulo académico",
        "Cursos y formación para importadores. Apagado, desaparece del menú y su API responde 404.",
    ),
    "registro": (
        "modulos.registro",
        "Registro público",
        "Que los cotizantes se creen la cuenta solos. Apagado, solo el equipo crea cuentas desde Usuarios.",
    ),
    "cobro_cotizaciones": (
        "modulos.cobro_cotizaciones",
        "Cobro por cotización",
        "Cada cotización consume 1 token (primero las gratis del reto). Los tokens se compran subiendo "
        "el comprobante en Pagos.",
    ),
}


def _por_defecto(nombre: str) -> bool:
    if nombre == "academico":
        return bool(config.MODULO_EDUCATIVO_HABILITADO)
    if nombre == "registro":
        return bool(config.REGISTRO_PUBLICO_HABILITADO)
    if nombre == "cobro_cotizaciones":
        return bool(config.COBRO_COTIZACIONES_TOKENS)
    return True


def activo(db: Session, nombre: str) -> bool:
    clave = MODULOS[nombre][0]
    valor = configuracion.obtener(db, clave)
    if valor is None:
        return _por_defecto(nombre)
    return valor == "1"


def todos(db: Session) -> Dict[str, Dict]:
    return {
        nombre: {"activo": activo(db, nombre), "nombre": titulo, "descripcion": descripcion}
        for nombre, (_, titulo, descripcion) in MODULOS.items()
    }


def fijar(db: Session, nombre: str, valor: bool, usuario_id: str) -> None:
    configuracion.guardar(db, MODULOS[nombre][0], "1" if valor else "0", usuario_id)
