# Routing y roles (Frontend)

> **Última actualización:** 2026-10-03 · Fuente: `proyecto/frontend/src/app/rutas.ts` y los menús `NAV_*` de `src/app/App.tsx`.

Reglas de navegación por rol del frontend de Zarpi.

## Roles

`solicitante`, `importadora` (cuenta dueña de la empresa, `importador` en el backend), `asesor`, `admin` y `soporte`.

## Cómo funciona la navegación

- **Cada pantalla tiene su URL.** `rutas.ts` define la tabla pantalla ↔ ruta.
  - `rutaDe(pantalla, id)` construye la URL.
  - `destinoDe(pathname)` resuelve la pantalla (y el id, si lo hay) a partir de la URL.
  - `esPantalla()` valida nombres.
- Antes de mostrar una pantalla, `App.tsx` comprueba que el rol activo la tenga permitida (`screenAllowedByRole`); si no, redirige a una permitida.
- El frontend oculta y bloquea vistas, pero **la seguridad real de los datos la aplica el backend**.

---

## Menú lateral por rol

| Rol | Entradas del menú (en orden) |
|-----|------------------------------|
| Solicitante | Dashboard · Cotizaciones · Respuestas · Chats · Órdenes · Cursos · Documentos · Pagos |
| Importadora (dueño) | Dashboard · **Solicitudes** · Asesores · **Mi empresa** · Órdenes · Chats · Cursos · Documentos |
| Asesor | Dashboard · Disponibles · Mis cotizaciones · Chats |
| Admin | Resumen · Empresas · **Asignación** · Usuarios · Cotizantes · Correos · Soporte · Certificaciones · **Respaldos** · Landing · Chats · Documentos |
| Soporte | Bandeja · Tickets · Documentos |

Además, en el header: notificaciones, chats, ayuda (no-admin) y perfil.

## Tabla de rutas

| Pantalla | Ruta | Para |
|----------|------|------|
| `landing` | `/` | Pública |
| `login`, `register`, `reset-password` | `/login`, `/registro`, `/restablecer-password` | Pública |
| `policy-data`, `policy-terms` | `/politica-de-datos`, `/terminos` | Pública |
| `dashboard` | `/inicio` | Solicitante |
| `quotes`, `new-quote`, `quote-detail` | `/cotizaciones`, `/cotizaciones/nueva`, `/cotizaciones/:id` | Solicitante |
| `responses`, `response-detail` | `/respuestas`, `/respuestas/:id` | Solicitante |
| `orders`, `order-detail` | `/ordenes`, `/ordenes/:id` | Solicitante, importadora |
| `importer-profile` | `/empresas/:id` | Ficha pública de una empresa |
| `chats` | `/chats`, `/chats/:conversacion` | Todos los roles con sesión |
| `documentos` | `/documentos` | Todos los roles con sesión |
| `pagos` | `/pagos` | Solicitante |
| `courses` | `/cursos` | Según `MODULO_EDUCATIVO_HABILITADO` |
| `notifications`, `user-profile`, `help-support` | `/notificaciones`, `/perfil`, `/ayuda` | Usuarios con sesión |
| `imp-dashboard`, `imp-quotes`, `imp-advisors`, `imp-profile` | `/empresa`, `/empresa/cotizaciones`, `/empresa/asesores`, `/empresa/perfil` | Importadora |
| `adv-dashboard`, `adv-available`, `adv-my-quotes` | `/asesor`, `/asesor/disponibles`, `/asesor/cotizaciones` | Asesor |
| `create-response` | `/asesor/responder/:cotizacion` | Importadora y asesor (responder o convertir una estimación en propuesta) |
| `admin-dashboard` … `admin-correos` | `/admin`, `/admin/empresas`, `/admin/asignacion`, `/admin/usuarios`, `/admin/cotizantes`, `/admin/soporte`, `/admin/certificaciones`, `/admin/respaldos`, `/admin/landing`, `/admin/correos` | Admin (`/admin/soporte` también soporte) |

---

## Subtítulo del header por rol

Centralizado en `header-profile-subtitle.ts`:

| Rol | Subtítulo |
|-----|-----------|
| solicitante | "Solicitante" |
| importadora | "<empresa> · Empresa importadora" |
| asesor | "<empresa> · Asesor" |
| admin | "Administrador del sistema" |

## Checklist al cambiar rutas

1. Login con cada rol (el rol elegido debe coincidir con el de la cuenta) y pantalla inicial correcta.
2. Menú lateral y header sin pantallas huérfanas.
3. Las URL directas a pantallas no permitidas redirigen a una permitida.
4. Recargar en una URL profunda (p. ej. `/chats/<id>`) vuelve a la misma pantalla.
5. Al añadir una pantalla, actualizar los 5 sitios:
   - tipo `Screen` y tabla de rutas en `rutas.ts`;
   - menú `NAV_*` en `App.tsx`;
   - `screenAllowedByRole` en `App.tsx`;
   - el `if(screen===…)` de render en `App.tsx`;
   - esta nota.

## Referencias

- [[Arquitectura-Frontend]]
- [[Contrato-Shell-Header-Sidebar]]
- [[Pantallas-Solicitante]] · [[Pantallas-Importador]] · [[Pantallas-Admin]]

← Volver a [[Indice-Frontend]]
