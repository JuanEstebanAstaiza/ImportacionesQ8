# APIs — Referidos

> Generado desde OpenAPI en vivo (`/openapi.json`). Base URL local: `http://localhost:8000`.

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
