import hashlib
import hmac
import secrets
from datetime import datetime
from uuid import UUID as PyUUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import config
from models.orden import Orden, HistorialEstadosOrden, EstadoOrden
from models.pago import Pago, EstadoPago
from schemas.pago import CheckoutRequest, CheckoutResponse, PagoResponse, WompiWebhookEvent
from utils.dependencies import get_db, get_current_user, require_rol

router = APIRouter(prefix="/pagos", tags=["Pagos"])


def get_db_now(db: Session) -> datetime:
    """Obtener la fecha/hora actual de forma compatible con SQLite y MySQL."""
    try:
        result = db.execute(db.func.now())
        return result.scalar()
    except Exception:
        return datetime.utcnow()


def _get_nested(data: dict, dotted_path: str):
    """Resuelve un path tipo 'transaction.id' dentro de un dict anidado."""
    current = data
    for part in dotted_path.split("."):
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


def verificar_firma_wompi(evento: WompiWebhookEvent) -> bool:
    """
    Verifica la firma HMAC-SHA256 del webhook siguiendo el esquema de checksum de Wompi:
    checksum = SHA256(valor_prop_1 + valor_prop_2 + ... + timestamp + secreto_eventos)

    Si no hay `WOMPI_EVENTS_SECRET` configurado, o el evento no trae firma/timestamp,
    el webhook se considera NO verificable y se rechaza (fail-closed) para evitar que
    cualquiera pueda inyectar pagos falsos y crear órdenes gratis.
    """
    if not config.WOMPI_EVENTS_SECRET:
        return False
    if evento.signature is None or evento.timestamp is None:
        return False

    valores = "".join(str(_get_nested(evento.data, prop)) for prop in evento.signature.properties)
    cadena = f"{valores}{evento.timestamp}{config.WOMPI_EVENTS_SECRET}"
    checksum_calculado = hashlib.sha256(cadena.encode("utf-8")).hexdigest()

    return hmac.compare_digest(checksum_calculado.lower(), evento.signature.checksum.lower())


@router.post("/checkout", response_model=CheckoutResponse)
async def generar_checkout(
    checkout_data: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante"))
):
    """
    Generar enlace de pago con Wompi para una cotización aceptada.

    Idempotente: si ya existe un pago pendiente para la misma cotización, se
    reutiliza en lugar de crear un registro duplicado.
    """
    from models.cotizacion import Cotizacion, EstadoCotizacion
    from models.propuesta import Propuesta, EstadoPropuesta

    user_id_str = str(PyUUID(current_user["user_id"]))

    try:
        cotizacion_id_str = str(PyUUID(checkout_data.cotizacion_id))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de cotización inválido"
        )

    # Verificar que la cotización existe, pertenece al usuario y está lista para pago
    cotizacion = db.query(Cotizacion).filter(
        Cotizacion.id == cotizacion_id_str,
        Cotizacion.solicitante_id == user_id_str,
        Cotizacion.estado == EstadoCotizacion.cotizacion_aceptada.value
    ).first()

    if not cotizacion:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cotización no encontrada o no está en estado de pago"
        )

    propuesta = db.query(Propuesta).filter(
        Propuesta.cotizacion_id == cotizacion_id_str,
        Propuesta.estado == EstadoPropuesta.aceptada.value
    ).first()

    if not propuesta:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Propuesta aceptada no encontrada"
        )

    # Idempotencia: reutilizar un pago pendiente existente en lugar de duplicarlo
    pago_existente = db.query(Pago).filter(
        Pago.cotizacion_id == cotizacion_id_str,
        Pago.estado == EstadoPago.pendiente.value
    ).first()

    if pago_existente:
        return CheckoutResponse(
            checkout_url=f"https://pay.wompi.co/pay/{pago_existente.wompi_payment_id}",
            wompi_payment_id=pago_existente.wompi_payment_id,
            monto_comision_usd=pago_existente.monto_usd,
            cotizacion_id=cotizacion_id_str
        )

    monto_comision = round(propuesta.precio_ofrecido_usd * 0.10, 2)

    # Identificador de pago simulado (en producción vendría de la respuesta de la API de Wompi)
    wompi_payment_id = f"wpm_{secrets.token_hex(12)}"
    wompi_checkout_url = f"https://pay.wompi.co/pay/{wompi_payment_id}"

    nuevo_pago = Pago(
        id=str(uuid4()),
        orden_id=None,
        cotizacion_id=cotizacion_id_str,
        wompi_payment_id=wompi_payment_id,
        monto_usd=monto_comision,
        estado=EstadoPago.pendiente.value,
        webhook_url=f"/pagos/webhook/wompi"
    )
    db.add(nuevo_pago)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un pago registrado para esta cotización"
        )

    return CheckoutResponse(
        checkout_url=wompi_checkout_url,
        wompi_payment_id=wompi_payment_id,
        monto_comision_usd=monto_comision,
        cotizacion_id=cotizacion_id_str
    )


@router.get("/{pago_id}", response_model=PagoResponse)
async def obtener_pago(
    pago_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Obtiene el estado de un pago. Solo el solicitante dueño de la cotización puede verlo."""
    from models.cotizacion import Cotizacion

    try:
        pago_id_str = str(PyUUID(pago_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pago no encontrado")

    pago = db.query(Pago).filter(Pago.id == pago_id_str).first()
    if not pago:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pago no encontrado")

    user_id_str = str(PyUUID(current_user["user_id"]))
    cotizacion = db.query(Cotizacion).filter(Cotizacion.id == pago.cotizacion_id).first()

    # Evitar IDOR: solo el dueño de la cotización asociada puede consultar el pago
    if not cotizacion or cotizacion.solicitante_id != user_id_str:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado para ver este pago"
        )

    return pago


@router.post("/webhook/wompi")
async def webhook_wompi(
    evento: WompiWebhookEvent,
    db: Session = Depends(get_db)
):
    """
    Webhook de Wompi que recibe notificaciones sobre el estado del pago.

    Seguridad:
    - Se verifica la firma HMAC-SHA256 del evento antes de procesarlo (fail-closed).
    - El procesamiento es idempotente: si el pago ya está confirmado, se responde
      200 OK sin duplicar la creación de la orden (Wompi puede reenviar el mismo evento).
    """
    from models.cotizacion import Cotizacion, EstadoCotizacion
    from models.propuesta import Propuesta, EstadoPropuesta

    if not verificar_firma_wompi(evento):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Firma de webhook inválida")

    wompi_payment_id = evento.data.get("id")
    estado_wompi = evento.data.get("status")
    evento_tipo = evento.event

    if not wompi_payment_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="wompi_payment_id no encontrado en el webhook"
        )

    pago = db.query(Pago).filter(Pago.wompi_payment_id == wompi_payment_id).first()
    if not pago:
        # Evento desconocido o de un pago que no existe en nuestra base - se ignora
        return {"success": True}

    # Idempotencia: si ya se procesó este pago, no repetir efectos secundarios
    if pago.estado in (EstadoPago.confirmado.value, EstadoPago.reembolsado.value) and evento_tipo != "payment.refunded":
        return {"success": True}

    if evento_tipo == "payment.confirmed" or estado_wompi == "confirmed":
        cotizacion = db.query(Cotizacion).filter(
            Cotizacion.id == pago.cotizacion_id,
            Cotizacion.estado == EstadoCotizacion.cotizacion_aceptada.value
        ).first()

        if not cotizacion:
            # Ya se creó la orden previamente (idempotencia) o la cotización cambió de estado
            pago.estado = EstadoPago.confirmado.value
            pago.fecha_confirmacion = get_db_now(db)
            db.commit()
            return {"success": True}

        propuesta = db.query(Propuesta).filter(
            Propuesta.cotizacion_id == pago.cotizacion_id,
            Propuesta.estado == EstadoPropuesta.aceptada.value
        ).first()

        if not propuesta:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Propuesta aceptada no encontrada"
            )

        nueva_orden = Orden(
            id=str(uuid4()),
            cotizacion_id=pago.cotizacion_id,
            importador_id=propuesta.importador_id,
            solicitante_id=cotizacion.solicitante_id,
            trabajador_asignado_id=cotizacion.trabajador_asignado_id,
            estado=EstadoOrden.cotizacion_aceptada,
            precio_acordado_usd=propuesta.precio_ofrecido_usd,
            tiempo_estimado_entrega=propuesta.tiempo_estimado_entrega,
            condiciones_adicionales=propuesta.condiciones_adicionales
        )
        db.add(nueva_orden)

        nuevo_historial = HistorialEstadosOrden(
            orden_id=nueva_orden.id,
            estado_anterior=None,
            estado_nuevo=EstadoOrden.cotizacion_aceptada.value,
            fecha_cambio=get_db_now(db)
        )
        db.add(nuevo_historial)

        cotizacion.estado = EstadoCotizacion.orden_activa
        pago.estado = EstadoPago.confirmado.value
        pago.fecha_confirmacion = get_db_now(db)
        pago.orden_id = nueva_orden.id

        try:
            db.commit()
        except IntegrityError:
            # Otro webhook concurrente ya creó la orden para esta cotización (unique constraint)
            db.rollback()
            pago_actual = db.query(Pago).filter(Pago.wompi_payment_id == wompi_payment_id).first()
            if pago_actual:
                pago_actual.estado = EstadoPago.confirmado.value
                pago_actual.fecha_confirmacion = get_db_now(db)
                db.commit()

    elif evento_tipo == "payment.failed" or estado_wompi == "failed":
        pago.estado = EstadoPago.fallido.value
        db.commit()

    elif evento_tipo == "payment.refunded" or estado_wompi == "refunded":
        pago.estado = EstadoPago.reembolsado.value
        # TODO: Implementar lógica de reembolso de la orden y notificación (Semana 3)
        db.commit()

    return {"success": True}
