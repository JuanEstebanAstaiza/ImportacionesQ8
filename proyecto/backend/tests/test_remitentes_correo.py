"""Cada correo sale del buzón que le toca:

- notificaciones@: eventos del usuario (soporte resuelto, aprobaciones del reto,
  códigos), el aviso del formulario de contacto, estado de la plataforma.
- contacto@: lo del formulario de contacto (se elige en Admin › Correos).
- pagos@: comprobantes, retiros del reto, aprobaciones y transferencias.
- admin@: el equipo y los correos directos a empresas (verificación).

En Admin › Correos se elige el buzón."""
from datetime import datetime, timedelta

import pytest

import config
from conftest import auth_headers_for, crear_empresa_importadora, crear_usuario_con_token
from models.configuracion import ConfiguracionPlataforma
from models.notificacion import Notificacion

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


@pytest.fixture
def correos(monkeypatch):
    """Captura los correos de notificación (destinatario, título, mensaje, buzón)."""
    import utils.email as correo

    enviados = []

    def falso(destinatario, titulo, mensaje="", enlace="", buzon="notificaciones"):
        enviados.append({"para": destinatario, "titulo": titulo, "mensaje": mensaje, "buzon": buzon})
        return True

    monkeypatch.setattr(correo, "enviar_correo_notificacion", falso)
    return enviados


@pytest.fixture(autouse=True)
def config_limpia(db_session):
    yield
    db_session.query(ConfiguracionPlataforma).filter(ConfiguracionPlataforma.clave.like("pagos.%")).delete(
        synchronize_session=False)
    db_session.commit()


# ── Remitente y Reply-To ─────────────────────────────────────────────────────

def _resend(monkeypatch):
    import utils.email as email

    llamadas = []

    class Ok:
        is_success = True

    monkeypatch.setattr(config, "SMTP_HOST", "smtp.resend.com")
    monkeypatch.setattr(config, "SMTP_API_KEY", "re_prueba_123")
    monkeypatch.setattr(config, "EMAIL_PROVIDER", "")
    monkeypatch.setattr(email.httpx, "post",
                        lambda url, json=None, headers=None, timeout=None: llamadas.append(json) or Ok())
    return email, llamadas


@pytest.mark.parametrize("buzon,de,responde", [
    ("notificaciones", "Zarpi <notificaciones@zarpi.co>", "contacto@zarpi.co"),
    ("contacto", "Zarpi <contacto@zarpi.co>", "contacto@zarpi.co"),
    ("pagos", "Zarpi Pagos <pagos@zarpi.co>", "pagos@zarpi.co"),
    ("admin", "Zarpi <admin@zarpi.co>", "admin@zarpi.co"),
])
def test_cada_buzon_con_su_remitente(monkeypatch, buzon, de, responde):
    email, llamadas = _resend(monkeypatch)
    assert email.enviar_correo("a@example.com", "Asunto", "Cuerpo", buzon=buzon)
    assert llamadas[-1]["from"] == de and llamadas[-1]["reply_to"] == responde


def test_por_defecto_sale_de_notificaciones(monkeypatch):
    email, llamadas = _resend(monkeypatch)
    assert email.enviar_correo("a@example.com", "Verifica tu cuenta — Zarpi", "Código 123456")
    assert llamadas[-1]["from"] == "Zarpi <notificaciones@zarpi.co>"


def test_contacto_llega_a_contacto_y_se_responde_al_visitante(client, monkeypatch):
    import routers.landing as landing

    llamadas = []
    monkeypatch.setattr(landing, "enviar_correo", lambda d, a, c, h=None, **kw: llamadas.append((d, kw)) or True)
    r = client.post("/landing/contacto", json={"nombre": "Ana", "email": "ana@example.com",
                                               "mensaje": "Quiero importar termos"})
    assert r.status_code == 200, r.text
    # Sale de notificaciones@ (el buzón por defecto) y «Responder» le escribe a Ana.
    assert llamadas == [("contacto@zarpi.co", {"responder_a": "ana@example.com"})]


# ── Admin › Correos ──────────────────────────────────────────────────────────

def test_admin_elige_el_buzon_de_la_campana(client, db_session, monkeypatch):
    import routers.admin as admin_router

    llamadas = []
    monkeypatch.setattr(admin_router, "enviar_correo",
                        lambda d, a, c, h=None, **kw: llamadas.append((d, kw["buzon"])) or True)
    _, admin = crear_usuario_con_token(db_session, rol="admin")

    remitentes = client.get("/admin/correos/remitentes", headers=admin).json()
    assert [r["buzon"] for r in remitentes] == ["notificaciones", "contacto", "pagos", "admin"]
    assert remitentes[0]["direccion"] == "Zarpi <notificaciones@zarpi.co>" and remitentes[0]["uso"]

    base = {"asunto": "Cambios en los términos", "cuerpo": "Actualizamos los términos.", "correos": ["x@example.com"]}
    r = client.post("/admin/correos/masivo", headers=admin, json={**base, "buzon": "notificaciones"})
    assert r.status_code == 200, r.text
    assert r.json()["remitente"] == "Zarpi <notificaciones@zarpi.co>" and r.json()["buzon"] == "notificaciones"
    # Sin elegir, sale de admin@.
    assert client.post("/admin/correos/masivo", headers=admin, json=base).json()["buzon"] == "admin"
    assert llamadas == [("x@example.com", "notificaciones"), ("x@example.com", "admin")]

    assert client.post("/admin/correos/masivo", headers=admin, json={**base, "buzon": "otro"}).status_code == 422
    _, soporte = crear_usuario_con_token(db_session, rol="soporte")
    assert client.get("/admin/correos/remitentes", headers=soporte).status_code == 403


# ── Correos automáticos ──────────────────────────────────────────────────────

def test_notificaciones_al_equipo_salen_de_admin(db_session, correos):
    from services.notificacion_service import notificar

    usuario, _ = crear_usuario_con_token(db_session)
    designer, _ = crear_usuario_con_token(db_session, rol="designer")
    notificar(db_session, usuario_id=usuario.id, tipo="soporte", titulo="Tu solicitud de soporte quedó resuelta")
    notificar(db_session, usuario_id=designer.id, tipo="tendencias", titulo="Nuevo producto para diseñar")
    assert [(c["para"], c["buzon"]) for c in correos] == [(usuario.email, "notificaciones"), (designer.email, "admin")]


def test_verificacion_de_empresa_sale_de_admin(client, db_session, correos):
    admin, _ = crear_usuario_con_token(db_session, rol="admin")
    importador, dueño = crear_empresa_importadora(db_session, nombre_empresa="Verificable SAS",
                                                  email_dueño="dueno_buzon@example.com")
    importador.especialidad_producto = ["Textil"]
    importador.paises_origen = ["China"]
    importador.shipping_mark_prefijo = "vbz"
    dueño.email_verificado = True
    dueño.activo = True
    db_session.commit()

    r = client.post(f"/admin/importadores/{importador.id}/verificar", headers=auth_headers_for(admin))
    assert r.status_code == 200, r.text
    assert [(c["para"], c["titulo"], c["buzon"]) for c in correos] == [
        (dueño.email, "Tu empresa quedó verificada", "admin")]


def _aprobar_enlace(client, db_session, umbral=1):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    fin = (datetime.utcnow() + timedelta(days=14)).replace(microsecond=0).isoformat()
    ronda = client.post("/reto/rondas", json={"nombre": "Ronda correo", "max_participantes": 5, "fecha_limite": fin,
                                              "umbral_aprobados": umbral}, headers=admin).json()
    usuario, participante = crear_usuario_con_token(db_session)
    client.post(f"/reto/rondas/{ronda['id']}/inscribirme", headers=participante)
    item = client.post("/tendencias/enviar", json={"url": "https://youtu.be/dQw4w9WgXcQ"}, headers=participante).json()["id"]
    client.patch(f"/tendencias/items/{item}", json={"nombre": "Termo viral", "categoria": "Hogar"}, headers=admin)
    client.post(f"/tendencias/items/{item}/aprobar", json={"sin_portada": True}, headers=admin)
    return admin, usuario, participante


def test_aprobacion_del_video_del_reto_por_correo(client, db_session, correos):
    _, usuario, _ = _aprobar_enlace(client, db_session, umbral=10)
    aprobado = [c for c in correos if c["titulo"] == "Aprobado: Termo viral"]
    assert len(aprobado) == 1 and aprobado[0]["para"] == usuario.email and aprobado[0]["buzon"] == "notificaciones"


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
    assert len(acuse) == 1 and acuse[0]["buzon"] == "pagos"
    assert acuse[0]["titulo"] == "Recibimos tu comprobante de pago"
    assert concepto in acuse[0]["mensaje"] and "Pronto nos pondremos en contacto contigo" in acuse[0]["mensaje"]
    assert db_session.query(Notificacion).filter(Notificacion.usuario_id == usuario.id,
                                                 Notificacion.titulo == "Recibimos tu comprobante de pago").count() == 1


def test_acuse_del_retiro_del_reto_desde_pagos(client, db_session, correos):
    admin, usuario, participante = _aprobar_enlace(client, db_session)
    p = client.get("/reto/mi-participacion", headers=participante).json()["participacion"]
    client.post(f"/reto/participaciones/{p['id']}/reclamar", json={"eleccion": "efectivo"}, headers=participante)
    correos.clear()

    cuenta = {"banco": "Bancolombia", "tipo_cuenta": "ahorros", "numero_cuenta": "123456789012",
              "titular": "Paula Restrepo", "documento_titular": "1020304050"}
    assert client.put(f"/reto/participaciones/{p['id']}/cuenta-pago", json=cuenta, headers=participante).status_code == 200
    assert len(correos) == 1
    acuse = correos[0]
    assert acuse["para"] == usuario.email and acuse["buzon"] == "pagos"
    assert acuse["titulo"] == "Recibimos tu solicitud de retiro"
    assert "retiro de fondos del reto ($50.000)" in acuse["mensaje"]
    # Los datos bancarios nunca viajan en el correo.
    assert "123456789012" not in acuse["mensaje"] and "1020304050" not in acuse["mensaje"]

    client.patch(f"/reto/participaciones/{p['id']}/pagado", json={"referencia": "TRX-1"}, headers=admin)
    assert correos[-1]["titulo"] == "Te transferimos tu recompensa" and correos[-1]["buzon"] == "pagos"
