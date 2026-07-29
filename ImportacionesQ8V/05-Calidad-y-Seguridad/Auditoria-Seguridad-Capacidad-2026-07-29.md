# Auditoría de seguridad ampliada + capacidad (2026-07-29)

Continúa la línea de [[Auditoria-Seguridad-Modulos-2026-07-28]] y [[OWASP-Top10-Backend-2026-07-14]], con foco en:

1. **XSS, SQL injection, DDoS / abuso de rate**
2. **Capacidad: 1000 usuarios concurrentes y ≥100 operaciones simultáneas**
3. **Pagos reales: aplazados** hasta definir pasarela (no se implementan)

← [[Indice-Calidad]] · [[Pruebas-Carga-1000-Concurrentes]] · [[Seguridad]]

---

## Decisiones de producto

| Tema | Decisión |
|------|----------|
| Pasarela de pago / cobro de cursos | **No implementar** hasta que negocio indique proveedor |
| Compra de curso (`POST /cursos/{id}/comprar`) | Sigue siendo **inscripción sin cobro real** (honor-system MVP) |
| Paywall de media LMS | Sigue activo (solo preview sin compra) |

---

## 1. XSS (Cross-Site Scripting)

### Backend

| Control | Estado |
|---------|--------|
| URLs de curso (`video_url`, `portada_url`, recursos) solo `http`/`https` | ✅ (sesión 28-jul + validators) |
| Chat: `contenido` max 4000 chars; `tipo` solo `texto`\|`archivo` (no forjar `sistema`) | ✅ |
| API JSON (React no usa `dangerouslySetInnerHTML` de usuario) | ✅ base |

### Frontend

| Control | Estado |
|---------|--------|
| Helper `utils/safe-url.ts` (`isSafeHttpUrl`, `isSafeEmbedUrl`, `safeHttpUrl`) | ✅ nuevo |
| `CoursesScreen`: `img`/`iframe`/`video`/`a` solo con URLs http(s) o embeds YouTube/Vimeo | ✅ |
| `iframe` con `sandbox` acotado | ✅ |
| Enlaces de recursos: `rel="noopener noreferrer"` | ✅ |
| `chart.tsx` `dangerouslySetInnerHTML` | Solo CSS de tema shadcn (no input usuario) — residual OK |

### Residual XSS

- Cualquier pantalla futura que renderice markdown/HTML de chat o descripciones **debe** escapar o usar librería safe.
- Sanitizar en FE al cablear chat real (contenido de mensajes).

---

## 2. SQL injection

| Control | Estado |
|---------|--------|
| ORM SQLAlchemy (queries parametrizadas) | ✅ en todo el backend de producto |
| Sin concatenación de SQL con input de usuario en routers | ✅ verificado |
| `CREATE DATABASE` solo con nombre validado por regex (`database.py`) | ✅ ya existía |
| Filtros `ILIKE` / `LIKE`: escape de `%` `_` `\` (`utils/query_safety.py`) | ✅ nuevo en catálogo cursos |
| `especialidad`/`pais` clamp de longitud en listado importadores | ✅ |

**Conclusión SQLi:** riesgo residual **bajo**. No hay SQL crudo alimentado por el cliente.

---

## 3. DDoS / abuso / rate limiting

| Endpoint / zona | Límite (default) | Notas |
|-----------------|------------------|-------|
| Login / register / OTP / forgot | 5–10/min (ya existían) | Fuerza bruta |
| `GET /importadores/`, `GET /cursos` | `RATE_LIMIT_PUBLIC_READ` **120/min** | Catálogos públicos |
| `POST /cursos`, `POST .../comprar` | `RATE_LIMIT_PUBLIC_WRITE` **30/min** | Spam de writes |
| `POST .../mensajes` chat | `RATE_LIMIT_CHAT_MESSAGE` **60/min** | Flood de chat |
| `GET /notificaciones` | `RATE_LIMIT_NOTIFICACIONES` **90/min** | Polling agresivo |
| Paginación listados | default 50, max 100–200 | Evita respuestas monstruo |
| Mensaje chat | max 4000 chars | Payload abuse |
| Curso publish | max módulos/lecciones/recursos | Ya desde 28-jul |

Configurables vía env en `docker-compose` / `.env`. En **load tests** hay que **elevar** estos límites (igual que se hace con login/register).

### Residual DDoS

- Rate limit por **IP** (slowapi); detrás de NAT corporativo puede castigar usuarios legítimos → en prod preferir API Gateway / WAF / Cloudflare.
- WebSocket no tiene el mismo rate limit que REST (residual).
- No hay CAPTCHA en register (abuso de cuentas) — residual de producto.

---

## 4. Otros controles (resumen)

| Amenaza | Estado |
|---------|--------|
| IDOR notificaciones / mis-cursos / métricas | ✅ scoped a JWT |
| Paywall LMS | ✅ |
| CORS sin `*` | ✅ |
| Secrets en producción | ✅ fail-fast `SECRET_KEY` |
| Docs/OpenAPI off en production | ✅ |
| GZip respuestas ≥500 B | ✅ nuevo (menos ancho de banda bajo carga) |

---

## 5. Capacidad: 1000 concurrentes y 100 ops

### Evidencia previa (2026-07-13)

[[Pruebas-Carga-1000-Concurrentes]]: **1000/1000 usuarios OK**, 6000 requests, 0 fallos de escenario.  
Cuello de botella observado: latencia p95 alta en `POST /cotizaciones/` y `GET /importadores/` (no caídas).

### Endurecimiento de capacidad (esta sesión)

| Cambio | Objetivo |
|--------|----------|
| `WEB_CONCURRENCY` default **4** | Más workers Uvicorn |
| `DB_POOL_SIZE=15` / `MAX_OVERFLOW=30` | ~180 conn max (4×45); MySQL 500 |
| `GET /importadores/` **paginado** (limit/offset) | Elimina full-scan de respuesta en catálogo caliente |
| `GET /cursos` paginado + nombres importadora **en batch** | Evita N+1 |
| `GET /importadores/metricas` y dashboard asesor en **COUNT/SUM** | Evita cargar tablas enteras |
| GZipMiddleware | Menos bytes por cliente concurrente |
| Script `scripts/load_100_ops_burst.py` | Smoke de 100 ops paralelas (health + catálogos) |

### Cómo validar

```bash
# 1) Stack con workers/pools de capacidad (ver docker-compose)
cd proyecto/backend
# Elevar rate limits en .env para la corrida de carga

# 2) Burst 100 ops
python -u scripts/load_100_ops_burst.py --base-url http://127.0.0.1:8000 --ops 100

# 3) Campaña 1000 usuarios (completa)
python -u scripts/load_1000_concurrent.py --base-url http://127.0.0.1:8000 \
  --users 1000 --concurrency 1000 --provision-concurrency 100 --companies 5
```

### Dimensionamiento recomendado (producción)

| Recurso | Mínimo orientativo |
|---------|-------------------|
| API workers | 4–8 (CPU-bound bcrypt en auth) |
| MySQL `max_connections` | ≥ 500 (ya en Compose) |
| Redis | Obligatorio (chat pub/sub, rate limit storage si se migra a Redis storage) |
| Reverse proxy | Nginx/Caddy con timeouts y body size limit |
| WAF / CDN | Cloudflare o similar delante del API |

**Nota:** 1000 concurrentes con p95 de varios segundos en writes pesados (bcrypt + cotizaciones) es **aceptable para MVP** si el success rate es ~100%. Optimizar p95 de `POST /cotizaciones` es backlog de performance (no bloquea “no caerse”).

---

## 6. Checklist residual (backlog)

| Prioridad | Item |
|-----------|------|
| P0 negocio | Elegir pasarela → entonces cablear cobro de cursos |
| P1 | Rate limit WS + storage Redis para slowapi multi-worker consistente |
| P1 | Índices MySQL en columnas de filtro frecuente si p95 catálogo sube |
| P2 | CAPTCHA / anti-bot en register |
| P2 | CSP headers en el hosting del Frontend |
| P2 | Re-ejecutar `load_1000_concurrent.py` tras estos cambios y archivar JSON |

---

## 7. Archivos tocados (esta sesión)

- `utils/query_safety.py`, `utils/limiter.py`
- `routers/cursos.py`, `importadores.py`, `chat.py`, `notificaciones.py`, `usuarios.py`
- `schemas/chat.py`, `main.py` (GZip), `config.py`, `docker-compose.yml`
- `frontend/src/utils/safe-url.ts`, `features/courses/CoursesScreen.tsx`
- `scripts/load_100_ops_burst.py`, `tests/test_query_safety_capacity.py`

---

## Conclusión

- **Seguridad app:** postura sólida en SQLi; XSS endurecido en LMS (BE+FE); DDoS básico por rate limit + paginación.
- **Pagos:** conscientemente **fuera de alcance** hasta definición de pasarela.
- **Capacidad:** historial de **1000 concurrentes OK**; defaults de workers/pool y optimización de catálogos/métricas orientados a **≥100 ops simultáneas sin full-table dumps**. Re-correr smoke `load_100_ops_burst` y la campaña 1000 en el entorno real de despliegue.
