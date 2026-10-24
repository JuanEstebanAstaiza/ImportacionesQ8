"""Mesa de ayuda compartida por la suite: cada ticket dice de qué producto viene.

La mesa (agentes, niveles, asignación) es una sola para Importaciones,
Liquidaciones y los módulos que vengan; el ticket lleva `modulo` y, si se abrió
desde algo concreto, `referencia`.
"""
from uuid import uuid4

from conftest import crear_usuario_con_token
from models.chat import ConversacionChat, TipoConversacion


def test_ticket_de_liquidaciones_con_referencia(client, db_session):
    _, h_cliente = crear_usuario_con_token(db_session, rol="solicitante")
    _, h_admin = crear_usuario_con_token(db_session, rol="admin")

    r = client.post("/chat/soporte", json={
        "asunto": "El vendedor no responde", "urgencia": "alta", "mensaje": "Reservé hace un día",
        "modulo": "liquidaciones", "referencia": f"operacion:{uuid4()}",
    }, headers=h_cliente)
    assert r.status_code == 201, r.text
    ticket = r.json()
    assert ticket["modulo"] == "liquidaciones"
    assert ticket["referencia"].startswith("operacion:")

    r = client.post("/chat/soporte", json={"asunto": "No puedo cotizar"}, headers=h_cliente)
    assert r.json()["modulo"] == "importaciones"

    liq = client.get("/admin/conversaciones?modulo=liquidaciones", headers=h_admin).json()
    assert [i["id"] for i in liq["items"]] == [ticket["id"]]
    assert liq["items"][0]["modulo"] == "liquidaciones"
    imp = client.get("/admin/conversaciones?modulo=importaciones", headers=h_admin).json()
    assert ticket["id"] not in [i["id"] for i in imp["items"]]


def test_ticket_anterior_a_la_suite_es_de_importaciones(client, db_session):
    cliente, _ = crear_usuario_con_token(db_session, rol="solicitante")
    _, h_admin = crear_usuario_con_token(db_session, rol="admin")
    viejo = ConversacionChat(id=str(uuid4()), tipo=TipoConversacion.soporte.value, solicitante_id=cliente.id,
                             asunto="Ticket antiguo", urgencia="media", nivel=1)
    db_session.add(viejo)
    db_session.commit()

    imp = client.get("/admin/conversaciones?modulo=importaciones", headers=h_admin).json()
    fila = next(i for i in imp["items"] if i["id"] == viejo.id)
    assert fila["modulo"] == "importaciones"
    assert fila["importador_usuario_id"] == ""


def test_modulo_desconocido_se_rechaza(client, db_session):
    _, h_cliente = crear_usuario_con_token(db_session, rol="solicitante")
    r = client.post("/chat/soporte", json={"asunto": "Ayuda con algo", "modulo": "otro"}, headers=h_cliente)
    assert r.status_code == 422
