# APIs — Créditos y pagos

> Generado desde OpenAPI en vivo (`/openapi.json`). Base URL local: `http://localhost:8000`.

## Modelo actual (importante)

**No se cobra a la persona/empresa que cotiza** (solicitante natural o jurídica).

| Comportamiento | Estado |
|----------------|--------|
| Crear cotización | **Gratis** (`costo_creditos = 0`) |
| `POST /creditos/comprar` | **410 Gone** (deshabilitado) |
| Bonos de registro / referidos en créditos | **No** se otorgan |
| Cobro de la plataforma | A **importadoras** (contrato/suscripción, fuera de este wallet) |

Flag de backend: `COBRO_A_SOLICITANTES=false` (default). Solo poner `true` si se reactiva el wallet del cotizante.

Los endpoints `GET /creditos/saldo` y `GET /creditos/movimientos` pueden seguir respondiendo (saldo 0 para usuarios nuevos); el frontend no debe exigir compra de créditos para cotizar.

### `POST /creditos/comprar`

- **Resumen:** Comprar Creditos
- **Auth:** Bearer JWT
- **Códigos:** **410** (default), 200 si `COBRO_A_SOLICITANTES=true`, 422

**Body (`ComprarCreditosRequest`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `monto_usd` | `number` | sí | Monto en USD a pagar; se convierte a créditos con CREDITO_USD_POR_UNIDAD |

```json
{
  "monto_usd": 0
}
```

**Respuesta (`ComprarCreditosResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `checkout_url` | `string` | sí |  |
| `wompi_payment_id` | `string` | sí |  |
| `monto_usd` | `number` | sí |  |
| `creditos_a_acreditar` | `number` | sí |  |

---

### `GET /creditos/movimientos`

- **Resumen:** Listar Movimientos
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`array[MovimientoCreditoResponse]`)**

Array de `MovimientoCreditoResponse`:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `tipo` | `string` | sí |  |
| `monto` | `number` | sí |  |
| `cotizacion_id` | `Optional[string]` | sí |  |
| `pago_id` | `Optional[string]` | sí |  |
| `organizacion_id` | `Optional[string]` | no |  |
| `descripcion` | `Optional[string]` | sí |  |
| `fecha` | `string` | sí |  |

---

### `GET /creditos/saldo`

- **Resumen:** Obtener Saldo
- **Auth:** Bearer JWT
- **Códigos:** 200

**Respuesta (`SaldoCreditosResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `creditos_balance` | `number` | sí |  |
| `wallet_tipo` | `string` | no |  |
| `organizacion_id` | `Optional[string]` | no |  |

---

### `POST /pagos/webhook/wompi`

- **Resumen:** Webhook Wompi
- **Auth:** Público
- **Códigos:** 200, 422

**Body (`WompiWebhookEvent`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `event` | `string` | sí |  |
| `data` | `object` | sí |  |
| `timestamp` | `Optional[integer]` | no |  |
| `signature` | `Optional[WompiWebhookSignature]` | no |  |

```json
{
  "event": "<event>",
  "data": null
}
```

---

### `GET /pagos/{pago_id}`

- **Resumen:** Obtener Pago
- **Auth:** Bearer JWT
- **Códigos:** 200, 422
- **Path params:** `pago_id`

**Respuesta (`PagoResponse`)**

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `id` | `string` | sí |  |
| `usuario_id` | `string` | sí |  |
| `wompi_payment_id` | `string` | sí |  |
| `monto_usd` | `number` | sí |  |
| `creditos_comprados` | `number` | sí |  |
| `estado` | `string` | sí |  |
| `fecha_creacion` | `string` | sí |  |
| `fecha_confirmacion` | `Optional[string]` | sí |  |

---
