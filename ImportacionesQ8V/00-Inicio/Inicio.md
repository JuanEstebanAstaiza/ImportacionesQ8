# Zarpi — Documentación

> **Última actualización:** 2026-10-01 · **En producción desde el 2026-10-01.**

**Zarpi** es la plataforma de **conexión y cotización** entre solicitantes (quien importa) y **empresas importadoras**. Este vault es la fuente de verdad del proyecto. El repositorio y el vault conservan el nombre técnico original, *ImportacionesQ8*.

---

## Empieza aquí según tu rol

| Soy… | Orden de lectura |
|------|------------------|
| **Nuevo en el proyecto** | 1. [[Resumen-Ejecutivo]] · 2. [[Estado-del-proyecto]] · 3. [[Cronologia-del-Proyecto]] · 4. [[Como-navegar]] |
| **Frontend / Fullstack** | 1. [[Indice-Integracion-API]] · 2. [[00-Env-y-Arranque]] · 3. [[Catalogo-Completo]] · 4. [[Indice-Frontend]] |
| **Backend** | 1. [[Indice-Backend]] · 2. [[Seguridad]] · 3. [[API-Rest]] · 4. [[Indice-Calidad]] |
| **Negocio / stakeholders** | 1. [[Resumen-Ejecutivo]] · 2. [[Hoja-de-Ruta]] · 3. [[Modelo-Negocio]] · 4. [[Metricas-MVP]] |
| **Operación / DevOps** | 1. [[Despliegue-y-Operacion]] · 2. [[Backups-y-Restauracion]] · 3. [[Seguridad]] |
| **QA / seguridad** | 1. [[Indice-Calidad]] · 2. [[OWASP-Top10-Backend-2026-07-14]] · 3. [[Seguridad]] |

---

## Mapa del vault (carpetas)

| # | Carpeta | Contenido |
|---|---------|-----------|
| 00 | [[Como-navegar\|Inicio]] | Cómo leer el vault, estado y mapa |
| 01 | [[Indice-Negocio\|Negocio]] | Propuesta, modelo, pitch, métricas |
| 02 | [[Indice-Integracion-API\|Integración API]] | **Todas las APIs**, `.env`, Postman (para conectar el cliente) |
| 03 | [[Indice-Backend\|Backend]] | Diseño técnico: DB, auth, pagos, chat, matching |
| 04 | [[Indice-Frontend\|Frontend UI]] | Pantallas, wireframes, UX |
| 05 | [[Indice-Calidad\|Calidad y seguridad]] | Auditorías, OWASP, carga, remediaciones |
| 06 | [[Indice-Historial\|Historial]] | Cronología, semanas y fases con fechas |

Detalle visual: [[Mapa-del-vault]].

---

## Atajos frecuentes

- **Levantar el stack y variables de entorno** → [[00-Env-y-Arranque]]
- **Lista de endpoints** → [[Catalogo-Completo]]
- **Colección Postman** → [[14-Postman-Insomnia]]
- **Qué hay implementado hoy** → [[Estado-del-proyecto]]
- **Metas y próximos pasos** → [[Hoja-de-Ruta]]
- **Cómo se construyó, con fechas** → [[Cronologia-del-Proyecto]]
- **Desplegar o actualizar producción** → [[Despliegue-y-Operacion]]
- **Copias de seguridad** → [[Backups-y-Restauracion]]
- **Propuesta original del producto** → [[Propuesta_Plataforma_Importacion]]

---

## Código en el monorepo

```text
ImportacionesQ8/
├── proyecto/backend/     → API FastAPI + Docker
├── proyecto/frontend/    → Vite + React
└── ImportacionesQ8V/     → este vault
```
