# 08 - Arquitectura Frontend

Mapa de arquitectura del frontend actual, con foco en el proceso de desacople del monolito de app.

## Stack

- React + TypeScript + Vite
- UI mixta:
  - componentes de layout y vistas en app propia
  - componentes de cursos con librerias tipo shadcn/radix
- Cliente API centralizado para Bearer y base URL

---

## Estructura principal

```text
proyecto/frontend/src/
  app/
    App.tsx
    utils/
      header-profile-subtitle.ts
  features/
    courses/
      CoursesScreen.tsx
    help/
      help-support-content.ts
  services/
    api-client.ts
    auth.service.ts
    business.service.ts
    admin.service.ts
  types/
    portal.ts
```

---

## Responsabilidades por capa

| Capa | Responsabilidad | Archivo(s) |
|------|------------------|------------|
| app | Orquestacion de estado global de UI, navegacion por rol, shell de pantallas | App.tsx |
| features | Flujos de negocio por dominio | features/courses, features/help |
| services | Integracion HTTP/WS y transformacion de datos | services/*.ts |
| types | Contratos compartidos de UI y datos | types/*.ts |

---

## Estado actual del desacople

El frontend venia con alta concentracion de logica en App.tsx. En esta fase se inicio una separacion incremental:

1. Logica de subtitulo de perfil movida a `app/utils/header-profile-subtitle.ts`.
2. Contenido y filtros de ayuda movidos a `features/help/help-support-content.ts`.
3. App.tsx mantiene composicion y estado, pero con menos datos hardcodeados en componente.

---

## Lineamientos para seguir desacoplando

1. Extraer componentes puros sin estado global primero (Header, bloques de soporte visual, cards).
2. Extraer hooks de estado por dominio (`useChatState`, `useNotificationsState`, `useRoleNavigation`).
3. Reducir dependencias cruzadas entre vistas con contratos en `types/`.
4. Mantener build verde en cada paso (`npm run build`).

---

## Riesgos y mitigacion

| Riesgo | Impacto | Mitigacion |
|------|---------|------------|
| Romper navegacion por rol | Alto | Tests manuales por rol en rutas criticas |
| Desalinear datos de header/chat | Medio | Mantener `SidebarCtrl` como contrato unico |
| Regresiones visuales en layouts | Medio | Validar shell responsivo en desktop y mobile |

---

## Referencias

- [[Indice-Frontend]]
- [[Routing-y-Roles-Frontend]]
- [[Contrato-Shell-Header-Sidebar]]

← Volver a [[Indice-Frontend]]
