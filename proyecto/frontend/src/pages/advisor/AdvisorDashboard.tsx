import { AdvisorDashboardScreen } from "@/components/advisor/tabs/AdvisorDashboardScreen";
import type { Quote } from "@/types/quote";
import type { SidebarCtrl } from "@/types/portal";

export function ImpAdvisorDashboard({
  sb,
  availableCount,
  quotes,
  headerUser,
  responsesSentCount,
  activeChatsCount,
  onOpenInternalChat,
}: {
  sb: SidebarCtrl;
  availableCount: number;
  quotes: Quote[];
  headerUser: { name: string; company: string; initials: string };
  responsesSentCount: number;
  activeChatsCount: number;
  onOpenInternalChat: () => Promise<void>;
}) {
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
}

export const AdvisorDashboard = ImpAdvisorDashboard;