"""Carrusel de videos de "Quiénes somos" en la Landing."""
import json
from pathlib import Path
from uuid import uuid4

from conftest import crear_usuario_con_token
from models.documental import Archivo
from models.landing import LandingBlock


def _video(db_session, owner_id):
    archivo_id = str(uuid4())
    ruta = Path("uploads/documentos") / f"{archivo_id}_landing.mp4"
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(b"\x00\x00\x00\x18ftypmp42")
    db_session.add(Archivo(
        id=archivo_id, owner_user_id=owner_id, nombre="landing.mp4", extension="mp4", mime_type="video/mp4",
        tipo_recurso="video", size_bytes=12, storage_path=str(ruta),
        storage_url=f"/documentos/archivos/{archivo_id}/descargar", origen="landing",
    ))
    db_session.commit()
    return f"/documentos/archivos/{archivo_id}/descargar"


def _limpiar(db_session):
    db_session.query(LandingBlock).delete()
    db_session.commit()


def test_guardar_videos_y_verlos_en_la_landing_sin_sesion(client, db_session):
    _limpiar(db_session)
    admin_user, admin = crear_usuario_con_token(db_session, rol="admin")
    h1, v1, v2 = (_video(db_session, admin_user.id) for _ in range(3))

    r = client.put("/landing/videos-quienes-somos", json={
        "intervalo_segundos": 30,
        "videos": [
            {"titulo": "Quiénes somos", "horizontal": h1, "vertical": v1},
            {"vertical": v2},
        ],
    }, headers=admin)
    assert r.status_code == 200, r.text
    assert r.json()["tipo"] == "video_rotativo" and r.json()["seccion"] == "about"

    bloques = client.get("/landing/dynamic-content").json()["blocks"]
    carrusel = next(b for b in bloques if b["tipo"] == "video_rotativo")
    contenido = json.loads(carrusel["contenido"])
    assert contenido["intervalo_segundos"] == 30
    assert [v["vertical"] for v in contenido["videos"]] == [v1, v2]
    assert all(v["id"] for v in contenido["videos"])
    # Público: un visitante sin sesión puede reproducirlos.
    assert client.get(v2).status_code == 200
    _limpiar(db_session)


def test_guardar_estructura_no_borra_el_carrusel(client, db_session):
    _limpiar(db_session)
    admin_user, admin = crear_usuario_con_token(db_session, rol="admin")
    client.put("/landing/videos-quienes-somos", json={"videos": [{"horizontal": _video(db_session, admin_user.id)}]},
               headers=admin)

    r = client.put("/landing/dynamic-content", json={"blocks": [
        {"seccion": "news", "tipo": "paragraph", "contenido": "Hola"},
    ]}, headers=admin)
    assert r.status_code == 200, r.text
    tipos = {b["tipo"] for b in client.get("/landing/dynamic-content").json()["blocks"]}
    assert tipos == {"paragraph", "video_rotativo"}
    _limpiar(db_session)


def test_validaciones(client, db_session):
    _limpiar(db_session)
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    ruta = "/documentos/archivos/x/descargar"
    casos = [
        {"videos": [{"titulo": "Sin archivos"}]},
        {"videos": [{"horizontal": "https://youtube.com/watch?v=x"}]},
        {"intervalo_segundos": 2, "videos": [{"horizontal": ruta}]},
        {"videos": [{"horizontal": ruta}] * 11},
    ]
    for caso in casos:
        assert client.put("/landing/videos-quienes-somos", json=caso, headers=admin).status_code == 422, caso


def test_sin_videos_el_carrusel_queda_inactivo_y_solo_admin(client, db_session):
    _limpiar(db_session)
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    _, comprador = crear_usuario_con_token(db_session)
    assert client.put("/landing/videos-quienes-somos", json={"videos": []}, headers=comprador).status_code == 403
    r = client.put("/landing/videos-quienes-somos", json={"videos": []}, headers=admin)
    assert r.json()["activo"] is False
    _limpiar(db_session)
