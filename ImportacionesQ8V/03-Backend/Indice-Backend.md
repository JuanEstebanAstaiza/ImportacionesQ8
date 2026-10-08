# Backend — índice técnico

> **Última actualización:** 2026-10-01

Diseño e implementación del servidor (`proyecto/backend/`).  
Si solo necesitas **llamar la API desde el cliente**, usa [[Indice-Integracion-API]] (más práctico para frontend).

## Contenido de esta carpeta

| Nota | Tema |
|------|------|
| [[API-Rest]] | Visión general de endpoints y módulos REST |
| [[Autenticacion]] | Registro, JWT, OTP, roles |
| [[Base-Datos]] | Modelo de datos, migraciones Alembic |
| [[Pagos-Wompi]] | Créditos, compras, webhooks |
| [[Chat-WebSocket]] | Chat en tiempo real y Redis |
| [[Matching-Cotizaciones]] | Pool abierto, matching, Redis |
| [[Seguridad]] | Blindaje consolidado (IDOR, rate limits, ACID, etc.) |
| [[Features-Valor-Jul-2026]] | Evidencias, orgs, disputas, referidos, traducción |
| [[Backups-y-Restauracion]] | Backups automáticos, restauración, actualizaciones con `down -v` y migración a nativo |
| [[Despliegue-y-Operacion]] | Producción (Caddy + HTTPS en DigitalOcean), primer despliegue, actualizaciones, scripts y problemas conocidos |

## Orden recomendado (backend dev)

1. [[Estado-del-proyecto]] — contexto  
2. [[Base-Datos]] — entidades  
3. [[Autenticacion]] + [[Seguridad]]  
4. [[API-Rest]] → profundizar por dominio  
5. [[Indice-Calidad]] — auditorías y carga  

## Arranque local

[[00-Env-y-Arranque]] (plantillas `.env` y Docker).

## Relación con Integración API

| Carpeta | Enfoque |
|---------|---------|
| **03-Backend** | Cómo y por qué está hecho (diseño, DB, seguridad) |
| **02-Integracion-API** | Contrato HTTP listo para conectar (bodies, auth, Postman) |

← Volver a [[Inicio]]
