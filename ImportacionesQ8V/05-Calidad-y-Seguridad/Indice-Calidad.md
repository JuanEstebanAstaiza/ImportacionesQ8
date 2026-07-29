# Calidad y seguridad

Informes de **auditoría, remediaciones, OWASP y pruebas de carga**.  
Complementan (no sustituyen) el diseño en [[Seguridad]], [[API-Rest]] y [[Base-Datos]].

← Volver a [[Inicio]]

## Documentos

| Nota | Descripción | Fecha |
|------|-------------|-------|
| [[Auditoria-Backend-2026-07-13]] | Informe consolidado (código, seguridad, sostenimiento, tests, carga) | 2026-07-13 |
| [[Remediaciones-Backend-Jul-2026]] | Fixes aplicados tras la auditoría | 2026-07-13 |
| [[Pruebas-Carga-1000-Concurrentes]] | Simulación 1000 usuarios concurrentes | 2026-07-13 |
| [[OWASP-Top10-Backend-2026-07-14]] | Revisión OWASP Top 10 y score ~92/100 | 2026-07-14 |
| [[Auditoria-Seguridad-Modulos-2026-07-28]] | LMS, notificaciones, chat iniciar, hard-delete, métricas + remediaciones | 2026-07-28 |
| [[Auditoria-Seguridad-Capacidad-2026-07-29]] | XSS/SQLi/DDoS + capacidad 1000 concurrentes / 100 ops; pagos aplazados | 2026-07-29 |
| [[Auditoria-Post-Carga-Docker-2026-07-29]] | Carga real en Docker + blindaje headers/body/Alembic + backlog B1–B8 | 2026-07-29 |

## Orden recomendado

1. [[Auditoria-Backend-2026-07-13]] — contexto y hallazgos  
2. [[Remediaciones-Backend-Jul-2026]] — qué se corrigió  
3. [[Pruebas-Carga-1000-Concurrentes]] — capacidad (campaña 1000)  
4. [[OWASP-Top10-Backend-2026-07-14]] — postura de seguridad (jul-14)  
5. [[Auditoria-Seguridad-Modulos-2026-07-28]] — delta módulos LMS/notif/chat  
6. [[Auditoria-Seguridad-Capacidad-2026-07-29]] — XSS/SQLi/DDoS + workers/paginación  
7. [[Seguridad]] — blindaje como referencia viva de implementación  

## Contexto de producto

- Admin registra **siempre** empresa importadora + dueño (representante legal).
- Código auditado: `proyecto/backend/`

## Enlaces relacionados

- [[Seguridad]] · [[API-Rest]] · [[Base-Datos]] · [[Matching-Cotizaciones]]
- [[Indice-Backend]] · [[Estado-del-proyecto]]
