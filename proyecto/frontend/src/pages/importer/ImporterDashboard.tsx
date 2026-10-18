import { Building2, ChevronRight, FileText, Users } from "lucide-react";
import { Sidebar, AppHeader, USER_IMPORTADORA } from "@/app/App";
import { Breadcrumb } from "@/app/components/navigation/Breadcrumb";
import { Badge, Button, Card } from "@/app/components/design-system";
import { PanelEmpresa } from "@/features/importador/PanelEmpresa";
import type { Quote } from "@/types/quote";
import type { SidebarCtrl } from "@/types/portal";
import type { CompanyAdvisor, ChatConv } from "@/app/App";
import type { BadgeVariant } from "@/types/design-system";

export function ImporterDashboardScreen({sb,quotes,advisors,chats,companyName}:{sb:SidebarCtrl;quotes:Quote[];advisors:CompanyAdvisor[];chats:ChatConv[];companyName:string}) {
  const activeChatsCount = chats.filter(c=>c.status==="activa").length;
  const activeAdvisors = advisors.filter(a=>a.status==="activo").length;
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="imp-dashboard"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER_IMPORTADORA} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div>
            <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav("imp-dashboard")},{label:"Dashboard"}]}/>
            <h1 className="text-xl font-semibold mt-3">Panel de la empresa</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{companyName ? `${companyName} - Resumen de actividad` : "Resumen de actividad"}</p>
          </div>
          <PanelEmpresa
            asesoresConectados={activeAdvisors}
            chatsActivos={activeChatsCount}
            onAbrirSolicitudes={()=>sb.onNav("imp-quotes")}
            onAbrirPedidos={()=>sb.onNav("orders")}
          />
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card padding="none">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <h2 className="font-semibold text-sm">Solicitudes recientes</h2>
                  <Button variant="ghost" size="sm" iconRight={<ChevronRight className="w-3.5 h-3.5"/>} onClick={()=>sb.onNav("imp-quotes")}>Ver todas</Button>
                </div>
                <div className="divide-y divide-border">
                  {quotes.slice(0,5).map(q=>(
                    <div key={q.id} className="flex items-center gap-4 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{q.product}</p>
                        <p className="text-xs text-muted-foreground">{q.code} · {q.date}</p>
                      </div>
                      <Badge variant={q.status as BadgeVariant}/>
                    </div>
                  ))}
                  {quotes.length===0&&<div className="px-5 py-8 text-sm text-muted-foreground text-center">Sin solicitudes todavía.</div>}
                </div>
              </Card>
            </div>
            <div className="space-y-4">
              <Card padding="md">
                <p className="text-sm font-semibold mb-3">Accesos rápidos</p>
                <div className="space-y-2">
                  <Button variant="secondary" size="sm" fullWidth icon={<Users className="w-3.5 h-3.5"/>} onClick={()=>sb.onNav("imp-advisors")}>Gestionar asesores</Button>
                  <Button variant="secondary" size="sm" fullWidth icon={<FileText className="w-3.5 h-3.5"/>} onClick={()=>sb.onNav("imp-quotes")}>Ver solicitudes</Button>
                  <Button variant="secondary" size="sm" fullWidth icon={<Building2 className="w-3.5 h-3.5"/>} onClick={()=>sb.onNav("imp-profile")}>Editar perfil</Button>
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTER PORTAL — COMPANY PROFILE
// ─────────────────────────────────────────────────────────────────────────────

/** Formatos que gestión documental acepta como imagen (ver IMAGE_EXTENSIONS del backend). */
const BANNER_EXTENSIONS=["png","jpg","jpeg","webp"];
const BANNER_FORMATS_LABEL="PNG, JPG o WebP";
const BANNER_UPLOAD_ACCEPT=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";
const BANNER_MAX_BYTES=5*1024*1024;

/** Estado del autoguardado del perfil de empresa, en la cabecera. */