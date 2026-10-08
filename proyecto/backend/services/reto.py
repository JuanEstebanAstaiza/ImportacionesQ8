"""Reto comunitario: rondas, inscripción con cupos, conteo de aprobados y pago.

Ver models/reto.py. Textos de las notificaciones: docs/Tendencias · Guía de
construcción.html, sección 4 ("Notificaciones").
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.reto import (
    CuentaPago, EleccionRecompensa, EstadoRecompensa, EstadoRonda, RetoListaEspera,
    RetoParticipacion, RetoRonda,
)
from models.usuario import Usuario
from services import cuentas_pago
from utils.cifrado import descifrar

logger = logging.getLogger("importacionesq8")

AVISO_FALTAN = 3          # "Te faltan 3" se manda al llegar a umbral − 3
DIAS_INACTIVIDAD = 7

EXCLUSIONES = (
    "Se paga por producto aprobado, no por enviado. No cuentan: productos con registro "
    "sanitario (INVIMA, ICA), marcas o réplicas, y repetidos."
)


def _error(codigo: int, mensaje: str) -> HTTPException:
    return HTTPException(status_code=codigo, detail=mensaje)


def pesos(valor: int) -> str:
    return "$" + f"{int(valor):,}".replace(",", ".")


def _notificar(db: Session, usuario_id: str, evento: str, titulo: str, mensaje: str, *, email: bool) -> None:
    from services.notificacion_service import notificar

    notificar(
        db, usuario_id=usuario_id, tipo="reto", titulo=titulo, mensaje=mensaje,
        data={"evento": evento}, enlace_relativo="/reto", whatsapp=False, email=email,
    )


# ── Consultas ────────────────────────────────────────────────────────────────

def ronda_de(db: Session, participacion: RetoParticipacion) -> RetoRonda:
    return db.query(RetoRonda).filter(RetoRonda.id == participacion.ronda_id).one()


def participacion_por_id(db: Session, participacion_id: Optional[str]) -> Optional[RetoParticipacion]:
    if not participacion_id:
        return None
    return db.query(RetoParticipacion).filter(RetoParticipacion.id == participacion_id).first()


def participacion_vigente(db: Session, usuario_id: str, ahora: Optional[datetime] = None) -> Optional[RetoParticipacion]:
    """La inscripción en una ronda que todavía cuenta envíos (abierta o llena,
    antes de la fecha límite)."""
    ahora = ahora or datetime.utcnow()
    return (
        db.query(RetoParticipacion)
        .join(RetoRonda, RetoRonda.id == RetoParticipacion.ronda_id)
        .filter(
            RetoParticipacion.usuario_id == usuario_id,
            RetoRonda.estado.in_((EstadoRonda.abierta.value, EstadoRonda.llena.value)),
            RetoRonda.fecha_limite > ahora,
        )
        .order_by(RetoRonda.fecha_creacion.desc())
        .first()
    )


def inscritos(db: Session, ronda_id: str) -> int:
    return db.query(func.count(RetoParticipacion.id)).filter(RetoParticipacion.ronda_id == ronda_id).scalar() or 0


def ronda_abierta(db: Session, ahora: Optional[datetime] = None) -> Optional[RetoRonda]:
    ahora = ahora or datetime.utcnow()
    return (
        db.query(RetoRonda)
        .filter(RetoRonda.estado == EstadoRonda.abierta.value, RetoRonda.fecha_limite > ahora)
        .order_by(RetoRonda.fecha_creacion.desc())
        .first()
    )


def ronda_dict(db: Session, ronda: RetoRonda, admin: bool = False) -> Dict:
    usados = inscritos(db, ronda.id)
    datos = {
        "id": ronda.id,
        "nombre": ronda.nombre,
        "max_participantes": ronda.max_participantes,
        "cupos_restantes": max(ronda.max_participantes - usados, 0),
        "umbral_aprobados": ronda.umbral_aprobados,
        "recompensa_cop": ronda.recompensa_cop,
        "recompensa_cotizaciones": ronda.recompensa_cotizaciones,
        "fecha_limite": ronda.fecha_limite.isoformat() + "Z",
        "estado": ronda.estado,
        "exclusiones": EXCLUSIONES,
    }
    if admin:
        datos.update(presupuesto(db, ronda, usados))
        datos.update({
            "inscritos": usados,
            "abrir_siguiente_al_llenarse": ronda.abrir_siguiente_al_llenarse,
            "fecha_creacion": ronda.fecha_creacion.isoformat() + "Z",
        })
    return datos


def presupuesto(db: Session, ronda: RetoRonda, usados: Optional[int] = None) -> Dict:
    """El presupuesto se mueve con la ronda, no con los cupos:

    - `presupuesto_cop`: inscritos × recompensa. Lo que costaría si todos los
      inscritos llegan al umbral y eligen efectivo; crece con cada inscripción.
    - `presupuesto_maximo_cop`: cupos × recompensa, el techo si se llena.
    - `por_pagar_cop`: quienes ya llegaron y no cobraron (eligieron efectivo o
      todavía no eligieron) × recompensa vigente.
    - `pagado_cop`: lo transferido, con el monto de cada pago.
    """
    if usados is None:
        usados = inscritos(db, ronda.id)
    filas = db.query(RetoParticipacion.estado_recompensa, RetoParticipacion.eleccion,
                     RetoParticipacion.monto_pagado_cop).filter(RetoParticipacion.ronda_id == ronda.id).all()
    efectivo = EleccionRecompensa.efectivo.value
    pagado = sum(
        (monto if monto is not None else ronda.recompensa_cop)
        for estado, eleccion, monto in filas
        if estado == EstadoRecompensa.pagada.value and eleccion == efectivo
    )
    por_pagar = sum(
        1 for estado, eleccion, _ in filas
        if estado == EstadoRecompensa.reclamable.value
        or (estado == EstadoRecompensa.solicitada.value and eleccion == efectivo)
    ) * ronda.recompensa_cop
    cotizaciones = sum(
        1 for estado, eleccion, _ in filas
        if estado == EstadoRecompensa.pagada.value and eleccion == EleccionRecompensa.cotizaciones.value
    )
    return {
        "presupuesto_cop": usados * ronda.recompensa_cop,
        "presupuesto_maximo_cop": ronda.max_participantes * ronda.recompensa_cop,
        "por_pagar_cop": por_pagar,
        "pagado_cop": pagado,
        "recompensas_en_cotizaciones": cotizaciones,
    }


def aplicar_umbral(db: Session, ronda: RetoRonda) -> int:
    """Tras bajar el umbral: quien ya lo alcanza pasa a reclamable. Lo ya
    reclamado no se toca si el umbral sube. Devuelve cuántos cambiaron."""
    cambiaron = 0
    for participacion in db.query(RetoParticipacion).filter(
        RetoParticipacion.ronda_id == ronda.id,
        RetoParticipacion.estado_recompensa == EstadoRecompensa.pendiente.value,
        RetoParticipacion.aprobados >= ronda.umbral_aprobados,
    ).all():
        participacion.estado_recompensa = EstadoRecompensa.reclamable.value
        _notificar(db, participacion.usuario_id, "recompensa_lista",
                   f"Llegaste a {ronda.umbral_aprobados}: reclamá tu recompensa",
                   f"Elegí: {pesos(ronda.recompensa_cop)} o {ronda.recompensa_cotizaciones} cotizaciones gratis.",
                   email=True)
        cambiaron += 1
    return cambiaron


def resumen_participacion(db: Session, participacion: Optional[RetoParticipacion]) -> Optional[Dict]:
    if participacion is None:
        return None
    ronda = ronda_de(db, participacion)
    # Enmascarada: la cuenta que cargó para este pago o, ya pagado, el comprobante.
    cuenta = None
    if participacion.eleccion == EleccionRecompensa.efectivo.value:
        if participacion.estado_recompensa == EstadoRecompensa.pagada.value:
            if participacion.pago_ultimos_digitos:
                cuenta = {"banco": participacion.pago_banco, "tipo_cuenta": participacion.pago_tipo_cuenta,
                          "ultimos_digitos": participacion.pago_ultimos_digitos}
        else:
            fila = cuentas_pago.de_usuario(db, participacion.usuario_id)
            if fila is not None:
                cuenta = {"banco": fila.banco, "tipo_cuenta": fila.tipo_cuenta, "ultimos_digitos": fila.ultimos_digitos}
    return {
        "id": participacion.id,
        "ronda": ronda_dict(db, ronda),
        "aprobados": participacion.aprobados,
        "umbral": ronda.umbral_aprobados,
        "eleccion": participacion.eleccion,
        "estado_recompensa": participacion.estado_recompensa,
        "pagado_en": participacion.pagado_en.isoformat() + "Z" if participacion.pagado_en else None,
        "referencia_pago": participacion.referencia_pago,
        "cuenta": cuenta,
    }


# ── Inscripción ──────────────────────────────────────────────────────────────

def inscribir(db: Session, ronda_id: str, usuario: Usuario) -> RetoParticipacion:
    """Ocupa un cupo. La fila de la ronda se bloquea (SELECT … FOR UPDATE) para
    que dos inscripciones simultáneas no superen el máximo; la restricción
    única (ronda, usuario) evita inscribir dos veces a la misma persona."""
    ahora = datetime.utcnow()
    ronda = db.query(RetoRonda).filter(RetoRonda.id == ronda_id).with_for_update().first()
    if ronda is None:
        raise _error(status.HTTP_404_NOT_FOUND, "Ronda no encontrada")
    ya = db.query(RetoParticipacion).filter(
        RetoParticipacion.ronda_id == ronda.id, RetoParticipacion.usuario_id == usuario.id).first()
    if ya is not None:
        db.rollback()
        return ya
    if ronda.estado != EstadoRonda.abierta.value or ronda.fecha_limite <= ahora:
        db.rollback()
        raise _error(status.HTTP_409_CONFLICT, "La ronda ya está cerrada. Déjanos tu correo y te avisamos de la próxima.")
    usados = inscritos(db, ronda.id)
    if usados >= ronda.max_participantes:
        ronda.estado = EstadoRonda.llena.value
        db.commit()
        raise _error(status.HTTP_409_CONFLICT, "Se acabaron los cupos de esta ronda.")
    participacion = RetoParticipacion(ronda_id=ronda.id, usuario_id=usuario.id, ultimo_envio_en=ahora)
    db.add(participacion)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        existente = db.query(RetoParticipacion).filter(
            RetoParticipacion.ronda_id == ronda_id, RetoParticipacion.usuario_id == usuario.id).first()
        if existente is not None:
            return existente
        raise _error(status.HTTP_409_CONFLICT, "No se pudo completar la inscripción, inténtalo de nuevo.")

    siguiente = None
    if usados + 1 >= ronda.max_participantes:
        ronda.estado = EstadoRonda.llena.value
        if ronda.abrir_siguiente_al_llenarse:
            siguiente = abrir_siguiente(db, ronda)
    db.commit()
    db.refresh(participacion)
    if siguiente is not None:
        avisar_lista_espera(db, siguiente)
    return participacion


def abrir_siguiente(db: Session, anterior: RetoRonda) -> RetoRonda:
    """«Cuando se llenan los 20, cerramos la ronda y abrimos otra»: misma
    configuración y la misma duración que tenía la anterior."""
    duracion = max(anterior.fecha_limite - anterior.fecha_creacion, timedelta(days=7))
    numero = (db.query(func.count(RetoRonda.id)).scalar() or 0) + 1
    nueva = RetoRonda(
        nombre=f"Ronda {numero}",
        max_participantes=anterior.max_participantes,
        umbral_aprobados=anterior.umbral_aprobados,
        recompensa_cop=anterior.recompensa_cop,
        recompensa_cotizaciones=anterior.recompensa_cotizaciones,
        fecha_limite=datetime.utcnow() + duracion,
        abrir_siguiente_al_llenarse=anterior.abrir_siguiente_al_llenarse,
        creada_por=anterior.creada_por,
    )
    db.add(nueva)
    db.flush()
    return nueva


def avisar_lista_espera(db: Session, ronda: RetoRonda) -> int:
    """Avisa a quienes pidieron «avisame de la próxima»."""
    from services.notificacion_service import notificar
    from utils.email import enviar_correo_notificacion

    pendientes = db.query(RetoListaEspera).filter(RetoListaEspera.avisado_en.is_(None)).all()
    titulo = f"Abrimos {ronda.nombre} del reto de Tendencias"
    mensaje = (f"Hay {ronda.max_participantes} cupos. Por cada {ronda.umbral_aprobados} productos aprobados "
               f"reclamás {pesos(ronda.recompensa_cop)}. Inscribite antes de que se llene.")
    for fila in pendientes:
        try:
            if fila.usuario_id:
                notificar(db, usuario_id=fila.usuario_id, tipo="reto", titulo=titulo, mensaje=mensaje,
                          data={"evento": "ronda_abierta"}, enlace_relativo="/reto", whatsapp=False, email=True)
            else:
                enviar_correo_notificacion(fila.email, titulo, mensaje, "/reto")
            fila.avisado_en = datetime.utcnow()
        except Exception:
            logger.exception("No se pudo avisar de la nueva ronda a %s", fila.email)
    db.commit()
    return len(pendientes)


def anotar_lista_espera(db: Session, email: str, usuario: Optional[Usuario]) -> None:
    email = email.strip().lower()
    fila = db.query(RetoListaEspera).filter(RetoListaEspera.email == email).first()
    if fila is None:
        db.add(RetoListaEspera(email=email, usuario_id=usuario.id if usuario else None))
    else:
        fila.avisado_en = None
        if usuario and not fila.usuario_id:
            fila.usuario_id = usuario.id
    try:
        db.commit()
    except IntegrityError:
        db.rollback()


# ── Aprobados y recompensa ───────────────────────────────────────────────────

def registrar_aprobado(db: Session, participacion: RetoParticipacion) -> None:
    """Suma un aprobado (UPDATE atómico) y dispara los hitos del reto."""
    db.query(RetoParticipacion).filter(RetoParticipacion.id == participacion.id).update(
        {RetoParticipacion.aprobados: RetoParticipacion.aprobados + 1}, synchronize_session=False)
    db.refresh(participacion)
    ronda = ronda_de(db, participacion)
    umbral = ronda.umbral_aprobados
    if (participacion.aprobados == umbral - AVISO_FALTAN and umbral > AVISO_FALTAN
            and not participacion.aviso_faltan_pocos):
        participacion.aviso_faltan_pocos = True
        _notificar(db, participacion.usuario_id, "faltan_pocos",
                   f"Te faltan {AVISO_FALTAN} para tu recompensa",
                   f"Llevás {participacion.aprobados} de {umbral} productos aprobados.", email=True)
    if participacion.aprobados >= umbral and participacion.estado_recompensa == EstadoRecompensa.pendiente.value:
        participacion.estado_recompensa = EstadoRecompensa.reclamable.value
        _notificar(db, participacion.usuario_id, "recompensa_lista",
                   f"Llegaste a {umbral}: reclamá tu recompensa",
                   f"Elegí: {pesos(ronda.recompensa_cop)} o {ronda.recompensa_cotizaciones} cotizaciones gratis.",
                   email=True)


def _propia(db: Session, participacion_id: str, usuario: Usuario) -> RetoParticipacion:
    participacion = participacion_por_id(db, participacion_id)
    if participacion is None or participacion.usuario_id != usuario.id:
        raise _error(status.HTTP_404_NOT_FOUND, "Participación no encontrada")
    return participacion


def reclamar(db: Session, participacion_id: str, usuario: Usuario, eleccion: str) -> RetoParticipacion:
    participacion = _propia(db, participacion_id, usuario)
    if participacion.estado_recompensa != EstadoRecompensa.reclamable.value:
        raise _error(status.HTTP_409_CONFLICT, "Esta recompensa no se puede reclamar ahora")
    ronda = ronda_de(db, participacion)
    participacion.eleccion = eleccion
    if eleccion == EleccionRecompensa.cotizaciones.value:
        db.query(Usuario).filter(Usuario.id == usuario.id).update(
            {Usuario.cotizaciones_gratis: Usuario.cotizaciones_gratis + ronda.recompensa_cotizaciones},
            synchronize_session=False)
        participacion.estado_recompensa = EstadoRecompensa.pagada.value
        participacion.pagado_en = datetime.utcnow()
        db.refresh(usuario)
        _notificar(db, usuario.id, "cotizaciones_acreditadas", "Cotizaciones gratis acreditadas",
                   f"Tenés {usuario.cotizaciones_gratis} cotizaciones gratis disponibles.", email=True)
    else:
        # Los datos bancarios se piden ahora (guardar_cuenta) y se borran al pagar.
        participacion.estado_recompensa = EstadoRecompensa.solicitada.value
    db.commit()
    db.refresh(participacion)
    return participacion


def guardar_cuenta(db: Session, participacion_id: str, usuario: Usuario, datos: Dict) -> RetoParticipacion:
    """Los datos bancarios se piden solo al reclamar en efectivo; se pueden
    corregir hasta que el admin marque el pago."""
    participacion = _propia(db, participacion_id, usuario)
    if (participacion.eleccion != EleccionRecompensa.efectivo.value
            or participacion.estado_recompensa != EstadoRecompensa.solicitada.value):
        raise _error(status.HTTP_409_CONFLICT, "Los datos bancarios se piden al reclamar la recompensa en efectivo")
    cuentas_pago.guardar(db, usuario, datos)
    _notificar(db, usuario.id, "datos_pago_recibidos", "Recibimos tus datos de pago",
               "El pago sale en máximo 5 días hábiles.", email=True)
    db.commit()
    db.refresh(participacion)
    return participacion


def marcar_pagado(db: Session, participacion_id: str, referencia: str) -> RetoParticipacion:
    participacion = participacion_por_id(db, participacion_id)
    if participacion is None:
        raise _error(status.HTTP_404_NOT_FOUND, "Participación no encontrada")
    if participacion.estado_recompensa != EstadoRecompensa.solicitada.value:
        raise _error(status.HTTP_409_CONFLICT, "Solo se marca como pagada una recompensa en efectivo solicitada")
    cuenta = db.query(CuentaPago).filter(CuentaPago.usuario_id == participacion.usuario_id).first()
    if cuenta is None:
        raise _error(status.HTTP_409_CONFLICT, "El participante todavía no cargó sus datos bancarios")
    ronda = ronda_de(db, participacion)
    participacion.estado_recompensa = EstadoRecompensa.pagada.value
    participacion.pagado_en = datetime.utcnow()
    participacion.referencia_pago = referencia.strip()
    participacion.monto_pagado_cop = ronda.recompensa_cop
    # Del pago queda el comprobante; la cuenta completa se borra.
    participacion.pago_banco = cuenta.banco
    participacion.pago_tipo_cuenta = cuenta.tipo_cuenta
    participacion.pago_ultimos_digitos = cuenta.ultimos_digitos
    _notificar(db, participacion.usuario_id, "pago_realizado", "Te transferimos tu recompensa",
               f"Te transferimos {pesos(ronda.recompensa_cop)} a tu cuenta {cuenta.banco} terminada en "
               f"{cuenta.ultimos_digitos}. Referencia {participacion.referencia_pago}.", email=True)
    db.flush()
    cuentas_pago.borrar_si_no_hay_pagos(db, participacion.usuario_id)
    db.commit()
    db.refresh(participacion)
    return participacion


def participantes(db: Session, ronda_id: str) -> List[Dict]:
    """Para el panel de pagos del admin, con los datos bancarios descifrados."""
    filas = (
        db.query(RetoParticipacion, Usuario)
        .join(Usuario, Usuario.id == RetoParticipacion.usuario_id)
        .filter(RetoParticipacion.ronda_id == ronda_id)
        .order_by(RetoParticipacion.aprobados.desc(), RetoParticipacion.fecha_inscripcion.asc())
        .all()
    )
    cuentas = {
        c.usuario_id: c for c in db.query(CuentaPago).filter(
            CuentaPago.usuario_id.in_([u.id for _, u in filas])).all()
    } if filas else {}
    resultado = []
    for p, u in filas:
        cuenta = cuentas.get(u.id)
        datos_cuenta = None
        if p.estado_recompensa == EstadoRecompensa.pagada.value:
            # Ya pagado: la cuenta se borró, queda el comprobante.
            if p.pago_ultimos_digitos:
                datos_cuenta = {"banco": p.pago_banco, "tipo_cuenta": p.pago_tipo_cuenta,
                                "ultimos_digitos": p.pago_ultimos_digitos}
        elif cuenta is not None and p.eleccion == EleccionRecompensa.efectivo.value:
            try:
                datos_cuenta = {
                    "banco": cuenta.banco, "tipo_cuenta": cuenta.tipo_cuenta,
                    "numero": descifrar(cuenta.numero_cifrado), "titular": cuenta.titular,
                    "documento": descifrar(cuenta.documento_cifrado),
                }
            except ValueError:
                datos_cuenta = {"error": "No se pudieron descifrar los datos bancarios"}
        resultado.append({
            "id": p.id,
            "usuario": {"id": u.id, "nombre": " ".join(x for x in (u.nombre, u.apellido) if x) or None, "email": u.email},
            "aprobados": p.aprobados,
            "eleccion": p.eleccion,
            "estado_recompensa": p.estado_recompensa,
            "cuenta": datos_cuenta,
            "pagado_en": p.pagado_en.isoformat() + "Z" if p.pagado_en else None,
            "referencia_pago": p.referencia_pago,
            "monto_pagado_cop": p.monto_pagado_cop,
            "fecha_inscripcion": p.fecha_inscripcion.isoformat() + "Z",
        })
    return resultado


# ── Tarea diaria ─────────────────────────────────────────────────────────────

def cerrar_vencidas(db: Session, ahora: Optional[datetime] = None) -> int:
    ahora = ahora or datetime.utcnow()
    n = db.query(RetoRonda).filter(
        RetoRonda.estado.in_((EstadoRonda.abierta.value, EstadoRonda.llena.value)),
        RetoRonda.fecha_limite <= ahora,
    ).update({RetoRonda.estado: EstadoRonda.cerrada.value}, synchronize_session=False)
    db.commit()
    return n


def avisar_inactivos(db: Session, ahora: Optional[datetime] = None) -> int:
    """«Llevás 4 de 10. La ronda cierra el [fecha]» a quien lleva 7 días sin enviar."""
    ahora = ahora or datetime.utcnow()
    limite = ahora - timedelta(days=DIAS_INACTIVIDAD)
    filas = (
        db.query(RetoParticipacion, RetoRonda)
        .join(RetoRonda, RetoRonda.id == RetoParticipacion.ronda_id)
        .filter(
            RetoRonda.estado.in_((EstadoRonda.abierta.value, EstadoRonda.llena.value)),
            RetoRonda.fecha_limite > ahora,
            RetoParticipacion.aprobados < RetoRonda.umbral_aprobados,
            func.coalesce(RetoParticipacion.ultimo_envio_en, RetoParticipacion.fecha_inscripcion) <= limite,
        )
        .all()
    )
    enviados = 0
    for p, ronda in filas:
        if p.ultimo_aviso_inactividad and p.ultimo_aviso_inactividad > limite:
            continue
        from services.tendencias_calculo import utc_a_bogota

        cierre = utc_a_bogota(ronda.fecha_limite).strftime("%d/%m/%Y")
        _notificar(db, p.usuario_id, "inactivo", "Seguí sumando productos",
                   f"Llevás {p.aprobados} de {ronda.umbral_aprobados}. La ronda cierra el {cierre}.", email=True)
        p.ultimo_aviso_inactividad = ahora
        enviados += 1
    db.commit()
    return enviados
