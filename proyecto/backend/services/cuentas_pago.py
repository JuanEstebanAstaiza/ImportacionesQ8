"""Cuenta bancaria de un usuario para recibir pagos (hoy: la recompensa del reto).

Una por usuario (`cuentas_pago.usuario_id` es único). Se carga desde el perfil o
al reclamar la recompensa en efectivo; las dos vías escriben la misma fila.
Número y documento van cifrados (utils/cifrado.py): al dueño solo le vuelven
enmascarados y el número completo lo ve únicamente el admin que transfiere.
"""
from __future__ import annotations

from typing import Dict, Optional

from sqlalchemy.orm import Session

from models.reto import CuentaPago
from models.usuario import Usuario
from utils.cifrado import cifrar, descifrar

TIPOS_CUENTA = ("ahorros", "corriente")


def de_usuario(db: Session, usuario_id: str) -> Optional[CuentaPago]:
    return db.query(CuentaPago).filter(CuentaPago.usuario_id == usuario_id).first()


def _enmascarar_documento(cifrado: str) -> Optional[str]:
    try:
        documento = descifrar(cifrado)
    except ValueError:
        return None
    return "•" * max(len(documento) - 3, 0) + documento[-3:]


def resumen(cuenta: Optional[CuentaPago]) -> Optional[Dict]:
    """Lo que ve el dueño: nunca el número completo."""
    if cuenta is None:
        return None
    return {
        "banco": cuenta.banco,
        "tipo_cuenta": cuenta.tipo_cuenta,
        "ultimos_digitos": cuenta.ultimos_digitos,
        "titular": cuenta.titular,
        "documento": _enmascarar_documento(cuenta.documento_cifrado),
        "fecha_actualizacion": cuenta.fecha_actualizacion.isoformat() + "Z" if cuenta.fecha_actualizacion else None,
    }


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
