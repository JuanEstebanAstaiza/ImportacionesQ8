
import { ShoppingCart, ExternalLink } from "lucide-react";

import { Breadcrumb } from "@/app/components/navigation/Breadcrumb";

import { Avatar, Badge, Button, Card } from "@/app/components/design-system";

// De este archivo ya solo se usan las buenas prácticas por rol: la FAQ vive
// ahora en la base de datos, mantenida por el equipo de soporte.

import { PendientesDeResena } from "@/features/resenas/PendientesDeResena";

import { RUTA_RESTABLECER } from "@/app/rutas";

const RESET_PASSWORD_PATH = RUTA_RESTABLECER;
/** Producto de Tendencias que un visitante quiso cotizar antes de registrarse. */
const CLAVE_PREFILL_PENDIENTE = "zarpi:prefill-pendiente";
/** Pantalla (y por tanto URL) de cada documento legal. */
const PANTALLA_LEGAL: Record<LegalPage, Screen> = {
  data: "policy-data",
  terms: "policy-terms",
  payments: "policy-payments",
  planes: "policy-planes",
};

import { Sidebar, AppHeader, USER } from "@/app/App";

export function OrdersScreen({onViewOrder,sb,orders,importers}:{onViewOrder:(id:string)=>void;sb:SidebarCtrl;orders:Order[];importers:Importer[]}) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="orders"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div><Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav(sb.navItems[0]?.key || "dashboard")},{label:"Operaciones"}]}/><h1 className="text-xl font-semibold tracking-tight mt-3">Operaciones</h1></div>
          <PendientesDeResena/>
          {orders.length===0 ? (
            <Card padding="lg" className="border-dashed"><div className="flex flex-col items-center text-center py-8 gap-2"><ShoppingCart className="w-10 h-10 text-muted-foreground/30"/><p className="font-medium">Sin operaciones</p><p className="text-sm text-muted-foreground">No tienes operaciones activas en backend.</p></div></Card>
          ) : (
          <div className="space-y-3">{orders.map(ord=>{const imp=importers.find(i=>i.id===ord.importerId);return(
            <Card key={ord.id} padding="md" className="hover:shadow-md transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <Avatar initials={imp?.initials || "NA"} size="xl" color={imp?.color || "bg-slate-500"}/>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap"><span className="font-mono font-semibold">{ord.code}</span><Badge variant="active-order"/></div>
                    <p className="text-sm font-medium mt-0.5">{ord.product}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{imp?.name || "Empresa importadora"} · {ord.quantity}</p>
                    <div className="flex gap-4 mt-2 flex-wrap">{[["Valor",ord.totalValue],["Creada",ord.created],["Estimada",ord.estimated]].map(([k,v])=><div key={k}><span className="text-xs text-muted-foreground">{k}: </span><span className="text-xs font-semibold">{v}</span></div>)}</div>
                  </div>
                </div>
                <Button variant="secondary" size="sm" icon={<ExternalLink className="w-3 h-3"/>} onClick={()=>onViewOrder(ord.id)}>Ver detalle</Button>
              </div>
            </Card>
          );})}</div>
          )}
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER DETAIL
// ─────────────────────────────────────────────────────────────────────────────