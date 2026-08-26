# APIs — Usuarios, asesores y perfil

> Endpoints REST generados desde OpenAPI (`/openapi.json`). Base URL local: `http://localhost:8000`.
> Lo escrito a mano va en `_preambulos/03-Usuarios-Asesores-y-Perfil.md`; el resto se sobrescribe.

### `GET /asesores/dashboard/stats`

- **Resumen:** Dashboard Stats Asesor
- **Auth:** Bearer JWT
- **Códigos:** 200

---

### `GET /asesores/me/cotizaciones`

- **Resumen:** Listar Mis Cotizaciones Asignadas
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`array[CotizacionAsignadaItem]`)**

Array de `CotizacionAsignadaItem`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `solicitante_id` | `string` | sí |  |
| `modalidad` | `string` | sí |  |
| `nombre_producto` | `string` | sí |  |
| `descripcion_cliente` | `string` | sí |  |
| `cantidad_minima` | `integer` | sí |  |
| `precio_objetivo_usd` | `Optional[number]` | no |  |
| `incoterm` | `string` | sí |  |
| `estado` | `string` | sí |  |
| `fecha_creacion` | `string` | sí |  |
| `asesor_asignado_id` | `Optional[string]` | no |  |

---

### `GET /usuarios/me`

- **Resumen:** Obtener Mi Perfil
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`UsuarioMeResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `email` | `string` | sí |  |
| `rol` | `string` | sí |  |
| `importador_id` | `Optional[string]` | no |  |
| `nombre` | `Optional[string]` | no |  |
| `telefono` | `Optional[string]` | no |  |
| `foto_url` | `Optional[string]` | no |  |
| `whatsapp` | `Optional[string]` | no |  |
| `activo` | `boolean` | sí |  |
| `perfil_completo` | `boolean` | sí |  |
| `fecha_creacion` | `string` | sí |  |

---

### `PUT /usuarios/me`

- **Resumen:** Actualizar Mi Perfil
- **Auth:** Bearer JWT
- **Códigos:** 200, 422

**Body (`UsuarioMeUpdate`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `nombre` | `Optional[string]` | no |  |
| `telefono` | `Optional[string]` | no |  |
| `foto_url` | `Optional[string]` | no |  |
| `whatsapp` | `Optional[string]` | no |  |

```json
{
  "nombre": "<nombre>",
  "telefono": "<telefono>",
  "foto_url": "<foto_url>",
  "whatsapp": "<whatsapp>"
}
```

**Respuesta (`UsuarioMeResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `email` | `string` | sí |  |
| `rol` | `string` | sí |  |
| `importador_id` | `Optional[string]` | no |  |
| `nombre` | `Optional[string]` | no |  |
| `telefono` | `Optional[string]` | no |  |
| `foto_url` | `Optional[string]` | no |  |
| `whatsapp` | `Optional[string]` | no |  |
| `activo` | `boolean` | sí |  |
| `perfil_completo` | `boolean` | sí |  |
| `fecha_creacion` | `string` | sí |  |

---
