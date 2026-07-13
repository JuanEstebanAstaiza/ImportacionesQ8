# Remediaciones Backend — Julio 2026

Lista de cambios aplicados tras [[Auditoria-Backend-2026-07-13]]. Código en `proyecto/backend/`.

---

## Críticos

### 1. `get_db` devolvía un generator

- **Antes:** `return _get_db()` → FastAPI inyectaba el objeto generator → 500 en Docker.
- **Después:** `yield from gen` en `utils/dependencies.py`.
- **Verificación:** login/API contra MySQL; suite Docker verde.

### 2. Init de base de datos

- **Antes:** `create_all` al importar `database.py` con metadata vacía; parseo de URL con `split("/")` generaba `mysql+pymysql::///...`.
- **Después:**
  - `init_db()` en lifespan de `main.py` (tras importar modelos).
  - URL sin DB: `DATABASE_URL.rsplit("/", 1)`.
  - Migraciones vía **Alembic** (`alembic upgrade head`); fallback `create_all` + stamp si hace falta.
- **Archivos:** `database.py`, `main.py`, `alembic/`, `alembic.ini`.

### 3. Cotización dirigida → negociación

- **Antes:** solo `estado == "abierta"` pasaba a `propuestas_recibidas` al enviar propuesta.
- **Después:** también `"dirigida"` (envío directo y envío de borrador).
- **Archivo:** `routers/cotizaciones.py`.

### 4. Secrets y password MySQL

- Compose ya no hardcodea `SECRET_KEY`; usa `.env` (`SECRET_KEY` obligatorio).
- Password MySQL solo ASCII (`password_q8`).
- `config.py` rechaza `SECRET_KEY` insegura si `APP_ENV=production`.
- Plantilla: `.env.example`.

---

## Altos / capacidad

### 5. Débito atómico de créditos

```text
UPDATE usuarios
SET creditos_balance = creditos_balance - :costo
WHERE id = :user_id AND creditos_balance >= :costo
```

- Si `rowcount != 1` → `402` + rollback (no queda cotización a medias).
- Test de carrera: `tests/test_health_ready_creditos.py`.

### 6. Redis sin `KEYS`

- Índice SET: `indice:importador:{id}:abiertas` (+ índice global).
- `matching_cotizacion_abierta` indexa al matchear; `expirar_cotizacion_abierta` desindexa.
- Pool empresa e inbox abierta usan `SMEMBERS`, no `KEYS`.
- Ver [[Matching-Cotizaciones]].

### 7. Workers y pool DB

- Dockerfile: `uvicorn ... --workers ${WEB_CONCURRENCY:-2}`.
- Engine: `pool_pre_ping`, `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`.
- MySQL Compose: `--max-connections=500`.

### 8. `/health/ready`

| Endpoint | Rol |
|----------|-----|
| `GET /health` | Liveness (proceso vivo) |
| `GET /health/ready` | Readiness: MySQL `SELECT 1` + Redis `PING` → 503 si falla |

### 9. CI

- `.github/workflows/backend-ci.yml`:
  - `docker compose run --rm tests`
  - Smoke: levantar stack y esperar `/health/ready`

---

## Pendientes (no remediados en esta pasada)

| Ítem | Notas |
|------|-------|
| Revocación JWT | Logout sigue siendo client-side |
| WS JWT en query | Limitación de browsers; mitigar con token corto |
| Rate limit en escritura de negocio | Solo auth hoy |
| Logging estructurado / README completo | Parcial |

---

## Cómo verificar

```bash
cd proyecto/backend
cp .env.example .env   # generar SECRET_KEY fuerte
docker compose up -d --build
curl http://localhost:8000/health/ready
docker compose run --rm tests
```

Carga opcional: ver [[Pruebas-Carga-1000-Concurrentes]].

---

## Seguimiento — flujos Admin / Dueño (2026-07-13, tarde)

Ajustes tras la revisión de flujos de administrador y dueño de importadora (siempre hay representante legal porque el alta es `POST /admin/importadores`).

| # | Cambio | Detalle |
|---|--------|---------|
| F1 | Recreación en cotizaciones **abiertas** | Empresa ganadora vía propuesta `aceptada` (y `importador_id` fijado al aceptar); ya no depende solo de `cotizacion.importador_id` |
| F2 | Estado `orden_activa` | Tras doble aceptación: cotización → `orden_activa` + `importador_id` = empresa ganadora |
| F3 | Métricas | `importadores_verificados` cuenta `verificado=True`, no activos |
| F4 | Alta sin dueño | `POST /importadores` → **410 Gone**; única vía = `POST /admin/importadores` |
| F5 | Dueño reclama pool | `POST /cotizaciones/{id}/reclamar` admite `importador` y `asesor` |
| F6 | Matching fail-closed | `POST /propuestas/` en abiertas exige Redis; sin Redis → 503 |

Ver también [[API-Rest]] y [[Seguridad]].
