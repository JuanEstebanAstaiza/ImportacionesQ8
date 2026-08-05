# 09 - Routing y roles (Frontend)

Reglas de navegacion por rol implementadas en frontend para controlar acceso de vistas sin tocar backend.

## Roles soportados

- solicitante
- importadora
- asesor
- admin

---

## Enfoque de navegacion

La app usa estado interno de pantalla (screen state) con guardas por rol. Antes de navegar, se valida que la pantalla exista en el set permitido para el rol activo.

## Principio clave

- El frontend puede ocultar y bloquear vistas no permitidas.
- La seguridad real de datos sigue dependiendo del backend.

---

## Mapa resumido de accesos

| Rol | Pantallas principales |
|-----|------------------------|
| solicitante | dashboard, cotizaciones, ordenes, chats, cursos, ayuda |
| importadora | imp-dashboard, imp-cotizaciones, imp-propuestas, imp-ordenes, chats, cursos, ayuda |
| asesor | adv-dashboard, adv-cotizaciones, adv-ordenes, chats, cursos, ayuda |
| admin | admin-dashboard, usuarios, organizaciones, metricas, auditoria |

---

## Header y acciones globales

- Chat en header: redirige a pantalla de chat del rol.
- Badge de chat: usa contador dinamico (notificaciones + no leidos por conversacion).
- Ayuda: visible para no-admin; oculto para admin.

---

## Caso especial de subtitulo por rol

Regla actual centralizada:

- solicitante: "Solicitante"
- importadora: "<empresa> · Empresa importadora"
- asesor: "<empresa> · Asesor"
- admin: "Administrador del sistema"

Implementado en `header-profile-subtitle.ts`.

---

## Checklist de validacion por cambios de rutas

1. Login por cada rol y landing correcta.
2. Navegacion lateral y header sin pantallas huerfanas.
3. Boton Chat abre vista de chat correcta por rol.
4. Boton Ayuda visible solo en no-admin.
5. Accesos directos invalidos son redirigidos a pantalla permitida.

---

## Referencias

- [[08-Arquitectura-Frontend]]
- [[10-Contrato-Shell-Header-Sidebar]]

← Volver a [[Indice-Frontend]]
