import { useCallback } from "react";
import { businessService, type CreateCotizacionPayload } from "@/services/business.service";
import type { DomainActionOptions } from "./useDomainActionTypes";

type QuoteOptions = Pick<DomainActionOptions, "currentUserProfile" | "reloadRequesterQuotes" | "reloadRequesterResponses" | "reloadRequesterOrders" | "reloadImporterQuotes" | "reloadAdvisorAssignedQuotes" | "reloadCurrentUserProfile" | "refreshUser">;

export function useQuoteActions(options: QuoteOptions) {
  const { currentUserProfile, reloadRequesterQuotes, reloadRequesterResponses, reloadRequesterOrders, reloadImporterQuotes, reloadAdvisorAssignedQuotes, reloadCurrentUserProfile, refreshUser } = options;
  const handleCreateQuote = useCallback(async (payload: CreateCotizacionPayload, unlock = false) => {
    if (unlock && Number(currentUserProfile?.puntos_cotizacion ?? 0) < 1) throw new Error("No tienes créditos suficientes para desbloquear esta cotización.");
    const created = await businessService.createQuote(payload);
    if (unlock) await businessService.unlockQuoteByPoint(created.id);
    await Promise.allSettled([
      reloadRequesterQuotes(), reloadRequesterResponses(), reloadRequesterOrders(),
      reloadImporterQuotes(currentUserProfile?.importador_id ?? undefined),
      reloadAdvisorAssignedQuotes(), reloadCurrentUserProfile(), refreshUser(),
    ]);
  }, [currentUserProfile, refreshUser, reloadAdvisorAssignedQuotes, reloadCurrentUserProfile, reloadImporterQuotes, reloadRequesterOrders, reloadRequesterQuotes, reloadRequesterResponses]);
  return { handleCreateQuote };
}
