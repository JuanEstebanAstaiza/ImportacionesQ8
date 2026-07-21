import { useState, useEffect, useRef, useCallback } from "react";
import {
  Eye, EyeOff, Mail, Lock, UserRound, Building2, LogIn,
  Moon, Sun, Info, AlertCircle, CheckCircle2, Loader2, Package2,
  FileText, ShoppingCart, FolderOpen, CreditCard, ChevronRight,
  Plus, Search, MessageCircle, Phone, ExternalLink, ArrowUpDown,
  ChevronDown, Globe, Check, Star, Clock, X, Upload, ChevronLeft,
  Save, Send, Users, MapPin, Tag, Layers, Building, RotateCcw,
  BadgeCheck, GitCompare, Mail as MailIcon, ClipboardList,
  Truck, Package, Anchor, Warehouse, CheckCircle, Edit2, Copy, Ban,
  TrendingUp, TrendingDown, Minus, Receipt, FileCheck, Bell,
  Scale, HelpCircle, Download, Boxes, Ship, Factory,
  PackageCheck, Navigation2, MessageSquare, Paperclip, Smile,
  Image as ImageIcon, PanelRightClose, PanelRightOpen,
  FileSpreadsheet, File as FileIcon, LayoutGrid, Award, Shield,
  Zap, Filter, AtSign, ChevronDown as ChevDown,
} from "lucide-react";
import { clsx } from "clsx";

import { Quote } from "../types/quote";
import type { ResponseFrom, ResponseStatus } from "../types/quote";
import { Importer } from "../types/importer";
import { SidebarCtrl } from "../types/portal";
import { ProtectedRoute } from "@/app/components/guards/ProtectedRoute";
import { AuthScreen } from "@/features/auth/components/AuthScreen";
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/auth.service";
import {
  businessService,
  type BackendAsesor,
  type BackendCotizacion,
  type BackendImporter,
  type BackendOrder,
  type BackendPropuesta,
  type BackendUserProfile,
  type CreateAsesorPayload,
  type CreateCotizacionPayload,
  type CreatePropuestaPayload,
} from "@/services/business.service";
import { getStoredRole, getStoredToken } from "@/services/api-client";
import type { RegisterRequest } from "@/types/auth";

const RESET_PASSWORD_PATH = "/restablecer-password";
const SHOW_PAYMENTS_MODULE = false;

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN SYSTEM COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

type BadgeVariant = "created"|"directed"|"open"|"accepted"|"active-order"|"neutral"|
  "resp-nueva"|"resp-vista"|"resp-aceptada"|"resp-rechazada"|"info"|"warning"|"success";

const BADGE_MAP: Record<BadgeVariant,{label:string;cls:string;dot:string}> = {
  "created":        {label:"Creada",       cls:"bg-slate-100 text-slate-600",    dot:"bg-slate-400"},
  "directed":       {label:"Dirigida",     cls:"bg-blue-50 text-blue-700",       dot:"bg-blue-500"},
  "open":           {label:"Abierta",      cls:"bg-orange-50 text-orange-700",   dot:"bg-orange-500"},
  "accepted":       {label:"Aceptada",     cls:"bg-emerald-50 text-emerald-700", dot:"bg-emerald-500"},
  "active-order":   {label:"Orden activa", cls:"bg-purple-50 text-purple-700",   dot:"bg-purple-500"},
  "neutral":        {label:"",             cls:"bg-slate-100 text-slate-600",    dot:"bg-slate-400"},
  "resp-nueva":     {label:"Nueva",        cls:"bg-orange-50 text-orange-700",   dot:"bg-orange-500"},
  "resp-vista":     {label:"Vista",        cls:"bg-blue-50 text-blue-700",       dot:"bg-blue-500"},
  "resp-aceptada":  {label:"Aceptada",     cls:"bg-emerald-50 text-emerald-700", dot:"bg-emerald-500"},
  "resp-rechazada": {label:"Rechazada",    cls:"bg-red-50 text-red-700",         dot:"bg-red-500"},
  "info":           {label:"",             cls:"bg-blue-50 text-blue-700",       dot:"bg-blue-500"},
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
    primary:"bg-primary text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm",
    secondary:"bg-white text-foreground border border-border hover:bg-muted shadow-sm",
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
function ContactBtn({type,size="sm",label,className}:{type:ContactType;size?:"sm"|"md";label?:string;className?:string}) {
  const cfg:Record<ContactType,{icon:React.FC<{className?:string}>;defaultLabel:string;cls:string}>={
    whatsapp:{icon:Phone,         defaultLabel:"WhatsApp",cls:"border-emerald-200 hover:bg-emerald-50 text-emerald-700"},
    chat:    {icon:MessageCircle, defaultLabel:"Chat",    cls:"border-border hover:bg-muted text-foreground"},
    email:   {icon:MailIcon,      defaultLabel:"Correo",  cls:"border-border hover:bg-muted text-foreground"},
    phone:   {icon:Phone,         defaultLabel:"Llamar",  cls:"border-slate-200 hover:bg-slate-50 text-slate-700"},
  };
  const c=cfg[type];const Icon=c.icon;
  const iconSize=size==="sm"?"w-3.5 h-3.5":"w-4 h-4";
  return <Button variant="secondary" size={size} icon={<Icon className={iconSize}/>} className={clsx(c.cls,className)}>{label??c.defaultLabel}</Button>;
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

function Card({children,className,padding="md"}:{children:React.ReactNode;className?:string;padding?:"none"|"sm"|"md"|"lg"}) {
  const p={none:"",sm:"p-4",md:"p-5",lg:"p-6"};
  return <div className={clsx("bg-white border border-border rounded-xl shadow-sm",p[padding],className)}>{children}</div>;
}

function Avatar({initials,size="md",color="bg-primary"}:{initials:string;size?:"sm"|"md"|"lg"|"xl";color?:string}) {
  const s={sm:"w-7 h-7 text-xs",md:"w-9 h-9 text-sm",lg:"w-10 h-10 text-sm",xl:"w-12 h-12 text-base"};
  return <div className={clsx("rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0",color,s[size])}>{initials}</div>;
}

function Breadcrumb({items}:{items:{label:string;onClick?:()=>void}[]}) {
  return (
    <nav className="flex items-center gap-1 text-sm">
      {items.map((item,i)=>(
        <span key={i} className="flex items-center gap-1">
          {i>0&&<ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40"/>}
          <span onClick={item.onClick} className={clsx(i===items.length-1?"text-foreground font-medium":"text-muted-foreground",item.onClick&&"cursor-pointer hover:text-foreground transition-colors")}>
            {item.label}
          </span>
        </span>
      ))}
    </nav>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5 overflow-hidden">
      <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center flex-shrink-0"><Package2 className="w-4 h-4 text-white"/></div>
      <span className="font-semibold text-foreground tracking-tight text-[14px] whitespace-nowrap">ImportacionesQ8</span>
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
function NotifIcon({icon,count=0}:{icon:React.ReactNode;count?:number}) {
  return (
    <div className="relative">
      <button className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
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

interface Order {id:string;code:string;quoteCode:string;product:string;importerId:string;created:string;estimated:string;quantity:string;unitPrice:string;totalValue:string;incoterm:string;originPort:string;destPort:string;conversationId?:string;}

const MOCK_ORDERS:Order[]=[
  {id:"ord001",code:"ORD-2025-0042",quoteCode:"COT-2025-0068",product:"Laptops Dell Latitude 5540",importerId:"techimport",created:"20 Feb 2025",estimated:"15 Abr 2025",quantity:"20 unidades",unitPrice:"950 USD/u",totalValue:"$19,000 USD",incoterm:"FOB",originPort:"Port of Los Angeles, USA",destPort:"Puerto de Buenaventura, CO"},
  {id:"ord002",code:"ORD-2025-0038",quoteCode:"COT-2025-0017",product:"Cámaras CCTV IP 4K Dahua",  importerId:"secvision", created:"12 Ene 2025",estimated:"20 Mar 2025",quantity:"30 unidades",unitPrice:"165 USD/u", totalValue:"$4,950 USD", incoterm:"CIF",originPort:"Shenzhen Port, China",         destPort:"Puerto de Cartagena, CO"},
];

const ORDER_TIMELINE:TimelineStage[]=[
  {label:"Solicitud aceptada",  icon:<CheckCircle2 className="w-3.5 h-3.5"/>, status:"done",   date:"20 Feb 2025"},
  {label:"Producción",          icon:<Factory className="w-3.5 h-3.5"/>,      status:"done",   date:"28 Feb 2025"},
  {label:"Inspección",          icon:<PackageCheck className="w-3.5 h-3.5"/>, status:"done",   date:"05 Mar 2025"},
  {label:"Carga",               icon:<Boxes className="w-3.5 h-3.5"/>,        status:"current",date:"12 Mar 2025"},
  {label:"En tránsito",         icon:<Ship className="w-3.5 h-3.5"/>,         status:"pending",date:"~20 Mar 2025"},
  {label:"En aduana",           icon:<Anchor className="w-3.5 h-3.5"/>,       status:"pending",date:"~25 Mar 2025"},
  {label:"En bodega",           icon:<Warehouse className="w-3.5 h-3.5"/>,    status:"pending",date:"~01 Abr 2025"},
  {label:"Entrega",             icon:<Navigation2 className="w-3.5 h-3.5"/>,  status:"pending",date:"~15 Abr 2025"},
];

const QUOTE_TIMELINE:TimelineStage[]=[
  {label:"Solicitud enviada",   icon:<Send className="w-3.5 h-3.5"/>,         status:"done"},
  {label:"Proveedor respondió", icon:<ClipboardList className="w-3.5 h-3.5"/>,status:"done"},
  {label:"Negociación",         icon:<Scale className="w-3.5 h-3.5"/>,        status:"current"},
  {label:"Producción",          icon:<Factory className="w-3.5 h-3.5"/>,      status:"pending"},
  {label:"En tránsito",         icon:<Ship className="w-3.5 h-3.5"/>,         status:"pending"},
  {label:"En aduana",           icon:<Anchor className="w-3.5 h-3.5"/>,       status:"pending"},
  {label:"En bodega",           icon:<Warehouse className="w-3.5 h-3.5"/>,    status:"pending"},
  {label:"Entrega final",       icon:<CheckCircle className="w-3.5 h-3.5"/>,  status:"pending"},
];

const MOCK_DOCS=[
  {name:"Factura Comercial",          date:"20 Feb 2025",status:"Disponible"},
  {name:"Packing List",               date:"05 Mar 2025",status:"Disponible"},
  {name:"Bill of Lading (BL)",        date:"12 Mar 2025",status:"Pendiente"},
  {name:"Certificado de Origen",      date:"05 Mar 2025",status:"Disponible"},
  {name:"Declaración de Importación", date:"—",           status:"Pendiente"},
];

const ORDER_HISTORY=[
  {label:"Orden creada",         date:"20 Feb 2025",icon:<Plus className="w-3 h-3"/>},
  {label:"Proveedor aceptó",     date:"21 Feb 2025",icon:<CheckCircle2 className="w-3 h-3"/>},
  {label:"Producción inició",    date:"28 Feb 2025",icon:<Factory className="w-3 h-3"/>},
  {label:"Inspección completada",date:"05 Mar 2025",icon:<PackageCheck className="w-3 h-3"/>},
  {label:"Carga realizada",      date:"12 Mar 2025",icon:<Boxes className="w-3 h-3"/>},
];

// ─── Chat data ────────────────────────────────────────────────────────────────
type ChatType="orden"|"cotizacion";
interface ChatConv {
  id:string;type:ChatType;refCode:string;refId:string;importerId:string;
  status:"activa"|"archivada";unread:number;lastMsg:string;lastDate:string;
}
type MsgFileType="pdf"|"excel"|"word"|"image";
interface MsgFile {name:string;type:MsgFileType;size:string;}
interface ChatMsg {
  id:string;sender:"client"|"provider";text?:string;file?:MsgFile;
  time:string;read:boolean;dateGroup?:string;
}

const INCOTERMS=["EXW","FCA","FAS","FOB","CFR","CIF","CPT","CIP","DAP","DPU","DDP"];
const COUNTRIES=["China","Estados Unidos","Alemania","Japón","India","Italia","Francia","España","Brasil","Corea del Sur","Turquía","México","Colombia"];
const LINES=["Tecnología","Textil","Alimentos","Maquinaria","Agroindustria","Químicos","Automotriz","Construcción","Consumo masivo","Farmacéutico","Seguridad"];
const ALL_CATEGORIES=["Tecnología","Textil","Alimentos","Maquinaria","Agroindustria","Industrial","Seguridad","Química","Software","Confección","Bebidas","Electrónica"];

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR — pinned / floating / toggle tab
// ─────────────────────────────────────────────────────────────────────────────
const NAV_ITEMS=[
  {icon:LayoutGrid,   label:"Dashboard",    key:"dashboard"},
  {icon:FileText,     label:"Cotizaciones", key:"quotes"},
  {icon:ClipboardList,label:"Respuestas",   key:"responses"},
  {icon:MessageSquare,label:"Chats",        key:"chats"},
  {icon:ShoppingCart, label:"Órdenes",      key:"orders"},
  {icon:FolderOpen,   label:"Documentos",   key:"documentos"},
  {icon:CreditCard,   label:"Pagos",        key:"pagos"},
];

const NAV_IMPORTADORA=[
  {icon:LayoutGrid,    label:"Dashboard",    key:"imp-dashboard"},
  {icon:FileText,      label:"Cotizaciones", key:"imp-quotes"},
  {icon:Users,         label:"Asesores",     key:"imp-advisors"},
  {icon:Building2,     label:"Mi empresa",   key:"imp-profile"},
  {icon:MessageSquare, label:"Chats",        key:"chats"},
  {icon:FolderOpen,    label:"Documentos",   key:"documentos"},
];

const NAV_ASESOR=[
  {icon:LayoutGrid,    label:"Dashboard",       key:"adv-dashboard"},
  {icon:Zap,           label:"Disponibles",     key:"adv-available"},
  {icon:ClipboardList, label:"Mis cotizaciones",key:"adv-my-quotes"},
  {icon:MessageSquare, label:"Chats",           key:"chats"},
];

// ─── Portal data ──────────────────────────────────────────────────────────────
type UserRole="solicitante"|"importadora"|"asesor"|"admin";

const NAV_ADMIN=[
  {icon:LayoutGrid,    label:"Dashboard",    key:"admin-dashboard"},
  {icon:MessageSquare, label:"Chats",        key:"chats"},
  {icon:FolderOpen,    label:"Documentos",   key:"documentos"},
];

type StoredRole = "solicitante" | "importador" | "importadora" | "asesor" | "admin";

function normalizeStoredRole(role: string | null): UserRole | "admin" | null {
  if (!role) {
    return null;
  }

  if (role === "importador" || role === "importadora") {
    return "importadora";
  }

  if (role === "solicitante" || role === "asesor" || role === "admin") {
    return role;
  }

  return null;
}

function getHomeScreenForRole(role: UserRole | "admin"): "dashboard" | "imp-dashboard" | "adv-dashboard" | "admin-dashboard" {
  if (role === "importadora") {
    return "imp-dashboard";
  }
  if (role === "asesor") {
    return "adv-dashboard";
  }
  if (role === "admin") {
    return "admin-dashboard";
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

function mapBackendImporterToUi(imp: BackendImporter): Importer {
  const primaryCategory = imp.especialidad_producto[0] ?? "General";
  const primaryCountry = imp.paises_origen[0] ?? "N/A";
  const name = imp.nombre_empresa;
  return {
    id: imp.id,
    name,
    specialty: `${primaryCategory} internacional`,
    rating: Number(imp.calificacion_promedio || 0),
    responseTime: imp.tiempo_respuesta_promedio || "~48h",
    initials: initialsFromName(name),
    color: importerColorFromId(imp.id),
    memberSince: formatShortDate(imp.fecha_registro),
    projects: 0,
    verified: Boolean(imp.verificado),
    country: primaryCountry,
    categories: imp.especialidad_producto.length > 0 ? imp.especialidad_producto : ["General"],
    advisor: {
      name: "Asesor asignado",
      role: "Asesor",
      initials: "AS",
      color: "bg-slate-600",
      email: "asesor@importacionesq8.co",
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

  return {
    id: cot.id,
    code: `COT-${cot.id.slice(0, 8).toUpperCase()}`,
    date: formatShortDate(cot.fecha_creacion),
    product: cot.nombre_producto,
    importer: importerName,
    mode: cot.modalidad === "dirigida" ? "Dirigida" : "Abierta",
    status: backendEstadoToUi(cot.estado),
    updatedAt: formatShortDate(cot.fecha_actualizacion),
    country: cot.pais_importacion,
    productLine: cot.linea_producto,
    quality: cot.tipo_calidad,
    minQuantity: String(cot.cantidad_minima),
    targetPrice: cot.precio_objetivo_usd ? `${cot.precio_objetivo_usd} USD` : "N/A",
    incoterm: cot.incoterm,
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
  return {
    id: order.id,
    code,
    quoteCode: quote?.code || `COT-${order.cotizacion_id.slice(0, 8).toUpperCase()}`,
    product: quote?.product || "Producto no disponible",
    importerId: order.importador_id,
    created: formatShortDate(order.historial_estados?.[0]?.fecha || new Date().toISOString()),
    estimated: order.tiempo_estimado_entrega || "N/D",
    quantity: quote?.minQuantity ? `${quote.minQuantity} unidades` : "N/D",
    unitPrice: `${order.precio_acordado_usd} USD/u`,
    totalValue: `${order.precio_acordado_usd} USD`,
    incoterm: quote?.incoterm || "N/D",
    originPort: "N/D",
    destPort: "N/D",
    conversationId: order.conversacion_id || undefined,
  };
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
}

const INIT_NOTIFICATIONS:AppNotification[]=[
  {id:"n1",type:"response",title:"Nueva respuesta recibida",body:"Grupo Nexus respondió tu cotización COT-2025-0089",date:"Hace 1h",read:false},
  {id:"n2",type:"message",title:"Nuevo mensaje",body:"Carlos Mendoza: 'Adjunto la factura comercial actualizada.'",date:"Hace 2h",read:false},
  {id:"n3",type:"status",title:"Estado actualizado",body:"Orden ORD-2025-0042 pasó a 'En tránsito'",date:"Hace 3h",read:false},
  {id:"n4",type:"order",title:"Nueva orden creada",body:"Se creó la orden ORD-2025-0038 desde tu cotización",date:"Ayer",read:true},
  {id:"n5",type:"document",title:"Documento agregado",body:"Packing List disponible en Orden ORD-2025-0042",date:"Ayer",read:true},
  {id:"n6",type:"advisor",title:"Asesor asignado",body:"Carlos Mendoza fue asignado a COT-2025-0089",date:"Hace 2 días",read:true},
  {id:"n7",type:"update",title:"Orden actualizada",body:"Nueva actualización en ORD-2025-0038",date:"Hace 3 días",read:true},
];

type NavItem={icon:React.FC<{className?:string}>;label:string;key:string};

function Sidebar({active,onNav,pinned,onToggle,navItems,onLogout}:SidebarCtrl) {
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
        <div className={clsx("flex items-center h-[57px] border-b border-border",isExpanded?"px-4 gap-2.5":"justify-center px-0")}>
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center flex-shrink-0"><Package2 className="w-4 h-4 text-white"/></div>
          <div className={clsx("overflow-hidden transition-all duration-200",isExpanded?"w-auto opacity-100 ml-0":"w-0 opacity-0")}>
            <span className="font-semibold text-foreground tracking-tight text-[14px] whitespace-nowrap">ImportacionesQ8</span>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 p-2 mt-1 flex-1">
          {navItems.map(({icon:Icon,label,key})=>{
            const isActive=active===key;
            return (
              <button key={key} onClick={()=>onNav(key)}
                className={clsx("flex items-center rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150 w-full",
                  isActive?"bg-primary/8 text-primary":"text-muted-foreground hover:text-foreground hover:bg-muted",
                  isExpanded?"gap-2.5":"justify-center gap-0")}
                title={!isExpanded?label:undefined}>
                <Icon className={clsx("w-4 h-4 flex-shrink-0",isActive&&"text-primary")}/>
                <div className={clsx("overflow-hidden transition-all duration-200",isExpanded?"w-auto opacity-100":"w-0 opacity-0")}>
                  <span className="whitespace-nowrap">{label}</span>
                </div>
                {isExpanded&&isActive&&<span className="ml-auto w-1 h-4 rounded-full bg-primary flex-shrink-0"/>}
              </button>
            );
          })}
        </nav>

        <div className="p-2 border-t border-border">
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
// APP HEADER
// ─────────────────────────────────────────────────────────────────────────────
function AppHeader({user,notifCount=0,onNotif,onProfile,sb}:{user:{name:string;company:string;initials:string};notifCount?:number;onNotif?:()=>void;onProfile?:()=>void;sb?:SidebarCtrl}) {
  const { user: authUser } = useAuth();
  const count=sb?.notifCount??notifCount;
  const handler=sb?.onNotif??onNotif;
  const profileHandler=sb?.onProfile??onProfile;
  const displayName = authUser?.nombre?.trim() || authUser?.email || user.name;
  const displayCompany = authUser?.email || user.company;
  const initialsSource = authUser?.nombre?.trim() || authUser?.email || user.name;
  const displayInitials = initialsFromName(initialsSource);
  return (
    <header className="h-[57px] flex items-center justify-between px-5 bg-white border-b border-border flex-shrink-0">
      <div/>
      <div className="flex items-center gap-1">
        <div className="relative">
          <button onClick={handler} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            <Bell className="w-4 h-4"/>
          </button>
          {count>0&&<span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none pointer-events-none">{count>9?"9+":count}</span>}
        </div>
        <NotifIcon icon={<MessageCircle className="w-4 h-4"/>} count={1}/>
        <NotifIcon icon={<HelpCircle className="w-4 h-4"/>} count={0}/>
        <div className="w-px h-5 bg-border mx-2"/>
        <div className="flex items-center gap-2.5">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-foreground leading-tight">{displayName}</p>
            <p className="text-xs text-muted-foreground leading-tight">{displayCompany}</p>
          </div>
          <button onClick={profileHandler} title="Editar perfil"><Avatar initials={displayInitials} size="md"/></button>
        </div>
      </div>
    </header>
  );
}

const USER={name:"Ana García",company:"Importaciones del Norte S.A.",initials:"AG"};
const USER_IMPORTADORA={name:"María López",company:"Grupo Nexus S.A.",initials:"ML"};
const USER_ASESOR={name:"Carlos Mendoza",company:"Grupo Nexus S.A. — Asesor",initials:"CM"};

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTER CARD — used in Dashboard and profile screens
// ─────────────────────────────────────────────────────────────────────────────
function ImporterCard({imp,onViewProfile,onCreateQuote,featured=false}:{
  imp:Importer;onViewProfile:(id:string)=>void;onCreateQuote:(id:string)=>void;featured?:boolean;
}) {
  const desc=IMP_DESCRIPTIONS[imp.id]||"Importadora con experiencia en comercio internacional.";
  const certs=IMP_CERTS[imp.id]||[];
  return (
    <div className={clsx(
      "bg-white border rounded-xl p-5 flex flex-col gap-4 hover:shadow-md transition-all duration-200 group",
      featured?"border-primary/20 shadow-sm ring-1 ring-primary/10":"border-border"
    )}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar initials={imp.initials} size="xl" color={imp.color}/>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1.5 flex-wrap">
            <p className="font-semibold text-sm leading-tight">{imp.name}</p>
            {imp.verified&&<BadgeCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5"/>}
            {featured&&<span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-semibold"><Award className="w-2.5 h-2.5"/>Destacada</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{imp.specialty}</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3"/>{imp.country}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400"/><span className="text-sm font-semibold">{imp.rating}</span></div>
          <div className="flex items-center gap-1 text-muted-foreground"><Clock className="w-3 h-3"/><span className="text-xs">{imp.responseTime}</span></div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{desc}</p>

      {/* Categories + certs */}
      <div className="flex flex-wrap gap-1.5">
        {imp.categories.map(c=>(
          <span key={c} className="px-2 py-0.5 bg-muted rounded-md text-[10px] font-medium text-muted-foreground">{c}</span>
        ))}
        {certs.map(c=>(
          <span key={c} className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-md text-[10px] font-medium text-emerald-700 flex items-center gap-1"><Shield className="w-2.5 h-2.5"/>{c}</span>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 py-2.5 border-t border-border">
        <div className="flex items-center gap-1.5"><Package2 className="w-3 h-3 text-muted-foreground/60"/><span className="text-xs text-muted-foreground">{imp.projects} proyectos</span></div>
        <div className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-muted-foreground/60"/><span className="text-xs text-muted-foreground">Desde {imp.memberSince}</span></div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" fullWidth onClick={()=>onViewProfile(imp.id)}>Ver perfil</Button>
        <Button variant="primary" size="sm" fullWidth icon={<Plus className="w-3.5 h-3.5"/>} onClick={()=>onCreateQuote(imp.id)}>Cotizar</Button>
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
  const [ratingFilter,setRatingFilter]=useState("");
  const [countryFilter,setCountryFilter]=useState("");

  const filtered=importers.filter(imp=>{
    const ms=!search||[imp.name,imp.specialty,...imp.categories].some(v=>v.toLowerCase().includes(search.toLowerCase()));
    const mc=catFilter==="Todas"||imp.categories.some(c=>c.toLowerCase()===catFilter.toLowerCase());
    const mr=!ratingFilter||imp.rating>=parseFloat(ratingFilter);
    const mco=!countryFilter||imp.country===countryFilter;
    return ms&&mc&&mr&&mco;
  });

  const featured=importers.filter(i=>i.verified&&i.rating>=4.7).slice(0,3);
  const quickCats=["Todas","Tecnología","Textil","Alimentos","Maquinaria","Agroindustria","Industrial","Seguridad"];

  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <Sidebar {...sb} active="dashboard"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Page header */}
          <div>
            <Breadcrumb items={[{label:"Inicio"},{label:"Dashboard"}]}/>
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
              {label:"Importadoras activas",value:importers.length.toString(),icon:<Building2 className="w-4 h-4"/>,color:"text-primary"},
              {label:"Verificadas",value:importers.filter(i=>i.verified).length.toString(),icon:<BadgeCheck className="w-4 h-4"/>,color:"text-emerald-600"},
              {label:"Rating promedio",value:"4.6",icon:<Star className="w-4 h-4"/>,color:"text-amber-500"},
              {label:"Tiempo prom. respuesta",value:"~34h",icon:<Zap className="w-4 h-4"/>,color:"text-violet-600"},
            ].map(s=>(
              <Card key={s.label} padding="md" className="flex flex-col gap-2">
                <div className={clsx("w-7 h-7 rounded-lg bg-muted flex items-center justify-center",s.color)}>{s.icon}</div>
                <p className="text-xl font-semibold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </Card>
            ))}
          </div>

          {/* Featured */}
          {!search&&catFilter==="Todas"&&!ratingFilter&&!countryFilter&&(
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-4 h-4 text-amber-500"/>
                <h2 className="text-sm font-semibold">Empresas destacadas</h2>
                <span className="text-xs text-muted-foreground">· Mejor calificadas y verificadas</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <div className="w-36">
                <Select value={ratingFilter} onChange={e=>setRatingFilter(e.target.value)}>
                  <option value="">Calificación</option>
                  <option value="4.9">⭐ 4.9+</option>
                  <option value="4.7">⭐ 4.7+</option>
                  <option value="4.5">⭐ 4.5+</option>
                </Select>
              </div>
              <div className="w-40">
                <Select value={countryFilter} onChange={e=>setCountryFilter(e.target.value)}>
                  <option value="">País</option>
                  {[...new Set(importers.map(i=>i.country))].map(c=><option key={c}>{c}</option>)}
                </Select>
              </div>
              {(search||ratingFilter||countryFilter||catFilter!=="Todas")&&(
                <Button variant="ghost" size="sm" icon={<RotateCcw className="w-3.5 h-3.5"/>} onClick={()=>{setSearch("");setRatingFilter("");setCountryFilter("");setCatFilter("Todas");}}>Limpiar</Button>
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

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTER PROFILE SCREEN — read-only public profile for the requester
// ─────────────────────────────────────────────────────────────────────────────
function ImporterProfileScreen({importerId,onBack,onCreateQuote,onOpenChat,sb,importers,chats}:{
  importerId:string;onBack:()=>void;onCreateQuote:(id:string)=>void;onOpenChat:(convId:string)=>void;sb:SidebarCtrl;importers:Importer[];chats:ChatConv[];
}) {
  const imp=importers.find(i=>i.id===importerId)||importers[0]||IMPORTERS[0];
  const desc=IMP_DESCRIPTIONS[imp.id]||"";
  const certs=IMP_CERTS[imp.id]||[];
  const relQuotes=QUOTES.filter(q=>q.importer===imp.name);
  const relOrders=MOCK_ORDERS.filter(o=>o.importerId===imp.id);
  const relChats=chats.filter(c=>c.importerId===imp.id);

  const ADVISORS=[
    imp.advisor,
    {name:"Suplente "+imp.advisor.name.split(" ")[1], role:"Asesor Jr.", initials:imp.advisor.initials[0]+"S", color:"bg-slate-500", email:"suplente@"+imp.id+".co"},
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <Sidebar {...sb} active="dashboard"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <Breadcrumb items={[{label:"Inicio"},{label:"Dashboard",onClick:onBack},{label:imp.name}]}/>

          {/* Hero card */}
          <Card padding="md" className="mt-4 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
              <div className="flex items-start gap-4">
                <Avatar initials={imp.initials} size="xl" color={imp.color}/>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg font-semibold">{imp.name}</h1>
                    {imp.verified&&<span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium"><BadgeCheck className="w-3 h-3"/>Verificada</span>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{imp.specialty}</p>
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    <div className="flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400"/><span className="text-sm font-semibold">{imp.rating}</span><span className="text-xs text-muted-foreground ml-1">calificación</span></div>
                    <div className="flex items-center gap-1 text-muted-foreground"><Clock className="w-3.5 h-3.5"/><span className="text-xs">{imp.responseTime} respuesta</span></div>
                    <div className="flex items-center gap-1 text-muted-foreground"><MapPin className="w-3.5 h-3.5"/><span className="text-xs">{imp.country}</span></div>
                    <div className="flex items-center gap-1 text-muted-foreground"><Package2 className="w-3.5 h-3.5"/><span className="text-xs">{imp.projects} proyectos</span></div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <ContactBtn type="whatsapp"/>
                <ContactBtn type="email"/>
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
              </Card>

              {/* Certifications */}
              <Card padding="md">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-primary"/>Certificaciones</h3>
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
                        <ContactBtn type="whatsapp" label="WA" size="sm"/>
                        <ContactBtn type="email" label="Email" size="sm"/>
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
                  <ContactBtn type="whatsapp" size="sm" label="Contactar por WhatsApp" className="w-full justify-center"/>
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
function QuotesScreen({onNewQuote,onViewDetail,sb,quotes}:{onNewQuote:()=>void;onViewDetail:(id:string)=>void;sb:SidebarCtrl;quotes:Quote[]}) {
  const [search,setSearch]=useState("");const[statusF,setStatusF]=useState("");const[modeF,setModeF]=useState("");const[respF,setRespF]=useState("");
  const lastQ=quotes[0]??null;
  const filtered=quotes.filter(q=>{
    const ms=!search||[q.code,q.product,q.importer].some(v=>v.toLowerCase().includes(search.toLowerCase()));
    const mst=!statusF||q.status===statusF;const mm=!modeF||q.mode===modeF;
    const mr=!respF||(respF==="sin");
    return ms&&mst&&mm&&mr;
  });
  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <Sidebar {...sb} active="quotes"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div>
            <Breadcrumb items={[{label:"Inicio"},{label:"Cotizaciones"}]}/>
            <div className="flex items-center justify-between mt-3">
              <h1 className="text-xl font-semibold tracking-tight">Cotizaciones</h1>
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
                    <div><p className="text-xs text-muted-foreground mb-0.5">Respuestas</p><p className="text-sm font-medium text-muted-foreground">Sin datos</p></div>
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
              <div className="py-6 text-center">
                <ClipboardList className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2"/>
                <p className="text-sm text-muted-foreground">No hay endpoint de respuestas asociado a esta bandeja.</p>
              </div>
            </Card>
          </div>
          <div>
            <h2 className="text-base font-semibold mb-4">Historial de cotizaciones</h2>
            <Card padding="sm" className="mb-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[160px]"><Input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} prefix={<Search className="w-4 h-4"/>}/></div>
                <div className="w-32"><Select value={statusF} onChange={e=>setStatusF(e.target.value)}><option value="">Estado</option><option value="created">Creada</option><option value="directed">Dirigida</option><option value="open">Abierta</option><option value="accepted">Aceptada</option><option value="active-order">Orden activa</option></Select></div>
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
                        <td className="px-4 py-3"><Badge variant={row.status}/></td>
                        <td className="px-4 py-3 text-center"><span className="text-xs text-muted-foreground">—</span></td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{row.updatedAt}</td>
                        <td className="px-4 py-3"><Button variant="secondary" size="sm" icon={<ExternalLink className="w-3 h-3"/>} onClick={()=>onViewDetail(row.id)}>Ver detalle</Button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ):<div className="py-16 text-center"><FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2"/><p className="text-sm text-muted-foreground">No se encontraron cotizaciones</p></div>}
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUOTE DETAIL
// ─────────────────────────────────────────────────────────────────────────────
function QuoteDetailScreen({quoteId,quotes,onBack,onOpenChat,sb,onRefreshQuotes,chats}:{quoteId:string;quotes:Quote[];onBack:()=>void;onOpenChat:(id:string)=>void;sb:SidebarCtrl;onRefreshQuotes?:()=>Promise<void>;chats:ChatConv[]}) {
  const quote=quotes.find(q=>q.id===quoteId)??null;
  const [proposals,setProposals]=useState<BackendPropuesta[]>([]);
  const [loadingProposals,setLoadingProposals]=useState(true);
  const [actionMessage,setActionMessage]=useState("");

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

  const handleDecision=useCallback(async(propuestaId:string,aceptar:boolean)=>{
    setActionMessage("");
    await businessService.preAcceptProposal(propuestaId,aceptar);
    await loadProposals();
    if(onRefreshQuotes){
      await onRefreshQuotes();
    }
    setActionMessage(aceptar?"Oferta aceptada." :"Oferta rechazada.");
  },[loadProposals,onRefreshQuotes]);

  if(!quote){
    return (
      <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
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

  const activeProposal=proposals[0]??null;
  const contactAsesor=proposals.find(p=>p.contacto_asesor)?.contacto_asesor??null;
  const relChat=chats.find(c=>c.refId===quoteId&&c.type==="cotizacion");

  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <Sidebar {...sb} active="quotes"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <Breadcrumb items={[{label:"Inicio"},{label:"Cotizaciones",onClick:onBack},{label:quote.code}]}/>
          <Card padding="md" className="mt-4 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 flex-wrap"><span className="font-mono text-lg font-semibold">{quote.code}</span><Badge variant={quote.status}/><span className={clsx("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",quote.mode==="Dirigida"?"bg-blue-50 text-blue-700":"bg-orange-50 text-orange-700")}>{quote.mode}</span></div>
                <div className="flex gap-6 flex-wrap">{[["Fecha",quote.date],["País",quote.country],["Incoterm",quote.incoterm]].map(([k,v])=><div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="text-sm font-medium">{v}</p></div>)}{quote.mode==="Dirigida"&&<div><p className="text-xs text-muted-foreground">Empresa</p><p className="text-sm font-medium">{quote.importer}</p></div>}</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="secondary" size="sm" icon={<Edit2 className="w-3.5 h-3.5"/>}>Editar</Button>
                <Button variant="secondary" size="sm" icon={<Copy className="w-3.5 h-3.5"/>}>Duplicar</Button>
                {relChat&&<Button variant="secondary" size="sm" icon={<MessageSquare className="w-3.5 h-3.5"/>} onClick={()=>onOpenChat(relChat.id)}>Chat</Button>}
                <Button variant="danger" size="sm" icon={<Ban className="w-3.5 h-3.5"/>}>Cancelar</Button>
              </div>
            </div>
          </Card>
          <div className="flex gap-5 items-start">
            <div className="flex-1 min-w-0 space-y-5">
              <Card padding="md"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Tag className="w-4 h-4 text-primary"/>Información del producto</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">{[["Nombre",quote.product],["Línea",quote.productLine],["País",quote.country],["Calidad",quote.quality],["Descripción","Producto de alta demanda, especificaciones estándar."]].map(([k,v])=><div key={k} className={k==="Descripción"?"col-span-2":""}><p className="text-xs text-muted-foreground">{k}</p><p className="text-sm font-medium mt-0.5">{v}</p></div>)}</div>
              </Card>
              <Card padding="md"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Receipt className="w-4 h-4 text-primary"/>Información comercial</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">{[["MOQ",quote.minQuantity+" u"],["Precio objetivo",quote.targetPrice],["Incoterm",quote.incoterm],["Notas","Entrega en destino final preferida."]].map(([k,v])=><div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="text-sm font-medium mt-0.5">{v}</p></div>)}</div>
              </Card>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><ClipboardList className="w-4 h-4 text-primary"/>Ofertas recibidas{proposals.length>0&&<span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">{proposals.length}</span>}</h3>
                  {actionMessage&&<span className="text-xs text-emerald-600 font-medium">{actionMessage}</span>}
                </div>
                {loadingProposals?<Card padding="md" className="border-dashed"><div className="py-6 text-center"><Loader2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2 animate-spin"/><p className="text-sm text-muted-foreground">Cargando ofertas...</p></div></Card>:proposals.length===0?<Card padding="md" className="border-dashed"><div className="py-6 text-center"><ClipboardList className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2"/><p className="text-sm text-muted-foreground">Sin ofertas recibidas aún</p></div></Card>:(
                  <div className="space-y-3">{proposals.map(p=>{
                    const contactName=p.contacto_asesor?.nombre||"Asesor de la empresa";
                    const companyName=quote.importer;
                    return(
                      <Card key={p.id} padding="md" className="hover:shadow-md transition-shadow">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-sm">{companyName}</p>
                                <span className={clsx("px-2 py-0.5 rounded text-xs font-medium",p.estado==="aceptada"?"bg-emerald-50 text-emerald-700":p.estado==="rechazada"?"bg-rose-50 text-rose-700":"bg-amber-50 text-amber-700")}>{p.estado}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{contactName}</p>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                                <div><p className="text-[10px] text-muted-foreground uppercase">Precio</p><p className="text-sm font-semibold">{p.precio_ofrecido_usd} USD</p></div>
                                <div><p className="text-[10px] text-muted-foreground uppercase">Entrega</p><p className="text-sm font-semibold">{p.tiempo_estimado_entrega}</p></div>
                                <div><p className="text-[10px] text-muted-foreground uppercase">Incoterm</p><p className="text-sm font-semibold">{p.incoterm}</p></div>
                                <div><p className="text-[10px] text-muted-foreground uppercase">Contacto</p><p className="text-sm font-semibold">{p.contacto_asesor?.whatsapp||"—"}</p></div>
                              </div>
                              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{p.condiciones_adicionales||"Sin observaciones adicionales."}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                              {p.estado==="pendiente"?(
                                <>
                                  <Button variant="primary" size="sm" onClick={()=>void handleDecision(p.id,true)}>Aceptar</Button>
                                  <Button variant="secondary" size="sm" onClick={()=>void handleDecision(p.id,false)}>Rechazar</Button>
                                </>
                              ):(
                                <span className="text-xs text-muted-foreground">Acción registrada</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    );})}
                  </div>
                )}
              </div>
            </div>
            <div className="w-60 xl:w-64 flex-shrink-0 hidden lg:block space-y-4">
              <Card padding="md"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Línea de tiempo</h3><Timeline stages={QUOTE_TIMELINE}/></Card>
              {contactAsesor?<Card padding="md">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Asesor asignado</h3>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-2.5"><Avatar initials={initialsFromName(contactAsesor.nombre||"AS")} size="md"/><div><p className="text-sm font-semibold">{contactAsesor.nombre||"Asesor"}</p><p className="text-xs text-muted-foreground">Contacto de la propuesta</p><p className="text-xs text-muted-foreground">{contactAsesor.whatsapp||"Sin WhatsApp"}</p></div></div>
                  <div className="flex flex-col gap-1.5">
                    <ContactBtn type="chat" size="sm" className="w-full justify-center"/>
                    <ContactBtn type="whatsapp" size="sm" className="w-full justify-center"/>
                  </div>
                </div>
              </Card>:<Card padding="md" className="border-dashed"><div className="py-4 text-center"><p className="text-xs text-muted-foreground">Sin contacto de asesor todavía</p></div></Card>}
              {relChat&&<Card padding="md"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Chat asociado</h3><p className="text-xs text-muted-foreground mb-3">{quote.importer}</p><Button variant="secondary" size="sm" fullWidth icon={<MessageSquare className="w-3.5 h-3.5"/>} onClick={()=>onOpenChat(relChat.id)}>Abrir chat</Button></Card>}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE DETAIL — contextual back navigation
// ─────────────────────────────────────────────────────────────────────────────
function ResponseDetailScreen({responseId,from,fromQuoteId,onBack,onBackToQuote,onOpenChat,sb,responses,quotes,chats}:{
  responseId:string;from:ResponseFrom;fromQuoteId?:string;
  onBack:()=>void;onBackToQuote:(id:string)=>void;onOpenChat:(id:string)=>void;sb:SidebarCtrl;responses:QuoteResponse[];quotes:Quote[];chats:ChatConv[];
}) {
  const resp=responses.find(r=>r.id===responseId)||responses[0];
  if(!resp){
    return (
      <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
        <Sidebar {...sb} active="responses"/>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden"><AppHeader user={USER} sb={sb}/><main className="flex-1 overflow-y-auto px-6 py-6"><Card padding="lg" className="border-dashed"><p className="text-sm text-muted-foreground text-center">Respuesta no disponible.</p></Card></main></div>
      </div>
    );
  }
  const imp=IMPORTERS.find(i=>i.id===resp.importerId)||IMPORTERS[0];
  const quote=quotes.find(q=>q.id===resp.quoteId)||quotes[0];
  const relChat=chats.find(c=>c.importerId===resp.importerId&&(c.refId===resp.quoteId||c.type==="cotizacion"));
  const [accepting,setAccepting]=useState(false);
  const [acceptedByMe,setAcceptedByMe]=useState(resp.status==="resp-aceptada");
  const [acceptedByAdvisor,setAcceptedByAdvisor]=useState(resp.status==="resp-aceptada");
  const [orderCreated,setOrderCreated]=useState(resp.status==="resp-aceptada");
  async function handleAccept(){
    setAccepting(true);
    try{
      await businessService.preAcceptProposal(resp.id,true);
      setAcceptedByMe(true);
    }finally{
      setAccepting(false);
    }
  }
  const negotiationStages=[
    {label:"Cotización enviada",status:"done" as const,icon:<Send className="w-3.5 h-3.5"/>},
    {label:"Respuesta recibida",status:"done" as const,icon:<ClipboardList className="w-3.5 h-3.5"/>},
    {label:"Negociación activa",status:(acceptedByMe||acceptedByAdvisor)?"done":"current" as "done"|"current",icon:<Scale className="w-3.5 h-3.5"/>},
    {label:"Aceptación del solicitante",status:acceptedByMe?"done":"pending" as "done"|"pending",icon:<UserRound className="w-3.5 h-3.5"/>},
    {label:"Aceptación del asesor",status:acceptedByAdvisor?"done":"pending" as "done"|"pending",icon:<Users className="w-3.5 h-3.5"/>},
    {label:"Orden creada",status:orderCreated?"done":"pending" as "done"|"pending",icon:<ShoppingCart className="w-3.5 h-3.5"/>},
  ];

  const crumbs=from==="quote-detail"
    ?[{label:"Cotizaciones",onClick:()=>onBackToQuote(fromQuoteId||quote.id)},{label:quote.code,onClick:()=>onBackToQuote(fromQuoteId||quote.id)},{label:`Respuesta — ${imp.name}`}]
    :[{label:"Respuestas",onClick:onBack},{label:`Respuesta de ${imp.name}`}];

  const compRows=[
    {label:"Precio objetivo",target:quote.targetPrice,offer:resp.price,         result:"worse" as const},
    {label:"MOQ solicitado", target:quote.minQuantity+" u",offer:resp.moq,       result:"better"as const},
    {label:"Incoterm",       target:quote.incoterm,   offer:resp.incoterm,       result:(quote.incoterm===resp.incoterm?"equal":"worse")as"equal"|"worse"},
    {label:"Plazo estimado", target:"30 días",        offer:resp.deliveryTime,   result:"equal" as const},
  ];

  if(orderCreated){
    return (
      <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
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
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <Sidebar {...sb} active={from==="quote-detail"?"quotes":"responses"}/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <Breadcrumb items={[{label:"Inicio"},...crumbs]}/>
          <Card padding="md" className="mt-4 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-4 flex-1">
                <Avatar initials={imp.initials} size="xl" color={imp.color}/>
                <div>
                  <div className="flex items-center gap-2 flex-wrap"><h1 className="text-lg font-semibold">{imp.name}</h1>{imp.verified&&<span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium"><BadgeCheck className="w-3 h-3"/>Verificada</span>}<Badge variant={resp.status}/></div>
                  <p className="text-sm text-muted-foreground mt-0.5">{imp.specialty}</p>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap"><div className="flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400"/><span className="text-xs font-medium">{imp.rating}</span></div><div className="flex items-center gap-1 text-muted-foreground"><Clock className="w-3.5 h-3.5"/><span className="text-xs">{imp.responseTime}</span></div><div className="flex items-center gap-1 text-muted-foreground"><MapPin className="w-3.5 h-3.5"/><span className="text-xs">{imp.country}</span></div></div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Cotización: <span className="font-mono font-medium text-foreground">{quote.code}</span></p>
            </div>
          </Card>
          <div className="flex gap-5 items-start">
            <div className="flex-1 min-w-0 space-y-5">
              <Card padding="md"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><UserRound className="w-4 h-4 text-primary"/>Asesor asignado</h3>
                <div className="flex items-start gap-3 mb-4"><Avatar initials={imp.advisor.initials} size="xl" color={imp.advisor.color}/><div><p className="font-semibold">{imp.advisor.name}</p><p className="text-xs text-muted-foreground mt-0.5">{imp.advisor.role}</p><p className="text-xs text-primary mt-0.5">{imp.name}</p></div></div>
                <div className="flex gap-2">
                  <ContactBtn type="whatsapp"/>
                  <ContactBtn type="chat"/>
                  <ContactBtn type="email"/>
                </div>
              </Card>
              <Card padding="md"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary"/>Oferta comercial</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">{[["Precio unitario",resp.price],["MOQ",resp.moq],["Plazo",resp.deliveryTime],["Incoterm",resp.incoterm],["País de origen",resp.origin],["Producción",resp.production],["Personalización",resp.customization]].map(([k,v])=><div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="text-sm font-semibold mt-0.5">{v}</p></div>)}<div className="col-span-2 sm:col-span-3"><p className="text-xs text-muted-foreground">Observaciones</p><p className="text-sm mt-0.5 leading-relaxed">{resp.observations}</p></div></div>
                <div className="mt-4 pt-4 border-t border-border"><p className="text-xs text-muted-foreground mb-2">Archivos adjuntos</p>{["Ficha técnica.pdf","Certificado de origen.pdf"].map(f=><div key={f} className="flex items-center gap-2 py-1.5"><FileCheck className="w-4 h-4 text-primary flex-shrink-0"/><span className="text-sm text-primary hover:underline cursor-pointer">{f}</span></div>)}</div>
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
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Flujo de negociación</h3>
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
                  {!acceptedByMe&&<Button variant="danger" fullWidth icon={<X className="w-4 h-4"/>}>Rechazar</Button>}
                  <div className="pt-2 border-t border-border flex flex-col gap-1.5">
                    <Button variant="ghost" fullWidth icon={<ExternalLink className="w-3.5 h-3.5"/>} className="text-primary hover:text-blue-700 hover:bg-primary/5" onClick={()=>onBackToQuote(resp.quoteId)}>Ver cotización</Button>
                    {relChat&&<Button variant="ghost" fullWidth icon={<MessageSquare className="w-3.5 h-3.5"/>} className="text-foreground hover:bg-muted" onClick={()=>onOpenChat(relChat.id)}>Ver chat</Button>}
                  </div>
                </div>
              </Card>
              <Card padding="md"><div className="space-y-2">{[["Empresa",imp.name],["Miembro desde",imp.memberSince],["Proyectos",imp.projects.toString()],["Resp. prom.",imp.responseTime]].map(([k,v])=><div key={k} className="flex justify-between"><span className="text-xs text-muted-foreground">{k}</span><span className="text-xs font-medium text-right">{v}</span></div>)}</div></Card>
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
function ResponsesScreen({onViewDetail,sb,responses}:{onViewDetail:(id:string,from:ResponseFrom)=>void;sb:SidebarCtrl;responses:QuoteResponse[]}) {
  const [search,setSearch]=useState("");const[statusF,setStatusF]=useState("");const[empresaF,setEmpresaF]=useState("");
  const filtered=responses.filter(r=>{const imp=IMPORTERS.find(i=>i.id===r.importerId);const q=QUOTES.find(q=>q.id===r.quoteId);
    const ms=!search||[imp?.name||"",q?.product||"",r.price].some(v=>v.toLowerCase().includes(search.toLowerCase()));
    return ms&&(!statusF||r.status===statusF)&&(!empresaF||r.importerId===empresaF);
  });
  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <Sidebar {...sb} active="responses"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div>
            <Breadcrumb items={[{label:"Inicio"},{label:"Respuestas"}]}/>
            <div className="flex items-center justify-between mt-3">
              <div><h1 className="text-xl font-semibold tracking-tight">Respuestas</h1><p className="text-sm text-muted-foreground mt-0.5">Propuestas de importadores a tus cotizaciones.</p></div>
              {responses.filter(r=>r.status==="resp-nueva").length>0&&<span className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-xs font-medium text-orange-700"><Bell className="w-3.5 h-3.5"/>{responses.filter(r=>r.status==="resp-nueva").length} nuevas</span>}
            </div>
          </div>
          <Card padding="sm"><div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px]"><Input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} prefix={<Search className="w-4 h-4"/>}/></div>
            <div className="w-36"><Select value={statusF} onChange={e=>setStatusF(e.target.value)}><option value="">Estado</option><option value="resp-nueva">Nueva</option><option value="resp-vista">Vista</option><option value="resp-aceptada">Aceptada</option><option value="resp-rechazada">Rechazada</option></Select></div>
            <div className="w-44"><Select value={empresaF} onChange={e=>setEmpresaF(e.target.value)}><option value="">Empresa</option>{IMPORTERS.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</Select></div>
            {(search||statusF||empresaF)&&<Button variant="ghost" size="sm" onClick={()=>{setSearch("");setStatusF("");setEmpresaF("");}}>Limpiar</Button>}
          </div></Card>
          <div>
            <p className="text-sm text-muted-foreground mb-3"><span className="font-medium text-foreground">{filtered.length}</span> respuestas</p>
            {filtered.length===0?<Card padding="lg" className="border-dashed"><div className="flex flex-col items-center text-center py-8 gap-2"><ClipboardList className="w-10 h-10 text-muted-foreground/30"/><p className="font-medium">Sin respuestas</p><p className="text-sm text-muted-foreground">No hay propuestas registradas en backend para tus cotizaciones.</p></div></Card>:(
              <div className="space-y-3">{filtered.map(r=>{const imp=IMPORTERS.find(i=>i.id===r.importerId)||IMPORTERS[0];const q=QUOTES.find(q=>q.id===r.quoteId)||QUOTES[0];return(
                <Card key={r.id} padding="md" className="hover:shadow-md transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Avatar initials={imp.initials} size="xl" color={imp.color}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap"><p className="font-semibold">{imp.name}</p><Badge variant={r.status}/>{imp.verified&&<span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-medium"><BadgeCheck className="w-2.5 h-2.5"/>Verificada</span>}</div>
                        <p className="text-xs text-muted-foreground mt-0.5">{imp.specialty} · {imp.advisor.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Cotización: <span className="font-mono font-medium text-foreground">{q.code}</span></p>
                        <div className="flex gap-4 mt-2 flex-wrap">{[["Precio",r.price],["Plazo",r.deliveryTime],["Incoterm",r.incoterm],["Fecha",r.date]].map(([k,v])=><div key={k}><span className="text-xs text-muted-foreground">{k}: </span><span className="text-xs font-semibold">{v}</span></div>)}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap"><Button variant="secondary" size="sm" icon={<ExternalLink className="w-3 h-3"/>} onClick={()=>onViewDetail(r.id,"responses")}>Ver detalle</Button><Button variant="secondary" size="sm" icon={<GitCompare className="w-3 h-3"/>}>Comparar</Button><ContactBtn type="chat" size="sm" label="Contactar"/></div>
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
function OrdersScreen({onViewOrder,sb,orders}:{onViewOrder:(id:string)=>void;sb:SidebarCtrl;orders:Order[]}) {
  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <Sidebar {...sb} active="orders"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div><Breadcrumb items={[{label:"Inicio"},{label:"Órdenes"}]}/><h1 className="text-xl font-semibold tracking-tight mt-3">Órdenes</h1></div>
          {orders.length===0 ? (
            <Card padding="lg" className="border-dashed"><div className="flex flex-col items-center text-center py-8 gap-2"><ShoppingCart className="w-10 h-10 text-muted-foreground/30"/><p className="font-medium">Sin órdenes</p><p className="text-sm text-muted-foreground">No tienes órdenes activas en backend.</p></div></Card>
          ) : (
          <div className="space-y-3">{orders.map(ord=>{const imp=IMPORTERS.find(i=>i.id===ord.importerId)||IMPORTERS[0];return(
            <Card key={ord.id} padding="md" className="hover:shadow-md transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <Avatar initials={imp.initials} size="xl" color={imp.color}/>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap"><span className="font-mono font-semibold">{ord.code}</span><Badge variant="active-order"/></div>
                    <p className="text-sm font-medium mt-0.5">{ord.product}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{imp.name} · {ord.quantity}</p>
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
function OrderDetailScreen({orderId,onBack,onOpenChat,sb,orders}:{orderId:string;onBack:()=>void;onOpenChat:(id:string)=>void;sb:SidebarCtrl;orders:Order[]}) {
  const order=orders.find(o=>o.id===orderId)||orders[0];
  if(!order){
    return (
      <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
        <Sidebar {...sb} active="orders"/>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AppHeader user={USER} sb={sb}/>
          <main className="flex-1 overflow-y-auto px-6 py-6"><Card padding="lg" className="border-dashed"><p className="text-sm text-muted-foreground text-center">Orden no disponible.</p></Card></main>
        </div>
      </div>
    );
  }
  const imp=IMPORTERS.find(i=>i.id===order.importerId)||IMPORTERS[0];
  const advisor=imp.advisor;
  const relChatId = order.conversationId;
  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <Sidebar {...sb} active="orders"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <Breadcrumb items={[{label:"Inicio"},{label:"Órdenes",onClick:onBack},{label:order.code}]}/>
          <Card padding="md" className="mt-4 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 flex-wrap"><span className="font-mono text-lg font-semibold">{order.code}</span><Badge variant="active-order"/></div>
                <div className="flex gap-6 flex-wrap">{[["Empresa",imp.name],["Asesor",advisor.name],["Creada",order.created],["Entrega estimada",order.estimated]].map(([k,v])=><div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="text-sm font-medium">{v}</p></div>)}</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <ContactBtn type="whatsapp" label="Contactar asesor"/>
                <Button variant="secondary" size="sm" icon={<FolderOpen className="w-3.5 h-3.5"/>}>Ver documentos</Button>
                {relChatId&&<Button variant="secondary" size="sm" icon={<MessageSquare className="w-3.5 h-3.5"/>} onClick={()=>onOpenChat(relChatId)}>Chat</Button>}
                <Button variant="primary" size="sm" icon={<Navigation2 className="w-3.5 h-3.5"/>}>Ver seguimiento</Button>
              </div>
            </div>
          </Card>
          <div className="flex gap-5 items-start">
            <div className="flex-1 min-w-0 space-y-5">
              <Card padding="md"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Receipt className="w-4 h-4 text-primary"/>Resumen comercial</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">{[["Producto",order.product],["Cantidad",order.quantity],["Precio final",order.unitPrice],["Incoterm",order.incoterm],["Puerto de origen",order.originPort],["Puerto de destino",order.destPort],["Valor total",order.totalValue]].map(([k,v])=>(
                  <div key={k} className={k==="Puerto de origen"||k==="Puerto de destino"||k==="Producto"?"col-span-2 sm:col-span-1":""}><p className="text-xs text-muted-foreground">{k}</p><p className={clsx("text-sm font-medium mt-0.5",k==="Valor total"&&"text-primary font-semibold")}>{v}</p></div>
                ))}</div>
                <div className="mt-4 pt-3 border-t border-border flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-muted-foreground"/><span className="text-xs text-muted-foreground">Cotización origen:</span><span className="text-xs font-mono font-medium">{order.quoteCode}</span></div>
              </Card>
              <Card padding="md"><h3 className="text-sm font-semibold mb-5 flex items-center gap-2"><Truck className="w-4 h-4 text-primary"/>Estado logístico</h3><Timeline stages={ORDER_TIMELINE}/></Card>
              <Card padding="none">
                <div className="px-5 py-3.5 border-b border-border flex items-center justify-between"><h3 className="text-sm font-semibold flex items-center gap-2"><FolderOpen className="w-4 h-4 text-primary"/>Documentos</h3><span className="text-xs text-muted-foreground">{MOCK_DOCS.filter(d=>d.status==="Disponible").length} disponibles</span></div>
                <div className="divide-y divide-border/60">{MOCK_DOCS.map(doc=>(
                  <div key={doc.name} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3"><FileCheck className={clsx("w-4 h-4 flex-shrink-0",doc.status==="Disponible"?"text-primary":"text-muted-foreground/40")}/><div><p className="text-sm font-medium">{doc.name}</p><p className="text-xs text-muted-foreground">{doc.date}</p></div></div>
                    <div className="flex items-center gap-2">
                      <span className={clsx("text-xs font-medium px-2 py-0.5 rounded",doc.status==="Disponible"?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-500")}>{doc.status}</span>
                      {doc.status==="Disponible"&&<><Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5"/>} className="text-xs">Ver</Button><Button variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5"/>} className="text-xs">Descargar</Button></>}
                    </div>
                  </div>
                ))}</div>
              </Card>
              <Card padding="md"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-primary"/>Historial de eventos</h3>
                <div className="relative"><div className="absolute left-3 top-3 bottom-3 w-0.5 bg-border"/>
                  <div className="space-y-1">{ORDER_HISTORY.map((ev,i)=>(
                    <div key={i} className="flex items-start gap-3"><div className="w-6 h-6 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center flex-shrink-0 z-10 text-primary">{ev.icon}</div><div className="pb-4 flex-1 flex items-center justify-between"><p className="text-sm">{ev.label}</p><p className="text-xs text-muted-foreground">{ev.date}</p></div></div>
                  ))}</div>
                </div>
              </Card>
            </div>
            <div className="w-64 flex-shrink-0 hidden lg:block space-y-4">
              <Card padding="md"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Empresa importadora</h3>
                <div className="flex items-start gap-3 mb-4"><Avatar initials={imp.initials} size="xl" color={imp.color}/><div><div className="flex items-start gap-1"><p className="font-semibold text-sm">{imp.name}</p>{imp.verified&&<BadgeCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5"/>}</div><p className="text-xs text-muted-foreground mt-0.5">{imp.specialty}</p><div className="flex items-center gap-1 mt-1"><Star className="w-3 h-3 fill-amber-400 text-amber-400"/><span className="text-xs font-medium">{imp.rating}</span></div></div></div>
                <div className="space-y-1.5 pt-3 border-t border-border mb-3">{[["Años en plataforma","5+"],["Proyectos",imp.projects.toString()],["Resp. prom.",imp.responseTime]].map(([k,v])=><div key={k} className="flex justify-between"><span className="text-xs text-muted-foreground">{k}</span><span className="text-xs font-medium">{v}</span></div>)}</div>
                <Button variant="secondary" size="sm" fullWidth>Ver perfil</Button>
              </Card>
              <Card padding="md"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Asesor</h3>
                <div className="flex items-start gap-2.5 mb-3"><Avatar initials={advisor.initials} size="lg" color={advisor.color}/><div><p className="font-semibold text-sm">{advisor.name}</p><p className="text-xs text-muted-foreground mt-0.5">{advisor.role}</p></div></div>
                <div className="flex gap-1.5">
                  <ContactBtn type="whatsapp" label="WA" size="sm" className="flex-1 justify-center"/>
                  <ContactBtn type="chat" size="sm" className="flex-1 justify-center"/>
                  <ContactBtn type="email" label="Email" size="sm" className="flex-1 justify-center"/>
                </div>
              </Card>
              <Card padding="md" className="border-purple-100 bg-purple-50/40"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Estado actual</h3><div className="flex items-center gap-2 mb-1"><div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"/><span className="text-sm font-semibold text-purple-700">Carga en progreso</span></div><p className="text-xs text-muted-foreground">Última actualización: hace 3 horas</p></Card>
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
      <button className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"><Download className="w-3.5 h-3.5"/></button>
    </div>
  );
}

function ChatsScreen({onViewQuote,onViewOrder,sb,initialConvId,conversations,messagesByConversation,onSendMessage}:{onViewQuote:(id:string)=>void;onViewOrder:(id:string)=>void;sb:SidebarCtrl;initialConvId?:string;conversations:ChatConv[];messagesByConversation:Record<string,ChatMsg[]>;onSendMessage:(conversationId:string,contenido:string)=>Promise<void>}) {
  const [selectedId,setSelectedId]=useState<string|null>(initialConvId||conversations[0]?.id||null);
  const [filter,setFilter]=useState<"all"|"ordenes"|"cotizaciones"|"no-leidas">("all");
  const [searchConv,setSearchConv]=useState("");
  const [msgs,setMsgs]=useState<Record<string,ChatMsg[]>>(messagesByConversation);
  const [input,setInput]=useState("");
  const [sending,setSending]=useState(false);
  const [showCtx,setShowCtx]=useState(true);
  const messagesEndRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    setMsgs(messagesByConversation);
  },[messagesByConversation]);

  useEffect(()=>{
    if (!selectedId && conversations.length > 0) {
      setSelectedId(initialConvId || conversations[0].id);
    }
  }, [selectedId, conversations, initialConvId]);

  const conv=selectedId?conversations.find(c=>c.id===selectedId)||null:null;
  const imp=conv?IMPORTERS.find(i=>i.id===conv.importerId)||IMPORTERS[0]:null;

  const filteredConvs=conversations.filter(c=>{
    if(filter==="ordenes"&&c.type!=="orden")return false;
    if(filter==="cotizaciones"&&c.type!=="cotizacion")return false;
    if(filter==="no-leidas"&&c.unread===0)return false;
    if(searchConv){
      const cImp=IMPORTERS.find(i=>i.id===c.importerId);
      const q=c.type==="cotizacion"?QUOTES.find(q=>q.id===c.refId):null;
      const ord=c.type==="orden"?MOCK_ORDERS.find(o=>o.id===c.refId):null;
      const terms=[c.refCode,cImp?.name||"",cImp?.advisor.name||"",q?.product||"",ord?.product||""];
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

  function handleKey(e:React.KeyboardEvent){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMsg();}}

  const convMsgs=selectedId?msgs[selectedId]||[]:[];

  const refQuote=conv?.type==="cotizacion"?QUOTES.find(q=>q.id===conv.refId)||null:null;
  const refOrderId=conv?.type==="orden"?conv.refId:null;

  const FILTERS=[{k:"all",label:"Todas"},{k:"ordenes",label:"Órdenes"},{k:"cotizaciones",label:"Cotizaciones"},{k:"no-leidas",label:"No leídas"}] as const;

  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <Sidebar {...sb} active="chats"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <div className="flex-1 flex overflow-hidden">

          {/* ── Left: conversation list ─────────────────────────────────── */}
          <div className="w-72 flex-shrink-0 border-r border-border bg-white flex flex-col">
            <div className="px-3 pt-3 pb-2 border-b border-border">
              <Input placeholder="Buscar por código, empresa, asesor..." value={searchConv} onChange={e=>setSearchConv(e.target.value)} prefix={<Search className="w-3.5 h-3.5"/>}/>
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
                const cImp=IMPORTERS.find(i=>i.id===c.importerId)||IMPORTERS[0];
                const isSelected=selectedId===c.id;
                return (
                  <button key={c.id} onClick={()=>setSelectedId(c.id)}
                    className={clsx("w-full text-left px-3 py-3 border-b border-border/50 transition-colors flex gap-2.5",
                      isSelected?"bg-primary/5 border-l-2 border-l-primary":"hover:bg-muted/50")}>
                    <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                      c.type==="orden"?"bg-purple-50 text-purple-600":"bg-blue-50 text-blue-600")}>
                      {c.type==="orden"?<ShoppingCart className="w-4 h-4"/>:<FileText className="w-4 h-4"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <p className={clsx("text-xs font-semibold truncate",isSelected?"text-primary":"text-foreground")}>{c.refCode}</p>
                          <p className="text-xs text-muted-foreground truncate">{cImp.name}</p>
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
                <Avatar initials={imp!.initials} size="md" color={imp!.color}/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-foreground">{imp!.advisor.name}</p>
                    <span className="text-muted-foreground/40 text-xs">·</span>
                    <p className="text-xs text-muted-foreground">{imp!.name}</p>
                    <span className={clsx("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                      conv.type==="orden"?"bg-purple-50 text-purple-700":"bg-blue-50 text-blue-700")}>
                      {conv.type==="orden"?"Orden":"Cotización"} · {conv.refCode}
                    </span>
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
                        {!isClient&&<Avatar initials={imp!.advisor.initials} size="sm" color={imp!.color}/>}
                        <div className={clsx("max-w-[70%] flex flex-col gap-1",isClient?"items-end":"items-start")}>
                          {msg.file&&<FileAttachmentBubble file={msg.file}/>}
                          {msg.text&&(
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
                <div className="flex items-end gap-2">
                  <div className="flex gap-1 pb-1">
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Adjuntar archivo"><Paperclip className="w-4 h-4"/></button>
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Adjuntar imagen"><ImageIcon className="w-4 h-4"/></button>
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Emoji"><Smile className="w-4 h-4"/></button>
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
                    className={clsx("w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0 mb-0.5",
                      input.trim()?"bg-primary text-white hover:bg-blue-700 shadow-sm":"bg-muted text-muted-foreground cursor-not-allowed")}>
                    <Send className="w-4 h-4"/>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Right: context panel ────────────────────────────────────── */}
          {conv&&showCtx&&(
            <div className="w-56 flex-shrink-0 border-l border-border bg-white overflow-y-auto flex flex-col">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contexto</p>
              </div>
              <div className="p-3 space-y-3 flex-1">
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Empresa</p>
                  <div className="flex items-center gap-2"><Avatar initials={imp!.initials} size="sm" color={imp!.color}/><div><p className="text-xs font-semibold">{imp!.name}</p><div className="flex items-center gap-1"><Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400"/><span className="text-[10px] text-muted-foreground">{imp!.rating}</span></div></div></div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Asesor</p>
                  <div className="flex items-center gap-2"><Avatar initials={imp!.advisor.initials} size="sm" color={imp!.advisor.color}/><div><p className="text-xs font-semibold">{imp!.advisor.name}</p><p className="text-[10px] text-muted-foreground">{imp!.advisor.role}</p></div></div>
                  <div className="flex gap-1 mt-2">
                    <button className="flex-1 h-7 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-medium flex items-center justify-center gap-1 hover:bg-emerald-100 transition-colors"><Phone className="w-2.5 h-2.5"/>WA</button>
                    <button className="flex-1 h-7 rounded-lg border border-border bg-white text-[10px] font-medium flex items-center justify-center gap-1 hover:bg-muted transition-colors text-foreground"><MailIcon className="w-2.5 h-2.5"/>Email</button>
                  </div>
                </div>
                <div className="border-t border-border"/>
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
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Orden</p>
                    <div className="space-y-1.5">{[["Código",`ORD-${refOrderId.slice(0, 8).toUpperCase()}`],["Estado","En seguimiento"],["Canal","Chat API"]].map(([k,v])=>(
                      <div key={k} className="flex justify-between items-start gap-1"><span className="text-[10px] text-muted-foreground">{k}</span><span className="text-[10px] font-medium text-foreground text-right">{v}</span></div>
                    ))}</div>
                    <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 border border-purple-100 rounded-lg">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse flex-shrink-0"/>
                      <span className="text-[10px] font-semibold text-purple-700">Carga en progreso</span>
                    </div>
                    <Button variant="secondary" size="sm" fullWidth className="mt-2 text-xs" onClick={()=>onViewOrder(refOrderId)}>Ver orden</Button>
                  </div>
                </>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTOS + PAGOS placeholders
// ─────────────────────────────────────────────────────────────────────────────
function DocumentosScreen({sb}:{sb:SidebarCtrl}) {
  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <Sidebar {...sb} active="documentos"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6"><Breadcrumb items={[{label:"Inicio"},{label:"Documentos"}]}/><h1 className="text-xl font-semibold tracking-tight mt-3 mb-6">Documentos</h1>
          <Card padding="lg" className="border-dashed max-w-lg"><div className="flex flex-col items-center text-center py-8 gap-3"><div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center"><FolderOpen className="w-6 h-6 text-muted-foreground/50"/></div><div><p className="font-semibold">Módulo en construcción</p><p className="text-sm text-muted-foreground mt-1 leading-relaxed">Facturas, certificados y documentos aduaneros próximamente.</p></div><span className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-medium text-amber-700">Próximamente</span></div></Card>
        </main>
      </div>
    </div>
  );
}

function PagosScreen({sb}:{sb:SidebarCtrl}) {
  if (!SHOW_PAYMENTS_MODULE) {
    return (
      <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
        <Sidebar {...sb} active="pagos"/>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AppHeader user={USER} sb={sb}/>
          <main className="flex-1 overflow-y-auto px-6 py-6"><Breadcrumb items={[{label:"Inicio"},{label:"Pagos"}]}/><h1 className="text-xl font-semibold tracking-tight mt-3 mb-6">Pagos</h1>
            <Card padding="lg" className="border-dashed max-w-lg"><div className="flex flex-col items-center text-center py-8 gap-3"><div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center"><CreditCard className="w-6 h-6 text-muted-foreground/50"/></div><div><p className="font-semibold">Módulo en construcción</p><p className="text-sm text-muted-foreground mt-1 leading-relaxed">Próximamente habilitaremos pagos y conciliaciones para órdenes.</p></div><span className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-medium text-amber-700">Próximamente</span></div></Card>
          </main>
        </div>
      </div>
    );
  }

  const mp=[{id:"PAG-001",amount:"$4,600 USD",concept:"Orden #ORD-2025-0042",date:"10 Mar 2025",status:"Completado"},{id:"PAG-002",amount:"$3,200 USD",concept:"Orden #ORD-2025-0038",date:"02 Mar 2025",status:"Pendiente"},{id:"PAG-003",amount:"$8,900 USD",concept:"Orden #ORD-2025-0031",date:"22 Feb 2025",status:"Parcial"}];
  const sc:Record<string,string>={"Completado":"bg-emerald-50 text-emerald-700","Pendiente":"bg-orange-50 text-orange-700","Parcial":"bg-blue-50 text-blue-700"};
  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <Sidebar {...sb} active="pagos"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div><Breadcrumb items={[{label:"Inicio"},{label:"Pagos"}]}/><div className="flex items-center justify-between mt-3"><h1 className="text-xl font-semibold">Pagos</h1><span className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-700">Módulo en definición · Integración Wompi pendiente</span></div></div>
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

interface QuoteFormState {productName:string;description:string;referenceLink:string;country:string;productLine:string;quality:string;customization:string;purpose:"ecommerce"|"corporativo";minQuantity:string;targetPrice:string;incoterm:string;notes:string;}
const EMPTY_FORM:QuoteFormState={productName:"",description:"",referenceLink:"",country:"",productLine:"",quality:"",customization:"",purpose:"ecommerce",minQuantity:"",targetPrice:"",incoterm:"",notes:""};

function Step1({modalidad,setModalidad,selectedId,setSelectedId,preselectedId,importers}:{modalidad:"dirigida"|"abierta"|null;setModalidad:(m:"dirigida"|"abierta")=>void;selectedId:string|null;setSelectedId:(id:string|null)=>void;preselectedId?:string;importers:Importer[]}) {
  const [cs,setCs]=useState("");const[cc,setCc]=useState("");const[ccat,setCcat]=useState("");const[cr,setCr]=useState("");
  const fi=importers.filter(imp=>{const ms=!cs||imp.name.toLowerCase().includes(cs.toLowerCase());const mc=!cc||imp.country===cc;const mcat=!ccat||imp.categories.some(c=>c.toLowerCase().includes(ccat.toLowerCase()));const mr=!cr||imp.rating>=parseFloat(cr);return ms&&mc&&mcat&&mr;});
  const hasF=cs||cc||ccat||cr;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[{m:"dirigida"as const,icon:Building2,title:"Cotización dirigida",desc:"Elige una empresa importadora específica para enviar directamente tu solicitud."},{m:"abierta"as const,icon:Globe,title:"Cotización abierta",desc:"La solicitud se distribuirá automáticamente entre importadores compatibles."}].map(({m,icon:Icon,title,desc})=>(
        <button key={m} onClick={()=>{setModalidad(m);if(m==="abierta")setSelectedId(null);}} className={clsx("p-5 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-md",modalidad===m?"border-primary bg-primary/5 shadow-md":"border-border bg-white hover:border-primary/40")}>
          <div className={clsx("w-10 h-10 rounded-lg flex items-center justify-center mb-3",modalidad===m?"bg-primary":"bg-muted")}><Icon className={clsx("w-5 h-5",modalidad===m?"text-white":"text-muted-foreground")}/></div>
          <h3 className="font-semibold text-sm mb-1.5">{title}</h3><p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
          {modalidad===m&&<div className="mt-3 flex items-center gap-1 text-xs text-primary font-medium"><Check className="w-3.5 h-3.5"/>Seleccionada</div>}
        </button>
      ))}</div>
      {modalidad==="dirigida"&&<div>
        <h3 className="text-sm font-semibold mb-3">Selecciona una importadora</h3>
        <Card padding="sm" className="mb-4"><div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[140px]"><Input placeholder="Buscar empresa..." value={cs} onChange={e=>setCs(e.target.value)} prefix={<Search className="w-4 h-4"/>}/></div>
          <div className="w-32"><Select value={cc} onChange={e=>setCc(e.target.value)}><option value="">País</option>{[...new Set(importers.map(i=>i.country))].map(c=><option key={c}>{c}</option>)}</Select></div>
          <div className="w-36"><Select value={ccat} onChange={e=>setCcat(e.target.value)}><option value="">Categoría</option>{[...new Set(importers.flatMap(i=>i.categories))].map(c=><option key={c}>{c}</option>)}</Select></div>
          <div className="w-40"><Select value={cr} onChange={e=>setCr(e.target.value)}><option value="">Calificación mín.</option><option value="4.9">⭐ 4.9+</option><option value="4.7">⭐ 4.7+</option><option value="4.5">⭐ 4.5+</option></Select></div>
          {hasF&&<Button variant="ghost" size="sm" icon={<RotateCcw className="w-3.5 h-3.5"/>} onClick={()=>{setCs("");setCc("");setCcat("");setCr("");}}>Limpiar</Button>}
        </div></Card>
        {fi.length===0?<Card padding="lg" className="border-dashed"><div className="py-6 text-center"><p className="text-sm text-muted-foreground">No se encontraron empresas</p></div></Card>:(
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">{fi.map(imp=>{const sel=selectedId===imp.id;return(
            <div key={imp.id} onClick={()=>setSelectedId(sel?null:imp.id)} className={clsx("relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200",sel?"border-primary shadow-lg bg-white":"border-border bg-white hover:border-primary/40 hover:shadow-md")}>
              {sel&&<div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center"><Check className="w-3 h-3 text-white"/></div>}
              <div className="flex items-start gap-3 mb-3"><Avatar initials={imp.initials} size="lg" color={imp.color}/><div className="min-w-0"><div className="flex items-start gap-1"><p className="font-semibold text-sm leading-tight">{imp.name}</p>{imp.verified&&<BadgeCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5"/>}</div><p className="text-xs text-muted-foreground mt-0.5 leading-tight">{imp.specialty}</p><p className="text-xs text-muted-foreground/70 mt-0.5">{imp.country}</p></div></div>
              <div className="flex items-center justify-between text-xs mb-3"><div className="flex items-center gap-1"><Star className="w-3 h-3 fill-amber-400 text-amber-400"/><span className="font-medium">{imp.rating}</span></div><div className="flex items-center gap-1 text-muted-foreground"><Clock className="w-3 h-3"/><span>{imp.responseTime}</span></div></div>
              <button onClick={e=>{e.stopPropagation();setSelectedId(sel?null:imp.id);}} className={clsx("w-full h-8 rounded-lg text-xs font-medium transition-all",sel?"bg-primary text-white":"bg-muted text-foreground hover:bg-primary/10")}>{sel?"Seleccionada":"Seleccionar"}</button>
            </div>
          );})}</div>
        )}
      </div>}
    </div>
  );
}

function RightPanel({step,modalidad,si,form}:{step:number;modalidad:"dirigida"|"abierta"|null;si:Importer|null;form:QuoteFormState}) {
  const Summary=()=>(<Card padding="md"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Resumen</h3><div className="space-y-2">{[["Producto",form.productName],["País",form.country],["Calidad",form.quality],["Cantidad",form.minQuantity?`${form.minQuantity} u`:""],["Incoterm",form.incoterm]].map(([k,v])=><div key={k} className="flex justify-between items-start gap-2"><span className="text-xs text-muted-foreground flex-shrink-0">{k}</span><span className="text-xs font-medium text-right">{v||<span className="italic text-muted-foreground/50">—</span>}</span></div>)}</div></Card>);
  if(modalidad==="dirigida"&&si)return(<div className="space-y-4">
    <Card padding="md"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Empresa seleccionada</h3><div className="flex items-start gap-3 mb-3"><Avatar initials={si.initials} size="xl" color={si.color}/><div><p className="font-semibold text-sm">{si.name}</p><p className="text-xs text-muted-foreground mt-0.5">{si.specialty}</p><div className="flex items-center gap-1 mt-1"><Star className="w-3 h-3 fill-amber-400 text-amber-400"/><span className="text-xs font-medium">{si.rating}</span></div></div></div><div className="space-y-1.5 pt-3 border-t border-border">{[["Miembro desde",si.memberSince],["Proyectos",si.projects.toString()],["Respuesta",si.responseTime]].map(([k,v])=><div key={k} className="flex justify-between"><span className="text-xs text-muted-foreground">{k}</span><span className="text-xs font-medium">{v}</span></div>)}</div></Card>
    <Card padding="md"><h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Asesor</h3><div className="flex items-start gap-2.5 mb-3"><Avatar initials={si.advisor.initials} size="lg" color={si.advisor.color}/><div><p className="font-semibold text-sm">{si.advisor.name}</p><p className="text-xs text-muted-foreground mt-0.5">{si.advisor.role}</p></div></div><div className="flex gap-2"><ContactBtn type="whatsapp" label="WA" size="sm" className="flex-1 justify-center"/><ContactBtn type="chat" size="sm" className="flex-1 justify-center"/></div></Card>
    {step>=2&&<Summary/>}
    {step===3&&<Card padding="md" className="border-primary/20 bg-primary/5"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary animate-pulse"/><span className="text-xs font-semibold text-primary">Lista para enviar</span></div></Card>}
  </div>);
  if(modalidad==="abierta"){if(step===1)return(<Card padding="md"><div className="flex items-center gap-2 mb-3"><div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><Globe className="w-4 h-4 text-primary"/></div><h3 className="text-sm font-semibold">¿Cómo funciona?</h3></div><div className="space-y-3">{[{i:Send,t:"Tu solicitud llega a importadores activos compatibles."},{i:Users,t:"Múltiples empresas enviarán propuestas."},{i:CheckCircle2,t:"Compara y decide con cuál continuar."}].map(({i:Icon,t},idx)=><div key={idx} className="flex items-start gap-2.5"><div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5"><Icon className="w-3 h-3 text-primary"/></div><p className="text-xs text-muted-foreground leading-relaxed">{t}</p></div>)}</div></Card>);
  return(<div className="space-y-4"><Summary/>{step===3&&<Card padding="md"><div className="space-y-2">{[["Empresas potenciales","23 activas"],["País",form.country||"—"],["Categoría",form.productLine||"—"]].map(([k,v])=><div key={k} className="flex justify-between"><span className="text-xs text-muted-foreground">{k}</span><span className="text-xs font-semibold">{v}</span></div>)}<div className="pt-2 border-t border-border flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"/><span className="text-xs font-semibold text-orange-600">Esperando propuestas</span></div></div></Card>}</div>);}
  return(<Card padding="md" className="border-dashed"><div className="flex flex-col items-center text-center py-4 gap-2"><div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"><Building className="w-5 h-5 text-muted-foreground/40"/></div><p className="text-sm text-muted-foreground">Selecciona una modalidad.</p></div></Card>);
}

function Step2({form,setForm}:{form:QuoteFormState;setForm:React.Dispatch<React.SetStateAction<QuoteFormState>>}) {
  const [dragOver,setDragOver]=useState(false);const[fn,setFn]=useState<string|null>(null);
  const upd=(f:keyof QuoteFormState,v:string)=>setForm(p=>({...p,[f]:v}));
  return (
    <div className="space-y-5">
      <Card padding="md"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Tag className="w-4 h-4 text-primary"/>Información del producto</h3>
        <div className="space-y-4">
          <div><p className="text-sm font-medium mb-1.5">Foto <span className="text-xs text-muted-foreground font-normal">(opcional)</span></p>
            <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)setFn(f.name);}} className={clsx("border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",dragOver?"border-primary bg-primary/5":"border-border hover:border-primary/40 hover:bg-muted/30")}>
              {fn?<div className="flex items-center justify-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500"/><span className="text-sm font-medium">{fn}</span><button onClick={()=>setFn(null)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4"/></button></div>:<><Upload className="w-6 h-6 text-muted-foreground/50 mx-auto mb-2"/><p className="text-sm text-muted-foreground">Arrastra o <span className="text-primary font-medium">busca en tu equipo</span></p><p className="text-xs text-muted-foreground/60 mt-1">PNG, JPG hasta 10 MB</p></>}
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
            <Input label="Cantidad mínima" placeholder="Ej. 500" type="number" value={form.minQuantity} onChange={e=>upd("minQuantity",e.target.value)} hint="En unidades"/>
            <Input label="Precio objetivo" placeholder="Ej. 8.50 USD/u" value={form.targetPrice} onChange={e=>upd("targetPrice",e.target.value)}/>
            <Select label="Incoterm" value={form.incoterm} onChange={e=>upd("incoterm",e.target.value)}><option value="">Seleccionar</option>{INCOTERMS.map(t=><option key={t}>{t}</option>)}</Select>
          </div>
          <Textarea label="Notas" placeholder="Información adicional..." rows={3} value={form.notes} onChange={e=>upd("notes",e.target.value)}/>
        </div>
      </Card>
    </div>
  );
}

function Step3Dirigida({form,importer,confirmed,setConfirmed}:{form:QuoteFormState;importer:Importer;confirmed:boolean;setConfirmed:(v:boolean)=>void}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="w-5 h-5 text-primary"/><h2 className="text-base font-semibold">Revisa tu solicitud</h2></div>
      {[{title:"Empresa",icon:Building2,rows:[["Importadora",importer.name],["Especialidad",importer.specialty]]},{title:"Asesor",icon:UserRound,rows:[["Nombre",importer.advisor.name],["Cargo",importer.advisor.role]]},{title:"Producto",icon:Tag,rows:[["Nombre",form.productName||"—"],["País",form.country||"—"],["Calidad",form.quality||"—"]]},{title:"Importación",icon:MapPin,rows:[["Propósito",form.purpose==="ecommerce"?"Ecommerce":"Corporativo"],["Cantidad",form.minQuantity?`${form.minQuantity} u`:"—"],["Precio objetivo",form.targetPrice||"—"],["Incoterm",form.incoterm||"—"]]}].map(({title,icon:Icon,rows})=>(
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

function NewQuoteScreen({onBack,sb,preselectedImporterId,importers,onSubmitQuote}:{onBack:()=>void;sb:SidebarCtrl;preselectedImporterId?:string;importers:Importer[];onSubmitQuote:(payload:CreateCotizacionPayload)=>Promise<void>}) {
  const [step,setStep]=useState(1);
  const [modalidad,setModalidad]=useState<"dirigida"|"abierta"|null>(preselectedImporterId?"dirigida":null);
  const [selectedId,setSelectedId]=useState<string|null>(preselectedImporterId||null);
  const [form,setForm]=useState<QuoteFormState>(EMPTY_FORM);
  const [confirmed,setConfirmed]=useState(false);const[stepError,setStepError]=useState("");
  const [submitted,setSubmitted]=useState(false);const[submitting,setSubmitting]=useState(false);
  const [visible,setVisible]=useState(true);const[pendingStep,setPendingStep]=useState<number|null>(null);const[direction,setDirection]=useState<"fwd"|"back">("fwd");
  const si=importers.find(i=>i.id===selectedId)??null;
  const navigate=useCallback((ns:number,dir:"fwd"|"back")=>{setDirection(dir);setVisible(false);setPendingStep(ns);},[]);
  useEffect(()=>{if(!visible&&pendingStep!==null){const t=setTimeout(()=>{setStep(pendingStep);setPendingStep(null);setVisible(true);setStepError("");},180);return()=>clearTimeout(t);}},[visible,pendingStep]);
  function goNext(){if(step===1){if(!modalidad){setStepError("Selecciona una modalidad.");return;}if(modalidad==="dirigida"&&!selectedId){setStepError("Selecciona una empresa importadora.");return;}}if(step===2&&!form.productName.trim()){setStepError("El nombre del producto es requerido.");return;}setStepError("");navigate(step+1,"fwd");}
  async function handleSubmit(){
    if(modalidad==="dirigida"&&!confirmed){setStepError("Debes confirmar la información.");return;}
    if(!modalidad){setStepError("Selecciona una modalidad.");return;}

    const parsedMinQuantity=Number.parseInt(form.minQuantity,10);
    if(Number.isNaN(parsedMinQuantity)||parsedMinQuantity<1){setStepError("La cantidad mínima debe ser mayor a 0.");return;}

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
      pais_importacion:form.country,
      nombre_producto:form.productName,
      descripcion_cliente:(form.description||"").length>=10?form.description:`${form.description}...`,
      link_referencia:form.referenceLink||undefined,
      linea_producto:form.productLine,
      tipo_calidad:tipoCalidad,
      nivel_personalizacion:form.customization||undefined,
      modalidad_importacion:form.purpose,
      cantidad_minima:parsedMinQuantity,
      precio_objetivo_usd:Number.isFinite(parsedTarget as number)?parsedTarget:undefined,
      incoterm:form.incoterm,
      notas_adicionales:form.notes||undefined,
    };

    try{
      setSubmitting(true);
      setStepError("");
      await onSubmitQuote(payload);
      setSubmitted(true);
    }catch(error){
      setStepError(error instanceof Error?error.message:"No se pudo crear la cotización.");
    }finally{
      setSubmitting(false);
    }
  }
  const slideStyle:React.CSSProperties={opacity:visible?1:0,transform:visible?"translateX(0)":direction==="fwd"?"translateX(12px)":"translateX(-12px)",transition:"opacity 180ms ease,transform 180ms ease"};
  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <Sidebar {...sb} active="quotes"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        {submitted?(<div className="flex-1 flex items-center justify-center p-6"><div className="flex flex-col items-center text-center gap-4 max-w-sm"><div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center"><CheckCircle2 className="w-7 h-7 text-emerald-500"/></div><div><h2 className="text-lg font-semibold">Solicitud enviada</h2><p className="text-sm text-muted-foreground mt-1 leading-relaxed">Tu cotización ha sido registrada exitosamente.</p></div><Button variant="primary" onClick={onBack}>Ver mis cotizaciones</Button></div></div>):(
          <main className="flex-1 overflow-y-auto px-6 py-6">
            <Breadcrumb items={[{label:"Inicio"},{label:"Cotizaciones",onClick:onBack},{label:"Nueva cotización"}]}/>
            <h1 className="text-xl font-semibold mt-3">Nueva cotización</h1><p className="text-sm text-muted-foreground mt-1 mb-7">Solicita una nueva cotización para importar productos desde proveedores internacionales.</p>
            <div className="mb-8"><Stepper current={step}/></div>
            <div className="flex gap-6 items-start">
              <div className="flex-1 min-w-0">
                <div style={slideStyle}>{step===1&&<Step1 modalidad={modalidad} setModalidad={m=>{setModalidad(m);setStepError("");}} selectedId={selectedId} setSelectedId={setSelectedId} preselectedId={preselectedImporterId} importers={importers}/>}{step===2&&<Step2 form={form} setForm={setForm}/>}{step===3&&modalidad==="dirigida"&&si&&<Step3Dirigida form={form} importer={si} confirmed={confirmed} setConfirmed={setConfirmed}/>}{step===3&&modalidad==="abierta"&&<Step3Abierta/>}</div>
                {stepError&&<div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg"><AlertCircle className="w-4 h-4 text-destructive flex-shrink-0"/><p className="text-sm text-destructive">{stepError}</p></div>}
                <div className="flex items-center justify-between mt-8 pt-5 border-t border-border">
                  <div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={onBack}>Cancelar</Button>{step>1&&<Button variant="secondary" size="sm" icon={<ChevronLeft className="w-3.5 h-3.5"/>} onClick={()=>navigate(step-1,"back")}>Anterior</Button>}</div>
                  <div className="flex items-center gap-2"><Button variant="secondary" size="sm" icon={<Save className="w-3.5 h-3.5"/>}>Guardar borrador</Button>{step<3?<Button variant="primary" size="md" iconRight={<ChevronRight className="w-4 h-4"/>} onClick={goNext}>Continuar</Button>:<Button variant="primary" size="md" icon={<Send className="w-4 h-4"/>} loading={submitting} onClick={handleSubmit}>Solicitar cotización</Button>}</div>
                </div>
              </div>
              <div className="w-64 xl:w-72 flex-shrink-0 hidden lg:block"><RightPanel step={step} modalidad={modalidad} si={si} form={form}/></div>
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
function NotificationsScreen({notifications,onMark,onBack,sb}:{notifications:AppNotification[];onMark:(id:string)=>void;onBack:()=>void;sb:SidebarCtrl}) {
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
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
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
            {notifications.map(n=>(
              <div key={n.id} onClick={()=>onMark(n.id)} className={clsx("flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-muted/50 transition-colors",!n.read&&"bg-blue-50/40")}>
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">{NOTIF_ICON[n.type]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={clsx("text-sm",!n.read?"font-semibold text-foreground":"font-medium text-foreground/80")}>{n.title}</p>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{n.date}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                </div>
                {!n.read&&<span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5"/>}
              </div>
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
function ImporterDashboardScreen({sb,quotes,advisors}:{sb:SidebarCtrl;quotes:Quote[];advisors:CompanyAdvisor[]}) {
  const activeQuotesCount = quotes.filter(q=>q.status!=="active-order").length;
  const assignedQuotesCount = quotes.filter(q=>q.mode==="Dirigida").length;
  const activeAdvisors = advisors.filter(a=>a.status==="activo").length;
  const metrics=[
    {label:"Cotizaciones pendientes",value:String(activeQuotesCount),delta:"Dato API",icon:<FileText className="w-5 h-5"/>,color:"text-blue-600",bg:"bg-blue-50"},
    {label:"Cotizaciones asignadas",value:String(assignedQuotesCount),delta:"Dato API",icon:<Users className="w-5 h-5"/>,color:"text-purple-600",bg:"bg-purple-50"},
    {label:"Respuestas enviadas",value:"N/D",delta:"Sin endpoint",icon:<Send className="w-5 h-5"/>,color:"text-emerald-600",bg:"bg-emerald-50"},
    {label:"Órdenes activas",value:"N/D",delta:"Sin endpoint",icon:<ShoppingCart className="w-5 h-5"/>,color:"text-amber-600",bg:"bg-amber-50"},
    {label:"Chats activos",value:"N/D",delta:"Sin endpoint",icon:<MessageSquare className="w-5 h-5"/>,color:"text-rose-600",bg:"bg-rose-50"},
    {label:"Tiempo prom. respuesta",value:"N/D",delta:"Sin endpoint",icon:<Clock className="w-5 h-5"/>,color:"text-cyan-600",bg:"bg-cyan-50"},
    {label:"Asesores conectados",value:`${activeAdvisors}/${advisors.length}`,delta:"Dato API",icon:<Zap className="w-5 h-5"/>,color:"text-lime-600",bg:"bg-lime-50"},
  ];
  const recentActivity: {text:string;time:string;icon:React.ReactNode}[] = [];
  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <Sidebar {...sb} active="imp-dashboard"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER_IMPORTADORA} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div>
            <Breadcrumb items={[{label:"Inicio"},{label:"Dashboard"}]}/>
            <h1 className="text-xl font-semibold mt-3">Panel de la empresa</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Grupo Nexus S.A. — Resumen de actividad</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((m,i)=>(
              <Card key={i} padding="md" className="flex items-start gap-3">
                <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",m.bg,m.color)}>{m.icon}</div>
                <div className="min-w-0">
                  <p className="text-xl font-bold text-foreground leading-none">{m.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{m.label}</p>
                  <p className={clsx("text-xs mt-1 font-medium",m.color)}>{m.delta}</p>
                </div>
              </Card>
            ))}
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card padding="none">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <h2 className="font-semibold text-sm">Cotizaciones recientes</h2>
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
                  {quotes.length===0&&<div className="px-5 py-8 text-sm text-muted-foreground text-center">Sin cotizaciones disponibles.</div>}
                </div>
              </Card>
            </div>
            <div className="space-y-4">
              <Card padding="none">
                <div className="px-5 py-4 border-b border-border"><h2 className="font-semibold text-sm">Actividad reciente</h2></div>
                <div className="px-5 py-3 space-y-3">
                  {recentActivity.map((a,i)=>(
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">{a.icon}</div>
                      <div>
                        <p className="text-xs text-foreground leading-relaxed">{a.text}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{a.time}</p>
                      </div>
                    </div>
                  ))}
                  {recentActivity.length===0&&<p className="text-xs text-muted-foreground">Sin actividad reciente disponible en API.</p>}
                </div>
              </Card>
              <Card padding="md">
                <p className="text-sm font-semibold mb-3">Accesos rápidos</p>
                <div className="space-y-2">
                  <Button variant="secondary" size="sm" fullWidth icon={<Users className="w-3.5 h-3.5"/>} onClick={()=>sb.onNav("imp-advisors")}>Gestionar asesores</Button>
                  <Button variant="secondary" size="sm" fullWidth icon={<FileText className="w-3.5 h-3.5"/>} onClick={()=>sb.onNav("imp-quotes")}>Ver cotizaciones</Button>
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
function ImporterCompanyProfileScreen({sb,company,onSave}:{sb:SidebarCtrl;company:BackendImporter|null;onSave:(payload:{nombre_empresa:string;especialidad_producto:string[];paises_origen:string[];tiempo_respuesta_promedio:string;})=>Promise<void>}) {
  const [saved,setSaved]=useState(false);
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({
    razonSocial:"",description:"",year:"",website:"",email:"",
    phone:"+57 1 234 5678",address:"Calle 90 #15-20, Bogotá, Colombia",
    categories:[] as string[],countries:[] as string[],
    industries:["Retail","Industrial"],avgResponse:"~24h",
    certs:["ISO 9001","CE"],banner:"",
  });
  const [saveError,setSaveError]=useState("");

  useEffect(()=>{
    if(!company)return;
    setForm((prev)=>(
      {
        ...prev,
        razonSocial:company.nombre_empresa,
        description:prev.description||"",
        categories:company.especialidad_producto ?? [],
        countries:company.paises_origen ?? [],
        avgResponse:company.tiempo_respuesta_promedio || "~24h",
      }
    ));
  },[company]);

  function f(k:string,v:string){setForm(p=>({...p,[k]:v}));setSaved(false);}
  async function save(){
    setSaveError("");
    setSaving(true);
    try{
      await onSave({
        nombre_empresa:form.razonSocial,
        especialidad_producto:form.categories,
        paises_origen:form.countries,
        tiempo_respuesta_promedio:form.avgResponse,
      });
      setSaved(true);
      setTimeout(()=>setSaved(false),3000);
    }catch(err){
      setSaveError(err instanceof Error ? err.message : "No se pudo guardar el perfil de empresa.");
    }finally{
      setSaving(false);
    }
  }

  if(!company){
    return (
      <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
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
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
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
            <Button variant="primary" loading={saving} icon={saved?<CheckCircle2 className="w-4 h-4"/>:<Save className="w-4 h-4"/>} onClick={()=>{void save();}}>{saved?"Guardado":"Guardar cambios"}</Button>
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
                  <Input label="Correo de contacto" value={form.email} onChange={e=>f("email",e.target.value)} prefix={<MailIcon className="w-4 h-4"/>}/>
                  <Input label="Teléfono" value={form.phone} onChange={e=>f("phone",e.target.value)} prefix={<Phone className="w-4 h-4"/>}/>
                  <Input label="Dirección" value={form.address} onChange={e=>f("address",e.target.value)} prefix={<MapPin className="w-4 h-4"/>}/>
                </div>
                <div className="mt-4">
                  <Textarea label="Descripción" rows={3} value={form.description} onChange={e=>f("description",e.target.value)}/>
                </div>
              </Card>
              <Card padding="md">
                <p className="font-semibold text-sm mb-4 flex items-center gap-2"><Tag className="w-4 h-4 text-primary"/>Información comercial</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Select label="Tiempo promedio de respuesta" value={form.avgResponse} onChange={e=>f("avgResponse",e.target.value)}>
                    {["~12h","~24h","~36h","~48h","~72h"].map(v=><option key={v}>{v}</option>)}
                  </Select>
                  <div>
                    <p className="text-sm font-medium mb-1.5">Categorías</p>
                    <div className="flex flex-wrap gap-1.5">{ALL_CATEGORIES.map(c=><button key={c} onClick={()=>{const arr=form.categories.includes(c)?form.categories.filter(x=>x!==c):[...form.categories,c];setForm(p=>({...p,categories:arr}));}} className={clsx("px-2 py-1 text-xs rounded-md border transition-colors",form.categories.includes(c)?"bg-primary text-white border-primary":"border-border hover:border-primary/40")}>{c}</button>)}</div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1.5">Países atendidos</p>
                    <div className="flex flex-wrap gap-1.5">{COUNTRIES.slice(0,8).map(c=><button key={c} onClick={()=>{const arr=form.countries.includes(c)?form.countries.filter(x=>x!==c):[...form.countries,c];setForm(p=>({...p,countries:arr}));}} className={clsx("px-2 py-1 text-xs rounded-md border transition-colors",form.countries.includes(c)?"bg-primary text-white border-primary":"border-border hover:border-primary/40")}>{c}</button>)}</div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1.5">Certificaciones</p>
                    <div className="flex flex-wrap gap-1.5">{["ISO 9001","CE","FDA","HACCP","OEKO-TEX","ISO 14001","DIN","JIS"].map(c=><button key={c} onClick={()=>{const arr=form.certs.includes(c)?form.certs.filter(x=>x!==c):[...form.certs,c];setForm(p=>({...p,certs:arr}));}} className={clsx("px-2 py-1 text-xs rounded-md border transition-colors flex items-center gap-1",form.certs.includes(c)?"bg-emerald-600 text-white border-emerald-600":"border-border hover:border-emerald-300")}><Shield className="w-2.5 h-2.5"/>{c}</button>)}</div>
                  </div>
                </div>
              </Card>
              <Card padding="md">
                <p className="font-semibold text-sm mb-4 flex items-center gap-2"><ImageIcon className="w-4 h-4 text-primary"/>Imágenes y banner</p>
                <div className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center gap-2 text-center">
                  <Upload className="w-8 h-8 text-muted-foreground/40"/>
                  <p className="text-sm text-muted-foreground">Arrastra imágenes o haz clic para subir</p>
                  <p className="text-xs text-muted-foreground/60">PNG, JPG hasta 5MB cada una</p>
                  <Button variant="secondary" size="sm">Seleccionar archivos</Button>
                </div>
              </Card>
            </div>
            <div>
              <Card padding="md">
                <p className="font-semibold text-sm mb-4">Vista previa del logo</p>
                <div className="flex flex-col items-center gap-3">
                  <div className={clsx("w-20 h-20 rounded-xl flex items-center justify-center text-white text-2xl font-bold",importerColorFromId(company.id))}>{initialsFromName(company.nombre_empresa)}</div>
                  <Button variant="secondary" size="sm" icon={<Upload className="w-3.5 h-3.5"/>}>Cambiar logo</Button>
                </div>
                <div className="mt-5 pt-5 border-t border-border space-y-2">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Calificación</span><span className="font-semibold flex items-center gap-1"><Star className="w-3 h-3 fill-amber-400 text-amber-400"/>{company.calificacion_promedio || 0}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Proyectos</span><span className="font-semibold">N/D</span></div>
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
function ImporterAdvisorsScreen({sb,initialAdvisors,onCreateAdvisor,onDeleteAdvisor}:{sb:SidebarCtrl;initialAdvisors:CompanyAdvisor[];onCreateAdvisor:(payload:CreateAsesorPayload)=>Promise<CompanyAdvisor>;onDeleteAdvisor:(advisorId:string)=>Promise<void>}) {
  const [advisors,setAdvisors]=useState(initialAdvisors);
  const [search,setSearch]=useState("");
  const [showModal,setShowModal]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const [editAdv,setEditAdv]=useState<CompanyAdvisor|null>(null);
  const [form,setForm]=useState({name:"",role:"",email:"",phone:"",password:"",status:"activo" as CompanyAdvisor["status"],availability:"alta" as CompanyAdvisor["availability"]});
  const [formError,setFormError]=useState("");

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

    if(form.password.trim().length<9){
      setFormError("La contraseña del asesor debe tener mínimo 9 caracteres.");
      return;
    }

    const created=await onCreateAdvisor({
      email:form.email,
      password:form.password.trim(),
      nombre:form.name,
      telefono:form.phone,
    });
    setAdvisors(prev=>[created,...prev]);
    setShowModal(false);
  }
  function toggle(id:string){setAdvisors(prev=>prev.map(a=>a.id===id?{...a,status:a.status==="activo"?"inactivo":"activo"}:a));}
  async function del(id:string){
    if(!confirm("¿Eliminar asesor?"))return;
    await onDeleteAdvisor(id);
    setAdvisors(prev=>prev.filter(a=>a.id!==id));
  }

  const STATUS_CLS:Record<CompanyAdvisor["status"],string>={activo:"bg-emerald-50 text-emerald-700",inactivo:"bg-slate-100 text-slate-600",ausente:"bg-amber-50 text-amber-700"};
  const AVAIL_CLS:Record<CompanyAdvisor["availability"],string>={alta:"text-emerald-600",media:"text-amber-600",baja:"text-rose-600"};

  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
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
                        <Button variant="ghost" size="sm" icon={<Edit2 className="w-3.5 h-3.5"/>} onClick={()=>openEdit(a)}/>
                        <Button variant="ghost" size="sm" icon={<RotateCcw className="w-3.5 h-3.5"/>} title="Reiniciar contraseña"/>
                        <Button variant="ghost" size="sm" icon={a.status==="activo"?<Ban className="w-3.5 h-3.5"/>:<CheckCircle2 className="w-3.5 h-3.5"/>} onClick={()=>toggle(a.id)}/>
                        <Button variant="ghost" size="sm" icon={<X className="w-3.5 h-3.5 text-destructive"/>} onClick={()=>{void del(a.id);}}/>
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
function ImporterQuotesScreen({sb,onRespond,quotes}:{sb:SidebarCtrl;onRespond:(id:string)=>void;quotes:Quote[]}) {
  const [filter,setFilter]=useState("todas");
  const [search,setSearch]=useState("");
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
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <Sidebar {...sb} active="imp-quotes"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER_IMPORTADORA} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          <div>
            <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav("imp-dashboard")},{label:"Cotizaciones"}]}/>
            <h1 className="text-xl font-semibold mt-3">Cotizaciones recibidas</h1>
          </div>
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
                        <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5"/>} title="Ver detalle"/>
                        <Button variant="ghost" size="sm" icon={<Users className="w-3.5 h-3.5"/>} title="Asignar asesor"/>
                        <Button variant="ghost" size="sm" icon={<MessageCircle className="w-3.5 h-3.5"/>} title="Abrir chat"/>
                        <Button variant="primary" size="sm" icon={<Send className="w-3.5 h-3.5"/>} onClick={()=>onRespond(q.id)}>Responder</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length===0&&<div className="py-12 text-center text-sm text-muted-foreground">No hay cotizaciones para este filtro.</div>}
          </Card>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVISOR PORTAL — DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function AdvisorDashboardScreen({sb,availableCount,quotes}:{sb:SidebarCtrl;availableCount:number;quotes:Quote[]}) {
  const myQuotesCount = quotes.length;
  const activeOrdersCount = quotes.filter(q=>q.status==="active-order").length;
  const recentQuotes = quotes.slice(0,3);
  const metrics=[
    {label:"Cotizaciones disponibles",value:availableCount.toString(),icon:<Zap className="w-5 h-5"/>,color:"text-amber-600",bg:"bg-amber-50"},
    {label:"Mis cotizaciones",value:myQuotesCount.toString(),icon:<ClipboardList className="w-5 h-5"/>,color:"text-blue-600",bg:"bg-blue-50"},
    {label:"Respuestas enviadas",value:"N/D",icon:<Send className="w-5 h-5"/>,color:"text-emerald-600",bg:"bg-emerald-50"},
    {label:"Chats activos",value:"N/D",icon:<MessageSquare className="w-5 h-5"/>,color:"text-purple-600",bg:"bg-purple-50"},
    {label:"Órdenes en seguimiento",value:activeOrdersCount.toString(),icon:<ShoppingCart className="w-5 h-5"/>,color:"text-cyan-600",bg:"bg-cyan-50"},
  ];
  const activity:{text:string;time:string}[]=[];
  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <Sidebar {...sb} active="adv-dashboard"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER_ASESOR} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div>
            <Breadcrumb items={[{label:"Inicio"},{label:"Mi dashboard"}]}/>
            <h1 className="text-xl font-semibold mt-3">Panel del asesor</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Resumen de cotizaciones asignadas</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {metrics.map((m,i)=>(
              <Card key={i} padding="md" className="flex flex-col gap-2">
                <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center",m.bg,m.color)}>{m.icon}</div>
                <p className="text-2xl font-bold">{m.value}</p>
                <p className="text-xs text-muted-foreground">{m.label}</p>
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
function AdvisorAvailableScreen({sb,available,onClaim}:{sb:SidebarCtrl;available:Quote[];onClaim:(id:string)=>Promise<void>}) {
  const [claimingId,setClaimingId]=useState<string|null>(null);
  const [claimError,setClaimError]=useState("");

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

  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <Sidebar {...sb} active="adv-available"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER_ASESOR} sb={sb}/>
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
                <Button variant="primary" size="sm" fullWidth icon={<Zap className="w-3.5 h-3.5"/>} loading={claimingId===q.id} onClick={()=>{void handleClaim(q.id);}}>Tomar cotización</Button>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVISOR PORTAL — MY QUOTES
// ─────────────────────────────────────────────────────────────────────────────
function AdvisorMyQuotesScreen({sb,quotes,onRespond}:{sb:SidebarCtrl;quotes:Quote[];onRespond:(id:string)=>void}) {
  const myQuotes=quotes.slice(0,20);
  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <Sidebar {...sb} active="adv-my-quotes"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER_ASESOR} sb={sb}/>
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
                        <Button variant="ghost" size="sm" icon={<MessageCircle className="w-3.5 h-3.5"/>} title="Abrir chat"/>
                        <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5"/>} title="Ver detalle"/>
                        <Button variant="primary" size="sm" icon={<Send className="w-3.5 h-3.5"/>} onClick={()=>onRespond(q.id)}>Responder</Button>
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE RESPONSE SCREEN — 3-step wizard
// ─────────────────────────────────────────────────────────────────────────────
function CreateResponseScreen({quoteId,onBack,sb,userRole,quotes,onSubmitted}:{quoteId:string;onBack:()=>void;sb:SidebarCtrl;userRole:UserRole;quotes:Quote[];onSubmitted?:()=>Promise<void>}) {
  const quote=quotes.find(q=>q.id===quoteId)??null;
  const [step,setStep]=useState(1);
  const [submitted,setSubmitted]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [form,setForm]=useState({
    unitPrice:"",moq:"",totalPrice:"",
    incoterm:"FOB",port:"",productionTime:"",shippingTime:"",totalTime:"",
    description:"",advantages:"",recommendations:"",
    files:[] as {name:string;type:string}[],
  });
  function f(k:string,v:string){setForm(p=>({...p,[k]:v}));}
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
    const observaciones = [form.description.trim(), form.advantages.trim(), form.recommendations.trim()].filter(Boolean).join("\n\n");

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

      if(userRole==="asesor"){
        const draft = await businessService.createProposalDraft(payload);
        await businessService.sendProposal(draft.id);
      }else{
        await businessService.createProposal(payload);
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
      <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
        <Sidebar {...sb} active={activeNav}/>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AppHeader user={userRole==="asesor"?USER_ASESOR:USER_IMPORTADORA}/>
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
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <Sidebar {...sb} active={activeNav}/>
      <div className="flex-1 flex flex-col"><AppHeader user={userRole==="asesor"?USER_ASESOR:USER_IMPORTADORA}/>
        <div className="flex-1 flex items-center justify-center"><div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center"><CheckCircle2 className="w-7 h-7 text-emerald-500"/></div>
          <div><h2 className="text-lg font-semibold">Respuesta enviada</h2><p className="text-sm text-muted-foreground mt-1">Tu propuesta fue registrada correctamente para {quote.product}.</p></div>
          <Button variant="primary" onClick={onBack}>Volver a cotizaciones</Button>
        </div></div>
      </div>
    </div>
  );
  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <Sidebar {...sb} active={activeNav}/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={userRole==="asesor"?USER_ASESOR:USER_IMPORTADORA}/>
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-1">
            <Button variant="ghost" size="sm" icon={<ChevronLeft className="w-3.5 h-3.5"/>} onClick={onBack}>Volver</Button>
          </div>
          <Breadcrumb items={[{label:"Cotizaciones",onClick:onBack},{label:"Responder cotización"}]}/>
          <h1 className="text-xl font-semibold mt-3">Responder cotización</h1>
          <p className="text-sm text-muted-foreground mt-0.5 mb-6">{quote.product} · {quote.code}</p>
          {/* Stepper */}
          <div className="flex items-center gap-2 mb-8">
            {steps.map((s,i)=>(
              <div key={i} className="flex items-center gap-2">
                <div className={clsx("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  step===i+1?"bg-primary text-white":step>i+1?"bg-emerald-50 text-emerald-700 border border-emerald-200":"bg-muted text-muted-foreground")}>
                  {step>i+1?<CheckCircle2 className="w-3.5 h-3.5"/>:<span className="w-4 h-4 rounded-full flex items-center justify-center bg-white/20 text-[10px]">{i+1}</span>}
                  {s.label}
                </div>
                {i<steps.length-1&&<ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0"/>}
              </div>
            ))}
          </div>
          <div className="flex gap-6">
            <div className="flex-1 min-w-0 max-w-2xl">
              {step===1&&(
                <Card padding="lg">
                  <p className="font-semibold mb-5 flex items-center gap-2"><Receipt className="w-4 h-4 text-primary"/>Información económica</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Input label="Precio unitario" placeholder="9.20 USD/kg" value={form.unitPrice} onChange={e=>f("unitPrice",e.target.value)}/>
                    <Input label="MOQ (cantidad mínima)" placeholder="300 kg" value={form.moq} onChange={e=>f("moq",e.target.value)}/>
                    <Input label="Precio total estimado" placeholder="2,760 USD" value={form.totalPrice} onChange={e=>f("totalPrice",e.target.value)} className="sm:col-span-2"/>
                  </div>
                </Card>
              )}
              {step===2&&(
                <Card padding="lg">
                  <p className="font-semibold mb-5 flex items-center gap-2"><Truck className="w-4 h-4 text-primary"/>Información logística</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Select label="Incoterm" value={form.incoterm} onChange={e=>f("incoterm",e.target.value)}>{INCOTERMS.map(v=><option key={v}>{v}</option>)}</Select>
                    <Input label="Puerto de origen" placeholder="Puerto de Buenaventura" value={form.port} onChange={e=>f("port",e.target.value)}/>
                    <Input label="Tiempo de producción" placeholder="15 días" value={form.productionTime} onChange={e=>f("productionTime",e.target.value)}/>
                    <Input label="Tiempo de envío" placeholder="12 días" value={form.shippingTime} onChange={e=>f("shippingTime",e.target.value)}/>
                    <Input label="Tiempo total estimado" placeholder="27 días" value={form.totalTime} onChange={e=>f("totalTime",e.target.value)} className="sm:col-span-2"/>
                  </div>
                </Card>
              )}
              {step===3&&(
                <div className="space-y-4">
                  <Card padding="lg">
                    <p className="font-semibold mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-primary"/>Observaciones</p>
                    <div className="space-y-4">
                      <Textarea label="Descripción de la oferta" placeholder="Descripción detallada de tu propuesta…" rows={3} value={form.description} onChange={e=>f("description",e.target.value)}/>
                      <Textarea label="Ventajas competitivas" placeholder="¿Por qué elegir tu empresa?" rows={2} value={form.advantages} onChange={e=>f("advantages",e.target.value)}/>
                      <Textarea label="Recomendaciones" placeholder="Condiciones especiales, notas…" rows={2} value={form.recommendations} onChange={e=>f("recommendations",e.target.value)}/>
                    </div>
                  </Card>
                  <Card padding="lg">
                    <p className="font-semibold mb-4 flex items-center gap-2"><Paperclip className="w-4 h-4 text-primary"/>Archivos adjuntos</p>
                    <div className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 text-center">
                      <Upload className="w-7 h-7 text-muted-foreground/40"/>
                      <p className="text-sm text-muted-foreground">PDF, imágenes, fichas técnicas, cotización oficial</p>
                      <Button variant="secondary" size="sm" icon={<Upload className="w-3.5 h-3.5"/>}>Seleccionar archivos</Button>
                    </div>
                  </Card>
                </div>
              )}
              <div className="flex items-center justify-between mt-6 pt-5 border-t border-border">
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={onBack}>Cancelar</Button>
                  {step>1&&<Button variant="secondary" size="sm" icon={<ChevronLeft className="w-3.5 h-3.5"/>} onClick={()=>setStep(s=>s-1)}>Anterior</Button>}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" icon={<Save className="w-3.5 h-3.5"/>}>Guardar borrador</Button>
                  {step<3
                    ?<Button variant="primary" size="md" iconRight={<ChevronRight className="w-4 h-4"/>} onClick={()=>setStep(s=>s+1)}>Continuar</Button>
                    :<Button variant="primary" size="md" icon={<Send className="w-4 h-4"/>} loading={saving} onClick={submit}>Enviar propuesta</Button>
                  }
                </div>
              </div>
              {error&&<div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-destructive">{error}</div>}
            </div>
            <div className="w-64 hidden lg:block">
              <Card padding="md">
                <p className="font-semibold text-sm mb-3">Resumen de la cotización</p>
                <div className="space-y-2 text-xs">
                  <div><span className="text-muted-foreground">Producto:</span><p className="font-medium">{quote?.product||"—"}</p></div>
                  <div><span className="text-muted-foreground">Código:</span><p className="font-medium">{quote?.code||"—"}</p></div>
                  <div><span className="text-muted-foreground">País origen:</span><p className="font-medium">{quote?.country||"—"}</p></div>
                  <div><span className="text-muted-foreground">Incoterm deseado:</span><p className="font-medium">{quote?.incoterm||"—"}</p></div>
                  <div><span className="text-muted-foreground">Precio objetivo:</span><p className="font-medium">{quote?.targetPrice||"—"}</p></div>
                  <div><span className="text-muted-foreground">Cant. mínima:</span><p className="font-medium">{quote?.minQuantity?`${quote.minQuantity} u.`:"—"}</p></div>
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
// LANDING PAGE
// ─────────────────────────────────────────────────────────────────────────────
function LandingScreen({onLogin,onRegister,onPolicy}:{onLogin:()=>void;onRegister:()=>void;onPolicy:(page:"data"|"terms")=>void}) {
  const [faqOpen,setFaqOpen]=useState<number|null>(null);
  const stats=[
    {value:"200+",label:"Empresas importadoras"},
    {value:"50+",label:"Países de origen"},
    {value:"4,800+",label:"Cotizaciones gestionadas"},
    {value:"~24h",label:"Tiempo promedio de respuesta"},
  ];
  const benefits=[
    {icon:<BadgeCheck className="w-6 h-6 text-primary"/>,title:"Importadores verificados",desc:"Todas las empresas pasan por un proceso de verificación antes de ser listadas en la plataforma."},
    {icon:<Zap className="w-6 h-6 text-amber-500"/>,title:"Respuestas rápidas",desc:"Los asesores especializados reciben y responden tus solicitudes de cotización en pocas horas."},
    {icon:<Scale className="w-6 h-6 text-emerald-600"/>,title:"Negociación transparente",desc:"Todo el proceso de cotización, respuesta y negociación queda registrado en un solo lugar."},
    {icon:<ShoppingCart className="w-6 h-6 text-purple-600"/>,title:"Seguimiento de órdenes",desc:"Una vez confirmada la operación, puedes hacer seguimiento en tiempo real de tu pedido."},
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
  const featuredImporters=IMPORTERS.filter(i=>i.verified&&i.rating>=4.7).slice(0,3);

  return (
    <div className="min-h-screen bg-white" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo/>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onLogin}>Iniciar sesión</Button>
            <Button variant="primary" size="sm" onClick={onRegister}>Registrarse</Button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-32 pb-20 px-6" style={{background:"linear-gradient(135deg,#EFF6FF 0%,#F8FAFC 60%,#FFF7ED 100%)"}}>
        <div className="max-w-5xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold mb-6"><BadgeCheck className="w-3.5 h-3.5"/>Plataforma B2B de importaciones verificadas</span>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight mb-5">
            Importa con confianza.<br/>
            <span className="text-primary">Conecta con los mejores.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
            ImportacionesQ8 conecta empresas con importadores verificados en todo el mundo. Solicita cotizaciones, negocia condiciones y rastrea tus órdenes desde un solo lugar.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="primary" size="lg" icon={<LogIn className="w-4 h-4"/>} onClick={onLogin} className="px-8">Iniciar sesión</Button>
            <Button variant="secondary" size="lg" icon={<UserRound className="w-4 h-4"/>} onClick={onRegister} className="px-8">Crear cuenta gratis</Button>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-12 bg-white border-y border-border">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-4 gap-8">
          {stats.map((s,i)=>(
            <div key={i} className="text-center">
              <p className="text-3xl font-bold text-primary">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* BENEFITS */}
      <section className="py-20 px-6 bg-[#F8FAFC]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold tracking-tight">¿Por qué usar ImportacionesQ8?</h2>
            <p className="text-muted-foreground mt-2">Una plataforma diseñada para simplificar el comercio exterior</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {benefits.map((b,i)=>(
              <div key={i} className="bg-white border border-border rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">{b.icon}</div>
                <h3 className="font-semibold text-sm mb-2">{b.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold tracking-tight">¿Cómo funciona?</h2>
            <p className="text-muted-foreground mt-2">En cuatro pasos, desde la solicitud hasta la entrega</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s,i)=>(
              <div key={i} className="relative">
                {i<steps.length-1&&<div className="hidden lg:block absolute top-7 left-full w-full h-0.5 bg-border z-0" style={{width:"calc(100% - 2rem)",left:"calc(100% - 0.5rem)"}}/>}
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <span className="text-lg font-bold text-primary">{s.n}</span>
                  </div>
                  <h3 className="font-semibold text-sm mb-2">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED IMPORTERS */}
      <section className="py-20 px-6 bg-[#F8FAFC]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold tracking-tight">Empresas importadoras destacadas</h2>
            <p className="text-muted-foreground mt-2">Verificadas, calificadas y listas para atenderte</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {featuredImporters.map(imp=>(
              <div key={imp.id} className="bg-white border border-border rounded-2xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3 mb-3">
                  <Avatar initials={imp.initials} size="lg" color={imp.color}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap"><p className="font-semibold text-sm">{imp.name}</p><BadgeCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0"/></div>
                    <p className="text-xs text-muted-foreground">{imp.specialty}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400"/><span className="text-sm font-semibold">{imp.rating}</span></div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{IMP_DESCRIPTIONS[imp.id]||""}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {imp.categories.map(c=><span key={c} className="px-2 py-0.5 bg-muted rounded-md text-[10px] font-medium text-muted-foreground">{c}</span>)}
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Button variant="secondary" size="md" icon={<Building2 className="w-4 h-4"/>} onClick={onLogin}>Ver todas las importadoras</Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold tracking-tight">Preguntas frecuentes</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((f,i)=>(
              <div key={i} className="border border-border rounded-xl overflow-hidden">
                <button onClick={()=>setFaqOpen(faqOpen===i?null:i)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/50 transition-colors">
                  <span className="font-medium text-sm">{f.q}</span>
                  <ChevronDown className={clsx("w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-200",faqOpen===i&&"rotate-180")}/>
                </button>
                {faqOpen===i&&<div className="px-5 pb-4"><p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="py-16 px-6" style={{background:"linear-gradient(135deg,#1D4ED8,#2563EB)"}}>
        <div className="max-w-3xl mx-auto text-center text-white">
          <h2 className="text-2xl font-bold mb-3">Comienza hoy mismo</h2>
          <p className="text-blue-100 mb-7 leading-relaxed">Regístrate gratis y accede al marketplace de importadoras verificadas más completo de la región.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="secondary" size="lg" onClick={onRegister} className="px-8 bg-white text-primary hover:bg-blue-50">Crear cuenta gratis</Button>
            <Button size="lg" onClick={onLogin} className="px-8 bg-white/15 text-white border border-white/30 hover:bg-white/25">Iniciar sesión</Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-foreground text-white/70 py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center flex-shrink-0"><Package2 className="w-3.5 h-3.5 text-white"/></div>
                <span className="font-semibold text-white text-sm">ImportacionesQ8</span>
              </div>
              <p className="text-xs text-white/50">Plataforma B2B de comercio exterior</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 text-xs">
              <button onClick={()=>onPolicy("data")} className="hover:text-white transition-colors text-left">Política de Tratamiento de Datos</button>
              <button onClick={()=>onPolicy("terms")} className="hover:text-white transition-colors text-left">Términos y Condiciones</button>
              <button onClick={onLogin} className="hover:text-white transition-colors text-left">Iniciar sesión</button>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 pt-6 text-xs text-white/40 text-center">© 2025 ImportacionesQ8. Todos los derechos reservados.</div>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER SCREEN
// ─────────────────────────────────────────────────────────────────────────────
type RegUserType="solicitante"|"importadora";
type RegPersonType="natural"|"juridica";

function RegisterScreen({onBack,onSuccess,onPolicy}:{onBack:()=>void;onSuccess:(email:string)=>void;onPolicy:(page:"data"|"terms")=>void}) {
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
      setSubmitError("La contrasena debe tener minimo 9 caracteres.");
      return;
    }
    if(form.password!==form.confirmPassword){
      setSubmitError("Las contrasenas no coinciden.");
      return;
    }

    const email=(personType==="natural"?form.email:form.repEmail).trim();
    const telefono=(personType==="natural"?form.phone:form.repPhone).trim();
    const indicativo=(personType==="natural"?form.country:form.repCountry).trim();

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
    <div className="min-h-screen flex flex-col bg-[#F0F2F5] items-center justify-center px-4" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <div className="bg-white rounded-2xl border border-border shadow-sm p-8 max-w-sm w-full text-center">
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
    <div className="min-h-screen flex flex-col bg-[#F0F2F5]" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <header className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-border">
        <Logo/>
        <Button variant="ghost" size="sm" icon={<ChevronLeft className="w-3.5 h-3.5"/>} onClick={onBack}>Volver</Button>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[480px]">
          <div className="bg-white rounded-2xl border border-border shadow-sm">
            <div className="px-8 pt-8 pb-2">
              <h1 className="text-xl font-semibold tracking-tight mb-1">Crear cuenta</h1>
              <p className="text-sm text-muted-foreground mb-6">Elige el tipo de cuenta que deseas registrar</p>
              {/* User type */}
              <div className="flex gap-2 mb-6">
                {(["solicitante","importadora"]as const).map(t=>(
                  <button key={t} onClick={()=>setUserType(t)} className={clsx("flex-1 py-3 flex flex-col items-center gap-1.5 border rounded-xl text-xs font-semibold transition-all capitalize",userType===t?"border-primary bg-primary/5 text-primary":"border-border text-muted-foreground hover:border-primary/40")}>
                    {t==="solicitante"?<UserRound className="w-5 h-5"/>:<Building2 className="w-5 h-5"/>}
                    {t==="solicitante"?"Soy solicitante":"Soy empresa importadora"}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-8 pb-8">
              {userType==="importadora"?(
                <div className="flex flex-col items-center text-center gap-5 py-6">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center"><Building2 className="w-8 h-8 text-primary"/></div>
                  <div>
                    <h2 className="font-semibold mb-2">Registro de empresa importadora</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">Actualmente las empresas importadoras son registradas directamente por el equipo administrativo. Contáctanos para iniciar el proceso.</p>
                  </div>
                  <Button variant="primary" size="md" icon={<MailIcon className="w-4 h-4"/>}>Contactar al equipo administrativo</Button>
                  <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Volver al inicio</button>
                </div>
              ):(
                <form onSubmit={submit} noValidate>
                  {/* Person type */}
                  <div className="flex gap-2 mb-5">
                    {(["natural","juridica"]as const).map(t=>(
                      <button type="button" key={t} onClick={()=>setPersonType(t)} className={clsx("flex-1 py-2 text-xs font-semibold border rounded-lg transition-all",personType===t?"border-primary bg-primary/5 text-primary":"border-border text-muted-foreground hover:border-primary/40")}>
                        {t==="natural"?"Persona Natural":"Persona Jurídica"}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-4">
                    {personType==="natural"?(
                      <>
                        <Input label="Correo electrónico" type="email" placeholder="correo@ejemplo.com" value={form.email} onChange={e=>f("email",e.target.value)} prefix={<Mail className="w-4 h-4"/>} required/>
                        <Input label="Contrasena" type="password" placeholder="Minimo 9 caracteres" value={form.password} onChange={e=>f("password",e.target.value)} prefix={<Lock className="w-4 h-4"/>} required/>
                        <Input label="Confirmar contrasena" type="password" placeholder="Repite tu contrasena" value={form.confirmPassword} onChange={e=>f("confirmPassword",e.target.value)} prefix={<Lock className="w-4 h-4"/>} required/>
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
                        <Input label="Confirmar contrasena" type="password" placeholder="Repite tu contrasena" value={form.confirmPassword} onChange={e=>f("confirmPassword",e.target.value)} prefix={<Lock className="w-4 h-4"/>} required/>
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
                      <input type="checkbox" id="acepta" checked={accepted} onChange={e=>setAccepted(e.target.checked)} className="mt-0.5 w-4 h-4 accent-primary flex-shrink-0 cursor-pointer"/>
                      <label htmlFor="acepta" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                        Acepto la <button type="button" onClick={()=>onPolicy("data")} className="text-primary underline">Política de Tratamiento de Datos</button> y los <button type="button" onClick={()=>onPolicy("terms")} className="text-primary underline">Términos y Condiciones</button> de la plataforma.
                      </label>
                    </div>
                    <Button type="submit" variant="primary" fullWidth loading={loading} disabled={!accepted} className="mt-1 h-10 uppercase tracking-wide text-[13px]">{!loading&&"Crear cuenta"}</Button>
                    <p className="text-center text-xs text-muted-foreground">¿Ya tienes cuenta? <button type="button" onClick={onBack} className="text-primary hover:text-blue-700 font-medium">Iniciar sesión</button></p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
      <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border bg-white">© 2025 ImportacionesQ8. Todos los derechos reservados.</footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POLICY PAGES
// ─────────────────────────────────────────────────────────────────────────────
function PolicyScreen({page,onBack}:{page:"data"|"terms";onBack:()=>void}) {
  const isData=page==="data";
  return (
    <div className="min-h-screen bg-white" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <header className="sticky top-0 flex items-center justify-between px-6 py-3.5 bg-white border-b border-border z-10">
        <Logo/>
        <Button variant="ghost" size="sm" icon={<ChevronLeft className="w-3.5 h-3.5"/>} onClick={onBack}>Volver</Button>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex flex-col items-center text-center gap-5 mb-12">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
            <FileText className="w-8 h-8 text-amber-600"/>
          </div>
          <div>
            <h1 className="text-2xl font-bold">{isData?"Política de Tratamiento de Datos":"Términos y Condiciones"}</h1>
            <p className="text-muted-foreground mt-2 text-sm">ImportacionesQ8 — Versión 1.0</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0"/>
            <p className="text-sm text-amber-700 font-medium">Este documento se encuentra en construcción y será publicado próximamente.</p>
          </div>
        </div>
        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <div className="p-6 bg-muted rounded-xl border border-border">
            <p className="font-semibold text-foreground mb-2">{isData?"Aviso importante":"Aviso importante"}</p>
            <p>La {isData?"Política de Tratamiento de Datos Personales":"política de Términos y Condiciones"} de ImportacionesQ8 está siendo redactada por nuestro equipo legal y estará disponible antes del lanzamiento oficial de la plataforma.</p>
          </div>
          <p>En ella se detallará: {isData?"el tratamiento, almacenamiento y protección de tus datos personales según la legislación colombiana vigente (Ley 1581 de 2012 y sus decretos reglamentarios).":"las condiciones de uso de la plataforma, responsabilidades de las partes, propiedad intelectual y resolución de controversias."}</p>
          <p>Si tienes preguntas, puedes contactarnos a <span className="text-primary font-medium">legal@importacionesq8.co</span></p>
        </div>
      </main>
      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border">© 2025 ImportacionesQ8. Todos los derechos reservados.</footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────
function LoginScreen({onLogin,onRegister,onLanding,onPolicy,initialEmail}:{onLogin:(role:UserRole|"admin")=>void;onRegister:()=>void;onLanding:()=>void;onPolicy:(page:"data"|"terms")=>void;initialEmail?:string}) {
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
    <div className="min-h-screen flex flex-col bg-[#F0F2F5]" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
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

function AdminDashboardScreen({sb}:{sb:SidebarCtrl}) {
  return (
    <div className="min-h-screen bg-[#F0F2F5]" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <Sidebar {...sb} active="admin-dashboard"/>
      <main className={clsx("transition-all duration-300",sb.pinned?"ml-52":"ml-16")}>
        <div className="px-6 py-6 max-w-6xl mx-auto">
          <div className="mb-5">
            <Breadcrumb items={[{label:"Inicio"},{label:"Dashboard Admin"}]}/>
            <h1 className="text-2xl font-bold mt-1">Panel Administrativo</h1>
            <p className="text-sm text-muted-foreground mt-1">Acceso administrativo autenticado correctamente.</p>
          </div>
          <Card padding="lg">
            <p className="text-sm text-muted-foreground">Este rol ya redirige al dashboard de admin. Aquí puedes conectar los módulos administrativos.</p>
          </Card>
        </div>
      </main>
    </div>
  );
}

function UserProfileScreen({sb,profile,onSave,onBack}:{sb:SidebarCtrl;profile:{nombre:string;telefono:string;email:string;whatsapp:string};onSave:(payload:{nombre:string;telefono:string;whatsapp:string})=>Promise<void>;onBack:()=>void}) {
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
    <div className="flex h-screen bg-background overflow-hidden" style={{fontFamily:"Inter,system-ui,sans-serif"}}>
      <Sidebar {...sb} active="dashboard"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Breadcrumb items={[{label:"Inicio",onClick:onBack},{label:"Editar perfil"}]}/>
              <h1 className="text-xl font-semibold mt-3">Editar perfil</h1>
            </div>
            <Button variant="primary" loading={saving} icon={saved?<CheckCircle2 className="w-4 h-4"/>:<Save className="w-4 h-4"/>} onClick={()=>{void save();}}>{saved?"Guardado":"Guardar cambios"}</Button>
          </div>
          {error&&<Card padding="sm" className="border-destructive/30 bg-red-50"><p className="text-xs text-destructive">{error}</p></Card>}
          <Card padding="md" className="max-w-2xl">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Nombre" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}/>
              <Input label="Teléfono" value={form.telefono} onChange={e=>setForm(p=>({...p,telefono:e.target.value}))}/>
              <Input label="Email" value={form.email} disabled/>
              <Input label="WhatsApp" value={form.whatsapp} onChange={e=>setForm(p=>({...p,whatsapp:e.target.value}))}/>
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
type Screen="landing"|"login"|"register"|"reset-password"|"policy-data"|"policy-terms"|"dashboard"|"importer-profile"|"quotes"|"new-quote"|"quote-detail"|"responses"|"response-detail"|"chats"|"orders"|"order-detail"|"documentos"|"pagos"|"imp-dashboard"|"imp-profile"|"imp-advisors"|"imp-quotes"|"adv-dashboard"|"adv-available"|"adv-my-quotes"|"admin-dashboard"|"create-response"|"notifications"|"user-profile";

export default function App() {
  const storedRole = normalizeStoredRole(getStoredRole());
  const hasStoredSession = Boolean(getStoredToken() && storedRole);

  const { isAuthenticated, isInitializing, appRole, signOut } = useAuth();
  const [screen,setScreen]=useState<Screen>(() =>
    window.location.pathname === RESET_PASSWORD_PATH
      ? "reset-password"
      : hasStoredSession
        ? getHomeScreenForRole(storedRole!)
        : "landing",
  );
  const [loginPrefillEmail,setLoginPrefillEmail]=useState("");
  const [resetToken,setResetToken]=useState<string>(() =>
    new URLSearchParams(window.location.search).get("token") ?? "",
  );
  const [userRole,setUserRole]=useState<UserRole|"admin">(storedRole ?? "solicitante");
  const [selectedQuoteId,setSelectedQuoteId]=useState("");
  const [selectedResponseId,setSelectedResponseId]=useState("");
  const [responseFrom,setResponseFrom]=useState<ResponseFrom>("responses");
  const [responseFromQuoteId,setResponseFromQuoteId]=useState("");
  const [selectedOrderId,setSelectedOrderId]=useState("");
  const [selectedImporterId,setSelectedImporterId]=useState("");
  const [preselectedImporterId,setPreselectedImporterId]=useState<string|undefined>();
  const [initialChatConvId,setInitialChatConvId]=useState<string|undefined>();
  const [sidebarPinned,setSidebarPinned]=useState(true);
  const [notifications,setNotifications]=useState<AppNotification[]>(INIT_NOTIFICATIONS);
  const [availableQuotes,setAvailableQuotes]=useState<Quote[]>([]);
  const [marketplaceImporters,setMarketplaceImporters]=useState<Importer[]>([]);
  const [requesterQuotes,setRequesterQuotes]=useState<Quote[]>([]);
  const [importerQuotes,setImporterQuotes]=useState<Quote[]>([]);
  const [companyAdvisors,setCompanyAdvisors]=useState<CompanyAdvisor[]>([]);
  const [advisorAssignedQuotes,setAdvisorAssignedQuotes]=useState<Quote[]>([]);
  const [currentUserProfile,setCurrentUserProfile]=useState<BackendUserProfile|null>(null);
  const [companyProfile,setCompanyProfile]=useState<BackendImporter|null>(null);
  const [requesterResponses,setRequesterResponses]=useState<QuoteResponse[]>([]);
  const [requesterOrders,setRequesterOrders]=useState<Order[]>([]);
  const [chatConversations,setChatConversations]=useState<ChatConv[]>([]);
  const [chatMessagesByConversation,setChatMessagesByConversation]=useState<Record<string, ChatMsg[]>>({});
  const [prevScreen,setPrevScreen]=useState<Screen>(() =>
    window.location.pathname === RESET_PASSWORD_PATH ? "login" : "dashboard",
  );

  const reloadImporters = useCallback(async () => {
    const rows = await businessService.listImporters();
    setMarketplaceImporters(rows.map(mapBackendImporterToUi));
  }, []);

  const reloadRequesterQuotes = useCallback(async () => {
    const rows = await businessService.listQuotes();
    setRequesterQuotes(rows.map((row: BackendCotizacion) => mapBackendQuoteToUi(row, marketplaceImporters)));
  }, [marketplaceImporters]);

  const reloadImporterQuotes = useCallback(async () => {
    const rows = await businessService.listQuotes();
    setImporterQuotes(rows.map((row: BackendCotizacion) => mapBackendQuoteToUi(row, marketplaceImporters)));
  }, [marketplaceImporters]);

  const reloadCompanyAdvisors = useCallback(async () => {
    const rows = await businessService.listCompanyAdvisors();
    setCompanyAdvisors(rows.map(mapBackendAdvisorToUi));
  }, []);

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

  const reloadChatData = useCallback(async () => {
    const rows = await businessService.listChatConversations();
    const mappedConversations: ChatConv[] = rows.map((row) => ({
      id: row.id,
      type: row.orden_id ? "orden" : "cotizacion",
      refCode: row.orden_id ? `ORD-${row.orden_id.slice(0, 8).toUpperCase()}` : `COT-${row.cotizacion_id.slice(0, 8).toUpperCase()}`,
      refId: row.orden_id ?? row.cotizacion_id,
      importerId: row.importador_usuario_id,
      status: "activa",
      unread: 0,
      lastMsg: row.ultimo_mensaje?.contenido || "Sin mensajes",
      lastDate: row.ultimo_mensaje?.fecha_envio ? formatShortDate(row.ultimo_mensaje.fecha_envio) : formatShortDate(row.fecha_creacion),
    }));
    setChatConversations(mappedConversations);

    const messagePairs = await Promise.all(
      mappedConversations.map(async (conversation) => {
        const messages = await businessService.listChatMessages(conversation.id);
        const mappedMessages: ChatMsg[] = messages.map((message) => ({
          id: message.id,
          sender: message.remitente_id === currentUserProfile?.id ? "client" : "provider",
          text: message.contenido,
          time: new Date(message.fecha_envio).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
          read: true,
        }));
        return [conversation.id, mappedMessages] as const;
      }),
    );
    setChatMessagesByConversation(Object.fromEntries(messagePairs));
  }, [currentUserProfile?.id]);

  const reloadAdvisorAssignedQuotes = useCallback(async () => {
    const rows = await businessService.listMyAssignedQuotes();
    const mapped: BackendCotizacion[] = rows.map((row: {
      id: string;
      modalidad: "dirigida" | "abierta";
      nombre_producto: string;
      cantidad_minima: number;
      precio_objetivo_usd: number | null;
      incoterm: string;
      estado: string;
      fecha_creacion: string;
    }) => ({
      id: row.id,
      importador_id: null,
      modalidad: row.modalidad,
      pais_importacion: "N/A",
      nombre_producto: row.nombre_producto,
      descripcion_cliente: "",
      linea_producto: "General",
      tipo_calidad: "estandar",
      cantidad_minima: row.cantidad_minima,
      precio_objetivo_usd: row.precio_objetivo_usd,
      incoterm: row.incoterm,
      estado: row.estado,
      fecha_creacion: row.fecha_creacion,
      fecha_actualizacion: row.fecha_creacion,
    }));
    setAdvisorAssignedQuotes(mapped.map((row) => mapBackendQuoteToUi(row, marketplaceImporters)));
  }, [marketplaceImporters]);

  const reloadAdvisorAvailableQuotes = useCallback(async () => {
    const rows = await businessService.listAdvisorAvailableQuotes();
    setAvailableQuotes(rows.map((row) => mapBackendQuoteToUi(row, marketplaceImporters)));
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
    if (isInitializing || !isAuthenticated || !appRole) {
      return;
    }

    const publicOrEntryScreens: Screen[] = [
      "landing",
      "login",
      "register",
      "policy-data",
      "policy-terms",
      "reset-password",
    ];

    if (publicOrEntryScreens.includes(screen)) {
      setScreen(getHomeScreenForRole(appRole));
    }
  }, [isInitializing, isAuthenticated, appRole, screen]);

  useEffect(() => {
    if (!isAuthenticated || isInitializing) {
      return;
    }
    void reloadImporters();
  }, [isAuthenticated, isInitializing, reloadImporters]);

  useEffect(() => {
    if (!isAuthenticated || isInitializing) {
      return;
    }
    void reloadCurrentUserProfile();
    void reloadChatData();
  }, [isAuthenticated, isInitializing, reloadCurrentUserProfile, reloadChatData]);

  useEffect(() => {
    if (!isAuthenticated || isInitializing) {
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
      return;
    }

    if (userRole === "asesor") {
      void reloadAdvisorAssignedQuotes();
      void reloadAdvisorAvailableQuotes();
    }
  }, [
    isAuthenticated,
    isInitializing,
    userRole,
    reloadRequesterQuotes,
    reloadRequesterResponses,
    reloadRequesterOrders,
    reloadImporterQuotes,
    reloadCompanyAdvisors,
    reloadAdvisorAssignedQuotes,
    reloadAdvisorAvailableQuotes,
  ]);

  const unreadCount=notifications.filter(n=>!n.read).length;

  function goTo(s:Screen){setPrevScreen(screen);setScreen(s);}

  function handleNav(key:string){
    const all:Record<string,Screen>={
      dashboard:"dashboard","imp-dashboard":"imp-dashboard","adv-dashboard":"adv-dashboard","admin-dashboard":"admin-dashboard",
      quotes:"quotes","imp-quotes":"imp-quotes","adv-available":"adv-available","adv-my-quotes":"adv-my-quotes",
      responses:"responses",chats:"chats",orders:"orders",documentos:"documentos",pagos:"pagos",
      "imp-advisors":"imp-advisors","imp-profile":"imp-profile",notifications:"notifications",
    };
    const s=all[key];if(s)goTo(s);
  }

  function getNavItems():NavItem[]{
    if(userRole==="admin")return NAV_ADMIN as NavItem[];
    if(userRole==="importadora")return NAV_IMPORTADORA as NavItem[];
    if(userRole==="asesor")return NAV_ASESOR as NavItem[];
    return NAV_ITEMS as NavItem[];
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

  const sb:SidebarCtrl={active:screen,onNav:handleNav,pinned:sidebarPinned,onToggle:()=>setSidebarPinned(p=>!p),navItems:getNavItems(),onNotif:()=>goTo("notifications"),notifCount:unreadCount,onLogout:()=>{void handleLogout();},onProfile:handleProfileClick};

  function openResponse(id:string,from:ResponseFrom,fromQuoteId?:string){
    setSelectedResponseId(id);setResponseFrom(from);setResponseFromQuoteId(fromQuoteId||"");goTo("response-detail");
  }
  function openChat(convId:string){setInitialChatConvId(convId);goTo("chats");}
  function openNewQuote(importerId?:string){setPreselectedImporterId(importerId);goTo("new-quote");}
  function markNotif(id:string){setNotifications(prev=>prev.map(n=>n.id===id?{...n,read:true}:n));}
  async function claimQuote(id:string){
    await businessService.claimAdvisorQuote(id);
    await Promise.all([reloadAdvisorAvailableQuotes(), reloadAdvisorAssignedQuotes()]);
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

  async function handleCreateQuote(payload: CreateCotizacionPayload){
    await businessService.createQuote(payload);
    await reloadRequesterQuotes();
    await reloadRequesterResponses();
    await reloadRequesterOrders();
    await reloadImporterQuotes();
    await reloadAdvisorAssignedQuotes();
  }

  async function handleCreateAdvisor(payload: CreateAsesorPayload): Promise<CompanyAdvisor>{
    const created = await businessService.createCompanyAdvisor(payload);
    await reloadCompanyAdvisors();
    return mapBackendAdvisorToUi(created);
  }

  async function handleDeleteAdvisor(advisorId: string): Promise<void> {
    await businessService.deleteCompanyAdvisor(advisorId);
    await reloadCompanyAdvisors();
  }

  async function handleSaveCompanyProfile(payload:{nombre_empresa:string;especialidad_producto:string[];paises_origen:string[];tiempo_respuesta_promedio:string;}) {
    if (!currentUserProfile?.importador_id) {
      throw new Error("Tu usuario no tiene importador asociado.");
    }
    await businessService.updateImporterById(currentUserProfile.importador_id, payload);
    await reloadCurrentUserProfile();
    await reloadImporters();
  }

  async function handleSaveUserProfile(payload:{nombre:string;telefono:string;whatsapp:string}) {
    await businessService.updateMyUserProfile(payload);
    await reloadCurrentUserProfile();
  }

  async function handleSendChatMessage(conversationId: string, contenido: string) {
    await businessService.sendChatMessage(conversationId, { contenido, tipo: "texto" });
    const messages = await businessService.listChatMessages(conversationId);
    setChatMessagesByConversation((prev) => ({
      ...prev,
      [conversationId]: messages.map((message) => ({
        id: message.id,
        sender: message.remitente_id === currentUserProfile?.id ? "client" : "provider",
        text: message.contenido,
        time: new Date(message.fecha_envio).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
        read: true,
      })),
    }));
    await reloadChatData();
  }

  async function refreshQuoteLists(){
    await Promise.all([
      reloadRequesterQuotes(),
      reloadRequesterResponses(),
      reloadRequesterOrders(),
      reloadImporterQuotes(),
      reloadAdvisorAssignedQuotes(),
      reloadAdvisorAvailableQuotes(),
    ]);
  }

  const publicScreens: Screen[] = ["landing", "login", "register", "reset-password", "policy-data", "policy-terms"];
  const screenAllowedByRole: Partial<Record<Screen, UserRole[]>> = {
    "imp-dashboard": ["importadora"],
    "imp-profile": ["importadora"],
    "imp-advisors": ["importadora"],
    "imp-quotes": ["importadora"],
    "adv-dashboard": ["asesor"],
    "adv-available": ["asesor"],
    "adv-my-quotes": ["asesor"],
    "user-profile": ["solicitante", "asesor"],
    "admin-dashboard": ["admin"],
  };

  const allowedRoles = screenAllowedByRole[screen];
  const loadingFallback = (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F2F5]">
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
      onPolicy={page=>goTo(page==="data"?"policy-data":"policy-terms")}
      initialEmail={loginPrefillEmail}
    />
  );

  const unauthorizedFallback = (
    <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center px-4">
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

  if(screen==="landing")return <LandingScreen onLogin={()=>goTo("login")} onRegister={()=>goTo("register")} onPolicy={page=>goTo(page==="data"?"policy-data":"policy-terms")}/>;
  if(screen==="register")return <RegisterScreen onBack={()=>goTo("login")} onSuccess={(email)=>{setLoginPrefillEmail(email);goTo("login");}} onPolicy={page=>goTo(page==="data"?"policy-data":"policy-terms")}/>;
  if(screen==="reset-password")return <ResetPasswordScreen token={resetToken} onBackToLogin={()=>goTo("login")}/>;
  if(screen==="policy-data")return <PolicyScreen page="data" onBack={()=>goTo(prevScreen)}/>;
  if(screen==="policy-terms")return <PolicyScreen page="terms" onBack={()=>goTo(prevScreen)}/>;
  if(screen==="login")return <LoginScreen onLogin={handleLogin} onRegister={()=>goTo("register")} onLanding={()=>goTo("landing")} onPolicy={page=>goTo(page==="data"?"policy-data":"policy-terms")} initialEmail={loginPrefillEmail}/>;

  const renderPrivateScreen = () => {
    // ── Importer portal ───────────────────────────────────────────────────────
    if(screen==="imp-dashboard")return <ImporterDashboardScreen sb={sb} quotes={importerQuotes} advisors={companyAdvisors}/>;
    if(screen==="imp-profile")return <ImporterCompanyProfileScreen sb={sb} company={companyProfile} onSave={handleSaveCompanyProfile}/>;
    if(screen==="imp-advisors")return <ImporterAdvisorsScreen sb={sb} initialAdvisors={companyAdvisors} onCreateAdvisor={handleCreateAdvisor} onDeleteAdvisor={handleDeleteAdvisor}/>;
    if(screen==="imp-quotes")return <ImporterQuotesScreen sb={sb} quotes={importerQuotes} onRespond={id=>{setSelectedQuoteId(id);goTo("create-response");}}/>;

    // ── Advisor portal ────────────────────────────────────────────────────────
    if(screen==="adv-dashboard")return <AdvisorDashboardScreen sb={sb} availableCount={availableQuotes.length} quotes={advisorAssignedQuotes}/>;
    if(screen==="adv-available")return <AdvisorAvailableScreen sb={sb} available={availableQuotes} onClaim={claimQuote}/>;
    if(screen==="adv-my-quotes")return <AdvisorMyQuotesScreen sb={sb} quotes={advisorAssignedQuotes} onRespond={id=>{setSelectedQuoteId(id);goTo("create-response");}}/>;

    if(screen==="admin-dashboard")return <AdminDashboardScreen sb={sb}/>;

    // ── Shared ────────────────────────────────────────────────────────────────
    if(screen==="create-response")return <CreateResponseScreen quoteId={selectedQuoteId} onBack={()=>goTo(prevScreen)} sb={sb} userRole={userRole} quotes={userRole==="importadora"?importerQuotes:advisorAssignedQuotes} onSubmitted={refreshQuoteLists}/>;
    if(screen==="notifications")return <NotificationsScreen notifications={notifications} onMark={markNotif} onBack={()=>goTo(prevScreen)} sb={sb}/>;

    // ── Solicitante portal ────────────────────────────────────────────────────
    if(screen==="dashboard")return <DashboardScreen sb={sb} importers={marketplaceImporters} onViewProfile={id=>{setSelectedImporterId(id);goTo("importer-profile");}} onCreateQuote={id=>openNewQuote(id)}/>;
    if(screen==="importer-profile")return <ImporterProfileScreen importerId={selectedImporterId} importers={marketplaceImporters} chats={chatConversations} onBack={()=>goTo("dashboard")} onCreateQuote={id=>openNewQuote(id)} onOpenChat={openChat} sb={sb}/>;
    if(screen==="quotes")return <QuotesScreen quotes={requesterQuotes} onNewQuote={()=>openNewQuote()} onViewDetail={id=>{setSelectedQuoteId(id);goTo("quote-detail");}} sb={sb}/>;
    if(screen==="new-quote")return <NewQuoteScreen onBack={()=>goTo("quotes")} sb={sb} preselectedImporterId={preselectedImporterId} importers={marketplaceImporters} onSubmitQuote={handleCreateQuote}/>;
    if(screen==="quote-detail")return <QuoteDetailScreen quoteId={selectedQuoteId} quotes={requesterQuotes} chats={chatConversations} onBack={()=>goTo("quotes")} onOpenChat={openChat} sb={sb} onRefreshQuotes={refreshQuoteLists}/>;
    if(screen==="responses")return <ResponsesScreen onViewDetail={(id,from)=>openResponse(id,from)} sb={sb} responses={requesterResponses}/>;
    if(screen==="response-detail")return <ResponseDetailScreen responseId={selectedResponseId} from={responseFrom} fromQuoteId={responseFromQuoteId} onBack={()=>goTo("responses")} onBackToQuote={id=>{setSelectedQuoteId(id);goTo("quote-detail");}} onOpenChat={openChat} sb={sb} responses={requesterResponses} quotes={requesterQuotes} chats={chatConversations}/>;
    if(screen==="chats")return <ChatsScreen onViewQuote={id=>{setSelectedQuoteId(id);goTo("quote-detail");}} onViewOrder={id=>{setSelectedOrderId(id);goTo("order-detail");}} sb={sb} initialConvId={initialChatConvId} conversations={chatConversations} messagesByConversation={chatMessagesByConversation} onSendMessage={handleSendChatMessage}/>;
    if(screen==="orders")return <OrdersScreen onViewOrder={id=>{setSelectedOrderId(id);goTo("order-detail");}} sb={sb} orders={requesterOrders}/>;
    if(screen==="order-detail")return <OrderDetailScreen orderId={selectedOrderId} onBack={()=>goTo("orders")} onOpenChat={openChat} sb={sb} orders={requesterOrders}/>;
    if(screen==="documentos")return <DocumentosScreen sb={sb}/>;
    if(screen==="pagos")return <PagosScreen sb={sb}/>;
    if(screen==="user-profile")return <UserProfileScreen sb={sb} profile={{nombre:currentUserProfile?.nombre||"",telefono:currentUserProfile?.telefono||"",email:currentUserProfile?.email||"",whatsapp:currentUserProfile?.whatsapp||""}} onSave={handleSaveUserProfile} onBack={()=>goTo(userRole==="asesor"?"adv-dashboard":"dashboard")}/>;
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
    </ProtectedRoute>
  );
}
