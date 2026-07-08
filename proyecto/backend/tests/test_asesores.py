"""Tests del panel de empresa: creación/gestión de asesores, pool de
cotizaciones sin reclamar y reclamo atómico (Fase 1)."""
import pytest
from uuid import uuid4
from datetime import datetime
from fastapi import status

from models.usuario import Usuario
from models.cotizacion import Cotizacion, EstadoCotizacion
from utils.security import hash_password, create_access_token
from conftest import crear_empresa_importadora, auth_headers_for


@pytest.fixture()
def empresa_a(db_session):
    importador, dueño = crear_empresa_importadora(
        db_session, nombre_empresa="Empresa Asesores A", email_dueño="dueño_a@example.com"
    )
    return importador, dueño


@pytest.fixture()
def empresa_b(db_session):
    importador, dueño = crear_empresa_importadora(
        db_session, nombre_empresa="Empresa Asesores B", email_dueño="dueño_b@example.com"
    )
    return importador, dueño


@pytest.fixture()
def solicitante(db_session):
    user = Usuario(
        id=str(uuid4()),
        email="solicitante_trab@example.com",
        password_hash=hash_password("123456789"),
        rol="solicitante",
        perfil_completo=True,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


class TestCrearAsesor:
    def test_dueño_crea_asesor_exitoso(self, client, empresa_a):
        importador, dueño = empresa_a
        response = client.post(
            "/importadores/asesores",
            json={"email": "asesor1@example.com", "password": "123456789", "nombre": "Juan Pérez"},
            headers=auth_headers_for(dueño)
        )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["email"] == "asesor1@example.com"
        assert data["activo"] is True

    def test_solicitante_no_puede_crear_asesor(self, client, solicitante):
        token = create_access_token(str(solicitante.id), "solicitante")
        response = client.post(
            "/importadores/asesores",
            json={"email": "asesor2@example.com", "password": "123456789"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_asesor_no_puede_crear_otro_asesor(self, client, db_session, empresa_a):
        importador, dueño = empresa_a
        asesor = Usuario(
            id=str(uuid4()), email="trab_existente@example.com", password_hash=hash_password("123456789"),
            rol="asesor", importador_id=importador.id, activo=True, fecha_creacion=datetime.utcnow()
        )
        db_session.add(asesor)
        db_session.commit()

        response = client.post(
            "/importadores/asesores",
            json={"email": "otro_asesor@example.com", "password": "123456789"},
            headers=auth_headers_for(asesor)
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_crear_asesor_email_duplicado(self, client, empresa_a):
        importador, dueño = empresa_a
        client.post(
            "/importadores/asesores",
            json={"email": "duplicado@example.com", "password": "123456789"},
            headers=auth_headers_for(dueño)
        )
        response = client.post(
            "/importadores/asesores",
            json={"email": "duplicado@example.com", "password": "123456789"},
            headers=auth_headers_for(dueño)
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestListarYActualizarAsesores:
    def test_listar_solo_asesores_propios(self, client, db_session, empresa_a, empresa_b):
        importador_a, dueño_a = empresa_a
        importador_b, dueño_b = empresa_b

        client.post("/importadores/asesores", json={"email": "t_a@example.com", "password": "123456789"}, headers=auth_headers_for(dueño_a))
        client.post("/importadores/asesores", json={"email": "t_b@example.com", "password": "123456789"}, headers=auth_headers_for(dueño_b))

        response = client.get("/importadores/asesores", headers=auth_headers_for(dueño_a))
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["email"] == "t_a@example.com"

    def test_desactivar_asesor_propio(self, client, db_session, empresa_a):
        importador, dueño = empresa_a
        crear_response = client.post(
            "/importadores/asesores",
            json={"email": "desactivar@example.com", "password": "123456789"},
            headers=auth_headers_for(dueño)
        )
        asesor_id = crear_response.json()["id"]

        response = client.put(
            f"/importadores/asesores/{asesor_id}/estado",
            json={"activo": False},
            headers=auth_headers_for(dueño)
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["activo"] is False

    def test_no_puede_desactivar_asesor_de_otra_empresa(self, client, db_session, empresa_a, empresa_b):
        importador_a, dueño_a = empresa_a
        importador_b, dueño_b = empresa_b

        crear_response = client.post(
            "/importadores/asesores",
            json={"email": "t_b2@example.com", "password": "123456789"},
            headers=auth_headers_for(dueño_b)
        )
        asesor_b_id = crear_response.json()["id"]

        response = client.put(
            f"/importadores/asesores/{asesor_b_id}/estado",
            json={"activo": False},
            headers=auth_headers_for(dueño_a)
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestPoolEmpresaYReclamo:
    def test_pool_incluye_cotizacion_dirigida_sin_reclamar(self, client, db_session, empresa_a, solicitante):
        importador, dueño = empresa_a
        cotizacion = Cotizacion(
            id=str(uuid4()), solicitante_id=solicitante.id, importador_id=importador.id,
            modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Pool",
            descripcion_cliente="Descripción de prueba para el pool de la empresa",
            linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=100,
            precio_objetivo_usd=1.0, incoterm="FOB", estado=EstadoCotizacion.dirigida
        )
        db_session.add(cotizacion)
        db_session.commit()

        response = client.get("/cotizaciones/pool-empresa", headers=auth_headers_for(dueño))
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert any(c["id"] == str(cotizacion.id) for c in data)

    def test_pool_no_incluye_cotizacion_de_otra_empresa(self, client, db_session, empresa_a, empresa_b, solicitante):
        importador_a, dueño_a = empresa_a
        importador_b, dueño_b = empresa_b
        cotizacion = Cotizacion(
            id=str(uuid4()), solicitante_id=solicitante.id, importador_id=importador_b.id,
            modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Ajeno",
            descripcion_cliente="Descripción de prueba para cotización de otra empresa",
            linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=100,
            precio_objetivo_usd=1.0, incoterm="FOB", estado=EstadoCotizacion.dirigida
        )
        db_session.add(cotizacion)
        db_session.commit()

        response = client.get("/cotizaciones/pool-empresa", headers=auth_headers_for(dueño_a))
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert not any(c["id"] == str(cotizacion.id) for c in data)

    def test_asesor_reclama_cotizacion_exitosamente(self, client, db_session, empresa_a, solicitante):
        importador, dueño = empresa_a
        asesor = Usuario(
            id=str(uuid4()), email="reclamador@example.com", password_hash=hash_password("123456789"),
            rol="asesor", importador_id=importador.id, activo=True, fecha_creacion=datetime.utcnow()
        )
        db_session.add(asesor)

        cotizacion = Cotizacion(
            id=str(uuid4()), solicitante_id=solicitante.id, importador_id=importador.id,
            modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Reclamo",
            descripcion_cliente="Descripción de prueba para el reclamo de una cotización",
            linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=100,
            precio_objetivo_usd=1.0, incoterm="FOB", estado=EstadoCotizacion.dirigida
        )
        db_session.add(cotizacion)
        db_session.commit()

        response = client.post(f"/cotizaciones/{cotizacion.id}/reclamar", headers=auth_headers_for(asesor))
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["asesor_asignado_id"] == str(asesor.id)

    def test_reclamo_duplicado_devuelve_409(self, client, db_session, empresa_a, solicitante):
        importador, dueño = empresa_a
        asesor1 = Usuario(
            id=str(uuid4()), email="reclamador1@example.com", password_hash=hash_password("123456789"),
            rol="asesor", importador_id=importador.id, activo=True, fecha_creacion=datetime.utcnow()
        )
        asesor2 = Usuario(
            id=str(uuid4()), email="reclamador2@example.com", password_hash=hash_password("123456789"),
            rol="asesor", importador_id=importador.id, activo=True, fecha_creacion=datetime.utcnow()
        )
        db_session.add_all([asesor1, asesor2])

        cotizacion = Cotizacion(
            id=str(uuid4()), solicitante_id=solicitante.id, importador_id=importador.id,
            modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Race",
            descripcion_cliente="Descripción de prueba para condición de carrera de reclamo",
            linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=100,
            precio_objetivo_usd=1.0, incoterm="FOB", estado=EstadoCotizacion.dirigida
        )
        db_session.add(cotizacion)
        db_session.commit()

        response1 = client.post(f"/cotizaciones/{cotizacion.id}/reclamar", headers=auth_headers_for(asesor1))
        assert response1.status_code == status.HTTP_200_OK

        # Segundo asesor intenta reclamar la MISMA cotización: debe fallar con 409,
        # ya que el UPDATE condicional protege contra la condición de carrera.
        response2 = client.post(f"/cotizaciones/{cotizacion.id}/reclamar", headers=auth_headers_for(asesor2))
        assert response2.status_code == status.HTTP_409_CONFLICT

    def test_asesor_no_puede_reclamar_cotizacion_de_otra_empresa(self, client, db_session, empresa_a, empresa_b, solicitante):
        importador_a, dueño_a = empresa_a
        importador_b, dueño_b = empresa_b
        asesor_b = Usuario(
            id=str(uuid4()), email="trab_b_reclamo@example.com", password_hash=hash_password("123456789"),
            rol="asesor", importador_id=importador_b.id, activo=True, fecha_creacion=datetime.utcnow()
        )
        db_session.add(asesor_b)

        cotizacion = Cotizacion(
            id=str(uuid4()), solicitante_id=solicitante.id, importador_id=importador_a.id,
            modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Ajeno Reclamo",
            descripcion_cliente="Descripción de prueba para reclamo cruzado entre empresas",
            linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=100,
            precio_objetivo_usd=1.0, incoterm="FOB", estado=EstadoCotizacion.dirigida
        )
        db_session.add(cotizacion)
        db_session.commit()

        response = client.post(f"/cotizaciones/{cotizacion.id}/reclamar", headers=auth_headers_for(asesor_b))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_dueño_no_puede_reclamar_cotizaciones(self, client, db_session, empresa_a, solicitante):
        """Solo el rol 'asesor' reclama; la cuenta dueña no (ella envía la propuesta formal)."""
        importador, dueño = empresa_a
        cotizacion = Cotizacion(
            id=str(uuid4()), solicitante_id=solicitante.id, importador_id=importador.id,
            modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Dueño",
            descripcion_cliente="Descripción de prueba para verificar rol de la cuenta dueña",
            linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=100,
            precio_objetivo_usd=1.0, incoterm="FOB", estado=EstadoCotizacion.dirigida
        )
        db_session.add(cotizacion)
        db_session.commit()

        response = client.post(f"/cotizaciones/{cotizacion.id}/reclamar", headers=auth_headers_for(dueño))
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestCotizacionesAsignadasAsesor:
    def test_asesor_ve_solo_sus_asignadas(self, client, db_session, empresa_a, solicitante):
        importador, dueño = empresa_a
        asesor = Usuario(
            id=str(uuid4()), email="asignado@example.com", password_hash=hash_password("123456789"),
            rol="asesor", importador_id=importador.id, activo=True, fecha_creacion=datetime.utcnow()
        )
        db_session.add(asesor)

        cotizacion_asignada = Cotizacion(
            id=str(uuid4()), solicitante_id=solicitante.id, importador_id=importador.id,
            modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Asignado",
            descripcion_cliente="Descripción de prueba para cotización asignada",
            linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=100,
            precio_objetivo_usd=1.0, incoterm="FOB", estado=EstadoCotizacion.dirigida
        )
        db_session.add(cotizacion_asignada)
        db_session.commit()

        client.post(f"/cotizaciones/{cotizacion_asignada.id}/reclamar", headers=auth_headers_for(asesor))

        response = client.get("/asesores/me/cotizaciones", headers=auth_headers_for(asesor))
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == str(cotizacion_asignada.id)
