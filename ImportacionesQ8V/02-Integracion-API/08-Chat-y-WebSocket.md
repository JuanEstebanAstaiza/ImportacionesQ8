# APIs — Chat y WebSocket

> Generado desde OpenAPI en vivo (`/openapi.json`). Base URL local: `http://localhost:8000`.

## WebSocket (no aparece completo en OpenAPI REST)

### Endpoint

```text
ws://localhost:8000/ws/chat/{conversacion_id}?ticket={ticket_opaco}
```

Producción: `wss://api.tudominio.com/ws/chat/{conversacion_id}?ticket=...`

### Auth recomendada (OWASP)

1. Con JWT válido: `POST /chat/ws-ticket` body opcional con `conversacion_id` (según schema) → respuesta con `ticket` de un solo uso.
2. Abrir el WebSocket con `?ticket=...` (preferido).
3. Fallback deprecado: `?token=<JWT>` (sigue existiendo por compatibilidad; **no lo uses en código nuevo** — el token en query string termina en logs/proxies).

Si auth falla o el usuario no es participante de la conversación → cierre con código **1008**.

### Protocolo de mensajes

**Cliente → servidor** (texto JSON):

```json
{ "contenido": "Hola, ¿tienen MOQ de 3000?", "tipo": "texto" }
```

También acepta texto plano (se interpreta como `tipo: "texto"`).

**Servidor → cliente** (JSON string):

```json
{
  "id": "uuid-mensaje",
  "conversacion_id": "uuid-conversacion",
  "remitente_id": "uuid-usuario",
  "contenido": "Hola, ¿tienen MOQ de 3000?",
  "tipo": "texto",
  "fecha_envio": "2026-07-14T23:10:00"
}
```

### Secuencia de conexión (resumen)

1. `POST /chat/ws-ticket` con header `Authorization: Bearer <JWT>` (body opcional con `conversacion_id`).
2. Abrir WebSocket:  
   `ws://localhost:8000/ws/chat/{conversacion_id}?ticket={ticket}`
3. Enviar texto JSON: `{"contenido":"...","tipo":"texto"}`.
4. Recibir JSON con `id`, `remitente_id`, `contenido`, `fecha_envio`, etc.

Probar con Postman/Insomnia el ticket REST; el WS suele probarse desde el browser o un cliente WS.

### Fallback REST

Si el WebSocket no está disponible, usa:

- `GET /chat/conversaciones/{id}/mensajes` (historial / polling)
- `POST /chat/conversaciones/{id}/mensajes` (enviar)

---

## Endpoints REST de chat

### `GET /chat/conversaciones`

- **Resumen:** Listar Mis Conversaciones
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`array[ConversacionChatResponse]`)**

Array de `ConversacionChatResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `cotizacion_id` | `string` | sí |  |
| `orden_id` | `Optional[string]` | no |  |
| `solicitante_id` | `string` | sí |  |
| `importador_usuario_id` | `string` | sí |  |
| `fecha_creacion` | `string` | sí |  |
| `ultimo_mensaje` | `Optional[MensajeChatResponse]` | no |  |

---

### `GET /chat/conversaciones/{conversacion_id}/mensajes`

- **Resumen:** Listar Mensajes
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `conversacion_id`

**Respuesta (`array[MensajeChatResponse]`)**

Array de `MensajeChatResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `conversacion_id` | `string` | sí |  |
| `remitente_id` | `string` | sí |  |
| `contenido` | `string` | sí |  |
| `tipo` | `string` | sí |  |
| `fecha_envio` | `string` | sí |  |
| `metadata` | `Optional[object]` | no |  |

---

### `POST /chat/conversaciones/{conversacion_id}/mensajes`

- **Resumen:** Enviar Mensaje
- **Auth:** Bearer JWT
- **Códigos:** 201, 422
- **Path params:** `conversacion_id`

**Body (`MensajeChatCreate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `contenido` | `string` | sí |  |
| `tipo` | `string` | no |  |

```json
{
  "contenido": "<contenido>"
}
```

**Respuesta (`MensajeChatResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `conversacion_id` | `string` | sí |  |
| `remitente_id` | `string` | sí |  |
| `contenido` | `string` | sí |  |
| `tipo` | `string` | sí |  |
| `fecha_envio` | `string` | sí |  |
| `metadata` | `Optional[object]` | no |  |

---

### `POST /chat/mensajes/{mensaje_id}/traducir`

- **Resumen:** Traducir Mensaje
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `mensaje_id`

**Body (`TraducirRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `texto` | `Optional[string]` | no |  |
| `idioma_destino` | `string` | sí |  |

```json
{
  "idioma_destino": "<idioma_destino>"
}
```

**Respuesta (`TraducirResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `original` | `string` | sí |  |
| `traducido` | `string` | sí |  |
| `idioma_origen_detectado` | `string` | sí |  |
| `idioma_destino` | `string` | sí |  |

---

### `POST /chat/traducir`

- **Resumen:** Traducir Preview
- **Auth:** Bearer JWT
- **Códigos:** 200, 422

**Body (`TraducirRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `texto` | `Optional[string]` | no |  |
| `idioma_destino` | `string` | sí |  |

```json
{
  "idioma_destino": "<idioma_destino>"
}
```

**Respuesta (`TraducirResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `original` | `string` | sí |  |
| `traducido` | `string` | sí |  |
| `idioma_origen_detectado` | `string` | sí |  |
| `idioma_destino` | `string` | sí |  |

---

### `POST /chat/ws-ticket`

- **Resumen:** Emitir Ticket Ws
- **Auth:** Bearer JWT
- **Códigos:** 200, 422

**Body (`WsTicketRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `conversacion_id` | `string` | sí |  |

```json
{
  "conversacion_id": "<conversacion_id>"
}
```

**Respuesta (`WsTicketResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `ticket` | `string` | sí |  |
| `expires_in_seconds` | `integer` | no |  |

---
