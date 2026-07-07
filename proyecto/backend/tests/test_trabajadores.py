"""Tests del panel de empresa: creación/gestión de trabajadores, pool de
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
        db_session, nombre_empresa="Empresa Trabajadores A", email_dueño="dueño_a@example.com"
    )
    return importador, dueño


@pytest.fixture()
def empresa_b(db_session):
    importador, dueño = crear_empresa_importadora(
        db_session, nombre_empresa="Empresa Trabajadores B", email_dueño="dueño_b@example.com"
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


class TestCrearTrabajador:
    def test_dueño_crea_trabajador_exitoso(self, client, empresa_a):
        importador, dueño = empresa_a
        response = client.post(
            "/importadores/trabajadores",
            json={"email": "trabajador1@example.com", "password": "123456789", "nombre": "Juan Pérez"},
            headers=auth_headers_for(dueño)
        )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["email"] == "trabajador1@example.com"
        assert data["activo"] is True

    def test_solicitante_no_puede_crear_trabajador(self, client, solicitante):
        token = create_access_token(str(solicitante.id), "solicitante")
        response = client.post(
            "/importadores/trabajadores",
            json={"email": "trabajador2@example.com", "password": "123456789"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_trabajador_no_puede_crear_otro_trabajador(self, client, db_session, empresa_a):
        importador, dueño = empresa_a
        trabajador = Usuario(
            id=str(uuid4()), email="trab_existente@example.com", password_hash=hash_password("123456789"),
            rol="trabajador", importador_id=importador.id, activo=True, fecha_creacion=datetime.utcnow()
        )
        db_session.add(trabajador)
        db_session.commit()

        response = client.post(
            "/importadores/trabajadores",
            json={"email": "otro_trabajador@example.com", "password": "123456789"},
            headers=auth_headers_for(trabajador)
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_crear_trabajador_email_duplicado(self, client, empresa_a):
        importador, dueño = empresa_a
        client.post(
            "/importadores/trabajadores",
            json={"email": "duplicado@example.com", "password": "123456789"},
            headers=auth_headers_for(dueño)
        )
        response = client.post(
            "/importadores/trabajadores",
            json={"email": "duplicado@example.com", "password": "123456789"},
            headers=auth_headers_for(dueño)
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestListarYActualizarTrabajadores:
    def test_listar_solo_trabajadores_propios(self, client, db_session, empresa_a, empresa_b):
        importador_a, dueño_a = empresa_a
        importador_b, dueño_b = empresa_b

        client.post("/importadores/trabajadores", json={"email": "t_a@example.com", "password": "123456789"}, headers=auth_headers_for(dueño_a))
        client.post("/importadores/trabajadores", json={"email": "t_b@example.com", "password": "123456789"}, headers=auth_headers_for(dueño_b))

        response = client.get("/importadores/trabajadores", headers=auth_headers_for(dueño_a))
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["email"] == "t_a@example.com"

    def test_desactivar_trabajador_propio(self, client, db_session, empresa_a):
        importador, dueño = empresa_a
        crear_response = client.post(
            "/importadores/trabajadores",
            json={"email": "desactivar@example.com", "password": "123456789"},
            headers=auth_headers_for(dueño)
        )
        trabajador_id = crear_response.json()["id"]

        response = client.put(
            f"/importadores/trabajadores/{trabajador_id}/estado",
            json={"activo": False},
            headers=auth_headers_for(dueño)
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["activo"] is False

    def test_no_puede_desactivar_trabajador_de_otra_empresa(self, client, db_session, empresa_a, empresa_b):
        importador_a, dueño_a = empresa_a
        importador_b, dueño_b = empresa_b

        crear_response = client.post(
            "/importadores/trabajadores",
            json={"email": "t_b2@example.com", "password": "123456789"},
            headers=auth_headers_for(dueño_b)
        )
        trabajador_b_id = crear_response.json()["id"]

        response = client.put(
            f"/importadores/trabajadores/{trabajador_b_id}/estado",
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

    def test_trabajador_reclama_cotizacion_exitosamente(self, client, db_session, empresa_a, solicitante):
        importador, dueño = empresa_a
        trabajador = Usuario(
            id=str(uuid4()), email="reclamador@example.com", password_hash=hash_password("123456789"),
            rol="trabajador", importador_id=importador.id, activo=True, fecha_creacion=datetime.utcnow()
        )
        db_session.add(trabajador)

        cotizacion = Cotizacion(
            id=str(uuid4()), solicitante_id=solicitante.id, importador_id=importador.id,
            modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Reclamo",
            descripcion_cliente="Descripción de prueba para el reclamo de una cotización",
            linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=100,
            precio_objetivo_usd=1.0, incoterm="FOB", estado=EstadoCotizacion.dirigida
        )
        db_session.add(cotizacion)
        db_session.commit()

        response = client.post(f"/cotizaciones/{cotizacion.id}/reclamar", headers=auth_headers_for(trabajador))
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["trabajador_asignado_id"] == str(trabajador.id)

    def test_reclamo_duplicado_devuelve_409(self, client, db_session, empresa_a, solicitante):
        importador, dueño = empresa_a
        trabajador1 = Usuario(
            id=str(uuid4()), email="reclamador1@example.com", password_hash=hash_password("123456789"),
            rol="trabajador", importador_id=importador.id, activo=True, fecha_creacion=datetime.utcnow()
        )
        trabajador2 = Usuario(
            id=str(uuid4()), email="reclamador2@example.com", password_hash=hash_password("123456789"),
            rol="trabajador", importador_id=importador.id, activo=True, fecha_creacion=datetime.utcnow()
        )
        db_session.add_all([trabajador1, trabajador2])

        cotizacion = Cotizacion(
            id=str(uuid4()), solicitante_id=solicitante.id, importador_id=importador.id,
            modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Race",
            descripcion_cliente="Descripción de prueba para condición de carrera de reclamo",
            linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=100,
            precio_objetivo_usd=1.0, incoterm="FOB", estado=EstadoCotizacion.dirigida
        )
        db_session.add(cotizacion)
        db_session.commit()

        response1 = client.post(f"/cotizaciones/{cotizacion.id}/reclamar", headers=auth_headers_for(trabajador1))
        assert response1.status_code == status.HTTP_200_OK

        # Segundo trabajador intenta reclamar la MISMA cotización: debe fallar con 409,
        # ya que el UPDATE condicional protege contra la condición de carrera.
        response2 = client.post(f"/cotizaciones/{cotizacion.id}/reclamar", headers=auth_headers_for(trabajador2))
        assert response2.status_code == status.HTTP_409_CONFLICT

    def test_trabajador_no_puede_reclamar_cotizacion_de_otra_empresa(self, client, db_session, empresa_a, empresa_b, solicitante):
        importador_a, dueño_a = empresa_a
        importador_b, dueño_b = empresa_b
        trabajador_b = Usuario(
            id=str(uuid4()), email="trab_b_reclamo@example.com", password_hash=hash_password("123456789"),
            rol="trabajador", importador_id=importador_b.id, activo=True, fecha_creacion=datetime.utcnow()
        )
        db_session.add(trabajador_b)

        cotizacion = Cotizacion(
            id=str(uuid4()), solicitante_id=solicitante.id, importador_id=importador_a.id,
            modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Ajeno Reclamo",
            descripcion_cliente="Descripción de prueba para reclamo cruzado entre empresas",
            linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=100,
            precio_objetivo_usd=1.0, incoterm="FOB", estado=EstadoCotizacion.dirigida
        )
        db_session.add(cotizacion)
        db_session.commit()

        response = client.post(f"/cotizaciones/{cotizacion.id}/reclamar", headers=auth_headers_for(trabajador_b))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_dueño_no_puede_reclamar_cotizaciones(self, client, db_session, empresa_a, solicitante):
        """Solo el rol 'trabajador' reclama; la cuenta dueña no (ella envía la propuesta formal)."""
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


class TestCotizacionesAsignadasTrabajador:
    def test_trabajador_ve_solo_sus_asignadas(self, client, db_session, empresa_a, solicitante):
        importador, dueño = empresa_a
        trabajador = Usuario(
            id=str(uuid4()), email="asignado@example.com", password_hash=hash_password("123456789"),
            rol="trabajador", importador_id=importador.id, activo=True, fecha_creacion=datetime.utcnow()
        )
        db_session.add(trabajador)

        cotizacion_asignada = Cotizacion(
            id=str(uuid4()), solicitante_id=solicitante.id, importador_id=importador.id,
            modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Asignado",
            descripcion_cliente="Descripción de prueba para cotización asignada",
            linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=100,
            precio_objetivo_usd=1.0, incoterm="FOB", estado=EstadoCotizacion.dirigida
        )
        db_session.add(cotizacion_asignada)
        db_session.commit()

        client.post(f"/cotizaciones/{cotizacion_asignada.id}/reclamar", headers=auth_headers_for(trabajador))

        response = client.get("/trabajadores/me/cotizaciones", headers=auth_headers_for(trabajador))
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == str(cotizacion_asignada.id)
