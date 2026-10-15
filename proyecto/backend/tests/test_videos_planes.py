"""Video de la tarjeta de cada plan (Admin › Planes).

Se guarda sin migración, en un bloque de la Landing (ver
services/videos_planes.py): estas pruebas cuidan que el video salga en
`GET /planes`, que se reproduzca sin sesión, que deje de ser público al
quitarlo y que el editor de la Landing ni lo vea ni lo borre.
"""
from conftest import crear_usuario_con_token
from models.landing import LandingBlock
from models.plan import Plan
from tests.test_landing_videos import _video


def _limpiar(db_session):
    db_session.query(LandingBlock).delete()
    db_session.query(Plan).filter(Plan.clave.like("video-%")).delete(synchronize_session=False)
    db_session.commit()


def _plan(client, admin, clave):
    r = client.post("/planes/admin/planes", json={"clave": clave, "nombre": f"Plan {clave}", "precio_cop": 100000},
                    headers=admin)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_el_video_sale_en_la_tarjeta_y_se_reproduce_sin_sesion(client, db_session):
    _limpiar(db_session)
    admin_user, admin = crear_usuario_con_token(db_session, rol="admin")
    plan_id, otro_id = _plan(client, admin, "video-a"), _plan(client, admin, "video-b")
    horizontal, vertical = _video(db_session, admin_user.id), _video(db_session, admin_user.id)

    # Antes de asignarlo, el archivo es privado.
    assert client.get(horizontal).status_code in (401, 403)

    r = client.put(f"/planes/admin/planes/{plan_id}/video",
                   json={"titulo": "Así funciona", "horizontal": horizontal, "vertical": vertical}, headers=admin)
    assert r.status_code == 200, r.text

    planes = {p["id"]: p for p in client.get("/planes").json()["planes"]}
    assert planes[plan_id]["video"] == {"horizontal": horizontal, "vertical": vertical, "titulo": "Así funciona"}
    assert planes[otro_id]["video"] is None
    assert client.get(horizontal).status_code == 200 and client.get(vertical).status_code == 200

    # Quitarlo deja de publicar el archivo.
    assert client.delete(f"/planes/admin/planes/{plan_id}/video", headers=admin).status_code == 200
    assert next(p for p in client.get("/planes").json()["planes"] if p["id"] == plan_id)["video"] is None
    assert client.get(horizontal).status_code in (401, 403)
    _limpiar(db_session)


def test_el_editor_de_la_landing_no_lo_ve_ni_lo_borra(client, db_session):
    _limpiar(db_session)
    admin_user, admin = crear_usuario_con_token(db_session, rol="admin")
    plan_id = _plan(client, admin, "video-c")
    video = _video(db_session, admin_user.id)
    client.put(f"/planes/admin/planes/{plan_id}/video", json={"vertical": video}, headers=admin)

    assert all(b["tipo"] != "videos_planes" for b in client.get("/landing/dynamic-content").json()["blocks"])
    assert all(b["tipo"] != "videos_planes"
               for b in client.get("/landing/dynamic-content/admin", headers=admin).json()["blocks"])
    r = client.put("/landing/dynamic-content", json={"blocks": [{"seccion": "news", "tipo": "paragraph",
                                                                 "contenido": "Hola"}]}, headers=admin)
    assert r.status_code == 200, r.text
    assert next(p for p in client.get("/planes").json()["planes"] if p["id"] == plan_id)["video"]["vertical"] == video
    _limpiar(db_session)


def test_validaciones_y_permisos(client, db_session):
    _limpiar(db_session)
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    _, comprador = crear_usuario_con_token(db_session)
    plan_id = _plan(client, admin, "video-d")
    ruta = "/documentos/archivos/x/descargar"
    assert client.put(f"/planes/admin/planes/{plan_id}/video", json={"horizontal": ruta}, headers=comprador).status_code == 403
    # Sin archivo, o con una URL de afuera.
    assert client.put(f"/planes/admin/planes/{plan_id}/video", json={}, headers=admin).status_code == 422
    assert client.put(f"/planes/admin/planes/{plan_id}/video", json={"horizontal": "https://x.com/v.mp4"},
                      headers=admin).status_code == 422
    assert client.put("/planes/admin/planes/no-existe/video", json={"horizontal": ruta}, headers=admin).status_code == 404
    _limpiar(db_session)
