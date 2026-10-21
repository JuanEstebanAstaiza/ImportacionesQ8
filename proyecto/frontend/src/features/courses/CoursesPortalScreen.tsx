import type { ComponentType } from "react";
import { CoursesScreen } from "@/features/courses/CoursesScreen";
import type { SidebarCtrl } from "@/types/portal";

type PortalHeaderProps = {
  user: { name: string; company: string; initials: string };
  sb: SidebarCtrl;
};

type CoursesPortalScreenProps = {
  sb: SidebarCtrl;
  role: "solicitante" | "importadora";
  headerUser: PortalHeaderProps["user"];
  companyName: string;
  onGoDashboard: () => void;
  onComprarAcceso?: (courseId: string) => void;
  active?: string;
  cursosDeZarpi?: boolean;
  SidebarComponent: ComponentType<SidebarCtrl>;
  HeaderComponent: ComponentType<PortalHeaderProps>;
};

export function CoursesPortalScreen({
  sb,
  role,
  headerUser,
  companyName,
  onGoDashboard,
  onComprarAcceso,
  active = "courses",
  cursosDeZarpi = false,
  SidebarComponent,
  HeaderComponent,
}: CoursesPortalScreenProps) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <SidebarComponent {...sb} active={active} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <HeaderComponent user={headerUser} sb={sb} />
        <CoursesScreen
          role={role}
          companyName={companyName}
          onGoDashboard={onGoDashboard}
          onComprarAcceso={onComprarAcceso}
          cursosDeZarpi={cursosDeZarpi}
        />
      </div>
    </div>
  );
}

