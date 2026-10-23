import { useCallback, useState } from "react";
import type { BackendChatAttachmentItem, BackendMiembroEquipo } from "@/services/business.service";
import type { ChatConv, ChatMsg } from "@/types/chat";
import { businessService, type BackendCotizacion } from "@/services/business.service";
import { mapBackendChatMessage } from "@/features/chat/mappers";
import { formatShortDate } from "@/utils/format";
import type { Importer } from "@/types/importer";

/** Conversation state and the local mutations used by chat screens. */
export function useChatManager(importers: Importer[] = [], userId?: string) {
  const [chatConversations, setChatConversations] = useState<ChatConv[]>([]);
  const [chatMessagesByConversation, setChatMessagesByConversation] = useState<Record<string, ChatMsg[]>>({});
  const [chatAttachmentsByConversation, setChatAttachmentsByConversation] = useState<Record<string, BackendChatAttachmentItem[]>>({});
  const [miembrosEquipo, setMiembrosEquipo] = useState<BackendMiembroEquipo[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const reloadChatData = useCallback(async () => {
    const [rows, quotes] = await Promise.all([
      businessService.listChatConversations(),
      businessService.listQuotes().catch(() => [] as BackendCotizacion[]),
    ]);
    const importerByQuoteId = new Map(quotes.map((quote) => [quote.id, quote.importador_id]));
    const tiers = new Map(quotes.map((quote) => [quote.id, quote.solicitante_tier || "Bronze"]));
    const importerById = new Map(importers.map((importer) => [importer.id, importer]));
    const conversations: ChatConv[] = rows.map((row) => {
      const internal = row.tipo === "interna", support = row.tipo === "soporte", team = row.tipo === "equipo";
      const importerId = internal ? row.importador_id || "" : support || team ? "" : importerByQuoteId.get(row.cotizacion_id || "") || row.importador_usuario_id || "";
      const importer = importerById.get(importerId);
      return {
        id: row.id, type: team ? "equipo" : support ? "soporte" : internal ? "interno" : row.orden_id ? "orden" : "cotizacion",
        refCode: team ? "Plataforma" : support ? "Soporte" : internal ? "Equipo" : row.orden_id ? `ORD-${row.orden_id.slice(0, 8).toUpperCase()}` : `COT-${(row.cotizacion_id || "").slice(0, 8).toUpperCase()}`,
        refId: row.orden_id ?? row.cotizacion_id ?? "", quoteId: row.cotizacion_id ?? "",
        cotizanteTier: row.cotizacion_id ? tiers.get(row.cotizacion_id) : undefined,
        counterpartName: row.contraparte_nombre ?? undefined, counterpartId: row.contraparte_id ?? undefined,
        counterpartRole: row.contraparte_rol ?? undefined, counterpartCompany: row.contraparte_empresa ?? undefined,
        counterpartPhotoUrl: row.contraparte_foto_url ?? undefined, subject: row.asunto ?? undefined,
        urgency: row.urgencia ?? undefined, requesterRole: row.solicitante_rol ?? undefined, closed: row.cerrada ?? false,
        resolution: row.resolucion ?? undefined, closedBy: row.cerrada_por_nombre ?? undefined, level: row.nivel ?? undefined,
        agentId: row.agente_asignado_id ?? undefined, agentName: row.agente_nombre ?? undefined, agentLevel: row.agente_nivel ?? undefined,
        rating: row.calificacion ?? undefined, ratingComment: row.comentario_calificacion ?? undefined, importerId,
        importerName: importer?.name, advisorName: importer?.advisor.name, advisorRole: importer?.advisor.role,
        advisorEmail: importer?.advisor.email, advisorPhone: importer?.advisor.phone, advisorInitials: importer?.advisor.initials,
        advisorColor: importer?.advisor.color, atiendeNombre: row.asesor_nombre ?? undefined, status: "activa",
        unread: row.no_leidos ?? 0, lastMsg: row.ultimo_mensaje?.contenido || "Sin mensajes",
        lastDate: row.ultimo_mensaje?.fecha_envio ? formatShortDate(row.ultimo_mensaje.fecha_envio) : formatShortDate(row.fecha_creacion),
      };
    });
    setChatConversations(conversations);
    const messages = await Promise.all(conversations.map(async (conversation) => [
      conversation.id, (await businessService.listChatMessages(conversation.id)).map((message) => mapBackendChatMessage(message, userId)),
    ] as const));
    setChatMessagesByConversation(Object.fromEntries(messages));
    const attachments = await Promise.all(conversations.map(async (conversation) => {
      try { return [conversation.id, await businessService.listChatAttachments(conversation.id)] as const; }
      catch { return [conversation.id, [] as BackendChatAttachmentItem[]] as const; }
    }));
    setChatAttachmentsByConversation(Object.fromEntries(attachments));
  }, [importers, userId]);

  const markConversationRead = (conversationId: string) => {
    setChatConversations((previous) =>
      previous.some((conversation) => conversation.id === conversationId && conversation.unread > 0)
        ? previous.map((conversation) => conversation.id === conversationId ? { ...conversation, unread: 0 } : conversation)
        : previous,
    );
  };

  return {
    chatConversations,
    setChatConversations,
    chatMessagesByConversation,
    setChatMessagesByConversation,
    chatAttachmentsByConversation,
    setChatAttachmentsByConversation,
    miembrosEquipo,
    setMiembrosEquipo,
    activeChatId,
    setActiveChatId,
    markConversationRead,
    reloadChatData,
  };
}
