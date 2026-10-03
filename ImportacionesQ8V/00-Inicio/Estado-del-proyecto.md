# Estado del proyecto

> **Última actualización:** 2026-10-03 · **Zarpi está en producción** (droplet de DigitalOcean, HTTPS con Caddy).
> Línea de tiempo completa: [[Cronologia-del-Proyecto]] · Próximos pasos: [[Hoja-de-Ruta]].

---

## Resumen

Zarpi conecta a quienes quieren importar (solicitantes) con empresas importadoras. El diferenciador es la **doble modalidad de cotización**: dirigida a una empresa, o abierta y repartida a la red por país y categoría. El sitio está en producción con backend, frontend y operación completos:
- **Roles:** solicitante, importadora (cuenta dueña), asesor, admin y soporte.
- **Operación:** backups y restauración desde el panel.

| Área | Estado |
|------|--------|
| Backend (FastAPI) | ✅ Completo: 212 operaciones REST + WebSocket, 25 migraciones, 706 tests verdes |
| Frontend (Vite + React) | ✅ Completo y conectado a la API: 40 pantallas con URL propia, modo claro/oscuro |
| Producción | ✅ Docker Compose + Caddy (HTTPS automático) en un droplet de DigitalOcean desde el 2026-10-01 |
| Copias de seguridad | ✅ Automatizables por cron; restauración desde el panel. Falta activar cron y copia externa (ver [[Hoja-de-Ruta]]) |
| Validación de negocio | ⬜ Empieza con el lanzamiento: metas en [[Hoja-de-Ruta]] |

---

## Módulos

| Módulo | Backend | Frontend | Desde | Documentación |
|--------|:-------:|:--------:|-------|---------------|
| Registro, login con rol, OTP, recuperación de contraseña | ✅ | ✅ | jul–sep 2026 | [[02-Auth]] · [[Autenticacion]] |
| Cotizaciones dirigidas y abiertas, matching por país y categoría | ✅ | ✅ | jul 2026 | [[05-Cotizaciones-y-Propuestas]] · [[Matching-Cotizaciones]] |
| **Asignación de abiertas a máx. 3 empresas** (manual en el piloto), propuestas selladas, comparador sin orden por precio | ✅ | ✅ | 2026-10-03 | [[23-Asignacion-de-Solicitudes]] |
| **Bitácora de eventos** con montos en COP (TRM oficial) y **panel de la empresa** | ✅ | ✅ | 2026-10-03 | [[24-Eventos-y-Panel-Empresa]] |
| Multimoneda en precio objetivo, DDP por defecto, shipping mark | ✅ | ✅ | ago 2026 | [[05-Cotizaciones-y-Propuestas]] |
| **Límite diario de cotizaciones por empresa** | ✅ | ✅ | 2026-09-30 | [[19-Limite-Diario-Cotizaciones]] |
| Propuestas: borrador del asesor, envío del dueño, doble aceptación, orden automática | ✅ | ✅ | jul 2026 | [[05-Cotizaciones-y-Propuestas]] |
| Órdenes y seguimiento del embarque | ✅ | ✅ | jul 2026 | [[06-Ordenes]] |
| Chat en tiempo real: negociación, interno empresa–asesor y soporte | ✅ | ✅ | jul–ago 2026 | [[08-Chat-y-WebSocket]] · [[Chat-WebSocket]] |
| **Calculadora de precios en el chat y conversión a propuesta** | ✅ | ✅ | 2026-09-30 | [[20-Calculadora-Precios-Chat]] |
| Asesores y reparto de cotizaciones | ✅ | ✅ | jul 2026 | [[03-Usuarios-Asesores-y-Perfil]] |
| Tiers del cotizante y desbloqueo con puntos | ✅ | ✅ | sep 2026 | [[18-Tiers-y-Perfil-Cotizante]] |
| Reseñas y certificaciones de empresas | ✅ | ✅ | ago 2026 | [[04-Importadores]] |
| Módulo documental (tipo Drive) | ✅ | ✅ | ago 2026 | [[17-Documentos-y-Multimedia]] |
| Cursos (LMS) y certificados | ✅ | ✅ | jul–ago 2026 | [[15-Cursos-LMS]] |
| Notificaciones in-app, correo y WhatsApp | ✅ | ✅ (SSE en vivo pendiente en el frontend) | jul–sep 2026 | [[16-Notificaciones]] |
| Mesa de soporte por niveles y centro de ayuda | ✅ | ✅ | ago 2026 | [[21-Ayuda-y-Soporte]] |
| Landing pública administrable (CMS) | ✅ | ✅ | sep 2026 | [[22-Landing-CMS]] |
| Panel admin: empresas, usuarios, cotizantes, correos masivos, soporte, certificaciones, **respaldos**, landing | ✅ | ✅ | ago–oct 2026 | [[12-Admin]] · [[Pantallas-Admin]] |
| Copias de seguridad y restauración | ✅ | ✅ | ago 2026 / 2026-10-01 | [[Backups-y-Restauracion]] |
| Pagos (Wompi) | ✅ | ✅ | jul 2026 | [[07-Creditos-y-Pagos]]: en modo simulado; el solicitante no paga por cotizar |
| Organizaciones, disputas, referidos, traducción | ✅ | parcial | jul 2026 | [[Features-Valor-Jul-2026]] |

---

## Decisiones vigentes

- **Monetización:** no se cobra al solicitante (`COBRO_A_SOLICITANTES=false`). El ingreso viene de las importadoras, por contrato o suscripción.
- **Marca:** el producto se llama **Zarpi** desde el 2026-09-17. El repositorio, el vault y algunos nombres técnicos (base `importacionesq8`) conservan el nombre original.
- **Producción:** Caddy es el único servicio expuesto. Las migraciones corren en el arranque del contenedor del backend.

## Calidad

- **Tests:** 706 casos en 46 archivos (`pytest`), todos verdes el 2026-10-03. La CI de GitHub corre la suite del backend en Docker en cada cambio de `proyecto/backend/`.
- **Seguridad:**
  - Auditorías de julio de 2026 y OWASP ~92/100 ([[Indice-Calidad]]).
  - Controles posteriores: HTTPS con HSTS, rate limiting, tickets para WebSocket y SSE, modo mantenimiento al restaurar, validación de rutas en ZIPs subidos. Ver [[Seguridad]].
- **Carga:** 1000 usuarios concurrentes y 100 operaciones simultáneas ([[Pruebas-Carga-1000-Concurrentes]]).

## Cómo verificar

- **Local:** [[00-Env-y-Arranque]].
- **Producción:** `bash scripts/diagnostico_despliegue.sh` y `https://<dominio>/api/health/ready`. Ver [[Despliegue-y-Operacion]].

## Lecturas relacionadas

- Resumen para stakeholders: [[Resumen-Ejecutivo]]
- Historial por etapas: [[Indice-Historial]]
- Negocio: [[Modelo-Negocio]] · [[Metricas-MVP]]
