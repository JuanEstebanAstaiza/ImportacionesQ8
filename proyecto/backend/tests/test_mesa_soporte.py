"""Mesa de soporte por niveles y calificación del servicio.

Dos reglas que antes no existían:

- Un caso de nivel 3 no puede caer en alguien que acaba de entrar en el nivel 1.
  Entre quienes sí pueden atenderlo se elige al azar, para repartir la carga sin
  llevar la cuenta de cuántos tickets tiene cada uno.
- Quien pidió ayuda puntúa a quien le atendió, y solo una vez cerrado el ticket.
"""
import pytest
from uuid import uuid4
from datetime import datetime

from models.chat import ConversacionChat, TipoConversacion
from models.usuario import Usuario
from services.mesa_soporte import elegir_agente, nivel_inicial
from utils.security import hash_password
from conftest import auth_headers_for


def _agente(db_session, email, nivel, *, activo=True, nombre=None):
    user = Usuario(
        id=str(uuid4()), email=email, password_hash=hash_password("123456789"),
        rol="soporte", nombre=nombre or email, nivel_soporte=nivel, activo=activo,
        fecha_creacion=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def admin(db_session):
    user = Usuario(
        id=str(uuid4()), email="admin_mesa@example.com", password_hash=hash_password("123456789"),
        rol="admin", nombre="Admin Mesa", activo=True, fecha_creacion=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def cliente(db_session):
    user = Usuario(
        id=str(uuid4()), email="cliente_mesa@example.com", password_hash=hash_password("123456789"),
        rol="solicitante", nombre="Cliente Mesa", perfil_completo=True, fecha_creacion=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _abrir(client, usuario, urgencia="critica", asunto="Un asunto suficientemente largo"):
    return client.post(
        "/chat/soporte",
        json={"asunto": asunto, "urgencia": urgencia, "mensaje": "Hola"},
        headers=auth_headers_for(usuario),
    ).json()


class TestNivelDelTicket:
    @pytest.mark.parametrize("urgencia,nivel", [("critica", 3), ("alta", 2), ("media", 1), ("baja", 1)])
    def test_el_nivel_sale_de_la_urgencia(self, urgencia, nivel):
        assert nivel_inicial(urgencia) == nivel

    def test_una_urgencia_desconocida_entra_por_el_nivel_mas_bajo(self):
        assert nivel_inicial("inventada") == 1
        assert nivel_inicial(None) == 1

    def test_el_ticket_guarda_su_nivel(self, client, db_session, cliente):
        _agente(db_session, "n3_nivel@example.com", 3)
        ticket = _abrir(client, cliente, urgencia="critica")
        assert ticket["nivel"] == 3


class TestAsignacion:
    def test_no_se_asigna_a_alguien_de_nivel_inferior(self, client, db_session, cliente):
        """Lo esencial: un caso difícil nunca cae en quien no puede resolverlo."""
        novato = _agente(db_session, "novato@example.com", 1)
        ticket = _abrir(client, cliente, urgencia="critica")
        assert ticket["agente_asignado_id"] != str(novato.id)
        # Sin nadie cualificado se queda sin dueño, a la vista de administración.
        assert ticket["agente_asignado_id"] is None

    def test_se_asigna_a_quien_si_puede(self, client, db_session, cliente):
        _agente(db_session, "novato2@example.com", 1)
        experto = _agente(db_session, "experto@example.com", 3)

        ticket = _abrir(client, cliente, urgencia="critica")
        assert ticket["agente_asignado_id"] == str(experto.id)
        assert ticket["agente_nivel"] == 3

    def test_se_prefiere_el_menor_nivel_suficiente(self, client, db_session, cliente):
        """No gastar a los expertos en consultas corrientes."""
        basico = _agente(db_session, "basico@example.com", 1)
        _agente(db_session, "experto2@example.com", 3)

        ticket = _abrir(client, cliente, urgencia="baja")
        assert ticket["agente_asignado_id"] == str(basico.id)

    def test_ignora_a_los_agentes_inactivos(self, client, db_session, cliente):
        _agente(db_session, "inactivo@example.com", 3, activo=False)
        ticket = _abrir(client, cliente, urgencia="critica")
        assert ticket["agente_asignado_id"] is None

    def test_reparte_entre_los_del_mismo_nivel(self, db_session):
        """Al azar, pero dentro del grupo correcto: nadie queda excluido."""
        uno = _agente(db_session, "uno_reparto@example.com", 2)
        dos = _agente(db_session, "dos_reparto@example.com", 2)
        _agente(db_session, "tres_reparto@example.com", 1)

        elegidos = {str(elegir_agente(db_session, 2).id) for _ in range(60)}
        assert elegidos == {str(uno.id), str(dos.id)}


class TestEscalado:
    def test_el_agente_escala_y_cambia_de_dueño(self, client, db_session, cliente):
        basico = _agente(db_session, "basico_esc@example.com", 1)
        experto = _agente(db_session, "experto_esc@example.com", 3)

        ticket = _abrir(client, cliente, urgencia="baja")
        assert ticket["agente_asignado_id"] == str(basico.id)

        response = client.post(
            f"/chat/soporte/{ticket['id']}/escalar",
            json={"nivel": 3, "motivo": "Requiere revisar la integración de pagos"},
            headers=auth_headers_for(basico),
        )
        assert response.status_code == 200
        assert response.json()["nivel"] == 3
        assert response.json()["agente_asignado_id"] == str(experto.id)

    def test_queda_constancia_en_el_hilo(self, client, db_session, cliente):
        basico = _agente(db_session, "basico_esc2@example.com", 1)
        _agente(db_session, "experto_esc2@example.com", 2)
        ticket = _abrir(client, cliente, urgencia="baja")

        client.post(
            f"/chat/soporte/{ticket['id']}/escalar",
            json={"nivel": 2}, headers=auth_headers_for(basico),
        )

        mensajes = client.get(
            f"/chat/conversaciones/{ticket['id']}/mensajes", headers=auth_headers_for(cliente)
        ).json()
        assert any("escaló el ticket" in m["contenido"] for m in mensajes)

    def test_no_se_baja_de_nivel(self, client, db_session, cliente):
        experto = _agente(db_session, "experto_baja@example.com", 3)
        ticket = _abrir(client, cliente, urgencia="critica")

        response = client.post(
            f"/chat/soporte/{ticket['id']}/escalar",
            json={"nivel": 1}, headers=auth_headers_for(experto),
        )
        assert response.status_code == 400

    def test_el_cliente_no_escala_su_propio_ticket(self, client, db_session, cliente):
        _agente(db_session, "agente_esc3@example.com", 3)
        ticket = _abrir(client, cliente, urgencia="baja")

        response = client.post(
            f"/chat/soporte/{ticket['id']}/escalar",
            json={"nivel": 3}, headers=auth_headers_for(cliente),
        )
        assert response.status_code == 403


class TestBandejaDelAgente:
    def test_ve_lo_suyo_y_lo_que_nadie_tomo(self, client, db_session, cliente):
        agente = _agente(db_session, "agente_bandeja@example.com", 2)
        mio = _abrir(client, cliente, urgencia="alta", asunto="Ticket asignado a este agente")
        # Nivel 3 sin nadie cualificado: queda sin dueño.
        huerfano = _abrir(client, cliente, urgencia="critica", asunto="Ticket sin dueño posible")

        filas = client.get("/chat/conversaciones", headers=auth_headers_for(agente)).json()
        ids = {f["id"] for f in filas}
        assert mio["id"] in ids
        assert huerfano["id"] in ids

    def test_no_ve_el_ticket_de_un_companero(self, client, db_session, cliente):
        otro = _agente(db_session, "companero@example.com", 2)
        agente = _agente(db_session, "curioso@example.com", 2)

        # Se asigna a mano para que el ticket sea inequívocamente del otro.
        ticket = _abrir(client, cliente, urgencia="alta")
        conversacion = db_session.query(ConversacionChat).filter(
            ConversacionChat.id == ticket["id"]
        ).first()
        conversacion.agente_asignado_id = str(otro.id)
        db_session.commit()

        filas = client.get("/chat/conversaciones", headers=auth_headers_for(agente)).json()
        assert all(f["id"] != ticket["id"] for f in filas)


class TestCalificacion:
    def _cerrado(self, client, db_session, cliente):
        agente = _agente(db_session, f"agente_cal_{uuid4().hex[:6]}@example.com", 3, nombre="Agente Cal")
        ticket = _abrir(client, cliente, urgencia="critica")
        client.post(
            f"/chat/soporte/{ticket['id']}/cerrar",
            json={"resolucion": "Resuelto por completo"},
            headers=auth_headers_for(agente),
        )
        return ticket, agente

    def test_el_usuario_califica_tras_el_cierre(self, client, db_session, cliente):
        ticket, _agente_ = self._cerrado(client, db_session, cliente)

        response = client.post(
            f"/chat/soporte/{ticket['id']}/calificar",
            json={"calificacion": 5, "comentario": "Muy rápidos"},
            headers=auth_headers_for(cliente),
        )
        assert response.status_code == 200
        assert response.json()["calificacion"] == 5
        assert response.json()["comentario_calificacion"] == "Muy rápidos"

    def test_no_se_califica_antes_de_cerrar(self, client, db_session, cliente):
        _agente(db_session, "agente_sincerrar@example.com", 3)
        ticket = _abrir(client, cliente, urgencia="critica")

        response = client.post(
            f"/chat/soporte/{ticket['id']}/calificar",
            json={"calificacion": 5}, headers=auth_headers_for(cliente),
        )
        assert response.status_code == 400

    def test_solo_califica_quien_pidio_la_ayuda(self, client, db_session, cliente):
        ticket, agente = self._cerrado(client, db_session, cliente)

        response = client.post(
            f"/chat/soporte/{ticket['id']}/calificar",
            json={"calificacion": 5}, headers=auth_headers_for(agente),
        )
        assert response.status_code == 403

    def test_no_se_califica_dos_veces(self, client, db_session, cliente):
        ticket, _agente_ = self._cerrado(client, db_session, cliente)
        client.post(
            f"/chat/soporte/{ticket['id']}/calificar",
            json={"calificacion": 5}, headers=auth_headers_for(cliente),
        )
        segunda = client.post(
            f"/chat/soporte/{ticket['id']}/calificar",
            json={"calificacion": 1}, headers=auth_headers_for(cliente),
        )
        assert segunda.status_code == 400

    @pytest.mark.parametrize("nota", [0, 6, -1])
    def test_la_nota_esta_acotada(self, client, db_session, cliente, nota):
        ticket, _agente_ = self._cerrado(client, db_session, cliente)
        response = client.post(
            f"/chat/soporte/{ticket['id']}/calificar",
            json={"calificacion": nota}, headers=auth_headers_for(cliente),
        )
        assert response.status_code == 422

    def test_el_promedio_llega_al_panel(self, client, db_session, cliente, admin):
        ticket, agente = self._cerrado(client, db_session, cliente)
        client.post(
            f"/chat/soporte/{ticket['id']}/calificar",
            json={"calificacion": 4}, headers=auth_headers_for(cliente),
        )

        equipo = client.get("/admin/equipo-soporte", headers=auth_headers_for(admin)).json()
        ficha = next(a for a in equipo if a["id"] == str(agente.id))
        assert ficha["calificacion_promedio"] == 4.0
        assert ficha["calificaciones_recibidas"] == 1
        assert ficha["tickets_cerrados"] == 1


class TestGestionDelEquipo:
    def test_el_admin_cambia_el_nivel_de_un_agente(self, client, db_session, admin):
        agente = _agente(db_session, "asciende@example.com", 1)

        response = client.put(
            f"/admin/equipo-soporte/{agente.id}/nivel",
            json={"nivel": 3}, headers=auth_headers_for(admin),
        )
        assert response.status_code == 200
        assert response.json()["nivel"] == 3

        db_session.refresh(agente)
        assert agente.nivel_soporte == 3

    def test_un_agente_no_se_asciende_solo(self, client, db_session):
        agente = _agente(db_session, "ambicioso@example.com", 1)

        response = client.put(
            f"/admin/equipo-soporte/{agente.id}/nivel",
            json={"nivel": 3}, headers=auth_headers_for(agente),
        )
        assert response.status_code == 403

    def test_el_alta_admite_nivel(self, client, db_session, admin):
        response = client.post(
            "/admin/equipo-soporte",
            json={
                "email": "nivel3@example.com", "password": "ClaveSegura1",
                "nombre": "Especialista", "nivel": 3,
            },
            headers=auth_headers_for(admin),
        )
        assert response.status_code == 201

        creada = db_session.query(Usuario).filter(Usuario.email == "nivel3@example.com").first()
        assert creada.nivel_soporte == 3
