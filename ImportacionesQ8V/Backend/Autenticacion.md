# Autenticación — ImportacionesQ8

## Descripción general

Sistema de autenticación basado en **JWT (JSON Web Tokens)** gestionado por FastAPI. Estándar ligero, sin dependencias pesadas, compatible con backend desacoplado del frontend.

---

## Flujo de autenticación

### Registro de nuevo usuario (persona natural / jurídica — Semana 4)

`POST /auth/register` **solo** acepta `rol="solicitante"` (ver "Cierre de auto-registro" más abajo), y ahora distingue entre **persona natural** y **persona jurídica**, con campos condicionales validados por un `model_validator` de Pydantic:

| Campo | Persona natural | Persona jurídica |
|-------|:---:|:---:|
| `email` | ✅ | ✅ (correo del representante) |
| `tipo_persona` | `"natural"` | `"juridica"` |
| `nombre`, `apellido` | ✅ requeridos | — |
| `tipo_documento`, `numero_documento` (cédula, pasaporte, cédula de extranjería...) | ✅ requeridos | — |
| `nit`, `razon_social` | — | ✅ requeridos |
| `indicativo_pais_telefono` + `telefono` | ✅ requeridos | ✅ requeridos |
| `acepto_politica_datos` | ✅ debe ser `true` | ✅ debe ser `true` |

Si `acepto_politica_datos` no es `true`, o faltan los campos condicionales según `tipo_persona`, la API responde `422 Unprocessable Entity` con el detalle del campo faltante (nunca se llega a crear el usuario). Al aceptar, se guarda `fecha_aceptacion_politica` para trazabilidad legal.

Al registrarse, el usuario recibe además un **bono de créditos de bienvenida** (`CREDITO_BONO_REGISTRO`, ver `Backend/Pagos-Wompi.md`) para poder crear su primera cotización sin comprar créditos primero.

```mermaid
sequenceDiagram
    participant Cliente as Frontend React/Next.js
    participant API as FastAPI
    participant DB as MySQL

    Cliente->>API: POST /auth/register {tipo_persona, email, password, ...campos condicionales, acepto_politica_datos}
    API->>API: Validar campos condicionales según tipo_persona (Pydantic)
    API->>DB: Verificar email único
    DB-->>API: Email disponible
    API->>API: Generar password_hash (bcrypt)
    API->>DB: INSERT INTO usuarios (..., email_verificado=false, creditos_balance=CREDITO_BONO_REGISTRO)
    API->>API: Generar OTP verificación, hashear, enviar por SMTP
    API-->>Cliente: {user_id, email, requiere_verificacion=true}  (sin JWT)

    Cliente->>API: POST /auth/verificar-email {email, otp}
    API->>API: Validar OTP
    API->>DB: email_verificado=true, ultimo_login_at=now
    API-->>Cliente: {access_token, user_id, rol, ...}
```

### Registro de importador (placeholder)

No existe auto-registro de empresas importadoras: `POST /auth/register` con `rol="importador"` responde `400 Bad Request` con el mensaje *"Contáctese con el equipo administrativo para registrar tu empresa importadora"*. El frontend debe mostrar este mensaje como placeholder en la pantalla de registro de importador (ver `Frontend/Pantallas-Registro-y-Login.md`). El alta real la hace un admin vía `POST /admin/importadores` (**siempre** empresa + dueño/representante legal). `POST /importadores` (ficha sin dueño) está **deshabilitado (410)**.

### Inicio de sesión

Si el correo no está verificado → `403` y reenvío de OTP de verificación.

Si el último login exitoso fue hace más de `LOGIN_TARDIO_HORAS` (default **72h**) → contraseña OK pero respuesta `requiere_otp=true` + `challenge_token` (sin JWT). Completar con `POST /auth/login/verificar-otp`.

```mermaid
sequenceDiagram
    participant Cliente as Frontend React/Next.js
    participant API as FastAPI
    participant DB as MySQL
    participant SMTP as SMTP

    Cliente->>API: POST /auth/login {email, password}
    API->>DB: SELECT usuario WHERE email = ?
    API->>API: Verificar password (bcrypt)
    alt Email no verificado
        API->>SMTP: OTP verificación
        API-->>Cliente: 403 verificar correo
    else Login tardío (>72h desde ultimo_login_at)
        API->>SMTP: OTP login_tardio
        API-->>Cliente: {requiere_otp:true, challenge_token}
        Cliente->>API: POST /auth/login/verificar-otp {challenge_token, otp}
        API-->>Cliente: {access_token, ...}
    else Login reciente
        API->>DB: ultimo_login_at=now
        API-->>Cliente: {access_token, user_id, rol, perfil_completo}
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

### Recuperación de contraseña (OTP + email real — Semana 4)

Flujo de dos pasos: el usuario pide un código y enlace por correo, y luego confirma con ambos para poner una nueva contraseña. Nunca se revela si un email existe (mismo mensaje siempre, previene enumeración de usuarios).

```mermaid
sequenceDiagram
    participant Cliente as Frontend React/Next.js
    participant API as FastAPI
    participant SMTP as Servidor SMTP real
    participant DB as MySQL

    Cliente->>API: POST /auth/forgot-password {email}
    API->>DB: Buscar usuario por email
    alt Usuario existe
        API->>API: Generar OTP (6 dígitos) + token seguro, hashear ambos
        API->>DB: INSERT INTO password_reset_tokens {token_hash, otp_hash, expira_en, usado=false}
        API->>DB: Invalidar tokens pendientes anteriores del usuario
        API->>SMTP: Enviar correo con enlace (?token=...) y OTP
    else Usuario no existe
        Note over API: No se hace nada, pero la respuesta es idéntica
    end
    API-->>Cliente: 200 OK {mensaje genérico}

    Cliente->>API: POST /auth/reset-password {token, otp, nueva_password}
    API->>DB: Buscar PasswordResetToken por hash(token)
    API->>API: Verificar OTP, expiración (15 min) y que no esté usado
    alt Todo válido
        API->>DB: UPDATE usuarios SET password_hash = hash(nueva_password)
        API->>DB: UPDATE password_reset_tokens SET usado = true
        API-->>Cliente: 200 OK
    else Inválido/expirado/reusado
        API-->>Cliente: 400 Bad Request
    end
```

**Seguridad del flujo:**
- El **token y el OTP se guardan hasheados** en `password_reset_tokens` (nunca en texto plano), igual que las contraseñas.
- Expiración corta configurable (`PASSWORD_RESET_EXPIRE_MINUTES`, default 15 minutos) y **de un solo uso** (`usado=true` tras consumirse).
- Al solicitar un nuevo OTP, se invalidan los tokens pendientes anteriores del mismo usuario (evita acumular tokens válidos).
- `POST /auth/forgot-password` está bajo el mismo rate limiting que login/registro (`RATE_LIMIT_FORGOT_PASSWORD`).
- El correo se envía por **SMTP real** (`utils/email.py::enviar_correo_recuperacion_password`), configurable vía `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM`/`SMTP_USE_TLS`; si SMTP no está configurado (ej. en desarrollo), se degrada a un log en vez de fallar la petición.

**Tests:** `tests/test_password_reset.py` (flujo feliz, OTP incorrecto, token expirado, token reusado, enumeración de usuarios, invalidación de tokens previos).

---

## Endpoints de páginas legales (placeholder)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/legal/politica-tratamiento-datos` | Contenido "En construcción..." (placeholder hasta tener el texto legal definitivo) |
| GET | `/legal/terminos-condiciones` | Ídem, términos y condiciones |

El frontend debe enlazar la casilla de aceptación del registro y el footer de la landing a estas dos páginas (ver `Frontend/Pantallas-Registro-y-Login.md`).

---

## Estructura del JWT Token

### Claims del token

| Claim | Tipo | Descripción |
|-------|------|-------------|
| `sub` (subject) | UUID | ID del usuario |
| `rol` | string | Rol del usuario: "solicitante", "importador", "asesor" o "admin" |
| `importador_id` | UUID \| null | **(Semana 3)** Empresa a la que pertenece la cuenta (dueño o asesor). `null` para solicitantes y admins |
| `exp` | timestamp | Fecha de expiración del token |
| `iat` | timestamp | Fecha de emisión del token |

> **Por qué se agregó `importador_id` (Semana 3):** antes se asumía `Usuario.id == Importador.id` para el rol "importador", lo que hacía imposible tener varias cuentas (dueño + asesores) por empresa. Ahora todas las comprobaciones de propiedad entre empresas (IDOR) usan este claim en vez del `sub` de la cuenta. Ver `utils/security.py::create_access_token` y `utils/dependencies.py::get_current_user`.

### Ejemplo de payload JWT

```json
{
    "sub": "550e8400-e29b-41d4-a716-446655440000",
    "rol": "asesor",
    "importador_id": "660f9500-f39c-52e5-b827-557766551111",
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
| **solicitante** | Cliente final que solicita cotizaciones | Cotizaciones propias, Órdenes propias, Chat propio, Pagos propios, reportar disputas |
| **importador** | Cuenta **dueña** de la empresa importadora | Envío de propuestas, gestión de asesores, perfil de empresa, formulario personalizado, pool de la empresa, chat asignado |
| **asesor** | Cuenta de un empleado de la empresa importadora (Semana 3; renombrado de "trabajador" en Semana 4) | Reclamar cotizaciones del pool de su empresa, redactar borradores de propuestas, negociar por chat, ver sus cotizaciones asignadas, su propio perfil personal |
| **admin** | Miembro del equipo de la plataforma | Todos los endpoints + alta de empresas importadoras, monitoreo/activación de cualquier cuenta, disputas y métricas |

> **Cierre de auto-registro (Semana 3):** `POST /auth/register` **solo** acepta `rol="solicitante"`. Las cuentas `importador` (dueño) las crea un admin con `POST /admin/importadores` (junto con la empresa), las cuentas `asesor` las crea el dueño con `POST /importadores/asesores`, y no existe ningún camino de auto-registro para `admin`. Esto cierra el hueco de seguridad donde cualquiera podía crearse una cuenta con rol elevado.

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
- **Password hashing con bcrypt:** Nunca almacenar contraseñas en texto plano (`passlib[bcrypt]`, ver `utils/security.py`)
- **JWT sin refresh tokens (MVP):** El token expira a las 24 horas; el usuario debe volver a iniciar sesión
- **Rate limiting en login:** Máximo 5 intentos de login por minuto por IP para prevenir fuerza bruta
- **CORS configurado:** Solo permitir orígenes autorizados (dominios del frontend)

### Estado de implementación (revisado 2026-07-06)

| Convención | Estado | Detalle |
|---|---|---|
| Password hashing con bcrypt | ✅ Implementado | `passlib.hash.bcrypt` en `utils/security.py` |
| JWT HS256 con `sub`/`rol`/`exp`/`iat` | ✅ Implementado | `utils/security.py::create_access_token` |
| Rate limiting en `/auth/login` | ✅ Implementado (antes solo era una convención documentada, sin código) | `slowapi`, límite configurable vía `RATE_LIMIT_LOGIN` (por defecto `5/minute` por IP), ver `routers/auth.py` |
| Rate limiting en `/auth/register` | ✅ Implementado | `RATE_LIMIT_REGISTER` (por defecto `10/minute` por IP) — previene registro masivo automatizado de cuentas |
| CORS restringido a orígenes conocidos | ✅ Implementado | `config.CORS_ORIGINS`, configurable por entorno |
| No filtrar detalles internos en errores 500 | ✅ Implementado | Manejador global de excepciones en `main.py`: cualquier excepción no controlada se registra en logs pero al cliente solo se le responde `{"error": "Error interno del servidor"}` |
| HTTPS en producción | ⬜ Depende del despliegue | No aplica en local/Docker; se debe configurar en el proveedor de hosting/reverse proxy |

### Estado de implementación (Semana 3, 2026-07-07)

| Convención | Estado | Detalle |
|---|---|---|
| Claim `importador_id` en el JWT | ✅ Implementado | `utils/security.py::create_access_token`, propagado en login/refresh (`services/auth_service.py`) |
| Cierre de auto-registro de `admin`/`importador` | ✅ Implementado | `services/auth_service.py::register_user` rechaza cualquier rol distinto de `solicitante` con `400 Bad Request` |
| Cuentas desactivables (`Usuario.activo`) | ✅ Implementado | Login y refresh de token rechazan cuentas con `activo=False` (`401 Unauthorized`), gestionable desde `PUT /admin/usuarios/{id}/estado` |
| Rol `asesor` con permisos limitados | ✅ Implementado | `require_rol_in`/`require_rol` en `utils/dependencies.py`; ver `Fases-Desarrollo/Semana-3-Chat-y-Pulido/Tareas-Semana-3.md` |
| Suite de tests de autenticación | ✅ 26/26 pasando | `tests/test_auth.py`, incluye rechazo de auto-registro elevado y bloqueo de cuentas desactivadas |

### Estado de implementación (Semana 4, 2026-07-08)

| Convención | Estado | Detalle |
|---|---|---|
| Registro diferenciado natural/jurídica con validación condicional | ✅ Implementado | `schemas/auth.py::RegistroRequest` (`model_validator`), `services/auth_service.py::register_user` |
| Aceptación obligatoria de política de datos | ✅ Implementado | `acepto_politica_datos` + `fecha_aceptacion_politica` en `models/usuario.py` |
| Placeholder de registro de importador | ✅ Implementado | Mensaje exacto "Contáctese con el equipo administrativo para registrar tu empresa importadora" |
| Páginas legales placeholder | ✅ Implementado | `routers/legal.py` |
| Recuperación de contraseña con OTP + SMTP real | ✅ Implementado | `models/password_reset.py`, `utils/email.py`, `routers/auth.py::forgot_password/reset_password` |
| Rename `trabajador` → `asesor` | ✅ Implementado | En modelos, endpoints, roles y tests (`tests/test_asesores.py`) |
| Roadmap: autenticación con Google (OAuth 2.0) | ⬜ Futuro | Ver `Backend/Seguridad.md` — no implementado en esta iteración |
| Roadmap: migración de hashing a Argon2 | ⬜ Futuro | Ver `Backend/Seguridad.md` — actualmente `bcrypt` vía `passlib`, suficiente para el MVP |