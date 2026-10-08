# APIs — Bitácora de eventos y panel de la empresa

> Backend: `models/evento.py`, `services/eventos.py`, `services/trm.py`, `services/panel_empresa.py`, `routers/importadores.py` (`/panel`), `routers/asignacion.py` (`/trm`).
> Frontend: dashboard de la empresa (`features/importador/PanelEmpresa.tsx`).
> Migración: `20261003_0025` (crea la tabla y la rellena con el histórico). Desde el 2026-10-03.

## La bitácora (`eventos`)

Cada cambio de estado del negocio deja una fila con fecha y hora. Las métricas salen de aquí: una métrica nueva se consulta sobre la bitácora, sin rehacer nada.

El evento se guarda **en la misma transacción** que el cambio de estado: o quedan los dos, o ninguno. Es de solo inserción y no tiene llaves foráneas, para sobrevivir a cancelaciones y bajas.

| Campo | Contenido |
|-------|-----------|
| `tipo` | Ver tabla de tipos |
| `fecha` | UTC con microsegundos (`DATETIME(6)` en MySQL) |
| `cotizacion_id`, `propuesta_id`, `orden_id`, `importador_id` | A qué se refiere |
| `usuario_id`, `rol_usuario` | Quién lo provocó (vacío si fue el sistema) |
| `estado_anterior`, `estado_nuevo` | Transición, cuando aplica |
| `motivo`, `motivo_detalle` | Motivo de descarte: `precio`, `tiempo`, `condiciones`, `otro` o `sin_motivo` |
| `monto`, `moneda` | Monto en su moneda de origen |
| `monto_usd`, `trm`, `monto_cop` | Convertido con la TRM **del momento** |
| `cantidad`, `unidad` | `unidades` o `m3` |
| `datos` | JSON con contexto: modalidad, origen de la asignación, etapa del pedido, fuente de la TRM… |

### Tipos de evento

| Tipo | Cuándo | Monto |
|------|--------|-------|
| `solicitud_creada` | `POST /cotizaciones` | Precio objetivo del cliente, si lo dio |
| `solicitud_asignada` | Dirigida al crearse; abierta en el reparto automático o al asignarla el admin | Ídem |
| `solicitud_desasignada` | El admin quita la asignación | Ídem |
| `solicitud_vista` | Primera vez que alguien de la empresa abre la solicitud: `POST /cotizaciones/{id}/vista`, `GET /cotizaciones/{id}` o al reclamarla | — |
| `solicitud_cancelada` | El admin aprueba una recreación por error | Ídem |
| `propuesta_enviada` | Envío directo o envío de un borrador | Precio total de la propuesta (USD) |
| `propuesta_editada` | Edición de una propuesta ya enviada | Nuevo precio |
| `propuesta_en_negociacion` | El cliente abre la negociación (una vez por propuesta) | Precio |
| `propuesta_preaceptada` | Cada marca o retiro de pre-aceptación (lado en `datos`) | Precio |
| `propuesta_aceptada` | Doble aceptación: se crea el pedido | Precio |
| `propuesta_descartada` | El cliente eligió otra propuesta (con motivo) | Precio de la descartada |
| `pedido_hito` | Creación del pedido y cada cambio de estado (`datos.etapa`) | Precio acordado |

Las **etapas del pedido** salen del estado de la orden:

| Estado de la orden | Etapa |
|--------------------|-------|
| `cotizacion_aceptada` | compra |
| `en_produccion` | embarque |
| `transito_internacional` | tránsito |
| `aduana_nacionalizacion` | nacionalización |
| `bodega_local` | entrega |
| `entregado` | entregado (ya no está en proceso) |

**Cantidad:**

- Las cotizaciones guardan `unidad_cantidad` (`unidades` o `m3`). En m³ se admiten decimales; en unidades la cantidad debe ser entera (`422` si no).
- Las propuestas pueden indicar `cantidad`. Si no la indican, cuenta la pedida.

**Histórico:** la migración 0025 rellena la bitácora con lo que se puede reconstruir:

- creación de cada solicitud;
- a quién se entregó (recepciones, dirigidas y empresas que respondieron);
- propuestas enviadas, aceptadas y descartadas;
- historial de cada pedido.

Esas filas llevan `datos.origen = "historico"` y no tienen TRM ni motivo. El panel las convierte con la TRM vigente.

---

## TRM (`services/trm.py`)

| Paso | Detalle |
|------|---------|
| Fuente oficial | Conjunto "TRM" de la Superintendencia Financiera en datos.gov.co (`TRM_URL`), una consulta al día por proceso, con timeout corto (`TRM_TIMEOUT_SEGUNDOS`) |
| Si falla | 1) respaldo del admin (`trm.respaldo`); 2) última oficial conocida; 3) `TRM_RESPALDO_COP` (4000 por defecto). Tras un fallo espera 15 min antes de reintentar |
| Trazabilidad | Cada evento guarda la TRM usada y su fuente (`datos.trm_fuente`: `oficial`, `respaldo_admin`, `ultima_oficial`, `por_defecto`) |
| Desactivar | `TRM_CONSULTA_AUTOMATICA=false` (por defecto en tests) |

Endpoints:

- `GET /trm`: cualquier usuario con sesión. Devuelve `{valor, fuente, vigencia, fecha_consulta}`; el comparador lo usa para el equivalente en pesos.
- Admin: `GET /admin/configuracion-operacion` y `PUT /admin/configuracion-operacion/trm`. Ver [[23-Asignacion-de-Solicitudes]].

---

## `GET /importadores/panel?dias=90`

Para la cuenta dueña o un asesor; siempre de su propia empresa. `dias=0` es todo el histórico.

| Campo | Definición |
|-------|------------|
| `solicitudes_recibidas` | Solicitudes asignadas a la empresa en el periodo (menos las desasignadas) |
| `propuestas_enviadas`, `propuestas_aceptadas`, `propuestas_descartadas` | Propuestas enviadas en el periodo y cuántas de ellas terminaron aceptadas o descartadas |
| `conversion_pct` | **Propuesta a pedido** = aceptadas ÷ enviadas |
| `cierre_uno_de_cada` | Enviadas ÷ aceptadas: "Cierras 1 de cada X propuestas" |
| `tasa_respuesta_pct` | Solicitudes recibidas respondidas ÷ solicitudes recibidas |
| `tiempo_promedio_respuesta_horas` | De la asignación a la primera propuesta |
| `valor_cerrado_cop`, `valor_promedio_cerrado_cop` | Suma y promedio de las aceptadas, con la TRM de cada evento |
| `valor_esperando_cop`, `propuestas_esperando` | Propuestas pendientes de respuesta del comprador, con su último monto enviado o editado |
| `pedidos_por_etapa` | Pedidos actuales por etapa (compra … entrega) |
| `pedidos_entregados` | Pedidos entregados |
| `motivos_perdida` | Descartes por motivo: precio, tiempo, condiciones, otro, sin_motivo |
| `pendientes_responder` | Hasta 20, el más antiguo primero, con `horas_esperando` y `nivel`: `a_tiempo` (< 24 h), `atencion` (24–48 h), `urgente` (> 48 h) |
| `trm`, `trm_fuente`, `moneda` | Siempre `COP` |

Las tasas son de cohorte, es decir, sobre lo que entró en el periodo, aunque se cierre después. Por eso no superan el 100 %.

← [[Indice-Integracion-API]]
