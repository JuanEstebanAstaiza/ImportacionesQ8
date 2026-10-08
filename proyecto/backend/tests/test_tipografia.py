"""Tipografía de la plataforma: catálogo, instalación en el servidor y CSS."""
import pytest

from conftest import crear_usuario_con_token
from services import configuracion
from services import tipografia as svc

WOFF2 = b"wOF2" + b"\x00" * 60
CDN = "https://cdn.jsdelivr.net/fontsource/fonts"


def _fuente(fid, licencia="OFL-1.1", categoria="sans-serif", subsets=("latin", "latin-ext"), weights=(300, 400, 700)):
    return {"id": fid, "family": fid.title(), "license": licencia, "category": categoria,
            "subsets": list(subsets), "weights": list(weights), "styles": ["normal", "italic"],
            "variable": False, "type": "google"}


def _detalle(fid, url_base=CDN, **kw):
    datos = _fuente(fid, **kw)
    datos["unicodeRange"] = {"latin": "U+0000-00FF,U+0131", "latin-ext": "U+0100-02BA"}
    datos["variants"] = {
        str(w): {e: {s: {"url": {"woff2": f"{url_base}/{fid}@latest/{s}-{w}-{e}.woff2"}} for s in datos["subsets"]}
                 for e in ("normal", "italic")}
        for w in datos["weights"]
    }
    return datos


class _Resp:
    def __init__(self, cuerpo=None, contenido=b""):
        self._cuerpo, self.content = cuerpo, contenido

    def json(self):
        return self._cuerpo


@pytest.fixture()
def api(monkeypatch, tmp_path):
    """Fontsource simulada: sin red y con la carpeta de fuentes en un temporal."""
    monkeypatch.setattr(svc, "CARPETA", tmp_path / "fuentes")
    monkeypatch.setattr(svc, "CARPETA_PREVIAS", tmp_path / "fuentes" / "_previas")
    svc._catalogo_cache.update(datos=None, hasta=0.0)
    estado = {
        "lista": [
            _fuente("inter"),
            _fuente("lora", categoria="serif"),
            _fuente("cerrada", licencia="Propietaria"),
            _fuente("iconos", categoria="icons"),
            _fuente("solo-cirilico", subsets=("cyrillic",)),
        ],
        "detalles": {"inter": _detalle("inter"), "lora": _detalle("lora", categoria="serif")},
        "archivo": WOFF2,
        "pedidas": [],
    }

    def falso_get(url):
        estado["pedidas"].append(url)
        if url == svc.API_BASE:
            return _Resp(estado["lista"])
        if url.startswith(svc.API_BASE + "/"):
            fid = url.rsplit("/", 1)[1]
            if fid not in estado["detalles"]:
                raise svc.ErrorTipografia("La fuente no existe en el catálogo.")
            return _Resp(estado["detalles"][fid])
        return _Resp(contenido=estado["archivo"])

    monkeypatch.setattr(svc, "_get", falso_get)
    return estado


def test_catalogo_solo_trae_fuentes_aptas(client, db_session, api):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    r = client.get("/admin/tipografia/catalogo", headers=admin).json()
    assert [f["id"] for f in r["fuentes"]] == ["inter", "lora"]
    assert client.get("/admin/tipografia/catalogo?categoria=serif", headers=admin).json()["total"] == 1
    assert [f["id"] for f in client.get("/admin/tipografia/catalogo?q=lo", headers=admin).json()["fuentes"]] == ["lora"]


def test_aplicar_instala_en_el_servidor_y_genera_el_css(client, db_session, api):
    configuracion.guardar(db_session, svc.CLAVE_CONFIG, None)
    db_session.commit()
    _, admin = crear_usuario_con_token(db_session, rol="admin")

    assert "sin personalización" in client.get("/tipografia/activa.css").text

    r = client.put("/admin/tipografia", json={"texto_id": "inter", "titulos_id": "lora"}, headers=admin)
    assert r.status_code == 200, r.text
    assert r.json()["texto"]["id"] == "inter" and r.json()["titulos"]["id"] == "lora"

    css = client.get("/tipografia/activa.css")
    assert css.headers["content-type"].startswith("text/css")
    assert '"Zarpi Texto"' in css.text and '"Zarpi Titulos"' in css.text
    assert 'url("archivos/inter/latin-400-normal.woff2")' in css.text
    assert "--font-display:\"Zarpi Titulos\", Georgia, serif" in css.text
    # Las fuentes se sirven desde este servidor, sin sesión.
    archivo = client.get("/tipografia/archivos/inter/latin-700-italic.woff2")
    assert archivo.status_code == 200 and archivo.content == WOFF2

    # Una vez instalada, no se vuelve a pedir nada a la API ni al CDN.
    antes = len(api["pedidas"])
    client.put("/admin/tipografia", json={"texto_id": "inter"}, headers=admin)
    assert len(api["pedidas"]) == antes

    # Vacío vuelve a la tipografía de marca.
    client.put("/admin/tipografia", json={"texto_id": None}, headers=admin)
    assert "sin personalización" in client.get("/tipografia/activa.css").text


def test_no_descarga_de_origenes_no_permitidos(client, db_session, api):
    api["detalles"]["inter"] = _detalle("inter", url_base="https://evil.example.com/fonts")
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    r = client.put("/admin/tipografia", json={"texto_id": "inter"}, headers=admin)
    assert r.status_code == 502
    assert "origen no permitido" in r.json()["detail"]
    assert not (svc.CARPETA / "inter").exists()


def test_rechaza_archivos_que_no_son_woff2(client, db_session, api):
    api["archivo"] = b"<html>no soy una fuente</html>"
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    r = client.put("/admin/tipografia", json={"texto_id": "inter"}, headers=admin)
    assert r.status_code == 502
    assert "WOFF2" in r.json()["detail"]


def test_rechaza_licencias_no_permitidas(client, db_session, api):
    api["detalles"]["cerrada"] = _detalle("cerrada", licencia="Propietaria")
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    assert client.put("/admin/tipografia", json={"texto_id": "cerrada"}, headers=admin).status_code == 502


def test_ids_y_archivos_invalidos(client, db_session, api):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    assert client.put("/admin/tipografia", json={"texto_id": "../etc"}, headers=admin).status_code == 400
    assert client.get("/admin/tipografia/vista-previa/Inter%20Bold", headers=admin).status_code == 400
    assert client.get("/tipografia/archivos/inter/manifiesto.json").status_code == 404
    assert client.get("/tipografia/archivos/..%2F..%2Fconfig/latin-400-normal.woff2").status_code == 404


def test_vista_previa_y_permisos(client, db_session, api):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    _, comprador = crear_usuario_con_token(db_session)
    r = client.get("/admin/tipografia/vista-previa/inter?peso=600", headers=admin)
    assert r.status_code == 200 and r.content == WOFF2
    # Pide 600, no existe: usa el más cercano disponible (700).
    assert any(u.endswith("latin-700-normal.woff2") for u in api["pedidas"])
    assert client.get("/admin/tipografia/catalogo", headers=comprador).status_code == 403
    assert client.put("/admin/tipografia", json={"texto_id": "inter"}, headers=comprador).status_code == 403
