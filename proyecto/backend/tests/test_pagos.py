"""Tests de compra de créditos vía Wompi (Semana 4: reemplaza la comisión sobre la orden)."""
import hashlib
from uuid import uuid4
from datetime import datetime

import pytest

import config
from models.usuario import Usuario
from models.pago import Pago, EstadoPago
from models.credito import MovimientoCredito
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
        creditos_balance=0.0,
        perfil_completo=True,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def auth_headers_solicitante(test_solicitante):
    token = create_access_token(str(test_solicitante.id), "solicitante")
    return {"Authorization": f"Bearer {token}"}


class TestComprarCreditos:

    def test_comprar_creditos_exitoso(self, client, db_session, test_solicitante, auth_headers_solicitante):
        response = client.post(
            "/creditos/comprar",
            json={"monto_usd": 10.0},
            headers=auth_headers_solicitante
        )

        assert response.status_code == 200
        data = response.json()
        assert data["monto_usd"] == 10.0
        assert data["creditos_a_acreditar"] == round(10.0 / config.CREDITO_USD_POR_UNIDAD, 2)
        assert data["wompi_payment_id"].startswith("wpm_")

        pago = db_session.query(Pago).filter(Pago.wompi_payment_id == data["wompi_payment_id"]).first()
        assert pago is not None
        assert pago.estado == EstadoPago.pendiente.value
        assert pago.usuario_id == test_solicitante.id

    def test_comprar_creditos_requiere_rol_solicitante(self, client):
        token = create_access_token(str(uuid4()), "admin")
        response = client.post(
            "/creditos/comprar",
            json={"monto_usd": 10.0},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403

    def test_comprar_creditos_monto_invalido(self, client, auth_headers_solicitante):
        response = client.post(
            "/creditos/comprar",
            json={"monto_usd": -5.0},
            headers=auth_headers_solicitante
        )
        assert response.status_code == 422


class TestSaldoYMovimientos:

    def test_obtener_saldo(self, client, test_solicitante, auth_headers_solicitante):
        response = client.get("/creditos/saldo", headers=auth_headers_solicitante)
        assert response.status_code == 200
        assert response.json()["creditos_balance"] == test_solicitante.creditos_balance

    def test_listar_movimientos_vacio(self, client, auth_headers_solicitante):
        response = client.get("/creditos/movimientos", headers=auth_headers_solicitante)
        assert response.status_code == 200
        assert response.json() == []


class TestWebhookWompi:

    def _crear_pago_pendiente(self, db_session, usuario_id, wompi_payment_id="wpm_test123", monto=10.0, creditos=100.0):
        pago = Pago(
            id=str(uuid4()),
            usuario_id=usuario_id,
            wompi_payment_id=wompi_payment_id,
            monto_usd=monto,
            creditos_comprados=creditos,
            estado=EstadoPago.pendiente.value
        )
        db_session.add(pago)
        db_session.commit()
        db_session.refresh(pago)
        return pago

    def test_webhook_sin_firma_es_rechazado(self, client, db_session, test_solicitante):
        """El webhook debe rechazar (403) eventos sin firma válida (fail-closed)"""
        self._crear_pago_pendiente(db_session, test_solicitante.id)

        response = client.post(
            "/pagos/webhook/wompi",
            json={
                "event": "payment.confirmed",
                "data": {"id": "wpm_test123", "status": "confirmed"}
            }
        )

        assert response.status_code == 403

    def test_webhook_con_firma_invalida_es_rechazado(self, client, db_session, test_solicitante):
        """El webhook debe rechazar eventos con checksum incorrecto"""
        self._crear_pago_pendiente(db_session, test_solicitante.id)

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

    def test_webhook_confirmado_acredita_creditos(self, client, db_session, test_solicitante):
        """El webhook con firma válida confirma el pago y acredita los créditos al usuario"""
        saldo_inicial = test_solicitante.creditos_balance
        pago = self._crear_pago_pendiente(db_session, test_solicitante.id, creditos=100.0)

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

        db_session.refresh(test_solicitante)
        assert test_solicitante.creditos_balance == saldo_inicial + 100.0

        movimiento = db_session.query(MovimientoCredito).filter(MovimientoCredito.pago_id == pago.id).first()
        assert movimiento is not None
        assert movimiento.tipo == "compra"
        assert movimiento.monto == 100.0

    def test_webhook_es_idempotente(self, client, db_session, test_solicitante):
        """Reenviar el mismo evento confirmado no debe acreditar créditos dos veces"""
        saldo_inicial = test_solicitante.creditos_balance
        pago = self._crear_pago_pendiente(db_session, test_solicitante.id, creditos=100.0)

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

        db_session.refresh(test_solicitante)
        assert test_solicitante.creditos_balance == saldo_inicial + 100.0

    def test_webhook_pago_fallido(self, client, db_session, test_solicitante):
        """El webhook de pago fallido marca el pago como fallido sin acreditar créditos"""
        saldo_inicial = test_solicitante.creditos_balance
        pago = self._crear_pago_pendiente(db_session, test_solicitante.id)

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

        db_session.refresh(test_solicitante)
        assert test_solicitante.creditos_balance == saldo_inicial
