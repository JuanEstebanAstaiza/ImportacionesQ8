# Integración API — guía para frontend / fullstack

Documentación **orientada al desarrollador frontend/fullstack** para conectar el cliente (Vite/React u otro) con el backend FastAPI.

> Carpeta del vault: `02-Integracion-API/`  
> Fuente de verdad en runtime: Swagger (`http://localhost:8000/docs`) y OpenAPI (`/openapi.json`) en development.  
> Aquí están **todas las rutas**, convenciones, plantillas `.env` y Postman. **No** es código del frontend: solo documentación de integración.

← [[Inicio]] · Pantallas UI → [[Indice-Frontend]] · Diseño backend → [[Indice-Backend]]

---

## Contenido de esta carpeta

| Nota | Para qué sirve |
|------|----------------|
| [[00-Env-y-Arranque]] | Cómo levantar backend + frontend y **plantillas `.env`** |
| [[01-Convenciones-Auth-y-Cliente]] | Base URL, headers JWT, roles, errores, fetch/axios, CORS |
| [[Catalogo-Completo]] | Tabla de **todas** las operaciones REST |
| [[02-Auth]] | Registro, OTP, login, refresh, logout, password |
| [[03-Usuarios-Asesores-y-Perfil]] | `/usuarios/me`, asesores |
| [[04-Importadores]] | Catálogo, perfil empresa, campos, evidencias, asesores |
| [[05-Cotizaciones-y-Propuestas]] | Crear cotizaciones, pool, propuestas, pre-aceptar, reclamar |
| [[06-Ordenes]] | Órdenes, estados, documentos, problemas |
| [[07-Creditos-y-Pagos]] | Comprar créditos, saldo, Wompi |
| [[08-Chat-y-WebSocket]] | REST chat + ticket WS + WebSocket |
| [[09-Organizaciones]] | Org multi-usuario del solicitante |
| [[10-Disputas]] | Dispute room y evidencias |
| [[11-Referidos]] | Código y estadísticas de referidos |
| [[12-Admin]] | Endpoints solo `rol=admin` |
| [[13-Legal-y-Salud]] | Legal, `/health`, `/health/ready` |
| [[14-Postman-Insomnia]] | Cómo importar y usar la colección HTTP |
| `ImportacionesQ8.postman_collection.json` | Importar en Postman o Insomnia (94 requests) |

---

## Base URL

| Entorno | REST | WebSocket |
|---------|------|-----------|
| Local (Docker Compose) | `http://localhost:8000` | `ws://localhost:8000` |
| Producción (ejemplo) | `https://api.tudominio.com` | `wss://api.tudominio.com` |

En el frontend usa una variable de entorno (ver [[00-Env-y-Arranque]]):

```ts
const API_URL = import.meta.env.VITE_API_URL; // http://localhost:8000
```

---

## Roles del producto (JWT `rol`)

| Rol | Quién es | Notas de integración |
|-----|----------|----------------------|
| `solicitante` | Persona natural/jurídica que cotiza | Auto-registro público. Gasta **créditos**. Puede tener organización multi-usuario. |
| `importador` | Dueño/representante de la empresa importadora | **No** se auto-registra: lo crea **admin**. Gestiona asesores, responde cotizaciones. |
| `asesor` | Operador de una importadora | Acceso a pool/cotizaciones de su empresa. |
| `admin` | Equipo ImportacionesQ8 | Alta de empresas, métricas, disputas, moderación. |

Header en rutas protegidas:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

## Flujos que debes implementar sí o sí

### 1) Registro + OTP (solicitante)

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant API as Backend

    FE->>API: POST /auth/register
    API-->>FE: 201 requiere_verificacion (sin JWT)
    Note over FE: Pantalla "Ingresa el código de 6 dígitos"
    FE->>API: POST /auth/verificar-email {email, otp}
    API-->>FE: 200 access_token + user_id + rol
    FE->>FE: Guardar token (memory + localStorage/sessionStorage)
```

- Sin verificar email, `POST /auth/login` responde **403**.
- Sin SMTP real en local, el OTP **no llega por correo** (se omite envío si `SMTP_HOST` vacío). En dev pide al backend el OTP en logs o usa reenvío + DB; en tests se mockea.

### 2) Login normal vs login tardío (>72 h)

- Login OK → `{ access_token, user_id, rol, ... }`
- Login tardío → `{ requiere_otp: true, challenge_token, mensaje }` → `POST /auth/login/verificar-otp`

### 3) Cotización con créditos

1. `GET /creditos/saldo`
2. Si falta saldo → `POST /creditos/comprar` → redirigir a Wompi (o flujo simulado en dev)
3. `POST /cotizaciones/` (`modalidad`: `abierta` | `dirigida`)
4. Costos por defecto (configurables en backend): abierta **10**, dirigida **5** créditos

### 4) Chat en tiempo real

1. `POST /chat/ws-ticket` con JWT → `{ ticket, expira_en }`
2. Conectar `ws://localhost:8000/ws/chat/{conversacion_id}?ticket={ticket}`
3. Enviar: `{"contenido":"Hola","tipo":"texto"}`
4. Fallback REST: `POST /chat/conversaciones/{id}/mensajes`

Detalle en [[08-Chat-y-WebSocket]].

---

## Mapa rápido por pantalla

| Pantalla / feature | Endpoints principales |
|--------------------|------------------------|
| Login / Registro / OTP | [[02-Auth]] |
| Perfil usuario | `GET/PUT /usuarios/me` |
| Catálogo importadores | `GET /importadores/`, destacados, certificados |
| Crear cotización | `POST /cotizaciones/`, `GET /creditos/saldo` |
| Inbox importadora | `GET /cotizaciones/pool-empresa`, `POST .../reclamar` |
| Propuestas | `POST /propuestas/`, borrador, enviar, pre-aceptar |
| Órdenes | `GET /ordenes/`, actualizar estado, documentos |
| Chat | `GET /chat/conversaciones`, WS ticket |
| Admin panel | [[12-Admin]] |
| Referidos | `GET /referidos/mi-codigo` |

---

## Qué NO es responsabilidad del frontend

- Webhook Wompi (`POST /pagos/webhook/wompi`) — solo backend/Wompi.
- Secretos (`SECRET_KEY`, `WOMPI_EVENTS_SECRET`, SMTP password, Redis password) — **nunca** en el repo del frontend ni en `VITE_*`.
- Crear importadoras: `POST /importadores/` está deshabilitado; usar flujos admin.

---

## Colección HTTP

Archivo: `ImportacionesQ8V/02-Integracion-API/ImportacionesQ8.postman_collection.json`  
Guía: [[14-Postman-Insomnia]].

La integración del frontend (fetch/axios, stores, etc.) la implementa el equipo de UI; esta carpeta es **solo documentación + `.env` + Postman**.

---

## Ver también

- [[Inicio]] · [[Indice-Frontend]] · [[Indice-Backend]]
- Backend técnico: [[API-Rest]], [[Autenticacion]], [[Pagos-Wompi]], [[Chat-WebSocket]], [[Seguridad]]
- Pantallas: [[Pantallas-Solicitante]], [[Pantallas-Importador]], [[Pantallas-Admin]]
- Calidad: [[OWASP-Top10-Backend-2026-07-14]] · [[Indice-Calidad]]
