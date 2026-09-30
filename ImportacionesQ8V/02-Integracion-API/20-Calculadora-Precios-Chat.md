# APIs — Calculadora de precios en el chat

> Backend: `services/calculadora_precios.py`, `routers/chat.py`. Frontend: `src/features/chat/CalculadoraPrecios.tsx`.
> Sin migración: la estimación es un mensaje de chat más (`tipo: "estimacion"`).

La empresa importadora (dueño o asesor) calcula un precio estimado de la cotización u orden mientras conversa con el cliente y se lo envía al chat. El cliente lo recibe al instante como una tarjeta con total, rango posible, costo por unidad y desglose.

---

## Cálculo

| Concepto | Base |
|----------|------|
| Mercancía | cantidad × precio unitario |
| Seguro | (mercancía + flete) × % seguro |
| Valor CIF | mercancía + flete + seguro |
| Arancel | CIF × % arancel |
| IVA | (CIF + arancel) × % IVA |
| Gestión de la empresa | (CIF + arancel + gastos en destino) × % margen; el IVA no entra en la base |
| **Total** | CIF + arancel + IVA + gastos en destino + gestión |
| Rango posible | total × (1 ± % rango) |
| Total en COP | total × tasa (solo si la moneda no es COP y se indica tasa) |

Importes redondeados a centavos. Monedas: `USD`, `COP`, `EUR`, `CNY`.

---

## `POST /chat/calculadora/calcular`

Cuenta dueña o asesor. Vista previa: no guarda ni envía nada. El panel del frontend la pide mientras se escribe.

```json
{
  "moneda": "USD", "cantidad": 500, "precio_unitario": 4,
  "flete_internacional": 800, "seguro_pct": 1, "arancel_pct": 10, "iva_pct": 19,
  "gastos_destino": 300, "margen_pct": 10, "rango_pct": 5, "tasa_cambio_cop": 4000,
  "incoterm": "DDP", "tiempo_entrega": "45 días", "validez_dias": 15, "notas": "…"
}
```

Respuesta: `{ "entrada": {…}, "desglose": { "valor_mercancia", "flete_internacional", "seguro", "valor_cif", "arancel", "iva", "gastos_destino", "margen", "total", "costo_unitario", "total_minimo", "total_maximo", "total_cop" }, "resumen": "Estimación de precio: USD 4,342.93 (…)" }`.

Rangos: `cantidad` ≥ 1; porcentajes 0–100 (`rango_pct` hasta 50); `validez_dias` 1–90. Fuera de rango, `422`.

---

## `POST /chat/conversaciones/{id}/estimaciones`

Cuenta dueña o asesor con acceso a la conversación. Mismo cuerpo que la vista previa. Crea un mensaje `tipo: "estimacion"`:

- `contenido`: el resumen en texto (lista de chats, notificaciones, WhatsApp/correo).
- `metadata.estimacion`: `{ entrada, desglose, cotizacion_id, orden_id }`.

Se reparte en vivo por el WebSocket de la conversación y notifica al cliente como cualquier mensaje.

| Caso | Resultado |
|------|-----------|
| Solicitante | `403` |
| Usuario de otra empresa | `403` |
| Chat interno o ticket de soporte | `400` |
| Entrada inválida | `422` |

El desglose **siempre** lo calcula el servidor. Los canales genéricos (`POST …/mensajes` y el WebSocket) solo aceptan `texto` y `archivo`, así que nadie puede colar un mensaje `estimacion` (ni `sistema`) con cifras inventadas.
