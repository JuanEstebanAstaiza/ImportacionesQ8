# APIs — Chat y WebSocket

> Endpoints REST generados desde OpenAPI (`/openapi.json`). Base URL local: `http://localhost:8000`.
> Lo escrito a mano va en `_preambulos/08-Chat-y-WebSocket.md`; el resto se sobrescribe.

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

### `POST /chat/calculadora/calcular`

- **Resumen:** Calcular Estimacion Precio
- **Auth:** Bearer JWT
- **Códigos:** 200, 422

**Body (`EstimacionPrecioRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `moneda` | `string` | no |  |
| `cantidad` | `integer` | sí |  |
| `precio_unitario` | `number` | sí |  |
| `flete_internacional` | `number` | no |  |
| `seguro_pct` | `number` | no | Sobre mercancía + flete |
| `arancel_pct` | `number` | no | Sobre el valor CIF |
| `iva_pct` | `number` | no | Sobre CIF + arancel |
| `gastos_destino` | `number` | no | Agenciamiento, bodegaje, transporte local |
| `margen_pct` | `number` | no | Sobre CIF + arancel + gastos en destino |
| `rango_pct` | `number` | no | ± % para dar un rango de precios posibles |
| `tasa_cambio_cop` | `Optional[number]` | no | Para mostrar el total en COP |
| `incoterm` | `Optional[string]` | no |  |
| `tiempo_entrega` | `Optional[string]` | no |  |
| `validez_dias` | `Optional[integer]` | no |  |
| `notas` | `Optional[string]` | no |  |

```json
{
  "cantidad": 0,
  "precio_unitario": 0
}
```

**Respuesta (`EstimacionPrecioResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `entrada` | `EstimacionPrecioRequest` | sí |  |
| `desglose` | `DesgloseEstimacion` | sí |  |
| `resumen` | `string` | sí |  |

---

### `GET /chat/conversaciones`

- **Resumen:** Listar Mis Conversaciones
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`array[ConversacionChatResponse]`)**

Array de `ConversacionChatResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `tipo` | `string` | no |  |
| `cotizacion_id` | `Optional[string]` | no |  |
| `orden_id` | `Optional[string]` | no |  |
| `solicitante_id` | `Optional[string]` | no |  |
| `importador_usuario_id` | `Optional[string]` | no |  |
| `importador_id` | `Optional[string]` | no |  |
| `contraparte_nombre` | `Optional[string]` | no |  |
| `contraparte_id` | `Optional[string]` | no |  |
| `contraparte_rol` | `Optional[string]` | no |  |
| `contraparte_empresa` | `Optional[string]` | no |  |
| `contraparte_foto_url` | `Optional[string]` | no |  |
| `asunto` | `Optional[string]` | no |  |
| `urgencia` | `Optional[string]` | no |  |
| `solicitante_rol` | `Optional[string]` | no |  |
| `no_leidos` | `integer` | no |  |
| `cerrada` | `boolean` | no |  |
| `resolucion` | `Optional[string]` | no |  |
| `cerrada_por_nombre` | `Optional[string]` | no |  |
| `fecha_cierre` | `Optional[string]` | no |  |
| `nivel` | `Optional[integer]` | no |  |
| `agente_asignado_id` | `Optional[string]` | no |  |
| `agente_nombre` | `Optional[string]` | no |  |
| `agente_nivel` | `Optional[integer]` | no |  |
| `calificacion` | `Optional[integer]` | no |  |
| `comentario_calificacion` | `Optional[string]` | no |  |
| `fecha_creacion` | `string` | sí |  |
| `ultimo_mensaje` | `Optional[MensajeChatResponse]` | no |  |

---

### `POST /chat/conversaciones/{conversacion_id}/estimaciones`

- **Resumen:** Enviar Estimacion Precio
- **Auth:** Bearer JWT
- **Códigos:** 201, 422
- **Path params:** `conversacion_id`

**Body (`EstimacionPrecioRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `moneda` | `string` | no |  |
| `cantidad` | `integer` | sí |  |
| `precio_unitario` | `number` | sí |  |
| `flete_internacional` | `number` | no |  |
| `seguro_pct` | `number` | no | Sobre mercancía + flete |
| `arancel_pct` | `number` | no | Sobre el valor CIF |
| `iva_pct` | `number` | no | Sobre CIF + arancel |
| `gastos_destino` | `number` | no | Agenciamiento, bodegaje, transporte local |
| `margen_pct` | `number` | no | Sobre CIF + arancel + gastos en destino |
| `rango_pct` | `number` | no | ± % para dar un rango de precios posibles |
| `tasa_cambio_cop` | `Optional[number]` | no | Para mostrar el total en COP |
| `incoterm` | `Optional[string]` | no |  |
| `tiempo_entrega` | `Optional[string]` | no |  |
| `validez_dias` | `Optional[integer]` | no |  |
| `notas` | `Optional[string]` | no |  |

```json
{
  "cantidad": 0,
  "precio_unitario": 0
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

### `POST /chat/conversaciones/{conversacion_id}/leida`

- **Resumen:** Marcar Conversacion Leida
- **Auth:** Bearer JWT
- **Códigos:** 204, 422
- **Path params:** `conversacion_id`

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
| `metadata` | `Optional[object]` | no |  |

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

### `POST /chat/iniciar`

- **Resumen:** Iniciar Chat
- **Auth:** Bearer JWT
- **Códigos:** 201, 422

**Body (`IniciarChatRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `cotizacion_id` | `Optional[string]` | no |  |
| `propuesta_id` | `Optional[string]` | no |  |
| `mensaje_inicial` | `Optional[string]` | no |  |

```json
{
  "cotizacion_id": "<cotizacion_id>",
  "propuesta_id": "<propuesta_id>",
  "mensaje_inicial": "<mensaje_inicial>"
}
```

**Respuesta (`ConversacionChatResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `tipo` | `string` | no |  |
| `cotizacion_id` | `Optional[string]` | no |  |
| `orden_id` | `Optional[string]` | no |  |
| `solicitante_id` | `Optional[string]` | no |  |
| `importador_usuario_id` | `Optional[string]` | no |  |
| `importador_id` | `Optional[string]` | no |  |
| `contraparte_nombre` | `Optional[string]` | no |  |
| `contraparte_id` | `Optional[string]` | no |  |
| `contraparte_rol` | `Optional[string]` | no |  |
| `contraparte_empresa` | `Optional[string]` | no |  |
| `contraparte_foto_url` | `Optional[string]` | no |  |
| `asunto` | `Optional[string]` | no |  |
| `urgencia` | `Optional[string]` | no |  |
| `solicitante_rol` | `Optional[string]` | no |  |
| `no_leidos` | `integer` | no |  |
| `cerrada` | `boolean` | no |  |
| `resolucion` | `Optional[string]` | no |  |
| `cerrada_por_nombre` | `Optional[string]` | no |  |
| `fecha_cierre` | `Optional[string]` | no |  |
| `nivel` | `Optional[integer]` | no |  |
| `agente_asignado_id` | `Optional[string]` | no |  |
| `agente_nombre` | `Optional[string]` | no |  |
| `agente_nivel` | `Optional[integer]` | no |  |
| `calificacion` | `Optional[integer]` | no |  |
| `comentario_calificacion` | `Optional[string]` | no |  |
| `fecha_creacion` | `string` | sí |  |
| `ultimo_mensaje` | `Optional[MensajeChatResponse]` | no |  |

---

### `POST /chat/interno`

- **Resumen:** Iniciar Chat Interno
- **Auth:** Bearer JWT
- **Códigos:** 201, 422

**Body (`IniciarChatInternoRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `asesor_id` | `Optional[string]` | no |  |
| `mensaje_inicial` | `Optional[string]` | no |  |

```json
{
  "asesor_id": "<asesor_id>",
  "mensaje_inicial": "<mensaje_inicial>"
}
```

**Respuesta (`ConversacionChatResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `tipo` | `string` | no |  |
| `cotizacion_id` | `Optional[string]` | no |  |
| `orden_id` | `Optional[string]` | no |  |
| `solicitante_id` | `Optional[string]` | no |  |
| `importador_usuario_id` | `Optional[string]` | no |  |
| `importador_id` | `Optional[string]` | no |  |
| `contraparte_nombre` | `Optional[string]` | no |  |
| `contraparte_id` | `Optional[string]` | no |  |
| `contraparte_rol` | `Optional[string]` | no |  |
| `contraparte_empresa` | `Optional[string]` | no |  |
| `contraparte_foto_url` | `Optional[string]` | no |  |
| `asunto` | `Optional[string]` | no |  |
| `urgencia` | `Optional[string]` | no |  |
| `solicitante_rol` | `Optional[string]` | no |  |
| `no_leidos` | `integer` | no |  |
| `cerrada` | `boolean` | no |  |
| `resolucion` | `Optional[string]` | no |  |
| `cerrada_por_nombre` | `Optional[string]` | no |  |
| `fecha_cierre` | `Optional[string]` | no |  |
| `nivel` | `Optional[integer]` | no |  |
| `agente_asignado_id` | `Optional[string]` | no |  |
| `agente_nombre` | `Optional[string]` | no |  |
| `agente_nivel` | `Optional[integer]` | no |  |
| `calificacion` | `Optional[integer]` | no |  |
| `comentario_calificacion` | `Optional[string]` | no |  |
| `fecha_creacion` | `string` | sí |  |
| `ultimo_mensaje` | `Optional[MensajeChatResponse]` | no |  |

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

### `POST /chat/soporte`

- **Resumen:** Abrir Ticket Soporte
- **Auth:** Bearer JWT
- **Códigos:** 201, 422

**Body (`AbrirSoporteRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `asunto` | `string` | sí |  |
| `urgencia` | `string` | no |  |
| `mensaje` | `Optional[string]` | no |  |

```json
{
  "asunto": "<asunto>"
}
```

**Respuesta (`ConversacionChatResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `tipo` | `string` | no |  |
| `cotizacion_id` | `Optional[string]` | no |  |
| `orden_id` | `Optional[string]` | no |  |
| `solicitante_id` | `Optional[string]` | no |  |
| `importador_usuario_id` | `Optional[string]` | no |  |
| `importador_id` | `Optional[string]` | no |  |
| `contraparte_nombre` | `Optional[string]` | no |  |
| `contraparte_id` | `Optional[string]` | no |  |
| `contraparte_rol` | `Optional[string]` | no |  |
| `contraparte_empresa` | `Optional[string]` | no |  |
| `contraparte_foto_url` | `Optional[string]` | no |  |
| `asunto` | `Optional[string]` | no |  |
| `urgencia` | `Optional[string]` | no |  |
| `solicitante_rol` | `Optional[string]` | no |  |
| `no_leidos` | `integer` | no |  |
| `cerrada` | `boolean` | no |  |
| `resolucion` | `Optional[string]` | no |  |
| `cerrada_por_nombre` | `Optional[string]` | no |  |
| `fecha_cierre` | `Optional[string]` | no |  |
| `nivel` | `Optional[integer]` | no |  |
| `agente_asignado_id` | `Optional[string]` | no |  |
| `agente_nombre` | `Optional[string]` | no |  |
| `agente_nivel` | `Optional[integer]` | no |  |
| `calificacion` | `Optional[integer]` | no |  |
| `comentario_calificacion` | `Optional[string]` | no |  |
| `fecha_creacion` | `string` | sí |  |
| `ultimo_mensaje` | `Optional[MensajeChatResponse]` | no |  |

---

### `POST /chat/soporte/{conversacion_id}/calificar`

- **Resumen:** Calificar Soporte
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `conversacion_id`

**Body (`CalificarSoporteRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `calificacion` | `integer` | sí |  |
| `comentario` | `Optional[string]` | no |  |

```json
{
  "calificacion": 0
}
```

**Respuesta (`ConversacionChatResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `tipo` | `string` | no |  |
| `cotizacion_id` | `Optional[string]` | no |  |
| `orden_id` | `Optional[string]` | no |  |
| `solicitante_id` | `Optional[string]` | no |  |
| `importador_usuario_id` | `Optional[string]` | no |  |
| `importador_id` | `Optional[string]` | no |  |
| `contraparte_nombre` | `Optional[string]` | no |  |
| `contraparte_id` | `Optional[string]` | no |  |
| `contraparte_rol` | `Optional[string]` | no |  |
| `contraparte_empresa` | `Optional[string]` | no |  |
| `contraparte_foto_url` | `Optional[string]` | no |  |
| `asunto` | `Optional[string]` | no |  |
| `urgencia` | `Optional[string]` | no |  |
| `solicitante_rol` | `Optional[string]` | no |  |
| `no_leidos` | `integer` | no |  |
| `cerrada` | `boolean` | no |  |
| `resolucion` | `Optional[string]` | no |  |
| `cerrada_por_nombre` | `Optional[string]` | no |  |
| `fecha_cierre` | `Optional[string]` | no |  |
| `nivel` | `Optional[integer]` | no |  |
| `agente_asignado_id` | `Optional[string]` | no |  |
| `agente_nombre` | `Optional[string]` | no |  |
| `agente_nivel` | `Optional[integer]` | no |  |
| `calificacion` | `Optional[integer]` | no |  |
| `comentario_calificacion` | `Optional[string]` | no |  |
| `fecha_creacion` | `string` | sí |  |
| `ultimo_mensaje` | `Optional[MensajeChatResponse]` | no |  |

---

### `POST /chat/soporte/{conversacion_id}/cerrar`

- **Resumen:** Cerrar Ticket Soporte
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `conversacion_id`

**Body (`CerrarTicketRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `resolucion` | `string` | sí |  |

```json
{
  "resolucion": "<resolucion>"
}
```

**Respuesta (`ConversacionChatResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `tipo` | `string` | no |  |
| `cotizacion_id` | `Optional[string]` | no |  |
| `orden_id` | `Optional[string]` | no |  |
| `solicitante_id` | `Optional[string]` | no |  |
| `importador_usuario_id` | `Optional[string]` | no |  |
| `importador_id` | `Optional[string]` | no |  |
| `contraparte_nombre` | `Optional[string]` | no |  |
| `contraparte_id` | `Optional[string]` | no |  |
| `contraparte_rol` | `Optional[string]` | no |  |
| `contraparte_empresa` | `Optional[string]` | no |  |
| `contraparte_foto_url` | `Optional[string]` | no |  |
| `asunto` | `Optional[string]` | no |  |
| `urgencia` | `Optional[string]` | no |  |
| `solicitante_rol` | `Optional[string]` | no |  |
| `no_leidos` | `integer` | no |  |
| `cerrada` | `boolean` | no |  |
| `resolucion` | `Optional[string]` | no |  |
| `cerrada_por_nombre` | `Optional[string]` | no |  |
| `fecha_cierre` | `Optional[string]` | no |  |
| `nivel` | `Optional[integer]` | no |  |
| `agente_asignado_id` | `Optional[string]` | no |  |
| `agente_nombre` | `Optional[string]` | no |  |
| `agente_nivel` | `Optional[integer]` | no |  |
| `calificacion` | `Optional[integer]` | no |  |
| `comentario_calificacion` | `Optional[string]` | no |  |
| `fecha_creacion` | `string` | sí |  |
| `ultimo_mensaje` | `Optional[MensajeChatResponse]` | no |  |

---

### `POST /chat/soporte/{conversacion_id}/escalar`

- **Resumen:** Escalar Ticket Soporte
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `conversacion_id`

**Body (`EscalarTicketRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `nivel` | `integer` | sí |  |
| `motivo` | `Optional[string]` | no |  |

```json
{
  "nivel": 0
}
```

**Respuesta (`ConversacionChatResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `tipo` | `string` | no |  |
| `cotizacion_id` | `Optional[string]` | no |  |
| `orden_id` | `Optional[string]` | no |  |
| `solicitante_id` | `Optional[string]` | no |  |
| `importador_usuario_id` | `Optional[string]` | no |  |
| `importador_id` | `Optional[string]` | no |  |
| `contraparte_nombre` | `Optional[string]` | no |  |
| `contraparte_id` | `Optional[string]` | no |  |
| `contraparte_rol` | `Optional[string]` | no |  |
| `contraparte_empresa` | `Optional[string]` | no |  |
| `contraparte_foto_url` | `Optional[string]` | no |  |
| `asunto` | `Optional[string]` | no |  |
| `urgencia` | `Optional[string]` | no |  |
| `solicitante_rol` | `Optional[string]` | no |  |
| `no_leidos` | `integer` | no |  |
| `cerrada` | `boolean` | no |  |
| `resolucion` | `Optional[string]` | no |  |
| `cerrada_por_nombre` | `Optional[string]` | no |  |
| `fecha_cierre` | `Optional[string]` | no |  |
| `nivel` | `Optional[integer]` | no |  |
| `agente_asignado_id` | `Optional[string]` | no |  |
| `agente_nombre` | `Optional[string]` | no |  |
| `agente_nivel` | `Optional[integer]` | no |  |
| `calificacion` | `Optional[integer]` | no |  |
| `comentario_calificacion` | `Optional[string]` | no |  |
| `fecha_creacion` | `string` | sí |  |
| `ultimo_mensaje` | `Optional[MensajeChatResponse]` | no |  |

---

### `POST /chat/soporte/{conversacion_id}/reabrir`

- **Resumen:** Reabrir Ticket Soporte
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `conversacion_id`

**Respuesta (`ConversacionChatResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `tipo` | `string` | no |  |
| `cotizacion_id` | `Optional[string]` | no |  |
| `orden_id` | `Optional[string]` | no |  |
| `solicitante_id` | `Optional[string]` | no |  |
| `importador_usuario_id` | `Optional[string]` | no |  |
| `importador_id` | `Optional[string]` | no |  |
| `contraparte_nombre` | `Optional[string]` | no |  |
| `contraparte_id` | `Optional[string]` | no |  |
| `contraparte_rol` | `Optional[string]` | no |  |
| `contraparte_empresa` | `Optional[string]` | no |  |
| `contraparte_foto_url` | `Optional[string]` | no |  |
| `asunto` | `Optional[string]` | no |  |
| `urgencia` | `Optional[string]` | no |  |
| `solicitante_rol` | `Optional[string]` | no |  |
| `no_leidos` | `integer` | no |  |
| `cerrada` | `boolean` | no |  |
| `resolucion` | `Optional[string]` | no |  |
| `cerrada_por_nombre` | `Optional[string]` | no |  |
| `fecha_cierre` | `Optional[string]` | no |  |
| `nivel` | `Optional[integer]` | no |  |
| `agente_asignado_id` | `Optional[string]` | no |  |
| `agente_nombre` | `Optional[string]` | no |  |
| `agente_nivel` | `Optional[integer]` | no |  |
| `calificacion` | `Optional[integer]` | no |  |
| `comentario_calificacion` | `Optional[string]` | no |  |
| `fecha_creacion` | `string` | sí |  |
| `ultimo_mensaje` | `Optional[MensajeChatResponse]` | no |  |

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
