# Semana 2: Red de Importadores y Ordenes — ImportacionesQ8

## Descripción general

Semana 2 del MVP a 3 semanas. Entregables: Distribución automática de cotizaciones abiertas, panel de propuestas recibidas, conexión con importador elegido, módulo de órdenes con estados y notificaciones.

---

## Estado de la revisión de backend (2026-07-06)

> Revisión de código + seguridad realizada sobre `proyecto/backend`. Alcance: Tareas 2.1 a 2.5 (backend). Las tareas 2.6 a 2.10 (frontend) siguen pendientes — el directorio `proyecto/frontend` todavía no existe en el repositorio.
>
> - ✅ Suite de tests: **101/101 passing** localmente (`pytest`) y en Docker (`docker compose run --rm tests`).
> - ✅ Se corrigieron IDOR críticos en `ordenes.py`, `importadores.py` y `cotizaciones.py` (comparaciones de propiedad contra una clave de JWT que no existía, dejando la autorización deshabilitada de facto).
> - ✅ Se implementó verificación real de firma HMAC-SHA256 en el webhook de Wompi (antes era un stub que siempre aprobaba).
> - ✅ Se agregó el modelo `Pago` (antes solo documentado, no implementado) con `wompi_payment_id` único para idempotencia real.
> - ✅ Se reforzaron condiciones de carrera con `IntegrityError` + `rollback` en creación de propuestas y órdenes, respaldadas por constraints únicos a nivel de base de datos (ACID).
> - ✅ Se agregó rate limiting a `/auth/login` y `/auth/register`, manejo global de excepciones (no se filtran stack traces/detalles internos al cliente), y defensa en profundidad contra inyección SQL en `database.py`.
> - ✅ Se removieron `.env` y `__pycache__` del control de versiones (`.gitignore` + `.env.example`).
>
> **Revisión de congruencia con el PDF y los wireframes (2026-07-06):** se leyó `docs/Propuesta_Plataforma_Importacion.pdf` completo y se contrastó contra `Frontend/Wireframes.md`, `Pantallas-Solicitante.md` y `Pantallas-Importador.md`. La estructura general es congruente (modalidad dirigida/abierta, campos del formulario, catálogo de importadores, checkout Wompi, los 6 estados de orden). Se encontraron y corrigieron 2 gaps concretos entre el backend y los wireframes:
> - ✅ Faltaba el campo `incoterm` en `Propuesta` (modelo, schema y endpoints), requerido por las Pantallas 6 y 11. Agregado con migración de esquema (`propuestas.incoterm VARCHAR(50) NOT NULL`) y cubierto por tests.
> - ✅ El contador "X de Y importadores respondieron" y la lista de "Pendientes de Responder" del panel de propuestas (Pantalla 6) no tenían endpoint propio, aunque `services/matching_service.py` ya calculaba esos datos internamente. Se expuso `GET /cotizaciones/{id}/matching-status`.
> - ⬜ Pendiente, correctamente diferido a Semana 3 (no es un gap, está en el roadmap del propio PDF): asignación real de `asesor_asignado_id` y endpoints de asesores (Tarea 3.7), creación automática de conversación de chat al confirmar el pago, y el consumidor WebSocket de las notificaciones Redis Pub/Sub (el `publish` ya existe, best-effort).

---

## Resumen de entregables

| Entregable | Módulo | Prioridad |
|------------|--------|-----------|
| Distribución automática de cotizaciones abiertas | Backend/Matching-Cotizaciones | P0 |
| Panel de propuestas recibidas | Frontend/Pantallas-Solicitante | P0 |
| Conexión con importador elegido | Backend/Pagos-Wompi, Frontend/Pantallas-Solicitante | P0 |
| Módulo de órdenes con estados y notificaciones | Backend/Base-Datos, Frontend/Pantallas-Solicitante | P0 |

---

## Tareas Backend — Semana 2

### Tarea 2.1: Implementar modelo y CRUD de propuestas

**Módulo:** Backend/Base-Datos  
**Duración estimada:** 1 día  
**Responsable:** Desarrollador Backend

#### Descripción
Implementar el modelo ORM para Propuesta con campos para precio ofrecido, tiempo estimado y condiciones adicionales. Los importadores usan este modelo para enviar sus propuestas a las cotizaciones abiertas.

#### Pasos de implementación

1. **Crear esquema Pydantic para Propuesta** (`schemas/cotizacion.py`)
   ```python
   from pydantic import BaseModel
   from typing import Optional
   
   class PropuestaCreate(BaseModel):
       cotizacion_id: str  # ID de la cotización a la que responde
       precio_ofrecido_usd: float  # Precio ofrecido por el importador
       tiempo_estimado_entrega: str  # Tiempo estimado (ej: "45 días")
       incoterm: str  # Incoterm propuesto (FOB, CIF, EXW, DDP...)
       condiciones_adicionales: Optional[str] = None  # Condiciones adicionales
   
   class PropuestaResponse(BaseModel):
       id: str
       cotizacion_id: str
       importador_id: str
       precio_ofrecido_usd: float
       tiempo_estimado_entrega: str
       incoterm: str
       condiciones_adicionales: Optional[str]
       estado: str  # "pendiente", "aceptada", "rechazada"
   ```

   > **Nota (revisión de congruencia con wireframes, 2026-07-06):** la especificación original de esta tarea no incluía `incoterm`, pero los wireframes "Panel de Propuestas Recibidas" (Pantalla 6) y "Formulario de Respuesta a Cotización" (Pantalla 11), y el flujo del PDF de referencia (paso 15: "responde con propuesta de precio, tiempo estimado, condiciones e incoterm"), lo exigen como campo obligatorio de cada propuesta. Se agregó `incoterm` al modelo, esquema y endpoints — ver sección "Estado de la revisión" al inicio del documento.

2. **Crear modelo ORM para Propuesta** (`models/cotizacion.py`)
   - Campos: id (UUID), cotizacion_id FK → cotizaciones.id, importador_id FK → importadores.id, precio_ofrecido_usd, tiempo_estimado_entrega, incoterm, condiciones_adicionales, estado (ENUM: "pendiente", "aceptada", "rechazada"), fecha_envio
   - **Restricción única:** Un importador solo puede enviar UNA propuesta por cotización (`UNIQUE KEY unique_propuesta_cotizacion_importador (cotizacion_id, importador_id)`)

3. **Implementar endpoint POST /propuestas** (`routers/cotizaciones.py`) — Solo para importadores
   ```python
   @app.post("/propuestas", response_model=PropuestaResponse)
   async def enviar_propuesta(
       propuesta: PropuestaCreate,
       current_user: dict = Depends(require_rol("importador")),
       db: Session = Depends(get_db)
   ):
       # 1. Verificar que la cotización existe y es abierta
       cotizacion = db.query(Cotizacion).filter(
           Cotizacion.id == propuesta.cotizacion_id,
           Cotizacion.modalidad == "abierta"
       ).first()
       
       if not cotizacion:
           raise HTTPException(status_code=404, detail="Cotización no encontrada o no es abierta")
       
       # 2. Verificar que el importador está en la lista de matching para esta cotización
       importadores_matching = redis_client.hgetall(f"cotizacion_abierta:{propuesta.cotizacion_id}")
       if str(current_user["user_id"]) not in importadores_matching:
           raise HTTPException(status_code=403, detail="No autorizado para responder esta cotización")
       
       # 3. Verificar que el importador no ha enviado ya una propuesta a esta cotización
       propuesta_existente = db.query(Propuesta).filter(
           Propuesta.cotizacion_id == propuesta.cotizacion_id,
           Propuesta.importador_id == current_user["user_id"]
       ).first()
       
       if propuesta_existente:
           raise HTTPException(status_code=400, detail="Ya has enviado una propuesta a esta cotización")
       
       # 4. Crear nueva propuesta en la base de datos
       nueva_propuesta = Propuesta(
           cotizacion_id=propuesta.cotizacion_id,
           importador_id=current_user["user_id"],
           precio_ofrecido_usd=propuesta.precio_ofrecido_usd,
           tiempo_estimado_entrega=propuesta.tiempo_estimado_entrega,
           condiciones_adicionales=propuesta.condiciones_adicionales,
           estado="pendiente"
       )
       db.add(nueva_propuesta)
       
       # 5. Actualizar estado en Redis
       redis_client.hset(f"cotizacion_abierta:{propuesta.cotizacion_id}", current_user["user_id"], "respondido")
       redis_client.incr(f"cotizacion_abierta:{propuesta.cotizacion_id}:respuestas")
       
       db.commit()
       db.refresh(nueva_propuesta)
       
       return PropuestaResponse(
           id=str(nueva_propuesta.id),
           cotizacion_id=propuesta.cotizacion_id,
           importador_id=current_user["user_id"],
           precio_ofrecido_usd=nueva_propuesta.precio_ofrecido_usd,
           tiempo_estimado_entrega=nueva_propuesta.tiempo_estimado_entrega,
           condiciones_adicionales=nueva_propuesta.condiciones_adicionales,
           estado="pendiente"
       )
   ```

4. **Implementar endpoint GET /cotizaciones/{id}/propuestas** (`routers/cotizaciones.py`) — Solo para el solicitante de la cotización
   - Listar todas las propuestas recibidas para una cotización abierta

5. **Implementar endpoint GET /cotizaciones/{id}/matching-status** (`routers/cotizaciones.py`) — Solo para el solicitante de la cotización
   - Devuelve `total_matching`, `respondidos`, `pendientes` e `importadores_pendientes` (id, nombre, logo) para alimentar el contador "X de Y importadores respondieron" y la sección "Pendientes de Responder" del wireframe Pantalla 6. Usa el motor de matching (`services/matching_service.py`), que ya calculaba estos datos internamente pero no estaban expuestos por ningún endpoint.

#### Criterios de aceptación

- [x] POST /propuestas con datos válidos crea nueva propuesta (201 Created) — verificado en `tests/test_propuestas.py::TestEnviarPropuesta::test_enviar_propuesta_exitoso`
- [x] POST /propuestas sin rol importador retorna 403 Forbidden — `test_enviar_propuesta_sin_rol_importador`
- [x] POST /propuestas para una cotización cerrada retorna 404 Not Found — `test_enviar_propuesta_cotizacion_no_encontrada`
- [x] POST /propuestas si el importador ya envió una propuesta a esa cotización retorna 400 Bad Request — `test_enviar_propuesta_duplicada` (y protegido a nivel de base de datos con `IntegrityError`/rollback ante condiciones de carrera)
- [x] GET /cotizaciones/{id}/propuestas retorna lista de propuestas recibidas (200 OK), incluyendo `incoterm` — `TestListarPropuestas`
- [x] GET /cotizaciones/{id}/matching-status retorna conteos e importadores pendientes (200 OK), solo accesible al solicitante dueño y solo para modalidad "abierta" — `TestMatchingStatus`

**Revisión de seguridad (2026-07-06):** se corrigieron 2 bugs críticos encontrados en la implementación real: (1) el router de `/propuestas` estaba anidado bajo `/cotizaciones`, generando rutas duplicadas (`/cotizaciones/propuestas`); se separó en un `APIRouter` independiente. (2) La creación de la propuesta usaba `PyUUID()` sin argumentos (bug, lanzaba `TypeError` en cada request) en lugar de `uuid4()`.

**Revisión de congruencia con wireframes (2026-07-06):** se detectaron y corrigieron 2 gaps frente al PDF de referencia y los wireframes del vault: (1) faltaba el campo `incoterm` en `Propuesta`, requerido por las Pantallas 6 y 11; (2) el conteo "X de Y importadores respondieron" y la lista de pendientes no estaban expuestos por ningún endpoint, aunque la lógica ya existía en `matching_service.py`. Ambos se resolvieron sin romper compatibilidad con el resto de la API.

#### Entregables

1. ✅ Modelo ORM para Propuesta con restricción única (un importador, una propuesta por cotización) e `incoterm`
2. ✅ Endpoint POST /propuestas funcional con validación de permisos
3. ✅ Endpoint GET /cotizaciones/{id}/propuestas funcional
4. ✅ Endpoint GET /cotizaciones/{id}/matching-status funcional

---

### Tarea 2.2: Implementar módulo de órdenes

**Módulo:** Backend/Base-Datos  
**Duración estimada:** 1.5 días  
**Responsable:** Desarrollador Backend Senior

#### Descripción
Implementar el modelo ORM para Orden con campos para seguimiento del ciclo de vida del pedido, y los endpoints REST para gestionar órdenes.

#### Pasos de implementación

1. **Crear esquema Pydantic para Orden** (`schemas/orden.py`)
   ```python
   from pydantic import BaseModel
   from typing import Optional, List
   
   class EstadoOrden(BaseModel):
       id: str
       orden_id: str
       estado_anterior: Optional[str]
       estado_nuevo: str
       fecha_cambio: datetime
   
   class DocumentoOrden(BaseModel):
       id: str
       orden_id: str
       nombre: str
       url: str
       tipo: str  # "factura_proforma", "factura_comercial", "packing_list", "comprobante_pago"
   
   class OrdenCreate(BaseModel):
       cotizacion_id: str
       importador_id: str
       solicitante_id: str
       asesor_asignado_id: Optional[str] = None
   
   class OrdenResponse(BaseModel):
       id: str
       cotizacion_id: str
       importador_id: str
       solicitante_id: str
       asesor_asignado_id: Optional[str]
       estado: str  # "cotizacion_aceptada", "en_produccion", etc.
       precio_acordado_usd: float
       tiempo_estimado_entrega: Optional[str]
       condiciones_adicionales: Optional[str]
       historial_estados: List[EstadoOrden]
       documentos_adjuntos: List[DocumentoOrden]
   ```

2. **Crear modelo ORM para Orden** (`models/orden.py`)
   - Campos: id (UUID), cotizacion_id FK, importador_id FK, solicitante_id FK, asesor_asignado_id FK, estado (ENUM), precio_acordado_usd, tiempo_estimado_entrega, condiciones_adicionales, fecha_creacion, fecha_actualizacion

3. **Crear modelo ORM para HistorialEstadosOrden** (`models/orden.py`)
   - Campos: id (UUID), orden_id FK → ordenes.id, estado_anterior, estado_nuevo, fecha_cambio

4. **Crear modelo ORM para DocumentoOrden** (`models/orden.py`)
   - Campos: id (UUID), orden_id FK → ordenes.id, nombre, url, tipo (ENUM)

5. **Implementar endpoint GET /ordenes** (`routers/ordenes.py`) — Listar órdenes del usuario autenticado
6. **Implementar endpoint GET /ordenes/{id}** (`routers/ordenes.py`) — Obtener detalles de una orden específica
7. **Implementar endpoint PUT /ordenes/{id}/estado** (`routers/ordenes.py`) — Actualizar estado de una orden (importador/admin)

#### Criterios de aceptación

- [x] Modelo Orden con todos los campos del ciclo de vida del pedido — incluye además `UniqueConstraint` en `cotizacion_id` (1 orden por cotización, ver Tarea 2.3)
- [x] Modelo HistorialEstadosOrden para rastrear cambios de estado con fecha y hora
- [x] GET /ordenes retorna solo las órdenes del usuario autenticado (200 OK) — `tests/test_ordenes.py::TestListarOrdenes`
- [x] GET /ordenes/{id} retorna detalles de una orden específica o 404 si no existe — `TestObtenerOrden`
- [x] PUT /ordenes/{id}/estado actualiza el estado y registra en historial_estados_orden — `TestActualizarEstadoOrden`

**Revisión de seguridad (2026-07-06):** se corrigieron IDOR en `GET /ordenes` y `GET /ordenes/{id}` para el rol `importador` (el código comparaba contra `current_user["importador_id"]`, una clave que nunca existe en el JWT, por lo que el filtro de autorización quedaba efectivamente deshabilitado). Ahora se compara siempre contra `current_user["user_id"]`.

#### Entregables

1. ✅ Modelos ORM para Orden, HistorialEstadosOrden y DocumentoOrden
2. ✅ Endpoint GET /ordenes filtrado por usuario autenticado
3. ✅ Endpoint GET /ordenes/{id}
4. ✅ Endpoint PUT /ordenes/{id}/estado con registro en historial de estados

---

### Tarea 2.3: Implementar flujo de conversión cotización → orden tras pago confirmado

**Módulo:** Backend/Pagos-Wompi  
**Duración estimada:** 1 día  
**Responsable:** Desarrollador Backend Senior

#### Descripción
Implementar el flujo completo de conversión de cotización aceptada en orden activa cuando se confirma el pago con Wompi. Este es el flujo más crítico del negocio.

#### Pasos de implementación

1. **Crear esquema Pydantic para Checkout** (`schemas/pago.py`)
   ```python
   from pydantic import BaseModel
   
   class CheckoutRequest(BaseModel):
       cotizacion_id: str  # ID de la cotización aceptada
   
   class CheckoutResponse(BaseModel):
       checkout_url: str  # URL del checkout de Wompi
       wompi_payment_id: str  # ID del pago en Wompi
   ```

2. **Implementar endpoint POST /pagos/checkout** (`routers/pagos.py`) — Generar enlace de pago con Wompi
   ```python
   @app.post("/pagos/checkout", response_model=CheckoutResponse)
   async def generar_checkout(
       checkout: CheckoutRequest,
       current_user: dict = Depends(require_rol("solicitante")),
       db: Session = Depends(get_db)
   ):
       # 1. Verificar que la cotización existe y está en estado "cotizacion_aceptada"
       cotizacion = db.query(Cotizacion).filter(
           Cotizacion.id == checkout.cotizacion_id,
           Cotizacion.solicitante_id == current_user["user_id"],
           Cotizacion.estado == "cotizacion_aceptada"
       ).first()
       
       if not cotizacion:
           raise HTTPException(status_code=400, detail="Cotización no encontrada o no está en estado de pago")
       
       # 2. Obtener el importador y la propuesta aceptada para calcular el monto del servicio
       propuesta = db.query(Propuesta).filter(
           Propuesta.cotizacion_id == checkout.cotizacion_id,
           Propuesta.estado == "aceptada"
       ).first()
       
       # Calcular comisión de la plataforma (ej: 10% del precio acordado)
       monto_comision = propuesta.precio_ofrecido_usd * 0.10
       
       # 3. Generar checkout con Wompi
       wompi_payment_id = await generar_checkout_wompi(monto_comision)
       
       # 4. Crear registro de pago en la base de datos
       nuevo_pago = Pago(
           orden_id=None,  # Se asignará cuando se cree la orden
           wompi_payment_id=wompi_payment_id,
           monto_usd=monto_comision,
           estado="pendiente",
           webhook_url=f"{API_URL}/pagos/webhook/wompi"
       )
       db.add(nuevo_pago)
       db.commit()
       
       return CheckoutResponse(
           checkout_url=wompi_payment_id.checkout_url,
           wompi_payment_id=wompi_payment_id.id
       )
   ```

3. **Implementar endpoint POST /pagos/webhook/wompi** (`routers/pagos.py`) — Recibir confirmación de pago
   ```python
   @app.post("/pagos/webhook/wompi")
   async def webhook_wompi(evento: dict):
       """
       Webhook de Wompi que recibe notificaciones sobre el estado del pago.
       
       Eventos manejados:
       - payment.confirmed: Pago confirmado → Cotización → Orden activa
       - payment.failed: Pago fallido → Mantener cotización en estado pendiente
       - payment.refunded: Reembolso → Notificar disputa
       """
       # 1. Verificar la firma del webhook usando WOMPI_SECRET_KEY
       if not verificar_firma_wompi(evento):
           raise HTTPException(status_code=403, detail="Firma inválida")
       
       wompi_payment_id = evento["data"]["id"]
       estado_wompi = evento["data"]["status"]
       
       # 2. Buscar el pago en la base de datos
       pago = db.query(Pago).filter(Pago.wompi_payment_id == wompi_payment_id).first()
       
       if not pago:
           raise HTTPException(status_code=404, detail="Pago no encontrado")
       
       # 3. Verificar que el pago ya fue procesado (idempotencia)
       if pago.estado != "pendiente":
           return {"success": True}
       
       # 4. Procesar según el estado del evento
       if evento["event"] == "payment.confirmed":
           # Actualizar estado del pago a confirmado
           pago.estado = "confirmado"
           pago.fecha_confirmacion = datetime.now()
           
           # Obtener la cotización asociada al pago
           cotizacion = db.query(Cotizacion).filter(
               Cotizacion.id == pago.orden_id  # Se asigna cuando se crea el checkout
           ).first()
           
           if cotizacion:
               # Convertir cotización en orden
               nueva_orden = Orden(
                   cotizacion_id=cotizacion.id,
                   importador_id=cotizacion.importador_id,
                   solicitante_id=cotizacion.solicitante_id,
                   asesor_asignado_id=None,  # Se asignará cuando el importador acepte la orden
                   estado="cotizacion_aceptada",
                   precio_acordado_usd=propuesta.precio_ofrecido_usd,
                   tiempo_estimado_entrega=propuesta.tiempo_estimado_entrega,
                   condiciones_adicionales=propuesta.condiciones_adicionales
               )
               db.add(nueva_orden)
               
               # Registrar cambio de estado en historial
               nuevo_estado = HistorialEstadosOrden(
                   orden_id=nueva_orden.id,
                   estado_anterior=None,
                   estado_nuevo="cotizacion_aceptada",
                   fecha_cambio=datetime.now()
               )
               db.add(nuevo_estado)
               
               # Actualizar estado de la cotización a "orden_activa"
               cotizacion.estado = "orden_activa"
               
               # Crear conversación de chat automáticamente entre solicitante y importador
               nueva_conversacion = ConversacionChat(
                   orden_id=nueva_orden.id,
                   solicitante_id=cotizacion.solicitante_id,
                   importador_id=cotizacion.importador_id
               )
               db.add(nueva_conversacion)
               
       elif evento["event"] == "payment.failed":
           pago.estado = "fallido"
       
       elif evento["event"] == "payment.refunded":
           pago.estado = "reembolsado"
           # Actualizar estado de la orden a "en disputa/reembolso"
       
       db.commit()
       
       return {"success": True}
   ```

#### Criterios de aceptación

- [x] POST /pagos/checkout con cotización válida genera enlace de pago con Wompi (200 OK) — `tests/test_pagos.py::TestGenerarCheckout`. Es idempotente (reutiliza el pago pendiente existente) y valida que la cotización pertenezca al solicitante autenticado (evita IDOR)
- [x] POST /pagos/webhook/wompi con evento payment.confirmed convierte cotización en orden activa — `TestWebhookWompi::test_webhook_confirmado_crea_orden`
- [x] El webhook verifica la firma de Wompi para evitar falsificaciones — implementación **real** de checksum HMAC-SHA256 (antes era un `TODO` que siempre devolvía `True`); `test_webhook_sin_firma_es_rechazado`, `test_webhook_con_firma_invalida_es_rechazado`. Fail-closed: sin `WOMPI_EVENTS_SECRET` configurado, el webhook rechaza todo
- [x] El webhook es idempotente: no procesa el mismo evento dos veces — `test_webhook_es_idempotente`
- [ ] Al confirmar pago, se crea automáticamente una conversación de chat entre solicitante e importador — **diferido a Semana 3** (el modelo de chat/`ConversacionChat` y WebSockets todavía no existen en el backend; queda como `TODO` explícito en `routers/pagos.py`)

**Revisión de seguridad (2026-07-06) — hallazgos críticos corregidos:**
1. El webhook **no verificaba ninguna firma real** (la función `verificar_firma_wompi` era un stub que siempre retornaba `True`), permitiendo que cualquiera con la URL del webhook pudiera falsificar pagos confirmados y generar órdenes gratis. Se implementó verificación real de checksum HMAC-SHA256 siguiendo el esquema de Wompi (`properties` + `timestamp` + secreto).
2. No existía tabla/modelo `Pago` en el código (solo en la documentación). Se agregó `models/pago.py` con `wompi_payment_id` **UNIQUE** (garantiza idempotencia real a nivel de base de datos, no solo por lógica de aplicación).
3. Se agregó manejo de `IntegrityError` + rollback en la creación de la orden desde el webhook, por si dos webhooks concurrentes procesan el mismo pago (la restricción única en `Orden.cotizacion_id` es la garantía ACID real).
4. Se agregó el endpoint `GET /pagos/{id}` (documentado pero no implementado) con verificación de propiedad para evitar IDOR.

#### Entregables

1. ✅ Endpoint POST /pagos/checkout funcional con integración Wompi (simulada para MVP) y persistencia real en tabla `pagos`
2. ✅ Endpoint POST /pagos/webhook/wompi funcional con verificación real de firma HMAC-SHA256
3. ✅ Flujo completo: cotización aceptada → checkout → pago confirmado → orden activa
4. ⬜ Creación automática de conversación de chat al confirmar pago — pendiente para Semana 3 (depende del módulo de Chat-WebSocket)

---

### Tarea 2.4: Implementar notificaciones por cambio de estado de orden

**Módulo:** Backend/Chat-WebSocket  
**Duración estimada:** 1 día  
**Responsable:** Desarrollador Backend

#### Descripción
Implementar las notificaciones en tiempo real para cambios de estado de orden usando WebSocket + Redis Pub/Sub. Cuando el importador actualiza el estado de una orden, el solicitante recibe la notificación inmediatamente.

#### Pasos de implementación

1. **Implementar endpoint PUT /ordenes/{id}/estado** (`routers/ordenes.py`) — Actualizar estado de una orden
   ```python
   @app.put("/ordenes/{orden_id}/estado")
   async def actualizar_estado_orden(
       orden_id: str,
       nuevo_estado: dict,  # {"estado": "en_produccion"}
       current_user: dict = Depends(require_rol("importador")),
       db: Session = Depends(get_db)
   ):
       # 1. Verificar que la orden existe y el importador es el asignado
       orden = db.query(Orden).filter(
           Orden.id == orden_id,
           Orden.importador_id == current_user["user_id"]
       ).first()
       
       if not orden:
           raise HTTPException(status_code=404, detail="Orden no encontrada")
       
       # 2. Verificar que el nuevo estado es válido (transición permitida)
       estados_validos = {
           "cotizacion_aceptada": ["en_produccion"],
           "en_produccion": ["transito_internacional"],
           "transito_internacional": ["aduana_nacionalizacion"],
           "aduana_nacionalizacion": ["bodega_local"],
           "bodega_local": ["entregado"]
       }
       
       estado_actual = orden.estado
       nuevo_estado_valor = nuevo_estado["estado"]
       
       if nuevo_estado_valor not in estados_validos.get(estado_actual, []):
           raise HTTPException(status_code=400, detail=f"Transición de estado inválida: {estado_actual} → {nuevo_estado_valor}")
       
       # 3. Actualizar el estado de la orden
       orden.estado = nuevo_estado_valor
       orden.fecha_actualizacion = datetime.now()
       
       # 4. Registrar cambio en historial de estados
       nuevo_historial = HistorialEstadosOrden(
           orden_id=orden_id,
           estado_anterior=estado_actual,
           estado_nuevo=nuevo_estado_valor,
           fecha_cambio=datetime.now()
       )
       db.add(nuevo_historial)
       
       # 5. Notificar al solicitante vía WebSocket/Redis Pub/Sub
       redis_client.publish(
           f"orden:{orden_id}:notificaciones",
           json.dumps({
               "tipo": "cambio_estado",
               "orden_id": orden_id,
               "estado_anterior": estado_actual,
               "estado_nuevo": nuevo_estado_valor,
               "fecha_cambio": datetime.now().isoformat()
           })
       )
       
       db.commit()
       
       return {"success": True, "nuevo_estado": nuevo_estado_valor}
   ```

2. **Implementar endpoint GET /ordenes/importador/{id}** (`routers/ordenes.py`) — Listar órdenes asignadas al importador

#### Criterios de aceptación

- [x] PUT /ordenes/{id}/estado con estado válido actualiza la orden y registra en historial — `tests/test_ordenes.py::TestActualizarEstadoOrden::test_actualizar_estado_exitoso`
- [x] PUT /ordenes/{id}/estado con transición inválida retorna 400 Bad Request — `test_actualizar_estado_transicion_invalida`
- [ ] El solicitante recibe notificación en tiempo real vía Redis Pub/Sub cuando cambia el estado de su orden — el `redis_client.publish(...)` existe y es best-effort (no rompe la petición si Redis está caído), pero **no hay ningún endpoint WebSocket que reenvíe ese mensaje al frontend todavía**; el consumidor real se implementa en el módulo Backend/Chat-WebSocket de la Semana 3
- [x] GET /ordenes/importador/{id} retorna órdenes asignadas al importador — implementado como `GET /ordenes/importador/{id}/activas` (ver Tarea 2.5); no existe una variante sin filtrar por activas

**Revisión de seguridad (2026-07-06):** la publicación en Redis no estaba protegida contra fallos de conexión: si Redis no estaba disponible, `PUT /ordenes/{id}/estado` fallaba con `500 Internal Server Error` y **no llegaba a hacer `commit()`**, es decir, se perdía la actualización de estado por completo. Se envolvió en `try/except` (best-effort) para que la actualización de la orden se confirme siempre, incluso si la notificación en tiempo real falla.

#### Entregables

1. ✅ Endpoint PUT /ordenes/{id}/estado funcional con validación de transiciones
2. ⚠️ Notificaciones vía Redis Pub/Sub emitidas desde el backend (best-effort), pero sin consumidor WebSocket aún (Semana 3)
3. ✅ Endpoint GET /ordenes/importador/{id}/activas

---

### Tarea 2.5: Implementar panel del importador — bandeja de solicitudes

**Módulo:** Backend/API-Rest  
**Duración estimada:** 1 día  
**Responsable:** Desarrollador Backend

#### Descripción
Implementar los endpoints REST para que el importador pueda ver todas las solicitudes dirigidas y abiertas que le aplican, así como sus órdenes activas.

#### Pasos de implementación

1. **Implementar endpoint GET /importadores/{id}/solicitudes-dirigidas** (`routers/importadores.py`)
   - Listar cotizaciones dirigidas al importador con estado "dirigida" o "propuestas_recibidas"

2. **Implementar endpoint GET /importadores/{id}/solicitudes-abiertas** (`routers/importadores.py`)
   - Listar cotizaciones abiertas que aplican al importador (usando el motor de matching)
   - Solo cotizaciones con estado "abierta" o "propuestas_recibidas"

3. **Implementar endpoint GET /ordenes/importador/{id}/activas** (`routers/ordenes.py`)
   - Listar órdenes asignadas al importador con estado diferente a "entregado"

#### Criterios de aceptación

- [x] GET /importadores/{id}/solicitudes-dirigidas retorna cotizaciones dirigidas al importador (200 OK) — `tests/test_importadores.py::TestBandejaSolicitudesImportador::test_solicitudes_dirigidas_solo_propias`
- [x] GET /importadores/{id}/solicitudes-abiertas retorna cotizaciones abiertas que aplican al importador (200 OK) — `test_solicitudes_abiertas_con_matching`
- [x] GET /ordenes/importador/{id}/activas retorna órdenes activas del importador (200 OK) — `tests/test_ordenes.py::TestListarOrdenesActivasImportador`

**Revisión de seguridad (2026-07-06) — hallazgos críticos corregidos, sin tests previos:**
1. **IDOR en los 3 endpoints**: comparaban `importador_id` de la URL contra `current_user.get("importador_id")`, una clave inexistente en el JWT (siempre `None`), por lo que el `if` de autorización nunca se ejecutaba y **cualquier importador autenticado podía leer la bandeja de solicitudes/órdenes de cualquier otro importador** simplemente cambiando el UUID en la URL. Se corrigió comparando contra `current_user["user_id"]`, y se agregaron tests explícitos de IDOR (`test_solicitudes_dirigidas_idor_rechazado`, `test_solicitudes_abiertas_idor_rechazado`) que confirman 403.
2. **Bug funcional en `solicitudes-abiertas`**: el código construía un diccionario `cotizaciones_matching` a partir de Redis pero comprobaba una variable distinta (`importadores_matching`) que nunca se asignaba — el filtro de matching nunca se aplicaba y el importador veía **todas** las cotizaciones abiertas de la plataforma, sin importar si el motor de matching realmente lo había seleccionado (país + categoría). Corregido y cubierto por `test_solicitudes_abiertas_con_matching`.

#### Entregables

1. ✅ Endpoint GET /importadores/{id}/solicitudes-dirigidas funcional (con verificación de propiedad)
2. ✅ Endpoint GET /importadores/{id}/solicitudes-abiertas funcional (con filtro de matching real vía Redis)
3. ✅ Endpoint GET /ordenes/importador/{id}/activas funcional (con verificación de propiedad)

---

## Tareas Frontend — Semana 2

### Tarea 2.6: Implementar panel de propuestas recibidas (solicitante)

**Módulo:** Frontend/Pantallas-Solicitante  
**Duración estimada:** 1.5 días  
**Responsable:** Desarrollador Frontend Senior

#### Descripción
Implementar la pantalla P6 — Panel de Propuestas Recibidas donde el solicitante ve las propuestas de los importadores y puede elegir con cuál conectarse.

#### Pasos de implementación

1. **Crear página de panel de propuestas** (`app/cotizacion/propuestas/page.tsx`)
   - Contador de propuestas: "X de Y importadores respondieron"
   - Lista de propuestas activas como tarjetas
   - Lista de propuestas pendientes como tarjetas

2. **Crear componente de tarjeta de propuesta activa** (`components/PropuestaCard.tsx`)
   ```typescript
   interface PropuestaCardProps {
     id: string;
     importadorNombre: string;
     importadorLogo?: string;
     precioOfrecidoUsd: number;
     tiempoEstimadoEntrega: string;
     incoterm: string;
     condicionesAdicionales?: string;
     onConnect: (propuestaId: string) => void;
   }
   
   export function PropuestaCard({ importadorNombre, importadorLogo, precioOfrecidoUsd, tiempoEstimadoEntrega, incoterm, condicionesAdicionales, onConnect }: PropuestaCardProps) {
     return (
       <div className="bg-white rounded-xl shadow-sm p-6">
         <div className="flex items-center gap-4 mb-4">
           {importadorLogo && <img src={importadorLogo} alt={importadorNombre} className="w-12 h-12 rounded-full" />}
           <h3 className="text-lg font-semibold">{importadorNombre}</h3>
         </div>
         
         <div className="space-y-2 mb-4">
           <p><strong>Precio:</strong> ${precioOfrecidoUsd.toFixed(2)} USD</p>
           <p><strong>Tiempo estimado:</strong> {tiempoEstimadoEntrega}</p>
           <p><strong>Incoterm:</strong> {incoterm}</p>
           {condicionesAdicionales && <p><strong>Condiciones:</strong> {condicionesAdicionales}</p>}
         </div>
         
         <button 
           onClick={() => onConnect(id)}
           className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
         >
           Conectar con este importador
         </button>
       </div>
     );
   }
   ```

3. **Crear componente de tarjeta de propuesta pendiente** (`components/PropuestaPendienteCard.tsx`)
   - Logo del importador, nombre, indicador de espera (spinner)

4. **Implementar fetch de propuestas** — Llamar a GET /cotizaciones/{id}/propuestas (propuestas activas) y a GET /cotizaciones/{id}/matching-status (contador "X de Y" y lista de importadores pendientes) al cargar la página

5. **Implementar conexión con importador elegido** — Al hacer clic en "Conectar con este importador", redirigir al checkout de pago Wompi (P7)

#### Criterios de aceptación

- [ ] El panel muestra el contador de propuestas: "X de Y importadores respondieron"
- [ ] Las propuestas activas se muestran como tarjetas con precio, tiempo estimado e incoterm
- [ ] Las propuestas pendientes se muestran como tarjetas con indicador de espera
- [ ] Al hacer clic en "Conectar con este importador", redirige al checkout de pago Wompi

#### Entregables

1. Página de panel de propuestas funcional
2. Componente de tarjeta de propuesta activa con toda la información relevante
3. Componente de tarjeta de propuesta pendiente con indicador de espera
4. Fetch de propuestas desde el backend
5. Navegación al checkout tras seleccionar un importador

---

### Tarea 2.7: Implementar checkout de pago (Wompi)

**Módulo:** Frontend/Pantallas-Solicitante  
**Duración estimada:** 1 día  
**Responsable:** Desarrollador Frontend

#### Descripción
Implementar la pantalla P7 — Checkout de Pago Wompi con resumen del pedido y redirección a la pasarela de pagos.

#### Pasos de implementación

1. **Crear página de checkout** (`app/pagos/checkout/page.tsx`)
   - Resumen del pedido: importador, producto, precio acordado, costo de servicio
   - Selector de método de pago (tarjeta, PSE, efectivo)
   - Botón de pago que redirige al checkout de Wompi

2. **Implementar fetch de datos del checkout** — Llamar a POST /pagos/checkout con el cotizacion_id

3. **Redirección al checkout de Wompi** — Abrir la URL del checkout en una nueva ventana o iframe

4. **Manejo de redirección tras completar el pago** — Escuchar eventos de redirección de Wompi y redirigir al detalle de la orden (P8)

#### Criterios de aceptación

- [ ] El checkout muestra resumen del pedido con importador, producto, precio acordado y costo de servicio
- [ ] Al hacer clic en "Pagar", se redirige a la URL de checkout de Wompi
- [ ] Tras completar el pago, el usuario es redirigido al detalle de la orden

#### Entregables

1. Página de checkout funcional con resumen del pedido
2. Redirección al checkout de Wompi
3. Manejo de redirección tras completar el pago

---

### Tarea 2.8: Implementar detalle de orden con línea de estados

**Módulo:** Frontend/Pantallas-Solicitante  
**Duración estimada:** 1.5 días  
**Responsable:** Desarrollador Frontend Senior

#### Descripción
Implementar la pantalla P8 — Detalle de Orden con línea de estados visual, historial de cambios y acceso a chat y documentos.

#### Pasos de implementación

1. **Crear página de detalle de orden** (`app/ordenes/[id]/page.tsx`)
   - Línea de estados visual (timeline horizontal)
   - Información general: importador, asesor, precio, tiempo estimado
   - Historial de cambios de estado con fecha y hora
   - Sección de documentos adjuntos
   - Botones: "Chat con asesor", "Reportar problema"

2. **Crear componente de línea de estados** (`components/EstadoOrdenTimeline.tsx`)
   ```typescript
   interface EstadoOrdenTimelineProps {
     estadoActual: string;
     historialEstados: Array<{estado_nuevo: string; fecha_cambio: string}>;
   }
   
   const ESTADOS = [
     "cotizacion_aceptada",
     "en_produccion",
     "transito_internacional",
     "aduana_nacionalizacion",
     "bodega_local",
     "entregado"
   ];
   
   export function EstadoOrdenTimeline({ estadoActual, historialEstados }: EstadoOrdenTimelineProps) {
     const indiceActual = ESTADOS.indexOf(estadoActual);
     
     return (
       <div className="flex items-center justify-between mb-8">
         {ESTADOS.map((estado, index) => {
           const completado = index <= indiceActual;
           const esActual = estado === estadoActual;
           
           return (
             <React.Fragment key={estado}>
               <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                 completado ? 'bg-green-500' : esActual ? 'bg-blue-500' : 'bg-gray-200'
               }`}>
                 {completado ? (
                   <CheckIcon className="w-6 h-6 text-white" />
                 ) : esActual ? (
                   <ClockIcon className="w-6 h-6 text-white" />
                 ) : (
                   <div className="w-4 h-4 rounded-full bg-gray-300" />
                 )}
               </div>
               {index < ESTADOS.length - 1 && (
                 <div className={`flex-1 h-1 mx-2 ${completado ? 'bg-green-500' : 'bg-gray-200'}`} />
               )}
             </React.Fragment>
           );
         })}
       </div>
     );
   }
   ```

3. **Implementar fetch de datos de la orden** — Llamar a GET /ordenes/{id} al cargar la página

4. **Implementar actualización en tiempo real del estado** — Escuchar eventos de Redis Pub/Sub para cambios de estado

#### Criterios de aceptación

- [ ] La línea de estados visual muestra los 6 estados con iconos (✅ completado, 🔵 actual, ⬜ pendiente)
- [ ] El historial de cambios de estado se muestra con fecha y hora
- [ ] Los botones "Chat con asesor" y "Reportar problema" son funcionales
- [ ] La sección de documentos adjuntos lista los archivos disponibles

#### Entregables

1. Página de detalle de orden funcional con línea de estados visual
2. Componente de línea de estados con iconos según estado (✅, 🔵, ⬜)
3. Historial de cambios de estado con fecha y hora
4. Sección de documentos adjuntos

---

### Tarea 2.9: Implementar bandeja de solicitudes del importador

**Módulo:** Frontend/Pantallas-Importador  
**Duración estimada:** 1.5 días  
**Responsable:** Desarrollador Frontend Senior

#### Descripción
Implementar la pantalla P10 — Bandeja de Solicitudes del Importador con tabs, filtros y tarjetas de solicitud recibida.

#### Pasos de implementación

1. **Crear página de bandeja de solicitudes** (`app/importador/solicitudes/page.tsx`)
   - Tabs: Solicitudes | Órdenes Activas
   - Filtros: Modalidad (Dirigida/Abierta/Todas), Estado (Pendiente/Respondido/Todos)
   - Tarjetas de solicitud recibida con foto del producto, nombre, etiqueta de modalidad, cantidad, precio objetivo, tiempo desde recepción

2. **Crear componente de tarjeta de solicitud** (`components/SolicitudCard.tsx`)
   ```typescript
   interface SolicitudCardProps {
     id: string;
     nombreProducto: string;
     modalida: 'dirigida' | 'abierta';
     cantidad: number;
     precioObjetivoUsd: number;
     tiempoDesdeRecepcion: string;
     estado: 'pendiente' | 'respondido';
     onClick: (id: string) => void;
   }
   
   export function SolicitudCard({ nombreProducto, modalida, cantidad, precioObjetivoUsd, tiempoDesdeRecepcion, estado, onClick }: SolicitudCardProps) {
     return (
       <div className="bg-white rounded-xl shadow-sm p-6">
         <div className="flex items-center justify-between mb-4">
           <h3 className="text-lg font-semibold">{nombreProducto}</h3>
           <span className={`px-2 py-1 rounded-full text-xs ${
             modalida === 'dirigida' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
           }`}>
             {modalida === 'dirigida' ? '🏷️ Dirigida' : '🌐 Abierta'}
           </span>
         </div>
         
         <p className="text-sm text-gray-600 mb-2">Cantidad: {cantidad} unidades</p>
         <p className="text-sm text-gray-600 mb-2">Precio objetivo: ${precioObjetivoUsd.toFixed(2)} USD</p>
         <p className="text-xs text-gray-400">{tiempoDesdeRecepcion}</p>
         
         <button 
           onClick={() => onClick(id)}
           className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
         >
           Responder cotización
         </button>
       </div>
     );
   }
   ```

3. **Implementar fetch de solicitudes** — Llamar a GET /importadores/{id}/solicitudes-dirigidas y GET /importadores/{id}/solicitudes-abiertas

4. **Implementar filtros** — Actualizar el estado de solicitudes cuando cambian los filtros

#### Criterios de aceptación

- [ ] La bandeja muestra tabs funcionales (Solicitudes | Órdenes Activas)
- [ ] Los filtros (modalidad, estado) filtran correctamente las solicitudes
- [ ] Las tarjetas de solicitud muestran foto del producto, nombre, etiqueta de modalidad, cantidad y precio objetivo
- [ ] Al hacer clic en "Responder cotización", redirige al formulario de respuesta

#### Entregables

1. Página de bandeja de solicitudes funcional con tabs y filtros
2. Componente de tarjeta de solicitud con etiqueta de modalidad (Dirigida/Abierta)
3. Fetch de solicitudes desde el backend
4. Filtros funcionales por modalidad y estado

---

### Tarea 2.10: Implementar formulario de respuesta a cotización (importador)

**Módulo:** Frontend/Pantallas-Importador  
**Duración estimada:** 1 día  
**Responsable:** Desarrollador Frontend

#### Descripción
Implementar la pantalla P11 — Formulario de Respuesta a Cotización donde el importador envía su propuesta con precio, tiempo estimado y condiciones.

#### Pasos de implementación

1. **Crear página de formulario de respuesta** (`app/importador/propuestas/nueva/page.tsx`)
   - Sección de datos de la solicitud (solo lectura): muestra toda la información del formulario del solicitante
   - Campo de precio ofrecido: number input con prefijo USD
   - Campo de tiempo estimado: text input (ej: "45 días")
   - Selector de incoterm: dropdown con opciones FOB, CIF, EXW, DDP
   - Área de texto para condiciones adicionales

2. **Implementar fetch de datos de la solicitud** — Llamar a GET /cotizaciones/{id} al cargar la página

3. **Implementar envío del formulario** — Llamar a POST /propuestas con los datos de la propuesta

4. **Validaciones en tiempo real** — Precio positivo, tiempo mínimo 7 días

#### Criterios de aceptación

- [ ] El formulario muestra todos los datos de la solicitud (solo lectura)
- [ ] Los campos de precio, tiempo estimado e incoterm son editables por el importador
- [ ] Las validaciones en tiempo real muestran mensajes de error apropiados
- [ ] Al enviar el formulario, se llama al endpoint POST /propuestas del backend

#### Entregables

1. Página de formulario de respuesta funcional con datos de la solicitud (solo lectura)
2. Campos editables para precio, tiempo estimado e incoterm
3. Validaciones en tiempo real
4. Envío del formulario al backend

---

## Criterios de aceptacion — Semana 2 (Resumen)

| Entregable | Criterio de aceptación | Estado backend | Estado frontend |
|------------|----------------------|-----------------|------------------|
| Propuestas | Los importadores matching pueden enviar propuestas (incluyendo incoterm). El solicitante ve las propuestas recibidas en tiempo real. | ✅ API + tests | ⬜ No implementado |
| Panel de propuestas recibidas | El solicitante ve cuántos importadores de la red respondieron ("X de Y") y cuáles siguen pendientes, con nombre y logo. | ✅ API + tests (`GET /cotizaciones/{id}/matching-status`) | ⬜ No implementado |
| Órdenes | Al confirmar el pago con Wompi, la cotización se convierte automáticamente en orden. Las órdenes tienen estados visuales. | ✅ API + tests | ⬜ No implementado |
| Checkout Wompi | El solicitante puede completar el pago a través de Wompi y ser redirigido al detalle de la orden tras confirmación. | ✅ API + tests (firma real, idempotente) | ⬜ No implementado |
| Bandeja importador | El importador ve todas las solicitudes dirigidas y abiertas que le aplican, con filtros por modalidad y estado. | ✅ API + tests (IDOR corregido) | ⬜ No implementado |
| Formulario respuesta | El importador puede enviar una propuesta con precio, tiempo estimado e incoterm para cualquier solicitud recibida. | ✅ API + tests | ⬜ No implementado |

*"Tiempo real" en Propuestas/Órdenes se refiere al Pub/Sub de Redis emitido por el backend; el consumidor WebSocket que lo entrega al navegador es trabajo de Semana 3.*

---

## Dependencias entre tareas

```mermaid
graph TD
    A[Tarea 2.1: CRUD Propuestas] --> B[Tarea 2.6: Panel Propuestas Solicitante]
    C[Tarea 2.2: Módulo Órdenes] --> D[Tarea 2.8: Detalle Orden]
    
    E[Tarea 2.3: Conversión Cotización→Orden] --> F[Tarea 2.7: Checkout Wompi]
    G[Tarea 2.4: Notificaciones Estado] --> H[Notificaciones en tiempo real]
    
    I[Tarea 2.5: Panel Importador API] --> J[Tarea 2.9: Bandeja Importador Frontend]
    B --> K[Panel de propuestas funcional]
    D --> L[Detalle de orden funcional]
    F --> M[Flujo de pago completo]
    J --> N[Bandeja importador funcional]
```

---

## Notas adicionales

- **Prioridad:** Las tareas P0 deben completarse antes de las P1. No se puede avanzar a la Semana 3 sin tener el flujo completo de cotización → propuesta → pago → orden.
- **Testing:** Cada tarea debe incluir al menos pruebas unitarias básicas para los endpoints y componentes principales.
- **Documentación:** Actualizar la documentación del vault en Obsidian con cualquier cambio significativo en los endpoints o pantallas.