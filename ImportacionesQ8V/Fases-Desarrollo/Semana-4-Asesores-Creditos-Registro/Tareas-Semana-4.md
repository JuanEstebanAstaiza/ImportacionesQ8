# Semana 4: Asesores, Créditos, Registro y Blindaje Adicional — ImportacionesQ8

## Descripción general

Cuarta iteración de desarrollo, ampliando el backend a partir de una revisión conjunta con el usuario y su equipo sobre el flujo real de negocio. **Alcance exclusivamente backend + documentación** (endpoints, modelos, reglas de negocio, especificación de pantallas en el vault); `proyecto/frontend` sigue sin existir.

> **Estado de implementación (verificado con 221/221 tests pasando en local y Docker):** todas las fases (1 a 8) están **implementadas y probadas**. Ver [[Seguridad]] para el resumen consolidado de blindaje de seguridad, incluyendo lo agregado esta semana (OTP, créditos, congruencia de categoría).

---

## Resumen de entregables

| Entregable | Módulo | Estado |
|------------|--------|--------|
| Registro diferenciado natural/jurídica + páginas legales placeholder | Backend/Autenticacion | ✅ Completo |
| Recuperación de contraseña con OTP + SMTP real | Backend/Autenticacion | ✅ Completo |
| Sistema de créditos (reemplaza comisión por orden) | Backend/Pagos-Wompi | ✅ Completo |
| Renombrado `trabajador` → `asesor`, redacción/envío separados, congruencia de categoría | Backend/API-Rest | ✅ Completo |
| Doble aceptación mutua, orden automática, traspaso de chat al dueño | Backend/API-Rest | ✅ Completo |
| Catálogo enriquecido de importadores | Backend/API-Rest | ✅ Completo |
| Navegación cruzada cotización/propuesta/orden/chat | Backend/API-Rest | ✅ Completo |
| Documentación completa + suite de tests | Todo el vault | ✅ Completo |

---

## Fase 1 — Registro extendido (persona natural/jurídica) y páginas legales placeholder

**Módulo:** Backend/Autenticacion (`models/usuario.py`, `schemas/auth.py`, `services/auth_service.py`, `routers/legal.py`)

### Descripción
El registro de `solicitante` distingue entre persona natural y persona jurídica, cada una con sus propios campos obligatorios, validados condicionalmente. El registro de `importador` sigue cerrado (Semana 3), pero ahora devuelve un mensaje explícito indicando el camino correcto. Se agregan páginas legales placeholder ("en construcción").

### Cambios implementados
- `Usuario` gana `tipo_persona`, `tipo_documento`, `numero_documento`, `nit`, `razon_social`, `apellido`, `indicativo_pais_telefono`, `acepto_politica_datos`, `fecha_aceptacion_politica`.
- `RegistroRequest` valida condicionalmente con un `model_validator` de Pydantic: persona jurídica exige `nit` + `razon_social`; persona natural exige `numero_documento` + `tipo_documento` + `apellido`; ambas exigen teléfono + indicativo y `acepto_politica_datos=True`.
- `POST /auth/register` con `rol="importador"` responde `400` con el mensaje: *"Contáctese con el equipo administrativo para registrar tu empresa importadora"*.
- Nuevo router `routers/legal.py`: `GET /legal/politica-tratamiento-datos` y `GET /legal/terminos-condiciones`, placeholder "En construcción...".

### Criterios de aceptación
- [x] Persona jurídica puede registrarse con `nit` + `razon_social`; falla `422` sin ellos
- [x] Persona natural puede registrarse con `numero_documento` + `apellido`; falla `422` sin ellos
- [x] El registro sin `acepto_politica_datos=True` falla `422`
- [x] `POST /auth/register` con `rol="importador"` devuelve el mensaje placeholder exacto
- [x] `GET /legal/politica-tratamiento-datos` y `GET /legal/terminos-condiciones` responden `200` con contenido placeholder
- [x] Tests en `tests/test_auth.py` (`TestRegistroPersonaNatural`, `TestRegistroPersonaJuridica`, `TestLegalPlaceholders`)

---

## Fase 2 — Recuperación de contraseña con OTP + SMTP real

**Módulo:** Backend/Autenticacion (`models/password_reset.py`, `utils/email.py`, `utils/security.py`, `routers/auth.py`)

### Descripción
Recuperación de contraseña de doble factor: un enlace con token y un código OTP de 6 dígitos, ambos enviados por correo electrónico real (SMTP configurable), ambos de un solo uso y con expiración corta.

### Cambios implementados
- Nuevo modelo `PasswordResetToken(usuario_id, token_hash, otp_hash, expira_en, usado, fecha_creacion)` — token y OTP se guardan **hasheados**, nunca en texto plano.
- `utils/email.py::enviar_correo` envía vía `smtplib` con TLS, configurado por `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_USE_TLS`; se degrada a log si no hay configuración SMTP (tests/desarrollo).
- `POST /auth/forgot-password` `{email}` — genera OTP + token, invalida tokens anteriores del usuario, envía correo, responde `200` genérico siempre (sin enumeración de usuarios). Rate-limited (`RATE_LIMIT_FORGOT_PASSWORD`).
- `POST /auth/reset-password` `{token, otp, nueva_password}` — valida token+OTP+expiración+no usado, actualiza `password_hash`, marca el token usado.

### Criterios de aceptación
- [x] Flujo feliz: solicitar recuperación, recibir OTP+token, resetear contraseña, iniciar sesión con la nueva
- [x] OTP incorrecto o token inválido rechazados con `400`
- [x] Token expirado rechazado con `400`
- [x] Reutilizar el mismo token dos veces falla en el segundo intento
- [x] Nueva solicitud invalida tokens anteriores del mismo usuario
- [x] Respuesta idéntica (`200`) exista o no el correo en la base de datos
- [x] 8 tests automatizados en `tests/test_password_reset.py`

---

## Fase 3 — Sistema de créditos (reemplaza la comisión por orden)

**Módulo:** Backend/Pagos-Wompi (`models/credito.py`, `models/solicitud_recreacion.py`, `routers/pagos.py` → `creditos_router`, `routers/cotizaciones.py`, `routers/admin.py`)

### Descripción
El pago vía Wompi deja de estar ligado a "aceptar una orden" (comisión) y pasa a ser **compra de créditos**, consumidos por el solicitante al crear cotizaciones (costo distinto para modalidad abierta vs. dirigida). La plataforma **no** cobra por la orden en sí — solo conecta las partes.

### Cambios implementados
- `Usuario.creditos_balance` (saldo) + nuevo modelo `MovimientoCredito(usuario_id, tipo["compra","consumo","reembolso"], monto, cotizacion_id, pago_id, descripcion, fecha)`.
- Config: `CREDITO_COSTO_COTIZACION_ABIERTA`, `CREDITO_COSTO_COTIZACION_DIRIGIDA`, `CREDITO_USD_POR_UNIDAD`, `CREDITO_BONO_REGISTRO` (bono inicial al registrarse).
- `POST /creditos/comprar` genera checkout Wompi para recargar créditos; el webhook `POST /pagos/webhook/wompi` acredita créditos (`MovimientoCredito` tipo `compra`) en vez de crear una orden.
- `POST /cotizaciones` valida `creditos_balance >= costo_segun_modalidad` **antes** de insertar; si no alcanza, `402 Payment Required`; si alcanza, descuenta y registra el movimiento en la misma transacción atómica.
- `GET /creditos/saldo` y `GET /creditos/movimientos` para consultar saldo e historial.
- **Recreación mediada por admin** (concepto de cotización "one-time"): `POST /cotizaciones/{id}/solicitar-recreacion` (solicitante o asesor/dueño asignado) reporta un error de negociación; `GET /admin/recreaciones` y `PUT /admin/recreaciones/{id}/resolver` permiten al admin decidir la parte responsable real y, si es la empresa importadora, reembolsar los créditos (exime al solicitante del costo de la nueva cotización).
- La cotización original queda `cancelada_por_error` con `motivo_cancelacion`.

### Criterios de aceptación
- [x] Comprar créditos exitosamente vía checkout Wompi; el webhook acredita el saldo correcto de forma idempotente
- [x] Crear cotización abierta/dirigida descuenta los créditos correctos según modalidad
- [x] Saldo insuficiente responde `402` y no crea la cotización ni descuenta nada
- [x] Solicitar recreación solo lo puede hacer el dueño de la cotización o el asesor/dueño asignado
- [x] Solo un admin resuelve la solicitud; si atribuye el error a la empresa, se reembolsan créditos
- [x] Una solicitud ya resuelta no puede resolverse de nuevo
- [x] Tests en `tests/test_creditos.py` y `tests/test_recreacion_cotizacion.py`

---

## Fase 4 — Renombrar `trabajador` → `asesor`, redacción/envío separados y congruencia de categoría

**Módulo:** Backend completo (modelos, routers, schemas, tests)

### Descripción
El rol `trabajador` se renombra formalmente a `asesor` en todo el backend. Además, se separa la redacción de la propuesta (asesor) de su envío formal (dueño de la empresa), y se valida que la especialidad de la empresa sea congruente con la línea de producto de la cotización antes de poder responder.

### Cambios implementados
- Renombrado consistente: `ROLES_VALIDOS`, `require_rol`/`require_rol_in`, rutas (`/importadores/asesores`, `/asesores/me/cotizaciones`), columna `asesor_asignado_id` en `Cotizacion` y `Orden`, y todos los tests (`test_asesores.py`).
- `_validar_congruencia_categoria`: al enviar una propuesta (dirigida o abierta), se valida que `Importador.especialidad_producto` contenga `Cotizacion.linea_producto`; si no coincide, `400 Bad Request` (ej. una empresa de tecnología no puede responder una cotización de alimentos).
- `Propuesta` gana el estado `borrador` y el campo `creado_por_usuario_id`.
- `POST /cotizaciones/{id}/propuestas/borrador` (asesor asignado) crea/actualiza un borrador, no visible para el solicitante.
- `PUT /propuestas/{id}` (asesor dueño del borrador) edita mientras esté en `borrador` o ya `enviada` (para reflejar ajustes negociados por chat).
- `POST /cotizaciones/{id}/propuestas/enviar` (dueño de la empresa) transiciona `borrador → pendiente` tras la validación de congruencia; desde aquí el solicitante puede verla.

### Criterios de aceptación
- [x] Una empresa de una categoría no puede responder cotizaciones de otra categoría (`400`)
- [x] El asesor asignado puede crear y editar un borrador; el borrador no es visible para el solicitante
- [x] Un asesor no asignado no puede crear un borrador para esa cotización
- [x] Solo el dueño (no el asesor) puede enviar la propuesta al solicitante
- [x] Un asesor no puede enviar su propio borrador directamente
- [x] Tests en `tests/test_asesores.py` (`TestCongruenciaCategoria`, `TestBorradorYEnvio`)

---

## Fase 5 — Doble aceptación mutua, orden automática y traspaso de chat al supervisor

**Módulo:** Backend/API-Rest (`routers/cotizaciones.py`, `routers/ordenes.py`, `models/propuesta.py`, `models/chat.py`)

### Descripción
Ni el solicitante ni la empresa pueden finalizar una propuesta unilateralmente: ambos deben marcar su lado de aceptación. Al completarse ambos lados, se crea la orden automáticamente (sin pago de por medio — la plataforma solo conecta) y el chat se traspasa de el/la asesor(a) al **dueño de la empresa** (supervisor), quien de ahí en adelante actualiza el estado de la orden para que el solicitante vea el progreso.

### Cambios implementados
- `Propuesta` gana `preaceptada_por_solicitante` y `preaceptada_por_empresa` (booleanos).
- `POST /propuestas/{id}/pre-aceptar` — el solicitante marca su lado; el asesor asignado o el dueño marcan el lado empresa. Revertible mientras el otro lado no haya aceptado.
- Al completarse ambos flags (en cualquier orden), en la misma transacción: la propuesta pasa a `aceptada`, las demás propuestas de esa cotización a `rechazada`, la cotización a `cotizacion_aceptada`, se crea la `Orden` automáticamente heredando `asesor_asignado_id`/precio/condiciones de la propuesta final, se traspasa `ConversacionChat.importador_usuario_id` al dueño y se completa `ConversacionChat.orden_id`, y se envía un mensaje de sistema (`tipo="sistema"`) anunciando el traspaso.
- `POST /propuestas/{id}/aceptar` (endpoint previo) ahora solo abre el chat con el asesor asignado, sin finalizar nada.
- **Se elimina** `POST /ordenes/crear-orden` (la orden ya no depende de un pago).

### Criterios de aceptación
- [x] Pre-aceptación de un solo lado no finaliza la propuesta ni crea la orden
- [x] Ambos lados aceptando finalizan la propuesta, crean la orden y traspasan el chat
- [x] Las demás propuestas de la cotización quedan `rechazada` automáticamente
- [x] La reversión de la pre-aceptación de un lado es posible mientras el otro no haya aceptado
- [x] `POST /ordenes/crear-orden` ya no existe (`405 Method Not Allowed`)
- [x] Solo las partes autorizadas (solicitante, asesor asignado o dueño) pueden pre-aceptar
- [x] Tests en `tests/test_doble_aceptacion.py`, `tests/test_propuestas.py::TestPreaceptarPropuesta`, `tests/test_ordenes.py::TestOrdenAutomaticaPorDobleAceptacion`

---

## Fase 6 — Catálogo enriquecido del dashboard del solicitante

**Módulo:** Backend/API-Rest (`models/importador.py`, `routers/importadores.py`)

### Descripción
El dashboard del solicitante deja de depender de una búsqueda simple por filtros: ahora puede navegar el catálogo por mejor calificación, agrupado por categoría, o filtrando por empresas certificadas ("socio verificado").

### Cambios implementados
- `Importador` gana `verificado` (Boolean, default `False`), independiente del campo `estado`. `POST /admin/importadores/{id}/verificar` ahora también fija `verificado=True`.
- `GET /importadores/destacados` — top N por `calificacion_promedio` desc.
- `GET /importadores/por-categoria` — agrupado por `especialidad_producto` (`{categoria: [importadores]}`).
- `GET /importadores/certificados` — filtro `verificado=True`.
- `GET /importadores` gana `orden=calificacion|reciente` y `certificado=true/false`, sin romper los filtros existentes (`especialidad`, `pais`).

### Criterios de aceptación
- [x] `/importadores/destacados` retorna los importadores mejor calificados, en orden
- [x] `/importadores/por-categoria` agrupa correctamente por especialidad
- [x] `/importadores/certificados` solo retorna empresas con `verificado=true`
- [x] `/importadores` respeta los nuevos parámetros de orden y filtro sin romper compatibilidad
- [x] Tests en `tests/test_importadores.py::TestCatalogoEnriquecido`

---

## Fase 7 — Navegación cruzada entre cotización, propuesta, orden y chat

**Módulo:** Backend/API-Rest (`schemas/cotizacion.py`, `schemas/orden.py`, `models/cotizacion.py`, `models/propuesta.py`, `models/orden.py`)

### Descripción
Desde cualquier cotización, propuesta, orden o chat, el frontend debe poder "saltar" a las entidades relacionadas sin peticiones adicionales de búsqueda.

### Cambios implementados
- `CotizacionResponse` incluye `conversacion_id` (si existe) y `contacto_asignado` (`{nombre, foto_url, whatsapp}` del asesor/dueño asignado, si hay propuesta `enviada`/`aceptada`; `null` si aún no hay respuesta).
- Para cotizaciones abiertas: la lista de propuestas incluye el contacto del asesor de cada una, para poder chatear antes de elegir oferta.
- `PropuestaResponse` incluye `contacto_asesor` y `cotizacion_id`.
- `OrdenResponse` incluye `conversacion_id`.
- `ConversacionChat.orden_id` queda poblado correctamente tras el traspaso de la Fase 5.

### Criterios de aceptación
- [x] Desde una cotización dirigida sin respuesta, `contacto_asignado` es `null`
- [x] Desde una cotización con propuesta enviada/aceptada, `contacto_asignado` trae los datos de contacto correctos
- [x] Desde una propuesta se puede obtener el `cotizacion_id` y el contacto del asesor
- [x] Desde una orden se puede obtener el `cotizacion_id` y el `conversacion_id` del chat asociado
- [x] Verificado en los tests existentes de `test_cotizaciones.py`, `test_propuestas.py` y `test_ordenes.py` (aserciones de los nuevos campos)

---

## Fase 8 — Documentación final y suite de tests completa

**Módulo:** Todo el vault de Obsidian

### Descripción
Consolidar toda la documentación del vault con el estado real de la Semana 4, y confirmar que la suite completa de tests pasa en local y en Docker antes de cerrar la iteración.

### Cambios implementados
- Esta nota (`Tareas-Semana-4.md`) documentando las 8 fases con sus criterios de aceptación.
- `Backend/Base-Datos.md`, `Backend/API-Rest.md`, `Backend/Pagos-Wompi.md`, `Backend/Autenticacion.md` actualizados con los modelos, endpoints y flujos nuevos.
- `Backend/Seguridad.md` ampliado con las secciones de recuperación de contraseña con OTP, integridad del sistema de créditos, y un roadmap explícito (Google OAuth, migración a Argon2, auditoría de acciones administrativas, HTTPS en producción).
- `00-Index-y-Navegacion/README.md` y `Mapa-Conexiones-Obsidian.md` actualizados con la Semana 4.

### Criterios de aceptación
- [x] Todas las notas de `Backend/` reflejan el esquema y los endpoints reales de la Semana 4
- [x] `Seguridad.md` incluye las nuevas protecciones y un roadmap explícito de lo que queda pendiente
- [x] El índice y el mapa de conexiones del vault referencian la Semana 4
- [x] Suite completa de tests: **221/221 pasando** en local y en Docker (`docker compose run --rm --build tests`)

---

## Resumen de endpoints nuevos/modificados — Semana 4

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/forgot-password` | Solicitar recuperación de contraseña (OTP + enlace) |
| POST | `/auth/reset-password` | Confirmar recuperación con token + OTP |
| GET | `/legal/politica-tratamiento-datos` | Placeholder legal |
| GET | `/legal/terminos-condiciones` | Placeholder legal |
| POST | `/creditos/comprar` | Comprar créditos vía Wompi |
| GET | `/creditos/saldo` | Saldo de créditos |
| GET | `/creditos/movimientos` | Historial de movimientos de créditos |
| POST | `/cotizaciones/{id}/solicitar-recreacion` | Solicitar recreación de una cotización aceptada por error |
| GET | `/admin/recreaciones` | Listar solicitudes de recreación (admin) |
| PUT | `/admin/recreaciones/{id}/resolver` | Resolver solicitud de recreación (admin) |
| POST | `/importadores/asesores` | Crear cuenta de asesor (renombrado de `/trabajadores`) |
| POST | `/cotizaciones/{id}/propuestas/borrador` | Crear/editar borrador de propuesta (asesor) |
| PUT | `/propuestas/{id}` | Editar propuesta (asesor dueño del borrador) |
| POST | `/cotizaciones/{id}/propuestas/enviar` | Enviar propuesta al solicitante (dueño) |
| POST | `/propuestas/{id}/pre-aceptar` | Marcar pre-aceptación (doble aceptación mutua) |
| GET | `/importadores/destacados` | Catálogo: mejor calificados |
| GET | `/importadores/por-categoria` | Catálogo: agrupado por categoría |
| GET | `/importadores/certificados` | Catálogo: empresas verificadas |
| ~~POST /ordenes/crear-orden~~ | — | **Eliminado**: la orden se crea automáticamente por doble aceptación |

---

## Notas y decisiones de negocio confirmadas

- La plataforma **solo conecta** solicitantes con empresas importadoras; **no se responsabiliza** del cumplimiento de la orden una vez pactada entre las partes. El módulo de órdenes existe a discreción de ambas partes para dar seguimiento.
- Los montos exactos de créditos (costo por modalidad, tasa de conversión USD↔crédito) son una decisión de negocio ajustable sin tocar código, vía variables de entorno (`config.py`/`.env`).
- Autenticación con Google OAuth y migración de hashing a Argon2 quedan documentadas como roadmap en [[Seguridad]], no implementadas en esta iteración.

---

## Referencias cruzadas

- [[Autenticacion]] — registro extendido, recuperación de contraseña con OTP
- [[Pagos-Wompi]] — sistema de créditos, recreación mediada por admin
- [[Base-Datos]] — esquema completo actualizado
- [[API-Rest]] — endpoints completos y navegación cruzada
- [[Seguridad]] — blindaje consolidado y roadmap
- `Fases-Desarrollo/Semana-3-Chat-y-Pulido/Tareas-Semana-3.md` — antecedente (panel de empresa, formulario dinámico)
