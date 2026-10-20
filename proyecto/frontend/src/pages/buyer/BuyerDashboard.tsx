import type { ReactNode } from "react";
import { BuyerDashboardScreen } from "@/components/buyer/tabs/BuyerDashboardScreen";
import type { SidebarCtrl } from "@/types/portal";
import type { Importer } from "@/types/importer";
import type { Screen } from "@/app/rutas";

type BuyerDashboardProps = {
  sb: SidebarCtrl;
  onViewProfile: (id: string) => void;
  onCreateQuote: (id: string) => void;
  importers: Importer[];
  screen?: Screen;
  views?: Partial<Record<BuyerRoute, ReactNode>>;
};

export type BuyerRoute =
  | "dashboard"
  | "quotes"
  | "new-quote"
  | "quote-detail"
  | "responses"
  | "response-detail"
  | "importer-profile"
  | "orders"
  | "order-detail"
  | "catalogos";

/** Sub-router del portal de solicitantes y sus vistas compartidas de negocio. */
export function DashboardScreen(props: BuyerDashboardProps) {
  const route = (props.screen ?? props.sb.active) as BuyerRoute;
  switch (route) {
    case "dashboard":
      return <BuyerDashboardScreen {...props} />;
    case "quotes":
    case "new-quote":
    case "quote-detail":
    case "responses":
    case "response-detail":
    case "importer-profile":
    case "orders":
    case "order-detail":
    case "catalogos":
      return props.views?.[route] ?? null;
    default:
      return null;
  }
}
