import type { BackendCotizacion } from "@/services/business.service";
import type { Importer } from "@/types/importer";
import type { Quote } from "@/types/quote";

const PRICE_CURRENCIES = ["USD", "EUR", "COP", "MXN", "CLP", "PEN", "GBP"];

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

function backendEstadoToUi(estado: string): Quote["status"] {
  switch (estado) {
    case "creada":
      return "created";
    case "dirigida":
      return "directed";
    case "abierta":
      return "open";
    case "aceptada":
      return "accepted";
    case "orden_activa":
      return "active-order";
    case "rechazada":
      return "rejected-importer";
    default:
      return "created";
  }
}

function parseTargetPriceCurrency(value:string|undefined|null):string { const clean=(value||"").trim().toUpperCase(); if(!clean) return "USD"; return PRICE_CURRENCIES.includes(clean)?clean:"USD"; }

export function mapBackendQuoteToUi(cot: BackendCotizacion, importers: Importer[]): Quote {
  const importerName = cot.importador_id
    ? importers.find((imp) => imp.id === cot.importador_id)?.name ?? "Importadora"
    : "Red abierta";
  const currency = parseTargetPriceCurrency(cot.precio_objetivo_moneda ?? cot.moneda_precio_objetivo ?? "USD");
  const targetPriceValue = Number.isFinite(cot.precio_objetivo_usd as number) ? Number(cot.precio_objetivo_usd) : null;

  return {
    id: cot.id,
    code: `COT-${cot.id.slice(0, 8).toUpperCase()}`,
    date: formatShortDate(cot.fecha_creacion),
    product: cot.nombre_producto,
    importer: importerName,
    importadorId: cot.importador_id,
    mode: cot.modalidad === "dirigida" ? "Dirigida" : "Abierta",
    status: backendEstadoToUi(cot.estado),
    motivoRechazo: cot.motivo_rechazo ?? null,
    updatedAt: formatShortDate(cot.fecha_actualizacion),
    country: cot.pais_importacion,
    productLine: cot.linea_producto,
    quality: cot.tipo_calidad,
    minQuantity: String(cot.cantidad_minima),
    unit: cot.unidad_cantidad === "m3" ? "m3" : "unidades",
    targetPrice: targetPriceValue !== null ? `${targetPriceValue} ${currency}` : "N/A",
    targetPriceCurrency: currency,
    incoterm: cot.incoterm || "DDP",
    description: cot.descripcion_cliente,
    notes: cot.notas_adicionales ?? "",
    referenceLink: cot.link_referencia ?? "",
    productPhotoUrls: cot.fotos_producto?.length ? cot.fotos_producto : (cot.foto_producto ? [cot.foto_producto] : []),
    personalizationLevel: cot.nivel_personalizacion ?? "",
    importMode: cot.modalidad_importacion ?? "",
    shippingMark: cot.shipping_mark ?? null,
    shippingMarkSufijo: cot.shipping_mark_sufijo ?? null,
    deliveryCity: cot.ciudad_entrega ?? null,
    customFields: cot.campos_personalizados_valores ?? null,
    requesterId: cot.solicitante_id,
    tierMinimoRequerido: cot.tier_minimo_requerido ?? "Bronze",
    solicitanteTier: cot.solicitante_tier ?? "Bronze",
    solicitantePuntosCotizacion: cot.solicitante_puntos_cotizacion ?? 0,
    bloqueada: Boolean(cot.bloqueada),
  };
}
