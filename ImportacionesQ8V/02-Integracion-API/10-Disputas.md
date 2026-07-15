# APIs — Disputas

> Generado desde OpenAPI en vivo (`/openapi.json`). Base URL local: `http://localhost:8000`.

### `GET /disputas/orden/{orden_id}`

- **Resumen:** Disputa Por Orden
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `orden_id`

**Respuesta (`DisputaResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `orden_id` | `string` | sí |  |
| `abierta_por_usuario_id` | `string` | sí |  |
| `estado` | `string` | sí |  |
| `motivo` | `string` | sí |  |
| `resolucion_admin` | `Optional[string]` | no |  |
| `fecha_apertura` | `Optional[string]` | no |  |
| `fecha_resolucion` | `Optional[string]` | no |  |
| `evidencias` | `array[EvidenciaDisputaResponse]` | no |  |
| `mensajes` | `array[MensajeDisputaResponse]` | no |  |

---

### `GET /disputas/{disputa_id}`

- **Resumen:** Obtener Disputa
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `disputa_id`

**Respuesta (`DisputaResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `orden_id` | `string` | sí |  |
| `abierta_por_usuario_id` | `string` | sí |  |
| `estado` | `string` | sí |  |
| `motivo` | `string` | sí |  |
| `resolucion_admin` | `Optional[string]` | no |  |
| `fecha_apertura` | `Optional[string]` | no |  |
| `fecha_resolucion` | `Optional[string]` | no |  |
| `evidencias` | `array[EvidenciaDisputaResponse]` | no |  |
| `mensajes` | `array[MensajeDisputaResponse]` | no |  |

---

### `POST /disputas/{disputa_id}/evidencias`

- **Resumen:** Subir Evidencia Disputa
- **Auth:** Bearer JWT
- **Códigos:** 201, 422
- **Path params:** `disputa_id`

**Body (`EvidenciaDisputaCreate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `url` | `string` | sí |  |
| `tipo` | `string` | no |  |
| `descripcion` | `Optional[string]` | no |  |

```json
{
  "url": "<url>"
}
```

**Respuesta (`EvidenciaDisputaResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `disputa_id` | `string` | sí |  |
| `subido_por_usuario_id` | `string` | sí |  |
| `url` | `string` | sí |  |
| `tipo` | `string` | sí |  |
| `descripcion` | `Optional[string]` | sí |  |
| `fecha` | `Optional[string]` | no |  |

---

### `POST /disputas/{disputa_id}/mensajes`

- **Resumen:** Mensaje Disputa
- **Auth:** Bearer JWT
- **Códigos:** 201, 422
- **Path params:** `disputa_id`

**Body (`MensajeDisputaCreate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `contenido` | `string` | sí |  |

```json
{
  "contenido": "<contenido>"
}
```

**Respuesta (`MensajeDisputaResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `disputa_id` | `string` | sí |  |
| `autor_id` | `string` | sí |  |
| `contenido` | `string` | sí |  |
| `tipo` | `string` | sí |  |
| `fecha` | `Optional[string]` | no |  |

---
