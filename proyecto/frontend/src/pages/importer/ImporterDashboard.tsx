import { ImporterDashboardScreen as ImporterDashboardTab } from "@/components/importer/tabs/ImporterDashboardScreen";
import type { ChatConv } from "@/app/App";
import type { CompanyAdvisor, SidebarCtrl } from "@/types/portal";
import type { Quote } from "@/types/quote";

type ImporterDashboardProps = {
  sb: SidebarCtrl;
  quotes: Quote[];
  advisors: CompanyAdvisor[];
  chats: ChatConv[];
  companyName: string;
};

/** Selector del tab principal del portal de empresas importadoras. */
export function ImporterDashboard(props: ImporterDashboardProps) {
  switch (props.sb.active) {
    case "imp-dashboard":
    default:
      return <ImporterDashboardTab {...props} />;
  }
}

export const ImporterDashboardScreen = ImporterDashboard;
