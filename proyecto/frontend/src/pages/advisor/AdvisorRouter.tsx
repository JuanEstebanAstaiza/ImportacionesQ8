import type { ReactNode } from "react";
import type { Screen } from "@/app/rutas";
import type { SidebarCtrl } from "@/types/portal";
import { ImpAdvisorDashboard } from "./AdvisorDashboard";
import { AdvisorAvailableScreen } from "@/features/advisor/components/tabs/AdvisorAvailableScreen";
import { AdvisorMyQuotesScreen } from "@/features/advisor/components/tabs/AdvisorMyQuotesScreen";
import { useAdvisorPortal } from "@/app/contexts/AdvisorPortalContext";
export type AdvisorRouterProps = { screen: Screen; sb: SidebarCtrl; available: any[]; quotes: any[]; headerUser: any; proposals: any; chats: any[]; availableCount: number; activeChatsCount: number; onClaim: any; refresh: any; onRespond: any; openChat: any; onOpenInternalChat: any; onRechazada: any };
export function AdvisorRouter({ screen, sb }: Pick<AdvisorRouterProps, "screen" | "sb">) {
  const p = { ...useAdvisorPortal(), screen, sb };
  const views: Record<string, ReactNode> = {
    "adv-available": <AdvisorAvailableScreen sb={p.sb} available={p.available} onClaim={p.onClaim} onDiscard={p.refresh} headerUser={p.headerUser} />,
    "adv-my-quotes": <AdvisorMyQuotesScreen sb={p.sb} quotes={p.quotes} onRespond={p.onRespond} headerUser={p.headerUser} existingProposalByQuoteId={p.proposals} chats={p.chats} onOpenChat={p.openChat} onRechazada={p.onRechazada} />,
  };
  return <ImpAdvisorDashboard screen={p.screen} sb={p.sb} availableCount={p.availableCount} quotes={p.quotes} headerUser={p.headerUser} responsesSentCount={Object.keys(p.proposals).length} activeChatsCount={p.activeChatsCount} onOpenInternalChat={p.onOpenInternalChat} views={views} />;
}
