import { useState, useRef } from "react";
import { Eye, CheckCircle2, Loader2, FileText, FolderOpen, Clock, BadgeCheck, Truck, Anchor, Warehouse, Receipt, FileCheck, Download, Boxes, Ship, Factory, PackageCheck, Navigation2, MessageSquare } from "lucide-react";
import { clsx } from "clsx";

import { Breadcrumb } from "@/app/components/navigation/Breadcrumb";

import { PagoOrden } from "@/features/ordenes/PagoOrden";

import { Avatar, Badge, Button, Card, ContactBtn, openSmartContact, Timeline } from "@/app/components/design-system";

// De este archivo ya solo se usan las buenas prácticas por rol: la FAQ vive
// ahora en la base de datos, mantenida por el equipo de soporte.

import { abrirArchivoEnPestana, descargarArchivo } from "@/lib/abrir-archivo";

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

import { Sidebar, AppHeader, USER, formatShortDate, initialsFromName, orderDocumentTypeLabel, orderStateLabel, nextOrderState, inferLifecycleStageIndex, buildLifecycleTimeline } from "@/app/App";

export function OrderDetailScreen({order,onBack,onOpenChat,sb,isLoading,importers,advisorName,onViewImporterProfile,canManageOrder,esCliente=false,onUpdateOrderStatus}:{order:Order|null;onBack:()=>void;onOpenChat:(id:string)=>void;sb:SidebarCtrl;isLoading:boolean;importers:Importer[];advisorName?:string;onViewImporterProfile:(id:string)=>void;canManageOrder:boolean;esCliente?:boolean;onUpdateOrderStatus:(orderId:string,estado:string)=>Promise<void>}) {
  const [isAdvancing,setIsAdvancing]=useState(false);
  // Lo informa la tarjeta «Pago de la orden»: sin pago confirmado no hay producción.
  const [pagoConfirmado,setPagoConfirmado]=useState<boolean|null>(null);
  const [advanceMessage,setAdvanceMessage]=useState("");
  const [advanceError,setAdvanceError]=useState("");
  // Anclas de las tarjetas a las que saltan los botones de la cabecera: la
  // información ya está en esta misma pantalla, solo hay que llevar al
  // usuario hasta ella.
  const documentosRef=useRef<HTMLDivElement|null>(null);
  const seguimientoRef=useRef<HTMLDivElement|null>(null);
  const irA=(ref:React.RefObject<HTMLDivElement|null>)=>ref.current?.scrollIntoView({behavior:"smooth",block:"start"});
  if(isLoading){
    return (
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar {...sb} active="orders"/>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AppHeader user={USER} sb={sb}/>
          <main className="flex-1 overflow-y-auto px-6 py-6"><Card padding="lg" className="border-dashed"><div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin"/>Cargando detalle de la operación...</div></Card></main>
        </div>
      </div>
    );
  }

  if(!order){
    return (
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar {...sb} active="orders"/>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AppHeader user={USER} sb={sb}/>
          <main className="flex-1 overflow-y-auto px-6 py-6"><Card padding="lg" className="border-dashed"><p className="text-sm text-muted-foreground text-center">Operación no disponible.</p></Card></main>
        </div>
      </div>
    );
  }

  const imp=importers.find(i=>i.id===order.importerId);
  const resolvedAdvisorName = order.advisorName || advisorName;
  const advisor=resolvedAdvisorName
    ? {...(imp?.advisor || {initials: initialsFromName(resolvedAdvisorName), color: "bg-slate-500", role: "Asesor", email: ""}), name: resolvedAdvisorName}
    : imp?.advisor;
  const relChatId = order.conversationId;
  const history = order.history;
  const documents = order.documents;

  const mapOrderStateIcon = (state: string) => {
    const normalized = String(state || "").toLowerCase();
    if (normalized.includes("produ")) return <Factory className="w-3.5 h-3.5"/>;
    if (normalized.includes("inspec")) return <PackageCheck className="w-3.5 h-3.5"/>;
    if (normalized.includes("carg")) return <Boxes className="w-3.5 h-3.5"/>;
    if (normalized.includes("transit") || normalized.includes("envio")) return <Ship className="w-3.5 h-3.5"/>;
    if (normalized.includes("aduan")) return <Anchor className="w-3.5 h-3.5"/>;
    if (normalized.includes("bodega")) return <Warehouse className="w-3.5 h-3.5"/>;
    if (normalized.includes("entrega")) return <Navigation2 className="w-3.5 h-3.5"/>;
    return <CheckCircle2 className="w-3.5 h-3.5"/>;
  };

  const timelineStages: TimelineStage[] = buildLifecycleTimeline(
    inferLifecycleStageIndex(order.status || history[history.length - 1]?.estado),
  );

  const siguienteEstadoOrden = nextOrderState(order.status);
  const esperaPago = order.status==="cotizacion_aceptada"&&pagoConfirmado!==true;

  async function avanzarEstado(){
    if(!order||!siguienteEstadoOrden)return;
    setAdvanceMessage("");
    setAdvanceError("");
    setIsAdvancing(true);
    try{
      await onUpdateOrderStatus(order.id, siguienteEstadoOrden.key);
      setAdvanceMessage(`Operación marcada como «${siguienteEstadoOrden.label}».`);
    }catch(error){
      setAdvanceError(error instanceof Error&&error.message.trim()?error.message:"No se pudo actualizar el estado.");
    }finally{
      setIsAdvancing(false);
    }
  }

  const historyEvents = history.length > 0
    ? history
    : [{ estado: order.status || "Sin estado", fecha: new Date().toISOString(), nota: null }];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="orders"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <Breadcrumb items={[{label:"Inicio",onClick:onBack},{label:"Operaciones",onClick:onBack},{label:order.code}]}/>
          <Card padding="md" className="mt-4 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 flex-wrap"><span className="font-mono text-lg font-semibold">{order.code}</span><Badge variant="active-order"/></div>
                <div className="flex gap-6 flex-wrap">{[["Empresa",imp?.name || "Empresa importadora"],["Asesor",advisor?.name || "Asesor"],["Creada",order.created],["Entrega estimada",order.estimated]].map(([k,v])=><div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="text-sm font-medium">{v}</p></div>)}</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <ContactBtn type="chat" label="Contactar asesor" onClick={()=>openSmartContact({type:"chat",onOpenChat:()=>{if(relChatId)onOpenChat(relChatId);}})}/>
                <Button variant="secondary" size="sm" icon={<FolderOpen className="w-3.5 h-3.5"/>} onClick={()=>irA(documentosRef)}>Ver documentos</Button>
                {relChatId&&<Button variant="secondary" size="sm" icon={<MessageSquare className="w-3.5 h-3.5"/>} onClick={()=>onOpenChat(relChatId)}>Chat</Button>}
                <Button variant="primary" size="sm" icon={<Navigation2 className="w-3.5 h-3.5"/>} onClick={()=>irA(seguimientoRef)}>Ver seguimiento</Button>
              </div>
            </div>
          </Card>
          <div className="flex gap-5 items-start">
            <div className="flex-1 min-w-0 space-y-5">
              <Card padding="md"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Receipt className="w-4 h-4 text-primary dark:text-accent"/>Resumen comercial</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">{[["Producto",order.product],["Cantidad",order.quantity],["Precio final",order.unitPrice],["Incoterm",order.incoterm],["Shipping mark",order.shippingMark||"Sin marca"],["Puerto de origen",order.originPort],["Puerto de destino",order.destPort],["Valor total",order.totalValue]].map(([k,v])=>(
                  <div key={k} className={k==="Puerto de origen"||k==="Puerto de destino"||k==="Producto"?"col-span-2 sm:col-span-1":""}><p className="text-xs text-muted-foreground">{k}</p><p className={clsx("text-sm font-medium mt-0.5",k==="Valor total"&&"text-primary dark:text-accent font-semibold")}>{v}</p></div>
                ))}</div>
                <div className="mt-4 pt-3 border-t border-border flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-muted-foreground"/><span className="text-xs text-muted-foreground">Cotización origen:</span><span className="text-xs font-mono font-medium">{order.quoteCode}</span></div>
              </Card>
              <PagoOrden ordenId={order.id} esCliente={esCliente} onPagoConfirmado={setPagoConfirmado}/>
              <div ref={seguimientoRef}>
                <Card padding="md">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
                    <h3 className="text-sm font-semibold flex items-center gap-2"><Truck className="w-4 h-4 text-primary dark:text-accent"/>Estado logístico</h3>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/10 dark:bg-accent/10 text-primary dark:text-accent">{orderStateLabel(order.status)}</span>
                  </div>
                  <Timeline stages={timelineStages}/>
                  {/* La empresa y el asesor asignado mueven el embarque desde
                      aquí; antes solo se podía desde el panel del chat. */}
                  {canManageOrder&&(
                    <div className="mt-5 pt-4 border-t border-border">
                      {siguienteEstadoOrden?(
                        <div className="flex items-center gap-3 flex-wrap">
                          <Button variant="primary" size="sm" loading={isAdvancing} disabled={esperaPago}
                            onClick={()=>{void avanzarEstado();}}>
                            Marcar «{siguienteEstadoOrden.label}»
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            {esperaPago
                              ?"Primero confirma el pago del cliente en «Pago de la orden»."
                              :"El cliente lo verá en el chat de seguimiento y recibirá el aviso."}
                          </p>
                        </div>
                      ):(
                        <p className="text-xs text-muted-foreground">
                          {order.status==="entregado"?"La operación está entregada: no hay más pasos.":"Sin siguiente estado disponible."}
                        </p>
                      )}
                      {advanceMessage&&<p className="text-xs text-emerald-600 mt-2">{advanceMessage}</p>}
                      {advanceError&&<p className="text-xs text-destructive mt-2">{advanceError}</p>}
                    </div>
                  )}
                </Card>
              </div>
              <Card padding="none">
                <div ref={documentosRef} className="px-5 py-3.5 border-b border-border flex items-center justify-between"><h3 className="text-sm font-semibold flex items-center gap-2"><FolderOpen className="w-4 h-4 text-primary dark:text-accent"/>Documentos</h3><span className="text-xs text-muted-foreground">{documents.filter(d=>d.status==="Disponible").length} disponibles</span></div>
                <div className="divide-y divide-border/60">{documents.map(doc=>(
                  <div key={doc.name} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3"><FileCheck className={clsx("w-4 h-4 flex-shrink-0",doc.status==="Disponible"?"text-primary":"text-muted-foreground/40")}/><div><p className="text-sm font-medium">{doc.name}</p><p className="text-xs text-muted-foreground">{doc.date||orderDocumentTypeLabel(doc.type)}</p></div></div>
                    <div className="flex items-center gap-2">
                      <span className={clsx("text-xs font-medium px-2 py-0.5 rounded",doc.status==="Disponible"?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-500")}>{doc.status}</span>
                      {doc.status==="Disponible"&&<><Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5"/>} className="text-xs" onClick={()=>{void abrirArchivoEnPestana(doc.url);}}>Ver</Button><Button variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5"/>} className="text-xs" onClick={()=>{void descargarArchivo(doc.url, doc.name);}}>Descargar</Button></>}
                    </div>
                  </div>
                ))}</div>
                {documents.length===0&&<div className="py-10 text-center text-sm text-muted-foreground">No hay documentos adjuntos para esta operación.</div>}
              </Card>
              <Card padding="md"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-primary dark:text-accent"/>Historial de eventos</h3>
                <div className="relative"><div className="absolute left-3 top-3 bottom-3 w-0.5 bg-border"/>
                  <div className="space-y-1">{historyEvents.map((ev,i)=>{
                    // Los eventos guardan el estado real de la orden
                    // (`en_produccion`), no las claves de la línea comercial.
                    const label=orderStateLabel(ev.estado);
                    return (
                    <div key={`${ev.estado}-${ev.fecha}-${i}`} className="flex items-start gap-3"><div className="w-6 h-6 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center flex-shrink-0 z-10 text-primary">{mapOrderStateIcon(ev.estado)}</div><div className="pb-4 flex-1"><div className="flex items-center justify-between"><p className="text-sm">{label}</p><p className="text-xs text-muted-foreground">{formatShortDate(ev.fecha)}</p></div>{ev.nota&&<p className="text-xs text-muted-foreground mt-1">{ev.nota}</p>}</div></div>
                    );
                  })}</div>
                </div>
              </Card>
            </div>
            <div className="w-64 flex-shrink-0 hidden lg:block space-y-4">
              <Card padding="md"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Empresa importadora</h3>
                <div className="flex items-start gap-3 mb-4"><Avatar initials={imp?.initials || "NA"} size="xl" color={imp?.color || "bg-slate-500"}/><div><div className="flex items-start gap-1"><p className="font-semibold text-sm">{imp?.name || "Empresa importadora"}</p>{imp?.verified&&<BadgeCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5"/>}</div><p className="text-xs text-muted-foreground mt-0.5">{imp?.specialty || "Sin especialidad"}</p></div></div>
                <div className="space-y-1.5 pt-3 border-t border-border mb-3">{[["Años en plataforma","5+"],["Proyectos",imp?.projects?.toString() || "N/D"],["Resp. prom.",imp?.responseTime || "N/D"]].map(([k,v])=><div key={k} className="flex justify-between"><span className="text-xs text-muted-foreground">{k}</span><span className="text-xs font-medium">{v}</span></div>)}</div>
                <Button variant="secondary" size="sm" fullWidth disabled={!imp?.id} onClick={()=>imp?.id&&onViewImporterProfile(imp.id)}>Ver perfil</Button>
              </Card>
              <Card padding="md"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Asesor</h3>
                <div className="flex items-start gap-2.5 mb-3"><Avatar initials={advisor?.initials || "AS"} size="lg" color={advisor?.color || "bg-slate-500"}/><div><p className="font-semibold text-sm">{advisor?.name || "Asesor"}</p><p className="text-xs text-muted-foreground mt-0.5">{advisor?.role || "Asesor"}</p></div></div>
                <div className="flex gap-1.5">
                  <ContactBtn type="chat" size="sm" className="flex-1 justify-center" onClick={()=>openSmartContact({type:"chat",onOpenChat:()=>{if(relChatId)onOpenChat(relChatId);}})}/>
                  <ContactBtn type="email" label="Email" size="sm" className="flex-1 justify-center" onClick={()=>openSmartContact({type:"email",email:advisor?.email,onOpenChat:()=>{if(relChatId)onOpenChat(relChatId);}})}/>
                </div>
              </Card>
              <Card padding="md" className="border-purple-100 bg-purple-50/40"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Estado actual</h3><div className="flex items-center gap-2 mb-1"><div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"/><span className="text-sm font-semibold text-purple-700">{order.status ? orderStateLabel(order.status) : "En seguimiento"}</span></div><p className="text-xs text-muted-foreground">Última actualización: {history.length>0?formatShortDate(history[history.length-1].fecha):"Reciente"}</p></Card>
              {relChatId&&<Card padding="md"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Chat de esta operación</h3><p className="text-xs text-muted-foreground mb-3">Abrir conversación asociada a la operación.</p><Button variant="secondary" size="sm" fullWidth icon={<MessageSquare className="w-3.5 h-3.5"/>} onClick={()=>onOpenChat(relChatId)}>Abrir chat</Button></Card>}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHATS SCREEN
// ─────────────────────────────────────────────────────────────────────────────