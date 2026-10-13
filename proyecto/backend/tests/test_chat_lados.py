"""A qué lado va cada mensaje y quién lo escribió.

La cuenta dueña de la empresa puede abrir el chat de su asesor con un cliente.
Antes lo veía todo en una sola columna, porque el frontend ponía a la derecha
solo lo que escribía quien mira, y ahí no había escrito nada: el asesor y el
cliente salían iguales. Ahora el backend dice de qué lado va cada mensaje
(`de_mi_lado`) y quién lo escribió (`remitente_nombre`), y la conversación dice
de qué asesor es (`asesor_nombre`).
"""
from datetime import datetime, timedelta
from uuid import uuid4

import pytest

from conftest import auth_headers_for, crear_empresa_importadora, crear_usuario_con_token
from models.chat import ConversacionChat, MensajeChat, TipoConversacion
from models.usuario import Usuario
from utils.security import hash_password


def _usuario(db, **campos):
    u = Usuario(id=str(uuid4()), password_hash=hash_password("123456789"), activo=True,
                fecha_creacion=datetime.utcnow(), perfil_completo=True, **campos)
    db.add(u)
    db.commit()
    return u


@pytest.fixture()
def chat_del_asesor(db_session):
    importador, dueño = crear_empresa_importadora(
        db_session, nombre_empresa="Lados SAS", email_dueño="dueno_lados@example.com")
    asesor = _usuario(db_session, email="asesor_lados@example.com", rol="asesor",
                      nombre="Julián", apellido="Vega", importador_id=importador.id)
    cliente = _usuario(db_session, email="cliente_lados@example.com", rol="solicitante",
                       nombre="Paula", apellido="Restrepo")
    conv = ConversacionChat(id=str(uuid4()), tipo=TipoConversacion.negociacion.value,
                            solicitante_id=cliente.id, importador_usuario_id=asesor.id,
                            importador_id=importador.id)
    db_session.add(conv)
    ahora = datetime.utcnow()
    for i, (autor, texto) in enumerate([(cliente, "Hola, ¿precio?"), (asesor, "Te cotizo hoy"),
                                        (dueño, "Le damos prioridad")]):
        db_session.add(MensajeChat(id=str(uuid4()), conversacion_id=conv.id, remitente_id=autor.id,
                                   contenido=texto, tipo="texto", fecha_envio=ahora + timedelta(seconds=i)))
    db_session.commit()
    return conv, dueño, asesor, cliente


def _lados(client, conv, usuario):
    r = client.get(f"/chat/conversaciones/{conv.id}/mensajes", headers=auth_headers_for(usuario))
    assert r.status_code == 200, r.text
    return [(m["contenido"], m["de_mi_lado"], m["remitente_nombre"]) for m in r.json()]


def test_la_dueña_ve_el_chat_del_asesor_como_si_fuera_el_suyo(client, chat_del_asesor):
    conv, dueño, asesor, _ = chat_del_asesor
    assert _lados(client, conv, dueño) == [
        ("Hola, ¿precio?", False, "Paula Restrepo"),
        ("Te cotizo hoy", True, "Julián Vega"),
        ("Le damos prioridad", True, dueño.nombre or dueño.email),
    ]
    fila = next(c for c in client.get("/chat/conversaciones", headers=auth_headers_for(dueño)).json()
                if c["id"] == conv.id)
    assert fila["asesor_id"] == asesor.id and fila["asesor_nombre"] == "Julián"


def test_el_asesor_y_el_cliente_ven_cada_uno_su_lado(client, chat_del_asesor):
    conv, _, asesor, cliente = chat_del_asesor
    assert [lado for _, lado, _ in _lados(client, conv, asesor)] == [False, True, True]
    assert [lado for _, lado, _ in _lados(client, conv, cliente)] == [True, False, False]
    # En su propio chat no hay asesor que mostrar.
    fila = next(c for c in client.get("/chat/conversaciones", headers=auth_headers_for(asesor)).json()
                if c["id"] == conv.id)
    assert fila["asesor_nombre"] is None


def test_en_la_sala_del_equipo_cada_persona_es_su_lado(client, db_session):
    admin, admin_h = crear_usuario_con_token(db_session, rol="admin")
    soporte, soporte_h = crear_usuario_con_token(db_session, rol="soporte")
    sala = client.post("/chat/equipo", headers=admin_h).json()
    client.post(f"/chat/conversaciones/{sala['id']}/mensajes", headers=admin_h, json={"contenido": "Buenos días"})
    client.post(f"/chat/conversaciones/{sala['id']}/mensajes", headers=soporte_h, json={"contenido": "Hola"})
    r = client.get(f"/chat/conversaciones/{sala['id']}/mensajes", headers=soporte_h).json()
    assert [(m["contenido"], m["de_mi_lado"]) for m in r] == [("Buenos días", False), ("Hola", True)]
    assert r[0]["remitente_nombre"]
