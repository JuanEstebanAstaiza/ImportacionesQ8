import type { Screen } from "@/app/rutas";

export interface AppNotification {
  id: string;
  type: "response" | "message" | "status" | "order" | "document" | "advisor" | "update";
  title: string;
  body: string;
  date: string;
  read: boolean;
  cotizacionId?: string;
  conversationId?: string;
  approval?: boolean;
  destino?: "tendencias-enviar" | "catalogos" | "reto" | "diseno" | "pagos" | "admin-pagos" | Extract<Screen, `liq-${string}`>;
  /** Identificador que la pantalla de destino lleva en la URL (lote u operación de Liquidaciones). */
  destinoId?: string;
}
