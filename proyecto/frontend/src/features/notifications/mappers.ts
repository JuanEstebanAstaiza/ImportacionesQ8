import type { AppNotification } from "@/features/notifications/types";

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
  const approval = notification.tipo === "negociacion" || /cotizaci[o?]n aprobada/i.test(notification.titulo);
  const company = companyName || (typeof data.nombre_empresa === "string" ? data.nombre_empresa : "la empresa importadora");
  const title = approval ? "Cotizaci?n Aprobada" : notification.titulo;
  const body = approval && cotizacionId
     ? `Tu cotizaci?n con ID ${cotizacionId} para la empresa ${company} ha sido aprobada. Se ha abierto un chat directo donde encontrar?s las instrucciones y siguientes pasos para continuar.`
    : notification.mensaje;
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
