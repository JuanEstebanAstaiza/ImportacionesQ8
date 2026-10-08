"""Fuente de los bloques de la landing: títulos/texto (siguen a la tipografía
de la plataforma) o las de marca fijas."""
from conftest import crear_usuario_con_token
from models.landing import LandingBlock


def _limpiar(db_session):
    db_session.query(LandingBlock).delete()
    db_session.commit()


def test_fuentes_de_bloque(client, db_session):
    _limpiar(db_session)
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    r = client.put("/landing/dynamic-content", headers=admin, json={"blocks": [
        {"seccion": "news", "tipo": "heading", "contenido": "Título", "fuente": "titulos", "orden": 1},
        {"seccion": "news", "tipo": "paragraph", "contenido": "Línea 1\nLínea 2", "fuente": "Texto", "orden": 2},
        {"seccion": "news", "tipo": "paragraph", "contenido": "Marca", "fuente": "elvellon", "orden": 3},
        {"seccion": "news", "tipo": "paragraph", "contenido": "Sin fuente", "orden": 4},
    ]})
    assert r.status_code == 200, r.text
    bloques = sorted(client.get("/landing/dynamic-content").json()["blocks"], key=lambda b: b["orden"])
    assert [b["fuente"] for b in bloques] == ["titulos", "texto", "elvellon", "texto"]
    # Los saltos de línea del párrafo se guardan tal cual.
    assert bloques[1]["contenido"] == "Línea 1\nLínea 2"

    r = client.put("/landing/dynamic-content", headers=admin, json={"blocks": [
        {"seccion": "news", "tipo": "paragraph", "contenido": "x", "fuente": "comic-sans"},
    ]})
    assert r.status_code == 422
    _limpiar(db_session)
