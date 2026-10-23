import { useState } from "react";
import { Eye, CheckCircle2, Globe, Clock, X, Tag } from "lucide-react";
import { clsx } from "clsx";

import { Quote } from "@/types/quote";

import { SidebarCtrl } from "@/types/portal";

import { Breadcrumb } from "@/components/navigation/Breadcrumb";

import { ModalRechazoCotizacion } from "@/features/importador/RechazarCotizacion";
import { AdvisorQuoteDetailModal } from "@/features/advisor/components/tabs/AdvisorQuoteDetailModal";

import { Button, Card } from "@/components/design-system";
import { puedeRechazarse } from "@/utils/quotes";

// De este archivo ya solo se usan las buenas prácticas por rol: la FAQ vive
// ahora en la base de datos, mantenida por el equipo de soporte.

import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";

export function AdvisorAvailableScreen({sb,available,onClaim,onDiscard,headerUser}:{sb:SidebarCtrl;available:Quote[];onClaim:(id:string)=>Promise<void>;onDiscard:(quote:Quote)=>Promise<void>;headerUser:{name:string;company:string;initials:string}}) {
  const [claimingId,setClaimingId]=useState<string|null>(null);
  const [discardingId,setDiscardingId]=useState<string|null>(null);
  const [claimError,setClaimError]=useState("");
  const [selectedQuote,setSelectedQuote]=useState<Quote|null>(null);
  const [rechazando,setRechazando]=useState<Quote|null>(null);

  async function handleClaim(quoteId: string){
    try{
      setClaimingId(quoteId);
      setClaimError("");
      await onClaim(quoteId);
    }catch(error){
      const message = error instanceof Error ? error.message : "No se pudo tomar la cotización.";
      setClaimError(message);
    }finally{
      setClaimingId(null);
    }
  }

  async function handleDiscard(quote: Quote){
    try{
      setDiscardingId(quote.id);
      setClaimError("");
      await onDiscard(quote);
    }catch(error){
      const message = error instanceof Error ? error.message : "No se pudo descartar la cotización.";
      setClaimError(message);
    }finally{
      setDiscardingId(null);
    }
  }

  async function handleAcceptFromDetail() {
    if (!selectedQuote) return;
    await handleClaim(selectedQuote.id);
    setSelectedQuote(null);
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="adv-available"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={headerUser} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          <div>
            <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav("adv-dashboard")},{label:"Cotizaciones disponibles"}]}/>
            <h1 className="text-xl font-semibold mt-3">Cotizaciones disponibles</h1>
            <p className="text-sm text-muted-foreground">{available.length} esperando asignación</p>
          </div>
          {claimError&&<Card padding="sm" className="border-destructive/30 bg-red-50"><p className="text-xs text-destructive">{claimError}</p></Card>}
          {available.length===0&&(
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400"/>
              <p className="font-semibold text-lg">¡Todo al día!</p>
              <p className="text-sm text-muted-foreground">No hay cotizaciones disponibles para asignar en este momento</p>
            </div>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {available.map(q=>(
              <div key={q.id} className="border border-border rounded-xl p-5 flex flex-col gap-4 transition-all duration-300 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm leading-tight">{q.product}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{q.code}</p>
                  </div>
                  <span className={clsx("px-2 py-0.5 text-xs rounded-md font-medium flex-shrink-0",q.mode==="Dirigida"?"bg-blue-50 text-blue-700":"bg-orange-50 text-orange-700")}>{q.mode}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Tag className="w-3 h-3"/>{q.productLine}</span>
                  <span className="flex items-center gap-1"><Globe className="w-3 h-3"/>{q.country}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3"/>{q.updatedAt}</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <Button variant="secondary" size="sm" icon={<Eye className="w-3.5 h-3.5"/>} onClick={()=>setSelectedQuote(q)}>Revisar y aceptar</Button>
                  <div className="grid grid-cols-1 gap-2">
                    <Button variant="secondary" size="sm" icon={<X className="w-3.5 h-3.5"/>} loading={discardingId===q.id} onClick={()=>setRechazando(q)}>Rechazar</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
      <AdvisorQuoteDetailModal quote={selectedQuote} open={Boolean(selectedQuote)} onClose={()=>setSelectedQuote(null)} onAccept={handleAcceptFromDetail} accepting={Boolean(selectedQuote && claimingId===selectedQuote.id)}/>
      <ModalRechazoCotizacion cotizacion={rechazando} onCerrar={()=>setRechazando(null)} onRechazada={()=>rechazando?handleDiscard(rechazando):undefined}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVISOR PORTAL — MY QUOTES
// ─────────────────────────────────────────────────────────────────────────────

