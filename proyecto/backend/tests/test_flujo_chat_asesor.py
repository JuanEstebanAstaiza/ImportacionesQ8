"""Ciclo de vida del chat: reclamo → negociación → orden → seguimiento.

El recorrido que cubre este archivo:

1. El asesor reclama la cotización y el canal con el cliente queda abierto solo
   con eso, sin que ninguna de las dos partes tenga que pedirlo.
2. Negocian por ese hilo; el cliente acepta.
3. La confirmación final la da la cuenta dueña, que revisa el chat del asesor.
4. Creada la orden, el hilo sigue con el asesor y pasa a ser el del embarque.
5. La empresa coordina al asesor por un canal interno que el cliente no ve, y
   el asesor mueve el estado de la orden.
"""
import pytest
from uuid import uuid4
from datetime import datetime

from models.chat import ConversacionChat, MensajeChat, TipoConversacion, TipoMensajeChat
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.orden import EstadoOrden, Orden
from models.propuesta import EstadoPropuesta, Propuesta
from models.usuario import Usuario
from utils.security import hash_password
from conftest import auth_headers_for, crear_empresa_importadora


@pytest.fixture()
def solicitante(db_session):
    user = Usuario(
        id=str(uuid4()), email="solicitante_flujochat@example.com",
        password_hash=hash_password("123456789"), rol="solicitante",
        nombre="Cliente Flujo", perfil_completo=True, fecha_creacion=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def empresa(db_session):
    return crear_empresa_importadora(
        db_session,
        nombre_empresa="Empresa Flujo Chat",
        email_dueño="dueño_flujochat@example.com",
    )


@pytest.fixture()
def asesor(db_session, empresa):
    importador, _dueño = empresa
    user = Usuario(
        id=str(uuid4()), email="asesor_flujochat@example.com",
        password_hash=hash_password("123456789"), rol="asesor",
        nombre="Asesor Flujo", importador_id=importador.id, activo=True,
        fecha_creacion=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def otro_asesor(db_session, empresa):
    importador, _dueño = empresa
    user = Usuario(
        id=str(uuid4()), email="asesor2_flujochat@example.com",
        password_hash=hash_password("123456789"), rol="asesor",
        nombre="Asesor Ajeno", importador_id=importador.id, activo=True,
        fecha_creacion=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _crear_cotizacion(db_session, solicitante, importador_id, *, asesor_asignado_id=None):
    cotizacion = Cotizacion(
        id=str(uuid4()), solicitante_id=solicitante.id, importador_id=importador_id,
        modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Flujo Chat",
        descripcion_cliente="Descripción suficientemente larga para el flujo de chat",
        linea_producto="Textil", tipo_calidad="estandar", cantidad_minima=100,
        precio_objetivo_usd=3.0, incoterm="FOB", estado=EstadoCotizacion.dirigida,
        asesor_asignado_id=asesor_asignado_id,
    )
    db_session.add(cotizacion)
    db_session.commit()
    db_session.refresh(cotizacion)
    return cotizacion


def _con_propuesta(db_session, cotizacion, importador_id):
    cotizacion.estado = EstadoCotizacion.propuestas_recibidas
    propuesta = Propuesta(
        id=str(uuid4()), cotizacion_id=cotizacion.id, importador_id=importador_id,
        precio_ofrecido_usd=3.1, tiempo_estimado_entrega="30 días", incoterm="FOB",
        estado=EstadoPropuesta.pendiente,
    )
    db_session.add(propuesta)
    db_session.commit()
    db_session.refresh(propuesta)
    return propuesta


class TestChatAlReclamar:
    def test_reclamar_abre_el_canal_con_el_cliente(self, client, db_session, solicitante, empresa, asesor):
        importador, _dueño = empresa
        cotizacion = _crear_cotizacion(db_session, solicitante, importador.id)

        response = client.post(f"/cotizaciones/{cotizacion.id}/reclamar", headers=auth_headers_for(asesor))
        assert response.status_code == 200

        conversacion = db_session.query(ConversacionChat).filter(
            ConversacionChat.cotizacion_id == cotizacion.id
        ).first()
        assert conversacion is not None
        assert conversacion.tipo == TipoConversacion.negociacion.value
        assert conversacion.importador_usuario_id == str(asesor.id)
        assert conversacion.solicitante_id == str(solicitante.id)

    def test_el_cliente_ve_el_hilo_sin_haber_hecho_nada(self, client, db_session, solicitante, empresa, asesor):
        importador, _dueño = empresa
        cotizacion = _crear_cotizacion(db_session, solicitante, importador.id)
        client.post(f"/cotizaciones/{cotizacion.id}/reclamar", headers=auth_headers_for(asesor))

        response = client.get("/chat/conversaciones", headers=auth_headers_for(solicitante))
        assert response.status_code == 200
        hilos = response.json()
        assert len(hilos) == 1
        assert hilos[0]["cotizacion_id"] == str(cotizacion.id)
        # Quien pregunta es el cliente, así que la contraparte es el asesor.
        assert hilos[0]["contraparte_nombre"] == "Asesor Flujo"

    def test_deja_un_mensaje_de_sistema_explicando_quien_atiende(self, client, db_session, solicitante, empresa, asesor):
        importador, _dueño = empresa
        cotizacion = _crear_cotizacion(db_session, solicitante, importador.id)
        client.post(f"/cotizaciones/{cotizacion.id}/reclamar", headers=auth_headers_for(asesor))

        conversacion = db_session.query(ConversacionChat).filter(
            ConversacionChat.cotizacion_id == cotizacion.id
        ).first()
        mensaje = db_session.query(MensajeChat).filter(
            MensajeChat.conversacion_id == conversacion.id,
            MensajeChat.tipo == TipoMensajeChat.sistema.value,
        ).first()
        assert mensaje is not None
        assert "Asesor Flujo" in mensaje.contenido
        assert "Empresa Flujo Chat" in mensaje.contenido

    def test_reclamar_no_duplica_un_hilo_existente(self, client, db_session, solicitante, empresa, asesor):
        """El hilo puede existir ya si el dueño respondió antes por su cuenta."""
        importador, dueño = empresa
        cotizacion = _crear_cotizacion(db_session, solicitante, importador.id)
        db_session.add(ConversacionChat(
            id=str(uuid4()), tipo=TipoConversacion.negociacion.value,
            cotizacion_id=cotizacion.id, solicitante_id=solicitante.id,
            importador_usuario_id=str(dueño.id),
        ))
        db_session.commit()

        response = client.post(f"/cotizaciones/{cotizacion.id}/reclamar", headers=auth_headers_for(asesor))
        assert response.status_code == 200

        hilos = db_session.query(ConversacionChat).filter(
            ConversacionChat.cotizacion_id == cotizacion.id
        ).all()
        assert len(hilos) == 1


class TestSeguimientoTrasLaOrden:
    def test_el_hilo_pasa_a_ser_el_del_embarque(self, client, db_session, solicitante, empresa, asesor):
        importador, dueño = empresa
        cotizacion = _crear_cotizacion(db_session, solicitante, importador.id)
        client.post(f"/cotizaciones/{cotizacion.id}/reclamar", headers=auth_headers_for(asesor))
        propuesta = _con_propuesta(db_session, cotizacion, importador.id)

        client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(solicitante))
        client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(dueño))

        orden = db_session.query(Orden).filter(Orden.cotizacion_id == cotizacion.id).first()
        assert orden is not None

        conversacion = db_session.query(ConversacionChat).filter(
            ConversacionChat.cotizacion_id == cotizacion.id
        ).first()
        # Mismo hilo, mismo interlocutor, nuevo asunto.
        assert conversacion.orden_id == orden.id
        assert conversacion.importador_usuario_id == str(asesor.id)

    def test_el_asesor_asignado_mueve_el_estado_de_la_orden(self, client, db_session, solicitante, empresa, asesor):
        importador, dueño = empresa
        cotizacion = _crear_cotizacion(db_session, solicitante, importador.id)
        client.post(f"/cotizaciones/{cotizacion.id}/reclamar", headers=auth_headers_for(asesor))
        propuesta = _con_propuesta(db_session, cotizacion, importador.id)
        client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(solicitante))
        client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(dueño))

        orden = db_session.query(Orden).filter(Orden.cotizacion_id == cotizacion.id).first()

        response = client.put(
            f"/ordenes/{orden.id}/estado",
            json={"estado": EstadoOrden.en_produccion.value},
            headers=auth_headers_for(asesor),
        )
        assert response.status_code == 200

        db_session.refresh(orden)
        assert orden.estado == EstadoOrden.en_produccion.value

    def test_el_cambio_de_estado_queda_anotado_en_el_chat(self, client, db_session, solicitante, empresa, asesor):
        importador, dueño = empresa
        cotizacion = _crear_cotizacion(db_session, solicitante, importador.id)
        client.post(f"/cotizaciones/{cotizacion.id}/reclamar", headers=auth_headers_for(asesor))
        propuesta = _con_propuesta(db_session, cotizacion, importador.id)
        client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(solicitante))
        client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(dueño))

        orden = db_session.query(Orden).filter(Orden.cotizacion_id == cotizacion.id).first()
        client.put(
            f"/ordenes/{orden.id}/estado",
            json={"estado": EstadoOrden.en_produccion.value},
            headers=auth_headers_for(asesor),
        )

        conversacion = db_session.query(ConversacionChat).filter(
            ConversacionChat.cotizacion_id == cotizacion.id
        ).first()
        mensajes = db_session.query(MensajeChat).filter(
            MensajeChat.conversacion_id == conversacion.id,
            MensajeChat.tipo == TipoMensajeChat.sistema.value,
        ).all()
        # El cliente lee "en producción", no "en_produccion".
        assert any("en producción" in m.contenido for m in mensajes)

    def test_un_asesor_ajeno_a_la_orden_no_la_mueve(self, client, db_session, solicitante, empresa, asesor, otro_asesor):
        importador, dueño = empresa
        cotizacion = _crear_cotizacion(db_session, solicitante, importador.id)
        client.post(f"/cotizaciones/{cotizacion.id}/reclamar", headers=auth_headers_for(asesor))
        propuesta = _con_propuesta(db_session, cotizacion, importador.id)
        client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(solicitante))
        client.post(f"/propuestas/{propuesta.id}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(dueño))

        orden = db_session.query(Orden).filter(Orden.cotizacion_id == cotizacion.id).first()

        response = client.put(
            f"/ordenes/{orden.id}/estado",
            json={"estado": EstadoOrden.en_produccion.value},
            headers=auth_headers_for(otro_asesor),
        )
        assert response.status_code == 403


class TestCanalInterno:
    def test_el_dueño_abre_el_canal_con_su_asesor(self, client, db_session, empresa, asesor):
        _importador, dueño = empresa

        response = client.post(
            "/chat/interno",
            json={"asesor_id": str(asesor.id), "mensaje_inicial": "Marca la orden como despachada mañana."},
            headers=auth_headers_for(dueño),
        )
        assert response.status_code == 201
        data = response.json()
        assert data["tipo"] == "interna"
        assert data["cotizacion_id"] is None
        assert data["contraparte_nombre"] == "Asesor Flujo"

    def test_reabrirlo_reutiliza_el_mismo_hilo(self, client, db_session, empresa, asesor):
        _importador, dueño = empresa

        primero = client.post("/chat/interno", json={"asesor_id": str(asesor.id)}, headers=auth_headers_for(dueño))
        segundo = client.post("/chat/interno", json={"asesor_id": str(asesor.id)}, headers=auth_headers_for(dueño))

        assert primero.json()["id"] == segundo.json()["id"]
        assert db_session.query(ConversacionChat).filter(
            ConversacionChat.tipo == TipoConversacion.interna.value
        ).count() == 1

    def test_el_asesor_abre_el_suyo_sin_indicar_nada(self, client, db_session, empresa, asesor):
        _importador, _dueño = empresa

        response = client.post("/chat/interno", json={}, headers=auth_headers_for(asesor))
        assert response.status_code == 201
        assert response.json()["importador_usuario_id"] == str(asesor.id)
        assert response.json()["contraparte_nombre"] == "Empresa Flujo Chat"

    def test_el_asesor_no_puede_abrir_el_de_un_compañero(self, client, db_session, empresa, asesor, otro_asesor):
        """Indicar otro asesor no debe colarlo en la coordinación ajena."""
        _importador, _dueño = empresa

        response = client.post(
            "/chat/interno",
            json={"asesor_id": str(otro_asesor.id)},
            headers=auth_headers_for(asesor),
        )
        assert response.status_code == 201
        # Se ignora el asesor pedido: el hilo devuelto es el suyo.
        assert response.json()["importador_usuario_id"] == str(asesor.id)

    def test_el_cliente_no_ve_ni_lee_el_canal_interno(self, client, db_session, solicitante, empresa, asesor):
        _importador, dueño = empresa
        interno = client.post(
            "/chat/interno",
            json={"asesor_id": str(asesor.id), "mensaje_inicial": "Coordinación interna"},
            headers=auth_headers_for(dueño),
        ).json()

        listado = client.get("/chat/conversaciones", headers=auth_headers_for(solicitante))
        assert listado.status_code == 200
        assert all(hilo["id"] != interno["id"] for hilo in listado.json())

        directo = client.get(
            f"/chat/conversaciones/{interno['id']}/mensajes",
            headers=auth_headers_for(solicitante),
        )
        assert directo.status_code == 403

    def test_un_asesor_de_otra_empresa_no_lo_lee(self, client, db_session, empresa, asesor):
        _importador, dueño = empresa
        interno = client.post(
            "/chat/interno", json={"asesor_id": str(asesor.id)}, headers=auth_headers_for(dueño)
        ).json()

        otra_empresa, _otro_dueño = crear_empresa_importadora(
            db_session, nombre_empresa="Empresa Rival Flujo", email_dueño="dueño_rival_flujo@example.com"
        )
        intruso = Usuario(
            id=str(uuid4()), email="asesor_rival_flujo@example.com",
            password_hash=hash_password("123456789"), rol="asesor",
            importador_id=otra_empresa.id, activo=True, fecha_creacion=datetime.utcnow(),
        )
        db_session.add(intruso)
        db_session.commit()

        response = client.get(
            f"/chat/conversaciones/{interno['id']}/mensajes",
            headers=auth_headers_for(intruso),
        )
        assert response.status_code == 403

    def test_el_dueño_no_puede_abrirlo_con_un_asesor_de_otra_empresa(self, client, db_session, empresa):
        _importador, dueño = empresa
        otra_empresa, _otro_dueño = crear_empresa_importadora(
            db_session, nombre_empresa="Empresa Tercera Flujo", email_dueño="dueño_tercero_flujo@example.com"
        )
        ajeno = Usuario(
            id=str(uuid4()), email="asesor_tercero_flujo@example.com",
            password_hash=hash_password("123456789"), rol="asesor",
            importador_id=otra_empresa.id, activo=True, fecha_creacion=datetime.utcnow(),
        )
        db_session.add(ajeno)
        db_session.commit()

        response = client.post(
            "/chat/interno", json={"asesor_id": str(ajeno.id)}, headers=auth_headers_for(dueño)
        )
        assert response.status_code == 404
