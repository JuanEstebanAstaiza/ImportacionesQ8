import { useState, useEffect, useCallback } from "react";
import { Star, Eye, CheckCircle2, Loader2, FolderOpen, MessageCircle, Tag, BadgeCheck, GitCompare, ClipboardList, Copy, Receipt, Download, MessageSquare } from "lucide-react";
import { clsx } from "clsx";

import { Breadcrumb } from "@/app/components/navigation/Breadcrumb";

import { Avatar, Badge, Button, Card, ContactBtn, openSmartContact, Textarea, Timeline } from "@/app/components/design-system";

// De este archivo ya solo se usan las buenas prácticas por rol: la FAQ vive
// ahora en la base de datos, mantenida por el equipo de soporte.

import { businessService, type BackendPropuesta, type MotivoEleccion } from "@/services/business.service";

import { abrirArchivoEnPestana, descargarArchivo } from "@/lib/abrir-archivo";

import { RUTA_RESTABLECER } from "@/app/rutas";
import type { LegalPage } from "@/features/legal/types";
import type { Screen } from "@/app/rutas";
import type { Quote } from "@/types/quote";
import type { SidebarCtrl } from "@/types/portal";

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

import {
  Sidebar,
  AppHeader,
  USER,
  inferLifecycleStageIndex,
  buildLifecycleTimeline,
  cantidadConUnidad,
  initialsFromName,
  GaleriaFotosProducto,
  Modal,
  type ChatConv,
  type Order,
  type UserRole,
  type LifecycleDocItem,
  INCOTERM_INCLUYE,
  MOTIVOS_ELECCION,
  leerCondicionesPropuesta,
  PrecioPropuesta,
} from "@/app/App";

export function QuoteDetailScreen({quoteId,quotes,onBack,onOpenChat,sb,onRefreshQuotes,chats,orders,onDuplicate,userRole,onConfirmProposal}:{quoteId:string;quotes:Quote[];onBack:()=>void;onOpenChat:(id:string)=>void;sb:SidebarCtrl;onRefreshQuotes?:()=>Promise<void>;chats:ChatConv[];orders:Order[];onDuplicate:(quote:Quote)=>void;userRole:UserRole|"admin";onConfirmProposal?:(propuestaId:string)=>Promise<void>}) {
  const quote=quotes.find(q=>q.id===quoteId)??null;
  const [proposals,setProposals]=useState<BackendPropuesta[]>([]);
  const [loadingProposals,setLoadingProposals]=useState(true);
  const [actionMessage,setActionMessage]=useState("");
  const [trm,setTrm]=useState<number|null>(null);
  // Aceptar habiendo otras propuestas: antes se pregunta qué decidió la elección.
  const [eligiendo,setEligiendo]=useState<BackendPropuesta|null>(null);
  const [motivoEleccion,setMotivoEleccion]=useState<MotivoEleccion|null>(null);
  const [motivoDetalle,setMotivoDetalle]=useState("");
  const [decisionError,setDecisionError]=useState("");
  const [confirmingCompanyProposal,setConfirmingCompanyProposal]=useState(false);
  const [companyConfirmationError,setCompanyConfirmationError]=useState("");

  useEffect(()=>{
    let vigente=true;
    businessService.getTrm().then((r)=>{if(vigente)setTrm(r.valor);}).catch(()=>{});
    return ()=>{vigente=false;};
  },[]);

  const loadProposals=useCallback(async()=>{
    if(!quote){
      setProposals([]);
      setLoadingProposals(false);
      return;
    }
    setLoadingProposals(true);
    try{
      const rows=await businessService.listQuoteProposals(quote.id);
      setProposals(rows);
    }finally{
      setLoadingProposals(false);
    }
  },[quote]);

  useEffect(()=>{void loadProposals();},[loadProposals]);

  const handleDecision=useCallback(async(propuestaId:string,aceptar:boolean,motivo?:{motivo_eleccion:MotivoEleccion;motivo_detalle?:string})=>{
    setActionMessage("");
    const targetProposal = proposals.find((proposal) => proposal.id === propuestaId);
    if (!targetProposal) {
      throw new Error("No se encontró la propuesta seleccionada.");
    }

    if (aceptar) {
      await businessService.startProposalNegotiation(targetProposal.cotizacion_id, targetProposal.importador_id);
    }

    await businessService.preAcceptProposal(propuestaId,aceptar,motivo);
    await loadProposals();
    if(onRefreshQuotes){
      await onRefreshQuotes();
    }
    setActionMessage(aceptar?"Oferta aceptada. Chat de negociación habilitado." :"Oferta rechazada.");
  },[loadProposals,onRefreshQuotes,proposals]);

  if(!quote){
    return (
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar {...sb} active="quotes"/>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AppHeader user={USER} sb={sb}/>
          <main className="flex-1 overflow-y-auto px-6 py-6">
            <Card padding="lg" className="max-w-xl mx-auto mt-10 text-center">
              <ClipboardList className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3"/>
              <p className="font-semibold">Cotización no encontrada</p>
              <p className="text-sm text-muted-foreground mt-1">No se pudo cargar la cotización seleccionada desde la API.</p>
              <Button variant="secondary" className="mt-4" onClick={onBack}>Volver</Button>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  const visibleProposals = quote.mode === "Dirigida"
    ? proposals.filter((proposal) => !quote.importadorId || proposal.importador_id === quote.importadorId)
    : proposals;
  const otrasPendientes=(id:string)=>visibleProposals.filter(p=>p.id!==id&&p.estado==="pendiente").length;
  const aceptarPropuesta=(p:BackendPropuesta)=>{
    setDecisionError("");
    if(otrasPendientes(p.id)>0){
      setMotivoEleccion(null);
      setMotivoDetalle("");
      setEligiendo(p);
      return;
    }
    void handleDecision(p.id,true).catch((e)=>setDecisionError(e instanceof Error?e.message:"No se pudo aceptar la propuesta."));
  };
  const confirmarEleccion=async()=>{
    if(!eligiendo||!motivoEleccion)return;
    try{
      await handleDecision(eligiendo.id,true,{motivo_eleccion:motivoEleccion,motivo_detalle:motivoDetalle.trim()||undefined});
      setEligiendo(null);
    }catch(e){
      setDecisionError(e instanceof Error?e.message:"No se pudo aceptar la propuesta.");
    }
  };
  const nombreEmpresa=(p:BackendPropuesta)=>p.empresa?.nombre_empresa||(quote.mode==="Dirigida"?quote.importer:"Empresa importadora");
  const activeProposal=visibleProposals[0]??null;
  const companyConfirmationProposal = visibleProposals.find((proposal) => (
    proposal.estado==="pendiente"
    && proposal.preaceptada_por_solicitante
    && !proposal.preaceptada_por_empresa
  )) ?? null;
  const hayPropuestaAceptada = visibleProposals.some((proposal) => proposal.estado === "aceptada" || proposal.preaceptada_por_solicitante);
  const contactAsesor=visibleProposals.find(p=>p.contacto_asesor)?.contacto_asesor??null;
  const relChat=chats.find(c=>(c.type==="cotizacion"||c.type==="orden")&&(c.quoteId===quoteId||c.refId===quoteId));
  const waitingCompanyConfirmation = userRole==="importadora"
    && Boolean(onConfirmProposal)
    && Boolean(companyConfirmationProposal);
  const relatedOrder = orders.find((order) => order.quoteCode === quote.code) ?? null;
  const quoteLifecycleIndex = relatedOrder
    ? inferLifecycleStageIndex(relatedOrder.status || relatedOrder.history[relatedOrder.history.length - 1]?.estado)
    : visibleProposals.length > 0
      ? 2
      : 0;
  const quoteTimelineStages = buildLifecycleTimeline(quoteLifecycleIndex);

  const orderDocByType = (matchers: string[]) => {
    if (!relatedOrder) return null;
    const matcher = matchers.map((value) => value.toLowerCase());
    return relatedOrder.documents.find((doc) => matcher.some((item) => (doc.type || "").toLowerCase().includes(item))) ?? null;
  };

  const solicitudDoc = orderDocByType(["cotizacion", "solicitud"]);
  const propuestaDoc = orderDocByType(["propuesta"]);
  const ordenDoc = orderDocByType(["orden"]);

  const lifecycleDocs: LifecycleDocItem[] = [
    {
      label: "Solicitud",
      name: solicitudDoc?.name || `Solicitud-${quote.code}.pdf`,
      status: solicitudDoc?.url ? "Disponible" : "Pendiente",
      url: solicitudDoc?.url || null,
      source: solicitudDoc ? "Operación" : "Pendiente de generación",
    },
    {
      label: "Propuesta",
      name: propuestaDoc?.name || `Propuesta-${quote.code}.pdf`,
      status: propuestaDoc?.url ? "Disponible" : "Pendiente",
      url: propuestaDoc?.url || null,
      source: propuestaDoc ? "Operación" : (activeProposal ? "Negociación" : "Sin propuesta aceptada"),
    },
    {
      label: "Operación",
      name: ordenDoc?.name || `Operacion-${quote.code}.pdf`,
      status: ordenDoc?.url ? "Disponible" : "Pendiente",
      url: ordenDoc?.url || null,
      source: relatedOrder ? "Operación activa" : "Aún no creada",
    },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="quotes"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <Breadcrumb items={[{label:"Inicio",onClick:onBack},{label:"Cotizaciones",onClick:onBack},{label:quote.code}]}/>
          <Card padding="md" className="mt-4 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-lg font-semibold">{quote.code}</span>
                  <Badge variant={quote.status}/>
                  <span className={clsx("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium rounded-full dark:!text-accent dark:!bg-accent/20", quote.mode === "Dirigida" ? "bg-blue-50 text-blue-700" : "bg-primary/20 text-primary")}>{quote.mode}</span>
                </div>
                <div className="flex gap-6 flex-wrap">{[["Fecha",quote.date],["País",quote.country],["Incoterm",quote.incoterm],...(quote.shippingMark?[["Shipping mark",quote.shippingMark]]:[])].map(([k,v])=><div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="text-sm font-medium">{v}</p></div>)}{quote.mode==="Dirigida"&&<div><p className="text-xs text-muted-foreground">Empresa</p><p className="text-sm font-medium">{quote.importer}</p></div>}</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="secondary" size="sm" icon={<Copy className="w-3.5 h-3.5"/>} onClick={()=>onDuplicate(quote)}>Duplicar</Button>
                {relChat&&<Button variant="secondary" size="sm" icon={<MessageSquare className="w-3.5 h-3.5"/>} onClick={()=>onOpenChat(relChat.id)}>Chat</Button>}
              </div>
            </div>
          </Card>
          {quote.status==="rejected-importer"&&quote.motivoRechazo&&(
            <Card padding="md" className="mb-5 border-rose-300/60 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30">
              <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">{quote.importer} rechazó esta cotización</p>
              <p className="mt-1 text-sm text-rose-800/90 dark:text-rose-200 whitespace-pre-line">Motivo: {quote.motivoRechazo}</p>
            </Card>
          )}
          {waitingCompanyConfirmation&&companyConfirmationProposal&&(
            <Card padding="md" className="mb-5 border-amber-300 bg-amber-50 dark:border-accent/40 dark:!bg-accent/10">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-amber-700 dark:text-accent flex-shrink-0 mt-0.5"/>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-amber-900 dark:!text-accent">El comprador ya aceptó la propuesta</p>
                  <p className="text-xs text-amber-800 dark:!text-accent mt-0.5">Revisa la negociación y confirma para crear la operación.</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {relChat&&(
                      <Button variant="secondary" size="sm" icon={<MessageCircle className="w-3.5 h-3.5"/>} onClick={()=>onOpenChat(relChat.id)} className="dark:!border-accent/40">
                        Ver negociación
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<CheckCircle2 className="w-3.5 h-3.5"/>}
                      loading={confirmingCompanyProposal}
                      onClick={()=>{
                        if(!onConfirmProposal)return;
                        setCompanyConfirmationError("");
                        setConfirmingCompanyProposal(true);
                        void onConfirmProposal(companyConfirmationProposal.id)
                          .catch((error)=>setCompanyConfirmationError(error instanceof Error?error.message:"No se pudo confirmar la propuesta."))
                          .finally(()=>setConfirmingCompanyProposal(false));
                      }}
                      className="dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/90"
                    >
                      Confirmar y crear operación
                    </Button>
                  </div>
                  {companyConfirmationError&&<p role="alert" className="text-xs text-destructive mt-2">{companyConfirmationError}</p>}
                </div>
              </div>
            </Card>
          )}
          <div className="flex gap-5 items-start">
            <div className="flex-1 min-w-0 space-y-5">
              <Card padding="md"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Tag className="w-4 h-4 text-primary dark:text-accent"/>Información del producto</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">{[["Nombre",quote.product],["Línea",quote.productLine],["País",quote.country],["Calidad",quote.quality],["Descripción",quote.description||"—"]].map(([k,v])=><div key={k} className={k==="Descripción"?"col-span-2 sm:col-span-3":""}><p className="text-xs text-muted-foreground">{k}</p><p className="text-sm font-medium mt-0.5 whitespace-pre-line">{v}</p></div>)}</div>
                {(quote.productPhotoUrls??[]).length>0&&<div className="mt-4 pt-4 border-t border-border"><GaleriaFotosProducto fotos={quote.productPhotoUrls??[]}/></div>}
              </Card>
              <Card padding="md"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Receipt className="w-4 h-4 text-primary dark:text-accent"/>Información comercial</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">{[["Cantidad",cantidadConUnidad(quote.minQuantity,quote.unit)],["Precio objetivo",quote.targetPrice],["Incoterm",quote.incoterm],["Notas",quote.notes||"—"]].map(([k,v])=><div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="text-sm font-medium mt-0.5">{v}</p></div>)}</div>
              </Card>
              <Card padding="md">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><FolderOpen className="w-4 h-4 text-primary dark:text-accent"/>Documentos del ciclo</h3>
                  <span className="text-xs text-muted-foreground">Solicitud · Propuesta · Operación</span>
                </div>
                <div className="space-y-2">
                  {lifecycleDocs.map((doc) => (
                    <div key={doc.label} className="rounded-xl border border-border px-3 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">{doc.label}</p>
                        <p className="text-sm font-semibold truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.source}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={clsx("text-[11px] font-medium px-2 py-0.5 rounded",doc.url?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-700")}>{doc.status}</span>
                        {doc.url && (
                          <>
                            <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5"/>} onClick={()=>{void abrirArchivoEnPestana(doc.url);}}>Ver PDF</Button>
                            <Button variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5"/>} onClick={()=>{void descargarArchivo(doc.url, doc.name);}}>Descargar</Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><ClipboardList className="w-4 h-4 text-primary dark:text-accent"/>Ofertas recibidas{visibleProposals.length>0&&<span className="w-5 h-5 rounded-full bg-primary dark:bg-accent text-white dark:text-black text-[10px] font-bold flex items-center justify-center">{visibleProposals.length}</span>}</h3>
                  {actionMessage&&<span className="text-xs text-emerald-600 font-medium">{actionMessage}</span>}
                </div>
                {loadingProposals?<Card padding="md" className="border-dashed"><div className="py-6 text-center"><Loader2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2 animate-spin"/><p className="text-sm text-muted-foreground">Cargando ofertas...</p></div></Card>:visibleProposals.length===0?<Card padding="md" className="border-dashed"><div className="py-6 text-center"><ClipboardList className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2"/><p className="text-sm text-muted-foreground">Sin ofertas visibles para esta cotización.</p></div></Card>:(
                  <>
                    {quote.mode === "Abierta" && visibleProposals.length > 1 && (
                      <Card padding="md" className="mb-3">
                        <h4 className="text-sm font-semibold flex items-center gap-2"><GitCompare className="w-4 h-4 text-primary"/>Comparador de propuestas</h4>
                        <p className="text-xs text-muted-foreground mt-0.5 mb-3">En el orden en que llegaron. Mira precio, tiempo, lo que incluye y cómo cumple cada empresa: lo más barato no siempre es lo que más conviene.</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                                <th className="text-left py-2 pr-3 font-medium">Empresa</th>
                                <th className="text-left py-2 pr-3 font-medium">Precio</th>
                                <th className="text-left py-2 pr-3 font-medium">Tiempo</th>
                                <th className="text-left py-2 pr-3 font-medium">Qué incluye</th>
                                <th className="text-left py-2 font-medium">Cumplimiento</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60 align-top">
                              {visibleProposals.map((proposal) => {
                                const condiciones=leerCondicionesPropuesta(proposal.condiciones_adicionales);
                                const empresa=proposal.empresa;
                                return (
                                <tr key={`cmp-${proposal.id}`}>
                                  <td className="py-2.5 pr-3">
                                    <p className="font-medium flex items-center gap-1">{nombreEmpresa(proposal)}{empresa?.verificado&&<BadgeCheck className="w-3.5 h-3.5 text-primary" aria-label="Verificada"/>}</p>
                                    <p className="text-[11px] text-muted-foreground">{proposal.estado==="pendiente"?(proposal.preaceptada_por_solicitante?"Aceptaste; falta que la empresa confirme":"Esperando tu respuesta"):proposal.estado==="aceptada"?"Elegida":proposal.estado==="rechazada"?"No elegida":proposal.estado}</p>
                                  </td>
                                  <td className="py-2.5 pr-3">
                                    <PrecioPropuesta propuesta={proposal} trm={trm}/>
                                    {proposal.cantidad?<p className="text-[11px] text-muted-foreground">por {cantidadConUnidad(proposal.cantidad,quote.unit)}</p>:null}
                                  </td>
                                  <td className="py-2.5 pr-3 font-medium">{proposal.tiempo_estimado_entrega}</td>
                                  <td className="py-2.5 pr-3 max-w-[260px]">
                                    <p className="font-medium">{proposal.incoterm}</p>
                                    <p className="text-[11px] text-muted-foreground">{INCOTERM_INCLUYE[(proposal.incoterm||"").toUpperCase()]??"Según lo acordado"}</p>
                                    {condiciones.ventajas&&<p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{condiciones.ventajas}</p>}
                                  </td>
                                  <td className="py-2.5">
                                    {empresa?(
                                      <>
                                        <p className="font-medium flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-500"/>{empresa.calificacion_promedio.toFixed(1)}<span className="text-[11px] font-normal text-muted-foreground">({empresa.total_resenas} {empresa.total_resenas===1?"reseña":"reseñas"})</span></p>
                                        <p className="text-[11px] text-muted-foreground">{empresa.pedidos_entregados} {empresa.pedidos_entregados===1?"pedido entregado":"pedidos entregados"} · {empresa.pedidos_en_curso} en curso</p>
                                      </>
                                    ):<span className="text-xs text-muted-foreground">—</span>}
                                  </td>
                                </tr>
                              );})}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    )}
                  {decisionError&&<p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{decisionError}</p>}
                  <div className="space-y-3">{visibleProposals.map(p=>{
                    const contactName=p.contacto_asesor?.nombre||"Asesor de la empresa";
                    const companyName=nombreEmpresa(p);
                    const condiciones=leerCondicionesPropuesta(p.condiciones_adicionales);
                    return(
                      <Card key={p.id} padding="md" className="hover:shadow-md transition-shadow">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-sm">{companyName}</p>
                                <span className={clsx("px-2 py-0.5 rounded text-xs font-medium",p.estado==="aceptada"?"bg-emerald-50 text-emerald-700":p.estado==="rechazada"?"bg-rose-50 text-rose-700":"bg-amber-50 text-amber-700")}>{p.estado}</span>
                                {/* La empresa puede ajustar su propuesta tras enviarla para reflejar
                                    lo negociado por chat. Se avisa de forma visible: lo que se está
                                    comparando ya no es la oferta que llegó. */}
                                {(p.revisiones??0)>0&&(
                                  <span
                                    className="px-2 py-0.5 rounded text-xs font-medium bg-sky-50 text-sky-700"
                                    title={p.fecha_modificacion?`Última modificación: ${new Date(p.fecha_modificacion).toLocaleString("es-CO")}`:undefined}
                                  >
                                    Versión {(p.revisiones??0)+1}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{contactName}</p>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                                <div><p className="text-[10px] text-muted-foreground uppercase">Precio</p><PrecioPropuesta propuesta={p} trm={trm}/></div>
                                <div><p className="text-[10px] text-muted-foreground uppercase">Tiempo</p><p className="text-sm font-semibold">{p.tiempo_estimado_entrega}</p></div>
                                <div><p className="text-[10px] text-muted-foreground uppercase">Incluye</p><p className="text-sm font-semibold">{p.incoterm}</p><p className="text-[11px] text-muted-foreground">{INCOTERM_INCLUYE[(p.incoterm||"").toUpperCase()]??"Según lo acordado"}</p></div>
                                <div><p className="text-[10px] text-muted-foreground uppercase">Cumplimiento</p>{p.empresa?<><p className="text-sm font-semibold flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-500"/>{p.empresa.calificacion_promedio.toFixed(1)}</p><p className="text-[11px] text-muted-foreground">{p.empresa.pedidos_entregados} entregados</p></>:<p className="text-sm font-semibold">—</p>}</div>
                              </div>
                              {(condiciones.descripcion||condiciones.ventajas||condiciones.detalles.length>0)?(
                                <div className="text-xs text-muted-foreground mt-3 leading-relaxed space-y-1">
                                  {condiciones.descripcion&&<p>{condiciones.descripcion}</p>}
                                  {condiciones.ventajas&&<p><span className="font-medium text-foreground">Ventajas:</span> {condiciones.ventajas}</p>}
                                  {condiciones.detalles.length>0&&<p>{condiciones.detalles.join(" · ")}</p>}
                                </div>
                              ):<p className="text-xs text-muted-foreground mt-3">Sin observaciones adicionales.</p>}
                              {(p.revisiones??0)>0&&p.fecha_modificacion&&(
                                <p className="text-[11px] text-sky-700 mt-2">
                                  La empresa modificó esta propuesta el {new Date(p.fecha_modificacion).toLocaleString("es-CO",{dateStyle:"medium",timeStyle:"short"})}
                                  {(p.revisiones??0)>1?` (${p.revisiones} cambios desde que la envió)`:""}.
                                </p>
                              )}
                              {p.estado==="rechazada"&&p.motivo_descarte&&<p className="text-[11px] text-muted-foreground mt-2">Elegiste otra propuesta por: {MOTIVOS_ELECCION.find(m=>m.clave===p.motivo_descarte)?.etiqueta??p.motivo_descarte}</p>}
                            </div>
                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                              {p.estado==="pendiente"&&!hayPropuestaAceptada?(
                                <>
                                  <Button variant="primary" size="sm" onClick={()=>aceptarPropuesta(p)}>Aceptar</Button>
                                  <Button variant="secondary" size="sm" onClick={()=>void handleDecision(p.id,false)}>Rechazar</Button>
                                </>
                              ):(
                                <span className="text-xs text-muted-foreground">Acción registrada</span>
                              )}
                                {relChat && <Button variant="ghost" size="sm" icon={<MessageSquare className="w-3.5 h-3.5"/>} onClick={()=>onOpenChat(relChat.id)}>Ir al chat</Button>}
                            </div>
                          </div>
                        </div>
                      </Card>
                    );})}
                  </div>
                  </>
                )}
              </div>
            </div>
            <div className="w-60 xl:w-64 flex-shrink-0 hidden lg:block space-y-4">
              <Card padding="md"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Línea de tiempo logística</h3><Timeline stages={quoteTimelineStages}/></Card>
              {contactAsesor?<Card padding="md">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Asesor asignado</h3>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-2.5"><Avatar initials={initialsFromName(contactAsesor.nombre||"AS")} size="md"/><div><p className="text-sm font-semibold">{contactAsesor.nombre||"Asesor"}</p><p className="text-xs text-muted-foreground">Contacto de la propuesta</p></div></div>
                  <div className="flex flex-col gap-1.5">
                    <ContactBtn type="chat" size="sm" className="w-full justify-center" onClick={()=>openSmartContact({type:"chat",onOpenChat:()=>{if(relChat)onOpenChat(relChat.id);}})}/>
                  </div>
                </div>
              </Card>:<Card padding="md" className="border-dashed"><div className="py-4 text-center"><p className="text-xs text-muted-foreground">Sin contacto de asesor todavía</p></div></Card>}
              {relChat&&<Card padding="md"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Chat asociado</h3><p className="text-xs text-muted-foreground mb-3">{quote.importer}</p><Button variant="secondary" size="sm" fullWidth icon={<MessageSquare className="w-3.5 h-3.5"/>} onClick={()=>onOpenChat(relChat.id)}>Abrir chat</Button></Card>}
            </div>
          </div>
        </main>
      </div>
      <Modal open={Boolean(eligiendo)} onClose={()=>setEligiendo(null)} title="¿Qué te hizo elegir esta propuesta?">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Elegiste la de <span className="font-medium text-foreground">{eligiendo?nombreEmpresa(eligiendo):""}</span>. Tu respuesta ayuda a las demás empresas a mejorar sus próximas propuestas; no ven quién ganó ni a qué precio.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Motivo de la elección">
            {MOTIVOS_ELECCION.map(m=>(
              <button
                key={m.clave}
                type="button"
                role="radio"
                aria-checked={motivoEleccion===m.clave}
                onClick={()=>setMotivoEleccion(m.clave)}
                className={clsx("rounded-xl border p-3 text-left transition-all",motivoEleccion===m.clave?"border-primary bg-primary/5":"border-border hover:border-primary/40")}
              >
                <p className="text-sm font-semibold">{m.etiqueta}</p>
                <p className="text-xs text-muted-foreground">{m.ayuda}</p>
              </button>
            ))}
          </div>
          <Textarea label="Detalle (opcional)" placeholder="Cuéntanos en una frase" value={motivoDetalle} maxLength={500} onChange={e=>setMotivoDetalle(e.target.value)}/>
          {decisionError&&<p role="alert" className="text-sm text-rose-700">{decisionError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={()=>setEligiendo(null)}>Cancelar</Button>
            <Button variant="primary" disabled={!motivoEleccion} onClick={()=>{void confirmarEleccion();}}>Aceptar propuesta</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE DETAIL — contextual back navigation
// ─────────────────────────────────────────────────────────────────────────────