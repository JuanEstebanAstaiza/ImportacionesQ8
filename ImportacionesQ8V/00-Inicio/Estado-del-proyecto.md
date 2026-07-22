# Estado del proyecto

Resumen ejecutivo del avance. Para el detalle de cada semana, ver [[Indice-Historial]].

**Última actualización de este resumen:** 2026-07-14 (post OWASP + docs de integración API).

---

## Tabla de fases

| Fase | Backend | Frontend | Notas |
|------|---------|----------|-------|
| Semana 1 — Fundaciones y cotizaciones | ✅ | ⬜ | [[Tareas-Semana-1]] |
| Semana 2 — Red y órdenes | ✅ | ⬜ | [[Tareas-Semana-2]] |
| Semana 3 — Chat y panel admin | ✅ | ⬜ | [[Tareas-Semana-3]] |
| Semana 4 — Asesores, créditos, registro | ✅ | ⬜ | [[Tareas-Semana-4]] |
| Auditoría + carga 1000 users | ✅ | — | [[Indice-Calidad]] |
| OWASP Top 10 (score ~92) | ✅ | — | [[OWASP-Top10-Backend-2026-07-14]] |
| Integración API documentada | ✅ docs | ⬜ código UI | [[Indice-Integracion-API]] |
| Módulo Academia (cursos) | ✅ | ⬜ | Importadoras venden cursos; solo solicitante compra; progreso % — [[15-Academia]] |

---

## Backend (resumen)

- **Stack:** FastAPI, MySQL, Redis, Docker Compose, Alembic, Wompi (créditos), WebSocket chat.
- **Roles:** `solicitante`, `importador` (dueño), `asesor`, `admin`.
- **Monetización en código:** **no se cobra al solicitante** (natural/jurídica) por cotizar (`COBRO_A_SOLICITANTES=false`). El cobro de la plataforma es a **empresas importadoras** (contrato/suscripción). El wallet de créditos del cotizante queda desactivado (compra 410, costo 0, sin bonos).
- **Tests:** suite en Docker (`docker compose run --rm tests`); históricamente 200+ tests verdes tras cada hito.
- **Seguridad:** consolidada en [[Seguridad]]; remediaciones OWASP en [[OWASP-Top10-Backend-2026-07-14]] y [[Remediaciones-Backend-Jul-2026]].
- **Carga:** [[Pruebas-Carga-1000-Concurrentes]] (1000 concurrentes, escenarios mixtos).

## Frontend

- Scaffold Vite/React en `proyecto/frontend/`.
- Pantallas y wireframes documentados en [[Indice-Frontend]].
- **Pendiente principal de producto:** implementar UI conectada a la API (guía en [[Indice-Integracion-API]]).

## Cómo verificar el backend en local

Ver [[00-Env-y-Arranque]]:

```text
cd proyecto/backend
# .env desde plantilla
docker compose up -d --build
curl http://localhost:8000/health/ready
```

---

## Lecturas relacionadas

- Propuesta de producto: [[Propuesta_Plataforma_Importacion]]
- Negocio: [[Modelo-Negocio]] · [[Metricas-MVP]]
- Calidad: [[Indice-Calidad]]
