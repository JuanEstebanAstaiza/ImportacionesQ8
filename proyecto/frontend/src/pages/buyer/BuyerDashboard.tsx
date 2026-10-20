import { BuyerDashboardScreen } from "@/components/buyer/tabs/BuyerDashboardScreen";
import type { SidebarCtrl } from "@/types/portal";
import type { Importer } from "@/types/importer";

type BuyerDashboardProps = {
  sb: SidebarCtrl;
  onViewProfile: (id: string) => void;
  onCreateQuote: (id: string) => void;
  importers: Importer[];
};

/** Selector del tab principal del portal de solicitantes. */
export function DashboardScreen(props: BuyerDashboardProps) {
  switch (props.sb.active) {
    case "dashboard":
    default:
      return <BuyerDashboardScreen {...props} />;
  }
}
