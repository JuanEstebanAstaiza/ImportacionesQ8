import type { ReactNode } from "react";
import { ImporterDashboardScreen as ImporterDashboardTab } from "@apps/importaciones/features/importador/components/tabs/ImporterDashboardScreen";
import type { SidebarCtrl } from "@/types/portal";
import type { Screen } from "@/app/rutas";
import type { ChatConv } from "@/types/chat";
import type { CompanyAdvisor } from "@/types/portal";
import type { Quote } from "@/types/quote";

type ImporterDashboardProps = {
  sb: SidebarCtrl;
  companyName: string;
  // Los carga App (con su refresco periódico) y llegan por el portal: el panel no los vuelve a pedir.
  quotes?: Quote[];
  advisors?: CompanyAdvisor[];
  chats?: ChatConv[];
  screen?: Screen;
  views?: Partial<Record<ImporterRoute, ReactNode>>;
};

export type ImporterRoute =
  | "imp-dashboard"
  | "imp-profile"
  | "imp-advisors"
  | "imp-quotes"
  | "imp-catalogos";

/** Sub-router del portal de empresas importadoras. */
export function ImporterDashboard(props: ImporterDashboardProps) {
  const route = (props.screen ?? props.sb.active) as ImporterRoute;
  switch (route) {
    case "imp-dashboard":
      return <ImporterDashboardTab sb={props.sb} companyName={props.companyName} quotes={props.quotes ?? []} advisors={props.advisors ?? []} chats={props.chats ?? []} />;
    case "imp-profile":
    case "imp-advisors":
    case "imp-quotes":
    case "imp-catalogos":
      return props.views?.[route] ?? null;
    default:
      return null;
  }
}

export const ImporterDashboardScreen = ImporterDashboard;
