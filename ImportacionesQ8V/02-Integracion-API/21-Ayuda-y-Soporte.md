# APIs — Centro de ayuda

> Endpoints REST generados desde OpenAPI (`/openapi.json`). Base URL local: `http://localhost:8000`.
> Lo escrito a mano va en `_preambulos/21-Ayuda-y-Soporte.md`; el resto se sobrescribe.

### `GET /ayuda/articulos`

- **Resumen:** Listar Articulos
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Query:** `buscar`, `categoria`

**Respuesta (`ArticulosAyudaResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `articulos` | `array[ArticuloAyudaResponse]` | sí |  |
| `categorias` | `array[string]` | sí |  |
| `total` | `integer` | sí |  |

---

### `POST /ayuda/articulos`

- **Resumen:** Crear Articulo
- **Auth:** Bearer JWT
- **Códigos:** 201, 422

**Body (`ArticuloAyudaCreate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `titulo` | `string` | sí |  |
| `resumen` | `string` | sí |  |
| `contenido` | `Optional[string]` | no |  |
| `categoria` | `string` | sí |  |
| `roles` | `Optional[array]` | no |  |
| `orden` | `integer` | no |  |
| `publicado` | `boolean` | no |  |

```json
{
  "titulo": "<titulo>",
  "resumen": "<resumen>",
  "categoria": "<categoria>"
}
```

**Respuesta (`ArticuloAyudaResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `titulo` | `string` | sí |  |
| `resumen` | `string` | sí |  |
| `contenido` | `Optional[string]` | no |  |
| `categoria` | `string` | sí |  |
| `roles` | `Optional[array]` | no |  |
| `orden` | `integer` | no |  |
| `publicado` | `boolean` | no |  |
| `vistas` | `integer` | no |  |
| `votos_util` | `integer` | no |  |
| `votos_inutil` | `integer` | no |  |
| `fecha_actualizacion` | `Optional[string]` | no |  |

---

### `DELETE /ayuda/articulos/{articulo_id}`

- **Resumen:** Despublicar Articulo
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `articulo_id`

**Respuesta (`ArticuloAyudaResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `titulo` | `string` | sí |  |
| `resumen` | `string` | sí |  |
| `contenido` | `Optional[string]` | no |  |
| `categoria` | `string` | sí |  |
| `roles` | `Optional[array]` | no |  |
| `orden` | `integer` | no |  |
| `publicado` | `boolean` | no |  |
| `vistas` | `integer` | no |  |
| `votos_util` | `integer` | no |  |
| `votos_inutil` | `integer` | no |  |
| `fecha_actualizacion` | `Optional[string]` | no |  |

---

### `PUT /ayuda/articulos/{articulo_id}`

- **Resumen:** Editar Articulo
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `articulo_id`

**Body (`ArticuloAyudaUpdate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `titulo` | `Optional[string]` | no |  |
| `resumen` | `Optional[string]` | no |  |
| `contenido` | `Optional[string]` | no |  |
| `categoria` | `Optional[string]` | no |  |
| `roles` | `Optional[array]` | no |  |
| `orden` | `Optional[integer]` | no |  |
| `publicado` | `Optional[boolean]` | no |  |

```json
{
  "titulo": "<titulo>",
  "resumen": "<resumen>",
  "contenido": "<contenido>",
  "categoria": "<categoria>",
  "roles": null,
  "orden": 0
}
```

**Respuesta (`ArticuloAyudaResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `titulo` | `string` | sí |  |
| `resumen` | `string` | sí |  |
| `contenido` | `Optional[string]` | no |  |
| `categoria` | `string` | sí |  |
| `roles` | `Optional[array]` | no |  |
| `orden` | `integer` | no |  |
| `publicado` | `boolean` | no |  |
| `vistas` | `integer` | no |  |
| `votos_util` | `integer` | no |  |
| `votos_inutil` | `integer` | no |  |
| `fecha_actualizacion` | `Optional[string]` | no |  |

---

### `POST /ayuda/articulos/{articulo_id}/visto`

- **Resumen:** Marcar Visto
- **Auth:** Bearer JWT
- **Códigos:** 204, 422
- **Path params:** `articulo_id`

---

### `POST /ayuda/articulos/{articulo_id}/voto`

- **Resumen:** Votar Articulo
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `articulo_id`

**Body (`VotoArticuloRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `util` | `boolean` | sí |  |

```json
{
  "util": true
}
```

**Respuesta (`ArticuloAyudaResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `titulo` | `string` | sí |  |
| `resumen` | `string` | sí |  |
| `contenido` | `Optional[string]` | no |  |
| `categoria` | `string` | sí |  |
| `roles` | `Optional[array]` | no |  |
| `orden` | `integer` | no |  |
| `publicado` | `boolean` | no |  |
| `vistas` | `integer` | no |  |
| `votos_util` | `integer` | no |  |
| `votos_inutil` | `integer` | no |  |
| `fecha_actualizacion` | `Optional[string]` | no |  |

---

### `GET /ayuda/categorias`

- **Resumen:** Listar Categorias
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`array`)**

_Sin campos detallados en OpenAPI._

---
