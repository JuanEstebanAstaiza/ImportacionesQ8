"""Tests de personalización de perfiles: perfil de usuario (GET/PUT /usuarios/me)
y perfil de la empresa importadora (PUT /importadores/{id}), incluyendo IDOR
entre cuentas/empresas distintas (Fase 2)."""
import pytest
from uuid import uuid4
from datetime import datetime
from fastapi import status

from models.cotizacion import Cotizacion, EstadoCotizacion
from models.orden import EstadoOrden, Orden
from models.usuario import Usuario
from utils.security import hash_password, create_access_token
from conftest import crear_empresa_importadora, auth_headers_for


def _orden_entregada(db_session, importador_id, solicitante_id):
    """Una orden ya entregada: es lo que cuenta como proyecto completado."""
    cotizacion = Cotizacion(
        id=str(uuid4()),
        solicitante_id=solicitante_id,
        importador_id=importador_id,
        modalidad="dirigida",
        pais_importacion="China",
        nombre_producto="Camisetas",
        descripcion_cliente="500 camisetas con logo",
        linea_producto="Textil",
        tipo_calidad="estandar",
        cantidad_minima=500,
        precio_objetivo_usd=3.5,
        incoterm="FOB",
        estado=EstadoCotizacion.dirigida,
    )
    db_session.add(cotizacion)
    db_session.commit()

    orden = Orden(
        id=str(uuid4()),
        cotizacion_id=cotizacion.id,
        importador_id=importador_id,
        solicitante_id=solicitante_id,
        estado=EstadoOrden.entregado.value,
        precio_acordado_usd=3.2,
        tiempo_estimado_entrega="45 días",
    )
    db_session.add(orden)
    db_session.commit()
    return orden


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


class TestFichaPublicaDeLaEmpresa:
    """Lo que la empresa escribe en su perfil tiene que volver tal cual.

    El autoguardado del formulario reenvía el perfil entero cada vez que el
    usuario deja de escribir, así que un campo que el backend descartara en
    silencio se perdía sin que nadie viera un error.
    """

    def test_logo_y_datos_de_contacto_persisten(self, client, empresa_a):
        importador, dueño = empresa_a
        respuesta = client.put(
            f"/importadores/{importador.id}",
            json={
                "logo_url": "/api/documentos/archivos/abc-123/descargar",
                "perfil_publico": {
                    "website": "https://empresa-a.example.com",
                    "email": "contacto@empresa-a.example.com",
                    "phone": "+57 300 000 0000",
                    "address": "Calle 1 #2-3",
                    "year": "2014",
                    "industries": ["Retail"],
                    "certs": ["ISO 9001"],
                },
            },
            headers=auth_headers_for(dueño),
        )
        assert respuesta.status_code == status.HTTP_200_OK

        # El `/api` es prefijo del proxy de Vite: se guarda la ruta del backend.
        assert respuesta.json()["logo_url"] == "/documentos/archivos/abc-123/descargar"

        leido = client.get(f"/importadores/{importador.id}").json()
        assert leido["logo_url"] == "/documentos/archivos/abc-123/descargar"
        perfil = leido["perfil_publico"]
        assert perfil["website"] == "https://empresa-a.example.com"
        assert perfil["email"] == "contacto@empresa-a.example.com"
        assert perfil["phone"] == "+57 300 000 0000"
        assert perfil["address"] == "Calle 1 #2-3"
        assert perfil["year"] == "2014"
        assert perfil["industries"] == ["Retail"]
        assert perfil["certs"] == ["ISO 9001"]

    def test_logo_vacio_lo_quita(self, client, empresa_a):
        importador, dueño = empresa_a
        cabeceras = auth_headers_for(dueño)
        client.put(
            f"/importadores/{importador.id}",
            json={"logo_url": "/documentos/archivos/abc-123/descargar"},
            headers=cabeceras,
        )

        respuesta = client.put(
            f"/importadores/{importador.id}",
            json={"logo_url": ""},
            headers=cabeceras,
        )
        assert respuesta.status_code == status.HTTP_200_OK
        assert not respuesta.json()["logo_url"]

    def test_guardados_sucesivos_no_pierden_lo_anterior(self, client, empresa_a):
        """El autoguardado dispara varios PUT seguidos con el perfil completo."""
        importador, dueño = empresa_a
        cabeceras = auth_headers_for(dueño)

        client.put(
            f"/importadores/{importador.id}",
            json={"perfil_publico": {"website": "empresa.example.com", "phone": ""}},
            headers=cabeceras,
        )
        respuesta = client.put(
            f"/importadores/{importador.id}",
            json={"perfil_publico": {"website": "empresa.example.com", "phone": "+57 1 2223344"}},
            headers=cabeceras,
        )

        assert respuesta.status_code == status.HTTP_200_OK
        perfil = respuesta.json()["perfil_publico"]
        assert perfil["website"] == "empresa.example.com"
        assert perfil["phone"] == "+57 1 2223344"


class TestProyectosCompletados:
    """`proyectos_completados` es la trayectoria que ve el solicitante."""

    def test_cero_sin_ordenes_entregadas(self, client, empresa_a):
        importador, _ = empresa_a
        assert client.get(f"/importadores/{importador.id}").json()["proyectos_completados"] == 0

    def test_cuenta_solo_las_ordenes_entregadas(self, client, db_session, empresa_a, solicitante):
        importador, _ = empresa_a
        _orden_entregada(db_session, importador.id, solicitante.id)
        _orden_entregada(db_session, importador.id, solicitante.id)

        ficha = client.get(f"/importadores/{importador.id}").json()
        assert ficha["proyectos_completados"] == 2

        # Una orden en curso no es un proyecto completado.
        en_curso = _orden_entregada(db_session, importador.id, solicitante.id)
        en_curso.estado = EstadoOrden.en_produccion.value
        db_session.commit()

        assert client.get(f"/importadores/{importador.id}").json()["proyectos_completados"] == 2

    def test_no_se_mezclan_entre_empresas(self, client, db_session, empresa_a, empresa_b, solicitante):
        importador_a, _ = empresa_a
        importador_b, _ = empresa_b
        _orden_entregada(db_session, importador_a.id, solicitante.id)

        catalogo = {fila["id"]: fila for fila in client.get("/importadores").json()}
        assert catalogo[str(importador_a.id)]["proyectos_completados"] == 1
        assert catalogo[str(importador_b.id)]["proyectos_completados"] == 0
