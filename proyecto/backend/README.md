# Backend ImportacionesQ8 - Semana 1

## Descripción

Backend de la plataforma ImportacionesQ8 construido con **FastAPI** (Python). Este README documenta los endpoints y estructura del proyecto para la Semana 1: Fundaciones y Módulo de Cotizaciones.

## Requisitos

- Python 3.10+
- MySQL Server
- Redis Server

## Instalación

### 1. Crear entorno virtual

```bash
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
```

### 2. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 3. Configurar variables de entorno

Copiar `.env.example` a `.env` y ajustar las configuraciones:

```bash
cp .env.example .env
```

Editar `.env`:

```
DATABASE_URL=mysql+pymysql://usuario:contraseña@localhost/importacionesq8
SECRET_KEY=tu-secreto-aqui-para-jwt-cambiar-en-produccion
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
CORS_ORIGINS=http://localhost:3000,http://localhost:8000
REDIS_URL=redis://localhost:6379/0
```

### 4. Crear base de datos MySQL

```sql
CREATE DATABASE importacionesq8;
```

### 5. Iniciar Redis

```bash
# Windows (si usas WSL)
redis-server

# Linux/Mac
redis-server --daemonize yes
```

## Ejecutar el servidor

```bash
python main.py
```

O con uvicorn directamente:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

El servidor estará disponible en `http://localhost:8000`

## Documentación de la API (Swagger UI)

Acceder a `http://localhost:8000/docs` para ver la documentación interactiva de la API con Swagger UI.

También puedes acceder al OpenAPI spec en `http://localhost:8000/openapi.json`

## Endpoints disponibles

### Autenticación (`/auth`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/register` | Registrar nuevo usuario |
| POST | `/auth/login` | Iniciar sesión |
| POST | `/auth/refresh` | Renovar token JWT |
| POST | `/auth/logout` | Cerrar sesión |

#### Ejemplo: Registro de usuario

```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@example.com",
    "password": "123456789",
    "rol": "solicitante"
  }'
```

Respuesta:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "rol": "solicitante"
}
```

#### Ejemplo: Login

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@example.com",
    "password": "123456789"
  }'
```

### Importadores (`/importadores`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/importadores` | Listar importadores activos (con filtros) |
| GET | `/importadores/{id}` | Obtener detalles de un importador |
| POST | `/importadores` | Crear nuevo importador (solo admin) |

#### Ejemplo: Listar importadores con filtros

```bash
curl http://localhost:8000/importadores?especialidad=Textiles&pais=China
```

#### Ejemplo: Crear importador (requiere token de admin)

```bash
curl -X POST http://localhost:8000/importadores \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token_admin>" \
  -d '{
    "nombre_empresa": "Importadora ABC",
    "especialidad_producto": ["Textiles", "Ropa"],
    "paises_origen": ["China", "Vietnam"],
    "tiempo_respuesta_promedio": "24h"
  }'
```

### Cotizaciones (`/cotizaciones`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/cotizaciones` | Listar cotizaciones del usuario autenticado |
| GET | `/cotizaciones/{id}` | Obtener detalles de una cotización |
| POST | `/cotizaciones` | Crear nueva cotización (solo solicitante) |

#### Ejemplo: Crear cotización dirigida

```bash
curl -X POST http://localhost:8000/cotizaciones \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token_solicitante>" \
  -d '{
    "modalidad": "dirigida",
    "importador_id": "550e8400-e29b-41d4-a716-446655440000",
    "pais_importacion": "China",
    "nombre_producto": "Camisetas personalizadas",
    "descripcion_cliente": "Necesito 500 camisetas con mi logo impreso",
    "linea_producto": "Textiles",
    "tipo_calidad": "estandar",
    "cantidad_minima": 500,
    "incoterm": "FOB"
  }'
```

#### Ejemplo: Crear cotización abierta (con matching automático)

```bash
curl -X POST http://localhost:8000/cotizaciones \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token_solicitante>" \
  -d '{
    "modalidad": "abierta",
    "pais_importacion": "China",
    "nombre_producto": "Camisetas personalizadas",
    "descripcion_cliente": "Necesito 500 camisetas con mi logo impreso",
    "linea_producto": "Textiles",
    "tipo_calidad": "estandar",
    "cantidad_minima": 500,
    "incoterm": "FOB"
  }'
```

## Estructura del proyecto

```
backend/
├── main.py                    # Punto de entrada principal
├── config.py                  # Configuración (variables de entorno)
├── database.py                # Conexión a MySQL con SQLAlchemy
├── .env                       # Variables de entorno
├── requirements.txt           # Dependencias Python
├── models/                    # Modelos ORM
│   ├── __init__.py
│   ├── usuario.py             # Modelo Usuario
│   ├── importador.py          # Modelo Importador
│   ├── asesor.py              # Modelo Asesor
│   └── cotizacion.py          # Modelo Cotización
├── schemas/                   # Esquemas Pydantic para validación
│   ├── __init__.py
│   ├── auth.py                # Esquemas de autenticación
│   ├── importador.py          # Esquemas de importador
│   └── cotizacion.py          # Esquemas de cotización
├── routers/                   # Endpoints de la API
│   ├── __init__.py
│   ├── auth.py                # Rutas de autenticación
│   ├── importadores.py        # Rutas de importadores
│   └── cotizaciones.py        # Rutas de cotizaciones
├── services/                  # Lógica de negocio
│   ├── __init__.py
│   ├── auth_service.py        # Servicio de autenticación
│   └── matching_service.py    # Motor de matching para cotizaciones abiertas
└── utils/                     # Utilidades
    ├── __init__.py
    ├── security.py            # JWT y bcrypt
    └── dependencies.py        # Dependencias FastAPI
```

## Autenticación

### Flujo de autenticación

1. El cliente envía credenciales (email + contraseña) al endpoint `/auth/login`
2. El servidor valida las credenciales contra la base de datos MySQL
3. Se genera un token JWT con los claims: `user_id`, `rol`, `exp`
4. El token se devuelve al cliente en el body de la respuesta
5. El cliente incluye el token en el header `Authorization: Bearer <token>` para todas las peticiones posteriores

### Roles y permisos

| Rol | Cotizaciones | Importadores | Admin |
|-----|-------------|--------------|-------|
| Solicitante | ✅ Propias | 🔍 Solo lectura | ❌ |
| Importador | ✅ Recibidas | ✅ Propia | ❌ |
| Admin | ✅ Todas | ✅ CRUD | ✅ |

## Motor de Matching

Para cotizaciones abiertas, el sistema encuentra automáticamente importadores que cumplen ambas condiciones:

1. El importador opera desde el país de origen del producto (`paises_origen` CONTAINS `pais_importacion`)
2. El importador tiene la categoría de producto como especialidad (`especialidad_producto` CONTAINS `linea_producto`)

### Redis para gestión de cotizaciones abiertas

- **TTL**: 72 horas (259200 segundos) para respuestas
- **Claves Redis**:
  - `cotizacion_abierta:{id}`: Hash con estado de respuestas por importador
  - `cotizacion_abierta:{id}:expiracion`: Timestamp de expiración
  - `cotizacion_abierta:{id}:respuestas`: Contador de propuestas recibidas

## Docker

### Levantar servicios con Docker Compose

```bash
docker-compose up -d
```

Esto levantará:
- MySQL en el puerto 3306
- Redis en el puerto 6379
- Backend API en el puerto 8000

### Detener servicios

```bash
docker-compose down
```

### Reconstruir imágenes

```bash
docker-compose up -d --build
```

El backend es *image-based* (sin bind mount): un cambio en el código de Python
no se ve en el contenedor hasta que se reconstruye la imagen. Reconstrucción
completa tras tocar backend (modelos, routers, migraciones nuevas, etc.):

```bash
docker-compose up -d --build backend
```

`entrypoint.sh` corre `alembic upgrade head` automáticamente antes de levantar
Uvicorn en cada arranque del contenedor (con MySQL; con SQLite se resuelve solo
con `create_all`), así que las tablas nuevas (`landing_blocks`, `landing_allies`,
`landing_news`, etc.) quedan creadas sin intervención manual.

### Ver logs

```bash
# Todos los servicios
docker-compose logs -f

# Solo backend
docker-compose logs -f backend

# Solo MySQL
docker-compose logs -f mysql

# Solo Redis
docker-compose logs -f redis
```

### Ejecutar comandos en el contenedor

```bash
# Shell dentro del contenedor backend
docker-compose exec backend bash

# Ejecutar Python en el contenedor
docker-compose exec backend python main.py
```

## Testing

### Ejecutar tests con pytest

```bash
# Todos los tests
pytest

# Tests específicos
pytest tests/test_auth.py -v

# Con cobertura de código
pytest --cov=. --cov-report=html

# Solo tests fallidos
pytest --lf

# Ver output detallado
pytest -vv
```

### Probar endpoints con curl

```bash
# Health check
curl http://localhost:8000/health

# Swagger UI
open http://localhost:8000/docs
```

### Crear datos de prueba

```python
# Conectar a la API y crear un usuario admin para pruebas
import requests

# Registrar admin
response = requests.post("http://localhost:8000/auth/register", json={
    "email": "admin@example.com",
    "password": "123456789",
    "rol": "admin"
})
token = response.json()["access_token"]

# Crear importador de prueba
response = requests.post("http://localhost:8000/importadores", json={
    "nombre_empresa": "Importadora Test",
    "especialidad_producto": ["Textiles"],
    "paises_origen": ["China"],
    "tiempo_respuesta_promedio": "24h"
}, headers={"Authorization": f"Bearer {token}"})

# Registrar solicitante de prueba
response = requests.post("http://localhost:8000/auth/register", json={
    "email": "solicitante@example.com",
    "password": "123456789",
    "rol": "solicitante"
})
token_solicitante = response.json()["access_token"]

# Crear cotización abierta de prueba
response = requests.post("http://localhost:8000/cotizaciones", json={
    "modalidad": "abierta",
    "pais_importacion": "China",
    "nombre_producto": "Camisetas",
    "descripcion_cliente": "Necesito camisetas personalizadas",
    "linea_producto": "Textiles",
    "tipo_calidad": "estandar",
    "cantidad_minima": 500,
    "incoterm": "FOB"
}, headers={"Authorization": f"Bearer {token_solicitante}"})
```

## Notas de arquitectura

- **Base de datos**: MySQL con SQLAlchemy ORM
- **Autenticación**: JWT (HS256) con python-jose
- **Hash de contraseñas**: bcrypt con passlib
- **Cache/Matching**: Redis para cotizaciones abiertas
- **API Documentation**: Swagger UI automático en `/docs`

## Actualización 2026-08-05 (Gestión documental, chat multimedia, LMS y PDFs)

### Migración aplicada

- Revisión Alembic: `20260804_0006`.
- Tablas nuevas: `carpetas`, `archivos`, `etiquetas`, `archivo_etiquetas`, `favoritos`, `curso_recursos`, `mensajes_adjuntos`, `orden_documentos`.
- Columnas soft delete añadidas:
  - `cursos.deleted_at`
  - `recursos_leccion.deleted_at`

Comando de despliegue:

```bash
docker exec importacionesq8_backend alembic upgrade head
```

### Endpoints nuevos (resumen)

- Drive documental:
  - `GET /documentos/explorador`
  - `POST /documentos/carpetas`
  - `PATCH /documentos/carpetas/{id}`
  - `DELETE /documentos/carpetas/{id}`
  - `POST /documentos/archivos`
  - `PATCH /documentos/archivos/{id}`
  - `DELETE /documentos/archivos/{id}`
  - `GET /documentos/buscar`
  - `POST /documentos/favoritos/toggle`
  - `GET/POST /documentos/etiquetas`
  - `POST /documentos/archivos/{id}/etiquetas`
  - `GET /documentos/archivos/{id}/descargar`
- Chat multimedia:
  - `POST /documentos/compartir-chat`
  - `GET /documentos/chats/{conversacion_id}/adjuntos`

### Reglas LMS aplicadas

- No se permiten enlaces de YouTube en:
  - `video_url` de lecciones
  - `url` de recursos de lección
- Nuevos endpoints de ciclo de vida de curso:
  - `PUT /cursos/{curso_id}`
  - `DELETE /cursos/{curso_id}` (soft delete)
- Protección de integridad:
  - Un archivo no puede eliminarse si está vinculado a un curso activo o vigente.

### Documentos automáticos de órdenes

Al concretarse doble aceptación de propuesta y crearse orden:

- Se generan PDFs de cotización, propuesta y orden.
- Se registran en:
  - `archivos`
  - `orden_documentos`
  - y se mantiene compatibilidad con `documentos_orden`.