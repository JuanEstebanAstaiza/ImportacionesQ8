# Fase 5 — Frontend conectado y módulos de operación (2026-07-20 → 2026-08-26)

> **Última actualización:** 2026-10-01 · Reconstruido del historial de git y del código.
> PRs: #8, #9, #10, #11, #13 (rama `visual/week_1`, integrada el 2026-08-26). #12 se cerró y su contenido llegó con #13.

## Objetivo de la fase

Pasar de un backend probado a una **aplicación usable**: frontend conectado a la API y los módulos que una operación real necesita (cursos, documentos, soporte, reputación, ayuda), con el modelo de cobro definitivo.

---

## Cronología

| Fecha | Autor | Entrega | Detalle técnico |
|-------|-------|---------|-----------------|
| 07-20 | JuanEstebanAstaiza | **Fin del cobro al solicitante** (#8) | Flag `COBRO_A_SOLICITANTES=false`; la compra de créditos responde 410; cotizar deja de exigir saldo. Solo pagan las importadoras, por contrato |
| 07-21 | JuanSamuelArbelaez | Auth y negocio conectados en el frontend (#9) | `ResetPasswordForm`, `business.service.ts` (asesores, perfil, órdenes, chat, propuestas con borrador/envío/preaceptación); scripts `seed_importador`, `smoke_auth_flow` |
| 07-25 | JuanSamuelArbelaez | Pantalla de cursos (#10) | `CoursesScreen.tsx` con catálogo, reproductor y editor (datos de prueba) |
| 07-29 | Evelio | **Backend del LMS, notificaciones y métricas** (#11) | `/cursos`, `/mis-cursos`, progreso, `/notificaciones`, `POST /chat/iniciar`, `GET /importadores/metricas`, `GET /asesores/dashboard/stats`. Migración `0005` |
| 07-29 | Evelio | **Seguridad y capacidad** (#11) | Paywall de lecciones, rate limiting, `query_safety`, middleware de seguridad, lock de Redis para migraciones, `safe-url.ts`. Ver [[Auditoria-Seguridad-Capacidad-2026-07-29]] |
| 07-29 | JuanSamuelArbelaez | Cursos del frontend contra la API real | `courses.service.ts`, login con OTP (`LoginOtpForm`), `seed_full.py` |
| 08-05 | JuanSamuelArbelaez | **Módulo documental** (tipo Drive) | Carpetas, archivos, etiquetas, favoritos, papelera lógica, compartir en chats, PDFs automáticos de órdenes. `/documentos/*`. Migraciones `0006`, `0007` |
| 08-05 | JuanEstebanAstaiza | URLs canónicas y rutas sin barra final | `utils/urls.py`, `TrailingSlashNormalizationMiddleware`; regeneración de OpenAPI y Postman |
| 08-05 | JuanSamuelArbelaez | Vídeos de curso alojados en la plataforma | Se eliminan los datos de prueba; Dockerfile del frontend |
| 08-06 | JuanEstebanAstaiza | Configuración pública y avisos salientes | `GET /configuracion-publica` (flags como `MODULO_EDUCATIVO_HABILITADO`), WhatsApp (open-wa) y correo, certificado de curso (`0008`), supervisión de chats por el admin, gestión de asesores |
| 08-06 | JuanEstebanAstaiza | **Certificaciones de plataforma y backup** | CRUD `/admin/certificaciones` con peso publicitario; `GET /admin/backup` (ZIP portable) y `scripts/restaurar_backup.py`. Migración `0009` |
| 08-07 | JuanSamuelArbelaez | Documentos en el frontend | Carpetas de sistema protegidas, rediseño, selector de archivos desde el chat, búsqueda que incluye carpetas |
| 08-07 | JuanEstebanAstaiza | Shipping mark y categorías tolerantes | Marca de embarque = prefijo de empresa + sufijo del cliente (`0010`); comparación de categorías sin tildes/plurales |
| 08-07 | JuanEstebanAstaiza | Límite de subida y volúmenes persistentes | Tope de tamaño con aviso previo en el frontend, GZip, volúmenes de `uploads/` |
| 08-07 | JuanEstebanAstaiza | **Reseñas de empresas** | `/resenas/*` (una por orden entregada, réplica de la empresa, moderación que oculta). Migración `0011` |
| 08-09 | JuanEstebanAstaiza | **Chat interno empresa ↔ asesor** | `POST /chat/interno`; una sola tabla de conversaciones con columna `tipo`. Migración `0012` |
| 08-09 | JuanEstebanAstaiza | Disputas y respuestas del admin | El admin responde como soporte y resuelve disputas; el panel pasa a secciones con URL |
| 08-09 | JuanEstebanAstaiza | **Mesa de soporte por niveles** | Rol `soporte`, tickets con urgencia, cierre, reapertura, escalado y calificación; expediente de verificación de empresas. Migraciones `0013`–`0016` |
| 08-09 | JuanSamuelArbelaez | Corrección de borradores de propuesta | Se conservan MOQ, puerto, plazos y adjuntos del asesor y la empresa |
| 08-10 | JuanEstebanAstaiza | Pedir soporte desde Ayuda | Tarjeta para abrir un ticket |
| 08-26 | JuanEstebanAstaiza | **Centro de ayuda editable** (#13) | Artículos en base de datos, votos, categorías y editor en el panel. Migración `0017` |
| 08-26 | JuanSamuelArbelaez | Estilo de auth | Mejor visibilidad de OTP y restablecer contraseña |

---

## Decisiones de esta fase y por qué

- **Solo se cobra a las importadoras.** El wallet del solicitante queda tras un flag por si se reactiva.
- **URLs canónicas en la base.** Guardar URLs absolutas ataba los registros al entorno donde se crearon (por ejemplo, un Dev Tunnel).
- **CORS como middleware más externo.** El 413 salía sin cabecera CORS y el navegador mostraba un error de CORS en lugar de "archivo demasiado grande".
- **Backup portable en NDJSON.** Sirve igual en MySQL y en SQLite, y no depende de `mysqldump`.
- **Una sola tabla de conversaciones** para negociación, chat interno y soporte. Así mensajes, adjuntos y WebSocket no se duplican. El cliente nunca ve el hilo interno.
- **Microsegundos en las fechas del chat.** MySQL truncaba a segundos y los mensajes desaparecían del contador de no leídos.
- **La urgencia fija el nivel del ticket** (crítica → 3, alta → 2, media y baja → 1). Se asigna al agente de menor nivel suficiente.
- **WhatsApp y correo son "best effort".** Si fallan, nunca rompen una cotización ni un pago.

## Resultado

Al cierre de la fase la aplicación era usable de punta a punta por los cuatro roles (solicitante, importadora, asesor y admin), más el nuevo rol de soporte. Faltaban la identidad de marca, la landing pública y el stack de producción: eso es la [[Fase-6-Zarpi-y-Produccion]].

← [[Cronologia-del-Proyecto]] · [[Indice-Historial]]
