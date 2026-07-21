import { BadgeVariant } from "./design-system";

export type ResponseStatus = Extract<BadgeVariant, "resp-nueva" | "resp-vista" | "resp-aceptada" | "resp-rechazada">;

export interface QuoteResponse {
  id: string;
  importerId: string;
  quoteId: string;
  price: string;
  deliveryTime: string;
  incoterm: string;
  date: string;
  status: ResponseStatus;
  moq: string;
  origin: string;
  production: string;
  customization: string;
  observations: string;
}

// Tipo auxiliar usado en la navegación de pantallas
export type ResponseFrom = "quote-detail" | "responses-list";