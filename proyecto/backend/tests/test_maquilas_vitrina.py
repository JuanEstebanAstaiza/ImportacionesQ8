"""Zarpi Maquilas: vitrina pública de la landing (sin sesión, solo datos públicos)."""
from tests.test_maquilas_fase2 import _maquila, mongo_maq  # noqa: F401 - `mongo_maq` es fixture
from tests.test_maquilas_fase3 import _producto


def test_vitrina_sin_datos_responde_vacia(client, mongo_maq):
    r = client.get("/maquilas/vitrina")
    assert r.status_code == 200, r.text
    datos = r.json()
    assert datos["cifras"]["maquilas"] == 0 and datos["cifras"]["calificacion"] is None
    assert datos["maquilas"] == [] and datos["productos"] == []
    assert any(c["clave"] == "textil" and c["maquilas"] == 0 for c in datos["categorias"])
    assert "Control de calidad" in datos["etapas"]
    assert datos["ruta_legal"]


def test_vitrina_muestra_solo_verificadas_y_sin_datos_privados(client, db_session, mongo_maq):
    _, hm = _maquila(db_session, mongo_maq, nombre="Textil Uno", categorias=("textil", "empaques"))
    _producto(client, hm)
    _producto(client, hm, nombre="Borrador", activo=False)
    _maquila(db_session, mongo_maq, nombre="Cosmética Dos", categorias=("cosmetica",), ciudad="Bogotá")
    _maquila(db_session, mongo_maq, nombre="Sin verificar", estado="registrada")

    datos = client.get("/maquilas/vitrina").json()
    assert datos["cifras"]["maquilas"] == 2
    assert datos["cifras"]["ciudades"] == 2
    assert datos["cifras"]["productos"] == 1
    nombres = {m["nombre_comercial"] for m in datos["maquilas"]}
    assert nombres == {"Textil Uno", "Cosmética Dos"}
    por_clave = {c["clave"]: c["maquilas"] for c in datos["categorias"]}
    assert por_clave["textil"] == 1 and por_clave["cosmetica"] == 1 and por_clave["alimentos"] == 0

    producto = datos["productos"][0]
    assert producto["nombre"] == "Camiseta básica algodón" and producto["precio_desde"] == 13000
    assert producto["maquila"] == "Textil Uno" and producto["foto"]
    # La foto del producto se puede ver sin sesión (es vitrina de una maquila verificada).
    assert client.get(producto["foto"]).status_code == 200

    texto = str(datos)
    for privado in ("nit", "razon_social", "telefono", "documentos", "representante"):
        assert privado not in texto
