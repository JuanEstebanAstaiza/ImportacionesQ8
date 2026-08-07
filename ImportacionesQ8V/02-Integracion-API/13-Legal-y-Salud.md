# APIs — Legal y salud

> Endpoints REST generados desde OpenAPI (`/openapi.json`). Base URL local: `http://localhost:8000`.
> Lo escrito a mano va en `_preambulos/13-Legal-y-Salud.md`; el resto se sobrescribe.

### `GET /`

- **Resumen:** Root
- **Auth:** Público
- **Códigos:** 200

---

### `GET /configuracion-publica`

- **Resumen:** Configuracion Publica
- **Auth:** Bearer JWT
- **Códigos:** 200

---

### `GET /health`

- **Resumen:** Health Check
- **Auth:** Público
- **Códigos:** 200

---

### `GET /health/ready`

- **Resumen:** Readiness Check
- **Auth:** Público
- **Códigos:** 200

---

### `GET /legal/politica-tratamiento-datos`

- **Resumen:** Politica Tratamiento Datos
- **Auth:** Público
- **Códigos:** 200

---

### `GET /legal/terminos-condiciones`

- **Resumen:** Terminos Condiciones
- **Auth:** Público
- **Códigos:** 200

---
