"""Acceso a Tendencias: suscripción pagada, cortesía y acceso libre temporal.

Tendencias v2 (feed de productos virales, services/tendencias_virales.py) es
público por ahora. Esto queda listo para cuando se cobre por verla: el webhook
de pagos activa la suscripción y `tiene_acceso` decide quién entra.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.tendencias import AccesoTendencias, OrigenAcceso
from models.usuario import Usuario
from services import configuracion


# Precio en pesos de un periodo de suscripción. Sin precio, no se vende: el
# acceso solo se puede regalar desde el panel.
CLAVE_PRECIO_COP = "tendencias.precio_cop"
CLAVE_DIAS_SUSCRIPCION = "tendencias.dias_suscripcion"
DIAS_SUSCRIPCION_DEFECTO = 30

CONCEPTO_PAGO_SUSCRIPCION = "suscripcion_tendencias"

# Acceso libre temporal: hasta esta fecha (UTC, ISO) cualquier usuario con
# sesión ve Tendencias sin suscripción ni cortesía. Vacío o vencido: solo
# suscriptores e invitados. Lo fija el admin desde el panel.
CLAVE_ACCESO_LIBRE_HASTA = "tendencias.acceso_libre_hasta"


def _entero(db: Session, clave: str, defecto: int) -> int:
    try:
        return int(configuracion.obtener(db, clave, str(defecto)))
    except (TypeError, ValueError):
        return defecto


def precio_suscripcion(db: Session) -> Optional[int]:
    valor = configuracion.obtener(db, CLAVE_PRECIO_COP)
    try:
        precio = int(float(valor)) if valor is not None else None
    except (TypeError, ValueError):
        return None
    return precio if precio and precio > 0 else None


def dias_suscripcion(db: Session) -> int:
    return max(1, _entero(db, CLAVE_DIAS_SUSCRIPCION, DIAS_SUSCRIPCION_DEFECTO))


# ── Acceso ───────────────────────────────────────────────────────────────────

def puede_curar(usuario: Optional[Usuario]) -> bool:
    return bool(usuario and usuario.activo and (usuario.rol == "admin" or usuario.es_curador))


def puede_disenar(usuario: Optional[Usuario]) -> bool:
    """Pone portada e imágenes y publica lo aprobado: los designers de Zarpi y,
    como respaldo, el admin."""
    return bool(usuario and usuario.activo and usuario.rol in ("designer", "admin"))


def _accesos_vigentes(db: Session, usuario_id: str, ahora: datetime):
    return db.query(AccesoTendencias).filter(
        AccesoTendencias.usuario_id == usuario_id,
        AccesoTendencias.revocado_en.is_(None),
        AccesoTendencias.inicio <= ahora,
        AccesoTendencias.fin > ahora,
    )


def acceso_vigente(db: Session, usuario_id: str, ahora: Optional[datetime] = None) -> Optional[AccesoTendencias]:
    """El periodo vigente que termina más tarde, o None."""
    ahora = ahora or datetime.utcnow()
    return _accesos_vigentes(db, usuario_id, ahora).order_by(AccesoTendencias.fin.desc()).first()


def acceso_hasta(db: Session, usuario_id: str, ahora: Optional[datetime] = None) -> Optional[datetime]:
    """Hasta cuándo tiene acceso, contando periodos ya comprados que empiezan
    después del actual (una renovación anticipada)."""
    ahora = ahora or datetime.utcnow()
    return (
        db.query(func.max(AccesoTendencias.fin))
        .filter(
            AccesoTendencias.usuario_id == usuario_id,
            AccesoTendencias.revocado_en.is_(None),
            AccesoTendencias.fin > ahora,
        )
        .scalar()
    )


def acceso_libre_hasta(db: Session, ahora: Optional[datetime] = None) -> Optional[datetime]:
    """Fin del periodo de acceso libre, si está vigente; None si no lo hay."""
    valor = configuracion.obtener(db, CLAVE_ACCESO_LIBRE_HASTA)
    if not valor:
        return None
    try:
        hasta = datetime.fromisoformat(valor.rstrip("Z"))
    except ValueError:
        return None
    return hasta if hasta > (ahora or datetime.utcnow()) else None


def tiene_acceso(db: Session, usuario: Optional[Usuario], ahora: Optional[datetime] = None) -> bool:
    if usuario is None:
        return False
    if puede_curar(usuario):
        return True
    if acceso_libre_hasta(db, ahora) is not None:
        return True
    return acceso_vigente(db, usuario.id, ahora) is not None


def otorgar_acceso(
    db: Session,
    *,
    usuario_id: str,
    dias: int,
    origen: str,
    pago_id: Optional[str] = None,
    otorgado_por: Optional[str] = None,
    nota: Optional[str] = None,
    ahora: Optional[datetime] = None,
) -> AccesoTendencias:
    """Agrega un periodo de `dias`. Si el usuario ya tiene acceso, el periodo
    nuevo empieza cuando termina el último: renovar antes de tiempo no hace
    perder días."""
    ahora = ahora or datetime.utcnow()
    inicio = max(ahora, acceso_hasta(db, usuario_id, ahora) or ahora)
    acceso = AccesoTendencias(
        usuario_id=usuario_id,
        origen=origen,
        inicio=inicio,
        fin=inicio + timedelta(days=dias),
        pago_id=pago_id,
        otorgado_por=otorgado_por,
        nota=nota,
    )
    db.add(acceso)
    return acceso


def activar_suscripcion_pagada(db: Session, pago) -> AccesoTendencias:
    """Lo llama el webhook al confirmar un pago de suscripción. El pago ya
    pasó de pendiente a confirmado en esta misma transacción."""
    return otorgar_acceso(
        db,
        usuario_id=str(pago.usuario_id),
        dias=int(pago.dias_acceso or DIAS_SUSCRIPCION_DEFECTO),
        origen=OrigenAcceso.pago.value,
        pago_id=str(pago.id),
    )


def revocar_por_reembolso(db: Session, pago) -> None:
    ahora = datetime.utcnow()
    db.query(AccesoTendencias).filter(
        AccesoTendencias.pago_id == str(pago.id),
        AccesoTendencias.revocado_en.is_(None),
    ).update({AccesoTendencias.revocado_en: ahora}, synchronize_session=False)


def lunes_de(d: date) -> date:
    return d - timedelta(days=d.weekday())
