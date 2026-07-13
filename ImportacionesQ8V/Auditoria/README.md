# Auditoría — ImportacionesQ8

Carpeta independiente del vault con auditorías técnicas, remediaciones y pruebas de carga del backend.

## Documentos

| Nota | Descripción |
|------|-------------|
| [[Auditoria-Backend-2026-07-13]] | Informe consolidado de la auditoría (código, seguridad, sostenimiento, tests Docker, carga) |
| [[Remediaciones-Backend-Jul-2026]] | Fixes aplicados tras la auditoría (críticos + altos) |
| [[Pruebas-Carga-1000-Concurrentes]] | Resultados de la simulación con 1000 usuarios concurrentes |

## Contexto

Esta carpeta **no sustituye** la documentación de diseño en [[Seguridad]], [[API-Rest]] o [[Base-Datos]]: las complementa con evidencia de revisión, hallazgos, remediaciones y métricas de carga.

Código auditado: `proyecto/backend/`  
Fecha de la campaña: **2026-07-13**

## Enlaces relacionados

- [[Seguridad]] — blindaje de seguridad del backend
- [[API-Rest]] — endpoints (incl. `/health/ready`)
- [[Base-Datos]] — esquema y migraciones Alembic
- [[Matching-Cotizaciones]] — Redis e índice por importador
- [[Tareas-Semana-4]] — alcance funcional Semana 4
