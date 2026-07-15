# APIs — Administración

> Generado desde OpenAPI en vivo (`/openapi.json`). Base URL local: `http://localhost:8000`.

### `GET /admin/cotizaciones-abiertas`

- **Resumen:** Listar Cotizaciones Abiertas
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`array`)**

_Sin campos detallados en OpenAPI._

---

### `GET /admin/disputas`

- **Resumen:** Listar Disputas
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`array[DisputaOrdenResponse]`)**

Array de `DisputaOrdenResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `cotizacion_id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `solicitante_id` | `string` | sí |  |
| `estado` | `string` | sí |  |
| `motivo_disputa` | `Optional[string]` | no |  |
| `fecha_actualizacion` | `string` | sí |  |

---

### `PUT /admin/disputas-room/{disputa_id}/resolver`

- **Resumen:** Resolver Disputa Por Id
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `disputa_id`

**Body (`ResolverDisputaRoomRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `resolucion` | `string` | sí |  |
| `estado` | `string` | no |  |

```json
{
  "resolucion": "<resolucion>"
}
```

**Respuesta (`object`)**

_Sin campos detallados en OpenAPI._

---

### `PUT /admin/disputas/{orden_id}/resolver`

- **Resumen:** Resolver Disputa
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `orden_id`

**Body (`ResolverDisputaRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `resolucion` | `string` | sí | Notas de la resolución aplicada por el admin |

```json
{
  "resolucion": "<resolucion>"
}
```

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
| `en_disputa` | `boolean` | no |  |
| `motivo_disputa` | `Optional[string]` | no |  |
| `conversacion_id` | `Optional[string]` | no |  |
| `historial_estados` | `array[EstadoOrdenItem]` | sí |  |
| `documentos_adjuntos` | `array[DocumentoOrdenItem]` | sí |  |

---

### `PUT /admin/evidencias/{evidencia_id}/revisar`

- **Resumen:** Revisar Evidencia Importador
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `evidencia_id`

**Body (`RevisarEvidenciaRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `estado` | `string` | sí |  |
| `nota_revision` | `Optional[string]` | no |  |

```json
{
  "estado": "<estado>"
}
```

**Respuesta (`object`)**

_Sin campos detallados en OpenAPI._

---

### `POST /admin/importadores`

- **Resumen:** Crear Importador Con Dueño
- **Auth:** Bearer JWT
- **Códigos:** 201, 422

**Body (`AdminCrearImportadorRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `nombre_empresa` | `string` | sí |  |
| `logo_url` | `Optional[string]` | no |  |
| `especialidad_producto` | `array[string]` | sí |  |
| `paises_origen` | `array[string]` | sí |  |
| `calificacion_promedio` | `number` | no |  |
| `tiempo_respuesta_promedio` | `string` | sí |  |
| `capacidad_volumen` | `Optional[integer]` | no |  |
| `solo_cotizaciones_directas` | `boolean` | no |  |
| `email_dueño` | `string` | sí | Email de la cuenta dueña de la empresa |
| `password_dueño` | `string` | sí | Contraseña inicial de la cuenta dueña |
| `nombre_dueño` | `Optional[string]` | no |  |

```json
{
  "nombre_empresa": "<nombre_empresa>",
  "especialidad_producto": null,
  "paises_origen": null,
  "tiempo_respuesta_promedio": "<tiempo_respuesta_promedio>",
  "email_dueño": "user@ejemplo.com",
  "password_dueño": "<password_dueño>"
}
```

**Respuesta (`AdminCrearImportadorResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `importador` | `ImportadorResponse` | sí |  |
| `usuario_dueño_id` | `string` | sí |  |
| `email_dueño` | `string` | sí |  |

---

### `PUT /admin/importadores/{importador_id}/estado`

- **Resumen:** Actualizar Estado Importador
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `importador_id`
- **Query:** `estado`*

**Respuesta (`ImportadorResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `nombre_empresa` | `string` | sí |  |
| `logo_url` | `Optional[string]` | sí |  |
| `especialidad_producto` | `array[string]` | sí |  |
| `paises_origen` | `array[string]` | sí |  |
| `calificacion_promedio` | `number` | sí |  |
| `tiempo_respuesta_promedio` | `string` | sí |  |
| `capacidad_volumen` | `Optional[integer]` | sí |  |
| `estado` | `string` | sí |  |
| `solo_cotizaciones_directas` | `boolean` | no |  |
| `verificado` | `boolean` | no |  |
| `fecha_registro` | `string` | sí |  |

---

### `POST /admin/importadores/{importador_id}/verificar`

- **Resumen:** Verificar Importador
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `importador_id`

**Respuesta (`ImportadorResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `nombre_empresa` | `string` | sí |  |
| `logo_url` | `Optional[string]` | sí |  |
| `especialidad_producto` | `array[string]` | sí |  |
| `paises_origen` | `array[string]` | sí |  |
| `calificacion_promedio` | `number` | sí |  |
| `tiempo_respuesta_promedio` | `string` | sí |  |
| `capacidad_volumen` | `Optional[integer]` | sí |  |
| `estado` | `string` | sí |  |
| `solo_cotizaciones_directas` | `boolean` | no |  |
| `verificado` | `boolean` | no |  |
| `fecha_registro` | `string` | sí |  |

---

### `GET /admin/metricas`

- **Resumen:** Obtener Metricas
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`MetricasResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `total_cotizaciones` | `integer` | sí |  |
| `cotizaciones_dirigidas` | `integer` | sí |  |
| `cotizaciones_abiertas` | `integer` | sí |  |
| `tasa_respuesta_abiertas` | `number` | sí |  |
| `tiempo_promedio_primera_propuesta_horas` | `Optional[number]` | no |  |
| `tasa_conversion_a_orden` | `number` | sí |  |
| `importadores_activos` | `integer` | sí |  |
| `importadores_verificados` | `integer` | sí |  |
| `ordenes_en_disputa` | `integer` | sí |  |

---

### `GET /admin/recreaciones`

- **Resumen:** Listar Recreaciones
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Query:** `estado`

**Respuesta (`array[SolicitudRecreacionResponse]`)**

Array de `SolicitudRecreacionResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `cotizacion_origen_id` | `string` | sí |  |
| `solicitado_por_usuario_id` | `string` | sí |  |
| `motivo` | `string` | sí |  |
| `parte_atribuida_sugerida` | `string` | sí |  |
| `estado` | `string` | sí |  |
| `parte_atribuida_final` | `Optional[string]` | sí |  |
| `fecha_creacion` | `string` | sí |  |
| `fecha_resolucion` | `Optional[string]` | sí |  |

---

### `PUT /admin/recreaciones/{solicitud_id}/resolver`

- **Resumen:** Resolver Recreacion
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `solicitud_id`

**Body (`ResolverRecreacionRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `parte_atribuida_final` | `string` | sí |  |
| `aprobado` | `boolean` | sí | Si es False, se rechaza la solicitud y la cotización original no se cancela |

```json
{
  "parte_atribuida_final": "<parte_atribuida_final>",
  "aprobado": true
}
```

**Respuesta (`SolicitudRecreacionResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `cotizacion_origen_id` | `string` | sí |  |
| `solicitado_por_usuario_id` | `string` | sí |  |
| `motivo` | `string` | sí |  |
| `parte_atribuida_sugerida` | `string` | sí |  |
| `estado` | `string` | sí |  |
| `parte_atribuida_final` | `Optional[string]` | sí |  |
| `fecha_creacion` | `string` | sí |  |
| `fecha_resolucion` | `Optional[string]` | sí |  |

---

### `GET /admin/usuarios`

- **Resumen:** Listar Usuarios
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Query:** `rol`, `activo`

**Respuesta (`array[UsuarioAdminResponse]`)**

Array de `UsuarioAdminResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `email` | `string` | sí |  |
| `rol` | `string` | sí |  |
| `importador_id` | `Optional[string]` | no |  |
| `nombre` | `Optional[string]` | no |  |
| `activo` | `boolean` | sí |  |
| `perfil_completo` | `boolean` | sí |  |
| `fecha_creacion` | `string` | sí |  |

---

### `PUT /admin/usuarios/{usuario_id}/estado`

- **Resumen:** Actualizar Estado Usuario
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `usuario_id`

**Body (`UsuarioEstadoUpdate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `activo` | `boolean` | sí |  |

```json
{
  "activo": true
}
```

**Respuesta (`UsuarioAdminResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `email` | `string` | sí |  |
| `rol` | `string` | sí |  |
| `importador_id` | `Optional[string]` | no |  |
| `nombre` | `Optional[string]` | no |  |
| `activo` | `boolean` | sí |  |
| `perfil_completo` | `boolean` | sí |  |
| `fecha_creacion` | `string` | sí |  |

---
