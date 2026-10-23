export type ChatType = "orden" | "cotizacion" | "interno" | "soporte" | "equipo";

export type MsgFileType = "pdf" | "excel" | "word" | "image";

export interface MsgFile {
  name: string;
  type: MsgFileType;
  size: string;
}

export interface ChatMsg {
  id: string;
  sender: "client" | "provider";
  text?: string;
  file?: MsgFile;
  time: string;
  read: boolean;
  dateGroup?: string;
  proposal?: PropuestaEnMensaje;
  authorName?: string;
}

export interface ChatConv {
  id: string;
  type: ChatType;
  refCode: string;
  refId: string;
  /**
   * Cotización de la que nace la conversación. `refId` apunta a la orden en
   * cuanto existe, así que se guarda aparte para poder reasignar el responsable
   * de la cotización desde el chat.
   */
  quoteId: string;
  importerId: string;
  status: "activa" | "archivada";
  unread: number;
  lastMsg: string;
  lastDate: string;
  cotizanteTier?: string;
  counterpartName?: string;
  counterpartId?: string;
  counterpartRole?: string;
  counterpartCompany?: string;
  counterpartPhotoUrl?: string;
  subject?: string;
  urgency?: string;
  requesterRole?: string;
  closed?: boolean;
  resolution?: string;
  closedBy?: string;
  level?: number;
  agentId?: string;
  agentName?: string;
  agentLevel?: number;
  rating?: number;
  ratingComment?: string;
  importerName?: string;
  advisorName?: string;
  advisorRole?: string;
  advisorEmail?: string;
  advisorPhone?: string;
  advisorInitials?: string;
  advisorColor?: string;
  atiendeNombre?: string;
}
import type { PropuestaEnMensaje } from "@/features/propuestas/TarjetaPropuestaChat";