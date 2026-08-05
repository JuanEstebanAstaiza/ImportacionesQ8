# APIs — Cotizaciones y propuestas

> Endpoints REST generados desde OpenAPI (`/openapi.json`). Base URL local: `http://localhost:8000`.
> Lo escrito a mano va en `_preambulos/05-Cotizaciones-y-Propuestas.md`; el resto se sobrescribe.

### `GET /cotizaciones`

- **Resumen:** Listar Cotizaciones
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`array[CotizacionResponse]`)**

Array de `CotizacionResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `solicitante_id` | `string` | sí |  |
| `importador_id` | `Optional[string]` | sí |  |
| `modalidad` | `string` | sí |  |
| `foto_producto` | `Optional[string]` | sí |  |
| `pais_importacion` | `string` | sí |  |
| `nivel_personalizacion` | `Optional[string]` | sí |  |
| `nombre_producto` | `string` | sí |  |
| `descripcion_cliente` | `string` | sí |  |
| `link_referencia` | `Optional[string]` | sí |  |
| `linea_producto` | `string` | sí |  |
| `tipo_calidad` | `string` | sí |  |
| `modalidad_importacion` | `Optional[string]` | sí |  |
| `cantidad_minima` | `integer` | sí |  |
| `precio_objetivo_usd` | `Optional[number]` | sí |  |
| `incoterm` | `string` | sí |  |
| `notas_adicionales` | `Optional[string]` | sí |  |
| `campos_personalizados_valores` | `Optional[object]` | no |  |
| `asesor_asignado_id` | `Optional[string]` | no |  |
| `estado` | `string` | sí |  |
| `costo_creditos` | `Optional[number]` | no |  |
| `cotizacion_origen_id` | `Optional[string]` | no |  |
| `cancelada_por_error` | `Optional[string]` | no |  |
| `motivo_cancelacion` | `Optional[string]` | no |  |
| `conversacion_id` | `Optional[string]` | no |  |
| `contacto_asignado` | `Optional[ContactoAsignadoResponse]` | no |  |
| `fecha_creacion` | `string` | sí |  |
| `fecha_actualizacion` | `string` | sí |  |

---

### `POST /cotizaciones`

- **Resumen:** Crear Cotizacion
- **Auth:** Bearer JWT
- **Códigos:** 201, 422

**Body (`CotizacionCreate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `modalidad` | `string` | sí | Modalidad de cotización: 'dirigida' o 'abierta' |
| `importador_id` | `Optional[string]` | no |  |
| `foto_producto` | `Optional[string]` | no |  |
| `pais_importacion` | `string` | sí | País desde donde se importa |
| `nivel_personalizacion` | `Optional[string]` | no |  |
| `nombre_producto` | `string` | sí | Nombre del producto a importar |
| `descripcion_cliente` | `string` | sí | Descripción detallada del producto |
| `link_referencia` | `Optional[string]` | no |  |
| `linea_producto` | `string` | sí | Categoría/línea del producto |
| `tipo_calidad` | `string` | sí | Tipo de calidad: 'economica', 'estandar' o 'premium' |
| `modalidad_importacion` | `Optional[string]` | no |  |
| `cantidad_minima` | `integer` | sí | Cantidad mínima a importar |
| `precio_objetivo_usd` | `Optional[number]` | no |  |
| `incoterm` | `string` | sí | Incoterm acordado (FOB, CIF, etc.) |
| `notas_adicionales` | `Optional[string]` | no |  |
| `campos_personalizados_valores` | `Optional[object]` | no | Valores de los campos personalizados del importador dirigido, si aplica: {campo_id: valor} |

```json
{
  "modalidad": "abierta",
  "pais_importacion": "China",
  "nombre_producto": "Botellas PET 500ml",
  "descripcion_cliente": "Botellas transparentes con tapa rosca, uso alimentario.",
  "linea_producto": "Empaques",
  "tipo_calidad": "estandar",
  "cantidad_minima": 5000,
  "precio_objetivo_usd": 0.12,
  "incoterm": "FOB",
  "notas_adicionales": "Preferencia de puerto Shanghai"
}
```

**Respuesta (`CotizacionResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `solicitante_id` | `string` | sí |  |
| `importador_id` | `Optional[string]` | sí |  |
| `modalidad` | `string` | sí |  |
| `foto_producto` | `Optional[string]` | sí |  |
| `pais_importacion` | `string` | sí |  |
| `nivel_personalizacion` | `Optional[string]` | sí |  |
| `nombre_producto` | `string` | sí |  |
| `descripcion_cliente` | `string` | sí |  |
| `link_referencia` | `Optional[string]` | sí |  |
| `linea_producto` | `string` | sí |  |
| `tipo_calidad` | `string` | sí |  |
| `modalidad_importacion` | `Optional[string]` | sí |  |
| `cantidad_minima` | `integer` | sí |  |
| `precio_objetivo_usd` | `Optional[number]` | sí |  |
| `incoterm` | `string` | sí |  |
| `notas_adicionales` | `Optional[string]` | sí |  |
| `campos_personalizados_valores` | `Optional[object]` | no |  |
| `asesor_asignado_id` | `Optional[string]` | no |  |
| `estado` | `string` | sí |  |
| `costo_creditos` | `Optional[number]` | no |  |
| `cotizacion_origen_id` | `Optional[string]` | no |  |
| `cancelada_por_error` | `Optional[string]` | no |  |
| `motivo_cancelacion` | `Optional[string]` | no |  |
| `conversacion_id` | `Optional[string]` | no |  |
| `contacto_asignado` | `Optional[ContactoAsignadoResponse]` | no |  |
| `fecha_creacion` | `string` | sí |  |
| `fecha_actualizacion` | `string` | sí |  |

---

### `GET /cotizaciones/pool-empresa`

- **Resumen:** Listar Pool Empresa
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`array[CotizacionResponse]`)**

Array de `CotizacionResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `solicitante_id` | `string` | sí |  |
| `importador_id` | `Optional[string]` | sí |  |
| `modalidad` | `string` | sí |  |
| `foto_producto` | `Optional[string]` | sí |  |
| `pais_importacion` | `string` | sí |  |
| `nivel_personalizacion` | `Optional[string]` | sí |  |
| `nombre_producto` | `string` | sí |  |
| `descripcion_cliente` | `string` | sí |  |
| `link_referencia` | `Optional[string]` | sí |  |
| `linea_producto` | `string` | sí |  |
| `tipo_calidad` | `string` | sí |  |
| `modalidad_importacion` | `Optional[string]` | sí |  |
| `cantidad_minima` | `integer` | sí |  |
| `precio_objetivo_usd` | `Optional[number]` | sí |  |
| `incoterm` | `string` | sí |  |
| `notas_adicionales` | `Optional[string]` | sí |  |
| `campos_personalizados_valores` | `Optional[object]` | no |  |
| `asesor_asignado_id` | `Optional[string]` | no |  |
| `estado` | `string` | sí |  |
| `costo_creditos` | `Optional[number]` | no |  |
| `cotizacion_origen_id` | `Optional[string]` | no |  |
| `cancelada_por_error` | `Optional[string]` | no |  |
| `motivo_cancelacion` | `Optional[string]` | no |  |
| `conversacion_id` | `Optional[string]` | no |  |
| `contacto_asignado` | `Optional[ContactoAsignadoResponse]` | no |  |
| `fecha_creacion` | `string` | sí |  |
| `fecha_actualizacion` | `string` | sí |  |

---

### `GET /cotizaciones/{cotizacion_id}`

- **Resumen:** Obtener Cotizacion
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `cotizacion_id`

**Respuesta (`CotizacionResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `solicitante_id` | `string` | sí |  |
| `importador_id` | `Optional[string]` | sí |  |
| `modalidad` | `string` | sí |  |
| `foto_producto` | `Optional[string]` | sí |  |
| `pais_importacion` | `string` | sí |  |
| `nivel_personalizacion` | `Optional[string]` | sí |  |
| `nombre_producto` | `string` | sí |  |
| `descripcion_cliente` | `string` | sí |  |
| `link_referencia` | `Optional[string]` | sí |  |
| `linea_producto` | `string` | sí |  |
| `tipo_calidad` | `string` | sí |  |
| `modalidad_importacion` | `Optional[string]` | sí |  |
| `cantidad_minima` | `integer` | sí |  |
| `precio_objetivo_usd` | `Optional[number]` | sí |  |
| `incoterm` | `string` | sí |  |
| `notas_adicionales` | `Optional[string]` | sí |  |
| `campos_personalizados_valores` | `Optional[object]` | no |  |
| `asesor_asignado_id` | `Optional[string]` | no |  |
| `estado` | `string` | sí |  |
| `costo_creditos` | `Optional[number]` | no |  |
| `cotizacion_origen_id` | `Optional[string]` | no |  |
| `cancelada_por_error` | `Optional[string]` | no |  |
| `motivo_cancelacion` | `Optional[string]` | no |  |
| `conversacion_id` | `Optional[string]` | no |  |
| `contacto_asignado` | `Optional[ContactoAsignadoResponse]` | no |  |
| `fecha_creacion` | `string` | sí |  |
| `fecha_actualizacion` | `string` | sí |  |

---

### `GET /cotizaciones/{cotizacion_id}/matching-status`

- **Resumen:** Obtener Estado Matching
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `cotizacion_id`

**Respuesta (`MatchingStatusResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `total_matching` | `integer` | sí |  |
| `respondidos` | `integer` | sí |  |
| `pendientes` | `integer` | sí |  |
| `importadores_pendientes` | `array[ImportadorPendienteResponse]` | sí |  |

---

### `GET /cotizaciones/{cotizacion_id}/propuestas`

- **Resumen:** Listar Propuestas
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `cotizacion_id`

**Respuesta (`array[PropuestaResponse]`)**

Array de `PropuestaResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `cotizacion_id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `precio_ofrecido_usd` | `number` | sí |  |
| `tiempo_estimado_entrega` | `string` | sí |  |
| `incoterm` | `string` | sí |  |
| `condiciones_adicionales` | `Optional[string]` | sí |  |
| `estado` | `string` | sí |  |
| `creado_por_usuario_id` | `Optional[string]` | no |  |
| `preaceptada_por_solicitante` | `boolean` | no |  |
| `preaceptada_por_empresa` | `boolean` | no |  |
| `contacto_asesor` | `Optional[ContactoAsignadoResponse]` | no |  |

---

### `PUT /cotizaciones/{cotizacion_id}/propuestas/aceptar`

- **Resumen:** Aceptar Propuesta
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `cotizacion_id`

**Body (`PropuestaAceptadaRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `importador_id` | `string` | sí |  |

```json
{
  "importador_id": "<importador_id>"
}
```

**Respuesta (`CotizacionResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `solicitante_id` | `string` | sí |  |
| `importador_id` | `Optional[string]` | sí |  |
| `modalidad` | `string` | sí |  |
| `foto_producto` | `Optional[string]` | sí |  |
| `pais_importacion` | `string` | sí |  |
| `nivel_personalizacion` | `Optional[string]` | sí |  |
| `nombre_producto` | `string` | sí |  |
| `descripcion_cliente` | `string` | sí |  |
| `link_referencia` | `Optional[string]` | sí |  |
| `linea_producto` | `string` | sí |  |
| `tipo_calidad` | `string` | sí |  |
| `modalidad_importacion` | `Optional[string]` | sí |  |
| `cantidad_minima` | `integer` | sí |  |
| `precio_objetivo_usd` | `Optional[number]` | sí |  |
| `incoterm` | `string` | sí |  |
| `notas_adicionales` | `Optional[string]` | sí |  |
| `campos_personalizados_valores` | `Optional[object]` | no |  |
| `asesor_asignado_id` | `Optional[string]` | no |  |
| `estado` | `string` | sí |  |
| `costo_creditos` | `Optional[number]` | no |  |
| `cotizacion_origen_id` | `Optional[string]` | no |  |
| `cancelada_por_error` | `Optional[string]` | no |  |
| `motivo_cancelacion` | `Optional[string]` | no |  |
| `conversacion_id` | `Optional[string]` | no |  |
| `contacto_asignado` | `Optional[ContactoAsignadoResponse]` | no |  |
| `fecha_creacion` | `string` | sí |  |
| `fecha_actualizacion` | `string` | sí |  |

---

### `POST /cotizaciones/{cotizacion_id}/reclamar`

- **Resumen:** Reclamar Cotizacion
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `cotizacion_id`

**Respuesta (`CotizacionResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `solicitante_id` | `string` | sí |  |
| `importador_id` | `Optional[string]` | sí |  |
| `modalidad` | `string` | sí |  |
| `foto_producto` | `Optional[string]` | sí |  |
| `pais_importacion` | `string` | sí |  |
| `nivel_personalizacion` | `Optional[string]` | sí |  |
| `nombre_producto` | `string` | sí |  |
| `descripcion_cliente` | `string` | sí |  |
| `link_referencia` | `Optional[string]` | sí |  |
| `linea_producto` | `string` | sí |  |
| `tipo_calidad` | `string` | sí |  |
| `modalidad_importacion` | `Optional[string]` | sí |  |
| `cantidad_minima` | `integer` | sí |  |
| `precio_objetivo_usd` | `Optional[number]` | sí |  |
| `incoterm` | `string` | sí |  |
| `notas_adicionales` | `Optional[string]` | sí |  |
| `campos_personalizados_valores` | `Optional[object]` | no |  |
| `asesor_asignado_id` | `Optional[string]` | no |  |
| `estado` | `string` | sí |  |
| `costo_creditos` | `Optional[number]` | no |  |
| `cotizacion_origen_id` | `Optional[string]` | no |  |
| `cancelada_por_error` | `Optional[string]` | no |  |
| `motivo_cancelacion` | `Optional[string]` | no |  |
| `conversacion_id` | `Optional[string]` | no |  |
| `contacto_asignado` | `Optional[ContactoAsignadoResponse]` | no |  |
| `fecha_creacion` | `string` | sí |  |
| `fecha_actualizacion` | `string` | sí |  |

---

### `POST /cotizaciones/{cotizacion_id}/solicitar-recreacion`

- **Resumen:** Solicitar Recreacion
- **Auth:** Bearer JWT
- **Códigos:** 201, 422
- **Path params:** `cotizacion_id`

**Body (`SolicitarRecreacionRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `motivo` | `string` | sí | Explicación de qué salió mal en la negociación |
| `parte_atribuida_sugerida` | `string` | sí |  |

```json
{
  "motivo": "<motivo>",
  "parte_atribuida_sugerida": "<parte_atribuida_sugerida>"
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

### `POST /propuestas`

- **Resumen:** Enviar Propuesta
- **Auth:** Bearer JWT
- **Códigos:** 201, 422

**Body (`PropuestaCreate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `cotizacion_id` | `string` | sí |  |
| `precio_ofrecido_usd` | `number` | sí | Precio ofrecido por el importador |
| `tiempo_estimado_entrega` | `string` | sí | Tiempo estimado (ej: '45 días') |
| `incoterm` | `string` | sí | Incoterm propuesto (FOB, CIF, EXW, DDP, etc.) |
| `condiciones_adicionales` | `Optional[string]` | no |  |

```json
{
  "cotizacion_id": "<uuid-cotizacion>",
  "precio_ofrecido_usd": 0.11,
  "tiempo_estimado_entrega": "35-45 días",
  "incoterm": "FOB",
  "condiciones_adicionales": "Incluye inspección pre-embarque"
}
```

**Respuesta (`PropuestaResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `cotizacion_id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `precio_ofrecido_usd` | `number` | sí |  |
| `tiempo_estimado_entrega` | `string` | sí |  |
| `incoterm` | `string` | sí |  |
| `condiciones_adicionales` | `Optional[string]` | sí |  |
| `estado` | `string` | sí |  |
| `creado_por_usuario_id` | `Optional[string]` | no |  |
| `preaceptada_por_solicitante` | `boolean` | no |  |
| `preaceptada_por_empresa` | `boolean` | no |  |
| `contacto_asesor` | `Optional[ContactoAsignadoResponse]` | no |  |

---

### `POST /propuestas/borrador`

- **Resumen:** Crear Borrador Propuesta
- **Auth:** Bearer JWT
- **Códigos:** 201, 422

**Body (`PropuestaCreate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `cotizacion_id` | `string` | sí |  |
| `precio_ofrecido_usd` | `number` | sí | Precio ofrecido por el importador |
| `tiempo_estimado_entrega` | `string` | sí | Tiempo estimado (ej: '45 días') |
| `incoterm` | `string` | sí | Incoterm propuesto (FOB, CIF, EXW, DDP, etc.) |
| `condiciones_adicionales` | `Optional[string]` | no |  |

```json
{
  "cotizacion_id": "<uuid-cotizacion>",
  "precio_ofrecido_usd": 0.11,
  "tiempo_estimado_entrega": "35-45 días",
  "incoterm": "FOB",
  "condiciones_adicionales": "Incluye inspección pre-embarque"
}
```

**Respuesta (`PropuestaResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `cotizacion_id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `precio_ofrecido_usd` | `number` | sí |  |
| `tiempo_estimado_entrega` | `string` | sí |  |
| `incoterm` | `string` | sí |  |
| `condiciones_adicionales` | `Optional[string]` | sí |  |
| `estado` | `string` | sí |  |
| `creado_por_usuario_id` | `Optional[string]` | no |  |
| `preaceptada_por_solicitante` | `boolean` | no |  |
| `preaceptada_por_empresa` | `boolean` | no |  |
| `contacto_asesor` | `Optional[ContactoAsignadoResponse]` | no |  |

---

### `PUT /propuestas/{propuesta_id}`

- **Resumen:** Editar Propuesta
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `propuesta_id`

**Body (`PropuestaCreate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `cotizacion_id` | `string` | sí |  |
| `precio_ofrecido_usd` | `number` | sí | Precio ofrecido por el importador |
| `tiempo_estimado_entrega` | `string` | sí | Tiempo estimado (ej: '45 días') |
| `incoterm` | `string` | sí | Incoterm propuesto (FOB, CIF, EXW, DDP, etc.) |
| `condiciones_adicionales` | `Optional[string]` | no |  |

```json
{
  "cotizacion_id": "<uuid-cotizacion>",
  "precio_ofrecido_usd": 0.11,
  "tiempo_estimado_entrega": "35-45 días",
  "incoterm": "FOB",
  "condiciones_adicionales": "Incluye inspección pre-embarque"
}
```

**Respuesta (`PropuestaResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `cotizacion_id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `precio_ofrecido_usd` | `number` | sí |  |
| `tiempo_estimado_entrega` | `string` | sí |  |
| `incoterm` | `string` | sí |  |
| `condiciones_adicionales` | `Optional[string]` | sí |  |
| `estado` | `string` | sí |  |
| `creado_por_usuario_id` | `Optional[string]` | no |  |
| `preaceptada_por_solicitante` | `boolean` | no |  |
| `preaceptada_por_empresa` | `boolean` | no |  |
| `contacto_asesor` | `Optional[ContactoAsignadoResponse]` | no |  |

---

### `POST /propuestas/{propuesta_id}/enviar`

- **Resumen:** Enviar Borrador Propuesta
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `propuesta_id`

**Respuesta (`PropuestaResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `cotizacion_id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `precio_ofrecido_usd` | `number` | sí |  |
| `tiempo_estimado_entrega` | `string` | sí |  |
| `incoterm` | `string` | sí |  |
| `condiciones_adicionales` | `Optional[string]` | sí |  |
| `estado` | `string` | sí |  |
| `creado_por_usuario_id` | `Optional[string]` | no |  |
| `preaceptada_por_solicitante` | `boolean` | no |  |
| `preaceptada_por_empresa` | `boolean` | no |  |
| `contacto_asesor` | `Optional[ContactoAsignadoResponse]` | no |  |

---

### `POST /propuestas/{propuesta_id}/pre-aceptar`

- **Resumen:** Pre Aceptar Propuesta
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `propuesta_id`

**Body (`PreaceptarPropuestaRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `aceptar` | `boolean` | no |  |

```json
{
  "aceptar": true
}
```

**Respuesta (`PropuestaResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `cotizacion_id` | `string` | sí |  |
| `importador_id` | `string` | sí |  |
| `precio_ofrecido_usd` | `number` | sí |  |
| `tiempo_estimado_entrega` | `string` | sí |  |
| `incoterm` | `string` | sí |  |
| `condiciones_adicionales` | `Optional[string]` | sí |  |
| `estado` | `string` | sí |  |
| `creado_por_usuario_id` | `Optional[string]` | no |  |
| `preaceptada_por_solicitante` | `boolean` | no |  |
| `preaceptada_por_empresa` | `boolean` | no |  |
| `contacto_asesor` | `Optional[ContactoAsignadoResponse]` | no |  |

---
