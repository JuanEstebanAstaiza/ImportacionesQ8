import type { BackendPropuesta } from "@/services/business.service";
import type { QuoteResponse, ResponseStatus } from "@/types/response";
import { leerPropuesta, pesos as pesosCop } from "@/features/propuestas/calculo";

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

function mapProposalEstadoToResponseStatus(estado: string): ResponseStatus {
  if (estado === "aceptada") return "resp-aceptada";
  if (estado === "rechazada") return "resp-rechazada";
  if (estado === "enviada") return "resp-vista";
  return "resp-nueva";
}

export function mapBackendProposalToUiResponse(p: BackendPropuesta): QuoteResponse {
  return {
    id: p.id,
    importerId: p.importador_id,
    quoteId: p.cotizacion_id,
    price: leerPropuesta(p.condiciones_adicionales) ? `${pesosCop(leerPropuesta(p.condiciones_adicionales)!.totales.total_cop)} COP con IVA` : `${p.precio_ofrecido_usd} USD`,
    deliveryTime: p.tiempo_estimado_entrega,
    incoterm: p.incoterm,
    date: formatShortDate(new Date().toISOString()),
    status: mapProposalEstadoToResponseStatus(p.estado),
    moq: "N/A",
    origin: "N/A",
    production: "N/A",
    customization: p.condiciones_adicionales || "Sin personalización",
    observations: p.condiciones_adicionales || "Sin observaciones",
  };
}
