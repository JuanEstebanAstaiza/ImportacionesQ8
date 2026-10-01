# 10 - Contrato shell, header y sidebar

Contrato de UI compartido para mantener consistencia visual y funcional entre pantallas.

## Objetivo

Estandarizar la capa superior de interfaz:

- Sidebar de navegacion
- Header contextual
- Area de contenido scrollable

---

## Contrato `SidebarCtrl`

El contrato se define en `types/portal.ts` y ahora incluye acciones globales:

- `onChat`
- `chatCount`
- `onHelp`
- `showHelp`
- `profileSubtitle`

Esto permite que header y sidebar no dependan de estado interno del screen.

---

## Estructura recomendada por pantalla

```text
Shell
  Sidebar(ctrl)
  MainColumn
    Header(ctrl, user)
    Content(scrollable)
```

---

## Reglas de UX aplicadas

1. El contenido inicia visible arriba (sin offset escondido).
2. Header conserva acciones globales consistentes por rol.
3. Areas largas usan contenedor con overflow para mantener sidebar estable.
4. Badges e iconos de estado usan datos reales, no valores estaticos.

---

## Admin shell

El panel admin fue alineado al mismo patron de layout que el resto de roles para evitar que cargue "abajo" y mejorar descubrimiento de modulos.

---

## Proximos desacoples recomendados

1. Extraer `AppHeader` a `app/components/AppHeader.tsx`.
2. Extraer sidebar a componente por rol o configuracion declarativa.
3. Mover breadcrumbs y secciones repetidas a componentes reutilizables.

---

## Referencias

- [[Arquitectura-Frontend]]
- [[Routing-y-Roles-Frontend]]
- [[Chat-y-Ayuda-UX]]

← Volver a [[Indice-Frontend]]
