# APIs — Importadores

> Generado desde OpenAPI en vivo (`/openapi.json`). Base URL local: `http://localhost:8000`.

### `GET /importadores/`

- **Resumen:** Listar Importadores
- **Auth:** Público
- **Códigos:** 200, 422
- **Query:** `especialidad`, `pais`, `orden`, `certificado`

**Respuesta (`array[ImportadorResponse]`)**

Array de `ImportadorResponse`:

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

### `POST /importadores/`

- **Resumen:** Crear Importador
- **Auth:** Bearer JWT
- **Códigos:** 201, 422

**Body (`ImportadorCreate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `nombre_empresa` | `string` | sí | Nombre de la empresa importadora |
| `logo_url` | `Optional[string]` | no |  |
| `especialidad_producto` | `array[string]` | sí | Categorías de producto (ej: ['Textiles', 'Electrónica']) |
| `paises_origen` | `array[string]` | sí | Países de origen (ej: ['China', 'Vietnam']) |
| `calificacion_promedio` | `number` | no |  |
| `tiempo_respuesta_promedio` | `string` | sí | Tiempo promedio de respuesta (ej: '24h') |
| `capacidad_volumen` | `Optional[integer]` | no |  |

```json
{
  "nombre_empresa": "<nombre_empresa>",
  "especialidad_producto": null,
  "paises_origen": null,
  "tiempo_respuesta_promedio": "<tiempo_respuesta_promedio>"
}
```

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

### `GET /importadores/asesores`

- **Resumen:** Listar Asesores
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`array[AsesorResponse]`)**

Array de `AsesorResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `email` | `string` | sí |  |
| `nombre` | `Optional[string]` | no |  |
| `telefono` | `Optional[string]` | no |  |
| `activo` | `boolean` | sí |  |
| `fecha_creacion` | `string` | sí |  |

---

### `POST /importadores/asesores`

- **Resumen:** Crear Asesor
- **Auth:** Bearer JWT
- **Códigos:** 201, 422

**Body (`AsesorCreate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `email` | `string` | sí |  |
| `password` | `string` | sí |  |
| `nombre` | `Optional[string]` | no |  |
| `telefono` | `Optional[string]` | no |  |

```json
{
  "email": "user@ejemplo.com",
  "password": "<password>"
}
```

**Respuesta (`AsesorResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `email` | `string` | sí |  |
| `nombre` | `Optional[string]` | no |  |
| `telefono` | `Optional[string]` | no |  |
| `activo` | `boolean` | sí |  |
| `fecha_creacion` | `string` | sí |  |

---

### `PUT /importadores/asesores/{asesor_id}/estado`

- **Resumen:** Actualizar Estado Asesor
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `asesor_id`

**Body (`AsesorEstadoUpdate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `activo` | `boolean` | sí |  |

```json
{
  "activo": true
}
```

**Respuesta (`AsesorResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `email` | `string` | sí |  |
| `nombre` | `Optional[string]` | no |  |
| `telefono` | `Optional[string]` | no |  |
| `activo` | `boolean` | sí |  |
| `fecha_creacion` | `string` | sí |  |

---

### `DELETE /importadores/asesores/{asesor_id}`

- **Resumen:** Hard delete de un asesor (solo dueño). Preferir soft delete con `PUT .../estado`.
- **Auth:** Bearer JWT rol `importador`
- **Códigos:** 204, 404, 409
- **409:** el asesor tiene cotizaciones asignadas o conversaciones de chat (conservar historial con soft delete).

---

### `GET /importadores/metricas`

- **Resumen:** Dashboard comercial de la empresa (propuestas, tasa de aceptación, volumen USD, órdenes, asesores activos).
- **Auth:** Bearer JWT rol `importador`
- **Códigos:** 200

**Respuesta (`MetricasImportadorResponse`)**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `importador_id` | string |  |
| `total_cotizaciones_recibidas` | int |  |
| `total_propuestas_enviadas` | int |  |
| `total_propuestas_aceptadas` | int |  |
| `tasa_aceptacion_pct` | number |  |
| `volumen_cotizado_usd` | number | Suma de precios ofrecidos |
| `ordenes_activas` | int |  |
| `ordenes_totales` | int |  |
| `asesores_activos` | int |  |
| `tiempo_promedio_respuesta_horas` | number\|null |  |

---

### `GET /importadores/campos-personalizados`

- **Resumen:** Listar Mis Campos Personalizados
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`array[CampoPersonalizadoResponse]`)**

Array de `CampoPersonalizadoResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `etiqueta` | `string` | sí |  |
| `tipo` | `string` | sí |  |
| `opciones` | `Optional[array]` | no |  |
| `obligatorio` | `boolean` | sí |  |
| `orden` | `integer` | sí |  |

---

### `POST /importadores/campos-personalizados`

- **Resumen:** Crear Campo Personalizado
- **Auth:** Bearer JWT
- **Códigos:** 201, 422

**Body (`CampoPersonalizadoCreate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `etiqueta` | `string` | sí |  |
| `tipo` | `string` | sí | 'texto', 'numero', 'select' o 'booleano' |
| `opciones` | `Optional[array]` | no |  |
| `obligatorio` | `boolean` | no |  |
| `orden` | `integer` | no |  |

```json
{
  "etiqueta": "<etiqueta>",
  "tipo": "<tipo>"
}
```

**Respuesta (`CampoPersonalizadoResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `etiqueta` | `string` | sí |  |
| `tipo` | `string` | sí |  |
| `opciones` | `Optional[array]` | no |  |
| `obligatorio` | `boolean` | sí |  |
| `orden` | `integer` | sí |  |

---

### `DELETE /importadores/campos-personalizados/{campo_id}`

- **Resumen:** Eliminar Campo Personalizado
- **Auth:** Bearer JWT
- **Códigos:** 204, 422
- **Path params:** `campo_id`

---

### `PUT /importadores/campos-personalizados/{campo_id}`

- **Resumen:** Actualizar Campo Personalizado
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `campo_id`

**Body (`CampoPersonalizadoUpdate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `etiqueta` | `Optional[string]` | no |  |
| `tipo` | `Optional[string]` | no |  |
| `opciones` | `Optional[array]` | no |  |
| `obligatorio` | `Optional[boolean]` | no |  |
| `orden` | `Optional[integer]` | no |  |

```json
{
  "etiqueta": "<etiqueta>",
  "tipo": "<tipo>",
  "opciones": null,
  "obligatorio": true,
  "orden": 0
}
```

**Respuesta (`CampoPersonalizadoResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `etiqueta` | `string` | sí |  |
| `tipo` | `string` | sí |  |
| `opciones` | `Optional[array]` | no |  |
| `obligatorio` | `boolean` | sí |  |
| `orden` | `integer` | sí |  |

---

### `GET /importadores/certificados`

- **Resumen:** Listar Importadores Certificados
- **Auth:** Público
- **Códigos:** 200

**Respuesta (`array[ImportadorResponse]`)**

Array de `ImportadorResponse`:

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

### `GET /importadores/destacados`

- **Resumen:** Listar Importadores Destacados
- **Auth:** Público
- **Códigos:** 200, 422
- **Query:** `limite`

**Respuesta (`array[ImportadorResponse]`)**

Array de `ImportadorResponse`:

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

### `GET /importadores/evidencias`

- **Resumen:** Listar Mis Evidencias
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`array[EvidenciaImportadorResponse]`)**

Array de `EvidenciaImportadorResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `tipo` | `string` | sí |  |
| `titulo` | `string` | sí |  |
| `descripcion` | `Optional[string]` | sí |  |
| `url` | `string` | sí |  |
| `estado` | `string` | sí |  |
| `nota_revision` | `Optional[string]` | no |  |
| `fecha_creacion` | `Optional[string]` | no |  |
| `fecha_revision` | `Optional[string]` | no |  |

---

### `POST /importadores/evidencias`

- **Resumen:** Crear Evidencia
- **Auth:** Bearer JWT
- **Códigos:** 201, 422

**Body (`EvidenciaImportadorCreate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `tipo` | `string` | sí |  |
| `titulo` | `string` | sí |  |
| `descripcion` | `Optional[string]` | no |  |
| `url` | `string` | sí |  |

```json
{
  "tipo": "<tipo>",
  "titulo": "<titulo>",
  "url": "<url>"
}
```

**Respuesta (`EvidenciaImportadorResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `tipo` | `string` | sí |  |
| `titulo` | `string` | sí |  |
| `descripcion` | `Optional[string]` | sí |  |
| `url` | `string` | sí |  |
| `estado` | `string` | sí |  |
| `nota_revision` | `Optional[string]` | no |  |
| `fecha_creacion` | `Optional[string]` | no |  |
| `fecha_revision` | `Optional[string]` | no |  |

---

### `DELETE /importadores/evidencias/{evidencia_id}`

- **Resumen:** Eliminar Evidencia
- **Auth:** Bearer JWT
- **Códigos:** 204, 422
- **Path params:** `evidencia_id`

---

### `GET /importadores/por-categoria`

- **Resumen:** Listar Importadores Por Categoria
- **Auth:** Público
- **Códigos:** 200

**Respuesta (`object`)**

_Sin campos detallados en OpenAPI._

---

### `GET /importadores/{importador_id}`

- **Resumen:** Obtener Importador
- **Auth:** Público
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

### `PUT /importadores/{importador_id}`

- **Resumen:** Actualizar Perfil Importador
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `importador_id`

**Body (`ImportadorUpdate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `nombre_empresa` | `Optional[string]` | no |  |
| `logo_url` | `Optional[string]` | no |  |
| `especialidad_producto` | `Optional[array]` | no |  |
| `paises_origen` | `Optional[array]` | no |  |
| `tiempo_respuesta_promedio` | `Optional[string]` | no |  |
| `capacidad_volumen` | `Optional[integer]` | no |  |
| `solo_cotizaciones_directas` | `Optional[boolean]` | no |  |

```json
{
  "nombre_empresa": "<nombre_empresa>",
  "logo_url": "<logo_url>",
  "especialidad_producto": null,
  "paises_origen": null,
  "tiempo_respuesta_promedio": "<tiempo_respuesta_promedio>",
  "capacidad_volumen": 0
}
```

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

### `GET /importadores/{importador_id}/evidencias`

- **Resumen:** Listar Evidencias Aprobadas Publicas
- **Auth:** Público
- **Códigos:** 200, 422
- **Path params:** `importador_id`

**Respuesta (`array[EvidenciaImportadorResponse]`)**

Array de `EvidenciaImportadorResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `tipo` | `string` | sí |  |
| `titulo` | `string` | sí |  |
| `descripcion` | `Optional[string]` | sí |  |
| `url` | `string` | sí |  |
| `estado` | `string` | sí |  |
| `nota_revision` | `Optional[string]` | no |  |
| `fecha_creacion` | `Optional[string]` | no |  |
| `fecha_revision` | `Optional[string]` | no |  |

---

### `GET /importadores/{importador_id}/formulario`

- **Resumen:** Obtener Formulario Importador
- **Auth:** Público
- **Códigos:** 200, 422
- **Path params:** `importador_id`

**Respuesta (`FormularioImportadorResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `importador_id` | `string` | sí |  |
| `solo_cotizaciones_directas` | `boolean` | sí |  |
| `campos_personalizados` | `array[CampoPersonalizadoResponse]` | no |  |

---

### `GET /importadores/{importador_id}/ordenes-activas`

- **Resumen:** Listar Ordenes Activas Importador
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `importador_id`

**Respuesta (`array`)**

_Sin campos detallados en OpenAPI._

---

### `GET /importadores/{importador_id}/solicitudes-abiertas`

- **Resumen:** Listar Solicitudes Abiertas
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `importador_id`

**Respuesta (`array`)**

_Sin campos detallados en OpenAPI._

---

### `GET /importadores/{importador_id}/solicitudes-dirigidas`

- **Resumen:** Listar Solicitudes Dirigidas
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `importador_id`

**Respuesta (`array`)**

_Sin campos detallados en OpenAPI._

---
