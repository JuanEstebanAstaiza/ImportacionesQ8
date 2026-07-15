# Auditoría Backend — 2026-07-13

## Resumen ejecutivo

Auditoría full-code + runtime Docker del backend FastAPI (`proyecto/backend/`), seguida de remediaciones y re-verificación con tests y carga a **1000 usuarios concurrentes**.

| Dimensión | Resultado |
|-----------|-----------|
| Suite Docker | **225/225** passed (~60s) |
| Carga 20 users (flujo E2E) | **20/20** OK |
| Carga 1000 concurrentes (mixta) | **1000/1000** OK · 6000/6000 requests |
| Críticos de arranque/DB/negocio | Encontrados y **corregidos** (ver [[Remediaciones-Backend-Jul-2026]]) |
| Security-review por diff Git | Sin diff (rama limpia); se hizo auditoría completa de código |

Canvas en Cursor: `canvases/backend-audit.canvas.tsx` (vista interactiva de la misma campaña).

---

## Alcance

- Revisión de arquitectura, auth, IDOR, créditos, chat, matching Redis, Wompi, Docker Compose
- Ejecución de `docker compose run --rm tests`
- Auditoría de sostenimiento (health, workers, migraciones, secrets)
- Simulación de transacciones (cotización, propuesta, chat, doble aceptación)
- Prueba de alto flujo: [[Pruebas-Carga-1000-Concurrentes]]

Fuera de alcance en esta campaña: frontend, pen-test externo, producción cloud real.

---

## Hallazgos iniciales (pre-remediación)

### Críticos (bloqueaban producción Docker)

| # | Hallazgo | Impacto |
|---|----------|---------|
| C1 | `utils/dependencies.get_db` hacía `return` del generator | API 500: `'generator' object has no attribute 'query'` (tests lo enmascaraban con override) |
| C2 | Parseo de `DATABASE_URL` rompía `CREATE DATABASE` (`mysql+pymysql::///...`) y `create_all` corría **antes** de importar modelos | MySQL con **0 tablas** |
| C3 | Cotización **dirigida** no pasaba a `propuestas_recibidas` al enviar propuesta | Negociación/aceptar fallaba con 400 |
| C4 | Password MySQL con `ñ` + `SECRET_KEY` hardcodeada en Compose | Auth PyMySQL rota; secreto inseguro si se desplegaba así |

### Altos / medios (capacidad y ops)

| # | Hallazgo | Severidad |
|---|----------|-----------|
| A1 | Sin Alembic; solo `create_all` | High |
| A2 | Débito de créditos read-check-write (race a saldo negativo) | High |
| A3 | Redis `KEYS cotizacion_abierta:*` en pool/inbox (O(N)) | High |
| A4 | Un solo worker Uvicorn; `/health` shallow | High/Medium |
| A5 | Sin CI en el repo | Medium |
| M1 | JWT sin revocación real en logout | Medium |
| M2 | WebSocket: JWT en query string | Medium |
| M3 | Rate limit solo en auth | Medium |

Detalle de lo corregido: [[Remediaciones-Backend-Jul-2026]].

---

## Controles que ya estaban sólidos

- bcrypt + JWT con roles / `importador_id`
- IDOR checks en chat, cotizaciones, pagos, asesores
- Wompi HMAC fail-closed + idempotencia
- Reclamo atómico de cotización (`UPDATE WHERE asesor_asignado_id IS NULL`)
- Unique de propuesta por importador/cotización
- Handler global 500 sin stack al cliente
- Forgot-password anti-enumeración

Ver [[Seguridad]].

---

## Tests Docker

```bash
cd proyecto/backend
docker compose run --rm tests
```

| Momento | Resultado |
|---------|-----------|
| Pre-remediación (suite existente) | 221 passed |
| Post-remediación (+ health/créditos) | **225 passed** |

---

## Pruebas de carga (resumen)

| Campaña | Resultado | Notas |
|---------|-----------|-------|
| 20 users E2E, conc=10 | 100% OK | Tras fix de dirigida |
| 50 users | 20% OK | 429 por rate-limit de register (esperado) |
| **1000 concurrentes mixtos** | **100% OK** | Ver [[Pruebas-Carga-1000-Concurrentes]] |

Stack en la campaña de 1000: 8 workers, pool DB 20+40, MySQL `max-connections=500`.

---

## Veredicto

1. **Correctitud:** el backend ya no está bloqueado por bugs críticos de arranque/DB/`get_db`/dirigida.
2. **Capacidad funcional:** soporta **1000 usuarios concurrentes** sin errores en escenarios mixtos.
3. **UX bajo pico:** latencia elevada (p95 ~6s en un solo nodo Docker); siguiente paso = escala horizontal + cache/paginación en lecturas calientes.
4. **Pendientes abiertos:** revocación JWT, WS token en query, rate limits de negocio, logging estructurado.

---

## Artefactos en el repo

| Artefacto | Ruta |
|-----------|------|
| Script carga 1000 | `proyecto/backend/scripts/load_1000_concurrent.py` |
| Resultados JSON | `proyecto/backend/scripts/load_results_1000.json` |
| CI | `.github/workflows/backend-ci.yml` |
| Canvas Cursor | `canvases/backend-audit.canvas.tsx` |

## Enlaces

- [[Remediaciones-Backend-Jul-2026]]
- [[Pruebas-Carga-1000-Concurrentes]]
- [[Seguridad]] · [[API-Rest]] · [[Base-Datos]] · [[Matching-Cotizaciones]]
