"""Cada buzón con su remitente: Admin › Correos sale de admin@, el formulario de
contacto llega a contacto@ y los pagos (comprobantes y retiros del reto) tienen
acuse inmediato desde pagos@."""
from datetime import datetime, timedelta

import pytest

import config
from conftest import crear_usuario_con_token
from models.configuracion import ConfiguracionPlataforma
from models.notificacion import Notificacion

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


@pytest.fixture
def correos(monkeypatch):
    """Captura los correos de notificación (destinatario, título, mensaje, remitente)."""
    import utils.email as correo

    enviados = []

    def falso(destinatario, titulo, mensaje="", enlace="", remitente=None):
        enviados.append({"para": destinatario, "titulo": titulo, "mensaje": mensaje, "remitente": remitente})
        return True

    monkeypatch.setattr(correo, "enviar_correo_notificacion", falso)
    return enviados


@pytest.fixture(autouse=True)
def config_limpia(db_session):
    yield
    db_session.query(ConfiguracionPlataforma).filter(ConfiguracionPlataforma.clave.like("pagos.%")).delete(
        synchronize_session=False)
    db_session.commit()


def test_remitente_propio_y_respuestas_al_mismo_buzon(monkeypatch):
    import utils.email as email

    llamadas = []

    class Ok:
        is_success = True

    monkeypatch.setattr(config, "SMTP_HOST", "smtp.resend.com")
    monkeypatch.setattr(config, "SMTP_API_KEY", "re_prueba_123")
    monkeypatch.setattr(config, "SMTP_FROM", "Zarpi <no-reply@zarpi.co>")
    monkeypatch.setattr(config, "EMAIL_PROVIDER", "")
    monkeypatch.setattr(email.httpx, "post", lambda url, json=None, headers=None, timeout=None: llamadas.append(json) or Ok())

    assert email.enviar_correo("a@example.com", "Asunto", "Cuerpo", remitente="Zarpi Pagos <pagos@zarpi.co>")
    assert llamadas[-1]["from"] == "Zarpi Pagos <pagos@zarpi.co>" and llamadas[-1]["reply_to"] == "pagos@zarpi.co"
    assert email.enviar_correo("contacto@zarpi.co", "Asunto", "Cuerpo", responder_a="visitante@example.com")
    assert llamadas[-1]["from"] == "Zarpi <no-reply@zarpi.co>" and llamadas[-1]["reply_to"] == "visitante@example.com"


def test_admin_correos_sale_de_admin(client, db_session, monkeypatch):
    import routers.admin as admin_router

    llamadas = []
    monkeypatch.setattr(admin_router, "enviar_correo",
                        lambda d, a, c, h=None, **kw: llamadas.append((d, kw)) or True)
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    r = client.post("/admin/correos/masivo", headers=admin,
                    json={"asunto": "Novedades", "cuerpo": "Hola a todos", "correos": ["x@example.com"]})
    assert r.status_code == 200, r.text
    assert r.json()["remitente"] == config.EMAIL_FROM_ADMIN and "admin@zarpi.co" in config.EMAIL_FROM_ADMIN
    assert llamadas == [("x@example.com", {"remitente": config.EMAIL_FROM_ADMIN})]


def test_contacto_llega_a_contacto_y_se_responde_al_visitante(client, monkeypatch):
    import routers.landing as landing

    llamadas = []
    monkeypatch.setattr(landing, "enviar_correo", lambda d, a, c, h=None, **kw: llamadas.append((d, kw)) or True)
    r = client.post("/landing/contacto", json={"nombre": "Ana", "email": "ana@example.com",
                                               "mensaje": "Quiero importar termos"})
    assert r.status_code == 200, r.text
    assert llamadas == [(config.CONTACT_EMAIL, {"responder_a": "ana@example.com"})]
    assert config.CONTACT_EMAIL == "contacto@zarpi.co"


@pytest.mark.parametrize("tipo,extra,concepto", [
    ("tokens", {"cantidad": 10}, "compra de cotizaciones (10 tokens)"),
    ("suscripcion", {}, "suscripción a Tendencias"),
])
def test_acuse_del_comprobante_desde_pagos(client, db_session, correos, tipo, extra, concepto):
    usuario, headers = crear_usuario_con_token(db_session)
    archivo = client.post("/documentos/archivos/upload", headers=headers,
                          files={"archivo": ("c.png", PNG, "image/png")}, data={"origen": "manual"}).json()["id"]
    r = client.post("/comprobantes", json={"tipo": tipo, "archivo_id": archivo, **extra}, headers=headers)
    assert r.status_code == 201, r.text
    acuse = [c for c in correos if c["para"] == usuario.email]
    assert len(acuse) == 1
    assert acuse[0]["remitente"] == config.EMAIL_FROM_PAGOS and "pagos@zarpi.co" in config.EMAIL_FROM_PAGOS
    assert acuse[0]["titulo"] == "Recibimos tu comprobante de pago"
    assert concepto in acuse[0]["mensaje"] and "Pronto nos pondremos en contacto contigo" in acuse[0]["mensaje"]
    assert db_session.query(Notificacion).filter(Notificacion.usuario_id == usuario.id,
                                                 Notificacion.titulo == "Recibimos tu comprobante de pago").count() == 1


def test_acuse_del_retiro_del_reto_desde_pagos(client, db_session, correos):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    fin = (datetime.utcnow() + timedelta(days=14)).replace(microsecond=0).isoformat()
    ronda = client.post("/reto/rondas", json={"nombre": "Ronda correo", "max_participantes": 5, "fecha_limite": fin,
                                              "umbral_aprobados": 1}, headers=admin).json()
    usuario, participante = crear_usuario_con_token(db_session)
    client.post(f"/reto/rondas/{ronda['id']}/inscribirme", headers=participante)
    item = client.post("/tendencias/enviar", json={"url": "https://youtu.be/dQw4w9WgXcQ"}, headers=participante).json()["id"]
    client.patch(f"/tendencias/items/{item}", json={"nombre": "P", "categoria": "Hogar"}, headers=admin)
    client.post(f"/tendencias/items/{item}/aprobar", json={"sin_portada": True}, headers=admin)
    p = client.get("/reto/mi-participacion", headers=participante).json()["participacion"]
    client.post(f"/reto/participaciones/{p['id']}/reclamar", json={"eleccion": "efectivo"}, headers=participante)
    correos.clear()

    cuenta = {"banco": "Bancolombia", "tipo_cuenta": "ahorros", "numero_cuenta": "123456789012",
              "titular": "Paula Restrepo", "documento_titular": "1020304050"}
    assert client.put(f"/reto/participaciones/{p['id']}/cuenta-pago", json=cuenta, headers=participante).status_code == 200
    assert len(correos) == 1
    acuse = correos[0]
    assert acuse["para"] == usuario.email and acuse["remitente"] == config.EMAIL_FROM_PAGOS
    assert acuse["titulo"] == "Recibimos tu solicitud de retiro"
    assert "retiro de fondos del reto ($50.000)" in acuse["mensaje"]
    # Los datos bancarios nunca viajan en el correo.
    assert "123456789012" not in acuse["mensaje"] and "1020304050" not in acuse["mensaje"]

    client.patch(f"/reto/participaciones/{p['id']}/pagado", json={"referencia": "TRX-1"}, headers=admin)
    assert correos[-1]["titulo"] == "Te transferimos tu recompensa" and correos[-1]["remitente"] == config.EMAIL_FROM_PAGOS
