# Cronología del proyecto Zarpi (ImportacionesQ8)

> **Última actualización:** 2026-10-01 · Fuente: historial de git de `main` (commits y merges de PR) y el código en cada fecha.
> El repositorio y el vault conservan el nombre técnico **ImportacionesQ8**; la marca del producto es **Zarpi** desde el 2026-09-17.

Vista de conjunto, de la propuesta a producción. El detalle de cada etapa está en su nota.

---

## Línea de tiempo

| Fechas | Etapa | Qué se logró | PRs | Detalle |
|--------|-------|--------------|-----|---------|
| 2026-07-05 | Arranque | Repositorio, vault de documentación y planificación del MVP a 3 semanas | #1 | [[Propuesta_Plataforma_Importacion]] |
| 2026-07-05 → 07-08 | Semanas 1–4 (backend MVP) | Auth JWT, cotizaciones dirigidas/abiertas con matching, red de importadores, órdenes, chat en tiempo real, panel admin, asesores, créditos Wompi, registro natural/jurídica | #1, #2 | [[Tareas-Semana-1]] · [[Tareas-Semana-2]] · [[Tareas-Semana-3]] · [[Tareas-Semana-4]] |
| 2026-07-08 → 07-15 | Auditoría, endurecimiento y arranque del frontend | Auditoría + carga 1000 concurrentes, OWASP ~92/100, OTP de email, revocación real de JWT, tickets de WebSocket, CI de backend, guía de integración API; primer frontend (Vite/React) y extracción de auth del monolito | #3 – #7 | [[Indice-Calidad]] · [[Indice-Integracion-API]] |
| 2026-07-20 → 08-26 | **Fase 5** — Frontend conectado y módulos de operación | Fin del cobro al solicitante, LMS de cursos, notificaciones, módulo documental, certificaciones y backup ZIP, shipping mark, reseñas, chat interno, mesa de soporte por niveles, centro de ayuda | #8 – #13 | [[Fase-5-Frontend-y-Operacion]] |
| 2026-08-31 → 09-29 | **Fase 6** — Marca Zarpi y preparación de producción | Multimoneda y DDP, marca Zarpi, landing con CMS, rol obligatorio en el login, tiers del cotizante, correos masivos, notificaciones en vivo (SSE), stack de producción con Caddy + HTTPS | #14 – #19 | [[Fase-6-Zarpi-y-Produccion]] |
| 2026-09-30 → 10-01 | **Fase 7** — Puesta en producción y operación | Despliegue en un droplet de DigitalOcean, límite diario de cotizaciones, calculadora de precios en el chat, backups completos con restauración desde el panel, scripts de diagnóstico y de primer admin | #22 – #25 | [[Fase-7-Puesta-en-Produccion]] |
| 2026-10-03 → | **Fase 8** — Piloto: asignación y métricas | Bitácora de eventos con montos en COP (TRM oficial), asignación de abiertas a máx. 3 empresas, propuestas selladas, comparador sin orden por precio, panel de la empresa en pesos | En rama | [[Fase-8-Piloto-Asignacion-y-Metricas]] |

---

## Hitos clave

| Fecha | Hito |
|-------|------|
| 2026-07-05 | Primer commit y vault de documentación |
| 2026-07-08 | Backend del MVP completo (semanas 1–4); arranca el repositorio del frontend |
| 2026-07-13 | Primera auditoría de backend y prueba de carga de 1000 usuarios concurrentes |
| 2026-07-14 | OWASP Top 10: puntuación ~92/100 tras remediaciones |
| 2026-07-20 | Decisión de negocio: **no se cobra al solicitante**, solo a las empresas importadoras (`COBRO_A_SOLICITANTES=false`) |
| 2026-07-29 | Backend del LMS y auditoría de seguridad XSS/SQLi/DDoS + capacidad (1000 usuarios / 100 operaciones) |
| 2026-08-05 | Módulo documental tipo Drive |
| 2026-08-09 | Rol `soporte`, tickets y mesa de ayuda por niveles |
| 2026-09-08 | Landing con la identidad visual Zarpi |
| 2026-09-17 | Renombrado del producto: ImportacionesQ8 → **Zarpi** |
| 2026-09-29 | Stack de producción listo: Docker Compose + Caddy con HTTPS automático |
| 2026-10-01 | **Plataforma en producción** en un droplet de DigitalOcean con dominio propio |
| 2026-10-01 | Copias de seguridad completas y restauración desde el panel de administración |
| 2026-10-03 | Cada cambio de estado queda en una bitácora con montos en pesos; las abiertas se asignan a máx. 3 empresas |

> **PRs que no entraron directamente en `main`:** #12 (frontend de cursos) se cerró y su contenido llegó con #13; #20 (límite diario) se cerró y su contenido llegó con #22; #21 se integró en la rama `feature/QoL-proveedores`.

---

## Quién participó

Según la autoría de los commits en `main`:

| Autor (GitHub) | Foco principal en el historial |
|----------------|-------------------------------|
| JuanEstebanAstaiza | Backend, documentación, seguridad, producción y la mayoría de los PRs |
| JuanSamuelArbelaez | Frontend: auth, cursos, documentos, landing y marca Zarpi, modo oscuro, tiers, correos |
| Evelio | Backend del LMS, notificaciones, métricas y auditoría de seguridad/capacidad (2026-07-29) |
| Claude (Claude Code) | Fases 7 y 8: límite diario, calculadora, backups, scripts de despliegue, bitácora de eventos, asignación y panel de la empresa, y esta documentación |

---

## El sistema hoy, en números (2026-10-03)

| Métrica | Valor | Cómo se midió |
|---------|-------|---------------|
| Operaciones REST | 212 + 1 WebSocket | OpenAPI exportado ([[Catalogo-Completo]]) |
| Migraciones Alembic | 25 (`0001` → `0025`) | `proyecto/backend/alembic/versions` |
| Tablas | 54 | Modelos SQLAlchemy |
| Tests de backend | 706 casos en 46 archivos, todos verdes | `pytest` (2026-10-03) |
| Pantallas del frontend con URL propia | 40 | `proyecto/frontend/src/app/rutas.ts` |
| PRs integrados en `main` | 22 (#1–#11, #13–#19, #22–#25) | Historial de merges y GitHub |

---

## Ver también

- Estado actual: [[Estado-del-proyecto]]
- Próximos pasos y metas: [[Hoja-de-Ruta]]
- Despliegue y operación: [[Despliegue-y-Operacion]]

← [[Indice-Historial]]
