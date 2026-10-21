import { Anchor, CheckCircle, ClipboardList, Factory, Navigation2, Scale, Send, Ship, Warehouse } from "lucide-react";
import type { TimelineStage } from "@/types/design-system";

export const ORDER_LIFECYCLE_STEPS=[
  {key:"solicitud_enviada",label:"Solicitud enviada",icon:<Send className="w-3.5 h-3.5"/>},
  {key:"proveedor_respondio",label:"Proveedor respondió",icon:<ClipboardList className="w-3.5 h-3.5"/>},
  {key:"negociacion_en_curso",label:"Negociación en curso",icon:<Scale className="w-3.5 h-3.5"/>},
  {key:"orden_confirmada_produccion",label:"Operación confirmada / Producción",icon:<Factory className="w-3.5 h-3.5"/>},
  {key:"en_transito",label:"En tránsito",icon:<Ship className="w-3.5 h-3.5"/>},
  {key:"en_aduana",label:"En aduana",icon:<Anchor className="w-3.5 h-3.5"/>},
  {key:"en_bodega",label:"En bodega",icon:<Warehouse className="w-3.5 h-3.5"/>},
  {key:"en_ruta",label:"En ruta",icon:<Navigation2 className="w-3.5 h-3.5"/>},
  {key:"entregado",label:"Entregado",icon:<CheckCircle className="w-3.5 h-3.5"/>},
];

// Los estados REALES de una orden en el backend (`EstadoOrden`), en el orden en
// que ocurren. La línea de tiempo de arriba es una vista comercial más detallada
// del ciclo completo (incluye pasos previos a la orden y un "en ruta" que el
// backend no distingue); usar sus claves para escribir era el motivo de que
// actualizar el estado no hiciera nada: el backend las rechazaba por inválidas.
// La orden nace esperando el pago del cliente; pasa a producción cuando la
// empresa confirma el comprobante (ver features/ordenes/PagoOrden.tsx).
export const ORDER_STATES=[
  {key:"cotizacion_aceptada",     label:"Orden generada · pago pendiente"},
  {key:"en_produccion",           label:"Orden en producción"},
  {key:"transito_internacional",  label:"Tránsito internacional"},
  {key:"aduana_nacionalizacion",  label:"Aduana / nacionalización"},
  {key:"bodega_local",            label:"Bodega local"},
  {key:"entregado",               label:"Entregado"},
] as const;

export const ORDER_DOCUMENT_LABELS:Record<string,string>={
  factura_proforma:"Factura proforma",
  factura_comercial:"Factura comercial",
  packing_list:"Packing list",
  comprobante_pago:"Comprobante de pago",
};

export function orderDocumentTypeLabel(tipo:string|undefined|null):string{
  return ORDER_DOCUMENT_LABELS[String(tipo||"")]||"Documento";
}

export function orderStateLabel(key:string|undefined|null):string{
  const found=ORDER_STATES.find((s)=>s.key===String(key||""));
  return found?found.label:(key?String(key):"Sin estado");
}

export function nextOrderState(current:string|undefined|null):{key:string;label:string}|null{
  const index=ORDER_STATES.findIndex((s)=>s.key===String(current||""));
  if(index<0||index>=ORDER_STATES.length-1)return null;
  const next=ORDER_STATES[index+1];
  return {key:next.key,label:next.label};
}

export function inferLifecycleStageIndex(rawState:string|undefined|null):number{
  const normalized=String(rawState||"").trim().toLowerCase();
  if(!normalized)return 0;
  if(normalized.includes("entreg"))return 8;
  if(normalized.includes("ruta"))return 7;
  if(normalized.includes("bodega"))return 6;
  if(normalized.includes("aduan"))return 5;
  if(normalized.includes("transit")||normalized.includes("enviad"))return 4;
  if(normalized.includes("produ")||normalized.includes("orden")||normalized.includes("proceso")||normalized.includes("cotizacion_aceptada")||normalized.includes("cotización aceptada"))return 3;
  if(normalized.includes("negoci"))return 2;
  if(normalized.includes("respond")||normalized.includes("propuesta")||normalized.includes("respuesta"))return 1;
  return 0;
}

export function buildLifecycleTimeline(currentStageIndex:number):TimelineStage[]{
  const bounded=Math.max(0,Math.min(ORDER_LIFECYCLE_STEPS.length-1,currentStageIndex));
  return ORDER_LIFECYCLE_STEPS.map((step,index)=>({
    label:step.label,
    icon:step.icon,
    status:index<bounded?"done":index===bounded?"current":"pending",
  }));
}
