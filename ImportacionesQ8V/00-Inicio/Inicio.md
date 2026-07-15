# ImportacionesQ8 — Documentación

Plataforma de **conexión y cotización** entre solicitantes (quien importa) e **empresas importadoras**. Este vault es la fuente de verdad del proyecto.

---

## Empieza aquí según tu rol

| Soy… | Orden de lectura |
|------|------------------|
| **Nuevo en el proyecto** | 1. [[Como-navegar]] · 2. [[Propuesta_Plataforma_Importacion\|Propuesta de producto]] · 3. [[Estado-del-proyecto]] |
| **Frontend / Fullstack** | 1. [[Indice-Integracion-API]] · 2. [[00-Env-y-Arranque]] · 3. [[Catalogo-Completo]] · 4. [[Indice-Frontend]] |
| **Backend** | 1. [[Indice-Backend]] · 2. [[Seguridad]] · 3. [[API-Rest]] · 4. [[Indice-Calidad]] |
| **Negocio / stakeholders** | 1. [[Pitch-Inversionistas]] · 2. [[Modelo-Negocio]] · 3. [[Metricas-MVP]] |
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
| 06 | [[Indice-Historial\|Historial]] | Tareas por semana (archivo de desarrollo) |

Detalle visual: [[Mapa-del-vault]].

---

## Atajos frecuentes

- **Levantar el stack y variables de entorno** → [[00-Env-y-Arranque]]
- **Lista de endpoints** → [[Catalogo-Completo]]
- **Colección Postman** → [[14-Postman-Insomnia]]
- **Qué hay implementado hoy** → [[Estado-del-proyecto]]
- **Propuesta original del producto** → [[Propuesta_Plataforma_Importacion]]

---

## Código en el monorepo

```text
ImportacionesQ8/
├── proyecto/backend/     → API FastAPI + Docker
├── proyecto/frontend/    → Vite + React
└── ImportacionesQ8V/     → este vault
```
