"""Cupo diario de cotizaciones por empresa importadora.

Una empresa puede fijar `Importador.limite_cotizaciones_diarias` para no recibir
más cotizaciones de las que su equipo puede atender en un día. Cuentan las
dirigidas a ella y las abiertas que el matching le repartió, desde la medianoche
de `config.CUPO_COTIZACIONES_UTC_OFFSET_HORAS` (Colombia por defecto).

Con el cupo agotado:
- `POST /cotizaciones` dirigida a la empresa responde 409, así el cliente puede
  elegir otra empresa o publicarla abierta sin perder lo que escribió.
- El matching de abiertas la salta. Queda registrada como no entregada
  (`RecepcionCotizacion.entregada=False`) para no enseñársela luego en la
  bandeja ni aceptar propuestas sobre ella: sin ese registro, la lista general
  de la empresa la volvería a mostrar al día siguiente como si le hubiera llegado.
"""
from datetime import datetime, timedelta
from typing import Dict, Iterable, Optional, Set

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import config
from models.recepcion_cotizacion import RecepcionCotizacion


def _desfase() -> timedelta:
    return timedelta(hours=config.CUPO_COTIZACIONES_UTC_OFFSET_HORAS)


def inicio_dia_utc(ahora: Optional[datetime] = None) -> datetime:
    """Medianoche local de hoy, expresada en UTC naive (como `fecha_recepcion`)."""
    ahora = ahora or datetime.utcnow()
    local = ahora + _desfase()
    return local.replace(hour=0, minute=0, second=0, microsecond=0) - _desfase()


def recibidas_hoy(db: Session, importador_ids: Iterable[str], ahora: Optional[datetime] = None) -> Dict[str, int]:
    """Cotizaciones entregadas hoy a cada empresa, en una sola consulta agrupada."""
    ids = [str(i) for i in importador_ids]
    if not ids:
        return {}
    filas = db.query(RecepcionCotizacion.importador_id, func.count(RecepcionCotizacion.id)).filter(
        RecepcionCotizacion.importador_id.in_(ids),
        RecepcionCotizacion.entregada.is_(True),
        RecepcionCotizacion.fecha_recepcion >= inicio_dia_utc(ahora),
    ).group_by(RecepcionCotizacion.importador_id).all()
    conteo = {importador_id: 0 for importador_id in ids}
    conteo.update({importador_id: int(total) for importador_id, total in filas})
    return conteo


def cupo_agotado(limite: Optional[int], recibidas: int) -> bool:
    return limite is not None and recibidas >= limite


def estado_cupo(db: Session, importador, ahora: Optional[datetime] = None) -> dict:
    """Resumen para el panel de la empresa (`GET /importadores/cupo-diario`)."""
    ahora = ahora or datetime.utcnow()
    limite = importador.limite_cotizaciones_diarias
    recibidas = recibidas_hoy(db, [importador.id], ahora).get(str(importador.id), 0)
    return {
        "importador_id": str(importador.id),
        "limite_cotizaciones_diarias": limite,
        "recibidas_hoy": recibidas,
        "disponibles_hoy": None if limite is None else max(0, limite - recibidas),
        "cupo_agotado": cupo_agotado(limite, recibidas),
        "reinicia_en": inicio_dia_utc(ahora) + timedelta(days=1),
    }


def registrar_recepcion(
    db: Session,
    *,
    importador_id: str,
    cotizacion_id: str,
    modalidad: str,
    entregada: bool = True,
) -> None:
    """Añade la recepción a la sesión; el commit lo hace quien llama."""
    db.add(RecepcionCotizacion(
        importador_id=str(importador_id),
        cotizacion_id=str(cotizacion_id),
        modalidad=modalidad,
        entregada=entregada,
    ))


def registrar_reparto_abierta(db: Session, *, cotizacion_id: str, entregadas: Iterable[str], omitidas: Iterable[str]) -> None:
    """Deja constancia del reparto de una abierta. Idempotente ante reintentos."""
    for importador_id in entregadas:
        registrar_recepcion(db, importador_id=importador_id, cotizacion_id=cotizacion_id, modalidad="abierta")
    for importador_id in omitidas:
        registrar_recepcion(
            db, importador_id=importador_id, cotizacion_id=cotizacion_id, modalidad="abierta", entregada=False,
        )
    try:
        db.commit()
    except IntegrityError:
        # El matching ya se había ejecutado para esta cotización: lo registrado
        # la primera vez es lo que vale.
        db.rollback()


def cotizaciones_omitidas(db: Session, importador_id: Optional[str]) -> Set[str]:
    """Abiertas que el matching no le entregó a la empresa por tener el cupo agotado."""
    if not importador_id:
        return set()
    filas = db.query(RecepcionCotizacion.cotizacion_id).filter(
        RecepcionCotizacion.importador_id == str(importador_id),
        RecepcionCotizacion.entregada.is_(False),
    ).all()
    return {cotizacion_id for (cotizacion_id,) in filas}


def fue_omitida(db: Session, importador_id: str, cotizacion_id: str) -> bool:
    return db.query(RecepcionCotizacion.id).filter(
        RecepcionCotizacion.importador_id == str(importador_id),
        RecepcionCotizacion.cotizacion_id == str(cotizacion_id),
        RecepcionCotizacion.entregada.is_(False),
    ).first() is not None
