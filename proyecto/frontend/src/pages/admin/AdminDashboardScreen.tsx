import { useEffect, useRef } from "react";
import type { SidebarCtrl } from "@/types/portal";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader, USER } from "@/components/layout/AppHeader";
import { AdminDashboard } from "@/pages/admin/AdminDashboard";

export const ADMIN_SECTION_BY_SCREEN = {
  "admin-dashboard": "metricas", "admin-empresas": "empresas", "admin-usuarios": "usuarios",
  "admin-cotizantes": "cotizantes", "admin-soporte": "soporte", "admin-certificaciones": "certificaciones",
  "admin-respaldos": "respaldos", "admin-asignacion": "asignacion", "admin-landing": "landing",
  "admin-correos": "correos", "admin-tendencias": "tendencias", "admin-tendencias-aprobacion": "tendencias-aprobacion",
} as const;
export type AdminScreen = keyof typeof ADMIN_SECTION_BY_SCREEN;

export function AdminDashboardScreen({ sb, onRefreshGlobal, screen }: { sb: SidebarCtrl; onRefreshGlobal?: () => Promise<void>; screen: AdminScreen }) {
  const mainRef = useRef<HTMLElement | null>(null);
  const section = ADMIN_SECTION_BY_SCREEN[screen];
  useEffect(() => { mainRef.current?.scrollTo({ top: 0, behavior: "auto" }); }, [section]);
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active={screen} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        <AppHeader user={USER} sb={sb} />
        <main ref={mainRef} className="flex-1 overflow-y-auto px-6 py-6"><div className="max-w-6xl mx-auto"><div className="admin-dashboard"><AdminDashboard onRefreshGlobal={onRefreshGlobal} section={section} /></div></div></main>
      </div>
    </div>
  );
}
