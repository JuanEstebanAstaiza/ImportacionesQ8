"""Cursos propios de Zarpi: los crea, edita y elimina el admin (sin empresa) y
en el catálogo salen como publicados por «Zarpi»."""
from conftest import auth_headers_for, crear_empresa_importadora, crear_usuario_con_token
from tests.test_cursos import CURSO_PAYLOAD

CURSO_ZARPI = {**CURSO_PAYLOAD, "titulo": "Cómo importar de manera profesional", "precio": 2_000_000}


def test_el_admin_crea_edita_y_elimina_cursos_de_zarpi(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    r = client.post("/cursos", json=CURSO_ZARPI, headers=admin)
    assert r.status_code == 201, r.text
    curso = r.json()
    assert curso["importador_id"] is None and curso["importadora_nombre"] == "Zarpi"
    assert curso["precio"] == 2_000_000

    catalogo = client.get("/cursos").json()
    assert [(c["id"], c["importadora_nombre"]) for c in catalogo] == [(curso["id"], "Zarpi")]
    assert client.get("/admin/cursos/catalogo", headers=admin).json()[0]["importadora_nombre"] == "Zarpi"

    r = client.put(f"/cursos/{curso['id']}", json={"precio": 1_500_000, "estado": "borrador"}, headers=admin)
    assert r.status_code == 200, r.text
    assert r.json()["precio"] == 1_500_000
    # En borrador lo ve el admin; los demás, no.
    _, alumno = crear_usuario_con_token(db_session)
    assert client.get(f"/cursos/{curso['id']}", headers=admin).status_code == 200
    assert client.get(f"/cursos/{curso['id']}", headers=alumno).status_code == 404
    assert client.get(f"/cursos/{curso['id']}").status_code == 404

    assert client.delete(f"/cursos/{curso['id']}", headers=admin).status_code == 200
    assert client.get("/cursos").json() == []


def test_cada_quien_edita_solo_los_suyos(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    _, dueño = crear_empresa_importadora(db_session, nombre_empresa="Importadora Cursos",
                                         email_dueño="cursos_propios@example.com")
    de_zarpi = client.post("/cursos", json=CURSO_ZARPI, headers=admin).json()
    de_empresa = client.post("/cursos", json=CURSO_PAYLOAD, headers=auth_headers_for(dueño)).json()
    assert de_empresa["importadora_nombre"] == "Importadora Cursos"

    assert client.put(f"/cursos/{de_zarpi['id']}", json={"precio": 1}, headers=auth_headers_for(dueño)).status_code == 403
    assert client.delete(f"/cursos/{de_zarpi['id']}", headers=auth_headers_for(dueño)).status_code == 403
    assert client.put(f"/cursos/{de_empresa['id']}", json={"precio": 1}, headers=admin).status_code == 403
    _, alumno = crear_usuario_con_token(db_session)
    assert client.post("/cursos", json=CURSO_ZARPI, headers=alumno).status_code == 403


def test_un_alumno_toma_un_curso_de_zarpi(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    curso = client.post("/cursos", json=CURSO_ZARPI, headers=admin).json()
    _, alumno = crear_usuario_con_token(db_session)
    # Sin pago manual (apagado en tests), la compra es directa.
    assert client.post(f"/cursos/{curso['id']}/comprar", headers=alumno).status_code == 201
    detalle = client.get(f"/cursos/{curso['id']}", headers=alumno).json()
    assert detalle["comprado"] is True and detalle["importadora_nombre"] == "Zarpi"
    assert detalle["modulos"][0]["lecciones"][0]["video_url"]
