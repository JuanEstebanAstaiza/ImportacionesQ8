"""Tests de redacción (asesor) vs. envío (dueño) de propuestas, y congruencia
de categoría al responder una cotización (Semana 4 - Fase 4)."""
from uuid import uuid4
from datetime import datetime

import pytest
from fastapi import status

from models.usuario import Usuario
from models.cotizacion import Cotizacion
from utils.security import hash_password, create_access_token
from conftest import crear_empresa_importadora, auth_headers_for


@pytest.fixture()
def empresa_textiles(db_session):
    return crear_empresa_importadora(
        db_session, nombre_empresa="Empresa Textiles Borrador",
        email_dueño="dueño_textiles@example.com", especialidad_producto=["Textiles"]
    )


@pytest.fixture()
def empresa_tecnologia(db_session):
    return crear_empresa_importadora(
        db_session, nombre_empresa="Empresa Tecnologia Borrador",
        email_dueño="dueño_tecnologia@example.com", especialidad_producto=["Tecnologia"]
    )


@pytest.fixture()
def solicitante(db_session):
    user = Usuario(
        id=str(uuid4()),
        email="solicitante_borrador@example.com",
        password_hash=hash_password("123456789"),
        rol="solicitante",
        creditos_balance=100.0,
        perfil_completo=True,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def asesor_textiles(db_session, empresa_textiles):
    importador, _ = empresa_textiles
    asesor = Usuario(
        id=str(uuid4()),
        email="asesor_textiles@example.com",
        password_hash=hash_password("123456789"),
        rol="asesor",
        importador_id=importador.id,
        activo=True,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(asesor)
    db_session.commit()
    db_session.refresh(asesor)
    return asesor


@pytest.fixture()
def cotizacion_dirigida_textiles(db_session, solicitante, empresa_textiles):
    importador, _ = empresa_textiles
    cotizacion = Cotizacion(
        id=str(uuid4()),
        solicitante_id=solicitante.id,
        importador_id=importador.id,
        modalidad="dirigida",
        pais_importacion="China",
        nombre_producto="Camisetas personalizadas",
        descripcion_cliente="500 camisetas con logo impreso en algodón premium",
        linea_producto="Textiles",
        tipo_calidad="estandar",
        cantidad_minima=500,
        precio_objetivo_usd=3.50,
        incoterm="FOB",
        estado="dirigida"
    )
    db_session.add(cotizacion)
    db_session.commit()
    db_session.refresh(cotizacion)
    return cotizacion


def _payload_propuesta(cotizacion_id):
    return {
        "cotizacion_id": cotizacion_id,
        "precio_ofrecido_usd": 1500.0,
        "tiempo_estimado_entrega": "45 días",
        "incoterm": "FOB",
        "condiciones_adicionales": "Incluye embalaje especial"
    }


class TestCongruenciaCategoria:
    def test_empresa_de_otra_categoria_no_puede_responder(self, client, db_session, cotizacion_dirigida_textiles, empresa_tecnologia):
        """Una empresa de tecnología no puede responder una cotización de textiles, ni siquiera dirigida a ella"""
        importador_tec, dueño_tec = empresa_tecnologia
        # Redirigir la cotización (para probar el caso "dirigida a la empresa incorrecta" sería otro test;
        # aquí forzamos el escenario típico: la empresa de tecnología intenta responder una de textiles).
        cotizacion_dirigida_textiles.importador_id = importador_tec.id
        db_session.commit()

        response = client.post(
            "/propuestas",
            json=_payload_propuesta(cotizacion_dirigida_textiles.id),
            headers=auth_headers_for(dueño_tec)
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "congruente" in response.json()["detail"] or "categoría" in response.json()["detail"].lower()

    def test_empresa_de_la_categoria_correcta_puede_responder(self, client, cotizacion_dirigida_textiles, empresa_textiles):
        importador, dueño = empresa_textiles
        response = client.post(
            "/propuestas",
            json=_payload_propuesta(cotizacion_dirigida_textiles.id),
            headers=auth_headers_for(dueño)
        )

        assert response.status_code == status.HTTP_201_CREATED


class TestBorradorYEnvio:
    def test_asesor_asignado_crea_borrador(self, client, db_session, cotizacion_dirigida_textiles, asesor_textiles):
        cotizacion_dirigida_textiles.asesor_asignado_id = asesor_textiles.id
        db_session.commit()

        response = client.post(
            "/propuestas/borrador",
            json=_payload_propuesta(cotizacion_dirigida_textiles.id),
            headers=auth_headers_for(asesor_textiles, )
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["estado"] == "borrador"

    def test_borrador_no_visible_para_solicitante(self, client, db_session, cotizacion_dirigida_textiles, asesor_textiles, solicitante):
        cotizacion_dirigida_textiles.asesor_asignado_id = asesor_textiles.id
        db_session.commit()

        client.post(
            "/propuestas/borrador",
            json=_payload_propuesta(cotizacion_dirigida_textiles.id),
            headers=auth_headers_for(asesor_textiles)
        )

        token = create_access_token(str(solicitante.id), "solicitante")
        response = client.get(
            f"/cotizaciones/{cotizacion_dirigida_textiles.id}/propuestas",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []

    def test_asesor_no_asignado_no_puede_crear_borrador(self, client, db_session, empresa_textiles, cotizacion_dirigida_textiles):
        """Solo el asesor que reclamó la cotización puede redactar su borrador"""
        importador, _ = empresa_textiles
        otro_asesor = Usuario(
            id=str(uuid4()), email="otro_asesor@example.com", password_hash=hash_password("123456789"),
            rol="asesor", importador_id=importador.id, activo=True, fecha_creacion=datetime.utcnow()
        )
        db_session.add(otro_asesor)
        db_session.commit()

        response = client.post(
            "/propuestas/borrador",
            json=_payload_propuesta(cotizacion_dirigida_textiles.id),
            headers=auth_headers_for(otro_asesor)
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_dueño_envia_borrador_exitosamente(self, client, db_session, cotizacion_dirigida_textiles, asesor_textiles, empresa_textiles):
        cotizacion_dirigida_textiles.asesor_asignado_id = asesor_textiles.id
        db_session.commit()
        _, dueño = empresa_textiles

        borrador = client.post(
            "/propuestas/borrador",
            json=_payload_propuesta(cotizacion_dirigida_textiles.id),
            headers=auth_headers_for(asesor_textiles)
        ).json()

        response = client.post(f"/propuestas/{borrador['id']}/enviar", headers=auth_headers_for(dueño))

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["estado"] == "pendiente"

    def test_asesor_no_puede_enviar_su_propio_borrador(self, client, db_session, cotizacion_dirigida_textiles, asesor_textiles):
        cotizacion_dirigida_textiles.asesor_asignado_id = asesor_textiles.id
        db_session.commit()

        borrador = client.post(
            "/propuestas/borrador",
            json=_payload_propuesta(cotizacion_dirigida_textiles.id),
            headers=auth_headers_for(asesor_textiles)
        ).json()

        response = client.post(f"/propuestas/{borrador['id']}/enviar", headers=auth_headers_for(asesor_textiles))

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_asesor_edita_propuesta_propia(self, client, db_session, cotizacion_dirigida_textiles, asesor_textiles):
        cotizacion_dirigida_textiles.asesor_asignado_id = asesor_textiles.id
        db_session.commit()

        borrador = client.post(
            "/propuestas/borrador",
            json=_payload_propuesta(cotizacion_dirigida_textiles.id),
            headers=auth_headers_for(asesor_textiles)
        ).json()

        payload_editado = _payload_propuesta(cotizacion_dirigida_textiles.id)
        payload_editado["precio_ofrecido_usd"] = 1800.0

        response = client.put(
            f"/propuestas/{borrador['id']}", json=payload_editado, headers=auth_headers_for(asesor_textiles)
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["precio_ofrecido_usd"] == 1800.0
