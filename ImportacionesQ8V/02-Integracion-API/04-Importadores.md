# APIs — Importadores

> Endpoints REST generados desde OpenAPI (`/openapi.json`). Base URL local: `http://localhost:8000`.
> Lo escrito a mano va en `_preambulos/04-Importadores.md`; el resto se sobrescribe.

### `GET /importadores`

- **Resumen:** Listar Importadores
- **Auth:** Público
- **Códigos:** 200, 422
- **Query:** `especialidad`, `pais`, `orden`, `certificado`, `limit`, `offset`

**Respuesta (`array[ImportadorResponse]`)**

Array de `ImportadorResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `nombre_empresa` | `string` | sí |  |
| `logo_url` | `Optional[string]` | sí |  |
| `certificaciones` | `array[CertificacionOtorgadaResponse]` | no |  |
| `puntaje_publicidad` | `number` | no |  |
| `proyectos_completados` | `integer` | no |  |
| `especialidad_producto` | `array[string]` | sí |  |
| `paises_origen` | `array[string]` | sí |  |
| `calificacion_promedio` | `number` | sí |  |
| `tiempo_respuesta_promedio` | `string` | sí |  |
| `capacidad_volumen` | `Optional[integer]` | sí |  |
| `perfil_publico` | `Optional[object]` | no |  |
| `estado` | `string` | sí |  |
| `solo_cotizaciones_directas` | `boolean` | no |  |
| `verificado` | `boolean` | no |  |
| `shipping_mark_prefijo` | `Optional[string]` | no |  |
| `tier_minimo_requerido` | `string` | no |  |
| `limite_cotizaciones_diarias` | `Optional[integer]` | no |  |
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

### `DELETE /importadores/asesores/{asesor_id}`

- **Resumen:** Eliminar Asesor
- **Auth:** Bearer JWT
- **Códigos:** 204, 422
- **Path params:** `asesor_id`

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

**Respuesta (`AsesorEstadoResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `email` | `string` | sí |  |
| `nombre` | `Optional[string]` | no |  |
| `telefono` | `Optional[string]` | no |  |
| `activo` | `boolean` | sí |  |
| `fecha_creacion` | `string` | sí |  |
| `cotizaciones_reasignadas` | `integer` | no |  |
| `ordenes_reasignadas` | `integer` | no |  |
| `conversaciones_reasignadas` | `integer` | no |  |

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
| `certificaciones` | `array[CertificacionOtorgadaResponse]` | no |  |
| `puntaje_publicidad` | `number` | no |  |
| `proyectos_completados` | `integer` | no |  |
| `especialidad_producto` | `array[string]` | sí |  |
| `paises_origen` | `array[string]` | sí |  |
| `calificacion_promedio` | `number` | sí |  |
| `tiempo_respuesta_promedio` | `string` | sí |  |
| `capacidad_volumen` | `Optional[integer]` | sí |  |
| `perfil_publico` | `Optional[object]` | no |  |
| `estado` | `string` | sí |  |
| `solo_cotizaciones_directas` | `boolean` | no |  |
| `verificado` | `boolean` | no |  |
| `shipping_mark_prefijo` | `Optional[string]` | no |  |
| `tier_minimo_requerido` | `string` | no |  |
| `limite_cotizaciones_diarias` | `Optional[integer]` | no |  |
| `fecha_registro` | `string` | sí |  |

---

### `PUT /importadores/cotizaciones/{cotizacion_id}/asignar`

- **Resumen:** Asignar Asesor A Cotizacion
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `cotizacion_id`

**Body (`AsignarAsesorRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `asesor_id` | `Optional[string]` | no |  |

```json
{
  "asesor_id": "<asesor_id>"
}
```

**Respuesta (`ReasignacionResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `cotizaciones_reasignadas` | `integer` | no |  |
| `ordenes_reasignadas` | `integer` | no |  |
| `conversaciones_reasignadas` | `integer` | no |  |

---

### `GET /importadores/cupo-diario`

- **Resumen:** Cupo Diario Importador
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`CupoDiarioResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `importador_id` | `string` | sí |  |
| `limite_cotizaciones_diarias` | `Optional[integer]` | no |  |
| `recibidas_hoy` | `integer` | sí |  |
| `disponibles_hoy` | `Optional[integer]` | no |  |
| `cupo_agotado` | `boolean` | sí |  |
| `reinicia_en` | `string` | sí | Momento (UTC) en que el contador vuelve a cero |

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
| `certificaciones` | `array[CertificacionOtorgadaResponse]` | no |  |
| `puntaje_publicidad` | `number` | no |  |
| `proyectos_completados` | `integer` | no |  |
| `especialidad_producto` | `array[string]` | sí |  |
| `paises_origen` | `array[string]` | sí |  |
| `calificacion_promedio` | `number` | sí |  |
| `tiempo_respuesta_promedio` | `string` | sí |  |
| `capacidad_volumen` | `Optional[integer]` | sí |  |
| `perfil_publico` | `Optional[object]` | no |  |
| `estado` | `string` | sí |  |
| `solo_cotizaciones_directas` | `boolean` | no |  |
| `verificado` | `boolean` | no |  |
| `shipping_mark_prefijo` | `Optional[string]` | no |  |
| `tier_minimo_requerido` | `string` | no |  |
| `limite_cotizaciones_diarias` | `Optional[integer]` | no |  |
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
| `descripcion` | `Optional[string]` | no | Descripcion breve que acompana al video o a la foto en la ficha publica |
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

### `GET /importadores/metricas`

- **Resumen:** Metricas Importador
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`MetricasImportadorResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `importador_id` | `string` | sí |  |
| `total_cotizaciones_recibidas` | `integer` | sí |  |
| `total_propuestas_enviadas` | `integer` | sí |  |
| `total_propuestas_aceptadas` | `integer` | sí |  |
| `tasa_aceptacion_pct` | `number` | sí |  |
| `volumen_cotizado_usd` | `number` | sí |  |
| `ordenes_activas` | `integer` | sí |  |
| `ordenes_totales` | `integer` | sí |  |
| `asesores_activos` | `integer` | sí |  |
| `tiempo_promedio_respuesta_horas` | `Optional[number]` | no |  |

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
| `certificaciones` | `array[CertificacionOtorgadaResponse]` | no |  |
| `puntaje_publicidad` | `number` | no |  |
| `proyectos_completados` | `integer` | no |  |
| `especialidad_producto` | `array[string]` | sí |  |
| `paises_origen` | `array[string]` | sí |  |
| `calificacion_promedio` | `number` | sí |  |
| `tiempo_respuesta_promedio` | `string` | sí |  |
| `capacidad_volumen` | `Optional[integer]` | sí |  |
| `perfil_publico` | `Optional[object]` | no |  |
| `estado` | `string` | sí |  |
| `solo_cotizaciones_directas` | `boolean` | no |  |
| `verificado` | `boolean` | no |  |
| `shipping_mark_prefijo` | `Optional[string]` | no |  |
| `tier_minimo_requerido` | `string` | no |  |
| `limite_cotizaciones_diarias` | `Optional[integer]` | no |  |
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
| `perfil_publico` | `Optional[object]` | no |  |
| `solo_cotizaciones_directas` | `Optional[boolean]` | no |  |
| `shipping_mark_prefijo` | `Optional[string]` | no | Prefijo de la empresa en el shipping mark (ej. 'ctl'). Cadena vacía para quitarlo. |
| `tier_minimo_requerido` | `Optional[string]` | no | Tier mínimo del cotizante: Bronze, Silver, Gold o Élite. También se acepta dentro de `perfil_publico` por compatibilidad. |
| `limite_cotizaciones_diarias` | `Optional[integer]` | no | Máximo de cotizaciones (dirigidas + abiertas) a recibir por día. Enviar null para quitar el límite. |

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
| `certificaciones` | `array[CertificacionOtorgadaResponse]` | no |  |
| `puntaje_publicidad` | `number` | no |  |
| `proyectos_completados` | `integer` | no |  |
| `especialidad_producto` | `array[string]` | sí |  |
| `paises_origen` | `array[string]` | sí |  |
| `calificacion_promedio` | `number` | sí |  |
| `tiempo_respuesta_promedio` | `string` | sí |  |
| `capacidad_volumen` | `Optional[integer]` | sí |  |
| `perfil_publico` | `Optional[object]` | no |  |
| `estado` | `string` | sí |  |
| `solo_cotizaciones_directas` | `boolean` | no |  |
| `verificado` | `boolean` | no |  |
| `shipping_mark_prefijo` | `Optional[string]` | no |  |
| `tier_minimo_requerido` | `string` | no |  |
| `limite_cotizaciones_diarias` | `Optional[integer]` | no |  |
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

### `POST /resenas`

- **Resumen:** Crear Resena
- **Auth:** Bearer JWT
- **Códigos:** 201, 422

**Body (`ResenaCreate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `orden_id` | `string` | sí | Orden que da derecho a opinar: solo se reseña lo que se importó |
| `calificacion` | `integer` | sí | Valoración global, de 1 a 5 estrellas |
| `comentario` | `Optional[string]` | no | Qué tal fue la experiencia. Opcional, pero es lo que de verdad le sirve al siguiente cliente. |
| `puntualidad` | `Optional[integer]` | no |  |
| `calidad_producto` | `Optional[integer]` | no |  |
| `comunicacion` | `Optional[integer]` | no |  |

```json
{
  "orden_id": "<orden_id>",
  "calificacion": 0
}
```

**Respuesta (`ResenaResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `orden_id` | `string` | sí |  |
| `calificacion` | `integer` | sí |  |
| `comentario` | `Optional[string]` | no |  |
| `puntualidad` | `Optional[integer]` | no |  |
| `calidad_producto` | `Optional[integer]` | no |  |
| `comunicacion` | `Optional[integer]` | no |  |
| `respuesta_empresa` | `Optional[string]` | no |  |
| `fecha_respuesta` | `Optional[string]` | no |  |
| `visible` | `boolean` | no |  |
| `autor_nombre` | `Optional[string]` | no |  |
| `fecha_creacion` | `string` | sí |  |

---

### `GET /resenas/importador/{importador_id}`

- **Resumen:** Listar Resenas De Importador
- **Auth:** Público
- **Códigos:** 200, 422
- **Path params:** `importador_id`
- **Query:** `limit`, `offset`

**Respuesta (`array[ResenaResponse]`)**

Array de `ResenaResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `orden_id` | `string` | sí |  |
| `calificacion` | `integer` | sí |  |
| `comentario` | `Optional[string]` | no |  |
| `puntualidad` | `Optional[integer]` | no |  |
| `calidad_producto` | `Optional[integer]` | no |  |
| `comunicacion` | `Optional[integer]` | no |  |
| `respuesta_empresa` | `Optional[string]` | no |  |
| `fecha_respuesta` | `Optional[string]` | no |  |
| `visible` | `boolean` | no |  |
| `autor_nombre` | `Optional[string]` | no |  |
| `fecha_creacion` | `string` | sí |  |

---

### `GET /resenas/importador/{importador_id}/resumen`

- **Resumen:** Resumen De Importador
- **Auth:** Público
- **Códigos:** 200, 422
- **Path params:** `importador_id`

**Respuesta (`ResumenResenasResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `promedio` | `number` | no |  |
| `total` | `integer` | no |  |
| `reparto` | `object` | no |  |
| `puntualidad` | `Optional[number]` | no |  |
| `calidad_producto` | `Optional[number]` | no |  |
| `comunicacion` | `Optional[number]` | no |  |

---

### `GET /resenas/mias`

- **Resumen:** Mis Resenas
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`array[ResenaResponse]`)**

Array de `ResenaResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `orden_id` | `string` | sí |  |
| `calificacion` | `integer` | sí |  |
| `comentario` | `Optional[string]` | no |  |
| `puntualidad` | `Optional[integer]` | no |  |
| `calidad_producto` | `Optional[integer]` | no |  |
| `comunicacion` | `Optional[integer]` | no |  |
| `respuesta_empresa` | `Optional[string]` | no |  |
| `fecha_respuesta` | `Optional[string]` | no |  |
| `visible` | `boolean` | no |  |
| `autor_nombre` | `Optional[string]` | no |  |
| `fecha_creacion` | `string` | sí |  |

---

### `GET /resenas/pendientes`

- **Resumen:** Ordenes Pendientes De Resena
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`array[OrdenResenableItem]`)**

Array de `OrdenResenableItem`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `orden_id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `nombre_empresa` | `string` | sí |  |
| `producto` | `string` | sí |  |
| `fecha_creacion` | `string` | sí |  |

---

### `PUT /resenas/{resena_id}`

- **Resumen:** Editar Resena
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `resena_id`

**Body (`ResenaUpdate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `calificacion` | `Optional[integer]` | no |  |
| `comentario` | `Optional[string]` | no |  |
| `puntualidad` | `Optional[integer]` | no |  |
| `calidad_producto` | `Optional[integer]` | no |  |
| `comunicacion` | `Optional[integer]` | no |  |

```json
{
  "calificacion": 0,
  "comentario": "<comentario>",
  "puntualidad": 0,
  "calidad_producto": 0,
  "comunicacion": 0
}
```

**Respuesta (`ResenaResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `orden_id` | `string` | sí |  |
| `calificacion` | `integer` | sí |  |
| `comentario` | `Optional[string]` | no |  |
| `puntualidad` | `Optional[integer]` | no |  |
| `calidad_producto` | `Optional[integer]` | no |  |
| `comunicacion` | `Optional[integer]` | no |  |
| `respuesta_empresa` | `Optional[string]` | no |  |
| `fecha_respuesta` | `Optional[string]` | no |  |
| `visible` | `boolean` | no |  |
| `autor_nombre` | `Optional[string]` | no |  |
| `fecha_creacion` | `string` | sí |  |

---

### `PUT /resenas/{resena_id}/moderar`

- **Resumen:** Moderar Resena
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `resena_id`

**Body (`OcultarResenaRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `visible` | `boolean` | no |  |
| `motivo` | `Optional[string]` | no |  |

```json
{
  "visible": true,
  "motivo": "<motivo>"
}
```

**Respuesta (`ResenaResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `orden_id` | `string` | sí |  |
| `calificacion` | `integer` | sí |  |
| `comentario` | `Optional[string]` | no |  |
| `puntualidad` | `Optional[integer]` | no |  |
| `calidad_producto` | `Optional[integer]` | no |  |
| `comunicacion` | `Optional[integer]` | no |  |
| `respuesta_empresa` | `Optional[string]` | no |  |
| `fecha_respuesta` | `Optional[string]` | no |  |
| `visible` | `boolean` | no |  |
| `autor_nombre` | `Optional[string]` | no |  |
| `fecha_creacion` | `string` | sí |  |

---

### `POST /resenas/{resena_id}/responder`

- **Resumen:** Responder Resena
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `resena_id`

**Body (`RespuestaEmpresaRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `respuesta` | `string` | sí |  |

```json
{
  "respuesta": "<respuesta>"
}
```

**Respuesta (`ResenaResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `orden_id` | `string` | sí |  |
| `calificacion` | `integer` | sí |  |
| `comentario` | `Optional[string]` | no |  |
| `puntualidad` | `Optional[integer]` | no |  |
| `calidad_producto` | `Optional[integer]` | no |  |
| `comunicacion` | `Optional[integer]` | no |  |
| `respuesta_empresa` | `Optional[string]` | no |  |
| `fecha_respuesta` | `Optional[string]` | no |  |
| `visible` | `boolean` | no |  |
| `autor_nombre` | `Optional[string]` | no |  |
| `fecha_creacion` | `string` | sí |  |

---
