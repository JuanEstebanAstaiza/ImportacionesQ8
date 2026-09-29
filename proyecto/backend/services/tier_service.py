"""Tiers del cotizante: recálculo por umbrales y desbloqueo con puntos.

El tier se gana por desempeño: cantidad de cotizaciones, cantidad de órdenes y
valor acumulado de esas órdenes en USD, contra la tabla `umbrales_tier_cotizante`
que edita el admin. Un cotizante con `tier_manual` conserva el nivel que le puso
el admin y el recálculo lo ignora.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List, Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from models.cotizacion import Cotizacion, EstadoCotizacion
from models.orden import Orden
from models.tier import MovimientoPuntoCotizacion, UmbralTierCotizante
from models.usuario import ORDEN_TIERS_COTIZANTE, TierCotizante, Usuario

logger = logging.getLogger("importacionesq8")

# Mismos valores que siembra la migración 0022: si la tabla está vacía (una BD
# creada con `create_all`), el recálculo no debe subir a todo el mundo a Élite.
UMBRALES_POR_DEFECTO = {
    TierCotizante.bronze.value: (0, 0, 0.0),
    TierCotizante.silver.value: (5, 1, 1000.0),
    TierCotizante.gold.value: (15, 3, 10000.0),
    TierCotizante.elite.value: (30, 10, 50000.0),
}


class SinPuntosParaDesbloquear(Exception):
    """El cotizante está por debajo del tier exigido y no le quedan puntos."""


@dataclass(frozen=True)
class MetricasTier:
    cotizaciones: int
    ordenes: int
    valor_operaciones_usd: float


def tier_insuficiente(tier_cotizante: Optional[str], tier_requerido: Optional[str]) -> bool:
    return ORDEN_TIERS_COTIZANTE.get(tier_cotizante or "", 0) < ORDEN_TIERS_COTIZANTE.get(tier_requerido or "", 0)


def consumir_punto_desbloqueo(db: Session, *, usuario_id: str, cotizacion_id: str) -> int:
    """Descuenta 1 punto y deja el movimiento auditado. No hace commit.

    El descuento es un UPDATE condicional (`puntos >= 1`), así dos peticiones
    simultáneas no pueden gastar el mismo último punto. Devuelve el saldo final.
    """
    actualizadas = db.query(Usuario).filter(
        Usuario.id == usuario_id,
        Usuario.puntos_cotizacion >= 1,
    ).update(
        {Usuario.puntos_cotizacion: Usuario.puntos_cotizacion - 1},
        synchronize_session=False,
    )
    if actualizadas != 1:
        raise SinPuntosParaDesbloquear()

    saldo = int(db.query(Usuario.puntos_cotizacion).filter(Usuario.id == usuario_id).scalar() or 0)
    db.add(MovimientoPuntoCotizacion(
        usuario_id=usuario_id,
        cotizacion_id=cotizacion_id,
        tipo="consumo",
        delta=-1,
        saldo_resultante=saldo,
        descripcion=f"Desbloqueo de cotización ID {cotizacion_id}",
    ))
    return saldo


def _umbrales(db: Session) -> Dict[str, tuple]:
    umbrales = dict(UMBRALES_POR_DEFECTO)
    for fila in db.query(UmbralTierCotizante).all():
        if fila.tier in umbrales:
            umbrales[fila.tier] = (
                int(fila.minimo_cotizaciones or 0),
                int(fila.minimo_ordenes or 0),
                float(fila.minimo_valor_operaciones_usd or 0.0),
            )
    return umbrales


def metricas_cotizante(db: Session, usuario_id: str) -> MetricasTier:
    """Desempeño que cuenta para el tier. Las cotizaciones anuladas no suman."""
    cotizaciones = db.query(func.count(Cotizacion.id)).filter(
        Cotizacion.solicitante_id == usuario_id,
        Cotizacion.cancelada_por_error.is_(None),
        or_(Cotizacion.estado.is_(None), Cotizacion.estado != EstadoCotizacion.cancelada.value),
    ).scalar() or 0
    ordenes, valor = db.query(
        func.count(Orden.id),
        func.coalesce(func.sum(Orden.precio_acordado_usd), 0.0),
    ).filter(Orden.solicitante_id == usuario_id).one()
    return MetricasTier(int(cotizaciones), int(ordenes or 0), float(valor or 0.0))


def tier_para_metricas(metricas: MetricasTier, umbrales: Dict[str, tuple]) -> str:
    """El tier más alto cuyos tres umbrales se cumplen a la vez."""
    alcanzado = TierCotizante.bronze.value
    for tier in sorted(ORDEN_TIERS_COTIZANTE, key=ORDEN_TIERS_COTIZANTE.get):
        min_cot, min_ord, min_valor = umbrales[tier]
        if (
            metricas.cotizaciones >= min_cot
            and metricas.ordenes >= min_ord
            and metricas.valor_operaciones_usd >= min_valor
        ):
            alcanzado = tier
    return alcanzado


def _recalcular(db: Session, usuario: Usuario, umbrales: Dict[str, tuple]) -> bool:
    if usuario.rol != "solicitante" or usuario.tier_manual:
        return False
    nuevo = tier_para_metricas(metricas_cotizante(db, str(usuario.id)), umbrales)
    if nuevo == usuario.tier:
        return False
    logger.info("Tier de %s: %s → %s", usuario.id, usuario.tier, nuevo)
    usuario.tier = nuevo
    return True


def recalcular_tier_cotizante(db: Session, usuario_id: Optional[str]) -> bool:
    """Recalcula un cotizante. No hace commit. Devuelve True si cambió."""
    if not usuario_id:
        return False
    # Las sesiones van con autoflush=False: sin esto la cotización u orden que
    # disparó el recálculo todavía no cuenta.
    db.flush()
    usuario = db.query(Usuario).filter(Usuario.id == str(usuario_id)).first()
    if not usuario:
        return False
    return _recalcular(db, usuario, _umbrales(db))


def recalcular_tier_best_effort(db: Session, usuario_id: Optional[str]) -> None:
    """Para enganchar tras un evento de negocio: un fallo aquí no debe tumbarlo.

    Solo lee y cambia un atributo; el commit es del caller.
    """
    try:
        recalcular_tier_cotizante(db, usuario_id)
    except Exception:
        logger.warning("No se pudo recalcular el tier de %s", usuario_id, exc_info=True)


def recalcular_tiers_todos(db: Session) -> Dict[str, int]:
    """Recorre todos los cotizantes automáticos y hace commit al final."""
    umbrales = _umbrales(db)
    usuarios: List[Usuario] = db.query(Usuario).filter(
        Usuario.rol == "solicitante",
        Usuario.tier_manual.is_(False),
    ).all()
    actualizados = sum(1 for usuario in usuarios if _recalcular(db, usuario, umbrales))
    db.commit()
    return {"evaluados": len(usuarios), "actualizados": actualizados}
