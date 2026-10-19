import { useState } from "react";
import { UserRound, CheckCircle2, ShoppingCart, MessageCircle, ExternalLink, Clock, MapPin, BadgeCheck, GitCompare, TrendingUp, TrendingDown, Minus, MessageSquare } from "lucide-react";

import { Quote } from "@/types/quote";
import type { ResponseFrom } from "@/types/quote";
import { Importer } from "@/types/importer";
import { SidebarCtrl } from "@/types/portal";

import { Breadcrumb } from "@/components/navigation/Breadcrumb";

import type { LegalPage } from "@/features/legal/types";

import { Avatar, Badge, Button, Card, ContactBtn, openSmartContact, Timeline } from "@/components/design-system";

// De este archivo ya solo se usan las buenas prácticas por rol: la FAQ vive
// ahora en la base de datos, mantenida por el equipo de soporte.

import { businessService } from "@/services/business.service";

import { resolveApiUrl } from "@/services/api-client";

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

import { Sidebar, AppHeader, USER, inferLifecycleStageIndex, buildLifecycleTimeline } from "@/app/App";
import type { Order, ChatConv } from "@/app/App";
import type { QuoteResponse } from "@/types/response";
import { cantidadConUnidad } from "@/utils/formatos";

export function ResponseDetailScreen({responseId,from,fromQuoteId,onBack,onBackToQuote,onOpenChat,sb,responses,quotes,chats,importers,orders,onRefreshData}:{
  responseId:string;from:ResponseFrom;fromQuoteId?:string;
  onBack:()=>void;onBackToQuote:(id:string)=>void;onOpenChat:(id:string)=>void;sb:SidebarCtrl;responses:QuoteResponse[];quotes:Quote[];chats:ChatConv[];importers:Importer[];orders:Order[];onRefreshData?:()=>Promise<void>;
}) {
  const resp=responses.find(r=>r.id===responseId)||responses[0];
  if(!resp){
    return (
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar {...sb} active="responses"/>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden"><AppHeader user={USER} sb={sb}/><main className="flex-1 overflow-y-auto px-6 py-6"><Card padding="lg" className="border-dashed"><p className="text-sm text-muted-foreground text-center">Respuesta no disponible.</p></Card></main></div>
      </div>
    );
  }
  const imp=importers.find(i=>i.id===resp.importerId)||importers[0]||null;
  const quote=quotes.find(q=>q.id===resp.quoteId)||quotes[0];
  const relChat=chats.find(c=>c.importerId===resp.importerId&&(c.refId===resp.quoteId||c.type==="cotizacion"));
  const relatedOrder=orders.find((order)=>order.quoteCode===quote.code)||null;
  const [accepting,setAccepting]=useState(false);
  const [acceptedByMe,setAcceptedByMe]=useState(resp.status==="resp-aceptada");
  const [acceptedByAdvisor,setAcceptedByAdvisor]=useState(resp.status==="resp-aceptada");
  const orderCreated=orders.some((order)=>order.quoteCode===quote.code||order.id===quote.id);
  async function handleAccept(){
    setAccepting(true);
    try{
      await businessService.startProposalNegotiation(resp.quoteId, resp.importerId);
      await businessService.preAcceptProposal(resp.id,true);
      setAcceptedByMe(true);
      setAcceptedByAdvisor(true);
      if(onRefreshData){
        await onRefreshData();
      }
    }finally{
      setAccepting(false);
    }
  }
  const responseLifecycleIndex = relatedOrder
    ? inferLifecycleStageIndex(relatedOrder.status || relatedOrder.history[relatedOrder.history.length - 1]?.estado)
    : (acceptedByMe || acceptedByAdvisor)
      ? 2
      : 1;
  const negotiationStages=buildLifecycleTimeline(responseLifecycleIndex);

  const companyName = imp?.name || "Empresa importadora";
  const importerLogo = imp?.logoUrl ? resolveApiUrl(imp.logoUrl) : "";
  const crumbs=from==="quote-detail"
    ?[{label:"Cotizaciones",onClick:()=>onBackToQuote(fromQuoteId||quote.id)},{label:quote.code,onClick:()=>onBackToQuote(fromQuoteId||quote.id)},{label:`Respuesta — ${companyName}`}]
    :[{label:"Respuestas",onClick:onBack},{label:`Respuesta de ${companyName}`}];

  const compRows=[
    {label:"Precio objetivo",target:quote.targetPrice,offer:resp.price,         result:"worse" as const},
    {label:"Cantidad solicitada", target:cantidadConUnidad(quote.minQuantity,quote.unit),offer:resp.moq,       result:"better"as const},
    {label:"Incoterm",       target:quote.incoterm,   offer:resp.incoterm,       result:(quote.incoterm===resp.incoterm?"equal":"worse")as"equal"|"worse"},
    {label:"Plazo estimado", target:"30 días",        offer:resp.deliveryTime,   result:"equal" as const},
  ];

  if(orderCreated){
    return (
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar {...sb} active={from==="quote-detail"?"quotes":"responses"}/>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AppHeader user={USER} sb={sb}/>
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="flex flex-col items-center text-center gap-5 max-w-sm">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center"><CheckCircle2 className="w-8 h-8 text-emerald-500"/></div>
              <div>
                <h2 className="text-lg font-semibold">¡Operación creada!</h2>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">Ambas partes aceptaron. La respuesta fue <span className="font-medium text-emerald-600">Seleccionada</span> y las demás propuestas quedaron <span className="font-medium text-slate-500">Canceladas</span>.</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                <Button variant="secondary" onClick={onBack}>Volver</Button>
                <Button variant="primary" icon={<ShoppingCart className="w-4 h-4"/>} onClick={()=>sb.onNav("orders")}>Ir a la operación</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active={from==="quote-detail"?"quotes":"responses"}/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <Breadcrumb items={[{label:"Inicio",onClick:onBack},...crumbs]}/>
          <Card padding="md" className="mt-4 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-4 flex-1">
                <Avatar initials={imp?.initials || "IM"} size="2xl" color={imp?.color || "bg-slate-600"} src={importerLogo||undefined} variant="logo"/>
                <div>
                  <div className="flex items-center gap-2 flex-wrap"><h1 className="text-lg font-semibold">{companyName}</h1>{imp?.verified&&<span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium"><BadgeCheck className="w-3 h-3"/>Verificada</span>}<Badge variant={resp.status}/></div>
                  <p className="text-sm text-muted-foreground mt-0.5">{imp?.specialty || "Especialidad no disponible"}</p>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap"><div className="flex items-center gap-1 text-muted-foreground"><Clock className="w-3.5 h-3.5"/><span className="text-xs">{imp?.responseTime || "N/A"}</span></div><div className="flex items-center gap-1 text-muted-foreground"><MapPin className="w-3.5 h-3.5"/><span className="text-xs">{imp?.country || "N/A"}</span></div></div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Cotización: <span className="font-mono font-medium text-foreground">{quote.code}</span></p>
            </div>
          </Card>
          <div className="flex gap-5 items-start">
            <div className="flex-1 min-w-0 space-y-5">
              <Card padding="md"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><UserRound className="w-4 h-4 text-primary"/>Asesor asignado</h3>
                <div className="flex items-start gap-3 mb-4"><Avatar initials={imp?.initials || initialsFromName(companyName)} size="xl" color={imp?.color || "bg-slate-600"} src={importerLogo||undefined} variant="logo"/><div><p className="font-semibold">{imp?.name || "Empresa importadora"}</p><p className="text-xs text-muted-foreground mt-0.5">{imp?.specialty || "Asesor"}</p><p className="text-xs text-primary mt-0.5">{companyName}</p></div></div>
                <div className="flex gap-2">
                  <ContactBtn type="chat" onClick={()=>openSmartContact({type:"chat",onOpenChat:()=>{if(relChat)onOpenChat(relChat.id);}})}/>
                  <ContactBtn type="email" onClick={()=>openSmartContact({type:"email",email:imp?.advisor.email,onOpenChat:()=>{if(relChat)onOpenChat(relChat.id);}})}/>
                </div>
              </Card>
              <Card padding="md"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary"/>Oferta comercial</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">{[["Precio unitario",resp.price],["MOQ",resp.moq],["Plazo",resp.deliveryTime],["Incoterm",resp.incoterm],["País de origen",resp.origin],["Producción",resp.production],["Personalización",resp.customization]].map(([k,v])=><div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="text-sm font-semibold mt-0.5">{v}</p></div>)}<div className="col-span-2 sm:col-span-3"><p className="text-xs text-muted-foreground">Observaciones</p><p className="text-sm mt-0.5 leading-relaxed">{resp.observations}</p></div></div>
                <div className="mt-4 pt-4 border-t border-border"><p className="text-xs text-muted-foreground">Los adjuntos reales se consultan desde Chat y Documentos vinculados a esta cotización.</p></div>
              </Card>
              <Card padding="md"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><GitCompare className="w-4 h-4 text-primary"/>Objetivo vs Oferta</h3>
                <table className="w-full text-sm"><thead><tr className="border-b border-border">{["Criterio","Tu objetivo","Oferta",""].map(h=><th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2 pr-4">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-border/60">{compRows.map(row=>(
                  <tr key={row.label} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 text-muted-foreground pr-4">{row.label}</td><td className="py-2.5 font-medium pr-4">{row.target}</td><td className="py-2.5 font-medium pr-4">{row.offer}</td>
                    <td className="py-2.5">{row.result==="better"&&<div className="flex items-center gap-1 text-emerald-600 text-xs font-medium"><TrendingUp className="w-3.5 h-3.5"/>Mejor</div>}{row.result==="worse"&&<div className="flex items-center gap-1 text-red-500 text-xs font-medium"><TrendingDown className="w-3.5 h-3.5"/>Más alto</div>}{row.result==="equal"&&<div className="flex items-center gap-1 text-blue-600 text-xs font-medium"><Minus className="w-3.5 h-3.5"/>Igual</div>}</td>
                  </tr>
                ))}</tbody></table>
              </Card>
            </div>
            <div className="w-64 flex-shrink-0 hidden lg:block space-y-4">
              {/* Negotiation timeline */}
              <Card padding="md">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Flujo de ciclo de vida</h3>
                <Timeline stages={negotiationStages}/>
              </Card>
              {/* Accept actions */}
              <Card padding="md">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Acciones</h3>
                {acceptedByMe&&!orderCreated&&(
                  <div className="mb-3 flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0"/>
                    <p className="text-xs text-emerald-700">Has aceptado. Esperando al asesor…</p>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {!acceptedByMe
                    ?<Button variant="primary" fullWidth icon={<CheckCircle2 className="w-4 h-4"/>} loading={accepting} onClick={handleAccept}>Aceptar propuesta</Button>
                    :<Button variant="secondary" fullWidth icon={<CheckCircle2 className="w-4 h-4 text-emerald-600"/>} disabled>Propuesta aceptada</Button>
                  }
                  <Button variant="secondary" fullWidth icon={<MessageCircle className="w-4 h-4"/>} onClick={()=>relChat&&onOpenChat(relChat.id)}>Negociar por chat</Button>
                  <div className="pt-2 border-t border-border flex flex-col gap-1.5">
                    <Button variant="ghost" fullWidth icon={<ExternalLink className="w-3.5 h-3.5"/>} className="text-primary hover:text-blue-700 hover:bg-primary/5" onClick={()=>onBackToQuote(resp.quoteId)}>Ver cotización</Button>
                    {relChat&&<Button variant="ghost" fullWidth icon={<MessageSquare className="w-3.5 h-3.5"/>} className="text-foreground hover:bg-muted" onClick={()=>onOpenChat(relChat.id)}>Ver chat</Button>}
                  </div>
                </div>
              </Card>
              <Card padding="md"><div className="space-y-2">{[["Empresa",companyName],["Miembro desde",imp?.memberSince || "N/D"],["Proyectos",String(imp?.projects || 0)],["Resp. prom.",imp?.responseTime || "N/D"]].map(([k,v])=><div key={k} className="flex justify-between"><span className="text-xs text-muted-foreground">{k}</span><span className="text-xs font-medium text-right">{v}</span></div>)}</div></Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSES SCREEN
// ─────────────────────────────────────────────────────────────────────────────