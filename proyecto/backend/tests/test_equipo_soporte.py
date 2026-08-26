"""Equipo de atención al cliente: cuentas propias y cierre de tickets.

Dos cosas que faltaban:

- Los tickets no se podían cerrar, así que la bandeja solo crecía y no quedaba
  constancia de qué se hizo para resolverlos.
- Solo un administrador podía atenderlos, y un administrador puede además dar de
  alta empresas, tocar certificaciones y descargar la copia de seguridad. El rol
  `soporte` separa atender de administrar.
"""
import pytest
from uuid import uuid4
from datetime import datetime

from models.chat import ConversacionChat, TipoConversacion
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.orden import EstadoOrden, Orden
from models.usuario import Usuario
from utils.security import hash_password
from conftest import auth_headers_for, crear_empresa_importadora


@pytest.fixture()
def admin(db_session):
    user = Usuario(
        id=str(uuid4()), email="admin_equipo@example.com", password_hash=hash_password("123456789"),
        rol="admin", nombre="Administrador", activo=True, fecha_creacion=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def agente(db_session):
    user = Usuario(
        id=str(uuid4()), email="agente_equipo@example.com", password_hash=hash_password("123456789"),
        rol="soporte", nombre="Agente Uno", activo=True, fecha_creacion=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def cliente(db_session):
    user = Usuario(
        id=str(uuid4()), email="cliente_equipo@example.com", password_hash=hash_password("123456789"),
        rol="solicitante", nombre="Cliente", perfil_completo=True, fecha_creacion=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _ticket(client, usuario, urgencia="alta"):
    return client.post(
        "/chat/soporte",
        json={"asunto": "Un asunto suficientemente largo", "urgencia": urgencia, "mensaje": "Hola"},
        headers=auth_headers_for(usuario),
    ).json()


class TestAltaDelEquipo:
    def test_el_admin_crea_una_cuenta_de_soporte(self, client, db_session, admin):
        response = client.post(
            "/admin/equipo-soporte",
            json={"email": "nueva_agente@example.com", "password": "ClaveSegura1", "nombre": "Agente Nueva"},
            headers=auth_headers_for(admin),
        )
        assert response.status_code == 201
        assert response.json()["rol"] == "soporte"

        creada = db_session.query(Usuario).filter(Usuario.email == "nueva_agente@example.com").first()
        assert creada is not None
        # No pertenece a ninguna empresa: es personal de la plataforma.
        assert creada.importador_id is None

    def test_un_agente_no_puede_crear_mas_agentes(self, client, agente):
        """El control de quién tiene acceso interno se queda en administración."""
        response = client.post(
            "/admin/equipo-soporte",
            json={"email": "otra@example.com", "password": "ClaveSegura1", "nombre": "Otra"},
            headers=auth_headers_for(agente),
        )
        assert response.status_code == 403

    def test_no_se_repite_el_email(self, client, admin, cliente):
        response = client.post(
            "/admin/equipo-soporte",
            json={"email": cliente.email, "password": "ClaveSegura1", "nombre": "Duplicada"},
            headers=auth_headers_for(admin),
        )
        assert response.status_code == 400


class TestFacultadesDelAgente:
    def test_ve_la_bandeja_de_tickets(self, client, cliente, agente):
        ticket = _ticket(client, cliente)
        filas = client.get("/chat/conversaciones", headers=auth_headers_for(agente)).json()
        assert any(f["id"] == ticket["id"] for f in filas)

    def test_responde_un_ticket(self, client, cliente, agente):
        ticket = _ticket(client, cliente)
        response = client.post(
            f"/chat/conversaciones/{ticket['id']}/mensajes",
            json={"contenido": "Lo revisamos"},
            headers=auth_headers_for(agente),
        )
        assert response.status_code == 201

    def test_interviene_en_una_negociacion(self, client, db_session, cliente, agente):
        importador, dueño = crear_empresa_importadora(
            db_session, nombre_empresa="Empresa Equipo", email_dueño="dueño_equipo@example.com"
        )
        cotizacion = Cotizacion(
            id=str(uuid4()), solicitante_id=cliente.id, importador_id=importador.id,
            modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Equipo",
            descripcion_cliente="Descripción de prueba para la intervención del equipo",
            linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=10,
            precio_objetivo_usd=1.0, incoterm="FOB", estado=EstadoCotizacion.propuestas_recibidas,
        )
        db_session.add(cotizacion)
        conversacion = ConversacionChat(
            id=str(uuid4()), tipo=TipoConversacion.negociacion.value,
            cotizacion_id=cotizacion.id, solicitante_id=cliente.id,
            importador_usuario_id=str(dueño.id),
        )
        db_session.add(conversacion)
        db_session.commit()

        response = client.post(
            f"/admin/conversaciones/{conversacion.id}/mensajes",
            json={"contenido": "Mediamos en el caso."},
            headers=auth_headers_for(agente),
        )
        assert response.status_code == 201

    def test_resuelve_un_incidente_de_orden(self, client, db_session, cliente, agente):
        importador, _dueño = crear_empresa_importadora(
            db_session, nombre_empresa="Empresa Incidente", email_dueño="dueño_incidente@example.com"
        )
        cotizacion = Cotizacion(
            id=str(uuid4()), solicitante_id=cliente.id, importador_id=importador.id,
            modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Incidente",
            descripcion_cliente="Descripción de prueba para el incidente de orden",
            linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=10,
            precio_objetivo_usd=1.0, incoterm="FOB", estado=EstadoCotizacion.orden_activa,
        )
        db_session.add(cotizacion)
        orden = Orden(
            id=str(uuid4()), cotizacion_id=cotizacion.id, importador_id=importador.id,
            solicitante_id=cliente.id, estado=EstadoOrden.cotizacion_aceptada,
            precio_acordado_usd=1.0, en_disputa=True, motivo_disputa="Llegó dañado",
        )
        db_session.add(orden)
        db_session.commit()

        listado = client.get("/admin/disputas", headers=auth_headers_for(agente))
        assert listado.status_code == 200

        resuelto = client.put(
            f"/admin/disputas/{orden.id}/resolver",
            json={"resolucion": "Se coordinó la reposición con la empresa"},
            headers=auth_headers_for(agente),
        )
        assert resuelto.status_code == 200

    @pytest.mark.parametrize(
        "metodo,ruta,cuerpo",
        [
            ("post", "/admin/importadores", {
                "nombre_empresa": "Empresa Prohibida", "email_dueño": "prohibida@example.com",
                "password_dueño": "ClaveSegura1", "nombre_dueño": "Dueño",
                "especialidad_producto": ["General"], "paises_origen": ["China"],
            }),
            ("get", "/admin/usuarios", None),
            ("get", "/admin/metricas", None),
            ("get", "/admin/certificaciones", None),
        ],
    )
    def test_no_administra_la_plataforma(self, client, agente, metodo, ruta, cuerpo):
        """Atender no es administrar: el agente no toca altas, cuentas ni sellos."""
        llamada = getattr(client, metodo)
        response = llamada(ruta, json=cuerpo, headers=auth_headers_for(agente)) if cuerpo else llamada(
            ruta, headers=auth_headers_for(agente)
        )
        assert response.status_code == 403


class TestCierreDeTickets:
    def test_el_agente_cierra_con_resolucion(self, client, db_session, cliente, agente):
        ticket = _ticket(client, cliente)

        response = client.post(
            f"/chat/soporte/{ticket['id']}/cerrar",
            json={"resolucion": "Se corrigió el permiso de la carpeta"},
            headers=auth_headers_for(agente),
        )
        assert response.status_code == 200
        cuerpo = response.json()
        assert cuerpo["cerrada"] is True
        assert cuerpo["resolucion"] == "Se corrigió el permiso de la carpeta"
        assert cuerpo["cerrada_por_nombre"] == "Agente Uno"

    def test_la_resolucion_queda_en_el_hilo(self, client, cliente, agente):
        ticket = _ticket(client, cliente)
        client.post(
            f"/chat/soporte/{ticket['id']}/cerrar",
            json={"resolucion": "Se corrigió el permiso de la carpeta"},
            headers=auth_headers_for(agente),
        )

        mensajes = client.get(
            f"/chat/conversaciones/{ticket['id']}/mensajes", headers=auth_headers_for(cliente)
        ).json()
        assert any("Ticket cerrado" in m["contenido"] for m in mensajes)

    def test_no_se_cierra_dos_veces(self, client, cliente, agente):
        ticket = _ticket(client, cliente)
        client.post(
            f"/chat/soporte/{ticket['id']}/cerrar",
            json={"resolucion": "Resuelto por completo"},
            headers=auth_headers_for(agente),
        )
        segundo = client.post(
            f"/chat/soporte/{ticket['id']}/cerrar",
            json={"resolucion": "Resuelto otra vez"},
            headers=auth_headers_for(agente),
        )
        assert segundo.status_code == 400

    def test_el_cliente_no_cierra_su_propio_ticket(self, client, cliente):
        """Cerrar es una decisión de quien atiende, no de quien reclama."""
        ticket = _ticket(client, cliente)
        response = client.post(
            f"/chat/soporte/{ticket['id']}/cerrar",
            json={"resolucion": "Ya no me importa"},
            headers=auth_headers_for(cliente),
        )
        assert response.status_code == 403

    def test_el_cliente_puede_reabrirlo(self, client, cliente, agente):
        """Si no quedó resuelto, no debe empezar de cero perdiendo el hilo."""
        ticket = _ticket(client, cliente)
        client.post(
            f"/chat/soporte/{ticket['id']}/cerrar",
            json={"resolucion": "Creemos que está resuelto"},
            headers=auth_headers_for(agente),
        )

        response = client.post(
            f"/chat/soporte/{ticket['id']}/reabrir", headers=auth_headers_for(cliente)
        )
        assert response.status_code == 200
        assert response.json()["cerrada"] is False

    def test_un_tercero_no_lo_reabre(self, client, db_session, cliente, agente):
        ticket = _ticket(client, cliente)
        client.post(
            f"/chat/soporte/{ticket['id']}/cerrar",
            json={"resolucion": "Resuelto"}, headers=auth_headers_for(agente),
        )
        intruso = Usuario(
            id=str(uuid4()), email="intruso_equipo@example.com", password_hash=hash_password("123456789"),
            rol="solicitante", perfil_completo=True, fecha_creacion=datetime.utcnow(),
        )
        db_session.add(intruso)
        db_session.commit()

        response = client.post(
            f"/chat/soporte/{ticket['id']}/reabrir", headers=auth_headers_for(intruso)
        )
        assert response.status_code in (403, 404)

    def test_los_cerrados_bajan_en_la_bandeja(self, client, cliente, agente):
        critico = _ticket(client, cliente, urgencia="critica")
        _bajo = _ticket(client, cliente, urgencia="baja")
        client.post(
            f"/chat/soporte/{critico['id']}/cerrar",
            json={"resolucion": "Resuelto sin más"}, headers=auth_headers_for(agente),
        )

        filas = client.get("/chat/conversaciones", headers=auth_headers_for(agente)).json()
        # El crítico ya cerrado queda por debajo del bajo que sigue abierto.
        assert filas[-1]["id"] == critico["id"]
        assert filas[-1]["cerrada"] is True

    def test_no_se_cierra_algo_que_no_es_un_ticket(self, client, db_session, cliente, agente):
        importador, dueño = crear_empresa_importadora(
            db_session, nombre_empresa="Empresa NoTicket", email_dueño="dueño_noticket@example.com"
        )
        conversacion = ConversacionChat(
            id=str(uuid4()), tipo=TipoConversacion.negociacion.value,
            solicitante_id=cliente.id, importador_usuario_id=str(dueño.id),
        )
        db_session.add(conversacion)
        db_session.commit()

        response = client.post(
            f"/chat/soporte/{conversacion.id}/cerrar",
            json={"resolucion": "No debería poder"},
            headers=auth_headers_for(agente),
        )
        assert response.status_code == 404
