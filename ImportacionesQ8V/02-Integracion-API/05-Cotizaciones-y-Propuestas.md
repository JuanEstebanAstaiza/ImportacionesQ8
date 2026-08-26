# APIs — Cotizaciones y propuestas

> Endpoints REST generados desde OpenAPI (`/openapi.json`). Base URL local: `http://localhost:8000`.
> Lo escrito a mano va en `_preambulos/05-Cotizaciones-y-Propuestas.md`; el resto se sobrescribe.

## Shipping mark (marca de embarque)

Es la etiqueta que va rotulada en las cajas para distinguir la mercancía de un
cliente dentro del contenedor de la empresa importadora. Se compone de dos
partes que viven en sitios distintos:

| Parte | Quién la pone | Dónde | Ejemplo |
|---|---|---|---|
| Prefijo | La empresa importadora | `PUT /importadores/{id}` → `shipping_mark_prefijo` | `ctl` |
| Sufijo | El cliente, al cotizar | `POST /cotizaciones` → `shipping_mark_sufijo` | `prendas control` |

El resultado es **`ctl-prendascontrol`**. Ambas partes se normalizan a `[a-z0-9]`
(sin tildes, sin eñes, sin espacios ni signos) porque la marca acaba impresa o
estarcida sobre cartón y la leen operarios de bodega y agentes de aduana en
varios países.

Dónde aparece cada campo:

- `CotizacionResponse.shipping_mark_sufijo` — lo que escribió el cliente, tal cual
  (`"prendas control"`), para poder mostrárselo de vuelta.
- `CotizacionResponse.shipping_mark` — la marca ya compuesta. Es `null` mientras no
  se sepa qué empresa importará: en modalidad **abierta** no hay prefijo hasta que
  una empresa gana la propuesta.
- `OrdenResponse.shipping_mark` — **copia congelada** en el momento de crear la
  orden. No se recalcula: si la empresa cambia su prefijo más adelante, las cajas
  ya rotuladas y los documentos emitidos tienen que seguir cuadrando.
- `ImportadorResponse.shipping_mark_prefijo` — público a propósito, para que el
  solicitante vea cómo quedará rotulada su carga antes de pedir la cotización.

Ambas partes son opcionales. Si falta cualquiera de las dos, `shipping_mark` es
`null`: media marca (`ctl-`) en un documento de embarque es peor que ninguna.

## Congruencia de categoría

Una empresa solo puede responder cotizaciones de su especialidad
(`Importador.especialidad_producto` frente a `Cotizacion.linea_producto`). La
comparación **no es de cadena exacta**: tolera mayúsculas, tildes, plurales y
variantes léxicas, de modo que `"Químicos"` y `"Química"`, o `"Textiles"` y
`"Textil"`, se consideran la misma categoría (ver `backend/utils/categorias.py`).

Consecuencias para quien integra:

- `POST /cotizaciones` en modalidad **dirigida** devuelve `400` si la empresa
  destino no trabaja esa línea de producto. El aviso llega al cliente al crearla,
  no a la empresa al intentar responderla.
- `GET /cotizaciones` para una cuenta de empresa (`importador` / `asesor`) ya
  filtra las cotizaciones abiertas: solo devuelve las que esa empresa puede
  responder de verdad. Las dirigidas a ella se listan siempre.
- Una empresa **sin especialidades declaradas** no queda bloqueada al responder,
  pero tampoco entra en el reparto automático de cotizaciones abiertas.

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
| `shipping_mark_sufijo` | `Optional[string]` | no |  |
| `shipping_mark` | `Optional[string]` | no |  |
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
| `shipping_mark_sufijo` | `Optional[string]` | no | Tu parte de la marca de embarque (ej. 'prendas control'). Se une al prefijo de la empresa importadora para rotular tus cajas: 'ctl-prenda... |
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
| `shipping_mark_sufijo` | `Optional[string]` | no |  |
| `shipping_mark` | `Optional[string]` | no |  |
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
| `shipping_mark_sufijo` | `Optional[string]` | no |  |
| `shipping_mark` | `Optional[string]` | no |  |
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
| `shipping_mark_sufijo` | `Optional[string]` | no |  |
| `shipping_mark` | `Optional[string]` | no |  |
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
| `shipping_mark_sufijo` | `Optional[string]` | no |  |
| `shipping_mark` | `Optional[string]` | no |  |
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
| `shipping_mark_sufijo` | `Optional[string]` | no |  |
| `shipping_mark` | `Optional[string]` | no |  |
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
