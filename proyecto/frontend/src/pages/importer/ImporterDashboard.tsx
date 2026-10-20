import type { ReactNode } from "react";
import { ImporterDashboardScreen as ImporterDashboardTab } from "@/components/importer/tabs/ImporterDashboardScreen";
import type { ChatConv } from "@/types/chat";
import type { CompanyAdvisor, SidebarCtrl } from "@/types/portal";
import type { Quote } from "@/types/quote";
import type { Screen } from "@/app/rutas";

type ImporterDashboardProps = {
  sb: SidebarCtrl;
  quotes: Quote[];
  advisors: CompanyAdvisor[];
  chats: ChatConv[];
  companyName: string;
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
      return <ImporterDashboardTab {...props} />;
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
