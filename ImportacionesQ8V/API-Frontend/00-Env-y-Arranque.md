# Entorno (`.env`) y arranque del proyecto

Guía para que el frontend fullstack pueda **levantar backend + cliente** sin adivinar variables.

Rutas del monorepo:

```text
ImportacionesQ8/
├── proyecto/backend/     # FastAPI + Docker Compose (API, MySQL, Redis)
├── proyecto/frontend/    # Vite + React (cliente)
└── ImportacionesQ8V/     # Este vault (documentación)
```

---

## 1) Backend — arranque con Docker (recomendado)

### Requisitos

- Docker Desktop + Docker Compose
- Puertos libres: `8000` (API), `3306` (MySQL solo localhost), `6379` (Redis solo localhost)

### Paso a paso

```powershell
cd proyecto\backend
copy .env.example .env
# Edita .env (mínimo: SECRET_KEY, WOMPI_EVENTS_SECRET, SMTP_HOST vacío en local)
docker compose up -d --build
```

Comprobar:

```powershell
curl http://localhost:8000/health
curl http://localhost:8000/health/ready
# Docs interactivas (solo development):
start http://localhost:8000/docs
```

Esperado:

- `/health` → `{"status":"healthy"}`
- `/health/ready` → `database: true`, `redis: true`

### Plantilla `.env` del backend

Copia este bloque a `proyecto/backend/.env` (valores de **desarrollo local**).  
En producción genera secretos reales y no uses `WOMPI_SIMULATE=true`.

```env
# development | production | test
APP_ENV=development

# MySQL (Compose reescribe DATABASE_URL hacia el host "mysql")
DATABASE_URL=mysql+pymysql://usuario_q8:password_q8@localhost/importacionesq8

# JWT — mínimo 32 caracteres aleatorios en prod
# Generar: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=dev-local-secret-key-importacionesq8-32chars-min
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# CORS: origen del frontend Vite (ajusta el puerto si cambia)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173

# Redis (password debe coincidir con REDIS_PASSWORD)
REDIS_URL=redis://:redis_q8_dev_change_me@localhost:6379/0

# Credenciales Compose MySQL / Redis
MYSQL_ROOT_PASSWORD=rootpassword
MYSQL_DATABASE=importacionesq8
MYSQL_USER=usuario_q8
MYSQL_PASSWORD=password_q8
REDIS_PASSWORD=redis_q8_dev_change_me

WEB_CONCURRENCY=2

# Wompi (sandbox / simulación local)
WOMPI_PUBLIC_KEY=pub_test_xxxxxxxxxxxxxxxxxxxxxxxx
WOMPI_SECRET_KEY=prv_test_xxxxxxxxxxxxxxxxxxxxxxxx
WOMPI_EVENTS_SECRET=dev-wompi-events-secret-local
# En production debe ser false e integrar API real
WOMPI_SIMULATE=true

# Rate limits
RATE_LIMIT_LOGIN=5/minute
RATE_LIMIT_REGISTER=10/minute
RATE_LIMIT_FORGOT_PASSWORD=5/minute
RATE_LIMIT_OTP=10/minute

# SMTP — en local déjalo vacío para no colgar el registro (simula envío en log)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=no-reply@importacionesq8.com
SMTP_USE_TLS=true
FRONTEND_URL=http://localhost:5173
PASSWORD_RESET_EXPIRE_MINUTES=15
OTP_EXPIRE_MINUTES=15
LOGIN_TARDIO_HORAS=72

# Precios de créditos (solicitantes; no importadoras)
CREDITO_COSTO_COTIZACION_ABIERTA=10
CREDITO_COSTO_COTIZACION_DIRIGIDA=5
CREDITO_USD_POR_UNIDAD=0.1
CREDITO_BONO_REGISTRO=20
CREDITO_BONO_REFERIDO=10
CREDITO_BONO_REFERIDOR=10

# Traducción (opcional; off en local)
TRANSLATION_ENABLED=false
GOOGLE_TRANSLATE_API_KEY=
GOOGLE_TRANSLATE_PROJECT=
```

**Importante para el frontend en local:**

| Variable backend | Por qué te importa |
|------------------|--------------------|
| `CORS_ORIGINS` | Debe incluir el origen exacto del Vite (`http://localhost:5173` o el que uses). Si no, el browser bloquea las llamadas. |
| `SMTP_HOST=` (vacío) | Si dejas un host inventado, `POST /auth/register` puede **timeout** al intentar SMTP. |
| `FRONTEND_URL` | Enlaces de reset password en correos apuntan aquí. |
| `WOMPI_SIMULATE=true` | Permite probar compra de créditos sin Wompi real. |
| `APP_ENV=development` | Habilita `/docs` y `/openapi.json`. En production están off. |

También existe la plantilla en el repo: `proyecto/backend/.env.example`.

---

## 2) Frontend — `.env` del cliente

El frontend actual es **Vite + React** (`proyecto/frontend/`).  
Vite solo expone variables con prefijo `VITE_`.

Crea `proyecto/frontend/.env` (o `.env.local`):

```env
# URL base del backend (sin slash final)
VITE_API_URL=http://localhost:8000

# WebSocket (mismo host; ws en local, wss en prod)
VITE_WS_URL=ws://localhost:8000

# Origen propio (informativo / deep links)
VITE_APP_URL=http://localhost:5173

# Clave pública Wompi solo si el widget de checkout corre en el browser
# NUNCA pongas WOMPI_SECRET_KEY ni WOMPI_EVENTS_SECRET aquí
VITE_WOMPI_PUBLIC_KEY=pub_test_xxxxxxxxxxxxxxxxxxxxxxxx
```

En el cliente (cuando el frontend lo implemente), leer por ejemplo:

- `import.meta.env.VITE_API_URL` → base REST
- `import.meta.env.VITE_WS_URL` → base WebSocket

No hay código de cliente prearmado en el repo: solo esta documentación, el `.env.example` y Postman.

### Arranque frontend

```powershell
cd proyecto\frontend
pnpm install   # o npm install / yarn
pnpm dev       # Vite; puerto por defecto suele ser 5173
```

Si el dev server corre en **otro puerto**, actualiza:

1. `proyecto/frontend/.env` → `VITE_APP_URL`
2. `proyecto/backend/.env` → `CORS_ORIGINS` y `FRONTEND_URL`
3. `docker compose up -d backend` (reinicia para recoger CORS)

---

## 3) Plantilla combinada (checklist del empleado)

Copia y marca:

- [ ] Docker Desktop corriendo
- [ ] `proyecto/backend/.env` creado (desde bloque de arriba o `.env.example`)
- [ ] `docker compose up -d --build` en `proyecto/backend`
- [ ] `curl http://localhost:8000/health/ready` OK
- [ ] `proyecto/frontend/.env` con `VITE_API_URL=http://localhost:8000`
- [ ] CORS del backend incluye el origen del Vite
- [ ] `pnpm dev` y una llamada de prueba a `/health` desde el browser o desde el cliente HTTP

### Smoke test mínimo (PowerShell)

```powershell
# Salud
curl.exe http://localhost:8000/health/ready

# Registro solicitante (ajusta email)
# Guarda el body en un archivo JSON para evitar problemas de comillas
```

```json
{
  "email": "dev.frontend@ejemplo.com",
  "password": "ClaveSegura1",
  "rol": "solicitante",
  "tipo_persona": "natural",
  "tipo_documento": "cedula",
  "numero_documento": "1234567890",
  "nombre": "Dev",
  "apellido": "Frontend",
  "indicativo_pais_telefono": "+57",
  "telefono": "3001234567",
  "acepto_politica_datos": true
}
```

```powershell
curl.exe -X POST http://localhost:8000/auth/register `
  -H "Content-Type: application/json" `
  --data-binary "@register.json"
# Esperado: HTTP 201, requiere_verificacion: true (aún sin JWT)
```

---

## 4) Qué NO va en el frontend `.env`

| Variable | ¿Frontend? | Motivo |
|----------|------------|--------|
| `SECRET_KEY` | No | Firma JWT del backend |
| `WOMPI_SECRET_KEY` | No | API privada Wompi |
| `WOMPI_EVENTS_SECRET` | No | Validación de webhooks |
| `MYSQL_*` / `DATABASE_URL` | No | Solo backend |
| `REDIS_PASSWORD` / `REDIS_URL` | No | Solo backend |
| `SMTP_PASSWORD` | No | Solo backend |
| `VITE_API_URL` | Sí | Base de la API |
| `VITE_WS_URL` | Sí | Chat WebSocket |
| `VITE_WOMPI_PUBLIC_KEY` | Sí (opcional) | Widget público |

---

## 5) Troubleshooting rápido

| Síntoma | Causa probable | Qué hacer |
|---------|----------------|-----------|
| CORS error en browser | Origen no listado | Añadir origen a `CORS_ORIGINS` y reiniciar backend |
| Register timeout | `SMTP_HOST` inventado | Vaciar `SMTP_HOST=` en backend `.env` |
| `/health/ready` 503 | MySQL/Redis caídos | `docker compose ps` y logs |
| 401 en rutas protegidas | Token ausente/expirado | Login + `Authorization: Bearer` o `/auth/refresh` |
| 403 al login tras register | Email no verificado | Flujo OTP `POST /auth/verificar-email` |
| WS cierra de inmediato | Ticket/token inválido | `POST /chat/ws-ticket` y usar `?ticket=` |
| `/docs` 404 | `APP_ENV=production` | Solo en prod; usa OpenAPI exportado o esta carpeta |

---

## Ver también

- [[README|Índice API Frontend]]
- [[01-Convenciones-Auth-y-Cliente]]
- [[Catalogo-Completo]]
- Backend: `proyecto/backend/.env.example`, `proyecto/backend/docker-compose.yml`
