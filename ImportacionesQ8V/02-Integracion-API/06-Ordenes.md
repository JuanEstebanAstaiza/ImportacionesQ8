# APIs — Órdenes

> Endpoints REST generados desde OpenAPI (`/openapi.json`). Base URL local: `http://localhost:8000`.
> Lo escrito a mano va en `_preambulos/06-Ordenes.md`; el resto se sobrescribe.

### `GET /ordenes`

- **Resumen:** Listar Ordenes
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`array[OrdenResponse]`)**

Array de `OrdenResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `cotizacion_id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `solicitante_id` | `string` | sí |  |
| `asesor_asignado_id` | `Optional[string]` | sí |  |
| `estado` | `string` | sí |  |
| `precio_acordado_usd` | `number` | sí |  |
| `tiempo_estimado_entrega` | `Optional[string]` | sí |  |
| `condiciones_adicionales` | `Optional[string]` | sí |  |
| `shipping_mark` | `Optional[string]` | no |  |
| `en_disputa` | `boolean` | no |  |
| `motivo_disputa` | `Optional[string]` | no |  |
| `conversacion_id` | `Optional[string]` | no |  |
| `historial_estados` | `array[EstadoOrdenItem]` | sí |  |
| `documentos_adjuntos` | `array[DocumentoOrdenItem]` | sí |  |

---

### `GET /ordenes/cotizacion/{cotizacion_id}`

- **Resumen:** Obtener Orden Por Cotizacion
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `cotizacion_id`

**Respuesta (`OrdenResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `cotizacion_id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `solicitante_id` | `string` | sí |  |
| `asesor_asignado_id` | `Optional[string]` | sí |  |
| `estado` | `string` | sí |  |
| `precio_acordado_usd` | `number` | sí |  |
| `tiempo_estimado_entrega` | `Optional[string]` | sí |  |
| `condiciones_adicionales` | `Optional[string]` | sí |  |
| `shipping_mark` | `Optional[string]` | no |  |
| `en_disputa` | `boolean` | no |  |
| `motivo_disputa` | `Optional[string]` | no |  |
| `conversacion_id` | `Optional[string]` | no |  |
| `historial_estados` | `array[EstadoOrdenItem]` | sí |  |
| `documentos_adjuntos` | `array[DocumentoOrdenItem]` | sí |  |

---

### `GET /ordenes/importador/{importador_id}/activas`

- **Resumen:** Listar Ordenes Activas Importador
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `importador_id`

**Respuesta (`array[OrdenResponse]`)**

Array de `OrdenResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `cotizacion_id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `solicitante_id` | `string` | sí |  |
| `asesor_asignado_id` | `Optional[string]` | sí |  |
| `estado` | `string` | sí |  |
| `precio_acordado_usd` | `number` | sí |  |
| `tiempo_estimado_entrega` | `Optional[string]` | sí |  |
| `condiciones_adicionales` | `Optional[string]` | sí |  |
| `shipping_mark` | `Optional[string]` | no |  |
| `en_disputa` | `boolean` | no |  |
| `motivo_disputa` | `Optional[string]` | no |  |
| `conversacion_id` | `Optional[string]` | no |  |
| `historial_estados` | `array[EstadoOrdenItem]` | sí |  |
| `documentos_adjuntos` | `array[DocumentoOrdenItem]` | sí |  |

---

### `GET /ordenes/{orden_id}`

- **Resumen:** Obtener Orden
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `orden_id`

**Respuesta (`OrdenResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `cotizacion_id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `solicitante_id` | `string` | sí |  |
| `asesor_asignado_id` | `Optional[string]` | sí |  |
| `estado` | `string` | sí |  |
| `precio_acordado_usd` | `number` | sí |  |
| `tiempo_estimado_entrega` | `Optional[string]` | sí |  |
| `condiciones_adicionales` | `Optional[string]` | sí |  |
| `shipping_mark` | `Optional[string]` | no |  |
| `en_disputa` | `boolean` | no |  |
| `motivo_disputa` | `Optional[string]` | no |  |
| `conversacion_id` | `Optional[string]` | no |  |
| `historial_estados` | `array[EstadoOrdenItem]` | sí |  |
| `documentos_adjuntos` | `array[DocumentoOrdenItem]` | sí |  |

---

### `POST /ordenes/{orden_id}/documentos`

- **Resumen:** Agregar Documento Orden
- **Auth:** Bearer JWT
- **Códigos:** 201, 422
- **Path params:** `orden_id`

**Body (`DocumentoOrdenCreate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `nombre` | `string` | sí |  |
| `url` | `string` | sí |  |
| `tipo` | `string` | sí |  |

```json
{
  "nombre": "<nombre>",
  "url": "<url>",
  "tipo": "<tipo>"
}
```

**Respuesta (`DocumentoOrdenItem`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `orden_id` | `string` | sí |  |
| `nombre` | `string` | sí |  |
| `url` | `string` | sí |  |
| `tipo` | `string` | sí |  |

---

### `PUT /ordenes/{orden_id}/estado`

- **Resumen:** Actualizar Estado Orden
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `orden_id`

**Body (`EstadoOrdenUpdate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `estado` | `string` | sí |  |

```json
{
  "estado": "<estado>"
}
```

**Respuesta (`object`)**

_Sin campos detallados en OpenAPI._

---

### `PUT /ordenes/{orden_id}/reportar-problema`

- **Resumen:** Reportar Problema Orden
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `orden_id`

**Body (`ReportarProblemaRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `motivo` | `string` | sí | Descripción del problema reportado |

```json
{
  "motivo": "<motivo>"
}
```

**Respuesta (`object`)**

_Sin campos detallados en OpenAPI._

---
