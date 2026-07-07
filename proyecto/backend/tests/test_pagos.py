import hashlib
import hmac
from uuid import uuid4
from datetime import datetime

import pytest

import config
from models.usuario import Usuario
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.propuesta import Propuesta, EstadoPropuesta
from models.pago import Pago, EstadoPago
from models.orden import Orden
from utils.security import hash_password, create_access_token


def firmar_evento(data: dict, timestamp: int, properties: list[str], secret: str) -> str:
    """Genera el checksum HMAC-SHA256 igual que lo hace el backend, para pruebas."""
    def get_nested(d, path):
        current = d
        for part in path.split("."):
            current = current.get(part) if isinstance(current, dict) else None
        return current

    valores = "".join(str(get_nested(data, prop)) for prop in properties)
    cadena = f"{valores}{timestamp}{secret}"
    return hashlib.sha256(cadena.encode("utf-8")).hexdigest()


@pytest.fixture()
def test_solicitante(db_session):
    user = Usuario(
        id=str(uuid4()),
        email="solicitante_pago@example.com",
        password_hash=hash_password("123456789"),
        rol="solicitante",
        perfil_completo=True,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def test_importador_user(db_session):
    user = Usuario(
        id=str(uuid4()),
        email="importador_pago@example.com",
        password_hash=hash_password("123456789"),
        rol="importador",
        perfil_completo=True,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def test_cotizacion_aceptada(db_session, test_solicitante, test_importador_user):
    cotizacion = Cotizacion(
        id=str(uuid4()),
        solicitante_id=test_solicitante.id,
        importador_id=test_importador_user.id,
        modalidad="dirigida",
        pais_importacion="China",
        nombre_producto="Camisetas personalizadas",
        descripcion_cliente="500 camisetas con logo impreso en algodón premium",
        linea_producto="Textiles",
        tipo_calidad="estandar",
        cantidad_minima=500,
        precio_objetivo_usd=3.50,
        incoterm="FOB",
        estado=EstadoCotizacion.cotizacion_aceptada
    )
    db_session.add(cotizacion)

    propuesta = Propuesta(
        id=str(uuid4()),
        cotizacion_id=cotizacion.id,
        importador_id=test_importador_user.id,
        precio_ofrecido_usd=1500.0,
        tiempo_estimado_entrega="45 días",
        incoterm="FOB",
        estado=EstadoPropuesta.aceptada
    )
    db_session.add(propuesta)

    db_session.commit()
    db_session.refresh(cotizacion)
    return cotizacion


@pytest.fixture()
def auth_headers_solicitante(test_solicitante):
    token = create_access_token(str(test_solicitante.id), "solicitante")
    return {"Authorization": f"Bearer {token}"}


class TestGenerarCheckout:

    def test_checkout_exitoso(self, client, db_session, test_cotizacion_aceptada, auth_headers_solicitante):
        """POST /pagos/checkout - Genera un pago pendiente para una cotización aceptada"""
        response = client.post(
            "/pagos/checkout",
            json={"cotizacion_id": str(test_cotizacion_aceptada.id)},
            headers=auth_headers_solicitante
        )

        assert response.status_code == 200
        data = response.json()
        assert data["cotizacion_id"] == str(test_cotizacion_aceptada.id)
        assert data["monto_comision_usd"] == 150.0  # 10% de 1500
        assert data["wompi_payment_id"].startswith("wpm_")

        pago = db_session.query(Pago).filter(Pago.cotizacion_id == test_cotizacion_aceptada.id).first()
        assert pago is not None
        assert pago.estado == EstadoPago.pendiente.value

    def test_checkout_es_idempotente(self, client, db_session, test_cotizacion_aceptada, auth_headers_solicitante):
        """POST /pagos/checkout - Llamadas repetidas reutilizan el mismo pago pendiente"""
        response1 = client.post(
            "/pagos/checkout",
            json={"cotizacion_id": str(test_cotizacion_aceptada.id)},
            headers=auth_headers_solicitante
        )
        response2 = client.post(
            "/pagos/checkout",
            json={"cotizacion_id": str(test_cotizacion_aceptada.id)},
            headers=auth_headers_solicitante
        )

        assert response1.status_code == 200
        assert response2.status_code == 200
        assert response1.json()["wompi_payment_id"] == response2.json()["wompi_payment_id"]

        pagos = db_session.query(Pago).filter(Pago.cotizacion_id == test_cotizacion_aceptada.id).all()
        assert len(pagos) == 1

    def test_checkout_cotizacion_no_aceptada(self, client, db_session, auth_headers_solicitante, test_solicitante):
        """POST /pagos/checkout - Rechaza cotizaciones que no están en estado 'cotizacion_aceptada'"""
        cotizacion = Cotizacion(
            id=str(uuid4()),
            solicitante_id=test_solicitante.id,
            importador_id=None,
            modalidad="abierta",
            pais_importacion="China",
            nombre_producto="Camisetas",
            descripcion_cliente="Descripción de prueba con más de veinte caracteres",
            linea_producto="Textiles",
            tipo_calidad="estandar",
            cantidad_minima=100,
            precio_objetivo_usd=1.0,
            incoterm="FOB",
            estado="abierta"
        )
        db_session.add(cotizacion)
        db_session.commit()

        response = client.post(
            "/pagos/checkout",
            json={"cotizacion_id": str(cotizacion.id)},
            headers=auth_headers_solicitante
        )

        assert response.status_code == 400

    def test_checkout_de_otro_usuario_es_rechazado(self, client, db_session, test_cotizacion_aceptada):
        """POST /pagos/checkout - Un solicitante no puede pagar la cotización de otro (IDOR)"""
        otro_token = create_access_token(str(uuid4()), "solicitante")
        headers = {"Authorization": f"Bearer {otro_token}"}

        response = client.post(
            "/pagos/checkout",
            json={"cotizacion_id": str(test_cotizacion_aceptada.id)},
            headers=headers
        )

        assert response.status_code == 400


class TestWebhookWompi:

    def _crear_pago_pendiente(self, db_session, cotizacion_id, wompi_payment_id="wpm_test123", monto=150.0):
        pago = Pago(
            id=str(uuid4()),
            orden_id=None,
            cotizacion_id=cotizacion_id,
            wompi_payment_id=wompi_payment_id,
            monto_usd=monto,
            estado=EstadoPago.pendiente.value
        )
        db_session.add(pago)
        db_session.commit()
        db_session.refresh(pago)
        return pago

    def test_webhook_sin_firma_es_rechazado(self, client, db_session, test_cotizacion_aceptada):
        """El webhook debe rechazar (403) eventos sin firma válida (fail-closed)"""
        self._crear_pago_pendiente(db_session, test_cotizacion_aceptada.id)

        response = client.post(
            "/pagos/webhook/wompi",
            json={
                "event": "payment.confirmed",
                "data": {"id": "wpm_test123", "status": "confirmed"}
            }
        )

        assert response.status_code == 403

    def test_webhook_con_firma_invalida_es_rechazado(self, client, db_session, test_cotizacion_aceptada):
        """El webhook debe rechazar eventos con checksum incorrecto"""
        self._crear_pago_pendiente(db_session, test_cotizacion_aceptada.id)

        response = client.post(
            "/pagos/webhook/wompi",
            json={
                "event": "payment.confirmed",
                "data": {"id": "wpm_test123", "status": "confirmed"},
                "timestamp": 1234567890,
                "signature": {"checksum": "0" * 64, "properties": ["id", "status"]}
            }
        )

        assert response.status_code == 403

    def test_webhook_confirmado_crea_orden(self, client, db_session, test_cotizacion_aceptada):
        """El webhook con firma válida confirma el pago y crea la orden correspondiente"""
        pago = self._crear_pago_pendiente(db_session, test_cotizacion_aceptada.id)

        data = {"id": pago.wompi_payment_id, "status": "confirmed"}
        timestamp = 1234567890
        properties = ["id", "status"]
        checksum = firmar_evento(data, timestamp, properties, config.WOMPI_EVENTS_SECRET)

        response = client.post(
            "/pagos/webhook/wompi",
            json={
                "event": "payment.confirmed",
                "data": data,
                "timestamp": timestamp,
                "signature": {"checksum": checksum, "properties": properties}
            }
        )

        assert response.status_code == 200

        db_session.refresh(pago)
        assert pago.estado == EstadoPago.confirmado.value
        assert pago.orden_id is not None

        orden = db_session.query(Orden).filter(Orden.cotizacion_id == test_cotizacion_aceptada.id).first()
        assert orden is not None

        db_session.refresh(test_cotizacion_aceptada)
        assert test_cotizacion_aceptada.estado == EstadoCotizacion.orden_activa.value

    def test_webhook_es_idempotente(self, client, db_session, test_cotizacion_aceptada):
        """Reenviar el mismo evento confirmado no debe crear una segunda orden"""
        pago = self._crear_pago_pendiente(db_session, test_cotizacion_aceptada.id)

        data = {"id": pago.wompi_payment_id, "status": "confirmed"}
        timestamp = 1234567890
        properties = ["id", "status"]
        checksum = firmar_evento(data, timestamp, properties, config.WOMPI_EVENTS_SECRET)
        payload = {
            "event": "payment.confirmed",
            "data": data,
            "timestamp": timestamp,
            "signature": {"checksum": checksum, "properties": properties}
        }

        response1 = client.post("/pagos/webhook/wompi", json=payload)
        response2 = client.post("/pagos/webhook/wompi", json=payload)

        assert response1.status_code == 200
        assert response2.status_code == 200

        ordenes = db_session.query(Orden).filter(Orden.cotizacion_id == test_cotizacion_aceptada.id).all()
        assert len(ordenes) == 1

    def test_webhook_pago_fallido(self, client, db_session, test_cotizacion_aceptada):
        """El webhook de pago fallido marca el pago como fallido sin crear orden"""
        pago = self._crear_pago_pendiente(db_session, test_cotizacion_aceptada.id)

        data = {"id": pago.wompi_payment_id, "status": "failed"}
        timestamp = 1234567890
        properties = ["id", "status"]
        checksum = firmar_evento(data, timestamp, properties, config.WOMPI_EVENTS_SECRET)

        response = client.post(
            "/pagos/webhook/wompi",
            json={
                "event": "payment.failed",
                "data": data,
                "timestamp": timestamp,
                "signature": {"checksum": checksum, "properties": properties}
            }
        )

        assert response.status_code == 200
        db_session.refresh(pago)
        assert pago.estado == EstadoPago.fallido.value

        orden = db_session.query(Orden).filter(Orden.cotizacion_id == test_cotizacion_aceptada.id).first()
        assert orden is None
