import type { ReactNode } from "react";
import type { Screen } from "@/app/rutas";
import type { SidebarCtrl } from "@/types/portal";
import { ImporterDashboard } from "./ImporterDashboard";
import { ImporterCompanyProfileScreen } from "@/features/importador/components/tabs/ImporterCompanyProfileScreen";
import { ImporterAdvisorsScreen } from "@/features/importador/components/tabs/ImporterAdvisorsScreen";
import { ImporterQuotesScreen } from "@/features/importador/components/tabs/ImporterQuotesScreen";
import { PantallaPortal } from "@/components/layout/PantallaPortal";
import { CatalogosEmpresa } from "@/features/catalogos/CatalogosEmpresa";
import { useImporterPortal } from "@/app/contexts/ImporterPortalContext";

export type ImporterRouterProps = { screen: Screen; sb: SidebarCtrl; quotes: any[]; advisors: any[]; chats: any[]; companyProfile: any; companyName: string; userRole: any; onSave: any; onCreateAdvisor: any; onSetAdvisorActive: any; openInternalChat: any; onRespond: any; openChat: any; onAssignAdvisor: any; proposalsByQuoteId: any; onConfirmProposal: any; onRechazada: any };

export function ImporterRouter({ screen, sb }: Pick<ImporterRouterProps, "screen" | "sb">) {
  const p = { ...useImporterPortal(), screen, sb };
  const views: Record<string, ReactNode> = {
    "imp-profile": <ImporterCompanyProfileScreen sb={p.sb} company={p.companyProfile} onSave={p.onSave} />,
    "imp-advisors": <ImporterAdvisorsScreen sb={p.sb} initialAdvisors={p.advisors} onCreateAdvisor={p.onCreateAdvisor} onSetAdvisorActive={p.onSetAdvisorActive} onOpenInternalChat={p.openInternalChat} />,
    "imp-quotes": <ImporterQuotesScreen sb={p.sb} quotes={p.quotes} onRespond={p.onRespond} advisors={p.advisors} chats={p.chats} onOpenChat={p.openChat} onAssignAdvisor={p.onAssignAdvisor} proposalsByQuoteId={p.proposalsByQuoteId} onConfirmProposal={p.onConfirmProposal} onRechazada={p.onRechazada} />,
    "imp-catalogos": <PantallaPortal sb={p.sb} active="imp-catalogos" titulo="Catálogos"><CatalogosEmpresa esDueno={p.userRole === "importadora"} /></PantallaPortal>,
  };
  return <ImporterDashboard screen={p.screen} sb={p.sb} quotes={p.quotes} advisors={p.advisors} chats={p.chats} companyName={p.companyName} views={views} />;
}
