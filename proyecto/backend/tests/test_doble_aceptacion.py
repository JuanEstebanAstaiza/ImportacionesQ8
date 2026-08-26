"""Semana 4 - Fase 5: doble aceptación mutua de propuestas.

Cubre: `POST /propuestas/{id}/pre-aceptar` no finaliza con un solo lado, ambos
lados finalizan y crean la Orden automáticamente (sin pago), el hilo de chat
pasa a colgar de la orden con un mensaje de sistema y sigue atendido por el
asesor que negoció, las demás propuestas quedan rechazadas, y la reversión de
la pre-aceptación mientras el otro lado no haya confirmado.

El lado "empresa" solo lo confirma la cuenta dueña: el asesor negocia y su chat
es la evidencia que el dueño revisa antes de cerrar.
"""
import pytest
from uuid import uuid4
from datetime import datetime

from models.usuario import Usuario
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.propuesta import Propuesta, EstadoPropuesta
from models.orden import Orden
from models.chat import ConversacionChat, MensajeChat, TipoMensajeChat
from utils.security import hash_password
from conftest import crear_empresa_importadora, auth_headers_for


@pytest.fixture()
def solicitante(db_session):
    user = Usuario(
        id=str(uuid4()), email="solicitante_doble@example.com", password_hash=hash_password("123456789"),
        rol="solicitante", perfil_completo=True, creditos_balance=1000.0, fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def empresa(db_session):
    return crear_empresa_importadora(db_session, nombre_empresa="Empresa Doble Aceptación", email_dueño="dueño_doble@example.com")


@pytest.fixture()
def asesor(db_session, empresa):
    importador, _dueño = empresa
    user = Usuario(
        id=str(uuid4()), email="asesor_doble@example.com", password_hash=hash_password("123456789"),
        rol="asesor", importador_id=importador.id, activo=True, fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _crear_cotizacion_con_propuesta(db_session, solicitante, importador_id, asesor_asignado_id=None, precio=3.2):
    cotizacion = Cotizacion(
        id=str(uuid4()), solicitante_id=solicitante.id, importador_id=importador_id,
        modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Doble Aceptación",
        descripcion_cliente="Descripción de prueba para el flujo de doble aceptación mutua",
        linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=100,
        precio_objetivo_usd=3.0, incoterm="FOB", estado=EstadoCotizacion.propuestas_recibidas,
        asesor_asignado_id=asesor_asignado_id
    )
    db_session.add(cotizacion)

    propuesta = Propuesta(
        id=str(uuid4()), cotizacion_id=cotizacion.id, importador_id=importador_id,
        precio_ofrecido_usd=precio, tiempo_estimado_entrega="30 días", incoterm="FOB",
        estado=EstadoPropuesta.pendiente
    )
    db_session.add(propuesta)
    db_session.commit()
    db_session.refresh(cotizacion)
    db_session.refresh(propuesta)
    return cotizacion, propuesta


class TestUnSoloLadoNoFinaliza:
    def test_solicitante_preacepta_no_finaliza(self, client, db_session, solicitante, empresa):
        importador, _dueño = empresa
        cotizacion, propuesta = _crear_cotizacion_con_propuesta(db_session, solicitante, importador.id)

        response = client.post(
            f"/propuestas/{propuesta.id}/pre-aceptar",
            json={"aceptar": True},
            headers=auth_headers_for(solicitante)
        )
        assert response.status_code == 200
        data = response.json()
        assert data["estado"] == "pendiente"
        assert data["preaceptada_por_solicitante"] is True
        assert data["preaceptada_por_empresa"] is False

        assert db_session.query(Orden).filter(Orden.cotizacion_id == cotizacion.id).first() is None

    def test_dueño_preacepta_no_finaliza(self, client, db_session, solicitante, empresa):
        importador, dueño = empresa
        _cotizacion, propuesta = _crear_cotizacion_con_propuesta(db_session, solicitante, importador.id)

        response = client.post(
            f"/propuestas/{propuesta.id}/pre-aceptar",
            json={"aceptar": True},
            headers=auth_headers_for(dueño)
        )
        assert response.status_code == 200
        data = response.json()
        assert data["preaceptada_por_solicitante"] is False
        assert data["preaceptada_por_empresa"] is True


class TestAmbosLadosFinalizan:
    def test_dueño_finaliza_crea_orden_y_el_chat_cuelga_de_ella(self, client, db_session, solicitante, empresa):
        """Sin asesor asignado el interlocutor sigue siendo el dueño."""
        importador, dueño = empresa
        cotizacion, propuesta = _crear_cotizacion_con_propuesta(db_session, solicitante, importador.id)

        client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(solicitante))
        response = client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(dueño))

        assert response.status_code == 200
        assert response.json()["estado"] == "aceptada"

        db_session.refresh(cotizacion)
        assert cotizacion.estado == EstadoCotizacion.orden_activa.value
        assert cotizacion.importador_id == importador.id

        orden = db_session.query(Orden).filter(Orden.cotizacion_id == cotizacion.id).first()
        assert orden is not None
        assert orden.precio_acordado_usd == propuesta.precio_ofrecido_usd
        assert orden.solicitante_id == solicitante.id
        assert orden.importador_id == importador.id

        conversacion = db_session.query(ConversacionChat).filter(ConversacionChat.cotizacion_id == cotizacion.id).first()
        assert conversacion is not None
        assert conversacion.importador_usuario_id == str(dueño.id)
        assert conversacion.orden_id == orden.id

        mensaje_sistema = db_session.query(MensajeChat).filter(
            MensajeChat.conversacion_id == conversacion.id,
            MensajeChat.tipo == TipoMensajeChat.sistema.value
        ).first()
        assert mensaje_sistema is not None

    def test_asesor_asignado_no_puede_finalizar_por_la_empresa(self, client, db_session, solicitante, empresa, asesor):
        """El asesor negocia; comprometer a la empresa es de la cuenta dueña.

        El chat que dejó el asesor es justo la evidencia que el dueño revisa
        antes de confirmar, así que dejarle cerrar a él se saltaba el control.
        """
        importador, _dueño = empresa
        _cotizacion, propuesta = _crear_cotizacion_con_propuesta(
            db_session, solicitante, importador.id, asesor_asignado_id=asesor.id
        )

        client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(solicitante))
        response = client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(asesor))

        assert response.status_code == 403
        assert "cuenta dueña" in response.json()["detail"]

        db_session.refresh(propuesta)
        assert propuesta.estado == EstadoPropuesta.pendiente.value
        assert propuesta.preaceptada_por_empresa is False

    def test_el_chat_sigue_con_el_asesor_tras_cerrar_la_orden(self, client, db_session, solicitante, empresa, asesor):
        """Al crearse la orden el hilo cambia de asunto, no de interlocutor."""
        importador, dueño = empresa
        cotizacion, propuesta = _crear_cotizacion_con_propuesta(
            db_session, solicitante, importador.id, asesor_asignado_id=asesor.id
        )

        client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(solicitante))
        response = client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(dueño))

        assert response.status_code == 200
        assert response.json()["estado"] == "aceptada"

        conversacion = db_session.query(ConversacionChat).filter(ConversacionChat.cotizacion_id == cotizacion.id).first()
        assert conversacion is not None
        assert conversacion.importador_usuario_id == str(asesor.id)
        # El mismo hilo pasa a colgar de la orden: es el de seguimiento.
        assert conversacion.orden_id is not None

    def test_otras_propuestas_quedan_rechazadas(self, client, db_session, solicitante, empresa):
        importador, dueño = empresa
        cotizacion, propuesta = _crear_cotizacion_con_propuesta(db_session, solicitante, importador.id)

        otra_empresa, _otro_dueño = crear_empresa_importadora(db_session, nombre_empresa="Otra Empresa Competidora", email_dueño="otro_dueño_doble@example.com")
        otra_propuesta = Propuesta(
            id=str(uuid4()), cotizacion_id=cotizacion.id, importador_id=otra_empresa.id,
            precio_ofrecido_usd=2.9, tiempo_estimado_entrega="25 días", incoterm="FOB",
            estado=EstadoPropuesta.pendiente
        )
        db_session.add(otra_propuesta)
        db_session.commit()
        db_session.refresh(otra_propuesta)

        client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(solicitante))
        client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(dueño))

        db_session.refresh(otra_propuesta)
        assert otra_propuesta.estado == EstadoPropuesta.rechazada.value

    def test_no_se_puede_modificar_tras_finalizar(self, client, db_session, solicitante, empresa):
        importador, dueño = empresa
        _cotizacion, propuesta = _crear_cotizacion_con_propuesta(db_session, solicitante, importador.id)

        client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(solicitante))
        client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(dueño))

        response = client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": False}, headers=auth_headers_for(dueño))
        assert response.status_code == 400


class TestReversionPreaceptacion:
    def test_solicitante_puede_revertir_antes_de_finalizar(self, client, db_session, solicitante, empresa):
        _importador, _dueño = empresa
        cotizacion, propuesta = _crear_cotizacion_con_propuesta(db_session, solicitante, _importador.id)

        client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(solicitante))
        response = client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": False}, headers=auth_headers_for(solicitante))

        assert response.status_code == 200
        assert response.json()["preaceptada_por_solicitante"] is False
        assert response.json()["estado"] == "pendiente"


class TestAutorizacion:
    def test_empresa_ajena_no_autorizada(self, client, db_session, solicitante, empresa):
        importador, _dueño = empresa
        _cotizacion, propuesta = _crear_cotizacion_con_propuesta(db_session, solicitante, importador.id)

        otra_empresa, otro_dueño = crear_empresa_importadora(db_session, nombre_empresa="Empresa Ajena", email_dueño="ajena_doble@example.com")

        response = client.post(
            f"/propuestas/{propuesta.id}/pre-aceptar",
            json={"aceptar": True},
            headers=auth_headers_for(otro_dueño)
        )
        assert response.status_code == 403

    def test_solicitante_ajeno_no_autorizado(self, client, db_session, solicitante, empresa):
        importador, _dueño = empresa
        _cotizacion, propuesta = _crear_cotizacion_con_propuesta(db_session, solicitante, importador.id)

        otro_solicitante = Usuario(
            id=str(uuid4()), email="otro_solicitante_doble@example.com", password_hash=hash_password("123456789"),
            rol="solicitante", perfil_completo=True, fecha_creacion=datetime.utcnow()
        )
        db_session.add(otro_solicitante)
        db_session.commit()

        response = client.post(
            f"/propuestas/{propuesta.id}/pre-aceptar",
            json={"aceptar": True},
            headers=auth_headers_for(otro_solicitante)
        )
        assert response.status_code == 403

    def test_asesor_no_asignado_no_autorizado(self, client, db_session, solicitante, empresa):
        importador, _dueño = empresa
        _cotizacion, propuesta = _crear_cotizacion_con_propuesta(db_session, solicitante, importador.id)

        otro_asesor = Usuario(
            id=str(uuid4()), email="otro_asesor_doble@example.com", password_hash=hash_password("123456789"),
            rol="asesor", importador_id=importador.id, activo=True, fecha_creacion=datetime.utcnow()
        )
        db_session.add(otro_asesor)
        db_session.commit()

        response = client.post(
            f"/propuestas/{propuesta.id}/pre-aceptar",
            json={"aceptar": True},
            headers=auth_headers_for(otro_asesor)
        )
        assert response.status_code == 403

    def test_propuesta_en_borrador_no_se_puede_preaceptar(self, client, db_session, solicitante, empresa):
        importador, dueño = empresa
        cotizacion, propuesta = _crear_cotizacion_con_propuesta(db_session, solicitante, importador.id)
        propuesta.estado = EstadoPropuesta.borrador
        db_session.commit()

        response = client.post(
            f"/propuestas/{propuesta.id}/pre-aceptar",
            json={"aceptar": True},
            headers=auth_headers_for(dueño)
        )
        assert response.status_code == 400
