# Pagos con Wompi — ImportacionesQ8

## Descripción general

Integración de **Wompi** como pasarela de pagos para el mercado colombiano. Delega el cumplimiento de seguridad de pagos (PCI) al proveedor, evitando que el equipo tenga que construir o certificar esa capa. Integración rápida y confiable, ideal para un sprint de 3 semanas.

---

## Flujo de pago con Wompi

```mermaid
sequenceDiagram
    participant S as Solicitante
    participant F as Frontend React/Next.js
    participant API as FastAPI
    participant W as Wompi API
    participant DB as MySQL

    Note over S,DB: === GENERAR CHECKOUT DE PAGO ===
    S->>F: Acepta oferta en cotización
    F->>API: POST /pagos/checkout {cotizacion_id}
    API->>DB: Verificar cotización y estado
    DB-->>API: Cotización válida, precio_acordado_usd
    API->>W: Crear checkout de pago (monto en USD)
    W-->>API: Checkout URL + payment_id
    API->>DB: INSERT INTO pagos {orden_id, wompi_payment_id, monto_usd, estado='pendiente', webhook_url}
    DB-->>API: Pago creado
    API-->>F: {checkout_url, wompi_payment_id}
    F->>S: Redirige a Wompi para completar pago

    Note over S,DB: === CONFIRMACIÓN DE PAGO (WEBHOOK) ===
    S->>W: Completa el pago en la pasarela
    W->>API: POST /pagos/webhook/wompi {event, payment_id, data}
    API->>DB: Verificar wompi_payment_id
    DB-->>API: Pago pendiente encontrado
    API->>DB: Actualizar pagos SET estado='confirmado', fecha_confirmacion=NOW()
    DB-->>API: Pago confirmado
    API->>DB: Actualizar cotizaciones SET estado='orden_activa'
    DB-->>API: Cotización convertida en orden
    API->>DB: INSERT INTO ordenes (cotizacion_id, importador_id, solicitante_id)
    DB-->>API: Orden creada
    API->>F: Notificar cambio de estado vía WebSocket
```

---

## Endpoints de pagos

### Generar checkout de pago

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/pagos/checkout` | Genera enlace de pago con Wompi para una cotización aceptada |

**Request body:**
```json
{
    "cotizacion_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (200 OK):**
```json
{
    "success": true,
    "data": {
        "checkout_url": "https://pay.wompi.co/checkout/abc123",
        "wompi_payment_id": "wpm_abc123"
    }
}
```

**Response (400 Bad Request):**
```json
{
    "success": false,
    "error": "La cotización no está en estado 'cotizacion_aceptada'"
}
```

### Obtener estado del pago

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/pagos/{id}` | Obtiene el estado actual de un pago |

**Response (200 OK):**
```json
{
    "success": true,
    "data": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "orden_id": "660f9500-f39c-52e5-b827-557766551111",
        "wompi_payment_id": "wpm_abc123",
        "monto_usd": 150.00,
        "estado": "confirmado",
        "fecha_creacion": "2026-07-05T10:00:00Z",
        "fecha_confirmacion": "2026-07-05T10:05:00Z"
    }
}
```

### Webhook de confirmación de pago (Wompi)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/pagos/webhook/wompi` | Recibe notificaciones de Wompi sobre el estado del pago |

**Request body (evento de pago confirmado):**
```json
{
    "event": "payment.confirmed",
    "data": {
        "id": "wpm_abc123",
        "amount_including_taxes": 150.00,
        "currency": "USD",
        "status": "confirmed"
    }
}
```

**Response (200 OK):**
```json
{
    "success": true
}
```

---

## Eventos de Wompi manejados

| Evento | Acción en la plataforma | Estado del pago |
|--------|----------------------|-----------------|
| `payment.confirmed` | Cotización → Orden activa, notificar al solicitante y importador vía WebSocket | `confirmado` |
| `payment.failed` | Mantener cotización en estado "pendiente de pago", notificar al solicitante | `fallido` |
| `payment.refunded` | Notificar disputa, cambiar estado de orden a "en disputa/reembolso" | `reembolsado` |

---

## Estados del pago

```mermaid
stateDiagram-v2
    [*] --> Pendiente: Generar checkout Wompi
    Pendiente --> Confirmado: Webhook payment.confirmed
    Pendiente --> Fallido: Webhook payment.failed
    Confirmado --> Reembolsado: Webhook payment.refunded
    Fallido --> Pendiente: Reintento de pago (nuevo checkout)
```

---

## Integración con Wompi — Configuración

### Credenciales necesarias

| Variable | Descripción |
|----------|-------------|
| `WOMPI_PUBLIC_KEY` | Clave pública de Wompi para generar el checkout |
| `WOMPI_SECRET_KEY` | Clave secreta de Wompi para verificar webhooks |
| `WOMPI_WEBHOOK_URL` | URL del webhook en nuestra API (ej: `https://api.importacionesq8.com/pagos/webhook/wompi`) |

### Flujo de configuración inicial con Wompi

1. Crear cuenta en Wompi y obtener las credenciales (sandbox para desarrollo, producción para lanzamiento)
2. Configurar el webhook URL en el panel de administración de Wompi
3. Configurar la variable `WOMPI_WEBHOOK_URL` en las variables de entorno del backend
4. Probar con pagos sandbox antes de activar producción

---

## Notas de implementación

- **Moneda:** Los pagos se procesan en USD (moneda principal del proyecto). Wompi soporta múltiples monedas.
- **Monto dinámico:** El monto del pago se obtiene de `precio_acordado_usd`/`precio_ofrecido_usd` de la propuesta aceptada (10% de comisión), no es un valor fijo.
- **Webhook seguro:** Verificar la firma del webhook de Wompi usando `WOMPI_SECRET_KEY` para evitar falsificaciones.
- **Idempotencia:** El webhook puede recibir el mismo evento múltiples veces; verificar que el pago ya esté confirmado antes de procesar.
- **No se almacenan datos de tarjetas:** La plataforma nunca maneja directamente los datos de la tarjeta o cuenta bancaria del solicitante — Wompi es responsable del cumplimiento PCI.

### Estado de implementación (revisado 2026-07-06)

| Elemento documentado | Estado | Detalle |
|---|---|---|
| Modelo/tabla `pagos` | ✅ Implementado | `models/pago.py` — antes solo existía en esta documentación, no en el código. Incluye `wompi_payment_id` **UNIQUE** para garantizar idempotencia a nivel de base de datos |
| `POST /pagos/checkout` | ✅ Implementado | `routers/pagos.py`. Idempotente: si ya hay un pago pendiente para la cotización, se reutiliza en vez de duplicarlo. Valida que la cotización pertenezca al solicitante autenticado |
| `GET /pagos/{id}` | ✅ Implementado | Estaba documentado pero no existía en el código; se agregó con verificación de propiedad (evita IDOR) |
| `POST /pagos/webhook/wompi` | ✅ Implementado | Verificación real de firma HMAC-SHA256 (checksum de `properties` + `timestamp` + `WOMPI_EVENTS_SECRET`), **fail-closed**: sin firma válida se responde `403` y no se procesa el evento. Antes, la función `verificar_firma_wompi` era un stub que siempre devolvía `True` — cualquiera con la URL del webhook podía simular pagos confirmados y generar órdenes gratis |
| Idempotencia del webhook | ✅ Implementado | Se verifica el estado del `Pago` antes de reprocesar; además `IntegrityError`/rollback protege contra dos webhooks concurrentes creando dos órdenes para la misma cotización |
| Creación automática de conversación de chat al confirmar pago | ⬜ Pendiente | Depende del módulo de chat, planeado para Semana 3 |
| Integración real con la API de Wompi (checkout/API keys reales) | ⬜ Pendiente | El MVP simula la generación del checkout (`wpm_...` + URL simulada); la integración real con el SDK/API de Wompi queda para antes de producción |

**Variables de entorno usadas:** `WOMPI_PUBLIC_KEY`, `WOMPI_SECRET_KEY`, `WOMPI_EVENTS_SECRET` (ver `.env.example`). Sin `WOMPI_EVENTS_SECRET` configurado, el webhook rechaza todos los eventos por diseño (fail-closed).