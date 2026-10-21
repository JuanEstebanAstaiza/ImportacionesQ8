import { useState } from "react";
import { Search, ExternalLink, BadgeCheck, GitCompare, ClipboardList, Bell } from "lucide-react";

import { Quote } from "@/types/quote";
import type { ResponseFrom } from "@/types/quote";
import { Importer } from "@/types/importer";
import { SidebarCtrl } from "@/types/portal";

import { Breadcrumb } from "@/components/navigation/Breadcrumb";

import type { LegalPage } from "@/features/legal/types";

import { Avatar, Badge, Button, Card, ContactBtn, Input, openSmartContact, Select } from "@/components/design-system";
import { resolveApiUrl } from "@/services/api-client";

// De este archivo ya solo se usan las buenas prácticas por rol: la FAQ vive
// ahora en la base de datos, mantenida por el equipo de soporte.

import { RUTA_RESTABLECER, type Screen } from "@/app/rutas";

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
import type { QuoteResponse } from "@/types/response";

export function ResponsesScreen({onViewDetail,sb,responses,importers,quotes,onViewQuote}:{onViewDetail:(id:string,from:ResponseFrom)=>void;sb:SidebarCtrl;responses:QuoteResponse[];importers:Importer[];quotes:Quote[];onViewQuote:(quoteId:string)=>void}) {
  const [search,setSearch]=useState("");const[statusF,setStatusF]=useState("");const[empresaF,setEmpresaF]=useState("");
  const filtered=responses.filter(r=>{const imp=importers.find(i=>i.id===r.importerId);const q=quotes.find(q=>q.id===r.quoteId);
    const ms=!search||[imp?.name||"",q?.product||"",r.price].some(v=>v.toLowerCase().includes(search.toLowerCase()));
    return ms&&(!statusF||r.status===statusF)&&(!empresaF||r.importerId===empresaF);
  });
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="responses"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div>
            <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav("dashboard")},{label:"Respuestas"}]}/>
            <div className="flex items-center justify-between mt-3">
              <div><h1 className="text-xl font-semibold tracking-tight">Respuestas</h1><p className="text-sm text-muted-foreground mt-0.5">Propuestas de importadores a tus cotizaciones.</p></div>
              {responses.filter(r=>r.status==="resp-nueva").length>0&&<span className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-xs font-medium text-orange-700"><Bell className="w-3.5 h-3.5"/>{responses.filter(r=>r.status==="resp-nueva").length} nuevas</span>}
            </div>
          </div>
          <Card padding="sm"><div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px]"><Input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} prefix={<Search className="w-4 h-4"/>}/></div>
            <div className="w-36"><Select value={statusF} onChange={e=>setStatusF(e.target.value)}><option value="">Estado</option><option value="resp-nueva">Nueva</option><option value="resp-vista">Vista</option><option value="resp-aceptada">Aceptada</option><option value="resp-rechazada">Rechazada</option></Select></div>
            <div className="w-44"><Select value={empresaF} onChange={e=>setEmpresaF(e.target.value)}><option value="">Empresa</option>{importers.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</Select></div>
            {(search||statusF||empresaF)&&<Button variant="ghost" size="sm" onClick={()=>{setSearch("");setStatusF("");setEmpresaF("");}}>Limpiar</Button>}
          </div></Card>
          <div>
            <p className="text-sm text-muted-foreground mb-3"><span className="font-medium text-foreground">{filtered.length}</span> respuestas</p>
            {filtered.length===0?<Card padding="lg" className="border-dashed"><div className="flex flex-col items-center text-center py-8 gap-2"><ClipboardList className="w-10 h-10 text-muted-foreground/30"/><p className="font-medium">Sin respuestas</p><p className="text-sm text-muted-foreground">No hay propuestas registradas en backend para tus cotizaciones.</p></div></Card>:(
              <div className="space-y-3">{filtered.map(r=>{const imp=importers.find(i=>i.id===r.importerId)||importers[0]||null;const q=quotes.find(q=>q.id===r.quoteId)||quotes[0]||null;return(
                <Card key={r.id} padding="md" className="hover:shadow-md transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Avatar
                        initials={imp?.initials || "IM"}
                        size="xl"
                        color={imp?.color || "bg-slate-600"}
                        src={imp?.logoUrl ? resolveApiUrl(imp.logoUrl) : undefined}
                        variant="logo"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap"><p className="font-semibold">{imp?.name || "Empresa importadora"}</p><Badge variant={r.status}/>{imp?.verified&&<span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-medium"><BadgeCheck className="w-2.5 h-2.5"/>Verificada</span>}</div>
                        <p className="text-xs text-muted-foreground mt-0.5">{imp?.specialty || "Especialidad no disponible"} · {imp?.advisor.name || "Asesor"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Cotización: <span className="font-mono font-medium text-foreground">{q?.code || "N/A"}</span></p>
                        <div className="flex gap-4 mt-2 flex-wrap">{[["Precio",r.price],["Plazo",r.deliveryTime],["Incoterm",r.incoterm],["Fecha",r.date]].map(([k,v])=><div key={k}><span className="text-xs text-muted-foreground">{k}: </span><span className="text-xs font-semibold">{v}</span></div>)}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap"><Button variant="secondary" size="sm" icon={<ExternalLink className="w-3 h-3"/>} onClick={()=>onViewDetail(r.id,"responses")}>Ver detalle</Button><Button variant="secondary" size="sm" icon={<GitCompare className="w-3 h-3"/>} disabled={!r.quoteId} title="Comparar todas las propuestas de esta cotizacion" onClick={()=>r.quoteId&&onViewQuote(r.quoteId)}>Comparar</Button><ContactBtn type="chat" size="sm" label="Contactar" onClick={()=>openSmartContact({type:"chat",onOpenChat:()=>onViewDetail(r.id,"responses")})}/></div>
                  </div>
                </Card>
              );})}</div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDERS SCREEN
// ─────────────────────────────────────────────────────────────────────────────