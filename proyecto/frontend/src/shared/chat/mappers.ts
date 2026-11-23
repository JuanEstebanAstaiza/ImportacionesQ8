import { formatChatTime } from "@/utils/date";
import { leerPropuestaDeMensaje } from "@apps/importaciones/features/propuestas/TarjetaPropuestaChat";
import type { ChatMsg } from "@/types/chat";

export function mapBackendChatMessage(
  message: { id: string; remitente_id: string; contenido: string; tipo: string; fecha_envio: string; metadata: Record<string, unknown> | null; remitente_nombre?: string | null; de_mi_lado?: boolean | null },
  currentUserId: string | undefined,
): ChatMsg {
  const proposal = message.tipo === "propuesta" ? leerPropuestaDeMensaje(message.metadata) : undefined;
  const liquidaciones = message.metadata?.liquidaciones;
  const archivo = liquidaciones && typeof liquidaciones === "object" && "archivo" in liquidaciones
    ? liquidaciones.archivo : null;
  const archivoLiquidaciones = archivo && typeof archivo === "object" && "url" in archivo && typeof archivo.url === "string"
    ? { url: archivo.url, nombre: "nombre" in archivo && typeof archivo.nombre === "string" ? archivo.nombre : "Documento" }
    : undefined;
  return {
    id: message.id,
    sender: message.de_mi_lado && message.remitente_id === currentUserId ? "client" : "provider",
    authorName: message.remitente_id !== currentUserId ? (message.remitente_nombre || undefined) : undefined,
    text: message.contenido,
    time: formatChatTime(message.fecha_envio),
    read: true,
    proposal,
    archivoLiquidaciones,
  };
}
