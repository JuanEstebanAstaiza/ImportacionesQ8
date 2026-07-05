# 📅 Semana 1: Fundaciones y Módulo de Cotizaciones — ImportacionesQ8

## Descripción general

Semana 1 del MVP a 3 semanas. Entregables: Autenticación, perfiles (solicitante / importador), formulario de cotización, selección de modalidad dirigida vs. abierta, directorio básico de importadores.

---

## 📋 Resumen de entregables

| Entregable | Módulo | Prioridad |
|------------|--------|-----------|
| Autenticación con JWT | Backend/Autenticacion | P0 |
| Perfiles (Solicitante / Importador) | Backend/Base-Datos | P0 |
| Formulario de cotización | Frontend/Pantallas-Solicitante | P0 |
| Selección de modalidad dirigida vs. abierta | Frontend/Pantallas-Solicitante | P0 |
| Directorio básico de importadores | Frontend/Pantallas-Solicitante | P0 |

---

## 🔧 Tareas Backend — Semana 1

### Tarea 1.1: Configurar proyecto FastAPI y base de datos MySQL

**Módulo:** Backend/API-Rest, Backend/Base-Datos  
**Duración estimada:** 1 día  
**Responsable:** Desarrollador Backend Senior

#### Descripción
Inicializar el proyecto backend con FastAPI, configurar la conexión a MySQL y crear las tablas iniciales de la base de datos.

#### Pasos de implementación

1. **Crear estructura del proyecto**
   ```
   backend/
   ├── main.py                    # Punto de entrada principal
   ├── config.py                  # Configuración (variables de entorno)
   ├── database.py                # Conexión a MySQL con SQLAlchemy
   ├── models/                    # Modelos ORM
   │   ├── __init__.py
   │   ├── usuario.py
   │   ├── importador.py
   │   ├── asesor.py
   │   └── cotizacion.py
   ├── schemas/                   # Esquemas Pydantic para validación
   │   ├── __init__.py
   │   ├── auth.py
   │   ├── importador.py
   │   └── cotizacion.py
   ├── routers/                   # Endpoints de la API
   │   ├── __init__.py
   │   ├── auth.py
   │   ├── importadores.py
   │   └── cotizaciones.py
   ├── services/                  # Lógica de negocio
   │   ├── __init__.py
   │   ├── auth_service.py
   │   └── matching_service.py
   ├── utils/                     # Utilidades
   │   ├── __init__.py
   │   ├── security.py           # JWT y bcrypt
   │   └── dependencies.py       # Dependencias FastAPI
   ├── .env                       # Variables de entorno
   └── requirements.txt           # Dependencias Python
   ```

2. **Instalar dependencias** (`requirements.txt`)
   - `fastapi==0.104.1`
   - `uvicorn[standard]==0.24.0`
   - `sqlalchemy==2.0.23`
   - `pymysql==1.1.0`
   - `pydantic==2.5.0`
   - `python-jose[cryptography]==3.3.0`
   - `passlib[bcrypt]==1.7.4`
   - `python-dotenv==1.0.0`

3. **Configurar variables de entorno** (`.env`)
   ```
   DATABASE_URL=mysql+pymysql://usuario:contraseña@localhost/importacionesq8
   SECRET_KEY=tu-secreto-aqui-para-jwt
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=1440
   CORS_ORIGINS=http://localhost:3000,http://localhost:8000
   ```

4. **Crear conexión a MySQL** (`database.py`)
   - Configurar SQLAlchemy engine con `create_engine(DATABASE_URL)`
   - Crear sesión con `sessionmaker`
   - Crear base de datos si no existe (usando `engine.connect()` y `CREATE DATABASE IF NOT EXISTS`)

5. **Crear modelos ORM** — Implementar las clases para:
   - `Usuario` (id, email, password_hash, rol, perfil_completo, fecha_creacion)
   - `Importador` (id, nombre_empresa, logo_url, especialidad_producto JSON, paises_origen JSON, calificacion_promedio, tiempo_respuesta_promedio, capacidad_volumen, estado, fecha_registro)
   - `Asesor` (id, importador_id FK, nombre, foto_url, whatsapp)

6. **Ejecutar migraciones** — Crear tablas en MySQL usando SQLAlchemy ORM:
   ```python
   from database import engine, Base
   Base.metadata.create_all(bind=engine)
   ```

#### Criterios de aceptación

- [ ] El servidor FastAPI inicia sin errores (`uvicorn main:app --reload`)
- [ ] La conexión a MySQL se establece correctamente (verificar con `SELECT 1`)
- [ ] Las tablas `usuarios`, `importadores` y `asesores` se crean automáticamente al iniciar el servidor por primera vez
- [ ] El endpoint `/docs` de Swagger UI es accesible en `http://localhost:8000/docs`

#### Entregables

1. Código del proyecto inicializado con la estructura definida arriba
2. Variables de entorno configuradas (sin credenciales reales)
3. Modelos ORM para Usuario, Importador y Asesor
4. Conexión a MySQL verificada
5. Swagger UI accesible

---

### Tarea 1.2: Implementar autenticación con JWT — Registro

**Módulo:** Backend/Autenticacion  
**Duración estimada:** 0.5 día  
**Responsable:** Desarrollador Backend

#### Descripción
Implementar el endpoint de registro de nuevo usuario (solicitante o importador) con hash de contraseña usando bcrypt y generación de JWT token.

#### Pasos de implementación

1. **Crear esquema Pydantic para registro** (`schemas/auth.py`)
   ```python
   from pydantic import BaseModel, EmailStr
   
   class RegistroRequest(BaseModel):
       email: EmailStr
       password: str  # Mínimo 8 caracteres
       rol: str  # "solicitante" o "importador"
   
   class TokenResponse(BaseModel):
       access_token: str
       token_type: str = "bearer"
       user_id: str
       rol: str
   ```

2. **Implementar servicio de autenticación** (`services/auth_service.py`)
   - Función `hash_password(password)`: usar `bcrypt.hashpw(password.encode(), bcrypt.gensalt())`
   - Función `verify_password(plain_password, hashed_password)`: usar `bcrypt.checkpw()`
   - Función `create_access_token(user_id, rol)`: usar `jwt.encode({"sub": user_id, "rol": rol}, SECRET_KEY, algorithm=ALGORITHM)`

3. **Implementar endpoint POST /auth/register** (`routers/auth.py`)
   ```python
   @app.post("/auth/register", response_model=TokenResponse)
   async def registrar_usuario(registro: RegistroRequest):
       # 1. Verificar que el email no exista ya en la base de datos
       usuario_existente = db.query(Usuario).filter(Usuario.email == registro.email).first()
       if usuario_existente:
           raise HTTPException(status_code=400, detail="El email ya está registrado")
       
       # 2. Validar que el rol sea válido
       if registro.rol not in ["solicitante", "importador"]:
           raise HTTPException(status_code=400, detail="Rol inválido")
       
       # 3. Hash de la contraseña
       password_hash = hash_password(registro.password)
       
       # 4. Crear nuevo usuario en la base de datos
       nuevo_usuario = Usuario(
           email=registro.email,
           password_hash=password_hash,
           rol=registro.rol,
           perfil_completo=False
       )
       db.add(nuevo_usuario)
       db.commit()
       db.refresh(nuevo_usuario)
       
       # 5. Generar JWT token
       access_token = create_access_token(str(nuevo_usuario.id), registro.rol)
       
       return TokenResponse(access_token=access_token, user_id=str(nuevo_usuario.id), rol=registro.rol)
   ```

4. **Crear dependencia de autenticación** (`utils/dependencies.py`)
   - Función `get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security))` que valida el JWT token y devuelve `{user_id, rol}`

#### Criterios de aceptación

- [ ] POST /auth/register con datos válidos retorna un JWT token (201 Created)
- [ ] POST /auth/register con email duplicado retorna 400 Bad Request
- [ ] POST /auth/register con contraseña menor a 8 caracteres retorna 400 Bad Request
- [ ] El password_hash almacenado en MySQL es un hash bcrypt (60 caracteres, empieza con `$2b$`)
- [ ] El JWT token generado puede ser decodificado correctamente con la clave secreta

#### Entregables

1. Endpoint POST /auth/register funcional
2. Esquema Pydantic para validación de datos de registro
3. Servicio de autenticación con bcrypt y JWT
4. Dependencia `get_current_user` para proteger endpoints

---

### Tarea 1.3: Implementar autenticación con JWT — Login

**Módulo:** Backend/Autenticacion  
**Duración estimada:** 0.5 día  
**Responsable:** Desarrollador Backend

#### Descripción
Implementar el endpoint de inicio de sesión que valida credenciales y retorna un JWT token.

#### Pasos de implementación

1. **Crear esquema Pydantic para login** (`schemas/auth.py`)
   ```python
   class LoginRequest(BaseModel):
       email: EmailStr
       password: str
   
   class LoginResponse(TokenResponse):
       perfil_completo: bool
   ```

2. **Implementar endpoint POST /auth/login** (`routers/auth.py`)
   ```python
   @app.post("/auth/login", response_model=LoginResponse)
   async def iniciar_sesion(login: LoginRequest):
       # 1. Buscar usuario por email
       usuario = db.query(Usuario).filter(Usuario.email == login.email).first()
       
       if not usuario or not verify_password(login.password, usuario.password_hash):
           raise HTTPException(status_code=401, detail="Credenciales inválidas")
       
       # 2. Generar JWT token
       access_token = create_access_token(str(usuario.id), usuario.rol)
       
       return LoginResponse(
           access_token=access_token,
           user_id=str(usuario.id),
           rol=usuario.rol,
           perfil_completo=usuario.perfil_completo
       )
   ```

3. **Implementar endpoint POST /auth/refresh** (`routers/auth.py`) — Renovación de token JWT expirado
   - Recibir el token actual en el header Authorization: Bearer <token>
   - Validar que el token sea válido (no expirado)
   - Generar un nuevo token con los mismos claims

#### Criterios de aceptación

- [ ] POST /auth/login con credenciales válidas retorna JWT token (200 OK)
- [ ] POST /auth/login con email inválido retorna 401 Unauthorized
- [ ] POST /auth/login con contraseña incorrecta retorna 401 Unauthorized
- [ ] El JWT token retornado contiene los claims correctos: sub=user_id, rol=rol_usuario
- [ ] POST /auth/refresh con token válido retorna un nuevo token (200 OK)

#### Entregables

1. Endpoint POST /auth/login funcional
2. Endpoint POST /auth/refresh funcional
3. Respuestas consistentes para errores de autenticación (401 Unauthorized)

---

### Tarea 1.4: Crear modelos y CRUD de importadores

**Módulo:** Backend/Base-Datos  
**Duración estimada:** 1 día  
**Responsable:** Desarrollador Backend

#### Descripción
Implementar el modelo ORM para Importador con campos JSON para especialidad_producto y paises_origen, y los endpoints REST para listar y crear importadores.

#### Pasos de implementación

1. **Crear esquema Pydantic para Importador** (`schemas/importador.py`)
   ```python
   from pydantic import BaseModel
   from typing import List, Optional
   
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

2. **Crear modelo ORM para Importador** (`models/importador.py`)
   - Campos: id (UUID), nombre_empresa, logo_url, especialidad_producto (JSON), paises_origen (JSON), calificacion_promedio, tiempo_respuesta_promedio, capacidad_volumen, estado (ENUM), fecha_registro

3. **Implementar endpoint GET /importadores** (`routers/importadores.py`)
   - Listar importadores activos con filtros opcionales: `?especialidad=textiles&pais=china`
   ```python
   @app.get("/importadores", response_model=List[ImportadorResponse])
   async def listar_importadores(
       especialidad: Optional[str] = None,
       pais: Optional[str] = None,
       db: Session = Depends(get_db)
   ):
       query = db.query(Importador).filter(Importador.estado == "activo")
       
       if especialidad:
           # Buscar en JSON usando JSON_CONTAINS
           query = query.filter(func.json_contains(Importador.especialidad_producto, f'"{especialidad}"'))
       
       if pais:
           query = query.filter(func.json_contains(Importador.paises_origen, f'"{pais}"'))
       
       return query.all()
   ```

4. **Implementar endpoint GET /importadores/{id}** (`routers/importadores.py`)
   - Obtener detalles de un importador específico

5. **Implementar endpoint POST /importadores** — Solo para admin (proteger con dependencia `require_rol("admin")`)
   - Crear nuevo importador en la base de datos

#### Criterios de aceptación

- [ ] GET /importadores retorna lista de importadores activos (200 OK)
- [ ] GET /importadores?especialidad=textiles filtra correctamente por especialidad usando JSON_CONTAINS
- [ ] GET /importadores?pais=china filtra correctamente por país usando JSON_CONTAINS
- [ ] GET /importadores/{id} retorna detalles de un importador específico (200 OK) o 404 si no existe
- [ ] POST /importadores con rol admin crea nuevo importador (201 Created)
- [ ] POST /importadores sin rol admin retorna 403 Forbidden

#### Entregables

1. Modelo ORM para Importador con campos JSON
2. Endpoint GET /importadores con filtros por especialidad y país
3. Endpoint GET /importadores/{id}
4. Endpoint POST /importadores protegido con rol admin

---

### Tarea 1.5: Crear modelo y CRUD de cotizaciones

**Módulo:** Backend/Base-Datos, Backend/Matching-Cotizaciones  
**Duración estimada:** 1.5 días  
**Responsable:** Desarrollador Backend Senior

#### Descripción
Implementar el modelo ORM para Cotización con todos los campos del formulario, y los endpoints REST para crear y listar cotizaciones.

#### Pasos de implementación

1. **Crear esquema Pydantic para Cotización** (`schemas/cotizacion.py`)
   ```python
   from pydantic import BaseModel
   from typing import Optional
   
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

2. **Crear modelo ORM para Cotización** (`models/cotizacion.py`)
   - Campos: id (UUID), solicitante_id FK, importador_id FK (nullable), modalidad (ENUM), foto_producto, pais_importacion, nivel_personalizacion (ENUM), nombre_producto, descripcion_cliente, link_referencia, linea_producto, tipo_calidad (ENUM), modalidad_importacion (ENUM), cantidad_minima, precio_objetivo_usd, incoterm, notas_adicionales, estado (ENUM), fecha_creacion, fecha_actualizacion

3. **Implementar endpoint POST /cotizaciones** (`routers/cotizaciones.py`)
   - Crear nueva cotización con validación de campos requeridos
   - Si modalidad="dirigida", verificar que importador_id sea válido y exista
   - Si modalidad="abierta", ejecutar el motor de matching (ver Tarea 1.6)

4. **Implementar endpoint GET /cotizaciones** (`routers/cotizaciones.py`)
   - Listar cotizaciones del usuario autenticado filtradas por rol:
     - Solicitante: solo sus propias cotizaciones
     - Importador: cotizaciones dirigidas a su empresa + cotizaciones abiertas que le aplican

5. **Implementar endpoint GET /cotizaciones/{id}** (`routers/cotizaciones.py`)
   - Obtener detalles de una cotización específica (solo si el usuario tiene acceso)

#### Criterios de aceptación

- [ ] POST /cotizaciones con datos válidos crea nueva cotización (201 Created)
- [ ] POST /cotizaciones con modalidad="dirigida" y importador_id válido funciona correctamente
- [ ] POST /cotizaciones con modalidad="abierta" ejecuta el motor de matching automáticamente
- [ ] GET /cotizaciones retorna solo las cotizaciones del usuario autenticado (200 OK)
- [ ] GET /cotizaciones/{id} retorna detalles de una cotización específica o 404 si no existe

#### Entregables

1. Modelo ORM para Cotización con todos los campos del formulario
2. Endpoint POST /cotizaciones funcional con validación de campos
3. Endpoint GET /cotizaciones filtrado por usuario autenticado
4. Endpoint GET /cotizaciones/{id}

---

### Tarea 1.6: Implementar motor de matching para cotizaciones abiertas

**Módulo:** Backend/Matching-Cotizaciones  
**Duración estimada:** 1 día  
**Responsable:** Desarrollador Backend Senior

#### Descripción
Implementar el motor de matching simple para cotizaciones abiertas: reglas por país de importación y categoría de producto. Redis también permite implementar la ventana de tiempo de las cotizaciones abiertas (TTL de 72 horas).

#### Pasos de implementación

1. **Instalar dependencias** — Agregar a `requirements.txt`:
   - `redis==5.0.1`
   - `aioredis==2.0.1`

2. **Configurar Redis** (`config.py`)
   ```python
   import redis
   import aioredis
   
   REDIS_URL = "redis://localhost:6379/0"
   
   # Redis síncrono para operaciones simples
   redis_client = redis.from_url(REDIS_URL, decode_responses=True)
   
   # Redis asíncrono para Pub/Sub (chat en tiempo real — se usará en Semana 3)
   async def get_redis_async():
       return await aioredis.from_url(REDIS_URL, decode_responses=True)
   ```

3. **Implementar función de matching** (`services/matching_service.py`)
   ```python
   from sqlalchemy import func
   
   async def matching_cotizacion_abierta(cotizacion_id: str, pais_importacion: str, linea_producto: str):
       """
       Encuentra todos los importadores activos que aplican a una cotización abierta.
       
       Un importador recibe la cotización si cumple AMBAS condiciones:
       - El importador opera desde el país de origen del producto
       - El importador tiene la categoría de producto como especialidad
       """
       importadores = db.query(Importador).filter(
           Importador.estado == "activo",
           func.json_contains(Importador.paises_origen, f'"{pais_importacion}"'),
           func.json_contains(Importador.especialidad_producto, f'"{linea_producto}"')
       ).all()
       
       # Guardar en Redis con TTL de 72 horas (259200 segundos)
       redis_client.hset(f"cotizacion_abierta:{cotizacion_id}", mapping={
           str(importador.id): "pendiente" for importador in importadores
       })
       redis_client.setex(
           f"cotizacion_abierta:{cotizacion_id}:expiracion",
           259200,  # 72 horas en segundos
           str(datetime.now() + timedelta(hours=72))
       )
       
       return importadores
   ```

4. **Implementar función de notificación a importadores** (`services/matching_service.py`)
   - Para MVP: guardar en Redis y el frontend del importador consultará periódicamente (polling) o usará Server-Sent Events (SSE)
   - En el futuro: WebSocket para notificaciones push

5. **Integrar con endpoint POST /cotizaciones** — Llamar a `matching_cotizacion_abierta()` cuando modalidad="abierta"

#### Criterios de aceptación

- [ ] La función matching devuelve solo importadores que cumplen AMBAS condiciones (país + categoría)
- [ ] Redis almacena correctamente el estado de respuestas por importador: `cotizacion_abierta:{id}` con hash de importador_id → "pendiente"/"respondido"
- [ ] Redis establece TTL de 72 horas para la cotización abierta usando `SET key value EX 259200`
- [ ] Cuando una cotización abierta expira (TTL llega a 0), el estado cambia automáticamente a "propuestas_recibidas"

#### Entregables

1. Función de matching implementada con SQL JSON_CONTAINS
2. Redis configurado para almacenar estado de cotizaciones abiertas
3. TTL de 72 horas implementado correctamente en Redis
4. Integración del motor de matching con el endpoint POST /cotizaciones

---

## 🎨 Tareas Frontend — Semana 1

### Tarea 1.7: Configurar proyecto React/Next.js con TypeScript y sistema de diseño

**Módulo:** Frontend  
**Duración estimada:** 0.5 día  
**Responsable:** Desarrollador Frontend Senior

#### Descripción
Inicializar el proyecto frontend con Next.js, TypeScript, Tailwind CSS y configurar el sistema de diseño (tokens de colores, tipografía, espaciado).

#### Pasos de implementación

1. **Crear estructura del proyecto**
   ```bash
   npx create-next-app@latest frontend --typescript --tailwind --app
   cd frontend
   
   # Instalar dependencias adicionales
   npm install axios @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-select @radix-ui/react-radio-group
   ```

2. **Configurar Tailwind CSS** (`tailwind.config.ts`)
   - Definir colores personalizados: primary (#2563EB), secondary (#6B7280), success (#10B981), warning (#F59E0B), danger (#EF4444), info (#3B82F6)
   - Configurar fuentes: Inter como fuente principal

3. **Crear componentes base reutilizables** (`components/ui/`)
   - `Button.tsx` — Botones (Primary, Secondary, Danger) con variantes de color y tamaño
   - `Card.tsx` — Tarjetas con sombra sutil y border-radius 12px
   - `Badge.tsx` — Etiquetas de estado con colores según tipo
   - `Input.tsx` — Inputs con label, validación visual y focus ring azul (#2563EB)
   - `Textarea.tsx` — Textarea con label y placeholder
   - `Tabs.tsx` — Tabs de navegación usando Radix UI

4. **Crear layout base** (`components/layout/`)
   - `Header.tsx` — Logo + notificaciones (altura 60px, fondo blanco)
   - `Sidebar.tsx` — Navegación lateral para importador y admin
   - `Footer.tsx` — Footer opcional

#### Criterios de aceptación

- [ ] El proyecto Next.js inicia sin errores (`npm run dev`)
- [ ] Tailwind CSS está configurado con los colores personalizados definidos en el sistema de diseño
- [ ] Los componentes base (Button, Card, Badge, Input, Textarea, Tabs) se pueden usar correctamente
- [ ] El layout base (Header, Sidebar, Footer) se renderiza correctamente

#### Entregables

1. Proyecto Next.js con TypeScript y Tailwind CSS configurado
2. Componentes base reutilizables (Button, Card, Badge, Input, Textarea, Tabs)
3. Layout base (Header, Sidebar, Footer)
4. Sistema de diseño documentado en el archivo `Frontend/UX-UI-Guia.md`

---

### Tarea 1.8: Implementar pantalla de Login / Registro

**Módulo:** Frontend/Pantallas-Solicitante  
**Duración estimada:** 1 día  
**Responsable:** Desarrollador Frontend

#### Descripción
Implementar la pantalla P1 — Login / Registro con formulario de inicio de sesión, selector de rol y enlace a registro.

#### Pasos de implementación

1. **Crear página de login** (`app/login/page.tsx`)
   - Formulario con campos: email + contraseña
   - Selector de rol (radio buttons): Solicitante, Importador, Admin
   - Botón "Iniciar sesión"
   - Enlace a registro y recuperación de contraseña

2. **Crear servicio de autenticación** (`services/auth.ts`)
   ```typescript
   import axios from 'axios';
   
   const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
   
   export async function login(email: string, password: string): Promise<{access_token: string; user_id: string; rol: string}> {
     const response = await axios.post(`${API_URL}/auth/login`, { email, password });
     localStorage.setItem('token', response.data.access_token);
     localStorage.setItem('user_id', response.data.user_id);
     localStorage.setItem('rol', response.data.rol);
     return response.data;
   }
   
   export async function register(email: string, password: string, rol: string): Promise<{access_token: string; user_id: string; rol: string}> {
     const response = await axios.post(`${API_URL}/auth/register`, { email, password, rol });
     localStorage.setItem('token', response.data.access_token);
     localStorage.setItem('user_id', response.data.user_id);
     localStorage.setItem('rol', response.data.rol);
     return response.data;
   }
   
   export function logout(): void {
     localStorage.removeItem('token');
     localStorage.removeItem('user_id');
     localStorage.removeItem('rol');
   }
   
   // Interceptor de axios para incluir token en todas las peticiones
   axios.interceptors.request.use(config => {
     const token = localStorage.getItem('token');
     if (token) {
       config.headers.Authorization = `Bearer ${token}`;
     }
     return config;
   });
   ```

3. **Implementar validaciones en el formulario**
   - Email: formato válido
   - Contraseña: mínimo 8 caracteres
   - Rol: debe seleccionar uno

4. **Redirección según rol después del login exitoso**
   - Solicitante → Dashboard (P2)
   - Importador → Bandeja de solicitudes (P10)
   - Admin → Panel de administración (P14)

#### Criterios de aceptación

- [ ] El formulario de login se puede completar con email, contraseña y rol seleccionado
- [ ] Al hacer clic en "Iniciar sesión", se llama al endpoint POST /auth/login del backend
- [ ] Si las credenciales son válidas, el JWT token se almacena en localStorage y se redirige según el rol
- [ ] Si las credenciales son inválidas, se muestra un mensaje de error (401 Unauthorized)
- [ ] El formulario tiene validaciones en tiempo real para email y contraseña

#### Entregables

1. Página de login funcional con formulario completo
2. Servicio de autenticación con axios e interceptor de token
3. Validaciones en el formulario
4. Redirección según rol después del login exitoso

---

### Tarea 1.9: Implementar Dashboard del solicitante

**Módulo:** Frontend/Pantallas-Solicitante  
**Duración estimada:** 1 día  
**Responsable:** Desarrollador Frontend

#### Descripción
Implementar la pantalla P2 — Dashboard del solicitante con tabs de navegación, botón "Nueva Cotización", lista de cotizaciones recientes y tarjeta de asesor asignado.

#### Pasos de implementación

1. **Crear página de dashboard** (`app/dashboard/page.tsx`)
   - Header con logo y notificaciones
   - Tabs: Cotizaciones | Órdenes | Pagos (usando Radix UI Tabs)
   - Botón "Nueva Cotización" que redirige a selección de modalidad

2. **Crear componente de lista de cotizaciones** (`components/CotizacionList.tsx`)
   - Tarjetas con: nombre del producto, estado (badge con color según estado), tiempo desde creación
   - Estados con colores: creada (azul), dirigida (verde), abierta/propuestas (amarillo), aceptada (morado), orden activa (naranja)

3. **Crear componente de tarjeta de asesor** (`components/AsesorCard.tsx`)
   - Foto del asesor, nombre, empresa, botones de Chat y WhatsApp

4. **Implementar fetch de cotizaciones** — Llamar a GET /cotizaciones al cargar el dashboard

#### Criterios de aceptación

- [ ] El dashboard muestra tabs funcionales (Cotizaciones | Órdenes | Pagos)
- [ ] El botón "Nueva Cotización" redirige a la pantalla de selección de modalidad
- [ ] Las cotizaciones recientes se muestran como tarjetas con estado y tiempo
- [ ] La tarjeta de asesor asignado muestra foto, nombre, empresa y botones de acción

#### Entregables

1. Página de dashboard funcional con tabs
2. Componente de lista de cotizaciones con estados visuales
3. Componente de tarjeta de asesor asignado
4. Fetch de cotizaciones desde el backend

---

### Tarea 1.10: Implementar selección de modalidad (dirigida / abierta)

**Módulo:** Frontend/Pantallas-Solicitante  
**Duración estimada:** 0.5 día  
**Responsable:** Desarrollador Frontend

#### Descripción
Implementar la pantalla P3 — Selección de modalidad con dos opciones grandes: Cotización Dirigida y Red de Importadores.

#### Pasos de implementación

1. **Crear página de selección de modalidad** (`app/cotizacion/nueva/page.tsx`)
   - Título: "¿Cómo quieres enviar tu solicitud?"
   - Dos tarjetas grandes:
     - Tarjeta 1: Cotización Dirigida — "Elige un importador específico" con botón "Buscar importador"
     - Tarjeta 2: Red de Importadores — "Difunde a toda la red y recibe múltiples propuestas" con botón "Difundir a la red"
   - Botón "Continuar" habilitado solo cuando se selecciona una modalidad

2. **Implementar estado local** — Usar React useState para rastrear la modalidad seleccionada

3. **Comportamiento de navegación**
   - Cotización Dirigida → Redirige a Catálogo de importadores (`/importadores`)
   - Red de Importadores → Redirige a Formulario de cotización con `modalidad=abierta` (`/cotizacion/formulario?modalidad=abierta`)

#### Criterios de aceptación

- [ ] La pantalla muestra dos opciones claras: Cotización Dirigida y Red de Importadores
- [ ] El botón "Continuar" está deshabilitado hasta que se selecciona una modalidad
- [ ] Al seleccionar Cotización Dirigida, redirige al catálogo de importadores
- [ ] Al seleccionar Red de Importadores, redirige al formulario con `modalidad=abierta`

#### Entregables

1. Página de selección de modalidad funcional
2. Dos tarjetas grandes con descripción y botones de acción
3. Botón "Continuar" habilitado solo cuando se selecciona una modalidad
4. Navegación correcta según la modalidad seleccionada

---

### Tarea 1.11: Implementar catálogo de importadores

**Módulo:** Frontend/Pantallas-Solicitante  
**Duración estimada:** 1 día  
**Responsable:** Desarrollador Frontend

#### Descripción
Implementar la pantalla P4 — Catálogo de importadores con barra de búsqueda, filtros por país y categoría, y tarjetas de importador.

#### Pasos de implementación

1. **Crear página de catálogo** (`app/importadores/page.tsx`)
   - Barra de búsqueda: "Buscar por nombre o especialidad"
   - Filtros desplegables: País de origen (dropdown), Categoría de producto (dropdown)
   - Lista de importadores como tarjetas

2. **Crear componente de tarjeta de importador** (`components/ImportadorCard.tsx`)
   - Logo del importador, nombre, especialidad, calificación (estrellas), tiempo de respuesta, botón "Seleccionar"

3. **Implementar fetch de importadores** — Llamar a GET /importadores con filtros:
   ```typescript
   const [importadores, setImportadores] = useState([]);
   
   useEffect(() => {
     const params = new URLSearchParams();
     if (pais) params.append('pais', pais);
     if (especialidad) params.append('especialidad', especialidad);
     
     axios.get(`${API_URL}/importadores?${params}`)
       .then(res => setImportadores(res.data));
   }, [pais, especialidad]);
   ```

4. **Implementar búsqueda y filtros** — Actualizar el estado de importadores cuando cambian los filtros

5. **Comportamiento al seleccionar un importador** — Guardar el importador seleccionado en el estado local y redirigir al formulario con `modalidad=dirigida` e `importador_id` preseleccionado

#### Criterios de aceptación

- [ ] La barra de búsqueda filtra importadores por nombre o especialidad
- [ ] Los filtros desplegables (país, categoría) filtran correctamente los importadores
- [ ] Las tarjetas de importador muestran logo, nombre, especialidad, calificación y tiempo de respuesta
- [ ] Al seleccionar un importador, se redirige al formulario con `modalidad=dirigida`

#### Entregables

1. Página de catálogo funcional con barra de búsqueda y filtros
2. Componente de tarjeta de importador con toda la información relevante
3. Fetch de importadores desde el backend con filtros
4. Navegación al formulario después de seleccionar un importador

---

### Tarea 1.12: Implementar formulario de cotización

**Módulo:** Frontend/Pantallas-Solicitante  
**Duración estimada:** 2 días  
**Responsable:** Desarrollador Frontend Senior

#### Descripción
Implementar la pantalla P5 — Formulario de cotización con todos los campos del formulario, validaciones en tiempo real y envío al backend.

#### Pasos de implementación

1. **Crear página de formulario** (`app/cotizacion/formulario/page.tsx`)
   - Modalidad: mostrar si es "dirigida" o "abierta" (desde query params)
   - Importador seleccionado: mostrar nombre del importador (si es dirigida)

2. **Implementar cada sección del formulario:**
   
   a. **Foto del producto** — Zona de carga con drag & drop usando `react-dropzone`
   ```typescript
   const { getRootProps, getInputProps, isDragActive } = useDropzone({
     accept: { 'image/*': ['.png', '.jpg', '.jpeg'] },
     onDrop: acceptedFiles => setFoto(acceptedFiles[0])
   });
   ```

   b. **País de importación** — Dropdown con lista de países (usando Radix UI Select)
   
   c. **Nivel de personalización** — Radio buttons: Estándar, Personalización de marca, Personalización de diseño completo
   
   d. **Nombre del producto** — Input text corto
   
   e. **Descripción del cliente** — Textarea largo (tamaño, material, colores, usos, variantes)
   
   f. **Link / enlace de referencia** — Input URL (ej: Alibaba, 1688)
   
   g. **Línea de producto** — Dropdown con categorías predefinidas
   
   h. **Tipo de calidad** — Radio buttons: Económica, Estándar, Premium
   
   i. **Sección Importación:**
      - Toggle Ecommerce / Corporativo (usando Radix UI Switch)
      - Cantidad mínima — Number input
      - Precio objetivo USD — Number input con prefijo $
      - Incoterm — Dropdown (FOB, CIF, EXW, DDP)
      - Notas adicionales — Textarea

3. **Implementar validaciones en tiempo real** — Usar React Hook Form + Zod para validación:
   ```typescript
   import { useForm } from 'react-hook-form';
   import { zodResolver } from '@hookform/resolvers/zod';
   import * as z from 'zod';
   
   const schema = z.object({
     pais_importacion: z.string().min(1, "Selecciona el país de origen"),
     nombre_producto: z.string().min(1, "Ingresa un nombre para el producto").max(255),
     descripcion_cliente: z.string().min(10, "Describe tu producto con más detalle"),
     linea_producto: z.string().min(1, "Selecciona la línea de producto"),
     tipo_calidad: z.enum(["economica", "estandar", "premium"]),
     cantidad_minima: z.number().min(1, "Ingresa una cantidad válida"),
   });
   
   const { register, handleSubmit, formState: { errors } } = useForm({
     resolver: zodResolver(schema)
   });
   ```

4. **Implementar envío del formulario** — Llamar a POST /cotizaciones con los datos del formulario:
   ```typescript
   const onSubmit = async (data: any) => {
     try {
       // Si hay foto, subirla primero al servicio de almacenamiento
       let fotoUrl = null;
       if (foto) {
         fotoUrl = await subirFoto(foto);  // Implementar subida a S3/Cloudinary
       }
       
       const response = await axios.post(`${API_URL}/cotizaciones`, {
         ...data,
         modalidad: query.modalidad || 'dirigida',
         importador_id: query.importador_id || null,
         foto_producto: fotoUrl
       });
       
       // Redirigir al dashboard con notificación de éxito
       router.push('/dashboard?success=true');
     } catch (error) {
       console.error('Error al enviar cotización:', error);
     }
   };
   ```

#### Criterios de aceptación

- [ ] El formulario se puede completar con todos los campos requeridos
- [ ] Las validaciones en tiempo real muestran mensajes de error apropiados para cada campo
- [ ] La zona de carga de imagen acepta drag & drop y muestra preview de la imagen
- [ ] Al enviar el formulario, se llama al endpoint POST /cotizaciones del backend con todos los datos
- [ ] Si es cotización dirigida, se incluye el importador_id preseleccionado
- [ ] Si es cotización abierta, no se incluye importador_id

#### Entregables

1. Página de formulario completa con todos los campos del formulario original
2. Validaciones en tiempo real usando React Hook Form + Zod
3. Zona de carga de imagen con drag & drop
4. Envío del formulario al backend con datos correctos
5. Redirección al dashboard tras envío exitoso

---

## 📊 Criterios de aceptación — Semana 1 (Resumen)

| Entregable | Criterio de aceptación |
|------------|----------------------|
| Autenticación | Usuarios pueden registrarse, iniciar sesión y obtener JWT token. Los endpoints protegidos requieren autenticación válida. |
| Perfiles | Se pueden crear importadores desde el backend (admin). Los importadores tienen campos de especialidad y país de origen. |
| Formulario de cotización | El formulario se puede completar con todos los campos requeridos y enviar al backend. Las validaciones funcionan correctamente. |
| Selección de modalidad | El usuario puede elegir entre "Cotización Dirigida" y "Red de Importadores". La selección redirige a la pantalla correcta. |
| Catálogo de importadores | Se pueden listar, buscar y filtrar importadores por país y categoría. Se puede seleccionar un importador para cotización dirigida. |

---

## 🔗 Dependencias entre tareas

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

## 📝 Notas adicionales

- **Prioridad:** Las tareas P0 deben completarse antes de las P1. No se puede avanzar a la Semana 2 sin tener el formulario de cotización funcional.
- **Testing:** Cada tarea debe incluir al menos pruebas unitarias básicas para los endpoints y componentes principales.
- **Documentación:** Actualizar la documentación del vault en Obsidian con cualquier cambio significativo en los endpoints o pantallas.