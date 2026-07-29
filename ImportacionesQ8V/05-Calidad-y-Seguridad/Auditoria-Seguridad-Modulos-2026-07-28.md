# Auditoría de seguridad — módulos nuevos (2026-07-28)

Revisión estática y de control de acceso sobre los cambios introducidos para cerrar gaps del Frontend:

- LMS cursos (`/cursos`, `/mis-cursos`, compra, progreso)
- Notificaciones in-app (`/notificaciones`)
- `POST /chat/iniciar`
- `DELETE /importadores/asesores/{id}`
- `GET /importadores/metricas` y `GET /asesores/dashboard/stats`

**Alcance:** `proyecto/backend/` (código + migración `20260728_0005`).  
**Método:** revisión manual alineada a **OWASP Top 10 2021** + principios ya documentados en [[Seguridad]] e [[OWASP-Top10-Backend-2026-07-14]].  
**No incluye:** pentest dinámico externo, SCA de dependencias, ni revisión del Frontend React.

← [[Indice-Calidad]] · [[Seguridad]] · [[OWASP-Top10-Backend-2026-07-14]]

---

## Score de los módulos nuevos

| Categoría OWASP | Antes de remediación (esta auditoría) | Después de remediaciones aplicadas en la misma sesión |
|-----------------|--------------------------------------:|------------------------------------------------------:|
| A01 Broken Access Control | 4/10 | **8/10** |
| A02 Cryptographic Failures | 9/10 | 9/10 (sin cambio; reutiliza JWT/PyJWT) |
| A03 Injection | 8/10 | **9/10** |
| A04 Insecure Design | 3/10 | **6/10** |
| A05 Security Misconfiguration | 8/10 | 8/10 |
| A07 Identification / Auth | 8/10 | **9/10** |
| A09 Logging / Monitoring | 7/10 | 7/10 |
| A10 SSRF | 9/10 | **9/10** (URLs no se fetchean en servidor) |

**Score global estimado de los módulos nuevos:** ~**7.8/10** post-remediación (antes ~5.5).  
El score global de la plataforma (~92 de la auditoría del 14-jul) **baja ligeramente** mientras quede el residual de **compra de curso sin pasarela de pago real** (A04).

---

## Resumen ejecutivo

Los endpoints nuevos reutilizan bien el patrón existente (`get_current_user` con rol desde BD, `require_rol` / `require_rol_in`, filtros por `importador_id` del token). Las **notificaciones** y las **métricas** nacieron con buen aislamiento multi-tenant.

El riesgo más grave era el **paywall del LMS roto**: el detalle público devolvía `video_url` y recursos de **todas** las lecciones sin compra. Eso se remedió en esta sesión.

Otros riesgos de diseño (compra sin cobro real, DoS por payload grande, hard delete incompleto) se endurecieron o se documentan como residuales.

---

## Hallazgos

### H1 — [CRÍTICO → REMEDIADO] Paywall LMS inexistente (A01)

**Antes:** `GET /cursos/{id_o_slug}` era público y devolvía el temario **completo** con todos los `video_url` y URLs de recursos descargables. Cualquiera podía consumir el contenido de pago sin `POST .../comprar`.

**Impacto:** Bypass total del modelo de negocio Domestika; fuga de contenido premium.

**Remediación aplicada:**

- `_modulos_response(..., acceso_completo=)` redacts `video_url` y `recursos` si el usuario no compró y no es dueño de la empresa.
- Solo lecciones `es_preview=true` exponen media al público.
- Compradores y dueño de la importadora ven contenido completo.
- Tests: `test_paywall_redacta_contenido_no_preview`, verificación post-compra.

**Estado:** ✅ Remediado.

---

### H2 — [ALTO → REMEDIADO] Compra abierta a cualquier rol (A01)

**Antes:** `POST /cursos/{id}/comprar` usaba `get_current_user` (cualquier rol autenticado: admin, importador, asesor).

**Remediación:** `require_rol("solicitante")`.

**Estado:** ✅ Remediado. Residual: sin pasarela (H6).

---

### H3 — [MEDIO → REMEDIADO] Inyección de mensajes vía `POST /chat/iniciar` (A01)

**Antes:** `mensaje_inicial` se insertaba aunque la conversación ya existiera y el llamante no fuera `importador_usuario_id` (p. ej. dueño escribiendo en hilo del asesor sin ser participante del modelo de acceso del resto del chat).

**Remediación:**

- Solo se escribe si el usuario es participante o es dueño de la empresa.
- Si el dueño escribe, se traspasa `importador_usuario_id` al dueño (alineado al patrón de supervisión del pre-aceptar).
- Mensaje truncado a 2000 chars.

**Estado:** ✅ Remediado.

---

### H4 — [MEDIO → REMEDIADO] Enumeración de cotizaciones (A01)

**Antes:** `POST /chat/iniciar` con `cotizacion_id` ajeno y sin propuesta propia respondía **400** “No hay propuesta…”, confirmando que el UUID de cotización existía.

**Remediación:** respuesta **404** genérica.

**Estado:** ✅ Remediado.

---

### H5 — [MEDIO → REMEDIADO] URLs peligrosas en cursos (A03 / XSS almacenado)

**Antes:** `video_url`, `portada_url` y recursos aceptaban cualquier string (`javascript:`, `data:`, etc.). Si el Frontend renderiza sin sanitizar → XSS o phishing.

**Remediación:** validación Pydantic: solo esquemas `http`/`https` con `netloc`. Test `test_url_javascript_rechazada`.

**Estado:** ✅ Remediado en backend. El FE **debe** seguir sanitizando al renderizar HTML.

---

### H6 — [ALTO residual] Compra de curso sin cobro real (A04 Insecure Design)

**Hecho:** `POST /cursos/{id}/comprar` registra inscripción e incrementa `estudiantes_count` **sin** pasarela (Wompi), créditos ni verificación de pago. `precio_pagado` es solo informativo.

**Impacto de negocio:** acceso gratuito a cursos de pago vía API.

**Mitigación actual:** documentado como MVP; rol restringido a solicitante; paywall de media post-compra.

**Recomendación (fase 2):**

1. Integrar pago Wompi (o wallet) antes de crear `CompraCurso`.
2. O modelo “inscripción gratuita / cursos de pago con webhook”.
3. No confiar en el Frontend para bloquear el botón “Comprar”.

**Estado:** ⬜ Residual aceptado para MVP; **no** se considera cerrado.

---

### H7 — [MEDIO → REMEDIADO parcial] DoS por payload de publicación (A04)

**Antes:** sin tope de módulos/lecciones/recursos → un `POST /cursos` enorme podía saturar BD.

**Remediación:**

- Máx. 30 módulos, 50 lecciones/módulo, 20 recursos/lección.
- `precio` acotado `0 … 1_000_000`.
- Límite de listado catálogo ya en 100.

**Residual:** no hay rate limit específico en `POST /cursos` ni `POST .../comprar` (solo los de auth globales).

**Estado:** ⚠️ Parcial.

---

### H8 — [MEDIO → REMEDIADO] Race en compra / `estudiantes_count` (A04)

**Antes:** read-modify-write de `estudiantes_count` + insert sin capturar `IntegrityError` → posible 500 o contador incorrecto bajo concurrencia.

**Remediación:** `UPDATE ... estudiantes_count + 1` + manejo de `IntegrityError` devolviendo la compra existente.

**Estado:** ✅ Remediado.

---

### H9 — [MEDIO → REMEDIADO] Hard delete incompleto (A01 / integridad)

**Antes:** solo se bloqueaba hard delete por cotizaciones asignadas y conversaciones como `importador_usuario_id`. No se miraban:

- `mensajes_chat.remitente_id`
- `propuestas.creado_por_usuario_id`
- otras FKs → posible `IntegrityError` o pérdida de trazabilidad

**Remediación:** checks adicionales + catch de `IntegrityError` → 409 con mensaje de soft-delete.

**Residual:** preferir **siempre** soft delete en producto; hard delete solo para cuentas sin historial.

**Estado:** ✅ Mejorado; soft delete sigue siendo la vía recomendada.

---

### H10 — [BAJO] Notificaciones y métricas (bien diseñadas)

| Control | Estado |
|---------|--------|
| Lista notificaciones filtrada por `usuario_id` del JWT | ✅ |
| Marcar leída con `id` + `usuario_id` (404 genérico IDOR) | ✅ |
| `leer-todas` scoped al usuario | ✅ |
| `GET /importadores/metricas` solo `require_rol("importador")` + `importador_id` del token | ✅ |
| `GET /asesores/dashboard/stats` solo `require_rol("asesor")` + `user_id` propio | ✅ |
| No hay endpoints públicos de creación de notificaciones arbitrarias | ✅ |

**Hallazgo menor:** no hay rate limit en `GET /notificaciones` (abuso de polling). Mitigar en FE con interval razonable + eventual ETag/caché.

---

### H11 — [BAJO] Superficie de catálogo público

- `GET /cursos` y detalle son públicos por diseño (catálogo).
- Se expone `importador_id` (aceptable en marketplace).
- Filtros `ILIKE` con `%` del usuario: coste acotado por `LIMIT 100`; residual DoS bajo.

---

### H12 — [INFO] Auth opcional en detalle de curso

`get_optional_user` ignora tokens inválidos y trata al cliente como anónimo (correcto). Un FE que no renueva JWT verá `comprado=false` y media redactada aunque el usuario “crea” estar logueado → UX, no bug de seguridad.

---

## Mapa de endpoints nuevos vs controles

| Endpoint | Auth | IDOR / tenant | Notas |
|----------|------|---------------|-------|
| `GET /cursos` | Público | N/A | Solo `publicado` |
| `GET /cursos/{id}` | Público + JWT opcional | Paywall media | Preview vs completo |
| `POST /cursos` | `importador` | `importador_id` del token | URLs http(s), límites tamaño |
| `POST .../comprar` | `solicitante` | compra propia | **Sin pago real (H6)** |
| `GET /mis-cursos` | JWT | filtro `usuario_id` | |
| `POST .../progreso` | JWT | exige compra propia | |
| `GET /notificaciones` | JWT | `usuario_id` | |
| `PUT .../leer` | JWT | `usuario_id` + id | 404 si ajena |
| `PUT .../leer-todas` | JWT | `usuario_id` | |
| `POST /chat/iniciar` | importador/asesor | propuesta de la empresa | 404 genérico |
| `DELETE .../asesores/{id}` | importador | empresa propia | 409 si historial |
| `GET /importadores/metricas` | importador | empresa propia | |
| `GET /asesores/dashboard/stats` | asesor | self | |

---

## Remediaciones aplicadas en esta auditoría

| # | Cambio | Archivos |
|---|--------|----------|
| R1 | Paywall de media en detalle de curso | `routers/cursos.py` |
| R2 | Compra solo `solicitante` | `routers/cursos.py` |
| R3 | Validación URLs http(s) + límites anidados | `schemas/curso.py` |
| R4 | Compra atómica + `IntegrityError` | `routers/cursos.py` |
| R5 | `mensaje_inicial` con auth de participante / traspaso dueño | `routers/chat.py` |
| R6 | 404 genérico en chat iniciar | `routers/chat.py` |
| R7 | Hard delete: mensajes, propuestas, IntegrityError | `routers/importadores.py` |
| R8 | Tests de paywall, URL maliciosa, rol compra | `tests/test_cursos.py` |

---

## Residuales prioritarios (backlog)

| Prioridad | Item | OWASP |
|-----------|------|-------|
| P0 | Integrar cobro real antes de `CompraCurso` | A04 |
| P1 | Rate limit en `POST /cursos`, `POST .../comprar`, `GET /notificaciones` | A04/A07 |
| P1 | Sanitización XSS en Frontend al renderizar títulos/descripciones de cursos | A03 |
| P2 | No exponer títulos de lecciones premium si se considera metadata sensible | A01 |
| P2 | Auditoría de logs: quién publica/compra cursos y hard-deletes | A09 |
| P2 | SCA de dependencias en CI (ya residual de jul-14) | A06 |

---

## Checklist de pruebas de seguridad (manual / automatizado)

- [x] Anónimo no ve `video_url` de lecciones no preview
- [x] Solicitante con compra ve todos los videos
- [x] `javascript:` en `video_url` → 422
- [x] Importador no puede comprar (403)
- [x] Notificación ajena → 404 al marcar leída
- [x] Asesor de otra empresa no inicia chat de propuesta ajena (404)
- [x] Hard delete con historial → 409
- [ ] (Manual) Concurrencia 2× comprar el mismo curso
- [ ] (Manual) Payload 100 módulos → 422 por max_length

---

## Conclusión

Los módulos nuevos **no reabren** de forma grave los controles multi-tenant ya blindados (JWT + `importador_id` desde BD). El defecto crítico del **paywall LMS** y varios de control de acceso en chat/compra se **cerraron en esta sesión**.

El principal residual de seguridad/negocio es **H6: inscripción de cursos de pago sin pasarela**. Hasta integrar cobro, el LMS debe tratarse como **catálogo + preview + inscripción honor-system**, no como tienda de contenido de pago.

**Ver también:** [[OWASP-Top10-Backend-2026-07-14]] · [[Seguridad]] · [[15-Cursos-LMS]] · [[16-Notificaciones]]
