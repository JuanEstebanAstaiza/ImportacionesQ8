"""Tests: POST /chat/iniciar, DELETE asesores, métricas dashboard."""
import pytest
from uuid import uuid4
from datetime import datetime
from fastapi import status

from models.usuario import Usuario
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.propuesta import Propuesta, EstadoPropuesta
from models.chat import ConversacionChat
from utils.security import hash_password
from conftest import crear_empresa_importadora, auth_headers_for


@pytest.fixture()
def solicitante(db_session):
    user = Usuario(
        id=str(uuid4()),
        email="sol_chat_init@example.com",
        password_hash=hash_password("123456789"),
        rol="solicitante",
        email_verificado=True,
        perfil_completo=True,
        fecha_creacion=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def empresa_con_propuesta(db_session, solicitante):
    importador, dueño = crear_empresa_importadora(
        db_session, nombre_empresa="Empresa Chat Init", email_dueño="dueño_chat_init@example.com"
    )
    asesor = Usuario(
        id=str(uuid4()),
        email="asesor_chat_init@example.com",
        password_hash=hash_password("123456789"),
        rol="asesor",
        importador_id=importador.id,
        activo=True,
        email_verificado=True,
        fecha_creacion=datetime.utcnow(),
    )
    db_session.add(asesor)

    cotizacion = Cotizacion(
        id=str(uuid4()),
        solicitante_id=solicitante.id,
        importador_id=importador.id,
        modalidad="dirigida",
        pais_importacion="China",
        nombre_producto="Producto Chat Init",
        descripcion_cliente="Descripción suficiente para el flujo de inicio de chat",
        linea_producto="Textiles",
        tipo_calidad="estandar",
        cantidad_minima=100,
        precio_objetivo_usd=1.0,
        incoterm="FOB",
        estado=EstadoCotizacion.propuestas_recibidas,
        asesor_asignado_id=asesor.id,
    )
    db_session.add(cotizacion)

    propuesta = Propuesta(
        id=str(uuid4()),
        cotizacion_id=cotizacion.id,
        importador_id=importador.id,
        precio_ofrecido_usd=0.9,
        tiempo_estimado_entrega="30 días",
        incoterm="FOB",
        estado=EstadoPropuesta.pendiente,
        creado_por_usuario_id=asesor.id,
    )
    db_session.add(propuesta)
    db_session.commit()
    return importador, dueño, asesor, cotizacion, propuesta


class TestIniciarChat:
    def test_asesor_inicia_chat_con_propuesta(self, client, empresa_con_propuesta, solicitante):
        _, _, asesor, cotizacion, propuesta = empresa_con_propuesta
        r = client.post(
            "/chat/iniciar",
            json={
                "propuesta_id": str(propuesta.id),
                "mensaje_inicial": "Hola, te envío la propuesta y quedo atento.",
            },
            headers=auth_headers_for(asesor),
        )
        assert r.status_code == status.HTTP_201_CREATED
        data = r.json()
        assert data["cotizacion_id"] == str(cotizacion.id)
        assert data["solicitante_id"] == str(solicitante.id)
        assert data["importador_usuario_id"] == str(asesor.id)
        assert data["ultimo_mensaje"] is not None
        assert "propuesta" in data["ultimo_mensaje"]["contenido"].lower() or data["ultimo_mensaje"]["contenido"]

        # Idempotente: reutiliza conversación
        r2 = client.post(
            "/chat/iniciar",
            json={"cotizacion_id": str(cotizacion.id)},
            headers=auth_headers_for(asesor),
        )
        assert r2.status_code == 201
        assert r2.json()["id"] == data["id"]

        # Notificación al solicitante
        notif = client.get("/notificaciones", headers=auth_headers_for(solicitante))
        assert notif.status_code == 200
        assert notif.json()["no_leidas"] >= 1

    def test_solicitante_no_puede_iniciar(self, client, empresa_con_propuesta, solicitante):
        _, _, _, _, propuesta = empresa_con_propuesta
        r = client.post(
            "/chat/iniciar",
            json={"propuesta_id": str(propuesta.id)},
            headers=auth_headers_for(solicitante),
        )
        assert r.status_code == status.HTTP_403_FORBIDDEN


class TestHardDeleteAsesor:
    def test_eliminar_asesor_sin_historial(self, client, db_session):
        importador, dueño = crear_empresa_importadora(
            db_session, email_dueño="dueño_del@example.com"
        )
        crear = client.post(
            "/importadores/asesores",
            json={"email": "asesor_del@example.com", "password": "ClaveSegura1", "nombre": "Temp"},
            headers=auth_headers_for(dueño),
        )
        assert crear.status_code == 201
        asesor_id = crear.json()["id"]

        r = client.delete(
            f"/importadores/asesores/{asesor_id}",
            headers=auth_headers_for(dueño),
        )
        assert r.status_code == status.HTTP_204_NO_CONTENT

        lista = client.get("/importadores/asesores", headers=auth_headers_for(dueño))
        assert all(a["id"] != asesor_id for a in lista.json())

    def test_no_eliminar_con_cotizaciones_asignadas(self, client, empresa_con_propuesta):
        _, dueño, asesor, _, _ = empresa_con_propuesta
        r = client.delete(
            f"/importadores/asesores/{asesor.id}",
            headers=auth_headers_for(dueño),
        )
        assert r.status_code == status.HTTP_409_CONFLICT


class TestMetricas:
    def test_metricas_importador(self, client, empresa_con_propuesta):
        _, dueño, _, _, _ = empresa_con_propuesta
        r = client.get("/importadores/metricas", headers=auth_headers_for(dueño))
        assert r.status_code == 200
        data = r.json()
        assert data["total_propuestas_enviadas"] >= 1
        assert "tasa_aceptacion_pct" in data
        assert "volumen_cotizado_usd" in data

    def test_dashboard_stats_asesor(self, client, empresa_con_propuesta):
        _, _, asesor, _, _ = empresa_con_propuesta
        r = client.get("/asesores/dashboard/stats", headers=auth_headers_for(asesor))
        assert r.status_code == 200
        data = r.json()
        assert data["asesor_id"] == str(asesor.id)
        assert data["cotizaciones_asignadas"] >= 1
        assert data["propuestas_enviadas"] >= 1
