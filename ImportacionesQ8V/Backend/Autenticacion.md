# Autenticación — ImportacionesQ8

## Descripción general

Sistema de autenticación basado en **JWT (JSON Web Tokens)** gestionado por FastAPI. Estándar ligero, sin dependencias pesadas, compatible con backend desacoplado del frontend.

---

## Flujo de autenticación

### Registro de nuevo usuario

```mermaid
sequenceDiagram
    participant Cliente as Frontend React/Next.js
    participant API as FastAPI
    participant DB as MySQL

    Cliente->>API: POST /auth/register {email, password, rol}
    API->>DB: Verificar email único
    DB-->>API: Email disponible
    API->>API: Generar password_hash (bcrypt)
    API->>DB: INSERT INTO usuarios
    DB-->>API: Usuario creado con ID
    API->>API: Generar JWT token
    API-->>Cliente: {token, user_id, rol}
```

### Inicio de sesión

```mermaid
sequenceDiagram
    participant Cliente as Frontend React/Next.js
    participant API as FastAPI
    participant DB as MySQL

    Cliente->>API: POST /auth/login {email, password}
    API->>DB: SELECT usuario WHERE email = ?
    DB-->>API: Usuario encontrado con password_hash
    API->>API: Verificar password (bcrypt.check)
    alt Password correcto
        API->>API: Generar JWT token (user_id, rol, exp)
        API-->>Cliente: {token, user_id, rol}
    else Password incorrecto
        API-->>Cliente: 401 Unauthorized
    end
```

### Renovación de token

```mermaid
sequenceDiagram
    participant Cliente as Frontend React/Next.js
    participant API as FastAPI
    participant DB as MySQL

    Cliente->>API: POST /auth/refresh {token}
    API->>API: Validar JWT (verificar firma y expiración)
    alt Token válido pero expirado
        API->>DB: Verificar usuario activo
        DB-->>API: Usuario activo
        API->>API: Generar nuevo JWT token
        API-->>Cliente: {token, user_id, rol}
    else Token inválido o revocado
        API-->>Cliente: 401 Unauthorized
    end
```

---

## Estructura del JWT Token

### Claims del token

| Claim | Tipo | Descripción |
|-------|------|-------------|
| `sub` (subject) | UUID | ID del usuario |
| `rol` | string | Rol del usuario: "solicitante", "importador" o "admin" |
| `exp` | timestamp | Fecha de expiración del token |
| `iat` | timestamp | Fecha de emisión del token |

### Ejemplo de payload JWT

```json
{
    "sub": "550e8400-e29b-41d4-a716-446655440000",
    "rol": "solicitante",
    "exp": 1751736000,
    "iat": 1751649600
}
```

### Configuración del token

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| Algoritmo | HS256 (HMAC-SHA256) | Firma simétrica del token |
| Duración | 24 horas | Tiempo de validez del token JWT |
| Refresh Token | No implementado en MVP | Se renueva el JWT directamente con `/auth/refresh` |

---

## Gestión de contraseñas

### Flujo de hash de contraseña

```mermaid
sequenceDiagram
    participant Cliente as Frontend React/Next.js
    participant API as FastAPI
    participant bcrypt as bcrypt.hashpw()
    participant DB as MySQL

    Cliente->>API: POST /auth/register {email, password}
    Note over API: Password en texto plano (solo por HTTPS)
    API->>bcrypt: bcrypt.hashpw(password, salt)
    bcrypt-->>API: password_hash (60 caracteres)
    API->>DB: INSERT INTO usuarios (email, password_hash)
```

### Verificación de contraseña

```mermaid
sequenceDiagram
    participant Cliente as Frontend React/Next.js
    participant API as FastAPI
    participant bcrypt as bcrypt.checkpw()
    participant DB as MySQL

    Cliente->>API: POST /auth/login {email, password}
    API->>DB: SELECT password_hash FROM usuarios WHERE email = ?
    DB-->>API: password_hash almacenado
    API->>bcrypt: bcrypt.checkpw(password, password_hash)
    alt Contraseña correcta
        bcrypt-->>API: True
        API->>API: Generar JWT token
    else Contraseña incorrecta
        bcrypt-->>API: False
        API-->>Cliente: 401 Unauthorized
    end
```

---

## Protección de endpoints con dependencias FastAPI

### Dependencia de autenticación

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

security = HTTPBearer()

SECRET_KEY = "tu-secreto-aqui"
ALGORITHM = "HS256"

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Dependencia que extrae y valida el JWT token del header Authorization"""
    token = credentials.credentials
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        rol = payload.get("rol")
        
        if user_id is None or rol is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado. Renueva tu sesión.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return {"user_id": user_id, "rol": rol}
```

### Uso en endpoints protegidos

```python
from fastapi import Depends

@app.post("/cotizaciones")
async def crear_cotizacion(
    cotizacion_data: CotizacionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Endpoint protegido: solo usuarios autenticados"""
    if current_user["rol"] != "solicitante":
        raise HTTPException(status_code=403, detail="No autorizado")
    
    # Crear cotización...
```

### Dependencia de autorización por rol

```python
def require_rol(rol: str):
    """Dependencia que verifica el rol del usuario"""
    async def verificar_rol(current_user: dict = Depends(get_current_user)):
        if current_user["rol"] != rol:
            raise HTTPException(status_code=403, detail="No autorizado")
        return current_user
    return verificar_rol

# Uso en endpoints de admin
@app.get("/admin/cotizaciones-abiertas")
async def listar_cotizaciones_abiertas(
    current_user: dict = Depends(require_rol("admin"))
):
    # Solo admins pueden acceder
```

---

## Roles y permisos del sistema

| Rol | Descripción | Endpoints accesibles |
|-----|-------------|---------------------|
| **solicitante** | Cliente final que solicita cotizaciones | Cotizaciones propias, Órdenes propias, Chat propio, Pagos propios |
| **importador** | Empresa importadora vinculada a la plataforma | Solicitudes recibidas, Propuestas, Órdenes asignadas, Chat asignado, Perfil empresa |
| **admin** | Miembro del equipo de la plataforma | Todos los endpoints + administración de importadores y disputas |

---

## Flujo completo de registro e inicio de sesión

```mermaid
sequenceDiagram
    participant F as Frontend React/Next.js
    participant A as API FastAPI
    participant D as MySQL
    participant B as bcrypt

    Note over F,D: === REGISTRO ===
    F->>A: POST /auth/register {email, password, rol}
    A->>D: Verificar email único
    D-->>A: Email disponible
    A->>B: Generar password_hash (bcrypt)
    B-->>A: password_hash
    A->>D: INSERT INTO usuarios
    D-->>A: Usuario creado
    A->>A: Generar JWT token
    A-->>F: {token, user_id, rol}

    Note over F,D: === LOGIN ===
    F->>A: POST /auth/login {email, password}
    A->>D: SELECT usuario WHERE email = ?
    D-->>A: Usuario con password_hash
    A->>B: Verificar password (bcrypt.checkpw)
    B-->>A: True/False
    alt Password correcto
        A->>A: Generar JWT token
        A-->>F: {token, user_id, rol}
    else Password incorrecto
        A-->>F: 401 Unauthorized
    end

    Note over F,D: === ACCESO PROTEGIDO ===
    F->>A: GET /cotizaciones (header: Authorization: Bearer <token>)
    A->>A: Validar JWT token
    alt Token válido
        A->>D: SELECT cotizaciones WHERE solicitante_id = ?
        D-->>A: Cotizaciones del usuario
        A-->>F: Lista de cotizaciones
    else Token inválido/expirado
        A-->>F: 401 Unauthorized
    end
```

---

## Convenciones y seguridad

- **HTTPS obligatorio:** Todas las comunicaciones deben ser sobre HTTPS para proteger credenciales en tránsito
- **Password hashing con bcrypt:** Nunca almacenar contraseñas en texto plano
- **JWT sin refresh tokens (MVP):** El token expira a las 24 horas; el usuario debe volver a iniciar sesión
- **Rate limiting en login:** Máximo 5 intentos de login por minuto por IP para prevenir fuerza bruta
- **CORS configurado:** Solo permitir orígenes autorizados (dominios del frontend)