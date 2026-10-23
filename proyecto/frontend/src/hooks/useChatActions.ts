import { useCallback } from "react";
import { businessService } from "@/services/business.service";
import { mapBackendChatMessage } from "@/features/chat/mappers";
import type { DomainActionOptions } from "./useDomainActionTypes";

type ChatOptions = Pick<DomainActionOptions, "currentUserProfile" | "setActiveChatId" | "markConversationRead" | "setChatMessagesByConversation" | "reloadChatData" | "reloadDocumentExplorer" | "documentCurrentFolderRef" | "openChat">;

export function useChatActions(options: ChatOptions) {
  const { currentUserProfile, setActiveChatId, markConversationRead, setChatMessagesByConversation, reloadChatData, reloadDocumentExplorer, documentCurrentFolderRef, openChat } = options;
  const handleActiveConversationChange = useCallback((id: string | null) => {
    setActiveChatId(id);
    if (id) {
      markConversationRead(id);
      void businessService.markConversationRead(id).catch(() => undefined);
    }
  }, [markConversationRead, setActiveChatId]);
  const openInternalChat = useCallback(async (advisorId?: string) => {
    const conversation = await businessService.startInternalChat(advisorId);
    await reloadChatData();
    openChat(conversation.id);
  }, [openChat, reloadChatData]);
  const handleSendChatMessage = useCallback(async (id: string, content: string, metadata?: Record<string, unknown>) => {
    await businessService.sendChatMessage(id, { contenido: content, tipo: "texto", metadata: metadata ?? null });
    const messages = await businessService.listChatMessages(id);
    setChatMessagesByConversation((previous) => ({ ...previous, [id]: messages.map((message) => mapBackendChatMessage(message, currentUserProfile?.id)) }));
    await reloadChatData();
  }, [currentUserProfile?.id, reloadChatData, setChatMessagesByConversation]);
  const handleShareLocalAttachment = useCallback(async (id: string, file: File) => {
    const created = await businessService.uploadDocumentFile(file, null, "chat");
    await businessService.shareDocumentsToChat({ conversacion_ids: [id], archivo_ids: [created.id], mensaje: `Adjunto: ${file.name}` });
    await Promise.all([reloadChatData(), reloadDocumentExplorer(documentCurrentFolderRef.current)]);
  }, [documentCurrentFolderRef, reloadChatData, reloadDocumentExplorer]);
  const handleShareExistingResource = useCallback(async (ids: string[], fileId: string, message?: string) => {
    await businessService.shareDocumentsToChat({ conversacion_ids: ids, archivo_ids: [fileId], mensaje: message });
    await reloadChatData();
  }, [reloadChatData]);
  return { handleActiveConversationChange, openInternalChat, handleSendChatMessage, handleShareLocalAttachment, handleShareExistingResource };
}
