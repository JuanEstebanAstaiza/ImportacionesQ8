# Seguridad del Backend — ImportacionesQ8

## Descripción general

Documento de referencia único ("fuente de verdad") sobre el blindaje de seguridad implementado en el backend de ImportacionesQ8, consolidando las medidas aplicadas durante la revisión de Semana 2 y ampliadas en la Semana 3. Cada punto está verificado con la suite de tests (**159/159 pasando en local y Docker**) y referenciado a su implementación real en el código.

---

## Resumen ejecutivo

| Categoría | Estado | Detalle |
|---|---|---|
| Inyección SQL | ✅ Blindado | 100% del acceso a datos vía SQLAlchemy ORM con parámetros ligados; sin SQL crudo concatenado en ningún router |
| IDOR (acceso a datos de terceros) | ✅ Blindado | Todas las comprobaciones de propiedad usan claims del JWT (`sub`, `importador_id`), nunca el ID recibido en la URL/body sin verificar |
| Autenticación y sesión | ✅ Blindado | JWT firmado (HS256), auto-registro restringido a `solicitante`, cuentas desactivables (`activo`) |
| Autorización por rol | ✅ Blindado | Dependencias `require_rol`/`require_rol_in` en cada endpoint sensible; principio de mínimo privilegio para `trabajador` |
| Fuerza bruta / abuso | ✅ Blindado | Rate limiting (`slowapi`) en `/auth/login` y `/auth/register` |
| Webhooks de terceros (Wompi) | ✅ Blindado | Verificación de firma HMAC-SHA256, fail-closed |
| Condiciones de carrera | ✅ Blindado | Restricciones `UNIQUE` a nivel de base de datos + `UPDATE` condicional atómico para el reclamo de cotizaciones |
| Exposición de errores internos | ✅ Blindado | Manejador global de excepciones; nunca se filtran tracebacks/detalles internos al cliente |
| CORS | ✅ Blindado | Restringido a orígenes configurados por entorno |
| Fugas de datos entre empresas (multi-tenant) | ✅ Blindado | Claim `importador_id` en el JWT en vez de `Usuario.id == Importador.id` |

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
| `POST /cotizaciones/{id}/reclamar` | La cotización debe ser de la empresa del trabajador (dirigida) o abierta | `tests/test_trabajadores.py::TestPoolEmpresaYReclamo` |
| `PUT /importadores/trabajadores/{id}/estado` | El trabajador debe pertenecer a la empresa del dueño autenticado | `tests/test_trabajadores.py::TestListarYActualizarTrabajadores` |
| `GET/POST /chat/conversaciones/{id}/mensajes`, WebSocket `/ws/chat/{id}` | Solo el solicitante o la cuenta de empresa de esa conversación (`_verificar_acceso_conversacion`) | `tests/test_chat.py::TestMensajesRest`, `TestWebSocketChat` |
| `PUT /ordenes/{id}/reportar-problema` | Solo el solicitante dueño de la orden | `tests/test_admin.py::TestDisputas` |
| `PUT /importadores/campos-personalizados/{id}`, `DELETE .../{id}` | Solo la empresa que creó el campo | `tests/test_formulario_personalizado.py::TestCrudCamposPersonalizados` |

### Refuerzo estructural (Semana 3, Fase 0)
Antes del desacople de identidad, el backend asumía `Usuario.id == Importador.id` para el rol `importador`. Esto era, en sí mismo, un vector de IDOR latente: no había forma de tener varios usuarios de una misma empresa sin que cada uno pudiera potencialmente suplantar a la empresa completa. La solución:
- `Usuario.importador_id` (FK) desacopla la cuenta de la empresa.
- El JWT incluye el claim `importador_id`, generado por el backend a partir de la base de datos (nunca enviado por el cliente), por lo que no puede falsificarse sin la clave secreta del servidor.
- Todas las comprobaciones de propiedad entre empresas ahora usan `current_user["importador_id"]`, consistente sin importar qué cuenta de la empresa (dueño o trabajador) esté autenticada.

---

## 3. Autenticación y gestión de sesión

- **Contraseñas con `bcrypt`** (`passlib`), nunca en texto plano ni con hashes reversibles.
- **JWT firmado con HS256** (`utils/security.py`), con expiración (`exp`) e `iat`; el secreto (`SECRET_KEY`) se configura por variable de entorno, nunca hardcodeado en el repositorio para producción.
- **Cierre del auto-registro de cuentas elevadas (Semana 3):** `POST /auth/register` rechaza cualquier `rol` distinto de `solicitante` con `400 Bad Request`. Antes, cualquiera podía crear una cuenta `admin` o `importador` sin ninguna verificación — el vector de escalamiento de privilegios más crítico encontrado en la revisión.
  - Las cuentas `importador` (dueño) solo las crea un admin ya autenticado (`POST /admin/importadores`), junto con la empresa, en una transacción atómica.
  - Las cuentas `trabajador` solo las crea la cuenta dueña de su propia empresa (`POST /importadores/trabajadores`).
  - No existe **ningún** camino, público o de autoservicio, para crear una cuenta `admin`.
- **Cuentas desactivables (`Usuario.activo`, Semana 3):** el login y la renovación de token (`/auth/refresh`) rechazan explícitamente cuentas con `activo=False` con `401 Unauthorized`, incluso si la contraseña es correcta. Permite a un admin revocar el acceso de una cuenta comprometida o de un empleado que deja la empresa, de forma inmediata (`PUT /admin/usuarios/{id}/estado`).
- **Rate limiting (`slowapi`):** `RATE_LIMIT_LOGIN` (por defecto `5/minute` por IP) y `RATE_LIMIT_REGISTER` (por defecto `10/minute` por IP) mitigan ataques de fuerza bruta y registro masivo automatizado.

Ver [[Autenticacion]] para el detalle completo del flujo y los claims del JWT.

---

## 4. Autorización por rol (RBAC)

- **`require_rol(rol)`:** exige un rol exacto (ej. `require_rol("admin")` en todos los endpoints de `/admin/*`).
- **`require_rol_in(*roles)` (Semana 3):** exige que el rol esté en un conjunto permitido, usado para endpoints compartidos entre la cuenta dueña y sus trabajadores (ej. `GET /cotizaciones/pool-empresa`).
- **Principio de mínimo privilegio para `trabajador` (Semana 3):** por diseño explícito, un trabajador **solo** puede reclamar cotizaciones del pool de su empresa, ver sus propias cotizaciones asignadas y participar en el chat de esas conversaciones. No puede crear otros trabajadores, editar el perfil de la empresa, ni enviar la propuesta formal — esas acciones quedan reservadas a la cuenta dueña.
- **Separación estricta admin vs. operación de negocio:** un admin no reemplaza a un dueño de empresa (no puede editar el perfil de una empresa ni enviar propuestas), y viceversa — reduce la superficie de una cuenta admin comprometida.

---

## 5. Protección contra condiciones de carrera (ACID)

| Escenario | Riesgo sin protección | Mitigación real |
|---|---|---|
| Dos webhooks de Wompi concurrentes para el mismo pago | Crear dos órdenes duplicadas | `Orden.cotizacion_id` con `UNIQUE`; el segundo intento falla por `IntegrityError` y se maneja con rollback controlado |
| Dos propuestas del mismo importador a la misma cotización | Doble propuesta o inconsistencia de estado | `UniqueConstraint(cotizacion_id, importador_id)` en `Propuesta`, verificado antes **y** protegido a nivel de base de datos |
| Dos trabajadores reclamando la misma cotización a la vez (Semana 3) | Ambos "se quedan" con la cotización | `UPDATE ... WHERE trabajador_asignado_id IS NULL` (condicional, no *check-then-set* en Python); si `rowcount == 0`, se responde `409 Conflict` al segundo. Verificado en `tests/test_trabajadores.py::test_reclamo_duplicado_devuelve_409` |
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
- **HTTPS en producción:** pendiente de la capa de despliegue (reverse proxy / proveedor de hosting); no aplica en desarrollo local/Docker.

---

## Checklist de seguridad — Estado real (verificado 2026-07-07)

- [x] Sin inyección SQL posible (ORM parametrizado en el 100% del acceso a datos)
- [x] IDOR cubierto en todos los endpoints que expuestos por ID (empresa, orden, pago, cotización, conversación, campo personalizado, trabajador)
- [x] Auto-registro público restringido a `solicitante`; sin camino de escalamiento a `admin`/`importador`
- [x] Cuentas desactivables de forma inmediata desde el panel admin
- [x] Rate limiting en endpoints de autenticación
- [x] Verificación de firma en webhooks de terceros (fail-closed)
- [x] Condiciones de carrera cubiertas con restricciones de base de datos y `UPDATE` condicional, no con checks en la capa de aplicación
- [x] Sin fuga de detalles internos en errores 500
- [x] CORS restringido por entorno
- [x] Multi-tenant real: una cuenta de una empresa no puede ver/modificar datos de otra empresa aunque adivine un UUID válido
- [ ] HTTPS en producción — depende del despliegue, fuera del alcance del código del backend
- [ ] Auditoría/logging estructurado de acciones administrativas críticas (activar/desactivar cuentas, resolver disputas) — recomendado para una futura iteración, no implementado aún

---

## Referencias cruzadas

- [[Autenticacion]] — JWT, claims, roles, rate limiting
- [[Pagos-Wompi]] — verificación de firma de webhooks, idempotencia
- [[Base-Datos]] — restricciones `UNIQUE` y claves foráneas que sustentan varias de estas protecciones
- `Fases-Desarrollo/Semana-3-Chat-y-Pulido/Tareas-Semana-3.md` — Tarea 3.13 (refactor de identidad y cierre de auto-registro)
