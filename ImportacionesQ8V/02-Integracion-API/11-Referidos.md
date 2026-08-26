# APIs — Referidos

> Endpoints REST generados desde OpenAPI (`/openapi.json`). Base URL local: `http://localhost:8000`.
> Lo escrito a mano va en `_preambulos/11-Referidos.md`; el resto se sobrescribe.

### `GET /referidos/estadisticas`

- **Resumen:** Estadisticas
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`EstadisticasReferidoResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `codigo` | `string` | sí |  |
| `usos` | `integer` | sí |  |
| `creditos_ganados` | `number` | sí |  |

---

### `GET /referidos/mi-codigo`

- **Resumen:** Mi Codigo
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`CodigoReferidoResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `codigo` | `string` | sí |  |
| `activo` | `boolean` | sí |  |

---
