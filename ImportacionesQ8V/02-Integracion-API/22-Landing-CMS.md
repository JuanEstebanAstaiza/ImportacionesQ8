# APIs — Landing (CMS por bloques)

> Endpoints REST generados desde OpenAPI (`/openapi.json`). Base URL local: `http://localhost:8000`.
> Lo escrito a mano va en `_preambulos/22-Landing-CMS.md`; el resto se sobrescribe.

### `GET /landing/allies`

- **Resumen:** Listar Aliados
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`array[LandingAllyResponse]`)**

Array de `LandingAllyResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `nombre` | `string` | sí |  |
| `logo_url` | `Optional[string]` | no |  |
| `categoria` | `Optional[string]` | no |  |
| `enlace` | `Optional[string]` | no |  |
| `orden` | `integer` | no |  |
| `activo` | `boolean` | no |  |

---

### `POST /landing/allies`

- **Resumen:** Crear Aliado
- **Auth:** Bearer JWT
- **Códigos:** 201, 422

**Body (`LandingAllyCreate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `nombre` | `string` | sí |  |
| `logo_url` | `Optional[string]` | no |  |
| `categoria` | `Optional[string]` | no |  |
| `enlace` | `Optional[string]` | no |  |
| `orden` | `integer` | no |  |
| `activo` | `boolean` | no |  |

```json
{
  "nombre": "<nombre>"
}
```

**Respuesta (`LandingAllyResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `nombre` | `string` | sí |  |
| `logo_url` | `Optional[string]` | no |  |
| `categoria` | `Optional[string]` | no |  |
| `enlace` | `Optional[string]` | no |  |
| `orden` | `integer` | no |  |
| `activo` | `boolean` | no |  |

---

### `DELETE /landing/allies/{aliado_id}`

- **Resumen:** Eliminar Aliado
- **Auth:** Bearer JWT
- **Códigos:** 204, 422
- **Path params:** `aliado_id`

---

### `PUT /landing/allies/{aliado_id}`

- **Resumen:** Editar Aliado
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `aliado_id`

**Body (`LandingAllyUpdate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `nombre` | `Optional[string]` | no |  |
| `logo_url` | `Optional[string]` | no |  |
| `categoria` | `Optional[string]` | no |  |
| `enlace` | `Optional[string]` | no |  |
| `orden` | `Optional[integer]` | no |  |
| `activo` | `Optional[boolean]` | no |  |

```json
{
  "nombre": "<nombre>",
  "logo_url": "<logo_url>",
  "categoria": "<categoria>",
  "enlace": "<enlace>",
  "orden": 0,
  "activo": true
}
```

**Respuesta (`LandingAllyResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `nombre` | `string` | sí |  |
| `logo_url` | `Optional[string]` | no |  |
| `categoria` | `Optional[string]` | no |  |
| `enlace` | `Optional[string]` | no |  |
| `orden` | `integer` | no |  |
| `activo` | `boolean` | no |  |

---

### `POST /landing/contacto`

- **Resumen:** Enviar Contacto
- **Auth:** Público
- **Códigos:** 200, 422

**Body (`ContactoRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `nombre` | `string` | sí |  |
| `email` | `string` | sí |  |
| `telefono` | `Optional[string]` | no |  |
| `perfil` | `string` | no |  |
| `mensaje` | `string` | sí |  |

```json
{
  "nombre": "<nombre>",
  "email": "user@ejemplo.com",
  "mensaje": "<mensaje>"
}
```

**Respuesta (`ContactoResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `enviado` | `boolean` | sí |  |
| `mensaje` | `string` | sí |  |

---

### `GET /landing/dynamic-content`

- **Resumen:** Obtener Contenido Dinamico
- **Auth:** Público
- **Códigos:** 200

**Respuesta (`LandingDynamicContentResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `blocks` | `array[LandingBlockResponse]` | sí |  |
| `allies` | `array[LandingAllyResponse]` | sí |  |
| `news` | `array[LandingNewsResponse]` | sí |  |

---

### `PUT /landing/dynamic-content`

- **Resumen:** Guardar Bloques
- **Auth:** Bearer JWT
- **Códigos:** 200, 422

**Body (`LandingBlocksSaveRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `blocks` | `array[LandingBlockUpsert]` | no |  |

```json
{
  "blocks": null
}
```

**Respuesta (`array[LandingBlockResponse]`)**

Array de `LandingBlockResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `seccion` | `string` | sí |  |
| `tipo` | `string` | sí |  |
| `contenido` | `Optional[string]` | no |  |
| `alineacion` | `string` | no |  |
| `tamano_fuente` | `string` | no |  |
| `accion_boton` | `Optional[string]` | no |  |
| `accion_url` | `Optional[string]` | no |  |
| `token_color` | `string` | no |  |
| `fuente` | `string` | no |  |
| `orden` | `integer` | no |  |
| `activo` | `boolean` | no |  |

---

### `GET /landing/dynamic-content/admin`

- **Resumen:** Obtener Contenido Dinamico Admin
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`LandingDynamicContentResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `blocks` | `array[LandingBlockResponse]` | sí |  |
| `allies` | `array[LandingAllyResponse]` | sí |  |
| `news` | `array[LandingNewsResponse]` | sí |  |

---

### `GET /landing/news`

- **Resumen:** Listar Noticias
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`array[LandingNewsResponse]`)**

Array de `LandingNewsResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `titulo` | `string` | sí |  |
| `resumen` | `string` | sí |  |
| `contenido` | `Optional[string]` | no |  |
| `imagen_url` | `Optional[string]` | no |  |
| `fecha_publicacion` | `Optional[string]` | no |  |
| `orden` | `integer` | no |  |
| `activo` | `boolean` | no |  |

---

### `POST /landing/news`

- **Resumen:** Crear Noticia
- **Auth:** Bearer JWT
- **Códigos:** 201, 422

**Body (`LandingNewsCreate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `titulo` | `string` | sí |  |
| `resumen` | `string` | sí |  |
| `contenido` | `Optional[string]` | no |  |
| `imagen_url` | `Optional[string]` | no |  |
| `orden` | `integer` | no |  |
| `activo` | `boolean` | no |  |

```json
{
  "titulo": "<titulo>",
  "resumen": "<resumen>"
}
```

**Respuesta (`LandingNewsResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `titulo` | `string` | sí |  |
| `resumen` | `string` | sí |  |
| `contenido` | `Optional[string]` | no |  |
| `imagen_url` | `Optional[string]` | no |  |
| `fecha_publicacion` | `Optional[string]` | no |  |
| `orden` | `integer` | no |  |
| `activo` | `boolean` | no |  |

---

### `DELETE /landing/news/{noticia_id}`

- **Resumen:** Eliminar Noticia
- **Auth:** Bearer JWT
- **Códigos:** 204, 422
- **Path params:** `noticia_id`

---

### `PUT /landing/news/{noticia_id}`

- **Resumen:** Editar Noticia
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `noticia_id`

**Body (`LandingNewsUpdate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `titulo` | `Optional[string]` | no |  |
| `resumen` | `Optional[string]` | no |  |
| `contenido` | `Optional[string]` | no |  |
| `imagen_url` | `Optional[string]` | no |  |
| `orden` | `Optional[integer]` | no |  |
| `activo` | `Optional[boolean]` | no |  |

```json
{
  "titulo": "<titulo>",
  "resumen": "<resumen>",
  "contenido": "<contenido>",
  "imagen_url": "<imagen_url>",
  "orden": 0,
  "activo": true
}
```

**Respuesta (`LandingNewsResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `titulo` | `string` | sí |  |
| `resumen` | `string` | sí |  |
| `contenido` | `Optional[string]` | no |  |
| `imagen_url` | `Optional[string]` | no |  |
| `fecha_publicacion` | `Optional[string]` | no |  |
| `orden` | `integer` | no |  |
| `activo` | `boolean` | no |  |

---
