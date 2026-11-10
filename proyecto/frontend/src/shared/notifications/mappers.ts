import type { AppNotification } from "@shared/notifications/types";

/** A qué pantalla lleva un aviso de Zarpi Liquidaciones (tipos `liquidacion_*`). */
function destinoLiquidaciones(tipo: string, data: Record<string, unknown>): Pick<AppNotification, "destino" | "destinoId"> {
  const operacionId = typeof data.operacion_id === "string" ? data.operacion_id : undefined;
  const loteId = typeof data.lote_id === "string" ? data.lote_id : undefined;
  if (tipo === "liquidacion_por_revisar") return { destino: "liq-revision" };
  if (operacionId) return { destino: data.lado === "vendedor" ? "liq-operaciones" : "liq-reservas", destinoId: operacionId };
  if (tipo === "liquidacion_cuenta") return { destino: "liq-catalogo" };
  return { destino: loteId ? "liq-mis-lotes" : "liq-catalogo" };
}

function formatShortDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

function mapBackendNotificationTypeToUi(type: string): AppNotification["type"] {
  if (type === "chat") return "message";
  if (type === "orden") return "order";
  if (type === "cotizacion" || type === "propuesta" || type === "negociacion") return "response";
  if (type === "curso") return "document";
  if (type === "sistema") return "update";
  return "status";
}

export function mapBackendNotificationToUi(notification: { id: string; tipo: string; titulo: string; mensaje: string; fecha_creacion: string; leida: boolean; data?: Record<string, unknown> | null; }, companyName?: string): AppNotification {
  const data = notification.data || {};
  const cotizacionId = typeof data.cotizacion_id === "string" ? data.cotizacion_id : undefined;
  const conversationId = typeof data.conversacion_id === "string" ? data.conversacion_id : undefined;
  const approval = notification.tipo === "negociacion" || /cotizaci[oó]n aprobada/i.test(notification.titulo);
  const company = companyName || (typeof data.nombre_empresa === "string" ? data.nombre_empresa : "la empresa importadora");
  const title = approval ? "Cotización Aprobada" : notification.titulo;
  const body = approval && cotizacionId
     ? `Tu cotización con ID ${cotizacionId} para la empresa ${company} ha sido aprobada. Se ha abierto un chat directo donde encontrarás las instrucciones y siguientes pasos para continuar.`
    : notification.mensaje;
  if (notification.tipo.startsWith("liquidacion_")) {
    return {
      id: notification.id,
      type: "status",
      title: notification.titulo,
      body: notification.mensaje,
      date: formatShortDate(notification.fecha_creacion),
      read: notification.leida,
      ...destinoLiquidaciones(notification.tipo, data),
    };
  }
  return {
    id: notification.id,
    type: mapBackendNotificationTypeToUi(notification.tipo),
    title,
    body,
    date: formatShortDate(notification.fecha_creacion),
    read: notification.leida,
    cotizacionId,
    conversationId,
    approval,
    destino: notification.tipo === "tendencias" ? (notification.data?.evento === "para_disenar" ? "diseno" : "tendencias-enviar")
      : notification.tipo === "reto" ? "reto"
      : notification.tipo === "pagos" ? (notification.data?.evento === "comprobante_nuevo" ? "admin-pagos" : "pagos")
      : notification.tipo === "catalogo" ? "catalogos" : undefined,
  };
}
