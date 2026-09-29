# APIs — Tiers del cotizante, desbloqueo con puntos y perfil público

> Backend: `services/tier_service.py`, `services/cotizante_service.py`, `routers/cotizaciones.py`, `routers/admin.py`, `routers/usuarios.py`.
> Migración: `20260929_0023`.

Orden de tiers: `Bronze` < `Silver` < `Gold` < `Élite`.

---

## Tier mínimo de la empresa

`Importador.tier_minimo_requerido` (columna, por defecto `Bronze`). Se lee en `GET /importadores` y `GET /importadores/{id}`.

Se configura con `PUT /importadores/{id}` (cuenta dueña) de cualquiera de estas formas:

```json
{ "tier_minimo_requerido": "Gold" }
{ "perfil_publico": { "tier_minimo_requerido": "Gold" } }
```

Si llegan las dos, manda la de primer nivel. El valor se refleja también en `perfil_publico.tier_minimo_requerido`. Un tier inválido da `422`.
El alta por admin (`POST /admin/importadores`) también acepta `tier_minimo_requerido`.

---

## `POST /cotizaciones` — validación en servidor

Solo aplica a modalidad `dirigida`. El tier exigido sale de la empresa; **el campo `tier_minimo_requerido` del payload se ignora**.

| Situación | Resultado |
|-----------|-----------|
| `cotizante.tier` ≥ tier de la empresa | `201`, sin coste |
| Tier inferior y `puntos_cotizacion >= 1` | `201`, se descuenta 1 punto, `desbloqueada_por_puntos: true` |
| Tier inferior y 0 puntos | `403` `{"detail": "Nivel insuficiente y sin créditos"}` y no se crea nada |

El descuento va en la misma transacción que la cotización y queda en `movimientos_puntos_cotizacion` (`tipo: "consumo"`, `delta: -1`, `descripcion: "Desbloqueo de cotización ID <id>"`).

`POST /cotizaciones/{id}/desbloquear` sigue disponible para cotizaciones antiguas bloqueadas; si la cotización ya no está bloqueada devuelve `200` sin cobrar (llamarlo tras crear no cobra dos veces). Sin puntos responde `403`.

`bloqueada` se evalúa contra el tier que tenía el cotizante **al crear** la cotización (`tier_solicitante_creacion`): bajar de nivel después no vuelve a bloquear lo ya enviado.

---

## Recálculo automático de tiers

Métricas del cotizante: cotizaciones (sin las anuladas), órdenes y suma de `precio_acordado_usd` de sus órdenes. Su tier pasa a ser el **más alto cuyos tres umbrales** (`umbrales_tier_cotizante`) cumple a la vez; puede subir o bajar.

- `tier_manual = true` → se ignora (lo fijó el admin).
- Se dispara al crear una cotización, al crearse una orden y al pasar una orden a `entregado`.
- Tarea periódica cada `TIER_RECALCULO_MINUTOS` (por defecto 60; `0` la desactiva).
- Al guardar umbrales (`PUT /admin/cotizantes/tier-umbrales`) se recalcula a todos.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/admin/cotizantes/recalcular-tiers` | Recalcula ya → `{ "evaluados": n, "actualizados": m }` |
| `DELETE` | `/admin/cotizantes/{id}/tier` | Quita el tier manual y lo recalcula |

---

## `GET /cotizantes/{id}/perfil-publico`

También en `GET /usuarios/{id}/perfil-publico` (misma respuesta). Roles: `importador`, `asesor`, `admin`; el `solicitante` solo el suyo.

```json
{
  "solicitante_id": "uuid",
  "nombre": "Ana",
  "tier": "Silver",
  "volumen_total_importaciones": { "peso_total_kg": 200.0, "volumen_total_m3": 2.5, "contenedores_total": 1 },
  "cantidad_importaciones": { "total": 7, "dentro_plataforma": 3, "fuera_plataforma": 4, "finalizadas": 2 },
  "valor_promedio_importacion_usd": 2000.0,
  "actividad_plataforma": {
    "cotizaciones_solicitadas": 4,
    "ordenes_generadas": 3,
    "valor_promedio_operaciones_usd": 2000.0,
    "valor_promedio_cotizaciones_usd": 100.0,
    "valor_promedio_ordenes_usd": 2000.0
  }
}
```

- Peso/volumen/contenedores: solo órdenes `entregado`, leídos de las respuestas del formulario de la cotización (por la etiqueta del campo: "peso", "kg", "volumen", "cbm", "m3", "contenedor"…).
- `dentro_plataforma`: órdenes en cualquier estado. `fuera_plataforma`: lo declara el cotizante con `PUT /usuarios/me` → `{ "importaciones_fuera_plataforma": 4 }`.
- `valor_promedio_cotizaciones_usd`: precio objetivo medio de sus cotizaciones en USD. `valor_promedio_ordenes_usd`: precio acordado medio de sus órdenes.
