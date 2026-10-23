import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { toast } from "sonner";
import { ArrowUpDown, AtSign, Bell, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Copy, Download, Edit2, ExternalLink, File as FileIcon, FileCheck, FileSpreadsheet, FileText, FolderOpen, FolderTree, Image as ImageIcon, LayoutGrid, LifeBuoy, Loader2, LockKeyhole, MessageCircle, MessageSquare, MoreHorizontal, MoveRight, Paperclip, PanelRightClose, PanelRightOpen, Plus, RotateCcw, Save, Search, Send, ShoppingCart, Smile, Star, Trash2, Upload, Users, Video, X } from "lucide-react";
import { Avatar, BADGE_MAP, Badge, Button, Card, ContactBtn, Input, Select, Textarea, Timeline } from "@/components/design-system";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { AppHeader, USER, USER_IMPORTADORA, USER_ASESOR } from "@/components/layout/AppHeader";
import { FormatFileIcon } from "@/components/files/FormatFileIcon";
import { Modal } from "@/components/ui/Modal";
import { Sidebar } from "@/components/layout/Sidebar";
import type { SidebarCtrl } from "@/types/portal";
import type { UserRole } from "@/types/roles";
import type { ChatConv, ChatMsg, MsgFile, MsgFileType } from "@/types/chat";
import type { Order } from "@/types/order";
import {
  initialsFromName,
  importerColorFromId,
} from "@/utils/profile";
import { nextOrderState, orderStateLabel } from "@/features/ordenes/constants";
import { normalizeFolderName } from "@/utils/folders";
import type { CompanyAdvisor } from "@/types/portal";
import type { Importer } from "@/types/importer";
import type { BackendArchivoItem, BackendChatAttachmentItem, BackendExplorerResponse, BackendMiembroEquipo, BackendOrder } from "@/services/business.service";
import { getStoredToken, resolveApiUrl, toApiPath } from "@/services/api-client";
import { abrirArchivoEnPestana } from "@/utils/abrir-archivo";
import { formatChatTime } from "@/utils/date";
import { TarjetaPropuestaChat, type PropuestaEnMensaje } from "@/features/propuestas/TarjetaPropuestaChat";
import { leerPropuesta } from "@/features/propuestas/calculo";
import { TierBadge } from "@/features/cotizante/TierBadge";
import { URGENCIA_SOPORTE } from "@/features/help/SoporteModal";
function FileAttachmentBubble({file}:{file:MsgFile}) {
  const icons:Record<MsgFileType,{icon:React.ReactNode;bg:string;label:string}> = {
    pdf:   {icon:<FileIcon className="w-4 h-4 text-red-600"/>,   bg:"bg-red-50 border-red-100",   label:"PDF"},
    excel: {icon:<FileSpreadsheet className="w-4 h-4 text-emerald-600"/>, bg:"bg-emerald-50 border-emerald-100", label:"Excel"},
    word:  {icon:<FileText className="w-4 h-4 text-blue-600"/>,  bg:"bg-blue-50 border-blue-100",  label:"Word"},
    image: {icon:<ImageIcon className="w-4 h-4 text-purple-600"/>,bg:"bg-purple-50 border-purple-100",label:"Imagen"},
  };
  const cfg=icons[file.type];
  return (
    <div className={clsx("flex items-center gap-2.5 px-3 py-2 rounded-lg border max-w-[220px]",cfg.bg)}>
      <div className="w-8 h-8 rounded-md bg-white flex items-center justify-center flex-shrink-0 shadow-sm">{cfg.icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
        <p className="text-[10px] text-muted-foreground">{cfg.label} · {file.size}</p>
      </div>
    </div>
  );
}

/** Cómo se llama en pantalla cada rol cuando es la contraparte de un chat. */
const ETIQUETA_ROL_CONTRAPARTE: Record<string, string> = {
  solicitante: "Cliente",
  importador: "Empresa importadora",
  asesor: "Asesor de la empresa",
  admin: "Equipo Zarpi",
  soporte: "Mesa de ayuda",
  plataforma: "Mesa de ayuda",
};

/** Etiqueta legible de un rol; devuelve el valor crudo si no se conoce. */
function etiquetaDeRol(rol:string|undefined|null):string{
  const clave=String(rol ?? "").trim();
  if(!clave)return "";
  return ETIQUETA_ROL_CONTRAPARTE[clave]||clave;
}

/**
 * Con quién se está hablando en una conversación, para pintarlo en pantalla.
 *
 * La cabecera del chat mostraba siempre el texto «Asesor asignado» y las
 * iniciales de la empresa importadora, daba igual el rol de quien mirara: un
 * asesor no distinguía a un cliente de otro, el cliente no sabía qué persona de
 * la empresa le escribía, y desde la mesa de ayuda todos los tickets parecían
 * el mismo. El backend ya resuelve la contraparte según quién consulta
 * (`contraparte_*`); aquí solo se le da forma.
 */
function resolverContraparteChat(conv:ChatConv|null,imp:Importer|null){
  const nombre = conv?.counterpartName
    || (conv?.type==="interno" ? "Equipo" : "")
    || imp?.name
    || "Conversación";
  const etiquetaRol = conv?.counterpartRole
    ? (ETIQUETA_ROL_CONTRAPARTE[conv.counterpartRole] || conv.counterpartRole)
    : "";
  // La empresa solo aporta contexto cuando no es ya el propio interlocutor.
  const empresa = conv?.counterpartCompany && conv.counterpartCompany!==nombre
    ? conv.counterpartCompany
    : "";
  return {
    nombre,
    etiquetaRol,
    empresa,
    iniciales: initialsFromName(nombre),
    // Color estable por PERSONA, no por conversación: si dependiera del id del
    // hilo, el mismo interlocutor (soporte, por ejemplo) saldría de un color
    // distinto en cada chat y el avatar dejaría de servir para reconocerlo.
    color: importerColorFromId(conv?.counterpartId || nombre || imp?.id || "chat"),
    fotoUrl: conv?.counterpartPhotoUrl
      ? resolveApiUrl(conv.counterpartPhotoUrl)
      : imp?.logoUrl
        ? resolveApiUrl(imp.logoUrl)
        : "",
  };
}

function puedeVerTierDeContraparte(currentUserRole: UserRole | "admin", counterpartRole: string | undefined, tier: string | undefined): boolean {
  const rolContraparte = String(counterpartRole || "").trim().toLowerCase();
  const esCotizante = rolContraparte === "cotizante" || rolContraparte === "solicitante";
  const esRolAutorizado = currentUserRole === "asesor" || currentUserRole === "importadora" || currentUserRole === "admin";
  return Boolean(tier) && esCotizante && esRolAutorizado;
}

export function ChatsScreen({modoEquipo=false,miembrosEquipo=[],onAbrirHiloEquipo,onViewQuote,onViewOrder,sb,initialConvId,conversations,messagesByConversation,onSendMessage,onOpenProposalForm,proposalStateByQuoteId={},onShareLocalAttachment,onShareExistingResource,onTransferConversation,onUpdateOrderStatus,onAttachOrderDocument,onActiveConversationChange,onCloseTicket,onReopenTicket,onEscalateTicket,onRateTicket,companyAdvisors=[],currentUserRole,chatAttachmentsByConversation,orders,quotes,importers,onLoadResourceFolder,userPhotoUrl}:{modoEquipo?:boolean;miembrosEquipo?:BackendMiembroEquipo[];onAbrirHiloEquipo?:(miembroId:string)=>Promise<string|undefined>;onViewQuote:(id:string)=>void;onViewOrder:(id:string)=>void;sb:SidebarCtrl;initialConvId?:string;conversations:ChatConv[];messagesByConversation:Record<string,ChatMsg[]>;onSendMessage:(conversationId:string,contenido:string,metadata?:Record<string,unknown>)=>Promise<void>;onOpenProposalForm?:(quoteId:string)=>void;proposalStateByQuoteId?:Record<string,string>;onShareLocalAttachment:(conversationId:string,file:File)=>Promise<void>;onShareExistingResource:(conversationIds:string[],fileId:string,message?:string)=>Promise<void>;onTransferConversation:(conversationId:string,newAdvisorEmail:string)=>Promise<void>;onUpdateOrderStatus:(orderId:string,statusValue:string)=>Promise<void>;onAttachOrderDocument:(orderId:string,file:File)=>Promise<void>;onActiveConversationChange?:(conversationId:string|null)=>void;onCloseTicket:(conversationId:string,resolucion:string)=>Promise<void>;onReopenTicket:(conversationId:string)=>Promise<void>;onEscalateTicket:(conversationId:string,nivel:number)=>Promise<void>;onRateTicket:(conversationId:string,calificacion:number,comentario?:string)=>Promise<void>;companyAdvisors?:CompanyAdvisor[];currentUserRole:UserRole|"admin";chatAttachmentsByConversation:Record<string,BackendChatAttachmentItem[]>;orders:Order[];quotes:Quote[];importers:Importer[];onLoadResourceFolder?:(parentId:string|null)=>Promise<BackendExplorerResponse>;userPhotoUrl?:string}) {
  const [selectedId,setSelectedId]=useState<string|null>(initialConvId||conversations[0]?.id||null);
  // El equipo de la plataforma filtra por urgencia; los demás, por el tipo de
  // hilo. Por eso el filtro es una cadena libre y no una unión cerrada.
  const [filter,setFilter]=useState<string>("all");
  const [searchConv,setSearchConv]=useState("");
  // Persona del equipo cuyo hilo privado se está creando.
  const [abriendoHilo,setAbriendoHilo]=useState("");
  const [msgs,setMsgs]=useState<Record<string,ChatMsg[]>>(messagesByConversation);
  const [input,setInput]=useState("");
  const [sending,setSending]=useState(false);
  const [showCtx,setShowCtx]=useState(true);
  const [showEmojiMenu,setShowEmojiMenu]=useState(false);
  const inputRef=useRef<HTMLTextAreaElement>(null);
  const [transferTo,setTransferTo]=useState("");
  const [isTransferring,setIsTransferring]=useState(false);
  const [transferMessage,setTransferMessage]=useState("");
  const [transferError,setTransferError]=useState("");
  const [isUpdatingOrderStatus,setIsUpdatingOrderStatus]=useState(false);
  const [isAttachingOrderDoc,setIsAttachingOrderDoc]=useState(false);
  const [orderActionMessage,setOrderActionMessage]=useState("");
  // Sin esto, un 400/403 del backend se perdía y la pantalla se quedaba igual
  // sin decir nada: parecía que el botón no hacía nada.
  const [orderActionError,setOrderActionError]=useState("");
  const [resolucionTicket,setResolucionTicket]=useState("");
  const [cerrandoTicket,setCerrandoTicket]=useState(false);
  const [errorTicket,setErrorTicket]=useState("");
  const [notaSoporte,setNotaSoporte]=useState(0);
  const [comentarioNota,setComentarioNota]=useState("");
  const [previewAttachment,setPreviewAttachment]=useState<BackendChatAttachmentItem|null>(null);
  const [pendingLocalAttachment,setPendingLocalAttachment]=useState<{file:File;url:string}|null>(null);
  const [pendingResource,setPendingResource]=useState<BackendArchivoItem|null>(null);
  // La descarga del backend exige Authorization, así que un <img>/<iframe>/<video>
  // apuntando directo a la URL devolvería 401: se resuelve a un blob autenticado.
  const [previewObjectUrl,setPreviewObjectUrl]=useState("");
  const [previewLoadFailed,setPreviewLoadFailed]=useState(false);
  const [attachmentThumbUrls,setAttachmentThumbUrls]=useState<Record<string,string>>({});
  const [isResourcePickerOpen,setIsResourcePickerOpen]=useState(false);
  const [resourceExplorer,setResourceExplorer]=useState<BackendExplorerResponse>({ carpetas: [], archivos: [] });
  const [resourceCurrentFolderId,setResourceCurrentFolderId]=useState<string|null>(null);
  const [resourceFolderTrail,setResourceFolderTrail]=useState<Array<{id:string|null;name:string}>>([{ id: null, name: "Raiz" }]);
  const [resourceLoading,setResourceLoading]=useState(false);
  const [resourceSearch,setResourceSearch]=useState("");
  const [resourceSearching,setResourceSearching]=useState(false);
  const [resourceUploading,setResourceUploading]=useState(false);
  const [resourceDropOver,setResourceDropOver]=useState(false);
  const [resourceSearchResults,setResourceSearchResults]=useState<{
    files: BackendArchivoItem[];
    folders: BackendExplorerResponse["carpetas"];
  }|null>(null);
  const [resourceTargetConversationId,setResourceTargetConversationId]=useState("");
  const [resourceViewMode,setResourceViewMode]=useState<"grid"|"list">("grid");
  const [resourcePreviewUrls,setResourcePreviewUrls]=useState<Record<string,string>>({});
  const fileInputRef=useRef<HTMLInputElement>(null);
  const imageInputRef=useRef<HTMLInputElement>(null);
  const resourceUploadInputRef=useRef<HTMLInputElement>(null);
  const orderDocumentInputRef=useRef<HTMLInputElement>(null);
  const messagesEndRef=useRef<HTMLDivElement>(null);
  const resourcePreviewLoadingRef=useRef<Record<string,boolean>>({});
  const resourcePreviewRegistryRef=useRef<Record<string,string>>({});
  const attachmentThumbLoadingRef=useRef<Record<string,boolean>>({});
  const attachmentThumbRegistryRef=useRef<Record<string,string>>({});
  const emojiOptions = [
    "😀",
    "😎",
    "👍",
    "✅",
    "📦",
    "🚢",
    "💬",
    "📌",
    "🎯",
    "🤝",
    "🙏",
    "🔥",
  ];

  useEffect(()=>{
    setMsgs(messagesByConversation);
  },[messagesByConversation]);

  // Informa al contenedor qué conversación está abierta, para que abra el
  // WebSocket solo de esa y la desconecte al salir de la pantalla.
  useEffect(()=>{
    onActiveConversationChange?.(selectedId);
    return ()=>{ onActiveConversationChange?.(null); };
  },[selectedId,onActiveConversationChange]);

  useEffect(()=>{
    if (!selectedId && conversations.length > 0) {
      setSelectedId(initialConvId || conversations[0].id);
    }
  }, [selectedId, conversations, initialConvId]);

  // Si desde fuera se pide abrir otra conversación (p. ej. un hilo privado del
  // equipo recién creado) estando ya en esta pantalla, se cambia a ella. Antes
  // la pantalla no se volvía a montar y seguía en el chat anterior.
  useEffect(()=>{
    if(initialConvId) setSelectedId(initialConvId);
  },[initialConvId]);

  useEffect(() => {
    if (selectedId) {
      setResourceTargetConversationId(selectedId);
    }
  }, [selectedId]);

  const conv=selectedId?conversations.find(c=>c.id===selectedId)||null:null;
  const imp=conv?importers.find(i=>i.id===conv.importerId)||null:null;
  const chatCompanyName = conv?.importerName || imp?.name || "Empresa importadora";
  // Con quién se habla de verdad. Antes la cabecera usaba `chatAdvisorName`,
  // que para casi todas las empresas es el literal «Asesor asignado».
  const contraparte = resolverContraparteChat(conv, imp);
  const mostrarTierContraparte = conv ? puedeVerTierDeContraparte(currentUserRole, conv.counterpartRole, conv.cotizanteTier) : false;
  const chatAdvisorName = conv?.advisorName || imp?.advisor.name || "Asesor";
  const chatAdvisorRole = conv?.advisorRole || imp?.advisor.role || "Asesor";
  const chatAdvisorEmail = conv?.advisorEmail || imp?.advisor.email || "";
  const chatAdvisorInitials = conv?.advisorInitials || imp?.advisor.initials || "AS";
  const chatAdvisorColor = conv?.advisorColor || imp?.advisor.color || "bg-slate-500";

  const filteredConvs=conversations.filter(c=>{
    // Los chats de los asesores no se mezclan con los propios: van en su
    // pestaña, agrupados por asesor. La pestaña sigue siendo un filtro
    // específico, pero sus conversaciones también deben aparecer en "Todas":
    // el contador global se calcula sobre todos los hilos cargados.
    if(filter==="asesores")return Boolean(c.atiendeNombre)&&(!searchConv||[c.atiendeNombre,c.refCode,c.counterpartName||""].some(t=>t.toLowerCase().includes(searchConv.toLowerCase())));
    if(filter==="ordenes"&&c.type!=="orden")return false;
    if(filter==="cotizaciones"&&c.type!=="cotizacion")return false;
    if(filter==="interno"&&c.type!=="interno")return false;
    if(filter==="soporte"&&c.type!=="soporte")return false;
    if(filter.startsWith("urg-")&&c.urgency!==filter.slice(4))return false;
    if(filter==="no-leidas"&&c.unread===0)return false;
    // Un ticket cerrado solo aparece si se pide expresamente: si no, la bandeja
    // de pendientes se llenaría de casos ya atendidos.
    if(filter==="cerrados"&&!c.closed)return false;
    if(filter!=="cerrados"&&c.closed)return false;
    if(searchConv){
      const cImp=importers.find(i=>i.id===c.importerId);
      const q=c.type==="cotizacion"?quotes.find((quote)=>quote.id===c.refId):null;
      const ord=c.type==="orden"?orders.find((order)=>order.id===c.refId):null;
      const terms=[c.refCode,c.subject||"",c.counterpartName||"",c.importerName||cImp?.name||"",c.advisorName||cImp?.advisor.name||"",q?.product||"",ord?.product||""];
      if(!terms.some(t=>t.toLowerCase().includes(searchConv.toLowerCase())))return false;
    }
    return true;
  });

  const convsEnLista=filter==="asesores"
    ?[...filteredConvs].sort((a,b)=>(a.atiendeNombre||"").localeCompare(b.atiendeNombre||""))
    :filteredConvs;

  /**
   * Canal del equipo: la sala común y, debajo, cada persona del equipo. Elegir
   * a alguien abre su hilo privado (o lo crea). Antes había un desplegable que
   * creaba el hilo pero dejaba la pantalla en la conversación anterior, y los
   * hilos salían en la lista sin decir con quién eran.
   */
  function renderListaEquipo(){
    const q=searchConv.trim().toLowerCase();
    const rolEquipo=(rol:string,nivel?:number|null)=>rol==="soporte"?`Soporte N${nivel ? 1 : 0}`:rol==="designer"?"Diseño":"Administración";
    const salas=conversations.filter(c=>c.counterpartRole==="plataforma");
    const hiloDe=(id:string)=>conversations.find(c=>c.counterpartId===id&&c.counterpartRole!=="plataforma");
    const soloNoLeidas=filter==="no-leidas";
    const personas=miembrosEquipo
      .filter(m=>!q||[m.nombre||"",m.email,rolEquipo(m.rol,m.nivel_soporte)].some(t=>t.toLowerCase().includes(q)))
      .filter(m=>!soloNoLeidas||(hiloDe(m.id)?.unread||0)>0);
    // Hilos con alguien que ya no está en el equipo (desactivado): se conservan.
    const huerfanos=conversations.filter(c=>c.counterpartRole!=="plataforma"&&!miembrosEquipo.some(m=>m.id===c.counterpartId))
      .filter(c=>(!q||(c.counterpartName||"").toLowerCase().includes(q))&&(!soloNoLeidas||c.unread>0));
    const fila=(clave:string,{nombre,detalle,colorId,activo,unread,ultimo,onClick,cargando}:{nombre:string;detalle:string;colorId:string;activo:boolean;unread:number;ultimo?:string;onClick:()=>void;cargando?:boolean})=>(
      <button key={clave} onClick={onClick} disabled={cargando}
        className={clsx("w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors flex gap-2.5 items-center",
          activo?"bg-primary/5 border-l-2 border-l-primary":"hover:bg-muted/50")}>
        <Avatar initials={initialsFromName(nombre)} size="md" color={importerColorFromId(colorId)}/>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className={clsx("text-xs font-semibold truncate",activo?"text-primary":"text-foreground")}>{nombre}</p>
            {unread>0&&<span className="w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">{unread}</span>}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{detalle}</p>
          <p className="text-[11px] text-muted-foreground/80 truncate">{cargando?"Abriendo...":ultimo||"Escribirle en privado"}</p>
        </div>
      </button>
    );
    return (
      <>
        {salas.map(c=>fila(c.id,{nombre:"Sala del equipo",detalle:"Todo el equipo",colorId:"sala-equipo",activo:selectedId===c.id,unread:c.unread,ultimo:c.lastMsg,onClick:()=>setSelectedId(c.id)}))}
        <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Personas del equipo</p>
        {personas.length===0&&huerfanos.length===0&&(
          <p className="px-3 py-4 text-xs text-muted-foreground">{q||soloNoLeidas?"Nadie coincide.":"No hay más personas en el equipo."}</p>
        )}
        {personas.map(m=>{
          const hilo=hiloDe(m.id);
          return fila(m.id,{
            nombre:m.nombre||m.email,
            detalle:rolEquipo(m.rol,m.nivel_soporte),
            colorId:m.id,
            activo:Boolean(hilo&&selectedId===hilo.id),
            unread:hilo?.unread||0,
            ultimo:hilo?hilo.lastMsg:undefined,
            cargando:abriendoHilo===m.id,
            onClick:()=>{
              if(hilo){setSelectedId(hilo.id);return;}
              if(!onAbrirHiloEquipo)return;
              setAbriendoHilo(m.id);
              void onAbrirHiloEquipo(m.id).then(id=>{if(id)setSelectedId(id);}).finally(()=>setAbriendoHilo(""));
            },
          });
        })}
        {huerfanos.map(c=>fila(c.id,{nombre:c.counterpartName||"Hilo privado",detalle:"Ya no está en el equipo",colorId:c.counterpartId||c.id,activo:selectedId===c.id,unread:c.unread,ultimo:c.lastMsg,onClick:()=>setSelectedId(c.id)}))}
      </>
    );
  }

  async function sendMsg(){
    if(!input.trim()||!selectedId)return;
    const content = input.trim();
    const newMsg:ChatMsg={id:`pending-${Date.now()}`,sender:"client",text:content,time:formatChatTime(new Date().toISOString()),read:true};
    setMsgs(prev=>({...prev,[selectedId]:[...(prev[selectedId]||[]),newMsg]}));
    setInput("");
    setSending(true);
    try{
      await onSendMessage(selectedId,content);
    }finally{
      setSending(false);
    }
    setTimeout(()=>messagesEndRef.current?.scrollIntoView({behavior:"smooth"}),50);
  }

  function getReadableFileSize(bytes:number):string{
    if(bytes<=0)return "0 B";
    if(bytes<1024)return `${bytes} B`;
    const kb=bytes/1024;
    if(kb<1024)return `${kb.toFixed(1)} KB`;
    const mb=kb/1024;
    return `${mb.toFixed(1)} MB`;
  }

  function mapFileType(file:File):MsgFileType{
    if(file.type.startsWith("image/"))return "image";
    if(file.type.includes("pdf"))return "pdf";
    if(file.type.includes("sheet")||file.type.includes("excel")||/\.(xlsx|xls|csv)$/i.test(file.name))return "excel";
    return "word";
  }

  function previewType(attachment: BackendChatAttachmentItem): "image" | "pdf" | "video" | "other" {
    const mime = String(attachment.mime_type || "").toLowerCase();
    if (mime.startsWith("image/")) return "image";
    if (mime.includes("pdf")) return "pdf";
    if (mime.startsWith("video/")) return "video";
    return "other";
  }

  function attachmentIcon(attachment: BackendChatAttachmentItem): React.ReactNode {
    const extension = String(attachment.extension || "").toLowerCase();
    const kind = previewType(attachment);
    if (kind === "image") return <ImageIcon className="w-4 h-4 text-fuchsia-600"/>;
    if (kind === "pdf") return <FileText className="w-4 h-4 text-red-600"/>;
    if (kind === "video") return <Video className="w-4 h-4 text-indigo-600"/>;
    if (["xlsx", "xls", "csv"].includes(extension)) return <FileSpreadsheet className="w-4 h-4 text-emerald-600"/>;
    if (["ppt", "pptx"].includes(extension)) return <FileText className="w-4 h-4 text-amber-600"/>;
    return <FileIcon className="w-4 h-4 text-slate-600"/>;
  }

  function attachmentTypeLabel(attachment: BackendChatAttachmentItem): string {
    const extension = String(attachment.extension || "").toLowerCase();
    const kind = previewType(attachment);
    if (kind === "image") return "Imagen";
    if (kind === "pdf") return "PDF";
    if (kind === "video") return "Video";
    if (["xlsx", "xls", "csv"].includes(extension)) return "Hoja de calculo";
    if (["ppt", "pptx"].includes(extension)) return "Presentacion";
    if (["doc", "docx"].includes(extension)) return "Documento";
    return extension ? extension.toUpperCase() : "Archivo";
  }

  function shouldRenderMessageText(message: ChatMsg, attachmentsCount: number): boolean {
    if (!message.text) return false;
    if (attachmentsCount === 0) return true;
    return !/^(adjunto:|recurso compartido:)/i.test(message.text.trim());
  }

  function attachmentResourceUrl(attachment: BackendChatAttachmentItem): string {
    const storageUrl = String(attachment.storage_url || "").trim();
    return storageUrl || `/documentos/archivos/${encodeURIComponent(attachment.archivo_id)}/descargar`;
  }

  async function fetchAttachmentBlob(attachment: BackendChatAttachmentItem): Promise<Blob | null> {
    const fallbackUrl = `/documentos/archivos/${encodeURIComponent(attachment.archivo_id)}/descargar`;
    const urls = [attachment.storage_url, fallbackUrl]
      .map((url) => String(url || "").trim())
      .filter((url, index, all) => Boolean(url) && all.indexOf(url) === index);
    let lastError: unknown = null;

    for (const url of urls) {
      try {
        return await fetchProtectedBlob(url);
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }
    return null;
  }

  async function handleAttachmentCardClick(attachment: BackendChatAttachmentItem) {
    if (previewType(attachment) === "image" || previewType(attachment) === "pdf" || previewType(attachment) === "video") {
      setPreviewAttachment(attachment);
      return;
    }
    await handleDownloadAttachment(attachment);
  }

  async function handleAttachFileChange(event:React.ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];
    if(!file||!selectedId)return;

    setPendingLocalAttachment({file,url:URL.createObjectURL(file)});
    event.target.value="";
  }

  function cancelarAdjuntoLocal() {
    if (pendingLocalAttachment) URL.revokeObjectURL(pendingLocalAttachment.url);
    setPendingLocalAttachment(null);
  }

  async function enviarAdjuntoLocal() {
    if (!pendingLocalAttachment || !selectedId) return;
    const selected = pendingLocalAttachment;
    cancelarAdjuntoLocal();
    try {
      await onShareLocalAttachment(selectedId, selected.file);
      setTimeout(()=>messagesEndRef.current?.scrollIntoView({behavior:"smooth"}),50);
    } catch {
      toast.error("No se pudo enviar el archivo adjunto.");
    }
  }

  function insertEmoji(emoji:string){
    setInput(prev=>`${prev}${emoji}`);
    setShowEmojiMenu(false);
  }

  function handleKey(e:React.KeyboardEvent){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMsg();}}

  const convMsgs=selectedId?msgs[selectedId]||[]:[];
  const convAttachments=useMemo(
    ()=>(selectedId?chatAttachmentsByConversation[selectedId]||[]:[]),
    [selectedId,chatAttachmentsByConversation],
  );
  const attachmentsByMessage = convAttachments.reduce<Record<string, BackendChatAttachmentItem[]>>((acc, attachment) => {
    if (!acc[attachment.mensaje_id]) {
      acc[attachment.mensaje_id] = [];
    }
    acc[attachment.mensaje_id].push(attachment);
    return acc;
  }, {});
  // Solo asesores activos de la propia empresa: antes se ofrecía el correo
  // genérico de ejemplo que rellena `mapBackendImporterToUi`, que no existe.
  const advisorOptions = Array.from(
    new Set(
      companyAdvisors
        .filter((advisor) => advisor.status === "activo")
        .map((advisor) => advisor.email)
        .filter((email) => Boolean(email && email.trim())),
    ),
  );

  const refQuote=conv?.type==="cotizacion"
    ? quotes.find((quote)=>quote.id===conv.quoteId)||quotes.find((quote)=>quote.id===conv.refId)||null
    : null;
  const refOrderId=conv?.type==="orden"?conv.refId:null;
  const refOrder=conv?.type==="orden"?orders.find((order)=>order.id===conv.refId)||null:null;
  // El asesor asignado también mueve el estado del embarque: es a quien la
  // empresa le indica por el canal interno cuándo hacerlo. El backend comprueba
  // que sea el asignado a esa orden.
  const canManageOrder = currentUserRole === "importadora" || currentUserRole === "asesor";
  // «Nueva propuesta» reemplaza a la calculadora: la empresa responde desde el
  // chat con el cliente mientras se negocia la cotización y su propuesta sigue
  // editable (en una orden ya hay una aceptada). El backend lo vuelve a validar.
  const estadoPropuestaEmpresa = conv?.quoteId ? proposalStateByQuoteId[conv.quoteId] : undefined;
  const puedeProponer = canManageOrder && conv?.type==="cotizacion" && Boolean(conv.quoteId) && Boolean(onOpenProposalForm)
    && (!estadoPropuestaEmpresa || estadoPropuestaEmpresa==="borrador" || estadoPropuestaEmpresa==="pendiente");
  const textoBotonPropuesta = estadoPropuestaEmpresa==="pendiente" ? "Editar propuesta"
    : estadoPropuestaEmpresa==="borrador" ? "Revisar borrador" : "Nueva propuesta";
  // ?ltima versión de cada propuesta en el hilo: las anteriores salen como reemplazadas.
  const versionVigente = new Map<string,number>();
  for(const m of (selectedId?msgs[selectedId]||[]:[])){
    if(m.proposal){
      versionVigente.set(m.proposal.propuesta_id, Math.max(versionVigente.get(m.proposal.propuesta_id)||0, m.proposal.version));
    }
  }
  const esComprador = currentUserRole === "solicitante";
  // Administración y atención al cliente comparten la bandeja de tickets.
  const esEquipoPlataforma = currentUserRole === "admin" || currentUserRole === "soporte";
  // El backend solo admite avanzar un paso en la cadena, así que ofrecer la
  // lista completa era ofrecer seis destinos inválidos y uno bueno.
  const siguienteEstado = nextOrderState(refOrder?.status);

  useEffect(() => {
    setOrderActionMessage("");
    setOrderActionError("");
  }, [refOrder?.id, refOrder?.status]);

  async function handleTransferConversation() {
    if (!conv || !transferTo.trim()) return;
    setTransferMessage("");
    setTransferError("");
    setIsTransferring(true);
    try {
      await onTransferConversation(conv.id, transferTo.trim());
      setTransferMessage(`Conversación transferida a ${transferTo.trim()}`);
      setTransferTo("");
    } catch (error) {
      setTransferError(error instanceof Error && error.message.trim() ? error.message : "No se pudo transferir la conversación.");
    } finally {
      setIsTransferring(false);
    }
  }

  async function cerrarTicket() {
    if (!conv || resolucionTicket.trim().length < 5) return;
    setErrorTicket("");
    setCerrandoTicket(true);
    try {
      await onCloseTicket(conv.id, resolucionTicket.trim());
      setResolucionTicket("");
    } catch (error) {
      setErrorTicket(error instanceof Error && error.message.trim() ? error.message : "No se pudo cerrar el ticket.");
    } finally {
      setCerrandoTicket(false);
    }
  }

  async function escalarTicket() {
    if (!conv) return;
    setErrorTicket("");
    setCerrandoTicket(true);
    try {
      await onEscalateTicket(conv.id, (conv.level || 1) + 1);
    } catch (error) {
      setErrorTicket(error instanceof Error && error.message.trim() ? error.message : "No se pudo escalar el ticket.");
    } finally {
      setCerrandoTicket(false);
    }
  }

  async function calificarTicket() {
    if (!conv || notaSoporte < 1) return;
    setErrorTicket("");
    setCerrandoTicket(true);
    try {
      await onRateTicket(conv.id, notaSoporte, comentarioNota.trim() || undefined);
      setNotaSoporte(0);
      setComentarioNota("");
    } catch (error) {
      setErrorTicket(error instanceof Error && error.message.trim() ? error.message : "No se pudo enviar la calificación.");
    } finally {
      setCerrandoTicket(false);
    }
  }

  async function reabrirTicket() {
    if (!conv) return;
    setErrorTicket("");
    setCerrandoTicket(true);
    try {
      await onReopenTicket(conv.id);
    } catch (error) {
      setErrorTicket(error instanceof Error && error.message.trim() ? error.message : "No se pudo reabrir el ticket.");
    } finally {
      setCerrandoTicket(false);
    }
  }

  async function handleOrderStatusUpdate() {
    if (!refOrderId || !siguienteEstado) return;
    setOrderActionMessage("");
    setOrderActionError("");
    setIsUpdatingOrderStatus(true);
    try {
      await onUpdateOrderStatus(refOrderId, siguienteEstado.key);
      setOrderActionMessage(`Operación marcada como «${siguienteEstado.label}».`);
    } catch (error) {
      setOrderActionError(error instanceof Error && error.message.trim() ? error.message : "No se pudo actualizar el estado.");
    } finally {
      setIsUpdatingOrderStatus(false);
    }
  }

  async function handleOrderDocumentPick(event:React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !refOrderId) return;
    setOrderActionMessage("");
    setIsAttachingOrderDoc(true);
    try {
      await onAttachOrderDocument(refOrderId, file);
      setOrderActionMessage(`Documento adjuntado: ${file.name}`);
    } finally {
      setIsAttachingOrderDoc(false);
      event.target.value = "";
    }
  }

  function absoluteResourceUrl(url: string | null): string {
    return resolveApiUrl(url);
  }

  async function fetchProtectedBlob(url: string | null): Promise<Blob | null> {
    const target = absoluteResourceUrl(url);
    const token = getStoredToken();
    if (!target || !token) {
      return null;
    }

    const response = await fetch(target, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`No se pudo cargar el recurso (${response.status})`);
    }
    return response.blob();
  }

  useEffect(()=>{
    let objectUrl:string|null=null;
    let cancelled=false;

    setPreviewObjectUrl("");
    setPreviewLoadFailed(false);

    const source=previewAttachment ? attachmentResourceUrl(previewAttachment) : "";
    if(!source){
      return;
    }

    void (async()=>{
      try{
        const blob=previewAttachment ? await fetchAttachmentBlob(previewAttachment) : null;
        if(!blob){
          if(!cancelled) setPreviewLoadFailed(true);
          return;
        }
        objectUrl=window.URL.createObjectURL(blob);
        if(cancelled){
          window.URL.revokeObjectURL(objectUrl);
          return;
        }
        setPreviewObjectUrl(objectUrl);
      }catch{
        if(!cancelled) setPreviewLoadFailed(true);
      }
    })();

    return ()=>{
      cancelled=true;
      if(objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  },[previewAttachment?.archivo_id,previewAttachment?.storage_url]);

  async function handleDownloadResource(url: string | null, fileName: string) {
    try {
      const blob = await fetchProtectedBlob(url);
      if (!blob) {
        toast.error("No hay recurso disponible para descargar");
        return;
      }
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Error descargando recurso desde chat:", error);
      toast.error(`No se pudo descargar ${fileName}`);
    }
  }

  async function handleDownloadAttachment(attachment: BackendChatAttachmentItem) {
    try {
      const blob = await fetchAttachmentBlob(attachment);
      if (!blob) {
        toast.error("No hay recurso disponible para descargar");
        return;
      }
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = attachment.nombre;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Error descargando adjunto desde chat:", error);
      toast.error(`No se pudo descargar ${attachment.nombre}`);
    }
  }

  // Delega en el helper compartido: abrirlo aqui con
  // `popup.location.replace(blobUrl)` dejaba la pestana en `about:blank`,
  // porque el navegador no permite navegar de primer nivel a una `blob:` URL.
  async function handleOpenResource(url: string | null, fileName: string) {
    const resultado = await abrirArchivoEnPestana(url, fileName);
    if (!resultado.ok) {
      toast.error(resultado.motivo || `No se pudo abrir ${fileName}`);
    }
  }

  async function handleOpenAttachment(attachment: BackendChatAttachmentItem) {
    const urls = [attachment.storage_url, attachmentResourceUrl(attachment)]
      .map((url) => String(url || "").trim())
      .filter((url, index, all) => Boolean(url) && all.indexOf(url) === index);

    for (const url of urls) {
      const resultado = await abrirArchivoEnPestana(url, attachment.nombre);
      if (resultado.ok) {
        return;
      }
    }

    toast.error(`No se pudo abrir ${attachment.nombre}`);
  }

  async function loadResourceFolder(parentId: string | null) {
    setResourceLoading(true);
    try {
      const explorer = onLoadResourceFolder
        ? await onLoadResourceFolder(parentId)
        : await businessService.listDocumentExplorer(parentId);
      setResourceExplorer(explorer);
      setResourceCurrentFolderId(parentId);
    } finally {
      setResourceLoading(false);
    }
  }

  async function openResourcePicker() {
    setIsResourcePickerOpen(true);
    setResourceSearch("");
    setResourceSearchResults(null);
    setResourceFolderTrail([{ id: null, name: "Raiz" }]);
    setResourceViewMode("grid");
    setResourceTargetConversationId(selectedId || "");
    await loadResourceFolder(null);
  }

  async function openResourceFolder(folder: { id: string; nombre: string }) {
    setResourceSearch("");
    setResourceSearchResults(null);
    setResourceFolderTrail((prev) => [...prev, { id: folder.id, name: folder.nombre }]);
    await loadResourceFolder(folder.id);
  }

  async function jumpResourceTrail(index: number) {
    const node = resourceFolderTrail[index];
    setResourceSearch("");
    setResourceSearchResults(null);
    setResourceFolderTrail((prev) => prev.slice(0, index + 1));
    await loadResourceFolder(node.id);
  }

  async function handleShareExistingResourceToChat(file: BackendArchivoItem) {
    setPendingResource(file);
    setIsResourcePickerOpen(false);
  }

  async function enviarRecursoPendiente() {
    const targetConversationId = resourceTargetConversationId.trim();
    if (!pendingResource || !targetConversationId) {
      toast.error("Selecciona el chat destino");
      return;
    }
    try {
      await onShareExistingResource([targetConversationId], pendingResource.id, `Recurso compartido: ${pendingResource.nombre}`);
      toast.success("Recurso enviado al chat");
      setPendingResource(null);
    } catch {
      toast.error("No se pudo enviar el recurso al chat.");
    }
  }

  async function handleUploadResourceToCurrentFolder(file: File) {
    setResourceUploading(true);
    try {
      await businessService.uploadDocumentFile(file, resourceCurrentFolderId, "chat");
      await loadResourceFolder(resourceCurrentFolderId);
      toast.success("Archivo subido correctamente en esta carpeta");
    } catch (error) {
      console.error("No se pudo subir el recurso desde el modal:", error);
      toast.error("No se pudo subir el archivo");
    } finally {
      setResourceUploading(false);
      setResourceDropOver(false);
    }
  }

  async function handleResourceUploadPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleUploadResourceToCurrentFolder(file);
    event.target.value = "";
  }

  async function reloadResourcePickerFolder() {
    await loadResourceFolder(resourceCurrentFolderId);
    toast.success("Carpeta recargada");
  }

  function resourcePreviewMediaUrl(file: BackendArchivoItem): string | null {
    const mime = String(file.mime_type || "").toLowerCase();
    if ((mime.startsWith("image/") || mime.startsWith("video/")) && file.storage_url && resourcePreviewUrls[file.id]) {
      return resourcePreviewUrls[file.id];
    }
    return null;
  }

  function resourcePreviewThumb(file: BackendArchivoItem): string | null {
    return String(file.mime_type || "").toLowerCase().startsWith("image/")
      ? resourcePreviewMediaUrl(file)
      : null;
  }

  // Para el equipo de la plataforma esto es una bandeja de soporte: filtrar por
  // órdenes o cotizaciones no significa nada ahí, y lo que importa es la
  // urgencia con la que el usuario pidió ayuda.
  const FILTERS = modoEquipo
    ? [
        {k:"all",label:"Todas"},
        {k:"no-leidas",label:"No leídas"},
      ]
    : esEquipoPlataforma
    ? [
        {k:"all",label:"Abiertos"},
        {k:"no-leidas",label:"No leídas"},
        {k:"urg-critica",label:"Críticas"},
        {k:"urg-alta",label:"Altas"},
        {k:"urg-media",label:"Medias"},
        {k:"urg-baja",label:"Bajas"},
        {k:"cerrados",label:"Cerrados"},
      ]
    : [
        {k:"all",label:"Todas"},
        {k:"no-leidas",label:"No leídas"},
        {k:"ordenes",label:"Operaciones"},
        {k:"cotizaciones",label:"Cotizaciones"},
        // La pestaña de equipo solo aparece si hay algún hilo interno: al
        // solicitante no le sirve de nada y nunca va a tener ninguno.
        ...(conversations.some(c=>c.type==="interno")?[{k:"interno",label:"Equipo"}]:[]),
        ...(conversations.some(c=>c.type==="soporte")?[{k:"soporte",label:"Soporte"}]:[]),
        ...(conversations.some(c=>c.atiendeNombre)?[{k:"asesores",label:"De mis asesores"}]:[]),
      ];
  const pickerVisibleFiles = resourceSearchResults?.files ?? resourceExplorer.archivos;
  const pickerVisibleFolders = resourceSearchResults
    ? resourceSearchResults.folders
    : resourceExplorer.carpetas.filter((folder, index, all) => {
        const normalized = normalizeFolderName(folder.nombre);
        return all.findIndex((candidate) => normalizeFolderName(candidate.nombre) === normalized) === index;
      });

  useEffect(() => {
    if (!isResourcePickerOpen) {
      return;
    }

    const query = resourceSearch.trim();
    if (!query) {
      setResourceSearchResults(null);
      setResourceSearching(false);
      return;
    }

    setResourceSearching(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const rows = await businessService.searchDocumentFiles(query);
          const normalizedQuery = normalizeFolderName(query);
          const matchedFolders = resourceExplorer.carpetas.filter((folder) =>
            normalizeFolderName(folder.nombre).includes(normalizedQuery),
          );
          if (!cancelled) {
            setResourceSearchResults({ files: rows, folders: matchedFolders });
          }
        } finally {
          if (!cancelled) {
            setResourceSearching(false);
          }
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [resourceSearch, isResourcePickerOpen, resourceExplorer.carpetas]);

  useEffect(() => {
    const attachmentIds = new Set(convAttachments.map((attachment) => attachment.archivo_id));
    Object.entries(attachmentThumbRegistryRef.current).forEach(([attachmentId, objectUrl]) => {
      if (!attachmentIds.has(attachmentId)) {
        window.URL.revokeObjectURL(objectUrl);
        delete attachmentThumbRegistryRef.current[attachmentId];
        delete attachmentThumbLoadingRef.current[attachmentId];
      }
    });

    setAttachmentThumbUrls((current) => {
      const next: Record<string,string> = {};
      convAttachments.forEach((attachment) => {
        if (current[attachment.archivo_id]) {
          next[attachment.archivo_id] = current[attachment.archivo_id];
        }
      });
      const iguales = Object.keys(next).length === Object.keys(current).length
        && Object.keys(next).every((clave) => next[clave] === current[clave]);
      return iguales ? current : next;
    });

    convAttachments.forEach((attachment) => {
      if (previewType(attachment) !== "image") {
        return;
      }
      if (attachmentThumbRegistryRef.current[attachment.archivo_id] || attachmentThumbLoadingRef.current[attachment.archivo_id]) {
        return;
      }

      attachmentThumbLoadingRef.current[attachment.archivo_id] = true;
      void fetchAttachmentBlob(attachment)
        .then((blob) => {
          if (!blob) return;
          const objectUrl = window.URL.createObjectURL(blob);
          attachmentThumbRegistryRef.current[attachment.archivo_id] = objectUrl;
          setAttachmentThumbUrls((current) => ({ ...current, [attachment.archivo_id]: objectUrl }));
        })
        .catch(() => {
          // Si falla miniatura protegida, se mantiene icono fallback.
        })
        .finally(() => {
          delete attachmentThumbLoadingRef.current[attachment.archivo_id];
        });
    });
  }, [convAttachments]);

  useEffect(() => {
    if (!isResourcePickerOpen) {
      return;
    }

    const previewFiles = pendingResource
      ? [...pickerVisibleFiles, pendingResource]
      : pickerVisibleFiles;
    const fileIds = new Set(previewFiles.map((file) => file.id));
    Object.entries(resourcePreviewRegistryRef.current).forEach(([fileId, objectUrl]) => {
      if (!fileIds.has(fileId)) {
        window.URL.revokeObjectURL(objectUrl);
        delete resourcePreviewRegistryRef.current[fileId];
        delete resourcePreviewLoadingRef.current[fileId];
      }
    });

    setResourcePreviewUrls((current) => {
      const next: Record<string,string> = {};
      previewFiles.forEach((file) => {
        if (current[file.id]) {
          next[file.id] = current[file.id];
        }
      });
      const iguales = Object.keys(next).length === Object.keys(current).length
        && Object.keys(next).every((clave) => next[clave] === current[clave]);
      return iguales ? current : next;
    });

    previewFiles.forEach((file) => {
      const mime = String(file.mime_type || "").toLowerCase();
      if (!(mime.startsWith("image/") || mime.startsWith("video/")) || !file.storage_url) {
        return;
      }
      if (resourcePreviewRegistryRef.current[file.id] || resourcePreviewLoadingRef.current[file.id]) {
        return;
      }

      resourcePreviewLoadingRef.current[file.id] = true;
      void fetchProtectedBlob(file.storage_url)
        .then((blob) => {
          if (!blob) return;
          const objectUrl = window.URL.createObjectURL(blob);
          resourcePreviewRegistryRef.current[file.id] = objectUrl;
          setResourcePreviewUrls((current) => ({ ...current, [file.id]: objectUrl }));
        })
        .catch(() => {
          // Si falla la miniatura, se mantiene icono fallback.
        })
        .finally(() => {
          delete resourcePreviewLoadingRef.current[file.id];
        });
    });
  }, [isResourcePickerOpen, pickerVisibleFiles, pendingResource]);

  useEffect(() => {
    return () => {
      Object.values(attachmentThumbRegistryRef.current).forEach((objectUrl) => {
        window.URL.revokeObjectURL(objectUrl);
      });
      attachmentThumbRegistryRef.current = {};
      attachmentThumbLoadingRef.current = {};
      Object.values(resourcePreviewRegistryRef.current).forEach((objectUrl) => {
        window.URL.revokeObjectURL(objectUrl);
      });
      resourcePreviewRegistryRef.current = {};
      resourcePreviewLoadingRef.current = {};
    };
  }, []);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active={modoEquipo?"team-channel":"chats"}/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <div className="flex-1 flex overflow-hidden">

          {/* â”€â”€ Left: conversation list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="w-72 flex-shrink-0 border-r border-border bg-white flex flex-col">
            {modoEquipo&&(
              <div className="px-3 pt-3 pb-2 border-b border-border space-y-2">
                <div>
                  <p className="text-sm font-semibold">Canal del equipo</p>
                  <p className="text-[11px] text-muted-foreground">
                    Elige a quién escribirle. La sala la lee todo el equipo; un hilo privado, solo ustedes dos.
                  </p>
                </div>
              </div>
            )}
            <div className="px-3 pt-3 pb-2 border-b border-border">
              <Input placeholder={modoEquipo?"Buscar persona del equipo...":"Buscar por código, empresa, asesor..."} value={searchConv} onChange={e=>setSearchConv(e.target.value)} prefix={<Search className="w-3.5 h-3.5"/>}/>
            </div>
            <div className="flex gap-1 px-3 py-2 border-b border-border overflow-x-auto">
              {FILTERS.map(f=>(
                <button key={f.k} onClick={()=>setFilter(f.k)}
                  className={clsx("flex-shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                    filter===f.k?"bg-primary text-white":"text-muted-foreground hover:text-foreground hover:bg-muted")}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {modoEquipo?renderListaEquipo():filteredConvs.length===0?(
                <div className="flex flex-col items-center justify-center py-12 gap-2 px-4 text-center">
                  <MessageSquare className="w-8 h-8 text-muted-foreground/30"/>
                  <p className="text-sm text-muted-foreground">No hay conversaciones</p>
                </div>
              ):convsEnLista.map((c,i)=>{
                const cImp=importers.find(i=>i.id===c.importerId);
                // En el hilo interno la contraparte es una persona del equipo,
                // no una empresa cliente; en soporte, quien pidió ayuda.
                const companyName = c.type==="interno"
                  ? (c.counterpartName || "Equipo")
                  : c.type==="soporte"
                  ? [c.counterpartName, etiquetaDeRol(c.requesterRole)].filter(Boolean).join(" · ")
                    : (c.counterpartName || c.importerName || cImp?.name || "Empresa importadora");
                const urgencia = c.type==="soporte" ? URGENCIA_SOPORTE[c.urgency||""] : undefined;
                const isSelected=selectedId===c.id;
                const suContraparte=resolverContraparteChat(c,cImp||null);
                const nuevoGrupo=filter==="asesores"&&(i===0||convsEnLista[i-1].atiendeNombre!==c.atiendeNombre);
                return (
                  <React.Fragment key={c.id}>
                  {nuevoGrupo&&(
                    <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40 border-b border-border/50">
                      Chats de {c.atiendeNombre}
                    </p>
                  )}
                  <button onClick={()=>setSelectedId(c.id)}
                    className={clsx("w-full text-left px-3 py-3 border-b border-border/50 transition-colors flex gap-2.5",
                      isSelected?"bg-primary/8 dark:bg-accent/8 border-l-2 border-l-primary dark:border-l-accent":"hover:bg-muted/50")}>
                    {/* El avatar es de la PERSONA y el distintivo pequeño dice de
                        qué hilo se trata: antes solo había un icono por tipo,
                        igual para todas las conversaciones de esa clase. */}
                    <div className="relative flex-shrink-0 mt-0.5">
                      <Avatar initials={suContraparte.iniciales} size="lg" color={suContraparte.color} src={suContraparte.fotoUrl||undefined}/>
                      <span className={clsx("absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-background",
                        c.type==="orden"?"bg-purple-100 text-primary":c.type==="interno"?"bg-amber-100 text-amber-600":c.type==="soporte"?"bg-rose-100 text-rose-600":"bg-blue-100 text-blue-600")}>
                        {c.type==="orden"?<ShoppingCart className="w-2.5 h-2.5"/>:c.type==="interno"?<Users className="w-2.5 h-2.5"/>:c.type==="soporte"?<LifeBuoy className="w-2.5 h-2.5"/>:<FileText className="w-2.5 h-2.5"/>}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <p className={clsx("text-xs font-semibold truncate",isSelected?"text-primary dark:text-accent":"text-foreground")}>
                            {c.type==="soporte"?(c.subject||"Solicitud de soporte"):c.refCode}
                          </p>
                          <div className="flex items-center gap-1.5 min-w-0">
                            {urgencia&&(
                              <span className={clsx("inline-flex flex-shrink-0 items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold",urgencia.clase)}>
                                {urgencia.label}
                              </span>
                            )}
                            <p className="text-xs text-muted-foreground truncate">
                              {[companyName, c.type!=="soporte"?suContraparte.etiquetaRol:""].filter(Boolean).join(" · ")}
                            </p>
                            {puedeVerTierDeContraparte(currentUserRole, c.counterpartRole, c.cotizanteTier) && <TierBadge tier={c.cotizanteTier} />}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{c.lastDate}</span>
                          {c.unread>0&&<span className="w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">{c.unread}</span>}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMsg}</p>
                      {c.status==="archivada"&&<span className="text-[10px] text-muted-foreground/60 font-medium">Archivada</span>}
                    </div>
                  </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* â”€â”€ Center: chat area â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {!conv?(
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <MessageSquare className="w-7 h-7 text-muted-foreground/40"/>
              </div>
              <div>
                <p className="font-semibold text-foreground">Selecciona una conversación</p>
                <p className="text-sm text-muted-foreground mt-1">Elige un chat de la lista para comenzar.</p>
              </div>
            </div>
          ):(
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {/* Chat header */}
              <div className="flex-shrink-0 border-b border-border bg-white px-4 py-3 flex items-center gap-3">
                <Avatar initials={contraparte.iniciales} size="md" color={contraparte.color} src={contraparte.fotoUrl||undefined}/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-foreground">
                      {conv.type==="soporte"?(conv.subject||"Solicitud de soporte"):contraparte.nombre}
                    </p>
                    {mostrarTierContraparte && <TierBadge tier={conv.cotizanteTier} />}
                    {/* Qué es esa persona: sin esto no se distinguía un cliente
                        de un asesor ni de la cuenta dueña de una empresa. */}
                    {conv.type!=="soporte"&&contraparte.etiquetaRol&&(
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        {contraparte.etiquetaRol}
                      </span>
                    )}
                    {conv.type==="soporte"&&(
                      <>
                        <span className="text-muted-foreground/40 text-xs">·</span>
                        <p className="text-xs text-muted-foreground">
                          {[conv.counterpartName, etiquetaDeRol(conv.requesterRole)].filter(Boolean).join(" · ")}
                        </p>
                        {URGENCIA_SOPORTE[conv.urgency||""]&&(
                          <span className={clsx("inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold",URGENCIA_SOPORTE[conv.urgency||""].clase)}>
                            Urgencia {URGENCIA_SOPORTE[conv.urgency||""].label.toLowerCase()}
                          </span>
                        )}
                      </>
                    )}
                    {conv.type!=="interno"&&conv.type!=="soporte"&&contraparte.empresa&&(
                      <>
                        <span className="text-muted-foreground/40 text-xs">·</span>
                        <p className="text-xs text-muted-foreground">{contraparte.empresa}</p>
                      </>
                    )}
                    {conv.type!=="soporte"&&(
                      <span className={clsx("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                        conv.type==="orden"?"bg-purple-50 text-purple-700":conv.type==="interno"?"bg-amber-50 text-amber-700":"bg-blue-50 text-blue-700")}>
                        {conv.type==="orden"?`Operación · ${conv.refCode}`:conv.type==="interno"?"Canal interno · el cliente no lo ve":`Cotización · ${conv.refCode}`}
                      </span>
                    )}
                    {conv.status==="activa"&&<span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>Activa</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {conv.type==="cotizacion"&&refQuote&&(
                    <Button variant="secondary" size="sm" icon={<ExternalLink className="w-3 h-3"/>} onClick={()=>onViewQuote(refQuote.id)}>Ver cotización</Button>
                  )}
                  {conv.type==="orden"&&refOrderId&&(
                    <Button variant="secondary" size="sm" icon={<ExternalLink className="w-3 h-3"/>} onClick={()=>onViewOrder(refOrderId)}>Ver operación</Button>
                  )}
                  <button onClick={()=>setShowCtx(v=>!v)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title={showCtx?"Ocultar panel":"Ver contexto"}>
                    {showCtx?<PanelRightClose className="w-4 h-4"/>:<PanelRightOpen className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              {conv.atiendeNombre&&(
                <div className="flex-shrink-0 px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800">
                  Chat de <strong>{conv.atiendeNombre}</strong> con {contraparte.nombre}. Lo ves como cuenta de la empresa:
                  a la derecha lo que escribió tu equipo, a la izquierda el cliente.
                </div>
              )}
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-slate-50/40">
                {convMsgs.map((msg,i)=>{
                  const isClient=msg.sender==="client";
                  const prevMsg=i>0?convMsgs[i-1]:null;
                  const messageAttachments=attachmentsByMessage[msg.id]||[];
                  // Donde escribe más de una persona por lado (la empresa con
                  // asesor y dueña, la sala del equipo, un ticket que pasó por
                  // varios agentes) cada grupo de mensajes lleva el nombre.
                  const enSalaEquipo=conv.type==="equipo"&&conv.counterpartRole==="plataforma";
                  const mostrarAutor=Boolean(msg.authorName)
                    &&(isClient||enSalaEquipo||conv.type==="soporte"||Boolean(conv.atiendeNombre))
                    &&(!prevMsg||prevMsg.authorName!==msg.authorName||prevMsg.sender!==msg.sender);
                  return (
                    <div key={msg.id}>
                      {msg.dateGroup&&(
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-border"/>
                          <span className="text-xs text-muted-foreground font-medium px-2 py-0.5 bg-white border border-border rounded-full">{msg.dateGroup}</span>
                          <div className="flex-1 h-px bg-border"/>
                        </div>
                      )}
                      <div className={clsx("flex gap-2 items-end mb-0.5",isClient?"justify-end":"justify-start")}>
                        {!isClient&&(enSalaEquipo&&msg.authorName
                          ?<Avatar initials={initialsFromName(msg.authorName)} size="sm" color={importerColorFromId(msg.authorName)}/>
                          :<Avatar initials={contraparte.iniciales} size="sm" color={contraparte.color} src={contraparte.fotoUrl||undefined}/>)}
                        <div className={clsx("max-w-[70%] flex flex-col gap-1",isClient?"items-end":"items-start")}>
                          {mostrarAutor&&<span className="text-[10px] font-semibold text-muted-foreground px-1">{msg.authorName}</span>}
                          {msg.file&&<FileAttachmentBubble file={msg.file}/>}
                          {messageAttachments.length>0 && (
                            <div className={clsx("grid gap-2", messageAttachments.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1", isClient ? "justify-items-end" : "justify-items-start")}>
                              {messageAttachments.map((attachment) => {
                                const kind = previewType(attachment);
                                const thumbUrl = kind === "image" ? attachmentThumbUrls[attachment.archivo_id] : "";
                                return (
                                  <div
                                    key={attachment.archivo_id}
                                    className="w-[240px] rounded-xl border border-border bg-white overflow-hidden shadow-sm"
                                  >
                                    <button
                                      onClick={()=>{void handleAttachmentCardClick(attachment);}}
                                      className="w-full text-left hover:bg-muted/50 transition-colors"
                                    >
                                      <div className="h-28 border-b border-border bg-slate-50 flex items-center justify-center overflow-hidden">
                                        {kind === "image" && thumbUrl ? (
                                          <img src={thumbUrl} alt={attachment.nombre} className="w-full h-full object-cover"/>
                                        ) : (
                                          <div className="w-10 h-10 rounded-lg bg-white border border-border flex items-center justify-center">
                                            {attachmentIcon(attachment)}
                                          </div>
                                        )}
                                      </div>
                                      <div className="p-2.5">
                                        <p className="text-xs font-semibold text-foreground truncate">{attachment.nombre}</p>
                                        <p className="text-[11px] text-muted-foreground mt-1">
                                          {attachmentTypeLabel(attachment)}
                                          {attachment.size_bytes ? ` · ${getReadableFileSize(attachment.size_bytes)}` : ""}
                                        </p>
                                      </div>
                                    </button>
                                    <div className="px-2.5 pb-2.5">
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        icon={<Download className="w-3.5 h-3.5"/>}
                                        onClick={()=>{void handleDownloadAttachment(attachment);}}
                                      >
                                        Descargar
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {msg.proposal&&(
                            <TarjetaPropuestaChat
                              datos={msg.proposal}
                              esCliente={esComprador}
                              reemplazada={(versionVigente.get(msg.proposal.propuesta_id)||0)>msg.proposal.version}
                              onElegir={()=>onViewQuote(msg.proposal!.cotizacion_id)}
                              onPreguntar={()=>{setInput("Sobre tu propuesta: ");inputRef.current?.focus();}}
                            />
                          )}
                          {!msg.proposal&&shouldRenderMessageText(msg, messageAttachments.length) && (
                            <div className={clsx("px-3 py-2 rounded-2xl text-sm leading-relaxed",
                              isClient
                                ?"bg-primary text-white rounded-br-sm"
                                :"bg-white border border-border text-foreground rounded-bl-sm shadow-sm")}>
                              {msg.text}
                            </div>
                          )}
                          <div className={clsx("flex items-center gap-1",isClient?"flex-row-reverse":"flex-row")}>
                            <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                            {isClient&&(
                              <span className={clsx("text-[10px]", msg.read ? "text-primary dark:text-accent" : "text-muted-foreground")}>
                                {msg.read ? "✓✓" : "✓"}
                              </span>
                            )}
                          </div>
                        </div>
                        {isClient&&<Avatar initials={msg.authorName?initialsFromName(msg.authorName):"AG"} size="sm" src={userPhotoUrl ? resolveApiUrl(userPhotoUrl) : undefined}/>}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef}/>
              </div>

              {/* Input */}
              <div className="flex-shrink-0 border-t border-border bg-white px-4 py-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event)=>{void handleAttachFileChange(event);}}
                />
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event)=>{void handleAttachFileChange(event);}}
                />
                {pendingLocalAttachment && (
                  <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-2">
                    {pendingLocalAttachment.file.type.startsWith("image/") ? (
                      <img
                        src={pendingLocalAttachment.url}
                        alt={`Vista previa de ${pendingLocalAttachment.file.name}`}
                        className="h-16 w-16 rounded-lg border border-border object-cover"
                      />
                    ) : pendingLocalAttachment.file.type.startsWith("video/") ? (
                      <video
                        src={pendingLocalAttachment.url}
                        controls
                        preload="metadata"
                        className="h-16 w-28 rounded-lg border border-border bg-black object-contain"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-border bg-white">
                        <FileIcon className="h-7 w-7 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{pendingLocalAttachment.file.name}</p>
                      <p className="text-xs text-muted-foreground">{getReadableFileSize(pendingLocalAttachment.file.size)}</p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={cancelarAdjuntoLocal}>Cancelar</Button>
                    <Button variant="primary" size="sm" onClick={()=>{void enviarAdjuntoLocal();}}>Enviar</Button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 items-center">
                    <button
                      onClick={()=>fileInputRef.current?.click()}
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Adjuntar archivo"
                    >
                      <Paperclip className="w-4 h-4"/>
                    </button>
                    <button
                      onClick={()=>imageInputRef.current?.click()}
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Adjuntar imagen"
                    >
                      <ImageIcon className="w-4 h-4"/>
                    </button>
                    <button
                      onClick={()=>{void openResourcePicker();}}
                      className="h-9 px-2.5 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Elegir recurso desde carpetas"
                    >
                      <FolderOpen className="w-4 h-4"/>
                    </button>
                    {puedeProponer&&conv&&(
                      <button
                        onClick={()=>onOpenProposalForm?.(conv.quoteId)}
                        className="h-9 px-2.5 flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 dark:border-accent/20 text-primary dark:text-accent text-xs font-medium hover:bg-primary/10 dark:hover:bg-accent/10 transition-colors"
                        title="Propuesta con precio cerrado en pesos: le llega al cliente en este chat"
                      >
                        <FileSignature className="w-4 h-4"/>
                        <span className="hidden md:inline">{textoBotonPropuesta}</span>
                      </button>
                    )}
                    <div className="relative">
                      <button
                        onClick={()=>setShowEmojiMenu(v=>!v)}
                        className={clsx("w-9 h-9 flex items-center justify-center rounded-lg transition-colors",showEmojiMenu?"bg-muted text-foreground":"text-muted-foreground hover:text-foreground hover:bg-muted")}
                        title="Emoji"
                      >
                        <Smile className="w-4 h-4"/>
                      </button>
                      {showEmojiMenu&&(
                        <div className="absolute bottom-11 left-0 z-20 w-52 rounded-xl border border-border bg-white p-2 shadow-lg">
                          <p className="px-1 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Emoji rápido</p>
                          <div className="grid grid-cols-6 gap-1">
                            {emojiOptions.map((emoji)=> (
                              <button
                                key={emoji}
                                onClick={()=>insertEmoji(emoji)}
                                className="rounded-md p-1 text-base hover:bg-muted"
                                title={`Insertar ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e=>setInput(e.target.value)}
                      onKeyDown={handleKey}
                      placeholder="Escribe un mensaje… (Enter para enviar)"
                      rows={1}
                      className="w-full resize-none bg-muted/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all max-h-32 overflow-y-auto"
                      style={{minHeight:"40px"}}
                    />
                  </div>
                  <button
                    onClick={()=>{void (pendingLocalAttachment ? enviarAdjuntoLocal() : sendMsg());}}
                    disabled={(!input.trim()&&!pendingLocalAttachment)||sending}
                    className={clsx("w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0",
                      input.trim()?"bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent shadow-sm":"bg-muted text-muted-foreground cursor-not-allowed")}>
                    <Send className="w-4 h-4"/>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* â”€â”€ Right: context panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {conv&&showCtx&&(
            <div className="w-56 flex-shrink-0 border-l border-border bg-white overflow-y-auto flex flex-col">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contexto</p>
              </div>
              <div className="p-3 space-y-3 flex-1">
                {conv.type==="soporte"?(
                  <div className={clsx("rounded-lg border px-2.5 py-2 space-y-1.5 dark:!bg-accent/20",conv.closed?"bg-emerald-50 border-emerald-200":"bg-rose-50 border-rose-200")}>
                    <p
                      className={clsx(
                        "text-[10px] font-semibold uppercase tracking-wide",
                        conv.closed
                          ? "text-emerald-800 dark:text-accent"
                          : "text-rose-800 dark:text-accent"
                      )}
                    >
                      {conv.closed ? "Ticket cerrado" : "Soporte técnico"}
                    </p>

                    {[
                      ["Asunto", conv.subject || "?"],
                      ["Urgencia", URGENCIA_SOPORTE[conv.urgency || ""]?.label || "?"],
                      ["Nivel de mesa", conv.level ? `Nivel ${conv.level}` : "?"],
                      ["Atiende", conv.agentName || "Sin asignar"],
                      ["Solicita", conv.counterpartName || "?"],
                      ["Perfil", etiquetaDeRol(conv.requesterRole) || "?"],
                      ...(conv.closed ? [["Cerró", conv.closedBy || "?"]] : []),
                      ...(conv.rating ? [["Calificación", `${conv.rating} de 5`]] : []),
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between items-start gap-1">
                        <span
                          className={clsx(
                            "text-[10px]",
                            conv.closed
                              ? "text-emerald-900/70 dark:text-accent/70"
                              : "text-rose-900/70 dark:text-accent/70"
                          )}
                        >
                          {k}
                        </span>

                        <span
                          className={clsx(
                            "text-[10px] font-medium text-right",
                            conv.closed
                              ? "text-emerald-900 dark:text-accent"
                              : "text-rose-900 dark:text-accent"
                          )}
                        >
                          {v}
                        </span>
                      </div>
                    ))}

                    {conv.closed&&conv.resolution&&(
                      <p className="text-[10px] text-emerald-900 leading-snug pt-1.5 border-t border-emerald-200">
                        <span className="font-semibold">Resolución: </span>{conv.resolution}
                      </p>
                    )}

                    {/* Cerrar es de quien atiende; reabrir, también de quien lo pidió. */}
                    {!conv.closed&&esEquipoPlataforma&&(
                      <div className="pt-1.5 border-t border-rose-200 dark:border-border space-y-1.5">
                        {/* Escalar: el nivel inicial se dedujo de la urgencia, que
                            dice cuánta prisa corre y no lo difícil que es. */}
                        {(conv.level||1)<3&&(
                          <Button variant="secondary" size="sm" fullWidth loading={cerrandoTicket}
                            onClick={()=>{void escalarTicket();}}>
                            Escalar a nivel {(conv.level||1)+1}
                          </Button>
                        )}
                        <textarea
                          value={resolucionTicket}
                          onChange={(e)=>setResolucionTicket(e.target.value)}
                          rows={3}
                          placeholder="Qué se hizo para resolverlo..."
                          className="w-full resize-none rounded-md border border-rose-200 dark:border-border px-2 py-1.5 text-[11px] bg-white dark:bg-background text-foreground"
                        />
                        <Button 
                          variant="primary" 
                          size="sm" 
                          fullWidth 
                          loading={cerrandoTicket}
                          disabled={resolucionTicket.trim().length<5}
                          onClick={()=>{void cerrarTicket();}}
                          className="bg-primary text-white dark:bg-accent dark:text-black dark:hover:bg-accent/80"
                        >
                          Cerrar ticket
                        </Button>
                      </div>
                    )}

                    {/* Calificar: solo quien pidió la ayuda, y solo una vez cerrado. */}
                    {conv.closed&&!esEquipoPlataforma&&!conv.rating&&(
                      <div className="pt-1.5 border-t border-emerald-200 space-y-1.5">
                        <p className="text-[10px] font-semibold text-emerald-900">
                          ¿Cómo te atendió {conv.agentName||"el equipo"}?
                        </p>
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map((n)=>(
                            <button
                              key={n}
                              type="button"
                              onClick={()=>setNotaSoporte(n)}
                              className={clsx(
                                "flex-1 rounded-md border py-1 text-[11px] font-semibold transition-colors",
                                notaSoporte>=n?"bg-amber-400 border-amber-500 text-white":"bg-white border-emerald-200 text-muted-foreground hover:bg-muted",
                              )}
                              aria-label={`${n} de 5`}
                            >
                              â˜…
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={comentarioNota}
                          onChange={(e)=>setComentarioNota(e.target.value)}
                          rows={2}
                          placeholder="Comentario (opcional)"
                          className="w-full resize-none rounded-md border border-emerald-200 px-2 py-1.5 text-[11px] bg-white"
                        />
                        <Button variant="primary" size="sm" fullWidth loading={cerrandoTicket}
                          disabled={notaSoporte<1}
                          onClick={()=>{void calificarTicket();}}>
                          Enviar calificación
                        </Button>
                      </div>
                    )}

                    {conv.rating&&(
                      <p className="text-[10px] text-emerald-900 pt-1.5 border-t border-emerald-200">
                        <span className="font-semibold">Calificó con {conv.rating}/5.</span>
                        {conv.ratingComment?` «${conv.ratingComment}»`:""}
                      </p>
                    )}
                    {conv.closed&&(
                      <div className="pt-1.5 border-t border-emerald-200">
                        <Button variant="secondary" size="sm" fullWidth loading={cerrandoTicket}
                          onClick={()=>{void reabrirTicket();}}>
                          Reabrir ticket
                        </Button>
                      </div>
                    )}
                    {errorTicket&&<p className="text-[10px] text-destructive">{errorTicket}</p>}
                  </div>
                ):conv.type==="interno"?(
                  <div className="rounded-lg bg-amber-50 border border-amber-200 dark:!bg-accent/15 px-2.5 py-2">
                    <p className="text-[10px] font-semibold text-amber-800 dark:text-accent uppercase tracking-wide mb-1">Canal interno</p>
                    <p className="text-[11px] text-amber-900 dark:text-accent leading-snug">
                      Coordinación entre la empresa y {conv.counterpartName||"el asesor"}. ?salo para indicar
                      cuándo actualizar el estado de una operación. El comprador no ve estos mensajes.
                    </p>
                  </div>
                ):(
                  <>
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Hablas con</p>
                      <div className="flex items-center gap-2">
                        <Avatar initials={contraparte.iniciales} size="sm" color={contraparte.color} src={contraparte.fotoUrl||undefined}/>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{contraparte.nombre}</p>
                          {contraparte.etiquetaRol&&<p className="text-[10px] text-muted-foreground">{contraparte.etiquetaRol}</p>}
                          {mostrarTierContraparte && <TierBadge tier={conv.cotizanteTier} />}
                        </div>
                      </div>
                    </div>
                    {/* La empresa es el contexto de la negociación; solo se
                        repite aquí cuando no es el propio interlocutor. */}
                    {contraparte.empresa&&(
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Empresa</p>
                        <div className="flex items-center gap-2"><Avatar initials={imp?.initials || initialsFromName(contraparte.empresa)} size="sm" color={imp?.color || "bg-slate-500"} variant="logo" src={imp?.logoUrl?resolveApiUrl(imp.logoUrl):undefined}/><div><p className="text-xs font-semibold">{contraparte.empresa}</p></div></div>
                      </div>
                    )}
                    {contraparte.empresa&&chatAdvisorEmail&&(
                      <div className="flex gap-1">
                        <ContactBtn type="email" size="sm" label="Email" className="flex-1 justify-center" onClick={()=>openSmartContact({type:"email",email:chatAdvisorEmail,onOpenChat:()=>setShowCtx(true)})}/>
                      </div>
                    )}
                  </>
                )}
                <div className="border-t border-border"/>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Adjuntos</p>
                    <span className="text-[10px] text-muted-foreground">{convAttachments.length}</span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {convAttachments.slice(0, 12).map((attachment)=>(
                      <button
                        key={attachment.mensaje_id + attachment.archivo_id}
                        onClick={()=>{void handleAttachmentCardClick(attachment);}}
                        className="w-full text-left block rounded-lg border border-border px-2 py-1.5 hover:bg-muted transition-colors"
                      >
                        <p className="text-[11px] font-medium truncate">{attachment.nombre}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {attachment.extension.toUpperCase()}
                          {attachment.size_bytes ? ` · ${getReadableFileSize(attachment.size_bytes)}` : ""}
                          {` · ${new Date(attachment.created_at).toLocaleDateString("es-CO")}`}
                        </p>
                      </button>
                    ))}
                    {convAttachments.length===0&&<p className="text-[10px] text-muted-foreground">Sin adjuntos todavía.</p>}
                  </div>
                </div>
                <div className="border-t border-border"/>
                {/* Transferir solo tiene sentido en el hilo con el cliente: el
                    canal interno es de un asesor concreto por definición, un
                    ticket de soporte no se pasa a una empresa y el canal del
                    equipo de Zarpi no tiene asesores a quién pasarlo. Y solo
                    para la cuenta dueña de la empresa: es la única que puede
                    reasignar (`PUT /importadores/cotizaciones/{id}/asignar`);
                    el comprador no tiene subcuentas y el asesor no reasigna. */}
                {currentUserRole==="importadora"&&conv.type!=="interno"&&conv.type!=="soporte"&&conv.type!=="equipo"&&(<>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Transferir chat</p>
                  <div className="space-y-2">
                    <Select value={transferTo} onChange={(event)=>setTransferTo(event.target.value)}>
                      <option value="">Selecciona asesor destino</option>
                      {advisorOptions.map((email)=><option key={email} value={email}>{email}</option>)}
                    </Select>
                    <Button
                      variant="secondary"
                      size="sm"
                      fullWidth
                      icon={<MoveRight className="w-3.5 h-3.5"/>}
                      onClick={()=>{void handleTransferConversation();}}
                      loading={isTransferring}
                      disabled={!transferTo.trim()}
                    >
                      Transferir conversación
                    </Button>
                    {advisorOptions.length===0&&<p className="text-[10px] text-muted-foreground">No hay asesores activos en tu empresa.</p>}
                    {transferMessage&&<p className="text-[10px] text-emerald-600">{transferMessage}</p>}
                    {transferError&&<p className="text-[10px] text-destructive">{transferError}</p>}
                  </div>
                </div>
                <div className="border-t border-border"/>
                </>)}
                {conv.type==="cotizacion"&&refQuote&&(<>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Cotización</p>
                    <div className="space-y-1.5">{[["Código",refQuote.code],["Estado",BADGE_MAP[refQuote.status].label],["Incoterm",refQuote.incoterm],["Precio obj.",refQuote.targetPrice],["País",refQuote.country]].map(([k,v])=>(
                      <div key={k} className="flex justify-between items-start gap-1"><span className="text-[10px] text-muted-foreground">{k}</span><span className="text-[10px] font-medium text-foreground text-right">{v}</span></div>
                    ))}</div>
                    <Button variant="secondary" size="sm" fullWidth className="mt-2 text-xs" onClick={()=>onViewQuote(refQuote.id)}>Ver cotización</Button>
                  </div>
                </>)}
                {conv.type==="orden"&&refOrderId&&(<>
                  <div>
                    <input ref={orderDocumentInputRef} type="file" className="hidden" onChange={(event)=>{void handleOrderDocumentPick(event);}}/>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Operación</p>
                    <div className="space-y-1.5">{[["Código",`ORD-${refOrderId.slice(0, 8).toUpperCase()}`],["Estado",orderStateLabel(refOrder?.status)],["Canal","Chat API"]].map(([k,v])=>(
                      <div key={k} className="flex justify-between items-start gap-1"><span className="text-[10px] text-muted-foreground">{k}</span><span className="text-[10px] font-medium text-foreground text-right">{v}</span></div>
                    ))}</div>

                    {canManageOrder && (
                      <div className="mt-3 space-y-2">
                        {siguienteEstado?(
                          <Button variant="primary" size="sm" fullWidth loading={isUpdatingOrderStatus} onClick={()=>{void handleOrderStatusUpdate();}}>
                            Marcar «{siguienteEstado.label}»
                          </Button>
                        ):(
                          <p className="text-[10px] text-muted-foreground">
                            {refOrder?.status==="entregado"?"La operación ya está entregada.":"Sin siguiente estado disponible."}
                          </p>
                        )}
                        <Button variant="secondary" size="sm" fullWidth loading={isAttachingOrderDoc} icon={<Upload className="w-3.5 h-3.5"/>} onClick={()=>orderDocumentInputRef.current?.click()}>
                          Adjuntar documento
                        </Button>
                      </div>
                    )}

                    {orderActionMessage&&<p className="text-[10px] text-emerald-600 mt-2">{orderActionMessage}</p>}
                    {orderActionError&&<p className="text-[10px] text-destructive mt-2">{orderActionError}</p>}

                    <div className="mt-3 space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Documentos de la operación</p>
                      {(refOrder?.documents || []).slice(0,6).map((doc)=>(
                        <button key={`${doc.name}-${doc.date}-${doc.url}`} type="button" onClick={()=>{void abrirArchivoEnPestana(doc.url);}} className="block w-full text-left rounded-lg border border-border px-2 py-1.5 hover:bg-muted transition-colors">
                          <p className="text-[11px] font-medium truncate">{doc.name}</p>
                          <p className="text-[10px] text-muted-foreground">{doc.type || "documento"} · {doc.date}</p>
                        </button>
                      ))}
                      {(!refOrder?.documents || refOrder.documents.length===0)&&<p className="text-[10px] text-muted-foreground">Sin documentos adicionales.</p>}
                    </div>

                    <Button variant="secondary" size="sm" fullWidth className="mt-2 text-xs" onClick={()=>onViewOrder(refOrderId)}>Ver operación</Button>
                  </div>
                </>)}
              </div>
            </div>
          )}
        </div>

        <Modal
          open={Boolean(pendingResource)}
          onClose={()=>setPendingResource(null)}
          title="Vista previa del recurso"
        >
          {pendingResource && (
            <div className="space-y-4">
              <div className="flex min-h-40 items-center justify-center rounded-lg border border-border bg-muted/30 p-4">
                {resourcePreviewThumb(pendingResource) ? (
                  <img
                    src={resourcePreviewThumb(pendingResource) || ""}
                    alt={pendingResource.nombre}
                    className="max-h-56 w-full rounded-lg object-contain"
                  />
                ) : String(pendingResource.mime_type || "").toLowerCase().startsWith("video/") && resourcePreviewMediaUrl(pendingResource) ? (
                  <video
                    src={resourcePreviewMediaUrl(pendingResource) || ""}
                    controls
                    preload="metadata"
                    className="max-h-56 w-full rounded-lg border border-border bg-black"
                  />
                ) : (
                  <FormatFileIcon extension={pendingResource.extension} mimeType={pendingResource.mime_type} />
                )}
              </div>
              <div>
                <p className="truncate text-sm font-medium">{pendingResource.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {pendingResource.extension.toUpperCase()} · {pendingResource.size_bytes != null ? getReadableFileSize(pendingResource.size_bytes) : "Tamaño no disponible"}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={()=>setPendingResource(null)}>Cancelar</Button>
                <Button variant="primary" onClick={()=>{void enviarRecursoPendiente();}}>Enviar al chat</Button>
              </div>
            </div>
          )}
        </Modal>

        {previewAttachment && (
          <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl border border-border w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{previewAttachment.nombre}</p>
                  <p className="text-xs text-muted-foreground">{previewAttachment.extension.toUpperCase()} · {new Date(previewAttachment.created_at).toLocaleString("es-CO")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5"/>} onClick={()=>{void handleDownloadAttachment(previewAttachment);}}>Descargar</Button>
                  <Button variant="secondary" size="sm" onClick={()=>{void handleOpenAttachment(previewAttachment);}}>Abrir</Button>
                  <button onClick={()=>setPreviewAttachment(null)} className="w-8 h-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"><X className="w-4 h-4"/></button>
                </div>
              </div>
              <div className="p-4 overflow-auto bg-slate-50/60 flex-1">
                {previewType(previewAttachment)!=="other" && !previewObjectUrl && !previewLoadFailed && (
                  <div className="h-[40vh] flex items-center justify-center text-sm text-muted-foreground">Cargando vista previa...</div>
                )}

                {previewType(previewAttachment)!=="other" && previewLoadFailed && (
                  <div className="h-[40vh] rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-3 text-center px-6">
                    <p className="text-sm text-muted-foreground">No se pudo cargar el recurso desde el backend. Verifica permisos o disponibilidad del archivo.</p>
                  </div>
                )}
                {previewObjectUrl && previewType(previewAttachment)==="image" && (
                  <img src={previewObjectUrl} alt={previewAttachment.nombre} className="max-h-[70vh] w-auto mx-auto rounded-lg border border-border"/>
                )}
                {previewObjectUrl && previewType(previewAttachment)==="pdf" && (
                  <iframe src={previewObjectUrl} title={previewAttachment.nombre} className="w-full h-[70vh] rounded-lg border border-border bg-white"/>
                )}
                {previewObjectUrl && previewType(previewAttachment)==="video" && (
                  <video src={previewObjectUrl} controls className="w-full max-h-[70vh] rounded-lg border border-border bg-black"/>
                )}
                {previewType(previewAttachment)==="other" && (
                  <div className="h-[40vh] rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-3 text-center px-6">
                    <Video className="w-8 h-8 text-muted-foreground/40"/>
                    <p className="text-sm text-muted-foreground">Vista previa no disponible para este tipo de archivo.</p>
                    <Button variant="secondary" size="sm" onClick={()=>{void handleOpenAttachment(previewAttachment);}}>Abrir en nueva pestaña</Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <Modal
          open={isResourcePickerOpen}
          onClose={()=>setIsResourcePickerOpen(false)}
          title="Compartir recurso desde carpetas"
          width="max-w-5xl"
        >
          <div className="space-y-4">
            <input
              ref={resourceUploadInputRef}
              type="file"
              className="hidden"
              onChange={(event) => {
                void handleResourceUploadPick(event);
              }}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Input
                  value={resourceSearch}
                  onChange={(event)=>setResourceSearch(event.target.value)}
                  placeholder="Buscar recurso o carpeta por nombre..."
                  prefix={
                    resourceSearching
                      ? <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      : <Search className="w-3.5 h-3.5"/>
                  }
                />
              </div>
              <Select value={resourceTargetConversationId} onChange={(event)=>setResourceTargetConversationId(event.target.value)}>
                <option value="">Selecciona chat destino</option>
                {conversations.map((conversation)=>{
                  const importer = importers.find((row)=>row.id===conversation.importerId);
                  return <option key={conversation.id} value={conversation.id}>{conversation.refCode} · {conversation.importerName || importer?.name || "Chat"}</option>;
                })}
              </Select>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border">
                <Button
                  variant={resourceViewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setResourceViewMode("list")}
                  className={resourceViewMode === "list" ? "!bg-primary !text-white dark:!bg-accent dark:!text-black" : "hover:!bg-primary/20 hover:!text-primary dark:hover:!bg-accent/20 dark:hover:!text-accent"}
                >
                  Lista
                </Button>
                <Button
                  variant={resourceViewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  icon={<LayoutGrid className="w-3.5 h-3.5" />}
                  onClick={() => setResourceViewMode("grid")}
                  className={resourceViewMode === "grid" ? "!bg-primary !text-white dark:!bg-accent dark:!text-black" : "hover:!bg-primary/20 hover:!text-primary dark:hover:!bg-accent/20 dark:hover:!text-accent"}
                >
                  Cuadrícula
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" icon={<RotateCcw className="w-3.5 h-3.5" />} onClick={()=>{void reloadResourcePickerFolder();}}>
                  Recargar
                </Button>
                <Button size="sm" icon={<Upload className="w-3.5 h-3.5" />} loading={resourceUploading} onClick={()=>resourceUploadInputRef.current?.click()}>
                  Subir aquí
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {resourceFolderTrail.map((node,index)=>(
                <button
                  key={`${node.id || "root"}-${index}`}
                  onClick={()=>{void jumpResourceTrail(index);}}
                  className={clsx("text-xs px-2 py-1 rounded-md border",index===resourceFolderTrail.length-1?"bg-primary/10 dark:bg-accent/10 text-primary dark:text-accent border-primary/20 dark:border-accent/20":"bg-white text-muted-foreground border-border hover:text-foreground")}
                >
                  {node.name}
                </button>
              ))}
            </div>

            <div
              className="relative"
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes("Files")) {
                  event.preventDefault();
                  setResourceDropOver(true);
                }
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setResourceDropOver(false);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file) {
                  void handleUploadResourceToCurrentFolder(file);
                }
              }}
            >
              {resourceDropOver && (
                <div className="absolute inset-0 z-20 rounded-xl border-2 border-dashed border-primary bg-primary/10 flex items-center justify-center pointer-events-none">
                  <p className="text-sm font-semibold text-primary">Suelta el archivo para subirlo en esta carpeta</p>
                </div>
              )}

            <div className={clsx(
              "max-h-[58vh] overflow-y-auto pr-1",
              resourceViewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" : "space-y-2"
            )}>
              {resourceLoading&&<p className="text-sm text-muted-foreground">Cargando recursos...</p>}

              {!resourceLoading&&pickerVisibleFolders.map((folder)=>(
                <button
                  key={folder.id}
                  onClick={()=>{void openResourceFolder(folder);}}
                  className={clsx(
                    "rounded-xl border text-left transition-colors w-full",
                    folder.is_protected || folder.is_system
                      ? "doc-system-folder dark:!bg-accent/10 dark:hover:!bg-accent/20"
                      : "border-border dark:!border-sky-200/40 bg-sky-600/20 hover:bg-sky-600/40",
                    resourceViewMode === "grid" ? "p-4" : "px-3 py-2.5 flex items-center justify-between gap-3"
                  )}
                >
                  <FolderTree className={clsx("w-8 h-8", folder.is_protected || folder.is_system ? "doc-system-folder-icon" : "doc-folder-icon", resourceViewMode === "grid" ? "mb-2" : "mb-0")}/>
                  <div className={clsx("min-w-0", resourceViewMode === "grid" ? "" : "flex-1") }>
                    <p className="text-sm font-semibold truncate">{folder.nombre}</p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                      Carpeta
                      {(folder.is_protected || folder.is_system) && (
                        <span className="doc-system-badge inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                          <LockKeyhole className="w-2.5 h-2.5" />
                          Sistema
                        </span>
                      )}
                    </p>
                  </div>
                </button>
              ))}

              {!resourceLoading&&pickerVisibleFiles.map((file)=>(
                <div key={file.id} className={clsx("rounded-xl border border-border bg-white", resourceViewMode === "grid" ? "p-3" : "px-3 py-2.5 flex items-center justify-between gap-3")}>
                  <div className={clsx("rounded-lg border border-border bg-slate-50 overflow-hidden flex items-center justify-center", resourceViewMode === "grid" ? "h-24 w-full mb-2" : "w-12 h-12 flex-shrink-0")}>
                    {resourcePreviewThumb(file)
                      ? <img src={resourcePreviewThumb(file) || ""} alt={file.nombre} className="w-full h-full object-cover"/>
                      : <FormatFileIcon extension={file.extension} mimeType={file.mime_type} compact={resourceViewMode === "list"}/>}
                  </div>
                  <div className={clsx("min-w-0", resourceViewMode === "grid" ? "" : "flex-1") }>
                    <p className="text-sm font-semibold truncate">{file.nombre}</p>
                    <p className="text-xs text-muted-foreground mt-1">{file.extension.toUpperCase()} · {new Date(file.created_at).toLocaleDateString("es-CO")}</p>
                  </div>
                  <div className={clsx("flex items-center gap-1.5", resourceViewMode === "grid" ? "mt-3" : "flex-shrink-0")}>
                    <Button size="sm"
                      variant="secondary"
                      icon={<Download className="w-3.5 h-3.5"/>}
                      onClick={()=>{void handleDownloadResource(file.storage_url, file.nombre);}}>
                        Descargar
                      </Button>
                    <Button size="sm" variant="secondary" onClick={()=>{void handleOpenResource(file.storage_url, file.nombre);}}>Abrir</Button>
                    <Button size="sm" onClick={()=>{void handleShareExistingResourceToChat(file);}}>Compartir</Button>
                  </div>
                </div>
              ))}

              {!resourceLoading&&pickerVisibleFolders.length===0&&pickerVisibleFiles.length===0&&<p className="text-sm text-muted-foreground">No se encontraron recursos.</p>}
            </div>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
