import pytest
from datetime import datetime, timedelta
from fastapi import status

from conftest import registro_payload, registrar_verificado, capturar_otp_envio


class TestRegisterUser:
    """Tests para el endpoint POST /auth/register"""

    def test_register_solicitante_success(self, client, monkeypatch):
        """Registro exitoso: pendiente de verificación OTP (sin JWT aún)"""
        capturar_otp_envio(monkeypatch)
        response = client.post("/auth/register", json=registro_payload("nuevo@example.com"))

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["requiere_verificacion"] is True
        assert data["email"] == "nuevo@example.com"
        assert "access_token" not in data
        assert len(data["user_id"]) > 0

    def test_register_solicitante_persona_juridica_success(self, client, monkeypatch):
        capturar_otp_envio(monkeypatch)
        response = client.post("/auth/register", json=registro_payload(
            "empresa@example.com", tipo_persona="juridica"
        ))
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["requiere_verificacion"] is True

    def test_register_persona_natural_sin_documento_falla(self, client):
        payload = registro_payload("sindoc@example.com")
        payload["numero_documento"] = None
        response = client.post("/auth/register", json=payload)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_register_persona_juridica_sin_nit_falla(self, client):
        payload = registro_payload("sinnit@example.com", tipo_persona="juridica")
        payload["nit"] = None
        response = client.post("/auth/register", json=payload)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_register_sin_aceptar_politica_falla(self, client):
        payload = registro_payload("sinpolitica@example.com", acepto_politica_datos=False)
        response = client.post("/auth/register", json=payload)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_register_importador_rechazado(self, client):
        response = client.post("/auth/register", json=registro_payload(
            "importador@example.com", rol="importador"
        ))
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "equipo administrativo" in response.json()["detail"]

    def test_register_admin_rechazado(self, client):
        response = client.post("/auth/register", json=registro_payload(
            "admin@example.com", rol="admin"
        ))
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "solicitante" in response.json()["detail"]

    def test_register_duplicate_email(self, client, monkeypatch):
        capturar_otp_envio(monkeypatch)
        response1 = client.post("/auth/register", json=registro_payload("duplicado@example.com"))
        assert response1.status_code == status.HTTP_201_CREATED

        response2 = client.post("/auth/register", json=registro_payload("duplicado@example.com"))
        assert response2.status_code == status.HTTP_400_BAD_REQUEST
        assert "email ya está registrado" in response2.json()["detail"]

    def test_register_password_too_short(self, client):
        response = client.post("/auth/register", json=registro_payload(
            "corto@example.com", password="12345678"
        ))
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_register_invalid_email(self, client):
        response = client.post("/auth/register", json=registro_payload("no-es-email"))
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_register_invalid_role(self, client):
        response = client.post("/auth/register", json=registro_payload(
            "rolinvalido@example.com", rol="superadmin"
        ))
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Rol inválido" in response.json()["detail"]


class TestVerificacionEmailOtp:
    def test_verificar_email_emite_jwt(self, client, monkeypatch):
        data = registrar_verificado(client, monkeypatch, "verify@example.com")
        assert data["access_token"]
        assert data["rol"] == "solicitante"
        assert data["requiere_otp"] is False

    def test_otp_incorrecto_falla(self, client, monkeypatch):
        capturar_otp_envio(monkeypatch)
        client.post("/auth/register", json=registro_payload("badotp@example.com"))
        r = client.post("/auth/verificar-email", json={"email": "badotp@example.com", "otp": "000000"})
        assert r.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_sin_verificar_email_prohibido(self, client, monkeypatch):
        capturar_otp_envio(monkeypatch)
        client.post("/auth/register", json=registro_payload("noverif@example.com"))
        r = client.post("/auth/login", json={"email": "noverif@example.com", "password": "123456789"})
        assert r.status_code == status.HTTP_403_FORBIDDEN
        assert "verificar" in r.json()["detail"].lower()


class TestLoginUser:
    def test_login_success(self, client, monkeypatch):
        registrar_verificado(client, monkeypatch, "login@example.com")
        response = client.post("/auth/login", json={
            "email": "login@example.com",
            "password": "123456789"
        })
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["access_token"]
        assert data["rol"] == "solicitante"
        assert data["perfil_completo"] is True
        assert data["requiere_otp"] is False

    def test_login_wrong_password(self, client, monkeypatch):
        registrar_verificado(client, monkeypatch, "wrongpass@example.com")
        response = client.post("/auth/login", json={
            "email": "wrongpass@example.com",
            "password": "contraseñaincorrecta"
        })
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Credenciales inválidas" in response.json()["detail"]

    def test_login_nonexistent_user(self, client):
        response = client.post("/auth/login", json={
            "email": "noexiste@example.com",
            "password": "123456789"
        })
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Credenciales inválidas" in response.json()["detail"]

    def test_login_cuenta_desactivada(self, client, monkeypatch, db_session):
        registrar_verificado(client, monkeypatch, "desactivado@example.com")
        from models.usuario import Usuario
        usuario = db_session.query(Usuario).filter(Usuario.email == "desactivado@example.com").first()
        usuario.activo = False
        db_session.commit()

        response = client.post("/auth/login", json={
            "email": "desactivado@example.com",
            "password": "123456789"
        })
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "desactivada" in response.json()["detail"]

    def test_login_tardio_requiere_otp(self, client, monkeypatch, db_session):
        registrar_verificado(client, monkeypatch, "tardio@example.com")
        from models.usuario import Usuario
        usuario = db_session.query(Usuario).filter(Usuario.email == "tardio@example.com").first()
        usuario.ultimo_login_at = datetime.utcnow() - timedelta(hours=73)
        db_session.commit()

        capturado = capturar_otp_envio(monkeypatch)
        login = client.post("/auth/login", json={"email": "tardio@example.com", "password": "123456789"})
        assert login.status_code == 200
        body = login.json()
        assert body["requiere_otp"] is True
        assert body["motivo_otp"] == "login_tardio"
        assert body["challenge_token"]
        assert body.get("access_token") is None
        assert capturado.get("otp")

        ok = client.post("/auth/login/verificar-otp", json={
            "challenge_token": body["challenge_token"],
            "otp": capturado["otp"],
        })
        assert ok.status_code == 200
        assert ok.json()["access_token"]
        assert ok.json()["requiere_otp"] is False


class TestRefreshToken:
    def test_refresh_token_success(self, client, monkeypatch):
        data = registrar_verificado(client, monkeypatch, "refresh@example.com")
        old_token = data["access_token"]
        response = client.post("/auth/refresh", headers={"Authorization": f"Bearer {old_token}"})
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["access_token"] != old_token

    def test_refresh_invalid_token(self, client):
        response = client.post("/auth/refresh", headers={"Authorization": "Bearer invalidtoken123"})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestLogout:
    def test_logout_success(self, client, monkeypatch):
        data = registrar_verificado(client, monkeypatch, "logout@example.com")
        response = client.post("/auth/logout", headers={"Authorization": f"Bearer {data['access_token']}"})
        assert response.status_code == status.HTTP_204_NO_CONTENT


class TestLegalPlaceholders:
    def test_politica_tratamiento_datos(self, client):
        response = client.get("/legal/politica-tratamiento-datos")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "titulo" in data
        assert "contenido" in data
        assert "version" in data

    def test_terminos_condiciones(self, client):
        response = client.get("/legal/terminos-condiciones")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "titulo" in data
        assert "contenido" in data


class TestHealthCheck:
    def test_root_endpoint(self, client):
        response = client.get("/")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "API ImportacionesQ8 funcionando correctamente" in data["message"]

    def test_health_endpoint(self, client):
        response = client.get("/health")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "healthy"


class TestSecurityFunctions:
    def test_hash_password_returns_bcrypt(self):
        from utils.security import hash_password
        hashed = hash_password("123456789")
        assert hashed.startswith("$2b$")
        assert len(hashed) == 60

    def test_verify_password_correct(self):
        from utils.security import hash_password, verify_password
        password = "123456789"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        from utils.security import hash_password, verify_password
        assert verify_password("contraseñaincorrecta", hash_password("123456789")) is False

    def test_create_access_token_contains_claims(self):
        from utils.security import create_access_token
        from jose import jwt
        from config import SECRET_KEY
        user_id = "550e8400-e29b-41d4-a716-446655440000"
        rol = "solicitante"
        token = create_access_token(user_id, rol)
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        assert payload["sub"] == user_id
        assert payload["rol"] == rol
        assert "exp" in payload
        assert "iat" in payload

    def test_decode_access_token_valid(self):
        from utils.security import create_access_token, decode_access_token
        user_id = "550e8400-e29b-41d4-a716-446655440000"
        rol = "solicitante"
        token = create_access_token(user_id, rol)
        payload = decode_access_token(token)
        assert payload["sub"] == user_id
        assert payload["rol"] == rol

    def test_decode_access_token_invalid(self):
        from utils.security import decode_access_token
        with pytest.raises(Exception):
            decode_access_token("token.invalido.123")


class TestDependencies:
    def test_get_current_user_valid_token(self, client, monkeypatch):
        data = registrar_verificado(client, monkeypatch, "dep@example.com")
        response = client.get("/cotizaciones", headers={"Authorization": f"Bearer {data['access_token']}"})
        assert response.status_code == status.HTTP_200_OK

    def test_get_current_user_invalid_token(self, client):
        response = client.get("/cotizaciones", headers={"Authorization": "Bearer invalidtoken123"})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_require_admin_role(self, client, monkeypatch):
        data = registrar_verificado(client, monkeypatch, "solicitante@example.com")
        response = client.post("/importadores", json={
            "nombre_empresa": "Importadora Test",
            "especialidad_producto": ["Textiles"],
            "paises_origen": ["China"],
            "tiempo_respuesta_promedio": "24h"
        }, headers={"Authorization": f"Bearer {data['access_token']}"})
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_require_admin_role_success(self, client):
        from utils.security import create_access_token
        from uuid import uuid4
        token = create_access_token(str(uuid4()), "admin")
        response = client.post("/admin/importadores", json={
            "nombre_empresa": "Importadora Test",
            "especialidad_producto": ["Textiles"],
            "paises_origen": ["China"],
            "tiempo_respuesta_promedio": "24h",
            "email_dueño": "dueño_auth_admin@example.com",
            "password_dueño": "123456789",
            "nombre_dueño": "Dueño Test"
        }, headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["importador"]["nombre_empresa"] == "Importadora Test"
