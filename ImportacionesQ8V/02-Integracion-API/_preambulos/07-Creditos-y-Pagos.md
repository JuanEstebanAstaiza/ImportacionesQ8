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
