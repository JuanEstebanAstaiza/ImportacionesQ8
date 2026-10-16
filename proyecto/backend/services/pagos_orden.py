"""Pago del cliente a la empresa importadora por cada orden.

La orden nace como «orden generada · pago pendiente» (`cotizacion_aceptada`) y
cada una tiene su carpeta de pagos en la gestión documental del cliente:
«Pagos/Operaciones/ORD-XXXXXXXX · <producto>». Ahí el cliente sube el
comprobante de la transferencia y lo envía a la empresa. La empresa (la cuenta
dueña o el asesor asignado, los mismos que mueven el estado) lo confirma o lo
rechaza con un motivo. Hasta que hay un comprobante confirmado la orden no
puede pasar a producción (`routers/ordenes.py::actualizar_estado_orden`).

La plataforma no recibe ese dinero: solo deja el registro y el aviso a las dos
partes, igual que en la negociación.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.documental import Archivo
from models.orden import ComprobantePagoOrden, EstadoComprobanteOrden, EstadoOrden, Orden
from models.usuario import Usuario
from services.documental_service import ensure_folder_path

logger = logging.getLogger("importacionesq8")

TIPOS_ARCHIVO = ("imagen", "documento")
MENSAJE_FALTA_PAGO = (
    "Antes de pasar a producción confirma el pago del cliente: "
    "revisa el comprobante en la sección «Pago» de la operación."
)


def _error(codigo: int, mensaje: str) -> HTTPException:
    return HTTPException(status_code=codigo, detail=mensaje)


def _estado(orden: Orden) -> str:
    return orden.estado.value if isinstance(orden.estado, EstadoOrden) else str(orden.estado)


def codigo(orden: Orden) -> str:
    return f"ORD-{str(orden.id)[:8].upper()}"


def _producto(db: Session, orden: Orden) -> Optional[str]:
    from models.cotizacion import Cotizacion

    return db.query(Cotizacion.nombre_producto).filter(Cotizacion.id == orden.cotizacion_id).scalar()


def carpeta_de_pagos(db: Session, orden: Orden) -> Optional[str]:
    """La carpeta de pagos de la operación en la gestión documental del cliente
    (se crea si falta: las órdenes anteriores a este módulo no la tienen)."""
    producto = (_producto(db, orden) or "").strip()
    nombre = f"{codigo(orden)} · {producto[:120]}" if producto else codigo(orden)
    return ensure_folder_path(
        db, owner_user_id=orden.solicitante_id, segments=["Pagos", "Operaciones", nombre],
    )


def pago_confirmado(db: Session, orden_id: str) -> bool:
    return db.query(ComprobantePagoOrden.id).filter(
        ComprobantePagoOrden.orden_id == str(orden_id),
        ComprobantePagoOrden.estado == EstadoComprobanteOrden.confirmado.value,
    ).first() is not None


# ── Acceso ───────────────────────────────────────────────────────────────────

def orden_visible(db: Session, orden_id: str, current_user: dict) -> Orden:
    """La orden si quien consulta es el cliente, alguien de la empresa o el admin."""
    orden = db.query(Orden).filter(Orden.id == str(orden_id)).first()
    if orden is None:
        raise _error(status.HTTP_404_NOT_FOUND, "Operación no encontrada")
    rol = current_user.get("rol")
    if rol == "admin":
        return orden
    if rol == "solicitante" and orden.solicitante_id == str(current_user.get("user_id")):
        return orden
    if rol in ("importador", "asesor") and orden.importador_id == current_user.get("importador_id"):
        return orden
    raise _error(status.HTTP_403_FORBIDDEN, "No tienes acceso a esta operación")


def puede_revisar(orden: Orden, current_user: dict) -> bool:
    """Confirman o rechazan el pago los mismos que mueven el estado de la orden:
    la cuenta dueña de la empresa y el asesor asignado."""
    if orden.importador_id != current_user.get("importador_id"):
        return False
    if current_user.get("rol") == "importador":
        return True
    return current_user.get("rol") == "asesor" and str(orden.asesor_asignado_id or "") == str(current_user.get("user_id"))


def puede_ver_archivo(db: Session, archivo_id: str, user_id: str, rol: str, importador_id: Optional[str]) -> bool:
    """El comprobante lo ven el cliente, la empresa de la orden y el admin."""
    fila = (
        db.query(Orden.solicitante_id, Orden.importador_id)
        .join(ComprobantePagoOrden, ComprobantePagoOrden.orden_id == Orden.id)
        .filter(ComprobantePagoOrden.archivo_id == archivo_id)
        .first()
    )
    if fila is None:
        return False
    if rol == "admin":
        return True
    if rol == "solicitante":
        return fila.solicitante_id == user_id
    return rol in ("importador", "asesor") and bool(importador_id) and fila.importador_id == importador_id


# ── Serialización ────────────────────────────────────────────────────────────

def _iso(valor: Optional[datetime]) -> Optional[str]:
    return valor.isoformat() + "Z" if valor else None


def a_dict(db: Session, c: ComprobantePagoOrden) -> Dict:
    archivo = db.query(Archivo).filter(Archivo.id == c.archivo_id).first()
    return {
        "id": c.id,
        "estado": c.estado,
        "archivo": {
            "id": c.archivo_id,
            "nombre": archivo.nombre if archivo else None,
            "tipo_recurso": archivo.tipo_recurso if archivo else None,
            "url": f"/documentos/archivos/{c.archivo_id}/descargar",
        },
        "monto_cop": c.monto_cop,
        "nota": c.nota,
        "motivo_rechazo": c.motivo_rechazo,
        "fecha": _iso(c.fecha_creacion),
        "revisado_en": _iso(c.revisado_en),
    }


def _monto_acordado(db: Session, orden: Orden) -> Optional[str]:
    """El valor a pagar del formulario de la propuesta aceptada («$… (COP, IVA incluido)»)."""
    from models.propuesta import EstadoPropuesta, Propuesta
    from services.formulario_propuesta import monto_a_pagar

    condiciones = orden.condiciones_adicionales
    if not condiciones:
        propuesta = db.query(Propuesta).filter(
            Propuesta.cotizacion_id == orden.cotizacion_id,
            Propuesta.importador_id == orden.importador_id,
            Propuesta.estado == EstadoPropuesta.aceptada.value,
        ).first()
        condiciones = propuesta.condiciones_adicionales if propuesta else None
    try:
        return monto_a_pagar(condiciones)
    except Exception:
        return None


def resumen(db: Session, orden: Orden, current_user: dict) -> Dict:
    comprobantes = (
        db.query(ComprobantePagoOrden)
        .filter(ComprobantePagoOrden.orden_id == orden.id)
        .order_by(ComprobantePagoOrden.fecha_creacion.desc())
        .all()
    )
    confirmado = any(c.estado == EstadoComprobanteOrden.confirmado.value for c in comprobantes)
    pendiente = any(c.estado == EstadoComprobanteOrden.pendiente.value for c in comprobantes)
    esperando_pago = _estado(orden) == EstadoOrden.cotizacion_aceptada.value and not confirmado
    es_cliente = current_user.get("rol") == "solicitante"
    carpeta_id = None
    if es_cliente:
        # La carpeta se crea al nacer la orden; las anteriores la reciben aquí.
        carpeta_id = carpeta_de_pagos(db, orden)
        db.commit()
    return {
        "orden_id": orden.id,
        "codigo": codigo(orden),
        "estado_orden": _estado(orden),
        "pago_confirmado": confirmado,
        "comprobante_por_revisar": pendiente,
        "monto_acordado": _monto_acordado(db, orden),
        "precio_acordado_usd": orden.precio_acordado_usd,
        "carpeta_id": carpeta_id,
        "puede_subir": es_cliente and esperando_pago and not pendiente,
        "puede_revisar": puede_revisar(orden, current_user) and esperando_pago,
        "comprobantes": [a_dict(db, c) for c in comprobantes],
    }


# ── Avisos ───────────────────────────────────────────────────────────────────

def _empresa(db: Session, orden: Orden) -> List[str]:
    """Quienes se enteran del lado de la empresa: la cuenta dueña y el asesor asignado."""
    ids = [
        str(fila[0]) for fila in db.query(Usuario.id).filter(
            Usuario.importador_id == orden.importador_id, Usuario.rol == "importador",
        ).all()
    ]
    if orden.asesor_asignado_id and str(orden.asesor_asignado_id) not in ids:
        ids.append(str(orden.asesor_asignado_id))
    return ids


def _nota_en_chat(db: Session, orden: Orden, remitente_id: str, texto: str, evento: str, datos: Dict) -> None:
    """Constancia en el chat de seguimiento (best-effort, como los cambios de estado)."""
    try:
        from models.chat import ConversacionChat, MensajeChat, TipoMensajeChat

        conversacion = db.query(ConversacionChat).filter(
            ConversacionChat.cotizacion_id == orden.cotizacion_id
        ).first()
        if conversacion is None:
            return
        db.add(MensajeChat(
            id=str(uuid4()),
            conversacion_id=conversacion.id,
            remitente_id=str(remitente_id),
            contenido=texto,
            tipo=TipoMensajeChat.sistema.value,
            metadata_json={"tipo_evento": evento, "orden_id": str(orden.id), **datos},
        ))
    except Exception:
        logger.warning("No se pudo anotar el pago en el chat de la orden %s", orden.id)


def _cop(valor: Optional[int]) -> str:
    return "$" + f"{int(valor):,}".replace(",", ".") + " COP" if valor else ""


# ── Cliente: enviar comprobante ──────────────────────────────────────────────

def subir(db: Session, orden: Orden, usuario: Usuario, *, archivo_id: str,
          monto_cop: Optional[int], nota: Optional[str]) -> ComprobantePagoOrden:
    if orden.solicitante_id != usuario.id:
        raise _error(status.HTTP_403_FORBIDDEN, "Solo el cliente de la operación envía el comprobante")
    if _estado(orden) != EstadoOrden.cotizacion_aceptada.value or pago_confirmado(db, orden.id):
        raise _error(status.HTTP_409_CONFLICT, "El pago de esta operación ya está confirmado")
    if db.query(ComprobantePagoOrden.id).filter(
        ComprobantePagoOrden.orden_id == orden.id,
        ComprobantePagoOrden.estado == EstadoComprobanteOrden.pendiente.value,
    ).first():
        raise _error(status.HTTP_409_CONFLICT, "Ya enviaste un comprobante: la empresa lo está revisando")

    archivo = db.query(Archivo).filter(Archivo.id == archivo_id, Archivo.deleted_at.is_(None)).first()
    if archivo is None or archivo.owner_user_id != usuario.id:
        raise _error(status.HTTP_404_NOT_FOUND, "Archivo no encontrado")
    if archivo.tipo_recurso not in TIPOS_ARCHIVO:
        raise _error(status.HTTP_400_BAD_REQUEST, "El comprobante debe ser una imagen o un PDF")
    if db.query(ComprobantePagoOrden.id).filter(ComprobantePagoOrden.archivo_id == archivo.id).first():
        raise _error(status.HTTP_409_CONFLICT, "Ese archivo ya se envió como comprobante")

    archivo.carpeta_id = carpeta_de_pagos(db, orden)
    comprobante = ComprobantePagoOrden(
        orden_id=orden.id,
        archivo_id=archivo.id,
        subido_por=usuario.id,
        monto_cop=monto_cop,
        nota=(nota or "").strip()[:500] or None,
        estado=EstadoComprobanteOrden.pendiente.value,
    )
    db.add(comprobante)
    db.flush()

    from services.notificacion_service import notificar

    cliente = " ".join(x for x in (usuario.nombre, usuario.apellido) if x) or usuario.email
    producto = _producto(db, orden)
    monto = _cop(monto_cop)
    for destinatario in _empresa(db, orden):
        notificar(
            db,
            usuario_id=destinatario,
            tipo="orden",
            titulo=f"Comprobante de pago por confirmar · {codigo(orden)}",
            mensaje=(
                f"{cliente} envió el comprobante de pago de la operación"
                f"{f' de {producto}' if producto else ''}{f' por {monto}' if monto else ''}. "
                "Revísalo y confirma el pago para pasarla a producción."
            ),
            data={"orden_id": orden.id, "comprobante_id": comprobante.id, "evento": "comprobante_orden_recibido"},
            enlace_relativo="/ordenes",
            whatsapp=False,
        )
    _nota_en_chat(
        db, orden, usuario.id,
        f"El cliente envió el comprobante de pago{f' por {monto}' if monto else ''}. "
        "La empresa lo revisa y confirma el pago antes de pasar a producción.",
        "comprobante_pago_orden", {"comprobante_id": comprobante.id},
    )
    return comprobante


# ── Empresa: confirmar o rechazar ────────────────────────────────────────────

def _por_revisar(db: Session, orden: Orden, comprobante_id: str, current_user: dict) -> ComprobantePagoOrden:
    if not puede_revisar(orden, current_user):
        raise _error(
            status.HTTP_403_FORBIDDEN,
            "Confirman el pago la cuenta de la empresa o el asesor asignado a la operación",
        )
    c = db.query(ComprobantePagoOrden).filter(
        ComprobantePagoOrden.id == comprobante_id, ComprobantePagoOrden.orden_id == orden.id,
    ).first()
    if c is None:
        raise _error(status.HTTP_404_NOT_FOUND, "Comprobante no encontrado")
    if c.estado != EstadoComprobanteOrden.pendiente.value:
        raise _error(status.HTTP_409_CONFLICT, "Ese comprobante ya fue revisado")
    return c


def confirmar(db: Session, orden: Orden, comprobante_id: str, current_user: dict) -> ComprobantePagoOrden:
    c = _por_revisar(db, orden, comprobante_id, current_user)
    c.estado = EstadoComprobanteOrden.confirmado.value
    c.revisado_por = str(current_user["user_id"])
    c.revisado_en = datetime.utcnow()

    from services.notificacion_service import notificar

    producto = _producto(db, orden)
    notificar(
        db,
        usuario_id=orden.solicitante_id,
        tipo="orden",
        titulo="La empresa confirmó tu pago",
        mensaje=(
            f"La empresa confirmó el pago de tu operación{f' de {producto}' if producto else ''} "
            f"({codigo(orden)}). El siguiente paso es la producción; te avisaremos de cada cambio."
        ),
        data={"orden_id": orden.id, "comprobante_id": c.id, "evento": "pago_orden_confirmado"},
        enlace_relativo="/ordenes",
    )
    _nota_en_chat(
        db, orden, current_user["user_id"],
        "La empresa confirmó el pago. La operación ya puede pasar a producción.",
        "pago_orden_confirmado", {"comprobante_id": c.id},
    )
    return c


def rechazar(db: Session, orden: Orden, comprobante_id: str, current_user: dict, motivo: str) -> ComprobantePagoOrden:
    c = _por_revisar(db, orden, comprobante_id, current_user)
    c.estado = EstadoComprobanteOrden.rechazado.value
    c.motivo_rechazo = motivo.strip()[:300]
    c.revisado_por = str(current_user["user_id"])
    c.revisado_en = datetime.utcnow()

    from services.notificacion_service import notificar

    notificar(
        db,
        usuario_id=orden.solicitante_id,
        tipo="orden",
        titulo="Revisa el comprobante de pago",
        mensaje=(
            f"La empresa no pudo confirmar el pago de la operación {codigo(orden)}: {c.motivo_rechazo} "
            "Sube un nuevo comprobante desde la operación."
        ),
        data={"orden_id": orden.id, "comprobante_id": c.id, "evento": "pago_orden_rechazado"},
        enlace_relativo="/ordenes",
    )
    _nota_en_chat(
        db, orden, current_user["user_id"],
        f"La empresa no pudo confirmar el comprobante de pago: {c.motivo_rechazo}",
        "pago_orden_rechazado", {"comprobante_id": c.id},
    )
    return c
