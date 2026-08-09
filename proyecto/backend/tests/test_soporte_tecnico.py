"""Soporte técnico: tickets con urgencia y marcas de lectura.

Antes no existía ningún camino para pedir ayuda: la pantalla de chats del
administrador mostraba lo mismo que la de cualquier usuario y el contador de no
leídos estaba escrito a cero, así que ese filtro no podía funcionar.
"""
import pytest
from uuid import uuid4
from datetime import datetime

from models.chat import ConversacionChat, LecturaConversacion, MensajeChat, TipoConversacion
from models.usuario import Usuario
from utils.security import hash_password
from conftest import auth_headers_for, crear_empresa_importadora


@pytest.fixture()
def solicitante(db_session):
    user = Usuario(
        id=str(uuid4()), email="solicitante_soporte@example.com",
        password_hash=hash_password("123456789"), rol="solicitante",
        nombre="Cliente Soporte", perfil_completo=True, fecha_creacion=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def empresa(db_session):
    return crear_empresa_importadora(
        db_session, nombre_empresa="Empresa Soporte", email_dueño="dueño_soporte@example.com"
    )


@pytest.fixture()
def asesor(db_session, empresa):
    importador, _dueño = empresa
    user = Usuario(
        id=str(uuid4()), email="asesor_soporte@example.com",
        password_hash=hash_password("123456789"), rol="asesor",
        nombre="Asesor Soporte", importador_id=importador.id, activo=True,
        fecha_creacion=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def admin(db_session):
    user = Usuario(
        id=str(uuid4()), email="admin_soporte@example.com",
        password_hash=hash_password("123456789"), rol="admin",
        nombre="Equipo Q8", activo=True, fecha_creacion=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _abrir(client, usuario, *, asunto="No puedo subir el packing list", urgencia="alta", mensaje="Ayuda"):
    return client.post(
        "/chat/soporte",
        json={"asunto": asunto, "urgencia": urgencia, "mensaje": mensaje},
        headers=auth_headers_for(usuario),
    )


class TestAbrirTicket:
    @pytest.mark.parametrize("rol_fixture", ["solicitante", "dueño", "asesor"])
    def test_los_tres_perfiles_pueden_pedir_soporte(self, client, request, empresa, rol_fixture, solicitante, asesor):
        _importador, dueño = empresa
        usuario = {"solicitante": solicitante, "dueño": dueño, "asesor": asesor}[rol_fixture]

        response = _abrir(client, usuario)
        assert response.status_code == 201
        cuerpo = response.json()
        assert cuerpo["tipo"] == "soporte"
        assert cuerpo["urgencia"] == "alta"
        assert cuerpo["asunto"] == "No puedo subir el packing list"

    def test_el_ticket_no_cuelga_de_ninguna_cotizacion(self, client, solicitante):
        cuerpo = _abrir(client, solicitante).json()
        assert cuerpo["cotizacion_id"] is None
        assert cuerpo["importador_usuario_id"] is None

    def test_cada_peticion_es_un_ticket_propio(self, client, db_session, solicitante):
        _abrir(client, solicitante, asunto="Primer problema distinto")
        _abrir(client, solicitante, asunto="Segundo problema distinto")

        total = db_session.query(ConversacionChat).filter(
            ConversacionChat.tipo == TipoConversacion.soporte.value
        ).count()
        assert total == 2

    def test_el_asunto_vacio_se_rechaza(self, client, solicitante):
        response = client.post(
            "/chat/soporte",
            json={"asunto": "ab", "urgencia": "alta"},
            headers=auth_headers_for(solicitante),
        )
        assert response.status_code == 422

    def test_una_urgencia_inventada_se_rechaza(self, client, solicitante):
        response = client.post(
            "/chat/soporte",
            json={"asunto": "Un asunto suficientemente largo", "urgencia": "urgentisimo"},
            headers=auth_headers_for(solicitante),
        )
        assert response.status_code == 422


class TestBandejaDelAdmin:
    def test_el_admin_ve_los_tickets(self, client, solicitante, admin):
        abierto = _abrir(client, solicitante).json()

        response = client.get("/chat/conversaciones", headers=auth_headers_for(admin))
        assert response.status_code == 200
        assert any(c["id"] == abierto["id"] for c in response.json())

    def test_el_admin_no_ve_negociaciones_ajenas(self, client, db_session, solicitante, empresa, admin):
        """Su bandeja es soporte; para supervisar existe el panel, que pagina."""
        _importador, dueño = empresa
        db_session.add(ConversacionChat(
            id=str(uuid4()), tipo=TipoConversacion.negociacion.value,
            solicitante_id=solicitante.id, importador_usuario_id=str(dueño.id),
        ))
        db_session.commit()

        response = client.get("/chat/conversaciones", headers=auth_headers_for(admin))
        assert all(c["tipo"] == "soporte" for c in response.json())

    def test_se_ordenan_por_urgencia(self, client, solicitante, admin):
        _abrir(client, solicitante, asunto="Problema de prioridad baja", urgencia="baja")
        _abrir(client, solicitante, asunto="Problema de prioridad critica", urgencia="critica")
        _abrir(client, solicitante, asunto="Problema de prioridad media", urgencia="media")

        filas = client.get("/chat/conversaciones", headers=auth_headers_for(admin)).json()
        assert [f["urgencia"] for f in filas] == ["critica", "media", "baja"]

    def test_soporte_sabe_a_quien_atiende(self, client, empresa, admin):
        _importador, dueño = empresa
        _abrir(client, dueño)

        fila = client.get("/chat/conversaciones", headers=auth_headers_for(admin)).json()[0]
        assert fila["solicitante_rol"] == "importador"
        assert fila["contraparte_nombre"] is not None

    def test_el_admin_puede_responder(self, client, solicitante, admin):
        ticket = _abrir(client, solicitante).json()

        response = client.post(
            f"/chat/conversaciones/{ticket['id']}/mensajes",
            json={"contenido": "Lo revisamos ahora mismo."},
            headers=auth_headers_for(admin),
        )
        assert response.status_code == 201


class TestAislamiento:
    def test_otro_usuario_no_lee_un_ticket_ajeno(self, client, db_session, solicitante, empresa):
        _importador, dueño = empresa
        ticket = _abrir(client, solicitante).json()

        response = client.get(
            f"/chat/conversaciones/{ticket['id']}/mensajes",
            headers=auth_headers_for(dueño),
        )
        assert response.status_code == 403

    def test_el_ticket_no_aparece_en_la_bandeja_de_otro(self, client, solicitante, empresa):
        _importador, dueño = empresa
        ticket = _abrir(client, solicitante).json()

        filas = client.get("/chat/conversaciones", headers=auth_headers_for(dueño)).json()
        assert all(f["id"] != ticket["id"] for f in filas)

    def test_quien_lo_abrio_sigue_viendolo(self, client, asesor):
        """El asesor ve sus propios tickets aunque su bandeja se filtre por empresa."""
        ticket = _abrir(client, asesor).json()

        filas = client.get("/chat/conversaciones", headers=auth_headers_for(asesor)).json()
        assert any(f["id"] == ticket["id"] for f in filas)


class TestNoLeidos:
    def test_un_mensaje_ajeno_cuenta_como_no_leido(self, client, solicitante, admin):
        ticket = _abrir(client, solicitante, mensaje="Tengo un problema").json()

        filas = client.get("/chat/conversaciones", headers=auth_headers_for(admin)).json()
        fila = next(f for f in filas if f["id"] == ticket["id"])
        assert fila["no_leidos"] == 1

    def test_lo_propio_no_cuenta(self, client, solicitante):
        ticket = _abrir(client, solicitante, mensaje="Tengo un problema").json()

        filas = client.get("/chat/conversaciones", headers=auth_headers_for(solicitante)).json()
        fila = next(f for f in filas if f["id"] == ticket["id"])
        assert fila["no_leidos"] == 0

    def test_marcar_leida_deja_el_contador_a_cero(self, client, solicitante, admin):
        ticket = _abrir(client, solicitante, mensaje="Tengo un problema").json()

        marcada = client.post(
            f"/chat/conversaciones/{ticket['id']}/leida", headers=auth_headers_for(admin)
        )
        assert marcada.status_code == 204

        filas = client.get("/chat/conversaciones", headers=auth_headers_for(admin)).json()
        fila = next(f for f in filas if f["id"] == ticket["id"])
        assert fila["no_leidos"] == 0

    def test_un_mensaje_posterior_vuelve_a_contar(self, client, solicitante, admin):
        ticket = _abrir(client, solicitante, mensaje="Tengo un problema").json()
        client.post(f"/chat/conversaciones/{ticket['id']}/leida", headers=auth_headers_for(admin))

        client.post(
            f"/chat/conversaciones/{ticket['id']}/mensajes",
            json={"contenido": "Se me olvidaba un detalle"},
            headers=auth_headers_for(solicitante),
        )

        filas = client.get("/chat/conversaciones", headers=auth_headers_for(admin)).json()
        fila = next(f for f in filas if f["id"] == ticket["id"])
        assert fila["no_leidos"] == 1

    def test_marcar_dos_veces_no_duplica_la_marca(self, client, db_session, solicitante, admin):
        ticket = _abrir(client, solicitante).json()
        client.post(f"/chat/conversaciones/{ticket['id']}/leida", headers=auth_headers_for(admin))
        client.post(f"/chat/conversaciones/{ticket['id']}/leida", headers=auth_headers_for(admin))

        marcas = db_session.query(LecturaConversacion).filter(
            LecturaConversacion.conversacion_id == ticket["id"],
            LecturaConversacion.usuario_id == str(admin.id),
        ).count()
        assert marcas == 1

    def test_no_se_puede_marcar_leido_un_hilo_ajeno(self, client, solicitante, empresa):
        _importador, dueño = empresa
        ticket = _abrir(client, solicitante).json()

        response = client.post(
            f"/chat/conversaciones/{ticket['id']}/leida", headers=auth_headers_for(dueño)
        )
        assert response.status_code == 403
