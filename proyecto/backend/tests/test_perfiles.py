"""Tests de personalización de perfiles: perfil de usuario (GET/PUT /usuarios/me)
y perfil de la empresa importadora (PUT /importadores/{id}), incluyendo IDOR
entre cuentas/empresas distintas (Fase 2)."""
import pytest
from uuid import uuid4
from datetime import datetime
from fastapi import status

from models.usuario import Usuario
from utils.security import hash_password, create_access_token
from conftest import crear_empresa_importadora, auth_headers_for


@pytest.fixture()
def solicitante(db_session):
    user = Usuario(
        id=str(uuid4()),
        email="solicitante_perfil@example.com",
        password_hash=hash_password("123456789"),
        rol="solicitante",
        perfil_completo=False,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def empresa_a(db_session):
    return crear_empresa_importadora(db_session, nombre_empresa="Empresa Perfiles A", email_dueño="perfil_a@example.com")


@pytest.fixture()
def empresa_b(db_session):
    return crear_empresa_importadora(db_session, nombre_empresa="Empresa Perfiles B", email_dueño="perfil_b@example.com")


class TestPerfilUsuario:
    def test_obtener_mi_perfil(self, client, solicitante):
        token = create_access_token(str(solicitante.id), "solicitante")
        response = client.get("/usuarios/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["email"] == solicitante.email
        assert data["activo"] is True

    def test_actualizar_mi_perfil_marca_completo(self, client, solicitante):
        token = create_access_token(str(solicitante.id), "solicitante")
        response = client.put(
            "/usuarios/me",
            json={"nombre": "María López", "telefono": "555-1234"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["nombre"] == "María López"
        assert data["telefono"] == "555-1234"
        assert data["perfil_completo"] is True

    def test_perfil_de_asesor_incluye_foto_y_whatsapp(self, client, db_session, empresa_a):
        importador, dueño = empresa_a
        asesor = Usuario(
            id=str(uuid4()), email="trab_perfil@example.com", password_hash=hash_password("123456789"),
            rol="asesor", importador_id=importador.id, activo=True, fecha_creacion=datetime.utcnow()
        )
        db_session.add(asesor)
        db_session.commit()

        response = client.put(
            "/usuarios/me",
            json={"nombre": "Asesor Uno", "foto_url": "https://example.com/foto.jpg", "whatsapp": "+50412345678"},
            headers=auth_headers_for(asesor)
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["foto_url"] == "https://example.com/foto.jpg"
        assert data["whatsapp"] == "+50412345678"
        assert data["importador_id"] == str(importador.id)

    def test_sin_autenticacion_rechazado(self, client):
        response = client.get("/usuarios/me")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestPerfilEmpresa:
    def test_dueño_actualiza_perfil_de_su_empresa(self, client, empresa_a):
        importador, dueño = empresa_a
        response = client.put(
            f"/importadores/{importador.id}",
            json={"nombre_empresa": "Empresa Perfiles A Renovada", "tiempo_respuesta_promedio": "6h"},
            headers=auth_headers_for(dueño)
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["nombre_empresa"] == "Empresa Perfiles A Renovada"
        assert data["tiempo_respuesta_promedio"] == "6h"

    def test_dueño_no_puede_editar_perfil_de_otra_empresa(self, client, empresa_a, empresa_b):
        importador_a, dueño_a = empresa_a
        importador_b, dueño_b = empresa_b

        response = client.put(
            f"/importadores/{importador_b.id}",
            json={"nombre_empresa": "Intento de IDOR"},
            headers=auth_headers_for(dueño_a)
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_asesor_no_puede_editar_perfil_de_la_empresa(self, client, db_session, empresa_a):
        importador, dueño = empresa_a
        asesor = Usuario(
            id=str(uuid4()), email="trab_no_edita@example.com", password_hash=hash_password("123456789"),
            rol="asesor", importador_id=importador.id, activo=True, fecha_creacion=datetime.utcnow()
        )
        db_session.add(asesor)
        db_session.commit()

        response = client.put(
            f"/importadores/{importador.id}",
            json={"nombre_empresa": "Intento desde asesor"},
            headers=auth_headers_for(asesor)
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_activar_solo_cotizaciones_directas(self, client, empresa_a):
        importador, dueño = empresa_a
        response = client.put(
            f"/importadores/{importador.id}",
            json={"solo_cotizaciones_directas": True},
            headers=auth_headers_for(dueño)
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["solo_cotizaciones_directas"] is True
