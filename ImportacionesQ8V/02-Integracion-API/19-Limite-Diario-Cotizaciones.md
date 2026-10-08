# APIs — Límite diario de cotizaciones por empresa

> Backend: `services/cupo_cotizaciones.py`, `services/matching_service.py`, `routers/cotizaciones.py`, `routers/importadores.py`.
> Migración: `20260930_0024`.

Una empresa importadora puede limitar cuántas cotizaciones recibe por día para no saturar a su equipo. Cuentan las **dirigidas** a ella y las **abiertas** que el matching le reparte. El contador se reinicia a medianoche de Colombia (`CUPO_COTIZACIONES_UTC_OFFSET_HORAS`, por defecto `-5`).

---

## Configurar el límite

`Importador.limite_cotizaciones_diarias` (entero, `null` = sin límite). Se lee en `GET /importadores` y `GET /importadores/{id}`.

Lo fija la cuenta dueña con `PUT /importadores/{id}`:

```json
{ "limite_cotizaciones_diarias": 20 }
{ "limite_cotizaciones_diarias": null }
```

Rango válido: 1–10000; fuera de él da `422`. Omitir el campo deja el límite como está. En el frontend: **Mi empresa → Información comercial → Límite de cotizaciones por día**.

---

## Qué pasa al agotar el cupo

| Caso | Resultado |
|------|-----------|
| `POST /cotizaciones` dirigida a una empresa con el cupo agotado | `409` con el motivo; no se crea nada ni se descuentan puntos. El cliente puede elegir otra empresa o publicarla abierta. |
| Cotización abierta | El reparto automático salta a la empresa: no entra en su pool ni recibe aviso. Las demás empresas la reciben normalmente. En modo manual, el admin no puede asignársela (`409`) y lo ve en el modal «Asignar a». Ver [[23-Asignacion-de-Solicitudes]]. |
| Abierta que se le saltó por cupo | No aparece en `GET /cotizaciones` de la empresa, y `POST /cotizaciones/{id}/reclamar`, `POST /propuestas` y `POST /propuestas/borrador` responden `403`, también después de que pase el día. |

Cada entrega queda en `recepciones_cotizacion` (`entregada = true`); las abiertas que se saltaron por cupo, con `entregada = false`, y esas no cuentan para el cupo.

---

## `GET /importadores/cupo-diario`

Cuenta dueña o asesor. Uso del día de su empresa:

```json
{
  "importador_id": "…",
  "limite_cotizaciones_diarias": 20,
  "recibidas_hoy": 7,
  "disponibles_hoy": 13,
  "cupo_agotado": false,
  "reinicia_en": "2026-10-01T05:00:00"
}
```

`disponibles_hoy` es `null` cuando la empresa no tiene límite. `reinicia_en` está en UTC.
