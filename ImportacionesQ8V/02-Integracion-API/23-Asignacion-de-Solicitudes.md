# APIs — Asignación de solicitudes abiertas

> Backend: `services/asignacion.py`, `services/configuracion.py`, `services/matching_service.py`, `routers/asignacion.py`, `routers/cotizaciones.py`.
> Frontend: **Admin › Asignación** (`features/admin/AsignacionSolicitudes.tsx`) y el comparador del detalle de cotización del solicitante.
> Migración: `20261003_0025`. Desde el 2026-10-03.

## Por qué

Antes, cada solicitud abierta llegaba a todas las empresas de su país y categoría, y competían sobre todo por precio. Ahora:

- **Cada solicitud llega a un máximo de empresas** (`cupo_por_solicitud`, 3 por defecto, configurable).
- **Zarpi elige por encaje:** categoría, país, pedido mínimo, capacidad y desempeño.
- **Piloto:** el admin asigna a mano (`modo = "manual"`). El modo `automatica` usa el mismo puntaje sin intervención; queda listo para cuando se quiera automatizar.
- **Propuestas selladas:** ninguna empresa ve las propuestas de las otras, ni quién compite.
- **El comprador compara sin orden por precio:** precio, tiempo, qué incluye y cumplimiento al mismo nivel, en orden de llegada.

---

## Fuente de verdad

`recepciones_cotizacion` con `entregada = true`. Una empresa solo ve, reclama y responde las abiertas que tiene ahí (también en desarrollo; ya no depende de Redis).

| Columna nueva | Valores |
|---------------|---------|
| `origen` | `dirigida` (la eligió el cliente), `automatica` (reparto por encaje), `manual` (la asignó el admin) |
| `asignado_por` | Usuario admin que la asignó |

Redis sigue llevando el reparto (`cotizacion_abierta:{id}`), pero solo para el contador "X de Y respondieron" del solicitante.

Si una empresa intenta responder una abierta que no tiene asignada: `403 "Esta solicitud abierta no está asignada a tu empresa."`.

---

## Configuración (`configuracion_plataforma`)

| Clave | Por defecto | Variable de entorno inicial |
|-------|-------------|-----------------------------|
| `asignacion.modo` | `manual` | `ASIGNACION_COTIZACIONES` |
| `asignacion.cupo_por_solicitud` | `3` | `ASIGNACION_CUPO_POR_SOLICITUD` |

El admin las cambia desde el panel; la variable de entorno solo es el valor inicial. Bajar el cupo no quita asignaciones ya hechas: solo impide añadir más.

---

## Criterios de encaje

`services/asignacion.py::evaluar_candidatos` evalúa cada empresa activa del circuito abierto:

| Criterio | Cómo se mide |
|----------|--------------|
| Categoría | La empresa trabaja la línea de producto (obligatorio: si no, no podría responder) |
| País | Trabaja ese país de origen |
| Pedido mínimo | `Importador.pedido_minimo` (+ unidad) ≤ cantidad pedida. Si las unidades no coinciden, queda "no comparable" |
| Capacidad | Cantidad pedida ≤ `capacidad_volumen` |
| Desempeño | Calificación, tasa de respuesta, tasa de cierre, pedidos entregados y activos |
| Cupo del día | `limite_cotizaciones_diarias` frente a lo recibido hoy (ver [[19-Limite-Diario-Cotizaciones]]) |

El puntaje ordena las candidatas en el panel y decide el reparto automático. No se puede asignar una empresa que no trabaje la categoría, que sea de "solo cotizaciones directas" o que haya agotado su cupo diario.

La empresa fija su pedido mínimo en **Mi empresa** (`PUT /importadores/{id}` con `pedido_minimo` y `pedido_minimo_unidad`).

---

## Endpoints (admin)

| Método | Ruta | Para qué |
|--------|------|----------|
| `GET` | `/admin/configuracion-operacion` | Modo y cupo de asignación, y el estado de la TRM |
| `PUT` | `/admin/configuracion-operacion/asignacion` | `{"modo": "manual" \| "automatica", "cupo_por_solicitud": 1-20}` |
| `PUT` | `/admin/configuracion-operacion/trm` | `{"respaldo": 4100}` o `null`. Ver [[24-Eventos-y-Panel-Empresa]] |
| `POST` | `/admin/configuracion-operacion/trm/consultar` | Vuelve a consultar la TRM oficial |
| `GET` | `/admin/solicitudes-abiertas?filtro=por_asignar\|vigentes\|todas` | Solicitudes con sus empresas asignadas, cupo y propuestas |
| `GET` | `/admin/solicitudes-abiertas/{id}/candidatos?solo_que_encajan=true` | Candidatas con encaje, desempeño y cupo del día |
| `POST` | `/admin/solicitudes-abiertas/{id}/asignar` | `{"importador_ids": ["…"]}` |
| `DELETE` | `/admin/solicitudes-abiertas/{id}/asignaciones/{importador_id}` | Quita la asignación si la empresa no envió propuesta |

Errores de `asignar`:

| Código | Causa |
|--------|-------|
| `409` | Se pasaría del cupo por solicitud, la solicitud ya no admite propuestas o la empresa agotó su cupo diario |
| `400` | La empresa no trabaja la categoría o solo recibe dirigidas |
| `404` | Empresa inexistente o inactiva |

Asignar avisa a la empresa (in-app, correo, WhatsApp) y registra el evento `solicitud_asignada`. En modo manual, cada abierta nueva avisa a los admins ("Solicitud abierta por asignar").

---

## Propuestas selladas

Para una empresa, en una abierta (`_vista_para_empresa` en `routers/cotizaciones.py`):

- `GET /cotizaciones/{id}/propuestas` devuelve solo las suyas.
- En `GET /cotizaciones`, `GET /cotizaciones/{id}`, el pool y el reclamo se ocultan los datos de otra empresa:
  - `asesor_asignado_id`, `contacto_asignado` y `conversacion_id` de la competencia;
  - `estado = propuestas_recibidas` si ella misma no ha propuesto (se muestra `abierta`);
  - el motivo de elección del cliente.

---

## Comparador y motivo de elección (solicitante)

`GET /cotizaciones/{id}/propuestas` para el solicitante:

- **Orden:** de llegada (`fecha_envio` ascendente), nunca por precio.
- **Campo `empresa`** con el cumplimiento:
  ```json
  { "nombre_empresa": "…", "verificado": true, "calificacion_promedio": 4.5,
    "total_resenas": 3, "pedidos_entregados": 7, "pedidos_en_curso": 2 }
  ```

El comparador muestra al mismo nivel:

- precio en USD con su equivalente en pesos (`GET /trm`);
- tiempo;
- qué incluye (lectura del incoterm y ventajas declaradas);
- cumplimiento.

Al aceptar habiendo otras propuestas pendientes, el cliente indica qué decidió su elección:

```http
POST /propuestas/{id}/pre-aceptar
{ "aceptar": true, "motivo_eleccion": "precio" | "tiempo" | "condiciones" | "otro", "motivo_detalle": "texto opcional" }
```

Al cerrarse la orden (doble aceptación), ese motivo pasa a las propuestas perdedoras:

- se guarda en `propuestas.motivo_descarte`, `motivo_descarte_detalle` y `fecha_descarte`;
- genera un evento `propuesta_descartada` por cada una (`sin_motivo` si no lo indicó).

Si el cliente retira su aceptación, el motivo se borra. Solo el solicitante puede indicarlo; la empresa recibe `400` si lo envía.

← [[Indice-Integracion-API]]
