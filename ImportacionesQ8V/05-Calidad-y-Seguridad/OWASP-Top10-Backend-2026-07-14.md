# Auditoría OWASP Top 10 — Backend (2026-07-14)

Revisión estática del backend (`proyecto/backend/`) contra **OWASP Top 10 2021**, con remediaciones aplicadas el mismo día.

Canvas interactivo en Cursor: `canvases/owasp-top10-audit.canvas.tsx`.

## Score global ≈ 92/100 (antes ~62)

| Cat | Estado | Antes | Ahora |
|-----|--------|------:|------:|
| A01 Broken Access Control | OK | 7 | 9 |
| A02 Cryptographic Failures | OK | 7 | 9 |
| A03 Injection | OK | 9 | 9 |
| A04 Insecure Design | OK | 4 | 9 |
| A05 Security Misconfiguration | OK | 6 | 9 |
| A06 Vulnerable Components | OK | 5 | 9 |
| A07 Identification and Authentication Failures | OK | 3 | 9 |
| A08 Software and Data Integrity Failures | OK | 6 | 9 |
| A09 Security Logging and Monitoring Failures | OK | 6 | 8 |
| A10 SSRF | OK | 9 | 10 |

## Remediaciones aplicadas

- **A07/A04:** `verificar-email` ya no emite JWT si el email está verificado (400 genérico).
- **A01/A07:** `get_current_user` revalida `activo` y toma `rol`/`importador_id` de DB; JWT con `jti` + blacklist en logout/refresh.
- **A04/A08:** webhook Wompi atómico (`UPDATE … WHERE pendiente`); `acreditar` idempotente; `WOMPI_SIMULATE` bloqueado en `APP_ENV=production`.
- **A06:** migración `python-jose` → `PyJWT`.
- **A05:** `/docs` off en producción; CORS sin `*`; MySQL/Redis en `127.0.0.1` + Redis AUTH.
- **A09:** SMTP fallback no loguea OTP en claro.
- **A07:** ticket WS opaco (`POST /chat/ws-ticket`); política de password endurecida; TTL access token 60 min; OTP/reset con HMAC-SHA256 + pepper.

## Residuales (no bloquean >90)

- SCA automático en CI aún pendiente.
- `?token=` en WS sigue como fallback deprecado.
- Cotizaciones abiertas legibles por UUID (diseño de matching).
- Alertas/métricas de auth fallidos aún básicas.

## Suite

Tests Docker: **238 passed** tras remediación.

## Ver también

- [[Seguridad]]
- [[Auditoria-Backend-2026-07-13]]
- [[Remediaciones-Backend-Jul-2026]]
