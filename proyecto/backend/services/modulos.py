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
    "solo_con_plan": (
        "modulos.solo_con_plan",
        "Solo publican con plan",
        "Mientras el acceso es por lista cerrada, solo publican solicitudes los cotizantes con un plan "
        "vigente. Las importadoras siguen igual. Apágalo al abrir al público.",
    ),
    "cobro_cotizaciones": (
        "modulos.cobro_cotizaciones",
        "Cobro por cotización",
        "Cada cotización consume 1 token (primero las gratis del reto). Los tokens se compran subiendo "
        "el comprobante en Pagos.",
    ),
    "pago_manual_cursos": (
        "modulos.pago_manual_cursos",
        "Pago manual de cursos",
        "Cada curso con precio se desbloquea por persona cuando el equipo aprueba el comprobante de pago "
        "(o da el acceso a mano en Accesos a cursos). Apágalo cuando haya pasarela: la compra vuelve a ser directa.",
    ),
}


def _por_defecto(nombre: str) -> bool:
    if nombre == "academico":
        return bool(config.MODULO_EDUCATIVO_HABILITADO)
    if nombre == "registro":
        return bool(config.REGISTRO_PUBLICO_HABILITADO)
    if nombre == "solo_con_plan":
        return bool(config.PUBLICAR_SOLO_CON_PLAN)
    if nombre == "cobro_cotizaciones":
        return bool(config.COBRO_COTIZACIONES_TOKENS)
    if nombre == "pago_manual_cursos":
        return bool(config.PAGO_MANUAL_CURSOS)
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
