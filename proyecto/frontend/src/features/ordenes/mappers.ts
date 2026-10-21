import type { BackendOrder } from "@/services/business.service";
import type { Quote } from "@/types/quote";
import { cantidadConUnidad } from "@/utils/formatos";
import { orderStateLabel } from "@/features/ordenes/constants";
import type { Order } from "@/features/ordenes/types";

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

export function mapBackendOrderToUiOrder(order: BackendOrder, quote?: Quote): Order {
  const code = `ORD-${order.id.slice(0, 8).toUpperCase()}`;
  // El backend no ordena el historial (la relación sale en orden de clave, que
  // es un UUID aleatorio), así que llegaba mezclado: se ordena por fecha para
  // que el seguimiento se lea de arriba abajo y `created` sea la creación real.
  const history = (order.historial_estados ?? [])
    .slice()
    .sort((a, b) => String(a.fecha_cambio).localeCompare(String(b.fecha_cambio)))
    .map((item) => ({
      estado: item.estado_nuevo,
      fecha: item.fecha_cambio,
      // De dónde venía, para poder leer el salto en el seguimiento.
      nota: item.estado_anterior ? `Desde ${orderStateLabel(item.estado_anterior)}` : null,
    }));
  const documents = (order.documentos_adjuntos ?? []).map((doc) => ({
    name: doc.nombre,
    // El backend no fecha los documentos de la orden; mostrar una fecha
    // inventada sería peor que no mostrar ninguna.
    date: "",
    status: doc.url ? "Disponible" : "Pendiente",
    url: doc.url,
    type: doc.tipo,
  }));

  return {
    id: order.id,
    code,
    quoteCode: quote?.code || `COT-${order.cotizacion_id.slice(0, 8).toUpperCase()}`,
    product: quote?.product || "Producto no disponible",
    importerId: order.importador_id,
    advisorName: order.asesor_nombre || undefined,
    created: formatShortDate(history[0]?.fecha || new Date().toISOString()),
    estimated: order.tiempo_estimado_entrega || "N/D",
    quantity: quote?.minQuantity ? cantidadConUnidad(quote.minQuantity, quote.unit, true) : "N/D",
    unitPrice: `${order.precio_acordado_usd} USD/u`,
    totalValue: `${order.precio_acordado_usd} USD`,
    incoterm: quote?.incoterm || "N/D",
    originPort: "N/D",
    destPort: "N/D",
    shippingMark: order.shipping_mark ?? null,
    status: order.estado,
    history,
    documents,
    conversationId: order.conversacion_id || undefined,
  };
}
