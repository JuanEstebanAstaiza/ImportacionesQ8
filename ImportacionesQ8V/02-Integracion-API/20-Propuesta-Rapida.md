# APIs — Propuesta rápida (reemplaza la calculadora del chat)

> Backend: `services/formulario_propuesta.py`, `routers/condiciones_propuesta.py`, `routers/cotizaciones.py` (`POST/PUT /propuestas`).
> Frontend: `src/features/propuestas/` (`FormularioPropuesta`, `TarjetaPropuestaChat`, `CondicionesEmpresa`, `calculo.ts`).
> **Sin migración.** Diseño de referencia: «Formulario de propuesta» (3 pantallas, 13 oct 2026).

La importadora responde una cotización con dos precios, la entrega, el tiempo y los permisos. El resto sale de sus **Condiciones de tus propuestas**, que llena una vez. El cliente recibe en el chat un **precio cerrado en pesos, IVA incluido**, con todo a la vista.

La calculadora del chat (`/chat/calculadora/calcular`, `/chat/conversaciones/{id}/estimaciones`, `tipo: "estimacion"`) se retiró. Los mensajes viejos con ese tipo se siguen mostrando como texto.

El formulario de tres pasos (Económica / Logística / Observaciones) también se reemplazó: el botón del chat y «Responder cotización» abren el mismo formulario nuevo.

---

## Cálculo

Es el mismo en `formulario_propuesta.calcular` y en `calculo.ts`. El servidor lo rehace al guardar y no acepta totales del navegador.

| Concepto | Cálculo |
|----------|---------|
| Producto | precio por unidad en China (USD) × cantidad × TRM |
| Logística y nacionalización | valor × TRM si va en USD, o el valor tal cual si va en COP. Incluye flete, seguro, aranceles, agenciamiento y la gestión, hasta la bodega |
| Entrega | solo con «Valor fijo»: se suma al subtotal y va en la factura |
| Subtotal | producto + logística + entrega |
| IVA de la venta | subtotal × 19, 5 o 0 % |
| **Total** | subtotal + IVA, en pesos |
| Por unidad | total / cantidad (y su equivalente en USD a la TRM de la propuesta) |

Ejemplo del diseño: USD 4,80 × 600, logística USD 1.700, TRM 3.920 e IVA 19 % dan un total de **$21.364.784** ($35.608 por unidad).

---

## `POST /propuestas`, `POST /propuestas/borrador`, `PUT /propuestas/{id}`

Son los mismos endpoints de antes. Ahora aceptan `formulario`:

```json
{
  "cotizacion_id": "…",
  "formulario": {
    "precio_unitario_usd": 4.8, "cantidad": 600,
    "logistica_valor": 1700, "logistica_moneda": "USD",
    "trm": 3920, "iva_pct": 19,
    "bodega_ciudad": "Cali", "bodega_direccion": "Calle 10 # 5-20",
    "ciudad_destino": "Medellín",
    "entrega_modo": "cliente", "entrega_valor_cop": null, "flete_aprox_cop": 220000,
    "via": "maritimo", "dias_min": 40, "dias_max": 50,
    "requiere_permisos": true, "permiso_cual": "Notificación sanitaria INVIMA", "permiso_gestiona": "importadora",
    "nota": null, "mostrar_desglose": false
  }
}
```

**Validaciones (422):**
- con `entrega_modo: "fijo"` hace falta el valor;
- `dias_max` tiene que ser mayor o igual que `dias_min`;
- si requiere permisos, hay que decir cuál;
- el IVA solo puede ser 19, 5 o 0.

**Lo que guarda el servidor:**
- `precio_ofrecido_usd`: el total convertido a USD con la TRM de la propuesta. Lo que ya suma en USD (métricas, tier, panel) sigue funcionando.
- `tiempo_estimado_entrega`: «De 40 a 50 días desde el anticipo, marítimo».
- `incoterm`: `DDP`, porque el precio queda puesto en Colombia y nacionalizado.
- `cantidad`.
- `condiciones_adicionales`: JSON `{"schema": "propuesta-v2", formulario, totales, condiciones, vigencia_hasta, variacion_maxima_pct}`.
  - `condiciones` es una **copia** de las condiciones de la empresa en ese momento: si las cambia después, lo ya enviado no cambia.
  - Al crearse la orden, este JSON se copia a `ordenes.condiciones_adicionales`.

Sin `formulario`, los endpoints siguen aceptando el formato anterior (`precio_ofrecido_usd`, `tiempo_estimado_entrega` e `incoterm` obligatorios).

**Quién envía:** no cambia. El asesor deja borrador y la cuenta dueña lo envía (`POST /propuestas/{id}/enviar`). Si la llena la dueña, sale directo.

### La tarjeta en el chat

Cuando la propuesta le llega al cliente (envío directo, envío de un borrador o edición de una ya enviada), el backend deja en el chat de la negociación un mensaje `tipo: "propuesta"`:

- `contenido`: resumen en texto, que es lo que se ve en la bandeja y en los avisos.
- `metadata`: `{tipo_evento: "propuesta_enviada", propuesta_id, cotizacion_id, version, empresa, producto, propuesta: <el JSON de arriba>}`.

Si el chat no existe, lo crea. Cada versión es una tarjeta; el frontend marca las anteriores como reemplazadas. Solo lo genera el backend: el tipo no se acepta por REST ni por WebSocket.

**Lo que ve el cliente:** total con IVA, valor por unidad, entrega, tiempo, pago, permisos, qué incluye y qué no, la nota, el desglose si la empresa lo deja ver, y las condiciones completas. Los botones son:
- **Elegir esta propuesta:** lleva al detalle de la cotización, donde se acepta (doble aceptación de siempre).
- **Hacer una pregunta:** escribe en el mismo chat.

### Al cerrar la orden

La solicitud de pago del chat y el aviso al comprador dicen el monto en pesos, por ejemplo «$21.364.784 (COP, IVA incluido)». El PDF de la propuesta agrega «Precio cerrado». Las propuestas del formato anterior siguen en USD.

---

## `GET /condiciones-propuesta` · `PUT /condiciones-propuesta`

Son las condiciones de la empresa en sesión. Las lee la cuenta dueña o un asesor; solo la dueña las cambia. `GET` agrega `configuradas` (false mientras la empresa no las haya guardado; entonces devuelve las de por defecto).

**Campos y valores por defecto:**
- **Bodega y entrega:**
  - `bodega_ciudad`, `bodega_direccion`;
  - `ciudades_entrega_incluida` (lista), donde la entrega va incluida;
  - `entrega_otras_ciudades`: `cliente` (por defecto), `fijo` o `incluida`.
- **Tiempos e IVA:**
  - `tiempo_maritimo` y `tiempo_aereo` como `{minimo, maximo}`, por defecto 40–50 y 15–20 días;
  - `vigencia_dias` (15);
  - `iva_pct` (19).
- **Pago y recepción:**
  - `forma_pago`: `50-50`, `30-70` o `100`;
  - `seguro_incluido`;
  - `tolerancia_pct` (3);
  - `dias_reclamo` (mínimo 3).
- **Cancelación y supuestos:** `cancelacion` (`antes_orden`, `en_fabricacion`, `despachada`) y `supuestos`.

Se guardan en `configuracion_plataforma` con la clave `empresa.<importador_id>.condiciones_propuesta`.

El formulario llena desde aquí la bodega, la entrega por defecto, los días de cada vía, el IVA y la vigencia.

**Lo mismo para todas las importadoras** (no se configura y se muestra en Mi empresa):
- precio cerrado en pesos con variación máxima de 10 % por supuestos declarados y con aprobación del cliente;
- punto de entrega exacto;
- propuesta en máximo 3 días hábiles;
- documentos al cliente;
- pagos solo a la cuenta registrada;
- métricas con la misma fórmula para todas.

---

## Ciudad de entrega de la cotización

La ciudad de entrega es la base de la sección «Entrega» del formulario de la empresa.

- **Al crear:** `POST /cotizaciones` acepta `ciudad_entrega`, y el formulario del comprador la pide en el paso del producto.
- **Al leer:** `CotizacionResponse.ciudad_entrega` la devuelve.
- **Cómo se guarda (sin columna propia):** en `campos_personalizados_valores` bajo la clave reservada `_ciudad_entrega`. Las claves que empiezan por `_` no se devuelven entre los campos del formulario de la empresa.
- **Cotizaciones anteriores:** no la tienen, y en esos casos la empresa la escribe en la propuesta.

---

## Pruebas

`tests/test_formulario_propuesta.py`: cálculo del ejemplo, validaciones, condiciones por empresa y permisos, envío con tarjeta en el chat y versión 2 al editar, borrador del asesor sin tarjeta hasta que la dueña lo envía, cobro en pesos al cerrar la orden, ciudad de entrega y que la calculadora ya no existe.
