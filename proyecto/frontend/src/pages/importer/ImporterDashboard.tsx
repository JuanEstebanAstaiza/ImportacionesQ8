import type { ReactNode } from "react";
import { ImporterDashboardScreen as ImporterDashboardTab } from "@/features/importador/components/tabs/ImporterDashboardScreen";
import type { SidebarCtrl } from "@/types/portal";
import type { Screen } from "@/app/rutas";

type ImporterDashboardProps = {
  sb: SidebarCtrl;
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
      return <ImporterDashboardTab sb={props.sb} companyName={props.companyName} />;
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
