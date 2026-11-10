import type React from "react";

import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { Sidebar } from "@shared/layout/Sidebar";
import { AppHeader } from "@shared/layout/AppHeader";
import type { SidebarCtrl } from "@/types/portal";

const DEFAULT_HEADER_USER = { name: "Ana García", company: "Importaciones del Norte S.A.", initials: "AG" };

/** `padre`: nivel intermedio de las migas, para pantallas de detalle (p. ej. la ficha de un lote cuelga del catálogo). */
export function PantallaPortal({sb,active,titulo,padre,children}:{sb:SidebarCtrl;active:string;titulo:string;padre?:{label:string;onClick:()=>void};children:React.ReactNode}) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active={active}/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={DEFAULT_HEADER_USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav(sb.navItems[0]?.key||"dashboard")},...(padre?[padre]:[]),{label:titulo}]}/>
          <div className="mt-3">{children}</div>
        </main>
      </div>
    </div>
  );
}
