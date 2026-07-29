# Pruebas de carga — 1000 usuarios concurrentes

Campaña del **2026-07-13** documentada en [[Auditoria-Backend-2026-07-13]].

---

## Objetivo

Validar que el backend soporta **al menos 1000 usuarios concurrentes** en escenarios mixtos de producto (no solo un endpoint), midiendo éxito y latencia.

---

## Método

Script: `proyecto/backend/scripts/load_1000_concurrent.py`

### Fase 1 — Provision

- Registrar 1000 solicitantes (concurrencia de registro = 100).
- Guardar JWT de cada uno.

### Fase 2 — Peak

- Barrera async: los 1000 arrancan a la vez.
- Un `httpx.AsyncClient` compartido (evita `Too many open files` de 1000 clientes síncronos).
- 5 empresas importadoras para repartir propuestas.

### Mix de escenarios (por `user_index % 10`)

| Escenario | Peso | Qué hace |
|-----------|------|----------|
| `browse` | 30% | `/usuarios/me`, catálogo, cotizaciones, saldo, health |
| `full_deal` | 20% | Cotización dirigida → propuesta → chat → doble pre-aceptación → órdenes |
| `chat_negociacion` | 20% | Hasta chat con burst de mensajes |
| `cotizacion_abierta` | 20% | Crear abierta + matching-status |
| `auth_refresh` | 10% | Login + refresh + `/me` |

---

## Stack durante la prueba

| Parámetro | Valor |
|-----------|-------|
| Workers Uvicorn | 8 |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | 20 / 40 |
| MySQL `max-connections` | 500 |
| Rate limits auth | Elevados solo para la corrida |

---

## Resultados 2026-07-29 (Docker Compose, run `3cff049f`)

| Fase | Resultado |
|------|-----------|
| Burst 100 ops | **100/100 OK** |
| Provision 1000 | **1000/1000 OK** |
| Peak mixto | **898/1000 (89.8%)** en harness; **~99.8% de negocio** tras descontar bug de `auth_refresh` (token viejo post-refresh) |
| p95 peak | ~19.8 s (calientes: `POST /cotizaciones/`, `GET /usuarios/me`) |

Detalle y blindajes: [[Auditoria-Post-Carga-Docker-2026-07-29]]. JSON: `scripts/load_results_1000_20260729.json`.

---

## Resultados históricos (run `c7e99b84`)

### Provision

| Métrica | Valor |
|---------|-------|
| Registros OK | **1000/1000** |
| Wall | 58.9 s |
| Register p95 | 5178 ms (bcrypt bajo presión) |
| Fallos | 0 |

### Peak

| Métrica | Valor |
|---------|-------|
| Usuarios OK | **1000/1000 (100%)** |
| Requests | **6000/6000** |
| Wall | 27.2 s |
| Throughput | ~36.7 users/s |
| Latency avg / p50 / p95 / p99 / max | 3023 / 2883 / **6073** / 9335 / 10726 ms |

### Por escenario

| Escenario | OK | FAIL |
|-----------|----|------|
| browse | 300 | 0 |
| full_deal | 200 | 0 |
| chat_negociacion | 200 | 0 |
| cotizacion_abierta | 200 | 0 |
| auth_refresh | 100 | 0 |

### Endpoints más calientes (p95)

| Endpoint | n | p95 (ms) |
|----------|---|----------|
| `POST /cotizaciones/` | 600 | ~10172 |
| `GET /importadores/` | 300 | ~8161 |
| `PUT .../propuestas/aceptar` | 400 | ~5179 |
| `POST /propuestas/` | 400 | ~4946 |
| `POST .../mensajes` | 1400 | ~2559 |

JSON completo: `proyecto/backend/scripts/load_results_1000.json`

---

## Campañas previas (contexto)

| Campaña | Resultado | Nota |
|---------|----------|------|
| 20 users E2E | 100% | Tras fix cotización dirigida |
| 50 users | 20% | 429 rate-limit register (comportamiento esperado) |
| 1000 sync clients | Falló | `OSError: Too many open files` → se pasó a async |

---

## Cómo repetir

```bash
cd proyecto/backend
# Stack listo + admin seed (scripts/seed_load_admin.py)
# Rate limits / workers elevados para la corrida (env Compose)
# Defaults post 2026-07-29: WEB_CONCURRENCY=4, DB_POOL_SIZE=15, DB_MAX_OVERFLOW=30

python -u scripts/load_1000_concurrent.py \
  --base-url http://127.0.0.1:8000 \
  --users 1000 \
  --concurrency 1000 \
  --provision-concurrency 100 \
  --companies 5 \
  --output scripts/load_results_1000.json
```

### Smoke de 100 operaciones concurrentes (rápido)

```bash
python -u scripts/load_100_ops_burst.py --base-url http://127.0.0.1:8000 --ops 100
```

Ver también [[Auditoria-Seguridad-Capacidad-2026-07-29]] (paginación de catálogos, métricas agregadas, GZip, rate limits).

---

## Lectura para producto

- **Correctitud bajo 1000 concurrentes: aprobada.**
- Latencia bajo pico (p95 ~6s en un nodo local con 8 workers) indica que, para UX “rápida” a ese volumen, hace falta más escala horizontal y optimizar lecturas calientes (paginación/cache).
- El cuello de registro masivo es **bcrypt** (esperado y deseable por seguridad).

## Enlaces

- [[Auditoria-Backend-2026-07-13]]
- [[Remediaciones-Backend-Jul-2026]]
- [[API-Rest]] · [[Seguridad]]
