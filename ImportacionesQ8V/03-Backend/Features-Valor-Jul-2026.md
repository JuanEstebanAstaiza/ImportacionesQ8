# Features de valor — Julio 2026

Resumen de capacidades backend añadidas el 2026-07-13. Código: `proyecto/backend/`. Migración: `alembic/versions/20260713_0002_features_valor.py`. Tests: `tests/test_features_valor.py`.

## Decisiones de producto

| Actor | Créditos / wallet | Notas |
|-------|-------------------|--------|
| Solicitante natural | `Usuario.creditos_balance` | Cotiza y compra créditos |
| Solicitante jurídica | Wallet de `OrganizacionSolicitante` | Equipo multi-usuario (`MiembroOrganizacion`) comparte saldo |
| Importadora | **Sin wallet** | Cobro contractual fuera de plataforma; perfil enriquecido con evidencias |

## Módulos

1. **Evidencias importador** — `EvidenciaImportador`; dueño sube URL; admin revisa; catálogo solo muestra `aprobada`.
2. **Créditos corporativos** — helper `services/credito_wallet.py` (`obtener_wallet`, `debitar_atomico`, `acreditar`). Cotizaciones/compras/movimientos resuelven org vs personal.
3. **Dispute room** — `Disputa` + `EvidenciaDisputa` + `MensajeDisputa`; compatible con `orden.en_disputa`.
4. **Referidos** — solo solicitantes; bonos `CREDITO_BONO_REFERIDO` / `CREDITO_BONO_REFERIDOR` al wallet efectivo; tipos de movimiento `bono_referido` / `bono_referidor`.
5. **Traducción** — Google Cloud Translation v2 REST si `TRANSLATION_ENABLED=true` + `GOOGLE_TRANSLATE_API_KEY`; en tests/mock sin key. Idiomas MVP: `es`, `en`, `zh-CN`. Adjuntos siguen patrón URL-only.

## Variables de entorno

Ver `.env.example`: `GOOGLE_TRANSLATE_API_KEY`, `GOOGLE_TRANSLATE_PROJECT`, `TRANSLATION_ENABLED`, `CREDITO_BONO_REFERIDO`, `CREDITO_BONO_REFERIDOR`.

## Endpoints

Tabla consolidada en [[API-Rest]] (sección *Features de valor*). Seguridad / IDOR: [[Seguridad]].
