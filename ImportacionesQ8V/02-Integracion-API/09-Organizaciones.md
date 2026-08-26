# APIs — Organizaciones solicitantes

> Endpoints REST generados desde OpenAPI (`/openapi.json`). Base URL local: `http://localhost:8000`.
> Lo escrito a mano va en `_preambulos/09-Organizaciones.md`; el resto se sobrescribe.

### `GET /organizaciones/me`

- **Resumen:** Mi Organizacion
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`OrganizacionResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `razon_social` | `string` | sí |  |
| `nit` | `string` | sí |  |
| `creditos_balance` | `number` | sí |  |
| `owner_usuario_id` | `string` | sí |  |
| `activo` | `boolean` | sí |  |

---

### `POST /organizaciones/me/invitar`

- **Resumen:** Invitar Miembro
- **Auth:** Bearer JWT
- **Códigos:** 201, 422

**Body (`InvitarMiembroRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `email` | `string` | sí |  |
| `password` | `string` | sí |  |
| `nombre` | `Optional[string]` | no |  |
| `rol_org` | `string` | no |  |

```json
{
  "email": "user@ejemplo.com",
  "password": "<password>"
}
```

**Respuesta (`MiembroResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `organizacion_id` | `string` | sí |  |
| `usuario_id` | `string` | sí |  |
| `email` | `Optional[string]` | no |  |
| `nombre` | `Optional[string]` | no |  |
| `rol_org` | `string` | sí |  |
| `activo` | `boolean` | sí |  |

---

### `GET /organizaciones/me/miembros`

- **Resumen:** Listar Miembros
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`array[MiembroResponse]`)**

Array de `MiembroResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `organizacion_id` | `string` | sí |  |
| `usuario_id` | `string` | sí |  |
| `email` | `Optional[string]` | no |  |
| `nombre` | `Optional[string]` | no |  |
| `rol_org` | `string` | sí |  |
| `activo` | `boolean` | sí |  |

---

### `PUT /organizaciones/me/miembros/{miembro_id}`

- **Resumen:** Actualizar Miembro
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `miembro_id`

**Body (`ActualizarMiembroRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `rol_org` | `Optional[string]` | no |  |
| `activo` | `Optional[boolean]` | no |  |

```json
{
  "rol_org": "<rol_org>",
  "activo": true
}
```

**Respuesta (`MiembroResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `organizacion_id` | `string` | sí |  |
| `usuario_id` | `string` | sí |  |
| `email` | `Optional[string]` | no |  |
| `nombre` | `Optional[string]` | no |  |
| `rol_org` | `string` | sí |  |
| `activo` | `boolean` | sí |  |

---
