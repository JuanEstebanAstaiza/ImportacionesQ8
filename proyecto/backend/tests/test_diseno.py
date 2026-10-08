"""Rol designer: aprobación → diseño → publicación, permisos y canal del equipo."""
from pathlib import Path
from uuid import uuid4

import pytest

from conftest import crear_usuario_con_token
from models.chat import ConversacionChat, TipoConversacion
from models.documental import Archivo
from models.notificacion import Notificacion
from services import enlaces_video as ev

YOUTUBE = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


@pytest.fixture(autouse=True)
def oembed_simulado(monkeypatch):
    monkeypatch.setattr(ev, "consultar_oembed", lambda enlace, cliente=None: enlace)


def _imagen(db_session, owner_id):
    archivo_id = str(uuid4())
    ruta = Path("uploads/documentos") / f"{archivo_id}_diseno.png"
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(b"\x89PNG\r\n\x1a\n")
    db_session.add(Archivo(
        id=archivo_id, owner_user_id=owner_id, nombre="diseno.png", extension="png", mime_type="image/png",
        tipo_recurso="imagen", size_bytes=8, storage_path=str(ruta),
        storage_url=f"/documentos/archivos/{archivo_id}/descargar", origen="tendencias",
    ))
    db_session.commit()
    return f"/documentos/archivos/{archivo_id}/descargar"


def _aprobado(client, db_session, aprobador):
    _, comprador = crear_usuario_con_token(db_session)
    item_id = client.post("/tendencias/enviar", json={"url": YOUTUBE}, headers=comprador).json()["id"]
    client.patch(f"/tendencias/items/{item_id}", json={"nombre": "Lámpara", "categoria": "Hogar"}, headers=aprobador)
    r = client.post(f"/tendencias/items/{item_id}/aprobar", json={}, headers=aprobador)
    assert r.status_code == 200 and r.json()["estado"] == "en_diseno", r.text
    return item_id


def test_aprobado_pasa_a_diseno_y_el_designer_publica_con_imagenes(client, db_session):
    _, aprobador = crear_usuario_con_token(db_session, rol="admin")
    disenador_user, disenador = crear_usuario_con_token(db_session, rol="designer")
    item_id = _aprobado(client, db_session, aprobador)

    # Le avisan a diseño.
    assert db_session.query(Notificacion).filter(
        Notificacion.usuario_id == disenador_user.id, Notificacion.titulo == "Para diseñar: Lámpara").count() == 1
    cola = client.get("/tendencias/diseno/cola", headers=disenador).json()
    assert [i["id"] for i in cola] == [item_id]
    assert client.get("/tendencias/diseno/contadores", headers=disenador).json()["en_cola"] == 1

    portada = _imagen(db_session, disenador_user.id)
    extras = [_imagen(db_session, disenador_user.id) for _ in range(2)]
    r = client.patch(f"/tendencias/diseno/items/{item_id}", json={"portada_url": portada, "imagenes": extras},
                     headers=disenador)
    assert r.status_code == 200, r.text
    # Antes de publicar, las imágenes no se ven sin sesión.
    assert client.get(extras[0]).status_code in (401, 403)

    r = client.post(f"/tendencias/diseno/items/{item_id}/publicar", headers=disenador)
    assert r.status_code == 200 and r.json()["estado"] == "publicado"
    assert r.json()["disenado_por"]
    ficha = client.get(f"/tendencias/items/{item_id}").json()
    assert ficha["portada_url"] == portada and ficha["imagenes"] == extras
    assert client.get(extras[0]).status_code == 200  # publicadas: públicas
    mios = client.get("/tendencias/diseno/publicados?mios=true", headers=disenador).json()
    assert [i["id"] for i in mios] == [item_id]


def test_el_designer_no_aprueba_ni_usa_imagenes_ajenas(client, db_session):
    _, aprobador = crear_usuario_con_token(db_session, rol="admin")
    otro, _ = crear_usuario_con_token(db_session)
    _, disenador = crear_usuario_con_token(db_session, rol="designer")
    item_id = _aprobado(client, db_session, aprobador)

    assert client.get("/tendencias/aprobacion/cola", headers=disenador).status_code == 403
    r = client.patch(f"/tendencias/diseno/items/{item_id}", json={"portada_url": _imagen(db_session, otro.id)},
                     headers=disenador)
    assert r.status_code == 403
    r = client.patch(f"/tendencias/diseno/items/{item_id}", json={"imagenes": ["javascript:alert(1)"]}, headers=disenador)
    assert r.status_code == 400
    # Un comprador no entra a diseño.
    _, comprador = crear_usuario_con_token(db_session)
    assert client.get("/tendencias/diseno/cola", headers=comprador).status_code == 403


def test_publicar_directo_es_solo_del_admin(client, db_session):
    curador_user, curador = crear_usuario_con_token(db_session, rol="soporte")
    curador_user.es_curador = True
    db_session.commit()
    admin_user, admin = crear_usuario_con_token(db_session, rol="admin")
    _, comprador = crear_usuario_con_token(db_session)
    item_id = client.post("/tendencias/enviar", json={"url": YOUTUBE}, headers=comprador).json()["id"]
    client.patch(f"/tendencias/items/{item_id}", json={
        "nombre": "Lámpara", "categoria": "Hogar", "portada_url": _imagen(db_session, admin_user.id)}, headers=admin)
    assert client.post(f"/tendencias/items/{item_id}/aprobar", json={"publicar": True},
                       headers=curador).status_code == 403
    r = client.post(f"/tendencias/items/{item_id}/aprobar", json={"publicar": True}, headers=admin)
    assert r.status_code == 200 and r.json()["estado"] == "publicado"


def test_designer_en_el_canal_del_equipo_pero_no_en_soporte(client, db_session):
    disenador_user, disenador = crear_usuario_con_token(db_session, rol="designer")
    admin_user, admin = crear_usuario_con_token(db_session, rol="admin")
    _, comprador = crear_usuario_con_token(db_session)

    miembros = {m["id"] for m in client.get("/chat/equipo/miembros", headers=admin).json()}
    assert str(disenador_user.id) in miembros
    sala = client.post("/chat/equipo", json={}, headers=disenador)
    assert sala.status_code == 201, sala.text
    hilo = client.post("/chat/equipo", json={"miembro_id": str(admin_user.id)}, headers=disenador)
    assert hilo.status_code == 201

    # Un ticket de soporte de un cliente no le aparece ni lo puede abrir.
    ticket = ConversacionChat(id=str(uuid4()), tipo=TipoConversacion.soporte.value,
                              solicitante_id=None, asunto="Ayuda")
    db_session.add(ticket)
    db_session.commit()
    ids = {c["id"] for c in client.get("/chat/conversaciones", headers=disenador).json()}
    assert ticket.id not in ids
    assert ids >= {sala.json()["id"], hilo.json()["id"]}
    assert client.get(f"/chat/conversaciones/{ticket.id}/mensajes", headers=disenador).status_code in (403, 404)
    assert client.get("/chat/equipo/miembros", headers=comprador).status_code == 403


def test_admin_crea_y_lista_designers(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    r = client.post("/admin/disenadores", json={
        "email": f"diseno_{uuid4().hex[:6]}@example.com", "password": "ClaveSegura1", "nombre": "Dani Diseño"},
        headers=admin)
    assert r.status_code == 201, r.text
    filas = client.get("/admin/disenadores", headers=admin).json()
    assert any(f["id"] == r.json()["id"] and f["publicados"] == 0 for f in filas)
    _, soporte = crear_usuario_con_token(db_session, rol="soporte")
    assert client.post("/admin/disenadores", json={
        "email": "x@example.com", "password": "ClaveSegura1", "nombre": "X"}, headers=soporte).status_code == 403


def _publicado_sin_diseno(client, db_session, admin_user, admin, nombre, url):
    """Algo publicado sin pasar por diseño (admin directo, o de antes del equipo)."""
    _, comprador = crear_usuario_con_token(db_session)
    item_id = client.post("/tendencias/enviar", json={"url": url}, headers=comprador).json()["id"]
    client.patch(f"/tendencias/items/{item_id}", json={
        "nombre": nombre, "categoria": "Hogar", "portada_url": _imagen(db_session, admin_user.id)}, headers=admin)
    r = client.post(f"/tendencias/items/{item_id}/aprobar", json={"publicar": True}, headers=admin)
    assert r.json()["estado"] == "publicado"
    return item_id


def test_el_designer_retoca_lo_publicado_sin_identidad(client, db_session):
    admin_user, admin = crear_usuario_con_token(db_session, rol="admin")
    disenador_user, disenador = crear_usuario_con_token(db_session, rol="designer")
    lampara = _publicado_sin_diseno(client, db_session, admin_user, admin, "Lámpara lunar", YOUTUBE)
    termo = _publicado_sin_diseno(client, db_session, admin_user, admin, "Termo inteligente",
                                  "https://www.youtube.com/watch?v=jNQXAC9IVRw")

    sin_diseno = client.get("/tendencias/diseno/publicados?filtro=sin_diseno", headers=disenador).json()
    assert {i["id"] for i in sin_diseno} == {lampara, termo}
    assert all(i["con_identidad"] is False for i in sin_diseno)
    assert client.get("/tendencias/diseno/contadores", headers=disenador).json()["publicados_sin_diseno"] == 2
    buscados = client.get("/tendencias/diseno/publicados?q=termo", headers=disenador).json()
    assert [i["id"] for i in buscados] == [termo]

    # Cambiarle la portada a algo publicado lo deja con la identidad de Zarpi y sigue publicado.
    nueva = _imagen(db_session, disenador_user.id)
    r = client.patch(f"/tendencias/diseno/items/{lampara}", json={"portada_url": nueva}, headers=disenador)
    assert r.status_code == 200 and r.json()["estado"] == "publicado" and r.json()["con_identidad"] is True
    assert client.get(f"/tendencias/items/{lampara}").json()["portada_url"] == nueva
    # Un publicado no puede quedar sin portada.
    r = client.patch(f"/tendencias/diseno/items/{lampara}", json={"portada_url": ""}, headers=disenador)
    assert r.status_code == 400

    # Si ya está bien, se marca como revisado sin cambiar nada.
    r = client.post(f"/tendencias/diseno/items/{termo}/revisado", headers=disenador)
    assert r.status_code == 200 and r.json()["con_identidad"] is True
    assert client.get("/tendencias/diseno/publicados?filtro=sin_diseno", headers=disenador).json() == []
    mios = client.get("/tendencias/diseno/publicados?filtro=mios", headers=disenador).json()
    assert {i["id"] for i in mios} == {lampara, termo}

    _, comprador = crear_usuario_con_token(db_session)
    assert client.post(f"/tendencias/diseno/items/{termo}/revisado", headers=comprador).status_code == 403
