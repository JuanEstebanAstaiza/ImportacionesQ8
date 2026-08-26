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

`POST /chat/iniciar` es la vía recomendada para asesores: reutiliza la
conversación existente si ya la hay, en vez de crear duplicados.
