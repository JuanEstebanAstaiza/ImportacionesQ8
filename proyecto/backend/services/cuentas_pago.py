"""Cuenta bancaria para pagar una recompensa del reto en efectivo.

No se guarda en el perfil: se pide al reclamar en efectivo y se borra al
marcar el pago (`borrar_si_no_hay_pagos`). Mientras existe, número y documento
van cifrados (utils/cifrado.py) y solo el admin que transfiere los ve completos.
"""
from __future__ import annotations

from typing import Dict, Optional

from sqlalchemy.orm import Session

from models.reto import CuentaPago, EleccionRecompensa, EstadoRecompensa, RetoParticipacion
from models.usuario import Usuario
from utils.cifrado import cifrar


def de_usuario(db: Session, usuario_id: str) -> Optional[CuentaPago]:
    return db.query(CuentaPago).filter(CuentaPago.usuario_id == usuario_id).first()


def borrar_si_no_hay_pagos(db: Session, usuario_id: str) -> bool:
    """Tras pagar: la cuenta se borra salvo que tenga otro pago en camino
    (dos rondas reclamadas en efectivo a la vez). No hace commit."""
    pendiente = db.query(RetoParticipacion.id).filter(
        RetoParticipacion.usuario_id == usuario_id,
        RetoParticipacion.eleccion == EleccionRecompensa.efectivo.value,
        RetoParticipacion.estado_recompensa == EstadoRecompensa.solicitada.value,
    ).first()
    if pendiente is not None:
        return False
    return db.query(CuentaPago).filter(CuentaPago.usuario_id == usuario_id).delete(synchronize_session=False) > 0


def guardar(db: Session, usuario: Usuario, datos: Dict) -> CuentaPago:
    """Crea o reemplaza la cuenta. No hace commit."""
    numero = "".join(c for c in datos["numero_cuenta"] if c.isdigit())
    cuenta = de_usuario(db, usuario.id)
    if cuenta is None:
        cuenta = CuentaPago(usuario_id=usuario.id)
        db.add(cuenta)
    cuenta.banco = datos["banco"].strip()
    cuenta.tipo_cuenta = datos["tipo_cuenta"]
    cuenta.numero_cifrado = cifrar(numero)
    cuenta.ultimos_digitos = numero[-4:]
    cuenta.titular = datos["titular"].strip()
    cuenta.documento_cifrado = cifrar(datos["documento_titular"].strip())
    return cuenta
