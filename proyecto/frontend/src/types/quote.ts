export type QuoteStatus = "created" | "directed" | "open" | "accepted" | "active-order";
export type QuoteMode = "Dirigida" | "Abierta";
export type ResponseStatus = "resp-nueva" | "resp-vista" | "resp-aceptada" | "resp-rechazada";
export type ResponseFrom = "responses" | "quote-detail";

export interface Quote {
  id: string;
  code: string;
  date: string;
  product: string;
  importer: string;
  mode: QuoteMode;
  status: QuoteStatus;
  updatedAt: string;
  country: string;
  productLine: string;
  quality: string;
  minQuantity: string;
  targetPrice: string;
  incoterm: string;
}