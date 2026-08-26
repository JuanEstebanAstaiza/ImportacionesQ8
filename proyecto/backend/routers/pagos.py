import hashlib
import hmac
import secrets
from datetime import datetime
from uuid import UUID as PyUUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import config
from models.pago import Pago, EstadoPago
from models.usuario import Usuario
from models.credito import MovimientoCredito, TipoMovimientoCredito
from schemas.pago import (
    ComprarCreditosRequest, ComprarCreditosResponse, PagoResponse,
    SaldoCreditosResponse, MovimientoCreditoResponse, WompiWebhookEvent
)
from utils.dependencies import get_db, get_current_user, require_rol
from services.credito_wallet import obtener_wallet, acreditar, debitar_atomico

router = APIRouter(prefix="/pagos", tags=["Pagos"])
creditos_router = APIRouter(prefix="/creditos", tags=["Créditos"])


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
    cualquiera pueda inyectar pagos falsos y acreditar créditos gratis.
    """
    if not config.WOMPI_EVENTS_SECRET:
        return False
    if evento.signature is None or evento.timestamp is None:
        return False

    valores = "".join(str(_get_nested(evento.data, prop)) for prop in evento.signature.properties)
    cadena = f"{valores}{evento.timestamp}{config.WOMPI_EVENTS_SECRET}"
    checksum_calculado = hashlib.sha256(cadena.encode("utf-8")).hexdigest()

    return hmac.compare_digest(checksum_calculado.lower(), evento.signature.checksum.lower())


@creditos_router.post("/comprar", response_model=ComprarCreditosResponse)
async def comprar_creditos(
    solicitud: ComprarCreditosRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante"))
):
    """
    Genera un enlace de pago con Wompi para recargar créditos.

    Deshabilitado por defecto: el modelo de negocio no cobra al solicitante
    (quien cotiza). Solo se factura a empresas importadoras por contrato.
    Reactivar con COBRO_A_SOLICITANTES=true.
    """
    if not config.COBRO_A_SOLICITANTES:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=(
                "La compra de créditos para solicitantes está deshabilitada. "
                "Crear cotizaciones no requiere pago. El cobro aplica a empresas importadoras."
            ),
        )

    user_id_str = str(PyUUID(current_user["user_id"]))

    creditos_a_acreditar = round(solicitud.monto_usd / config.CREDITO_USD_POR_UNIDAD, 2)

    if config.APP_ENV == "production" and getattr(config, "WOMPI_SIMULATE", True):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Pagos Wompi no configurados para producción (WOMPI_SIMULATE=true)",
        )

    # Sandbox/dev: referencia local. En producción real se debe crear el pago vía API Wompi
    # y persistir el id devuelto por el PSP (WOMPI_SIMULATE=false + keys reales).
    wompi_payment_id = f"wpm_{secrets.token_hex(12)}"
    wompi_checkout_url = f"https://checkout.wompi.co/l/{wompi_payment_id}"

    nuevo_pago = Pago(
        id=str(uuid4()),
        usuario_id=user_id_str,
        wompi_payment_id=wompi_payment_id,
        monto_usd=solicitud.monto_usd,
        creditos_comprados=creditos_a_acreditar,
        estado=EstadoPago.pendiente.value
    )
    db.add(nuevo_pago)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un pago registrado con ese identificador"
        )

    return ComprarCreditosResponse(
        checkout_url=wompi_checkout_url,
        wompi_payment_id=wompi_payment_id,
        monto_usd=solicitud.monto_usd,
        creditos_a_acreditar=creditos_a_acreditar
    )


@creditos_router.get("/saldo", response_model=SaldoCreditosResponse)
async def obtener_saldo(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante"))
):
    """Saldo efectivo: wallet de organización si pertenece a una, si no el personal."""
    usuario = db.query(Usuario).filter(Usuario.id == current_user["user_id"]).first()
    if not usuario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    wallet = obtener_wallet(db, usuario)
    return SaldoCreditosResponse(
        creditos_balance=wallet.balance,
        wallet_tipo=wallet.kind,
        organizacion_id=wallet.organizacion_id,
    )


@creditos_router.get("/movimientos", response_model=list[MovimientoCreditoResponse])
async def listar_movimientos(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante"))
):
    """Historial del wallet efectivo (org o movimientos del usuario)."""
    usuario = db.query(Usuario).filter(Usuario.id == current_user["user_id"]).first()
    if not usuario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    wallet = obtener_wallet(db, usuario)
    q = db.query(MovimientoCredito)
    if wallet.organizacion_id:
        q = q.filter(MovimientoCredito.organizacion_id == wallet.organizacion_id)
    else:
        q = q.filter(
            MovimientoCredito.usuario_id == current_user["user_id"],
            MovimientoCredito.organizacion_id.is_(None),
        )
    return q.order_by(MovimientoCredito.fecha.desc()).all()


@router.get("/{pago_id}", response_model=PagoResponse)
async def obtener_pago(
    pago_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Obtiene el estado de un pago. Solo el solicitante que lo generó puede verlo (evita IDOR)."""
    try:
        pago_id_str = str(PyUUID(pago_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pago no encontrado")

    pago = db.query(Pago).filter(Pago.id == pago_id_str).first()
    if not pago:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pago no encontrado")

    user_id_str = str(PyUUID(current_user["user_id"]))
    if pago.usuario_id != user_id_str:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado para ver este pago"
        )

    return pago


def _notificar_pago(db: Session, *, pago: Pago, titulo: str, mensaje: str) -> None:
    """Aviso in-app + WhatsApp + correo del resultado de un pago."""
    from services.notificacion_service import notificar

    notificar(
        db,
        usuario_id=str(pago.usuario_id),
        tipo="pago",
        titulo=titulo,
        mensaje=mensaje,
        data={"pago_id": str(pago.id), "wompi_payment_id": pago.wompi_payment_id},
        enlace_relativo="/creditos",
    )


@router.post("/webhook/wompi")
async def webhook_wompi(
    evento: WompiWebhookEvent,
    db: Session = Depends(get_db)
):
    """
    Webhook de Wompi. Firma fail-closed + transición atómica pendiente→confirmado
    para evitar doble acreditación bajo reintentos concurrentes.
    """
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
        return {"success": True}

    if evento_tipo == "payment.confirmed" or estado_wompi == "confirmed":
        # Solo un worker gana la carrera: UPDATE ... WHERE estado=pendiente
        ahora = get_db_now(db)
        ganado = (
            db.query(Pago)
            .filter(
                Pago.id == pago.id,
                Pago.estado == EstadoPago.pendiente.value,
            )
            .update(
                {
                    Pago.estado: EstadoPago.confirmado.value,
                    Pago.fecha_confirmacion: ahora,
                },
                synchronize_session=False,
            )
        )
        if ganado != 1:
            db.rollback()
            return {"success": True}

        usuario = db.query(Usuario).filter(Usuario.id == pago.usuario_id).first()
        if usuario:
            wallet = obtener_wallet(db, usuario)
            acreditar(
                db,
                wallet,
                pago.creditos_comprados,
                tipo=TipoMovimientoCredito.compra.value,
                pago_id=pago.id,
                descripcion=f"Compra de créditos vía Wompi ({pago.wompi_payment_id})",
            )
        _notificar_pago(
            db,
            pago=pago,
            titulo="Pago confirmado",
            mensaje=f"Se acreditaron {pago.creditos_comprados} créditos a tu cuenta.",
        )
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return {"success": True}

    elif evento_tipo == "payment.failed" or estado_wompi == "failed":
        db.query(Pago).filter(
            Pago.id == pago.id,
            Pago.estado == EstadoPago.pendiente.value,
        ).update({Pago.estado: EstadoPago.fallido.value}, synchronize_session=False)
        _notificar_pago(
            db,
            pago=pago,
            titulo="Tu pago no se pudo procesar",
            mensaje="El pago fue rechazado por la pasarela. Puedes intentarlo de nuevo desde la plataforma.",
        )
        db.commit()

    elif evento_tipo == "payment.refunded" or estado_wompi == "refunded":
        ganado = (
            db.query(Pago)
            .filter(
                Pago.id == pago.id,
                Pago.estado == EstadoPago.confirmado.value,
            )
            .update(
                {Pago.estado: EstadoPago.reembolsado.value},
                synchronize_session=False,
            )
        )
        if ganado != 1:
            db.rollback()
            return {"success": True}

        usuario = db.query(Usuario).filter(Usuario.id == pago.usuario_id).first()
        if usuario:
            wallet = obtener_wallet(db, usuario)
            try:
                debitar_atomico(
                    db,
                    wallet,
                    pago.creditos_comprados,
                    tipo=TipoMovimientoCredito.consumo.value,
                    pago_id=pago.id,
                    descripcion=f"Reversión por reembolso de pago Wompi ({pago.wompi_payment_id})",
                )
            except HTTPException:
                if wallet.organizacion is not None:
                    wallet.organizacion.creditos_balance = 0
                else:
                    wallet.usuario.creditos_balance = 0
                db.add(MovimientoCredito(
                    id=str(uuid4()),
                    usuario_id=usuario.id,
                    organizacion_id=wallet.organizacion_id,
                    tipo=TipoMovimientoCredito.consumo.value,
                    monto=-pago.creditos_comprados,
                    pago_id=pago.id,
                    descripcion=f"Reversión por reembolso Wompi (saldo forzado) ({pago.wompi_payment_id})",
                ))
        db.commit()

    return {"success": True}
