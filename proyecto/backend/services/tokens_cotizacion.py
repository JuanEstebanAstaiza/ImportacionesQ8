"""Cobro de cotizaciones con tokens: cada cotización consume 1.

Primero se gasta una de las «cotizaciones gratis» que da el reto y, si no
quedan, un token de cotización (`usuarios.puntos_cotizacion`). Los tokens se
compran subiendo el comprobante en Pagos (ver services/comprobantes.py).
El cobro se enciende o apaga en *Admin › Módulos* (`cobro_cotizaciones`).
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from models.tier import MovimientoPuntoCotizacion
from models.usuario import Usuario

MENSAJE_SIN_TOKENS = (
    "No tienes tokens de cotización. Cárgalos en Pagos › Cargue y descargue de pagos "
    "y te los acreditamos apenas revisemos el comprobante."
)


class SinTokens(Exception):
    pass


def saldo(usuario: Usuario) -> int:
    return int(usuario.cotizaciones_gratis or 0) + int(usuario.puntos_cotizacion or 0)


def cobrar(db: Session, *, usuario_id: str, cotizacion_id: str) -> str:
    """Descuenta 1 (gratis primero, luego token) con UPDATE condicional, para
    que dos cotizaciones simultáneas no gasten el mismo último token. No hace
    commit: va en la misma transacción que crea la cotización. Devuelve qué se
    gastó: "gratis" o "token"."""
    gastada = db.query(Usuario).filter(Usuario.id == usuario_id, Usuario.cotizaciones_gratis >= 1).update(
        {Usuario.cotizaciones_gratis: Usuario.cotizaciones_gratis - 1}, synchronize_session=False)
    if gastada == 1:
        return "gratis"
    gastado = db.query(Usuario).filter(Usuario.id == usuario_id, Usuario.puntos_cotizacion >= 1).update(
        {Usuario.puntos_cotizacion: Usuario.puntos_cotizacion - 1}, synchronize_session=False)
    if gastado != 1:
        raise SinTokens()
    restante = int(db.query(Usuario.puntos_cotizacion).filter(Usuario.id == usuario_id).scalar() or 0)
    db.add(MovimientoPuntoCotizacion(
        usuario_id=usuario_id, cotizacion_id=cotizacion_id, tipo="consumo", delta=-1,
        saldo_resultante=restante, descripcion=f"Cotización {cotizacion_id}",
    ))
    return "token"
