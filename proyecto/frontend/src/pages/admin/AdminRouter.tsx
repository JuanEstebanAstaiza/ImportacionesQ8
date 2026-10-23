import type { Screen } from "@/app/rutas";
import type { SidebarCtrl } from "@/types/portal";
import { AdminDashboardScreen, type AdminScreen, ADMIN_SECTION_BY_SCREEN } from "./AdminDashboardScreen";
export function AdminRouter({ screen, sb, onRefreshGlobal }: { screen: Screen; sb: SidebarCtrl; onRefreshGlobal: () => Promise<void> }) {
  if (!(screen in ADMIN_SECTION_BY_SCREEN)) return null;
  return <AdminDashboardScreen sb={sb} onRefreshGlobal={onRefreshGlobal} screen={screen as AdminScreen} />;
}
export function isAdminScreen(screen: Screen) {
  return screen in ADMIN_SECTION_BY_SCREEN;
}
