import { useState } from "react";
import { Eye, CheckCircle2, Search, MessageCircle, X, Send, Users } from "lucide-react";
import { clsx } from "clsx";

import { Quote } from "@/types/quote";

import { SidebarCtrl } from "@/types/portal";

import { Breadcrumb } from "@/app/components/navigation/Breadcrumb";

import type { LegalPage } from "@/features/legal/types";

import { ModalRechazoCotizacion } from "@/features/importador/RechazarCotizacion";

import { Avatar, Badge, Button, Card, Input } from "@/app/components/design-system";

// De este archivo ya solo se usan las buenas prácticas por rol: la FAQ vive
// ahora en la base de datos, mantenida por el equipo de soporte.

import { type BackendPropuesta } from "@/services/business.service";

import { leerPropuesta, pesos as pesosCop } from "@/features/propuestas/calculo";

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

import { Modal, Sidebar, AppHeader, USER_IMPORTADORA } from "@/app/App";
import { AdvisorQuoteDetailModal } from "@/components/advisor/tabs/AdvisorQuoteDetailModal";
import type { CompanyAdvisor } from "@/types/portal";
import type { ChatConv } from "@/app/App";

function puedeRechazarse(q: Quote): boolean {
  return q.status === "created" || q.status === "directed" || q.status === "open";
}

export function ImporterQuotesScreen({sb,onRespond,quotes,advisors,chats,onOpenChat,onAssignAdvisor,proposalsByQuoteId,onConfirmProposal,onRechazada}:{sb:SidebarCtrl;onRespond:(id:string)=>void;quotes:Quote[];advisors:CompanyAdvisor[];chats:ChatConv[];onOpenChat:(conversationId:string)=>void;onAssignAdvisor:(quoteId:string,advisorId:string|null)=>Promise<void>;proposalsByQuoteId:Record<string,BackendPropuesta>;onConfirmProposal:(propuestaId:string)=>Promise<void>;onRechazada:()=>Promise<void>}) {
  const [filter,setFilter]=useState("todas");
  const [rechazando,setRechazando]=useState<Quote|null>(null);
  const [search,setSearch]=useState("");
  const [detalle,setDetalle]=useState<Quote|null>(null);
  const [asignando,setAsignando]=useState<Quote|null>(null);
  const [mensaje,setMensaje]=useState("");
  const [confirmando,setConfirmando]=useState("");
  // La conversacion de una cotizacion solo existe cuando ya se abrio la
  // negociacion; hasta entonces no hay chat al que llevar al usuario.
  // Tras crearse la orden el mismo hilo pasa a tipo "orden", asi que se buscan
  // los dos: es la misma conversacion con el cliente.
  const chatDe=(quoteId:string)=>chats.find((c)=>(c.type==="cotizacion"||c.type==="orden")&&(c.refId===quoteId||c.quoteId===quoteId));

  // El cliente ya aceptó y falta la firma de la empresa: hasta que la cuenta
  // dueña confirme, no hay orden. Es el paso donde revisa la negociación que
  // dejó su asesor en el chat.
  const esperandoConfirmacion=quotes.filter((q)=>{
    const p=proposalsByQuoteId[q.id];
    return p&&p.estado==="pendiente"&&p.preaceptada_por_solicitante&&!p.preaceptada_por_empresa;
  });

  async function confirmar(quote:Quote){
    const propuesta=proposalsByQuoteId[quote.id];
    if(!propuesta)return;
    setConfirmando(propuesta.id);
    setMensaje("");
    try{
      await onConfirmProposal(propuesta.id);
      setMensaje(`Confirmaste la propuesta de ${quote.product}. La operación ya está creada; el comprador fue avisado de realizar el pago y enviar el comprobante por el chat.`);
    }catch(err){
      setMensaje(err instanceof Error?err.message:"No se pudo confirmar la propuesta.");
    }finally{
      setConfirmando("");
    }
  }

  async function asignar(quote:Quote,advisorId:string|null){
    try{
      await onAssignAdvisor(quote.id,advisorId);
      setMensaje(advisorId?"Asesor asignado a la cotizacion.":"La cotizacion volvio al pool de la empresa.");
    }catch(err){
      setMensaje(err instanceof Error?err.message:"No se pudo reasignar la cotizacion.");
    }finally{
      setAsignando(null);
    }
  }
  const tabs=["todas","disponibles","asignadas","respondidas","vencidas","abiertas","dirigidas"];
  const filtered=quotes.filter(q=>{
    const ms=!search||[q.product,q.code,q.importer].some(v=>v.toLowerCase().includes(search.toLowerCase()));
    const mf=filter==="todas"||
      (filter==="dirigidas"&&q.mode==="Dirigida")||
      (filter==="abiertas"&&q.mode==="Abierta")||
      (filter==="disponibles"&&q.status==="created")||
      (filter==="asignadas"&&q.status==="directed")||
      (filter==="respondidas"&&(q.status==="accepted"||q.status==="active-order"));
    return ms&&mf;
  });
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="imp-quotes"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER_IMPORTADORA} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          <div>
            <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav("imp-dashboard")},{label:"Cotizaciones"}]}/>
            <h1 className="text-xl font-semibold mt-3">Cotizaciones recibidas</h1>
          </div>

          {esperandoConfirmacion.length>0&&(
            <Card padding="none" className="border-amber-300">
              <div className="px-5 py-3 border-b border-amber-200 bg-amber-50 dark:!bg-accent/10">
                <p className="font-semibold text-sm text-amber-900 dark:!text-accent">Esperan tu confirmación</p>
                <p className="text-xs text-amber-800 dark:!text-accent mt-0.5">
                  El cliente aceptó lo que negoció tu asesor. Revisa el chat y confirma para crear la operación.
                </p>
              </div>
              <div className="divide-y divide-border">
                {esperandoConfirmacion.map((q)=>{
                  const propuesta=proposalsByQuoteId[q.id];
                  const chat=chatDe(q.id);
                  return (
                    <div key={q.id} className="flex items-center gap-3 px-5 py-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{q.product}</p>
                        <p className="text-xs text-muted-foreground">
                          {q.code} · {leerPropuesta(propuesta.condiciones_adicionales) ? `${pesosCop(leerPropuesta(propuesta.condiciones_adicionales)!.totales.total_cop)} con IVA` : `US$${propuesta.precio_ofrecido_usd}`} · {propuesta.tiempo_estimado_entrega} · {propuesta.incoterm}
                        </p>
                      </div>
                      <Button variant="secondary" size="sm" icon={<MessageCircle className="w-3.5 h-3.5"/>}
                        disabled={!chat}
                        title={chat?"Revisar la negociación del asesor":"Todavía no hay chat de esta cotización"}
                        onClick={()=>{if(chat) onOpenChat(chat.id);}}>
                        Ver negociación
                      </Button>
                      <Button variant="primary" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5"/>}
                        loading={confirmando===propuesta.id}
                        onClick={()=>{void confirmar(q);}}>
                        Confirmar y crear operación
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              {tabs.map(t=>
                <button key={t}
                  onClick={()=>setFilter(t)}
                  className={clsx("px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors",filter===t?"bg-primary dark:bg-accent text-white dark:text-black":"border hover:bg-primary/20 dark:hover:bg-accent/20 hover:text-primary dark:hover:text-accent hover:!border-primary/40 dark:hover:!border-accent/40")}>{t}
                </button>
              )}
            </div>
            <div className="w-64"><Input placeholder="Buscar…" value={search} onChange={e=>setSearch(e.target.value)} prefix={<Search className="w-4 h-4"/>}/></div>
          </div>
          <Card padding="none">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Cotización</th>
                  <th className="text-left px-3 py-3 font-medium hidden md:table-cell">Modalidad</th>
                  <th className="text-left px-3 py-3 font-medium hidden sm:table-cell">Fecha</th>
                  <th className="text-left px-3 py-3 font-medium">Estado</th>
                  <th className="text-right px-5 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(q=>(
                  <tr key={q.id} className="hover:bg-muted/30 dark:hover:!bg-accent/10 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium truncate max-w-[200px]">{q.product}</p>
                      <p className="text-xs text-muted-foreground">{q.code}</p>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell"><span className={clsx("px-2 py-0.5 text-xs rounded-md font-medium dark:!bg-accent/10 dark:!text-accent",q.mode==="Dirigida"?"bg-blue-50 text-blue-700":"bg-orange-50 text-orange-700")}>{q.mode}</span></td>
                    <td className="px-3 py-3 text-xs text-muted-foreground hidden sm:table-cell">{q.date}</td>
                    <td className="px-3 py-3"><Badge variant={q.status}/></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="dark:border dark:border-accent/80 dark:bg-accent/10 dark:text-accent dark:hover:bg-accent/20" icon={<Eye className="w-3.5 h-3.5"/>} title="Ver detalle" onClick={()=>setDetalle(q)}/>
                        <Button variant="ghost" size="sm" className="dark:border dark:border-accent/80 dark:bg-accent/10 dark:text-accent dark:hover:bg-accent/20" icon={<Users className="w-3.5 h-3.5"/>} title="Asignar asesor" onClick={()=>setAsignando(q)}/>
                        <Button variant="ghost" size="sm" className="dark:border dark:border-accent/80 dark:bg-accent/10 dark:text-accent dark:hover:bg-accent/20" icon={<MessageCircle className="w-3.5 h-3.5"/>} title={chatDe(q.id)?"Abrir chat":"Todavia no hay chat: se abre al iniciar la negociacion"} disabled={!chatDe(q.id)} onClick={()=>{const c=chatDe(q.id); if(c) onOpenChat(c.id);}}/>
                        {puedeRechazarse(q)&&<Button variant="ghost" size="sm" className="dark:border dark:border-accent/80 dark:bg-accent/10 dark:text-accent dark:hover:bg-accent/20" icon={<X className="w-3.5 h-3.5"/>} title="Rechazar cotización" onClick={()=>setRechazando(q)}/>}
                        <Button variant="primary" size="sm" icon={<Send className="w-3.5 h-3.5"/>} onClick={()=>onRespond(q.id)}>Responder</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length===0&&<div className="py-12 text-center text-sm text-muted-foreground">No hay cotizaciones para este filtro.</div>}
            <ModalRechazoCotizacion cotizacion={rechazando} onCerrar={()=>setRechazando(null)} onRechazada={onRechazada}/>
          </Card>
          {mensaje&&<div className="p-3 rounded-lg border border-border bg-muted/40 text-sm">{mensaje}</div>}
        </main>
      </div>
      <AdvisorQuoteDetailModal
        quote={detalle}
        open={Boolean(detalle)}
        onClose={()=>setDetalle(null)}
        proposal={detalle ? proposalsByQuoteId[detalle.id] : undefined}
        negotiationChat={detalle ? chatDe(detalle.id) : undefined}
        onConfirmProposal={onConfirmProposal}
        onOpenChat={onOpenChat}
      />
      <Modal open={Boolean(asignando)} onClose={()=>setAsignando(null)} title="Asignar asesor">
        <p className="text-sm text-muted-foreground mb-4">
          Elige quien de tu equipo se hace cargo de esta cotizacion. Devolverla al pool permite que
          cualquier asesor la reclame.
        </p>
        <div className="space-y-2">
          {advisors.filter((a)=>a.status==="activo").map((a)=>(
            <button key={a.id} type="button" onClick={()=>{if(asignando) void asignar(asignando,a.id);}}
              className="w-full flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-left hover:border-primary/40 hover:bg-muted/40 transition-colors">
              <Avatar initials={a.initials} size="sm" color={a.color}/>
              <div className="min-w-0"><p className="text-sm font-medium truncate">{a.name}</p><p className="text-xs text-muted-foreground truncate">{a.email}</p></div>
            </button>
          ))}
          {advisors.filter((a)=>a.status==="activo").length===0&&(
            <p className="text-sm text-muted-foreground">No hay asesores activos en tu empresa.</p>
          )}
        </div>
        <div className="mt-4 pt-3 border-t border-border">
          <Button variant="secondary" size="sm" fullWidth onClick={()=>{if(asignando) void asignar(asignando,null);}}>
            Devolver al pool de la empresa
          </Button>
        </div>
      </Modal>
    </div>
  );
}