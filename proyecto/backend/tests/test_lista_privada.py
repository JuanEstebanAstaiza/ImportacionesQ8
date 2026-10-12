"""Formulario de la lista privada de la landing: la solicitud llega a admin@ con
«Responder» hacia quien la llenó, y a la persona le llega un acuse desde admin@
con el aviso del costo del acceso."""
import pytest

SOLICITUD = {
    "nombre": "Laura Gómez",
    "email": "laura@example.com",
    "telefono": "+57 300 123 4567",
    "ciudad": "Medellín",
    "motivo": "Tengo una tienda de hogar y quiero importar termos <b>desde China</b>.",
}


@pytest.fixture
def enviados(monkeypatch):
    import routers.landing as landing

    llamadas = []

    def falso(destinatario, asunto, texto, html=None, **kw):
        llamadas.append({"para": destinatario, "asunto": asunto, "texto": texto, "html": html, **kw})
        return True

    monkeypatch.setattr(landing, "enviar_correo", falso)
    return llamadas


def test_la_solicitud_llega_a_admin_y_se_le_responde_a_la_persona(client, enviados):
    r = client.post("/landing/lista-privada", json=SOLICITUD)
    assert r.status_code == 200, r.text
    assert r.json()["enviado"] is True

    solicitud, acuse = enviados
    assert solicitud["para"] == "admin@zarpi.co" and solicitud["responder_a"] == "laura@example.com"
    assert solicitud["asunto"] == "Lista privada Zarpi — Laura Gómez"
    assert "+57 300 123 4567" in solicitud["texto"] and "Medellín" in solicitud["texto"]
    assert "No indicada" in solicitud["texto"]  # sin empresa
    # Lo que escribe la persona no se cuela como HTML.
    assert "&lt;b&gt;desde China&lt;/b&gt;" in solicitud["html"] and "<b>desde China" not in solicitud["html"]

    assert acuse["para"] == "laura@example.com" and acuse["buzon"] == "admin"
    assert "tiene un costo" in acuse["texto"] and "creamos tus credenciales" in acuse["texto"]


def test_motivo_y_telefono_obligatorios(client, enviados):
    for cambio in ({"motivo": "Quiero entrar"}, {"telefono": ""}, {"email": "no-es-correo"}):
        assert client.post("/landing/lista-privada", json={**SOLICITUD, **cambio}).status_code == 422
    assert enviados == []


def test_si_no_sale_el_correo_no_se_dice_enviado(client, monkeypatch):
    import routers.landing as landing

    monkeypatch.setattr(landing, "enviar_correo", lambda *a, **kw: False)
    assert client.post("/landing/lista-privada", json=SOLICITUD).status_code == 502


def test_si_falla_el_acuse_la_solicitud_igual_queda(client, monkeypatch):
    import routers.landing as landing

    para = []

    def falso(destinatario, *a, **kw):
        para.append(destinatario)
        if destinatario != "admin@zarpi.co":
            raise RuntimeError("SMTP caído")
        return True

    monkeypatch.setattr(landing, "enviar_correo", falso)
    assert client.post("/landing/lista-privada", json=SOLICITUD).status_code == 200
    assert para == ["admin@zarpi.co", "laura@example.com"]
