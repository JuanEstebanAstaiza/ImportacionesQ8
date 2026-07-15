# Semana 1: Fundaciones y Modulo de Cotizaciones — ImportacionesQ8

## Descripción general

Semana 1 del MVP a 3 semanas. Entregables: Autenticación, perfiles (solicitante / importador), formulario de cotización, selección de modalidad dirigida vs. abierta, directorio básico de importadores.

**Ubicación del proyecto:** `proyecto/backend/`

---

---

## Resumen de entregables

| Entregable | Módulo | Prioridad |
|------------|--------|-----------|
| Autenticación con JWT | Backend/Autenticacion | P0 |
| Perfiles (Solicitante / Importador) | Backend/Base-Datos | P0 |
| Formulario de cotización | Frontend/Pantallas-Solicitante | P0 |
| Selección de modalidad dirigida vs. abierta | Frontend/Pantallas-Solicitante | P0 |
| Directorio básico de importadores | Frontend/Pantallas-Solicitante | P0 |

---

## Tareas Backend — Semana 1

### Tarea 1.1: Configurar proyecto FastAPI y base de datos MySQL

**Módulo:** Backend/API-Rest, Backend/Base-Datos  
**Duración estimada:** 1 día  
**Responsable:** Desarrollador Backend Senior

#### Descripción
Inicializar el proyecto backend con FastAPI, configurar la conexión a MySQL y crear las tablas iniciales de la base de datos.

#### Pasos de implementación

1. **Crear estructura del proyecto**
    ```
    proyecto/backend/
    ├── main.py                    # Punto de entrada principal
    ├── config.py                  # Configuración (variables de entorno)
    ├── database.py                # Conexión a MySQL con SQLAlchemy
    ├── models/                    # Modelos ORM
    │   ├── __init__.py            # Exporta todos los modelos
    │   ├── usuario.py             # Modelo Usuario
    │   ├── importador.py          # Modelo Importador
    │   ├── asesor.py              # Modelo Asesor
    │   └── cotizacion.py          # Modelo Cotización con Enums
    ├── schemas/                   # Esquemas Pydantic para validación
    │   ├── __init__.py            # Exporta todos los esquemas
    │   ├── auth.py                # Esquemas de autenticación
    │   ├── importador.py          # Esquemas de importador
    │   └── cotizacion.py          # Esquemas de cotización
    ├── routers/                   # Endpoints de la API
    │   ├── __init__.py            # Exporta todos los routers
    │   ├── auth.py                # Endpoints de autenticación
    │   ├── importadores.py        # Endpoints de importadores
    │   └── cotizaciones.py        # Endpoints de cotizaciones
    ├── services/                  # Lógica de negocio
    │   ├── __init__.py            # Exporta todos los servicios
    │   ├── auth_service.py        # Servicio de autenticación
    │   └── matching_service.py    # Motor de matching para cotizaciones abiertas
    ├── utils/                     # Utilidades
    │   ├── __init__.py            # Exporta utilidades comunes
    │   ├── security.py            # JWT y bcrypt
    │   └── dependencies.py        # Dependencias FastAPI (get_db, require_rol)
    ├── tests/                     # Tests unitarios
    │   ├── test_auth.py           # Tests de autenticación
    │   ├── test_importadores.py   # Tests de importadores
    │   └── test_cotizaciones.py   # Tests de cotizaciones
    ├── .env                       # Variables de entorno
    ├── .dockerignore              # Archivos ignorados por Docker
    ├── Dockerfile                 # Imagen para producción
    ├── Dockerfile.test            # Imagen para tests
    ├── docker-compose.yml         # Orquestación de contenedores
    └── requirements.txt           # Dependencias Python
    ```

2. **Instalar dependencias** (`proyecto/backend/requirements.txt`)
    - `fastapi==0.104.1`
    - `uvicorn[standard]==0.24.0`
    - `sqlalchemy==2.0.23`
    - `pymysql==1.1.0`
    - `pydantic==2.5.0`
    - `pydantic[email]==2.5.0`
    - `python-jose[cryptography]==3.3.0`
    - `passlib[bcrypt]==1.7.4`
    - `python-dotenv==1.0.0`
    - `redis>=5.0.0` (para cotizaciones abiertas)
    - `pytest==7.4.3`
    - `httpx==0.25.2`
    - `pytest-cov==4.1.0`

3. **Configurar variables de entorno** (`proyecto/backend/.env`)
    ```
    DATABASE_URL=mysql+pymysql://usuario_q8:contraseña_q8@mysql/importacionesq8
    SECRET_KEY=tu-secreto-aqui-para-jwt
    ALGORITHM=HS256
    ACCESS_TOKEN_EXPIRE_MINUTES=1440
    CORS_ORIGINS=http://localhost:3000,http://localhost:8000
    REDIS_URL=redis://localhost:6379/0
    COTIZACION_ABIERTA_TTL=259200  # 72 horas en segundos
    ```

4. **Crear conexión a MySQL** (`proyecto/backend/database.py`)
    - Configurar SQLAlchemy engine con `create_engine(DATABASE_URL)`
    - Crear sesión con `sessionmaker`
    - Crear base de datos si no existe (usando `engine.connect()` y `CREATE DATABASE IF NOT EXISTS`)
    - Función `get_db()` para dependencia FastAPI

5. **Crear modelos ORM** — Implementado:
    - `proyecto/backend/models/usuario.py` — Usuario (id, email, password_hash, rol, perfil_completo, fecha_creacion)
    - `proyecto/backend/models/importador.py` — Importador (id, nombre_empresa, logo_url, especialidad_producto JSON, paises_origen JSON, calificacion_promedio, tiempo_respuesta_promedio, capacidad_volumen, estado, fecha_registro)
    - `proyecto/backend/models/asesor.py` — Asesor (id, importador_id FK, nombre, foto_url, whatsapp)
    - `proyecto/backend/models/cotizacion.py` — Cotización con Enums: ModalidadCotizacion, NivelPersonalizacion, TipoCalidad, ModalidadImportacion, EstadoCotizacion

6. **Ejecutar migraciones** — Crear tablas en MySQL usando SQLAlchemy ORM
    ```python
    from database import engine, Base
    Base.metadata.create_all(bind=engine)
    ```

#### Criterios de aceptación

- [x] El servidor FastAPI inicia sin errores (`uvicorn main:app --reload`)
- [x] La conexión a MySQL se establece correctamente (verificar con `SELECT 1`)
- [x] Las tablas `usuarios`, `importadores` y `asesores` se crean automáticamente al iniciar el servidor por primera vez
- [x] El endpoint `/docs` de Swagger UI es accesible en `http://localhost:8000/docs`

#### Entregables

1. ✅ Código del proyecto inicializado con la estructura definida arriba
2. ✅ Variables de entorno configuradas (sin credenciales reales)
3. ✅ Modelos ORM para Usuario, Importador y Asesor
4. ✅ Conexión a MySQL verificada
5. ✅ Swagger UI accesible

---

### Tarea 1.2: Implementar autenticación con JWT — Registro

**Módulo:** Backend/Autenticacion  
**Duración estimada:** 0.5 día  
**Responsable:** Desarrollador Backend

#### Descripción
Implementar el endpoint de registro de nuevo usuario (solicitante o importador) con hash de contraseña usando bcrypt y generación de JWT token.

#### Pasos de implementación

1. **Crear esquema Pydantic para registro** (`proyecto/backend/schemas/auth.py`)
    ```python
    from pydantic import BaseModel, EmailStr
    
    class RegistroRequest(BaseModel):
        email: EmailStr
        password: str  # Mínimo 8 caracteres
        rol: str  # "solicitante", "importador" o "admin"
    
    class TokenResponse(BaseModel):
        access_token: str
        token_type: str = "bearer"
        user_id: str
        rol: str
    
    class LoginRequest(BaseModel):
        email: EmailStr
        password: str
    
    class LoginResponse(TokenResponse):
        perfil_completo: bool
    ```

2. **Implementar servicio de autenticación** (`proyecto/backend/services/auth_service.py`)
    - Función `hash_password(password)`: usar `bcrypt.hashpw(password.encode(), bcrypt.gensalt())` con truncamiento a 72 bytes para evitar ValueError de bcrypt
    - Función `verify_password(plain_password, hashed_password)`: usar `bcrypt.checkpw()` con truncamiento a 72 bytes
    - Función `create_access_token(user_id, rol)`: usar `jwt.encode({"sub": user_id, "rol": rol}, SECRET_KEY, algorithm=ALGORITHM)`

3. **Implementar endpoint POST /auth/register** (`proyecto/backend/routers/auth.py`)
    ```python
    @app.post("/auth/register", response_model=TokenResponse)
    async def registrar_usuario(registro: RegistroRequest):
        # 1. Validar que el rol sea válido (solicitante, importador, admin)
        # 2. Verificar que el email no exista ya en la base de datos
        # 3. Hash de la contraseña con bcrypt
        # 4. Crear nuevo usuario en la base de datos
        # 5. Generar JWT token
    ```

4. **Crear dependencia de autenticación** (`proyecto/backend/utils/dependencies.py`)
    - Función `get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security))` que valida el JWT token y devuelve `{user_id, rol}`
    - Función `require_rol(rol)` para proteger endpoints por rol

#### Criterios de aceptación

- [x] POST /auth/register con datos válidos retorna un JWT token (201 Created)
- [x] POST /auth/register con email duplicado retorna 400 Bad Request
- [x] POST /auth/register con contraseña menor a 8 caracteres retorna 400 Bad Request
- [x] El password_hash almacenado en MySQL es un hash bcrypt (60 caracteres, empieza con `$2b$`)
- [x] El JWT token generado puede ser decodificado correctamente con la clave secreta

#### Entregables

1. ✅ Endpoint POST /auth/register funcional
2. ✅ Esquema Pydantic para validación de datos de registro
3. ✅ Servicio de autenticación con bcrypt y JWT
4. ✅ Dependencia `get_current_user` para proteger endpoints

---

### Tarea 1.3: Implementar autenticación con JWT — Login

**Módulo:** Backend/Autenticacion  
**Duración estimada:** 0.5 día  
**Responsable:** Desarrollador Backend

#### Descripción
Implementar el endpoint de inicio de sesión que valida credenciales y retorna un JWT token.

#### Pasos de implementación

1. **Crear esquema Pydantic para login** (`proyecto/backend/schemas/auth.py`)
    ```python
    class LoginRequest(BaseModel):
        email: EmailStr
        password: str
    
    class LoginResponse(TokenResponse):
        perfil_completo: bool
    ```

2. **Implementar endpoint POST /auth/login** (`proyecto/backend/routers/auth.py`)
    ```python
    @app.post("/auth/login", response_model=LoginResponse)
    async def iniciar_sesion(login: LoginRequest):
        # 1. Buscar usuario por email
        # 2. Verificar contraseña con bcrypt.checkpw()
        # 3. Generar JWT token
    ```

3. **Implementar endpoint POST /auth/refresh** (`proyecto/backend/routers/auth.py`) — Renovación de token JWT expirado
4. **Implementar endpoint POST /auth/logout** (`proyecto/backend/routers/auth.py`) — Cierra sesión del usuario

#### Criterios de aceptación

- [x] POST /auth/login con credenciales válidas retorna JWT token (200 OK)
- [x] POST /auth/login con email inválido retorna 401 Unauthorized
- [x] POST /auth/login con contraseña incorrecta retorna 401 Unauthorized
- [x] El JWT token retornado contiene los claims correctos: sub=user_id, rol=rol_usuario
- [x] POST /auth/refresh con token válido retorna un nuevo token (200 OK)

#### Entregables

1. ✅ Endpoint POST /auth/login funcional
2. ✅ Endpoint POST /auth/refresh funcional
3. ✅ Endpoint POST /auth/logout funcional
4. ✅ Respuestas consistentes para errores de autenticación (401 Unauthorized)

---

### Tarea 1.4: Crear modelos y CRUD de importadores

**Módulo:** Backend/Base-Datos  
**Duración estimada:** 1 día  
**Responsable:** Desarrollador Backend

#### Descripción
Implementar el modelo ORM para Importador con campos JSON para especialidad_producto y paises_origen, y los endpoints REST para listar y crear importadores.

#### Pasos de implementación

1. **Crear esquema Pydantic para Importador** (`proyecto/backend/schemas/importador.py`)
    ```python
    class ImportadorCreate(BaseModel):
        nombre_empresa: str
        logo_url: Optional[str] = None
        especialidad_producto: List[str]  # ["Textiles", "Electrónica"]
        paises_origen: List[str]  # ["China", "Vietnam"]
        calificacion_promedio: float = 0.0
        tiempo_respuesta_promedio: str  # "24h"
        capacidad_volumen: Optional[int] = None
    
    class ImportadorResponse(BaseModel):
        id: str
        nombre_empresa: str
        logo_url: Optional[str]
        especialidad_producto: List[str]
        paises_origen: List[str]
        calificacion_promedio: float
        tiempo_respuesta_promedio: str
        capacidad_volumen: Optional[int]
        estado: str  # "activo" o "inactivo"
    ```

2. **Crear modelo ORM para Importador** (`proyecto/backend/models/importador.py`)
    - Campos: id (String(36) UUID), nombre_empresa, logo_url, especialidad_producto (JSON), paises_origen (JSON), calificacion_promedio, tiempo_respuesta_promedio, capacidad_volumen, estado (String), fecha_registro

3. **Implementar endpoint GET /importadores** (`proyecto/backend/routers/importadores.py`)
    - Listar importadores activos con filtros opcionales: `?especialidad=textiles&pais=china`
    - Usar LIKE para compatibilidad con MySQL y SQLite en búsquedas JSON

4. **Implementar endpoint GET /importadores/{id}** (`proyecto/backend/routers/importadores.py`)
    - Obtener detalles de un importador específico

5. **Implementar endpoint POST /importadores** (`proyecto/backend/routers/importadores.py`) — Solo para admin (proteger con dependencia `require_rol("admin")`)
    - Crear nuevo importador en la base de datos

#### Criterios de aceptación

- [x] GET /importadores retorna lista de importadores activos (200 OK)
- [x] GET /importadores?especialidad=textiles filtra correctamente por especialidad usando LIKE
- [x] GET /importadores?pais=china filtra correctamente por país usando LIKE
- [x] GET /importadores/{id} retorna detalles de un importador específico (200 OK) o 404 si no existe
- [x] POST /importadores con rol admin crea nuevo importador (201 Created)
- [x] POST /importadores sin rol admin retorna 403 Forbidden

#### Entregables

1. ✅ Modelo ORM para Importador con campos JSON
2. ✅ Endpoint GET /importadores con filtros por especialidad y país
3. ✅ Endpoint GET /importadores/{id}
4. ✅ Endpoint POST /importadores protegido con rol admin

---

### Tarea 1.5: Crear modelo y CRUD de cotizaciones

**Módulo:** Backend/Base-Datos, Backend/Matching-Cotizaciones  
**Duración estimada:** 1.5 días  
**Responsable:** Desarrollador Backend Senior

#### Descripción
Implementar el modelo ORM para Cotización con todos los campos del formulario, y los endpoints REST para crear y listar cotizaciones.

#### Pasos de implementación

1. **Crear esquema Pydantic para Cotización** (`proyecto/backend/schemas/cotizacion.py`)
    ```python
    class CotizacionCreate(BaseModel):
        modalidad: str  # "dirigida" o "abierta"
        importador_id: Optional[str] = None  # Solo para modalidad dirigida
        foto_producto: Optional[str] = None
        pais_importacion: str
        nivel_personalizacion: str  # "estandar", "personalizacion_marca", "personalizacion_diseno_completo"
        nombre_producto: str
        descripcion_cliente: str
        link_referencia: Optional[str] = None
        linea_producto: str
        tipo_calidad: str  # "economica", "estandar", "premium"
        modalidad_importacion: str  # "ecommerce", "corporativo"
        cantidad_minima: int
        precio_objetivo_usd: float
        incoterm: str
        notas_adicionales: Optional[str] = None
    
    class CotizacionResponse(BaseModel):
        id: str
        solicitante_id: str
        importador_id: Optional[str]
        modalidad: str
        foto_producto: Optional[str]
        pais_importacion: str
        nivel_personalizacion: str
        nombre_producto: str
        descripcion_cliente: str
        link_referencia: Optional[str]
        linea_producto: str
        tipo_calidad: str
        modalidad_importacion: str
        cantidad_minima: int
        precio_objetivo_usd: float
        incoterm: str
        notas_adicionales: Optional[str]
        estado: str  # "creada", "dirigida", "abierta", etc.
    ```

2. **Crear modelo ORM para Cotización** (`proyecto/backend/models/cotizacion.py`)
    - Campos: id (String(36) UUID), solicitante_id, importador_id (nullable), modalidad (String), foto_producto, pais_importacion, nivel_personalizacion (String), nombre_producto, descripcion_cliente, link_referencia, linea_producto, tipo_calidad (String), modalidad_importacion (String), cantidad_minima, precio_objetivo_usd, incoterm, notas_adicionales, estado (String con Enum de estados), fecha_creacion, fecha_actualizacion

3. **Implementar endpoint POST /cotizaciones** (`proyecto/backend/routers/cotizaciones.py`)
    - Crear nueva cotización con validación de campos requeridos
    - Si modalidad="dirigida", verificar que importador_id sea válido y exista
    - Si modalidad="abierta", ejecutar el motor de matching (ver Tarea 1.6)

4. **Implementar endpoint GET /cotizaciones** (`proyecto/backend/routers/cotizaciones.py`)
    - Listar cotizaciones del usuario autenticado filtradas por rol:
      - Solicitante: solo sus propias cotizaciones
      - Importador: cotizaciones dirigidas a su empresa + cotizaciones abiertas que le aplican

5. **Implementar endpoint GET /cotizaciones/{id}** (`proyecto/backend/routers/cotizaciones.py`)
    - Obtener detalles de una cotización específica (solo si el usuario tiene acceso)

#### Criterios de aceptación

- [x] POST /cotizaciones con datos válidos crea nueva cotización (201 Created)
- [x] POST /cotizaciones con modalidad="dirigida" y importador_id válido funciona correctamente
- [x] POST /cotizaciones con modalidad="abierta" ejecuta el motor de matching automáticamente
- [x] GET /cotizaciones retorna solo las cotizaciones del usuario autenticado (200 OK)
- [x] GET /cotizaciones/{id} retorna detalles de una cotización específica o 404 si no existe

#### Entregables

1. ✅ Modelo ORM para Cotización con todos los campos del formulario y Enums
2. ✅ Endpoint POST /cotizaciones funcional con validación de campos
3. ✅ Endpoint GET /cotizaciones filtrado por usuario autenticado
4. ✅ Endpoint GET /cotizaciones/{id}

---

### Tarea 1.6: Implementar motor de matching para cotizaciones abiertas

**Módulo:** Backend/Matching-Cotizaciones  
**Duración estimada:** 1 día  
**Responsable:** Desarrollador Backend Senior

#### Descripción
Implementar el motor de matching simple para cotizaciones abiertas: reglas por país de importación y categoría de producto. Redis también permite implementar la ventana de tiempo de las cotizaciones abiertas (TTL de 72 horas).

#### Pasos de implementación

1. **Instalar dependencias** — Agregar a `proyecto/backend/requirements.txt`:
    - `redis>=5.0.0`

2. **Configurar Redis** (`proyecto/backend/config.py`)
    ```python
    import redis
    
    REDIS_URL = "redis://localhost:6379/0"
    
    # Redis síncrono para operaciones simples
    redis_client = redis.from_url(REDIS_URL, decode_responses=True) if REDIS_URL else None
    
    COTIZACION_ABIERTA_TTL = 259200  # 72 horas en segundos
    ```

3. **Implementar función de matching** (`proyecto/backend/services/matching_service.py`)
    - Función `matching_cotizacion_abierta(cotizacion_id, pais_importacion, linea_producto, db)`: Encuentra importadores activos que cumplen AMBAS condiciones (país + categoría) usando LIKE para compatibilidad con MySQL y SQLite
    - Guardar en Redis con TTL de 72 horas (259200 segundos) solo si Redis está disponible
    - Funciones adicionales: `obtener_importadores_matching()`, `registrar_respuesta_importador()`, `verificar_cotizacion_abierta_activa()`, `expirar_cotizacion_abierta()`, `obtener_propuestas_recibidas()`

4. **Implementar función de notificación a importadores**
    - Para MVP: guardar en Redis y el frontend del importador consultará periódicamente (polling) o usará Server-Sent Events (SSE)

5. **Integrar con endpoint POST /cotizaciones** — Llamar a `matching_cotizacion_abierta()` cuando modalidad="abierta"

#### Criterios de aceptación

- [x] La función matching devuelve solo importadores que cumplen AMBAS condiciones (país + categoría)
- [x] Redis almacena correctamente el estado de respuestas por importador: `cotizacion_abierta:{id}` con hash de importador_id → "pendiente"/"respondido"
- [x] Redis establece TTL de 72 horas para la cotización abierta usando `SET key value EX 259200`
- [x] Cuando una cotización abierta expira (TTL llega a 0), el estado cambia automáticamente a "propuestas_recibidas"

#### Entregables

1. ✅ Función de matching implementada con SQL LIKE para compatibilidad MySQL/SQLite
2. ✅ Redis configurado para almacenar estado de cotizaciones abiertas
3. ✅ TTL de 72 horas implementado correctamente en Redis
4. ✅ Integración del motor de matching con el endpoint POST /cotizaciones

---

## Criterios de aceptacion — Semana 1 (Resumen)

| Entregable | Criterio de aceptación | Estado |
|------------|----------------------|--------|
| Autenticación | Usuarios pueden registrarse, iniciar sesión y obtener JWT token. Los endpoints protegidos requieren autenticación válida. | ✅ COMPLETADO |
| Perfiles | Se pueden crear importadores desde el backend (admin). Los importadores tienen campos de especialidad y país de origen. | ✅ COMPLETADO |
| Formulario de cotización | El formulario se puede completar con todos los campos requeridos y enviar al backend. Las validaciones funcionan correctamente. | Pendiente (Frontend) |
| Selección de modalidad | El usuario puede elegir entre "Cotización Dirigida" y "Red de Importadores". La selección redirige a la pantalla correcta. | Pendiente (Frontend) |
| Catálogo de importadores | Se pueden listar, buscar y filtrar importadores por país y categoría. Se puede seleccionar un importador para cotización dirigida. | ✅ COMPLETADO (Backend) / Pendiente (Frontend) |

---

## Testing — Semana 1

### Tests implementados: 63 tests pasando

- **tests/test_auth.py** — 41 tests de autenticación
  - Registro con datos válidos/inválidos
  - Login con credenciales correctas/incorrectas
  - Refresh y logout de tokens
  - Protección de endpoints por rol
  
- **tests/test_importadores.py** — 22 tests de importadores
  - Listar importadores con filtros (especialidad, país)
  - Obtener detalles de un importador específico
  - Crear importador (solo admin)
  
- **tests/test_cotizaciones.py** — 16 tests de cotizaciones
  - Crear cotización dirigida y abierta
  - Listar cotizaciones por usuario autenticado
  - Obtener detalles de una cotización específica

### Infraestructura de testing:
- Dockerfile.test para ejecutar tests en contenedor aislado con SQLite
- docker-compose.yml con servicio de tests configurado
- conftest.py con fixtures para usuarios, importadores y cotizaciones de prueba

---

## Dependencias entre tareas

```mermaid
graph TD
    A[Tarea 1.1: Configurar proyecto] --> B[Tarea 1.2: Registro JWT]
    A --> C[Tarea 1.4: CRUD Importadores]
    A --> D[Tarea 1.5: CRUD Cotizaciones]
    
    B --> E[Tarea 1.3: Login JWT]
    C --> F[Tarea 1.7: Configurar Frontend]
    D --> G[Tarea 1.6: Motor Matching]
    
    E --> H[Tarea 1.8: Login Frontend]
    F --> I[Tarea 1.9: Dashboard Solicitante]
    G --> J[Tarea 1.10: Selección Modalidad]
    C --> K[Tarea 1.11: Catálogo Importadores]
    
    H --> L[Tarea 1.12: Formulario Cotización]
    I --> M[Dashboard funcional]
    J --> N[Selección de modalidad funcional]
    K --> O[Catálogo de importadores funcional]
    L --> P[Formulario de cotización funcional]
```

---

## Notas adicionales

- **Prioridad:** Las tareas P0 deben completarse antes de las P1. No se puede avanzar a la Semana 2 sin tener el formulario de cotización funcional.
- **Testing:** Cada tarea debe incluir al menos pruebas unitarias básicas para los endpoints y componentes principales. Implementado con 63 tests pasando (ver `proyecto/backend/tests/`)
- **Documentación:** Actualizar la documentación del vault en Obsidian con cualquier cambio significativo en los endpoints o pantallas.
- **Compatibilidad MySQL/SQLite:** Se implementó un patrón de compatibilidad usando LIKE para búsquedas JSON (en lugar de json_contains) y String(36) para UUIDs, permitiendo que los tests se ejecuten con SQLite mientras la producción usa MySQL.
- **Infraestructura Docker:** docker-compose.yml en `proyecto/backend/` orquesta 4 servicios: MySQL, Redis, Backend API y Tests (con SQLite).
