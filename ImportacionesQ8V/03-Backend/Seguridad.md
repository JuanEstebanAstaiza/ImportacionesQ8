# Seguridad del Backend — Zarpi (ImportacionesQ8)

> **Última actualización:** 2026-10-01 · Los controles añadidos después de julio están en [[#Controles añadidos (agosto → octubre 2026)]].

## Descripción general

Documento de referencia único ("fuente de verdad") sobre el blindaje de seguridad implementado en el backend de ImportacionesQ8, consolidando las medidas aplicadas durante la revisión de Semana 2, ampliadas en la Semana 3, reforzadas en la Semana 4 (recuperación de contraseña con OTP + SMTP real, sistema de créditos, doble aceptación mutua), y actualizadas tras la auditoría del **2026-07-13** (débito atómico de créditos, secrets, readiness). Cada punto está verificado con la suite de tests (local y Docker) y referenciado a su implementación real en el código. Informe completo: [[Auditoria-Backend-2026-07-13]].

---

## Resumen ejecutivo

| Categoría | Estado | Detalle |
|---|---|---|
| Inyección SQL | ✅ Blindado | 100% del acceso a datos vía SQLAlchemy ORM con parámetros ligados; sin SQL crudo concatenado en ningún router |
| IDOR (acceso a datos de terceros) | ✅ Blindado | Todas las comprobaciones de propiedad usan claims del JWT (`sub`, `importador_id`), nunca el ID recibido en la URL/body sin verificar |
| Autenticación y sesión | ✅ Blindado | JWT firmado (HS256), auto-registro restringido a `solicitante`, cuentas desactivables (`activo`) |
| Autorización por rol | ✅ Blindado | Dependencias `require_rol`/`require_rol_in` en cada endpoint sensible; principio de mínimo privilegio para `asesor` |
| Fuerza bruta / abuso | ✅ Blindado | Rate limiting (`slowapi`) en `/auth/login` y `/auth/register` |
| Webhooks de terceros (Wompi) | ✅ Blindado | Verificación de firma HMAC-SHA256, fail-closed |
| Condiciones de carrera | ✅ Blindado | Restricciones `UNIQUE` a nivel de base de datos + `UPDATE` condicional atómico (reclamo de cotizaciones y débito de créditos) |
| Exposición de errores internos | ✅ Blindado | Manejador global de excepciones; nunca se filtran tracebacks/detalles internos al cliente |
| CORS | ✅ Blindado | Restringido a orígenes configurados por entorno |
| Fugas de datos entre empresas (multi-tenant) | ✅ Blindado | Claim `importador_id` en el JWT en vez de `Usuario.id == Importador.id` |
| Recuperación de contraseña (Semana 4) | ✅ Blindado | OTP + token de un solo uso, ambos hasheados en BD, expiración corta, sin enumeración de usuarios, envío real vía SMTP |
| Verificación de email en registro + login tardío (2026-07-13) | ✅ Blindado | OTP hasheado; login >72h exige challenge_token + OTP; cuentas admin/asesor/importador nacen verificadas |
| Enumeración de cuentas vía `/auth/forgot-password` | ✅ Blindado | Respuesta `200` genérica idéntica exista o no el email |
| Integridad del sistema de créditos (Semana 4 + fix 2026-07-13) | ✅ Blindado | Débito atómico vía `credito_wallet` (personal u org) + `MovimientoCredito`; `402` si insuficiente |
| Créditos corporativos / multi-tenant org (2026-07-13) | ✅ Blindado | Solo solicitantes; invite restringido a `owner`/`admin` de la org; importadoras sin wallet |
| Dispute room / evidencias (2026-07-13) | ✅ Blindado | Acceso a disputa y evidencias limitado a partes de la orden + admin; revisión de evidencias de perfil solo admin |
| Traducción asistida (2026-07-13) | ✅ Blindado | Traducir mensaje exige ser participante de la conversación (misma regla que leer chat) |
| Congruencia de categoría en propuestas (Semana 4) | ✅ Blindado | Una empresa solo puede responder cotizaciones de su propia `especialidad_producto` |
| Autenticación con Google / hashing Argon2 | 🔜 Roadmap | Documentado como mejora futura, no implementado en esta iteración (ver sección 10) |

---

## 1. Prevención de inyección SQL

- **Sin SQL crudo:** todo el acceso a datos pasa por el ORM de SQLAlchemy (`db.query(...)`, `.filter(...)`, `.update({...})`), que parametriza automáticamente los valores. No existe ningún f-string ni concatenación de strings para construir queries en `routers/`, `services/` ni `utils/`.
- **Filtros de búsqueda JSON:** las búsquedas por especialidad/país en `GET /importadores` (`json_contains_column`) usan `Column.like()` con el valor pasado como parámetro ligado, no interpolado en el string SQL.
- **Validación de UUIDs antes de usarlos en queries:** cualquier ID recibido por path/body se valida con `UUID(valor)` antes de usarse en un filtro; un UUID inválido devuelve `404`/`400` en vez de propagarse a la base de datos.
- **`create_database_if_not_exists` (`database.py`):** el nombre de la base de datos usado en el `CREATE DATABASE` (el único lugar donde se interpola un identificador en SQL) se valida contra una expresión regular estricta (`^[a-zA-Z0-9_]+$`) antes de construir la sentencia, para que no pueda inyectarse SQL vía la variable de entorno `DATABASE_URL`.

---

## 2. Prevención de IDOR (Insecure Direct Object Reference)

El backend tuvo una revisión dedicada a IDOR en la Semana 2, y un refuerzo estructural en la Semana 3 (Fase 0) al desacoplar `Usuario` de `Importador`.

### Regla general
Ningún endpoint confía en un ID recibido en la URL o el body para decidir *qué* datos devolver: siempre se cruza contra la identidad del token (`current_user["user_id"]` o `current_user["importador_id"]`), y solo si coincide con el dueño real del recurso se responde `200`; en caso contrario, `403 Forbidden` (o `404` si además se quiere no confirmar la existencia del recurso).

### Casos verificados (con test dedicado)
| Endpoint | Comprobación de propiedad | Test |
|---|---|---|
| `GET /importadores/{id}/solicitudes-dirigidas`, `/solicitudes-abiertas`, `/ordenes-activas` | `importador_id` del token == `{id}` de la URL | `tests/test_importadores.py::TestBandejaSolicitudesImportador` |
| `PUT /importadores/{id}` | Solo el dueño de esa empresa | `tests/test_perfiles.py::TestPerfilEmpresa` |
| `GET/PUT /ordenes/{id}` | Solicitante dueño o empresa asignada, según el rol | `tests/test_ordenes.py` |
| `GET /pagos/{id}` | Solo el solicitante que generó el pago | `tests/test_pagos.py` |
| `POST /cotizaciones/{id}/reclamar` | Dueño o asesor de la empresa (dirigida/abierta del pool) | `tests/test_asesores.py::TestPoolEmpresaYReclamo` |
| `PUT /importadores/asesores/{id}/estado` | El asesor debe pertenecer a la empresa del dueño autenticado | `tests/test_asesores.py::TestListarYActualizarAsesores` |
| `GET/POST /chat/conversaciones/{id}/mensajes`, WebSocket `/ws/chat/{id}` | Solo el solicitante o la cuenta de empresa de esa conversación (`_verificar_acceso_conversacion`) | `tests/test_chat.py::TestMensajesRest`, `TestWebSocketChat` |
| `PUT /ordenes/{id}/reportar-problema` | Solo el solicitante dueño de la orden | `tests/test_admin.py::TestDisputas` |
| `PUT /importadores/campos-personalizados/{id}`, `DELETE .../{id}` | Solo la empresa que creó el campo | `tests/test_formulario_personalizado.py::TestCrudCamposPersonalizados` |

### Refuerzo estructural (Semana 3, Fase 0)
Antes del desacople de identidad, el backend asumía `Usuario.id == Importador.id` para el rol `importador`. Esto era, en sí mismo, un vector de IDOR latente: no había forma de tener varios usuarios de una misma empresa sin que cada uno pudiera potencialmente suplantar a la empresa completa. La solución:
- `Usuario.importador_id` (FK) desacopla la cuenta de la empresa.
- El JWT incluye el claim `importador_id`, generado por el backend a partir de la base de datos (nunca enviado por el cliente), por lo que no puede falsificarse sin la clave secreta del servidor.
- Todas las comprobaciones de propiedad entre empresas ahora usan `current_user["importador_id"]`, consistente sin importar qué cuenta de la empresa (dueño o asesor) esté autenticada.

---

## 3. Autenticación y gestión de sesión

- **Contraseñas con `bcrypt`** (`passlib`), nunca en texto plano ni con hashes reversibles.
- **JWT firmado con HS256** (`utils/security.py`), con expiración (`exp`) e `iat`; el secreto (`SECRET_KEY`) se configura por variable de entorno, nunca hardcodeado en el repositorio para producción.
- **Cierre del auto-registro de cuentas elevadas (Semana 3):** `POST /auth/register` rechaza cualquier `rol` distinto de `solicitante` con `400 Bad Request`. Antes, cualquiera podía crear una cuenta `admin` o `importador` sin ninguna verificación — el vector de escalamiento de privilegios más crítico encontrado en la revisión.
  - Las cuentas `importador` (dueño / representante legal) solo las crea un admin ya autenticado (`POST /admin/importadores`), junto con la empresa, en una transacción atómica. `POST /importadores` (empresa sin dueño) responde **410 Gone**.
  - Las cuentas `asesor` (operadores) solo las crea la cuenta dueña de su propia empresa (`POST /importadores/asesores`).
  - No existe **ningún** camino, público o de autoservicio, para crear una cuenta `admin`.
- **Cuentas desactivables (`Usuario.activo`, Semana 3):** el login y la renovación de token (`/auth/refresh`) rechazan explícitamente cuentas con `activo=False` con `401 Unauthorized`, incluso si la contraseña es correcta. Permite a un admin revocar el acceso de una cuenta comprometida o de un empleado que deja la empresa, de forma inmediata (`PUT /admin/usuarios/{id}/estado`).
- **Rate limiting (`slowapi`):** `RATE_LIMIT_LOGIN` (por defecto `5/minute` por IP) y `RATE_LIMIT_REGISTER` (por defecto `10/minute` por IP) mitigan ataques de fuerza bruta y registro masivo automatizado.

Ver [[Autenticacion]] para el detalle completo del flujo y los claims del JWT.

---

## 4. Autorización por rol (RBAC)

- **`require_rol(rol)`:** exige un rol exacto (ej. `require_rol("admin")` en todos los endpoints de `/admin/*`).
- **`require_rol_in(*roles)` (Semana 3):** exige que el rol esté en un conjunto permitido, usado para endpoints compartidos entre la cuenta dueña y sus asesores (ej. `GET /cotizaciones/pool-empresa`).
- **Principio de roles en la empresa importadora:** el **dueño** es representante legal y jefe de operadores: puede reclamar del pool, enviar propuestas, gestionar asesores, órdenes y chat post-aceptación. El **asesor** reclama, redacta borradores y negocia hasta el traspaso; no crea otros asesores ni edita el perfil de empresa.
- **Separación estricta admin vs. operación de negocio:** un admin no reemplaza a un dueño de empresa (no puede editar el perfil de una empresa ni enviar propuestas), y viceversa — reduce la superficie de una cuenta admin comprometida.

---

## 5. Protección contra condiciones de carrera (ACID)

| Escenario | Riesgo sin protección | Mitigación real |
|---|---|---|
| Dos webhooks de Wompi concurrentes para el mismo pago | Crear dos órdenes duplicadas | `Orden.cotizacion_id` con `UNIQUE`; el segundo intento falla por `IntegrityError` y se maneja con rollback controlado |
| Dos propuestas del mismo importador a la misma cotización | Doble propuesta o inconsistencia de estado | `UniqueConstraint(cotizacion_id, importador_id)` en `Propuesta`, verificado antes **y** protegido a nivel de base de datos |
| Dos asesores reclamando la misma cotización a la vez (Semana 3) | Ambos "se quedan" con la cotización | `UPDATE ... WHERE asesor_asignado_id IS NULL` (condicional, no *check-then-set* en Python); si `rowcount == 0`, se responde `409 Conflict` al segundo. Verificado en `tests/test_asesores.py::test_reclamo_duplicado_devuelve_409` |
| Webhook de pago reprocesado (reintento de Wompi) | Doble cobro/orden duplicada | Idempotencia explícita: se verifica el estado del `Pago` antes de reprocesar, más el `UNIQUE` de `wompi_payment_id` |

---

## 6. Seguridad de integraciones externas (Wompi)

- **Verificación real de firma HMAC-SHA256** en `POST /pagos/webhook/wompi`, calculada sobre `properties + timestamp + WOMPI_EVENTS_SECRET`.
- **Fail-closed:** sin `WOMPI_EVENTS_SECRET` configurado, o con una firma que no coincide, el webhook responde `403` y **no procesa el evento** — antes, la verificación era un stub que siempre devolvía `True`, permitiendo simular pagos confirmados sin pagar.

Ver [[Pagos-Wompi]] para el detalle completo.

---

## 7. Manejo de errores y exposición de información

- **Manejador global de excepciones** (`main.py`): cualquier excepción no controlada se registra en logs del servidor pero al cliente solo se le responde `{"error": "Error interno del servidor"}` — nunca un traceback, nombre de tabla o detalle de implementación.
- **Mensajes de error de negocio explícitos y controlados:** los `HTTPException` que sí se muestran al cliente (`400`, `403`, `404`, `409`) contienen mensajes útiles pero sin revelar información que ayude a enumerar recursos de otros usuarios (ej. un `404` genérico en vez de distinguir "no existe" de "no es tuyo" cuando aplica).

---

## 8. CORS y transporte

- **CORS restringido** a los orígenes configurados en `config.CORS_ORIGINS` (por entorno), en vez de `*`.
- **HTTPS en producción:** ✅ desde el 2026-09-29/10-01. Caddy termina TLS con certificados de Let's Encrypt renovados solos, añade HSTS y es el único servicio expuesto. Ver [[Despliegue-y-Operacion]].

---

## 9. Recuperación de contraseña segura (Semana 4)

`POST /auth/forgot-password` y `POST /auth/reset-password` reemplazan cualquier flujo de recuperación inseguro con las siguientes protecciones:

- **Nunca se guarda el token ni el OTP en texto plano:** `PasswordResetToken.token_hash` y `.otp_hash` almacenan un hash (`utils/security.hash_token`), igual que las contraseñas; una fuga de la base de datos no permite recuperar el token/OTP original.
- **Expiración corta:** el token/OTP expira a los `PASSWORD_RESET_EXPIRE_MINUTES` (15 minutos por defecto), configurable por entorno.
- **Uso único:** el campo `usado` se marca `True` tras un reseteo exitoso; reutilizar el mismo token/OTP responde `400`.
- **Invalidación de tokens anteriores:** cada nueva solicitud de recuperación invalida los tokens pendientes previos del mismo usuario, evitando que un token viejo filtrado siga siendo válido.
- **Sin enumeración de usuarios:** `POST /auth/forgot-password` responde siempre el mismo mensaje genérico `200`, exista o no el correo en la base de datos — un atacante no puede usar este endpoint para descubrir qué correos están registrados.
- **Rate limiting:** `RATE_LIMIT_FORGOT_PASSWORD` limita intentos repetidos desde la misma IP, igual que login/registro.
- **Envío real por SMTP:** `utils/email.py` envía el correo con el enlace + OTP vía `smtplib` sobre TLS (`SMTP_USE_TLS`), configurado con credenciales de entorno (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, etc.); en ausencia de configuración SMTP (ej. en tests), se degrada a un log del servidor en vez de fallar.

Ver [[Autenticacion]] para el flujo completo con diagrama de secuencia.

---

## 10. Sistema de créditos: integridad financiera interna (Semana 4 + remediación 2026-07-13)

- **Débito atómico en BD (post-auditoría):** al crear una cotización, el saldo se descuenta con un único `UPDATE usuarios SET creditos_balance = creditos_balance - :costo WHERE id = :user_id AND creditos_balance >= :costo`. Si `rowcount != 1` → `402 Payment Required` + rollback (no queda cotización a medias ni saldo negativo bajo concurrencia). Evita el patrón read-check-write en Python. Verificado en `tests/test_health_ready_creditos.py` y `tests/test_creditos.py`.
- **Misma transacción:** el `UPDATE` atómico, la creación de la `Cotizacion` y el `MovimientoCredito` tipo `consumo` ocurren juntos.
- **Idempotencia del webhook de acreditación:** igual que en el modelo anterior de pagos, `wompi_payment_id` es `UNIQUE`, por lo que un reintento del webhook de Wompi no acredita créditos dos veces.
- **Trazabilidad completa:** cada movimiento de crédito (`compra`, `consumo`, `reembolso`) queda registrado en `movimientos_credito` con referencia a la cotización o pago relacionado — nunca se modifica `creditos_balance` sin dejar un registro auditable.
- **Recreación mediada por admin, no por autoservicio:** si una cotización aceptada tuvo un error, ninguna de las partes puede auto-eximirse del costo; solo un `admin` autenticado, vía `PUT /admin/recreaciones/{id}/resolver`, decide la parte responsable y autoriza el reembolso — evita que un solicitante o una empresa se auto-otorguen créditos gratis alegando errores falsos.
- **Congruencia de categoría como control de negocio:** `_validar_congruencia_categoria` impide que una empresa de una industria distinta responda (y potencialmente "robe" o distorsione) una cotización fuera de su especialidad, tanto en modalidad abierta como dirigida.
- **Detalle de remediaciones:** [[Remediaciones-Backend-Jul-2026]].

---

## 11. Roadmap de seguridad (no implementado en esta iteración)

Estas mejoras fueron discutidas con el usuario y se documentan explícitamente como trabajo futuro, no deuda oculta. Parte del backlog también aparece en [[Auditoria-Backend-2026-07-13]]:

| Mejora | Estado | Motivo de posposición |
|---|---|---|
| **Autenticación con Google (OAuth 2.0)** | 🔜 Pendiente | Requiere registro de la app en Google Cloud Console y flujo OAuth adicional; se prioriza completar el flujo de credenciales propio primero |
| **Migración de hashing de contraseñas a Argon2** | 🔜 Pendiente | El backend usa `bcrypt` (`passlib`) actualmente, que sigue siendo seguro; la migración a Argon2 (ganador del Password Hashing Competition) se documenta como mejora incremental, no una vulnerabilidad activa |
| **Auditoría/logging estructurado de acciones administrativas** | 🔜 Pendiente | Ya señalado como pendiente desde la Semana 3 |
| **HTTPS en producción** | ✅ Hecho (2026-10-01) | Caddy + Let's Encrypt + HSTS; backend, MySQL y Redis sin puertos públicos |
| **Revocación real de JWT en logout** | ✅ Hecho (2026-07-14) | `jti` + tabla `jwt_blacklist` (+ Redis opcional); refresh rota el token |
| **JWT de WebSocket fuera del query string** | ✅ Parcial (2026-07-14) | `POST /chat/ws-ticket` + `?ticket=`; `?token=` deprecado por compatibilidad |
| **Rate limits en escritura de negocio** | ✅ Parcial | Cubiertos: auth, mensajes y estimaciones del chat (`RATE_LIMIT_CHAT_MESSAGE`), cursos, contacto de la landing, notificaciones y lecturas públicas. **Pendiente:** `POST /cotizaciones` (lo mitiga en parte el cupo diario por empresa) |

---

## Checklist de seguridad — Estado real (verificado Semana 4 + auditoría 2026-07-13)

- [x] Sin inyección SQL posible (ORM parametrizado en el 100% del acceso a datos)
- [x] IDOR cubierto en todos los endpoints que expuestos por ID (empresa, orden, pago, cotización, conversación, campo personalizado, asesor)
- [x] Auto-registro público restringido a `solicitante`; sin camino de escalamiento a `admin`/`importador`
- [x] Cuentas desactivables de forma inmediata desde el panel admin
- [x] Rate limiting en endpoints de autenticación
- [x] Verificación de firma en webhooks de terceros (fail-closed)
- [x] Condiciones de carrera cubiertas con restricciones de base de datos y `UPDATE` condicional, no con checks en la capa de aplicación
- [x] Débito de créditos atómico (`UPDATE ... WHERE creditos_balance >= costo`) — remediación 2026-07-13
- [x] `SECRET_KEY` no hardcodeada en Compose; rechazo de claves débiles si `APP_ENV=production`
- [x] Sin fuga de detalles internos en errores 500
- [x] CORS restringido por entorno
- [x] Multi-tenant real: una cuenta de una empresa no puede ver/modificar datos de otra empresa aunque adivine un UUID válido
- [x] Recuperación de contraseña con OTP + token hasheados, expiración corta, uso único, sin enumeración de usuarios
- [x] Sistema de créditos con descuento/acreditación atómica y trazabilidad completa (`movimientos_credito`)
- [x] Recreación de cotizaciones mediada por admin (ninguna parte se auto-exime del costo)
- [x] Congruencia de categoría al enviar propuestas (evita respuestas fuera de especialidad)
- [x] HTTPS en producción con HSTS (Caddy + Let's Encrypt) — 2026-10-01
- [ ] Auditoría/logging estructurado de acciones administrativas críticas (activar/desactivar cuentas, resolver disputas) — recomendado para una futura iteración, no implementado aún
- [x] Revocación real de JWT y ticket de un solo uso para WebSocket (2026-07-14); ticket también para el stream SSE de notificaciones (2026-09-29)
- [ ] Rate limit en `POST /cotizaciones` — el resto de escrituras de negocio ya está limitado (ver sección 11)
- [ ] Autenticación con Google (OAuth 2.0) — roadmap, ver sección 11
- [ ] Migración de hashing de contraseñas a Argon2 — roadmap, ver sección 11

---

## Controles añadidos (agosto → octubre 2026)

| Fecha | Control | Dónde |
|-------|---------|-------|
| 2026-08-05 | URLs canónicas: solo se guardan rutas internas, nunca hosts ajenos ni URLs absolutas de otro entorno | `utils/urls.py` |
| 2026-08-07 | Límite de tamaño por ruta (2 MiB JSON, 300 MB subidas) con 413 legible a través de CORS | `utils/security_middleware.py` |
| 2026-08-09 | Rol `soporte` aislado: solo ve tickets; el hilo interno empresa–asesor nunca es visible para el cliente | `routers/chat.py` (`_verificar_acceso_conversacion`) |
| 2026-09-11 | El rol elegido en el login debe coincidir con el de la cuenta (403 si no) | `services/auth_service.py` |
| 2026-09-29 | El tier exigido sale de la empresa, nunca del payload; descuento de puntos con UPDATE condicional | `routers/cotizaciones.py`, `services/tier_service.py` |
| 2026-09-29 | Ticket de un solo uso para el stream SSE de notificaciones (sin JWT en la URL) | `routers/notificaciones.py` |
| 2026-09-29 | Correos con HTML escapado en la plantilla común | `utils/email.py` |
| 2026-09-30 | El WebSocket solo acepta mensajes `texto` y `archivo`: nadie puede forjar un mensaje `sistema` ni una estimación de precio | `routers/chat.py` |
| 2026-09-30 | Las estimaciones de precio se recalculan siempre en el servidor | `services/calculadora_precios.py` |
| 2026-09-30 | Cupo diario con bloqueo de fila al crear cotizaciones dirigidas | `services/cupo_cotizaciones.py` |
| 2026-10-01 | Restauración desde el panel: solo admin, confirmación escrita, verificación SHA-256/CRC/conteos, rechazo de rutas fuera de `uploads/` y `generated_docs/` (zip slip), copia previa automática | `routers/admin.py`, `services/backup_service.py` |
| 2026-10-01 | Modo mantenimiento (503 en todos los workers) mientras se restaura | `services/mantenimiento.py` |

---

## Referencias cruzadas

- [[Autenticacion]] — JWT, claims, roles, rate limiting, registro extendido, recuperación de contraseña con OTP
- [[Pagos-Wompi]] — verificación de firma de webhooks, idempotencia, sistema de créditos
- [[Base-Datos]] — restricciones `UNIQUE` y claves foráneas que sustentan varias de estas protecciones
- [[Despliegue-y-Operacion]] — HTTPS, exposición de puertos y firewall en producción
- [[Backups-y-Restauracion]] — seguridad de las copias y de la restauración
- [[Indice-Calidad]] · [[Auditoria-Backend-2026-07-13]] · [[Remediaciones-Backend-Jul-2026]] — campaña de auditoría y fixes
- [[Tareas-Semana-3]] — Tarea 3.13 (refactor de identidad y cierre de auto-registro)
- [[Tareas-Semana-4]] — detalle de las fases de Semana 4
