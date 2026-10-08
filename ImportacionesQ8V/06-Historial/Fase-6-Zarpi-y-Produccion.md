# Fase 6 — Marca Zarpi y preparación de producción (2026-08-31 → 2026-09-29)

> **Última actualización:** 2026-10-01 · Reconstruido del historial de git y del código.
> PRs: #14 (08-31), #15 (09-08), #16 (09-16), #17, #18 y #19 (09-29, rama `fix/requisitos-funcionales-fix`).

## Objetivo de la fase

Dar al producto su **identidad (Zarpi)**, una cara pública administrable y las reglas de negocio pendientes: tiers del cotizante y comunicación por correo. Además, dejar listo el **stack de producción**.

---

## Cronología

| Fecha | Autor | Entrega | Detalle técnico |
|-------|-------|---------|-----------------|
| 08-31 | JuanSamuelArbelaez | **Incoterm DDP por defecto y precio objetivo multimoneda** (#14) | Columna `moneda_precio_objetivo`; la vitrina de la empresa se oculta si está vacía. Migración `0018` |
| 09-08 | JuanSamuelArbelaez | **Landing con la identidad Zarpi** (#15) | Tipografías, paleta, fondos, modo claro/oscuro; vista inicial sin sesión (`public/brand/*`, `theme.css`) |
| 09-11 | JuanSamuelArbelaez | **El rol elegido en el login se valida** (#16) | Si no coincide con el rol de la cuenta, 403 (los admin quedan exentos) |
| 09-11 | JuanSamuelArbelaez | **Landing administrable por bloques (CMS)** (#16) | `/landing/*`: contenido dinámico, aliados, noticias y formulario de contacto. Editor en `/admin/landing`. Migraciones `0019`, `0020`. `entrypoint.sh` aplica las migraciones antes de arrancar |
| 09-11 → 09-16 | JuanSamuelArbelaez | Modo oscuro y ajustes visuales | Auth, cursos, chats, pantallas legales, ayuda y sidebar |
| 09-17 | JuanEstebanAstaiza | Identidad en el chat y trayectoria de empresas | El chat muestra nombre, rol, empresa y foto de la contraparte; "N proyectos" sale de órdenes entregadas; categoría "Televenta" |
| 09-17 | JuanEstebanAstaiza | **Renombrado ImportacionesQ8 → Zarpi** | Backend, frontend y `scripts/renombrar_marca.py` para el contenido ya guardado |
| 09-17 | JuanSamuelArbelaez | FAQ de la landing | Tarjetas estándar y chevron |
| 09-21 | JuanSamuelArbelaez | **Tiers del cotizante (v1)** | Bronze, Silver, Gold y Élite; puntos ("créditos") para desbloquear cotizaciones dirigidas a empresas más exigentes; perfil público del cotizante; gestión en `/admin/cotizantes`. Migraciones `0021`, `0022` |
| 09-29 | JuanSamuelArbelaez | **Correos masivos** | `POST /admin/correos/masivo` (hasta 500 destinatarios por rol, usuario o correo) y plantilla HTML común de Zarpi para todos los correos |
| 09-29 | JuanEstebanAstaiza | **Tiers y notificaciones (v2)** | El tier mínimo lo fija la empresa y lo hace cumplir el servidor; descuento de puntos atómico; recálculo por umbrales; notificaciones en vivo (SSE con ticket). Migración `0023`. Ver [[18-Tiers-y-Perfil-Cotizante]] y [[16-Notificaciones]] |
| 09-29 | JuanEstebanAstaiza | **Stack de producción** (#18, #19) | `docker-compose.prod.yml` (Caddy es el único servicio público), `Caddyfile` con HTTPS automático y `/api` hacia el backend, `Dockerfile.prod`, `.env.production.example`, `scripts/generar_env_produccion.sh` |

---

## Decisiones de esta fase y por qué

- **Migraciones en `entrypoint.sh` y no en el arranque de la app.** Antes, si fallaban, la app arrancaba con el esquema viejo sin avisar.
- **El tier exigido sale de la empresa, nunca del payload.** Si viniera del cliente, bastaría con enviar "Bronze" para saltarse el bloqueo.
- **Descuento de puntos con UPDATE condicional.** Dos peticiones simultáneas no pueden gastar el mismo punto.
- **Notificaciones después del commit.** No se avisa de algo que luego se deshizo.
- **Ticket para el stream SSE.** `EventSource` no puede enviar cabeceras, así que se evita poner el JWT en la URL.
- **En producción, Caddy delante de todo.**
  - Backend, MySQL y Redis no publican puertos: Docker se salta `ufw`.
  - `FORWARDED_ALLOW_IPS` evita que el rate limit trate a todos los usuarios como una sola IP.
- **`.gitattributes` fuerza LF.** El CRLF de Windows rompía `#!/bin/sh` dentro de los contenedores.

## Pendientes que dejó la fase

- La campaña de correos masivos se marcó "Validation Pending" y no tiene tests.
- Tampoco tienen tests la validación de rol del login ni el CMS de la landing.
- El frontend no consume todavía el stream SSE de notificaciones (`/notificaciones/stream`).
- Configurar a mano en producción: `SMTP_API_KEY` (Resend), llaves reales de Wompi y el DNS de `www`.

Todos están en [[Hoja-de-Ruta]].

← [[Cronologia-del-Proyecto]] · [[Indice-Historial]]
