"""Cobro de cotizaciones con tokens: cada cotización consume 1.

Se gasta en este orden:
1. una de las «cotizaciones gratis» que da el reto;
2. una solicitud del plan (models/plan.py), si el plan sigue vigente: es lo
   que vence primero;
3. un token de cotización comprado suelto (`usuarios.puntos_cotizacion`), que
   no vence. Los tokens se compran subiendo el comprobante en Pagos.

Si una solicitud no recibe propuestas en 72 horas, la unidad vuelve al mismo
saldo del que salió (`devolver_sin_propuestas`, tarea periódica de main.py).
El cobro se enciende o apaga en *Admin › Módulos* (`cobro_cotizaciones`).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Dict, Optional

from sqlalchemy.orm import Session

from models.tier import MovimientoPuntoCotizacion
from models.usuario import Usuario

logger = logging.getLogger("importacionesq8")

HORAS_PARA_DEVOLVER = 72

MENSAJE_SIN_TOKENS = (
    "No tienes solicitudes disponibles. Compra un plan en la sección Planes o carga tokens en "
    "Pagos › Cargue y descargue de pagos y te los acreditamos apenas revisemos el comprobante."
)

MENSAJE_SIN_PLAN = (
    "Por ahora solo publican solicitudes quienes tienen un plan activo. Acceso por lista cerrada: "
    "apertura al público próximamente."
)


class SinTokens(Exception):
    pass


def plan_vigente(usuario: Usuario, ahora: Optional[datetime] = None) -> bool:
    vence = usuario.plan_vence_en
    return bool(vence and vence > (ahora or datetime.utcnow()))


def solicitudes_plan_vigentes(usuario: Usuario, ahora: Optional[datetime] = None) -> int:
    return int(usuario.solicitudes_plan or 0) if plan_vigente(usuario, ahora) else 0


def saldo(usuario: Usuario) -> int:
    return (int(usuario.cotizaciones_gratis or 0) + solicitudes_plan_vigentes(usuario)
            + int(usuario.puntos_cotizacion or 0))


def cobrar(db: Session, *, usuario_id: str, cotizacion_id: str) -> str:
    """Descuenta 1 con UPDATE condicional, para que dos cotizaciones simultáneas
    no gasten la misma última unidad. No hace commit: va en la misma
    transacción que crea la cotización. Devuelve qué se gastó: "gratis",
    "plan" o "token"."""
    gastada = db.query(Usuario).filter(Usuario.id == usuario_id, Usuario.cotizaciones_gratis >= 1).update(
        {Usuario.cotizaciones_gratis: Usuario.cotizaciones_gratis - 1}, synchronize_session=False)
    if gastada == 1:
        return "gratis"
    gastada = db.query(Usuario).filter(
        Usuario.id == usuario_id, Usuario.solicitudes_plan >= 1, Usuario.plan_vence_en > datetime.utcnow(),
    ).update({Usuario.solicitudes_plan: Usuario.solicitudes_plan - 1}, synchronize_session=False)
    if gastada == 1:
        restante = int(db.query(Usuario.solicitudes_plan).filter(Usuario.id == usuario_id).scalar() or 0)
        db.add(MovimientoPuntoCotizacion(
            usuario_id=usuario_id, cotizacion_id=cotizacion_id, tipo="consumo_plan", delta=-1,
            saldo_resultante=restante, descripcion=f"Cotización {cotizacion_id} (plan)",
        ))
        return "plan"
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


_COLUMNA = {
    "gratis": Usuario.cotizaciones_gratis,
    "plan": Usuario.solicitudes_plan,
    "token": Usuario.puntos_cotizacion,
}


def devolver_sin_propuestas(db: Session, ahora: Optional[datetime] = None) -> Dict[str, int]:
    """Devuelve la unidad de las solicitudes que llevan 72 horas sin propuestas.

    Cuenta cualquier propuesta, aunque después se haya retirado o rechazado: lo
    que se promete es que la solicitud *reciba* propuestas. La marca
    `unidad_devuelta_en` se pone con un UPDATE condicional, así que dos workers
    que corran la tarea a la vez no devuelven la misma unidad dos veces.
    """
    from models.cotizacion import Cotizacion
    from models.propuesta import Propuesta
    from services.notificacion_service import notificar

    ahora = ahora or datetime.utcnow()
    limite = ahora - timedelta(hours=HORAS_PARA_DEVOLVER)
    con_propuestas = db.query(Propuesta.cotizacion_id)
    candidatas = (
        db.query(Cotizacion)
        .filter(
            Cotizacion.unidad_cobrada.in_(tuple(_COLUMNA)),
            Cotizacion.unidad_devuelta_en.is_(None),
            Cotizacion.fecha_creacion <= limite,
            # Acota la búsqueda: lo más viejo ya se revisó en vueltas anteriores.
            Cotizacion.fecha_creacion >= limite - timedelta(days=30),
            ~Cotizacion.id.in_(con_propuestas),
        )
        .limit(500)
        .all()
    )
    devueltas = 0
    for cot in candidatas:
        marcada = db.query(Cotizacion).filter(
            Cotizacion.id == cot.id, Cotizacion.unidad_devuelta_en.is_(None),
        ).update({Cotizacion.unidad_devuelta_en: ahora}, synchronize_session=False)
        if marcada != 1:
            continue
        columna = _COLUMNA[cot.unidad_cobrada]
        db.query(Usuario).filter(Usuario.id == cot.solicitante_id).update(
            {columna: columna + 1}, synchronize_session=False)
        if cot.unidad_cobrada in ("plan", "token"):
            restante = int(db.query(columna).filter(Usuario.id == cot.solicitante_id).scalar() or 0)
            db.add(MovimientoPuntoCotizacion(
                usuario_id=cot.solicitante_id, cotizacion_id=cot.id, tipo="devolucion", delta=1,
                saldo_resultante=restante,
                descripcion=f"Sin propuestas en {HORAS_PARA_DEVOLVER} horas ({cot.unidad_cobrada})",
            ))
        producto = cot.nombre_producto or "tu solicitud"
        notificar(
            db, usuario_id=cot.solicitante_id, tipo="pagos",
            titulo="Te devolvimos una solicitud",
            mensaje=(f"«{producto}» no recibió propuestas en {HORAS_PARA_DEVOLVER} horas, así que la "
                     "solicitud volvió a tu saldo. Puedes ajustarla y publicarla de nuevo."),
            data={"evento": "solicitud_devuelta", "cotizacion_id": cot.id},
            enlace_relativo="/cotizaciones", whatsapp=False, email=True,
        )
        devueltas += 1
    db.commit()
    return {"revisadas": len(candidatas), "devueltas": devueltas}

