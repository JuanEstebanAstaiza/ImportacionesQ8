"""Tendencias v2: enlaces, aprobación, feed, ficha y solicitudes atribuidas.

Criterios de aceptación: docs/Tendencias · Guía de construcción.html, sección 8.
"""
from pathlib import Path
from uuid import uuid4

import httpx
import pytest

from conftest import auth_headers_for, crear_empresa_importadora, crear_usuario_con_token
from models.documental import Archivo
from models.tendencias_virales import TendenciaItem
from services import enlaces_video as ev

TIKTOK = "https://www.tiktok.com/@tienda.viral/video/7300000000000000001"
YOUTUBE = "https://youtu.be/dQw4w9WgXcQ"
# El fixture de abajo reemplaza el oEmbed para el flujo completo; las pruebas
# unitarias usan el real con un transporte simulado.
_OEMBED_REAL = ev.consultar_oembed


# ── Normalización (sin red) ──────────────────────────────────────────────────

@pytest.mark.parametrize("url, plataforma, id_video, normalizada", [
    (TIKTOK + "?is_from_webapp=1&sender_device=pc#comentarios", "tiktok", "7300000000000000001",
     "https://www.tiktok.com/video/7300000000000000001"),
    ("tiktok.com/@otra.cuenta/video/7300000000000000001", "tiktok", "7300000000000000001",
     "https://www.tiktok.com/video/7300000000000000001"),
    ("https://m.tiktok.com/v/7300000000000000001.html", "tiktok", "7300000000000000001",
     "https://www.tiktok.com/video/7300000000000000001"),
    ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&si=abc", "youtube", "dQw4w9WgXcQ",
     "https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    (YOUTUBE + "?si=xyz", "youtube", "dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ("https://youtube.com/shorts/dQw4w9WgXcQ?feature=share", "youtube", "dQw4w9WgXcQ",
     "https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ("https://www.instagram.com/reel/C1a2B3c4D5e/?igsh=xyz", "instagram", "C1a2B3c4D5e",
     "https://www.instagram.com/p/C1a2B3c4D5e/"),
])
def test_normaliza_y_extrae_el_id(url, plataforma, id_video, normalizada):
    enlace = ev.normalizar(url)
    assert (enlace.plataforma, enlace.id_video, enlace.normalizada) == (plataforma, id_video, normalizada)


@pytest.mark.parametrize("url", [
    "https://vimeo.com/123456", "https://evil.com/tiktok.com/@a/video/7300000000000000001",
    "https://www.tiktok.com/@solo.perfil", "https://www.youtube.com/watch?v=corto", "", "javascript:alert(1)",
])
def test_rechaza_enlaces_no_validos(url):
    with pytest.raises(ev.EnlaceInvalido):
        ev.normalizar(url)


def test_el_enlace_corto_no_puede_salir_de_tiktok():
    def respuesta(request):
        return httpx.Response(302, headers={"location": "https://evil.example.com/robar"})

    cliente = httpx.Client(transport=httpx.MockTransport(respuesta))
    with pytest.raises(ev.EnlaceInvalido):
        ev.normalizar("https://vm.tiktok.com/ZMabc123/", cliente)


def test_resuelve_el_enlace_corto_de_tiktok():
    def respuesta(request):
        return httpx.Response(301, headers={"location": TIKTOK + "?_r=1"})

    cliente = httpx.Client(transport=httpx.MockTransport(respuesta))
    assert ev.normalizar("https://vm.tiktok.com/ZMabc123/", cliente).id_video == "7300000000000000001"


def test_oembed_marca_videos_caidos():
    cliente = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(404)))
    with pytest.raises(ev.VideoNoDisponible):
        _OEMBED_REAL(ev.normalizar(YOUTUBE), cliente)


def test_embed_url_solo_desde_ids_validos():
    assert ev.embed_url("youtube", "dQw4w9WgXcQ") == "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
    assert ev.embed_url("tiktok", "7300000000000000001") == "https://www.tiktok.com/embed/v2/7300000000000000001"
    assert ev.embed_url("youtube", '"><script>') is None


# ── Flujo completo ───────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def oembed_simulado(monkeypatch):
    """Sin red: el oEmbed devuelve el autor y una miniatura de la plataforma."""
    def falso(enlace, cliente=None):
        enlace.autor = "Autor de prueba"
        enlace.miniatura_url = "https://p16.tiktokcdn.com/miniatura.jpg"
        return enlace

    monkeypatch.setattr(ev, "consultar_oembed", falso)


def _imagen(db_session, owner_id):
    archivo_id = str(uuid4())
    ruta = Path("uploads/documentos") / f"{archivo_id}_portada.png"
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(b"\x89PNG\r\n\x1a\n")
    db_session.add(Archivo(
        id=archivo_id, owner_user_id=owner_id, nombre="portada.png", extension="png", mime_type="image/png",
        tipo_recurso="imagen", size_bytes=8, storage_path=str(ruta),
        storage_url=f"/documentos/archivos/{archivo_id}/descargar", origen="tendencias",
    ))
    db_session.commit()
    return f"/documentos/archivos/{archivo_id}/descargar"


def _publicar(client, db_session, aprobador_user, aprobador, item_id, **ficha):
    """Flujo completo: el aprobador aprueba (pasa a diseño) y un designer pone
    la portada y publica."""
    r = client.patch(f"/tendencias/items/{item_id}", json={
        "nombre": "Mini proyector portátil", "categoria": "Tecnología",
        "por_que_tendencia": "Explotó en TikTok con los videos de cine en casa.", **ficha,
    }, headers=aprobador)
    assert r.status_code == 200, r.text
    r = client.post(f"/tendencias/items/{item_id}/aprobar", json={}, headers=aprobador)
    assert r.status_code == 200 and r.json()["estado"] == "en_diseno", r.text
    disenador_user, disenador = crear_usuario_con_token(db_session, rol="designer")
    portada = _imagen(db_session, disenador_user.id)
    r = client.patch(f"/tendencias/diseno/items/{item_id}", json={"portada_url": portada}, headers=disenador)
    assert r.status_code == 200, r.text
    r = client.post(f"/tendencias/diseno/items/{item_id}/publicar", headers=disenador)
    assert r.status_code == 200, r.text
    return r.json()


def test_el_mismo_video_con_y_sin_parametros_crea_una_sola_ficha(client, db_session):
    _, comprador = crear_usuario_con_token(db_session)
    _, otro = crear_usuario_con_token(db_session)
    r1 = client.post("/tendencias/enviar", json={"url": TIKTOK}, headers=comprador)
    assert r1.status_code == 200 and r1.json()["estado"] == "recibido"
    r2 = client.post("/tendencias/enviar", json={"url": TIKTOK + "?is_from_webapp=1#x"}, headers=otro)
    assert r2.json()["estado"] == "duplicado"
    assert "otra persona" in r2.json()["mensaje"]
    r3 = client.post("/tendencias/enviar", json={"url": TIKTOK}, headers=comprador)
    assert "subido tú" in r3.json()["mensaje"]
    assert db_session.query(TendenciaItem).count() == 1


def test_enlace_no_valido_responde_422(client, db_session):
    _, comprador = crear_usuario_con_token(db_session)
    r = client.post("/tendencias/enviar", json={"url": "https://vimeo.com/1"}, headers=comprador)
    assert r.status_code == 422
    assert "TikTok, Instagram o YouTube" in r.json()["detail"]


def test_no_se_publica_sin_portada_y_el_feed_no_trae_embeds(client, db_session):
    aprobador_user, aprobador = crear_usuario_con_token(db_session, rol="admin")
    _, comprador = crear_usuario_con_token(db_session)
    item_id = client.post("/tendencias/enviar", json={"url": YOUTUBE}, headers=comprador).json()["id"]

    client.patch(f"/tendencias/items/{item_id}", json={"nombre": "Lámpara", "categoria": "Hogar"}, headers=aprobador)
    r = client.post(f"/tendencias/items/{item_id}/aprobar", json={}, headers=aprobador)
    assert r.json()["estado"] == "en_diseno"
    assert client.get("/tendencias/feed").json()["items"] == []
    _, disenador = crear_usuario_con_token(db_session, rol="designer")
    r = client.post(f"/tendencias/diseno/items/{item_id}/publicar", headers=disenador)
    assert r.status_code == 400 and "portada" in r.json()["detail"]
    db_session.query(TendenciaItem).filter(TendenciaItem.id == item_id).update({"estado": "pendiente"})
    db_session.commit()

    publicado = _publicar(client, db_session, aprobador_user, aprobador, item_id)
    assert publicado["estado"] == "publicado"

    feed = client.get("/tendencias/feed").json()  # sin sesión
    assert [i["id"] for i in feed["items"]] == [item_id]
    assert "embed_url" not in feed["items"][0] and "embed_html" not in str(feed)
    ficha = client.get(f"/tendencias/items/{item_id}").json()
    assert ficha["embed_url"] == "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
    assert "El video pertenece a su autor" in ficha["pie"]
    # La portada de un publicado se ve sin sesión.
    assert client.get(ficha["portada_url"]).status_code == 200


def test_ninguna_ruta_guarda_video(client, db_session):
    _, comprador = crear_usuario_con_token(db_session)
    antes = db_session.query(Archivo).count()
    client.post("/tendencias/enviar", json={"url": TIKTOK}, headers=comprador)
    assert db_session.query(Archivo).count() == antes


def test_rechazo_con_motivo(client, db_session):
    _, aprobador = crear_usuario_con_token(db_session, rol="admin")
    _, comprador = crear_usuario_con_token(db_session)
    item_id = client.post("/tendencias/enviar", json={"url": TIKTOK}, headers=comprador).json()["id"]
    assert client.post(f"/tendencias/items/{item_id}/rechazar", json={"motivo": "otro"}, headers=aprobador).status_code == 422
    r = client.post(f"/tendencias/items/{item_id}/rechazar", json={"motivo": "marca_replica"}, headers=aprobador)
    assert r.json()["estado"] == "rechazado"
    assert client.post(f"/tendencias/items/{item_id}/aprobar", json={}, headers=aprobador).status_code == 409
    envios = client.get("/tendencias/mis-envios", headers=comprador).json()
    assert envios[0]["motivo_rechazo"] == "Es una marca o una réplica"


def test_cola_y_contadores_del_aprobador(client, db_session):
    usuario, aprobador = crear_usuario_con_token(db_session, rol="soporte")
    usuario.es_curador = True
    db_session.commit()
    _, comprador = crear_usuario_con_token(db_session)
    for url in (TIKTOK, YOUTUBE):
        client.post("/tendencias/enviar", json={"url": url}, headers=comprador)
    cola = client.get("/tendencias/aprobacion/cola", headers=aprobador).json()
    assert [i["plataforma"] for i in cola] == ["tiktok", "youtube"]  # los más antiguos primero
    assert cola[0]["remitente"]["rol"] == "comunidad"
    client.post(f"/tendencias/items/{cola[0]['id']}/rechazar", json={"motivo": "calidad"}, headers=aprobador)
    assert client.get("/tendencias/aprobacion/contadores", headers=aprobador).json() == {
        "pendientes": 1, "en_diseno": 0, "aprobados_hoy": 0, "rechazados_hoy": 1}
    assert client.get("/tendencias/aprobacion/cola", headers=comprador).status_code == 403


def test_solicitud_desde_la_ficha_queda_atribuida_y_suma(client, db_session):
    aprobador_user, aprobador = crear_usuario_con_token(db_session, rol="admin")
    _, comprador = crear_usuario_con_token(db_session)
    item_id = client.post("/tendencias/enviar", json={"url": YOUTUBE}, headers=comprador).json()["id"]
    _publicar(client, db_session, aprobador_user, aprobador, item_id)

    r = client.post("/cotizaciones", json={
        "modalidad": "abierta", "pais_importacion": "China", "nombre_producto": "Mini proyector portátil",
        "descripcion_cliente": f"Lo vi en Tendencias: {YOUTUBE}", "linea_producto": "Tecnología",
        "tipo_calidad": "estandar", "cantidad_minima": 100, "origen": "tendencias", "tendencia_item_id": item_id,
    }, headers=comprador)
    assert r.status_code == 201, r.text
    assert r.json()["tendencia_item_id"] == item_id
    ficha = client.get(f"/tendencias/items/{item_id}").json()
    assert ficha["cotizaciones_total"] == 1 and ficha["cotizaciones_semana"] == 1


def test_producto_de_importadora_solo_se_cotiza_con_ella(client, db_session):
    importador, dueno = crear_empresa_importadora(db_session, nombre_empresa="Andes Import")
    otra, _ = crear_empresa_importadora(db_session, nombre_empresa="Otra")
    empresa = auth_headers_for(dueno)
    foto = _imagen(db_session, dueno.id)
    r = client.post("/tendencias/enviar", json={"url": TIKTOK, "portada_url": foto, "nombre": "Termo"}, headers=empresa)
    item_id = r.json()["id"]
    item = db_session.query(TendenciaItem).filter(TendenciaItem.id == item_id).one()
    assert item.rol_remitente == "importadora" and item.importador_id == importador.id and item.portada_url == foto

    aprobador_user, aprobador = crear_usuario_con_token(db_session, rol="admin")
    client.patch(f"/tendencias/items/{item_id}", json={"categoria": "Hogar"}, headers=aprobador)
    assert client.post(f"/tendencias/items/{item_id}/aprobar", json={}, headers=aprobador).json()["estado"] == "en_diseno"
    # El designer puede publicar con la foto que propuso la importadora.
    _, disenador = crear_usuario_con_token(db_session, rol="designer")
    assert client.post(f"/tendencias/diseno/items/{item_id}/publicar", headers=disenador).json()["estado"] == "publicado"
    ficha = client.get(f"/tendencias/items/{item_id}").json()
    assert ficha["origen"] == "importadora" and ficha["empresa"]["nombre"] == "Andes Import"
    assert [i["id"] for i in client.get(f"/tendencias/feed?importador_id={importador.id}").json()["items"]] == [item_id]

    _, comprador = crear_usuario_con_token(db_session)
    base = {"pais_importacion": "China", "nombre_producto": "Termo", "descripcion_cliente": "Termo visto en Tendencias",
            "linea_producto": "Textiles", "tipo_calidad": "estandar", "cantidad_minima": 100,
            "origen": "tendencias", "tendencia_item_id": item_id}
    assert client.post("/cotizaciones", json={**base, "modalidad": "abierta"}, headers=comprador).status_code == 400
    assert client.post("/cotizaciones", json={**base, "modalidad": "dirigida", "importador_id": otra.id},
                       headers=comprador).status_code == 400
    r = client.post("/cotizaciones", json={**base, "modalidad": "dirigida", "importador_id": importador.id},
                    headers=comprador)
    assert r.status_code == 201, r.text


def test_una_importadora_no_puede_usar_fotos_ajenas_como_portada(client, db_session):
    _, dueno = crear_empresa_importadora(db_session)
    ajeno, _ = crear_usuario_con_token(db_session)
    foto_ajena = _imagen(db_session, ajeno.id)
    r = client.post("/tendencias/enviar", json={"url": TIKTOK, "portada_url": foto_ajena}, headers=auth_headers_for(dueno))
    assert r.status_code == 403


def test_instagram_el_codigo_de_insercion_debe_ser_del_mismo_post(client, db_session):
    _, aprobador = crear_usuario_con_token(db_session, rol="admin")
    _, comprador = crear_usuario_con_token(db_session)
    item_id = client.post("/tendencias/enviar", json={"url": "https://www.instagram.com/reel/C1a2B3c4D5e/"},
                          headers=comprador).json()["id"]
    otro = '<blockquote data-instgrm-permalink="https://www.instagram.com/p/ZZZZZZZZZZZ/"></blockquote>'
    assert client.patch(f"/tendencias/items/{item_id}", json={"embed_html": otro}, headers=aprobador).status_code == 400
    propio = '<blockquote data-instgrm-permalink="https://www.instagram.com/reel/C1a2B3c4D5e/?utm_source=ig"></blockquote>'
    assert client.patch(f"/tendencias/items/{item_id}", json={"embed_html": propio}, headers=aprobador).status_code == 200


def test_tarea_diaria_saca_del_feed_los_videos_caidos(client, db_session, monkeypatch):
    from services import tendencias_virales

    aprobador_user, aprobador = crear_usuario_con_token(db_session, rol="admin")
    _, comprador = crear_usuario_con_token(db_session)
    item_id = client.post("/tendencias/enviar", json={"url": YOUTUBE}, headers=comprador).json()["id"]
    _publicar(client, db_session, aprobador_user, aprobador, item_id)

    def caido(enlace, cliente=None):
        raise ev.VideoNoDisponible(enlace.normalizada)

    monkeypatch.setattr(ev, "consultar_oembed", caido)
    assert tendencias_virales.verificar_publicados(db_session) == 1
    assert client.get("/tendencias/feed").json()["items"] == []
    assert client.get(f"/tendencias/items/{item_id}").status_code == 404
