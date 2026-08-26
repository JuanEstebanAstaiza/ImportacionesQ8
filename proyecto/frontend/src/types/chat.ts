export type ChatType = "orden" | "cotizacion";

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
  quoteId?: string;
  importerId: string;
  status: "activa" | "archivada";
  unread: number;
  lastMsg: string;
  lastDate: string;
}