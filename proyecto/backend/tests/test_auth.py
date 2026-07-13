import pytest
from fastapi.testclient import TestClient
from fastapi import status

from conftest import registro_payload

class TestRegisterUser:
    """Tests para el endpoint POST /auth/register"""
    
    def test_register_solicitante_success(self, client):
        """Registro exitoso de usuario solicitante (persona natural)"""
        response = client.post("/auth/register", json=registro_payload("nuevo@example.com"))
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["rol"] == "solicitante"
        assert len(data["user_id"]) > 0

    def test_register_solicitante_persona_juridica_success(self, client):
        """Registro exitoso de solicitante persona jurídica (NIT, razón social)"""
        response = client.post("/auth/register", json=registro_payload(
            "empresa@example.com", tipo_persona="juridica"
        ))

        assert response.status_code == status.HTTP_201_CREATED

    def test_register_persona_natural_sin_documento_falla(self, client):
        """Persona natural sin número de documento debe fallar la validación condicional"""
        payload = registro_payload("sindoc@example.com")
        payload["numero_documento"] = None
        response = client.post("/auth/register", json=payload)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_register_persona_juridica_sin_nit_falla(self, client):
        """Persona jurídica sin NIT debe fallar la validación condicional"""
        payload = registro_payload("sinnit@example.com", tipo_persona="juridica")
        payload["nit"] = None
        response = client.post("/auth/register", json=payload)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_register_sin_aceptar_politica_falla(self, client):
        """No se puede registrar sin aceptar la política de tratamiento de datos"""
        payload = registro_payload("sinpolitica@example.com", acepto_politica_datos=False)
        response = client.post("/auth/register", json=payload)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_register_importador_rechazado(self, client):
        """El auto-registro público NO permite crear cuentas 'importador' (hueco de
        seguridad cerrado): se devuelve el placeholder de contacto administrativo."""
        response = client.post("/auth/register", json=registro_payload(
            "importador@example.com", rol="importador"
        ))
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "equipo administrativo" in response.json()["detail"]
    
    def test_register_admin_rechazado(self, client):
        """El auto-registro público NO permite crear cuentas 'admin'."""
        response = client.post("/auth/register", json=registro_payload(
            "admin@example.com", rol="admin"
        ))
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "solicitante" in response.json()["detail"]
    
    def test_register_duplicate_email(self, client):
        """Intento de registro con email duplicado"""
        # Primer registro
        response1 = client.post("/auth/register", json=registro_payload("duplicado@example.com"))
        assert response1.status_code == status.HTTP_201_CREATED
        
        # Intento de registro con mismo email
        response2 = client.post("/auth/register", json=registro_payload("duplicado@example.com"))
        
        assert response2.status_code == status.HTTP_400_BAD_REQUEST
        assert "email ya está registrado" in response2.json()["detail"]
    
    def test_register_password_too_short(self, client):
        """Intento de registro con contraseña menor a 8 caracteres"""
        response = client.post("/auth/register", json=registro_payload(
            "corto@example.com", password="12345678"  # Solo 8 caracteres - debería fallar
        ))
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_register_invalid_email(self, client):
        """Intento de registro con email inválido"""
        response = client.post("/auth/register", json=registro_payload("no-es-email"))
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_register_invalid_role(self, client):
        """Intento de registro con rol inválido"""
        response = client.post("/auth/register", json=registro_payload(
            "rolinvalido@example.com", rol="superadmin"  # Rol no válido
        ))
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Rol inválido" in response.json()["detail"]

class TestLoginUser:
    """Tests para el endpoint POST /auth/login"""
    
    def test_login_success(self, client):
        """Inicio de sesión exitoso"""
        # Primero registrar un usuario
        register_response = client.post("/auth/register", json=registro_payload("login@example.com"))
        
        # Luego intentar login
        response = client.post("/auth/login", json={
            "email": "login@example.com",
            "password": "123456789"
        })
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["rol"] == "solicitante"
        # El registro ahora captura el perfil completo (nombre/documento/teléfono) de una vez
        assert data["perfil_completo"] is True
    
    def test_login_wrong_password(self, client):
        """Intento de login con contraseña incorrecta"""
        # Registrar usuario
        client.post("/auth/register", json=registro_payload("wrongpass@example.com"))
        
        # Intentar login con contraseña incorrecta
        response = client.post("/auth/login", json={
            "email": "wrongpass@example.com",
            "password": "contraseñaincorrecta"
        })
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Credenciales inválidas" in response.json()["detail"]
    
    def test_login_nonexistent_user(self, client):
        """Intento de login con email no registrado"""
        response = client.post("/auth/login", json={
            "email": "noexiste@example.com",
            "password": "123456789"
        })
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Credenciales inválidas" in response.json()["detail"]

    def test_login_cuenta_desactivada(self, client, db_session):
        """Una cuenta desactivada (activo=False) no puede iniciar sesión aunque la contraseña sea correcta"""
        client.post("/auth/register", json=registro_payload("desactivado@example.com"))

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

class TestRefreshToken:
    """Tests para el endpoint POST /auth/refresh"""
    
    def test_refresh_token_success(self, client):
        """Renovación exitosa de token JWT"""
        # Registrar usuario y obtener token
        register_response = client.post("/auth/register", json=registro_payload("refresh@example.com"))
        
        old_token = register_response.json()["access_token"]
        
        # Renovar token
        response = client.post("/auth/refresh", headers={
            "Authorization": f"Bearer {old_token}"
        })
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["access_token"] != old_token  # Token diferente
    
    def test_refresh_invalid_token(self, client):
        """Intento de renovación con token inválido"""
        response = client.post("/auth/refresh", headers={
            "Authorization": "Bearer invalidtoken123"
        })
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

class TestLogout:
    """Tests para el endpoint POST /auth/logout"""
    
    def test_logout_success(self, client):
        """Cierre de sesión exitoso"""
        # Registrar usuario y obtener token
        register_response = client.post("/auth/register", json=registro_payload("logout@example.com"))
        
        token = register_response.json()["access_token"]
        
        # Cerrar sesión
        response = client.post("/auth/logout", headers={
            "Authorization": f"Bearer {token}"
        })
        
        assert response.status_code == status.HTTP_204_NO_CONTENT

class TestLegalPlaceholders:
    """Tests para los endpoints placeholder de política de datos y términos"""

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
    """Tests para los endpoints de salud"""
    
    def test_root_endpoint(self, client):
        """Endpoint raíz devuelve información de la API"""
        response = client.get("/")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "API ImportacionesQ8 funcionando correctamente" in data["message"]
    
    def test_health_endpoint(self, client):
        """Endpoint de health check devuelve estado saludable"""
        response = client.get("/health")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "healthy"

class TestSecurityFunctions:
    """Tests para las funciones de seguridad"""
    
    def test_hash_password_returns_bcrypt(self):
        """La función hash_password retorna un hash bcrypt válido"""
        from utils.security import hash_password
        
        hashed = hash_password("123456789")
        
        assert hashed.startswith("$2b$")  # bcrypt empieza con $2b$
        assert len(hashed) == 60  # bcrypt tiene 60 caracteres
    
    def test_verify_password_correct(self):
        """Verificación de contraseña correcta"""
        from utils.security import hash_password, verify_password
        
        password = "123456789"
        hashed = hash_password(password)
        
        assert verify_password(password, hashed) is True
    
    def test_verify_password_incorrect(self):
        """Verificación de contraseña incorrecta"""
        from utils.security import hash_password, verify_password
        
        password = "123456789"
        wrong_password = "contraseñaincorrecta"
        hashed = hash_password(password)
        
        assert verify_password(wrong_password, hashed) is False
    
    def test_create_access_token_contains_claims(self):
        """El token JWT contiene los claims correctos"""
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
        """Decodificación de token JWT válido"""
        from utils.security import create_access_token, decode_access_token
        
        user_id = "550e8400-e29b-41d4-a716-446655440000"
        rol = "solicitante"
        
        token = create_access_token(user_id, rol)
        payload = decode_access_token(token)
        
        assert payload["sub"] == user_id
        assert payload["rol"] == rol
    
    def test_decode_access_token_invalid(self):
        """Decodificación de token JWT inválido"""
        from utils.security import decode_access_token
        
        with pytest.raises(Exception):  # Debe lanzar JWTError
            decode_access_token("token.invalido.123")

class TestDependencies:
    """Tests para las dependencias de autenticación"""
    
    def test_get_current_user_valid_token(self, client):
        """Obtener usuario actual con token válido"""
        # Registrar usuario y obtener token
        register_response = client.post("/auth/register", json=registro_payload("dep@example.com"))
        
        token = register_response.json()["access_token"]
        
        # Intentar acceder a un endpoint protegido (debería funcionar)
        response = client.get("/cotizaciones", headers={
            "Authorization": f"Bearer {token}"
        })
        
        assert response.status_code == status.HTTP_200_OK
    
    def test_get_current_user_invalid_token(self, client):
        """Obtener usuario actual con token inválido"""
        response = client.get("/cotizaciones", headers={
            "Authorization": "Bearer invalidtoken123"
        })
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_require_admin_role(self, client):
        """Verificar que solo admin puede acceder a endpoints de admin"""
        # Registrar usuario solicitante y obtener token
        register_response = client.post("/auth/register", json=registro_payload("solicitante@example.com"))
        
        token = register_response.json()["access_token"]
        
        # Intentar crear importador (requiere admin) - debería fallar
        response = client.post("/importadores", json={
            "nombre_empresa": "Importadora Test",
            "especialidad_producto": ["Textiles"],
            "paises_origen": ["China"],
            "tiempo_respuesta_promedio": "24h"
        }, headers={"Authorization": f"Bearer {token}"})
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_require_admin_role_success(self, client):
        """Verificar que admin puede crear importadores (via /admin/importadores con dueno)."""
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