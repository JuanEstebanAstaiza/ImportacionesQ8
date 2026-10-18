import { useState } from "react";
import { Eye, MessageCircle, X, Send, Edit2 } from "lucide-react";

import { Quote } from "@/types/quote";

import { SidebarCtrl } from "@/types/portal";

import { Breadcrumb } from "@/app/components/navigation/Breadcrumb";

import type { LegalPage } from "@/features/legal/types";

import { ModalRechazoCotizacion } from "@/features/importador/RechazarCotizacion";

import { Badge, Button, Card } from "@/app/components/design-system";

// De este archivo ya solo se usan las buenas prácticas por rol: la FAQ vive
// ahora en la base de datos, mantenida por el equipo de soporte.

import { type BackendPropuesta } from "@/services/business.service";

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

import { Sidebar, AppHeader } from "@/app/App";
import type { ChatConv } from "@/app/App";

export function AdvisorMyQuotesScreen({sb,quotes,onRespond,headerUser,existingProposalByQuoteId,chats,onOpenChat,onRechazada}:{sb:SidebarCtrl;quotes:Quote[];onRespond:(id:string)=>void;headerUser:{name:string;company:string;initials:string};existingProposalByQuoteId:Record<string, BackendPropuesta>;chats:ChatConv[];onOpenChat:(conversationId:string)=>void;onRechazada:()=>Promise<void>}) {
  const myQuotes=quotes.slice(0,20);
  const [rechazando,setRechazando]=useState<Quote|null>(null);
  // Al crearse la orden el hilo pasa a tipo "orden" y `refId` apunta a ella,
  // pero sigue siendo la misma conversacion con el cliente: sin buscar tambien
  // por `quoteId`, el asesor perdia el acceso al chat justo al cerrar el trato.
  const chatDe=(quoteId:string)=>chats.find((c)=>(c.type==="cotizacion"||c.type==="orden")&&(c.refId===quoteId||c.quoteId===quoteId));
  const [selectedQuote,setSelectedQuote]=useState<Quote|null>(null);
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="adv-my-quotes"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={headerUser} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          <div>
            <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav("adv-dashboard")},{label:"Mis cotizaciones"}]}/>
            <h1 className="text-xl font-semibold mt-3">Mis cotizaciones</h1>
          </div>
          <Card padding="none">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Producto</th>
                  <th className="text-left px-3 py-3 font-medium hidden md:table-cell">Código</th>
                  <th className="text-left px-3 py-3 font-medium hidden md:table-cell">Estado cot.</th>
                  <th className="text-left px-3 py-3 font-medium hidden lg:table-cell">Últ. act.</th>
                  <th className="text-right px-5 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {myQuotes.map(q=>(
                  <tr key={q.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium">{q.product}</p>
                      <p className="text-xs text-muted-foreground">{q.importer}</p>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell text-xs font-mono">{q.code}</td>
                    <td className="px-3 py-3 hidden md:table-cell"><Badge variant={q.status as BadgeVariant}/></td>
                    <td className="px-3 py-3 text-xs hidden lg:table-cell text-muted-foreground">{q.updatedAt}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<MessageCircle className="w-3.5 h-3.5"/>} title={chatDe(q.id)?"Abrir chat":"Todavia no hay chat: se abre al iniciar la negociacion"} disabled={!chatDe(q.id)} onClick={()=>{const c=chatDe(q.id); if(c) onOpenChat(c.id);}}/>
                        <Button variant="secondary" size="sm" icon={<Eye className="w-3.5 h-3.5"/>} onClick={()=>setSelectedQuote(q)}>Ver Detalle Completo</Button>
                        {existingProposalByQuoteId[q.id] ? (
                          <Button variant="secondary" size="sm" icon={<Edit2 className="w-3.5 h-3.5"/>} onClick={()=>onRespond(q.id)}>Ver/Editar Propuesta</Button>
                        ) : (
                          <Button variant="primary" size="sm" icon={<Send className="w-3.5 h-3.5"/>} onClick={()=>onRespond(q.id)}>Crear Respuesta</Button>
                        )}
                        {puedeRechazarse(q)&&<Button variant="ghost" size="sm" icon={<X className="w-3.5 h-3.5"/>} title="Rechazar cotización" onClick={()=>setRechazando(q)}/>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {myQuotes.length===0&&<div className="py-12 text-center text-sm text-muted-foreground">No tienes cotizaciones asignadas.</div>}
          </Card>
          <ModalRechazoCotizacion cotizacion={rechazando} onCerrar={()=>setRechazando(null)} onRechazada={onRechazada}/>
        </main>
      </div>
      <AdvisorQuoteDetailModal quote={selectedQuote} open={Boolean(selectedQuote)} onClose={()=>setSelectedQuote(null)}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE RESPONSE SCREEN — 3-step wizard
// ─────────────────────────────────────────────────────────────────────────────