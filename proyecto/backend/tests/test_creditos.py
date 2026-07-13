"""Tests de consumo de créditos al crear cotizaciones (Semana 4)."""
from uuid import uuid4
from datetime import datetime

import pytest
from fastapi import status

import config
from models.usuario import Usuario
from models.credito import MovimientoCredito
from utils.security import hash_password, create_access_token


@pytest.fixture()
def solicitante_con_creditos(db_session):
    user = Usuario(
        id=str(uuid4()),
        email="solicitante_creditos@example.com",
        password_hash=hash_password("123456789"),
        rol="solicitante",
        creditos_balance=12.0,
        perfil_completo=True,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def solicitante_sin_creditos(db_session):
    user = Usuario(
        id=str(uuid4()),
        email="solicitante_sin_creditos@example.com",
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


def _auth_headers(usuario):
    token = create_access_token(str(usuario.id), "solicitante")
    return {"Authorization": f"Bearer {token}"}


def _payload_cotizacion_abierta():
    return {
        "modalidad": "abierta",
        "pais_importacion": "China",
        "nombre_producto": "Camisetas personalizadas",
        "descripcion_cliente": "Necesito 500 camisetas con mi logo impreso en algodón premium",
        "linea_producto": "Textiles",
        "tipo_calidad": "estandar",
        "cantidad_minima": 500,
        "incoterm": "FOB"
    }


class TestConsumoCreditosAlCrearCotizacion:

    def test_crear_cotizacion_abierta_descuenta_creditos(self, client, db_session, solicitante_con_creditos):
        saldo_inicial = solicitante_con_creditos.creditos_balance

        response = client.post(
            "/cotizaciones", json=_payload_cotizacion_abierta(), headers=_auth_headers(solicitante_con_creditos)
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["costo_creditos"] == config.CREDITO_COSTO_COTIZACION_ABIERTA

        db_session.refresh(solicitante_con_creditos)
        assert solicitante_con_creditos.creditos_balance == saldo_inicial - config.CREDITO_COSTO_COTIZACION_ABIERTA

        movimiento = db_session.query(MovimientoCredito).filter(
            MovimientoCredito.cotizacion_id == data["id"]
        ).first()
        assert movimiento is not None
        assert movimiento.tipo == "consumo"
        assert movimiento.monto == -config.CREDITO_COSTO_COTIZACION_ABIERTA

    def test_crear_cotizacion_sin_creditos_suficientes_falla_402(self, client, solicitante_sin_creditos):
        response = client.post(
            "/cotizaciones", json=_payload_cotizacion_abierta(), headers=_auth_headers(solicitante_sin_creditos)
        )

        assert response.status_code == status.HTTP_402_PAYMENT_REQUIRED

    def test_creditos_insuficientes_no_crea_cotizacion(self, client, db_session, solicitante_sin_creditos):
        """Si no hay créditos, no debe quedar ninguna cotización creada a medias (ACID)"""
        from models.cotizacion import Cotizacion

        antes = db_session.query(Cotizacion).count()
        client.post("/cotizaciones", json=_payload_cotizacion_abierta(), headers=_auth_headers(solicitante_sin_creditos))
        despues = db_session.query(Cotizacion).count()

        assert antes == despues
