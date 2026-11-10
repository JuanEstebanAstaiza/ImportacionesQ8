import { useCallback } from "react";
import { businessService, type CreateAsesorPayload } from "@/services/business.service";
import { mapBackendAdvisorToUi } from "@/features/advisors/mappers";
import type { CompanyAdvisor } from "@/types/portal";
import type { DomainActionOptions } from "./useDomainActionTypes";

type AdvisorOptions = Pick<DomainActionOptions, "currentUserProfile" | "chatConversations" | "companyAdvisors" | "reloadCompanyAdvisors" | "reloadChatData" | "reloadImporterQuotes" | "reloadImporterOrders" | "reloadAdvisorAvailableQuotes" | "reloadAdvisorAssignedQuotes" | "reloadCurrentUserProfile" | "reloadImporters" | "openChat" | "goTo">;

export function useAdvisorActions(options: AdvisorOptions) {
  const { currentUserProfile, chatConversations, companyAdvisors, reloadCompanyAdvisors, reloadChatData, reloadImporterQuotes, reloadImporterOrders, reloadAdvisorAvailableQuotes, reloadAdvisorAssignedQuotes, reloadCurrentUserProfile, reloadImporters, openChat, goTo } = options;
  const claimQuote = useCallback(async (id: string) => {
    await businessService.claimAdvisorQuote(id);
    const [, , conversations] = await Promise.all([reloadAdvisorAvailableQuotes(), reloadAdvisorAssignedQuotes(), businessService.listChatConversations()]);
    await reloadChatData();
    const conversation = conversations.find((item) => item.cotizacion_id === id);
    conversation ? openChat(conversation.id) : goTo("chats");
  }, [goTo, openChat, reloadAdvisorAssignedQuotes, reloadAdvisorAvailableQuotes, reloadChatData]);
  const handleCreateAdvisor = useCallback(async (payload: CreateAsesorPayload): Promise<CompanyAdvisor> => {
    const created = await businessService.createCompanyAdvisor(payload);
    await reloadCompanyAdvisors(currentUserProfile?.importador_id ?? undefined);
    return mapBackendAdvisorToUi(created);
  }, [currentUserProfile, reloadCompanyAdvisors]);
  const handleSetAdvisorActive = useCallback(async (advisorId: string, active: boolean) => {
    const result = await businessService.updateCompanyAdvisorStatus(advisorId, active);
    await Promise.all([reloadCompanyAdvisors(currentUserProfile?.importador_id ?? undefined), reloadChatData(), reloadImporterQuotes(currentUserProfile?.importador_id ?? undefined)]);
    const moved = result.cotizaciones_reasignadas + result.conversaciones_reasignadas;
    return !active && moved > 0 ? `Asesor desactivado. Se traspasaron a tu cuenta ${result.cotizaciones_reasignadas} cotización(es) y ${result.conversaciones_reasignadas} conversación(es).` : active ? "Asesor activado." : "Asesor desactivado.";
  }, [currentUserProfile, reloadChatData, reloadCompanyAdvisors, reloadImporterQuotes]);
  const handleSaveCompanyProfile = useCallback(async (payload: { nombre_empresa: string; logo_url?: string; especialidad_producto: string[]; paises_origen: string[]; tiempo_respuesta_promedio: string; perfil_publico?: Record<string, unknown>; solo_cotizaciones_directas?: boolean; shipping_mark_prefijo?: string; limite_cotizaciones_diarias?: number | null; pedido_minimo?: number | null; pedido_minimo_unidad?: import("@/services/business.service").UnidadCantidad }) => {
    if (!currentUserProfile?.importador_id) throw new Error("Tu usuario no tiene importador asociado.");
    await businessService.updateImporterById(currentUserProfile.importador_id, payload);
    await reloadCurrentUserProfile();
    await reloadImporters();
  }, [currentUserProfile, reloadCurrentUserProfile, reloadImporters]);
  const handleTransferConversation = useCallback(async (conversationId: string, email: string) => {
    const conversation = chatConversations.find((item) => item.id === conversationId);
    if (!conversation?.quoteId) throw new Error("No se encontró la cotización asociada a esta conversación.");
    const advisor = companyAdvisors.find((item) => item.email.trim().toLowerCase() === email.trim().toLowerCase());
    if (!advisor) throw new Error(`${email} no es un asesor activo de tu empresa.`);
    await businessService.assignAdvisorToQuote(conversation.quoteId, advisor.id);
    await Promise.all([reloadChatData(), reloadCompanyAdvisors(currentUserProfile?.importador_id ?? undefined), reloadImporterQuotes(currentUserProfile?.importador_id ?? undefined)]);
  }, [chatConversations, companyAdvisors, currentUserProfile, reloadChatData, reloadCompanyAdvisors, reloadImporterQuotes]);
  const handleAssignAdvisorToQuote = useCallback(async (quoteId: string, advisorId: string | null) => {
    await businessService.assignAdvisorToQuote(quoteId, advisorId);
    await Promise.all([reloadImporterQuotes(currentUserProfile?.importador_id ?? undefined), reloadChatData()]);
  }, [currentUserProfile, reloadChatData, reloadImporterQuotes]);
  const handleConfirmProposalAsCompany = useCallback(async (proposalId: string) => {
    await businessService.preAcceptProposal(proposalId, true);
    await Promise.all([reloadImporterQuotes(currentUserProfile?.importador_id ?? undefined), reloadImporterOrders(), reloadChatData()]);
  }, [currentUserProfile, reloadChatData, reloadImporterOrders, reloadImporterQuotes]);
  return { claimQuote, handleCreateAdvisor, handleSetAdvisorActive, handleSaveCompanyProfile, handleTransferConversation, handleAssignAdvisorToQuote, handleConfirmProposalAsCompany };
}
