# Frontend UI — índice

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
| [[08-Arquitectura-Frontend]] | Mapa de arquitectura y estrategia de desacople |
| [[09-Routing-y-Roles-Frontend]] | Reglas de navegacion y guardas por rol |
| [[10-Contrato-Shell-Header-Sidebar]] | Contrato comun de layout, header y sidebar |
| [[11-Cursos-Experiencia-y-Player]] | Flujo de cursos, modal player y auto-avance |
| [[12-Chat-y-Ayuda-UX]] | Patrones UX de chat y soporte |

## Orden recomendado

1. [[Wireframes]]  
2. [[UX-UI-Guia]]  
3. Pantallas del rol que implementes  
4. [[08-Arquitectura-Frontend]] y [[09-Routing-y-Roles-Frontend]]  
5. [[10-Contrato-Shell-Header-Sidebar]] + [[11-Cursos-Experiencia-y-Player]]  
6. [[12-Chat-y-Ayuda-UX]]  
7. [[Indice-Integracion-API]] + [[00-Env-y-Arranque]] para cablear datos reales  

## Código

```text
proyecto/frontend/   → Vite + React
proyecto/frontend/.env.example → VITE_API_URL, VITE_WS_URL
```

← Volver a [[Inicio]]
