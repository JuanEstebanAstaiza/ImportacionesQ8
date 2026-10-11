"""Catálogo del equipo (admin › Tendencias), muro de pago con vista previa,
interruptor «gratis» y módulos que el admin enciende o apaga."""
from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

import pytest

from conftest import crear_usuario_con_token
from models.documental import Archivo
from models.tendencias_virales import TendenciaItem
from services import enlaces_video as ev
from services import tendencias as svc_acceso


@pytest.fixture(autouse=True)
def config_limpia(db_session):
    """El interruptor «gratis» y los módulos viven en la base: no deben pasar a otras pruebas."""
    yield
    from models.configuracion import ConfiguracionPlataforma

    db_session.query(ConfiguracionPlataforma).filter(ConfiguracionPlataforma.clave.in_(
        ("tendencias.gratis", "modulos.academico", "tendencias.precio_cop", "tendencias.dias_suscripcion"))
    ).delete(synchronize_session=False)
    db_session.commit()


@pytest.fixture(autouse=True)
def oembed_simulado(monkeypatch):
    def falso(enlace, cliente=None):
        enlace.autor = "Canal Original"
        return enlace
    monkeypatch.setattr(ev, "consultar_oembed", falso)


def _imagen(db_session, owner_id):
    archivo_id = str(uuid4())
    ruta = Path("uploads/documentos") / f"{archivo_id}_cat.png"
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(b"\x89PNG\r\n\x1a\n")
    db_session.add(Archivo(
        id=archivo_id, owner_user_id=owner_id, nombre="cat.png", extension="png", mime_type="image/png",
        tipo_recurso="imagen", size_bytes=8, storage_path=str(ruta),
        storage_url=f"/documentos/archivos/{archivo_id}/descargar", origen="tendencias",
    ))
    db_session.commit()
    return f"/documentos/archivos/{archivo_id}/descargar"


def _producto(client, db_session, admin_user, admin, n, **extra):
    datos = {
        "url": f"https://www.youtube.com/watch?v=video{n:06d}",
        "nombre": f"Producto {n}", "categoria": "Hogar",
        "descripcion": "Lámpara recargable de 3 tonos.\nBatería de 2000 mAh.",
        "portada_url": _imagen(db_session, admin_user.id),
        **extra,
    }
    r = client.post("/tendencias/catalogo", json=datos, headers=admin)
    assert r.status_code == 201, r.text
    return r.json()


def _modo_pago(client, admin, gratis):
    r = client.put("/tendencias/admin/suscripcion", json={"precio_cop": 30000, "dias_suscripcion": 30, "gratis": gratis},
                   headers=admin)
    assert r.status_code == 200 and r.json()["gratis"] is gratis


def test_el_equipo_sube_y_publica_su_catalogo(client, db_session):
    admin_user, admin = crear_usuario_con_token(db_session, rol="admin")
    extras = [_imagen(db_session, admin_user.id) for _ in range(2)]
    p = _producto(client, db_session, admin_user, admin, 1, imagenes=extras, autor_plataforma="@tienda_viral",
                  por_que_tendencia="Explotó en TikTok")
    assert p["estado"] == "publicado" and p["con_identidad"] is True and p["origen"] == "equipo"
    ficha = client.get(f"/tendencias/items/{p['id']}").json()  # gratis por defecto: sin sesión
    assert ficha["descripcion"].startswith("Lámpara") and ficha["autor_plataforma"] == "@tienda_viral"
    assert ficha["imagenes"] == extras

    # Sin portada pasa a diseño; el autor sale del oEmbed.
    sin_portada = _producto(client, db_session, admin_user, admin, 2, portada_url=None)
    assert sin_portada["estado"] == "en_diseno" and sin_portada["autor_plataforma"] == "Canal Original"

    # El mismo video no se sube dos veces.
    r = client.post("/tendencias/catalogo", json={"url": "https://youtu.be/video000001", "nombre": "Equis",
                                                   "categoria": "Hogar"}, headers=admin)
    assert r.status_code == 409 and r.json()["detail"]["id"] == p["id"]

    # Imágenes ajenas no.
    otro, _ = crear_usuario_con_token(db_session)
    r = client.post("/tendencias/catalogo", json={"url": "https://youtu.be/video000009", "nombre": "Ye",
                                                   "categoria": "Hogar", "portada_url": _imagen(db_session, otro.id)},
                    headers=admin)
    assert r.status_code == 403

    lista = client.get("/tendencias/catalogo?estado=todos&q=producto", headers=admin).json()
    assert {i["id"] for i in lista} == {p["id"], sin_portada["id"]}

    # Editar textos, archivar y volver a publicar.
    r = client.patch(f"/tendencias/items/{p['id']}", json={"descripcion": "Nueva descripción"}, headers=admin)
    assert r.status_code == 200
    assert client.post(f"/tendencias/items/{p['id']}/archivar", headers=admin).json()["estado"] == "archivado"
    assert client.get("/tendencias/feed").json()["items"] == []
    assert client.post(f"/tendencias/items/{p['id']}/republicar", headers=admin).json()["estado"] == "publicado"
    assert client.get(f"/tendencias/items/{p['id']}").json()["descripcion"] == "Nueva descripción"

    _, comprador = crear_usuario_con_token(db_session)
    assert client.post("/tendencias/catalogo", json={"url": "https://youtu.be/video000008", "nombre": "Zeta",
                                                      "categoria": "Hogar"}, headers=comprador).status_code == 403


def test_muro_de_pago_con_vista_previa(client, db_session):
    admin_user, admin = crear_usuario_con_token(db_session, rol="admin")
    ids = [_producto(client, db_session, admin_user, admin, n)["id"] for n in range(10)]
    _modo_pago(client, admin, gratis=False)

    # Visitante: vista previa (8 portadas), la ficha pide suscripción.
    feed = client.get("/tendencias/feed").json()
    assert feed["acceso"] == {"completo": False, "gratis": False, "total": 10, "ocultos": 2}
    assert len(feed["items"]) == svc_acceso.LIMITE_VISTA_PREVIA
    r = client.get(f"/tendencias/items/{ids[0]}")
    assert r.status_code == 402
    assert r.json()["detail"]["codigo"] == "requiere_suscripcion" and "embed_url" not in r.text

    # Comprador sin suscripción: igual.
    comprador_user, comprador = crear_usuario_con_token(db_session)
    assert client.get(f"/tendencias/items/{ids[0]}", headers=comprador).status_code == 402
    assert client.get("/tendencias/acceso", headers=comprador).json()["tiene_acceso"] is False
    # Con una cortesía (o suscripción) ve todo.
    svc_acceso.otorgar_acceso(db_session, usuario_id=comprador_user.id, dias=30, origen="cortesia")
    db_session.commit()
    assert client.get(f"/tendencias/items/{ids[0]}", headers=comprador).status_code == 200
    assert client.get("/tendencias/feed", headers=comprador).json()["acceso"]["completo"] is True

    # Diseño y el equipo ven todo.
    _, disenador = crear_usuario_con_token(db_session, rol="designer")
    assert client.get(f"/tendencias/items/{ids[0]}", headers=disenador).status_code == 200

    # Interruptor «gratis»: abierto para todos otra vez.
    _modo_pago(client, admin, gratis=True)
    assert client.get(f"/tendencias/items/{ids[0]}").status_code == 200
    assert client.get("/tendencias/feed").json()["acceso"]["completo"] is True


def test_la_landing_trae_los_mas_recientes_de_todas_las_semanas(client, db_session):
    admin_user, admin = crear_usuario_con_token(db_session, rol="admin")
    viejo = _producto(client, db_session, admin_user, admin, 1)
    db_session.query(TendenciaItem).filter(TendenciaItem.id == viejo["id"]).update(
        {"semana": date.today() - timedelta(days=30)})
    db_session.commit()
    nuevo = _producto(client, db_session, admin_user, admin, 2)
    assert [i["id"] for i in client.get("/tendencias/feed").json()["items"]] == [nuevo["id"]]
    recientes = client.get("/tendencias/feed?recientes=true&limite=8").json()["items"]
    assert {i["id"] for i in recientes} == {viejo["id"], nuevo["id"]}


def test_el_admin_apaga_el_modulo_academico(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    _, soporte = crear_usuario_con_token(db_session, rol="soporte")
    assert client.get("/admin/modulos", headers=soporte).status_code == 403

    r = client.put("/admin/modulos", json={"academico": False}, headers=admin)
    assert r.status_code == 200 and r.json()["academico"]["activo"] is False
    assert client.get("/configuracion-publica").json()["modulo_educativo_habilitado"] is False
    assert client.get("/cursos").status_code == 404

    client.put("/admin/modulos", json={"academico": True}, headers=admin)
    assert client.get("/configuracion-publica").json()["modulo_educativo_habilitado"] is True
    assert client.get("/cursos").status_code == 200
