# Convenciones de cliente HTTP, auth y errores

## Base URL y paths

- Todas las rutas de esta carpeta son **relativas** a `VITE_API_URL` (ej. `http://localhost:8000`).
- No dupliques el prefijo: `fetch(\`${API_URL}/auth/login\`)`.
- Algunas rutas listadas en OpenAPI terminan en `/` (ej. `/cotizaciones/`). FastAPI suele aceptar ambas; si recibes **307**, sigue el redirect o normaliza con slash final.

## Autenticación JWT

### Header

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Ciclo de vida recomendado en el frontend

1. Tras login / verificar-email → guardar `access_token` (y opcionalmente `user_id`, `rol`).
2. Adjuntar el header en **todas** las rutas no públicas (ver [[Catalogo-Completo]] columna Auth).
3. Si la API responde **401**:
   - Intentar `POST /auth/refresh` con el mismo Bearer (revoca el `jti` anterior y emite uno nuevo).
   - Si falla → limpiar sesión y redirigir a login.
4. Logout: `POST /auth/logout` + borrar token en el cliente (la blacklist invalida el JWT en servidor).

### Claims útiles (lógica de UI)

El backend **revalida en DB** en cada request protegido (`activo`, `rol`, `importador_id`). No confíes solo en el payload del JWT para autorización crítica; úsalo para enrutar UI:

| Dato | Uso en UI |
|------|-----------|
| `rol` | Router de paneles: solicitante / importador / asesor / admin |
| `user_id` | Identidad local, chat, permisos de pantalla |
| `importador_id` | Solo roles de empresa; filtra vistas de importadora |

### Password policy (registro y reset)

- Mínimo **9** caracteres
- Al menos **una letra** y **un dígito**
- Ejemplo válido: `ClaveSegura1`

---

## Formato de errores

FastAPI devuelve JSON. Casos frecuentes:

| HTTP | Significado típico | Acción UI |
|------|--------------------|-----------|
| 400 | Regla de negocio (rol inválido, email duplicado, saldo, etc.) | Mostrar `detail` |
| 401 | Token inválido / revocado / ausente | Refresh o login |
| 403 | Sin permiso o email no verificado | Mensaje + flujo OTP si aplica |
| 404 | Recurso no existe o no visible | Empty state |
| 409 | Conflicto (carrera, estado inválido) | Refrescar datos |
| 422 | Validación de schema (campos faltantes/invalidos) | Marcar inputs (`detail` es lista) |
| 429 | Rate limit (login/register/OTP) | Esperar y reintentar |
| 503 | `/health/ready` dependencias caídas | Banner de mantenimiento |

Ejemplo 422:

```json
{
  "success": false,
  "error": "Datos de solicitud inválidos",
  "detail": [
    { "type": "missing", "loc": ["body", "telefono"], "msg": "Field required" }
  ]
}
```

Ejemplo 400/403 con string:

```json
{ "detail": "Debes verificar tu correo con el código OTP enviado antes de iniciar sesión" }
```

---

## Cliente HTTP (orientación)

El frontend puede usar `fetch`, axios u otro cliente. Convenciones:

1. Base URL desde env del frontend (ej. `VITE_API_URL=http://localhost:8000`).
2. Header `Authorization: Bearer <token>` en rutas protegidas.
3. `Content-Type: application/json` en bodies JSON.
4. Ante **401**, intentar `POST /auth/refresh` o redirigir a login.
5. Ante **422**, mapear `detail[]` a campos del formulario.

Para probar sin código: colección Postman [[14-Postman-Insomnia]].

---

## CORS

El backend solo acepta orígenes listados en `CORS_ORIGINS`.  
Si desarrollas en `http://localhost:5173`, ese string exacto debe estar en el `.env` del backend (ver [[00-Env-y-Arranque]]).

---

## Rate limits (auth)

Valores por defecto (configurables en backend):

| Endpoint | Límite típico |
|----------|----------------|
| Login | 5/minuto |
| Register | 10/minuto |
| Forgot password | 5/minuto |
| OTP | 10/minuto |

En desarrollo no spamees formularios de auth o verás **429**.

---

## IDs y fechas

- IDs de recursos: **UUID string**.
- Fechas: ISO-8601 en JSON (ej. `2026-07-14T23:00:00`).
- Montos de créditos: `number` (float en backend); muestra con 0–2 decimales según diseño.

---

## Endpoints públicos vs protegidos

**Públicos (no requieren JWT):** registro, login, OTP, forgot/reset password, legal, health, catálogo público de importadores (listados/detalle/formulario/evidencias públicas), webhook Wompi.

**Todo lo demás:** Bearer JWT. Detalle por ruta en cada nota de módulo y en [[Catalogo-Completo]].

---

## Ver también

- [[02-Auth]] — contratos de registro/login/OTP
- [[00-Env-y-Arranque]] — variables de entorno
- [[08-Chat-y-WebSocket]] — ticket y WS
