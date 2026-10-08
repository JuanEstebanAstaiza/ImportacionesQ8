export type QuoteStatus = "created" | "directed" | "open" | "accepted" | "active-order" | "rejected-importer";
export type QuoteMode = "Dirigida" | "Abierta";
export type ResponseStatus = "resp-nueva" | "resp-vista" | "resp-aceptada" | "resp-rechazada";
export type ResponseFrom = "responses" | "quote-detail";

export interface Quote {
  id: string;
  code: string;
  date: string;
  product: string;
  importer: string;
  importadorId?: string | null;
  mode: QuoteMode;
  status: QuoteStatus;
  updatedAt: string;
  country: string;
  productLine: string;
  quality: string;
  minQuantity: string;
  /** Unidad de la cantidad: "unidades" o "m3". */
  unit?: "unidades" | "m3";
  targetPrice: string;
  targetPriceCurrency?: string;
  incoterm: string;
  description?: string;
  notes?: string;
  referenceLink?: string;
  productPhotoUrls?: string[];
  personalizationLevel?: string;
  importMode?: string;
  /** Marca de embarque ya compuesta ("ctl-prendascontrol"), si se conoce la empresa. */
  shippingMark?: string | null;
  /** Lo que escribió el cliente antes de normalizar ("prendas control"). */
  shippingMarkSufijo?: string | null;
  customFields?: Record<string, unknown> | null;
  requesterId?: string;
  tierMinimoRequerido?: string;
  solicitanteTier?: string;
  solicitantePuntosCotizacion?: number;
  bloqueada?: boolean;
}