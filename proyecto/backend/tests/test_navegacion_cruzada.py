"""Semana 4 - Fase 7: navegación cruzada entre cotización, propuesta, orden y chat.

Verifica que `CotizacionResponse` exponga `conversacion_id` y `contacto_asignado`,
que `PropuestaResponse` exponga `contacto_asesor`, y que `OrdenResponse` exponga
`conversacion_id`, para que el frontend pueda "saltar" de una entidad a otra.
"""
import pytest
from uuid import uuid4
from datetime import datetime

from models.usuario import Usuario
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.propuesta import Propuesta, EstadoPropuesta
from models.orden import Orden
from utils.security import hash_password
from conftest import crear_empresa_importadora, auth_headers_for


@pytest.fixture()
def solicitante(db_session):
    user = Usuario(
        id=str(uuid4()), email="solicitante_navcruzada@example.com", password_hash=hash_password("123456789"),
        rol="solicitante", perfil_completo=True, creditos_balance=1000.0, fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def empresa(db_session):
    return crear_empresa_importadora(
        db_session, nombre_empresa="Empresa Navegación Cruzada", email_dueño="dueño_navcruzada@example.com"
    )


@pytest.fixture()
def asesor(db_session, empresa):
    importador, _dueño = empresa
    user = Usuario(
        id=str(uuid4()), email="asesor_navcruzada@example.com", password_hash=hash_password("123456789"),
        rol="asesor", importador_id=importador.id, activo=True, nombre="Asesor Nav", whatsapp="+573001112233",
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _crear_cotizacion_con_propuesta(db_session, solicitante, importador_id, asesor_asignado_id=None):
    cotizacion = Cotizacion(
        id=str(uuid4()), solicitante_id=solicitante.id, importador_id=importador_id,
        modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Navegación",
        descripcion_cliente="Descripción de prueba para el flujo de navegación cruzada",
        linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=100,
        precio_objetivo_usd=3.0, incoterm="FOB", estado=EstadoCotizacion.propuestas_recibidas,
        asesor_asignado_id=asesor_asignado_id
    )
    db_session.add(cotizacion)

    propuesta = Propuesta(
        id=str(uuid4()), cotizacion_id=cotizacion.id, importador_id=importador_id,
        precio_ofrecido_usd=3.2, tiempo_estimado_entrega="30 días", incoterm="FOB",
        estado=EstadoPropuesta.pendiente, creado_por_usuario_id=asesor_asignado_id
    )
    db_session.add(propuesta)
    db_session.commit()
    db_session.refresh(cotizacion)
    db_session.refresh(propuesta)
    return cotizacion, propuesta


class TestContactoAsignadoEnCotizacion:
    def test_sin_propuesta_contacto_es_null(self, client, db_session, solicitante, empresa):
        importador, _dueño = empresa
        cotizacion = Cotizacion(
            id=str(uuid4()), solicitante_id=solicitante.id, importador_id=importador.id,
            modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Sin Propuesta",
            descripcion_cliente="Descripción de prueba sin propuesta aún",
            linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=100,
            precio_objetivo_usd=3.0, incoterm="FOB", estado=EstadoCotizacion.dirigida
        )
        db_session.add(cotizacion)
        db_session.commit()

        response = client.get(f"/cotizaciones/{cotizacion.id}", headers=auth_headers_for(solicitante))
        assert response.status_code == 200
        data = response.json()
        assert data["contacto_asignado"] is None
        assert data["conversacion_id"] is None

    def test_con_propuesta_pendiente_contacto_es_el_asesor(self, db_session, client, solicitante, empresa, asesor):
        importador, _dueño = empresa
        cotizacion, _propuesta = _crear_cotizacion_con_propuesta(db_session, solicitante, importador.id, asesor_asignado_id=asesor.id)

        response = client.get(f"/cotizaciones/{cotizacion.id}", headers=auth_headers_for(solicitante))
        assert response.status_code == 200
        data = response.json()
        assert data["contacto_asignado"] is not None
        assert data["contacto_asignado"]["usuario_id"] == str(asesor.id)
        assert data["contacto_asignado"]["nombre"] == "Asesor Nav"
        assert data["contacto_asignado"]["whatsapp"] == "+573001112233"

    def test_tras_doble_aceptacion_el_contacto_sigue_siendo_el_asesor(self, client, db_session, solicitante, empresa, asesor):
        """Cerrar la orden no le cambia el interlocutor al cliente.

        El dueño confirma, pero quien negoció —y quien va a hacer el
        seguimiento del embarque— es el asesor: mandarlo a hablar con otra
        persona justo al cerrar el trato le hacía repetir todo el contexto.
        """
        importador, dueño = empresa
        cotizacion, propuesta = _crear_cotizacion_con_propuesta(db_session, solicitante, importador.id, asesor_asignado_id=asesor.id)

        client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(solicitante))
        client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(dueño))

        response = client.get(f"/cotizaciones/{cotizacion.id}", headers=auth_headers_for(solicitante))
        assert response.status_code == 200
        data = response.json()
        assert data["contacto_asignado"]["usuario_id"] == str(asesor.id)
        assert data["conversacion_id"] is not None


class TestContactoAsesorEnPropuesta:
    def test_propuesta_expone_contacto_de_quien_la_redacto(self, client, db_session, solicitante, empresa, asesor):
        importador, _dueño = empresa
        cotizacion, _propuesta = _crear_cotizacion_con_propuesta(db_session, solicitante, importador.id, asesor_asignado_id=asesor.id)

        response = client.get(f"/cotizaciones/{cotizacion.id}/propuestas", headers=auth_headers_for(solicitante))
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["contacto_asesor"]["usuario_id"] == str(asesor.id)


class TestConversacionIdEnOrden:
    def test_orden_expone_conversacion_id_tras_doble_aceptacion(self, client, db_session, solicitante, empresa, asesor):
        importador, dueño = empresa
        cotizacion, propuesta = _crear_cotizacion_con_propuesta(db_session, solicitante, importador.id, asesor_asignado_id=asesor.id)

        client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(solicitante))
        client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(dueño))

        orden = db_session.query(Orden).filter(Orden.cotizacion_id == cotizacion.id).first()
        assert orden is not None

        response = client.get(f"/ordenes/{orden.id}", headers=auth_headers_for(solicitante))
        assert response.status_code == 200
        data = response.json()
        assert data["conversacion_id"] is not None
        assert data["cotizacion_id"] == cotizacion.id
