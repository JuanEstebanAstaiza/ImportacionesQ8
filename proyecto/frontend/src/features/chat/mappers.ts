import { formatChatTime } from "@/utils/date";
import { leerPropuestaDeMensaje } from "@/features/propuestas/TarjetaPropuestaChat";
import type { ChatMsg } from "@/app/App";

export function mapBackendChatMessage(
  message: { id: string; remitente_id: string; contenido: string; tipo: string; fecha_envio: string; metadata: Record<string, unknown> | null; remitente_nombre?: string | null; de_mi_lado?: boolean | null },
  currentUserId: string | undefined,
): ChatMsg {
  const proposal = message.tipo === "propuesta" ? leerPropuestaDeMensaje(message.metadata) : undefined;
  return {
    id: message.id,
    sender: message.de_mi_lado && message.remitente_id === currentUserId ? "client" : "provider",
    authorName: message.remitente_id !== currentUserId ? (message.remitente_nombre || undefined) : undefined,
    text: message.contenido,
    time: formatChatTime(message.fecha_envio),
    read: true,
    proposal,
  };
}
