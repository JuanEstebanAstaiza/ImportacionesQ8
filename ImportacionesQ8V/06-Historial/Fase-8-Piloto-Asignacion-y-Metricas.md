# Fase 8 — Piloto: asignación en lugar de guerra de precios, y métricas (2026-10-03 →)

> **Última actualización:** 2026-10-03
> Rama `claude/zen-dirac-gp2njw`, sobre `main` tras el PR #25.

## Objetivo de la fase

Preparar el piloto con datos útiles para decidir y una dinámica de mercado sana. Orden de prioridad pedido por el negocio:

1. **Guardar los eventos.** Cada cambio de estado con fecha y hora, montos en pesos y cantidad, para que cualquier métrica salga después sin rehacer nada.
2. **Asignación manual con cupos y propuestas selladas.** Cada solicitud llega a pocas empresas elegidas por encaje, no a toda la red, y nadie ve las propuestas de los demás.
3. **Ajustes del panel de la empresa.** Nombres claros, montos en pesos y definiciones de conversión y respuesta.
4. **Métricas nuevas.**

---

## Cronología

| Fecha | Entrega | Detalle | Documentación |
|-------|---------|---------|---------------|
| 10-03 | **Bitácora de eventos** | Tabla `eventos`: solicitud creada, asignada, vista, cancelada; propuesta enviada, editada, en negociación, preaceptada, aceptada y descartada con motivo; cada hito del pedido con su etapa. Cada fila guarda el monto en USD y en COP con la TRM usada, y la cantidad en unidades o m³. La migración `0025` la rellena con el histórico | [[24-Eventos-y-Panel-Empresa]] |
| 10-03 | **TRM oficial automática** | Una consulta al día a datos.gov.co, con respaldo editable por el admin, última oficial y valor por defecto si falla | [[24-Eventos-y-Panel-Empresa]] |
| 10-03 | **Unidad de cantidad** | La cotización se pide en unidades o en m³ (con decimales). La propuesta puede indicar la cantidad que cubre | [[05-Cotizaciones-y-Propuestas]] |
| 10-03 | **Asignación de solicitudes abiertas** | Máximo 3 empresas por solicitud (configurable). En el piloto las asigna el admin con el botón «Asignar a», viendo categoría, país, pedido mínimo, capacidad, desempeño y cupo del día. Modo automático listo para después | [[23-Asignacion-de-Solicitudes]] |
| 10-03 | **Propuestas selladas** | Una empresa no ve las propuestas, el responsable ni el chat de las otras en una abierta | [[23-Asignacion-de-Solicitudes]] |
| 10-03 | **Comparador del comprador** | Orden de llegada, no por precio. Precio (USD y COP), tiempo, qué incluye y cumplimiento al mismo nivel. Al elegir, el cliente dice por qué: precio, tiempo, condiciones u otro | [[Pantallas-Solicitante]] |
| 10-03 | **Panel de la empresa** | En pesos con la moneda visible: "Cierras 1 de cada X propuestas", propuesta a pedido, tasa de respuesta, valor promedio cerrado, valor esperando al comprador, pedidos por etapa, motivos de pérdida y pendientes con color por espera. "Cotizaciones" pasa a "Solicitudes" | [[Pantallas-Importador]] |

---

## Cómo se verificó

- **Backend:** 706 tests verdes. Hay 50 tests nuevos de eventos, migración con histórico, asignación, propuestas selladas, comparador, TRM y panel.
- **Frontend:**
  - `tsc` sin errores nuevos (siguen los 88 previos);
  - `vite build` correcto.
- **Recorrido en navegador** contra backend y frontend reales:
  1. El cliente crea una abierta en m³.
  2. El admin la asigna a dos empresas desde el modal.
  3. Una tercera empresa recibe `403` al intentar responder.
  4. Las dos asignadas proponen sin verse entre sí.
  5. El cliente compara y acepta indicando "condiciones".
  6. La empresa confirma y el pedido avanza.
  7. La bitácora tiene los 16 eventos esperados con sus montos en COP.
  8. El panel de cada empresa refleja lo ocurrido (la que perdió ve "Condiciones: 100 %").

## Decisiones y por qué

- **La bitácora se escribe en la misma transacción que el cambio de estado.** Así no hay estados sin evento ni eventos sin estado.
- **Se guarda la TRM de cada momento.** Un negocio de septiembre no debe cambiar de valor en pesos porque hoy el dólar esté distinto.
- **La asignación vive en la base, no en Redis.** Es la regla que decide qué ve cada empresa: tiene que sobrevivir a reinicios y restauraciones, y comportarse igual en desarrollo y en producción.
- **El motivo de pérdida lo da el comprador al elegir.** Preguntarlo una vez por elección es más fiable que pedírselo por cada propuesta descartada.
- **Tasas de cohorte.** Se mide lo que entró en el periodo, aunque se cierre después. Por eso no superan el 100 % y no castigan los periodos cortos.

## Pendiente de esta fase

- **Automatizar la asignación** cuando el piloto dé datos para calibrar el puntaje de encaje.
- **Cantidad en el formulario de propuesta.** El API ya la acepta; hoy se usa la cantidad pedida.
- **Probar la salida a `www.datos.gov.co` desde el droplet** y fijar una TRM de respaldo en el panel.
- **Un mismo chat por cotización abierta.** El hilo de negociación sigue siendo uno por cotización. Con varias empresas asignadas, solo la primera que reclama abre chat; las demás negocian con su propuesta. Conviene evaluarlo con el piloto.

← [[Indice-Historial]] · [[Cronologia-del-Proyecto]]
