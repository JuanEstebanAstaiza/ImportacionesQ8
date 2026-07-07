"""Tests del chat de negociación (Fase 4): creación de conversación al aceptar
una propuesta, mensajes REST, autorización de conversación (IDOR) y WebSocket."""
import pytest
from uuid import uuid4
from datetime import datetime
from fastapi import status

from models.usuario import Usuario
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.propuesta import Propuesta, EstadoPropuesta
from models.chat import ConversacionChat, MensajeChat
from utils.security import hash_password, create_access_token
from conftest import crear_empresa_importadora, auth_headers_for


@pytest.fixture()
def solicitante(db_session):
    user = Usuario(
        id=str(uuid4()),
        email="solicitante_chat@example.com",
        password_hash=hash_password("123456789"),
        rol="solicitante",
        perfil_completo=True,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def otro_solicitante(db_session):
    user = Usuario(
        id=str(uuid4()),
        email="otro_solicitante_chat@example.com",
        password_hash=hash_password("123456789"),
        rol="solicitante",
        perfil_completo=True,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def empresa(db_session):
    return crear_empresa_importadora(db_session, nombre_empresa="Empresa Chat", email_dueño="dueño_chat@example.com")


@pytest.fixture()
def cotizacion_aceptada_con_trabajador(db_session, solicitante, empresa):
    """Cotización dirigida, reclamada por un trabajador y con propuesta aceptada:
    dispara la creación automática de la conversación de chat con ESE trabajador."""
    importador, dueño = empresa
    trabajador = Usuario(
        id=str(uuid4()), email="trab_chat@example.com", password_hash=hash_password("123456789"),
        rol="trabajador", importador_id=importador.id, activo=True, fecha_creacion=datetime.utcnow()
    )
    db_session.add(trabajador)

    cotizacion = Cotizacion(
        id=str(uuid4()), solicitante_id=solicitante.id, importador_id=importador.id,
        modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Chat",
        descripcion_cliente="Descripción de prueba para el flujo de chat de negociación",
        linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=100,
        precio_objetivo_usd=1.0, incoterm="FOB", estado=EstadoCotizacion.propuestas_recibidas,
        trabajador_asignado_id=trabajador.id
    )
    db_session.add(cotizacion)

    propuesta = Propuesta(
        id=str(uuid4()), cotizacion_id=cotizacion.id, importador_id=importador.id,
        precio_ofrecido_usd=0.9, tiempo_estimado_entrega="30 días", incoterm="FOB",
        estado=EstadoPropuesta.pendiente
    )
    db_session.add(propuesta)
    db_session.commit()

    return cotizacion, trabajador


class TestCreacionConversacionAlAceptar:
    def test_aceptar_propuesta_crea_conversacion_con_trabajador_asignado(
        self, client, db_session, solicitante, empresa, cotizacion_aceptada_con_trabajador
    ):
        importador, dueño = empresa
        cotizacion, trabajador = cotizacion_aceptada_con_trabajador
        token = create_access_token(str(solicitante.id), "solicitante")

        response = client.put(
            f"/cotizaciones/{cotizacion.id}/propuestas/aceptar",
            json={"importador_id": str(importador.id)},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == status.HTTP_200_OK

        conversacion = db_session.query(ConversacionChat).filter(
            ConversacionChat.cotizacion_id == str(cotizacion.id)
        ).first()
        assert conversacion is not None
        assert conversacion.importador_usuario_id == str(trabajador.id)
        assert conversacion.solicitante_id == str(solicitante.id)

    def test_aceptar_propuesta_sin_trabajador_asigna_al_dueño(self, client, db_session, solicitante, empresa):
        importador, dueño = empresa
        cotizacion = Cotizacion(
            id=str(uuid4()), solicitante_id=solicitante.id, importador_id=importador.id,
            modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Sin Trabajador",
            descripcion_cliente="Descripción de prueba sin trabajador asignado a la cotización",
            linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=100,
            precio_objetivo_usd=1.0, incoterm="FOB", estado=EstadoCotizacion.propuestas_recibidas
        )
        db_session.add(cotizacion)
        propuesta = Propuesta(
            id=str(uuid4()), cotizacion_id=cotizacion.id, importador_id=importador.id,
            precio_ofrecido_usd=0.9, tiempo_estimado_entrega="30 días", incoterm="FOB",
            estado=EstadoPropuesta.pendiente
        )
        db_session.add(propuesta)
        db_session.commit()

        token = create_access_token(str(solicitante.id), "solicitante")
        response = client.put(
            f"/cotizaciones/{cotizacion.id}/propuestas/aceptar",
            json={"importador_id": str(importador.id)},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == status.HTTP_200_OK

        conversacion = db_session.query(ConversacionChat).filter(
            ConversacionChat.cotizacion_id == str(cotizacion.id)
        ).first()
        assert conversacion is not None
        assert conversacion.importador_usuario_id == str(dueño.id)


class TestMensajesRest:
    def test_solicitante_puede_leer_y_enviar_mensajes(self, client, db_session, solicitante, empresa):
        importador, dueño = empresa
        conversacion = ConversacionChat(
            id=str(uuid4()), cotizacion_id=str(uuid4()), solicitante_id=solicitante.id,
            importador_usuario_id=dueño.id
        )
        db_session.add(conversacion)
        db_session.commit()

        token = create_access_token(str(solicitante.id), "solicitante")
        headers = {"Authorization": f"Bearer {token}"}

        response = client.post(
            f"/chat/conversaciones/{conversacion.id}/mensajes",
            json={"contenido": "Hola, ¿cuál es el costo final?"},
            headers=headers
        )
        assert response.status_code == status.HTTP_201_CREATED

        response_get = client.get(f"/chat/conversaciones/{conversacion.id}/mensajes", headers=headers)
        assert response_get.status_code == status.HTTP_200_OK
        assert len(response_get.json()) == 1

    def test_usuario_de_otra_conversacion_no_puede_leer_mensajes(self, client, db_session, solicitante, otro_solicitante, empresa):
        importador, dueño = empresa
        conversacion = ConversacionChat(
            id=str(uuid4()), cotizacion_id=str(uuid4()), solicitante_id=solicitante.id,
            importador_usuario_id=dueño.id
        )
        db_session.add(conversacion)
        db_session.commit()

        token_ajeno = create_access_token(str(otro_solicitante.id), "solicitante")
        response = client.get(
            f"/chat/conversaciones/{conversacion.id}/mensajes",
            headers={"Authorization": f"Bearer {token_ajeno}"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_usuario_de_otra_empresa_no_puede_escribir(self, client, db_session, solicitante, empresa):
        importador, dueño = empresa
        otro_importador, otro_dueño = crear_empresa_importadora(
            db_session, nombre_empresa="Empresa Chat Ajena", email_dueño="ajena_chat@example.com"
        )
        conversacion = ConversacionChat(
            id=str(uuid4()), cotizacion_id=str(uuid4()), solicitante_id=solicitante.id,
            importador_usuario_id=dueño.id
        )
        db_session.add(conversacion)
        db_session.commit()

        response = client.post(
            f"/chat/conversaciones/{conversacion.id}/mensajes",
            json={"contenido": "Intento de intrusión"},
            headers=auth_headers_for(otro_dueño)
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_conversacion_no_existente_devuelve_404(self, client, solicitante):
        token = create_access_token(str(solicitante.id), "solicitante")
        response = client.get(f"/chat/conversaciones/{uuid4()}/mensajes", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_listar_mis_conversaciones(self, client, db_session, solicitante, empresa):
        importador, dueño = empresa
        conversacion = ConversacionChat(
            id=str(uuid4()), cotizacion_id=str(uuid4()), solicitante_id=solicitante.id,
            importador_usuario_id=dueño.id
        )
        db_session.add(conversacion)
        db_session.commit()

        token = create_access_token(str(solicitante.id), "solicitante")
        response = client.get("/chat/conversaciones", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()) == 1


class TestWebSocketChat:
    def test_websocket_sin_token_es_rechazado(self, client, db_session, solicitante, empresa):
        importador, dueño = empresa
        conversacion = ConversacionChat(
            id=str(uuid4()), cotizacion_id=str(uuid4()), solicitante_id=solicitante.id,
            importador_usuario_id=dueño.id
        )
        db_session.add(conversacion)
        db_session.commit()

        with pytest.raises(Exception):
            with client.websocket_connect(f"/ws/chat/{conversacion.id}"):
                pass

    def test_websocket_con_token_valido_intercambia_mensajes(self, client, db_session, monkeypatch, solicitante, empresa):
        """Sin Redis disponible, el WebSocket degrada a eco directo al propio emisor
        (confirmación de envío), en vez de esperar el reenvío vía Pub/Sub."""
        importador, dueño = empresa
        conversacion = ConversacionChat(
            id=str(uuid4()), cotizacion_id=str(uuid4()), solicitante_id=solicitante.id,
            importador_usuario_id=dueño.id
        )
        db_session.add(conversacion)
        db_session.commit()

        import config
        original_redis = config.redis_client
        config.redis_client = None

        try:
            token = create_access_token(str(solicitante.id), "solicitante")
            with client.websocket_connect(f"/ws/chat/{conversacion.id}?token={token}") as websocket:
                websocket.send_json({"contenido": "Hola por WebSocket", "tipo": "texto"})
                data = websocket.receive_json()
                assert data["contenido"] == "Hola por WebSocket"
                assert data["remitente_id"] == str(solicitante.id)
        finally:
            config.redis_client = original_redis

        mensaje_guardado = db_session.query(MensajeChat).filter(
            MensajeChat.conversacion_id == str(conversacion.id)
        ).first()
        assert mensaje_guardado is not None
        assert mensaje_guardado.contenido == "Hola por WebSocket"

    def test_websocket_usuario_no_autorizado_es_rechazado(self, client, db_session, solicitante, otro_solicitante, empresa):
        importador, dueño = empresa
        conversacion = ConversacionChat(
            id=str(uuid4()), cotizacion_id=str(uuid4()), solicitante_id=solicitante.id,
            importador_usuario_id=dueño.id
        )
        db_session.add(conversacion)
        db_session.commit()

        token_ajeno = create_access_token(str(otro_solicitante.id), "solicitante")
        with pytest.raises(Exception):
            with client.websocket_connect(f"/ws/chat/{conversacion.id}?token={token_ajeno}"):
                pass
