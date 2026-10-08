"""Galería de fotos del producto en la cotización (hasta 10)."""
from fastapi import status

from conftest import registrar_verificado


def _payload(**extra):
    return {
        "modalidad": "abierta",
        "pais_importacion": "China",
        "nombre_producto": "Camisetas personalizadas",
        "descripcion_cliente": "Necesito 500 camisetas con mi logo impreso en algodón premium",
        "linea_producto": "Textiles",
        "tipo_calidad": "estandar",
        "cantidad_minima": 500,
        **extra,
    }


def _headers(client, monkeypatch, email):
    token = registrar_verificado(client, monkeypatch, email)["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_varias_fotos_se_guardan_en_orden_y_la_primera_es_portada(client, monkeypatch):
    headers = _headers(client, monkeypatch, "galeria1@example.com")
    fotos = [f"/documentos/archivos/{i}/descargar" for i in range(10)]

    response = client.post("/cotizaciones", json=_payload(fotos_producto=fotos), headers=headers)

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["fotos_producto"] == fotos
    assert data["foto_producto"] == fotos[0]

    detalle = client.get(f"/cotizaciones/{data['id']}", headers=headers).json()
    assert detalle["fotos_producto"] == fotos


def test_mas_de_diez_fotos_se_rechaza(client, monkeypatch):
    headers = _headers(client, monkeypatch, "galeria2@example.com")
    fotos = [f"/documentos/archivos/{i}/descargar" for i in range(11)]

    response = client.post("/cotizaciones", json=_payload(fotos_producto=fotos), headers=headers)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_fotos_repetidas_o_vacias_se_descartan(client, monkeypatch):
    headers = _headers(client, monkeypatch, "galeria3@example.com")

    response = client.post(
        "/cotizaciones",
        json=_payload(fotos_producto=["/a.png", " ", "/a.png", "/b.png"]),
        headers=headers,
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["fotos_producto"] == ["/a.png", "/b.png"]


def test_cliente_anterior_con_una_sola_foto_sigue_funcionando(client, monkeypatch):
    headers = _headers(client, monkeypatch, "galeria4@example.com")

    response = client.post("/cotizaciones", json=_payload(foto_producto="/solo.png"), headers=headers)

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["foto_producto"] == "/solo.png"
    assert data["fotos_producto"] == ["/solo.png"]


def test_sin_fotos_la_galeria_es_vacia(client, monkeypatch):
    headers = _headers(client, monkeypatch, "galeria5@example.com")

    response = client.post("/cotizaciones", json=_payload(), headers=headers)

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["foto_producto"] is None
    assert data["fotos_producto"] == []
