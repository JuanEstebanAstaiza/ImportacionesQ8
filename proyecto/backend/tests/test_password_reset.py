"""Tests de recuperación de contraseña con OTP + enlace por correo (Semana 4)."""
from fastapi import status

from conftest import registrar_verificado


def _registrar_y_obtener_token_reset(client, monkeypatch, email):
    """Registra (verificado) y captura el (otp, token) de recuperación de contraseña."""
    registrar_verificado(client, monkeypatch, email)

    capturado = {}

    def _fake_enviar(destinatario, otp, token):
        capturado["destinatario"] = destinatario
        capturado["otp"] = otp
        capturado["token"] = token
        return True

    monkeypatch.setattr("services.auth_service.enviar_correo_recuperacion_password", _fake_enviar)

    response = client.post("/auth/forgot-password", json={"email": email})
    assert response.status_code == status.HTTP_200_OK
    return capturado


class TestForgotPassword:
    def test_forgot_password_email_existente(self, client, monkeypatch):
        capturado = _registrar_y_obtener_token_reset(client, monkeypatch, "reset1@example.com")

        assert capturado["destinatario"] == "reset1@example.com"
        assert len(capturado["otp"]) == 6
        assert capturado["token"]

    def test_forgot_password_email_inexistente_mismo_mensaje(self, client):
        response_existente = client.post("/auth/forgot-password", json={"email": "noexiste999@example.com"})

        assert response_existente.status_code == status.HTTP_200_OK
        assert "mensaje" in response_existente.json()


class TestResetPassword:
    def test_reset_password_flujo_exitoso(self, client, monkeypatch):
        capturado = _registrar_y_obtener_token_reset(client, monkeypatch, "reset2@example.com")

        response = client.post("/auth/reset-password", json={
            "token": capturado["token"],
            "otp": capturado["otp"],
            "nueva_password": "NuevaClave123"
        })

        assert response.status_code == status.HTTP_204_NO_CONTENT

        login = client.post("/auth/login", json={
            "email": "reset2@example.com",
            "password": "NuevaClave123"
        })
        assert login.status_code == status.HTTP_200_OK
        assert login.json()["access_token"]

        login_viejo = client.post("/auth/login", json={
            "email": "reset2@example.com",
            "password": "ClaveSegura1"
        })
        assert login_viejo.status_code == status.HTTP_401_UNAUTHORIZED

    def test_reset_password_otp_incorrecto(self, client, monkeypatch):
        capturado = _registrar_y_obtener_token_reset(client, monkeypatch, "reset3@example.com")

        response = client.post("/auth/reset-password", json={
            "token": capturado["token"],
            "otp": "000000",
            "nueva_password": "NuevaClave123"
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reset_password_token_invalido(self, client):
        response = client.post("/auth/reset-password", json={
            "token": "token-que-no-existe",
            "otp": "123456",
            "nueva_password": "NuevaClave123"
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reset_password_token_usado_dos_veces(self, client, monkeypatch):
        capturado = _registrar_y_obtener_token_reset(client, monkeypatch, "reset4@example.com")

        primera = client.post("/auth/reset-password", json={
            "token": capturado["token"],
            "otp": capturado["otp"],
            "nueva_password": "NuevaClave123"
        })
        assert primera.status_code == status.HTTP_204_NO_CONTENT

        segunda = client.post("/auth/reset-password", json={
            "token": capturado["token"],
            "otp": capturado["otp"],
            "nueva_password": "OtraClave123"
        })
        assert segunda.status_code == status.HTTP_400_BAD_REQUEST

    def test_reset_password_token_expirado(self, client, monkeypatch, db_session):
        capturado = _registrar_y_obtener_token_reset(client, monkeypatch, "reset5@example.com")

        from datetime import datetime, timedelta
        from models.password_reset import PasswordResetToken
        from utils.security import hash_token

        registro = db_session.query(PasswordResetToken).filter(
            PasswordResetToken.token_hash == hash_token(capturado["token"])
        ).first()
        registro.expira_en = datetime.utcnow() - timedelta(minutes=1)
        db_session.commit()

        response = client.post("/auth/reset-password", json={
            "token": capturado["token"],
            "otp": capturado["otp"],
            "nueva_password": "NuevaClave123"
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_forgot_password_invalida_tokens_anteriores(self, client, monkeypatch):
        primero = _registrar_y_obtener_token_reset(client, monkeypatch, "reset6@example.com")

        segundo = {}

        def _fake_enviar(destinatario, otp, token):
            segundo["otp"] = otp
            segundo["token"] = token
            return True

        monkeypatch.setattr("services.auth_service.enviar_correo_recuperacion_password", _fake_enviar)
        client.post("/auth/forgot-password", json={"email": "reset6@example.com"})

        response = client.post("/auth/reset-password", json={
            "token": primero["token"],
            "otp": primero["otp"],
            "nueva_password": "NuevaClave123"
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        response_ok = client.post("/auth/reset-password", json={
            "token": segundo["token"],
            "otp": segundo["otp"],
            "nueva_password": "NuevaClave123"
        })
        assert response_ok.status_code == status.HTTP_204_NO_CONTENT
