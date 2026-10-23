import { useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, ClipboardList, FileText, MessageSquare } from "lucide-react";

import { AppHeader } from "@/components/layout/AppHeader";
import { Sidebar } from "@/components/layout/Sidebar";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { Button, Card } from "@/components/design-system";
import type { SidebarCtrl } from "@/types/portal";
import type { Quote } from "@/types/quote";
import { businessService, type BackendPropuesta, type CreatePropuestaPayload } from "@/services/business.service";
import { FormularioPropuesta } from "@/features/propuestas/FormularioPropuesta";
import { leerPropuesta, type FormularioPropuesta as FormularioPropuestaDatos } from "@/features/propuestas/calculo";
import { cantidadConUnidad } from "@/utils/formatos";
import { PerfilPublicoCotizanteCard } from "@/features/cotizante/PerfilPublicoCotizanteCard";
import type { UserRole } from "@/types/roles";

function extractFirstNumber(value: string | null | undefined): number {
  const text = String(value || "");
  const match = text.match(/(-?\d+(?:[.,]\d+)?)/);
  if (!match) {
    return 0;
  }
  const parsed = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed);
}

export function CreateResponseScreen({quoteId,onBack,sb,userRole,quotes,onSubmitted,existingProposal,headerUser,companyName,clientName,chatConversationId,onOpenChat,onEditConditions}:{quoteId:string;onBack:()=>void;sb:SidebarCtrl;userRole:UserRole;quotes:Quote[];onSubmitted?:()=>Promise<void>;existingProposal?:BackendPropuesta|null;headerUser:{name:string;company:string;initials:string};companyName:string;clientName?:string;chatConversationId?:string;onOpenChat?:(conversationId:string)=>void;onEditConditions?:()=>void}) {
  const quote=quotes.find(q=>q.id===quoteId) ?? null;

  // Abrir la solicitud es el "vista" de la bitácora; el backend solo cuenta la primera.
  useEffect(()=>{
    if(!quoteId)return;
    void businessService.markQuoteViewed(quoteId).catch(()=>undefined);
  },[quoteId]);
  const [submitted,setSubmitted]=useState(false);
  const [submittedTitle,setSubmittedTitle]=useState("Propuesta enviada");
  const [directChatId,setDirectChatId]=useState<string|undefined>(chatConversationId);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  // Solo la cuenta dueña envía; el asesor guarda y deja el borrador listo.
  const esBorradorPendienteDeEnvio = userRole==="importadora" && existingProposal?.estado==="borrador";

  // No es lo mismo responder por primera vez que reescribir algo que el
  // comprador ya tiene delante: la pantalla se llamaba "Responder cotización"
  // en los dos casos, y parecía que se podía responder varias veces.
  const esPropuestaYaVista = existingProposal?.estado === "pendiente";
  const revisionesPrevias = existingProposal?.revisiones ?? 0;
  const tituloPantalla = esPropuestaYaVista ? "Editar mi propuesta" : "Nueva propuesta";
  // La propuesta guardada en el formato nuevo se edita tal cual; una del formato
  // anterior (precio en USD y texto libre) se rehace con el formulario.
  const inicial = leerPropuesta(existingProposal?.condiciones_adicionales);
  const esFormatoAnterior = Boolean(existingProposal) && !inicial;
  const textoEnviar = userRole==="asesor" ? "Guardar borrador" : esPropuestaYaVista ? "Enviar versión nueva" : "Enviar propuesta";

  async function submit(formulario:FormularioPropuestaDatos){
    if(!quote){
      setError("No se encontró la cotización seleccionada.");
      return;
    }
    try{
      setSaving(true);
      setError("");
      let directConversationId = directChatId;
      let propuestaId = existingProposal?.id;
      const payload:CreatePropuestaPayload = {cotizacion_id: quote.id, formulario};

      // El borrador lo redacta el asesor y lo envía la cuenta dueña
      // (POST /propuestas/{id}/enviar).
      if(existingProposal?.id){
        await businessService.updateProposal(existingProposal.id, payload);
        if(esBorradorPendienteDeEnvio){
          await businessService.sendProposal(existingProposal.id);
          setSubmittedTitle("Propuesta enviada al comprador");
        }else{
          setSubmittedTitle(userRole==="asesor"?"Borrador actualizado":"Versión nueva enviada");
        }
      }else if(userRole==="asesor"){
        await businessService.createProposalDraft(payload);
        setSubmittedTitle("Borrador guardado");
      }else{
        propuestaId = (await businessService.createProposal(payload)).id;
        setSubmittedTitle("Propuesta enviada");
      }

      // El backend deja la propuesta como tarjeta en el chat (y lo abre si no
      // existía); aquí solo se averigua cuál es para ofrecer "Ir al chat".
      if(userRole==="importadora" && !directConversationId && propuestaId){
        const conversation = await businessService.startNegotiationChat(quote.id, propuestaId).catch(()=>null);
        if(conversation){
          directConversationId = conversation.id;
          setDirectChatId(conversation.id);
        }
      }

      if(onSubmitted){
        await onSubmitted();
      }
      setSubmitted(true);
    }catch(err){
      setError(err instanceof Error ? err.message : "No se pudo enviar la propuesta.");
    }finally{
      setSaving(false);
    }
  }
  const activeNav=userRole==="importadora"?"imp-quotes":"adv-my-quotes";
  if(!quote){
    return (
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar {...sb} active={activeNav}/>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <AppHeader user={headerUser}/>
          <main className="flex-1 flex items-center justify-center p-6">
            <Card padding="lg" className="max-w-md w-full text-center border-dashed">
              <ClipboardList className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3"/>
              <p className="font-semibold">Cotización no disponible</p>
              <p className="text-sm text-muted-foreground mt-1">Sin datos reales de API para responder.</p>
              <Button variant="secondary" className="mt-4" onClick={onBack}>Volver</Button>
            </Card>
          </main>
        </div>
      </div>
    );
  }
  if(submitted)return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active={activeNav}/>
      <div className="flex-1 flex flex-col"><AppHeader user={headerUser}/>
        <div className="flex-1 flex items-center justify-center"><div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-emerald-50 dark:!bg-accent/10 border border-emerald-200 flex items-center justify-center"><CheckCircle2 className="w-7 h-7 text-emerald-500 dark:text-accent"/></div>
          <div>
            <h2 className="text-lg font-semibold">{submittedTitle}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {userRole==="asesor"
                ? `Tu borrador para ${quote.product} quedó guardado. La cuenta de la empresa lo revisa y lo envía.`
                : `El comprador la recibe en el chat de ${quote.product}, con el total en pesos y las condiciones.`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            <Button variant="primary" onClick={onBack}>Volver</Button>
            {(directChatId || chatConversationId) && onOpenChat && <Button variant="secondary" icon={<MessageSquare className="w-3.5 h-3.5"/>} onClick={()=>onOpenChat(directChatId || chatConversationId!)}>Ir al Chat</Button>}
          </div>
        </div></div>
      </div>
    </div>
  );
  const cantidad = Number(String(quote.minQuantity ?? "").replace(",", ".")) || extractFirstNumber(quote.minQuantity) || 0;
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active={activeNav}/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={headerUser}/>
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3 mb-1">
            <Button variant="ghost" size="sm" icon={<ChevronLeft className="w-3.5 h-3.5"/>} onClick={onBack}>Volver</Button>
          </div>
          <Breadcrumb items={[{label:"Cotizaciones",onClick:onBack},{label:tituloPantalla}]}/>
          <h1 className="text-xl font-semibold mt-3 mb-4">{tituloPantalla}</h1>
          {esPropuestaYaVista&&(
            <div className="mb-4 p-3 rounded-lg border border-sky-200 bg-sky-50 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200 flex items-start gap-2">
              <FileText className="w-4 h-4 mt-0.5 flex-shrink-0"/>
              <span>
                No estás respondiendo de nuevo: estás <strong>enviando una versión nueva de tu propuesta</strong>.
                Al cliente le llega como otra tarjeta en el chat y la anterior queda marcada como reemplazada.
                {revisionesPrevias>0&&<> Ya la has cambiado {revisionesPrevias===1?"una vez":`${revisionesPrevias} veces`}.</>}
                {" "}Guardar también anula la aceptación que hubiera de cualquiera de las dos partes.
              </span>
            </div>
          )}
          {esFormatoAnterior&&(
            <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 flex items-start gap-2">
              <FileText className="w-4 h-4 mt-0.5 flex-shrink-0"/>
              <span>Esta propuesta se hizo con el formulario anterior (precio en USD). Llénala de nuevo: al guardarla queda con precio cerrado en pesos.</span>
            </div>
          )}
          {esBorradorPendienteDeEnvio&&(
            <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-900 dark:text-accent dark:!bg-accent/15 flex items-start gap-2">
              <FileText className="w-4 h-4 mt-0.5 flex-shrink-0"/>
              <span>Un asesor de tu empresa ya redactó esta propuesta. Revisa las cifras y pulsa <strong>Enviar propuesta</strong>: hasta entonces el comprador no la ve.</span>
            </div>
          )}
          {userRole==="asesor"&&(
            <div className="mb-4 p-3 rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground flex items-start gap-2">
              <FileText className="w-4 h-4 mt-0.5 flex-shrink-0"/>
              <span>Tu respuesta se guarda como borrador. La cuenta de la empresa es quien la revisa y la envía al comprador.</span>
            </div>
          )}
          <FormularioPropuesta
            cotizacion={{
              codigo: quote.code,
              producto: quote.product,
              cantidad,
              cantidadTexto: cantidadConUnidad(quote.minQuantity, quote.unit),
              cliente: clientName,
              ciudad: quote.deliveryCity,
            }}
            empresa={companyName}
            inicial={inicial}
            textoEnviar={textoEnviar}
            esBorrador={userRole==="asesor"}
            guardando={saving}
            error={error}
            onEnviar={(f)=>{void submit(f);}}
            onCancelar={onBack}
            onEditarCondiciones={userRole==="importadora"?onEditConditions:undefined}
          />
          <div className="mt-6 max-w-xl">
            <PerfilPublicoCotizanteCard solicitanteId={quote.requesterId} />
          </div>
          </div>
        </main>
      </div>
    </div>
  );
}
