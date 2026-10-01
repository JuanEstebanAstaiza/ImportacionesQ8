# Frontend UI — índice

> **Última actualización:** 2026-10-01 · El frontend está completo y en producción. Las notas `Pantallas-*` empiezan con una sección "Estado actual"; el resto conserva el diseño original del MVP.

Documentación de **pantallas, wireframes y UX**.  
La guía para **conectar contra la API** (env, endpoints, Postman) está en [[Indice-Integracion-API]].

## Contenido

| Nota | Descripción |
|------|-------------|
| [[Wireframes]] | Estructura de pantallas y flujos |
| [[UX-UI-Guia]] | Principios de diseño y tokens |
| [[Pantallas-Solicitante]] | Flujos del cotizante |
| [[Pantallas-Importador]] | Flujos de empresa / asesores |
| [[Pantallas-Admin]] | Panel administración |
| [[Arquitectura-Frontend]] | Mapa de arquitectura y estrategia de desacople |
| [[Routing-y-Roles-Frontend]] | Reglas de navegacion y guardas por rol |
| [[Contrato-Shell-Header-Sidebar]] | Contrato comun de layout, header y sidebar |
| [[Cursos-Experiencia-y-Player]] | Flujo de cursos, modal player y auto-avance |
| [[Chat-y-Ayuda-UX]] | Patrones UX de chat y soporte |

## Orden recomendado

1. [[Wireframes]]  
2. [[UX-UI-Guia]]  
3. Pantallas del rol que implementes  
4. [[Arquitectura-Frontend]] y [[Routing-y-Roles-Frontend]]  
5. [[Contrato-Shell-Header-Sidebar]] + [[Cursos-Experiencia-y-Player]]  
6. [[Chat-y-Ayuda-UX]]  
7. [[Indice-Integracion-API]] + [[00-Env-y-Arranque]] para cablear datos reales  

## Código

```text
proyecto/frontend/   → Vite + React
proyecto/frontend/.env.example → VITE_API_URL, VITE_WS_URL
```

← Volver a [[Inicio]]
