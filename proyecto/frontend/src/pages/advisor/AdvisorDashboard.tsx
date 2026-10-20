import type { ReactNode } from "react";
import { AdvisorDashboardScreen } from "@/components/advisor/tabs/AdvisorDashboardScreen";
import type { Quote } from "@/types/quote";
import type { SidebarCtrl } from "@/types/portal";
import type { Screen } from "@/app/rutas";

export type AdvisorRoute = "adv-dashboard" | "adv-available" | "adv-my-quotes";

export function ImpAdvisorDashboard({
  sb,
  availableCount,
  quotes,
  headerUser,
  responsesSentCount,
  activeChatsCount,
  onOpenInternalChat,
  screen,
  views,
}: {
  sb: SidebarCtrl;
  availableCount: number;
  quotes: Quote[];
  headerUser: { name: string; company: string; initials: string };
  responsesSentCount: number;
  activeChatsCount: number;
  onOpenInternalChat: () => Promise<void>;
  screen?: Screen;
  views?: Partial<Record<AdvisorRoute, ReactNode>>;
}) {
  const route = (screen ?? sb.active) as AdvisorRoute;
  switch (route) {
    case "adv-dashboard":
      return (
        <AdvisorDashboardScreen
          sb={sb}
          availableCount={availableCount}
          quotes={quotes}
          headerUser={headerUser}
          responsesSentCount={responsesSentCount}
          activeChatsCount={activeChatsCount}
          onOpenInternalChat={onOpenInternalChat}
        />
      );
    case "adv-available":
    case "adv-my-quotes":
      return views?.[route] ?? null;
    default:
      return null;
  }
}

export const AdvisorDashboard = ImpAdvisorDashboard;