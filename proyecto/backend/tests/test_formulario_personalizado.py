"""Tests del formulario de cotización personalizable para empresas
'solo_cotizaciones_directas' (Fase 3)."""
import pytest
from uuid import uuid4
from datetime import datetime
from fastapi import status

from models.usuario import Usuario
from utils.security import hash_password, create_access_token
from conftest import crear_empresa_importadora, auth_headers_for


@pytest.fixture()
def empresa_directa(db_session):
    """Empresa marcada como solo_cotizaciones_directas=True, puede personalizar su formulario."""
    return crear_empresa_importadora(
        db_session, nombre_empresa="Empresa Solo Directas", email_dueño="directa@example.com",
        solo_cotizaciones_directas=True
    )


@pytest.fixture()
def empresa_estandar(db_session):
    """Empresa con formulario estándar (no puede personalizar)."""
    return crear_empresa_importadora(
        db_session, nombre_empresa="Empresa Estandar", email_dueño="estandar@example.com",
        solo_cotizaciones_directas=False
    )


@pytest.fixture()
def solicitante(db_session):
    user = Usuario(
        id=str(uuid4()),
        email="solicitante_form@example.com",
        password_hash=hash_password("123456789"),
        rol="solicitante",
        creditos_balance=1000.0,
        perfil_completo=True,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def auth_headers_solicitante(solicitante):
    token = create_access_token(str(solicitante.id), "solicitante")
    return {"Authorization": f"Bearer {token}"}


class TestCrudCamposPersonalizados:
    def test_crear_campo_en_empresa_directa(self, client, empresa_directa):
        importador, dueño = empresa_directa
        response = client.post(
            "/importadores/campos-personalizados",
            json={"etiqueta": "Color deseado", "tipo": "texto", "obligatorio": True, "orden": 1},
            headers=auth_headers_for(dueño)
        )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["etiqueta"] == "Color deseado"
        assert data["obligatorio"] is True

    def test_crear_campo_rechazado_en_empresa_estandar(self, client, empresa_estandar):
        importador, dueño = empresa_estandar
        response = client.post(
            "/importadores/campos-personalizados",
            json={"etiqueta": "Campo no permitido", "tipo": "texto"},
            headers=auth_headers_for(dueño)
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_crear_campo_tipo_invalido(self, client, empresa_directa):
        importador, dueño = empresa_directa
        response = client.post(
            "/importadores/campos-personalizados",
            json={"etiqueta": "Campo raro", "tipo": "fecha"},
            headers=auth_headers_for(dueño)
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_listar_campos_propios(self, client, empresa_directa):
        importador, dueño = empresa_directa
        client.post(
            "/importadores/campos-personalizados",
            json={"etiqueta": "Talla", "tipo": "select", "opciones": ["S", "M", "L"]},
            headers=auth_headers_for(dueño)
        )
        response = client.get("/importadores/campos-personalizados", headers=auth_headers_for(dueño))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()) == 1

    def test_actualizar_campo_propio(self, client, empresa_directa):
        importador, dueño = empresa_directa
        crear = client.post(
            "/importadores/campos-personalizados",
            json={"etiqueta": "Material", "tipo": "texto"},
            headers=auth_headers_for(dueño)
        )
        campo_id = crear.json()["id"]

        response = client.put(
            f"/importadores/campos-personalizados/{campo_id}",
            json={"obligatorio": True},
            headers=auth_headers_for(dueño)
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["obligatorio"] is True

    def test_no_puede_editar_campo_de_otra_empresa(self, client, empresa_directa, empresa_estandar, db_session):
        importador_directa, dueño_directa = empresa_directa
        # Convertimos la segunda empresa también a "directa" para poder crear su propio campo
        importador_b, dueño_b = crear_empresa_importadora(
            db_session, nombre_empresa="Empresa Directa B", email_dueño="directa_b@example.com",
            solo_cotizaciones_directas=True
        )

        crear = client.post(
            "/importadores/campos-personalizados",
            json={"etiqueta": "Campo de B", "tipo": "texto"},
            headers=auth_headers_for(dueño_b)
        )
        campo_id = crear.json()["id"]

        response = client.put(
            f"/importadores/campos-personalizados/{campo_id}",
            json={"obligatorio": True},
            headers=auth_headers_for(dueño_directa)
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_eliminar_campo_propio(self, client, empresa_directa):
        importador, dueño = empresa_directa
        crear = client.post(
            "/importadores/campos-personalizados",
            json={"etiqueta": "Para eliminar", "tipo": "texto"},
            headers=auth_headers_for(dueño)
        )
        campo_id = crear.json()["id"]

        response = client.delete(f"/importadores/campos-personalizados/{campo_id}", headers=auth_headers_for(dueño))
        assert response.status_code == status.HTTP_204_NO_CONTENT


class TestFormularioEfectivo:
    def test_formulario_empresa_directa_incluye_campos(self, client, empresa_directa):
        importador, dueño = empresa_directa
        client.post(
            "/importadores/campos-personalizados",
            json={"etiqueta": "Campo A", "tipo": "texto", "obligatorio": True},
            headers=auth_headers_for(dueño)
        )

        response = client.get(f"/importadores/{importador.id}/formulario")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["solo_cotizaciones_directas"] is True
        assert len(data["campos_personalizados"]) == 1

    def test_formulario_empresa_estandar_sin_campos(self, client, empresa_estandar):
        importador, dueño = empresa_estandar
        response = client.get(f"/importadores/{importador.id}/formulario")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["solo_cotizaciones_directas"] is False
        assert data["campos_personalizados"] == []


class TestValidacionEnCrearCotizacion:
    def test_cotizacion_dirigida_a_empresa_directa_sin_campos_obligatorios_falla(
        self, client, empresa_directa, auth_headers_solicitante
    ):
        importador, dueño = empresa_directa
        crear_campo = client.post(
            "/importadores/campos-personalizados",
            json={"etiqueta": "Campo obligatorio", "tipo": "texto", "obligatorio": True},
            headers=auth_headers_for(dueño)
        )
        assert crear_campo.status_code == status.HTTP_201_CREATED

        response = client.post(
            "/cotizaciones",
            json={
                "modalidad": "dirigida",
                "importador_id": str(importador.id),
                "pais_importacion": "China",
                "nombre_producto": "Producto sin campos",
                "descripcion_cliente": "Descripción de prueba sin completar campos obligatorios",
                "linea_producto": "Textiles",
                "tipo_calidad": "estandar",
                "cantidad_minima": 100,
                "incoterm": "FOB"
            },
            headers=auth_headers_solicitante
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cotizacion_dirigida_a_empresa_directa_con_campos_completos_exitosa(
        self, client, empresa_directa, auth_headers_solicitante
    ):
        importador, dueño = empresa_directa
        crear_campo = client.post(
            "/importadores/campos-personalizados",
            json={"etiqueta": "Campo obligatorio 2", "tipo": "texto", "obligatorio": True},
            headers=auth_headers_for(dueño)
        )
        campo_id = crear_campo.json()["id"]

        response = client.post(
            "/cotizaciones",
            json={
                "modalidad": "dirigida",
                "importador_id": str(importador.id),
                "campos_personalizados_valores": {campo_id: "Valor completado"},
                "pais_importacion": "China",
                "nombre_producto": "Producto con campos",
                "descripcion_cliente": "Descripción de prueba completando campos obligatorios",
                "linea_producto": "Textiles",
                "tipo_calidad": "estandar",
                "cantidad_minima": 100,
                "incoterm": "FOB"
            },
            headers=auth_headers_solicitante
        )
        assert response.status_code == status.HTTP_201_CREATED
