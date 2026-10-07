import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Film,
  Star,
  Eye, EyeOff, Mail, Lock, UserRound, Building2, LogIn,
  Moon, Sun, Info, AlertCircle, CheckCircle2, Loader2, Package2,
  FileText, ShoppingCart, FolderOpen, CreditCard, ChevronRight,
  Plus, Search, MessageCircle, Phone, ExternalLink, ArrowUpDown,
  ChevronDown, Globe, Check, Clock, X, Upload, ChevronLeft,
  Save, Send, Users, MapPin, Tag, Layers, Building, RotateCcw,
  BadgeCheck, GitCompare, Mail as MailIcon, ClipboardList,
  Truck, Package, Anchor, Warehouse, CheckCircle, Edit2, Copy, Ban,
  TrendingUp, TrendingDown, Minus, Receipt, FileCheck, Bell,
  Scale, HelpCircle, Download, Boxes, Ship, Factory,
  PackageCheck, Navigation2, MessageSquare, Paperclip, Smile,
  Image as ImageIcon, PanelRightClose, PanelRightOpen,
  FileSpreadsheet, File as FileIcon, LayoutGrid, Award, Shield, BookOpen,
  Zap, Filter, AtSign, ChevronDown as ChevDown, FolderTree,
  MoveRight, MoreHorizontal, Video, CalendarDays as CalendarIcon,
  LockKeyhole, LifeBuoy, WalletCards, Calculator, DatabaseBackup, Gauge,
  Sparkles, LibraryBig,
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

import { Quote } from "../types/quote";
import type { ResponseFrom, ResponseStatus } from "../types/quote";
import { Importer } from "../types/importer";
import { SidebarCtrl } from "../types/portal";
import { ProtectedRoute } from "@/app/components/guards/ProtectedRoute";
import { Breadcrumb } from "@/app/components/navigation/Breadcrumb";
import { AuthScreen } from "@/features/auth/components/AuthScreen";
import { CoursesScreen } from "@/features/courses/CoursesScreen";
import { LegalPolicyScreen } from "@/features/legal/components/LegalPolicyScreen";
import type { LegalPage } from "@/features/legal/types";
import { EMPRESA } from "@/features/legal/empresa";
import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";
import { DocumentUploadButton } from "@/app/components/files/DocumentUploadButton";
import { ImagenArchivo } from "@/app/components/files/ImagenArchivo";
import { TendenciasComprador } from "@/features/tendencias/TendenciasComprador";
import { PanelCurador } from "@/features/tendencias/PanelCurador";
import type { PrefillSolicitud } from "@/features/tendencias/prefill";
import { CatalogosEmpresa } from "@/features/catalogos/CatalogosEmpresa";
import { CatalogosComprador } from "@/features/catalogos/CatalogosComprador";
import { useAuth } from "@/hooks/useAuth";
import { useAutoRefresh, type AutoRefreshReason } from "@/hooks/useAutoRefresh";
import { useChatSocket } from "@/hooks/useChatSocket";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { authService } from "@/services/auth.service";
import { resolveHeaderSubtitle } from "@/app/utils/header-profile-subtitle";
import { useBrandTheme } from "@/app/hooks/useBrandTheme";
// De este archivo ya solo se usan las buenas prácticas por rol: la FAQ vive
// ahora en la base de datos, mantenida por el equipo de soporte.
import { HELP_SUPPORT_CONTENT, normalizeHelpRole } from "@/features/help/help-support-content";
import { ayudaService, type ArticuloAyuda } from "@/services/ayuda.service";
import {
  businessService,
  type BackendArchivoItem,
  type BackendAsesor,
  type BackendChatAttachmentItem,
  type BackendChatConversation,
  type BackendMiembroEquipo,
  type BackendCotizacion,
  type BackendCupoDiario,
  type BackendExplorerResponse,
  type BackendImporter,
  type BackendOrder,
  type BackendPropuesta,
  type MotivoEleccion,
  type UnidadCantidad,
  type BackendUserProfile,
  type CreateAsesorPayload,
  type CreateCotizacionPayload,
  type CreatePropuestaPayload,
  type EstimacionEnMensaje,
  type EstimacionPrecioEntrada,
} from "@/services/business.service";
import { CalculadoraPreciosChat, TarjetaEstimacion, propuestaDesdeEstimacion, type PropuestaDesdeEstimacion } from "@/features/chat/CalculadoraPrecios";
import { getStoredRole, getStoredToken, resolveApiUrl, toApiPath } from "@/services/api-client";
import { landingService, type LandingBlock, type LandingDynamicContent, type LandingSection } from "@/services/landing.service";
import { safeHttpUrl } from "@/utils/safe-url";
import { CATEGORIAS_PRODUCTO } from "@/lib/categorias";
import { abrirArchivoEnPestana, descargarArchivo } from "@/lib/abrir-archivo";
import { ResenasImportador } from "@/features/resenas/ResenasImportador";
import { PendientesDeResena } from "@/features/resenas/PendientesDeResena";
import { PresentacionPublica, EditorPresentacion } from "@/features/importador/PresentacionEmpresa";
import { PerfilPublicoCotizanteCard } from "@/features/cotizante/PerfilPublicoCotizanteCard";
import { TierBadge } from "@/features/cotizante/TierBadge";
import { TarjetaReferidos, leerCodigoReferidoDeLaUrl } from "@/features/referidos/TarjetaReferidos";
import { PanelEmpresa } from "@/features/importador/PanelEmpresa";
import {
  componerShippingMark,
  LONGITUD_MAX_PREFIJO_SHIPPING_MARK,
  LONGITUD_MAX_SUFIJO_SHIPPING_MARK,
} from "@/lib/shipping-mark";
import type { RegisterRequest } from "@/types/auth";
import { RUTA_RESTABLECER, destinoDe, esPantalla, rutaDe, type ParamRuta, type Screen } from "@/app/rutas";
import type { UrgenciaSoporte } from "@/services/business.service";

const RESET_PASSWORD_PATH = RUTA_RESTABLECER;
const SHOW_PAYMENTS_MODULE = false;
/** Pantalla (y por tanto URL) de cada documento legal. */
const PANTALLA_LEGAL: Record<LegalPage, Screen> = {
  data: "policy-data",
  terms: "policy-terms",
  payments: "policy-payments",
};

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN SYSTEM COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

type BadgeVariant = "created"|"directed"|"open"|"accepted"|"active-order"|"neutral"|
  "rejected-importer"|"resp-nueva"|"resp-vista"|"resp-aceptada"|"resp-rechazada"|"info"|"warning"|"success";

const BADGE_MAP: Record<BadgeVariant,{label:string;cls:string;dot:string}> = {
  "created":        {label:"Creada",       cls:"bg-slate-100 text-slate-600",    dot:"bg-slate-400"},
  "directed":       {label:"Dirigida",     cls:"bg-primary/10 text-primary border border-primary/20", dot:"bg-primary"},
  "open":           {label:"Abierta",      cls:"bg-accent text-accent-foreground border border-accent/70", dot:"bg-foreground"},
  "accepted":       {label:"Aceptada",     cls:"bg-emerald-50 text-emerald-700", dot:"bg-emerald-500"},
  "active-order":   {label:"Orden activa", cls:"bg-primary text-primary-foreground border border-primary", dot:"bg-accent"},
  "rejected-importer": {label:"Rechazada por importadora", cls:"bg-rose-50 text-rose-700", dot:"bg-rose-500"},
  "neutral":        {label:"",             cls:"bg-slate-100 text-slate-600",    dot:"bg-slate-400"},
  "resp-nueva":     {label:"Nueva",        cls:"bg-accent text-accent-foreground border border-accent/70", dot:"bg-foreground"},
  "resp-vista":     {label:"Vista",        cls:"bg-primary/10 text-primary border border-primary/20", dot:"bg-primary"},
  "resp-aceptada":  {label:"Aceptada",     cls:"bg-emerald-50 text-emerald-700", dot:"bg-emerald-500"},
  "resp-rechazada": {label:"Rechazada",    cls:"bg-red-50 text-red-700",         dot:"bg-red-500"},
  "info":           {label:"",             cls:"bg-primary/10 text-primary border border-primary/20", dot:"bg-primary"},
  "warning":        {label:"",             cls:"bg-amber-50 text-amber-700",     dot:"bg-amber-500"},
  "success":        {label:"",             cls:"bg-emerald-50 text-emerald-700", dot:"bg-emerald-500"},
};

function Badge({variant,label,className}:{variant:BadgeVariant;label?:string;className?:string}) {
  const c = BADGE_MAP[variant];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap",c.cls,className)}>
      <span className={clsx("w-1.5 h-1.5 rounded-full flex-shrink-0",c.dot)}/>
      {label??c.label}
    </span>
  );
}

type BtnVariant="primary"|"secondary"|"danger"|"ghost";
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:BtnVariant; size?:"sm"|"md"|"lg";
  loading?:boolean; fullWidth?:boolean; icon?:React.ReactNode; iconRight?:React.ReactNode;
}
function Button({variant="primary",size="md",loading=false,fullWidth=false,icon,iconRight,children,className,disabled,...props}:BtnProps) {
  const base="inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none";
  const variants:Record<BtnVariant,string>={
    primary:"bg-primary text-primary-foreground hover:bg-[#3f05bc] active:bg-[#2e038a] shadow-sm",
    secondary:"bg-muted text-foreground border border-border hover:bg-accent hover:text-accent-foreground hover:border-accent active:bg-accent active:text-accent-foreground shadow-sm",
    danger:"bg-destructive text-white hover:bg-red-700 shadow-sm",
    ghost:"text-muted-foreground hover:text-foreground hover:bg-muted",
  };
  const sizes:Record<"sm"|"md"|"lg",string>={sm:"h-8 px-3 text-xs",md:"h-9 px-4 text-sm",lg:"h-10 px-5 text-sm"};
  return (
    <button className={clsx(base,variants[variant],sizes[size],fullWidth&&"w-full",className)} disabled={disabled||loading} {...props}>
      {loading?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:icon}{children}{!loading&&iconRight}
    </button>
  );
}

// ─── Unified contact action button ───────────────────────────────────────────
type ContactType="whatsapp"|"chat"|"email"|"phone";
function ContactBtn({type,size="sm",label,className,onClick,disabled,title}:{type:ContactType;size?:"sm"|"md";label?:string;className?:string;onClick?:()=>void;disabled?:boolean;title?:string}) {
  const cfg:Record<ContactType,{icon:React.FC<{className?:string}>;defaultLabel:string;cls:string}>={
    whatsapp:{icon:Phone,         defaultLabel:"WhatsApp",cls:"border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"},
    chat:    {icon:MessageCircle, defaultLabel:"Chat",    cls:"border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"},
    email:   {icon:MailIcon,      defaultLabel:"Correo",  cls:"border-slate-200 bg-white text-slate-700 hover:bg-slate-50"},
    phone:   {icon:Phone,         defaultLabel:"Llamar",  cls:"border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"},
  };
  const c=cfg[type];const Icon=c.icon;
  const iconSize=size==="sm"?"w-3.5 h-3.5":"w-4 h-4";
  return <Button variant="secondary" size={size} icon={<Icon className={iconSize}/>} className={clsx(c.cls,className)} onClick={onClick} disabled={disabled} title={title}>{label??c.defaultLabel}</Button>;
}

function normalizePhoneForWa(value:string|undefined|null):string{
  const digits=String(value||"").replace(/\D+/g,"");
  if(!digits)return "";
  if(digits.length>=10&&digits.length<=15)return digits;
  return "";
}

function openSmartContact({type,whatsapp,email,onOpenChat}:{type:ContactType;whatsapp?:string|null;email?:string|null;onOpenChat?:()=>void}){
  if(type==="chat"){
    if(onOpenChat){
      onOpenChat();
      return;
    }
    toast.error("No hay chat disponible para esta conversación.");
    return;
  }

  const wa=normalizePhoneForWa(whatsapp);
  if((type==="whatsapp"||type==="phone")&&wa){
    window.open(`https://wa.me/${wa}`, "_blank", "noopener,noreferrer");
    return;
  }

  if(type==="whatsapp"||type==="phone"){
    toast.error("No hay número de WhatsApp disponible.");
    return;
  }

  const normalizedEmail=String(email||"").trim();
  if(type==="email"&&normalizedEmail){
    window.open(`mailto:${normalizedEmail}`, "_blank", "noopener,noreferrer");
    return;
  }

  toast.error("No hay correo disponible para este contacto.");
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>,"prefix"> & {
  label?:string;error?:string;hint?:string;prefix?:React.ReactNode;suffix?:React.ReactNode;rightLabel?:React.ReactNode;
};
function Input({label,error,hint,prefix,suffix,rightLabel,className,id,...props}:InputProps) {
  const iid=id||label?.toLowerCase().replace(/\s+/g,"-");
  return (
    <div className="flex flex-col gap-1.5">
      {(label||rightLabel)&&<div className="flex items-center justify-between">
        {label&&<label htmlFor={iid} className="text-sm font-medium text-foreground">{label}</label>}
        {rightLabel}
      </div>}
      <div className="relative flex items-center">
        {prefix&&<span className="absolute left-3 text-muted-foreground flex items-center pointer-events-none">{prefix}</span>}
        <input id={iid} className={clsx("w-full h-10 bg-white border rounded-lg text-sm text-foreground placeholder:text-slate-400 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",error?"border-destructive":"border-border",prefix?"pl-9":"pl-3",suffix?"pr-10":"pr-3",className)} {...props}/>
        {suffix&&<span className="absolute right-3 text-muted-foreground flex items-center">{suffix}</span>}
      </div>
      {error&&<p className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="w-3 h-3 flex-shrink-0"/>{error}</p>}
      {hint&&!error&&<p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {label?:string;error?:string;hint?:string;}
function Textarea({label,error,hint,className,id,...props}:TextareaProps) {
  const iid=id||label?.toLowerCase().replace(/\s+/g,"-");
  return (
    <div className="flex flex-col gap-1.5">
      {label&&<label htmlFor={iid} className="text-sm font-medium text-foreground">{label}</label>}
      <textarea id={iid} className={clsx("w-full bg-white border rounded-lg text-sm text-foreground placeholder:text-slate-400 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none px-3 py-2.5",error?"border-destructive":"border-border",className)} {...props}/>
      {hint&&!error&&<p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {label?:string;}
function Select({label,children,className,id,...props}:SelectProps) {
  const iid=id||label?.toLowerCase().replace(/\s+/g,"-");
  return (
    <div className="flex flex-col gap-1.5">
      {label&&<label htmlFor={iid} className="text-sm font-medium text-foreground">{label}</label>}
      <div className="relative">
        <select id={iid} className={clsx("w-full h-10 pl-3 pr-8 bg-white border border-border rounded-lg text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer",className)} {...props}>{children}</select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none"/>
      </div>
    </div>
  );
}

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  children:React.ReactNode;
  padding?:"none"|"sm"|"md"|"lg";
};

function Card({children,className,padding="md",...props}:CardProps) {
  const p={none:"",sm:"p-4",md:"p-5",lg:"p-6"};
  return <div className={clsx("bg-white border border-border rounded-xl shadow-sm",p[padding],className)} {...props}>{children}</div>;
}

/**
 * Avatar de persona (redondo) o logo de empresa (`variant="logo"`).
 *
 * Los tamaños `2xl`/`3xl` y la variante de logo existen porque el logo de la
 * empresa se pintaba a 48 px y recortado en círculo: las marcas apaisadas
 * perdían el texto y la ficha parecía no tener logo. En `logo` la imagen se
 * escala entera (`object-contain`) sobre fondo blanco.
 */
function Avatar({initials,size="md",color="bg-primary",src,variant="avatar"}:{initials:string;size?:"sm"|"md"|"lg"|"xl"|"2xl"|"3xl";color?:string;src?:string;variant?:"avatar"|"logo"}) {
  const s={sm:"w-7 h-7 text-xs",md:"w-9 h-9 text-sm",lg:"w-10 h-10 text-sm",xl:"w-12 h-12 text-base","2xl":"w-20 h-20 text-2xl","3xl":"w-28 h-28 text-3xl"};
  const esLogo=variant==="logo";
  if(src){
    return <img src={src} alt={initials} className={clsx("flex-shrink-0 border border-border",esLogo?"rounded-xl object-contain bg-white p-1":"rounded-full object-cover",s[size])}/>;
  }
  return <div className={clsx("flex items-center justify-center font-semibold text-white flex-shrink-0",esLogo?"rounded-xl":"rounded-full",color,s[size])}>{initials}</div>;
}

function Logo() {
  const { dark } = useBrandTheme();
  return (
    <div className="flex items-center overflow-hidden">
      <img src={dark ? "/brand/zarpi-wordmark-acid.svg" : "/brand/zarpi-wordmark.svg"} alt="Zarpi" className="h-8 w-28 object-contain object-left" />
    </div>
  );
}

// ─── Enhanced Timeline ────────────────────────────────────────────────────────
interface TimelineStage {label:string;icon:React.ReactNode;status:"done"|"current"|"pending";date?:string;}

function Timeline({stages}:{stages:TimelineStage[]}) {
  return (
    <div className="relative">
      <div className="absolute left-4 top-5 bottom-5 w-0.5 bg-border"/>
      <div className="space-y-0">
        {stages.map((s,i)=>(
          <div key={i} className="flex items-start gap-3 relative">
            <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 mt-0.5",
              s.status==="done"   ?"bg-primary border-primary text-white":
              s.status==="current"?"bg-white border-primary text-primary ring-4 ring-primary/15":
              "bg-white border-border text-muted-foreground/50")}>
              {s.status==="done"?<Check className="w-3.5 h-3.5"/>:s.icon}
            </div>
            <div className={clsx("pb-5 min-w-0 flex-1",i===stages.length-1&&"pb-0")}>
              <div className="flex items-center justify-between gap-2">
                <p className={clsx("text-sm font-medium",s.status==="pending"?"text-muted-foreground":"text-foreground")}>{s.label}</p>
                {s.date&&<span className={clsx("text-xs flex-shrink-0",s.status==="pending"?"text-muted-foreground/60":"text-muted-foreground")}>{s.date}</span>}
              </div>
              {s.status==="current"&&<p className="text-xs text-primary font-medium mt-0.5">En curso</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Notification icon with badge ─────────────────────────────────────────────
function NotifIcon({icon,count=0,onClick,title}:{icon:React.ReactNode;count?:number;onClick?:()=>void;title?:string}) {
  return (
    <div className="relative">
      <button
        onClick={onClick}
        title={title}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {icon}
      </button>
      {count>0&&(
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none pointer-events-none">
          {count>9?"9+":count}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────
const QUOTES:Quote[]=[
  {id:"q001",code:"COT-2025-0089",date:"12 Mar 2025",product:"Café Verde Colombiano Premium",importer:"FoodTrade SRL",       mode:"Abierta", status:"open",        updatedAt:"Hace 2 horas", country:"Colombia",       productLine:"Alimentos",    quality:"Premium",  minQuantity:"500",  targetPrice:"8.50 USD/kg",  incoterm:"FOB"},
  {id:"q002",code:"COT-2025-0081",date:"05 Mar 2025",product:"Telas Sintéticas 400 GSM",    importer:"TextilMax Corp.",      mode:"Dirigida",status:"directed",    updatedAt:"Hace 1 día",   country:"China",          productLine:"Textil",       quality:"Estándar", minQuantity:"1000", targetPrice:"3.20 USD/m",   incoterm:"CIF"},
  {id:"q003",code:"COT-2025-0074",date:"28 Feb 2025",product:"Repuestos Motor Diesel HD",   importer:"MecanicaQ Ltda.",      mode:"Dirigida",status:"accepted",    updatedAt:"Hace 3 días",  country:"Alemania",       productLine:"Maquinaria",   quality:"Premium",  minQuantity:"50",   targetPrice:"420 USD/set",  incoterm:"DDP"},
  {id:"q004",code:"COT-2025-0068",date:"20 Feb 2025",product:"Laptops Dell Latitude 5540",  importer:"TechImport S.A.",      mode:"Abierta", status:"active-order",updatedAt:"Hace 5 días",  country:"Estados Unidos", productLine:"Tecnología",   quality:"Premium",  minQuantity:"20",   targetPrice:"950 USD/u",    incoterm:"FOB"},
  {id:"q005",code:"COT-2025-0055",date:"10 Feb 2025",product:"Aceite de Oliva Extra Virgen",importer:"FoodTrade SRL",        mode:"Abierta", status:"accepted",    updatedAt:"Hace 8 días",  country:"España",         productLine:"Alimentos",    quality:"Estándar", minQuantity:"200",  targetPrice:"12.00 USD/L",  incoterm:"CIF"},
  {id:"q006",code:"COT-2025-0043",date:"01 Feb 2025",product:"Válvulas Industriales ANSI",  importer:"IndustrialK S.A.",     mode:"Dirigida",status:"created",     updatedAt:"Hace 12 días", country:"Japón",          productLine:"Maquinaria",   quality:"Estándar", minQuantity:"100",  targetPrice:"85 USD/u",     incoterm:"EXW"},
  {id:"q007",code:"COT-2025-0031",date:"20 Ene 2025",product:"Fertilizantes NPK 20-20-20", importer:"AgroSur Trading",      mode:"Abierta", status:"directed",    updatedAt:"Hace 18 días", country:"India",          productLine:"Agroindustria",quality:"Estándar", minQuantity:"5000", targetPrice:"0.45 USD/kg",  incoterm:"CFR"},
  {id:"q008",code:"COT-2025-0017",date:"08 Ene 2025",product:"Cámaras CCTV IP 4K Dahua",   importer:"SecureVision Corp",    mode:"Dirigida",status:"active-order",updatedAt:"Hace 26 días", country:"China",          productLine:"Tecnología",   quality:"Premium",  minQuantity:"30",   targetPrice:"180 USD/u",    incoterm:"CIF"},
];

const IMPORTERS:Importer[]=[
  {id:"nexus",     name:"Grupo Nexus S.A.",  specialty:"Tecnología & Electrónica",rating:4.8,responseTime:"~24h",initials:"GN",color:"bg-blue-600",   memberSince:"Ene 2020",projects:147,verified:true, country:"Colombia",      categories:["Tecnología","Electrónica"],  advisor:{name:"Carlos Mendoza", role:"Asesor Senior",     initials:"CM",color:"bg-blue-600",   email:"c.mendoza@nexus.co"}},
  {id:"textil",    name:"TextilMax Corp.",   specialty:"Textiles & Confección",   rating:4.6,responseTime:"~36h",initials:"TM",color:"bg-purple-600", memberSince:"Mar 2021",projects:89, verified:true, country:"China",         categories:["Textil","Confección"],       advisor:{name:"Laura Gómez",    role:"Asesora Comercial", initials:"LG",color:"bg-purple-600", email:"l.gomez@textilmax.co"}},
  {id:"food",      name:"FoodTrade SRL",     specialty:"Alimentos & Bebidas",     rating:4.9,responseTime:"~18h",initials:"FT",color:"bg-emerald-600",memberSince:"Jun 2019",projects:213,verified:true, country:"España",        categories:["Alimentos","Bebidas"],       advisor:{name:"Andrés Peña",    role:"Asesor Principal",  initials:"AP",color:"bg-emerald-600", email:"a.pena@foodtrade.co"}},
  {id:"mecanica",  name:"MecanicaQ Ltda.",   specialty:"Maquinaria & Repuestos",  rating:4.5,responseTime:"~48h",initials:"MQ",color:"bg-orange-600", memberSince:"Sep 2022",projects:54, verified:false,country:"Alemania",      categories:["Maquinaria","Industrial"],   advisor:{name:"Juliana Ríos",   role:"Asesora Técnica",   initials:"JR",color:"bg-orange-600", email:"j.rios@mecanicaq.co"}},
  {id:"agro",      name:"AgroSur Trading",   specialty:"Agroindustria & Insumos", rating:4.7,responseTime:"~30h",initials:"AS",color:"bg-lime-600",   memberSince:"Nov 2020",projects:102,verified:true, country:"Brasil",        categories:["Agroindustria","Química"],   advisor:{name:"Miguel Castillo",role:"Asesor Agro",       initials:"MC",color:"bg-lime-600",   email:"m.castillo@agrosur.co"}},
  {id:"techimport",name:"TechImport S.A.",   specialty:"Tecnología & Cómputo",    rating:4.4,responseTime:"~40h",initials:"TI",color:"bg-cyan-600",   memberSince:"Abr 2021",projects:67, verified:true, country:"Estados Unidos",categories:["Tecnología","Software"],     advisor:{name:"Raúl Herrera",   role:"Asesor Tech",       initials:"RH",color:"bg-cyan-600",   email:"r.herrera@techimport.co"}},
  {id:"industrialk",name:"IndustrialK S.A.", specialty:"Industria & Manufactura", rating:4.3,responseTime:"~52h",initials:"IK",color:"bg-slate-600",  memberSince:"Jul 2020",projects:38, verified:false,country:"Japón",         categories:["Industrial","Maquinaria"],   advisor:{name:"Paola Vásquez", role:"Asesora Industrial",initials:"PV",color:"bg-slate-600",  email:"p.vasquez@industrialk.co"}},
  {id:"secvision", name:"SecureVision Corp", specialty:"Seguridad & Vigilancia",  rating:4.6,responseTime:"~28h",initials:"SV",color:"bg-rose-600",   memberSince:"Feb 2022",projects:81, verified:true, country:"China",         categories:["Tecnología","Seguridad"],    advisor:{name:"Diego Salazar",  role:"Asesor Seguridad",  initials:"DS",color:"bg-rose-600",   email:"d.salazar@secvision.co"}},
];

const IMP_DESCRIPTIONS:Record<string,string>={
  nexus:      "Especialistas en electrónica de consumo e industrial. Presencia en Corea, China y EE.UU. con capacidad de distribución global.",
  textil:     "Confección a gran escala con certificación OEKO-TEX. Producción propia en China continental y control de calidad integral.",
  food:       "Alimentos gourmet y de consumo masivo. Red logística refrigerada en Europa con trazabilidad completa desde origen.",
  mecanica:   "Repuestos OEM y aftermarket para maquinaria pesada. Garantía extendida de 24 meses y soporte técnico especializado.",
  agro:       "Insumos agrícolas y fertilizantes orgánicos certificados. Experiencia exportando a más de 12 países de Latinoamérica.",
  techimport: "Tecnología corporativa y consumer. Distribuidor autorizado de marcas globales con soporte técnico local en Colombia.",
  industrialk:"Componentes industriales bajo especificación JIT. Fabricación a medida y gestión de inventario en planta.",
  secvision:  "Sistemas de vigilancia IP y analítica de video con IA. Toda la línea certificada CE, IP67 y FCC.",
};

const IMP_CERTS:Record<string,string[]>={
  nexus:       ["ISO 9001","CE"],
  textil:      ["OEKO-TEX","ISO 14001"],
  food:        ["FDA","HACCP"],
  mecanica:    ["ISO 9001","DIN"],
  agro:        ["USDA Organic","GlobalG.A.P."],
  techimport:  ["Apple Auth.","MS Partner"],
  industrialk: ["ISO 9001","JIS"],
  secvision:   ["CE","IP67"],
};

interface QuoteResponse {id:string;importerId:string;quoteId:string;price:string;deliveryTime:string;incoterm:string;date:string;status:ResponseStatus;moq:string;origin:string;production:string;customization:string;observations:string;}

const RESPONSES:QuoteResponse[]=[
  {id:"r001",importerId:"nexus",    quoteId:"q001",price:"9.20 USD/kg", deliveryTime:"28 días",incoterm:"FOB",date:"14 Mar 2025",status:"resp-nueva",    moq:"300 kg",  origin:"Colombia",production:"Propia",     customization:"Marca blanca",             observations:"Café lavado, proceso húmedo, tostado medio."},
  {id:"r002",importerId:"food",     quoteId:"q001",price:"8.80 USD/kg", deliveryTime:"21 días",incoterm:"CIF",date:"13 Mar 2025",status:"resp-vista",    moq:"500 kg",  origin:"Colombia",production:"Tercerizada",customization:"Estándar",                 observations:"Stock disponible inmediato."},
  {id:"r003",importerId:"textil",   quoteId:"q002",price:"3.45 USD/m",  deliveryTime:"45 días",incoterm:"CIF",date:"08 Mar 2025",status:"resp-vista",    moq:"800 m",   origin:"China",   production:"Propia",     customization:"Personalización completa", observations:"Certificación OEKO-TEX disponible."},
  {id:"r004",importerId:"mecanica", quoteId:"q003",price:"398 USD/set", deliveryTime:"60 días",incoterm:"DDP",date:"03 Mar 2025",status:"resp-aceptada", moq:"10 sets", origin:"Alemania",production:"OEM",        customization:"Estándar",                 observations:"Garantía 24 meses incluida."},
  {id:"r005",importerId:"secvision",quoteId:"q008",price:"165 USD/u",   deliveryTime:"35 días",incoterm:"CIF",date:"12 Ene 2025",status:"resp-aceptada", moq:"10 u",    origin:"China",   production:"Propia",     customization:"Marca blanca",             observations:"Certificación CE e IP67."},
];

interface OrderHistoryItem {estado:string;fecha:string;nota:string|null;}
interface OrderDocumentItem {name:string;date:string;status:string;url:string;type:string;}
interface LifecycleDocItem {label:string;name:string;status:string;url:string|null;source:string;}
interface Order {
  id:string;
  code:string;
  quoteCode:string;
  product:string;
  importerId:string;
  created:string;
  estimated:string;
  quantity:string;
  unitPrice:string;
  totalValue:string;
  incoterm:string;
  originPort:string;
  destPort:string;
  /** Marca de embarque congelada al crear la orden: lo que va rotulado en las cajas. */
  shippingMark?:string|null;
  status:string;
  history:OrderHistoryItem[];
  documents:OrderDocumentItem[];
  conversationId?:string;
}

const ORDER_LIFECYCLE_STEPS=[
  {key:"solicitud_enviada",label:"Solicitud enviada",icon:<Send className="w-3.5 h-3.5"/>},
  {key:"proveedor_respondio",label:"Proveedor respondió",icon:<ClipboardList className="w-3.5 h-3.5"/>},
  {key:"negociacion_en_curso",label:"Negociación en curso",icon:<Scale className="w-3.5 h-3.5"/>},
  {key:"orden_confirmada_produccion",label:"Orden confirmada / Producción",icon:<Factory className="w-3.5 h-3.5"/>},
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
const ORDER_STATES=[
  {key:"cotizacion_aceptada",     label:"Cotización aceptada"},
  {key:"en_produccion",           label:"En producción"},
  {key:"transito_internacional",  label:"Tránsito internacional"},
  {key:"aduana_nacionalizacion",  label:"Aduana / nacionalización"},
  {key:"bodega_local",            label:"Bodega local"},
  {key:"entregado",               label:"Entregado"},
] as const;

const ORDER_DOCUMENT_LABELS:Record<string,string>={
  factura_proforma:"Factura proforma",
  factura_comercial:"Factura comercial",
  packing_list:"Packing list",
  comprobante_pago:"Comprobante de pago",
};

function orderDocumentTypeLabel(tipo:string|undefined|null):string{
  return ORDER_DOCUMENT_LABELS[String(tipo||"")]||"Documento";
}

function orderStateLabel(key:string|undefined|null):string{
  const found=ORDER_STATES.find((s)=>s.key===String(key||""));
  return found?found.label:(key?String(key):"Sin estado");
}

/** Único estado al que el backend deja avanzar desde el actual (cadena lineal). */
function nextOrderState(current:string|undefined|null):{key:string;label:string}|null{
  const index=ORDER_STATES.findIndex((s)=>s.key===String(current||""));
  if(index<0||index>=ORDER_STATES.length-1)return null;
  const next=ORDER_STATES[index+1];
  return {key:next.key,label:next.label};
}

function inferLifecycleStageIndex(rawState:string|undefined|null):number{
  const normalized=String(rawState||"").trim().toLowerCase();
  if(!normalized)return 0;
  if(normalized.includes("entreg"))return 8;
  if(normalized.includes("ruta"))return 7;
  if(normalized.includes("bodega"))return 6;
  if(normalized.includes("aduan"))return 5;
  if(normalized.includes("transit")||normalized.includes("enviad"))return 4;
  if(normalized.includes("produ")||normalized.includes("orden")||normalized.includes("proceso"))return 3;
  if(normalized.includes("negoci"))return 2;
  if(normalized.includes("respond")||normalized.includes("propuesta")||normalized.includes("respuesta"))return 1;
  return 0;
}

function buildLifecycleTimeline(currentStageIndex:number):TimelineStage[]{
  const bounded=Math.max(0,Math.min(ORDER_LIFECYCLE_STEPS.length-1,currentStageIndex));
  return ORDER_LIFECYCLE_STEPS.map((step,index)=>({
    label:step.label,
    icon:step.icon,
    status:index<bounded?"done":index===bounded?"current":"pending",
  }));
}

// ─── Chat data ────────────────────────────────────────────────────────────────
// "interno" es el canal de la empresa con su asesor (coordinación del equipo);
// "soporte" es un ticket con el equipo de la plataforma. Ninguno de los dos
// cuelga de una cotización o una orden.
type ChatType="orden"|"cotizacion"|"interno"|"soporte"|"equipo";

const URGENCIA_SOPORTE:Record<string,{label:string;clase:string;peso:number}>={
  critica:{label:"Crítica", clase:"bg-red-100 text-red-800 border-red-200",       peso:4},
  alta:   {label:"Alta",    clase:"bg-orange-100 text-orange-800 border-orange-200", peso:3},
  media:  {label:"Media",   clase:"bg-amber-100 text-amber-800 border-amber-200",  peso:2},
  baja:   {label:"Baja",    clase:"bg-slate-100 text-slate-700 border-slate-200",  peso:1},
};

interface ChatConv {
  id:string;type:ChatType;refCode:string;refId:string;importerId:string;
  // `refId` pasa a apuntar a la orden en cuanto existe; la cotización se guarda
  // aparte porque es lo que identifica al responsable que se puede reasignar.
  // Ambos van vacíos en los hilos internos y en los de soporte.
  quoteId:string;
  cotizanteTier?:string;
  counterpartName?:string;
  counterpartId?:string;
  counterpartRole?:string;
  counterpartCompany?:string;
  counterpartPhotoUrl?:string;
  // Solo en tickets de soporte.
  subject?:string;
  urgency?:string;
  requesterRole?:string;
  closed?:boolean;
  resolution?:string;
  closedBy?:string;
  level?:number;
  agentId?:string;
  agentName?:string;
  agentLevel?:number;
  rating?:number;
  ratingComment?:string;
  importerName?:string;
  advisorName?:string;
  advisorRole?:string;
  advisorEmail?:string;
  advisorPhone?:string;
  advisorInitials?:string;
  advisorColor?:string;
  status:"activa"|"archivada";unread:number;lastMsg:string;lastDate:string;
}
type MsgFileType="pdf"|"excel"|"word"|"image";
interface MsgFile {name:string;type:MsgFileType;size:string;}
interface ChatMsg {
  id:string;sender:"client"|"provider";text?:string;file?:MsgFile;
  time:string;read:boolean;dateGroup?:string;
  // Precio estimado enviado con la calculadora (`tipo: "estimacion"`).
  estimate?:EstimacionEnMensaje;
}

/** `sender: "client"` es el usuario que mira la pantalla, sea del rol que sea. */
function mapBackendChatMessage(
  message:{id:string;remitente_id:string;contenido:string;tipo:string;fecha_envio:string;metadata:Record<string,unknown>|null},
  currentUserId:string|undefined,
):ChatMsg{
  const estimacion=message.tipo==="estimacion"?message.metadata?.estimacion:undefined;
  const estimate=estimacion&&typeof estimacion==="object"&&"desglose" in estimacion&&"entrada" in estimacion
    ?estimacion as EstimacionEnMensaje
    :undefined;
  return {
    id:message.id,
    sender:message.remitente_id===currentUserId?"client":"provider",
    text:message.contenido,
    time:new Date(message.fecha_envio).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"}),
    read:true,
    estimate,
  };
}

const INCOTERMS=["EXW","FCA","FAS","FOB","CFR","CIF","CPT","CIP","DAP","DPU","DDP"];
const COUNTRIES=["China","Estados Unidos","Alemania","Japón","India","Italia","Francia","España","Brasil","Corea del Sur","Turquía","México","Colombia"];
// Una sola lista para la línea de producto que pide el cliente y para las
// categorías que declara la empresa: eran dos listas distintas y el backend
// compara ambas para decidir si la empresa puede responder. Ver
// `src/lib/categorias.ts`.
const LINES=CATEGORIAS_PRODUCTO;
const ALL_CATEGORIES=CATEGORIAS_PRODUCTO;
const SYSTEM_ROOT_FOLDER_NAMES=["Órdenes","Cotizaciones","Respuestas","Cursos","Chats","Certificados"];
// Buzón al que escribe quien quiere dar de alta una empresa importadora: el
// alta la hace el equipo de la plataforma, no hay auto-registro.
const CORREO_ADMINISTRACION="administracion@importacionesq8.com";

function normalizeFolderName(value:string):string{
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getFileFormatToken(extension: string, mimeType: string): { label: string; classes: string } {
  const ext = String(extension || "").trim().toLowerCase();
  const mime = String(mimeType || "").toLowerCase();

  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) {
    return { label: "IMG", classes: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700" };
  }
  if (mime.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(ext)) {
    return { label: "VID", classes: "border-indigo-200 bg-indigo-50 text-indigo-700" };
  }
  if (ext === "pdf") {
    return { label: "PDF", classes: "border-red-200 bg-red-50 text-red-700" };
  }
  if (["xlsx", "xls", "csv"].includes(ext)) {
    return { label: "XLS", classes: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }
  if (["doc", "docx", "odt", "rtf"].includes(ext)) {
    return { label: "DOC", classes: "border-blue-200 bg-blue-50 text-blue-700" };
  }
  if (["ppt", "pptx"].includes(ext)) {
    return { label: "PPT", classes: "border-amber-200 bg-amber-50 text-amber-700" };
  }

  const fallback = (ext || "FILE").slice(0, 4).toUpperCase();
  return { label: fallback, classes: "border-slate-200 bg-slate-100 text-slate-700" };
}

function FormatFileIcon({ extension, mimeType, compact = false }: { extension: string; mimeType: string; compact?: boolean }) {
  const token = getFileFormatToken(extension, mimeType);
  return (
    <div
      className={clsx(
        "rounded-lg border font-semibold tracking-wide flex items-center justify-center",
        compact ? "w-10 h-10 text-[10px]" : "w-12 h-12 text-[11px]",
        token.classes,
      )}
      title={`Formato ${token.label}`}
      aria-label={`Formato ${token.label}`}
    >
      {token.label}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR — pinned / floating / toggle tab
// ─────────────────────────────────────────────────────────────────────────────
const NAV_ITEMS=[
  {icon:LayoutGrid,   label:"Dashboard",    key:"dashboard"},
  {icon:FileText,     label:"Cotizaciones", key:"quotes"},
  {icon:Sparkles,     label:"Tendencias",   key:"tendencias"},
  {icon:LibraryBig,   label:"Catálogos",    key:"catalogos"},
  {icon:ClipboardList,label:"Respuestas",   key:"responses"},
  {icon:MessageSquare,label:"Chats",        key:"chats"},
  {icon:ShoppingCart, label:"Órdenes",      key:"orders"},
  {icon:BookOpen,     label:"Cursos",       key:"courses"},
  {icon:FolderOpen,   label:"Documentos",   key:"documentos"},
  {icon:CreditCard,   label:"Pagos",        key:"pagos"},
];

const NAV_IMPORTADORA=[
  {icon:LayoutGrid,    label:"Dashboard",    key:"imp-dashboard"},
  {icon:FileText,      label:"Solicitudes",  key:"imp-quotes"},
  {icon:Users,         label:"Asesores",     key:"imp-advisors"},
  {icon:Building2,     label:"Mi empresa",   key:"imp-profile"},
  {icon:LibraryBig,    label:"Catálogos",    key:"imp-catalogos"},
  {icon:ShoppingCart,  label:"Órdenes",      key:"orders"},
  {icon:MessageSquare, label:"Chats",        key:"chats"},
  {icon:BookOpen,      label:"Cursos",       key:"courses"},
  {icon:FolderOpen,    label:"Documentos",   key:"documentos"},
];

const NAV_ASESOR=[
  {icon:LayoutGrid,    label:"Dashboard",       key:"adv-dashboard"},
  {icon:Zap,           label:"Disponibles",     key:"adv-available"},
  {icon:ClipboardList, label:"Mis cotizaciones",key:"adv-my-quotes"},
  {icon:LibraryBig,    label:"Catálogos",       key:"imp-catalogos"},
  {icon:MessageSquare, label:"Chats",           key:"chats"},
];

// ─── Portal data ──────────────────────────────────────────────────────────────
// "soporte" es el equipo de atención al cliente de la plataforma: atiende los
// tickets y resuelve incidentes, pero no administra (ni empresas, ni cuentas,
// ni certificaciones, ni copias de seguridad).
type UserRole="solicitante"|"importadora"|"asesor"|"admin"|"soporte";

// Cada área del panel es una entrada del sidebar, igual que en los demás
// perfiles: así se navega con el mismo mecanismo que el resto de la aplicación
// y cada una tiene su propia URL.
const NAV_ADMIN=[
  {icon:LayoutGrid,    label:"Resumen",         key:"admin-dashboard"},
  {icon:Building2,     label:"Empresas",        key:"admin-empresas"},
  {icon:GitCompare,    label:"Asignación",      key:"admin-asignacion"},
  {icon:Users,         label:"Usuarios",        key:"admin-usuarios"},
  {icon:WalletCards,   label:"Cotizantes",      key:"admin-cotizantes"},
  {icon:Mail,          label:"Correos",         key:"admin-correos"},
  {icon:LifeBuoy,      label:"Soporte",         key:"admin-soporte"},
  {icon:Award,         label:"Certificaciones", key:"admin-certificaciones"},
  {icon:DatabaseBackup,label:"Respaldos",       key:"admin-respaldos"},
  {icon:Layers,        label:"Landing",         key:"admin-landing"},
  {icon:Sparkles,      label:"Tendencias",      key:"curaduria"},
  {icon:MessageSquare, label:"Chats",           key:"chats"},
  {icon:FolderOpen,    label:"Documentos",      key:"documentos"},
];

// El equipo de atención solo ve lo suyo: la bandeja de tickets y la sección de
// soporte del panel (incidentes y conversaciones). Nada de altas ni respaldos.
const NAV_SOPORTE=[
  {icon:LifeBuoy,      label:"Bandeja",     key:"admin-soporte"},
  {icon:MessageSquare, label:"Tickets",     key:"chats"},
  {icon:FolderOpen,    label:"Documentos",  key:"documentos"},
];

type StoredRole = "solicitante" | "importador" | "importadora" | "asesor" | "admin" | "soporte";

function normalizeStoredRole(role: string | null): UserRole | "admin" | null {
  if (!role) {
    return null;
  }

  const normalizedRole = role
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalizedRole === "importador" || normalizedRole === "importadora") {
    return "importadora";
  }

  if (
    normalizedRole === "admin"
    || normalizedRole === "administrador"
    || normalizedRole === "superadmin"
    || normalizedRole === "admin_role"
  ) {
    return "admin";
  }

  if (normalizedRole === "solicitante" || normalizedRole === "asesor" || normalizedRole === "soporte") {
    return normalizedRole;
  }

  return null;
}

function getHomeScreenForRole(role: UserRole | "admin"): Screen {
  if (role === "importadora") {
    return "imp-dashboard";
  }
  if (role === "asesor") {
    return "adv-dashboard";
  }
  if (role === "admin") {
    return "admin-dashboard";
  }
  if (role === "soporte") {
    // Su trabajo empieza en la bandeja de incidentes y tickets.
    return "admin-soporte";
  }
  return "dashboard";
}

function formatShortDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value;
  }
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function initialsFromName(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "IM";
}

function importerColorFromId(id: string): string {
  const palette = [
    "bg-blue-600",
    "bg-emerald-600",
    "bg-cyan-600",
    "bg-orange-600",
    "bg-slate-600",
    "bg-rose-600",
    "bg-indigo-600",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i)) % 997;
  }
  return palette[hash % palette.length];
}

/** Lee una clave de `perfil_publico` sin asumir su forma (es JSON libre). */
function readPerfilPublicoString(perfil: Record<string, unknown> | null | undefined, ...claves: string[]): string {
  for (const clave of claves) {
    const valor = perfil?.[clave];
    if (typeof valor === "string" && valor.trim()) {
      return valor.trim();
    }
  }
  return "";
}

function readPerfilPublicoStringArray(perfil: Record<string, unknown> | null | undefined, ...claves: string[]): string[] {
  for (const clave of claves) {
    const valor = perfil?.[clave];
    if (Array.isArray(valor)) {
      return valor.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    }
  }
  return [];
}

/**
 * Convierte lo que la empresa escribió en «Sitio web» en un href navegable.
 *
 * Casi nadie escribe el esquema: el campo llega como "miempresa.com" y un
 * `<a href="miempresa.com">` navega a una ruta relativa de la propia
 * plataforma. Se antepone `https://` y se descarta cualquier cosa que no acabe
 * siendo http(s) (defensa en profundidad: el texto lo escribe la empresa).
 */
function enlaceSitioWeb(valor: string | null | undefined): string {
  const limpio = String(valor ?? "").trim();
  if (!limpio) {
    return "";
  }
  const conEsquema = /^[a-z][a-z0-9+.-]*:\/\//i.test(limpio) ? limpio : `https://${limpio}`;
  return safeHttpUrl(conEsquema);
}

/** Texto del enlace: sin esquema ni "www.", que es como se lee una web. */
function etiquetaSitioWeb(valor: string | null | undefined): string {
  return String(valor ?? "")
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}

function resolveImporterAdvisorProfile(perfil: Record<string, unknown> | null | undefined, companyName: string) {
  const advisorName =
    readPerfilPublicoString(perfil, "advisor_name", "asesor_nombre", "contact_name", "nombre_contacto") ||
    "Asesor asignado";
  const advisorRole =
    readPerfilPublicoString(perfil, "advisor_role", "asesor_rol", "cargo_contacto", "contact_role") ||
    "Asesor";
  const advisorEmail = readPerfilPublicoString(perfil, "advisor_email", "asesor_email", "email", "correo");
  const advisorPhone = readPerfilPublicoString(perfil, "advisor_phone", "asesor_telefono", "phone", "telefono", "whatsapp");

  return {
    advisorName,
    advisorRole,
    advisorEmail,
    advisorPhone,
    advisorInitials: initialsFromName(advisorName || companyName),
  };
}

function mapBackendImporterToUi(imp: BackendImporter): Importer {
  const primaryCategory = imp.especialidad_producto[0] ?? "General";
  const primaryCountry = imp.paises_origen[0] ?? "N/A";
  const name = imp.nombre_empresa;
  const perfil = imp.perfil_publico ?? null;
  const tierMinimoRequerido = readPerfilPublicoString(perfil, "tier_minimo_requerido") || imp.tier_minimo_requerido || "Bronze";
  const advisorProfile = resolveImporterAdvisorProfile(perfil, name);
  return {
    description: readPerfilPublicoString(perfil, "descripcion", "description", "about"),
    certs: readPerfilPublicoStringArray(perfil, "certs", "certificaciones"),
    bannerUrl: readPerfilPublicoString(perfil, "banner_url", "banner"),
    logoUrl: imp.logo_url ?? "",
    // Ficha corporativa: la empresa ya rellenaba estos campos en su perfil,
    // pero nadie los leía, así que no aparecían en ninguna pantalla pública.
    website: readPerfilPublicoString(perfil, "website", "sitio_web", "web"),
    email: readPerfilPublicoString(perfil, "email", "correo", "email_contacto"),
    phone: readPerfilPublicoString(perfil, "phone", "telefono", "whatsapp"),
    address: readPerfilPublicoString(perfil, "address", "direccion"),
    foundedYear: readPerfilPublicoString(perfil, "year", "anio_fundacion", "fundacion"),
    industries: readPerfilPublicoStringArray(perfil, "industries", "industrias", "sectores"),
    platformCerts: (imp.certificaciones ?? []).map((cert) => ({
      id: cert.certificacion_id,
      nombre: cert.nombre,
      descripcion: cert.descripcion || "",
      logoUrl: cert.logo_url || "",
      peso: Number(cert.peso_publicidad || 0),
    })),
    adScore: Number(imp.puntaje_publicidad || 0),
    id: imp.id,
    name,
    specialty: `${primaryCategory} internacional`,
    rating: Number(imp.calificacion_promedio || 0),
    responseTime: imp.tiempo_respuesta_promedio || "~48h",
    initials: initialsFromName(name),
    color: importerColorFromId(imp.id),
    memberSince: formatShortDate(imp.fecha_registro),
    // Órdenes entregadas que cuenta el backend. Antes era un 0 fijo y todas las
    // empresas se presentaban como si no hubieran cerrado ni un proyecto.
    projects: Number(imp.proyectos_completados ?? 0),
    verified: Boolean(imp.verificado),
    country: primaryCountry,
    categories: imp.especialidad_producto.length > 0 ? imp.especialidad_producto : ["General"],
    tierMinimoRequerido: ["Bronze", "Silver", "Gold", "Élite"].includes(tierMinimoRequerido) ? tierMinimoRequerido as Importer["tierMinimoRequerido"] : "Bronze",
    shippingMarkPrefix: imp.shipping_mark_prefijo ?? undefined,
    advisor: {
      name: advisorProfile.advisorName,
      role: advisorProfile.advisorRole,
      initials: advisorProfile.advisorInitials,
      color: "bg-slate-600",
      email: advisorProfile.advisorEmail,
      phone: advisorProfile.advisorPhone,
    },
  };
}

function backendEstadoToUi(estado: string): Quote["status"] {
  switch (estado) {
    case "creada":
      return "created";
    case "dirigida":
      return "directed";
    case "abierta":
      return "open";
    case "aceptada":
      return "accepted";
    case "orden_activa":
      return "active-order";
    default:
      return "created";
  }
}

function mapBackendQuoteToUi(cot: BackendCotizacion, importers: Importer[]): Quote {
  const importerName = cot.importador_id
    ? importers.find((imp) => imp.id === cot.importador_id)?.name ?? "Importadora"
    : "Red abierta";
  const currency = parseTargetPriceCurrency(cot.precio_objetivo_moneda ?? cot.moneda_precio_objetivo ?? "USD");
  const targetPriceValue = Number.isFinite(cot.precio_objetivo_usd as number) ? Number(cot.precio_objetivo_usd) : null;

  return {
    id: cot.id,
    code: `COT-${cot.id.slice(0, 8).toUpperCase()}`,
    date: formatShortDate(cot.fecha_creacion),
    product: cot.nombre_producto,
    importer: importerName,
    importadorId: cot.importador_id,
    mode: cot.modalidad === "dirigida" ? "Dirigida" : "Abierta",
    status: backendEstadoToUi(cot.estado),
    updatedAt: formatShortDate(cot.fecha_actualizacion),
    country: cot.pais_importacion,
    productLine: cot.linea_producto,
    quality: cot.tipo_calidad,
    minQuantity: String(cot.cantidad_minima),
    unit: cot.unidad_cantidad === "m3" ? "m3" : "unidades",
    targetPrice: targetPriceValue !== null ? `${targetPriceValue} ${currency}` : "N/A",
    targetPriceCurrency: currency,
    incoterm: cot.incoterm || "DDP",
    description: cot.descripcion_cliente,
    notes: cot.notas_adicionales ?? "",
    referenceLink: cot.link_referencia ?? "",
    productPhotoUrls: cot.fotos_producto?.length ? cot.fotos_producto : (cot.foto_producto ? [cot.foto_producto] : []),
    personalizationLevel: cot.nivel_personalizacion ?? "",
    importMode: cot.modalidad_importacion ?? "",
    shippingMark: cot.shipping_mark ?? null,
    shippingMarkSufijo: cot.shipping_mark_sufijo ?? null,
    customFields: cot.campos_personalizados_valores ?? null,
    requesterId: cot.solicitante_id,
    tierMinimoRequerido: cot.tier_minimo_requerido ?? "Bronze",
    solicitanteTier: cot.solicitante_tier ?? "Bronze",
    solicitantePuntosCotizacion: cot.solicitante_puntos_cotizacion ?? 0,
    bloqueada: Boolean(cot.bloqueada),
  };
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function findCustomFieldValue(customFields: Record<string, unknown> | null | undefined, aliases: string[]): string {
  if (!customFields) {
    return "";
  }

  const entries = Object.entries(customFields);
  const match = entries.find(([key, value]) => {
    const normalizedKey = normalizeText(key);
    if (aliases.some((alias) => normalizedKey.includes(alias))) {
      return true;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      const label = normalizeText(nested.label ?? nested.nombre ?? nested.name ?? "");
      return aliases.some((alias) => label.includes(alias));
    }

    return false;
  });

  if (!match) {
    return "";
  }

  const rawValue = match[1];
  if (typeof rawValue === "string" || typeof rawValue === "number") {
    return String(rawValue);
  }

  if (Array.isArray(rawValue)) {
    return rawValue.map((item) => String(item)).join(", ");
  }

  if (rawValue && typeof rawValue === "object") {
    const nested = rawValue as Record<string, unknown>;
    const possible = nested.valor ?? nested.value ?? nested.url ?? nested.archivo ?? nested.adjunto;
    if (possible) {
      return String(possible);
    }
  }

  return "";
}

/** Miniaturas de las fotos del producto; al pulsar una se abre completa. */
function GaleriaFotosProducto({fotos}:{fotos:string[]}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">Fotos del producto ({fotos.length})</p>
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {fotos.map((url,i)=>(
          <button key={url} type="button" onClick={()=>{void abrirArchivoEnPestana(url).then(r=>{if(!r.ok)toast.error(r.motivo||"No se pudo abrir la foto.");});}} className="aspect-square rounded-lg overflow-hidden border border-border hover:ring-2 hover:ring-primary/40 transition" title={`Ver foto ${i+1}`}>
            <ImagenArchivo src={url} alt={`Foto ${i+1} del producto`} className="w-full h-full"/>
          </button>
        ))}
      </div>
    </div>
  );
}

function getQuoteAttachmentLinks(quote: Quote): string[] {
  const links = new Set<string>();
  const maybePushLink = (value: unknown) => {
    const text = String(value ?? "").trim();
    if (!text) {
      return;
    }
    if (/^https?:\/\//i.test(text)) {
      links.add(text);
    }
  };

  (quote.productPhotoUrls ?? []).forEach(maybePushLink);
  maybePushLink(quote.referenceLink);

  const custom = quote.customFields;
  if (custom && typeof custom === "object") {
    Object.entries(custom).forEach(([key, value]) => {
      const normalizedKey = normalizeText(key);
      if (!/(archivo|adjunto|file|url|imagen|foto|link)/.test(normalizedKey)) {
        return;
      }

      if (typeof value === "string") {
        maybePushLink(value);
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => maybePushLink(item));
        return;
      }

      if (value && typeof value === "object") {
        const nested = value as Record<string, unknown>;
        maybePushLink(nested.url);
        maybePushLink(nested.link);
        maybePushLink(nested.archivo);
        maybePushLink(nested.adjunto);
        maybePushLink(nested.imagen);
        maybePushLink(nested.foto);
      }
    });
  }

  return Array.from(links);
}

const LOCAL_HIDDEN_OPEN_QUOTES_KEY = "advisor_hidden_open_quotes_by_company";
const LOCAL_QUOTE_STATUS_OVERRIDES_KEY = "quote_status_overrides";

function loadHiddenOpenQuotesByCompany(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(LOCAL_HIDDEN_OPEN_QUOTES_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveHiddenOpenQuotesByCompany(payload: Record<string, string[]>): void {
  localStorage.setItem(LOCAL_HIDDEN_OPEN_QUOTES_KEY, JSON.stringify(payload));
}

function loadQuoteStatusOverrides(): Record<string, Quote["status"]> {
  try {
    const raw = localStorage.getItem(LOCAL_QUOTE_STATUS_OVERRIDES_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, Quote["status"]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveQuoteStatusOverrides(payload: Record<string, Quote["status"]>): void {
  localStorage.setItem(LOCAL_QUOTE_STATUS_OVERRIDES_KEY, JSON.stringify(payload));
}

function applyQuoteStatusOverride(quote: Quote, overrides: Record<string, Quote["status"]>): Quote {
  const override = overrides[quote.id];
  if (!override) {
    return quote;
  }
  return {
    ...quote,
    status: override,
  };
}

function mapBackendAdvisorToUi(a: BackendAsesor): CompanyAdvisor {
  const name = a.nombre || a.email;
  return {
    id: a.id,
    name,
    role: "Asesor",
    email: a.email,
    phone: a.telefono || "",
    initials: initialsFromName(name),
    color: "bg-slate-600",
    status: a.activo ? "activo" : "inactivo",
    availability: a.activo ? "media" : "baja",
    activeQuotes: 0,
    avgResponse: "~24h",
    joinDate: formatShortDate(a.fecha_creacion),
  };
}

function mapProposalEstadoToResponseStatus(estado: string): ResponseStatus {
  if (estado === "aceptada") return "resp-aceptada";
  if (estado === "rechazada") return "resp-rechazada";
  if (estado === "enviada") return "resp-vista";
  return "resp-nueva";
}

function mapBackendProposalToUiResponse(p: BackendPropuesta): QuoteResponse {
  return {
    id: p.id,
    importerId: p.importador_id,
    quoteId: p.cotizacion_id,
    price: `${p.precio_ofrecido_usd} USD`,
    deliveryTime: p.tiempo_estimado_entrega,
    incoterm: p.incoterm,
    date: formatShortDate(new Date().toISOString()),
    status: mapProposalEstadoToResponseStatus(p.estado),
    moq: "N/A",
    origin: "N/A",
    production: "N/A",
    customization: p.condiciones_adicionales || "Sin personalización",
    observations: p.condiciones_adicionales || "Sin observaciones",
  };
}

function mapBackendOrderToUiOrder(order: BackendOrder, quote?: Quote): Order {
  const code = `ORD-${order.id.slice(0, 8).toUpperCase()}`;
  // El backend no ordena el historial (la relación sale en orden de clave, que
  // es un UUID aleatorio), así que llegaba mezclado: se ordena por fecha para
  // que el seguimiento se lea de arriba abajo y `created` sea la creación real.
  const history = (order.historial_estados ?? [])
    .slice()
    .sort((a, b) => String(a.fecha_cambio).localeCompare(String(b.fecha_cambio)))
    .map((item) => ({
      estado: item.estado_nuevo,
      fecha: item.fecha_cambio,
      // De dónde venía, para poder leer el salto en el seguimiento.
      nota: item.estado_anterior ? `Desde ${orderStateLabel(item.estado_anterior)}` : null,
    }));
  const documents = (order.documentos_adjuntos ?? []).map((doc) => ({
    name: doc.nombre,
    // El backend no fecha los documentos de la orden; mostrar una fecha
    // inventada sería peor que no mostrar ninguna.
    date: "",
    status: doc.url ? "Disponible" : "Pendiente",
    url: doc.url,
    type: doc.tipo,
  }));

  return {
    id: order.id,
    code,
    quoteCode: quote?.code || `COT-${order.cotizacion_id.slice(0, 8).toUpperCase()}`,
    product: quote?.product || "Producto no disponible",
    importerId: order.importador_id,
    created: formatShortDate(history[0]?.fecha || new Date().toISOString()),
    estimated: order.tiempo_estimado_entrega || "N/D",
    quantity: quote?.minQuantity ? cantidadConUnidad(quote.minQuantity, quote.unit, true) : "N/D",
    unitPrice: `${order.precio_acordado_usd} USD/u`,
    totalValue: `${order.precio_acordado_usd} USD`,
    incoterm: quote?.incoterm || "N/D",
    originPort: "N/D",
    destPort: "N/D",
    shippingMark: order.shipping_mark ?? null,
    status: order.estado,
    history,
    documents,
    conversationId: order.conversacion_id || undefined,
  };
}

function extractFirstNumber(value: string | null | undefined): number {
  const match = String(value ?? "").match(/(\d+(?:[.,]\d+)?)/);
  if (!match) {
    return 0;
  }

  const parsed = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed);
}

interface CompanyAdvisor {
  id:string;name:string;role:string;email:string;phone:string;
  initials:string;color:string;status:"activo"|"inactivo"|"ausente";
  availability:"alta"|"media"|"baja";activeQuotes:number;avgResponse:string;joinDate:string;
}

const COMPANY_ADVISORS:CompanyAdvisor[]=[
  {id:"adv1",name:"Carlos Mendoza",role:"Asesor Senior",email:"c.mendoza@nexus.co",phone:"+57 310 123 4567",initials:"CM",color:"bg-blue-600",status:"activo",availability:"alta",activeQuotes:4,avgResponse:"~20h",joinDate:"Ene 2022"},
  {id:"adv2",name:"Laura Gómez",role:"Asesora Comercial",email:"l.gomez@nexus.co",phone:"+57 311 234 5678",initials:"LG",color:"bg-purple-600",status:"activo",availability:"media",activeQuotes:2,avgResponse:"~32h",joinDate:"Mar 2022"},
  {id:"adv3",name:"Andrés Peña",role:"Asesor Técnico",email:"a.pena@nexus.co",phone:"+57 312 345 6789",initials:"AP",color:"bg-emerald-600",status:"ausente",availability:"baja",activeQuotes:0,avgResponse:"~48h",joinDate:"Jul 2023"},
  {id:"adv4",name:"Juliana Ríos",role:"Asesora Junior",email:"j.rios@nexus.co",phone:"+57 313 456 7890",initials:"JR",color:"bg-orange-600",status:"inactivo",availability:"baja",activeQuotes:0,avgResponse:"—",joinDate:"Nov 2023"},
];

interface AppNotification {
  id:string;type:"response"|"message"|"status"|"order"|"document"|"advisor"|"update";
  title:string;body:string;date:string;read:boolean;
  cotizacionId?:string;conversationId?:string;approval?:boolean;
  /** Pantalla a la que lleva la notificación cuando no es de una cotización ni de un chat. */
  destino?:"tendencias"|"catalogos";
}

const INIT_NOTIFICATIONS:AppNotification[]=[];

function mapBackendNotificationTypeToUi(type: string): AppNotification["type"] {
  if (type === "chat") return "message";
  if (type === "orden") return "order";
  if (type === "cotizacion" || type === "propuesta" || type === "negociacion") return "response";
  if (type === "curso") return "document";
  if (type === "sistema") return "update";
  return "status";
}

function mapBackendNotificationToUi(notification: { id: string; tipo: string; titulo: string; mensaje: string; fecha_creacion: string; leida: boolean; data?: Record<string, unknown> | null; }, companyName?: string): AppNotification {
  const data = notification.data || {};
  const cotizacionId = typeof data.cotizacion_id === "string" ? data.cotizacion_id : undefined;
  const conversationId = typeof data.conversacion_id === "string" ? data.conversacion_id : undefined;
  const approval = notification.tipo === "negociacion" || /cotizaci[oó]n aprobada/i.test(notification.titulo);
  const company = companyName || (typeof data.nombre_empresa === "string" ? data.nombre_empresa : "la empresa importadora");
  const title = approval ? "Cotización Aprobada" : notification.titulo;
  const body = approval && cotizacionId
    ? `Tu cotización con ID ${cotizacionId} para la empresa ${company} ha sido aprobada. Se ha abierto un chat directo donde encontrarás las instrucciones y siguientes pasos para continuar.`
    : notification.mensaje;
  return {
    id: notification.id,
    type: mapBackendNotificationTypeToUi(notification.tipo),
    title,
    body,
    date: formatShortDate(notification.fecha_creacion),
    read: notification.leida,
    cotizacionId,
    conversationId,
    approval,
    destino: notification.tipo === "tendencias" ? "tendencias" : notification.tipo === "catalogo" ? "catalogos" : undefined,
  };
}

type NavItem={icon:React.FC<{className?:string}>;label:string;key:string};

function Sidebar({active,onNav,pinned,onToggle,navItems,onLogout,onSoporte,showSoporte,onCanalEquipo,showCanalEquipo}:SidebarCtrl) {
  const { dark } = useBrandTheme();
  const [hovered,setHovered]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>>(null);
  const floating=!pinned&&hovered;
  const isExpanded=pinned||hovered;

  function onEnter(){timer.current=setTimeout(()=>setHovered(true),60);}
  function onLeave(){if(timer.current)clearTimeout(timer.current);setHovered(false);}

  return (
    <div
      className={clsx("relative flex-shrink-0 transition-all duration-250 ease-in-out h-screen",pinned?"w-52":"w-14")}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className={clsx(
        "flex flex-col bg-white border-r border-border h-full",
        "transition-all duration-250 ease-in-out overflow-hidden",
        floating
          ? "absolute top-0 left-0 z-50 shadow-2xl shadow-black/10 w-52"
          : pinned ? "w-full" : "w-14"
      )}>
        <div className={clsx("flex items-center h-[57px] border-b border-sidebar-border",isExpanded?"px-4":"justify-center px-0")}>
          <img src={dark ? (isExpanded ? "/brand/zarpi-wordmark-acid.svg" : "/brand/zarpi-isotipo-acid.svg") : (isExpanded ? "/brand/zarpi-wordmark.svg" : "/brand/zarpi-isotipo.svg")} alt="Zarpi" className={clsx("object-contain object-left transition-all duration-200",isExpanded?"h-8 w-28":"h-8 w-8")} />
        </div>

        <nav className="flex flex-col gap-0.5 p-2 mt-1 flex-1">
          {navItems.map(({ icon: Icon, label, key }) => {
            const isActive = active === key;
            return (
              <button
                key={key}
                onClick={() => onNav(key)}
                className={clsx(
                  "flex items-center rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150 w-full",
                  isActive
                    ? "bg-primary/8 text-primary dark:bg-accent/15 dark:text-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  isExpanded ? "gap-2.5" : "justify-center gap-0"
                )}
                title={!isExpanded ? label : undefined}
              >
                <Icon className={clsx("w-4 h-4 flex-shrink-0", isActive && "text-primary dark:text-accent")} />
                <div className={clsx("overflow-hidden transition-all duration-200", isExpanded ? "w-auto opacity-100" : "w-0 opacity-0")}>
                  <span className="whitespace-nowrap">{label}</span>
                </div>
                {isExpanded && isActive && (
                  <span className="ml-auto w-1 h-4 rounded-full bg-primary dark:bg-accent flex-shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-2 border-t border-border">
          {/* Vía directa con el equipo de la plataforma. Va en el pie y no en el
              menú porque no es una sección de la aplicación, sino una acción. */}
          {showSoporte&&(
            <button
              onClick={onSoporte}
              className={clsx(
                "flex items-center rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150 w-full mb-1",
                "text-muted-foreground hover:text-foreground hover:bg-muted",
                isExpanded ? "gap-2.5" : "justify-center gap-0",
              )}
              title={!isExpanded ? "Soporte técnico" : undefined}
            >
              <LifeBuoy className="w-4 h-4 flex-shrink-0"/>
              <div className={clsx("overflow-hidden transition-all duration-200",isExpanded?"w-auto opacity-100":"w-0 opacity-0")}>
                <span className="whitespace-nowrap">Soporte técnico</span>
              </div>
            </button>
          )}
          {/* El equipo de la plataforma no se abre tickets a sí mismo: su vía
              es el canal interno con administración y con sus compañeros. */}
          {showCanalEquipo&&(
            <button
              onClick={onCanalEquipo}
              className={clsx(
                "flex items-center rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150 w-full mb-1",
                "text-muted-foreground hover:text-foreground hover:bg-muted",
                isExpanded ? "gap-2.5" : "justify-center gap-0",
              )}
              title={!isExpanded ? "Canal del equipo" : undefined}
            >
              <Users className="w-4 h-4 flex-shrink-0"/>
              <div className={clsx("overflow-hidden transition-all duration-200",isExpanded?"w-auto opacity-100":"w-0 opacity-0")}>
                <span className="whitespace-nowrap">Canal del equipo</span>
              </div>
            </button>
          )}
          <button
            onClick={onLogout}
            className={clsx(
              "flex items-center rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150 w-full",
              "text-muted-foreground hover:text-foreground hover:bg-muted",
              isExpanded ? "gap-2.5" : "justify-center gap-0",
            )}
            title={!isExpanded ? "Cerrar sesion" : undefined}
          >
            <LogIn className="w-4 h-4 flex-shrink-0 rotate-180"/>
            <div className={clsx("overflow-hidden transition-all duration-200",isExpanded?"w-auto opacity-100":"w-0 opacity-0")}>
              <span className="whitespace-nowrap">Cerrar sesion</span>
            </div>
          </button>
        </div>
      </div>

      <button
        onClick={onToggle}
        className={clsx(
          "absolute top-1/2 -translate-y-1/2 right-0 translate-x-full z-[60]",
          "w-4 h-10 bg-white border border-l-0 border-border",
          "rounded-r-md flex items-center justify-center",
          "shadow-sm hover:bg-slate-50 transition-all duration-150",
          "focus-visible:outline-none",
          (!pinned && hovered) ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
        title={pinned?"Contraer menú":"Fijar expandido"}
      >
        <div className={clsx("transition-transform duration-250",pinned?"":"rotate-180")}>
          <ChevronLeft className="w-2.5 h-2.5 text-muted-foreground"/>
        </div>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SOPORTE TÉCNICO — formulario de apertura de ticket
// ─────────────────────────────────────────────────────────────────────────────
function SoporteModal({open,onClose,onSubmit}:{open:boolean;onClose:()=>void;onSubmit:(datos:{asunto:string;urgencia:UrgenciaSoporte;mensaje:string})=>Promise<void>}) {
  const [asunto,setAsunto]=useState("");
  const [urgencia,setUrgencia]=useState<UrgenciaSoporte>("media");
  const [mensaje,setMensaje]=useState("");
  const [enviando,setEnviando]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    if(open){
      setAsunto("");setUrgencia("media");setMensaje("");setError("");
    }
  },[open]);

  async function enviar(){
    if(asunto.trim().length<5){
      setError("Describe el asunto en al menos 5 caracteres.");
      return;
    }
    setError("");
    setEnviando(true);
    try{
      await onSubmit({asunto:asunto.trim(),urgencia,mensaje:mensaje.trim()});
    }catch(err){
      setError(err instanceof Error?err.message:"No se pudo abrir la solicitud.");
    }finally{
      setEnviando(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Pedir soporte técnico">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Abre una conversación con el equipo de Zarpi. Se atiende por urgencia, así que
          marca la que corresponda de verdad.
        </p>
        <Input
          label="Asunto"
          placeholder="Ej. No puedo subir el packing list de mi orden"
          value={asunto}
          onChange={e=>setAsunto(e.target.value)}
        />
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Urgencia</label>
          <div className="grid grid-cols-4 gap-2">
            {(["baja","media","alta","critica"] as UrgenciaSoporte[]).map((nivel)=>(
              <button
                key={nivel}
                type="button"
                onClick={()=>setUrgencia(nivel)}
                className={clsx(
                  "rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                  urgencia===nivel?URGENCIA_SOPORTE[nivel].clase:"bg-white border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {URGENCIA_SOPORTE[nivel].label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Cuéntanos qué pasa (opcional)</label>
          <textarea
            value={mensaje}
            onChange={e=>setMensaje(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Qué intentabas hacer, qué viste y desde qué pantalla."
            className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        {error&&<p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={enviando} onClick={()=>{void enviar();}}>Enviar solicitud</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP HEADER
// ─────────────────────────────────────────────────────────────────────────────
function AppHeader({user,notifCount=0,onNotif,onProfile,sb}:{user:{name:string;company:string;initials:string;photoUrl?:string};notifCount?:number;onNotif?:()=>void;onProfile?:()=>void;sb?:SidebarCtrl}) {
  const { dark, toggleTheme } = useBrandTheme();
  const { user: authUser } = useAuth();
  const count=sb?.notifCount??notifCount;
  const handler=sb?.onNotif??onNotif;
  const profileHandler=sb?.onProfile??onProfile;
  const chatHandler=sb?.onChat;
  const helpHandler=sb?.onHelp;
  const chatCount=sb?.chatCount??0;
  const showHelp=sb?.showHelp??true;
  const displayName = authUser?.nombre?.trim() || authUser?.email || user.name;
  const displayCompany = sb?.profileSubtitle || user.company || authUser?.email || "";
  const initialsSource = authUser?.nombre?.trim() || authUser?.email || user.name;
  const displayInitials = initialsFromName(initialsSource);
  const authUserPhoto = (authUser as { foto_url?: string | null } | null)?.foto_url || "";
  const displayPhotoUrl = authUserPhoto || sb?.profilePhotoUrl || user.photoUrl || "";
  const creditos = Number((authUser as { puntos_cotizacion?: number } | null)?.puntos_cotizacion ?? 0);
  return (
    <header className="h-[57px] flex items-center justify-between px-5 bg-white border-b border-border flex-shrink-0">
      {/* LADO IZQUIERDO */}
      <div className="flex items-center">
        {authUser?.rol === "solicitante" && (
          <span
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-primary dark:border-accent/30 dark:text-accent"
            title="Créditos disponibles. 1 crédito te permite enviar una cotización gratuita a una empresa de mayor categoría (Plata, Oro, etc.)."
          >
            <WalletCards className="h-3.5 w-3.5" />
            {creditos}
          </span>
        )}
      </div>

      {/* LADO DERECHO */}
      <div className="flex items-center gap-1">
        <div className="relative">
          <button onClick={handler} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            <Bell className="w-4 h-4"/>
          </button>
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none pointer-events-none">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </div>

        <NotifIcon icon={<MessageCircle className="w-4 h-4"/>} count={chatCount} onClick={chatHandler} title="Ir a chats"/>

        {showHelp && <NotifIcon icon={<HelpCircle className="w-4 h-4"/>} count={0} onClick={helpHandler} title="Ayuda y soporte"/>}

        <button
          onClick={toggleTheme}
          title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          aria-label={dark ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground dark:hover:bg-accent dark:hover:text-accent-foreground active:bg-primary/90 dark:active:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {dark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
        </button>

        <div className="w-px h-5 bg-border mx-2"/>

        <div className="flex items-center gap-2.5">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-foreground leading-tight">{displayName}</p>
            <p className="text-xs text-muted-foreground leading-tight">{displayCompany}</p>
          </div>
          <button onClick={profileHandler} title="Editar perfil">
            <Avatar initials={displayInitials} size="md" src={displayPhotoUrl ? resolveApiUrl(displayPhotoUrl) : undefined}/>
          </button>
        </div>
      </div>
    </header>
  );
}

const USER={name:"Ana García",company:"Importaciones del Norte S.A.",initials:"AG"};
const USER_IMPORTADORA={name:"María López",company:"Grupo Nexus S.A.",initials:"ML"};
const USER_ASESOR={name:"Carlos Mendoza",company:"Grupo Nexus S.A. — Asesor",initials:"CM"};

function CoursesPortalScreen({
  sb,
  role,
  headerUser,
  companyName,
  onGoDashboard,
}:{
  sb: SidebarCtrl;
  role: "solicitante" | "importadora";
  headerUser: { name: string; company: string; initials: string };
  companyName: string;
  onGoDashboard: () => void;
}) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="courses"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={headerUser} sb={sb}/>
        <CoursesScreen role={role} companyName={companyName} onGoDashboard={onGoDashboard}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTER CARD — used in Dashboard and profile screens
// ─────────────────────────────────────────────────────────────────────────────
function ImporterCard({
  imp,
  onViewProfile,
  onCreateQuote,
  featured = false,
}: {
  imp: Importer;
  onViewProfile: (id: string) => void;
  onCreateQuote: (id: string) => void;
  featured?: boolean;
}) {
  const desc =
    imp.description ||
    IMP_DESCRIPTIONS[imp.id] ||
    "Importadora con experiencia en comercio internacional.";

  const certs =
    imp.certs && imp.certs.length > 0
      ? imp.certs
      : IMP_CERTS[imp.id] || [];

  const platformCerts = imp.platformCerts ?? [];
  const bannerUrl = imp.bannerUrl ? resolveApiUrl(imp.bannerUrl) : "";
  const logoUrl = imp.logoUrl ? resolveApiUrl(imp.logoUrl) : "";

  return (
    <div
      className={clsx(
        "bg-white border rounded-xl p-4 flex flex-col min-h-[420px] hover:shadow-md transition-all duration-200 group",
        featured
          ? "border-primary/20 shadow-sm ring-1 ring-primary/10 landing-glow"
          : "border-border"
      )}
    >
      {/* CONTENIDO SUPERIOR */}
      <div className="flex flex-col gap-3.5">
        {/* Banner */}
        <div className="relative">
          <div
            className={clsx(
              "h-16 rounded-lg overflow-hidden border border-border",
              bannerUrl
                ? "bg-slate-100"
                : "bg-muted"
            )}
          >
            {bannerUrl && (
              <img
                src={bannerUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* El logo se apoya sobre el banner y es la única marca visual de la
              empresa en el catálogo: a 40 px no se distinguía una de otra. */}
          <div className="absolute -bottom-7 left-3 w-16 h-16 rounded-xl ring-2 ring-white overflow-hidden bg-white border border-border flex items-center justify-center">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`Logo de ${imp.name}`}
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <Avatar initials={imp.initials} size="lg" color={imp.color} variant="logo" />
            )}
          </div>
        </div>

        {/* Header */}
        <div className="flex items-start gap-3 mt-5">
          <div className="w-16" />

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1.5 flex-wrap">
              <p className="font-semibold text-sm leading-tight">
                {imp.name}
              </p>

              {imp.verified && (
                <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
              )}

              {featured && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-semibold">
                  <Award className="w-2.5 h-2.5" />
                  Destacada
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-0.5">
              {imp.specialty}
            </p>

            <p className="text-xs text-muted-foreground/70 mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {imp.country}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {(platformCerts.length + certs.length) > 0 && (
              <div className="flex items-center gap-1 text-emerald-700">
                <Shield className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">
                  {platformCerts.length + certs.length}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span className="text-xs">{imp.responseTime}</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {desc}
        </p>

        {/* Categories + certs */}
        <div className="flex flex-wrap gap-1.5">
          {imp.categories.map((c) => (
            <span
              key={c}
              className="px-2 py-0.5 bg-muted rounded-md text-[10px] font-medium text-muted-foreground"
            >
              {c}
            </span>
          ))}

          {platformCerts.map((c) => (
            <span
              key={c.id}
              title={c.descripcion || `Respaldado por Zarpi`}
              className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-md text-[10px] font-semibold text-primary flex items-center gap-1"
            >
              {c.logoUrl ? (
                <img
                  src={resolveApiUrl(c.logoUrl)}
                  alt=""
                  className="w-3 h-3 object-contain"
                />
              ) : (
                <BadgeCheck className="w-2.5 h-2.5" />
              )}

              {c.nombre}
            </span>
          ))}

          {certs.map((c) => (
            <span
              key={c}
              className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-md text-[10px] font-medium text-emerald-700 flex items-center gap-1"
            >
              <Shield className="w-2.5 h-2.5" />
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* CONTENIDO INFERIOR */}
      <div className="mt-auto">
        {/* Stats */}
        <div className="flex items-center gap-4 py-2.5 border-t border-border">
          <div className="flex items-center gap-1.5">
            <Package2 className="w-3 h-3 text-muted-foreground/60" />
            <span className="text-xs text-muted-foreground">
              {imp.projects} proyectos
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-muted-foreground/60" />
            <span className="text-xs text-muted-foreground">
              Desde {imp.memberSince}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            onClick={() => onViewProfile(imp.id)}
          >
            Ver perfil
          </Button>

          <Button
            variant="primary"
            size="sm"
            fullWidth
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => onCreateQuote(imp.id)}
          >
            Cotizar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD SCREEN — importer marketplace catalog
// ─────────────────────────────────────────────────────────────────────────────
function DashboardScreen({sb,onViewProfile,onCreateQuote,importers}:{sb:SidebarCtrl;onViewProfile:(id:string)=>void;onCreateQuote:(id:string)=>void;importers:Importer[]}) {
  const [search,setSearch]=useState("");
  const [catFilter,setCatFilter]=useState<string>("Todas");
  // Sustituye al viejo filtro por calificación: se filtra por empresas con
  // certificaciones registradas, que es un dato real y no una nota inventada.
  const [certFilter,setCertFilter]=useState("");
  const [countryFilter,setCountryFilter]=useState("");

  const filtered=importers.filter(imp=>{
    const ms=!search||[imp.name,imp.specialty,...imp.categories].some(v=>v.toLowerCase().includes(search.toLowerCase()));
    const mc=catFilter==="Todas"||imp.categories.some(c=>c.toLowerCase()===catFilter.toLowerCase());
    const certs=imp.certs??[];
    const sellos=(imp.platformCerts??[]).map(c=>c.nombre);
    const todas=[...sellos,...certs];
    const mr=!certFilter||(certFilter==="certificadas"?todas.length>0:todas.some(c=>c===certFilter));
    const mco=!countryFilter||imp.country===countryFilter;
    return ms&&mc&&mr&&mco;
  });

  const certOptions=[...new Set(importers.flatMap(i=>[...(i.platformCerts??[]).map(c=>c.nombre),...(i.certs??[])]))].sort();
  // El backend ya devuelve el catálogo ordenado por peso publicitario, así que
  // basta con tomar las primeras: son las que más respaldo tienen.
  const featured=importers.filter(i=>(i.platformCerts??[]).length>0||i.verified).slice(0,3);
  const quickCats=["Todas","Tecnología","Textil","Alimentos","Maquinaria","Agroindustria","Industrial","Seguridad"];
  const responseHours=importers
    .map((imp)=>{
      const match=imp.responseTime.match(/(\d+(?:[\.,]\d+)?)/);
      return match?Number(match[1].replace(",",".")):null;
    })
    .filter((value):value is number=>value!==null&&!Number.isNaN(value));
  const avgResponseHours=responseHours.length>0?Math.round(responseHours.reduce((acc,value)=>acc+value,0)/responseHours.length):null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="dashboard"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Page header */}
          <div>
            <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav("dashboard")},{label:"Dashboard"}]}/>
            <div className="mt-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Marketplace de importadores</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Encuentra y contacta empresas importadoras verificadas para tu negocio.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{importers.filter(i=>i.verified).length} verificadas · {importers.length} en total</span>
              </div>
            </div>
          </div>

         {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {label:"Importadoras activas",value:importers.length.toString(),icon:<Building2 className="w-4 h-4"/>,color:"text-primary dark:text-[#EDF953]"},
              {label:"Verificadas",value:importers.filter(i=>i.verified).length.toString(),icon:<BadgeCheck className="w-4 h-4"/>,color:"text-emerald-600 dark:text-emerald-400"},
              {label:"Respaldadas por Q8",value:importers.filter(i=>(i.platformCerts??[]).length>0).length.toString(),icon:<Shield className="w-4 h-4"/>,color:"text-emerald-600 dark:text-emerald-400"},
              {label:"Tiempo prom. respuesta",value:avgResponseHours!==null?`~${avgResponseHours}h`:"N/D",icon:<Zap className="w-4 h-4"/>,color:"text-violet-600 dark:text-[#EDF953]"},
            ].map(s=>(
              <Card 
                key={s.label} 
                padding="md" 
                className="metric-card flex flex-col gap-2 transition-all duration-300 dark:bg-[#EDF953]/10 dark:border-[#EDF953]/25 dark:shadow-[0_0_15px_rgba(237,249,83,0.15)]"
              >
                <div className={clsx("metric-icon w-7 h-7 rounded-lg flex items-center justify-center dark:bg-[#EDF953]/20", s.color)}>
                  {s.icon}
                </div>
                <p className="text-xl font-semibold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </Card>
            ))}
          </div>

          {/* Featured */}
          {!search&&catFilter==="Todas"&&!certFilter&&!countryFilter&&(
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-4 h-4 text-amber-500"/>
                <h2 className="text-sm font-semibold">Empresas destacadas</h2>
                <span className="text-xs text-muted-foreground">· Con mayor respaldo de Zarpi</span>
              </div>
              <div className="grid grid-flow-col auto-cols-[85%] gap-4 overflow-x-auto pb-2 md:grid-flow-row md:auto-cols-auto md:grid-cols-2 lg:grid-cols-3 md:overflow-visible">
                {featured.map(imp=>(
                  <ImporterCard key={imp.id} imp={imp} featured onViewProfile={onViewProfile} onCreateQuote={onCreateQuote}/>
                ))}
              </div>
            </div>
          )}

          {/* Search + filters */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <Input placeholder="Buscar por nombre, especialidad o categoría..." value={search} onChange={e=>setSearch(e.target.value)} prefix={<Search className="w-4 h-4"/>}/>
              </div>
              <div className="w-44">
                <Select value={certFilter} onChange={e=>setCertFilter(e.target.value)}>
                  <option value="">Certificación</option>
                  <option value="certificadas">Con certificaciones</option>
                  {certOptions.map(c=><option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div className="w-40">
                <Select value={countryFilter} onChange={e=>setCountryFilter(e.target.value)}>
                  <option value="">País</option>
                  {[...new Set(importers.map(i=>i.country))].map(c=><option key={c}>{c}</option>)}
                </Select>
              </div>
              {(search||certFilter||countryFilter||catFilter!=="Todas")&&(
                <Button variant="ghost" size="sm" icon={<RotateCcw className="w-3.5 h-3.5"/>} onClick={()=>{setSearch("");setCertFilter("");setCountryFilter("");setCatFilter("Todas");}}>Limpiar</Button>
              )}
            </div>

            {/* Category tabs */}
            <div className="flex gap-1.5 flex-wrap">
              {quickCats.map(cat=>(
                <button key={cat} onClick={()=>setCatFilter(cat)}
                  className={clsx("px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
                    catFilter===cat?"bg-primary text-white shadow-sm":"bg-white border border-border text-muted-foreground hover:text-foreground hover:border-primary/30")}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          <div>
            <p className="text-sm text-muted-foreground mb-4"><span className="font-medium text-foreground">{filtered.length}</span> importadoras {catFilter!=="Todas"&&`en ${catFilter}`}</p>
            {filtered.length===0?(
              <Card padding="lg" className="border-dashed">
                <div className="flex flex-col items-center text-center py-8 gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center"><Search className="w-6 h-6 text-muted-foreground/40"/></div>
                  <div><p className="font-semibold">Sin resultados</p><p className="text-sm text-muted-foreground mt-1">Intenta con otros filtros o términos de búsqueda.</p></div>
                </div>
              </Card>
            ):(
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(imp=>(
                  <ImporterCard key={imp.id} imp={imp} onViewProfile={onViewProfile} onCreateQuote={onCreateQuote}/>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/** Sitio web, correo, teléfono, dirección y año de fundación de la empresa. */
function DatosDeContactoEmpresa({imp}:{imp:Importer}) {
  const sitio=enlaceSitioWeb(imp.website);
  const filas:Array<{icono:React.ReactNode;etiqueta:string;valor:React.ReactNode}>=[];

  if(sitio){
    filas.push({
      icono:<Globe className="w-3.5 h-3.5"/>,
      etiqueta:"Sitio web",
      valor:<a href={sitio} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{etiquetaSitioWeb(imp.website)}</a>,
    });
  }
  if(imp.email){
    filas.push({
      icono:<MailIcon className="w-3.5 h-3.5"/>,
      etiqueta:"Correo",
      valor:<a href={`mailto:${imp.email}`} className="text-primary hover:underline break-all">{imp.email}</a>,
    });
  }
  if(imp.phone){
    filas.push({icono:<Phone className="w-3.5 h-3.5"/>,etiqueta:"Teléfono",valor:<span className="break-all">{imp.phone}</span>});
  }
  if(imp.address){
    filas.push({icono:<MapPin className="w-3.5 h-3.5"/>,etiqueta:"Dirección",valor:<span>{imp.address}</span>});
  }
  if(imp.foundedYear){
    filas.push({icono:<CalendarIcon className="w-3.5 h-3.5"/>,etiqueta:"Fundada en",valor:<span>{imp.foundedYear}</span>});
  }

  if(filas.length===0){
    return null;
  }

  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Building2 className="w-4 h-4 text-primary"/>Datos de la empresa</h3>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
        {filas.map(f=>(
          <div key={f.etiqueta} className="flex items-start gap-2.5 min-w-0">
            <span className="text-muted-foreground mt-0.5 flex-shrink-0">{f.icono}</span>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{f.etiqueta}</p>
              <p className="text-sm text-foreground mt-0.5">{f.valor}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTER PROFILE SCREEN — read-only public profile for the requester
// ─────────────────────────────────────────────────────────────────────────────
function ImporterProfileScreen({importerId,onBack,onCreateQuote,onOpenChat,sb,importers,chats,orders}:{
  importerId:string;onBack:()=>void;onCreateQuote:(id:string)=>void;onOpenChat:(convId:string)=>void;sb:SidebarCtrl;importers:Importer[];chats:ChatConv[];orders:Order[];
}) {
  const imp=importers.find(i=>i.id===importerId)||importers[0]||IMPORTERS[0];
  // Lo que la empresa configuró en su perfil manda; los textos de ejemplo solo
  // se usan para las importadoras de demostración, que no tienen perfil real.
  const desc=imp.description||IMP_DESCRIPTIONS[imp.id]||"Esta empresa aún no ha publicado su descripción.";
  const certs=(imp.certs&&imp.certs.length>0)?imp.certs:(IMP_CERTS[imp.id]||[]);
  const platformCerts=imp.platformCerts??[];
  const bannerUrl=imp.bannerUrl?resolveApiUrl(imp.bannerUrl):"";
  const logoUrl=imp.logoUrl?resolveApiUrl(imp.logoUrl):"";
  const relQuotes=QUOTES.filter(q=>q.importer===imp.name);
  const relOrders=orders.filter(o=>o.importerId===imp.id);
  const relChats=chats.filter(c=>c.importerId===imp.id);

  const ADVISORS=[
    imp.advisor,
    {name:"Suplente "+imp.advisor.name.split(" ")[1], role:"Asesor Jr.", initials:imp.advisor.initials[0]+"S", color:"bg-slate-500", email:"suplente@"+imp.id+".co"},
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="dashboard"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <Breadcrumb items={[{label:"Inicio",onClick:onBack},{label:"Dashboard",onClick:onBack},{label:imp.name}]}/>

          {/* Banner de portada: primera impresión de la empresa para el solicitante */}
          {bannerUrl&&(
            <div className="mt-4 rounded-2xl overflow-hidden border border-border bg-muted/40">
              <img
                src={bannerUrl}
                alt={`Portada de ${imp.name}`}
                className="w-full h-40 sm:h-56 object-cover"
                loading="lazy"
              />
            </div>
          )}

          {/* Hero card */}
          <Card padding="md" className={clsx("mb-5",bannerUrl?"mt-3":"mt-4")}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
              <div className="flex items-start gap-4">
                <Avatar initials={imp.initials} size="2xl" color={imp.color} src={logoUrl||undefined} variant="logo"/>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg font-semibold">{imp.name}</h1>
                    {imp.verified&&<span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium"><BadgeCheck className="w-3 h-3"/>Verificada</span>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{imp.specialty}</p>
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    {platformCerts.length>0&&<div className="flex items-center gap-1 text-primary"><BadgeCheck className="w-3.5 h-3.5"/><span className="text-xs font-medium">{platformCerts.length} {platformCerts.length===1?"sello":"sellos"} de Zarpi</span></div>}
                    {certs.length>0&&<div className="flex items-center gap-1 text-muted-foreground"><Award className="w-3.5 h-3.5"/><span className="text-xs">{certs.length} {certs.length===1?"certificación":"certificaciones"}</span></div>}
                    <div className="flex items-center gap-1 text-muted-foreground"><Clock className="w-3.5 h-3.5"/><span className="text-xs">{imp.responseTime} respuesta</span></div>
                    <div className="flex items-center gap-1 text-muted-foreground"><MapPin className="w-3.5 h-3.5"/><span className="text-xs">{imp.country}</span></div>
                    <div className="flex items-center gap-1 text-muted-foreground"><Package2 className="w-3.5 h-3.5"/><span className="text-xs">{imp.projects} proyectos</span></div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <ContactBtn type="whatsapp" onClick={()=>openSmartContact({type:"whatsapp",whatsapp:imp.advisor.phone,onOpenChat:()=>{if(relChats[0])onOpenChat(relChats[0].id);}})}/>
                <ContactBtn type="email" onClick={()=>openSmartContact({type:"email",email:imp.advisor.email,onOpenChat:()=>{if(relChats[0])onOpenChat(relChats[0].id);}})}/>
                <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5"/>} onClick={()=>onCreateQuote(imp.id)}>Crear cotización</Button>
              </div>
            </div>
          </Card>

          <div className="flex gap-5 items-start">
            <div className="flex-1 min-w-0 space-y-5">
              {/* About */}
              <Card padding="md">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Building2 className="w-4 h-4 text-primary"/>Acerca de la empresa</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {imp.categories.map(c=>(
                    <span key={c} className="px-2.5 py-1 bg-primary/5 text-primary rounded-lg text-xs font-medium">{c}</span>
                  ))}
                </div>
                {imp.industries&&imp.industries.length>0&&(
                  <div className="mt-3 flex flex-wrap gap-2">
                    {imp.industries.map(i=>(
                      <span key={i} className="px-2.5 py-1 bg-muted text-muted-foreground rounded-lg text-xs font-medium">{i}</span>
                    ))}
                  </div>
                )}
              </Card>

              {/* Ficha de contacto que la empresa rellena en su propio perfil.
                  Estaba guardándose en `perfil_publico` sin que ninguna pantalla
                  la leyera, así que rellenarla no cambiaba nada para el cliente. */}
              <DatosDeContactoEmpresa imp={imp}/>

              {/* Presentacion en video y fotos que sube la propia empresa. El
                  componente no pinta nada si todavia no hay material aprobado. */}
              <PresentacionPublica importadorId={imp.id}/>

              <Card padding="md">
                <h3 className="text-sm font-semibold mb-1 flex items-center gap-2"><Star className="w-4 h-4 text-primary"/>Reseñas de clientes</h3>
                <p className="text-xs text-muted-foreground mb-4">Solo las escriben clientes que ya recibieron una importación con esta empresa.</p>
                <ResenasImportador importadorId={imp.id}/>
              </Card>

              {/* Respaldo de la plataforma: distinto de las certificaciones que
                  la propia empresa declara, porque este lo otorga Zarpi. */}
              {platformCerts.length>0&&(
                <Card padding="md" className="border-primary/20 bg-primary/5">
                  <h3 className="text-sm font-semibold mb-1 flex items-center gap-2"><BadgeCheck className="w-4 h-4 text-primary"/>Respaldada por Zarpi</h3>
                  <p className="text-xs text-muted-foreground mb-3">Sellos que nuestro equipo otorgó tras verificar a esta empresa.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {platformCerts.map(c=>(
                      <div key={c.id} className="flex items-start gap-3 p-3 bg-white border border-primary/15 rounded-xl">
                        <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center flex-shrink-0">
                          {c.logoUrl
                            ? <img src={resolveApiUrl(c.logoUrl)} alt="" className="w-8 h-8 object-contain"/>
                            : <BadgeCheck className="w-5 h-5 text-primary"/>}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground">{c.nombre}</p>
                          {c.descripcion&&<p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{c.descripcion}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Certifications */}
              <Card padding="md">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-primary"/>Certificaciones declaradas por la empresa</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {certs.map(c=>(
                    <div key={c} className="flex items-center gap-2.5 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0"><Award className="w-4 h-4 text-emerald-600"/></div>
                      <div><p className="text-xs font-semibold text-emerald-800">{c}</p><p className="text-[10px] text-emerald-600 mt-0.5">Certificado activo</p></div>
                    </div>
                  ))}
                  {certs.length===0&&<p className="text-sm text-muted-foreground col-span-3">Sin certificaciones registradas.</p>}
                </div>
              </Card>

              {/* Advisors */}
              <Card padding="md">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><UserRound className="w-4 h-4 text-primary"/>Asesores disponibles</h3>
                <div className="space-y-3">
                  {ADVISORS.map((adv,i)=>(
                    <div key={i} className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
                      <Avatar initials={adv.initials} size="lg" color={adv.color}/>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{adv.name}</p>
                        <p className="text-xs text-muted-foreground">{adv.role}</p>
                        <p className="text-xs text-primary mt-0.5">{adv.email}</p>
                      </div>
                      <div className="flex gap-1.5">
                        <ContactBtn type="whatsapp" label="WA" size="sm" onClick={()=>openSmartContact({type:"whatsapp",whatsapp:adv.phone,onOpenChat:()=>{if(relChats[0])onOpenChat(relChats[0].id);}})}/>
                        <ContactBtn type="email" label="Email" size="sm" onClick={()=>openSmartContact({type:"email",email:adv.email,onOpenChat:()=>{if(relChats[0])onOpenChat(relChats[0].id);}})}/>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Related activity */}
              {(relQuotes.length>0||relOrders.length>0)&&(
                <Card padding="md">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-primary"/>Historial contigo</h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    {[["Cotizaciones",relQuotes.length,"text-blue-600"],["Órdenes",relOrders.length,"text-purple-600"],["Chats activos",relChats.filter(c=>c.status==="activa").length,"text-emerald-600"]].map(([l,v,c])=>(
                      <div key={l as string} className="p-3 bg-muted/30 rounded-xl">
                        <p className={clsx("text-2xl font-semibold",c as string)}>{v as number}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{l as string}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            {/* Right sidebar */}
            <div className="w-60 flex-shrink-0 hidden lg:block space-y-4">
              <Card padding="md">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Estadísticas</h3>
                <div className="space-y-2.5">
                  {[["Miembro desde",imp.memberSince],["Proyectos totales",imp.projects.toString()],["Tiempo de respuesta",imp.responseTime],["País principal",imp.country]].map(([k,v])=>(
                    <div key={k} className="flex justify-between items-start gap-2"><span className="text-xs text-muted-foreground">{k}</span><span className="text-xs font-medium text-right">{v}</span></div>
                  ))}
                </div>
              </Card>

              <Card padding="md" className="bg-primary/5 border-primary/20">
                <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">Acciones rápidas</h3>
                <div className="flex flex-col gap-2">
                  <Button variant="primary" size="sm" fullWidth icon={<Plus className="w-3.5 h-3.5"/>} onClick={()=>onCreateQuote(imp.id)}>Crear cotización</Button>
                  <ContactBtn type="whatsapp" size="sm" label="Contactar por WhatsApp" className="w-full justify-center" onClick={()=>openSmartContact({type:"whatsapp",whatsapp:imp.advisor.phone,onOpenChat:()=>{if(relChats[0])onOpenChat(relChats[0].id);}})}/>
                  {relChats.length>0&&<Button variant="secondary" size="sm" fullWidth icon={<MessageSquare className="w-3.5 h-3.5"/>} onClick={()=>onOpenChat(relChats[0].id)}>Abrir chat</Button>}
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUOTES SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function QuotesScreen({onNewQuote,onViewDetail,onRefreshQuotes,creditos,sb,quotes,responses}:{onNewQuote:()=>void;onViewDetail:(id:string)=>void;onRefreshQuotes?:()=>Promise<void>;creditos:number;sb:SidebarCtrl;quotes:Quote[];responses:QuoteResponse[]}) {
  const [search,setSearch]=useState("");const[statusF,setStatusF]=useState("");const[modeF,setModeF]=useState("");const[respF,setRespF]=useState("");
  const [quoteToUnlock,setQuoteToUnlock]=useState<Quote|null>(null);
  const [unlocking,setUnlocking]=useState(false);
  const [unlockError,setUnlockError]=useState("");
  const lastQ=quotes[0]??null;
  const responseCountByQuoteId = responses.reduce<Record<string, number>>((acc, response) => {
    acc[response.quoteId] = (acc[response.quoteId] || 0) + 1;
    return acc;
  }, {});

  const filtered=quotes.filter(q=>{
    const ms=!search||[q.code,q.product,q.importer].some(v=>v.toLowerCase().includes(search.toLowerCase()));
    const mst=!statusF||q.status===statusF;const mm=!modeF||q.mode===modeF;
    const count=responseCountByQuoteId[q.id]||0;
    const mr=!respF||(respF==="sin"?count===0:count>0);
    return ms&&mst&&mm&&mr;
  });

  async function unlockQuote() {
    if (!quoteToUnlock) return;
    setUnlocking(true);
    setUnlockError("");
    try {
      await businessService.unlockQuoteByPoint(quoteToUnlock.id);
      setQuoteToUnlock(null);
      await onRefreshQuotes?.();
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : "No se pudo desbloquear la cotización.");
    } finally {
      setUnlocking(false);
    }
  }
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="quotes"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div>
            <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav("dashboard")},{label:"Cotizaciones"}]}/>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold tracking-tight">Cotizaciones</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-primary dark:border-accent/30 dark:text-accent" title="Créditos disponibles. 1 crédito te permite enviar una cotización gratuita a una empresa de mayor categoría (Plata, Oro, etc.).">
                  <WalletCards className="h-3.5 w-3.5"/>
                  {creditos} créditos
                </span>
              </div>
              <Button variant="primary" icon={<Plus className="w-4 h-4"/>} onClick={onNewQuote}>Nueva cotización</Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card padding="md">
              <div className="flex items-center justify-between mb-4"><h2 className="text-sm font-semibold">Última cotización</h2>{lastQ&&<Badge variant={lastQ.status}/>}</div>
              {lastQ?(
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div><p className="text-xs text-muted-foreground mb-0.5">Código</p><p className="text-sm font-mono font-medium">{lastQ.code}</p></div>
                    <div><p className="text-xs text-muted-foreground mb-0.5">Fecha</p><p className="text-sm">{lastQ.date}</p></div>
                    <div className="col-span-2"><p className="text-xs text-muted-foreground mb-0.5">Producto</p><p className="text-sm font-medium">{lastQ.product}</p></div>
                    <div><p className="text-xs text-muted-foreground mb-0.5">Modalidad</p><span className={clsx("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",lastQ.mode==="Dirigida"?"bg-blue-50 text-blue-700":"bg-orange-50 text-orange-700")}>{lastQ.mode}</span></div>
                    <div><p className="text-xs text-muted-foreground mb-0.5">Respuestas</p><p className="text-sm font-medium text-muted-foreground">{responseCountByQuoteId[lastQ.id]||0}</p></div>
                  </div>
                  <div className="pt-3 mt-3 border-t border-border"><Button variant="secondary" size="sm" icon={<ExternalLink className="w-3 h-3"/>} onClick={()=>onViewDetail(lastQ.id)}>Ver detalle</Button></div>
                </>
              ):(
                <div className="py-8 text-center">
                  <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2"/>
                  <p className="text-sm text-muted-foreground">No hay cotizaciones registradas aún.</p>
                </div>
              )}
            </Card>
            <Card padding="md">
              <h2 className="text-sm font-semibold mb-4">Estado de respuestas</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Con propuestas</p>
                  <p className="text-xl font-semibold">{quotes.filter((quote)=> (responseCountByQuoteId[quote.id]||0) > 0).length}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Sin propuestas</p>
                  <p className="text-xl font-semibold">{quotes.filter((quote)=> (responseCountByQuoteId[quote.id]||0) === 0).length}</p>
                </div>
              </div>
            </Card>
          </div>
          <div>
            <h2 className="text-base font-semibold mb-4">Historial de cotizaciones</h2>
            <Card padding="sm" className="mb-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[160px]"><Input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} prefix={<Search className="w-4 h-4"/>}/></div>
                <div className="w-44"><Select value={statusF} onChange={e=>setStatusF(e.target.value)}><option value="">Estado</option><option value="created">Creada</option><option value="directed">Dirigida</option><option value="open">Abierta</option><option value="accepted">Aceptada</option><option value="active-order">Orden activa</option><option value="rejected-importer">Rechazada por importadora</option></Select></div>
                <div className="w-32"><Select value={modeF} onChange={e=>setModeF(e.target.value)}><option value="">Modalidad</option><option value="Dirigida">Dirigida</option><option value="Abierta">Abierta</option></Select></div>
                <div className="w-44"><Select value={respF} onChange={e=>setRespF(e.target.value)}><option value="">Respuestas recibidas</option><option value="con">Con respuestas</option><option value="sin">Sin respuestas</option></Select></div>
                {(search||statusF||modeF||respF)&&<Button variant="ghost" size="sm" onClick={()=>{setSearch("");setStatusF("");setModeF("");setRespF("");}}>Limpiar</Button>}
              </div>
            </Card>
            <Card padding="none">
              <div className="px-5 py-3.5 border-b border-border"><p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">{filtered.length}</span> cotizaciones</p></div>
              {filtered.length>0?(
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead><tr className="border-b border-border">{["Código","Fecha","Producto","Importadora","Modalidad","Estado","Resp.","Últ. act.",""].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr></thead>
                    <tbody>{filtered.map((row,i)=>(
                      <tr key={row.id} className={clsx("border-b border-border/60 hover:bg-muted/40 transition-colors",i%2===0?"bg-white":"bg-slate-50/50")}>
                        <td className="px-4 py-3 font-mono text-xs font-medium">{row.code}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{row.date}</td>
                        <td className="px-4 py-3 font-medium max-w-[180px]"><span className="truncate block">{row.product}</span></td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{row.importer}</td>
                        <td className="px-4 py-3"><span className={clsx("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",row.mode==="Dirigida"?"bg-blue-50 text-blue-700":"bg-orange-50 text-orange-700")}>{row.mode}</span></td>
                        <td className="px-4 py-3">
                          {row.bloqueada ? (
                            <div className="flex min-w-[150px] flex-col items-start gap-1">
                              <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">Cotización bloqueada</span>
                              <span className="text-[11px] text-muted-foreground">Requiere <TierBadge tier={row.tierMinimoRequerido} /></span>
                            </div>
                          ) : <Badge variant={row.status}/>}
                        </td>
                        <td className="px-4 py-3 text-center"><span className="text-xs text-muted-foreground">{responseCountByQuoteId[row.id]||0}</span></td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{row.updatedAt}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" size="sm" icon={<ExternalLink className="w-3 h-3"/>} onClick={()=>onViewDetail(row.id)}>Ver detalle</Button>
                            {row.bloqueada && <Button variant="primary" size="sm" onClick={()=>{setUnlockError("");setQuoteToUnlock(row);}}>Desbloquear por 1 punto</Button>}
                          </div>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ):<div className="py-16 text-center"><FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2"/><p className="text-sm text-muted-foreground">No se encontraron cotizaciones</p></div>}
            </Card>
          </div>
        </main>
      </div>
      <Modal open={Boolean(quoteToUnlock)} onClose={()=>{if(!unlocking)setQuoteToUnlock(null);}} title="Desbloquear cotización">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-sm font-semibold">{quoteToUnlock?.code} · {quoteToUnlock?.product}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Tu nivel:</span><TierBadge tier={quoteToUnlock?.solicitanteTier} />
              <span>Requerido:</span><TierBadge tier={quoteToUnlock?.tierMinimoRequerido} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Se descontará 1 punto de cotización de tu saldo para habilitar esta oportunidad.</p>
          <p className="text-xs text-muted-foreground">Saldo disponible: <span className="font-semibold text-foreground">{quoteToUnlock?.solicitantePuntosCotizacion ?? 0} puntos</span></p>
          {unlockError && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{unlockError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={unlocking} onClick={()=>setQuoteToUnlock(null)}>Cancelar</Button>
            <Button variant="primary" loading={unlocking} onClick={()=>{void unlockQuote();}}>Desbloquear por 1 punto</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Qué cubre el precio según el incoterm, en palabras del comprador.
const INCOTERM_INCLUYE: Record<string,string> = {
  EXW:"Mercancía en fábrica; tú pones el transporte",
  FCA:"Entregada al transportista en origen",
  FOB:"Puesta en el barco en origen; flete y seguro aparte",
  CFR:"Flete hasta el puerto de destino; seguro aparte",
  CIF:"Flete y seguro hasta el puerto de destino",
  CPT:"Transporte pagado hasta destino; seguro aparte",
  CIP:"Transporte y seguro pagados hasta destino",
  DAP:"Hasta tu puerta, sin impuestos de importación",
  DPU:"Descargada en destino, sin impuestos",
  DDP:"Puerta a puerta con impuestos y nacionalización",
};

/** Las observaciones de una propuesta: texto libre o el JSON del formulario de respuesta. */
function leerCondicionesPropuesta(texto: string | null | undefined): { descripcion: string; ventajas: string; detalles: string[] } {
  const vacio = { descripcion: "", ventajas: "", detalles: [] as string[] };
  if (!texto) return vacio;
  try {
    const datos = JSON.parse(texto) as Record<string, unknown>;
    if (datos && typeof datos === "object" && datos.schema === "create-response-v1") {
      const campo = (clave: string) => (typeof datos[clave] === "string" ? String(datos[clave]).trim() : "");
      const detalles = [
        campo("moq") && `MOQ ${campo("moq")}`,
        campo("port") && `Puerto ${campo("port")}`,
        campo("productionTime") && `Producción ${campo("productionTime")}`,
        campo("shippingTime") && `Envío ${campo("shippingTime")}`,
      ].filter(Boolean) as string[];
      return { descripcion: campo("description"), ventajas: campo("advantages"), detalles };
    }
  } catch {
    // Texto libre.
  }
  return { ...vacio, descripcion: texto };
}

const MOTIVOS_ELECCION: { clave: MotivoEleccion; etiqueta: string; ayuda: string }[] = [
  { clave: "precio", etiqueta: "Precio", ayuda: "Me salió mejor en costo" },
  { clave: "tiempo", etiqueta: "Tiempo de entrega", ayuda: "Llega antes" },
  { clave: "condiciones", etiqueta: "Condiciones", ayuda: "Lo que incluye, pagos, garantías" },
  { clave: "otro", etiqueta: "Otro motivo", ayuda: "Confianza, atención, recomendación..." },
];

/** "500 u" o "2,5 m³". */
function cantidadConUnidad(cantidad: string | number | null | undefined, unidad?: string | null, largo = false): string {
  if (cantidad === null || cantidad === undefined || cantidad === "") return "—";
  const numero = Number(cantidad);
  const texto = Number.isFinite(numero) ? numero.toLocaleString("es-CO", { maximumFractionDigits: 2 }) : String(cantidad);
  if (unidad === "m3") return `${texto} m³`;
  return `${texto} ${largo ? "unidades" : "u"}`;
}

function formatoPesos(valor: number): string {
  return `$${Math.round(valor).toLocaleString("es-CO")} COP`;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUOTE DETAIL
// ─────────────────────────────────────────────────────────────────────────────
function QuoteDetailScreen({quoteId,quotes,onBack,onOpenChat,sb,onRefreshQuotes,chats,orders,onDuplicate}:{quoteId:string;quotes:Quote[];onBack:()=>void;onOpenChat:(id:string)=>void;sb:SidebarCtrl;onRefreshQuotes?:()=>Promise<void>;chats:ChatConv[];orders:Order[];onDuplicate:(quote:Quote)=>void}) {
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
  const contactAsesor=visibleProposals.find(p=>p.contacto_asesor)?.contacto_asesor??null;
  const contactAsesorWhatsapp = contactAsesor?.whatsapp || "";
  const relChat=chats.find(c=>c.refId===quoteId&&c.type==="cotizacion");
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
      source: solicitudDoc ? "Orden" : "Pendiente de generación",
    },
    {
      label: "Propuesta",
      name: propuestaDoc?.name || `Propuesta-${quote.code}.pdf`,
      status: propuestaDoc?.url ? "Disponible" : "Pendiente",
      url: propuestaDoc?.url || null,
      source: propuestaDoc ? "Orden" : (activeProposal ? "Negociación" : "Sin propuesta aceptada"),
    },
    {
      label: "Orden",
      name: ordenDoc?.name || `Orden-${quote.code}.pdf`,
      status: ordenDoc?.url ? "Disponible" : "Pendiente",
      url: ordenDoc?.url || null,
      source: relatedOrder ? "Orden activa" : "Aún no creada",
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
                <div className="flex items-center gap-3 flex-wrap"><span className="font-mono text-lg font-semibold">{quote.code}</span><Badge variant={quote.status}/><span className={clsx("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",quote.mode==="Dirigida"?"bg-blue-50 text-blue-700":"bg-orange-50 text-orange-700")}>{quote.mode}</span></div>
                <div className="flex gap-6 flex-wrap">{[["Fecha",quote.date],["País",quote.country],["Incoterm",quote.incoterm],...(quote.shippingMark?[["Shipping mark",quote.shippingMark]]:[])].map(([k,v])=><div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="text-sm font-medium">{v}</p></div>)}{quote.mode==="Dirigida"&&<div><p className="text-xs text-muted-foreground">Empresa</p><p className="text-sm font-medium">{quote.importer}</p></div>}</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="secondary" size="sm" icon={<Copy className="w-3.5 h-3.5"/>} onClick={()=>onDuplicate(quote)}>Duplicar</Button>
                {relChat&&<Button variant="secondary" size="sm" icon={<MessageSquare className="w-3.5 h-3.5"/>} onClick={()=>onOpenChat(relChat.id)}>Chat</Button>}
              </div>
            </div>
          </Card>
          <div className="flex gap-5 items-start">
            <div className="flex-1 min-w-0 space-y-5">
              <Card padding="md"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Tag className="w-4 h-4 text-primary"/>Información del producto</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">{[["Nombre",quote.product],["Línea",quote.productLine],["País",quote.country],["Calidad",quote.quality],["Descripción",quote.description||"—"]].map(([k,v])=><div key={k} className={k==="Descripción"?"col-span-2 sm:col-span-3":""}><p className="text-xs text-muted-foreground">{k}</p><p className="text-sm font-medium mt-0.5 whitespace-pre-line">{v}</p></div>)}</div>
                {(quote.productPhotoUrls??[]).length>0&&<div className="mt-4 pt-4 border-t border-border"><GaleriaFotosProducto fotos={quote.productPhotoUrls??[]}/></div>}
              </Card>
              <Card padding="md"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Receipt className="w-4 h-4 text-primary"/>Información comercial</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">{[["Cantidad",cantidadConUnidad(quote.minQuantity,quote.unit)],["Precio objetivo",quote.targetPrice],["Incoterm",quote.incoterm],["Notas",quote.notes||"—"]].map(([k,v])=><div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="text-sm font-medium mt-0.5">{v}</p></div>)}</div>
              </Card>
              <Card padding="md">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><FolderOpen className="w-4 h-4 text-primary"/>Documentos del ciclo</h3>
                  <span className="text-xs text-muted-foreground">Solicitud · Propuesta · Orden</span>
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
                  <h3 className="text-sm font-semibold flex items-center gap-2"><ClipboardList className="w-4 h-4 text-primary"/>Ofertas recibidas{visibleProposals.length>0&&<span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">{visibleProposals.length}</span>}</h3>
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
                                    <p className="font-medium">US${proposal.precio_ofrecido_usd.toLocaleString("es-CO")}</p>
                                    {trm&&<p className="text-[11px] text-muted-foreground">≈ {formatoPesos(proposal.precio_ofrecido_usd*trm)}</p>}
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
                                <div><p className="text-[10px] text-muted-foreground uppercase">Precio</p><p className="text-sm font-semibold">US${p.precio_ofrecido_usd.toLocaleString("es-CO")}</p>{trm&&<p className="text-[11px] text-muted-foreground">≈ {formatoPesos(p.precio_ofrecido_usd*trm)}</p>}</div>
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
                              {p.estado==="pendiente"?(
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
                  <div className="flex items-start gap-2.5"><Avatar initials={initialsFromName(contactAsesor.nombre||"AS")} size="md"/><div><p className="text-sm font-semibold">{contactAsesor.nombre||"Asesor"}</p><p className="text-xs text-muted-foreground">Contacto de la propuesta</p><p className="text-xs text-muted-foreground">{contactAsesor.whatsapp||"Sin WhatsApp"}</p></div></div>
                  <div className="flex flex-col gap-1.5">
                    <ContactBtn type="chat" size="sm" className="w-full justify-center" onClick={()=>openSmartContact({type:"chat",onOpenChat:()=>{if(relChat)onOpenChat(relChat.id);}})}/>
                    <ContactBtn type="whatsapp" size="sm" className="w-full justify-center" onClick={()=>openSmartContact({type:"whatsapp",whatsapp:contactAsesorWhatsapp,onOpenChat:()=>{if(relChat)onOpenChat(relChat.id);}})}/>
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
function ResponseDetailScreen({responseId,from,fromQuoteId,onBack,onBackToQuote,onOpenChat,sb,responses,quotes,chats,importers,orders,onRefreshData}:{
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
                <h2 className="text-lg font-semibold">¡Orden creada!</h2>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">Ambas partes aceptaron. La respuesta fue <span className="font-medium text-emerald-600">Seleccionada</span> y las demás propuestas quedaron <span className="font-medium text-slate-500">Canceladas</span>.</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                <Button variant="secondary" onClick={onBack}>Volver</Button>
                <Button variant="primary" icon={<ShoppingCart className="w-4 h-4"/>} onClick={()=>sb.onNav("orders")}>Ir a la Orden</Button>
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
                  <ContactBtn type="whatsapp" onClick={()=>openSmartContact({type:"whatsapp",whatsapp:imp?.advisor.phone,onOpenChat:()=>{if(relChat)onOpenChat(relChat.id);}})}/>
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
function ResponsesScreen({onViewDetail,sb,responses,importers,quotes,onViewQuote}:{onViewDetail:(id:string,from:ResponseFrom)=>void;sb:SidebarCtrl;responses:QuoteResponse[];importers:Importer[];quotes:Quote[];onViewQuote:(quoteId:string)=>void}) {
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
                      <Avatar initials={imp?.initials || "IM"} size="xl" color={imp?.color || "bg-slate-600"}/>
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
function OrdersScreen({onViewOrder,sb,orders,importers}:{onViewOrder:(id:string)=>void;sb:SidebarCtrl;orders:Order[];importers:Importer[]}) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="orders"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div><Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav(sb.navItems[0]?.key || "dashboard")},{label:"Órdenes"}]}/><h1 className="text-xl font-semibold tracking-tight mt-3">Órdenes</h1></div>
          <PendientesDeResena/>
          {orders.length===0 ? (
            <Card padding="lg" className="border-dashed"><div className="flex flex-col items-center text-center py-8 gap-2"><ShoppingCart className="w-10 h-10 text-muted-foreground/30"/><p className="font-medium">Sin órdenes</p><p className="text-sm text-muted-foreground">No tienes órdenes activas en backend.</p></div></Card>
          ) : (
          <div className="space-y-3">{orders.map(ord=>{const imp=importers.find(i=>i.id===ord.importerId);return(
            <Card key={ord.id} padding="md" className="hover:shadow-md transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <Avatar initials={imp?.initials || "NA"} size="xl" color={imp?.color || "bg-slate-500"}/>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap"><span className="font-mono font-semibold">{ord.code}</span><Badge variant="active-order"/></div>
                    <p className="text-sm font-medium mt-0.5">{ord.product}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{imp?.name || "Empresa importadora"} · {ord.quantity}</p>
                    <div className="flex gap-4 mt-2 flex-wrap">{[["Valor",ord.totalValue],["Creada",ord.created],["Estimada",ord.estimated]].map(([k,v])=><div key={k}><span className="text-xs text-muted-foreground">{k}: </span><span className="text-xs font-semibold">{v}</span></div>)}</div>
                  </div>
                </div>
                <Button variant="secondary" size="sm" icon={<ExternalLink className="w-3 h-3"/>} onClick={()=>onViewOrder(ord.id)}>Ver detalle</Button>
              </div>
            </Card>
          );})}</div>
          )}
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER DETAIL
// ─────────────────────────────────────────────────────────────────────────────
function OrderDetailScreen({order,onBack,onOpenChat,sb,isLoading,importers,onViewImporterProfile,canManageOrder,onUpdateOrderStatus}:{order:Order|null;onBack:()=>void;onOpenChat:(id:string)=>void;sb:SidebarCtrl;isLoading:boolean;importers:Importer[];onViewImporterProfile:(id:string)=>void;canManageOrder:boolean;onUpdateOrderStatus:(orderId:string,estado:string)=>Promise<void>}) {
  const [isAdvancing,setIsAdvancing]=useState(false);
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
          <main className="flex-1 overflow-y-auto px-6 py-6"><Card padding="lg" className="border-dashed"><div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin"/>Cargando detalle de orden...</div></Card></main>
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
          <main className="flex-1 overflow-y-auto px-6 py-6"><Card padding="lg" className="border-dashed"><p className="text-sm text-muted-foreground text-center">Orden no disponible.</p></Card></main>
        </div>
      </div>
    );
  }

  const imp=importers.find(i=>i.id===order.importerId);
  const advisor=imp?.advisor;
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

  async function avanzarEstado(){
    if(!order||!siguienteEstadoOrden)return;
    setAdvanceMessage("");
    setAdvanceError("");
    setIsAdvancing(true);
    try{
      await onUpdateOrderStatus(order.id, siguienteEstadoOrden.key);
      setAdvanceMessage(`Orden marcada como «${siguienteEstadoOrden.label}».`);
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
          <Breadcrumb items={[{label:"Inicio",onClick:onBack},{label:"Órdenes",onClick:onBack},{label:order.code}]}/>
          <Card padding="md" className="mt-4 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 flex-wrap"><span className="font-mono text-lg font-semibold">{order.code}</span><Badge variant="active-order"/></div>
                <div className="flex gap-6 flex-wrap">{[["Empresa",imp?.name || "Empresa importadora"],["Asesor",advisor?.name || "Asesor"],["Creada",order.created],["Entrega estimada",order.estimated]].map(([k,v])=><div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="text-sm font-medium">{v}</p></div>)}</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <ContactBtn type="whatsapp" label="Contactar asesor" onClick={()=>openSmartContact({type:"whatsapp",whatsapp:advisor?.phone,onOpenChat:()=>{if(relChatId)onOpenChat(relChatId);}})}/>
                <Button variant="secondary" size="sm" icon={<FolderOpen className="w-3.5 h-3.5"/>} onClick={()=>irA(documentosRef)}>Ver documentos</Button>
                {relChatId&&<Button variant="secondary" size="sm" icon={<MessageSquare className="w-3.5 h-3.5"/>} onClick={()=>onOpenChat(relChatId)}>Chat</Button>}
                <Button variant="primary" size="sm" icon={<Navigation2 className="w-3.5 h-3.5"/>} onClick={()=>irA(seguimientoRef)}>Ver seguimiento</Button>
              </div>
            </div>
          </Card>
          <div className="flex gap-5 items-start">
            <div className="flex-1 min-w-0 space-y-5">
              <Card padding="md"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Receipt className="w-4 h-4 text-primary"/>Resumen comercial</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">{[["Producto",order.product],["Cantidad",order.quantity],["Precio final",order.unitPrice],["Incoterm",order.incoterm],["Shipping mark",order.shippingMark||"Sin marca"],["Puerto de origen",order.originPort],["Puerto de destino",order.destPort],["Valor total",order.totalValue]].map(([k,v])=>(
                  <div key={k} className={k==="Puerto de origen"||k==="Puerto de destino"||k==="Producto"?"col-span-2 sm:col-span-1":""}><p className="text-xs text-muted-foreground">{k}</p><p className={clsx("text-sm font-medium mt-0.5",k==="Valor total"&&"text-primary font-semibold")}>{v}</p></div>
                ))}</div>
                <div className="mt-4 pt-3 border-t border-border flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-muted-foreground"/><span className="text-xs text-muted-foreground">Cotización origen:</span><span className="text-xs font-mono font-medium">{order.quoteCode}</span></div>
              </Card>
              <div ref={seguimientoRef}>
                <Card padding="md">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
                    <h3 className="text-sm font-semibold flex items-center gap-2"><Truck className="w-4 h-4 text-primary"/>Estado logístico</h3>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">{orderStateLabel(order.status)}</span>
                  </div>
                  <Timeline stages={timelineStages}/>
                  {/* La empresa y el asesor asignado mueven el embarque desde
                      aquí; antes solo se podía desde el panel del chat. */}
                  {canManageOrder&&(
                    <div className="mt-5 pt-4 border-t border-border">
                      {siguienteEstadoOrden?(
                        <div className="flex items-center gap-3 flex-wrap">
                          <Button variant="primary" size="sm" loading={isAdvancing}
                            onClick={()=>{void avanzarEstado();}}>
                            Marcar «{siguienteEstadoOrden.label}»
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            El cliente lo verá en el chat de seguimiento y recibirá el aviso.
                          </p>
                        </div>
                      ):(
                        <p className="text-xs text-muted-foreground">
                          {order.status==="entregado"?"La orden está entregada: no hay más pasos.":"Sin siguiente estado disponible."}
                        </p>
                      )}
                      {advanceMessage&&<p className="text-xs text-emerald-600 mt-2">{advanceMessage}</p>}
                      {advanceError&&<p className="text-xs text-destructive mt-2">{advanceError}</p>}
                    </div>
                  )}
                </Card>
              </div>
              <Card padding="none">
                <div ref={documentosRef} className="px-5 py-3.5 border-b border-border flex items-center justify-between"><h3 className="text-sm font-semibold flex items-center gap-2"><FolderOpen className="w-4 h-4 text-primary"/>Documentos</h3><span className="text-xs text-muted-foreground">{documents.filter(d=>d.status==="Disponible").length} disponibles</span></div>
                <div className="divide-y divide-border/60">{documents.map(doc=>(
                  <div key={doc.name} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3"><FileCheck className={clsx("w-4 h-4 flex-shrink-0",doc.status==="Disponible"?"text-primary":"text-muted-foreground/40")}/><div><p className="text-sm font-medium">{doc.name}</p><p className="text-xs text-muted-foreground">{doc.date||orderDocumentTypeLabel(doc.type)}</p></div></div>
                    <div className="flex items-center gap-2">
                      <span className={clsx("text-xs font-medium px-2 py-0.5 rounded",doc.status==="Disponible"?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-500")}>{doc.status}</span>
                      {doc.status==="Disponible"&&<><Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5"/>} className="text-xs" onClick={()=>{void abrirArchivoEnPestana(doc.url);}}>Ver</Button><Button variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5"/>} className="text-xs" onClick={()=>{void descargarArchivo(doc.url, doc.name);}}>Descargar</Button></>}
                    </div>
                  </div>
                ))}</div>
                {documents.length===0&&<div className="py-10 text-center text-sm text-muted-foreground">No hay documentos adjuntos para esta orden.</div>}
              </Card>
              <Card padding="md"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-primary"/>Historial de eventos</h3>
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
                  <ContactBtn type="whatsapp" label="WA" size="sm" className="flex-1 justify-center" onClick={()=>openSmartContact({type:"whatsapp",whatsapp:advisor?.phone,onOpenChat:()=>{if(relChatId)onOpenChat(relChatId);}})}/>
                  <ContactBtn type="chat" size="sm" className="flex-1 justify-center" onClick={()=>openSmartContact({type:"chat",onOpenChat:()=>{if(relChatId)onOpenChat(relChatId);}})}/>
                  <ContactBtn type="email" label="Email" size="sm" className="flex-1 justify-center" onClick={()=>openSmartContact({type:"email",email:advisor?.email,onOpenChat:()=>{if(relChatId)onOpenChat(relChatId);}})}/>
                </div>
              </Card>
              <Card padding="md" className="border-purple-100 bg-purple-50/40"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Estado actual</h3><div className="flex items-center gap-2 mb-1"><div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"/><span className="text-sm font-semibold text-purple-700">{order.status || "En seguimiento"}</span></div><p className="text-xs text-muted-foreground">Última actualización: {history.length>0?formatShortDate(history[history.length-1].fecha):"Reciente"}</p></Card>
              {relChatId&&<Card padding="md"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Chat de esta orden</h3><p className="text-xs text-muted-foreground mb-3">Abrir conversación asociada a la orden.</p><Button variant="secondary" size="sm" fullWidth icon={<MessageSquare className="w-3.5 h-3.5"/>} onClick={()=>onOpenChat(relChatId)}>Abrir chat</Button></Card>}
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
  const clave=String(rol??"").trim();
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
    fotoUrl: conv?.counterpartPhotoUrl ? resolveApiUrl(conv.counterpartPhotoUrl) : "",
  };
}

function puedeVerTierDeContraparte(currentUserRole: UserRole | "admin", counterpartRole: string | undefined, tier: string | undefined): boolean {
  const rolContraparte = String(counterpartRole || "").trim().toLowerCase();
  const esCotizante = rolContraparte === "cotizante" || rolContraparte === "solicitante";
  const esRolAutorizado = currentUserRole === "asesor" || currentUserRole === "importadora" || currentUserRole === "admin";
  return Boolean(tier) && esCotizante && esRolAutorizado;
}

function ChatsScreen({modoEquipo=false,miembrosEquipo=[],onAbrirHiloEquipo,onViewQuote,onViewOrder,sb,initialConvId,conversations,messagesByConversation,onSendMessage,onSendPriceEstimate,onConvertEstimateToProposal,proposalStateByQuoteId={},onShareLocalAttachment,onShareExistingResource,onTransferConversation,onUpdateOrderStatus,onAttachOrderDocument,onActiveConversationChange,onCloseTicket,onReopenTicket,onEscalateTicket,onRateTicket,companyAdvisors=[],currentUserRole,chatAttachmentsByConversation,orders,quotes,importers}:{modoEquipo?:boolean;miembrosEquipo?:BackendMiembroEquipo[];onAbrirHiloEquipo?:(miembroId:string)=>Promise<void>;onViewQuote:(id:string)=>void;onViewOrder:(id:string)=>void;sb:SidebarCtrl;initialConvId?:string;conversations:ChatConv[];messagesByConversation:Record<string,ChatMsg[]>;onSendMessage:(conversationId:string,contenido:string,metadata?:Record<string,unknown>)=>Promise<void>;onSendPriceEstimate:(conversationId:string,entrada:EstimacionPrecioEntrada)=>Promise<void>;onConvertEstimateToProposal:(quoteId:string,estimate:EstimacionEnMensaje)=>void;proposalStateByQuoteId?:Record<string,string>;onShareLocalAttachment:(conversationId:string,file:File)=>Promise<void>;onShareExistingResource:(conversationIds:string[],fileId:string,message?:string)=>Promise<void>;onTransferConversation:(conversationId:string,newAdvisorEmail:string)=>Promise<void>;onUpdateOrderStatus:(orderId:string,statusValue:string)=>Promise<void>;onAttachOrderDocument:(orderId:string,file:File)=>Promise<void>;onActiveConversationChange?:(conversationId:string|null)=>void;onCloseTicket:(conversationId:string,resolucion:string)=>Promise<void>;onReopenTicket:(conversationId:string)=>Promise<void>;onEscalateTicket:(conversationId:string,nivel:number)=>Promise<void>;onRateTicket:(conversationId:string,calificacion:number,comentario?:string)=>Promise<void>;companyAdvisors?:CompanyAdvisor[];currentUserRole:UserRole|"admin";chatAttachmentsByConversation:Record<string,BackendChatAttachmentItem[]>;orders:Order[];quotes:Quote[];importers:Importer[]}) {
  const [selectedId,setSelectedId]=useState<string|null>(initialConvId||conversations[0]?.id||null);
  // El equipo de la plataforma filtra por urgencia; los demás, por el tipo de
  // hilo. Por eso el filtro es una cadena libre y no una unión cerrada.
  const [filter,setFilter]=useState<string>("all");
  const [searchConv,setSearchConv]=useState("");
  const [msgs,setMsgs]=useState<Record<string,ChatMsg[]>>(messagesByConversation);
  const [input,setInput]=useState("");
  const [sending,setSending]=useState(false);
  const [showCtx,setShowCtx]=useState(true);
  const [showEmojiMenu,setShowEmojiMenu]=useState(false);
  const [showCalculadora,setShowCalculadora]=useState(false);
  // Cambiar de conversación cierra la calculadora: lo escrito era para otro cliente.
  useEffect(()=>{setShowCalculadora(false);},[selectedId]);
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
  const emojiOptions=["😀","😎","👍","✅","📦","🚢","💬","📌","🎯","🤝","🙏","🔥"];

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
  const chatAdvisorWhatsapp = conv?.advisorPhone || imp?.advisor.phone || "";
  const chatAdvisorInitials = conv?.advisorInitials || imp?.advisor.initials || "AS";
  const chatAdvisorColor = conv?.advisorColor || imp?.advisor.color || "bg-slate-500";

  const filteredConvs=conversations.filter(c=>{
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

  async function sendMsg(){
    if(!input.trim()||!selectedId)return;
    const content = input.trim();
    const newMsg:ChatMsg={id:`pending-${Date.now()}`,sender:"client",text:content,time:new Date().toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"}),read:true};
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

  async function handleAttachmentCardClick(attachment: BackendChatAttachmentItem) {
    if (previewType(attachment) === "image" || previewType(attachment) === "pdf") {
      setPreviewAttachment(attachment);
      return;
    }
    await handleDownloadResource(attachment.storage_url, attachment.nombre);
  }

  async function handleAttachFileChange(event:React.ChangeEvent<HTMLInputElement>,isImage:boolean){
    const file=event.target.files?.[0];
    if(!file||!selectedId)return;

    const contentLabel=isImage?"Imagen":"Archivo";
    const localMsg:ChatMsg={
      id:`pending-file-${Date.now()}`,
      sender:"client",
      text:`${contentLabel} adjunto: ${file.name}`,
      file:{name:file.name,size:getReadableFileSize(file.size),type:mapFileType(file)},
      time:new Date().toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"}),
      read:true,
    };

    setMsgs(prev=>({...prev,[selectedId]:[...(prev[selectedId]||[]),localMsg]}));
    try{
      await onShareLocalAttachment(selectedId,file);
    }catch{
      // Mantener feedback visual local aunque falle el registro remoto.
    }

    event.target.value="";
    setTimeout(()=>messagesEndRef.current?.scrollIntoView({behavior:"smooth"}),50);
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

  const refQuote=conv?.type==="cotizacion"?quotes.find((quote)=>quote.id===conv.refId)||null:null;
  const refOrderId=conv?.type==="orden"?conv.refId:null;
  const refOrder=conv?.type==="orden"?orders.find((order)=>order.id===conv.refId)||null:null;
  // El asesor asignado también mueve el estado del embarque: es a quien la
  // empresa le indica por el canal interno cuándo hacerlo. El backend comprueba
  // que sea el asignado a esa orden.
  const canManageOrder = currentUserRole === "importadora" || currentUserRole === "asesor";
  // La calculadora es de la empresa y solo tiene sentido en el hilo con el
  // cliente (cotización u orden), no en el interno ni en soporte.
  const puedeEstimarPrecio = canManageOrder && (conv?.type==="cotizacion" || conv?.type==="orden");
  const cotizacionDelHilo = conv?.quoteId ? quotes.find((quote)=>quote.id===conv.quoteId) || null : null;
  // Pasar una estimación a propuesta formal: solo mientras se negocia la
  // cotización (en una orden ya hay propuesta aceptada) y si la propuesta de la
  // empresa sigue editable. El backend vuelve a validarlo al guardar.
  const estadoPropuestaEmpresa = conv?.quoteId ? proposalStateByQuoteId[conv.quoteId] : undefined;
  const accionEstimacion = puedeEstimarPrecio && conv?.type==="cotizacion" && conv.quoteId
    && (!estadoPropuestaEmpresa || estadoPropuestaEmpresa==="borrador" || estadoPropuestaEmpresa==="pendiente")
    ? (estimate:EstimacionEnMensaje)=>({
        etiqueta: estadoPropuestaEmpresa ? "Actualizar propuesta con esta estimación" : "Convertir en propuesta",
        onClick: ()=>onConvertEstimateToProposal(conv.quoteId,estimate),
      })
    : null;
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
      setOrderActionMessage(`Orden marcada como «${siguienteEstado.label}».`);
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

    const source=previewAttachment?.storage_url;
    if(!source){
      return;
    }

    void (async()=>{
      try{
        const blob=await fetchProtectedBlob(source);
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

  // Delega en el helper compartido: abrirlo aqui con
  // `popup.location.replace(blobUrl)` dejaba la pestana en `about:blank`,
  // porque el navegador no permite navegar de primer nivel a una `blob:` URL.
  async function handleOpenResource(url: string | null, fileName: string) {
    const resultado = await abrirArchivoEnPestana(url, fileName);
    if (!resultado.ok) {
      toast.error(resultado.motivo || `No se pudo abrir ${fileName}`);
    }
  }

  async function loadResourceFolder(parentId: string | null) {
    setResourceLoading(true);
    try {
      const explorer = await businessService.listDocumentExplorer(parentId);
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
    const targetConversationId = resourceTargetConversationId.trim();
    if (!targetConversationId) {
      toast.error("Selecciona el chat destino");
      return;
    }
    await onShareExistingResource([targetConversationId], file.id, `Recurso compartido: ${file.nombre}`);
    toast.success("Recurso enviado al chat");
    setIsResourcePickerOpen(false);
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

  function resourcePreviewThumb(file: BackendArchivoItem): string | null {
    const mime = String(file.mime_type || "").toLowerCase();
    if (mime.startsWith("image/") && file.storage_url && resourcePreviewUrls[file.id]) {
      return resourcePreviewUrls[file.id];
    }
    return null;
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
        {k:"ordenes",label:"Órdenes"},
        {k:"cotizaciones",label:"Cotizaciones"},
        // La pestaña de equipo solo aparece si hay algún hilo interno: al
        // solicitante no le sirve de nada y nunca va a tener ninguno.
        ...(conversations.some(c=>c.type==="interno")?[{k:"interno",label:"Equipo"}]:[]),
        ...(conversations.some(c=>c.type==="soporte")?[{k:"soporte",label:"Soporte"}]:[]),
        {k:"no-leidas",label:"No leídas"},
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
      if (previewType(attachment) !== "image" || !attachment.storage_url) {
        return;
      }
      if (attachmentThumbRegistryRef.current[attachment.archivo_id] || attachmentThumbLoadingRef.current[attachment.archivo_id]) {
        return;
      }

      attachmentThumbLoadingRef.current[attachment.archivo_id] = true;
      void fetchProtectedBlob(attachment.storage_url)
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

    const fileIds = new Set(pickerVisibleFiles.map((file) => file.id));
    Object.entries(resourcePreviewRegistryRef.current).forEach(([fileId, objectUrl]) => {
      if (!fileIds.has(fileId)) {
        window.URL.revokeObjectURL(objectUrl);
        delete resourcePreviewRegistryRef.current[fileId];
        delete resourcePreviewLoadingRef.current[fileId];
      }
    });

    setResourcePreviewUrls((current) => {
      const next: Record<string,string> = {};
      pickerVisibleFiles.forEach((file) => {
        if (current[file.id]) {
          next[file.id] = current[file.id];
        }
      });
      const iguales = Object.keys(next).length === Object.keys(current).length
        && Object.keys(next).every((clave) => next[clave] === current[clave]);
      return iguales ? current : next;
    });

    pickerVisibleFiles.forEach((file) => {
      const mime = String(file.mime_type || "").toLowerCase();
      if (!mime.startsWith("image/") || !file.storage_url) {
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
  }, [isResourcePickerOpen, pickerVisibleFiles]);

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

          {/* ── Left: conversation list ─────────────────────────────────── */}
          <div className="w-72 flex-shrink-0 border-r border-border bg-white flex flex-col">
            {modoEquipo&&(
              <div className="px-3 pt-3 pb-2 border-b border-border space-y-2">
                <div>
                  <p className="text-sm font-semibold">Canal del equipo</p>
                  <p className="text-[11px] text-muted-foreground">
                    Administración y soporte. Los clientes y las empresas no entran aquí.
                  </p>
                </div>
                <select
                  aria-label="Abrir un hilo con alguien del equipo"
                  className="w-full rounded-lg border border-border bg-white px-2 py-1.5 text-xs"
                  value=""
                  onChange={(e)=>{
                    const id=e.target.value;
                    if(id&&onAbrirHiloEquipo){void onAbrirHiloEquipo(id);}
                    e.target.value="";
                  }}
                >
                  <option value="">Hablar en privado con…</option>
                  {miembrosEquipo.map((m)=>(
                    <option key={m.id} value={m.id}>
                      {(m.nombre||m.email)}{m.rol==="soporte"?` · soporte N${m.nivel_soporte??1}`:" · administración"}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="px-3 pt-3 pb-2 border-b border-border">
              <Input placeholder={modoEquipo?"Buscar en el canal...":"Buscar por código, empresa, asesor..."} value={searchConv} onChange={e=>setSearchConv(e.target.value)} prefix={<Search className="w-3.5 h-3.5"/>}/>
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
              {filteredConvs.length===0?(
                <div className="flex flex-col items-center justify-center py-12 gap-2 px-4 text-center">
                  <MessageSquare className="w-8 h-8 text-muted-foreground/30"/>
                  <p className="text-sm text-muted-foreground">No hay conversaciones</p>
                </div>
              ):filteredConvs.map(c=>{
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
                return (
                  <button key={c.id} onClick={()=>setSelectedId(c.id)}
                    className={clsx("w-full text-left px-3 py-3 border-b border-border/50 transition-colors flex gap-2.5",
                      isSelected?"bg-primary/5 border-l-2 border-l-primary":"hover:bg-muted/50")}>
                    {/* El avatar es de la PERSONA y el distintivo pequeño dice de
                        qué hilo se trata: antes solo había un icono por tipo,
                        igual para todas las conversaciones de esa clase. */}
                    <div className="relative flex-shrink-0 mt-0.5">
                      <Avatar initials={suContraparte.iniciales} size="lg" color={suContraparte.color} src={suContraparte.fotoUrl||undefined}/>
                      <span className={clsx("absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-background",
                        c.type==="orden"?"bg-purple-100 text-purple-600":c.type==="interno"?"bg-amber-100 text-amber-600":c.type==="soporte"?"bg-rose-100 text-rose-600":"bg-blue-100 text-blue-600")}>
                        {c.type==="orden"?<ShoppingCart className="w-2.5 h-2.5"/>:c.type==="interno"?<Users className="w-2.5 h-2.5"/>:c.type==="soporte"?<LifeBuoy className="w-2.5 h-2.5"/>:<FileText className="w-2.5 h-2.5"/>}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <p className={clsx("text-xs font-semibold truncate",isSelected?"text-primary":"text-foreground")}>
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
                );
              })}
            </div>
          </div>

          {/* ── Center: chat area ───────────────────────────────────────── */}
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
                        {conv.type==="orden"?`Orden · ${conv.refCode}`:conv.type==="interno"?"Canal interno · el cliente no lo ve":`Cotización · ${conv.refCode}`}
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
                    <Button variant="secondary" size="sm" icon={<ExternalLink className="w-3 h-3"/>} onClick={()=>onViewOrder(refOrderId)}>Ver orden</Button>
                  )}
                  <button onClick={()=>setShowCtx(v=>!v)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title={showCtx?"Ocultar panel":"Ver contexto"}>
                    {showCtx?<PanelRightClose className="w-4 h-4"/>:<PanelRightOpen className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-slate-50/40">
                {convMsgs.map((msg,i)=>{
                  const isClient=msg.sender==="client";
                  const prevMsg=i>0?convMsgs[i-1]:null;
                  const messageAttachments=attachmentsByMessage[msg.id]||[];
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
                        {!isClient&&<Avatar initials={contraparte.iniciales} size="sm" color={contraparte.color} src={contraparte.fotoUrl||undefined}/>}
                        <div className={clsx("max-w-[70%] flex flex-col gap-1",isClient?"items-end":"items-start")}>
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
                                        onClick={()=>{void handleDownloadResource(attachment.storage_url, attachment.nombre);}}
                                      >
                                        Descargar
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {msg.estimate&&<TarjetaEstimacion estimacion={msg.estimate} propia={isClient} accion={accionEstimacion?accionEstimacion(msg.estimate):undefined}/>}
                          {!msg.estimate&&shouldRenderMessageText(msg, messageAttachments.length) && (
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
                              <span className={clsx("text-[10px]",msg.read?"text-primary":"text-muted-foreground")}>
                                {msg.read?"✓✓":"✓"}
                              </span>
                            )}
                          </div>
                        </div>
                        {isClient&&<Avatar initials="AG" size="sm"/>}
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
                  onChange={(event)=>{void handleAttachFileChange(event,false);}}
                />
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event)=>{void handleAttachFileChange(event,true);}}
                />
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
                    {puedeEstimarPrecio&&(
                      <button
                        onClick={()=>setShowCalculadora(true)}
                        className="h-9 px-2.5 flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 text-primary text-xs font-medium hover:bg-primary/5 transition-colors"
                        title="Calculadora de precios: envía al cliente un precio estimado"
                      >
                        <Calculator className="w-4 h-4"/>
                        <span className="hidden md:inline">Calcular precio</span>
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
                    onClick={()=>{void sendMsg();}}
                    disabled={!input.trim()||sending}
                    className={clsx("w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0",
                      input.trim()?"bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent shadow-sm":"bg-muted text-muted-foreground cursor-not-allowed")}>
                    <Send className="w-4 h-4"/>
                  </button>
                </div>
              </div>
            </div>
          )}

          {conv&&puedeEstimarPrecio&&(
            <CalculadoraPreciosChat
              abierta={showCalculadora}
              referencia={[conv.refCode,cotizacionDelHilo?.product,conv.counterpartName].filter(Boolean).join(" · ")}
              valoresIniciales={{
                cantidad:extractFirstNumber(cotizacionDelHilo?.minQuantity)||undefined,
                moneda:cotizacionDelHilo?.targetPriceCurrency,
                incoterm:cotizacionDelHilo?.incoterm,
                precioObjetivo:cotizacionDelHilo?.targetPrice&&cotizacionDelHilo.targetPrice!=="N/D"?cotizacionDelHilo.targetPrice:undefined,
              }}
              onCerrar={()=>setShowCalculadora(false)}
              onEnviar={async(entrada)=>{
                await onSendPriceEstimate(conv.id,entrada);
                setTimeout(()=>messagesEndRef.current?.scrollIntoView({behavior:"smooth"}),50);
              }}
            />
          )}

          {/* ── Right: context panel ────────────────────────────────────── */}
          {conv&&showCtx&&(
            <div className="w-56 flex-shrink-0 border-l border-border bg-white overflow-y-auto flex flex-col">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contexto</p>
              </div>
              <div className="p-3 space-y-3 flex-1">
                {conv.type==="soporte"?(
                  <div className={clsx("rounded-lg border px-2.5 py-2 space-y-1.5",conv.closed?"bg-emerald-50 border-emerald-200":"bg-rose-50 border-rose-200")}>
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
                      ["Asunto", conv.subject || "—"],
                      ["Urgencia", URGENCIA_SOPORTE[conv.urgency || ""]?.label || "—"],
                      ["Nivel de mesa", conv.level ? `Nivel ${conv.level}` : "—"],
                      ["Atiende", conv.agentName || "Sin asignar"],
                      ["Solicita", conv.counterpartName || "—"],
                      ["Perfil", etiquetaDeRol(conv.requesterRole) || "—"],
                      ...(conv.closed ? [["Cerró", conv.closedBy || "—"]] : []),
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
                      <div className="pt-1.5 border-t border-rose-200 space-y-1.5">
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
                          placeholder="Qué se hizo para resolverlo…"
                          className="w-full resize-none rounded-md border border-rose-200 px-2 py-1.5 text-[11px] bg-white"
                        />
                        <Button variant="primary" size="sm" fullWidth loading={cerrandoTicket}
                          disabled={resolucionTicket.trim().length<5}
                          onClick={()=>{void cerrarTicket();}}>
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
                              ★
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
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2">
                    <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide mb-1">Canal interno</p>
                    <p className="text-[11px] text-amber-900 leading-snug">
                      Coordinación entre la empresa y {conv.counterpartName||"el asesor"}. Úsalo para indicar
                      cuándo actualizar el estado de una orden. El solicitante no ve estos mensajes.
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
                    {contraparte.empresa&&(chatAdvisorWhatsapp||chatAdvisorEmail)&&(
                      <div className="flex gap-1">
                        <ContactBtn type="whatsapp" size="sm" label="WA" className="flex-1 justify-center" onClick={()=>openSmartContact({type:"whatsapp",whatsapp:chatAdvisorWhatsapp,onOpenChat:()=>setShowCtx(true)})}/>
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
                    canal interno es de un asesor concreto por definición, y un
                    ticket de soporte no se pasa a una empresa. */}
                {conv.type!=="interno"&&conv.type!=="soporte"&&(<>
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
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Orden</p>
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
                            {refOrder?.status==="entregado"?"La orden ya está entregada.":"Sin siguiente estado disponible."}
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
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Documentos de la orden</p>
                      {(refOrder?.documents || []).slice(0,6).map((doc)=>(
                        <button key={`${doc.name}-${doc.date}-${doc.url}`} type="button" onClick={()=>{void abrirArchivoEnPestana(doc.url);}} className="block w-full text-left rounded-lg border border-border px-2 py-1.5 hover:bg-muted transition-colors">
                          <p className="text-[11px] font-medium truncate">{doc.name}</p>
                          <p className="text-[10px] text-muted-foreground">{doc.type || "documento"} · {doc.date}</p>
                        </button>
                      ))}
                      {(!refOrder?.documents || refOrder.documents.length===0)&&<p className="text-[10px] text-muted-foreground">Sin documentos adicionales.</p>}
                    </div>

                    <Button variant="secondary" size="sm" fullWidth className="mt-2 text-xs" onClick={()=>onViewOrder(refOrderId)}>Ver orden</Button>
                  </div>
                </>)}
              </div>
            </div>
          )}
        </div>

        {previewAttachment && (
          <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl border border-border w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{previewAttachment.nombre}</p>
                  <p className="text-xs text-muted-foreground">{previewAttachment.extension.toUpperCase()} · {new Date(previewAttachment.created_at).toLocaleString("es-CO")}</p>
                </div>
                <div className="flex items-center gap-2">
                  {previewAttachment.storage_url && <Button variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5"/>} onClick={()=>{void handleDownloadResource(previewAttachment.storage_url, previewAttachment.nombre);}}>Descargar</Button>}
                  {previewAttachment.storage_url && <Button variant="secondary" size="sm" onClick={()=>{void handleOpenResource(previewAttachment.storage_url, previewAttachment.nombre);}}>Abrir</Button>}
                  <button onClick={()=>setPreviewAttachment(null)} className="w-8 h-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"><X className="w-4 h-4"/></button>
                </div>
              </div>
              <div className="p-4 overflow-auto bg-slate-50/60 flex-1">
                {previewAttachment.storage_url && previewType(previewAttachment)!=="other" && !previewObjectUrl && !previewLoadFailed && (
                  <div className="h-[40vh] flex items-center justify-center text-sm text-muted-foreground">Cargando vista previa...</div>
                )}
                {previewAttachment.storage_url && previewType(previewAttachment)!=="other" && previewLoadFailed && (
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
                {(!previewAttachment.storage_url || previewType(previewAttachment)==="other") && (
                  <div className="h-[40vh] rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-3 text-center px-6">
                    <Video className="w-8 h-8 text-muted-foreground/40"/>
                    <p className="text-sm text-muted-foreground">Vista previa no disponible para este tipo de archivo.</p>
                    {previewAttachment.storage_url && <Button variant="secondary" size="sm" onClick={()=>{void handleOpenResource(previewAttachment.storage_url, previewAttachment.nombre);}}>Abrir en nueva pestaña</Button>}
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
                >
                  Lista
                </Button>
                <Button
                  variant={resourceViewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  icon={<LayoutGrid className="w-3.5 h-3.5" />}
                  onClick={() => setResourceViewMode("grid")}
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
                  className={clsx("text-xs px-2 py-1 rounded-md border",index===resourceFolderTrail.length-1?"bg-primary/10 text-primary border-primary/20":"bg-white text-muted-foreground border-border hover:text-foreground")}
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
                      ? "doc-system-folder"
                      : "border-border bg-sky-50/40 hover:bg-sky-50",
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
                    <Button size="sm" variant="secondary" icon={<Download className="w-3.5 h-3.5"/>} onClick={()=>{void handleDownloadResource(file.storage_url, file.nombre);}}>Descargar</Button>
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


// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTOS + PAGOS placeholders
// ─────────────────────────────────────────────────────────────────────────────
function DocumentosScreen({
  sb,
  explorer,
  isLoading,
  currentFolderId,
  onLoadFolder,
  onCreateFolder,
  onRegisterFile,
  onSearch,
  onMoveFile,
  onMoveFolder,
  onRenameFile,
  onRenameFolder,
  onDeleteFile,
  onDeleteFolder,
  protectedFolders,
}: {
  sb: SidebarCtrl;
  explorer: BackendExplorerResponse;
  isLoading: boolean;
  currentFolderId: string | null;
  onLoadFolder: (parentId: string | null) => Promise<void>;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onRegisterFile: (file: File, parentId: string | null) => Promise<void>;
  onSearch: (query: string) => Promise<BackendArchivoItem[]>;
  onMoveFile: (fileId: string, targetFolderId: string | null) => Promise<void>;
  onMoveFolder: (folderId: string, targetParentId: string | null) => Promise<void>;
  onRenameFile: (fileId: string, newName: string) => Promise<void>;
  onRenameFolder: (folderId: string, newName: string) => Promise<void>;
  onDeleteFile: (fileId: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  protectedFolders: Array<{ id: string; nombre: string }>;
}) {
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Drag & drop estados para carga external
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);
  const [dragHoverFolderId, setDragHoverFolderId] = useState<string | null>(null);

  // Drag & drop estados para mover elementos internos
  const [dragFileId, setDragFileId] = useState<string | null>(null);
  const [dragFolderId, setDragFolderId] = useState<string | null>(null);

  const [searchResults, setSearchResults] = useState<{
    files: BackendArchivoItem[];
    folders: BackendExplorerResponse["carpetas"];
  } | null>(null);
  const [folderTrail, setFolderTrail] = useState<Array<{ id: string | null; name: string }>>([
    { id: null, name: "Raíz" },
  ]);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [gridPreviewUrls, setGridPreviewUrls] = useState<Record<string, string>>({});
  const [menuState, setMenuState] = useState<{
    kind: "file" | "folder" | "canvas";
    id: string | null;
    x: number;
    y: number;
    file?: BackendArchivoItem;
    folder?: BackendExplorerResponse["carpetas"][number];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const gridPreviewLoadingRef = useRef<Record<string, boolean>>({});
  const gridPreviewRegistryRef = useRef<Record<string, string>>({});
  const protectedFolderSet = new Set(protectedFolders.map((folder) => folder.id));
  const chatRootFolderId =
    protectedFolders.find((folder) => normalizeFolderName(folder.nombre) === "chats")?.id || null;

  function isProtectedFolder(folderId: string): boolean {
    if (protectedFolderSet.has(folderId)) {
      return true;
    }
    return Boolean(explorer.carpetas.find((folder) => folder.id === folderId)?.is_protected);
  }

  const visibleFiles = searchResults?.files ?? explorer.archivos;
  const visibleFolders = searchResults
    ? searchResults.folders
    : currentFolderId === null
    ? explorer.carpetas.filter((folder, index, all) => {
        if (
          !SYSTEM_ROOT_FOLDER_NAMES.some(
            (name) => normalizeFolderName(name) === normalizeFolderName(folder.nombre)
          )
        ) {
          return true;
        }
        return (
          all.findIndex(
            (candidate) =>
              normalizeFolderName(candidate.nombre) === normalizeFolderName(folder.nombre)
          ) === index
        );
      })
    : explorer.carpetas;

  useEffect(() => {
    if (currentFolderId === null) {
      setFolderTrail([{ id: null, name: "Raíz" }]);
    }
  }, [currentFolderId]);

  // Búsqueda en tiempo real con debounce
  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await onSearch(query);
        const normalizedQuery = normalizeFolderName(query);
        const folderRows = explorer.carpetas.filter((folder) =>
          normalizeFolderName(folder.nombre).includes(normalizedQuery),
        );
        setSearchResults({ files: rows, folders: folderRows });
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, onSearch, explorer.carpetas]);

  useEffect(() => {
    if (!menuState) return;
    const onWindowEvent = () => setMenuState(null);
    window.addEventListener("scroll", onWindowEvent, true);
    window.addEventListener("resize", onWindowEvent);
    return () => {
      window.removeEventListener("scroll", onWindowEvent, true);
      window.removeEventListener("resize", onWindowEvent);
    };
  }, [menuState]);

  async function handleCreateFolderPrompt() {
    const entered = window.prompt("Nombre de la nueva carpeta", "") ?? "";
    const normalized = entered.trim();
    if (!normalized) return;
    setIsSubmitting(true);
    try {
      await onCreateFolder(normalized, currentFolderId);
    } finally {
      setIsSubmitting(false);
      setMenuState(null);
    }
  }

  async function handleFilePick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsSubmitting(true);
    try {
      await onRegisterFile(file, currentFolderId);
    } finally {
      setIsSubmitting(false);
      event.target.value = "";
    }
  }

  // Carga al soltar un archivo externo en el canvas o sobre una carpeta
  async function handleDropUpload(
    event: React.DragEvent<HTMLDivElement>,
    targetFolderId: string | null = currentFolderId
  ) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOverCanvas(false);
    setDragHoverFolderId(null);

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    try {
      await onRegisterFile(file, targetFolderId);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function openFolder(folder: { id: string; nombre: string }) {
    setSearchResults(null);
    setSearch("");
    setFolderTrail((prev) => [...prev, { id: folder.id, name: folder.nombre }]);
    await onLoadFolder(folder.id);
  }

  async function jumpToTrail(index: number) {
    const node = folderTrail[index];
    setSearchResults(null);
    setSearch("");
    setFolderTrail((prev) => prev.slice(0, index + 1));
    await onLoadFolder(node.id);
  }

  async function moveFileTo(fileId: string, targetFolderId: string | null) {
    setMenuState(null);
    await onMoveFile(fileId, targetFolderId);
    if (targetFolderId === null) {
      setFolderTrail([{ id: null, name: "Raíz" }]);
      setSearch("");
      setSearchResults(null);
      await onLoadFolder(null);
    }
  }

  async function moveFolderTo(folderId: string, targetFolderId: string | null) {
    if (isProtectedFolder(folderId)) {
      toast.error("Esta carpeta del sistema no se puede mover.");
      setMenuState(null);
      return;
    }
    setMenuState(null);
    await onMoveFolder(folderId, targetFolderId);
    if (targetFolderId === null) {
      setFolderTrail([{ id: null, name: "Raíz" }]);
      setSearch("");
      setSearchResults(null);
      await onLoadFolder(null);
    }
  }

  async function handleDeleteFile(fileId: string) {
    setMenuState(null);
    await onDeleteFile(fileId);
  }

  async function handleDeleteFolder(folderId: string) {
    if (isProtectedFolder(folderId)) {
      toast.error("Esta carpeta del sistema no se puede eliminar.");
      setMenuState(null);
      return;
    }
    setMenuState(null);
    await onDeleteFolder(folderId);
  }

  async function handleRenameFile(file: BackendArchivoItem) {
    const splitName = (name: string) => {
      const trimmed = name.trim();
      const lastDot = trimmed.lastIndexOf(".");
      if (lastDot <= 0 || lastDot === trimmed.length - 1) {
        return { base: trimmed, ext: "" };
      }
      return {
        base: trimmed.slice(0, lastDot),
        ext: trimmed.slice(lastDot + 1),
      };
    };

    const { base, ext } = splitName(file.nombre);
    const nextBase =
      window.prompt(
        ext ? `Nuevo nombre del archivo (sin .${ext})` : "Nuevo nombre del archivo",
        base
      ) ?? "";
    const normalizedBase = nextBase.trim();

    if (!normalizedBase) {
      setMenuState(null);
      return;
    }

    const nextFullName = ext ? `${normalizedBase}.${ext}` : normalizedBase;
    if (nextFullName === file.nombre) {
      setMenuState(null);
      return;
    }

    await onRenameFile(file.id, nextFullName);
    setMenuState(null);
  }

  async function handleRenameFolder(folder: BackendExplorerResponse["carpetas"][number]) {
    if (isProtectedFolder(folder.id)) {
      toast.error("Esta carpeta del sistema no se puede renombrar.");
      setMenuState(null);
      return;
    }
    const nextName = window.prompt("Nuevo nombre para la carpeta", folder.nombre) ?? "";
    const normalized = nextName.trim();
    if (!normalized || normalized === folder.nombre) {
      setMenuState(null);
      return;
    }
    await onRenameFolder(folder.id, normalized);
    setMenuState(null);
  }

  function fmtBytes(bytes: number | null): string {
    if (!bytes || bytes <= 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
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

  async function handleCopyLink(url: string | null) {
    const shareable = absoluteResourceUrl(url);
    if (!shareable) {
      toast.error("No hay enlace disponible para copiar");
      setMenuState(null);
      return;
    }

    try {
      await navigator.clipboard.writeText(shareable);
      toast.success("Enlace copiado al portapapeles");
    } catch (error) {
      console.error("No se pudo copiar el enlace:", error);
      toast.error("No se pudo copiar el enlace");
    } finally {
      setMenuState(null);
    }
  }

  async function handleDownload(url: string | null, fileName: string) {
    try {
      const blob = await fetchProtectedBlob(url);
      if (!blob) return;
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Error descargando archivo:", error);
      const message = error instanceof Error ? error.message : "Error desconocido";
      if (message.includes("(404)")) {
        toast.error(`No se encontró el archivo en el servidor: ${fileName}`);
      } else {
        toast.error(`No se pudo descargar ${fileName}`);
      }
    } finally {
      setMenuState(null);
    }
  }

  async function handleOpenResource(url: string | null, fileName: string) {
    const resultado = await abrirArchivoEnPestana(url, fileName);
    if (!resultado.ok) {
      toast.error(resultado.motivo || `No se pudo abrir ${fileName}`);
    }
  }

  function handleOpenMenuAtPoint(
    payload: {
      kind: "file" | "folder" | "canvas";
      id: string | null;
      file?: BackendArchivoItem;
      folder?: BackendExplorerResponse["carpetas"][number];
    },
    clientX: number,
    clientY: number
  ) {
    const menuWidth = 176;
    const menuHeight = 200;
    const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, clientX));
    const top = Math.max(8, Math.min(window.innerHeight - menuHeight - 8, clientY));
    setMenuState({
      ...payload,
      x: left,
      y: top,
    });
  }

  function handleOpenMenu(
    event: React.MouseEvent<HTMLButtonElement>,
    payload: {
      kind: "file" | "folder";
      id: string;
      file?: BackendArchivoItem;
      folder?: BackendExplorerResponse["carpetas"][number];
    }
  ) {
    const rect = event.currentTarget.getBoundingClientRect();
    handleOpenMenuAtPoint(payload, rect.right - 170, rect.bottom + 6);
  }

  function previewThumb(file: BackendArchivoItem): string | null {
    const mime = String(file.mime_type || "").toLowerCase();
    if (mime.startsWith("image/") && file.storage_url && gridPreviewUrls[file.id]) {
      return gridPreviewUrls[file.id];
    }
    return null;
  }

  useEffect(() => {
    const fileIds = new Set(visibleFiles.map((file) => file.id));
    Object.entries(gridPreviewRegistryRef.current).forEach(([fileId, objectUrl]) => {
      if (!fileIds.has(fileId)) {
        window.URL.revokeObjectURL(objectUrl);
        delete gridPreviewRegistryRef.current[fileId];
        delete gridPreviewLoadingRef.current[fileId];
      }
    });

    setGridPreviewUrls((current) => {
      const next: Record<string, string> = {};
      visibleFiles.forEach((file) => {
        if (current[file.id]) {
          next[file.id] = current[file.id];
        }
      });
      return next;
    });

    if (viewMode !== "grid") {
      return;
    }

    visibleFiles.forEach((file) => {
      const mime = String(file.mime_type || "").toLowerCase();
      if (!mime.startsWith("image/") || !file.storage_url) {
        return;
      }
      if (gridPreviewRegistryRef.current[file.id] || gridPreviewLoadingRef.current[file.id]) {
        return;
      }

      gridPreviewLoadingRef.current[file.id] = true;
      void fetchProtectedBlob(file.storage_url)
        .then((blob) => {
          if (!blob) return;
          const objectUrl = window.URL.createObjectURL(blob);
          gridPreviewRegistryRef.current[file.id] = objectUrl;
          setGridPreviewUrls((current) => ({ ...current, [file.id]: objectUrl }));
        })
        .catch(() => {
          // Si falla la miniatura, se mantiene fallback de icono.
        })
        .finally(() => {
          delete gridPreviewLoadingRef.current[file.id];
        });
    });
  }, [viewMode, visibleFiles]);

  useEffect(() => {
    return () => {
      Object.values(gridPreviewRegistryRef.current).forEach((objectUrl) => {
        window.URL.revokeObjectURL(objectUrl);
      });
      gridPreviewRegistryRef.current = {};
      gridPreviewLoadingRef.current = {};
    };
  }, []);

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      <Sidebar {...sb} active="documentos" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb} />
        <main
          className="flex-1 overflow-y-auto px-6 py-6 space-y-5"
          onClick={() => setMenuState(null)}
          onContextMenu={(event) => {
            event.preventDefault();
            handleOpenMenuAtPoint({ kind: "canvas", id: currentFolderId }, event.clientX, event.clientY);
          }}
        >
          <div>
            <Breadcrumb
              items={[
                { label: "Inicio", onClick: () => sb.onNav(sb.navItems[0]?.key || "dashboard") },
                { label: "Documentos" },
              ]}
            />
            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight">Gestión Documental</h1>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(event) => {
              void handleFilePick(event);
            }}
          />

          <Card
            padding="md"
            className="overflow-visible relative"
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes("Files")) {
                event.preventDefault();
                setIsDragOverCanvas(true);
              }
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setIsDragOverCanvas(false);
              }
            }}
            onDrop={(event) => {
              if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
                void handleDropUpload(event);
              }
            }}
          >
            {/* Superposición cuando se arrastran archivos externos al canvas general */}
            {isDragOverCanvas && (
              <div className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-xl flex flex-col items-center justify-center pointer-events-none transition-all">
                <Upload className="w-10 h-10 text-primary animate-bounce mb-2" />
                <p className="text-base font-semibold text-primary">
                  Suelta el archivo para subirlo aquí
                </p>
              </div>
            )}

            {/* Barra de Búsqueda y Botones de Acción Integrados */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 mb-4">
              <div className="w-full md:w-72">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre..."
                  prefix={
                    searching ? (
                      <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )
                  }
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
                <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border">
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                  >
                    Lista
                  </Button>
                  <Button
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                    size="sm"
                    icon={<LayoutGrid className="w-3.5 h-3.5" />}
                    onClick={() => setViewMode("grid")}
                  >
                    Cuadrícula
                  </Button>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  onClick={() => {
                    void onLoadFolder(currentFolderId);
                  }}
                >
                  Actualizar
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<FolderOpen className="w-3.5 h-3.5" />}
                  onClick={() => {
                    void handleCreateFolderPrompt();
                  }}
                  disabled={isSubmitting}
                >
                  Nueva carpeta
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Upload className="w-3.5 h-3.5" />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                >
                  Subir archivo
                </Button>
              </div>
            </div>

            {/* Breadcrumb de carpetas */}
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
              {folderTrail.map((node, index) => (
                <button
                  key={`${node.id || "root"}-${index}`}
                  onClick={() => {
                    void jumpToTrail(index);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragFileId) {
                      void moveFileTo(dragFileId, node.id);
                    }
                    if (dragFolderId) {
                      void moveFolderTo(dragFolderId, node.id);
                    }
                    setDragFileId(null);
                    setDragFolderId(null);
                  }}
                  className={clsx(
                    "text-xs px-2 py-1 rounded-md border transition-colors",
                    index === folderTrail.length - 1
                      ? "bg-primary/10 text-primary border-primary/20 font-medium"
                      : "bg-white text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {node.name}
                </button>
              ))}
            </div>

            {/* Contenido principal (Carpetas y Archivos) */}
            <div
              className={clsx(
                "max-h-[60vh] overflow-y-auto overflow-x-visible pr-1",
                viewMode === "grid" ? "grid grid-cols-2 lg:grid-cols-4 gap-3" : "space-y-2"
              )}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (dragFileId) {
                  void moveFileTo(dragFileId, null);
                }
                if (dragFolderId) {
                  void moveFolderTo(dragFolderId, null);
                }
                setDragFileId(null);
                setDragFolderId(null);
              }}
            >
              {isLoading && (
                <p className="text-sm text-muted-foreground col-span-full py-4 text-center">
                  Cargando documentos...
                </p>
              )}

              {!isLoading &&
                visibleFolders.map((folder) => {
                  const isHoveredForUpload = dragHoverFolderId === folder.id;

                  return (
                    <div
                      key={folder.id}
                      draggable={!isProtectedFolder(folder.id)}
                      onDragStart={() => {
                        if (!isProtectedFolder(folder.id)) setDragFolderId(folder.id);
                      }}
                      onDragEnd={() => setDragFolderId(null)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (event.dataTransfer.types.includes("Files")) {
                          setDragHoverFolderId(folder.id);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragHoverFolderId === folder.id) {
                          setDragHoverFolderId(null);
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDragHoverFolderId(null);

                        // Si es un archivo local arrastrado externamente
                        if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
                          void handleDropUpload(event, folder.id);
                          return;
                        }

                        // Si es un mover interno de archivo o carpeta
                        if (dragFileId) {
                          void moveFileTo(dragFileId, folder.id);
                        }
                        if (
                          dragFolderId &&
                          dragFolderId !== folder.id &&
                          !isProtectedFolder(dragFolderId)
                        ) {
                          void moveFolderTo(dragFolderId, folder.id);
                        }
                        setDragFileId(null);
                        setDragFolderId(null);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleOpenMenuAtPoint(
                          { kind: "folder", id: folder.id, folder },
                          event.clientX,
                          event.clientY
                        );
                      }}
                      className={clsx(
                        "rounded-xl border transition-all relative",
                        isHoveredForUpload
                          ? "border-primary bg-primary/20 scale-[1.01]"
                          : isProtectedFolder(folder.id)
                          ? "doc-system-folder"
                          : "doc-folder",
                        viewMode === "grid"
                          ? "min-h-[220px] p-4 flex flex-col items-center justify-center text-center"
                          : "px-3 py-2.5 flex items-center justify-between gap-3"
                      )}
                    >
                      <button
                        className={clsx(
                          "min-w-0",
                          viewMode === "grid"
                            ? "w-full h-full flex flex-col items-center justify-center text-center"
                            : "text-left w-full"
                        )}
                        onClick={() => {
                          void openFolder(folder);
                        }}
                      >
                        <FolderTree
                          className={clsx(
                            isProtectedFolder(folder.id) ? "doc-system-folder-icon" : "doc-folder-icon",
                            viewMode === "grid" ? "w-12 h-12 mb-3" : "w-4 h-4"
                          )}
                        />
                        <p
                          className={clsx(
                            "text-sm font-semibold truncate",
                            viewMode === "grid" ? "max-w-full" : "flex items-center gap-1.5"
                          )}
                        >
                          {folder.nombre}
                        </p>
                        {isProtectedFolder(folder.id) && (
                          <span className="doc-system-badge inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                            <LockKeyhole className="w-2.5 h-2.5" />
                            Sistema
                          </span>
                        )}
                        {chatRootFolderId === currentFolderId && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Conversación ID: {folder.id}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Carpeta · {new Date(folder.created_at).toLocaleDateString("es-CO")}
                        </p>
                      </button>

                      <div
                        className={clsx(
                          "flex justify-end",
                          viewMode === "grid" ? "absolute top-2 right-2" : ""
                        )}
                      >
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenMenu(event, { kind: "folder", id: folder.id, folder });
                          }}
                          className="w-7 h-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

              {!isLoading &&
                visibleFiles.map((file) => (
                  <div
                    key={file.id}
                    draggable
                    onDragStart={() => setDragFileId(file.id)}
                    onDragEnd={() => setDragFileId(null)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleOpenMenuAtPoint(
                        { kind: "file", id: file.id, file },
                        event.clientX,
                        event.clientY
                      );
                    }}
                    className={clsx(
                      "rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors",
                      viewMode === "grid"
                        ? "relative min-h-[220px] p-4 flex flex-col items-center justify-center text-center"
                        : "px-3 py-2.5 flex items-start justify-between gap-3"
                    )}
                  >
                    {viewMode === "grid" && (
                      <div className="h-24 w-full rounded-lg border border-border bg-slate-50 mb-3 overflow-hidden flex items-center justify-center">
                        {previewThumb(file) ? (
                          <img
                            src={previewThumb(file) || ""}
                            alt={file.nombre}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FormatFileIcon extension={file.extension} mimeType={file.mime_type} />
                        )}
                      </div>
                    )}
                    <div
                      className={clsx(
                        "min-w-0",
                        viewMode === "grid" ? "w-full text-center" : "flex-1"
                      )}
                    >
                      <p className="text-sm font-semibold truncate">{file.nombre}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {file.extension.toUpperCase()} · {fmtBytes(file.size_bytes)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(file.created_at).toLocaleDateString("es-CO")}
                      </p>
                    </div>
                    <div
                      className={clsx(
                        "flex items-center gap-1",
                        viewMode === "grid" ? "absolute top-2 right-2" : ""
                      )}
                    >
                      {viewMode !== "grid" && file.storage_url && (
                        <button
                          onClick={() => {
                            void handleOpenResource(file.storage_url, file.nombre);
                          }}
                          className="text-xs text-primary hover:underline whitespace-nowrap"
                        >
                          Abrir
                        </button>
                      )}
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenMenu(event, { kind: "file", id: file.id, file });
                        }}
                        className="w-7 h-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

              {!isLoading && visibleFolders.length === 0 && visibleFiles.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-full py-8 text-center">
                  No hay elementos en esta carpeta.
                </p>
              )}
            </div>
          </Card>

          {/* Menú Contextual / Desplegable */}
          {menuState && (
            <div className="fixed inset-0 z-[70]" onClick={() => setMenuState(null)}>
              <div
                className="absolute w-44 rounded-lg border border-border bg-white shadow-lg p-1"
                style={{ left: menuState.x, top: menuState.y }}
                onClick={(event) => event.stopPropagation()}
              >
                {menuState.kind === "canvas" && (
                  <>
                    <button
                      onClick={() => {
                        void handleCreateFolderPrompt();
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                    >
                      Nueva carpeta
                    </button>
                    <button
                      onClick={() => {
                        fileInputRef.current?.click();
                        setMenuState(null);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                    >
                      Subir archivo
                    </button>
                    <button
                      onClick={() => {
                        void onLoadFolder(currentFolderId);
                        setMenuState(null);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                    >
                      Refrescar
                    </button>
                  </>
                )}
                {menuState.kind === "folder" && menuState.folder && (
                  <>
                    <button
                      onClick={() => {
                        void openFolder(menuState.folder!);
                        setMenuState(null);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                    >
                      Abrir
                    </button>
                    <button
                      onClick={() => {
                        void onLoadFolder(menuState.folder!.id);
                        setMenuState(null);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                    >
                      Refrescar
                    </button>
                    {!isProtectedFolder(menuState.folder.id) && (
                      <button
                        onClick={() => {
                          void handleRenameFolder(menuState.folder!);
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                      >
                        Renombrar
                      </button>
                    )}
                    {!isProtectedFolder(menuState.folder.id) && (
                      <button
                        onClick={() => {
                          void moveFolderTo(menuState.folder!.id, null);
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                      >
                        Mover a raíz
                      </button>
                    )}
                    {!isProtectedFolder(menuState.folder.id) && (
                      <button
                        onClick={() => {
                          void handleDeleteFolder(menuState.folder!.id);
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 rounded"
                      >
                        Eliminar
                      </button>
                    )}
                    {isProtectedFolder(menuState.folder.id) && (
                      <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
                        Carpeta del sistema protegida.
                      </p>
                    )}
                  </>
                )}
                {menuState.kind === "file" && menuState.file && (
                  <>
                    {menuState.file.storage_url && (
                      <button
                        onClick={() => {
                          void handleOpenResource(
                            menuState.file!.storage_url,
                            menuState.file!.nombre
                          );
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                      >
                        Ver
                      </button>
                    )}
                    {menuState.file.storage_url && (
                      <button
                        onClick={() => {
                          void handleDownload(
                            menuState.file!.storage_url,
                            menuState.file!.nombre
                          );
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                      >
                        Descargar
                      </button>
                    )}
                    <button
                      onClick={() => handleCopyLink(menuState.file!.storage_url)}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                    >
                      Copiar enlace
                    </button>
                    <button
                      onClick={() => {
                        void handleRenameFile(menuState.file!);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                    >
                      Renombrar
                    </button>
                    <button
                      onClick={() => {
                        void moveFileTo(menuState.file!.id, null);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                    >
                      Mover a raíz
                    </button>
                    <button
                      onClick={() => {
                        void handleDeleteFile(menuState.file!.id);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 rounded"
                    >
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/** Armazón común (sidebar, cabecera, migas) para las pantallas que viven en `features/`. */
function PantallaPortal({sb,active,titulo,children}:{sb:SidebarCtrl;active:string;titulo:string;children:React.ReactNode}) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active={active}/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav(sb.navItems[0]?.key||"dashboard")},{label:titulo}]}/>
          <div className="mt-3">{children}</div>
        </main>
      </div>
    </div>
  );
}

function PagosScreen({sb}:{sb:SidebarCtrl}) {
  if (!SHOW_PAYMENTS_MODULE) {
    return (
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar {...sb} active="pagos"/>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AppHeader user={USER} sb={sb}/>
          <main className="flex-1 overflow-y-auto px-6 py-6"><Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav(sb.navItems[0]?.key || "dashboard")},{label:"Pagos"}]}/><h1 className="text-xl font-semibold tracking-tight mt-3 mb-6">Pagos</h1>
            <Card padding="lg" className="border-dashed max-w-lg"><div className="flex flex-col items-center text-center py-8 gap-3"><div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center"><CreditCard className="w-6 h-6 text-muted-foreground/50"/></div><div><p className="font-semibold">Módulo en construcción</p><p className="text-sm text-muted-foreground mt-1 leading-relaxed">Próximamente habilitaremos pagos y conciliaciones para órdenes.</p></div><span className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-medium text-amber-700">Próximamente</span></div></Card>
          </main>
        </div>
      </div>
    );
  }

  const mp=[{id:"PAG-001",amount:"$4,600 USD",concept:"Orden #ORD-2025-0042",date:"10 Mar 2025",status:"Completado"},{id:"PAG-002",amount:"$3,200 USD",concept:"Orden #ORD-2025-0038",date:"02 Mar 2025",status:"Pendiente"},{id:"PAG-003",amount:"$8,900 USD",concept:"Orden #ORD-2025-0031",date:"22 Feb 2025",status:"Parcial"}];
  const sc:Record<string,string>={"Completado":"bg-emerald-50 text-emerald-700","Pendiente":"bg-orange-50 text-orange-700","Parcial":"bg-blue-50 text-blue-700"};
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="pagos"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div><Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav(sb.navItems[0]?.key || "dashboard")},{label:"Pagos"}]}/><div className="flex items-center justify-between mt-3"><h1 className="text-xl font-semibold">Pagos</h1><span className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-700">Módulo en definición · Integración de pagos pendiente</span></div></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{[["Total pagado","$16,700 USD","text-emerald-600"],["Pendiente","$3,200 USD","text-orange-600"],["En liberación parcial","$8,900 USD","text-blue-600"]].map(([l,v,c])=><Card key={l as string} padding="md"><p className="text-xs text-muted-foreground">{l as string}</p><p className={clsx("text-2xl font-semibold mt-1",c as string)}>{v as string}</p></Card>)}</div>
          <Card padding="none"><div className="px-5 py-3.5 border-b border-border flex items-center justify-between"><p className="text-sm font-semibold">Historial de pagos</p><span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded">Visual mockup</span></div>
            <table className="w-full text-sm"><thead><tr className="border-b border-border">{["ID","Concepto","Fecha","Estado","Monto"].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>)}</tr></thead>
            <tbody>{mp.map((p,i)=><tr key={p.id} className={clsx("border-b border-border/60 hover:bg-muted/30",i%2===0?"bg-white":"bg-slate-50/50")}><td className="px-4 py-3 font-mono text-xs font-medium">{p.id}</td><td className="px-4 py-3">{p.concept}</td><td className="px-4 py-3 text-muted-foreground">{p.date}</td><td className="px-4 py-3"><span className={clsx("px-2 py-0.5 rounded-md text-xs font-medium",sc[p.status])}>{p.status}</span></td><td className="px-4 py-3 font-semibold">{p.amount}</td></tr>)}</tbody>
            </table>
          </Card>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW QUOTE WIZARD
// ─────────────────────────────────────────────────────────────────────────────
const STEPS=["Modalidad","Información del producto","Confirmación"];
function Stepper({current}:{current:number}) {
  return (
    <div className="flex items-center">{STEPS.map((label,i)=>{
      const step=i+1;const done=step<current;const active=step===current;
      return (<div key={step} className="flex items-center flex-1 last:flex-none">
        <div className="flex flex-col items-center gap-1.5">
          <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",done?"bg-primary text-white":active?"bg-primary text-white ring-4 ring-primary/20":"bg-muted text-muted-foreground border border-border")}>{done?<Check className="w-4 h-4"/>:step}</div>
          <span className={clsx("text-xs font-medium whitespace-nowrap hidden sm:block",active?"text-primary":done?"text-foreground":"text-muted-foreground")}>{label}</span>
        </div>
        {i<STEPS.length-1&&<div className={clsx("flex-1 h-0.5 mx-2 mb-4 transition-all duration-300",step<current?"bg-primary":"bg-border")}/>}
      </div>);
    })}</div>
  );
}

interface QuoteFormState {productName:string;description:string;referenceLink:string;productPhotoUrls:string[];country:string;productLine:string;quality:string;customization:string;purpose:"ecommerce"|"corporativo";minQuantity:string;unit:"unidades"|"m3";targetPrice:string;targetPriceCurrency:string;incoterm:string;notes:string;shippingMarkSufijo:string;}
/** Igual que `MAX_FOTOS_PRODUCTO` en backend/schemas/cotizacion.py. */
const MAX_FOTOS_PRODUCTO=10;
const EMPTY_FORM:QuoteFormState={productName:"",description:"",referenceLink:"",productPhotoUrls:[],country:"",productLine:"",quality:"",customization:"",purpose:"ecommerce",minQuantity:"",unit:"unidades",targetPrice:"",targetPriceCurrency:"USD",incoterm:"DDP",notes:"",shippingMarkSufijo:""};
const PRICE_CURRENCIES=["USD","EUR","COP","MXN","CLP","PEN","GBP"];
const TIER_ORDER:Record<string,number>={Bronze:0,Silver:1,Gold:2,"Élite":3};
const POSITIVE_DECIMAL_INPUT = /^\d*\.?\d*$/;
function normalizeTargetPriceInput(value: string): string {
  const normalized = value.replace(",", ".");
  return POSITIVE_DECIMAL_INPUT.test(normalized) ? normalized : "";
}
function parseTargetPriceCurrency(value:string|undefined|null):string { const clean=(value||"").trim().toUpperCase(); if(!clean) return "USD"; return PRICE_CURRENCIES.includes(clean)?clean:"USD"; }

function Step1({modalidad,setModalidad,selectedId,setSelectedId,preselectedId,importers}:{modalidad:"dirigida"|"abierta"|null;setModalidad:(m:"dirigida"|"abierta")=>void;selectedId:string|null;setSelectedId:(id:string|null)=>void;preselectedId?:string;importers:Importer[]}) {
  const [cs,setCs]=useState("");const[cc,setCc]=useState("");const[ccat,setCcat]=useState("");const[cr,setCr]=useState("");
  const fi=importers.filter(imp=>{const ms=!cs||imp.name.toLowerCase().includes(cs.toLowerCase());const mc=!cc||imp.country===cc;const mcat=!ccat||imp.categories.some(c=>c.toLowerCase().includes(ccat.toLowerCase()));const mr=!cr||(imp.certs??[]).length>0;return ms&&mc&&mcat&&mr;});
  const hasF=cs||cc||ccat||cr;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[{m:"dirigida" as const,icon:Building2,title:"Cotización dirigida",desc:"Elige una empresa importadora específica para enviar directamente tu solicitud."},{m:"abierta" as const,icon:Globe,title:"Cotización abierta",desc:"La solicitud se distribuirá automáticamente entre importadores compatibles."}].map(({m,icon:Icon,title,desc})=>(
          <button key={m} onClick={()=>{setModalidad(m);if(m==="abierta")setSelectedId(null);}} className={clsx("p-4 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-md",modalidad===m?"border-primary bg-primary/5 shadow-md":"border-border bg-white hover:border-primary/40")}>
            <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center mb-2.5",modalidad===m?"bg-primary":"bg-muted")}><Icon className={clsx("w-5 h-5",modalidad===m?"text-white":"text-muted-foreground")}/></div>
            <h3 className="font-semibold text-sm mb-1.5">{title}</h3><p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            {modalidad===m&&<div className="mt-3 flex items-center gap-1 text-xs text-primary font-medium"><Check className="w-3.5 h-3.5"/>Seleccionada</div>}
          </button>
        ))}
      </div>

      {modalidad==="dirigida"&& (
        <div>
          <h3 className="text-sm font-semibold mb-3">Selecciona una importadora</h3>
          <Card padding="sm" className="mb-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[140px]"><Input placeholder="Buscar empresa..." value={cs} onChange={e=>setCs(e.target.value)} prefix={<Search className="w-4 h-4"/>}/></div>
              <div className="w-32"><Select value={cc} onChange={e=>setCc(e.target.value)}><option value="">País</option>{[...new Set(importers.map(i=>i.country))].map(c=><option key={c}>{c}</option>)}</Select></div>
              <div className="w-36"><Select value={ccat} onChange={e=>setCcat(e.target.value)}><option value="">Categoría</option>{[...new Set(importers.flatMap(i=>i.categories))].map(c=><option key={c}>{c}</option>)}</Select></div>
              <div className="w-44"><Select value={cr} onChange={e=>setCr(e.target.value)}><option value="">Certificación</option><option value="certificadas">Con certificaciones</option></Select></div>
              {hasF&&<Button variant="ghost" size="sm" icon={<RotateCcw className="w-3.5 h-3.5"/>} onClick={()=>{setCs("");setCc("");setCcat("");setCr("");}}>Limpiar</Button>}
            </div>
          </Card>

          {fi.length===0 ? (
            <Card padding="lg" className="border-dashed">
              <div className="py-6 text-center"><p className="text-sm text-muted-foreground">No se encontraron empresas</p></div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {fi.map(imp=>{
                const sel=selectedId===imp.id;
                return(
                  <div key={imp.id} onClick={()=>setSelectedId(sel?null:imp.id)} className={clsx("relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200",sel?"border-primary shadow-lg bg-white":"border-border bg-white hover:border-primary/40 hover:shadow-md")}>
                    {sel&&<div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center"><Check className="w-3 h-3 text-white"/></div>}
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar initials={imp.initials} size="lg" color={imp.color}/>
                      <div className="min-w-0">
                        <div className="flex items-start gap-1"><p className="font-semibold text-sm leading-tight">{imp.name}</p>{imp.verified&&<BadgeCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5"/>}</div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{imp.specialty}</p>
                        <p className="text-xs text-muted-foreground/70 mt-0.5">{imp.country}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs mb-3">
                      <div className="flex items-center gap-1 text-emerald-700">{(imp.certs??[]).length>0&&(<><Shield className="w-3 h-3"/><span className="font-medium">{(imp.certs??[]).length} cert.</span></>)}</div>
                      <div className="flex items-center gap-1 text-muted-foreground"><Clock className="w-3 h-3"/><span>{imp.responseTime}</span></div>
                    </div>
                    <button onClick={e=>{e.stopPropagation();setSelectedId(sel?null:imp.id);}} className={clsx("w-full h-8 rounded-lg text-xs font-medium transition-all",sel?"bg-primary text-white":"bg-muted text-foreground hover:bg-primary/10")}>{sel?"Seleccionada":"Seleccionar"}</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RightPanel({step,modalidad,si,form}:{step:number;modalidad:"dirigida"|"abierta"|null;si:Importer|null;form:QuoteFormState}) {
  const Summary=()=>(<Card padding="md"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Resumen</h3><div className="space-y-2">{[["Producto",form.productName],["País",form.country],["Calidad",form.quality],["Cantidad",form.minQuantity?cantidadConUnidad(form.minQuantity,form.unit):""],["Incoterm",form.incoterm]].map(([k,v])=><div key={k} className="flex justify-between items-start gap-2"><span className="text-xs text-muted-foreground flex-shrink-0">{k}</span><span className="text-xs font-medium text-right">{v||<span className="italic text-muted-foreground/50">—</span>}</span></div>)}</div></Card>);
  if(modalidad==="dirigida"&&si)return(<div className="space-y-4">
    <Card padding="md"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Empresa seleccionada</h3><div className="flex items-start gap-3 mb-3"><Avatar initials={si.initials} size="xl" color={si.color}/><div><p className="font-semibold text-sm">{si.name}</p><p className="text-xs text-muted-foreground mt-0.5">{si.specialty}</p></div></div><div className="space-y-1.5 pt-3 border-t border-border">{[["Miembro desde",si.memberSince],["Proyectos",si.projects.toString()],["Respuesta",si.responseTime]].map(([k,v])=><div key={k} className="flex justify-between"><span className="text-xs text-muted-foreground">{k}</span><span className="text-xs font-medium">{v}</span></div>)}</div></Card>
    <Card padding="md"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Asesor</h3><div className="flex items-start gap-2.5 mb-3"><Avatar initials={si.advisor.initials} size="lg" color={si.advisor.color}/><div><p className="font-semibold text-sm">{si.advisor.name}</p><p className="text-xs text-muted-foreground mt-0.5">{si.advisor.role}</p></div></div><div className="flex gap-2"><ContactBtn type="whatsapp" label="WA" size="sm" className="flex-1 justify-center" onClick={()=>openSmartContact({type:"whatsapp",whatsapp:si.advisor.phone})}/><ContactBtn type="chat" size="sm" className="flex-1 justify-center" onClick={()=>toast.info("El chat se habilita al enviar la cotización.")}/></div></Card>
    {step>=2&&<Summary/>}
    {step===3&&<Card padding="md" className="border-primary/20 bg-primary/5"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary animate-pulse"/><span className="text-xs font-semibold text-primary">Lista para enviar</span></div></Card>}
  </div>);
  if(modalidad==="abierta"){if(step===1)return(<Card padding="md"><div className="flex items-center gap-2 mb-3"><div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><Globe className="w-4 h-4 text-primary"/></div><h3 className="text-sm font-semibold">¿Cómo funciona?</h3></div><div className="space-y-3">{[{i:Send,t:"Tu solicitud llega a importadores activos compatibles."},{i:Users,t:"Múltiples empresas enviarán propuestas."},{i:CheckCircle2,t:"Compara y decide con cuál continuar."}].map(({i:Icon,t},idx)=><div key={idx} className="flex items-start gap-2.5"><div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5"><Icon className="w-3 h-3 text-primary"/></div><p className="text-xs text-muted-foreground leading-relaxed">{t}</p></div>)}</div></Card>);
  return(<div className="space-y-4"><Summary/>{step===3&&<Card padding="md"><div className="space-y-2">{[["Empresas potenciales","23 activas"],["País",form.country||"—"],["Categoría",form.productLine||"—"]].map(([k,v])=><div key={k} className="flex justify-between"><span className="text-xs text-muted-foreground">{k}</span><span className="text-xs font-semibold">{v}</span></div>)}<div className="pt-2 border-t border-border flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"/><span className="text-xs font-semibold text-orange-600">Esperando propuestas</span></div></div></Card>}</div>);}
  return(<Card padding="md" className="border-dashed"><div className="flex flex-col items-center text-center py-4 gap-2"><div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"><Building className="w-5 h-5 text-muted-foreground/40"/></div><p className="text-sm text-muted-foreground">Selecciona una modalidad.</p></div></Card>);
}

function Step2({form,setForm,onProductPhotoUploaded,importer}:{form:QuoteFormState;setForm:React.Dispatch<React.SetStateAction<QuoteFormState>>;onProductPhotoUploaded:(fileItem:BackendArchivoItem)=>void|Promise<void>;importer:Importer|null}) {
  const upd=(f:keyof QuoteFormState,v:string)=>setForm(p=>({...p,[f]:v}));
  const fotos=form.productPhotoUrls;
  const quitarFoto=(url:string)=>setForm(p=>({...p,productPhotoUrls:p.productPhotoUrls.filter(f=>f!==url)}));
  return (
    <div className="space-y-5">
      <Card padding="md"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Tag className="w-4 h-4 text-primary"/>Información del producto</h3>
        <div className="space-y-4">
          <div><p className="text-sm font-medium mb-1.5">Fotos <span className="text-xs text-muted-foreground font-normal">(opcional, hasta {MAX_FOTOS_PRODUCTO})</span></p>
            <div className={clsx("border-2 border-dashed rounded-xl p-5 transition-all",fotos.length?"border-border":"border-border hover:border-primary/40 hover:bg-muted/30")}>
              {fotos.length>0
                ?<div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {fotos.map((url,i)=>(
                    <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                      <button type="button" onClick={()=>{void abrirArchivoEnPestana(url);}} className="block w-full h-full" title="Ver foto">
                        <ImagenArchivo src={url} alt={`Foto ${i+1} del producto`} className="w-full h-full"/>
                      </button>
                      {i===0&&<span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">Portada</span>}
                      <button type="button" onClick={()=>quitarFoto(url)} aria-label={`Quitar foto ${i+1}`} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-100 sm:opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"><X className="h-3.5 w-3.5"/></button>
                    </div>
                  ))}
                </div>
                :<div className="text-center py-3"><Upload className="w-6 h-6 text-muted-foreground/50 mx-auto mb-2"/><p className="text-sm text-muted-foreground">Sube fotos reales del producto: el producto, la etiqueta, el empaque, las medidas</p><p className="text-xs text-muted-foreground/60 mt-1">PNG, JPG, JPEG o WebP · la primera será la portada</p></div>
              }
              <div className="mt-3 flex items-center justify-center gap-3">
                <DocumentUploadButton
                  label={fotos.length?"Agregar fotos":"Subir fotos"}
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  origen="cotizacion"
                  multiple
                  maxArchivos={MAX_FOTOS_PRODUCTO-fotos.length}
                  disabled={fotos.length>=MAX_FOTOS_PRODUCTO}
                  onUploaded={onProductPhotoUploaded}
                  onError={message=>toast.error(message)}
                />
                <span className="text-xs text-muted-foreground">{fotos.length}/{MAX_FOTOS_PRODUCTO}</span>
              </div>
            </div>
          </div>
          <Input label="Nombre del producto" placeholder="Ej. Café Verde Colombiano Premium" value={form.productName} onChange={e=>upd("productName",e.target.value)}/>
          <Textarea label="Descripción" placeholder="Describe el producto..." rows={3} value={form.description} onChange={e=>upd("description",e.target.value)}/>
          <Input label="Link de referencia" placeholder="https://proveedor.com/producto" type="url" value={form.referenceLink} onChange={e=>upd("referenceLink",e.target.value)} hint="URL del proveedor (opcional)"/>
        </div>
      </Card>
      <Card padding="md"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Layers className="w-4 h-4 text-primary"/>Clasificación</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="País de importación" value={form.country} onChange={e=>upd("country",e.target.value)}><option value="">Seleccionar</option>{COUNTRIES.map(c=><option key={c}>{c}</option>)}</Select>
          <Select label="Línea de producto" value={form.productLine} onChange={e=>upd("productLine",e.target.value)}><option value="">Seleccionar</option>{LINES.map(l=><option key={l}>{l}</option>)}</Select>
          <Select label="Calidad" value={form.quality} onChange={e=>upd("quality",e.target.value)}><option value="">Seleccionar</option>{["Económica","Estándar","Premium","Ultra premium"].map(q=><option key={q}>{q}</option>)}</Select>
          <Select label="Personalización" value={form.customization} onChange={e=>upd("customization",e.target.value)}><option value="">Seleccionar</option><option>Estándar</option><option>Personalización de marca</option><option>Personalización de diseño completo</option></Select>
        </div>
      </Card>
      <Card padding="md"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-primary"/>Importación</h3>
        <div className="space-y-4">
          <div><p className="text-sm font-medium mb-2">Propósito</p><div className="flex gap-2">{(["ecommerce","corporativo"]as const).map(opt=><button key={opt} onClick={()=>upd("purpose",opt)} className={clsx("flex-1 h-9 rounded-lg border text-sm font-medium transition-all",form.purpose===opt?"bg-primary text-white border-primary shadow-sm":"bg-white text-muted-foreground border-border hover:border-primary/40")}>{opt==="ecommerce"?"Ecommerce":"Corporativo"}</button>)}</div></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cantidad-minima" className="text-sm font-medium text-foreground">Cantidad mínima</label>
              <div className="relative flex items-center">
                <input
                  id="cantidad-minima"
                  type="number"
                  min={form.unit==="m3"?0.1:1}
                  step={form.unit==="m3"?0.1:1}
                  inputMode={form.unit==="m3"?"decimal":"numeric"}
                  placeholder={form.unit==="m3"?"Ej. 2.5":"Ej. 500"}
                  value={form.minQuantity}
                  onChange={e=>{
                    const valor=e.target.value;
                    // En unidades no hay fracciones; en m³ sí (2,5 m³).
                    upd("minQuantity",form.unit==="m3"?valor:(valor===""?"":String(Math.max(1,Math.round(Number(valor))))));
                  }}
                  className="w-full h-10 bg-white border rounded-lg text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary border-border pl-3 pr-28"
                />
                <div className="absolute right-1 flex rounded-md border border-border bg-white p-0.5" role="radiogroup" aria-label="Unidad de la cantidad">
                  {(["unidades","m3"] as const).map(u=>(
                    <button
                      key={u}
                      type="button"
                      role="radio"
                      aria-checked={form.unit===u}
                      onClick={()=>setForm(p=>({...p,unit:u,minQuantity:u==="unidades"&&p.minQuantity?String(Math.max(1,Math.round(Number(p.minQuantity)))):p.minQuantity}))}
                      className={clsx("h-7 rounded px-2 text-xs font-medium",form.unit===u?"bg-primary text-white":"text-muted-foreground")}
                    >{u==="m3"?"m³":"Unidades"}</button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{form.unit==="m3"?"Volumen en metros cúbicos; admite decimales":"Número de piezas o unidades"}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between"><label htmlFor="precio-objetivo" className="text-sm font-medium text-foreground">Precio objetivo</label></div>
              <div className="relative flex items-center">
                <input id="precio-objetivo" type="text" inputMode="decimal" className="w-full h-10 bg-white border rounded-lg text-sm text-foreground placeholder:text-slate-400 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary border-border pl-3 pr-20" placeholder="Ej. 8.50" value={form.targetPrice} onChange={e=>upd("targetPrice", normalizeTargetPriceInput(e.target.value))}/>
                <div className="absolute right-1">
                  <select value={form.targetPriceCurrency} onChange={e=>setForm(p=>({...p,targetPriceCurrency:e.target.value}))} className="h-8 rounded-md border border-border bg-white px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer pr-6">
                    {PRICE_CURRENCIES.map(currency => <option key={currency} value={currency}>{currency}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none"/>
                </div>
              </div>
            </div>
            <Select label="Incoterm" value={form.incoterm || "DDP"} onChange={e=>upd("incoterm",e.target.value)}><option value="">Seleccionar</option>{INCOTERMS.map(t=><option key={t} value={t}>{t}</option>)}</Select>
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Importación incluida:</span>{" "}
              El proveedor se encargará de la nacionalización de la mercancía antes de
              realizar la facturación electrónica correspondiente.
            </p>
          </div>
          <Textarea label="Notas" placeholder="Información adicional..." rows={3} value={form.notes} onChange={e=>upd("notes",e.target.value)}/>
        </div>
      </Card>
      <Card padding="md"><h3 className="text-sm font-semibold mb-1 flex items-center gap-2"><Package className="w-4 h-4 text-primary"/>Shipping mark</h3>
        <p className="text-xs text-muted-foreground mb-4">Cómo quieres que se rotulen tus cajas dentro del contenedor de la empresa importadora.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <Input
            label="Tu identificador"
            placeholder="Prendas Control"
            maxLength={LONGITUD_MAX_SUFIJO_SHIPPING_MARK}
            value={form.shippingMarkSufijo}
            onChange={e=>upd("shippingMarkSufijo",e.target.value)}
            hint="Opcional. El nombre con el que reconoces tu carga."
          />
          <div className="pt-1">
            <p className="text-sm font-medium mb-1.5">Marca resultante</p>
            <p className="font-mono text-sm px-3 py-2 rounded-lg border border-border bg-muted/40 truncate">
              {componerShippingMark(importer?.shippingMarkPrefix,form.shippingMarkSufijo)||"—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {importer
                ?(importer.shippingMarkPrefix
                  ?`Prefijo de ${importer.name}: ${importer.shippingMarkPrefix}`
                  :`${importer.name} todavía no configuró su prefijo.`)
                :"Se completará con el prefijo de la empresa que atienda tu solicitud."}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Step3Dirigida({form,importer,confirmed,setConfirmed}:{form:QuoteFormState;importer:Importer;confirmed:boolean;setConfirmed:(v:boolean)=>void}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="w-5 h-5 text-primary"/><h2 className="text-base font-semibold">Revisa tu solicitud</h2></div>
      {[{title:"Empresa",icon:Building2,rows:[["Importadora",importer.name],["Especialidad",importer.specialty]]},{title:"Asesor",icon:UserRound,rows:[["Nombre",importer.advisor.name],["Cargo",importer.advisor.role]]},{title:"Producto",icon:Tag,rows:[["Nombre",form.productName||"—"],["País",form.country||"—"],["Calidad",form.quality||"—"]]},{title:"Importación",icon:MapPin,rows:[["Propósito",form.purpose==="ecommerce"?"Ecommerce":"Corporativo"],["Cantidad",form.minQuantity?cantidadConUnidad(form.minQuantity,form.unit):"—"],["Precio objetivo",form.targetPrice ? `${form.targetPrice} ${form.targetPriceCurrency || "USD"}` : "—"],["Incoterm",form.incoterm || "DDP"]]}].map(({title,icon:Icon,rows})=>(
        <Card key={title} padding="md"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5"><Icon className="w-3.5 h-3.5"/>{title}</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">{rows.map(([k,v])=><div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="text-sm font-medium mt-0.5">{v}</p></div>)}</div></Card>
      ))}
      <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer"/><span className="text-sm leading-relaxed">Confirmo que la información es correcta y autorizo el envío de esta solicitud.</span></label>
    </div>
  );
}

function Step3Abierta() {
  return (
    <div className="space-y-4">
      <div><h2 className="text-base font-semibold">Solicitudes abiertas</h2><p className="text-sm text-muted-foreground mt-1">Una vez envíes, los importadores comenzarán a responder.</p></div>
      <Card padding="none"><div className="py-16 flex flex-col items-center text-center gap-3"><div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center"><ClipboardList className="w-6 h-6 text-muted-foreground/40"/></div><p className="font-medium text-sm">Todavía no hay propuestas</p><p className="text-xs text-muted-foreground">Aparecerán aquí cuando los importadores respondan.</p></div></Card>
      <Card padding="md" className="border-blue-100 bg-blue-50"><div className="flex gap-3"><Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5"/><div><p className="text-xs font-semibold text-blue-900 mb-1.5">Información importante</p>{["La cotización se convierte en orden al aceptar una propuesta.","La solicitud deja de estar disponible para los demás importadores."].map((t,i)=><div key={i} className="flex items-start gap-1.5"><span className="text-primary text-xs mt-0.5">•</span><p className="text-xs text-blue-800 leading-relaxed">{t}</p></div>)}</div></div></Card>
    </div>
  );
}

/** Producto de Tendencias o de un catálogo del que sale una solicitud. */
interface OrigenSolicitud {
  origen:"tendencias"|"catalogo";
  nombre:string;
  revisarRequisitos:boolean;
  tendenciaEdicionId?:string|null;
  tendenciaProductoId?:string;
  catalogoProductoId?:string;
}

function NewQuoteScreen({onBack,sb,preselectedImporterId,importers,onSubmitQuote,creditos,cotizanteTier="Bronze",prefill,origen=null}:{onBack:()=>void;sb:SidebarCtrl;preselectedImporterId?:string;importers:Importer[];onSubmitQuote:(payload:CreateCotizacionPayload,desbloquear?:boolean)=>Promise<void>;creditos:number;cotizanteTier?:string;prefill?:Partial<QuoteFormState>;origen?:OrigenSolicitud|null}) {
  const [step,setStep]=useState(1);
  const [modalidad,setModalidad]=useState<"dirigida"|"abierta"|null>(preselectedImporterId?"dirigida":null);
  const [selectedId,setSelectedId]=useState<string|null>(preselectedImporterId||null);
  // `prefill` llega al duplicar una cotización existente: se copian sus datos
  // y el usuario solo ajusta lo que cambie.
  const [form,setForm]=useState<QuoteFormState>({...EMPTY_FORM,...prefill});
  const [confirmed,setConfirmed]=useState(false);const[stepError,setStepError]=useState("");
  // El error se pinta al final de la columna con scroll, y quien lo provoca
  // está abajo, junto al botón de enviar: sin desplazarlo a la vista, un
  // rechazo del servidor (p. ej. la empresa agotó su cupo diario) parecía un
  // clic que no hacía nada.
  const stepErrorRef=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{if(stepError)stepErrorRef.current?.scrollIntoView({behavior:"smooth",block:"nearest"});},[stepError]);
  const [desbloquearPorCredito,setDesbloquearPorCredito]=useState(false);
  const [submitted,setSubmitted]=useState(false);const[submitting,setSubmitting]=useState(false);
  const [visible,setVisible]=useState(true);const[pendingStep,setPendingStep]=useState<number|null>(null);const[direction,setDirection]=useState<"fwd"|"back">("fwd");
  const si=importers.find(i=>i.id===selectedId)??null;
  const tierCotizante = cotizanteTier;
  const tierRequerido = si?.tierMinimoRequerido || "Bronze";
  const tierBloqueado = Boolean(modalidad === "dirigida" && si && (TIER_ORDER[tierCotizante] ?? 0) < (TIER_ORDER[tierRequerido] ?? 0));
  const navigate=useCallback((ns:number,dir:"fwd"|"back")=>{setDirection(dir);setVisible(false);setPendingStep(ns);},[]);
  useEffect(()=>{if(!visible&&pendingStep!==null){const t=setTimeout(()=>{setStep(pendingStep);setPendingStep(null);setVisible(true);setStepError("");},180);return()=>clearTimeout(t);}},[visible,pendingStep]);
  // El backend exige una descripcion de al menos 10 caracteres. Se comprueba
  // aqui, en el paso donde se escribe, y no al enviar: llegar al final del
  // formulario para que la peticion muera en un 422 no ayuda a nadie.
  const DESCRIPCION_MINIMA=10;

  function goNext(){
    if(step===1){
      if(!modalidad){setStepError("Selecciona una modalidad.");return;}
      if(modalidad==="dirigida"&&!selectedId){setStepError("Selecciona una empresa importadora.");return;}
    }
    if(step===2){
      if(!form.productName.trim()){setStepError("El nombre del producto es requerido.");return;}
      const descripcion=form.description.trim();
      if(descripcion.length<DESCRIPCION_MINIMA){
        setStepError(`Describe el producto con al menos ${DESCRIPCION_MINIMA} caracteres (llevas ${descripcion.length}).`);
        return;
      }
      if(!form.country){setStepError("Selecciona el pais de importacion.");return;}
      if(!form.productLine){setStepError("Selecciona la linea de producto.");return;}
      if(!form.incoterm){setStepError("Selecciona el incoterm.");return;}
    }
    setStepError("");
    navigate(step+1,"fwd");
  }
  async function handleSubmit(forceUnlock = desbloquearPorCredito){
    if(modalidad==="dirigida"&&!confirmed){setStepError("Debes confirmar la información.");return;}
    if(!modalidad){setStepError("Selecciona una modalidad.");return;}
    if(tierBloqueado && !forceUnlock){
      setStepError(`Esta empresa requiere nivel ${tierRequerido} o superior. Tu nivel actual es ${tierCotizante}.`);
      return;
    }
    if(tierBloqueado && creditos < 1){
      setStepError("No tienes créditos suficientes para desbloquear esta cotización.");
      return;
    }

    if(form.description.trim().length<DESCRIPCION_MINIMA){
      setStepError(`Describe el producto con al menos ${DESCRIPCION_MINIMA} caracteres.`);
      setStep(2);
      return;
    }

    const parsedMinQuantity=form.unit==="m3"
      ?Number.parseFloat(String(form.minQuantity).replace(",","."))
      :Number.parseInt(form.minQuantity,10);
    if(!Number.isFinite(parsedMinQuantity)||parsedMinQuantity<=0||(form.unit==="unidades"&&parsedMinQuantity<1)){setStepError("La cantidad mínima debe ser mayor a 0.");return;}

    const quality=String(form.quality||"").toLowerCase();
    const tipoCalidad:CreateCotizacionPayload["tipo_calidad"]=quality.includes("econ")
      ?"economica"
      :quality.includes("est")
        ?"estandar"
        :"premium";

    const parsedTarget=form.targetPrice
      ?Number.parseFloat(String(form.targetPrice).replace(/[^0-9.,]/g,"").replace(",","."))
      :undefined;

    const payload:CreateCotizacionPayload={
      modalidad,
      ...(modalidad==="dirigida"&&selectedId?{importador_id:selectedId}:{}),
      ...(form.productPhotoUrls.length?{fotos_producto:form.productPhotoUrls}:{}),
      pais_importacion:form.country,
      nombre_producto:form.productName,
      descripcion_cliente:form.description.trim(),
      link_referencia:form.referenceLink||undefined,
      linea_producto:form.productLine,
      tipo_calidad:tipoCalidad,
      nivel_personalizacion:form.customization||undefined,
      modalidad_importacion:form.purpose,
      cantidad_minima:parsedMinQuantity,
      unidad_cantidad:form.unit,
      precio_objetivo_usd:Number.isFinite(parsedTarget as number)?parsedTarget:undefined,
      precio_objetivo_moneda:form.targetPriceCurrency || "USD",
      incoterm:form.incoterm || "DDP",
      notas_adicionales:form.notes||undefined,
      shipping_mark_sufijo:form.shippingMarkSufijo.trim()||undefined,
      tier_minimo_requerido: modalidad === "dirigida" ? tierRequerido : "Bronze",
      ...(origen?.origen==="tendencias"?{
        origen:"tendencias" as const,
        tendencia_edicion_id:origen.tendenciaEdicionId??null,
        tendencia_producto_id:origen.tendenciaProductoId,
      }:{}),
      // Desde un catálogo solo vale si va dirigida a la empresa dueña; si el
      // comprador cambió de empresa, la solicitud pasa a ser directa.
      ...(origen?.origen==="catalogo"&&modalidad==="dirigida"&&selectedId===preselectedImporterId?{
        origen:"catalogo" as const,
        catalogo_producto_id:origen.catalogoProductoId,
      }:{}),
    };

    try{
      setSubmitting(true);
      setStepError("");
      await onSubmitQuote(payload, tierBloqueado && forceUnlock);
      setSubmitted(true);
    }catch(error){
      setStepError(error instanceof Error?error.message:"No se pudo crear la cotización.");
    }finally{
      setSubmitting(false);
    }
  }
  const slideStyle:React.CSSProperties={opacity:visible?1:0,transform:visible?"translateX(0)":direction==="fwd"?"translateX(12px)":"translateX(-12px)",transition:"opacity 180ms ease,transform 180ms ease"};
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="quotes"/>
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        {submitted ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="flex flex-col items-center text-center gap-4 max-w-sm">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-500"/>
              </div>
              <div>
                <h2 className="text-lg font-semibold">Solicitud enviada</h2>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Tu cotización ha sido registrada exitosamente.</p>
              </div>
              <Button variant="primary" onClick={onBack}>Ver mis cotizaciones</Button>
            </div>
          </div>
        ) : (
          <main className="flex-1 overflow-hidden px-6 pt-6 pb-4 flex flex-col min-h-0">
            {/* Header del Formulario / Stepper (Fijos arriba) */}
            <div className="flex-shrink-0">
              <Breadcrumb items={[{label:"Inicio",onClick:onBack},{label:"Cotizaciones",onClick:onBack},{label:"Nueva cotización"}]}/>
              <h1 className="text-xl font-semibold mt-3">Nueva cotización</h1>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Solicita una nueva cotización para importar productos desde proveedores internacionales.</p>
              <div className="mb-4"><Stepper current={step}/></div>
            </div>

            {/* Área Central Scrolleable (Formulario + Panel Lateral) */}
            <div className="flex gap-6 items-start flex-1 min-h-0 overflow-hidden">
              
              {/* Columna Izquierda: Formulario (Con scroll independiente) */}
              <div className="flex-1 min-w-0 flex flex-col h-full min-h-0">
                <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                  {origen&&(
                    <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                      <p className="font-medium flex items-center gap-2">
                        {origen.origen==="tendencias"?<Sparkles className="w-4 h-4 text-primary"/>:<LibraryBig className="w-4 h-4 text-primary"/>}
                        {origen.origen==="tendencias"?"Desde Tendencias":"Desde el catálogo de la empresa"}: {origen.nombre}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Ya cargamos el producto. Completa la cantidad, la calidad y lo que haga falta.</p>
                      {origen.revisarRequisitos&&(
                        <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400"><AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"/>Este producto puede requerir permisos o registros (INVIMA, ICA, etiquetado). Pídele a la nacionalizadora que lo revise en su propuesta.</p>
                      )}
                    </div>
                  )}
                  <div style={slideStyle}>
                    {step===1 && <Step1 modalidad={modalidad} setModalidad={m=>{setModalidad(m);setDesbloquearPorCredito(false);setStepError("");}} selectedId={selectedId} setSelectedId={(id)=>{setSelectedId(id);setDesbloquearPorCredito(false);setStepError("");}} preselectedId={preselectedImporterId} importers={importers}/>}
                    {step===2 && <Step2 form={form} setForm={setForm} importer={si} onProductPhotoUploaded={(fileItem)=>setForm(prev=>{
                      const url=toApiPath(fileItem.storage_url||`/documentos/archivos/${fileItem.id}/descargar`);
                      if(prev.productPhotoUrls.length>=MAX_FOTOS_PRODUCTO||prev.productPhotoUrls.includes(url))return prev;
                      return {...prev,productPhotoUrls:[...prev.productPhotoUrls,url]};
                    })}/>}
                    {step===3 && modalidad==="dirigida" && si && <Step3Dirigida form={form} importer={si} confirmed={confirmed} setConfirmed={setConfirmed}/>}
                    {step===3 && modalidad==="abierta" && <Step3Abierta/>}
                  </div>
                  {stepError && (
                    <div ref={stepErrorRef} role="alert" className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0"/>
                      <p className="text-sm text-destructive">{stepError}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Columna Derecha: Panel Lateral (Con scroll independiente para importadoras/filtros) */}
              <div className="w-64 xl:w-72 flex-shrink-0 hidden lg:block h-full overflow-y-auto pr-1">
                <RightPanel step={step} modalidad={modalidad} si={si} form={form}/>
              </div>
            </div>

            {tierBloqueado && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-accent/30 dark:bg-accent/10">
                <p className="text-xs font-semibold text-amber-900 dark:text-accent">Esta empresa requiere nivel {tierRequerido} o superior. Tu nivel actual es {tierCotizante}.</p>
                <p className="mt-1 text-xs text-amber-800 dark:text-accent/80">Saldo disponible: {creditos} créditos. 1 crédito desbloquea 1 cotización.</p>
              </div>
            )}

            {/* Barra Inferior de Navegación (SIEMPRE FIJA EN EL BOTTOM) */}
            <div className="pt-3 mt-3 border-t border-border flex-shrink-0 bg-background z-10">
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="ghost" size="sm" onClick={onBack}>Cancelar</Button>
                  {step > 1 && (
                    <Button variant="secondary" size="sm" icon={<ChevronLeft className="w-3.5 h-3.5"/>} onClick={()=>navigate(step-1,"back")}>Anterior</Button>
                  )}
                </div>
                <div className="w-full sm:w-auto">
                  {step < 3 ? (
                    <Button variant="primary" size="md" iconRight={<ChevronRight className="w-4 h-4"/>} onClick={goNext} className="w-full sm:w-auto justify-center">Continuar</Button>
                  ) : (
                    <Button variant="primary" size="md" icon={<Send className="w-4 h-4"/>} loading={submitting} disabled={tierBloqueado} onClick={()=>{void handleSubmit(false);}} className="w-full sm:w-auto justify-center dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/90">
                      {tierBloqueado ? "Solicitar cotización" : "Solicitar cotización"}
                    </Button>
                  )}
                </div>
              </div>
              {step === 3 && tierBloqueado && creditos >= 1 && (
                <Button variant="primary" size="md" icon={<WalletCards className="w-4 h-4"/>} loading={submitting} onClick={()=>{setDesbloquearPorCredito(true);void handleSubmit(true);}} className="mt-2 w-full justify-center dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/90">
                  Desbloquear y enviar cotización por 1 crédito
                </Button>
              )}
            </div>

          </main>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL HELPER
// ─────────────────────────────────────────────────────────────────────────────
function Modal({open,onClose,title,children,width="max-w-lg"}:{open:boolean;onClose:()=>void;title:string;children:React.ReactNode;width?:string}) {
  if(!open)return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.35)"}}>
      <div className={clsx("bg-white rounded-2xl border border-border shadow-2xl w-full flex flex-col max-h-[90vh]",width)}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="w-4 h-4"/></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function NotificationsScreen({notifications,onMark,onOpen,onBack,sb}:{notifications:AppNotification[];onMark:(id:string)=>void;onOpen:(notification:AppNotification)=>Promise<void>;onBack:()=>void;sb:SidebarCtrl}) {
  const NOTIF_ICON:Record<AppNotification["type"],React.ReactNode>={
    response:<ClipboardList className="w-4 h-4 text-blue-600"/>,
    message: <MessageSquare className="w-4 h-4 text-purple-600"/>,
    status:  <TrendingUp className="w-4 h-4 text-amber-600"/>,
    order:   <ShoppingCart className="w-4 h-4 text-emerald-600"/>,
    document:<FileText className="w-4 h-4 text-slate-600"/>,
    advisor: <Users className="w-4 h-4 text-cyan-600"/>,
    update:  <Bell className="w-4 h-4 text-rose-600"/>,
  };
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="notifications"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="sm" icon={<ChevronLeft className="w-3.5 h-3.5"/>} onClick={onBack}>Volver</Button>
            <div>
              <h1 className="text-xl font-semibold">Notificaciones</h1>
              <p className="text-sm text-muted-foreground">{notifications.filter(n=>!n.read).length} sin leer</p>
            </div>
          </div>
          <Card padding="none" className="divide-y divide-border">
            {notifications.length===0&&(
              <div className="px-5 py-10 text-center">
                <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2"/>
                <p className="text-sm font-medium">No tienes notificaciones pendientes</p>
                <p className="text-xs text-muted-foreground mt-1">Cuando haya cambios en cotizaciones, propuestas, chats u órdenes aparecerán aquí.</p>
              </div>
            )}
            {notifications.map(n=>(
              <button key={n.id} type="button" onClick={()=>{onMark(n.id);void onOpen(n);}} className={clsx("w-full text-left flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-primary/5 dark:hover:bg-accent/10 transition-colors",!n.read&&"bg-primary/5 dark:bg-accent/10")}>
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">{NOTIF_ICON[n.type]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={clsx("text-sm",!n.read?"font-semibold text-primary dark:text-accent":"font-medium text-foreground/80")}>{n.title}</p>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{n.date}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                </div>
                {!n.read&&<span className="w-2 h-2 rounded-full bg-primary dark:bg-accent flex-shrink-0 mt-1.5"/>}
              </button>
            ))}
          </Card>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTER PORTAL — DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function ImporterDashboardScreen({sb,quotes,advisors,chats,companyName}:{sb:SidebarCtrl;quotes:Quote[];advisors:CompanyAdvisor[];chats:ChatConv[];companyName:string}) {
  const activeChatsCount = chats.filter(c=>c.status==="activa").length;
  const activeAdvisors = advisors.filter(a=>a.status==="activo").length;
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="imp-dashboard"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER_IMPORTADORA} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div>
            <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav("imp-dashboard")},{label:"Dashboard"}]}/>
            <h1 className="text-xl font-semibold mt-3">Panel de la empresa</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{companyName ? `${companyName} - Resumen de actividad` : "Resumen de actividad"}</p>
          </div>
          <PanelEmpresa
            asesoresConectados={activeAdvisors}
            chatsActivos={activeChatsCount}
            onAbrirSolicitudes={()=>sb.onNav("imp-quotes")}
            onAbrirPedidos={()=>sb.onNav("orders")}
          />
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card padding="none">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <h2 className="font-semibold text-sm">Solicitudes recientes</h2>
                  <Button variant="ghost" size="sm" iconRight={<ChevronRight className="w-3.5 h-3.5"/>} onClick={()=>sb.onNav("imp-quotes")}>Ver todas</Button>
                </div>
                <div className="divide-y divide-border">
                  {quotes.slice(0,5).map(q=>(
                    <div key={q.id} className="flex items-center gap-4 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{q.product}</p>
                        <p className="text-xs text-muted-foreground">{q.code} · {q.date}</p>
                      </div>
                      <Badge variant={q.status as BadgeVariant}/>
                    </div>
                  ))}
                  {quotes.length===0&&<div className="px-5 py-8 text-sm text-muted-foreground text-center">Sin solicitudes todavía.</div>}
                </div>
              </Card>
            </div>
            <div className="space-y-4">
              <Card padding="md">
                <p className="text-sm font-semibold mb-3">Accesos rápidos</p>
                <div className="space-y-2">
                  <Button variant="secondary" size="sm" fullWidth icon={<Users className="w-3.5 h-3.5"/>} onClick={()=>sb.onNav("imp-advisors")}>Gestionar asesores</Button>
                  <Button variant="secondary" size="sm" fullWidth icon={<FileText className="w-3.5 h-3.5"/>} onClick={()=>sb.onNav("imp-quotes")}>Ver solicitudes</Button>
                  <Button variant="secondary" size="sm" fullWidth icon={<Building2 className="w-3.5 h-3.5"/>} onClick={()=>sb.onNav("imp-profile")}>Editar perfil</Button>
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTER PORTAL — COMPANY PROFILE
// ─────────────────────────────────────────────────────────────────────────────

/** Formatos que gestión documental acepta como imagen (ver IMAGE_EXTENSIONS del backend). */
const BANNER_EXTENSIONS=["png","jpg","jpeg","webp"];
const BANNER_FORMATS_LABEL="PNG, JPG o WebP";
const BANNER_UPLOAD_ACCEPT=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";
const BANNER_MAX_BYTES=5*1024*1024;

/** Estado del autoguardado del perfil de empresa, en la cabecera. */
function IndicadorAutoguardado({estado}:{estado:"sin-cambios"|"pendiente"|"guardando"|"guardado"}) {
  if(estado==="sin-cambios"){
    return <span className="text-xs text-muted-foreground">Se guarda automáticamente</span>;
  }
  if(estado==="pendiente"){
    return <span className="text-xs text-amber-700 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/>Cambios sin guardar</span>;
  }
  if(estado==="guardando"){
    return <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin"/>Guardando…</span>;
  }
  return <span className="text-xs text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5"/>Guardado</span>;
}

/**
 * Retardo del autoguardado. Suficiente para no disparar una petición por
 * pulsación y corto para que el usuario vea "Guardado" mientras sigue en el
 * mismo campo: el perfil se perdía porque nadie volvía a pulsar el botón.
 */
const RETARDO_AUTOGUARDADO_MS = 1200;

type FormularioEmpresa = {
  razonSocial:string;description:string;year:string;website:string;email:string;logoUrl:string;
  phone:string;address:string;
  categories:string[];countries:string[];industries:string[];
  avgResponse:string;capacityVolume:string;soloCotizacionesDirectas:boolean;
  shippingMarkPrefijo:string;certs:string[];banner:string;
  tierMinimoRequerido:"Bronze"|"Silver"|"Gold"|"Élite";
  /** Vacío = sin límite. Texto para poder dejar el campo en blanco al editar. */
  limiteCotizacionesDiarias:string;
  /** Pedido mínimo que acepta la empresa; vacío = sin mínimo. */
  pedidoMinimo:string;
  pedidoMinimoUnidad:UnidadCantidad;
};

/** Pedido mínimo para el PUT: null si está vacío, undefined si no es un número válido. */
function leerPedidoMinimo(texto:string):number|null|undefined{
  const limpio=texto.trim().replace(",",".");
  if(!limpio)return null;
  const valor=Number.parseFloat(limpio);
  return Number.isFinite(valor)&&valor>0?valor:undefined;
}

/**
 * Convierte lo escrito en el campo de límite diario al valor del PUT: null
 * (sin límite) si está vacío, el entero si es válido y undefined si no lo es,
 * para no pisar el límite guardado con un valor a medio escribir.
 */
function leerLimiteDiario(texto:string):number|null|undefined{
  const limpio=texto.trim();
  if(!limpio)return null;
  if(!/^\d+$/.test(limpio))return undefined;
  const valor=Number.parseInt(limpio,10);
  return valor>=1&&valor<=10000?valor:undefined;
}

// Formulario vacío de verdad. Antes venía sembrado con una dirección de Bogotá,
// un teléfono y las certificaciones "ISO 9001"/"CE" de ejemplo: cualquier
// empresa que guardara su perfil publicaba esos datos inventados como propios.
const FORMULARIO_EMPRESA_VACIO:FormularioEmpresa={
  razonSocial:"",description:"",year:"",website:"",email:"",logoUrl:"",
  phone:"",address:"",
  categories:[],countries:[],industries:[],
  avgResponse:"~24h",capacityVolume:"",soloCotizacionesDirectas:false,
  shippingMarkPrefijo:"",certs:[],banner:"",
  tierMinimoRequerido:"Bronze",
  limiteCotizacionesDiarias:"",
  pedidoMinimo:"",
  pedidoMinimoUnidad:"unidades",
};

function ImporterCompanyProfileScreen({sb,company,onSave}:{sb:SidebarCtrl;company:BackendImporter|null;onSave:(payload:{nombre_empresa:string;logo_url?:string;especialidad_producto:string[];paises_origen:string[];tiempo_respuesta_promedio:string;capacidad_volumen?:number;perfil_publico?:Record<string, unknown>;solo_cotizaciones_directas?:boolean;shipping_mark_prefijo?:string;limite_cotizaciones_diarias?:number|null;pedido_minimo?:number|null;pedido_minimo_unidad?:UnidadCantidad;})=>Promise<void>}) {
  const [form,setForm]=useState<FormularioEmpresa>(FORMULARIO_EMPRESA_VACIO);
  const [estadoGuardado,setEstadoGuardado]=useState<"sin-cambios"|"pendiente"|"guardando"|"guardado">("sin-cambios");
  const [saveError,setSaveError]=useState("");
  const [bannerUploading,setBannerUploading]=useState(false);
  const [bannerError,setBannerError]=useState("");
  const [logoUploading,setLogoUploading]=useState(false);
  const [logoUploadError,setLogoUploadError]=useState("");
  const bannerInputRef=useRef<HTMLInputElement>(null);
  const logoInputRef=useRef<HTMLInputElement>(null);

  /**
   * Vistas previas del archivo que acaba de elegir el usuario, como `blob:`.
   *
   * Hacen falta porque el backend solo sirve una imagen sin sesión cuando ya
   * figura como imagen pública de la empresa, y eso no ocurre hasta que el
   * perfil se guarda. Entre la subida y el autoguardado, el `<img>` apuntando al
   * servidor recibía un 401 y el navegador NO reintenta una imagen fallida: se
   * quedaba rota hasta recargar la página, justo lo que hacía pensar que la
   * subida no había funcionado.
   */
  const [previaLocal,setPreviaLocal]=useState<{logo:string;banner:string}>({logo:"",banner:""});
  const previaLocalRef=useRef(previaLocal);
  useEffect(()=>{previaLocalRef.current=previaLocal;},[previaLocal]);
  // Un `blob:` retiene el archivo en memoria hasta que se revoca.
  useEffect(()=>()=>{
    Object.values(previaLocalRef.current).forEach((url)=>{if(url)URL.revokeObjectURL(url);});
  },[]);

  function fijarPreviaLocal(clave:"logo"|"banner",archivo:File|null){
    setPreviaLocal((prev)=>{
      if(prev[clave])URL.revokeObjectURL(prev[clave]);
      return {...prev,[clave]:archivo?URL.createObjectURL(archivo):""};
    });
  }

  // `revision` sube en cada edición del usuario (nunca al hidratar desde el
  // servidor) y es lo que dispara el autoguardado con retardo.
  const [revision,setRevision]=useState(0);
  const formRef=useRef(form);
  const [cupo,setCupo]=useState<BackendCupoDiario|null>(null);
  const empresaHidratadaRef=useRef<string|null>(null);
  const guardadoEnCursoRef=useRef(false);
  const cambiosSinGuardarRef=useRef(false);

  useEffect(()=>{formRef.current=form;},[form]);

  // Uso del cupo diario. Es informativo: si falla, el campo sigue funcionando.
  const cargarCupo=useCallback(async()=>{
    try{setCupo(await businessService.getDailyQuoteQuota());}catch{setCupo(null);}
  },[]);
  useEffect(()=>{if(company?.id)void cargarCupo();},[company?.id,cargarCupo]);

  useEffect(()=>{
    if(!company)return;
    // Se hidrata una sola vez por empresa. Volver a copiar la respuesta del
    // servidor en cada recarga pisaba lo que el usuario estuviera escribiendo,
    // y con autoguardado esa recarga ocurre cada pocos segundos.
    if(empresaHidratadaRef.current===company.id)return;
    empresaHidratadaRef.current=company.id;

    const perfilPublico = company.perfil_publico && typeof company.perfil_publico === "object" ? company.perfil_publico : {};
    const getString = (key: string) => {
      const value = perfilPublico[key];
      return typeof value === "string" ? value : "";
    };
    const getStringArray = (key: string) => {
      const value = perfilPublico[key];
      if (!Array.isArray(value)) {
        return [] as string[];
      }
      return value.filter((entry): entry is string => typeof entry === "string");
    };

    setForm({
      razonSocial:company.nombre_empresa,
      logoUrl:company.logo_url || "",
      description:getString("description"),
      year:getString("year"),
      website:getString("website"),
      email:getString("email"),
      phone:getString("phone"),
      address:getString("address"),
      categories:company.especialidad_producto ?? [],
      countries:company.paises_origen ?? [],
      industries:getStringArray("industries"),
      avgResponse:company.tiempo_respuesta_promedio || "~24h",
      capacityVolume:typeof company.capacidad_volumen === "number" ? String(company.capacidad_volumen) : "",
      certs:getStringArray("certs"),
      banner:getString("banner"),
      soloCotizacionesDirectas:Boolean(company.solo_cotizaciones_directas),
      shippingMarkPrefijo:company.shipping_mark_prefijo || "",
      tierMinimoRequerido: (["Bronze", "Silver", "Gold", "Élite"].includes(getString("tier_minimo_requerido")) ? getString("tier_minimo_requerido") : "Bronze") as FormularioEmpresa["tierMinimoRequerido"],
      limiteCotizacionesDiarias:typeof company.limite_cotizaciones_diarias==="number"?String(company.limite_cotizaciones_diarias):"",
      pedidoMinimo:typeof company.pedido_minimo==="number"?String(company.pedido_minimo):"",
      pedidoMinimoUnidad:company.pedido_minimo_unidad==="m3"?"m3":"unidades",
    });
    cambiosSinGuardarRef.current=false;
    setRevision(0);
    setEstadoGuardado("sin-cambios");
  },[company]);

  /** Aplica un cambio del usuario y programa el autoguardado. */
  const editar=useCallback((cambios:Partial<FormularioEmpresa>)=>{
    setForm(p=>({...p,...cambios}));
    cambiosSinGuardarRef.current=true;
    setEstadoGuardado("pendiente");
    setRevision(r=>r+1);
  },[]);

  function f(k:keyof FormularioEmpresa,v:string){editar({[k]:v} as Partial<FormularioEmpresa>);}

  /** Alterna un valor dentro de una lista de etiquetas (categorías, países...). */
  function alternar(clave:"categories"|"countries"|"certs",valor:string){
    const actual=form[clave];
    editar({[clave]:actual.includes(valor)?actual.filter(x=>x!==valor):[...actual,valor]} as Partial<FormularioEmpresa>);
  }

  const persistir=useCallback(async()=>{
    if(guardadoEnCursoRef.current){
      // Hay un envío en vuelo: se reintenta en el siguiente ciclo del retardo,
      // en vez de solapar dos PUT sobre la misma empresa.
      setRevision(r=>r+1);
      return;
    }

    const actual=formRef.current;
    guardadoEnCursoRef.current=true;
    cambiosSinGuardarRef.current=false;
    setEstadoGuardado("guardando");
    setSaveError("");
    try{
      await onSave({
        nombre_empresa:actual.razonSocial,
        // Se manda siempre, también vacío: con `|| undefined` no había manera de
        // quitar un logo ya puesto, porque el backend no veía el campo.
        logo_url:actual.logoUrl.trim(),
        especialidad_producto:actual.categories,
        paises_origen:actual.countries,
        shipping_mark_prefijo:actual.shippingMarkPrefijo.trim(),
        tiempo_respuesta_promedio:actual.avgResponse,
        capacidad_volumen:actual.capacityVolume.trim() ? Number.parseInt(actual.capacityVolume, 10) : undefined,
        perfil_publico: {
          description: actual.description.trim(),
          year: actual.year.trim(),
          website: actual.website.trim(),
          email: actual.email.trim(),
          phone: actual.phone.trim(),
          address: actual.address.trim(),
          industries: actual.industries,
          certs: actual.certs,
          banner: actual.banner.trim(),
          tier_minimo_requerido: actual.tierMinimoRequerido,
        },
        solo_cotizaciones_directas:actual.soloCotizacionesDirectas,
        limite_cotizaciones_diarias:leerLimiteDiario(actual.limiteCotizacionesDiarias),
        pedido_minimo:leerPedidoMinimo(actual.pedidoMinimo),
        pedido_minimo_unidad:actual.pedidoMinimoUnidad,
      });
      setEstadoGuardado(prev=>prev==="guardando"?"guardado":prev);
      void cargarCupo();
    }catch(err){
      // Lo escrito sigue en pantalla y vuelve a marcarse como pendiente: el
      // siguiente intento (automático o manual) lo reenvía entero.
      cambiosSinGuardarRef.current=true;
      setEstadoGuardado("pendiente");
      setSaveError(err instanceof Error ? err.message : "No se pudo guardar el perfil de empresa.");
    }finally{
      guardadoEnCursoRef.current=false;
    }
  },[onSave,cargarCupo]);

  // El envío se invoca siempre por referencia. `onSave` se redefine en cada
  // render de la aplicación, así que depender de `persistir` en el efecto
  // reiniciaba el temporizador con cada repintado ajeno (sondeos, chat...) y el
  // autoguardado podía no llegar a dispararse nunca.
  const persistirRef=useRef(persistir);
  useEffect(()=>{persistirRef.current=persistir;},[persistir]);

  // Autoguardado: cada edición reinicia el reloj, así que solo se envía cuando
  // el usuario deja de escribir.
  useEffect(()=>{
    if(revision===0)return;
    const temporizador=window.setTimeout(()=>{void persistirRef.current();},RETARDO_AUTOGUARDADO_MS);
    return ()=>window.clearTimeout(temporizador);
  },[revision]);

  // Si se sale de la pantalla dentro de la ventana del retardo, lo último
  // escrito se envía igualmente en lugar de perderse.
  useEffect(()=>()=>{
    if(cambiosSinGuardarRef.current){
      void persistirRef.current();
    }
  },[]);

  /**
   * Sube una imagen del perfil (logo o banner) a gestión documental y devuelve
   * su ruta canónica.
   *
   * La imagen tiene que vivir en la plataforma (no una URL pegada a mano) para
   * que el backend la reconozca como imagen pública de la empresa y la sirva
   * sin sesión al solicitante que abre la ficha.
   */
  async function subirImagenDePerfil(archivo:File):Promise<string>{
    const extension=(archivo.name.split(".").pop()||"").toLowerCase();
    if(!BANNER_EXTENSIONS.includes(extension)){
      throw new Error(`Formato no soportado (.${extension}). Usa ${BANNER_FORMATS_LABEL}.`);
    }
    if(archivo.size>BANNER_MAX_BYTES){
      throw new Error("La imagen supera 5 MB. Comprímela antes de subirla.");
    }
    const subido=await businessService.uploadDocumentFile(archivo,null,"perfil-empresa");
    return toApiPath(subido.storage_url||`/documentos/archivos/${subido.id}/descargar`);
  }

  async function handleUploadBanner(archivo:File){
    setBannerError("");
    setBannerUploading(true);
    try{
      const ruta=await subirImagenDePerfil(archivo);
      fijarPreviaLocal("banner",archivo);
      editar({banner:ruta});
    }catch(err){
      setBannerError(err instanceof Error&&err.message.trim()?err.message:"No se pudo subir la imagen del banner.");
    }finally{
      setBannerUploading(false);
    }
  }

  async function handleUploadLogo(archivo:File){
    setLogoUploadError("");
    setLogoUploading(true);
    try{
      const ruta=await subirImagenDePerfil(archivo);
      fijarPreviaLocal("logo",archivo);
      editar({logoUrl:ruta});
    }catch(err){
      setLogoUploadError(err instanceof Error&&err.message.trim()?err.message:"No se pudo subir el logo.");
    }finally{
      setLogoUploading(false);
    }
  }

  const guardando=estadoGuardado==="guardando";
  const logoPreview=previaLocal.logo||(form.logoUrl?resolveApiUrl(form.logoUrl):"");
  const bannerPreview=previaLocal.banner||(form.banner?resolveApiUrl(form.banner):"");

  if(!company){
    return (
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar {...sb} active="imp-profile"/>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AppHeader user={USER_IMPORTADORA} sb={sb}/>
          <main className="flex-1 overflow-y-auto px-6 py-6">
            <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav("imp-dashboard")},{label:"Mi empresa"}]}/>
            <Card padding="lg" className="border-dashed mt-4 max-w-xl"><div className="text-center py-8"><p className="font-semibold">No hay datos de empresa disponibles</p><p className="text-sm text-muted-foreground mt-1">Verifica que tu usuario tenga importador asociado en /usuarios/me.</p></div></Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="imp-profile"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER_IMPORTADORA} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav("imp-dashboard")},{label:"Mi empresa"}]}/>
              <h1 className="text-xl font-semibold mt-3">Perfil de la empresa</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Esta información es visible para los solicitantes.</p>
            </div>
            <div className="flex items-center gap-3">
              {/* El formulario se guarda solo; el indicador es lo que le dice al
                  usuario que no tiene que pulsar nada para no perder lo escrito. */}
              <IndicadorAutoguardado estado={estadoGuardado}/>
              <Button variant="primary" loading={guardando} icon={<Save className="w-4 h-4"/>} onClick={()=>{void persistir();}}>Guardar ahora</Button>
            </div>
          </div>
          {saveError&&<Card padding="sm" className="border-destructive/30 bg-red-50"><p className="text-xs text-destructive">{saveError}</p></Card>}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <Card padding="md">
                <p className="font-semibold text-sm mb-4 flex items-center gap-2"><Building2 className="w-4 h-4 text-primary"/>Información general</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input label="Razón social" value={form.razonSocial} onChange={e=>f("razonSocial",e.target.value)}/>
                  <Input label="Año de fundación" type="number" value={form.year} onChange={e=>f("year",e.target.value)}/>
                  <Input label="Sitio web" value={form.website} onChange={e=>f("website",e.target.value)} prefix={<Globe className="w-4 h-4"/>}/>
                  <div>
                    <Input label="URL de logo/foto" value={form.logoUrl} onChange={e=>{fijarPreviaLocal("logo",null);f("logoUrl",e.target.value);}} prefix={<ImageIcon className="w-4 h-4"/>} hint="Súbelo desde aquí o pega la URL de tu logo."/>
                    <div className="mt-2 flex gap-2">
                      <Button variant="secondary" size="sm" loading={logoUploading} icon={<Upload className="w-3.5 h-3.5"/>} onClick={()=>logoInputRef.current?.click()}>{form.logoUrl?"Reemplazar logo":"Subir logo"}</Button>
                      {form.logoUrl&&<Button variant="ghost" size="sm" icon={<X className="w-3.5 h-3.5"/>} onClick={()=>{fijarPreviaLocal("logo",null);editar({logoUrl:""});}}>Quitar</Button>}
                    </div>
                    {logoUploadError&&<p className="text-xs text-destructive mt-2">{logoUploadError}</p>}
                  </div>
                  <Input label="Correo de contacto" value={form.email} onChange={e=>f("email",e.target.value)} prefix={<MailIcon className="w-4 h-4"/>}/>
                  <Input label="Teléfono" value={form.phone} onChange={e=>f("phone",e.target.value)} prefix={<Phone className="w-4 h-4"/>}/>
                  <Input label="Dirección" value={form.address} onChange={e=>f("address",e.target.value)} prefix={<MapPin className="w-4 h-4"/>}/>
                  <Input label="Capacidad de volumen" type="number" value={form.capacityVolume} onChange={e=>f("capacityVolume",e.target.value)} hint="Lo máximo que manejas por pedido. Opcional"/>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="pedido-minimo" className="text-sm font-medium text-foreground">Pedido mínimo</label>
                    <div className="flex gap-2">
                      <input id="pedido-minimo" inputMode="decimal" placeholder="Sin mínimo" value={form.pedidoMinimo} onChange={e=>f("pedidoMinimo",e.target.value)} className="w-full h-10 bg-white border rounded-lg text-sm px-3 border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"/>
                      <select aria-label="Unidad del pedido mínimo" value={form.pedidoMinimoUnidad} onChange={e=>editar({pedidoMinimoUnidad:e.target.value==="m3"?"m3":"unidades"})} className="h-10 rounded-lg border border-border bg-white px-2 text-sm">
                        <option value="unidades">Unidades</option>
                        <option value="m3">m³</option>
                      </select>
                    </div>
                    <p className="text-xs text-muted-foreground">Zarpi lo usa para asignarte solicitudes que encajen contigo</p>
                  </div>
                </div>
                <div className="mt-4">
                  <Textarea label="Descripción" rows={3} value={form.description} onChange={e=>f("description",e.target.value)}/>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <input id="solo-cotizaciones-directas" type="checkbox" checked={form.soloCotizacionesDirectas} onChange={e=>editar({soloCotizacionesDirectas:e.target.checked})} className="h-4 w-4 rounded border-border"/>
                  <label htmlFor="solo-cotizaciones-directas" className="text-sm text-foreground">Solo cotizaciones dirigidas</label>
                </div>
              </Card>
              <Card padding="md">
                <p className="font-semibold text-sm mb-4 flex items-center gap-2"><Tag className="w-4 h-4 text-primary"/>Información comercial</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Select label="Tiempo promedio de respuesta" value={form.avgResponse} onChange={e=>f("avgResponse",e.target.value)}>
                    {["~12h","~24h","~36h","~48h","~72h"].map(v=><option key={v}>{v}</option>)}
                  </Select>
                  <Select label="Tier mínimo requerido para cotizar" value={form.tierMinimoRequerido} onChange={e=>f("tierMinimoRequerido",e.target.value)}>
                    {["Bronze", "Silver", "Gold", "Élite"].map((tier)=><option key={tier}>{tier}</option>)}
                  </Select>
                  <div>
                    <p className="text-sm font-medium mb-1.5">Categorías</p>
                    <div className="flex flex-wrap gap-1.5">{ALL_CATEGORIES.map(c=><button key={c} onClick={()=>alternar("categories",c)} className={clsx("px-2 py-1 text-xs rounded-md border transition-colors",form.categories.includes(c)?"bg-primary text-white border-primary":"border-border hover:border-primary/40")}>{c}</button>)}</div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1.5">Países atendidos</p>
                    <div className="flex flex-wrap gap-1.5">{COUNTRIES.slice(0,8).map(c=><button key={c} onClick={()=>alternar("countries",c)} className={clsx("px-2 py-1 text-xs rounded-md border transition-colors",form.countries.includes(c)?"bg-primary text-white border-primary":"border-border hover:border-primary/40")}>{c}</button>)}</div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1.5">Certificaciones</p>
                    <div className="flex flex-wrap gap-1.5">{["ISO 9001","CE","FDA","HACCP","OEKO-TEX","ISO 14001","DIN","JIS"].map(c=><button key={c} onClick={()=>alternar("certs",c)} className={clsx("px-2 py-1 text-xs rounded-md border transition-colors flex items-center gap-1",form.certs.includes(c)?"bg-emerald-600 text-white border-emerald-600":"border-border hover:border-emerald-300")}><Shield className="w-2.5 h-2.5"/>{c}</button>)}</div>
                  </div>
                </div>
              </Card>
              <Card padding="md">
                {/* Cupo diario: tarjeta propia con interruptor. Como campo suelto
                    dentro de "Información comercial" pasaba desapercibido. */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-sm flex items-center gap-2"><Gauge className="w-4 h-4 text-primary"/>Límite de cotizaciones por día</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cuántas cotizaciones (dirigidas y abiertas) quiere recibir tu equipo cada día. Al llegar al tope,
                      los clientes no pueden enviarte más dirigidas y las abiertas se reparten a otras empresas hasta la medianoche.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.limiteCotizacionesDiarias.trim()!==""}
                    aria-label="Limitar cotizaciones por día"
                    onClick={()=>editar({limiteCotizacionesDiarias:form.limiteCotizacionesDiarias.trim()?"":String(cupo?.limite_cotizaciones_diarias||20)})}
                    className={clsx("relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors",form.limiteCotizacionesDiarias.trim()?"bg-primary":"bg-muted-foreground/30")}
                  >
                    <span className={clsx("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",form.limiteCotizacionesDiarias.trim()?"translate-x-5":"translate-x-0.5")}/>
                  </button>
                </div>
                {form.limiteCotizacionesDiarias.trim()!==""?(
                  <div className="mt-4 grid sm:grid-cols-2 gap-4 items-start">
                    <Input
                      label="Máximo por día"
                      type="number"
                      min={1}
                      max={10000}
                      value={form.limiteCotizacionesDiarias}
                      onChange={e=>f("limiteCotizacionesDiarias",e.target.value)}
                      error={leerLimiteDiario(form.limiteCotizacionesDiarias)===undefined?"Escribe un número entero entre 1 y 10000.":undefined}
                    />
                    {cupo&&cupo.limite_cotizaciones_diarias!=null?(
                      <div>
                        <p className="text-sm font-medium mb-1.5">Uso de hoy</p>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={clsx("h-full transition-all",cupo.cupo_agotado?"bg-destructive":"bg-primary")}
                            style={{width:`${Math.min(100,Math.round((cupo.recibidas_hoy/Math.max(1,cupo.limite_cotizaciones_diarias))*100))}%`}}
                          />
                        </div>
                        <p className={clsx("text-xs mt-1.5",cupo.cupo_agotado?"text-destructive font-medium":"text-muted-foreground")}>
                          {cupo.recibidas_hoy} de {cupo.limite_cotizaciones_diarias} recibidas hoy.
                          {cupo.cupo_agotado?" Cupo agotado: no recibirás más hasta mañana.":` Te quedan ${cupo.disponibles_hoy}.`}
                        </p>
                      </div>
                    ):(
                      <p className="text-xs text-muted-foreground sm:mt-7">El uso de hoy aparece en cuanto se guarde el límite.</p>
                    )}
                  </div>
                ):(
                  <p className="mt-3 text-xs text-muted-foreground">
                    Sin límite{cupo?`: hoy llevas ${cupo.recibidas_hoy} cotización(es) recibida(s).`:"."}
                  </p>
                )}
              </Card>
              <Card padding="md">
                <p className="font-semibold text-sm mb-1 flex items-center gap-2"><Package className="w-4 h-4 text-primary"/>Shipping mark</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Prefijo con el que se rotula la carga de tu empresa. Cada cliente añade su propio sufijo
                  al pedir la cotización, y así se distinguen sus cajas dentro del contenedor.
                </p>
                <div className="grid sm:grid-cols-2 gap-4 items-start">
                  <Input
                    label="Prefijo de la empresa"
                    placeholder="ctl"
                    maxLength={LONGITUD_MAX_PREFIJO_SHIPPING_MARK}
                    value={form.shippingMarkPrefijo}
                    onChange={e=>f("shippingMarkPrefijo",e.target.value)}
                    hint="Solo letras y números; se guarda en minúsculas."
                  />
                  <div className="pt-1">
                    <p className="text-sm font-medium mb-1.5">Así quedará</p>
                    <p className="font-mono text-sm px-3 py-2 rounded-lg border border-border bg-muted/40 truncate">
                      {componerShippingMark(form.shippingMarkPrefijo,"prendas control")||"—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Ejemplo con un cliente llamado «Prendas Control».</p>
                  </div>
                </div>
              </Card>
              <Card padding="md">
                <p className="font-semibold text-sm mb-1 flex items-center gap-2"><Film className="w-4 h-4 text-primary"/>Presentación de la empresa</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Un video corto de tu taller y algunas fotos de producto. Es lo primero que mira un cliente
                  al abrir tu ficha; nuestro equipo lo revisa antes de publicarlo.
                </p>
                <EditorPresentacion/>
              </Card>
              <Card padding="md">
                <p className="font-semibold text-sm mb-1 flex items-center gap-2"><ImageIcon className="w-4 h-4 text-primary"/>Banner de portada</p>
                <p className="text-xs text-muted-foreground mb-4">Imagen ancha que encabeza tu perfil público. Se recomienda 1600×400 px.</p>

                <input
                  ref={bannerInputRef}
                  type="file"
                  accept={BANNER_UPLOAD_ACCEPT}
                  className="hidden"
                  onChange={e=>{
                    const archivo=e.target.files?.[0];
                    e.target.value="";
                    if(archivo)void handleUploadBanner(archivo);
                  }}
                />

                {form.banner?(
                  <div className="space-y-3">
                    <div className="rounded-xl overflow-hidden border border-border bg-muted/40">
                      <img src={bannerPreview} alt="Banner de la empresa" className="w-full h-32 object-cover"/>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" loading={bannerUploading} icon={<Upload className="w-3.5 h-3.5"/>} onClick={()=>bannerInputRef.current?.click()}>Reemplazar</Button>
                      <Button variant="ghost" size="sm" icon={<X className="w-3.5 h-3.5"/>} onClick={()=>{fijarPreviaLocal("banner",null);editar({banner:""});}}>Quitar</Button>
                    </div>
                  </div>
                ):(
                  <div className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center gap-2 text-center">
                    <Upload className="w-8 h-8 text-muted-foreground/40"/>
                    <p className="text-sm text-muted-foreground">Sube la imagen de portada de tu empresa</p>
                    <p className="text-xs text-muted-foreground/60">PNG, JPG o WebP hasta 5 MB</p>
                    <Button variant="secondary" size="sm" loading={bannerUploading} onClick={()=>bannerInputRef.current?.click()}>Seleccionar imagen</Button>
                  </div>
                )}

                {bannerError&&<p className="text-xs text-destructive mt-3">{bannerError}</p>}
              </Card>
            </div>
            <div>
              <Card padding="md">
                <p className="font-semibold text-sm mb-4">Vista previa del logo</p>
                {/* Input oculto compartido por los dos botones de "subir logo". */}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept={BANNER_UPLOAD_ACCEPT}
                  className="hidden"
                  onChange={e=>{
                    const archivo=e.target.files?.[0];
                    e.target.value="";
                    if(archivo)void handleUploadLogo(archivo);
                  }}
                />
                <div className="flex flex-col items-center gap-3">
                  {/* Antes esta vista previa pintaba siempre las iniciales, así
                      que tras subir el logo no cambiaba nada en pantalla y la
                      subida parecía no haber funcionado. */}
                  {logoPreview?(
                    <img src={logoPreview} alt="Logo de la empresa" className="w-32 h-32 rounded-2xl border border-border bg-white object-contain p-2"/>
                  ):(
                    <div className={clsx("w-32 h-32 rounded-2xl flex items-center justify-center text-white text-3xl font-bold",importerColorFromId(company.id))}>{initialsFromName(company.nombre_empresa)}</div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" loading={logoUploading} icon={<Upload className="w-3.5 h-3.5"/>} onClick={()=>logoInputRef.current?.click()}>{form.logoUrl?"Cambiar logo":"Subir logo"}</Button>
                    {form.logoUrl&&<Button variant="ghost" size="sm" onClick={()=>{void abrirArchivoEnPestana(form.logoUrl);}}>Ver</Button>}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">PNG, JPG o WebP hasta 5 MB. Se recomienda un cuadrado de 512×512 px.</p>
                </div>
                <div className="mt-5 pt-5 border-t border-border space-y-2">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Certificaciones</span><span className="font-semibold flex items-center gap-1 text-emerald-700"><Shield className="w-3 h-3"/>{form.certs.length}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Proyectos completados</span><span className="font-semibold">{company.proyectos_completados ?? 0}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Miembro desde</span><span className="font-semibold">{formatShortDate(company.fecha_registro)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Verificada</span><span className="font-semibold flex items-center gap-1 text-emerald-600"><BadgeCheck className="w-3 h-3"/>{company.verificado?"Sí":"No"}</span></div>
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTER PORTAL — ADVISORS
// ─────────────────────────────────────────────────────────────────────────────
function ImporterAdvisorsScreen({sb,initialAdvisors,onCreateAdvisor,onSetAdvisorActive,onOpenInternalChat}:{sb:SidebarCtrl;initialAdvisors:CompanyAdvisor[];onCreateAdvisor:(payload:CreateAsesorPayload)=>Promise<CompanyAdvisor>;onSetAdvisorActive:(advisorId:string,activo:boolean)=>Promise<string>;onOpenInternalChat:(advisorId:string)=>Promise<void>}) {
  const [advisors,setAdvisors]=useState(initialAdvisors);
  const [search,setSearch]=useState("");
  const [showModal,setShowModal]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const [editAdv,setEditAdv]=useState<CompanyAdvisor|null>(null);
  const [form,setForm]=useState({name:"",role:"",email:"",phone:"",password:"",status:"activo" as CompanyAdvisor["status"],availability:"alta" as CompanyAdvisor["availability"]});
  const [formError,setFormError]=useState("");
  const [statusMessage,setStatusMessage]=useState("");

  const filtered=advisors.filter(a=>!search||[a.name,a.role,a.email].some(v=>v.toLowerCase().includes(search.toLowerCase())));

  useEffect(()=>{
    setAdvisors(initialAdvisors);
  },[initialAdvisors]);

  function openCreate(){setEditAdv(null);setFormError("");setShowPassword(false);setForm({name:"",role:"",email:"",phone:"",password:"",status:"activo",availability:"alta"});setShowModal(true);}
  function openEdit(a:CompanyAdvisor){setEditAdv(a);setFormError("");setForm({name:a.name,role:a.role,email:a.email,phone:a.phone,password:"",status:a.status,availability:a.availability});setShowModal(true);}
  async function save(){
    if(editAdv){
      setAdvisors(prev=>prev.map(a=>a.id===editAdv.id?{...a,...form}:a));
      setShowModal(false);
      return;
    }

    const password = form.password.trim();
    if(password.length<9 || !/[A-Za-z]/.test(password) || !/\d/.test(password)){
      setFormError("La contraseña debe tener mínimo 9 caracteres, al menos una letra y al menos un dígito.");
      return;
    }

    const created=await onCreateAdvisor({
      email:form.email,
      password,
      nombre:form.name,
      telefono:form.phone,
    });
    setAdvisors(prev=>[created,...prev]);
    setShowModal(false);
  }
  async function abrirCanal(asesor:CompanyAdvisor){
    try{
      await onOpenInternalChat(asesor.id);
    }catch(err){
      setStatusMessage(err instanceof Error ? err.message : "No se pudo abrir el canal con el asesor.");
    }
  }

  async function reiniciarClave(asesor:CompanyAdvisor){
    try{
      await authService.forgotPassword({email:asesor.email});
      setStatusMessage(`Se envió a ${asesor.email} un enlace para que ${asesor.name} defina una contraseña nueva.`);
    }catch(err){
      setStatusMessage(err instanceof Error ? err.message : "No se pudo enviar el correo de restablecimiento.");
    }
  }

  async function toggle(id:string){
    const target = advisors.find((advisor) => advisor.id === id);
    if (!target) {
      return;
    }
    const nextActivo = target.status !== "activo";
    setStatusMessage(await onSetAdvisorActive(id, nextActivo));
    setAdvisors((prev) => prev.map((advisor) => (
      advisor.id === id
        ? {
            ...advisor,
            status: nextActivo ? "activo" : "inactivo",
          }
        : advisor
    )));
  }
  async function deactivate(id:string){
    // Se advierte del traspaso: el backend mueve sus cotizaciones y chats a la
    // cuenta dueña para que ninguna negociación quede sin responsable.
    if(!confirm("¿Desactivar asesor? Sus cotizaciones y conversaciones abiertas pasarán a tu cuenta."))return;
    setStatusMessage(await onSetAdvisorActive(id, false));
    setAdvisors((prev) => prev.map((advisor) => (
      advisor.id === id
        ? {
            ...advisor,
            status: "inactivo",
          }
        : advisor
    )));
  }

  const STATUS_CLS:Record<CompanyAdvisor["status"],string>={activo:"bg-emerald-50 text-emerald-700",inactivo:"bg-slate-100 text-slate-600",ausente:"bg-amber-50 text-amber-700"};
  const AVAIL_CLS:Record<CompanyAdvisor["availability"],string>={alta:"text-emerald-600",media:"text-amber-600",baja:"text-rose-600"};

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="imp-advisors"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER_IMPORTADORA} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav("imp-dashboard")},{label:"Asesores"}]}/>
              <h1 className="text-xl font-semibold mt-3">Gestión de asesores</h1>
              <p className="text-sm text-muted-foreground">{advisors.filter(a=>a.status==="activo").length} activos · {advisors.length} en total</p>
            </div>
            <Button variant="primary" icon={<Plus className="w-4 h-4"/>} onClick={openCreate}>Nuevo asesor</Button>
          </div>
          {statusMessage&&(
            <Card padding="sm" className="border-emerald-200 bg-emerald-50">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-emerald-800">{statusMessage}</p>
                <button type="button" onClick={()=>setStatusMessage("")} className="text-emerald-700 hover:text-emerald-900" aria-label="Cerrar aviso"><X className="w-3.5 h-3.5"/></button>
              </div>
            </Card>
          )}
          <div className="max-w-sm">
            <Input placeholder="Buscar por nombre, cargo o correo…" value={search} onChange={e=>setSearch(e.target.value)} prefix={<Search className="w-4 h-4"/>}/>
          </div>
          <Card padding="none">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Asesor</th>
                  <th className="text-left px-3 py-3 font-medium hidden md:table-cell">Estado</th>
                  <th className="text-left px-3 py-3 font-medium hidden lg:table-cell">Disponibilidad</th>
                  <th className="text-left px-3 py-3 font-medium hidden lg:table-cell">Cotizaciones</th>
                  <th className="text-left px-3 py-3 font-medium hidden xl:table-cell">Resp. prom.</th>
                  <th className="text-right px-5 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(a=>(
                  <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar initials={a.initials} size="sm" color={a.color}/>
                        <div>
                          <p className="font-medium text-foreground">{a.name}</p>
                          <p className="text-xs text-muted-foreground">{a.role} · {a.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell"><span className={clsx("px-2 py-0.5 rounded-md text-xs font-medium capitalize",STATUS_CLS[a.status])}>{a.status}</span></td>
                    <td className={clsx("px-3 py-3 text-xs font-medium capitalize hidden lg:table-cell",AVAIL_CLS[a.availability])}>{a.availability}</td>
                    <td className="px-3 py-3 text-xs hidden lg:table-cell">{a.activeQuotes} activas</td>
                    <td className="px-3 py-3 text-xs hidden xl:table-cell">{a.avgResponse}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<MessageSquare className="w-3.5 h-3.5"/>} title="Abrir canal interno para coordinar sus órdenes" onClick={()=>{void abrirCanal(a);}}/>
                        <Button variant="ghost" size="sm" icon={<Edit2 className="w-3.5 h-3.5"/>} onClick={()=>openEdit(a)}/>
                        <Button variant="ghost" size="sm" icon={<RotateCcw className="w-3.5 h-3.5"/>} title="Enviar enlace para restablecer la contraseña" onClick={()=>{void reiniciarClave(a);}}/>
                        <Button variant="ghost" size="sm" icon={a.status==="activo"?<Ban className="w-3.5 h-3.5"/>:<CheckCircle2 className="w-3.5 h-3.5"/>} onClick={()=>{void toggle(a.id);}}/>
                        <Button variant="ghost" size="sm" icon={<X className="w-3.5 h-3.5 text-destructive"/>} onClick={()=>{void deactivate(a.id);}}/>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </main>
      </div>
      <Modal open={showModal} onClose={()=>setShowModal(false)} title={editAdv?"Editar asesor":"Nuevo asesor"}>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Nombre completo" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>
            <Input label="Cargo" value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))}/>
            <Input label="Correo" type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/>
            <Input label="Teléfono" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))}/>
            {!editAdv&&<Input label="Contraseña temporal" type={showPassword?"text":"password"} value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} hint="Mínimo 9 caracteres. Úsala para el primer login del asesor." suffix={<button type="button" onClick={()=>setShowPassword(v=>!v)} className="text-muted-foreground hover:text-foreground transition-colors">{showPassword?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button>}/>}
            <Select label="Estado" value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value as CompanyAdvisor["status"]}))}>
              <option value="activo">Activo</option><option value="inactivo">Inactivo</option><option value="ausente">Ausente</option>
            </Select>
            <Select label="Disponibilidad" value={form.availability} onChange={e=>setForm(p=>({...p,availability:e.target.value as CompanyAdvisor["availability"]}))}>
              <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
            </Select>
          </div>
          {formError&&<p className="text-xs text-destructive">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="secondary" onClick={()=>setShowModal(false)}>Cancelar</Button>
            <Button variant="primary" onClick={save}>{editAdv?"Guardar cambios":"Crear asesor"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTER PORTAL — QUOTES
// ─────────────────────────────────────────────────────────────────────────────
function ImporterQuotesScreen({sb,onRespond,quotes,advisors,chats,onOpenChat,onAssignAdvisor,proposalsByQuoteId,onConfirmProposal}:{sb:SidebarCtrl;onRespond:(id:string)=>void;quotes:Quote[];advisors:CompanyAdvisor[];chats:ChatConv[];onOpenChat:(conversationId:string)=>void;onAssignAdvisor:(quoteId:string,advisorId:string|null)=>Promise<void>;proposalsByQuoteId:Record<string,BackendPropuesta>;onConfirmProposal:(propuestaId:string)=>Promise<void>}) {
  const [filter,setFilter]=useState("todas");
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
      setMensaje(`Confirmaste la propuesta de ${quote.product}. La orden ya está creada y el seguimiento queda en el chat.`);
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
              <div className="px-5 py-3 border-b border-amber-200 bg-amber-50">
                <p className="font-semibold text-sm text-amber-900">Esperan tu confirmación</p>
                <p className="text-xs text-amber-800 mt-0.5">
                  El cliente aceptó lo que negoció tu asesor. Revisa el chat y confirma para crear la orden.
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
                          {q.code} · US${propuesta.precio_ofrecido_usd} · {propuesta.tiempo_estimado_entrega} · {propuesta.incoterm}
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
                        Confirmar y crear orden
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              {tabs.map(t=><button key={t} onClick={()=>setFilter(t)} className={clsx("px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors",filter===t?"bg-primary text-white":"bg-white border border-border text-muted-foreground hover:text-foreground")}>{t}</button>)}
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
                  <tr key={q.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium truncate max-w-[200px]">{q.product}</p>
                      <p className="text-xs text-muted-foreground">{q.code}</p>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell"><span className={clsx("px-2 py-0.5 text-xs rounded-md font-medium",q.mode==="Dirigida"?"bg-blue-50 text-blue-700":"bg-orange-50 text-orange-700")}>{q.mode}</span></td>
                    <td className="px-3 py-3 text-xs text-muted-foreground hidden sm:table-cell">{q.date}</td>
                    <td className="px-3 py-3"><Badge variant={q.status}/></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5"/>} title="Ver detalle" onClick={()=>setDetalle(q)}/>
                        <Button variant="ghost" size="sm" icon={<Users className="w-3.5 h-3.5"/>} title="Asignar asesor" onClick={()=>setAsignando(q)}/>
                        <Button variant="ghost" size="sm" icon={<MessageCircle className="w-3.5 h-3.5"/>} title={chatDe(q.id)?"Abrir chat":"Todavia no hay chat: se abre al iniciar la negociacion"} disabled={!chatDe(q.id)} onClick={()=>{const c=chatDe(q.id); if(c) onOpenChat(c.id);}}/>
                        <Button variant="primary" size="sm" icon={<Send className="w-3.5 h-3.5"/>} onClick={()=>onRespond(q.id)}>Responder</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length===0&&<div className="py-12 text-center text-sm text-muted-foreground">No hay cotizaciones para este filtro.</div>}
          </Card>
          {mensaje&&<div className="p-3 rounded-lg border border-border bg-muted/40 text-sm">{mensaje}</div>}
        </main>
      </div>
      <AdvisorQuoteDetailModal quote={detalle} open={Boolean(detalle)} onClose={()=>setDetalle(null)}/>
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

function AdvisorQuoteDetailModal({quote,open,onClose,onAccept,accepting}:{quote:Quote|null;open:boolean;onClose:()=>void;onAccept?:()=>Promise<void>;accepting?:boolean}) {
  if (!quote) {
    return null;
  }

  const custom = quote.customFields;
  const peso = findCustomFieldValue(custom, ["peso", "weight"]);
  const volumen = findCustomFieldValue(custom, ["volumen", "volume", "cbm", "m3"]);
  const dimensiones = findCustomFieldValue(custom, ["dimension", "medida", "tamano", "size"]);
  const origen = findCustomFieldValue(custom, ["origen", "origin", "puerto_origen"]);
  const destino = findCustomFieldValue(custom, ["destino", "destination", "puerto_destino"]);
  const adjuntos = getQuoteAttachmentLinks(quote);

  return (
    <Modal open={open} onClose={onClose} title={`Detalle completo · ${quote.code}`} width="max-w-3xl">
      <div className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Card padding="sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Producto</p>
                <p className="mt-1 truncate text-sm font-semibold">{quote.product}</p>
              </div>
              <TierBadge tier={quote.solicitanteTier} />
            </div>
          </Card>
          <Card padding="sm">
            <p className="text-xs text-muted-foreground">Modalidad</p>
            <p className="text-sm font-semibold mt-1">{quote.mode}</p>
          </Card>
        </div>

        <Card padding="md">
          <h3 className="text-sm font-semibold mb-3">Ficha técnica</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Peso</p><p className="font-medium">{peso || "No especificado"}</p></div>
            <div><p className="text-xs text-muted-foreground">Volumen</p><p className="font-medium">{volumen || "No especificado"}</p></div>
            <div><p className="text-xs text-muted-foreground">Dimensiones</p><p className="font-medium">{dimensiones || "No especificado"}</p></div>
            <div><p className="text-xs text-muted-foreground">Origen</p><p className="font-medium">{origen || quote.country || "No especificado"}</p></div>
            <div><p className="text-xs text-muted-foreground">Destino</p><p className="font-medium">{destino || "No especificado"}</p></div>
            <div><p className="text-xs text-muted-foreground">Incoterm</p><p className="font-medium">{quote.incoterm || "No especificado"}</p></div>
            <div><p className="text-xs text-muted-foreground">Shipping mark</p><p className="font-medium font-mono">{quote.shippingMark || quote.shippingMarkSufijo || "Sin marca"}</p></div>
          </div>
        </Card>

        <Card padding="md">
          <h3 className="text-sm font-semibold mb-3">Información registrada por el solicitante</h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Descripción</p>
              <p className="mt-1 whitespace-pre-wrap">{quote.description || "Sin descripción"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Notas adicionales</p>
              <p className="mt-1 whitespace-pre-wrap">{quote.notes || "Sin notas"}</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><p className="text-xs text-muted-foreground">Nivel de personalización</p><p className="font-medium mt-1">{quote.personalizationLevel || "No especificado"}</p></div>
              <div><p className="text-xs text-muted-foreground">Modalidad de importación</p><p className="font-medium mt-1">{quote.importMode || "No especificado"}</p></div>
            </div>
          </div>
        </Card>

        <PerfilPublicoCotizanteCard solicitanteId={quote.requesterId} />

        {onAccept && (
          <div className="flex justify-end border-t border-border pt-4">
            <Button
              variant="primary"
              loading={accepting}
              icon={<CheckCircle2 className="w-4 h-4" />}
              onClick={() => { void onAccept(); }}
              className="dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/90"
            >
              Aceptar y abrir chat
            </Button>
          </div>
        )}

        {(quote.productPhotoUrls??[]).length>0&&(
          <Card padding="md">
            <GaleriaFotosProducto fotos={quote.productPhotoUrls??[]}/>
          </Card>
        )}

        <Card padding="md">
          <h3 className="text-sm font-semibold mb-3">Archivos adjuntos</h3>
          {adjuntos.length===0 ? (
            <p className="text-sm text-muted-foreground">No hay archivos o enlaces adjuntos en esta cotización.</p>
          ) : (
            <div className="space-y-2">
              {adjuntos.map((link)=> (
                <a key={link} href={link} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline break-all inline-flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5"/>{link}
                </a>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVISOR PORTAL — DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function AdvisorDashboardScreen({sb,availableCount,quotes,headerUser,responsesSentCount,activeChatsCount,onOpenInternalChat}:{sb:SidebarCtrl;availableCount:number;quotes:Quote[];headerUser:{name:string;company:string;initials:string};responsesSentCount:number;activeChatsCount:number;onOpenInternalChat:()=>Promise<void>}) {
  const [errorCanal,setErrorCanal]=useState("");
  const myQuotesCount = quotes.length;
  const activeOrdersCount = quotes.filter(q=>q.status==="active-order").length;
  const recentQuotes = quotes.slice(0,3);
  const metrics=[
    {label:"Cotizaciones disponibles",value:availableCount.toString(),icon:<Zap className="w-5 h-5"/>,color:"text-amber-600",bg:"bg-amber-50"},
    {label:"Mis cotizaciones",value:myQuotesCount.toString(),icon:<ClipboardList className="w-5 h-5"/>,color:"text-blue-600",bg:"bg-blue-50"},
    {label:"Respuestas enviadas",value:responsesSentCount.toString(),icon:<Send className="w-5 h-5"/>,color:"text-emerald-600",bg:"bg-emerald-50"},
    {label:"Chats activos",value:activeChatsCount.toString(),icon:<MessageSquare className="w-5 h-5"/>,color:"text-purple-600",bg:"bg-purple-50"},
    {label:"Órdenes en seguimiento",value:activeOrdersCount.toString(),icon:<ShoppingCart className="w-5 h-5"/>,color:"text-cyan-600",bg:"bg-cyan-50"},
  ];
  const activity:{text:string;time:string}[]=[];
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="adv-dashboard"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={headerUser} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div>
            <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav("adv-dashboard")},{label:"Mi dashboard"}]}/>
            <div className="flex items-start justify-between gap-4 flex-wrap mt-3">
              <div>
                <h1 className="text-xl font-semibold">Panel del asesor</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{headerUser.company}</p>
              </div>
              {/* Canal privado con la empresa: por aquí llegan las instrucciones
                  de cuándo mover el estado de cada orden. */}
              <Button variant="secondary" size="sm" icon={<MessageSquare className="w-3.5 h-3.5"/>}
                onClick={()=>{void onOpenInternalChat().catch((err)=>setErrorCanal(err instanceof Error?err.message:"No se pudo abrir el canal."));}}>
                Canal con mi empresa
              </Button>
            </div>
            {errorCanal&&<p className="text-xs text-destructive mt-2">{errorCanal}</p>}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {metrics.map((m,i)=>(
              <Card key={i} padding="md" className="metric-card flex items-start gap-3">
                <div className={clsx("metric-icon w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 dark:!bg-accent/24",m.bg,m.color)}>{m.icon}</div>
                <div className="min-w-0">
                  <p className="text-xl font-bold text-foreground leading-none">{m.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{m.label}</p>
                </div>
              </Card>
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <Card padding="none">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-sm">Mis cotizaciones recientes</h2>
                <Button variant="ghost" size="sm" iconRight={<ChevronRight className="w-3.5 h-3.5"/>} onClick={()=>sb.onNav("adv-my-quotes")}>Ver todas</Button>
              </div>
              {recentQuotes.map(q=>(
                <div key={q.id} className="flex items-center gap-3 px-5 py-3 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{q.product}</p>
                    <p className="text-xs text-muted-foreground">{q.code} · {q.date}</p>
                  </div>
                  <Badge variant={q.status as BadgeVariant}/>
                </div>
              ))}
              {recentQuotes.length===0&&<div className="px-5 py-8 text-sm text-muted-foreground text-center">Sin cotizaciones asignadas.</div>}
            </Card>
            <Card padding="none">
              <div className="px-5 py-4 border-b border-border"><h2 className="font-semibold text-sm">Actividad reciente</h2></div>
              <div className="px-5 py-4 space-y-3">
                {activity.map((a,i)=>(
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"/>
                    <div><p className="text-sm">{a.text}</p><p className="text-xs text-muted-foreground">{a.time}</p></div>
                  </div>
                ))}
                {activity.length===0&&<p className="text-xs text-muted-foreground">Sin actividad reciente disponible en API.</p>}
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVISOR PORTAL — AVAILABLE QUOTES (Uber style)
// ─────────────────────────────────────────────────────────────────────────────
function AdvisorAvailableScreen({sb,available,onClaim,onDiscard,headerUser}:{sb:SidebarCtrl;available:Quote[];onClaim:(id:string)=>Promise<void>;onDiscard:(quote:Quote)=>Promise<void>;headerUser:{name:string;company:string;initials:string}}) {
  const [claimingId,setClaimingId]=useState<string|null>(null);
  const [discardingId,setDiscardingId]=useState<string|null>(null);
  const [claimError,setClaimError]=useState("");
  const [selectedQuote,setSelectedQuote]=useState<Quote|null>(null);

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
                    <Button variant="secondary" size="sm" icon={<X className="w-3.5 h-3.5"/>} loading={discardingId===q.id} onClick={()=>{void handleDiscard(q);}}>{q.mode==="Abierta"?"Descartar":"Rechazar"}</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
      <AdvisorQuoteDetailModal quote={selectedQuote} open={Boolean(selectedQuote)} onClose={()=>setSelectedQuote(null)} onAccept={handleAcceptFromDetail} accepting={Boolean(selectedQuote && claimingId===selectedQuote.id)}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVISOR PORTAL — MY QUOTES
// ─────────────────────────────────────────────────────────────────────────────
function AdvisorMyQuotesScreen({sb,quotes,onRespond,headerUser,existingProposalByQuoteId,chats,onOpenChat}:{sb:SidebarCtrl;quotes:Quote[];onRespond:(id:string)=>void;headerUser:{name:string;company:string;initials:string};existingProposalByQuoteId:Record<string, BackendPropuesta>;chats:ChatConv[];onOpenChat:(conversationId:string)=>void}) {
  const myQuotes=quotes.slice(0,20);
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {myQuotes.length===0&&<div className="py-12 text-center text-sm text-muted-foreground">No tienes cotizaciones asignadas.</div>}
          </Card>
        </main>
      </div>
      <AdvisorQuoteDetailModal quote={selectedQuote} open={Boolean(selectedQuote)} onClose={()=>setSelectedQuote(null)}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE RESPONSE SCREEN — 3-step wizard
// ─────────────────────────────────────────────────────────────────────────────
function CreateResponseScreen({quoteId,onBack,sb,userRole,quotes,onSubmitted,existingProposal,headerUser,chatConversationId,onOpenChat,prefill}:{quoteId:string;onBack:()=>void;sb:SidebarCtrl;userRole:UserRole;quotes:Quote[];onSubmitted?:()=>Promise<void>;existingProposal?:BackendPropuesta|null;headerUser:{name:string;company:string;initials:string};chatConversationId?:string;onOpenChat?:(conversationId:string)=>void;prefill?:PropuestaDesdeEstimacion|null}) {
  type ProposalAttachmentRef = {id:string;nombre:string};
  type ProposalDraftDetails = {
    moq: string;
    port: string;
    productionTime: string;
    shippingTime: string;
    description: string;
    advantages: string;
    recommendations: string;
    attachedFiles: ProposalAttachmentRef[];
  };

  function parseDraftDetails(raw:string|null|undefined):ProposalDraftDetails|null{
    if(!raw){
      return null;
    }
    try{
      const parsed=JSON.parse(raw) as unknown;
      if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)){
        return null;
      }
      const draft=parsed as Record<string, unknown>;
      const pickString=(value:unknown)=>typeof value==="string"?value:"";
      const attachedFiles=Array.isArray(draft.attachedFiles)
        ?draft.attachedFiles.map((row)=>{
          if(!row||typeof row!=="object"||Array.isArray(row)){
            return null;
          }
          const item=row as Record<string, unknown>;
          const id=typeof item.id==="string"?item.id.trim():"";
          if(!id){
            return null;
          }
          return {
            id,
            nombre:typeof item.nombre==="string"&&item.nombre.trim()?item.nombre.trim():"Archivo adjunto",
          };
        }).filter((row):row is ProposalAttachmentRef=>Boolean(row))
        :[];

      return {
        moq: pickString(draft.moq),
        port: pickString(draft.port),
        productionTime: pickString(draft.productionTime),
        shippingTime: pickString(draft.shippingTime),
        description: pickString(draft.description),
        advantages: pickString(draft.advantages),
        recommendations: pickString(draft.recommendations),
        attachedFiles,
      };
    }catch{
      return null;
    }
  }

  const quote=quotes.find(q=>q.id===quoteId)??null;

  // Abrir la solicitud es el "vista" de la bitácora; el backend solo cuenta la primera.
  useEffect(()=>{
    if(!quoteId)return;
    void businessService.markQuoteViewed(quoteId).catch(()=>undefined);
  },[quoteId]);
  const [step,setStep]=useState(1);
  const [submitted,setSubmitted]=useState(false);
  const [submittedTitle,setSubmittedTitle]=useState("Respuesta enviada");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [attachedFiles,setAttachedFiles]=useState<ProposalAttachmentRef[]>([]);
  const [form,setForm]=useState({
    unitPrice:"",moq:"",totalPrice:"",
    incoterm:"FOB",port:"",productionTime:"",shippingTime:"",totalTime:"",
    description:"",advantages:"",recommendations:"",
    files:[] as {name:string;type:string}[],
  });
  function f(k:string,v:string){setForm(p=>({...p,[k]:v}));}

  // Solo la cuenta dueña envía; el asesor guarda y deja el borrador listo.
  const esBorradorPendienteDeEnvio = userRole==="importadora" && existingProposal?.estado==="borrador";

  // No es lo mismo responder por primera vez que reescribir algo que el
  // comprador ya tiene delante: la pantalla se llamaba "Responder cotización"
  // en los dos casos, y parecía que se podía responder varias veces.
  const esPropuestaYaVista = existingProposal?.estado==="pendiente";
  const revisionesPrevias = existingProposal?.revisiones ?? 0;
  const tituloPantalla = esPropuestaYaVista ? "Editar mi propuesta" : "Responder cotización";

  // El formulario se hidrata una sola vez por propuesta: el refresco automático
  // trae un objeto nuevo cada pocos segundos y volver a copiarlo pisaba lo que
  // el usuario estuviera escribiendo. La estimación del chat (`prefill`) se
  // aplica una vez y siempre encima de la propuesta guardada, aunque esta
  // llegue después.
  const propuestaHidratadaRef=useRef<string|null>(null);
  const prefillAplicadoRef=useRef<PropuestaDesdeEstimacion|null>(null);
  useEffect(()=>{
    const hidratarPropuesta=Boolean(existingProposal)&&propuestaHidratadaRef.current!==existingProposal?.id;
    const aplicarPrefill=Boolean(prefill)&&prefillAplicadoRef.current!==prefill;
    if(!hidratarPropuesta&&!aplicarPrefill){
      return;
    }

    if(existingProposal&&hidratarPropuesta){
      propuestaHidratadaRef.current=existingProposal.id;
      const draftDetails=parseDraftDetails(existingProposal.condiciones_adicionales);
      const plainTextConditions=draftDetails?"":(existingProposal.condiciones_adicionales || "");

      setForm((prev)=>({
        ...prev,
        totalPrice: String(existingProposal.precio_ofrecido_usd ?? ""),
        unitPrice: String(existingProposal.precio_ofrecido_usd ?? ""),
        incoterm: existingProposal.incoterm || "FOB",
        totalTime: existingProposal.tiempo_estimado_entrega || "",
        moq: draftDetails?.moq || "",
        port: draftDetails?.port || "",
        productionTime: draftDetails?.productionTime || "",
        shippingTime: draftDetails?.shippingTime || "",
        description: draftDetails?.description || plainTextConditions,
        advantages: draftDetails?.advantages || "",
        recommendations: draftDetails?.recommendations || "",
      }));

      setAttachedFiles(draftDetails?.attachedFiles || []);
    }

    if(prefill){
      prefillAplicadoRef.current=prefill;
      setForm((prev)=>({
        ...prev,
        totalPrice: prefill.precioTotalUsd,
        unitPrice: prefill.precioUnitarioUsd,
        moq: prefill.cantidad,
        incoterm: prefill.incoterm || prev.incoterm,
        totalTime: prefill.tiempoEntrega || prev.totalTime,
        description: prefill.descripcion,
      }));
      if(aplicarPrefill){
        setStep(1);
      }
    }
  },[existingProposal,prefill]);

  async function submit(){
    if(!quote){
      setError("No se encontró la cotización seleccionada.");
      return;
    }

    const sourceAmount = form.totalPrice.trim() || form.unitPrice.trim();
    const parsedAmount = Number.parseFloat(sourceAmount.replace(/[^0-9.,]/g, "").replace(",", "."));
    if(!Number.isFinite(parsedAmount) || parsedAmount <= 0){
      setError("Ingresa un valor numérico válido para el costo de la propuesta.");
      return;
    }

    const tiempoEstimado = form.totalTime.trim() || [form.productionTime.trim(), form.shippingTime.trim()].filter(Boolean).join(" + ") || "Por definir";
    const observaciones = JSON.stringify({
      schema:"create-response-v1",
      moq:form.moq.trim(),
      port:form.port.trim(),
      productionTime:form.productionTime.trim(),
      shippingTime:form.shippingTime.trim(),
      description:form.description.trim(),
      advantages:form.advantages.trim(),
      recommendations:form.recommendations.trim(),
      attachedFiles:attachedFiles.map((file)=>({id:file.id,nombre:file.nombre})),
    });

    try{
      setSaving(true);
      setError("");
      const payload:CreatePropuestaPayload = {
        cotizacion_id: quote.id,
        precio_ofrecido_usd: parsedAmount,
        tiempo_estimado_entrega: tiempoEstimado,
        incoterm: form.incoterm,
        condiciones_adicionales: observaciones || undefined,
      };

      // El borrador lo redacta el asesor y lo envía la cuenta dueña. Ese envío
      // (POST /propuestas/{id}/enviar) no lo llamaba ninguna pantalla, así que
      // el borrador se quedaba atrapado y el solicitante nunca veía la
      // propuesta. Aquí se cierra el circuito.
      if(existingProposal?.id){
        await businessService.updateProposal(existingProposal.id, payload);
        if(esBorradorPendienteDeEnvio){
          await businessService.sendProposal(existingProposal.id);
          setSubmittedTitle("Propuesta enviada al solicitante");
        }else{
          setSubmittedTitle(userRole==="asesor"?"Borrador actualizado":"Propuesta actualizada");
        }
      }else if(userRole==="asesor"){
        await businessService.createProposalDraft(payload);
        setSubmittedTitle("Borrador guardado");
      }else{
        await businessService.createProposal(payload);
        setSubmittedTitle("Respuesta enviada");
      }

      if(chatConversationId && attachedFiles.length>0){
        await businessService.shareDocumentsToChat({
          conversacion_ids:[chatConversationId],
          archivo_ids:attachedFiles.map((file)=>file.id),
          mensaje:"Adjuntos de propuesta comercial",
        });
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
  const steps=[{label:"Económica"},{label:"Logística"},{label:"Observaciones"}];
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
          <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center"><CheckCircle2 className="w-7 h-7 text-emerald-500"/></div>
          <div><h2 className="text-lg font-semibold">{submittedTitle}</h2><p className="text-sm text-muted-foreground mt-1">Tu propuesta fue registrada correctamente para {quote.product}.</p></div>
          <div className="flex gap-2 flex-wrap justify-center">
            <Button variant="primary" onClick={onBack}>Volver a cotizaciones</Button>
            {chatConversationId && onOpenChat && <Button variant="secondary" icon={<MessageSquare className="w-3.5 h-3.5"/>} onClick={()=>onOpenChat(chatConversationId)}>Ir al Chat</Button>}
          </div>
        </div></div>
      </div>
    </div>
  );
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active={activeNav}/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={headerUser}/>
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:items-start">
          <section className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <Button variant="ghost" size="sm" icon={<ChevronLeft className="w-3.5 h-3.5"/>} onClick={onBack}>Volver</Button>
          </div>
          <Breadcrumb items={[{label:"Cotizaciones",onClick:onBack},{label:tituloPantalla}]}/>
          <h1 className="text-xl font-semibold mt-3">{tituloPantalla}</h1>
          <p className="text-sm text-muted-foreground mt-0.5 mb-6">{quote.product} · {quote.code}</p>
          {esPropuestaYaVista&&(
            <div className="mb-6 p-3 rounded-lg border border-sky-200 bg-sky-50 text-sm text-sky-900 flex items-start gap-2">
              <FileText className="w-4 h-4 mt-0.5 flex-shrink-0"/>
              <span>
                No estás respondiendo de nuevo: estás <strong>modificando la propuesta que ya enviaste</strong>.
                El comprador la tiene delante y verá que la cambiaste, con la fecha.
                {revisionesPrevias>0&&<> Ya la has cambiado {revisionesPrevias===1?"una vez":`${revisionesPrevias} veces`}.</>}
                {" "}Guardar también anula la aceptación que hubiera de cualquiera de las dos partes.
              </span>
            </div>
          )}
          {esBorradorPendienteDeEnvio&&(
            <div className="mb-6 p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-900 flex items-start gap-2">
              <FileText className="w-4 h-4 mt-0.5 flex-shrink-0"/>
              <span>Un asesor de tu empresa ya redactó esta propuesta. Revisa las cifras y pulsa <strong>Enviar propuesta</strong>: hasta entonces el solicitante no la ve.</span>
            </div>
          )}
          {prefill&&(
            <div className="mb-6 p-3 rounded-lg border border-primary/30 bg-primary/5 text-sm text-foreground flex items-start gap-2">
              <Calculator className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary"/>
              <span>
                Datos tomados de la estimación que enviaste por el chat; el desglose quedó en la descripción de la oferta. Revísalos antes de guardar.
                {prefill.monedaOrigen!=="USD"&&<> <strong>La estimación estaba en {prefill.monedaOrigen} y la propuesta se expresa en USD: escribe el precio convertido.</strong></>}
              </span>
            </div>
          )}
          {userRole==="asesor"&&(
            <div className="mb-6 p-3 rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground flex items-start gap-2">
              <FileText className="w-4 h-4 mt-0.5 flex-shrink-0"/>
              <span>Tu respuesta se guarda como borrador. La cuenta de la empresa es quien la revisa y la envía al solicitante.</span>
            </div>
          )}
          {/* Stepper */}
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={clsx(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap",
                    step === i + 1
                      ? "bg-primary text-primary-foreground dark:bg-accent dark:text-accent-foreground shadow-sm"
                      : step > i + 1
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60"
                      : "bg-muted/60 text-muted-foreground border border-transparent"
                  )}
                >
                  {step > i + 1 ? (
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <span className="w-4 h-4 rounded-full flex items-center justify-center bg-foreground/10 text-[10px] font-semibold">
                      {i + 1}
                    </span>
                  )}
                  {s.label}
                </div>
                {i < steps.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-6">
            <div className="flex-1 min-w-0 max-w-2xl space-y-6">
              {step === 1 && (
                <Card padding="lg" className="border-border bg-card">
                  <p className="font-semibold mb-5 flex items-center gap-2 text-foreground">
                    <Receipt className="w-4 h-4 text-primary dark:text-accent" />
                    Información económica
                  </p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Input label="Precio unitario" placeholder="9.20 USD/kg" value={form.unitPrice} onChange={e => f("unitPrice", e.target.value)} />
                    <Input label="MOQ (cantidad mínima)" placeholder="300 kg" value={form.moq} onChange={e => f("moq", e.target.value)} />
                    <Input label="Precio total estimado" placeholder="2,760 USD" value={form.totalPrice} onChange={e => f("totalPrice", e.target.value)} className="sm:col-span-2" />
                  </div>
                </Card>
              )}

              {step === 2 && (
                <Card padding="lg" className="border-border bg-card">
                  <p className="font-semibold mb-5 flex items-center gap-2 text-foreground">
                    <Truck className="w-4 h-4 text-primary dark:text-accent" />
                    Información logística
                  </p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Select label="Incoterm" value={form.incoterm} onChange={e => f("incoterm", e.target.value)}>
                      {INCOTERMS.map(v => <option key={v}>{v}</option>)}
                    </Select>
                    <Input label="Puerto de origen" placeholder="Puerto de Buenaventura" value={form.port} onChange={e => f("port", e.target.value)} />
                    <Input label="Tiempo de producción" placeholder="15 días" value={form.productionTime} onChange={e => f("productionTime", e.target.value)} />
                    <Input label="Tiempo de envío" placeholder="12 días" value={form.shippingTime} onChange={e => f("shippingTime", e.target.value)} />
                    <Input label="Tiempo total estimado" placeholder="27 días" value={form.totalTime} onChange={e => f("totalTime", e.target.value)} className="sm:col-span-2" />
                  </div>
                </Card>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <Card padding="lg" className="border-border bg-card">
                    <p className="font-semibold mb-4 flex items-center gap-2 text-foreground">
                      <FileText className="w-4 h-4 text-primary dark:text-accent" />
                      Observaciones
                    </p>
                    <div className="space-y-4">
                      <Textarea label="Descripción de la oferta" placeholder="Descripción detallada de tu propuesta…" rows={3} value={form.description} onChange={e => f("description", e.target.value)} />
                      <Textarea label="Ventajas competitivas" placeholder="¿Por qué elegir tu empresa?" rows={2} value={form.advantages} onChange={e => f("advantages", e.target.value)} />
                      <Textarea label="Recomendaciones" placeholder="Condiciones especiales, notas…" rows={2} value={form.recommendations} onChange={e => f("recommendations", e.target.value)} />
                    </div>
                  </Card>

                  <Card padding="lg" className="border-border bg-card">
                    <p className="font-semibold mb-4 flex items-center gap-2 text-foreground">
                      <Paperclip className="w-4 h-4 text-primary dark:text-accent" />
                      Archivos adjuntos
                    </p>
                    <div className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 text-center bg-muted/20 hover:bg-muted/40 transition-colors">
                      <Upload className="w-7 h-7 text-muted-foreground/60" />
                      <p className="text-sm text-muted-foreground">PDF, imágenes, fichas técnicas, cotización oficial</p>
                      <DocumentUploadButton
                        label="Seleccionar archivos"
                        multiple
                        origen="propuesta"
                        onUploaded={(fileItem) => setAttachedFiles((prev) => {
                          if (prev.some((row) => row.id === fileItem.id)) return prev;
                          return [...prev, { id: fileItem.id, nombre: fileItem.nombre }];
                        })}
                        onError={(message) => setError(message)}
                      />
                      {attachedFiles.length > 0 && (
                        <div className="w-full mt-3 space-y-1.5 text-left">
                          {attachedFiles.map((file) => (
                            <div key={file.id} className="rounded-md border border-border bg-muted/40 px-3 py-2 flex items-center justify-between gap-2 transition-colors hover:bg-muted/60">
                              <p className="text-xs font-medium text-foreground truncate">{file.nombre}</p>
                              <button 
                                className="text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors" 
                                onClick={() => setAttachedFiles((prev) => prev.filter((row) => row.id !== file.id))}
                              >
                                Quitar
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              )}

             {/* Acciones del Stepper */}
              <div className="flex items-center justify-between mt-6 pt-5 border-t border-border">
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={onBack}>
                    Cancelar
                  </Button>
                  {step > 1 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<ChevronLeft className="w-3.5 h-3.5" />}
                      onClick={() => setStep(s => s - 1)}
                      className="hover:!border-primary hover:text-primary hover:bg-primary/10 dark:hover:!border-accent dark:hover:text-accent dark:hover:bg-accent/15 transition-colors"
                    >
                      Anterior
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  {step < 3 ? (
                    <Button
                      variant="primary"
                      size="md"
                      iconRight={<ChevronRight className="w-4 h-4" />}
                      onClick={() => setStep(s => s + 1)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/90 transition-colors"
                    >
                      Continuar
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="md"
                      icon={userRole === "asesor" ? <Save className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                      loading={saving}
                      onClick={submit}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/90 transition-colors"
                    >
                      {userRole === "asesor"
                        ? "Guardar borrador"
                        : esPropuestaYaVista
                          ? "Guardar cambios"
                          : "Enviar propuesta"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Banner de error adaptable */}
              {error && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive dark:bg-destructive/20 dark:border-destructive/30">
                  {error}
                </div>
              )}
            </div>
          </div>
          </section>
          <aside className="min-w-0 lg:sticky lg:top-0 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
            <div className="space-y-4">
              <Card padding="md" className="border-border bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary dark:text-accent">Cotizante</p>
                    <h2 className="mt-1 truncate text-base font-semibold">Perfil de referencia</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Información disponible mientras preparas la propuesta.</p>
                  </div>
                  <TierBadge tier={quote.solicitanteTier} />
                </div>
                <div className="mt-4 space-y-2 border-t border-border pt-4 text-xs">
                  <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground">Producto</span><span className="text-right font-medium">{quote.product || "—"}</span></div>
                  <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground">Código</span><span className="font-mono font-medium">{quote.code || "—"}</span></div>
                  <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground">País de origen</span><span className="text-right font-medium">{quote.country || "—"}</span></div>
                  <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground">Tier actual</span><TierBadge tier={quote.solicitanteTier} /></div>
                </div>
              </Card>
              <PerfilPublicoCotizanteCard solicitanteId={quote.requesterId} />
            </div>
          </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE
// ─────────────────────────────────────────────────────────────────────────────
const LANDING_TABS:{key:LandingSection;label:string}[]=[
  {key:"home",label:"Inicio"},
  {key:"about",label:"Quiénes somos"},
  {key:"how-it-works",label:"Cómo funciona"},
  {key:"news",label:"Novedades y aliados"},
  {key:"contact",label:"Contacto"},
];

function LandingScreen({onLogin,onRegister,onPolicy,importers}:{onLogin:()=>void;onRegister:()=>void;onPolicy:(page:LegalPage)=>void;importers:Importer[]}) {
  const { dark, toggleTheme } = useBrandTheme();
  const [faqOpen,setFaqOpen]=useState<number|null>(null);
  const [activeTab,setActiveTab]=useState<LandingSection>("home");
  const [profileModalImporter,setProfileModalImporter]=useState<Importer|null>(null);
  const [dynamicContent,setDynamicContent]=useState<LandingDynamicContent|null>(null);
  const [dynamicContentError,setDynamicContentError]=useState("");

  useEffect(()=>{
    if(activeTab!=="news"||dynamicContent)return;
    landingService.getDynamicContent()
      .then(setDynamicContent)
      .catch(()=>setDynamicContentError("No se pudo cargar el contenido de novedades y aliados."));
  },[activeTab,dynamicContent]);

  const featuredImporters=importers.filter(i=>i.verified||(i.platformCerts??[]).length>0).slice(0,6);
  const uniqueCountries=[...new Set(importers.map((item)=>item.country).filter(Boolean))];
  const uniqueCategories=[...new Set(importers.flatMap((item)=>item.categories).filter(Boolean))];
  const stats=[
    {value:importers.length.toString(),label:"Empresas importadoras"},
    {value:uniqueCountries.length.toString(),label:"Países de origen"},
    {value:importers.filter((item)=>item.verified).length.toString(),label:"Empresas verificadas"},
    {value:uniqueCategories.length.toString(),label:"Líneas de producto"},
  ];
  const benefits=[
    {icon:<MoveRight className="w-6 h-6 text-primary"/>,title:"Abrimos caminos",desc:"Conectamos tus necesidades con productos y empresas que hacen posible llegar más lejos."},
    {icon:<BadgeCheck className="w-6 h-6 text-primary"/>,title:"Confianza que se comprueba",desc:"Las empresas pasan por un proceso de verificación antes de aparecer en Zarpi."},
    {icon:<Scale className="w-6 h-6 text-primary"/>,title:"Todo más claro",desc:"Cotizaciones, condiciones y negociaciones quedan ordenadas en un solo lugar."},
    {icon:<ShoppingCart className="w-6 h-6 text-primary"/>,title:"Más posibilidades, menos barreras",desc:"Explora opciones globales, compara propuestas y sigue cada etapa de tu orden."},
  ];
  const brandPrinciples=[
    {label:"Misión",title:"Acercar lo que mueve tus ideas",desc:"Hacemos más simple encontrar productos, empresas y oportunidades confiables en cualquier parte del mundo."},
    {label:"Visión",title:"Un mundo más conectado",desc:"Imaginamos un comercio exterior claro, accesible y abierto a más personas y negocios."},
    {label:"Valores",title:"Claridad, confianza y movimiento",desc:"Verificamos lo importante, mostramos las opciones y avanzamos contigo en cada decisión."},
  ];
  const brandVisuals=[
    {src:"/brand/container-1.jpg",alt:"Contenedores Zarpi en tránsito",label:"Movemos lo que imaginas."},
    {src:"/brand/shipping-1.jpg",alt:"Logística y shipping Zarpi",label:"Del mundo a tus manos."},
    {src:"/brand/container-2.jpg",alt:"Operación de containers Zarpi",label:"Más cerca, en cada etapa."},
    {src:"/brand/shipping-2.jpg",alt:"Envío de productos Zarpi",label:"Descubre. Compara. Elige."},
    {src:"/brand/container-3.jpg",alt:"Operación de containers Zarpi",label:"Productos del mundo, más cerca."},
    {src:"/brand/shipping-3.png",alt:"Envío de productos Zarpi",label:"Tu negocio. Tu elección."},
  ];
  const steps=[
    {n:"01",title:"Crea tu solicitud",desc:"Describe el producto que necesitas importar, especifica cantidades, país de origen y demás detalles relevantes."},
    {n:"02",title:"Recibe propuestas",desc:"Las empresas importadoras verificadas envían sus mejores ofertas. Compara precios, tiempos y condiciones."},
    {n:"03",title:"Negocia directamente",desc:"Usa el chat integrado para negociar detalles directamente con el asesor asignado de cada empresa."},
    {n:"04",title:"Confirma y rastrea",desc:"Una vez acordada la operación, se crea automáticamente la orden y puedes seguir cada etapa del proceso."},
  ];
  const faqs=[
    {q:"¿Cuánto cuesta usar la plataforma?",a:"El registro y el uso básico de la plataforma son gratuitos para los solicitantes. Las empresas importadoras tienen planes según su volumen de operaciones."},
    {q:"¿Cómo sé que las empresas importadoras son confiables?",a:"Todas las empresas pasan por un proceso de verificación documental realizado por nuestro equipo administrativo antes de ser listadas."},
    {q:"¿Puedo enviar cotizaciones a múltiples empresas a la vez?",a:"Sí. Puedes crear cotizaciones abiertas que llegan a todas las empresas relevantes, o cotizaciones dirigidas a una empresa específica."},
    {q:"¿Qué pasa si no recibo respuesta?",a:"El sistema notifica a las empresas automáticamente. Si no recibes respuesta en 48h, te recomendamos ampliar tu solicitud a más proveedores."},
    {q:"¿Cómo funciona el seguimiento de la orden?",a:"Una vez creada la orden, el representante de la empresa importadora actualiza el estado en cada etapa: producción, tránsito, aduana y entrega."},
  ];
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-9xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Logo/>
          <div className="hidden md:flex items-center gap-1">
            {LANDING_TABS.map(section=>(
              <button
                key={section.key}
                onClick={()=>setActiveTab(section.key)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  activeTab === section.key 
                    ? "bg-primary text-white dark:bg-accent dark:text-accent-foreground" 
                    : "text-muted-foreground hover:bg-foreground/15 dark:hover:bg-white/15 dark:hover:text-white"
                )}
              >
                {section.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              aria-label={dark ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground dark:hover:bg-accent dark:hover:text-accent-foreground active:bg-primary/90 dark:active:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {dark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
            </button>
            <Button 
              variant="secondary" 
              size="sm" 
              className="hover:bg-primary hover:text-white hover:border-primary dark:hover:bg-accent dark:hover:text-accent-foreground dark:hover:border-accent" 
              onClick={onLogin}
            >
              Iniciar sesión
            </Button>

            <Button 
              variant="primary" 
              size="sm" 
              className="hover:bg-primary/80 dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/80" 
              onClick={onRegister}
            >
              Registrarse
            </Button>
          </div>
        </div>
      </nav>

      {activeTab==="home" && (
      <>
      {/* HERO */}
      <section className="pt-32 pb-20 px-6 bg-foreground text-background relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/25 pointer-events-none z-0"/>
        <div className="zarpi-blob zarpi-blob-violet absolute -top-24 -left-24 z-0 pointer-events-none"/>
        <div className="zarpi-blob zarpi-blob-acid absolute top-20 -right-20 z-0 pointer-events-none"/>
        <div className="zarpi-blob zarpi-blob-neutral absolute -bottom-36 left-1/3 z-0 pointer-events-none"/>
        
        <div className="landing-hero-content relative z-10 max-w-5xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent text-accent-foreground rounded-full text-xs font-semibold mb-6"><BadgeCheck className="w-3.5 h-3.5"/>Del mundo a tus manos</span>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight mb-5">
            Un mundo de productos,<br/>
            <span className="text-accent">más cerca.</span>
          </h1>
          <p className="text-lg text-background/75 max-w-2xl mx-auto leading-relaxed mb-8">
            Descubre productos, compara cotizaciones y elige con claridad. Zarpi acerca lo que necesitas.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="secondary" size="lg" icon={<LogIn className="w-4 h-4"/>} onClick={onLogin} className="px-8 bg-accent text-accent-foreground hover:bg-accent/85">Iniciar sesión</Button>
            <Button variant="secondary" size="lg" icon={<UserRound className="w-4 h-4"/>} onClick={onRegister} className="px-8 bg-accent text-accent-foreground border-accent hover:bg-accent/85">Crear cuenta gratis</Button>
          </div>
          <p className="mt-8 text-xs uppercase tracking-[0.18em] font-bold text-accent">
            Descubre. Compara. Elige. Zarpi it.
          </p>
        </div>
      </section>

      {/* BRAND VISUALS (Infinite Carousel) */}
      <section className="relative px-6 py-10 bg-background overflow-hidden">
        {/* Degradados laterales para suavizar la entrada/salida */}
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

        <div className="relative z-0 max-w-10xl mx-auto overflow-hidden">
          <div className="flex w-max gap-4 animate-marquee hover:[animation-play-state:paused]">
            {[...brandVisuals, ...brandVisuals].map((visual, index) => (
              <figure 
                key={`${visual.src}-${index}`} 
                className="group relative w-64 md:w-80 shrink-0 overflow-hidden rounded-2xl border border-border bg-card aspect-[4/3]"
              >
                <img 
                  src={visual.src} 
                  alt={visual.alt} 
                  loading="eager" 
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-102" 
                />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 pb-3 pt-8 text-xs font-semibold text-white">
                  {visual.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-12 bg-card border-y border-border relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-4 gap-8 relative z-10">
          {stats.map((s,i)=>(
            <div key={i} className="text-center">
              <p className="text-3xl font-bold text-primary dark:text-accent">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* BENEFITS */}
      <section className="py-20 px-6 bg-muted relative overflow-hidden">
        <div className="zarpi-blob zarpi-blob-acid absolute -right-16 top-10 pointer-events-none opacity-30 scale-90" />
        <div className="zarpi-blob zarpi-blob-violet absolute -left-20 bottom-10 pointer-events-none opacity-25 scale-75" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold tracking-tight">Más cerca de lo que buscas</h2>
            <p className="text-muted-foreground mt-2">Una forma más clara de encontrar, comparar y elegir.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {benefits.map((b, i) => (
              <div key={i} className="landing-reveal bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-6 hover:shadow-md transition-shadow" style={{animationDelay:`${i*90}ms`}}>
                <div className="landing-icon w-12 h-12 rounded-xl flex items-center justify-center mb-4 border bg-primary/10 border-primary/20 text-primary dark:bg-[#EDF953]/15 dark:border-[#EDF953]/30 dark:text-[#EDF953]">
                  {b.icon}
                </div>
                <h3 className="font-semibold text-sm mb-2">{b.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MISION, VISION Y VALORES */}
      <section className="py-20 px-6 bg-background relative overflow-hidden">
        <div className="zarpi-blob zarpi-blob-violet absolute right-0 top-1/4 pointer-events-none opacity-50 scale-110" />
        <div className="zarpi-blob zarpi-blob-acid absolute -left-16 bottom-0 pointer-events-none opacity-40 scale-90" />

        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="max-w-2xl mb-10">
            <p className="text-xs uppercase tracking-[0.18em] text-primary dark:text-accent font-semibold mb-3">La forma Zarpi</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Un comercio más cerca, más claro y más humano.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {brandPrinciples.map((principle, i) => (
              <article key={principle.label} className="landing-reveal relative overflow-hidden bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-6 landing-glow" style={{animationDelay:`${i*100}ms`}}>
                <div className="relative">
                  <p className="text-xs uppercase tracking-[0.16em] text-primary dark:text-accent font-semibold mb-5">{principle.label}</p>
                  <h3 className="text-lg font-bold mb-3">{principle.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{principle.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-6 bg-background relative overflow-hidden">
        
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold tracking-tight">¿Cómo funciona?</h2>
            <p className="text-muted-foreground mt-2">En cuatro pasos, desde la solicitud hasta la entrega</p>
          </div>
          
          <div className="relative">
            <div className="hidden lg:block absolute top-7 left-[0%] right-[0%] h-0.5 bg-border z-0" />

            <div className="flex justify-center items-center gap-6 sm:gap-10">
              {steps.map((s, i) => (
                <div key={i} className="flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-accent border border-accent flex items-center justify-center mb-4 shadow-sm relative z-10">
                    <span className="text-lg font-bold text-accent-foreground">{s.n}</span>
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{s.title}</h3>
                  <p className="text-xs text-muted-foreground max-w-[200px]">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED IMPORTERS */}
      <section className="py-20 px-6 bg-muted relative overflow-hidden">
        <div className="zarpi-blob zarpi-blob-violet absolute -right-24 bottom-10 pointer-events-none opacity-35 scale-90" />
        <div className="zarpi-blob zarpi-blob-acid absolute -left-20 top-10 pointer-events-none opacity-30 scale-75" />

        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold tracking-tight">Empresas importadoras destacadas</h2>
            <p className="text-muted-foreground mt-2">Verificadas, calificadas y listas para atenderte</p>
          </div>
          {featuredImporters.length===0?(
            <Card padding="lg" className="border-dashed bg-card/60 backdrop-blur-sm">
              <p className="text-sm text-muted-foreground text-center">No hay empresas visibles en este momento.</p>
            </Card>
          ):(
            <div className="grid grid-flow-col auto-cols-[85%] gap-5 overflow-x-auto pb-2 sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-3 sm:overflow-visible">
              {featuredImporters.map(imp=>(
                <ImporterCard key={imp.id} imp={imp} onViewProfile={()=>setProfileModalImporter(imp)} onCreateQuote={()=>onLogin()} featured/>
              ))}
            </div>
          )}
          <div className="text-center mt-8">
            <Button variant="secondary"
              className="text-white hover:text-white border-transparent hover:border-primary dark:hover:border-accent dark:text-accent-foreground bg-primary hover:bg-primary/80 dark:bg-accent dark:hover:bg-accent/80"
              size="md" icon={<Building2 className="w-4 h-4"/>}
              onClick={onLogin}>Ver todas las importadoras</Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 bg-background relative overflow-hidden">
        {/* Blob Lima: visible únicamente en modo oscuro */}
        <div className="hidden dark:block zarpi-blob zarpi-blob-acid absolute right-10 top-1/3 pointer-events-none opacity-25 scale-90" />
        {/* Blob Violeta: visible únicamente en modo claro */}
        <div className="block dark:hidden zarpi-blob zarpi-blob-violet absolute left-10 bottom-10 pointer-events-none opacity-25 scale-90" />

        <div className="max-w-3xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold tracking-tight">Preguntas frecuentes</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={i} className="border border-border rounded-xl overflow-hidden bg-card backdrop-blur-sm">
                <button 
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)} 
                  className="group w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/50 transition-colors"
                >
                  <span className="font-medium text-sm">{f.q}</span>
                  
                  {/* Contenedor circular con bordes y hover por tema */}
                  <div className={clsx(
                    "w-7 h-7 rounded-full border border-border flex items-center justify-center flex-shrink-0 transition-colors duration-200",
                    "group-hover:bg-primary group-hover:border-primary",
                    "dark:group-hover:bg-accent dark:group-hover:border-accent"
                  )}>
                    <ChevronDown className={clsx(
                      "w-4 h-4 text-muted-foreground transition-all duration-200",
                      "group-hover:text-white dark:group-hover:text-accent-foreground",
                      faqOpen === i && "rotate-180"
                    )}/>
                  </div>
                </button>
                {faqOpen === i && (
                  <div className="px-5 pb-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
      </>
      )}

      {activeTab==="about" && <LandingAboutSection/>}
      {activeTab==="how-it-works" && <LandingHowItWorksSection/>}
      {activeTab==="news" && (
        <LandingNewsAlliesSection content={dynamicContent} error={dynamicContentError} onLogin={onLogin} onRegister={onRegister}/>
      )}
      {activeTab==="contact" && <LandingContactSection onLogin={onLogin} onRegister={onRegister}/>}

      {activeTab!=="contact" && (
      <>
      {/* CTA BANNER */}
      <section className="py-16 px-6 bg-primary/60 relative overflow-hidden">

        <div className="zarpi-blob zarpi-blob-violet absolute right-20 top-1/3 pointer-events-none opacity-25 scale-80" />

        <div className="zarpi-blob zarpi-blob-violet absolute left-15 bottom-15 pointer-events-none opacity-25 scale-80 -rotate-[90deg]" />
        <div className="max-w-3xl mx-auto text-center text-primary-foreground relative z-10">
          <h2 className="text-2xl font-bold mb-3">Del mundo a tus manos</h2>
          <p className="text-primary-foreground/75 mb-7 leading-relaxed">Empieza a descubrir oportunidades y encuentra todo más cerca.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              variant="secondary" 
              size="lg" 
              onClick={onRegister} 
              className="px-8 text-accent-foreground"
            >
              Crear cuenta gratis
            </Button>
            <Button 
              variant="secondary" 
              size="lg" 
              onClick={onLogin} 
              className="px-8 text-accent-foreground"
            >
              Iniciar sesión
            </Button>
          </div>
        </div>
      </section>
      </>
      )}

      {/* FOOTER */}
      <footer className="bg-[#0F0F0F] text-white py-10 px-6 relative overflow-hidden">
        <div className="zarpi-blob zarpi-blob-neutral absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-15 scale-125" />
        
        <div className="mx-auto relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="mb-2">
                <img src="/brand/zarpi-wordmark-acid.svg" alt="Zarpi" className="h-8 w-28 object-contain object-left" />
              </div>
              <p className="text-xs text-white/50">Un mundo de productos, más cerca.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 text-xs text-white/70">
              <button onClick={()=>onPolicy("data")} className="hover:text-accent transition-colors text-left">Política de Tratamiento de Datos</button>
              <button onClick={()=>onPolicy("terms")} className="hover:text-accent transition-colors text-left">Términos y Condiciones</button>
              <button onClick={()=>onPolicy("payments")} className="hover:text-accent transition-colors text-left">Pagos y Reembolsos</button>
              <button onClick={onLogin} className="hover:text-accent transition-colors text-left">Iniciar sesión</button>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 pt-6 text-xs text-white/40 text-center space-y-1">
            <p>{EMPRESA.razonSocial} · NIT {EMPRESA.nit} · {EMPRESA.domicilio}</p>
            <p>{EMPRESA.telefono} · <a href={`mailto:${EMPRESA.correo}`} className="hover:text-accent transition-colors">{EMPRESA.correo}</a></p>
            <p>© 2026 Zarpi. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>

      <ImporterProfileModal
        imp={profileModalImporter}
        open={Boolean(profileModalImporter)}
        onClose={()=>setProfileModalImporter(null)}
        onLogin={onLogin}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LANDING — Perfil de empresa (QuickView) y subpáginas públicas
// ─────────────────────────────────────────────────────────────────────────────
function ImporterProfileModal({imp,open,onClose,onLogin}:{imp:Importer|null;open:boolean;onClose:()=>void;onLogin:()=>void}) {
  if(!imp)return null;
  const logoUrl=imp.logoUrl?resolveApiUrl(imp.logoUrl):"";
  const bannerUrl=imp.bannerUrl?resolveApiUrl(imp.bannerUrl):"";
  const certs=imp.certs??[];
  const platformCerts=imp.platformCerts??[];

  return (
    <Modal open={open} onClose={onClose} title={imp.name} width="max-w-2xl">
      <div className="space-y-4">
        {bannerUrl&&<img src={bannerUrl} alt="" className="h-32 w-full rounded-xl object-cover"/>}
        <div className="flex items-center gap-3">
          <Avatar initials={imp.initials} size="2xl" color={imp.color} src={logoUrl||undefined} variant="logo"/>
          <div className="min-w-0">
            <p className="font-semibold text-base truncate">{imp.name}</p>
            <p className="text-xs text-muted-foreground truncate">{imp.specialty} · {imp.country}</p>
          </div>
          {imp.verified&&(
            <span className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold flex-shrink-0">
              <BadgeCheck className="w-3.5 h-3.5"/>Verificada
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{imp.description||"Esta empresa aún no ha publicado su descripción."}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div><p className="text-xs text-muted-foreground">Tiempo de respuesta</p><p className="font-medium">{imp.responseTime}</p></div>
          <div><p className="text-xs text-muted-foreground">Miembro desde</p><p className="font-medium">{imp.memberSince}</p></div>
          <div><p className="text-xs text-muted-foreground">Proyectos</p><p className="font-medium">{imp.projects}</p></div>
        </div>
        {imp.categories.length>0&&(
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Especialidades</p>
            <div className="flex flex-wrap gap-1.5">{imp.categories.map(c=><span key={c} className="px-2 py-1 rounded-full bg-muted text-xs">{c}</span>)}</div>
          </div>
        )}
        {(certs.length>0||platformCerts.length>0)&&(
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Certificaciones</p>
            <div className="flex flex-wrap gap-1.5">
              {platformCerts.map(c=><span key={c.id} className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">{c.nombre}</span>)}
              {certs.map(c=><span key={c} className="px-2 py-1 rounded-full bg-muted text-xs">{c}</span>)}
            </div>
          </div>
        )}
        <Button variant="primary" size="lg" fullWidth onClick={onLogin}>Solicitar cotización / Cotizar</Button>
      </div>
    </Modal>
  );
}

function LandingBackground() {
  const particles = Array.from({ length: 15 }, (_, i) => {
    const random = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    const colors = ["primary", "accent", "neutral"];

    return {
      id: i,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: random(12, 30),
      top: random(0, 100),
      left: random(0, 100),
      duration: random(80, 100),
      delay: random(-16, 0),
      originX: random(-25, 25),
      originY: random(-25, 25),
      shadowX: Math.random() > 0.5 ? 1 : -1,
      blur: random(5, 30),
    };
  });

  return (
    <div className="landing-anim-background" aria-hidden="true">
      {particles.map((particle) => (
        <span
          key={particle.id}
          className={`landing-orb-${particle.color}`}
          style={{
            width: `${particle.size}vmin`,
            height: `${particle.size}vmin`,
            borderRadius: `${particle.size}vmin`,
            top: `${particle.top}%`,
            left: `${particle.left}%`,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`,
            transformOrigin: `${particle.originX}vw ${particle.originY}vh`,
            boxShadow: `${particle.size * 2 * particle.shadowX}px 0 ${
              particle.blur
            }vmin currentColor`,
          }}
        />
      ))}
    </div>
  );
}

/** "Quiénes somos": los tres principios del negocio (Zarpi_Modelo_de_Monetizacion). */
function LandingAboutSection() {
  const principios=[
    {title:"No somos importadores de registro",desc:"Conectamos solicitantes con empresas nacionalizadoras verificadas; no figuramos como importador de registro en ninguna operación."},
    {title:"No custodiamos dinero de terceros",desc:"El pago del servicio se acuerda y se ejecuta entre el solicitante y la nacionalizadora; la plataforma no retiene ni administra esos fondos."},
    {title:"Garantizamos verificación y trazabilidad documental",desc:"Cada empresa pasa por un proceso de verificación documental, y cada cotización, propuesta y orden queda registrada y trazable dentro de la plataforma."},
  ];
  return (
    <section className="pt-32 pb-20 px-6 relative overflow-hidden">
      <LandingBackground />

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.18em] text-primary dark:text-accent font-semibold mb-3">Quiénes somos</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Un modelo claro, desde el primer día</h1>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">Zarpi conecta, no custodia ni interviene como importador. Así protegemos tanto al solicitante como a la empresa importadora.</p>
        </div>
        <div className="grid sm:grid-cols-1 gap-5">
          {principios.map((principio,i)=>(
            <Card key={principio.title} padding="lg" className="border-primary/15">
              <p className="text-xs font-semibold text-primary dark:text-accent mb-2">Principio {i+1}</p>
              <h3 className="text-lg font-bold mb-2">{principio.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{principio.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/** "Cómo funciona": 8 pasos + condiciones de monetización para comprador y nacionalizadora. */
function LandingHowItWorksSection() {
  const pasos=[
    "El solicitante crea su solicitud de cotización con los detalles del producto.",
    "La solicitud llega a nacionalizadoras verificadas, dirigida o abierta.",
    "Las nacionalizadoras envían sus propuestas con precio, tiempos y condiciones.",
    "El solicitante compara y negocia por el chat integrado con el asesor asignado.",
    "Al aceptar una propuesta, la plataforma crea la orden automáticamente.",
    "La nacionalizadora actualiza el estado: producción, tránsito, aduana y bodega.",
    "El solicitante y la nacionalizadora hacen seguimiento documental en cada etapa.",
    "Se confirma la entrega y, si aplica, se declara el cierre de la operación.",
  ];
  return (
    <section className="pt-32 pb-20 px-6 relative overflow-hidden">
      <LandingBackground />
      <div className="max-w-5xl mx-auto relative z-10">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.18em] text-primary dark:text-accent font-semibold mb-3">Cómo funciona</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Un flujo transparente, de principio a fin</h1>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mb-14">
          {pasos.map((paso,i)=>(
            <Card key={i} padding="md" className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground dark:bg-accent dark:text-accent-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
              <p className="text-sm text-muted-foreground leading-relaxed">{paso}</p>
            </Card>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <Card padding="lg">
            <h3 className="text-base font-bold mb-3">Para compradores</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Primera cotización, gratis.</li>
              <li>• COP 40.000 por cada cotización adicional dentro del mismo mes.</li>
              <li>• 6 meses de cotizaciones gratis al declarar el cierre de una operación.</li>
            </ul>
          </Card>
          <Card padding="lg">
            <h3 className="text-base font-bold mb-3">Para nacionalizadoras</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• 5% de comisión sobre el servicio cobrado, vía bolsa prepagada.</li>
              <li>• Founders Program: 5% de por vida para las primeras empresas aliadas.</li>
            </ul>
          </Card>
        </div>
      </div>
    </section>
  );
}

/** "Novedades y aliados": bloques dinámicos, miniblog y muro de aliados del CMS. */
const LANDING_IMAGE_FALLBACK = "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=80";
// Tokens de marca con su variante clara/oscura resuelta vía Tailwind `dark:`,
// nunca HEX fijo en lo renderizado (ver Zarpi_Modelo_de_Monetizacion).
const LANDING_TOKEN_TEXT_CLASS:Record<string,string>={
  primary:"text-[#4F06EB] dark:text-[#EDF953]",
  surface:"text-black dark:text-white",
  border:"text-slate-400 dark:text-zinc-500",
  foreground:"text-black dark:text-white",
  muted:"text-slate-500 dark:text-zinc-400",
};
const LANDING_TOKEN_BUTTON_CLASS:Record<string,string>={
  primary:"bg-[#4F06EB] text-white dark:bg-[#EDF953] dark:text-black",
  surface:"bg-white text-black dark:bg-[#0F0F0F] dark:text-white",
  border:"bg-transparent border border-slate-200 dark:border-zinc-800",
  foreground:"bg-black text-white dark:bg-white dark:text-black",
  muted:"bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300",
};
const LANDING_FONT_CLASS:Record<string,string>={elvellon:"font-elvellon",avenor:"font-avenor"};
const LANDING_HEADING_SIZE_CLASS:Record<string,string>={xl:"text-3xl font-bold",lg:"text-2xl font-bold",md:"text-xl font-semibold",sm:"text-lg font-semibold"};
const LANDING_TEXT_SIZE_CLASS:Record<string,string>={lg:"text-base",md:"text-sm",sm:"text-xs"};
const LANDING_ALIGN_CLASS:Record<string,string>={left:"text-left",center:"text-center",right:"text-right"};

/** Un bloque del CMS renderizado con las mismas reglas que la previsualización del admin. */
function LandingDynamicBlock({block,onLogin,onRegister}:{block:LandingBlock;onLogin:()=>void;onRegister:()=>void}) {
  const alignClass=LANDING_ALIGN_CLASS[block.alineacion]||"text-left";
  const tokenTextClass=LANDING_TOKEN_TEXT_CLASS[block.token_color]||LANDING_TOKEN_TEXT_CLASS.foreground;
  const tokenButtonClass=LANDING_TOKEN_BUTTON_CLASS[block.token_color]||LANDING_TOKEN_BUTTON_CLASS.primary;
  const fontClass=LANDING_FONT_CLASS[block.fuente]||LANDING_FONT_CLASS.avenor;

  if(block.tipo==="heading"){
    return <p className={clsx(alignClass,tokenTextClass,fontClass,LANDING_HEADING_SIZE_CLASS[block.tamano_fuente]||LANDING_HEADING_SIZE_CLASS.md)}>{block.contenido}</p>;
  }
  if(block.tipo==="paragraph"){
    return <p className={clsx(alignClass,tokenTextClass,fontClass,LANDING_TEXT_SIZE_CLASS[block.tamano_fuente]||LANDING_TEXT_SIZE_CLASS.md)}>{block.contenido}</p>;
  }
  if(block.tipo==="image"){
    if(!block.contenido)return null;
    return (
      <div className={alignClass}>
        <img
          src={safeHttpUrl(resolveApiUrl(block.contenido),LANDING_IMAGE_FALLBACK)}
          alt=""
          className="inline-block max-h-80 rounded-xl border border-slate-200 dark:border-zinc-800 object-cover"
          onError={(event)=>{event.currentTarget.src=LANDING_IMAGE_FALLBACK;}}
        />
      </div>
    );
  }
  if(block.tipo==="video"){
    return block.contenido?<div className={alignClass}><video src={resolveApiUrl(block.contenido)} controls className="inline-block max-h-80 w-full max-w-2xl rounded-xl border border-slate-200 dark:border-zinc-800"/></div>:null;
  }
  if(block.tipo==="button"){
    const handleClick=block.accion_boton==="open_register"?onRegister
      :block.accion_boton==="external_link"&&block.accion_url?()=>window.open(block.accion_url as string,"_blank","noopener,noreferrer")
      :onLogin;
    return <div className={alignClass}><button type="button" onClick={handleClick} className={clsx("inline-flex items-center rounded-lg px-6 py-3 text-sm font-semibold",tokenButtonClass)}>{block.contenido||"Continuar"}</button></div>;
  }
  return null;
}

function LandingNewsAlliesSection({content,error,onLogin,onRegister}:{content:LandingDynamicContent|null;error:string;onLogin:()=>void;onRegister:()=>void}) {
  const dynamicBlocks=(content?.blocks??[]).filter(b=>b.tipo!=="allies_grid").sort((a,b)=>a.orden-b.orden);
  return (
    <section className="pt-32 pb-20 px-6 relative overflow-hidden">
      <LandingBackground />
      <div className="max-w-5xl mx-auto space-y-14 relative z-10">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-primary dark:text-accent font-semibold mb-3">Novedades y aliados</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Lo último de Zarpi</h1>
        </div>

        {error&&(
          <Card padding="md" className="border-destructive/30 bg-red-50 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        )}

        {!content&&!error&&(
          <p className="text-center text-sm text-muted-foreground">Cargando contenido...</p>
        )}

        {content&&(
          <>
            {dynamicBlocks.length>0&&(
              <Card padding="lg" className="space-y-5 bg-white/30 !backdrop-blur-md">
                {dynamicBlocks.map(block=><LandingDynamicBlock key={block.id} block={block} onLogin={onLogin} onRegister={onRegister}/>)}
              </Card>
            )}

            <div>
              <h2 className="text-xl font-bold mb-5">Novedades</h2>
              {content.news.length===0?(
                <p className="text-sm text-muted-foreground">Todavía no hay novedades publicadas.</p>
              ):(
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {content.news.map(item=>(
                    <Card key={item.id} padding="md">
                      {item.imagen_url&&(
                        <img
                          src={safeHttpUrl(resolveApiUrl(item.imagen_url),LANDING_IMAGE_FALLBACK)}
                          alt=""
                          className="h-32 w-full rounded-lg object-cover mb-3"
                          onError={(event)=>{event.currentTarget.src=LANDING_IMAGE_FALLBACK;}}
                        />
                      )}
                      <h3 className="font-semibold text-sm mb-1.5">{item.titulo}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.resumen}</p>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold mb-5">Aliados</h2>
              {content.allies.length===0?(
                <p className="text-sm text-muted-foreground">Todavía no hay aliados publicados.</p>
              ):(
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {content.allies.map(ally=>{
                    const card=(
                      <Card padding="md" className="flex flex-col items-center text-center gap-2">
                        {ally.logo_url?(
                          <img
                            src={safeHttpUrl(resolveApiUrl(ally.logo_url),LANDING_IMAGE_FALLBACK)}
                            alt={ally.nombre}
                            className="h-12 object-contain"
                            onError={(event)=>{event.currentTarget.src=LANDING_IMAGE_FALLBACK;}}
                          />
                        ):(
                          <Building2 className="w-8 h-8 text-muted-foreground/40"/>
                        )}
                        <p className="text-xs font-medium">{ally.nombre}</p>
                      </Card>
                    );
                    return ally.enlace?(
                      <a key={ally.id} href={ally.enlace} target="_blank" rel="noopener noreferrer">{card}</a>
                    ):(
                      <div key={ally.id}>{card}</div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/** "Contacto": selector de perfil (comprador / nacionalizadora) + FAQ. */
function LandingContactSection({onLogin,onRegister}:{onLogin:()=>void;onRegister:()=>void}) {
  const [perfil,setPerfil]=useState<"comprador"|"nacionalizadora">("comprador");
  const [nombre,setNombre]=useState("");
  const [email,setEmail]=useState("");
  const [telefono,setTelefono]=useState("");
  const [mensaje,setMensaje]=useState("");
  const [enviado,setEnviado]=useState(false);
  const [enviando,setEnviando]=useState(false);
  const [errorEnvio,setErrorEnvio]=useState("");

  const faqsContacto=[
    {q:"¿Cómo empiezo si soy comprador?",a:"Crea tu cuenta gratis y publica tu primera solicitud de cotización sin costo."},
    {q:"¿Cómo empiezo si soy nacionalizadora?",a:"Escríbenos desde este formulario: el equipo revisa tu documentación antes del alta."},
  ];

  async function enviarContacto(event:React.FormEvent){
    event.preventDefault();
    setErrorEnvio("");
    setEnviando(true);
    try{
      await landingService.sendContact({
        nombre:nombre.trim(),
        email:email.trim(),
        telefono:telefono.trim()||undefined,
        perfil,
        mensaje:mensaje.trim(),
      });
      setEnviado(true);
    }catch(error){
      setErrorEnvio(error instanceof Error&&error.message.trim()?error.message:"No se pudo enviar tu mensaje. Intenta nuevamente.");
    }finally{
      setEnviando(false);
    }
  }

  return (
    <section className="pt-32 pb-20 px-6 relative overflow-hidden">
      <LandingBackground />
      <div className="max-w-3xl mx-auto space-y-12 relative z-10">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-primary dark:text-accent font-semibold mb-3">Contacto</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Hablemos</h1>
        </div>

        <Card padding="lg">
          {enviado ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-10 h-10 text-accent mx-auto mb-3" />
              <p className="font-semibold">Gracias, recibimos tu mensaje.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Te responderemos pronto a {email || "tu correo"}.
              </p>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => { void enviarContacto(event); }}
            >
              <div className="flex gap-2">
                {(["comprador", "nacionalizadora"] as const).map(opt => (
                  <button
                    type="button"
                    key={opt}
                    onClick={() => setPerfil(opt)}
                    className={clsx(
                      "flex-1 h-9 rounded-lg border text-sm font-medium transition-all",
                      perfil === opt
                        ? "bg-primary text-white border-primary dark:bg-accent dark:text-accent-foreground dark:border-accent"
                        : "bg-white text-muted-foreground border-border hover:border-primary/40 dark:bg-transparent dark:hover:border-accent/40"
                    )}
                  >
                    {opt === "comprador" ? "Soy comprador" : "Soy nacionalizadora"}
                  </button>
                ))}
              </div>

              <Input
                label="Nombre"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                required
                className="focus:border-primary dark:focus:border-accent"
              />

              <Input
                label="Correo"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="focus:border-primary dark:focus:border-accent"
              />

              <Input
                label="Teléfono (opcional)"
                type="tel"
                value={telefono}
                onChange={(event) => setTelefono(event.target.value)}
                className="focus:border-primary dark:focus:border-accent"
              />

              <Textarea
                label="Mensaje"
                rows={4}
                value={mensaje}
                onChange={(event) => setMensaje(event.target.value)}
                required
                className="focus:border-primary dark:focus:border-accent"
              />

              {errorEnvio ? <p className="text-sm text-destructive">{errorEnvio}</p> : null}

              <Button type="submit" variant="primary" fullWidth loading={enviando} className="dark:bg-accent dark:hover:bg-accent/80 dark:text-accent-foreground">
                {enviando ? "Enviando..." : "Enviar mensaje"}
              </Button>
            </form>
          )}
        </Card>

        <div className="space-y-3">
          {faqsContacto.map((f,i)=>(
            <Card key={f.q} padding="md">
              <p className="text-sm font-semibold mb-1">{f.q}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.a}</p>
            </Card>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="secondary" size="lg" onClick={onRegister}>Crear cuenta gratis</Button>
          <Button variant="primary" size="lg" onClick={onLogin}>Iniciar sesión</Button>
        </div>
      </div>
    </section>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
type RegUserType="solicitante"|"importadora";
type RegPersonType="natural"|"juridica";

function RegisterScreen({onBack,onSuccess,onPolicy}:{onBack:()=>void;onSuccess:(email:string)=>void;onPolicy:(page:LegalPage)=>void}) {
  const [userType,setUserType]=useState<RegUserType>("solicitante");
  const [personType,setPersonType]=useState<RegPersonType>("natural");
  const [accepted,setAccepted]=useState(false);
  const [loading,setLoading]=useState(false);
  const [success,setSuccess]=useState(false);
  const [registeredEmail,setRegisteredEmail]=useState("");
  const [otpCode,setOtpCode]=useState("");
  const [otpLoading,setOtpLoading]=useState(false);
  const [otpError,setOtpError]=useState("");
  const [otpSuccess,setOtpSuccess]=useState(false);
  const [submitError,setSubmitError]=useState("");
  const { dark, toggleTheme } = useBrandTheme();
  const [form,setForm]=useState({
    email:"",docType:"CC",docNum:"",name:"",lastName:"",phone:"",country:"+57",
    nit:"",razonSocial:"",repEmail:"",repPhone:"",repCountry:"+57",password:"",confirmPassword:"",
  });

  function f(k:string,v:string){setForm(p=>({...p,[k]:v}));}

  function getErrorMessage(error: unknown){
    if(error instanceof Error&&error.message){
      return error.message;
    }
    if(typeof error==="string"&&error){
      return error;
    }
    if(typeof error==="object"&&error!==null){
      const response="response" in error?error.response:undefined;
      if(typeof response==="object"&&response!==null&&"data" in response){
        const data=response.data;
        if(typeof data==="object"&&data!==null&&"detail" in data){
          const detail=data.detail;
          if(typeof detail==="string"&&detail){
            return detail;
          }
        }
      }
    }
    return "No se pudo completar el registro";
  }

  async function submit(e:React.FormEvent){
    e.preventDefault();
    if(!accepted||loading)return;

    setSubmitError("");

    const password=form.password;
    if(password.length<9){
      setSubmitError("La contraseña debe tener minimo 9 caracteres.");
      return;
    }
    if(form.password!==form.confirmPassword){
      setSubmitError("Las contraseñas no coinciden.");
      return;
    }

    const email=(personType==="natural"?form.email:form.repEmail).trim();
    const telefono=(personType==="natural"?form.phone:form.repPhone).trim();
    const indicativo=(personType==="natural"?form.country:form.repCountry).trim();

    const codigoReferido = leerCodigoReferidoDeLaUrl();

    const payload: RegisterRequest = personType === "natural"
      ? {
          email,
          password,
          rol: "solicitante",
          tipo_persona: "natural",
          tipo_documento: String(form.docType ?? "").trim(),
          numero_documento: String(form.docNum ?? "").trim(),
          nombre: String(form.name ?? "").trim(),
          apellido: String(form.lastName ?? "").trim(),
          indicativo_pais_telefono: indicativo,
          telefono,
          acepto_politica_datos: accepted,
          ...(codigoReferido ? { codigo_referido: codigoReferido } : {}),
        }
      : {
          email,
          password,
          rol: "solicitante",
          tipo_persona: "juridica",
          nit: String(form.nit ?? "").trim(),
          razon_social: String(form.razonSocial ?? "").trim(),
          indicativo_pais_telefono: indicativo,
          telefono,
          acepto_politica_datos: accepted,
          ...(codigoReferido ? { codigo_referido: codigoReferido } : {}),
        };

    try{
      setLoading(true);
      await authService.register(payload);
      setRegisteredEmail(email);
      setSuccess(true);
    }catch(error){
      setSubmitError(getErrorMessage(error));
    }finally{
      setLoading(false);
    }
  }

  async function verifyOtp(e:React.FormEvent){
    e.preventDefault();
    if(otpLoading)return;

    const normalizedOtp=String(otpCode??"").trim();
    if(normalizedOtp.length!==6){
      setOtpError("Ingresa un codigo OTP valido de 6 digitos.");
      return;
    }

    if(!registeredEmail){
      setOtpError("No se encontro el correo de registro para verificar la cuenta.");
      return;
    }

    try{
      setOtpLoading(true);
      setOtpError("");
      await authService.verifyEmail({ email: registeredEmail, otp: normalizedOtp });
      setOtpSuccess(true);
      setTimeout(()=>onSuccess(registeredEmail),1200);
    }catch(error){
      setOtpError(getErrorMessage(error));
    }finally{
      setOtpLoading(false);
    }
  }

  const countryPhones=["+57","+1","+52","+34","+44","+49","+55","+54","+56","+51"];
  const docTypes=["CC","CE","Pasaporte","NIT","DNI"];

  if(success)return(
    <div className="min-h-screen flex flex-col bg-background items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-border shadow-sm p-8 max-w-sm w-full text-center relative z-10">
        {!otpSuccess?(
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4"/>
            <h2 className="text-lg font-semibold mb-2">¡Registro exitoso!</h2>
            <p className="text-sm text-muted-foreground mb-4">Te enviamos un codigo OTP de 6 digitos a <span className="font-medium text-foreground">{registeredEmail||"tu correo"}</span>.</p>

            <form onSubmit={verifyOtp} className="space-y-3 text-left">
              <Input
                label="Codigo OTP"
                value={otpCode}
                onChange={e=>setOtpCode(e.target.value)}
                placeholder="123456"
                inputMode="numeric"
                maxLength={6}
                required
              />
              {otpError&&<p className="text-xs text-destructive text-left">{otpError}</p>}
              <Button type="submit" variant="primary" fullWidth loading={otpLoading}>
                {!otpLoading&&"Activar cuenta"}
              </Button>
            </form>

            <button type="button" onClick={onBack} className="mt-4 text-xs text-muted-foreground hover:text-foreground">Volver al inicio</button>
          </>
        ):(
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4"/>
            <h2 className="text-lg font-semibold mb-2">¡Cuenta activada con éxito!</h2>
            <p className="text-sm text-muted-foreground">Redirigiendo al inicio de sesion...</p>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-background px-6 py-3.5 relative z-10">
        <Logo/>
        <div className="flex items-center gap-1.5 w-fit">
          <button
            onClick={toggleTheme}
            title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-primary hover:text-primary-foreground dark:hover:bg-accent dark:hover:text-accent-foreground transition-colors"
          >
            {dark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
          </button>
          <Button variant="ghost" size="sm" icon={<ChevronLeft className="w-3.5 h-3.5"/>} onClick={onBack}>Volver</Button>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-10 overflow-hidden">
        {/* Fondo con z-0 */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img
            src={dark ? "/brand/fondo-1.png" : "/brand/fondo-4.png"}
            alt="Fondo de registro"
            className="auth-background w-full h-full object-cover object-center transition-all duration-300"
          />
        </div>

        {/* Card principal con z-10 por encima de la imagen */}
        <div className="relative z-10 w-full max-w-[480px]">
          <div className="bg-white rounded-2xl border border-border shadow-sm">
            <div className="px-8 pt-8 pb-2">
              <h1 className="text-xl font-semibold tracking-tight mb-1">
                Crear cuenta
              </h1>

              <p className="text-sm text-muted-foreground mb-6">
                Elige el tipo de cuenta que deseas registrar
              </p>

              {/* User type */}
              <div className="flex gap-2 mb-6">
                {(["solicitante", "importadora"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setUserType(t)}
                    className={clsx(
                      "flex-1 py-3 flex flex-col items-center gap-1.5 border rounded-xl text-xs font-semibold transition-all capitalize",
                      userType === t
                        ? "border-primary bg-primary/5 text-primary dark:border-accent dark:bg-accent/5 dark:text-accent"
                        : "border-border text-muted-foreground hover:border-primary/40 dark:hover:border-accent/40"
                    )}
                  >
                    {t === "solicitante" ? (
                      <UserRound className="w-5 h-5" />
                    ) : (
                      <Building2 className="w-5 h-5" />
                    )}

                    {t === "solicitante"
                      ? "Soy solicitante"
                      : "Soy empresa importadora"}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-8 pb-8">
              {userType === "importadora" ? (
                <div className="flex flex-col items-center text-center gap-5 py-6">
                  <div className="w-16 h-16 rounded-2xl bg-primary/20 dark:bg-accent/20 flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-primary dark:text-accent" />
                  </div>

                  <div>
                    <h2 className="font-semibold mb-2">Registro de empresa importadora</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                      Actualmente las empresas importadoras son registradas directamente por el equipo administrativo. Contáctanos para iniciar el proceso.
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    className="dark:bg-accent dark:hover:bg-accent/90 dark:text-accent-foreground"
                    size="md"
                    icon={<MailIcon className="w-4 h-4" />}
                    onClick={() => openSmartContact({ type: "email", email: CORREO_ADMINISTRACION })}
                  >
                    Contactar al equipo administrativo
                  </Button>

                  <button
                    onClick={onBack}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ← Volver al inicio
                  </button>
                </div>
              ):(
                <form onSubmit={submit} noValidate>
                  {/* Person type */}
                  <div className="flex gap-2 mb-5">
                    {(["natural", "juridica"] as const).map(t => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setPersonType(t)}
                        className={clsx(
                          "flex-1 py-2 text-xs font-semibold border rounded-lg transition-all",
                          personType === t
                            ? "border-primary bg-primary/5 text-primary dark:border-accent dark:bg-accent/5 dark:text-accent"
                            : "border-border text-muted-foreground hover:border-primary/40 dark:hover:border-accent/40"
                        )}
                      >
                        {t === "natural" ? "Persona Natural" : "Persona Jurídica"}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-4">
                    {personType==="natural"?(
                      <>
                        <Input label="Correo electrónico" type="email" placeholder="correo@ejemplo.com" value={form.email} onChange={e=>f("email",e.target.value)} prefix={<Mail className="w-4 h-4"/>} required/>
                        <Input label="Contrasena" type="password" placeholder="Minimo 9 caracteres" value={form.password} onChange={e=>f("password",e.target.value)} prefix={<Lock className="w-4 h-4"/>} required/>
                        <Input label="Confirmar contrasena" type="password" placeholder="Repite tu contraseña" value={form.confirmPassword} onChange={e=>f("confirmPassword",e.target.value)} prefix={<Lock className="w-4 h-4"/>} required/>
                        <div className="grid grid-cols-2 gap-3">
                          <Select label="Tipo de documento" value={form.docType} onChange={e=>f("docType",e.target.value)}>{docTypes.map(d=><option key={d}>{d}</option>)}</Select>
                          <Input label="Número de documento" placeholder="1234567890" value={form.docNum} onChange={e=>f("docNum",e.target.value)} required/>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Input label="Nombre(s)" placeholder="Ana" value={form.name} onChange={e=>f("name",e.target.value)} required/>
                          <Input label="Apellidos" placeholder="García" value={form.lastName} onChange={e=>f("lastName",e.target.value)} required/>
                        </div>
                        <div className="flex gap-2">
                          <Select label="País" value={form.country} onChange={e=>f("country",e.target.value)} className="w-24">{countryPhones.map(c=><option key={c}>{c}</option>)}</Select>
                          <div className="flex-1"><Input label="Teléfono" placeholder="310 123 4567" value={form.phone} onChange={e=>f("phone",e.target.value)} required/></div>
                        </div>
                      </>
                    ):(
                      <>
                        <Input label="Correo del representante" type="email" placeholder="representante@empresa.com" value={form.repEmail} onChange={e=>f("repEmail",e.target.value)} prefix={<Mail className="w-4 h-4"/>} required/>
                        <Input label="Contrasena" type="password" placeholder="Minimo 9 caracteres" value={form.password} onChange={e=>f("password",e.target.value)} prefix={<Lock className="w-4 h-4"/>} required/>
                        <Input label="Confirmar contrasena" type="password" placeholder="Repite tu contraseña" value={form.confirmPassword} onChange={e=>f("confirmPassword",e.target.value)} prefix={<Lock className="w-4 h-4"/>} required/>
                        <Input label="NIT" placeholder="900.123.456-7" value={form.nit} onChange={e=>f("nit",e.target.value)} required/>
                        <Input label="Razón social" placeholder="Mi Empresa S.A.S." value={form.razonSocial} onChange={e=>f("razonSocial",e.target.value)} required/>
                        <div className="flex gap-2">
                          <Select label="País" value={form.repCountry} onChange={e=>f("repCountry",e.target.value)} className="w-24">{countryPhones.map(c=><option key={c}>{c}</option>)}</Select>
                          <div className="flex-1"><Input label="Teléfono" placeholder="310 123 4567" value={form.repPhone} onChange={e=>f("repPhone",e.target.value)} required/></div>
                        </div>
                      </>
                    )}
                    {submitError&&<p className="text-xs text-destructive">{submitError}</p>}
                    <div className="flex items-start gap-2.5 mt-1">
                      <input 
                        type="checkbox" 
                        id="acepta" 
                        checked={accepted} 
                        onChange={e => setAccepted(e.target.checked)} 
                        className="
                          mt-0.5
                          h-4 w-4
                          flex-shrink-0
                          cursor-pointer
                          rounded
                          border
                          border-primary
                          bg-white
                          accent-primary
                          transition-colors
                          duration-150
                          dark:border-accent
                          dark:bg-accent
                          dark:accent-accent
                        "
                      />
                      <label htmlFor="acepta" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                        Acepto la <button type="button" onClick={()=>onPolicy("data")} className="text-xs font-medium text-purple-600 dark:text-green-500 underline">Política de Tratamiento de Datos</button> y los <button type="button" onClick={()=>onPolicy("terms")} className="text-xs font-medium text-purple-600 dark:text-green-500 underline">Términos y Condiciones</button> de la plataforma.
                      </label>
                    </div>
                    <Button
                      type="submit"
                      variant="primary"
                      fullWidth loading={loading}
                      disabled={!accepted}
                      className="mt-1 h-10 uppercase tracking-wide text-[13px] dark:bg-accent dark:hover:bg-accent dark:text-black">
                        {!loading&&"Crear cuenta"}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">¿Ya tienes cuenta? <button type="button" onClick={onBack} className="text-purple-600 dark:text-green-500 hover:underline font-medium">Iniciar sesión</button></p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="flex items-center justify-center gap-4 border-t border-border bg-background py-4 text-center text-xs text-muted-foreground relative z-10">
        <span>© 2026 Zarpi</span>
        <button onClick={() => onPolicy("data")} className="transition-colors hover:text-foreground">
          Tratamiento de Datos
        </button>
        <button onClick={() => onPolicy("terms")} className="transition-colors hover:text-foreground">
          Términos
        </button>
        <button onClick={() => onPolicy("payments")} className="transition-colors hover:text-foreground">
          Pagos y Reembolsos
        </button>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────
function LoginScreen({onLogin,onRegister,onLanding,onPolicy,initialEmail}:{onLogin:(role:UserRole|"admin")=>void;onRegister:()=>void;onLanding:()=>void;onPolicy:(page:LegalPage)=>void;initialEmail?:string}) {
  return (
    <AuthScreen
      onLogin={onLogin}
      onRegister={onRegister}
      onLanding={onLanding}
      onPolicy={onPolicy}
      logo={<Logo />}
      initialEmail={initialEmail}
    />
  );
}

function ResetPasswordScreen({ token, onBackToLogin }: { token: string; onBackToLogin: () => void }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-white px-6 py-3.5">
        <Logo/>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[420px]">
          <ResetPasswordForm token={token} onBackToLogin={onBackToLogin} />
        </div>
      </main>
    </div>
  );
}

/** Qué área del panel corresponde a cada entrada del sidebar del admin. */
const ADMIN_SECTION_BY_SCREEN = {
  "admin-dashboard": "metricas",
  "admin-empresas": "empresas",
  "admin-usuarios": "usuarios",
  "admin-cotizantes": "cotizantes",
  "admin-soporte": "soporte",
  "admin-certificaciones": "certificaciones",
  "admin-respaldos": "respaldos",
  "admin-asignacion": "asignacion",
  "admin-landing": "landing",
  "admin-correos": "correos",
} as const;

type AdminScreen = keyof typeof ADMIN_SECTION_BY_SCREEN;

function AdminDashboardScreen({sb,onRefreshGlobal,screen}:{sb:SidebarCtrl;onRefreshGlobal?:()=>Promise<void>;screen:AdminScreen}) {
  const mainRef = useRef<HTMLElement | null>(null);
  const section = ADMIN_SECTION_BY_SCREEN[screen];

  useEffect(() => {
    if (!mainRef.current) {
      return;
    }
    mainRef.current.scrollTo({ top: 0, behavior: "auto" });
  }, [section]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active={screen}/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        <AppHeader user={USER} sb={sb}/>
        <main ref={mainRef} className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-6xl mx-auto">
          <div className="admin-dashboard">
            <AdminDashboard onRefreshGlobal={onRefreshGlobal} section={section}/>
          </div>
          </div>
        </main>
        </div>
    </div>
  );
}

function HelpSupportScreen({sb,role,onPedirSoporte}:{sb:SidebarCtrl;role:UserRole;onPedirSoporte:()=>void}) {
  const helpRole = normalizeHelpRole(role);
  const roleContent = HELP_SUPPORT_CONTENT[helpRole];
  const [faqSearch, setFaqSearch] = useState("");
  const [categoria, setCategoria] = useState("");
  const [articulos, setArticulos] = useState<ArticuloAyuda[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [cargandoAyuda, setCargandoAyuda] = useState(true);
  const [expandido, setExpandido] = useState<string|null>(null);
  const [votados, setVotados] = useState<Record<string, boolean>>({});

  useEffect(()=>{
    let vigente = true;
    setCargandoAyuda(true);
    const t = setTimeout(()=>{
      void ayudaService.listArticles({ buscar: faqSearch, categoria: categoria || undefined })
        .then((datos)=>{
          if(!vigente) return;
          setArticulos(datos.articulos);
          if(!categoria) setCategorias(datos.categorias);
        })
        .catch(()=>{ if(vigente) setArticulos([]); })
        .finally(()=>{ if(vigente) setCargandoAyuda(false); });
    }, faqSearch ? 250 : 0);
    return ()=>{ vigente = false; clearTimeout(t); };
  },[faqSearch, categoria]);

  function abrirArticulo(articulo: ArticuloAyuda){
    const abriendo = expandido !== articulo.id;
    setExpandido(abriendo ? articulo.id : null);
    if(abriendo){
      void ayudaService.markRead(articulo.id).catch(()=>undefined);
    }
  }

  async function votar(articuloId: string, util: boolean){
    setVotados((prev)=>({ ...prev, [articuloId]: true }));
    await ayudaService.vote(articuloId, util).catch(()=>undefined);
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="help-support"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={role === "importadora" ? USER_IMPORTADORA : role === "asesor" ? USER_ASESOR : USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div>
            <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav(role === "importadora" ? "imp-dashboard" : role === "asesor" ? "adv-dashboard" : "dashboard")},{label:"Ayuda y soporte"}]}/>
            <h1 className="text-xl font-semibold tracking-tight mt-3">Ayuda y soporte</h1>
            <p className="text-sm text-muted-foreground mt-1">Guia de uso y preguntas frecuentes para rol {roleContent.roleLabel}.</p>
          </div>

          {/* Card con borde y fondo accent en modo oscuro */}
          <Card padding="md" className="border-primary/30 dark:border-accent/30 bg-primary/[0.03] dark:bg-accent/[0.05]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 dark:bg-accent/20 text-primary dark:text-accent flex items-center justify-center flex-shrink-0">
                  <LifeBuoy className="w-4 h-4"/>
                </div>
                <div>
                  <p className="text-sm font-semibold">¿No encuentras la respuesta aquí?</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Abre un ticket y te atiende una persona del equipo de Zarpi. Se prioriza por urgencia.
                  </p>
                </div>
              </div>
              <Button 
                variant="primary" 
                icon={<LifeBuoy className="w-4 h-4"/>} 
                onClick={onPedirSoporte}
                className="dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/90"
              >
                Pedir soporte técnico
              </Button>
            </div>
          </Card>

          <Card padding="md">
            <div className="space-y-3">
              <Input
                value={faqSearch}
                onChange={(event)=>setFaqSearch(event.target.value)}
                placeholder="Describe tu problema: «no me llegan propuestas», «rol insuficiente»…"
                prefix={<Search className="w-4 h-4"/>}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={()=>setCategoria("")}
                  className={clsx("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    categoria==="" ? "bg-primary dark:bg-accent text-white dark:text-accent-foreground border-primary dark:border-accent" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground")}
                >
                  Todo
                </button>
                {categorias.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={()=>setCategoria(c===categoria?"":c)}
                    className={clsx("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      categoria===c ? "bg-primary dark:bg-accent text-white dark:text-accent-foreground border-primary dark:border-accent" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground")}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card padding="md" className="md:col-span-2">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-primary dark:text-accent"/>
                  <h2 className="text-sm font-semibold">Documentación</h2>
                </div>
                <span className="text-xs text-muted-foreground">
                  {cargandoAyuda?"Cargando…":`${articulos.length} artículos`}
                </span>
              </div>
              <div className="space-y-2.5">
                {!cargandoAyuda&&articulos.length===0&&(
                  <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                    No encontramos nada para esa búsqueda. Prueba con otras palabras o abre un ticket de soporte:
                    el equipo escribe un artículo nuevo cuando una duda se repite.
                  </div>
                )}
                {articulos.map((articulo)=>{
                  const abierto = expandido===articulo.id;
                  return (
                    <div key={articulo.id} className="rounded-lg border border-border bg-card overflow-hidden">
                      <button
                        type="button"
                        onClick={()=>abrirArticulo(articulo)}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{articulo.titulo}</p>
                            <p className="text-sm text-muted-foreground mt-0.5">{articulo.resumen}</p>
                          </div>
                          <span className="flex-shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {articulo.categoria}
                          </span>
                        </div>
                        {articulo.contenido&&(
                          <span className="mt-1.5 inline-block text-xs font-medium text-primary dark:text-accent">
                            {abierto?"Ocultar detalle":"Ver paso a paso"}
                          </span>
                        )}
                      </button>

                      {abierto&&articulo.contenido&&(
                        <div className="border-t border-border px-3 py-3 bg-muted/20">
                          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                            {articulo.contenido}
                          </p>
                          <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 flex-wrap">
                            {votados[articulo.id]?(
                              <p className="text-xs text-muted-foreground">Gracias, lo tendremos en cuenta.</p>
                            ):(
                              <>
                                <span className="text-xs text-muted-foreground">¿Te resolvió la duda?</span>
                                <Button variant="secondary" size="sm" onClick={()=>{void votar(articulo.id,true);}}>Sí</Button>
                                <Button variant="secondary" size="sm" onClick={()=>{void votar(articulo.id,false);}}>No</Button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card padding="md">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4 text-primary dark:text-accent"/>
                <h2 className="text-sm font-semibold">Buenas practicas</h2>
              </div>
              <div className="space-y-3">
                {roleContent.tips.map((tip) => (
                  <div key={tip} className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    {tip}
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-border p-3 text-xs text-muted-foreground">
                Al abrir un ticket, incluye el código de cotización (COT-…) o de orden (ORD-…) y el mensaje de error
                completo. Con eso el equipo reproduce el caso sin tener que preguntarte.
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

function UserProfileScreen({sb,profile,onSave,onBack,headerUser}:{sb:SidebarCtrl;profile:{nombre:string;telefono:string;email:string;whatsapp:string;fotoUrl:string};onSave:(payload:{nombre:string;telefono:string;whatsapp:string;foto_url?:string})=>Promise<void>;onBack:()=>void;headerUser:{name:string;company:string;initials:string}}) {
  const [form,setForm]=useState(profile);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    setForm(profile);
  },[profile]);

  async function save(){
    setSaving(true);
    setError("");
    try{
      await onSave({
        nombre:form.nombre,
        telefono:form.telefono,
        whatsapp:form.whatsapp,
        foto_url:form.fotoUrl?.trim()||undefined,
      });
      setSaved(true);
      setTimeout(()=>setSaved(false),3000);
    }catch(err){
      setError(err instanceof Error ? err.message : "No se pudo actualizar el perfil.");
    }finally{
      setSaving(false);
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="dashboard"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={headerUser} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Breadcrumb items={[{label:"Inicio",onClick:onBack},{label:"Editar perfil"}]}/>
              <h1 className="text-xl font-semibold mt-3">Editar perfil</h1>
            </div>
            <Button variant="primary" loading={saving} icon={saved?<CheckCircle2 className="w-4 h-4"/>:<Save className="w-4 h-4"/>} onClick={()=>{void save();}}>{saved?"Guardado":"Guardar cambios"}</Button>
          </div>
          {error&&<Card padding="sm" className="border-destructive/30 bg-red-50"><p className="text-xs text-destructive">{error}</p></Card>}
          {/* Solo aparece para el rol solicitante: el propio componente se
              oculta si el backend no le devuelve codigo. */}
          <div className="max-w-2xl"><TarjetaReferidos/></div>
          <Card padding="md" className="max-w-2xl">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Nombre" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}/>
              <Input label="Teléfono" value={form.telefono} onChange={e=>setForm(p=>({...p,telefono:e.target.value}))}/>
              <Input label="Email" value={form.email} disabled/>
              <Input label="WhatsApp" value={form.whatsapp} onChange={e=>setForm(p=>({...p,whatsapp:e.target.value}))}/>
              <div className="sm:col-span-2">
                <Input label="Foto de perfil" value={form.fotoUrl} onChange={e=>setForm(p=>({...p,fotoUrl:e.target.value}))} placeholder="URL del archivo"/>
                <div className="mt-2 flex gap-2">
                  <DocumentUploadButton
                    label="Subir foto"
                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                    origen="perfil-usuario"
                    onUploaded={(fileItem)=>setForm((prev)=>({...prev,fotoUrl:toApiPath(fileItem.storage_url||`/documentos/archivos/${fileItem.id}/descargar`)}))}
                    onError={(message)=>setError(message)}
                  />
                  {form.fotoUrl&&<Button variant="secondary" size="sm" onClick={()=>{void abrirArchivoEnPestana(form.fotoUrl);}}>Ver foto</Button>}
                </div>
              </div>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────
// `Screen` y la correspondencia con las URL viven en `@/app/rutas`.

export default function App() {
  useBrandTheme();
  const storedRole = normalizeStoredRole(getStoredRole());
  const hasStoredSession = Boolean(getStoredToken() && storedRole);

  const { isAuthenticated, isInitializing, appRole, signOut, token, refreshUser } = useAuth();

  // La dirección manda al entrar: es lo que hace que un enlace a una cotización
  // abra esa cotización, y que recargar no devuelva al inicio. Solo la raíz se
  // resuelve por sesión, porque "/" no identifica ninguna pantalla concreta.
  const destinoInicial = destinoDe(window.location.pathname);
  const [screen,setScreen]=useState<Screen>(() => {
    if (destinoInicial && destinoInicial.screen !== "landing") {
      return destinoInicial.screen;
    }
    return hasStoredSession ? getHomeScreenForRole(storedRole!) : "landing";
  });
  const [loginPrefillEmail,setLoginPrefillEmail]=useState("");
  const [resetToken,setResetToken]=useState<string>(() =>
    new URLSearchParams(window.location.search).get("token") ?? "",
  );
  const [userRole,setUserRole]=useState<UserRole|"admin">(storedRole ?? "solicitante");
  /** Identificador que traía la dirección de entrada, si era de ese tipo. */
  const idInicialDe=(param:ParamRuta)=>destinoInicial?.param===param?(destinoInicial.id ?? ""):"";
  const [selectedQuoteId,setSelectedQuoteId]=useState(()=>idInicialDe("quote"));
  const [selectedResponseId,setSelectedResponseId]=useState(()=>idInicialDe("response"));
  const [responseFrom,setResponseFrom]=useState<ResponseFrom>("responses");
  const [responseFromQuoteId,setResponseFromQuoteId]=useState("");
  const [selectedOrderId,setSelectedOrderId]=useState(()=>idInicialDe("order"));
  const [selectedOrderDetail,setSelectedOrderDetail]=useState<Order|null>(null);
  const [isOrderDetailLoading,setIsOrderDetailLoading]=useState(false);
  const [selectedImporterId,setSelectedImporterId]=useState(()=>idInicialDe("importer"));
  const [preselectedImporterId,setPreselectedImporterId]=useState<string|undefined>();
  const [quotePrefill,setQuotePrefill]=useState<Partial<QuoteFormState>|undefined>();
  // Producto de Tendencias o de un catálogo del que sale la solicitud en curso.
  const [origenSolicitud,setOrigenSolicitud]=useState<OrigenSolicitud|null>(null);
  const [initialChatConvId,setInitialChatConvId]=useState<string|undefined>(
    ()=>idInicialDe("conversation") || undefined,
  );
  const [sidebarPinned,setSidebarPinned]=useState(true);
  const [soporteAbierto,setSoporteAbierto]=useState(false);
  const [notifications,setNotifications]=useState<AppNotification[]>(INIT_NOTIFICATIONS);
  const [hiddenOpenQuotesByCompany,setHiddenOpenQuotesByCompany]=useState<Record<string, string[]>>(() => loadHiddenOpenQuotesByCompany());
  const [quoteStatusOverrides,setQuoteStatusOverrides]=useState<Record<string, Quote["status"]>>(() => loadQuoteStatusOverrides());
  const [availableQuotes,setAvailableQuotes]=useState<Quote[]>([]);
  const [marketplaceImporters,setMarketplaceImporters]=useState<Importer[]>([]);
  const [requesterQuotes,setRequesterQuotes]=useState<Quote[]>([]);
  const [importerQuotes,setImporterQuotes]=useState<Quote[]>([]);
  const [companyAdvisors,setCompanyAdvisors]=useState<CompanyAdvisor[]>([]);
  const [advisorAssignedQuotes,setAdvisorAssignedQuotes]=useState<Quote[]>([]);
  const [advisorProposalsByQuoteId,setAdvisorProposalsByQuoteId]=useState<Record<string, BackendPropuesta>>({});
  // Estimación del chat que se está pasando a propuesta formal.
  const [proposalPrefill,setProposalPrefill]=useState<{quoteId:string;datos:PropuestaDesdeEstimacion}|null>(null);
  // Propuestas de la empresa vistas desde la cuenta dueña: de aquí sale la
  // bandeja de "esperan tu confirmación".
  const [companyProposalsByQuoteId,setCompanyProposalsByQuoteId]=useState<Record<string, BackendPropuesta>>({});
  const [currentUserProfile,setCurrentUserProfile]=useState<BackendUserProfile|null>(null);
  const [companyProfile,setCompanyProfile]=useState<BackendImporter|null>(null);
  const [requesterResponses,setRequesterResponses]=useState<QuoteResponse[]>([]);
  const [requesterOrders,setRequesterOrders]=useState<Order[]>([]);
  const [importerOrders,setImporterOrders]=useState<Order[]>([]);
  const [chatConversations,setChatConversations]=useState<ChatConv[]>([]);
  // Con quién se puede abrir un hilo privado en el canal del equipo.
  const [miembrosEquipo,setMiembrosEquipo]=useState<BackendMiembroEquipo[]>([]);
  // Conversación abierta en pantalla: es la única que necesita canal en vivo.
  const [activeChatId,setActiveChatId]=useState<string|null>(null);
  const { config: platformConfig, isLoading: platformConfigLoading } = usePlatformConfig();
  const moduloEducativoHabilitado = platformConfig.modulo_educativo_habilitado;
  const [chatMessagesByConversation,setChatMessagesByConversation]=useState<Record<string, ChatMsg[]>>({});
  const [chatAttachmentsByConversation,setChatAttachmentsByConversation]=useState<Record<string, BackendChatAttachmentItem[]>>({});
  const [documentExplorer,setDocumentExplorer]=useState<BackendExplorerResponse>({ carpetas: [], archivos: [] });
  const [protectedRootFolders,setProtectedRootFolders]=useState<Array<{id:string;nombre:string}>>([]);
  const [documentCurrentFolderId,setDocumentCurrentFolderId]=useState<string|null>(null);
  const [isDocumentExplorerLoading,setIsDocumentExplorerLoading]=useState(false);
  const documentCurrentFolderRef = useRef<string|null>(null);
  const [prevScreen,setPrevScreen]=useState<Screen>(() =>
    window.location.pathname === RESET_PASSWORD_PATH ? "login" : "dashboard",
  );

  // ── Dirección del navegador ────────────────────────────────────────────────
  // Identificador que la pantalla actual pone en su URL. Solo las de detalle
  // tienen uno; el resto se dirigen con la ruta a secas.
  const idEnLaRuta =
    screen === "quote-detail" || screen === "create-response" ? selectedQuoteId
    : screen === "response-detail" ? selectedResponseId
    : screen === "order-detail" ? selectedOrderId
    : screen === "importer-profile" ? selectedImporterId
    : screen === "chats" ? (activeChatId || initialChatConvId || "")
    : "";

  const rutaActual = rutaDe(screen, idEnLaRuta || undefined);
  // Pantalla con la que se escribió la última vez, para decidir entre apilar una
  // entrada nueva o reemplazarla.
  const ultimaPantallaEscritaRef = useRef<Screen|null>(null);

  useEffect(() => {
    const actual = window.location.pathname.replace(/\/+$/, "") || "/";
    const destino = rutaActual.replace(/\/+$/, "") || "/";
    if (actual === destino) {
      ultimaPantallaEscritaRef.current = screen;
      return;
    }

    // El token de restablecimiento y el código de referido viajan en la query;
    // se conservan mientras se esté en las pantallas que los usan.
    const conservaQuery = screen === "reset-password" || screen === "landing" || screen === "register";
    const url = `${rutaActual}${conservaQuery ? window.location.search : ""}`;

    // Moverse dentro de la misma pantalla (abrir otra conversación del chat) no
    // merece una entrada de historial propia: se reemplaza.
    if (ultimaPantallaEscritaRef.current === screen) {
      window.history.replaceState({}, "", url);
    } else {
      window.history.pushState({}, "", url);
    }
    ultimaPantallaEscritaRef.current = screen;
  }, [rutaActual, screen]);

  useEffect(() => {
    function alNavegarAtrasOAdelante() {
      const destino = destinoDe(window.location.pathname);
      if (!destino) {
        return;
      }
      // Se marca antes de tocar el estado para que el efecto de arriba no
      // vuelva a apilar la entrada que el navegador acaba de consumir.
      ultimaPantallaEscritaRef.current = destino.screen;
      setScreen(destino.screen);

      const id = destino.id ?? "";
      if (destino.param === "quote") setSelectedQuoteId(id);
      if (destino.param === "response") setSelectedResponseId(id);
      if (destino.param === "order") { setSelectedOrderDetail(null); setSelectedOrderId(id); }
      if (destino.param === "importer") setSelectedImporterId(id);
      if (destino.param === "conversation") setInitialChatConvId(id || undefined);
    }

    window.addEventListener("popstate", alNavegarAtrasOAdelante);
    return () => window.removeEventListener("popstate", alNavegarAtrasOAdelante);
  }, []);

  const reloadImporters = useCallback(async () => {
    const rows = await businessService.listImporters();
    setMarketplaceImporters(rows.map(mapBackendImporterToUi));
  }, []);

  const reloadRequesterQuotes = useCallback(async () => {
    const rows = await businessService.listQuotes();
    setRequesterQuotes(
      rows
        .map((row: BackendCotizacion) => mapBackendQuoteToUi(row, marketplaceImporters))
        .map((quote) => applyQuoteStatusOverride(quote, quoteStatusOverrides)),
    );
  }, [marketplaceImporters, quoteStatusOverrides]);

  const reloadImporterQuotes = useCallback(async () => {
    const rows = await businessService.listQuotes();
    setImporterQuotes(
      rows
        .map((row: BackendCotizacion) => mapBackendQuoteToUi(row, marketplaceImporters))
        .map((quote) => applyQuoteStatusOverride(quote, quoteStatusOverrides)),
    );

    // Propuestas de esta empresa, para saber cuáles esperan la confirmación de
    // la cuenta dueña (el cliente ya aceptó y falta cerrar la orden).
    const companyId = currentUserProfile?.importador_id;
    if (!companyId) {
      setCompanyProposalsByQuoteId({});
      return;
    }
    const proposalRows = await Promise.all(
      rows.map(async (row) => {
        try {
          return await businessService.listQuoteProposals(row.id);
        } catch {
          return [] as BackendPropuesta[];
        }
      }),
    );
    const byQuote: Record<string, BackendPropuesta> = {};
    proposalRows.flat().forEach((proposal) => {
      if (proposal.importador_id === companyId) {
        byQuote[proposal.cotizacion_id] = proposal;
      }
    });
    setCompanyProposalsByQuoteId(byQuote);
  }, [marketplaceImporters, quoteStatusOverrides, currentUserProfile?.importador_id]);

  const reloadCompanyAdvisors = useCallback(async () => {
    // `/importadores/asesores` es exclusivo de la cuenta dueña de una empresa.
    if (!currentUserProfile?.importador_id) {
      setCompanyAdvisors([]);
      return;
    }
    const rows = await businessService.listCompanyAdvisors();
    setCompanyAdvisors(rows.map(mapBackendAdvisorToUi));
  }, [currentUserProfile?.importador_id]);

  const reloadCurrentUserProfile = useCallback(async () => {
    const profile = await businessService.getMyUserProfile();
    setCurrentUserProfile(profile);
    if (profile.importador_id) {
      const importer = await businessService.getImporterById(profile.importador_id);
      setCompanyProfile(importer);
    } else {
      setCompanyProfile(null);
    }
  }, []);

  const reloadRequesterResponses = useCallback(async () => {
    const quotes = await businessService.listQuotes();
    const proposalsByQuote = await Promise.all(
      quotes.map(async (quote) => {
        try {
          return await businessService.listQuoteProposals(quote.id);
        } catch {
          return [] as BackendPropuesta[];
        }
      }),
    );
    const all = proposalsByQuote.flat().map(mapBackendProposalToUiResponse);
    setRequesterResponses(all);
  }, []);

  const reloadRequesterOrders = useCallback(async () => {
    const [orders, quotes] = await Promise.all([
      businessService.listOrders(),
      businessService.listQuotes(),
    ]);
    const quoteMap = new Map(quotes.map((q) => [q.id, mapBackendQuoteToUi(q, marketplaceImporters)]));
    setRequesterOrders(orders.map((order) => mapBackendOrderToUiOrder(order, quoteMap.get(order.cotizacion_id))));
  }, [marketplaceImporters]);

  const reloadImporterOrders = useCallback(async () => {
    const [orders, quotes] = await Promise.all([
      businessService.listOrders(),
      businessService.listQuotes(),
    ]);
    const quoteMap = new Map(quotes.map((q) => [q.id, mapBackendQuoteToUi(q, marketplaceImporters)]));
    setImporterOrders(orders.map((order) => mapBackendOrderToUiOrder(order, quoteMap.get(order.cotizacion_id))));
  }, [marketplaceImporters]);

  const loadOrderDetail = useCallback(async (orderId: string) => {
    if (!orderId) {
      setSelectedOrderDetail(null);
      return;
    }

    setIsOrderDetailLoading(true);
    try {
      const [orderRow, quotes] = await Promise.all([
        businessService.getOrderById(orderId),
        businessService.listQuotes().catch(() => [] as BackendCotizacion[]),
      ]);
      const quoteMap = new Map(quotes.map((quote) => [quote.id, mapBackendQuoteToUi(quote, marketplaceImporters)]));
      setSelectedOrderDetail(mapBackendOrderToUiOrder(orderRow, quoteMap.get(orderRow.cotizacion_id)));
    } finally {
      setIsOrderDetailLoading(false);
    }
  }, [marketplaceImporters]);

  const reloadChatData = useCallback(async () => {
    const [rows, quotes] = await Promise.all([
      businessService.listChatConversations(),
      businessService.listQuotes().catch(() => [] as BackendCotizacion[]),
    ]);
    const importerByQuoteId = new Map(quotes.map((quote) => [quote.id, quote.importador_id]));
    const cotizanteTierByQuoteId = new Map(quotes.map((quote) => [quote.id, quote.solicitante_tier || "Bronze"]));
    const importerById = new Map(marketplaceImporters.map((importer) => [importer.id, importer]));
    const mappedConversations: ChatConv[] = rows.map((row) => {
      // Ni el hilo interno, ni el ticket de soporte, ni el canal del equipo de
      // la plataforma cuelgan de una cotización.
      const esInterno = row.tipo === "interna";
      const esSoporte = row.tipo === "soporte";
      const esEquipo = row.tipo === "equipo";
      const importerId = esInterno
        ? (row.importador_id || "")
        : esSoporte || esEquipo
          ? ""
          : (importerByQuoteId.get(row.cotizacion_id || "") || row.importador_usuario_id || "");
      const importer = importerById.get(importerId);
      return {
        id: row.id,
        type: esEquipo ? "equipo" : esSoporte ? "soporte" : esInterno ? "interno" : row.orden_id ? "orden" : "cotizacion",
        refCode: esEquipo
          ? "Plataforma"
          : esSoporte
          ? "Soporte"
          : esInterno
            ? "Equipo"
            : row.orden_id
              ? `ORD-${row.orden_id.slice(0, 8).toUpperCase()}`
              : `COT-${(row.cotizacion_id || "").slice(0, 8).toUpperCase()}`,
        refId: row.orden_id ?? row.cotizacion_id ?? "",
        quoteId: row.cotizacion_id ?? "",
        cotizanteTier: row.cotizacion_id ? cotizanteTierByQuoteId.get(row.cotizacion_id) : undefined,
        counterpartName: row.contraparte_nombre ?? undefined,
        counterpartId: row.contraparte_id ?? undefined,
        counterpartRole: row.contraparte_rol ?? undefined,
        counterpartCompany: row.contraparte_empresa ?? undefined,
        counterpartPhotoUrl: row.contraparte_foto_url ?? undefined,
        subject: row.asunto ?? undefined,
        urgency: row.urgencia ?? undefined,
        requesterRole: row.solicitante_rol ?? undefined,
        closed: row.cerrada ?? false,
        resolution: row.resolucion ?? undefined,
        closedBy: row.cerrada_por_nombre ?? undefined,
        level: row.nivel ?? undefined,
        agentId: row.agente_asignado_id ?? undefined,
        agentName: row.agente_nombre ?? undefined,
        agentLevel: row.agente_nivel ?? undefined,
        rating: row.calificacion ?? undefined,
        ratingComment: row.comentario_calificacion ?? undefined,
        importerId,
        importerName: importer?.name,
        advisorName: importer?.advisor.name,
        advisorRole: importer?.advisor.role,
        advisorEmail: importer?.advisor.email,
        advisorPhone: importer?.advisor.phone,
        advisorInitials: importer?.advisor.initials,
        advisorColor: importer?.advisor.color,
        status: "activa",
        // Lo calcula el backend contra la marca de lectura del usuario; antes
        // estaba escrito a cero y el filtro de no leídas no filtraba nada.
        unread: row.no_leidos ?? 0,
        lastMsg: row.ultimo_mensaje?.contenido || "Sin mensajes",
        lastDate: row.ultimo_mensaje?.fecha_envio ? formatShortDate(row.ultimo_mensaje.fecha_envio) : formatShortDate(row.fecha_creacion),
      };
    });
    setChatConversations(mappedConversations);

    const messagePairs = await Promise.all(
      mappedConversations.map(async (conversation) => {
        const messages = await businessService.listChatMessages(conversation.id);
        const mappedMessages: ChatMsg[] = messages.map((message) => mapBackendChatMessage(message, currentUserProfile?.id));
        return [conversation.id, mappedMessages] as const;
      }),
    );
    setChatMessagesByConversation(Object.fromEntries(messagePairs));

    const attachmentPairs = await Promise.all(
      mappedConversations.map(async (conversation) => {
        try {
          const attachments = await businessService.listChatAttachments(conversation.id);
          return [conversation.id, attachments] as const;
        } catch {
          return [conversation.id, [] as BackendChatAttachmentItem[]] as const;
        }
      }),
    );
    setChatAttachmentsByConversation(Object.fromEntries(attachmentPairs));
  }, [currentUserProfile?.id, marketplaceImporters]);

  const ensureSystemRootFolders = useCallback(async () => {
    let rootExplorer = await businessService.listDocumentExplorer(null);
    const backendProtectedRoots = rootExplorer.carpetas.filter((folder) => folder.is_protected || folder.is_system);
    const existingRootNames = new Set(rootExplorer.carpetas.map((folder) => normalizeFolderName(folder.nombre)));
    const missingRootNames = backendProtectedRoots.length > 0
      ? []
      : SYSTEM_ROOT_FOLDER_NAMES.filter((name) => !existingRootNames.has(normalizeFolderName(name)));

    if (missingRootNames.length > 0) {
      await Promise.all(
        missingRootNames.map(async (name) => {
          try {
            await businessService.createDocumentFolder({ nombre: name, parent_id: null });
          } catch {
            // Folder may be created concurrently by another session.
          }
        }),
      );
      rootExplorer = await businessService.listDocumentExplorer(null);
    }

    const protectedSet = backendProtectedRoots.length > 0
      ? new Set(backendProtectedRoots.map((folder) => normalizeFolderName(folder.nombre)))
      : new Set(SYSTEM_ROOT_FOLDER_NAMES.map((name) => normalizeFolderName(name)));
    const bySystemFolderName = new Map<string, { id: string; nombre: string }>();
    rootExplorer.carpetas.forEach((folder) => {
      const normalized = normalizeFolderName(folder.nombre);
      if (!protectedSet.has(normalized)) {
        return;
      }
      if (!bySystemFolderName.has(normalized)) {
        bySystemFolderName.set(normalized, { id: folder.id, nombre: folder.nombre });
      }
    });

    setProtectedRootFolders(Array.from(bySystemFolderName.values()));

    rootExplorer = {
      ...rootExplorer,
      carpetas: rootExplorer.carpetas.filter((folder) => {
        const normalized = normalizeFolderName(folder.nombre);
        if (!protectedSet.has(normalized)) {
          return true;
        }
        return bySystemFolderName.get(normalized)?.id === folder.id;
      }),
    };

    return rootExplorer;
  }, []);

  const reloadDocumentExplorer = useCallback(async (parentId?: string | null) => {
    const resolvedParent = typeof parentId === "undefined" ? documentCurrentFolderRef.current : parentId;
    setIsDocumentExplorerLoading(true);
    try {
      const explorer = resolvedParent === null
        ? await ensureSystemRootFolders()
        : await businessService.listDocumentExplorer(resolvedParent);
      documentCurrentFolderRef.current = resolvedParent ?? null;
      setDocumentCurrentFolderId(resolvedParent ?? null);
      setDocumentExplorer(explorer);
      return explorer;
    } finally {
      setIsDocumentExplorerLoading(false);
    }
  }, [ensureSystemRootFolders]);

  const reloadAdvisorAssignedQuotes = useCallback(async () => {
    // `/asesores/me/cotizaciones` exige rol importador o asesor. Sin empresa
    // asociada no hay nada que pedir y la llamada solo produce un 403 que
    // acababa mostrandose como "Rol insuficiente" al crear una cotizacion.
    if (!currentUserProfile?.importador_id) {
      setAdvisorAssignedQuotes([]);
      return;
    }
    const rows = await businessService.listMyAssignedQuotes();
    const detailedRows = await Promise.all(
      rows.map(async (row) => {
        try {
          return await businessService.getQuoteById(row.id);
        } catch {
          return {
            id: row.id,
            solicitante_id: row.solicitante_id,
            importador_id: null,
            modalidad: row.modalidad,
            foto_producto: null,
            pais_importacion: "N/A",
            nivel_personalizacion: null,
            nombre_producto: row.nombre_producto,
            descripcion_cliente: row.descripcion_cliente,
            link_referencia: null,
            linea_producto: "General",
            tipo_calidad: "estandar",
            modalidad_importacion: null,
            cantidad_minima: row.cantidad_minima,
            precio_objetivo_usd: row.precio_objetivo_usd,
            incoterm: row.incoterm,
            notas_adicionales: null,
            campos_personalizados_valores: null,
            asesor_asignado_id: row.asesor_asignado_id,
            estado: row.estado,
            fecha_creacion: row.fecha_creacion,
            fecha_actualizacion: row.fecha_creacion,
          } satisfies BackendCotizacion;
        }
      }),
    );

    setAdvisorAssignedQuotes(
      detailedRows
        .map((row) => mapBackendQuoteToUi(row, marketplaceImporters))
        .map((quote) => applyQuoteStatusOverride(quote, quoteStatusOverrides)),
    );
  }, [marketplaceImporters, quoteStatusOverrides]);

  const reloadAdvisorAvailableQuotes = useCallback(async () => {
    // `/cotizaciones/pool-empresa` tambien es exclusivo de las cuentas de empresa.
    if (!currentUserProfile?.importador_id) {
      setAvailableQuotes([]);
      return;
    }
    const rows = await businessService.listAdvisorAvailableQuotes();
    setAvailableQuotes(
      rows
        .map((row) => mapBackendQuoteToUi(row, marketplaceImporters))
        .map((quote) => applyQuoteStatusOverride(quote, quoteStatusOverrides)),
    );
  }, [marketplaceImporters, quoteStatusOverrides, currentUserProfile?.importador_id]);

  /**
   * Índice "cotización → propuesta de mi empresa" (incluye borradores).
   *
   * Lo usa tanto el asesor como la cuenta dueña: sin él, la empresa no sabía
   * que un asesor ya había redactado un borrador, pulsaba "Responder" y el
   * backend la rechazaba con un 400. Por eso se recorren también las
   * cotizaciones de la bandeja de la empresa, no solo las del asesor.
   */
  const reloadAdvisorProposalIndex = useCallback(async () => {
    if (!currentUserProfile?.importador_id) {
      setAdvisorProposalsByQuoteId({});
      return;
    }

    const quoteIds = Array.from(
      new Set([...advisorAssignedQuotes, ...availableQuotes, ...importerQuotes].map((quote) => quote.id)),
    );
    if (quoteIds.length === 0) {
      setAdvisorProposalsByQuoteId({});
      return;
    }

    const proposalRows = await Promise.all(
      quoteIds.map(async (quoteId) => {
        try {
          return await businessService.listQuoteProposals(quoteId);
        } catch {
          return [] as BackendPropuesta[];
        }
      }),
    );

    const proposalByQuote: Record<string, BackendPropuesta> = {};
    proposalRows.forEach((rows) => {
      rows.forEach((proposal) => {
        if (proposal.importador_id === currentUserProfile.importador_id) {
          proposalByQuote[proposal.cotizacion_id] = proposal;
        }
      });
    });

    setAdvisorProposalsByQuoteId(proposalByQuote);
  }, [advisorAssignedQuotes, availableQuotes, importerQuotes, currentUserProfile?.importador_id]);

  const reloadNotifications = useCallback(async () => {
    try {
      const response = await businessService.listNotifications();
      const companies = new Map(marketplaceImporters.map((company) => [company.id, company.name]));
      setNotifications(response.items.map((notification) => {
        const importadorId = typeof notification.data?.importador_id === "string" ? notification.data.importador_id : "";
        return mapBackendNotificationToUi(notification, companies.get(importadorId));
      }));
    } catch {
      setNotifications([]);
    }
  }, [marketplaceImporters]);

  useEffect(() => {
    if (window.location.pathname !== RESET_PASSWORD_PATH) {
      return;
    }

    setScreen("reset-password");
    setResetToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  useEffect(() => {
    if (!appRole) {
      return;
    }
    setUserRole(appRole);
  }, [appRole]);

  useEffect(() => {
    if (isInitializing || isAuthenticated) {
      return;
    }
    const publicScreens: Screen[] = ["landing", "login", "register", "reset-password", "policy-data", "policy-terms", "policy-payments"];
    if (!publicScreens.includes(screen)) {
      setScreen("login");
    }
  }, [isAuthenticated, isInitializing, screen]);

  useEffect(() => {
    if (isInitializing || !isAuthenticated || !appRole) {
      return;
    }

    const publicOrEntryScreens: Screen[] = [
      "landing",
      "login",
      "register",
      "reset-password",
    ];

    if (publicOrEntryScreens.includes(screen)) {
      setScreen(getHomeScreenForRole(appRole));
    }
  }, [isInitializing, isAuthenticated, appRole, screen]);

  useEffect(() => {
    if (!isAuthenticated || !token || isInitializing) {
      return;
    }
    void reloadImporters();
  }, [isAuthenticated, token, isInitializing, reloadImporters]);

  useEffect(() => {
    if (isInitializing || isAuthenticated || marketplaceImporters.length > 0) {
      return;
    }

    const publicScreens: Screen[] = ["landing", "login", "register"];
    if (!publicScreens.includes(screen)) {
      return;
    }

    void reloadImporters().catch(() => {
      setMarketplaceImporters([]);
    });
  }, [isInitializing, isAuthenticated, marketplaceImporters.length, screen, reloadImporters]);

  useEffect(() => {
    if (!isAuthenticated || !token || isInitializing) {
      return;
    }
    void reloadCurrentUserProfile();
    void reloadChatData();
    void reloadDocumentExplorer();
  }, [isAuthenticated, token, isInitializing, reloadCurrentUserProfile, reloadChatData, reloadDocumentExplorer]);

  useEffect(() => {
    if (!isAuthenticated || !token || isInitializing) {
      return;
    }

    if (userRole === "solicitante") {
      void reloadRequesterQuotes();
      void reloadRequesterResponses();
      void reloadRequesterOrders();
      return;
    }

    if (userRole === "importadora") {
      void reloadImporterQuotes();
      void reloadCompanyAdvisors();
      void reloadImporterOrders();
      return;
    }

    if (userRole === "asesor") {
      void reloadAdvisorAssignedQuotes();
      void reloadAdvisorAvailableQuotes();
    }
  }, [
    isAuthenticated,
    token,
    isInitializing,
    userRole,
    reloadRequesterQuotes,
    reloadRequesterResponses,
    reloadRequesterOrders,
    reloadImporterQuotes,
    reloadCompanyAdvisors,
    reloadImporterOrders,
    reloadAdvisorAssignedQuotes,
    reloadAdvisorAvailableQuotes,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !token || isInitializing) {
      return;
    }
    if (userRole !== "asesor" && userRole !== "importadora") {
      return;
    }
    void reloadAdvisorProposalIndex();
  }, [isAuthenticated, token, isInitializing, userRole, reloadAdvisorProposalIndex]);

  useEffect(() => {
    if (!isAuthenticated || !token || isInitializing || screen !== "order-detail" || !selectedOrderId) {
      return;
    }
    void loadOrderDetail(selectedOrderId);
  }, [isAuthenticated, token, isInitializing, screen, selectedOrderId, loadOrderDetail]);

  useEffect(() => {
    if (!isAuthenticated || !token || isInitializing) {
      return;
    }
    void reloadNotifications();
  }, [
    isAuthenticated,
    token,
    isInitializing,
    userRole,
    advisorAssignedQuotes,
    availableQuotes,
    importerQuotes,
    requesterQuotes,
    requesterOrders,
    reloadNotifications,
  ]);

  /**
   * Recarga todo lo que le corresponde ver al rol actual. Es lo que dispara
   * `useAutoRefresh` al volver a la pestaña y cada pocos segundos, para que la
   * pantalla deje de depender de un F5 manual.
   */
  const refreshAllData = useCallback(async (reason: AutoRefreshReason = "focus") => {
    const tareas: Array<Promise<unknown>> = [
      reloadImporters(),
      reloadCurrentUserProfile(),
      reloadNotifications(),
    ];

    // El chat cuesta 2 peticiones por conversación, así que en el tick periódico
    // se omite: la conversación abierta ya llega en vivo por WebSocket y el
    // resto se refresca al volver a la pestaña.
    if (reason === "focus") {
      tareas.push(reloadChatData());
    }

    if (userRole === "solicitante") {
      tareas.push(reloadRequesterQuotes(), reloadRequesterResponses(), reloadRequesterOrders());
    } else if (userRole === "importadora") {
      tareas.push(reloadImporterQuotes(), reloadCompanyAdvisors(), reloadImporterOrders(), reloadAdvisorProposalIndex());
    } else if (userRole === "asesor") {
      tareas.push(reloadAdvisorAssignedQuotes(), reloadAdvisorAvailableQuotes(), reloadAdvisorProposalIndex());
    }

    // `allSettled`: que falle una lista no debe impedir refrescar las demás.
    await Promise.allSettled(tareas);
  }, [
    userRole,
    reloadImporters,
    reloadCurrentUserProfile,
    reloadChatData,
    reloadNotifications,
    reloadRequesterQuotes,
    reloadRequesterResponses,
    reloadRequesterOrders,
    reloadImporterQuotes,
    reloadCompanyAdvisors,
    reloadImporterOrders,
    reloadAdvisorAssignedQuotes,
    reloadAdvisorAvailableQuotes,
    reloadAdvisorProposalIndex,
  ]);

  useAutoRefresh(refreshAllData, {
    enabled: Boolean(isAuthenticated && token && !isInitializing),
  });

  // Mensajes en vivo de la conversación abierta: el backend ya publicaba en
  // `/ws/chat/{id}`, pero nadie estaba escuchando.
  const handleIncomingChatMessage = useCallback(() => {
    void reloadChatData();
  }, [reloadChatData]);

  useChatSocket(
    activeChatId,
    handleIncomingChatMessage,
    Boolean(isAuthenticated && token && !isInitializing),
  );

  const advisorHeaderUser = {
    name: currentUserProfile?.nombre?.trim() || currentUserProfile?.email || USER_ASESOR.name,
    company: companyProfile?.nombre_empresa
      ? `${companyProfile.nombre_empresa} (Empresa Importadora Madre)`
      : USER_ASESOR.company,
    initials: initialsFromName(currentUserProfile?.nombre?.trim() || currentUserProfile?.email || USER_ASESOR.name),
    photoUrl: currentUserProfile?.foto_url || undefined,
  };

  const importerHeaderUser = {
    name: currentUserProfile?.nombre?.trim() || currentUserProfile?.email || USER_IMPORTADORA.name,
    company: companyProfile?.nombre_empresa || USER_IMPORTADORA.company,
    initials: initialsFromName(currentUserProfile?.nombre?.trim() || currentUserProfile?.email || USER_IMPORTADORA.name),
    photoUrl: currentUserProfile?.foto_url || undefined,
  };

  const companyIdForAdvisor = currentUserProfile?.importador_id || "unknown-company";
  const hiddenOpenQuoteIds = new Set(hiddenOpenQuotesByCompany[companyIdForAdvisor] || []);
  const visibleAvailableQuotes = availableQuotes.filter((quote) => {
    if (quote.mode === "Abierta" && hiddenOpenQuoteIds.has(quote.id)) {
      return false;
    }
    if (quoteStatusOverrides[quote.id] === "rejected-importer") {
      return false;
    }
    return true;
  });

  const unreadCount=notifications.filter(n=>!n.read).length;
  const chatUnreadCount=Math.max(
    notifications.filter((n)=>!n.read&&n.type==="message").length,
    chatConversations.reduce((acc,conversation)=>acc+(conversation.unread||0),0),
  );
  const activeChatCount = chatConversations.filter((conversation)=>conversation.status==="activa").length;
  const headerSubtitle = resolveHeaderSubtitle({
    role: userRole,
    importerCompanyName: companyProfile?.nombre_empresa,
    importerFallbackCompany: importerHeaderUser.company,
    advisorFallbackCompany: "Empresa asignada",
  });

  function goTo(s:Screen){setPrevScreen(screen);setScreen(s);}

  // La estimación solo prellena la propuesta a la que se llegó desde el chat;
  // abrir después "Responder" por otro camino debe partir de cero.
  useEffect(()=>{
    if(screen!=="create-response")setProposalPrefill(null);
  },[screen]);

  function handleConvertEstimateToProposal(quoteId:string,estimate:EstimacionEnMensaje){
    setProposalPrefill({quoteId,datos:propuestaDesdeEstimacion(estimate)});
    setSelectedQuoteId(quoteId);
    goTo("create-response");
  }

  function handleNav(key:string){
    // La clave de cada entrada del menú ES el nombre de la pantalla, así que se
    // valida contra la tabla de rutas. Antes había aquí una segunda lista
    // escrita a mano y cualquier entrada nueva del sidebar nacía muerta: el
    // botón existía pero no navegaba a ninguna parte.
    if(key==="courses"&&!moduloEducativoHabilitado)return;
    if(esPantalla(key))goTo(key);
  }

  function getNavItems():NavItem[]{
    const base = userRole==="admin" ? NAV_ADMIN
      : userRole==="soporte" ? NAV_SOPORTE
      : userRole==="importadora" ? NAV_IMPORTADORA
      : userRole==="asesor" ? NAV_ASESOR
      : NAV_ITEMS;
    // Con el módulo educativo apagado en el backend, "Cursos" desaparece del
    // menú: dejarlo visible llevaría a una pantalla cuya API responde 404.
    let items = moduloEducativoHabilitado ? base : base.filter(item=>item.key!=="courses");
    // El curador de Tendencias es una capacidad, no un rol: se le suma la
    // entrada del panel a su menú, sea soporte, asesor o cualquier otro.
    if(currentUserProfile?.es_curador&&!items.some(item=>item.key==="curaduria")){
      items=[...items,{icon:Sparkles,label:"Curaduría",key:"curaduria"}];
    }
    return items as NavItem[];
  }

  function handleProfileClick(){
    if(userRole==="importadora"){
      goTo("imp-profile");
      return;
    }
    if(userRole==="solicitante"||userRole==="asesor"){
      goTo("user-profile");
      return;
    }
  }

  function handleHelpClick(){
    if(userRole==="admin"){
      return;
    }
    goTo("help-support");
  }

  /**
   * Abre (o reutiliza) la sala común del equipo y lleva a SU pantalla.
   *
   * Es la vía que sustituye al ticket para administración y soporte: el ticket
   * es el canal de los usuarios CON la plataforma, y un agente atendiéndose a
   * sí mismo no significa nada.
   *
   * Tiene pantalla propia (`/equipo`) y no la bandeja de `/chats`: ahí están
   * los tickets de clientes y empresas, y mezclar las dos cosas es justo lo que
   * no debe pasar en un canal interno.
   */
  async function abrirCanalEquipo(){
    try{
      const canal=await businessService.openTeamChannel();
      await reloadChatData();
      setInitialChatConvId(canal.id);
      goTo("team-channel");
    }catch(error){
      const mensaje=error instanceof Error?error.message:"No se pudo abrir el canal del equipo";
      toast.error(mensaje);
    }
  }

  /** Abre el hilo privado con una persona del equipo, dentro de la misma pantalla. */
  async function abrirHiloEquipo(miembroId:string){
    try{
      const hilo=await businessService.openTeamChannel(miembroId);
      await reloadChatData();
      setInitialChatConvId(hilo.id);
      goTo("team-channel");
    }catch(error){
      const mensaje=error instanceof Error?error.message:"No se pudo abrir el hilo";
      toast.error(mensaje);
    }
  }

  const sb:SidebarCtrl={
    active:screen,
    onNav:handleNav,
    pinned:sidebarPinned,
    onToggle:()=>setSidebarPinned(p=>!p),
    navItems:getNavItems(),
    onNotif:()=>goTo("notifications"),
    notifCount:unreadCount,
    onChat:()=>goTo("chats"),
    chatCount:chatUnreadCount,
    onHelp:handleHelpClick,
    showHelp:userRole!=="admin",
    // El equipo de la plataforma no se pide soporte a sí mismo: el ticket es el
    // canal de los usuarios con la plataforma. Antes el botón seguía saliendo
    // para soporte, y al pulsarlo el backend respondía 403.
    onSoporte:()=>setSoporteAbierto(true),
    showSoporte:userRole!=="admin"&&userRole!=="soporte",
    onCanalEquipo:()=>{void abrirCanalEquipo();},
    showCanalEquipo:userRole==="admin"||userRole==="soporte",
    profileSubtitle:headerSubtitle,
    profilePhotoUrl:currentUserProfile?.foto_url || null,
    onLogout:()=>{void handleLogout();},
    onProfile:handleProfileClick,
  };

  function openResponse(id:string,from:ResponseFrom,fromQuoteId?:string){
    setSelectedResponseId(id);setResponseFrom(from);setResponseFromQuoteId(fromQuoteId||"");goTo("response-detail");
  }
  // El canal interno de la plataforma va en su propia pantalla: en `/chats`
  // están los tickets de clientes y empresas, y no deben mezclarse.
  // Los miembros del equipo solo se piden con una sesión interna: para
  // cualquier otro rol el endpoint responde 403, y pedirlo sería ruido.
  useEffect(()=>{
    if(userRole!=="admin"&&userRole!=="soporte"){
      setMiembrosEquipo([]);
      return;
    }
    let cancelado=false;
    void (async()=>{
      try{
        const filas=await businessService.listTeamMembers();
        if(!cancelado) setMiembrosEquipo(filas);
      }catch{
        // Sin la lista solo se pierde el selector de hilos privados; la sala
        // común sigue funcionando, así que no se molesta al usuario.
        if(!cancelado) setMiembrosEquipo([]);
      }
    })();
    return ()=>{cancelado=true;};
  },[userRole]);

  const conversacionesDelEquipo = chatConversations.filter((c)=>c.type==="equipo");
  const conversacionesDeChats = chatConversations.filter((c)=>c.type!=="equipo");

  function openChat(convId:string){setInitialChatConvId(convId);goTo("chats");}

  async function handleCloseTicket(conversationId: string, resolucion: string) {
    await businessService.closeSupportTicket(conversationId, resolucion);
    await reloadChatData();
  }

  async function handleReopenTicket(conversationId: string) {
    await businessService.reopenSupportTicket(conversationId);
    await reloadChatData();
  }

  async function handleEscalateTicket(conversationId: string, nivel: number) {
    await businessService.escalateSupportTicket(conversationId, nivel);
    await reloadChatData();
  }

  async function handleRateTicket(conversationId: string, calificacion: number, comentario?: string) {
    await businessService.rateSupportTicket(conversationId, calificacion, comentario);
    await reloadChatData();
  }

  /** Abre el ticket y lleva directo a su chat, que es donde sigue la conversación. */
  async function handleOpenSupportTicket(datos:{asunto:string;urgencia:UrgenciaSoporte;mensaje:string}){
    const ticket = await businessService.openSupportTicket({
      asunto: datos.asunto,
      urgencia: datos.urgencia,
      mensaje: datos.mensaje || undefined,
    });
    setSoporteAbierto(false);
    await reloadChatData();
    openChat(ticket.id);
  }

  /**
   * Conversación abierta en pantalla. Abrirla es leerla: se marca en el backend
   * y se pone el contador a cero aquí mismo para que el badge no siga en rojo
   * hasta la siguiente recarga.
   */
  function handleActiveConversationChange(convId: string | null) {
    setActiveChatId(convId);
    if (!convId) {
      return;
    }
    setChatConversations((prev) =>
      prev.some((c) => c.id === convId && c.unread > 0)
        ? prev.map((c) => (c.id === convId ? { ...c, unread: 0 } : c))
        : prev,
    );
    void businessService.markConversationRead(convId).catch(() => undefined);
  }

  /**
   * Abre el canal interno con un asesor y lleva al chat ya posicionado en él.
   * El backend reutiliza el hilo si ya existía, así que llamarlo varias veces
   * no crea conversaciones nuevas.
   */
  async function openInternalChat(advisorId?:string){
    const conversation = await businessService.startInternalChat(advisorId);
    await reloadChatData();
    openChat(conversation.id);
  }
  function openNewQuote(importerId?:string){setQuotePrefill(undefined);setOrigenSolicitud(null);setPreselectedImporterId(importerId);goTo("new-quote");}

  /**
   * «Pedir propuestas» desde Tendencias o desde el catálogo de una empresa:
   * abre el asistente de solicitud con el producto ya cargado. Desde un
   * catálogo la solicitud va dirigida a la empresa dueña.
   */
  function pedirPropuestasDesde(p:PrefillSolicitud){
    setQuotePrefill({
      productName:p.nombre,
      description:p.descripcion,
      productPhotoUrls:p.fotos.slice(0,MAX_FOTOS_PRODUCTO),
      country:p.pais||"",
      productLine:p.lineaProducto||"",
      ...(p.cantidadMinima?{minQuantity:String(p.cantidadMinima)}:{}),
      ...(p.unidad?{unit:p.unidad}:{}),
    });
    setOrigenSolicitud({
      origen:p.origen,
      nombre:p.nombre,
      revisarRequisitos:Boolean(p.revisarRequisitos),
      tendenciaEdicionId:p.tendenciaEdicionId??null,
      tendenciaProductoId:p.tendenciaProductoId,
      catalogoProductoId:p.catalogoProductoId,
    });
    setPreselectedImporterId(p.importadorId);
    goTo("new-quote");
  }

  /**
   * Duplicar una cotización: se abre el formulario con sus datos copiados.
   * No hay endpoint de duplicado en el backend ni hace falta — lo que se
   * envía después es una cotización nueva y corriente.
   */
  function duplicateQuote(quote:Quote){
    setOrigenSolicitud(null);
    const extractedCurrency = parseTargetPriceCurrency(quote.targetPriceCurrency || "USD");
    setQuotePrefill({
      productName:quote.product||"",
      description:quote.description||"",
      referenceLink:quote.referenceLink||"",
      productPhotoUrls:quote.productPhotoUrls??[],
      country:quote.country||"",
      productLine:quote.productLine||"",
      quality:quote.quality||"",
      customization:quote.personalizationLevel||"",
      minQuantity:quote.minQuantity||"",
      unit:quote.unit??"unidades",
      targetPrice:quote.targetPrice ? quote.targetPrice.replace(new RegExp(`\\s*${extractedCurrency}$`, "i"), "").trim() : "",
      targetPriceCurrency: extractedCurrency,
      incoterm:quote.incoterm||"DDP",
      notes:quote.notes||"",
      shippingMarkSufijo:quote.shippingMarkSufijo||"",
    });
    setPreselectedImporterId(quote.importadorId||undefined);
    goTo("new-quote");
  }
  function markNotif(id:string){
    setNotifications(prev=>prev.map(n=>n.id===id?{...n,read:true}:n));
    void businessService.markNotificationAsRead(id).catch(() => undefined);
  }
  async function openNotification(notification: AppNotification){
    if (notification.destino) {
      goTo(notification.destino);
      return;
    }
    if (!notification.cotizacionId && !notification.conversationId) return;
    const conversations = await businessService.listChatConversations().catch(() => []);
    const conversation = notification.conversationId
      ? conversations.find((item) => item.id === notification.conversationId)
      : conversations.find((item) => item.cotizacion_id === notification.cotizacionId);
    if (conversation) {
      openChat(conversation.id);
      return;
    }
    goTo("chats");
  }
  async function claimQuote(id:string){
    await businessService.claimAdvisorQuote(id);
    const [, , conversations] = await Promise.all([
      reloadAdvisorAvailableQuotes(),
      reloadAdvisorAssignedQuotes(),
      businessService.listChatConversations(),
    ]);
    await reloadChatData();
    const conversation = conversations.find((item) => item.cotizacion_id === id);
    if (conversation) {
      openChat(conversation.id);
      return;
    }
    goTo("chats");
  }

  async function discardAdvisorQuote(quote: Quote){
    const companyId = currentUserProfile?.importador_id || "unknown-company";
    if (quote.mode === "Abierta") {
      const current = hiddenOpenQuotesByCompany[companyId] || [];
      const nextByCompany = {
        ...hiddenOpenQuotesByCompany,
        [companyId]: Array.from(new Set([...current, quote.id])),
      };
      setHiddenOpenQuotesByCompany(nextByCompany);
      saveHiddenOpenQuotesByCompany(nextByCompany);
      return;
    }

    const nextOverrides = {
      ...quoteStatusOverrides,
      [quote.id]: "rejected-importer" as Quote["status"],
    };
    setQuoteStatusOverrides(nextOverrides);
    saveQuoteStatusOverrides(nextOverrides);

    await refreshQuoteLists();
  }

  function handleLogin(role:UserRole|"admin"){
    setUserRole(role);
    goTo(getHomeScreenForRole(role));
  }

  async function handleLogout(){
    await signOut();
    setUserRole("solicitante");
    setScreen("login");
  }

  async function handleCreateQuote(payload: CreateCotizacionPayload, desbloquear = false){
    // La cotizacion se crea primero y sola: si esto falla, el error es real y el
    // formulario tiene que mostrarlo.
    const creditosActuales = Number(currentUserProfile?.puntos_cotizacion ?? 0);
    if (desbloquear && creditosActuales < 1) {
      throw new Error("No tienes créditos suficientes para desbloquear esta cotización.");
    }
    const created = await businessService.createQuote(payload);
    if (desbloquear) {
      // El servidor ya descontó el punto al crearla; esto solo cubre cotizaciones
      // que sigan bloqueadas y no vuelve a cobrar.
      await businessService.unlockQuoteByPoint(created.id);
    }

    // El refresco posterior es cortesia, no parte de la operacion. Encadenado con
    // `await`, el 403 de una lista ajena al rol (las del asesor, p. ej.) subia
    // hasta el formulario y se leia como "No autorizado - Rol insuficiente",
    // haciendo creer que la cotizacion habia fallado cuando ya estaba creada.
    await Promise.allSettled([
      reloadRequesterQuotes(),
      reloadRequesterResponses(),
      reloadRequesterOrders(),
      reloadImporterQuotes(),
      reloadAdvisorAssignedQuotes(),
      refrescarSaldoYTier(),
    ]);
  }

  /** El servidor decide el saldo de puntos (desbloqueos) y el tier (recálculo
   * por umbrales): tras crear o desbloquear se relee en vez de restar a mano. */
  async function refrescarSaldoYTier(){
    await Promise.allSettled([reloadCurrentUserProfile(), refreshUser()]);
  }

  async function handleCreateAdvisor(payload: CreateAsesorPayload): Promise<CompanyAdvisor>{
    const created = await businessService.createCompanyAdvisor(payload);
    await reloadCompanyAdvisors();
    return mapBackendAdvisorToUi(created);
  }

  async function handleSetAdvisorActive(advisorId: string, activo: boolean): Promise<string> {
    const resultado = await businessService.updateCompanyAdvisorStatus(advisorId, activo);
    // Al desactivar, el backend traspasa su trabajo a la cuenta dueña; conviene
    // decírselo al usuario en vez de dejarlo adivinar dónde quedaron los chats.
    await Promise.all([reloadCompanyAdvisors(), reloadChatData(), reloadImporterQuotes()]);

    const movidos = resultado.cotizaciones_reasignadas + resultado.conversaciones_reasignadas;
    if (!activo && movidos > 0) {
      return `Asesor desactivado. Se traspasaron a tu cuenta ${resultado.cotizaciones_reasignadas} cotización(es) y ${resultado.conversaciones_reasignadas} conversación(es).`;
    }
    return activo ? "Asesor activado." : "Asesor desactivado.";
  }

  async function handleSaveCompanyProfile(payload:{nombre_empresa:string;logo_url?:string;especialidad_producto:string[];paises_origen:string[];tiempo_respuesta_promedio:string;capacidad_volumen?:number;perfil_publico?:Record<string, unknown>;solo_cotizaciones_directas?:boolean;shipping_mark_prefijo?:string;limite_cotizaciones_diarias?:number|null;pedido_minimo?:number|null;pedido_minimo_unidad?:UnidadCantidad;}) {
    if (!currentUserProfile?.importador_id) {
      throw new Error("Tu usuario no tiene importador asociado.");
    }
    await businessService.updateImporterById(currentUserProfile.importador_id, payload);
    await reloadCurrentUserProfile();
    await reloadImporters();
  }

  async function handleSaveUserProfile(payload:{nombre:string;telefono:string;whatsapp:string;foto_url?:string}) {
    await businessService.updateMyUserProfile(payload);
    await reloadCurrentUserProfile();
  }

  async function handleSendChatMessage(conversationId: string, contenido: string, metadata?: Record<string, unknown>) {
    await businessService.sendChatMessage(conversationId, { contenido, tipo: "texto", metadata: metadata ?? null });
    const messages = await businessService.listChatMessages(conversationId);
    setChatMessagesByConversation((prev) => ({
      ...prev,
      [conversationId]: messages.map((message) => mapBackendChatMessage(message, currentUserProfile?.id)),
    }));
    await reloadChatData();
  }

  async function handleSendPriceEstimate(conversationId: string, entrada: EstimacionPrecioEntrada) {
    await businessService.sendPriceEstimate(conversationId, entrada);
    // El refresco es cortesía: la estimación ya está enviada aunque falle.
    await reloadChatData().catch(() => undefined);
  }

  async function handleShareLocalAttachment(conversationId: string, file: File) {
    const created = await businessService.uploadDocumentFile(file, null, "chat");

    await businessService.shareDocumentsToChat({
      conversacion_ids: [conversationId],
      archivo_ids: [created.id],
      mensaje: `Adjunto: ${file.name}`,
    });

    await Promise.all([reloadChatData(), reloadDocumentExplorer(documentCurrentFolderRef.current)]);
  }

  async function handleShareExistingResource(conversationIds: string[], fileId: string, message?: string) {
    await businessService.shareDocumentsToChat({
      conversacion_ids: conversationIds,
      archivo_ids: [fileId],
      mensaje: message,
    });
    await reloadChatData();
  }

  async function handleCreateDocumentFolder(name: string, parentId: string | null) {
    await businessService.createDocumentFolder({ nombre: name, parent_id: parentId });
    await reloadDocumentExplorer(parentId);
  }

  async function handleRegisterLocalDocument(file: File, parentId: string | null) {
    await businessService.uploadDocumentFile(file, parentId, "manual");
    await reloadDocumentExplorer(parentId);
  }

  async function handleMoveDocumentFile(fileId: string, targetFolderId: string | null) {
    await businessService.updateDocumentFile(fileId, { carpeta_id: targetFolderId });
    await reloadDocumentExplorer(documentCurrentFolderRef.current);
  }

  async function handleMoveDocumentFolder(folderId: string, targetParentId: string | null) {
    await businessService.updateDocumentFolder(folderId, { parent_id: targetParentId });
    await reloadDocumentExplorer(documentCurrentFolderRef.current);
  }

  async function handleRenameDocumentFile(fileId: string, newName: string) {
    await businessService.updateDocumentFile(fileId, { nombre: newName });
    await reloadDocumentExplorer(documentCurrentFolderRef.current);
  }

  async function handleRenameDocumentFolder(folderId: string, newName: string) {
    await businessService.updateDocumentFolder(folderId, { nombre: newName });
    await reloadDocumentExplorer(documentCurrentFolderRef.current);
  }

  async function handleDeleteDocumentFile(fileId: string) {
    await businessService.deleteDocumentFile(fileId);
    await reloadDocumentExplorer(documentCurrentFolderRef.current);
  }

  async function handleDeleteDocumentFolder(folderId: string) {
    await businessService.deleteDocumentFolder(folderId);
    await reloadDocumentExplorer(documentCurrentFolderRef.current);
  }

  /**
   * Transfiere la conversación a otro asesor de la empresa.
   *
   * Antes esto solo escribía un mensaje de texto ("transferencia solicitada")
   * y nada cambiaba de verdad. Ahora reasigna el responsable de la cotización
   * en el backend, que mueve también la conversación y deja constancia con un
   * mensaje de sistema.
   */
  async function handleTransferConversation(conversationId: string, newAdvisorEmail: string) {
    const conversation = chatConversations.find((item) => item.id === conversationId);
    if (!conversation?.quoteId) {
      throw new Error("No se encontró la cotización asociada a esta conversación.");
    }

    const correo = newAdvisorEmail.trim().toLowerCase();
    const advisor = companyAdvisors.find((item) => item.email.trim().toLowerCase() === correo);
    if (!advisor) {
      throw new Error(`${newAdvisorEmail} no es un asesor activo de tu empresa.`);
    }

    await businessService.assignAdvisorToQuote(conversation.quoteId, advisor.id);
    await Promise.all([reloadChatData(), reloadCompanyAdvisors(), reloadImporterQuotes()]);
  }

  /**
   * Reasigna el responsable de una cotizacion desde la tabla de la empresa.
   * Con `advisorId` en null la cotizacion vuelve al pool y cualquier asesor
   * puede reclamarla.
   */
  async function handleAssignAdvisorToQuote(quoteId: string, advisorId: string | null) {
    await businessService.assignAdvisorToQuote(quoteId, advisorId);
    await Promise.all([reloadImporterQuotes(), reloadChatData()]);
  }

  /**
   * Confirmación del lado empresa (solo la cuenta dueña). Cuando el cliente ya
   * había aceptado, esta es la llamada que crea la orden.
   */
  async function handleConfirmProposalAsCompany(propuestaId: string) {
    await businessService.preAcceptProposal(propuestaId, true);
    await refreshQuoteLists();
  }

  async function handleUpdateOrderStatus(orderId: string, statusValue: string) {
    await businessService.updateOrderStatus(orderId, { estado: statusValue });
    await Promise.all([reloadRequesterOrders(), reloadImporterOrders(), reloadChatData()]);
    if (selectedOrderId === orderId) {
      await loadOrderDetail(orderId);
    }
  }

  function mapOrderDocumentType(fileName: string): string {
    const extension = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() : "";
    if (extension === "pdf") return "factura_comercial";
    if (extension === "xlsx" || extension === "xls" || extension === "csv") return "packing_list";
    return "factura_proforma";
  }

  async function handleAttachOrderDocument(orderId: string, file: File) {
    const created = await businessService.uploadDocumentFile(file, null, "orden");

    await businessService.addOrderDocument(orderId, {
      nombre: file.name,
      // Ruta canónica del backend: independiente de si se publicó desde
      // localhost, un Dev Tunnel o producción.
      url: toApiPath(created.storage_url),
      tipo: mapOrderDocumentType(file.name),
    });

    await Promise.all([
      reloadRequesterOrders(),
      reloadImporterOrders(),
      reloadChatData(),
      reloadDocumentExplorer(documentCurrentFolderRef.current),
    ]);
    if (selectedOrderId === orderId) {
      await loadOrderDetail(orderId);
    }
  }

  function handleSearchDocuments(query: string) {
    return businessService.searchDocumentFiles(query);
  }

  async function refreshQuoteLists(){
    // `allSettled`: recargar listas que no corresponden al rol actual no puede
    // hacer fracasar la accion que pidio el refresco (enviar una propuesta,
    // aceptar, etc.).
    await Promise.allSettled([
      reloadRequesterQuotes(),
      reloadRequesterResponses(),
      reloadRequesterOrders(),
      reloadImporterQuotes(),
      reloadImporterOrders(),
      reloadAdvisorAssignedQuotes(),
      reloadAdvisorAvailableQuotes(),
      reloadChatData(),
    ]);
  }

  const publicScreens: Screen[] = ["landing", "login", "register", "reset-password", "policy-data", "policy-terms", "policy-payments"];
  const screenAllowedByRole: Partial<Record<Screen, UserRole[]>> = {
    "courses": ["solicitante", "importadora"],
    "imp-dashboard": ["importadora"],
    "imp-profile": ["importadora"],
    "imp-advisors": ["importadora"],
    "imp-quotes": ["importadora"],
    "adv-dashboard": ["asesor"],
    "adv-available": ["asesor"],
    "adv-my-quotes": ["asesor"],
    "user-profile": ["solicitante", "asesor"],
    "help-support": ["solicitante", "importadora", "asesor"],
    "tendencias": ["solicitante"],
    "catalogos": ["solicitante"],
    "imp-catalogos": ["importadora", "asesor"],
    // Canal interno de la plataforma. Sin esta entrada, un cliente o una
    // empresa que escribiera /equipo veía el armazón de la pantalla (título y
    // selector), aunque vacío y con el backend negándole los datos.
    "team-channel": ["admin", "soporte"],
    "admin-dashboard": ["admin"],
    "admin-empresas": ["admin"],
    "admin-usuarios": ["admin"],
    "admin-cotizantes": ["admin"],
    // Única área del panel que comparte el equipo de atención al cliente.
    "admin-soporte": ["admin", "soporte"],
    "admin-certificaciones": ["admin"],
    "admin-respaldos": ["admin"],
    "admin-asignacion": ["admin"],
    "admin-landing": ["admin"],
    "admin-correos": ["admin"],
  };

  const allowedRoles = screenAllowedByRole[screen];

  // Si alguien llega a "courses" con el módulo apagado (enlace guardado, botón
  // atrás), se le devuelve a su inicio en vez de dejarlo en una pantalla muerta.
  useEffect(() => {
    if (!platformConfigLoading && !moduloEducativoHabilitado && screen === "courses") {
      setScreen(getHomeScreenForRole(userRole));
    }
  }, [platformConfigLoading, moduloEducativoHabilitado, screen, userRole]);

  useEffect(() => {
    if (!isAuthenticated || isInitializing || !appRole || !allowedRoles) {
      return;
    }

    if (!allowedRoles.includes(userRole)) {
      const home = getHomeScreenForRole(userRole);
      if (screen !== home) {
        setScreen(home);
      }
    }
  }, [isAuthenticated, isInitializing, appRole, allowedRoles, userRole, screen]);

  const loadingFallback = (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Verificando sesion...
      </div>
    </div>
  );

  const unauthenticatedFallback = (
    <LoginScreen
      onLogin={handleLogin}
      onRegister={()=>goTo("register")}
      onLanding={()=>goTo("landing")}
      onPolicy={page=>goTo(PANTALLA_LEGAL[page])}
      initialEmail={loginPrefillEmail}
    />
  );

  const unauthorizedFallback = (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full p-6">
        <h2 className="text-lg font-semibold">Acceso restringido</h2>
        <p className="text-sm text-muted-foreground mt-2">Tu rol no tiene permisos para esta vista.</p>
        <Button
          className="mt-4"
          onClick={() => {
            if (userRole === "importadora") {
              goTo("imp-dashboard");
              return;
            }
            if (userRole === "asesor") {
              goTo("adv-dashboard");
              return;
            }
            if (userRole === "admin") {
              goTo("admin-dashboard");
              return;
            }
            goTo("dashboard");
          }}
        >
          Ir a mi panel
        </Button>
      </Card>
    </div>
  );

  if(screen==="landing")return <LandingScreen onLogin={()=>goTo("login")} onRegister={()=>goTo("register")} onPolicy={page=>goTo(PANTALLA_LEGAL[page])} importers={marketplaceImporters}/>;
  if(screen==="register")return <RegisterScreen onBack={()=>goTo("login")} onSuccess={(email)=>{setLoginPrefillEmail(email);goTo("login");}} onPolicy={page=>goTo(PANTALLA_LEGAL[page])}/>;
  if(screen==="reset-password")return <ResetPasswordScreen token={resetToken} onBackToLogin={()=>goTo("login")}/>;
  // Pasar de un documento legal a otro no toca `prevScreen`, para que «Volver»
  // regrese a donde estaba el usuario antes de abrir el primero.
  const legalPage=(Object.keys(PANTALLA_LEGAL) as LegalPage[]).find(page=>PANTALLA_LEGAL[page]===screen);
  if(legalPage)return <LegalPolicyScreen page={legalPage} onBack={()=>goTo(prevScreen)} onOpen={page=>setScreen(PANTALLA_LEGAL[page])}/>;
  if(screen==="login")return <LoginScreen onLogin={handleLogin} onRegister={()=>goTo("register")} onLanding={()=>goTo("landing")} onPolicy={page=>goTo(PANTALLA_LEGAL[page])} initialEmail={loginPrefillEmail}/>;

  const renderPrivateScreen = () => {
    // ── Importer portal ───────────────────────────────────────────────────────
    if(screen==="imp-dashboard")return <ImporterDashboardScreen sb={sb} quotes={importerQuotes} advisors={companyAdvisors} chats={chatConversations} companyName={companyProfile?.nombre_empresa||""}/>;
    if(screen==="imp-profile")return <ImporterCompanyProfileScreen sb={sb} company={companyProfile} onSave={handleSaveCompanyProfile}/>;
    if(screen==="imp-advisors")return <ImporterAdvisorsScreen sb={sb} initialAdvisors={companyAdvisors} onCreateAdvisor={handleCreateAdvisor} onSetAdvisorActive={handleSetAdvisorActive} onOpenInternalChat={openInternalChat}/>;
    if(screen==="imp-quotes")return <ImporterQuotesScreen sb={sb} quotes={importerQuotes} onRespond={id=>{setSelectedQuoteId(id);goTo("create-response");}} advisors={companyAdvisors} chats={chatConversations} onOpenChat={openChat} onAssignAdvisor={handleAssignAdvisorToQuote} proposalsByQuoteId={companyProposalsByQuoteId} onConfirmProposal={handleConfirmProposalAsCompany}/>;

    // ── Advisor portal ────────────────────────────────────────────────────────
    if(screen==="adv-dashboard")return <AdvisorDashboardScreen sb={sb} availableCount={visibleAvailableQuotes.length} quotes={advisorAssignedQuotes} headerUser={advisorHeaderUser} responsesSentCount={Object.keys(advisorProposalsByQuoteId).length} activeChatsCount={activeChatCount} onOpenInternalChat={()=>openInternalChat()}/>;
    if(screen==="adv-available")return <AdvisorAvailableScreen sb={sb} available={visibleAvailableQuotes} onClaim={claimQuote} onDiscard={discardAdvisorQuote} headerUser={advisorHeaderUser}/>;
    if(screen==="adv-my-quotes")return <AdvisorMyQuotesScreen sb={sb} quotes={advisorAssignedQuotes} onRespond={id=>{setSelectedQuoteId(id);goTo("create-response");}} headerUser={advisorHeaderUser} existingProposalByQuoteId={advisorProposalsByQuoteId} chats={chatConversations} onOpenChat={openChat}/>;

    if(screen in ADMIN_SECTION_BY_SCREEN)return <AdminDashboardScreen sb={sb} onRefreshGlobal={refreshQuoteLists} screen={screen as AdminScreen}/>;

    // ── Shared ────────────────────────────────────────────────────────────────
    if(screen==="create-response")return <CreateResponseScreen quoteId={selectedQuoteId} onBack={()=>goTo(prevScreen)} sb={sb} userRole={userRole} quotes={userRole==="importadora"?importerQuotes:advisorAssignedQuotes} onSubmitted={refreshQuoteLists} existingProposal={advisorProposalsByQuoteId[selectedQuoteId] ?? null} prefill={proposalPrefill?.quoteId===selectedQuoteId?proposalPrefill.datos:null} headerUser={userRole==="asesor"?advisorHeaderUser:importerHeaderUser} chatConversationId={chatConversations.find((conversation)=>conversation.type==="cotizacion"&&conversation.refId===selectedQuoteId)?.id} onOpenChat={openChat}/>;
    if(screen==="notifications")return <NotificationsScreen notifications={notifications} onMark={markNotif} onOpen={openNotification} onBack={()=>goTo(prevScreen)} sb={sb}/>;
    if(screen==="help-support")return <HelpSupportScreen sb={sb} role={userRole as UserRole} onPedirSoporte={()=>setSoporteAbierto(true)}/>;
    if(screen==="courses")return (
      <CoursesPortalScreen
        sb={sb}
        role={userRole === "importadora" ? "importadora" : "solicitante"}
        headerUser={userRole === "importadora" ? importerHeaderUser : USER}
        companyName={userRole === "importadora" ? (companyProfile?.nombre_empresa || importerHeaderUser.company) : ""}
        onGoDashboard={() => goTo(userRole === "importadora" ? "imp-dashboard" : "dashboard")}
      />
    );

    // ── Solicitante portal ────────────────────────────────────────────────────
    if(screen==="dashboard")return <DashboardScreen sb={sb} importers={marketplaceImporters} onViewProfile={id=>{setSelectedImporterId(id);goTo("importer-profile");}} onCreateQuote={id=>openNewQuote(id)}/>;
    if(screen==="importer-profile")return <ImporterProfileScreen importerId={selectedImporterId} importers={marketplaceImporters} chats={chatConversations} orders={requesterOrders} onBack={()=>goTo("dashboard")} onCreateQuote={id=>openNewQuote(id)} onOpenChat={openChat} sb={sb}/>;
    if(screen==="quotes")return <QuotesScreen quotes={requesterQuotes} responses={requesterResponses} creditos={Number(currentUserProfile?.puntos_cotizacion ?? 0)} onNewQuote={()=>openNewQuote()} onViewDetail={id=>{setSelectedQuoteId(id);goTo("quote-detail");}} onRefreshQuotes={async()=>{await refreshQuoteLists();await refrescarSaldoYTier();}} sb={sb}/>;
    if(screen==="new-quote")return <NewQuoteScreen key={origenSolicitud?.tendenciaProductoId||origenSolicitud?.catalogoProductoId||(quotePrefill?"duplicada":"nueva")} onBack={()=>goTo(origenSolicitud?(origenSolicitud.origen==="tendencias"?"tendencias":"catalogos"):"quotes")} sb={sb} preselectedImporterId={preselectedImporterId} importers={marketplaceImporters} cotizanteTier={currentUserProfile?.tier || "Bronze"} creditos={Number(currentUserProfile?.puntos_cotizacion ?? 0)} onSubmitQuote={handleCreateQuote} prefill={quotePrefill} origen={origenSolicitud}/>;
    if(screen==="tendencias"){
      const consulta=new URLSearchParams(window.location.search);
      return <PantallaPortal sb={sb} active="tendencias" titulo="Tendencias"><TendenciasComprador onPedirPropuestas={pedirPropuestasDesde} edicionInicialId={consulta.get("edicion")} desdeAviso={consulta.get("src")==="aviso"}/></PantallaPortal>;
    }
    if(screen==="catalogos")return <PantallaPortal sb={sb} active="catalogos" titulo="Catálogos"><CatalogosComprador onPedirPropuesta={pedirPropuestasDesde}/></PantallaPortal>;
    if(screen==="imp-catalogos")return <PantallaPortal sb={sb} active="imp-catalogos" titulo="Catálogos"><CatalogosEmpresa esDueno={userRole==="importadora"}/></PantallaPortal>;
    if(screen==="curaduria"){
      if(userRole!=="admin"&&!currentUserProfile?.es_curador)return unauthorizedFallback;
      return <PantallaPortal sb={sb} active="curaduria" titulo="Tendencias · Curaduría"><PanelCurador esAdmin={userRole==="admin"}/></PantallaPortal>;
    }
    if(screen==="quote-detail")return <QuoteDetailScreen quoteId={selectedQuoteId} quotes={requesterQuotes} chats={chatConversations} orders={userRole==="importadora"?importerOrders:requesterOrders} onBack={()=>goTo("quotes")} onOpenChat={openChat} sb={sb} onRefreshQuotes={refreshQuoteLists} onDuplicate={duplicateQuote}/>;
    if(screen==="responses")return <ResponsesScreen onViewDetail={(id,from)=>openResponse(id,from)} sb={sb} responses={requesterResponses} importers={marketplaceImporters} quotes={requesterQuotes} onViewQuote={id=>{setSelectedQuoteId(id);goTo("quote-detail");}}/>;
    if(screen==="response-detail")return <ResponseDetailScreen responseId={selectedResponseId} from={responseFrom} fromQuoteId={responseFromQuoteId} onBack={()=>goTo("responses")} onBackToQuote={id=>{setSelectedQuoteId(id);goTo("quote-detail");}} onOpenChat={openChat} sb={sb} responses={requesterResponses} quotes={requesterQuotes} chats={chatConversations} importers={marketplaceImporters} orders={userRole==="importadora"?importerOrders:requesterOrders} onRefreshData={refreshQuoteLists}/>;
    if(screen==="chats")return <ChatsScreen onViewQuote={id=>{setSelectedQuoteId(id);goTo("quote-detail");}} onViewOrder={id=>{setSelectedOrderDetail(null);setSelectedOrderId(id);goTo("order-detail");}} sb={sb} initialConvId={initialChatConvId} conversations={conversacionesDeChats} messagesByConversation={chatMessagesByConversation} onSendMessage={handleSendChatMessage} onSendPriceEstimate={handleSendPriceEstimate} onConvertEstimateToProposal={handleConvertEstimateToProposal} proposalStateByQuoteId={Object.fromEntries(Object.entries(advisorProposalsByQuoteId).map(([id,propuesta])=>[id,propuesta.estado]))} onShareLocalAttachment={handleShareLocalAttachment} onShareExistingResource={handleShareExistingResource} onTransferConversation={handleTransferConversation} onUpdateOrderStatus={handleUpdateOrderStatus} onAttachOrderDocument={handleAttachOrderDocument} onActiveConversationChange={handleActiveConversationChange} onCloseTicket={handleCloseTicket} onReopenTicket={handleReopenTicket} onEscalateTicket={handleEscalateTicket} onRateTicket={handleRateTicket} companyAdvisors={companyAdvisors} currentUserRole={userRole} chatAttachmentsByConversation={chatAttachmentsByConversation} orders={userRole==="importadora"?importerOrders:requesterOrders} quotes={userRole==="importadora"?importerQuotes:requesterQuotes} importers={marketplaceImporters}/>;
    if(screen==="team-channel")return <ChatsScreen modoEquipo miembrosEquipo={miembrosEquipo} onAbrirHiloEquipo={abrirHiloEquipo} onViewQuote={id=>{setSelectedQuoteId(id);goTo("quote-detail");}} onViewOrder={id=>{setSelectedOrderDetail(null);setSelectedOrderId(id);goTo("order-detail");}} sb={sb} initialConvId={initialChatConvId} conversations={conversacionesDelEquipo} messagesByConversation={chatMessagesByConversation} onSendMessage={handleSendChatMessage} onSendPriceEstimate={handleSendPriceEstimate} onConvertEstimateToProposal={handleConvertEstimateToProposal} proposalStateByQuoteId={Object.fromEntries(Object.entries(advisorProposalsByQuoteId).map(([id,propuesta])=>[id,propuesta.estado]))} onShareLocalAttachment={handleShareLocalAttachment} onShareExistingResource={handleShareExistingResource} onTransferConversation={handleTransferConversation} onUpdateOrderStatus={handleUpdateOrderStatus} onAttachOrderDocument={handleAttachOrderDocument} onActiveConversationChange={handleActiveConversationChange} onCloseTicket={handleCloseTicket} onReopenTicket={handleReopenTicket} onEscalateTicket={handleEscalateTicket} onRateTicket={handleRateTicket} companyAdvisors={companyAdvisors} currentUserRole={userRole} chatAttachmentsByConversation={chatAttachmentsByConversation} orders={userRole==="importadora"?importerOrders:requesterOrders} quotes={userRole==="importadora"?importerQuotes:requesterQuotes} importers={marketplaceImporters}/>;
    if(screen==="orders")return <OrdersScreen onViewOrder={id=>{setSelectedOrderDetail(null);setSelectedOrderId(id);goTo("order-detail");}} sb={sb} orders={userRole==="importadora"?importerOrders:requesterOrders} importers={marketplaceImporters}/>;
    if(screen==="order-detail")return <OrderDetailScreen order={selectedOrderDetail} isLoading={isOrderDetailLoading} onBack={()=>goTo("orders")} onOpenChat={openChat} sb={sb} importers={marketplaceImporters} onViewImporterProfile={id=>{setSelectedImporterId(id);goTo("importer-profile");}} canManageOrder={userRole==="importadora"||userRole==="asesor"} onUpdateOrderStatus={handleUpdateOrderStatus}/>;
    if(screen==="documentos")return <DocumentosScreen sb={sb} explorer={documentExplorer} isLoading={isDocumentExplorerLoading} currentFolderId={documentCurrentFolderId} onLoadFolder={async(parentId)=>{await reloadDocumentExplorer(parentId);}} onCreateFolder={handleCreateDocumentFolder} onRegisterFile={handleRegisterLocalDocument} onSearch={handleSearchDocuments} onMoveFile={handleMoveDocumentFile} onMoveFolder={handleMoveDocumentFolder} onRenameFile={handleRenameDocumentFile} onRenameFolder={handleRenameDocumentFolder} onDeleteFile={handleDeleteDocumentFile} onDeleteFolder={handleDeleteDocumentFolder} protectedFolders={protectedRootFolders}/>;
    if(screen==="pagos")return <PagosScreen sb={sb}/>;
    if(screen==="user-profile")return <UserProfileScreen sb={sb} profile={{nombre:currentUserProfile?.nombre||"",telefono:currentUserProfile?.telefono||"",email:currentUserProfile?.email||"",whatsapp:currentUserProfile?.whatsapp||"",fotoUrl:currentUserProfile?.foto_url||""}} onSave={handleSaveUserProfile} onBack={()=>goTo(userRole==="asesor"?"adv-dashboard":"dashboard")} headerUser={userRole==="asesor"?advisorHeaderUser:USER}/>;
    return null;
  };

  return (
    <ProtectedRoute
      isInitializing={isInitializing}
      isAuthenticated={isAuthenticated}
      currentRole={userRole}
      allowedRoles={allowedRoles}
      loadingFallback={loadingFallback}
      unauthenticatedFallback={unauthenticatedFallback}
      unauthorizedFallback={unauthorizedFallback}
    >
      {renderPrivateScreen()}
      {/* Fuera del conmutador de pantallas: se puede pedir soporte desde
          cualquiera de ellas sin perder dónde estabas. */}
      <SoporteModal
        open={soporteAbierto}
        onClose={()=>setSoporteAbierto(false)}
        onSubmit={handleOpenSupportTicket}
      />
    </ProtectedRoute>
  );
}
