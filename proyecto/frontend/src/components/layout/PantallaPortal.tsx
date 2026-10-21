import type React from "react";

import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import type { SidebarCtrl } from "@/types/portal";

const DEFAULT_HEADER_USER = { name: "Ana García", company: "Importaciones del Norte S.A.", initials: "AG" };

export function PantallaPortal({sb,active,titulo,children}:{sb:SidebarCtrl;active:string;titulo:string;children:React.ReactNode}) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active={active}/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={DEFAULT_HEADER_USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav(sb.navItems[0]?.key||"dashboard")},{label:titulo}]}/>
          <div className="mt-3">{children}</div>
        </main>
      </div>
    </div>
  );
}
