"""Envío del OTP de registro: si el correo no sale, el usuario se entera; en
local sin SMTP el código queda en el log para poder terminar el registro."""
import logging

import config
from conftest import registro_payload


def test_registro_avisa_si_el_correo_no_salio(client, monkeypatch):
    monkeypatch.setattr("services.otp_service.enviar_correo_otp", lambda d, o, p: False)
    r = client.post("/auth/register", json=registro_payload("sincorreo@example.com"))
    assert r.status_code == 201, r.text
    datos = r.json()
    assert datos["correo_enviado"] is False and "no pudimos enviarte el código" in datos["mensaje"]


def test_registro_normal_confirma_el_envio(client, monkeypatch):
    monkeypatch.setattr("services.otp_service.enviar_correo_otp", lambda d, o, p: True)
    r = client.post("/auth/register", json=registro_payload("concorreo@example.com"))
    assert r.json()["correo_enviado"] is True


def test_en_produccion_sin_smtp_el_correo_cuenta_como_fallido(monkeypatch):
    from utils import email

    monkeypatch.setattr(config, "SMTP_HOST", None)
    monkeypatch.setattr(config, "APP_ENV", "production")
    assert email.enviar_correo("a@example.com", "Asunto", "Cuerpo") is False
    monkeypatch.setattr(config, "APP_ENV", "development")
    assert email.enviar_correo("a@example.com", "Asunto", "Cuerpo") is True


def test_en_local_sin_smtp_el_otp_queda_en_el_log(monkeypatch, caplog):
    from utils import email

    monkeypatch.setattr(config, "SMTP_HOST", None)
    for entorno, se_ve in (("development", True), ("production", False), ("test", False)):
        monkeypatch.setattr(config, "APP_ENV", entorno)
        caplog.clear()
        with caplog.at_level(logging.WARNING):
            email.enviar_correo_otp("a@example.com", "482913", "verificacion_email")
        assert ("482913" in caplog.text) is se_ve, entorno


class _Respuesta:
    def __init__(self, codigo, cuerpo):
        self.status_code = codigo
        self._cuerpo = cuerpo
        self.text = str(cuerpo)
        self.is_success = 200 <= codigo < 300

    def json(self):
        return self._cuerpo


def _resend(monkeypatch, respuesta):
    from utils import email

    llamadas = []
    monkeypatch.setattr(config, "SMTP_HOST", "smtp.resend.com")
    monkeypatch.setattr(config, "SMTP_API_KEY", "re_prueba_123")
    monkeypatch.setattr(config, "SMTP_FROM", "Zarpi <no-reply@zarpi.co>")
    monkeypatch.setattr(config, "EMAIL_PROVIDER", "")

    def falso_post(url, json=None, headers=None, timeout=None):
        llamadas.append({"url": url, "json": json, "headers": headers})
        if isinstance(respuesta, Exception):
            raise respuesta
        return respuesta

    monkeypatch.setattr(email.httpx, "post", falso_post)
    return email, llamadas


def test_con_resend_sale_por_la_api_https(monkeypatch):
    email, llamadas = _resend(monkeypatch, _Respuesta(200, {"id": "abc"}))
    assert email.usa_api_resend()
    assert email.enviar_correo("a@example.com", "Verifica tu cuenta — Zarpi", "Código 123456", "<p>123456</p>") is True
    enviado = llamadas[0]
    assert enviado["url"] == "https://api.resend.com/emails"
    assert enviado["headers"]["Authorization"] == "Bearer re_prueba_123"
    assert enviado["json"]["from"] == "Zarpi <no-reply@zarpi.co>" and enviado["json"]["to"] == ["a@example.com"]
    # Las respuestas van a un buzón que se lee, no al alias no-reply.
    assert enviado["json"]["reply_to"] == config.EMAIL_REPLY_TO


def test_rechazo_de_resend_queda_en_el_log_con_el_motivo(monkeypatch, caplog):
    email, _ = _resend(monkeypatch, _Respuesta(403, {"message": "The zarpi.co domain is not verified."}))
    with caplog.at_level(logging.ERROR):
        assert email.enviar_correo("a@example.com", "Asunto", "Cuerpo") is False
    assert "domain is not verified" in caplog.text and "re_prueba_123" not in caplog.text


def test_sin_red_hacia_resend_no_revienta(monkeypatch):
    import httpx

    email, _ = _resend(monkeypatch, httpx.ConnectTimeout("timeout"))
    assert email.enviar_correo("a@example.com", "Asunto", "Cuerpo") is False


def test_email_provider_smtp_fuerza_smtp(monkeypatch):
    email, _ = _resend(monkeypatch, _Respuesta(200, {}))
    monkeypatch.setattr(config, "EMAIL_PROVIDER", "smtp")
    assert email.usa_api_resend() is False
