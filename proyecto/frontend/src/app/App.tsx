import { Fragment, useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  LockKeyhole, BellRing, LifeBuoy, WalletCards, DatabaseBackup, Gauge, FileSignature,
  Sparkles, LibraryBig, Type, Trophy, Palette, ToggleRight, Flame, GraduationCap,
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
import { PublicSicLogo } from "@/app/components/navigation/PublicSicLogo";
import { CoursesScreen } from "@/features/courses/CoursesScreen";
import { LegalPolicyScreen } from "@/features/legal/components/LegalPolicyScreen";
import type { LegalPage } from "@/features/legal/types";
import { EMPRESA } from "@/features/legal/empresa";
import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { DashboardScreen } from "@/pages/buyer/BuyerDashboard";
import { ImporterDashboardScreen } from "@/pages/importer/ImporterDashboard";
import { QuotesScreen } from "@/components/buyer/tabs/QuotesScreen";
import { QuoteDetailScreen } from "@/components/buyer/tabs/QuoteDetailScreen";
import { ResponseDetailScreen } from "@/components/buyer/tabs/ResponseDetailScreen";
import { ResponsesScreen } from "@/components/buyer/tabs/ResponsesScreen";
import { OrdersScreen } from "@/components/buyer/tabs/OrdersScreen";
import { OrderDetailScreen } from "@/components/buyer/tabs/OrderDetailScreen";
import { NewQuoteScreen } from "@/components/buyer/tabs/NewQuoteScreen";
import type { QuoteFormState, OrigenSolicitud } from "@/components/buyer/tabs/NewQuoteScreen";
import { ImporterCompanyProfileScreen } from "@/components/importer/tabs/ImporterCompanyProfileScreen";
import { ImporterAdvisorsScreen } from "@/components/importer/tabs/ImporterAdvisorsScreen";
import { ImporterQuotesScreen } from "@/components/importer/tabs/ImporterQuotesScreen";
import { AdvisorQuoteDetailModal } from "@/components/advisor/tabs/AdvisorQuoteDetailModal";
import { AdvisorDashboardScreen } from "@/components/advisor/tabs/AdvisorDashboardScreen";
import { AdvisorAvailableScreen } from "@/components/advisor/tabs/AdvisorAvailableScreen";
import { AdvisorMyQuotesScreen } from "@/components/advisor/tabs/AdvisorMyQuotesScreen";
import { ImpAdvisorDashboard } from "@/pages/advisor/AdvisorDashboard";
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";
import { DocumentUploadButton } from "@/app/components/files/DocumentUploadButton";
import { ImagenArchivo } from "@/app/components/files/ImagenArchivo";
import { TendenciasFeed } from "@/features/tendencias/Feed";
import { TendenciaFicha } from "@/features/tendencias/Ficha";
import { EnviarEnlace } from "@/features/tendencias/EnviarEnlace";
import { RecomendadosEmpresa } from "@/features/tendencias/Recomendados";
import { PanelAprobacion } from "@/features/tendencias/PanelAprobacion";
import { PanelDiseno } from "@/features/tendencias/PanelDiseno";
import { ModulosPlataforma } from "@/features/admin/ModulosPlataforma";
import { RevisionPagos } from "@/features/admin/RevisionPagos";
import { AccesosCursos } from "@/features/admin/AccesosCursos";
import { RevisionPresentaciones } from "@/features/admin/RevisionPresentaciones";
import { PlanesAdmin } from "@/features/admin/PlanesAdmin";
import { LISTA_CERRADA, SeccionPlanes } from "@/features/planes/SeccionPlanes";
import { ListaEsperaApertura } from "@/features/planes/ListaEspera";
import { InscripcionPlan } from "@/features/planes/InscripcionPlan";
import { ModalRechazoCotizacion } from "@/features/importador/RechazarCotizacion";
import { CargueDescarguePagos } from "@/features/pagos/CargueDescarguePagos";
import { PagoOrden } from "@/features/ordenes/PagoOrden";
import { fijarRegistro, registroAbierto } from "@/app/registro";
import { RetoPagina } from "@/features/reto/RetoPagina";
import { PerfilUsuario } from "@/features/perfil/PerfilUsuario";
import { BloqueLanding } from "@/features/landing/BloqueLanding";
import { RetoAdmin } from "@/features/reto/RetoAdmin";
import type { PrefillSolicitud } from "@/features/tendencias/prefill";
import { CatalogosEmpresa } from "@/features/catalogos/CatalogosEmpresa";
import { CatalogosComprador } from "@/features/catalogos/CatalogosComprador";
import { TipografiaPlataforma } from "@/features/admin/TipografiaPlataforma";
import { useAuth } from "@/hooks/useAuth";
import { useAutoRefresh, type AutoRefreshReason } from "@/hooks/useAutoRefresh";
import { useChatSocket } from "@/hooks/useChatSocket";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { authService } from "@/services/auth.service";
import { resolveHeaderSubtitle } from "@/app/utils/header-profile-subtitle";
import { useBrandTheme } from "@/app/hooks/useBrandTheme";
import {
  Avatar, BADGE_MAP, Badge, Button, Card, ContactBtn, Input, Logo, NotifIcon,
  openSmartContact, Select, Textarea, Timeline,
} from "@/app/components/design-system";
import { formatChatTime, parseBackendDate } from "@/lib/date";
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
} from "@/services/business.service";
import { FormularioPropuesta } from "@/features/propuestas/FormularioPropuesta";
import { TarjetaPropuestaChat, leerPropuestaDeMensaje, type PropuestaEnMensaje } from "@/features/propuestas/TarjetaPropuestaChat";
import { CondicionesEmpresa } from "@/features/propuestas/CondicionesEmpresa";
import { leerPropuesta, pesos as pesosCop, type FormularioPropuesta as FormularioPropuestaDatos } from "@/features/propuestas/calculo";
import { getStoredRole, getStoredToken, resolveApiUrl, toApiPath } from "@/services/api-client";
import { landingService, leerVideosQuienesSomos, type LandingBlock, type LandingDynamicContent, type LandingSection } from "@/services/landing.service";
import { CarruselVideos } from "@/app/components/media/CarruselVideos";
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
export function cantidadConUnidad(cantidad: string | number | null | undefined, unidad?: string | null, largo = false): string {
  if (cantidad === null || cantidad === undefined || cantidad === "") return "—";
  const numero = Number(cantidad);
  const texto = Number.isFinite(numero) ? numero.toLocaleString("es-CO", { maximumFractionDigits: 2 }) : String(cantidad);
  if (unidad === "m3") return `${texto} m³`;
  return `${texto} ${largo ? "unidades" : "u"}`;
}
/** Producto de Tendencias que un visitante quiso cotizar antes de registrarse. */
const CLAVE_PREFILL_PENDIENTE = "zarpi:prefill-pendiente";
/** Pantalla (y por tanto URL) de cada documento legal. */
const PANTALLA_LEGAL: Record<LegalPage, Screen> = {
  data: "policy-data",
  terms: "policy-terms",
  payments: "policy-payments",
  planes: "policy-planes",
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DATA
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

export interface QuoteResponse {id:string;importerId:string;quoteId:string;price:string;deliveryTime:string;incoterm:string;date:string;status:ResponseStatus;moq:string;origin:string;production:string;customization:string;observations:string;}

const RESPONSES:QuoteResponse[]=[
  {id:"r001",importerId:"nexus",    quoteId:"q001",price:"9.20 USD/kg", deliveryTime:"28 días",incoterm:"FOB",date:"14 Mar 2025",status:"resp-nueva",    moq:"300 kg",  origin:"Colombia",production:"Propia",     customization:"Marca blanca",             observations:"Café lavado, proceso húmedo, tostado medio."},
  {id:"r002",importerId:"food",     quoteId:"q001",price:"8.80 USD/kg", deliveryTime:"21 días",incoterm:"CIF",date:"13 Mar 2025",status:"resp-vista",    moq:"500 kg",  origin:"Colombia",production:"Tercerizada",customization:"Estándar",                 observations:"Stock disponible inmediato."},
  {id:"r003",importerId:"textil",   quoteId:"q002",price:"3.45 USD/m",  deliveryTime:"45 días",incoterm:"CIF",date:"08 Mar 2025",status:"resp-vista",    moq:"800 m",   origin:"China",   production:"Propia",     customization:"Personalización completa", observations:"Certificación OEKO-TEX disponible."},
  {id:"r004",importerId:"mecanica", quoteId:"q003",price:"398 USD/set", deliveryTime:"60 días",incoterm:"DDP",date:"03 Mar 2025",status:"resp-aceptada", moq:"10 sets", origin:"Alemania",production:"OEM",        customization:"Estándar",                 observations:"Garantía 24 meses incluida."},
  {id:"r005",importerId:"secvision",quoteId:"q008",price:"165 USD/u",   deliveryTime:"35 días",incoterm:"CIF",date:"12 Ene 2025",status:"resp-aceptada", moq:"10 u",    origin:"China",   production:"Propia",     customization:"Marca blanca",             observations:"Certificación CE e IP67."},
];

export interface OrderHistoryItem {estado:string;fecha:string;nota:string|null;}
export interface OrderDocumentItem {name:string;date:string;status:string;url:string;type:string;}
export interface LifecycleDocItem {label:string;name:string;status:string;url:string|null;source:string;}
export interface Order {
  id:string;
  code:string;
  quoteCode:string;
  product:string;
  importerId:string;
  advisorName?:string;
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
const ORDER_STATES=[
  {key:"cotizacion_aceptada",     label:"Orden generada · pago pendiente"},
  {key:"en_produccion",           label:"Orden en producción"},
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

export function orderDocumentTypeLabel(tipo:string|undefined|null):string{
  return ORDER_DOCUMENT_LABELS[String(tipo||"")]||"Documento";
}

export function orderStateLabel(key:string|undefined|null):string{
  const found=ORDER_STATES.find((s)=>s.key===String(key||""));
  return found?found.label:(key?String(key):"Sin estado");
}

/** ?nico estado al que el backend deja avanzar desde el actual (cadena lineal). */
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

// â”€â”€â”€ Chat data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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



export const INCOTERM_INCLUYE: Record<string,string> = {
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

export function leerCondicionesPropuesta(texto: string | null | undefined): { descripcion: string; ventajas: string; detalles: string[] } {
  const vacio = { descripcion: "", ventajas: "", detalles: [] as string[] };
  if (!texto) return vacio;
  // Propuesta rápida (precio cerrado en pesos): su detalle completo está en la
  // tarjeta del chat; aquí basta la nota y lo esencial.
  const nueva = leerPropuesta(texto);
  if (nueva) {
    const f = nueva.formulario;
    const detalles = [
      f.entrega_modo === "cliente" ? `Puesto en ${f.bodega_ciudad}; flete a ${f.ciudad_destino} a cargo del cliente` : `Entregado en ${f.ciudad_destino}`,
      f.requiere_permisos && f.permiso_cual ? `${f.permiso_cual} (${f.permiso_gestiona === "importadora" ? "incluido" : "lo gestiona el cliente"})` : "",
      `Válida hasta ${new Date(`${nueva.vigencia_hasta}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}`,
    ].filter(Boolean);
    return { descripcion: f.nota || "", ventajas: "", detalles };
  }
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

/**
 * Precio de una propuesta para comparar. Las del formato nuevo son un precio
 * cerrado en pesos con IVA; las anteriores, USD con el equivalente a la TRM.
 */

export function PrecioPropuesta({ propuesta, trm, tamano = "sm" }: { propuesta: BackendPropuesta; trm?: number | null; tamano?: "sm" | "base" }) {
  const nueva = leerPropuesta(propuesta.condiciones_adicionales);
  const clase = clsx("font-semibold", tamano === "base" ? "text-base" : "text-sm");
  if (nueva) {
    return (
      <>
        <p className={clase}>{pesosCop(nueva.totales.total_cop)}</p>
        <p className="text-[11px] text-muted-foreground">con IVA · {pesosCop(nueva.totales.unitario_cop)} por unidad</p>
      </>
    );
  }
  return (
    <>
      <p className={clase}>US${propuesta.precio_ofrecido_usd.toLocaleString("es-CO")}</p>
      {trm ? <p className="text-[11px] text-muted-foreground">≈ {formatoPesos(propuesta.precio_ofrecido_usd * trm)}</p> : null}
    </>
  );
}

export const MOTIVOS_ELECCION: { clave: MotivoEleccion; etiqueta: string; ayuda: string }[] = [
  { clave: "precio", etiqueta: "Precio", ayuda: "Me salió mejor en costo" },
  { clave: "tiempo", etiqueta: "Tiempo de entrega", ayuda: "Llega antes" },
  { clave: "condiciones", etiqueta: "Condiciones", ayuda: "Lo que incluye, pagos, garantías" },
  { clave: "otro", etiqueta: "Otro motivo", ayuda: "Confianza, atención, recomendación..." },
];

export interface ChatConv {
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
  // Solo en el chat de un asesor visto por la cuenta dueña de la empresa.
  atiendeNombre?:string;
  status:"activa"|"archivada";unread:number;lastMsg:string;lastDate:string;
}
type MsgFileType="pdf"|"excel"|"word"|"image";
interface MsgFile {name:string;type:MsgFileType;size:string;}
interface ChatMsg {
  id:string;sender:"client"|"provider";text?:string;file?:MsgFile;
  time:string;read:boolean;dateGroup?:string;
  // Propuesta enviada (`tipo: "propuesta"`): se muestra como tarjeta.
  proposal?:PropuestaEnMensaje;
  // Nombre de quien lo escribió, cuando no es quien mira.
  authorName?:string;
}

/**
 * `sender: "client"` es el lado de quien mira la pantalla: lo suyo y, en una
 * negociación, lo de su empresa (la dueña que abre el chat de su asesor ve al
 * asesor a la derecha y al cliente a la izquierda). Lo decide el backend con
 * `de_mi_lado`; sin él, solo lo propio.
 */
function mapBackendChatMessage(
  message:{id:string;remitente_id:string;contenido:string;tipo:string;fecha_envio:string;metadata:Record<string,unknown>|null;remitente_nombre?:string|null;de_mi_lado?:boolean|null},
  currentUserId:string|undefined,
):ChatMsg{
  const proposal=message.tipo==="propuesta" ? leerPropuestaDeMensaje(message.metadata) : undefined;
  return {
    id:message.id,
    sender:message.de_mi_lado && message.remitente_id===currentUserId ? "client" : "provider",
    authorName:message.remitente_id!==currentUserId?(message.remitente_nombre||undefined):undefined,
    text:message.contenido,
    time:formatChatTime(message.fecha_envio),
    read:true,
    proposal,
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
const SYSTEM_ROOT_FOLDER_NAMES=["?rdenes","Cotizaciones","Respuestas","Cursos","Chats","Certificados"];
// Buzón al que escribe quien quiere dar de alta una empresa importadora: el
// alta la hace el equipo de la plataforma, no hay auto-registro.
const CORREO_ADMINISTRACION="admin@zarpi.co";

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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SIDEBAR ? pinned / floating / toggle tab
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const NAV_ITEMS=[
  {icon:LayoutGrid,   label:"Dashboard",    key:"dashboard"},
  {icon:FileText,     label:"Cotizaciones", key:"quotes"},
  {icon:Sparkles,     label:"Tendencias",   key:"tendencias"},
  {icon:Trophy,       label:"Reto",         key:"reto"},
  {icon:LibraryBig,   label:"Catálogos",    key:"catalogos"},
  {icon:ClipboardList,label:"Respuestas",   key:"responses"},
  {icon:MessageSquare,label:"Chats",        key:"chats"},
  {icon:ShoppingCart, label:"Operaciones",  key:"orders"},
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
  {icon:Sparkles,      label:"Tendencias",   key:"tendencias"},
  {icon:ShoppingCart,  label:"Operaciones",  key:"orders"},
  {icon:MessageSquare, label:"Chats",        key:"chats"},
  {icon:BookOpen,      label:"Cursos",       key:"courses"},
  {icon:FolderOpen,    label:"Documentos",   key:"documentos"},
];

const NAV_ASESOR=[
  {icon:LayoutGrid,    label:"Dashboard",       key:"adv-dashboard"},
  {icon:Zap,           label:"Disponibles",     key:"adv-available"},
  {icon:ClipboardList, label:"Mis cotizaciones",key:"adv-my-quotes"},
  {icon:LibraryBig,    label:"Catálogos",       key:"imp-catalogos"},
  {icon:Sparkles,      label:"Tendencias",      key:"tendencias"},
  {icon:MessageSquare, label:"Chats",           key:"chats"},
];

// â”€â”€â”€ Portal data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// "soporte" es el equipo de atención al cliente de la plataforma: atiende los
// tickets y resuelve incidentes, pero no administra (ni empresas, ni cuentas,
// ni certificaciones, ni copias de seguridad).
// "designer" es el equipo de diseño: pone portada e imágenes con la identidad de
// Zarpi a lo aprobado en Tendencias y lo publica. Está en el canal del equipo,
// pero no ve soporte ni clientes.
export type UserRole="solicitante"|"importadora"|"asesor"|"admin"|"soporte"|"designer";

// Cada área del panel es una entrada del sidebar, igual que en los demás
// perfiles: así se navega con el mismo mecanismo que el resto de la aplicación
// y cada una tiene su propia URL.
const NAV_ADMIN=[
  {icon:LayoutGrid,    label:"Resumen",         key:"admin-dashboard"},
  {icon:Building2,     label:"Empresas",        key:"admin-empresas"},
  {icon:Film,          label:"Presentaciones",  key:"admin-presentaciones"},
  {icon:GitCompare,    label:"Asignación",      key:"admin-asignacion"},
  {icon:Users,         label:"Usuarios",        key:"admin-usuarios"},
  {icon:WalletCards,   label:"Cotizantes",      key:"admin-cotizantes"},
  {icon:Mail,          label:"Correos",         key:"admin-correos"},
  {icon:LifeBuoy,      label:"Soporte",         key:"admin-soporte"},
  {icon:Award,         label:"Certificaciones", key:"admin-certificaciones"},
  {icon:DatabaseBackup,label:"Respaldos",       key:"admin-respaldos"},
  {icon:Layers,        label:"Landing",         key:"admin-landing"},
  {icon:Flame,         label:"Tendencias",      key:"admin-tendencias"},
  {icon:Sparkles,      label:"Aprobación",      key:"admin-tendencias-aprobacion"},
  {icon:Palette,       label:"Diseño",          key:"diseno"},
  {icon:Trophy,        label:"Reto",            key:"admin-reto"},
  {icon:CreditCard,    label:"Pagos",           key:"admin-pagos"},
  {icon:WalletCards,   label:"Planes",          key:"admin-planes"},
  {icon:BookOpen,      label:"Cursos de Zarpi", key:"admin-cursos"},
  {icon:GraduationCap, label:"Accesos a cursos",key:"admin-cursos-accesos"},
  {icon:Type,          label:"Tipografía",      key:"admin-tipografia"},
  {icon:ToggleRight,   label:"Módulos",         key:"admin-modulos"},
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

// Diseño: su trabajo (la cola), Tendencias para ver cómo queda publicado y
// sus archivos. El canal del equipo va en el botón de la cabecera.
const NAV_DISENO=[
  {icon:Palette,       label:"Diseño",      key:"diseno"},
  {icon:Sparkles,      label:"Tendencias",  key:"tendencias"},
  {icon:FolderOpen,    label:"Documentos",  key:"documentos"},
];

// Pantallas a las que entra un designer. Lo demás (cotizaciones, órdenes,
// chats de clientes) no es suyo: se le devuelve a su inicio.
const PANTALLAS_DESIGNER:Screen[]=["diseno","team-channel","user-profile","notifications","documentos","tendencias","tendencia-detalle"];

type StoredRole = "solicitante" | "importador" | "importadora" | "asesor" | "admin" | "soporte" | "designer";

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

  if (normalizedRole === "solicitante" || normalizedRole === "asesor" || normalizedRole === "soporte" || normalizedRole === "designer") {
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
  if (role === "designer") {
    return "diseno";
  }
  return "dashboard";
}

function formatShortDate(value: string): string {
  const d = parseBackendDate(value);
  if (Number.isNaN(d.getTime())) {
    return value;
  }
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

export function initialsFromName(name: string): string {
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

const ROL_ASESOR_PUBLICO: Record<string, string> = { asesor: "Asesor", importador: "Responsable de la cuenta" };
const PRICE_CURRENCIES = ["USD", "EUR", "COP", "MXN", "CLP", "PEN", "GBP"];

/**
 * Contacto principal de la empresa. Manda lo que la empresa escribió en su
 * perfil; si no escribió nada, la primera persona real que atiende (antes
 * aparecía el texto de relleno «Asesor asignado»), y si no hay nadie, la propia
 * empresa.
 */
function resolveImporterAdvisorProfile(
  perfil: Record<string, unknown> | null | undefined,
  companyName: string,
  asesores: BackendImporter["asesores"] = [],
) {
  const principal = asesores?.[0];
  const advisorName =
    readPerfilPublicoString(perfil, "advisor_name", "asesor_nombre", "contact_name", "nombre_contacto") ||
    principal?.nombre ||
    companyName;
  const advisorRole =
    readPerfilPublicoString(perfil, "advisor_role", "asesor_rol", "cargo_contacto", "contact_role") ||
    (principal ? ROL_ASESOR_PUBLICO[principal.rol] || "Asesor" : "Equipo comercial");
  const advisorEmail = readPerfilPublicoString(perfil, "advisor_email", "asesor_email", "email", "correo");
  const advisorPhone = readPerfilPublicoString(perfil, "advisor_phone", "asesor_telefono", "phone", "telefono");

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
  const advisorProfile = resolveImporterAdvisorProfile(perfil, name, imp.asesores);
  return {
    description: readPerfilPublicoString(perfil, "descripcion", "description", "about"),
    certs: readPerfilPublicoStringArray(perfil, "certs", "certificaciones"),
    bannerUrl: readPerfilPublicoString(perfil, "banner_url", "banner"),
    logoUrl: imp.logo_url ?? "",
    // Ficha corporativa: la empresa ya rellenaba estos campos en su perfil,
    // pero nadie los leía, así que no aparecían en ninguna pantalla pública.
    website: readPerfilPublicoString(perfil, "website", "sitio_web", "web"),
    email: readPerfilPublicoString(perfil, "email", "correo", "email_contacto"),
    phone: readPerfilPublicoString(perfil, "phone", "telefono"),
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
    // ?rdenes entregadas que cuenta el backend. Antes era un 0 fijo y todas las
    // empresas se presentaban como si no hubieran cerrado ni un proyecto.
    projects: Number(imp.proyectos_completados ?? 0),
    verified: Boolean(imp.verificado),
    country: primaryCountry,
    categories: imp.especialidad_producto.length > 0 ? imp.especialidad_producto : ["General"],
    tierMinimoRequerido: ["Bronze", "Silver", "Gold", "Élite"].includes(tierMinimoRequerido) ? tierMinimoRequerido as Importer["tierMinimoRequerido"] : "Bronze",
    shippingMarkPrefix: imp.shipping_mark_prefijo ?? undefined,
    advisors: (imp.asesores ?? []).map((asesor) => ({
      id: asesor.id,
      name: asesor.nombre,
      role: ROL_ASESOR_PUBLICO[asesor.rol] || "Asesor",
      initials: initialsFromName(asesor.nombre),
      color: "bg-slate-600",
    })),
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
    case "rechazada":
      return "rejected-importer";
    default:
      return "created";
  }
}

function parseTargetPriceCurrency(value:string|undefined|null):string { const clean=(value||"").trim().toUpperCase(); if(!clean) return "USD"; return PRICE_CURRENCIES.includes(clean)?clean:"USD"; }

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
    motivoRechazo: cot.motivo_rechazo ?? null,
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
    deliveryCity: cot.ciudad_entrega ?? null,
    customFields: cot.campos_personalizados_valores ?? null,
    requesterId: cot.solicitante_id,
    tierMinimoRequerido: cot.tier_minimo_requerido ?? "Bronze",
    solicitanteTier: cot.solicitante_tier ?? "Bronze",
    solicitantePuntosCotizacion: cot.solicitante_puntos_cotizacion ?? 0,
    bloqueada: Boolean(cot.bloqueada),
  };
}function normalizeText(value: unknown): string {
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
export function GaleriaFotosProducto({fotos}:{fotos:string[]}) {
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
    price: leerPropuesta(p.condiciones_adicionales) ? `${pesosCop(leerPropuesta(p.condiciones_adicionales)!.totales.total_cop)} COP con IVA` : `${p.precio_ofrecido_usd} USD`,
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
    advisorName: order.asesor_nombre || undefined,
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

export interface CompanyAdvisor {
  id:string;name:string;role:string;email:string;phone:string;
  initials:string;color:string;status:"activo"|"inactivo"|"ausente";
  availability:"alta"|"media"|"baja";activeQuotes:number;avgResponse:string;joinDate:string;
}

const COMPANY_ADVISORS:CompanyAdvisor[]=[
  {id:"adv1",name:"Carlos Mendoza",role:"Asesor Senior",email:"c.mendoza@nexus.co",phone:"+57 310 123 4567",initials:"CM",color:"bg-blue-600",status:"activo",availability:"alta",activeQuotes:4,avgResponse:"~20h",joinDate:"Ene 2022"},
  {id:"adv2",name:"Laura Gómez",role:"Asesora Comercial",email:"l.gomez@nexus.co",phone:"+57 311 234 5678",initials:"LG",color:"bg-purple-600",status:"activo",availability:"media",activeQuotes:2,avgResponse:"~32h",joinDate:"Mar 2022"},
  {id:"adv3",name:"Andrés Peña",role:"Asesor Técnico",email:"a.pena@nexus.co",phone:"+57 312 345 6789",initials:"AP",color:"bg-emerald-600",status:"ausente",availability:"baja",activeQuotes:0,avgResponse:"~48h",joinDate:"Jul 2023"},
  {id:"adv4",name:"Juliana Ríos",role:"Asesora Junior",email:"j.rios@nexus.co",phone:"+57 313 456 7890",initials:"JR",color:"bg-orange-600",status:"inactivo",availability:"baja",activeQuotes:0,avgResponse:"?",joinDate:"Nov 2023"},
];

interface AppNotification {
  id:string;type:"response"|"message"|"status"|"order"|"document"|"advisor"|"update";
  title:string;body:string;date:string;read:boolean;
  cotizacionId?:string;conversationId?:string;approval?:boolean;
  /** Pantalla a la que lleva la notificación cuando no es de una cotización ni de un chat. */
  destino?:"tendencias-enviar"|"catalogos"|"reto"|"diseno"|"pagos"|"admin-pagos";
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
    // "Para diseñar" lleva a la cola de diseño; el resto de Tendencias, a mis envíos.
    destino: notification.tipo === "tendencias" ? (notification.data?.evento === "para_disenar" ? "diseno" : "tendencias-enviar")
      : notification.tipo === "reto" ? "reto"
      // Comprobantes: el admin revisa los nuevos; el usuario ve el resultado en Pagos.
      : notification.tipo === "pagos" ? (notification.data?.evento === "comprobante_nuevo" ? "admin-pagos" : "pagos")
      : notification.tipo === "catalogo" ? "catalogos" : undefined,
  };
}

type NavItem={icon:React.FC<{className?:string}>;label:string;key:string};

export function Sidebar({active,onNav,pinned,onToggle,navItems,onLogout,onSoporte,showSoporte,onCanalEquipo,showCanalEquipo}:SidebarCtrl) {
  const { dark } = useBrandTheme();
  const [hovered,setHovered]=useState(false);
  const [openAdminGroup,setOpenAdminGroup]=useState<string|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>>(null);
  const floating=!pinned&&hovered;
  const isExpanded=pinned||hovered;
  const isAdminNavigation=navItems.some(item=>item.key==="admin-dashboard");
  const adminGroups=[
    {key:"gestion",label:"Gestión",icon:Building2,items:["admin-empresas","admin-presentaciones","admin-asignacion","admin-usuarios","admin-cotizantes"]},
    {key:"comunicacion",label:"Comunicación",icon:MessageSquare,items:["admin-correos","admin-soporte","chats","documentos"]},
    {key:"contenido",label:"Contenido",icon:Layers,items:["admin-landing","admin-tendencias","admin-tendencias-aprobacion","diseno","admin-reto"]},
    {key:"finanzas",label:"Suscripciones",icon:WalletCards,items:["admin-pagos","admin-planes","admin-cursos","admin-cursos-accesos"]},
    {key:"configuracion",label:"Configuración",icon:ToggleRight,items:["admin-certificaciones","admin-respaldos","admin-tipografia","admin-modulos"]},
  ] as const;

  useEffect(()=>{
    if(!isAdminNavigation)return;
    const activeGroup=adminGroups.find(group=>group.items.includes(active));
    if(activeGroup)setOpenAdminGroup(activeGroup.key);
  },[active,isAdminNavigation]);

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

        <nav className="flex flex-col gap-0.5 p-2 mt-1 flex-1 overflow-y-auto">
          {isAdminNavigation ? (
            <>
              {navItems.filter(item=>item.key==="admin-dashboard").map(({icon:Icon,label,key})=>{
                const isActive=active===key;
                return (
                  <button
                    key={key}
                    onClick={()=>onNav(key)}
                    className={clsx(
                      "flex items-center rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150 w-full",
                      isActive
                        ? "bg-primary/8 text-primary dark:bg-accent/15 dark:text-accent"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                      isExpanded ? "gap-2.5" : "justify-center gap-0"
                    )}
                    title={!isExpanded ? label : undefined}
                  >
                    <Icon className={clsx("w-4 h-4 flex-shrink-0",isActive&&"text-primary dark:text-accent")}/>
                    <div className={clsx("overflow-hidden transition-all duration-200",isExpanded?"w-auto opacity-100":"w-0 opacity-0")}>
                      <span className="whitespace-nowrap">{label}</span>
                    </div>
                    {isExpanded&&isActive&&<span className="ml-auto w-1 h-4 rounded-full bg-primary dark:bg-accent flex-shrink-0"/>}
                  </button>
                );
              })}
              {adminGroups.map(group=>{
                const GroupIcon=group.icon;
                const groupItems=navItems.filter(item=>group.items.includes(item.key));
                if(groupItems.length===0)return null;
                const isOpen=openAdminGroup===group.key;
                const hasActiveItem=groupItems.some(item=>item.key===active);
                return (
                  <div key={group.key} className="mt-1">
                    <button
                      type="button"
                      onClick={()=>isExpanded&&setOpenAdminGroup(current=>current===group.key?null:group.key)}
                      className={clsx(
                        "flex items-center rounded-lg px-2.5 py-2 text-sm font-semibold transition-all duration-150 w-full",
                        hasActiveItem
                          ? "text-primary dark:text-accent"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted",
                        isExpanded?"gap-2.5":"justify-center gap-0"
                      )}
                      title={!isExpanded?group.label:undefined}
                      aria-expanded={isExpanded?isOpen:undefined}
                    >
                      <GroupIcon className="w-4 h-4 flex-shrink-0"/>
                      <div className={clsx("overflow-hidden transition-all duration-200",isExpanded?"w-auto opacity-100":"w-0 opacity-0")}>
                        <span className="whitespace-nowrap">{group.label}</span>
                      </div>
                      {isExpanded&&<ChevronDown className={clsx("ml-auto w-4 h-4 transition-transform duration-200",isOpen&&"rotate-180")}/>}
                    </button>
                    {isExpanded&&isOpen&&(
                      <div className="grid grid-rows-[1fr]">
                        <div className="min-h-0 overflow-hidden">
                          <div className="ml-2 border-l border-border pl-2 pt-0.5">
                            {groupItems.map(({icon:Icon,label,key})=>{
                              const isActive=active===key;
                              return (
                                <button
                                  key={key}
                                  onClick={()=>onNav(key)}
                                  className={clsx(
                                    "flex items-center rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150 w-full gap-2.5",
                                    isActive
                                      ? "bg-primary/8 text-primary dark:bg-accent/15 dark:text-accent"
                                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                  )}
                                >
                                  <Icon className={clsx("w-4 h-4 flex-shrink-0",isActive&&"text-primary dark:text-accent")}/>
                                  <span className="whitespace-nowrap">{label}</span>
                                  {isActive&&<span className="ml-auto w-1 h-4 rounded-full bg-primary dark:bg-accent flex-shrink-0"/>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : navItems.map(({ icon: Icon, label, key }) => {
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
            title={!isExpanded ? "Cerrar sesión" : undefined}
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SOPORTE TÉCNICO ? formulario de apertura de ticket
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          placeholder="Ej. No puedo subir el packing list de mi operación"
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// APP HEADER
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function AppHeader({ user, notifCount = 0, onNotif, onProfile, sb }: { user: { name: string; company: string; initials: string; photoUrl?: string }; notifCount?: number; onNotif?: () => void; onProfile?: () => void; sb?: SidebarCtrl }) {
  const { dark, toggleTheme } = useBrandTheme();
  const { user: authUser } = useAuth();
  
  // Estado para el popover de créditos
  const [showCreditosModal, setShowCreditosModal] = useState(false);
  const creditosRef = useRef<HTMLDivElement>(null);

  const count = sb?.notifCount ?? notifCount;
  const handler = sb?.onNotif ?? onNotif;
  const profileHandler = sb?.onProfile ?? onProfile;
  const chatHandler = sb?.onChat;
  const helpHandler = sb?.onHelp;
  const chatCount = sb?.chatCount ?? 0;
  const showHelp = sb?.showHelp ?? true;
  const displayName = authUser?.nombre?.trim() || authUser?.email || user.name;
  const displayCompany = sb?.profileSubtitle || user.company || authUser?.email || "";
  const initialsSource = authUser?.nombre?.trim() || authUser?.email || user.name;
  const displayInitials = initialsFromName(initialsSource);
  const authUserPhoto = (authUser as { foto_url?: string | null } | null)?.foto_url || "";
  const displayPhotoUrl = authUserPhoto || sb?.profilePhotoUrl || user.photoUrl || "";
  const creditos = Number((authUser as { puntos_cotizacion?: number } | null)?.puntos_cotizacion ?? 0);

  // Cierre automático al hacer clic fuera del badge/popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (creditosRef.current && !creditosRef.current.contains(event.target as Node)) {
        setShowCreditosModal(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-[57px] flex items-center justify-between px-5 bg-white border-b border-border flex-shrink-0 relative">
      {/* LADO IZQUIERDO: BADGE Y POPOVER DE CRÉDITOS */}
      <div className="flex items-center">
        {authUser?.rol === "solicitante" && (
          <div className="relative" ref={creditosRef}>
            <button
              type="button"
              onClick={() => setShowCreditosModal((prev) => !prev)}
              onMouseEnter={() => setShowCreditosModal(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold text-primary transition-all duration-200 hover:border-primary/40 hover:shadow-sm dark:border-accent/30 dark:text-accent dark:hover:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <WalletCards className="h-3.5 w-3.5 animate-pulse" />
              <span>{creditos} créditos</span>
            </button>

            {/* Popover animado */}
            {showCreditosModal && (
              <div 
                className="absolute left-0 top-full mt-2.5 w-72 z-50 rounded-2xl border border-border bg-card p-4 shadow-xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-accent/10 dark:text-accent">
                    <WalletCards className="h-4 w-4" />
                  </div>
                  <div className="space-y-1 text-left">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-foreground">Créditos disponibles</p>
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary dark:bg-accent/20 dark:text-accent">
                        {creditos}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong>1 crédito</strong> te permite enviar una cotización a empresas de categorías superiores (Plata, Oro, etc.).
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Info className="h-3 w-3 text-primary dark:text-accent" /> Se descuentan por solicitud
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCreditosModal(false)}
                    className="font-medium text-primary hover:underline dark:text-accent"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            )}
          </div>
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

export const USER={name:"Ana García",company:"Importaciones del Norte S.A.",initials:"AG"};
export const USER_IMPORTADORA={name:"María López",company:"Grupo Nexus S.A.",initials:"ML"};
const USER_ASESOR={name:"Carlos Mendoza",company:"Grupo Nexus S.A. ? Asesor",initials:"CM"};

function CoursesPortalScreen({
  sb,
  role,
  headerUser,
  companyName,
  onGoDashboard,
  onComprarAcceso,
  active = "courses",
  cursosDeZarpi = false,
}:{
  sb: SidebarCtrl;
  role: "solicitante" | "importadora";
  headerUser: { name: string; company: string; initials: string };
  companyName: string;
  onGoDashboard: () => void;
  onComprarAcceso?: (courseId: string) => void;
  active?: string;
  cursosDeZarpi?: boolean;
}) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active={active}/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={headerUser} sb={sb}/>
        <CoursesScreen role={role} companyName={companyName} onGoDashboard={onGoDashboard} onComprarAcceso={onComprarAcceso} cursosDeZarpi={cursosDeZarpi}/>
      </div>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// IMPORTER CARD ? used in Dashboard and profile screens
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function ImporterCard({
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
          ? "border-primary/20 dark:border-accent/20 shadow-sm ring-1 ring-primary/20 dark:ring-accent/20 landing-glow"
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
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-60 dark:bg-accent/20 text-amber-700 dark:text-accent rounded-full text-[10px] font-semibold">
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
              className="px-2 py-0.5 bg-muted rounded-full text-[10px] font-medium text-muted-foreground"
            >
              {c}
            </span>
          ))}

          {platformCerts.map((c) => (
            <span
              key={c.id}
              title={c.descripcion || `Respaldado por Zarpi`}
              className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-semibold text-primary flex items-center gap-1"
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
              className="px-2 py-0.5 bg-primary/20 dark:bg-accent/20 border border-primary/0 dark:border-accent/0 rounded-full text-[10px] font-medium text-primary dark:text-accent flex items-center gap-1"
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
            className="hover:bg-primary dark:hover:bg-accent hover:text-white dark:hover:text-black"
          >
            Ver perfil
          </Button>

          <Button
            variant="primary"
            size="sm"
            fullWidth
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => onCreateQuote(imp.id)}
            className="dark:bg-accent dark:hover:bg-accent dark:text-black dark:hover:bg-accent/80"
          >
            Cotizar
          </Button>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DASHBOARD SCREEN ? importer marketplace catalog
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// IMPORTER PROFILE SCREEN ? read-only public profile for the requester
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ImporterProfileScreen({importerId,onBack,onCreateQuote,onOpenChat,sb,importers,chats,orders,onAbrirTendencia}:{
  importerId:string;onBack:()=>void;onCreateQuote:(id:string)=>void;onOpenChat:(convId:string)=>void;sb:SidebarCtrl;importers:Importer[];chats:ChatConv[];orders:Order[];onAbrirTendencia:(id:string)=>void;
}) {
  const imp=importers.find(i=>i.id===importerId)||importers[0]||IMPORTERS[0];
  // Lo que la empresa configuró en su perfil manda; los textos de ejemplo solo
  // se usan para las importadoras de demostración, que no tienen perfil real.
  const desc=imp.description||IMP_DESCRIPTIONS[imp.id]||"Esta empresa aún no ha publicado su descripción.";
  const certs=(imp.certs&&imp.certs.length>0)?imp.certs:(IMP_CERTS[imp.id]||[]);
  const platformCerts=imp.platformCerts ?? [];
  const bannerUrl=imp.bannerUrl?resolveApiUrl(imp.bannerUrl):"";
  const logoUrl=imp.logoUrl?resolveApiUrl(imp.logoUrl):"";
  const relQuotes=QUOTES.filter(q=>q.importer===imp.name);
  const relOrders=orders.filter(o=>o.importerId===imp.id);
  const relChats=chats.filter(c=>c.importerId===imp.id);

  // Las personas reales que atienden en la empresa. Antes se añadía un
  // «Suplente / Asesor Jr.» inventado con un correo que no existía. El correo
  // es el de contacto de la empresa: el de cada asesor no se publica.
  const correoEmpresa=imp.email||imp.advisor.email||"";
  const ADVISORS=(imp.advisors&&imp.advisors.length>0?imp.advisors:[imp.advisor]).map(adv=>({...adv,email:correoEmpresa}));

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
                <ContactBtn type="chat" onClick={()=>openSmartContact({type:"chat",onOpenChat:()=>{if(relChats[0])onOpenChat(relChats[0].id);}})}/>
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
              {/* Productos de Tendencias que recomienda la empresa: cotizarlos
                  le llega solo a ella. No pinta nada si no tiene. */}
              <RecomendadosEmpresa importadorId={imp.id} onAbrir={onAbrirTendencia}/>

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
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><UserRound className="w-4 h-4 text-primary"/>{ADVISORS.length===1?"Quién te atiende":"Asesores disponibles"}</h3>
                <div className="space-y-3">
                  {ADVISORS.map((adv,i)=>(
                    <div key={i} className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
                      <Avatar initials={adv.initials} size="lg" color={adv.color}/>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{adv.name}</p>
                        <p className="text-xs text-muted-foreground">{adv.role}</p>
                        {adv.email&&<p className="text-xs text-primary mt-0.5">{adv.email}</p>}
                      </div>
                      <div className="flex gap-1.5">
                        <ContactBtn type="chat" size="sm" onClick={()=>openSmartContact({type:"chat",onOpenChat:()=>{if(relChats[0])onOpenChat(relChats[0].id);}})}/>
                        {adv.email&&<ContactBtn type="email" label="Email" size="sm" onClick={()=>openSmartContact({type:"email",email:adv.email,onOpenChat:()=>{if(relChats[0])onOpenChat(relChats[0].id);}})}/>}
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
                    {[["Cotizaciones",relQuotes.length,"text-blue-600"],["Operaciones",relOrders.length,"text-purple-600"],["Chats activos",relChats.filter(c=>c.status==="activa").length,"text-emerald-600"]].map(([l,v,c])=>(
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
                  <ContactBtn type="chat" size="sm" label="Contactar por chat" className="w-full justify-center" onClick={()=>openSmartContact({type:"chat",onOpenChat:()=>{if(relChats[0])onOpenChat(relChats[0].id);}})}/>
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// QUOTES SCREEN
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    fotoUrl: conv?.counterpartPhotoUrl ? resolveApiUrl(conv.counterpartPhotoUrl) : "",
  };
}

function puedeVerTierDeContraparte(currentUserRole: UserRole | "admin", counterpartRole: string | undefined, tier: string | undefined): boolean {
  const rolContraparte = String(counterpartRole || "").trim().toLowerCase();
  const esCotizante = rolContraparte === "cotizante" || rolContraparte === "solicitante";
  const esRolAutorizado = currentUserRole === "asesor" || currentUserRole === "importadora" || currentUserRole === "admin";
  return Boolean(tier) && esCotizante && esRolAutorizado;
}

function ChatsScreen({modoEquipo=false,miembrosEquipo=[],onAbrirHiloEquipo,onViewQuote,onViewOrder,sb,initialConvId,conversations,messagesByConversation,onSendMessage,onOpenProposalForm,proposalStateByQuoteId={},onShareLocalAttachment,onShareExistingResource,onTransferConversation,onUpdateOrderStatus,onAttachOrderDocument,onActiveConversationChange,onCloseTicket,onReopenTicket,onEscalateTicket,onRateTicket,companyAdvisors=[],currentUserRole,chatAttachmentsByConversation,orders,quotes,importers}:{modoEquipo?:boolean;miembrosEquipo?:BackendMiembroEquipo[];onAbrirHiloEquipo?:(miembroId:string)=>Promise<string|undefined>;onViewQuote:(id:string)=>void;onViewOrder:(id:string)=>void;sb:SidebarCtrl;initialConvId?:string;conversations:ChatConv[];messagesByConversation:Record<string,ChatMsg[]>;onSendMessage:(conversationId:string,contenido:string,metadata?:Record<string,unknown>)=>Promise<void>;onOpenProposalForm?:(quoteId:string)=>void;proposalStateByQuoteId?:Record<string,string>;onShareLocalAttachment:(conversationId:string,file:File)=>Promise<void>;onShareExistingResource:(conversationIds:string[],fileId:string,message?:string)=>Promise<void>;onTransferConversation:(conversationId:string,newAdvisorEmail:string)=>Promise<void>;onUpdateOrderStatus:(orderId:string,statusValue:string)=>Promise<void>;onAttachOrderDocument:(orderId:string,file:File)=>Promise<void>;onActiveConversationChange?:(conversationId:string|null)=>void;onCloseTicket:(conversationId:string,resolucion:string)=>Promise<void>;onReopenTicket:(conversationId:string)=>Promise<void>;onEscalateTicket:(conversationId:string,nivel:number)=>Promise<void>;onRateTicket:(conversationId:string,calificacion:number,comentario?:string)=>Promise<void>;companyAdvisors?:CompanyAdvisor[];currentUserRole:UserRole|"admin";chatAttachmentsByConversation:Record<string,BackendChatAttachmentItem[]>;orders:Order[];quotes:Quote[];importers:Importer[]}) {
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
  const emojiOptions=["ðŸ˜€","ðŸ˜Ž","ðŸ‘","âœ…","ðŸ“¦","ðŸš¢","ðŸ’¬","ðŸ“Œ","ðŸŽ¯","ðŸ¤","ðŸ™","ðŸ”¥"];

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
    // pestaña, agrupados por asesor.
    if(filter==="asesores")return Boolean(c.atiendeNombre)&&(!searchConv||[c.atiendeNombre,c.refCode,c.counterpartName||""].some(t=>t.toLowerCase().includes(searchConv.toLowerCase())));
    if(c.atiendeNombre)return false;
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
          <p className="text-[11px] text-muted-foreground/80 truncate">{cargando?"Abriendoâ€¦":ultimo||"Escribirle en privado"}</p>
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

  async function handleAttachmentCardClick(attachment: BackendChatAttachmentItem) {
    if (previewType(attachment) === "image" || previewType(attachment) === "pdf" || previewType(attachment) === "video") {
      setPreviewAttachment(attachment);
      return;
    }
    await handleDownloadResource(attachment.storage_url, attachment.nombre);
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
        {k:"ordenes",label:"Operaciones"},
        {k:"cotizaciones",label:"Cotizaciones"},
        // La pestaña de equipo solo aparece si hay algún hilo interno: al
        // solicitante no le sirve de nada y nunca va a tener ninguno.
        ...(conversations.some(c=>c.type==="interno")?[{k:"interno",label:"Equipo"}]:[]),
        ...(conversations.some(c=>c.type==="soporte")?[{k:"soporte",label:"Soporte"}]:[]),
        {k:"no-leidas",label:"No leídas"},
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
                  <Fragment key={c.id}>
                  {nuevoGrupo&&(
                    <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40 border-b border-border/50">
                      Chats de {c.atiendeNombre}
                    </p>
                  )}
                  <button onClick={()=>setSelectedId(c.id)}
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
                  </Fragment>
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
                              <span className={clsx("text-[10px]",msg.read?"text-primary":"text-muted-foreground")}>
                                {msg.read?"âœ“âœ“":"âœ“"}
                              </span>
                            )}
                          </div>
                        </div>
                        {isClient&&<Avatar initials={msg.authorName?initialsFromName(msg.authorName):"AG"} size="sm"/>}
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
                          placeholder="Qué se hizo para resolverloâ€¦"
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


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DOCUMENTOS + PAGOS placeholders
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
                      ? "bg-primary/10 dark:bg-accent/10 text-primary dark:text-accent border-primary/20 dark:border-primary/20 font-medium"
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
                          ? "doc-system-folder dark:!bg-accent/20"
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
                          className="text-xs text-primary dark:text-accent hover:underline whitespace-nowrap"
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

/** Armazón de las pantallas públicas (Tendencias y el reto) para quien no tiene sesión. */
type FooterPublicoProps = {
  onLanding: () => void;
  onPlanes: () => void;
  onPolicy: (page: LegalPage) => void;
  onTendencias: () => void;
};

const enlacePie = "hover:text-accent transition-colors text-left";

function FooterPublico({ onLanding, onPlanes, onPolicy, onTendencias }: FooterPublicoProps) {
  return (
    <footer className="bg-[#0F0F0F] text-white py-10 px-6 relative overflow-hidden">
      <div className="zarpi-blob zarpi-blob-neutral absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-15 scale-125" />
      <div className="mx-auto max-w-7xl relative z-10 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={onLanding} aria-label="Ir al inicio">
            <img src="/brand/zarpi-wordmark-acid.svg" alt="Zarpi" className="h-8 w-28 object-contain object-left" />
          </button>
          <p className="text-xs text-white/70"><span className="font-semibold text-white">{EMPRESA.razonSocial}</span> · NIT {EMPRESA.nit} · {EMPRESA.ciudad}, Colombia</p>
        </div>
        <nav aria-label="Enlaces del pie" className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/70">
          <button onClick={onLanding} className={enlacePie}>Quiénes somos</button>
          <button onClick={onLanding} className={enlacePie}>Cómo funciona</button>
          <button onClick={onPlanes} className={enlacePie}>Planes</button>
          <button onClick={onTendencias} className={enlacePie}>Tendencias</button>
          <button onClick={onLanding} className={enlacePie}>Contacto</button>
          <button onClick={() => onPolicy("planes")} className={enlacePie}>Condiciones de los planes</button>
          <button onClick={() => onPolicy("terms")} className={enlacePie}>Términos y condiciones</button>
          <button onClick={() => onPolicy("data")} className={enlacePie}>Política de tratamiento de datos</button>
        </nav>
        <p className="max-w-5xl text-xs leading-relaxed text-white/55">
          <span className="font-semibold text-white/70">Aviso legal: </span>
          Zarpi S.A.S. es una plataforma de intermediación tecnológica. No importa, no transporta, no nacionaliza ni recibe el dinero de las operaciones. Cada operación se celebra directamente entre quien importa y la empresa importadora que elige.
        </p>
        <p className="border-t border-white/10 pt-5 text-center text-xs text-white/40">? 2026 Zarpi. Todos los derechos reservados.</p>
        <div className="flex justify-center border-t border-white/10 pt-5">
          <PublicSicLogo />
        </div>
      </div>
    </footer>
  );
}

function PantallaPublica({activa,onLanding,onPlanes,onLogin,onRegister,onTendencias,onReto,onPolicy,children}:{activa:"tendencias"|"reto";onLanding:()=>void;onPlanes:()=>void;onLogin:()=>void;onRegister:()=>void;onTendencias:()=>void;onReto:()=>void;onPolicy:(page:LegalPage)=>void;children:React.ReactNode}) {
  const { dark, toggleTheme } = useBrandTheme();
  const claseMenuPublico=(activo:boolean)=>clsx(
    "px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
    activo
      ?"bg-primary text-white dark:bg-accent dark:text-accent-foreground"
      :"text-muted-foreground hover:bg-foreground/15 dark:hover:bg-white/15 dark:hover:text-white",
  );
  const irALanding=()=>onLanding();
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <LandingBackground />
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="flex w-full min-h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <button type="button" onClick={onLanding} aria-label="Ir al inicio" className="flex-shrink-0"><Logo/></button>
          <nav className="hidden xl:flex items-center gap-1">
            {LANDING_TABS.map(section=>{
              const action=section.key==="planes"
                ?onPlanes
                :section.key==="tendencias"
                  ?onTendencias
                  :section.key==="reto"
                    ?onReto
                    :irALanding;
              return <button key={section.key} type="button" onClick={action} className={claseMenuPublico(activa===section.key)}>{section.label}</button>;
            })}
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              aria-label={dark ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground dark:hover:bg-accent dark:hover:text-accent-foreground"
            >
              {dark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
            </button>
            <Button variant="secondary" size="sm" onClick={onLogin}>Iniciar sesión</Button>
            <Button size="sm" className="hidden sm:inline-flex" onClick={onRegister}>{registroAbierto()?"Crear cuenta":"Solicitar acceso"}</Button>
          </div>
        </div>
        <nav className="xl:hidden flex items-center gap-1 overflow-x-auto px-4 pb-2">
          {LANDING_TABS.map(section=>{
            const action=section.key==="planes"
              ?onPlanes
              :section.key==="tendencias"
                ?onTendencias
                :section.key==="reto"
                  ?onReto
                  :irALanding;
            return <button key={section.key} type="button" onClick={action} className={claseMenuPublico(activa===section.key)}>{section.label}</button>;
          })}
        </nav>
      </header>
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6">{children}</main>
      <div className="relative z-10">
        <FooterPublico onLanding={onLanding} onPlanes={onPlanes} onPolicy={onPolicy} onTendencias={onTendencias} />
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


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// NEW QUOTE WIZARD
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const STEPS=["Modalidad","Información del producto","Confirmación"];
export function Modal({open,onClose,title,children,width="max-w-lg"}:{open:boolean;onClose:()=>void;title:string;children:React.ReactNode;width?:string}) {
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// NOTIFICATIONS SCREEN
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
                <p className="text-xs text-muted-foreground mt-1">Cuando haya cambios en cotizaciones, propuestas, chats u operaciones aparecerán aquí.</p>
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// IMPORTER PORTAL ? DASHBOARD
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// IMPORTER PORTAL ? COMPANY PROFILE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    return <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin"/>Guardandoâ€¦</span>;
  }
  return <span className="text-xs text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5"/>Guardado</span>;
}

/**
 * Retardo del autoguardado. Suficiente para no disparar una petición por
 * pulsación y corto para que el usuario vea "Guardado" mientras sigue en el
 * mismo campo: el perfil se perdía porque nadie volvía a pulsar el botón.
 */
const RETARDO_AUTOGUARDADO_MS = 1200;

function CreateResponseScreen({quoteId,onBack,sb,userRole,quotes,onSubmitted,existingProposal,headerUser,companyName,clientName,chatConversationId,onOpenChat,onEditConditions}:{quoteId:string;onBack:()=>void;sb:SidebarCtrl;userRole:UserRole;quotes:Quote[];onSubmitted?:()=>Promise<void>;existingProposal?:BackendPropuesta|null;headerUser:{name:string;company:string;initials:string};companyName:string;clientName?:string;chatConversationId?:string;onOpenChat?:(conversationId:string)=>void;onEditConditions?:()=>void}) {
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

// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE
// ─────────────────────────────────────────────────────────────────────────────
// Textos: zarpi-home-copy-v1.md (raíz del repositorio). Los precios, lo que
// incluye cada plan y los cupos NO están aquí: salen de Admin â€º Planes.
type LandingTabKey=Exclude<LandingSection,"stats"|"dare">|"tendencias"|"reto";
const LANDING_TABS:{key:LandingTabKey;label:string}[]=[
  {key:"home",label:"Inicio"},
  {key:"about",label:"Quiénes somos"},
  {key:"how-it-works",label:"Cómo funciona"},
  {key:"planes",label:"Planes"},
  {key:"news",label:"Novedades y aliados"},
  {key:"contact",label:"Contacto"},
  {key:"tendencias",label:"Tendencias"},
  {key:"reto",label:"Reto"},
];

type PreguntaLanding={q:string;a:string};
const FAQ_ZARPI_IMPORTA:PreguntaLanding={q:"¿Zarpi importa mi producto?",a:"No. Las empresas importadoras importan a su nombre, nacionalizan y te facturan en Colombia como venta nacional. Zarpi conecta, ordena la información y registra el proceso."};
const FAQ_A_QUIEN_PAGO:PreguntaLanding={q:"¿A quién le pago?",a:"Directamente a la empresa importadora que elegiste, a la cuenta que ves en la plataforma. Zarpi no recibe el dinero de tu importación."};
const FAQ_CUANTO_CUESTA_IMPORTAR:PreguntaLanding={q:"¿Cómo sé cuánto me va a costar importar?",a:"Cada propuesta indica el precio final puesto en Colombia, qué incluye, qué no y los tiempos estimados. Antes de aceptar, revisa el punto de entrega y los supuestos que podrían mover el precio."};
// Lo que Zarpi no hace se dice aquí, solo como respuesta: la portada habla de lo que sí hace.
const FAQ_HOME:PreguntaLanding[]=[FAQ_ZARPI_IMPORTA,FAQ_A_QUIEN_PAGO,FAQ_CUANTO_CUESTA_IMPORTAR];
const FAQ_COMPLETA:PreguntaLanding[]=[
  FAQ_ZARPI_IMPORTA,
  {q:"¿Cuánto cuesta?",a:"Zarpi funciona con planes de acceso para quienes importan. Los ves en la sección de planes y conoces el precio y las condiciones antes de pagar."},
  FAQ_CUANTO_CUESTA_IMPORTAR,
  {q:"¿Qué significa “empresa verificada”?",a:"Que confirmamos su existencia legal, su actividad importadora real y sus referencias antes de que entre, y que su cumplimiento se publica con las mismas métricas que el de todas las demás."},
  {q:"¿Estoy obligado a aceptar una propuesta?",a:"No. Revisas las propuestas y eliges solo si alguna te sirve."},
  {q:"¿Y si algo sale distinto a lo acordado?",a:"La empresa importadora responde directamente por su servicio. Zarpi exige respuesta en plazos cortos, documenta todo y hace seguimiento hasta que haya una solución."},
  FAQ_A_QUIEN_PAGO,
];
const PARA_IMPORTADORAS=[
  "Solicitudes de compradores verificados y comprometidos, sin ruido.",
  "Cotizas solo lo que te interesa. Cotizar no tiene costo.",
  "Un perfil con tu trayectoria y tus métricas, iguales para todas.",
  "Programa Fundadoras: cupos limitados.",
];

function ListaChequeo({items}:{items:string[]}) {
  return (
    <ul className="space-y-2.5 text-sm text-muted-foreground">
      {items.map(item=>(
        <li key={item} className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary dark:text-accent"/><span>{item}</span></li>
      ))}
    </ul>
  );
}

function PreguntasLanding({items}:{items:PreguntaLanding[]}) {
  const [abierta,setAbierta]=useState<number|null>(null);
  return (
    <div className="space-y-3">
      {items.map((f,i)=>(
        <div key={f.q} className="border border-border rounded-xl overflow-hidden bg-card backdrop-blur-sm">
          <button onClick={()=>setAbierta(abierta===i?null:i)} aria-expanded={abierta===i}
            className="group w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/50 transition-colors">
            <span className="font-medium text-sm">{f.q}</span>
            <div className="w-7 h-7 rounded-full border border-border flex items-center justify-center flex-shrink-0 transition-colors duration-200 group-hover:bg-primary group-hover:border-primary dark:group-hover:bg-accent dark:group-hover:border-accent">
              <ChevronDown className={clsx("w-4 h-4 text-muted-foreground transition-all duration-200 group-hover:text-white dark:group-hover:text-accent-foreground",abierta===i&&"rotate-180")}/>
            </div>
          </button>
          {abierta===i&&<div className="px-5 pb-4"><p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p></div>}
        </div>
      ))}
    </div>
  );
}

function LandingScreen({onLogin,onRegister,onPolicy,onTendencias,onReto,onInscribirse,onListaEspera}:{onLogin:()=>void;onRegister:()=>void;onPolicy:(page:LegalPage)=>void;onTendencias:()=>void;onReto:()=>void;onInscribirse:(clave:string)=>void;onListaEspera:()=>void}) {
  const { dark, toggleTheme } = useBrandTheme();
  const [activeTab,setActiveTab]=useState<LandingTabKey>("home");
  // Sección a la que hay que bajar después de cambiar de pestaña (`planes`, `preguntas`).
  const [ancla,setAncla]=useState<string|null>(null);
  const irA=(pestana:LandingTabKey,destino?:string)=>{
    if (pestana === "tendencias") {
      onTendencias();
      return;
    }
    if (pestana === "reto") {
      onReto();
      return;
    }
    if (pestana === "planes") {
      setActiveTab("home");
      setAncla("planes");
      return;
    }
    setActiveTab(pestana);
    if(destino)setAncla(destino);
    else window.scrollTo({top:0});
  };
  // El tab Planes lleva a la sección de precios del inicio (/#planes).
  const irAPlanes=()=>irA("home","planes");
  // El CTA de acceso respeta el interruptor Admin â€º Módulos: registro público
  // o formulario de solicitud para la lista privada.
  const abrirAcceso=()=>onRegister();
  const textoAcceso=registroAbierto()?"Crear cuenta":"Solicitar acceso";
  // «Aplicar como empresa importadora» abre Contacto con ese perfil ya marcado.
  const [perfilContacto,setPerfilContacto]=useState<PerfilContacto>("comprador");
  const contactar=(perfil:PerfilContacto)=>{setPerfilContacto(perfil);irA("contact");};
  const [dynamicContent,setDynamicContent]=useState<LandingDynamicContent|null>(null);
  const [dynamicContentError,setDynamicContentError]=useState("");

  useEffect(()=>{
    if(!ancla)return;
    const t=window.setTimeout(()=>{
      document.getElementById(ancla)?.scrollIntoView({behavior:"smooth",block:"start"});
      setAncla(null);
    },60);
    return ()=>window.clearTimeout(t);
  },[ancla,activeTab]);

  // Un enlace a /#planes (correos, otras pantallas) abre directo la sección.
  useEffect(()=>{
    const revisar=()=>{if(window.location.hash==="#planes")irA("home","planes");};
    revisar();
    window.addEventListener("hashchange",revisar);
    return ()=>window.removeEventListener("hashchange",revisar);
  },[]);

  useEffect(()=>{
    // "Quiénes somos" también lo usa: su carrusel de videos vive en el CMS.
    if((activeTab!=="news"&&activeTab!=="about")||dynamicContent)return;
    landingService.getDynamicContent()
      .then(setDynamicContent)
      .catch(()=>setDynamicContentError("No se pudo cargar el contenido de novedades y aliados."));
  },[activeTab,dynamicContent]);

  const benefits=[
    {icon:<Receipt className="w-6 h-6 text-primary"/>,title:"Precio final en Colombia",desc:"Cada propuesta llega con el valor puesto en tu bodega y con lo que incluye y lo que no, por escrito."},
    {icon:<BadgeCheck className="w-6 h-6 text-primary"/>,title:"Empresas con trayectoria",desc:"Antes de elegir sabes quién es cada empresa importadora: años importando, operaciones realizadas y cumplimiento."},
    {icon:<ClipboardList className="w-6 h-6 text-primary"/>,title:"Todo queda registrado",desc:"Propuestas, acuerdos, documentos y avances de cada etapa, en un solo lugar."},
  ];
  const pasosCortos=[
    {title:"Publica.",desc:"Cuéntanos qué producto buscas, la cantidad, las especificaciones y, si tienes, el enlace o la referencia."},
    {title:"Recibe propuestas.",desc:"Empresas importadoras verificadas te envían precio final en Colombia, tiempos y condiciones."},
    {title:"Elige.",desc:"Resuelve tus dudas por la plataforma, conoce a cada empresa y decide con quién trabajar. La operación se hace directamente con la empresa que elijas."},
    {title:"Haz seguimiento.",desc:"Cada etapa, de la compra en origen a la entrega, queda documentada en un solo lugar."},
  ];
  const claseMenu=(activo:boolean)=>clsx(
    "px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
    activo
      ?"bg-primary text-white dark:bg-accent dark:text-accent-foreground"
      :"text-muted-foreground hover:bg-foreground/15 dark:hover:bg-white/15 dark:hover:text-white",
  );
  const menu=(
    <>
      {LANDING_TABS.map(section=>(
        <button key={section.key} onClick={()=>irA(section.key)} className={claseMenu(activeTab===section.key)}>{section.label}</button>
      ))}
    </>
  );
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-9xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Logo/>
          <div className="hidden xl:flex items-center gap-1">{menu}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              aria-label={dark ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground dark:hover:bg-accent dark:hover:text-accent-foreground active:bg-primary/90 dark:active:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {dark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
            </button>
            <Button variant="secondary" size="sm" className="hidden sm:inline-flex hover:bg-primary hover:text-white hover:border-primary dark:hover:bg-accent dark:hover:text-accent-foreground dark:hover:border-accent" onClick={onLogin}>
              Iniciar sesión
            </Button>
            <Button variant="primary" size="sm" className="hover:bg-primary/80 dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/80" onClick={abrirAcceso}>
              {textoAcceso}
            </Button>
          </div>
        </div>
        {/* En pantallas angostas el menú va en una fila que se desliza. */}
        <div className="xl:hidden flex items-center gap-1 overflow-x-auto px-4 pb-2 -mt-1">
          {menu}
          <button onClick={onLogin} className={clsx(claseMenu(false),"sm:hidden")}>Iniciar sesión</button>
        </div>
      </nav>

      {activeTab==="home" && (
      <>
      {/* HERO */}
      <section className="pt-40 xl:pt-32 pb-20 px-6 bg-foreground text-background relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/25 pointer-events-none z-0"/>
        <div className="zarpi-blob zarpi-blob-violet absolute -top-24 -left-24 z-0 pointer-events-none"/>
        <div className="zarpi-blob zarpi-blob-acid absolute top-20 -right-20 z-0 pointer-events-none"/>
        <div className="zarpi-blob zarpi-blob-neutral absolute -bottom-36 left-1/3 z-0 pointer-events-none"/>
        <div className="landing-hero-content relative z-10 max-w-7xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent text-accent-foreground rounded-full text-xs font-semibold mb-6"><Ship className="w-3.5 h-3.5"/>Importaciones desde China</span>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight mb-5">
            Tú dices qué importar.<br/>
            <span className="text-accent">Zarpi encuentra quién lo trae.</span>
          </h1>
          <p className="text-lg text-background/75 max-w-4xl mx-auto leading-relaxed mb-8">
            Publica lo que quieres importar y recibe propuestas de empresas importadoras verificadas, con precio final puesto en Colombia. Compara, elige y sigue todo el proceso en un solo lugar.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="secondary" size="lg" icon={<UserRound className="w-4 h-4"/>} onClick={abrirAcceso} className="px-8 bg-accent text-accent-foreground border-accent hover:bg-accent/85">{textoAcceso}</Button>
            <Button variant="secondary" size="lg" icon={<MoveRight className="w-4 h-4"/>} onClick={()=>irA("how-it-works")} className="px-8 text-black bg-accent border-background/40 hover:bg-accent/85 ">Cómo funciona</Button>
          </div>
          <p className="mt-6 text-sm italic text-background/60 max-w-2xl mx-auto">
            Para comerciantes, emprendedores y empresas que quieren importar con más información y menos incertidumbre.
          </p>
        </div>
      </section>

      {/* TRES BLOQUES */}
      <section className="py-16 px-6 bg-muted relative overflow-hidden">
        <div className="zarpi-blob zarpi-blob-acid absolute -right-16 top-10 pointer-events-none opacity-30 scale-90" />
        <div className="zarpi-blob zarpi-blob-violet absolute -left-20 bottom-10 pointer-events-none opacity-25 scale-75" />
        <div className="max-w-7xl mx-auto relative z-10 grid gap-5 md:grid-cols-3">
          {benefits.map((b, i) => (
            <div key={b.title} className="landing-reveal bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-6 hover:shadow-md transition-shadow" style={{animationDelay:`${i*90}ms`}}>
              <div className="landing-icon w-12 h-12 rounded-xl flex items-center justify-center mb-4 border bg-primary/10 border-primary/20 text-primary dark:bg-[#EDF953]/15 dark:border-[#EDF953]/30 dark:text-[#EDF953]">
                {b.icon}
              </div>
              <h3 className="font-semibold mb-2">{b.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CÓMO FUNCIONA (versión corta) */}
      <section className="py-20 px-6 bg-background relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-12">De lo que quieres importar a una propuesta en firme.</h2>
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {pasosCortos.map((paso,i)=>(
              <li key={paso.title} className="rounded-2xl border border-border bg-card/80 p-5">
                <span className="w-9 h-9 rounded-xl bg-primary dark:bg-accent text-primary-foreground dark:text-accent-foreground text-sm font-bold flex items-center justify-center mb-4">{i+1}</span>
                <h3 className="font-semibold mb-1.5">{paso.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{paso.desc}</p>
              </li>
            ))}
          </ol>
          <div className="text-center mt-8">
            <button type="button" onClick={()=>irA("how-it-works")} className="text-sm font-semibold text-primary dark:text-accent hover:underline">Ver el proceso completo →</button>
          </div>
        </div>
      </section>

      {/* PLANES (id `planes`): valores y cupos desde Admin ó Planes */}
      <SeccionPlanes onInscribirme={plan=>onInscribirse(plan.clave)} onCondiciones={()=>onPolicy("planes")} onAvisame={onListaEspera}/>

      {/* PARA EMPRESAS IMPORTADORAS */}
      <section className="py-20 px-6 bg-background relative overflow-hidden">
        <div className="max-w-5xl mx-auto relative z-10 rounded-2xl border border-border bg-card/80 p-6 sm:p-10">
          <p className="text-xs uppercase tracking-[0.18em] text-primary dark:text-accent font-semibold mb-3">Para empresas importadoras</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">Tu experiencia merece llegar a más compradores.</h2>
          <ListaChequeo items={PARA_IMPORTADORAS}/>
          <Button variant="primary" className="mt-7 dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/80" icon={<Building2 className="w-4 h-4"/>} onClick={()=>contactar("nacionalizadora")}>Aplicar como empresa importadora</Button>
          <p className="mt-3 text-xs text-muted-foreground">Cupos y beneficios sujetos a las condiciones vigentes del programa.</p>
        </div>
      </section>

      {/* PREGUNTAS FRECUENTES (versión corta) */}
      <section className="py-20 px-6 bg-muted relative overflow-hidden">
        <div className="max-w-5xl mx-auto relative z-10">
          <h2 className="text-2xl font-bold tracking-tight text-center mb-10">Preguntas frecuentes</h2>
          <PreguntasLanding items={FAQ_HOME}/>
          <div className="text-center mt-6">
            <button type="button" onClick={()=>irA("how-it-works","preguntas")} className="text-sm font-semibold text-primary dark:text-accent hover:underline">Todas las preguntas →</button>
          </div>
        </div>
      </section>
      </>
      )}

      {activeTab==="about" && <LandingAboutSection content={dynamicContent} onSolicitarAcceso={abrirAcceso}/>}
      {activeTab==="how-it-works" && <LandingHowItWorksSection onVerPlanes={irAPlanes} onAplicarImportadora={()=>contactar("nacionalizadora")}/>}
      {activeTab==="news" && (
        <LandingNewsAlliesSection content={dynamicContent} error={dynamicContentError} onLogin={onLogin} onRegister={onRegister}/>
      )}
      {activeTab==="contact" && <LandingContactSection key={perfilContacto} perfilInicial={perfilContacto} onLogin={onLogin} onRegister={abrirAcceso}/>}

      {activeTab!=="contact" && (
      /* CIERRE */
      <section className="py-16 px-6 bg-primary/60 relative overflow-hidden">
        <div className="zarpi-blob zarpi-blob-violet absolute right-20 top-1/3 pointer-events-none opacity-25 scale-80" />
        <div className="max-w-5xl mx-auto text-center text-primary-foreground relative z-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Tu próxima importación empieza con una mejor decisión.</h2>
          <p className="text-primary-foreground/80 mb-7 leading-relaxed">Publica lo que necesitas y elige la empresa importadora que mejor se ajuste a tu operación.</p>
          <Button variant="secondary" size="lg" onClick={abrirAcceso} className="px-8 text-accent-foreground">{textoAcceso}</Button>
          <p className="mt-5 text-sm text-primary-foreground/80">
            ¿Eres una empresa importadora?{" "}
            <button type="button" onClick={()=>contactar("nacionalizadora")} className="font-semibold underline underline-offset-2 hover:text-white">Conoce cómo vincularte</button>
          </p>
        </div>
      </section>
      )}

      {/* PIE */}
      <footer className="bg-[#0F0F0F] text-white py-10 px-6 relative overflow-hidden">
        <div className="zarpi-blob zarpi-blob-neutral absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-15 scale-125" />
        <div className="mx-auto max-w-7xl relative z-10 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <img src="/brand/zarpi-wordmark-acid.svg" alt="Zarpi" className="h-8 w-28 object-contain object-left" />
            <p className="text-xs text-white/70"><span className="font-semibold text-white">{EMPRESA.razonSocial}</span> · NIT {EMPRESA.nit} · {EMPRESA.ciudad}, Colombia</p>
          </div>
          <nav aria-label="Enlaces del pie" className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/70">
            <button onClick={()=>irA("about")} className={enlacePie}>Quiénes somos</button>
            <button onClick={()=>irA("how-it-works")} className={enlacePie}>Cómo funciona</button>
            <button onClick={irAPlanes} className={enlacePie}>Planes</button>
            <button onClick={onTendencias} className={enlacePie}>Tendencias</button>
            <button onClick={()=>irA("contact")} className={enlacePie}>Contacto</button>
            <button onClick={()=>onPolicy("planes")} className={enlacePie}>Condiciones de los planes</button>
            <button onClick={()=>onPolicy("terms")} className={enlacePie}>Términos y condiciones</button>
            <button onClick={()=>onPolicy("data")} className={enlacePie}>Política de tratamiento de datos</button>
          </nav>
          <p className="max-w-5xl text-xs leading-relaxed text-white/55">
            <span className="font-semibold text-white/70">Aviso legal: </span>
            Zarpi S.A.S. es una plataforma de intermediación tecnológica. No importa, no transporta, no nacionaliza ni recibe el dinero de las operaciones. Cada operación se celebra directamente entre quien importa y la empresa importadora que elige.
          </p>
          <p className="border-t border-white/10 pt-5 text-center text-xs text-white/40">? 2026 Zarpi. Todos los derechos reservados.</p>
          <div className="flex justify-center border-t border-white/10 pt-5">
            <PublicSicLogo />
          </div>
        </div>
      </footer>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// LANDING ? Perfil de empresa (QuickView) y subpáginas públicas
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function LandingBackground() {
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

/** "Quiénes somos": de dónde nace Zarpi, qué hace, en qué cree y quién está detrás. */
function LandingAboutSection({content,onSolicitarAcceso}:{content:LandingDynamicContent|null;onSolicitarAcceso:()=>void}) {
  const carrusel=leerVideosQuienesSomos(content?.blocks);
  const creencias=[
    {title:"Las mismas reglas para todas.",desc:"Cada empresa importadora se mide con las mismas métricas. Nadie compra una mejor reputación."},
    {title:"El proceso a la vista.",desc:"Cada etapa deja evidencia en la plataforma."},
    {title:"Tú decides.",desc:"Zarpi te muestra quién es quién; la elección es tuya."},
  ];
  return (
    <section className="pt-40 xl:pt-32 pb-20 px-6 relative overflow-hidden">
      <LandingBackground />

      <div className="max-w-7xl mx-auto relative z-10 space-y-12">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-primary dark:text-accent font-semibold mb-3">Quiénes somos</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Importar no debería depender de tener los contactos correctos.</h1>
        </div>
        {carrusel.activo&&carrusel.videos.length>0&&(
          <CarruselVideos videos={carrusel.videos} intervaloSegundos={carrusel.intervalo_segundos}/>
        )}
        <div className="max-w-5xl mx-auto space-y-4 text-base leading-relaxed text-muted-foreground">
          <p>Cuando empezamos a importar no sabíamos por dónde arrancar: si irnos a Buenaventura a buscar quién traía contenedores o irnos a China. Y estando en China, frente al producto, quedaban dos preguntas: cómo iba a llegar a la bodega y cuánto iba a costar realmente tenerlo en Colombia.</p>
          <p>Con los años encontramos la respuesta: empresas importadoras que traen el producto a su nombre, lo nacionalizan y te lo entregan facturado en Colombia. Así importan desde quien hace su primer pedido hasta empresas que traen millones de dólares al mes. Algunas llevan más de treinta años yendo a China.</p>
          <p>También entendimos que encontrar una buena empresa no debería depender de una recomendación, un contacto o una conversación por WhatsApp. <span className="font-semibold text-foreground">Zarpi existe para que esa respuesta esté a un clic de cualquier comerciante en Colombia.</span></p>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-3">Qué hacemos</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">Conectamos a personas y empresas que quieren importar con empresas importadoras verificadas, ordenamos la información para que puedas decidir y guardamos la evidencia de cada etapa.</p>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-4">En qué creemos</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {creencias.map((c,i)=>(
              <article key={c.title} className="landing-reveal bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-6" style={{animationDelay:`${i*100}ms`}}>
                <h3 className="text-base font-bold mb-2">{c.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
              </article>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-3">Quiénes estamos detrás</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">Zarpi S.A.S. nació en Cali en 2026, fundada por Juan Pablo Orozco, comerciante que lleva años importando para su propia operación de comercio electrónico. Creamos Zarpi para convertir una experiencia llena de incertidumbre en un proceso claro y documentado.</p>
        </div>
        <div className="text-center">
          <Button variant="primary" size="lg" className="px-8 dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/80" onClick={onSolicitarAcceso}>{registroAbierto()?"Crear cuenta":"Solicitar acceso"}</Button>
        </div>
      </div>
    </section>
  );
}

/** "Cómo funciona": los pasos de una importación, lo que obtiene cada lado y las preguntas completas. */
function LandingHowItWorksSection({onVerPlanes,onAplicarImportadora}:{onVerPlanes:()=>void;onAplicarImportadora:()=>void}) {
  const pasos:[string,string][]=[
    ["Publicas tu solicitud:"," producto, cantidad, referencia o enlace."],
    ["Tu solicitud llega a empresas importadoras verificadas.",""],
    ["Recibes propuestas"," con precio final en Colombia, tiempos y condiciones."],
    ["Resuelves dudas por el chat de la plataforma,"," conoces la trayectoria de cada empresa y eliges."],
    ["Al aceptar una propuesta, la operación queda registrada"," y se abre el contacto directo con la empresa importadora."],
    ["La empresa importadora actualiza cada etapa:"," producción, tránsito, aduana y entrega."],
    ["Cada etapa queda documentada"," en la plataforma."],
    ["Confirmas la entrega"," y calificas la experiencia."],
  ];
  const paraQuienImporta=[
    "Publicas una vez y recibes propuestas de varias empresas.",
    "Precio final puesto en Colombia, con lo que incluye y lo que no.",
    "Conoces a cada empresa antes de elegir: trayectoria, cumplimiento y calificaciones.",
    "Todo el proceso queda registrado.",
  ];
  return (
    <section className="pt-40 xl:pt-32 pb-20 px-6 relative overflow-hidden">
      <LandingBackground />
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.18em] text-primary dark:text-accent font-semibold mb-3">Cómo funciona</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Así se importa con Zarpi</h1>
        </div>
        <ol className="grid sm:grid-cols-2 gap-4 mb-14">
          {pasos.map(([fuerte,resto],i)=>(
            <li key={i}>
              <Card padding="md" className="flex h-full items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground dark:bg-accent dark:text-accent-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                <p className="text-sm text-muted-foreground leading-relaxed"><strong className="font-semibold text-foreground">{fuerte}</strong>{resto}</p>
              </Card>
            </li>
          ))}
        </ol>
        <div className="grid md:grid-cols-2 gap-5 mb-16">
          <Card padding="lg" className="flex flex-col">
            <h2 className="text-base font-bold mb-3">Para quien importa</h2>
            <div className="flex-1"><ListaChequeo items={paraQuienImporta}/></div>
            <Button variant="primary" className="mt-5 self-start dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/80" onClick={onVerPlanes}>Ver planes</Button>
          </Card>
          <Card padding="lg" className="flex flex-col">
            <h2 className="text-base font-bold mb-3">Para empresas importadoras</h2>
            <div className="flex-1"><ListaChequeo items={PARA_IMPORTADORAS}/></div>
            <Button variant="primary" className="mt-7 dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/80" icon={<Building2 className="w-4 h-4"/>} onClick={()=>contactar("nacionalizadora")}>Aplicar como empresa importadora</Button>
          </Card>
        </div>
        <div id="preguntas" className="scroll-mt-28 max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-center mb-8">Preguntas frecuentes</h2>
          <PreguntasLanding items={FAQ_COMPLETA}/>
        </div>
      </div>
    </section>
  );
}

/** "Novedades y aliados": bloques dinámicos, miniblog y muro de aliados del CMS. */
const LANDING_IMAGE_FALLBACK = "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=80";
/** Un bloque del CMS: mismas reglas que la vista previa del editor (features/landing/BloqueLanding). */
function LandingDynamicBlock({block,onLogin,onRegister}:{block:LandingBlock;onLogin:()=>void;onRegister:()=>void}) {
  const onBoton=block.accion_boton==="open_register"?onRegister
    :block.accion_boton==="external_link"&&block.accion_url?()=>window.open(block.accion_url as string,"_blank","noopener,noreferrer")
    :onLogin;
  return (
    <BloqueLanding
      block={block}
      onBoton={onBoton}
      imagen={(ruta,className)=>(
        <img
          src={safeHttpUrl(resolveApiUrl(ruta),LANDING_IMAGE_FALLBACK)}
          alt=""
          className={className}
          onError={(event)=>{event.currentTarget.src=LANDING_IMAGE_FALLBACK;}}
        />
      )}
      video={(ruta,className)=><video src={resolveApiUrl(ruta)} controls className={className}/>}
    />
  );
}

function LandingNewsAlliesSection({content,error,onLogin,onRegister}:{content:LandingDynamicContent|null;error:string;onLogin:()=>void;onRegister:()=>void}) {
  // El carrusel de videos es de "Quiénes somos", no de esta sección.
  const dynamicBlocks=(content?.blocks??[]).filter(b=>b.tipo!=="allies_grid"&&b.tipo!=="video_rotativo").sort((a,b)=>a.orden-b.orden);
  return (
    <section className="pt-32 pb-20 px-6 relative overflow-hidden">
      <LandingBackground />
      <div className="max-w-7xl mx-auto space-y-14 relative z-10">
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
type PerfilContacto="comprador"|"nacionalizadora";
function LandingContactSection({perfilInicial="comprador",onLogin,onRegister}:{perfilInicial?:PerfilContacto;onLogin:()=>void;onRegister:()=>void}) {
  const [perfil,setPerfil]=useState<PerfilContacto>(perfilInicial);
  const [nombre,setNombre]=useState("");
  const [email,setEmail]=useState("");
  const [telefono,setTelefono]=useState("");
  const [mensaje,setMensaje]=useState("");
  const [enviado,setEnviado]=useState(false);
  const [enviando,setEnviando]=useState(false);
  const [errorEnvio,setErrorEnvio]=useState("");

  const faqsContacto=[
    {q:"¿Cómo empiezo si quiero importar?",a:registroAbierto()
      ?"Crea tu cuenta gratis y publica tu primera solicitud de cotización sin costo."
      :"Por ahora el acceso es por lista privada: pídelo con «Solicitar acceso» y te escribimos con el valor."},
    {q:"¿Cómo empiezo si soy empresa importadora?",a:"Escríbenos desde este formulario: confirmamos tu existencia legal, tu actividad importadora real y tus referencias antes del alta. El Programa Fundadoras tiene cupos limitados."},
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
      <div className="max-w-4xl mx-auto space-y-12 relative z-10">
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
                    {opt === "comprador" ? "Quiero importar" : "Soy empresa importadora"}
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
          <Button variant="secondary" size="lg" onClick={onRegister}>{registroAbierto()?"Crear cuenta gratis":"Solicitar acceso"}</Button>
          <Button variant="primary" size="lg" onClick={onLogin}>Iniciar sesión</Button>
        </div>
      </div>
    </section>
  );
}
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type RegUserType="solicitante"|"importadora";
type RegPersonType="natural"|"juridica";

/**
 * Con el registro público cerrado (Admin â€º Módulos) nadie crea cuenta por su
 * lado: la cuenta se crea al activar la inscripción a un plan. Aquí va la línea
 * de la lista cerrada y el botón a la lista de espera.
 */
function RegistroCerrado({onLogin,onLanding,onListaEspera,onPolicy}:{onLogin:()=>void;onLanding:()=>void;onListaEspera:()=>void;onPolicy:(page:LegalPage)=>void}) {
  const { dark, toggleTheme } = useBrandTheme();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-background px-6 py-3.5 relative z-10">
        <button type="button" onClick={onLanding} aria-label="Ir al inicio">
          <Logo/>
        </button>
        <div className="flex items-center gap-1.5 w-fit">
          <button
            type="button"
            onClick={toggleTheme}
            title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-primary hover:text-primary-foreground dark:hover:bg-accent dark:hover:text-accent-foreground transition-colors"
          >
            {dark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
          </button>
          <Button variant="ghost" size="sm" icon={<ChevronLeft className="w-3.5 h-3.5"/>} onClick={onLanding}>Volver</Button>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-10 overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img
            src={dark ? "/brand/fondo-1.png" : "/brand/fondo-4.png"}
            alt="Fondo de solicitud de acceso"
            className="auth-background w-full h-full object-cover object-center transition-all duration-300"
          />
        </div>

        <div className="relative z-10 w-full max-w-[480px]">
          <div className="bg-white rounded-2xl border border-border shadow-sm p-6 sm:p-8">
            <div className="text-center">
              <Lock className="w-10 h-10 text-primary dark:text-accent mx-auto mb-4"/>
              <h1 className="text-xl font-semibold tracking-tight mb-2">{LISTA_CERRADA.titulo.replace(/\.$/, "")}</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">{LISTA_CERRADA.texto}</p>
              <Button variant="primary" icon={<BellRing className="w-4 h-4"/>} className="mt-5 dark:bg-accent dark:text-accent-foreground" onClick={onListaEspera}>Avísame cuando abra</Button>
            </div>
            <div className="mt-6 flex flex-col items-center gap-3 border-t border-border pt-6">
              <Button variant="secondary" fullWidth onClick={onLogin}>Ya tengo cuenta: iniciar sesión</Button>
              <button type="button" onClick={onLanding} className="text-xs text-muted-foreground hover:text-foreground">Volver al inicio</button>
            </div>
          </div>
        </div>
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-4 border-t border-border bg-background py-4 text-center text-xs text-muted-foreground relative z-10">
        <span>? 2026 Zarpi</span>
        <button onClick={() => onPolicy("data")} className="transition-colors hover:text-foreground">
          Tratamiento de Datos
        </button>
        <button onClick={() => onPolicy("terms")} className="transition-colors hover:text-foreground">
          Términos
        </button>
        <button onClick={() => onPolicy("payments")} className="transition-colors hover:text-foreground">
          Pagos y Reembolsos
        </button>
        <PublicSicLogo />
      </footer>
    </div>
  );
}

function RegisterScreen({onBack,onSuccess,onPolicy}:{onBack:()=>void;onSuccess:(email:string)=>void;onPolicy:(page:LegalPage)=>void}) {
  const [userType,setUserType]=useState<RegUserType>("solicitante");
  const [personType,setPersonType]=useState<RegPersonType>("natural");
  const [accepted,setAccepted]=useState(false);
  const [loading,setLoading]=useState(false);
  const [success,setSuccess]=useState(false);
  const [registeredEmail,setRegisteredEmail]=useState("");
  // El correo con el código puede no salir (SMTP caído): se avisa y se deja reenviar.
  const [correoEnviado,setCorreoEnviado]=useState(true);
  const [reenviando,setReenviando]=useState(false);
  const [esperaReenvio,setEsperaReenvio]=useState(0);
  useEffect(()=>{
    if(esperaReenvio<=0)return;
    const t=window.setTimeout(()=>setEsperaReenvio(s=>s-1),1000);
    return ()=>window.clearTimeout(t);
  },[esperaReenvio]);
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

    const payload: RegisterRequest = personType === "natural" ? {
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
      const respuesta=await authService.register(payload);
      setRegisteredEmail(email);
      setCorreoEnviado(respuesta.correo_enviado!==false);
      setEsperaReenvio(respuesta.correo_enviado===false?0:60);
      setSuccess(true);
    }catch(error){
      setSubmitError(getErrorMessage(error));
    }finally{
      setLoading(false);
    }
  }

  async function reenviarCodigo(){
    if(!registeredEmail||reenviando||esperaReenvio>0)return;
    try{
      setReenviando(true);
      setOtpError("");
      await authService.resendOtp({ email: registeredEmail, proposito: "verificacion_email" });
      setCorreoEnviado(true);
      setEsperaReenvio(60);
      toast.success("Te enviamos un código nuevo. Revisa también la carpeta de spam.");
    }catch(error){
      setOtpError(getErrorMessage(error));
    }finally{
      setReenviando(false);
    }
  }

  async function verifyOtp(e:React.FormEvent){
    e.preventDefault();
    if(otpLoading)return;

    const normalizedOtp=String(otpCode ?? "").trim();
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
            {correoEnviado?(
              <p className="text-sm text-muted-foreground mb-4">Te enviamos un código de 6 dígitos a <span className="font-medium text-foreground">{registeredEmail||"tu correo"}</span>. Si no llega en un par de minutos, revisa la carpeta de spam.</p>
            ):(
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">Creamos tu cuenta, pero no pudimos enviarte el código a <span className="font-medium">{registeredEmail||"tu correo"}</span>. Pide uno nuevo abajo.</p>
            )}

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

            <button
              type="button"
              onClick={()=>{void reenviarCodigo();}}
              disabled={reenviando||esperaReenvio>0}
              className="mt-3 text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline dark:text-accent"
            >
              {reenviando?"Enviandoâ€¦":esperaReenvio>0?`Reenviar código en ${esperaReenvio} s`:"Reenviar código"}
            </button>

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
                      ? "Soy comprador"
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
                    <p className="text-center text-xs text-muted-foreground">¿Ya tienes cuenta <button type="button" onClick={onBack} className="text-purple-600 dark:text-green-500 hover:underline font-medium">Iniciar sesión</button></p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-4 border-t border-border bg-background py-4 text-center text-xs text-muted-foreground relative z-10">
        <span>? 2026 Zarpi</span>
        <button onClick={() => onPolicy("data")} className="transition-colors hover:text-foreground">
          Tratamiento de Datos
        </button>
        <button onClick={() => onPolicy("terms")} className="transition-colors hover:text-foreground">
          Términos
        </button>
        <button onClick={() => onPolicy("payments")} className="transition-colors hover:text-foreground">
          Pagos y Reembolsos
        </button>
        <PublicSicLogo />
      </footer>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// LOGIN
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      <footer className="flex justify-center border-t border-border bg-background py-4">
        <PublicSicLogo />
      </footer>
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
  "admin-tendencias": "tendencias",
  "admin-tendencias-aprobacion": "tendencias-aprobacion",
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
                placeholder="Describe tu problema: «no me llegan propuestas», «rol insuficiente»â€¦"
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
                  {cargandoAyuda?"Cargandoâ€¦":`${articulos.length} artículos`}
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
                Al abrir un ticket, incluye el código de cotización (COT-â€¦) o de operación (ORD-â€¦) y el mensaje de error
                completo. Con eso el equipo reproduce el caso sin tener que preguntarte.
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ROOT
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  const [userRole, setUserRole] = useState<UserRole | "admin">(storedRole ?? "solicitante");
  /** Identificador que traía la dirección de entrada, si era de ese tipo. */
  const idInicialDe = (param: ParamRuta) => destinoInicial?.param === param ? (destinoInicial.id ?? "") : "";
  const [selectedQuoteId,setSelectedQuoteId]=useState(()=>idInicialDe("quote"));
  const [selectedResponseId,setSelectedResponseId]=useState(()=>idInicialDe("response"));
  const [responseFrom,setResponseFrom]=useState<ResponseFrom>("responses");
  const [responseFromQuoteId,setResponseFromQuoteId]=useState("");
  const [selectedOrderId,setSelectedOrderId]=useState(()=>idInicialDe("order"));
  const [selectedOrderDetail,setSelectedOrderDetail]=useState<Order|null>(null);
  const [selectedTendenciaId,setSelectedTendenciaId]=useState(()=>idInicialDe("tendencia"));
  // Plan elegido en el inicio («Inscribirme»): viaja en la URL como ?plan=.
  const [planElegido,setPlanElegido]=useState(()=>new URLSearchParams(window.location.search).get("plan") ?? "");
  const [isOrderDetailLoading,setIsOrderDetailLoading]=useState(false);
  // Qué orden está en pantalla: si se vuelve a pedir la misma, se refresca sin
  // pasar por «Cargandoâ€¦» (eso desmontaba el detalle y se perdía lo que el
  // usuario estaba haciendo, p. ej. el comprobante de pago recién elegido).
  const orderDetailIdRef=useRef<string|null>(null);
  orderDetailIdRef.current=selectedOrderDetail?.id ?? null;
  const [selectedImporterId,setSelectedImporterId]=useState(()=>idInicialDe("importer"));
  const [preselectedImporterId,setPreselectedImporterId]=useState<string|undefined>();
  const [quotePrefill,setQuotePrefill]=useState<Partial<QuoteFormState>|undefined>();
  // Producto de Tendencias o de un catálogo del que sale la solicitud en curso.
  const [origenSolicitud,setOrigenSolicitud]=useState<OrigenSolicitud|null>(null);
  // «Comprar acceso» en Cursos (pago manual): Pagos abre la ventana de ese curso.
  const [cursoAPagar,setCursoAPagar]=useState<string|null>(null);
  // Muro de pago de Tendencias: Pagos abre en la carpeta de la suscripción.
  const [carpetaPagos,setCarpetaPagos]=useState<"suscripcion"|null>(null);
  function pagarSuscripcionTendencias(){setCarpetaPagos("suscripcion");goTo("pagos");}
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
  const { config: platformConfig, isLoading: platformConfigLoading, recargar: recargarPlatformConfig } = usePlatformConfig();
  // Lo leen los botones de «Crear cuenta» de toda la app (ver app/registro.ts).
  fijarRegistro(platformConfig.registro_abierto, platformConfig.correo_contacto);
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

  // â”€â”€ Dirección del navegador â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Identificador que la pantalla actual pone en su URL. Solo las de detalle
  // tienen uno; el resto se dirigen con la ruta a secas.
  const idEnLaRuta = screen === "quote-detail" || screen === "create-response"
    ? selectedQuoteId
    : screen === "response-detail"
    ? selectedResponseId
    : screen === "order-detail"
    ? selectedOrderId
    : screen === "importer-profile"
    ? selectedImporterId
    : screen === "tendencia-detalle"
    ? selectedTendenciaId
    : screen === "chats"
    ? activeChatId || initialChatConvId || ""
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
    const query =
      screen === "planes-inscripcion"
        ? planElegido
          ? `?plan=${encodeURIComponent(planElegido)}`
          : ""
        : conservaQuery
        ? window.location.search
        : "";
    const url = `${rutaActual}${query}`;

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
      if (destino.param === "tendencia") setSelectedTendenciaId(id);
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

  // Las empresas se leen de una ref: si `loadOrderDetail` dependiera de la
  // lista, cada auto-refresco (que la vuelve a pedir, p. ej. al cerrar el
  // selector de archivos y recuperar el foco) recreaba la función y el efecto
  // de abajo recargaba el detalle con la pantalla de carga.
  const marketplaceImportersRef=useRef(marketplaceImporters);
  marketplaceImportersRef.current=marketplaceImporters;

  const loadOrderDetail = useCallback(async (orderId: string) => {
    if (!orderId) {
      setSelectedOrderDetail(null);
      return;
    }

    const silencioso = orderDetailIdRef.current === orderId;
    if (!silencioso) setIsOrderDetailLoading(true);
    try {
      const [orderRow, quotes] = await Promise.all([
        businessService.getOrderById(orderId),
        businessService.listQuotes().catch(() => [] as BackendCotizacion[]),
      ]);
      const quoteMap = new Map(quotes.map((quote) => [quote.id, mapBackendQuoteToUi(quote, marketplaceImportersRef.current)]));
      setSelectedOrderDetail(mapBackendOrderToUiOrder(orderRow, quoteMap.get(orderRow.cotizacion_id)));
    } finally {
      if (!silencioso) setIsOrderDetailLoading(false);
    }
  }, []);

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
        type: esEquipo
          ? "equipo"
          : esSoporte
          ? "soporte"
          : esInterno
          ? "interno"
          : row.orden_id
          ? "orden"
          : "cotizacion",
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
        atiendeNombre: row.asesor_nombre ?? undefined,
        status: "activa",
        // Lo calcula el backend contra la marca de lectura del usuario; antes
        // estaba escrito a cero y el filtro de no leídas no filtraba nada.
        unread: row.no_leidos ?? 0,
        lastMsg: row.ultimo_mensaje?.contenido || "Sin mensajes",
        lastDate: row.ultimo_mensaje?.fecha_envio
          ? formatShortDate(row.ultimo_mensaje.fecha_envio)
          : formatShortDate(row.fecha_creacion),
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
   * Índice "cotización â†’ propuesta de mi empresa" (incluye borradores).
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
    const publicScreens: Screen[] = ["landing", "login", "register", "reset-password", "policy-data", "policy-terms", "policy-payments", "policy-planes", "planes-inscripcion", "lista-espera", "tendencias", "tendencia-detalle", "reto"];
    if (!publicScreens.includes(screen)) {
      setScreen("landing");
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

  // El plan o el saldo pueden cambiar sin que el comprador haga nada (el admin le
  // da un plan, aprueba un comprobante): se releen al abrir una solicitud nueva o Pagos.
  useEffect(() => {
    if (!isAuthenticated || isInitializing || (screen !== "new-quote" && screen !== "pagos")) return;
    void reloadCurrentUserProfile().catch(() => undefined);
  }, [screen, isAuthenticated, isInitializing, reloadCurrentUserProfile]);

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

    // El detalle abierto se refresca en silencio (sin desmontar la pantalla).
    if (screen === "order-detail" && selectedOrderId) {
      tareas.push(loadOrderDetail(selectedOrderId));
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
    screen,
    selectedOrderId,
    loadOrderDetail,
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
  /** «Solicitar acceso» fuera de la landing: lleva a la sección Planes del inicio (/#planes). */
  function irAPlanesDelInicio(){goTo("landing");window.setTimeout(()=>{window.location.hash="planes";},0);}

  /** «Nueva propuesta» desde el chat: abre el formulario de esa cotización. */
  function openProposalForm(quoteId:string){
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
      : userRole==="designer" ? NAV_DISENO
      : userRole==="importadora" ? NAV_IMPORTADORA
      : userRole==="asesor" ? NAV_ASESOR
      : NAV_ITEMS;
    // Con el módulo educativo apagado en el backend, "Cursos" desaparece del
    // menú: dejarlo visible llevaría a una pantalla cuya API responde 404.
    let items = moduloEducativoHabilitado ? base : base.filter(item=>item.key!=="courses"&&item.key!=="admin-cursos"&&item.key!=="admin-cursos-accesos");
    // El curador de Tendencias es una capacidad, no un rol: se le suma la
    // entrada del panel a su menú, sea soporte, asesor o cualquier otro.
    if(currentUserProfile?.es_curador&&!items.some(item=>item.key==="tendencias-aprobacion")){
      items=[...items,{icon:Sparkles,label:"Aprobación",key:"tendencias-aprobacion"}];
    }
    return items as NavItem[];
  }

  function handleProfileClick(){
    // El perfil personal es para todos; la empresa importadora llega desde ahí
    // (o desde «Mi empresa» en el menú) a los datos de su empresa.
    goTo("user-profile");
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
  async function abrirHiloEquipo(miembroId:string):Promise<string|undefined>{
    try{
      const hilo=await businessService.openTeamChannel(miembroId);
      await reloadChatData();
      setInitialChatConvId(hilo.id);
      goTo("team-channel");
      return hilo.id;
    }catch(error){
      const mensaje=error instanceof Error?error.message:"No se pudo abrir el hilo";
      toast.error(mensaje);
      return undefined;
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
    showSoporte:userRole!=="admin"&&userRole!=="soporte"&&userRole!=="designer",
    onCanalEquipo:()=>{void abrirCanalEquipo();},
    showCanalEquipo:userRole==="admin"||userRole==="soporte"||userRole==="designer",
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
    if(userRole!=="admin"&&userRole!=="soporte"&&userRole!=="designer"){
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
    if(!isAuthenticated){
      // Se guarda el producto y se retoma al iniciar sesión (efecto de abajo).
      try { sessionStorage.setItem(CLAVE_PREFILL_PENDIENTE, JSON.stringify(p)); } catch { /* sin almacenamiento: se pide de nuevo */ }
      toast.info("Crea tu cuenta gratis para pedir propuestas. Al terminar seguimos con este producto.");
      goTo("register");
      return;
    }
    if(userRole!=="solicitante"){
      toast.info("Las propuestas las piden las cuentas de comprador.");
      return;
    }
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
      tendenciaItemId:p.tendenciaItemId,
      importadorId:p.importadorId,
      nombreEmpresa:p.importadorId?marketplaceImporters.find(i=>i.id===p.importadorId)?.name:undefined,
      catalogoProductoId:p.catalogoProductoId,
    });
    setPreselectedImporterId(p.importadorId);
    goTo("new-quote");
  }

  // Al iniciar sesión como comprador, retoma el «Pedir propuestas» que quedó
  // pendiente antes del registro.
  const prefillRetomado=useRef(0);
  useEffect(()=>{
    if(!isAuthenticated||isInitializing||userRole!=="solicitante")return;
    let pendiente:string|null=null;
    try { pendiente=sessionStorage.getItem(CLAVE_PREFILL_PENDIENTE); sessionStorage.removeItem(CLAVE_PREFILL_PENDIENTE); } catch { pendiente=null; }
    if(!pendiente)return;
    try { pedirPropuestasDesde(JSON.parse(pendiente) as PrefillSolicitud); prefillRetomado.current=Date.now(); } catch { /* dato corrupto: se ignora */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isAuthenticated,isInitializing,userRole]);

  const rolPortal:UserRole|null=isAuthenticated?(userRole as UserRole):null;
  function abrirTendencia(id:string){setSelectedTendenciaId(id);goTo("tendencia-detalle");}

  /**
   * Duplicar una cotización: se abre el formulario con sus datos copiados.
   * No hay endpoint de duplicado en el backend ni hace falta ? lo que se
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
      deliveryCity:quote.deliveryCity||"",
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

  function handleLogin(role:UserRole|"admin"){
    setUserRole(role);
    // Si hay un producto de Tendencias por retomar, el efecto de arriba lleva al
    // formulario: no se pisa esa navegación con la pantalla de inicio. Según el
    // orden de los renders, el efecto corre antes (marca prefillRetomado hace un
    // instante) o después (el producto sigue guardado).
    if(role==="solicitante"){
      let pendiente:string|null=null;
      try { pendiente=sessionStorage.getItem(CLAVE_PREFILL_PENDIENTE); } catch { pendiente=null; }
      if(pendiente||Date.now()-prefillRetomado.current<3000){ prefillRetomado.current=0; return; }
    }
    goTo(getHomeScreenForRole(role));
  }

  async function handleLogout(){
    await signOut();
    setUserRole("solicitante");
    goTo("landing");
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

  async function handleSaveCompanyProfile(payload:{nombre_empresa:string;logo_url?:string;especialidad_producto:string[];paises_origen:string[];tiempo_respuesta_promedio:string;perfil_publico?:Record<string, unknown>;solo_cotizaciones_directas?:boolean;shipping_mark_prefijo?:string;limite_cotizaciones_diarias?:number|null;pedido_minimo?:number|null;pedido_minimo_unidad?:UnidadCantidad;}) {
    if (!currentUserProfile?.importador_id) {
      throw new Error("Tu usuario no tiene importador asociado.");
    }
    await businessService.updateImporterById(currentUserProfile.importador_id, payload);
    await reloadCurrentUserProfile();
    await reloadImporters();
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
    await Promise.all([
      reloadImporterQuotes(),
      reloadImporterOrders(),
      reloadChatData(),
    ]);
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

  const publicScreens: Screen[] = ["landing", "login", "register", "reset-password", "policy-data", "policy-terms", "policy-payments", "policy-planes", "planes-inscripcion", "lista-espera", "tendencias", "tendencia-detalle", "reto"];
  const screenAllowedByRole: Partial<Record<Screen, UserRole[]>> = {
    "courses": ["solicitante", "importadora"],
    "imp-dashboard": ["importadora"],
    "imp-profile": ["importadora"],
    "imp-advisors": ["importadora"],
    "imp-quotes": ["importadora"],
    "adv-dashboard": ["asesor"],
    "adv-available": ["asesor"],
    "adv-my-quotes": ["asesor"],
    // Perfil personal: cualquier cuenta con sesión.
    "user-profile": ["solicitante", "asesor", "importadora", "admin", "soporte", "designer"],
    "help-support": ["solicitante", "importadora", "asesor"],
    "admin-reto": ["admin"],
    "admin-tendencias": ["admin"],
    "admin-tendencias-aprobacion": ["admin"],
    "admin-modulos": ["admin"],
    "admin-pagos": ["admin"],
    "admin-cursos-accesos": ["admin"],
    "admin-presentaciones": ["admin"],
    "admin-planes": ["admin"],
    "admin-cursos": ["admin"],
    "catalogos": ["solicitante"],
    "imp-catalogos": ["importadora", "asesor"],
    // Canal interno de la plataforma. Sin esta entrada, un cliente o una
    // empresa que escribiera /equipo veía el armazón de la pantalla (título y
    // selector), aunque vacío y con el backend negándole los datos.
    "team-channel": ["admin", "soporte", "designer"],
    "diseno": ["designer", "admin"],
    "admin-dashboard": ["admin"],
    "admin-empresas": ["admin"],
    "admin-usuarios": ["admin"],
    "admin-cotizantes": ["admin"],
    // ?nica área del panel que comparte el equipo de atención al cliente.
    "admin-soporte": ["admin", "soporte"],
    "admin-certificaciones": ["admin"],
    "admin-respaldos": ["admin"],
    "admin-asignacion": ["admin"],
    "admin-landing": ["admin"],
    "admin-correos": ["admin"],
    "admin-tipografia": ["admin"],
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
    if (!isAuthenticated || isInitializing || !appRole) {
      return;
    }
    // El designer solo entra a lo suyo; para el resto de roles, una pantalla
    // sin entrada en la tabla es de libre acceso.
    const bloqueada = allowedRoles
      ? !allowedRoles.includes(userRole)
      : userRole==="designer" && !PANTALLAS_DESIGNER.includes(screen);

    if (bloqueada) {
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

  if(screen==="landing")return <LandingScreen onLogin={()=>goTo("login")} onRegister={()=>goTo("register")} onPolicy={page=>goTo(PANTALLA_LEGAL[page])} onTendencias={()=>goTo("tendencias")} onReto={()=>goTo("reto")} onInscribirse={clave=>{setPlanElegido(clave);goTo("planes-inscripcion");}} onListaEspera={()=>goTo("lista-espera")}/>;
  // «Avísame cuando abra» (sección Planes): lista de espera de la apertura al público.
  if(screen==="lista-espera")return <ListaEsperaApertura
    onVolver={()=>goTo(isAuthenticated?getHomeScreenForRole(userRole):"landing")}
    onPoliticaDatos={()=>goTo("policy-data")}
    prefill={isAuthenticated&&currentUserProfile?{email:currentUserProfile.email,nombre:currentUserProfile.nombre??undefined,telefono:currentUserProfile.telefono??undefined}:undefined}
  />;
  // Inscripción a un plan: pública; con sesión de comprador se precargan sus datos.
  if(screen==="planes-inscripcion")return <InscripcionPlan
    key={planElegido}
    claveInicial={planElegido}
    onVolver={()=>goTo(isAuthenticated?getHomeScreenForRole(userRole):"landing")}
    onVerPlanes={irAPlanesDelInicio}
    onCondiciones={()=>goTo("policy-planes")}
    onPoliticaDatos={()=>goTo("policy-data")}
    prefill={isAuthenticated&&currentUserProfile?{email:currentUserProfile.email,nombre:currentUserProfile.nombre??undefined,telefono:currentUserProfile.telefono??undefined}:undefined}
  />;
  if(screen==="register"&&!registroAbierto())return <RegistroCerrado onLogin={()=>goTo("login")} onLanding={()=>goTo("landing")} onListaEspera={()=>goTo("lista-espera")} onPolicy={page=>goTo(PANTALLA_LEGAL[page])}/>;
  if(screen==="register")return <RegisterScreen onBack={()=>goTo("login")} onSuccess={(email)=>{setLoginPrefillEmail(email);goTo("login");}} onPolicy={page=>goTo(PANTALLA_LEGAL[page])}/>;
  if(screen==="reset-password")return <ResetPasswordScreen token={resetToken} onBackToLogin={()=>goTo("login")}/>;
  // Pasar de un documento legal a otro no toca `prevScreen`, para que «Volver»
  // regrese a donde estaba el usuario antes de abrir el primero.
  const legalPage=(Object.keys(PANTALLA_LEGAL) as LegalPage[]).find(page=>PANTALLA_LEGAL[page]===screen);
  if(legalPage)return <LegalPolicyScreen page={legalPage} onBack={()=>goTo(prevScreen)} onOpen={page=>setScreen(PANTALLA_LEGAL[page])}/>;
  if(screen==="login")return <LoginScreen onLogin={handleLogin} onRegister={()=>goTo("register")} onLanding={()=>goTo("landing")} onPolicy={page=>goTo(PANTALLA_LEGAL[page])} initialEmail={loginPrefillEmail}/>;

  const renderPrivateScreen = () => {
    // â”€â”€ Importer portal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if(screen==="imp-dashboard")return <ImporterDashboardScreen sb={sb} quotes={importerQuotes} advisors={companyAdvisors} chats={chatConversations} companyName={companyProfile?.nombre_empresa||""}/>;
    if(screen==="imp-profile")return <ImporterCompanyProfileScreen sb={sb} company={companyProfile} onSave={handleSaveCompanyProfile}/>;
    if(screen==="imp-advisors")return <ImporterAdvisorsScreen sb={sb} initialAdvisors={companyAdvisors} onCreateAdvisor={handleCreateAdvisor} onSetAdvisorActive={handleSetAdvisorActive} onOpenInternalChat={openInternalChat}/>;
    if(screen==="imp-quotes")return <ImporterQuotesScreen sb={sb} quotes={importerQuotes} onRespond={id=>{setSelectedQuoteId(id);goTo("create-response");}} advisors={companyAdvisors} chats={chatConversations} onOpenChat={openChat} onAssignAdvisor={handleAssignAdvisorToQuote} proposalsByQuoteId={companyProposalsByQuoteId} onConfirmProposal={handleConfirmProposalAsCompany} onRechazada={refreshQuoteLists}/>;

    // â”€â”€ Advisor portal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if(screen==="adv-dashboard")return <ImpAdvisorDashboard sb={sb} availableCount={visibleAvailableQuotes.length} quotes={advisorAssignedQuotes} headerUser={advisorHeaderUser} responsesSentCount={Object.keys(advisorProposalsByQuoteId).length} activeChatsCount={activeChatCount} onOpenInternalChat={()=>openInternalChat()}/>;
    if(screen==="adv-available")return <AdvisorAvailableScreen sb={sb} available={visibleAvailableQuotes} onClaim={claimQuote} onDiscard={async()=>{await refreshQuoteLists();}} headerUser={advisorHeaderUser}/>;
    if(screen==="adv-my-quotes")return <AdvisorMyQuotesScreen sb={sb} quotes={advisorAssignedQuotes} onRespond={id=>{setSelectedQuoteId(id);goTo("create-response");}} headerUser={advisorHeaderUser} existingProposalByQuoteId={advisorProposalsByQuoteId} chats={chatConversations} onOpenChat={openChat} onRechazada={refreshQuoteLists}/>;

    if(screen in ADMIN_SECTION_BY_SCREEN)return <AdminDashboardScreen sb={sb} onRefreshGlobal={refreshQuoteLists} screen={screen as AdminScreen}/>;

    // â”€â”€ Shared â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if(screen==="create-response")return <CreateResponseScreen quoteId={selectedQuoteId} onBack={()=>goTo(prevScreen)} sb={sb} userRole={userRole} quotes={userRole==="importadora"?importerQuotes:advisorAssignedQuotes} onSubmitted={async()=>{await refreshQuoteLists();await reloadChatData().catch(()=>undefined);}} existingProposal={advisorProposalsByQuoteId[selectedQuoteId] ?? null} headerUser={userRole==="asesor"?advisorHeaderUser:importerHeaderUser} companyName={companyProfile?.nombre_empresa || "Tu empresa"} clientName={chatConversations.find((conversation)=>conversation.type==="cotizacion"&&conversation.refId===selectedQuoteId)?.counterpartName} chatConversationId={chatConversations.find((conversation)=>conversation.type==="cotizacion"&&conversation.refId===selectedQuoteId)?.id} onOpenChat={openChat} onEditConditions={()=>{goTo("imp-profile");window.setTimeout(()=>document.getElementById("condiciones-propuesta")?.scrollIntoView({behavior:"smooth"}),300);}}/>;
    if(screen==="notifications")return <NotificationsScreen notifications={notifications} onMark={markNotif} onOpen={openNotification} onBack={()=>goTo(prevScreen)} sb={sb}/>;
    if(screen==="help-support")return <HelpSupportScreen sb={sb} role={userRole as UserRole} onPedirSoporte={()=>setSoporteAbierto(true)}/>;
    if(screen==="courses")return (
      <CoursesPortalScreen
        sb={sb}
        role={userRole === "importadora" ? "importadora" : "solicitante"}
        headerUser={userRole === "importadora" ? importerHeaderUser : USER}
        companyName={userRole === "importadora" ? (companyProfile?.nombre_empresa || importerHeaderUser.company) : ""}
        onGoDashboard={() => goTo(userRole === "importadora" ? "imp-dashboard" : "dashboard")}
        onComprarAcceso={(courseId) => { setCursoAPagar(courseId); goTo("pagos"); }}
      />
    );

    // â”€â”€ Solicitante portal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if(screen==="dashboard")return <DashboardScreen sb={sb} importers={marketplaceImporters} onViewProfile={id=>{setSelectedImporterId(id);goTo("importer-profile");}} onCreateQuote={id=>openNewQuote(id)} />;
    if(screen==="importer-profile")return <ImporterProfileScreen importerId={selectedImporterId} importers={marketplaceImporters} chats={chatConversations} orders={requesterOrders} onBack={()=>goTo("dashboard")} onCreateQuote={id=>openNewQuote(id)} onOpenChat={openChat} sb={sb} onAbrirTendencia={abrirTendencia}/>;
    if(screen==="quotes")return <QuotesScreen quotes={requesterQuotes} responses={requesterResponses} creditos={Number(currentUserProfile?.puntos_cotizacion ?? 0)} onNewQuote={()=>openNewQuote()} onViewDetail={id=>{setSelectedQuoteId(id);goTo("quote-detail");}} onRefreshQuotes={async()=>{await refreshQuoteLists();await refrescarSaldoYTier();}} sb={sb}/>;
    if(screen==="new-quote")return <NewQuoteScreen key={origenSolicitud?.tendenciaItemId||origenSolicitud?.catalogoProductoId||(quotePrefill?"duplicada":"nueva")} onBack={()=>goTo(origenSolicitud?(origenSolicitud.origen==="tendencias"?"tendencias":"catalogos"):"quotes")} sb={sb} preselectedImporterId={preselectedImporterId} importers={marketplaceImporters} cotizanteTier={currentUserProfile?.tier || "Bronze"} creditos={Number(currentUserProfile?.puntos_cotizacion ?? 0)} onSubmitQuote={handleCreateQuote} prefill={quotePrefill} origen={origenSolicitud} cobroTokens={platformConfig.cobro_cotizaciones&&userRole==="solicitante"} cotizacionesGratis={Number(currentUserProfile?.cotizaciones_gratis ?? 0)} solicitudesPlan={Number(currentUserProfile?.solicitudes_plan_vigentes ?? 0)} sinPlan={platformConfig.solo_con_plan&&userRole==="solicitante"&&currentUserProfile!==null&&!currentUserProfile.plan_vigente} permiteAbierta={platformConfig.cotizaciones_abiertas} onIrAPagos={()=>goTo("pagos")} onVerPlanes={irAPlanesDelInicio}/>;
    if(screen==="tendencias")return <PantallaPortal sb={sb} active="tendencias" titulo="Tendencias"><TendenciasFeed rol={rolPortal} onAbrir={abrirTendencia} onPedirPropuestas={pedirPropuestasDesde} onEnviarEnlace={()=>goTo("tendencias-enviar")} onIrAPagos={pagarSuscripcionTendencias}/></PantallaPortal>;
    if(screen==="tendencia-detalle")return <PantallaPortal sb={sb} active="tendencias" titulo="Tendencias"><TendenciaFicha id={selectedTendenciaId} rol={rolPortal} onVolver={()=>goTo("tendencias")} onPedirPropuestas={pedirPropuestasDesde} onIrAPagos={pagarSuscripcionTendencias}/></PantallaPortal>;
    if(screen==="tendencias-enviar")return <PantallaPortal sb={sb} active="tendencias" titulo="Subir un producto viral"><EnviarEnlace rol={rolPortal ?? "solicitante"}/></PantallaPortal>;
    if(screen==="reto")return <PantallaPortal sb={sb} active="reto" titulo="Reto"><RetoPagina autenticado onIrARegistro={()=>goTo("register")} onEnviarEnlace={()=>goTo("tendencias-enviar")}/></PantallaPortal>;
    if(screen==="admin-reto")return <PantallaPortal sb={sb} active="admin-reto" titulo="Reto · Rondas y pagos"><RetoAdmin/></PantallaPortal>;
    if(screen==="catalogos")return <PantallaPortal sb={sb} active="catalogos" titulo="Catálogos"><CatalogosComprador onPedirPropuesta={pedirPropuestasDesde}/></PantallaPortal>;
    if(screen==="imp-catalogos")return <PantallaPortal sb={sb} active="imp-catalogos" titulo="Catálogos"><CatalogosEmpresa esDueno={userRole==="importadora"}/></PantallaPortal>;
    if(screen==="admin-tipografia")return <PantallaPortal sb={sb} active="admin-tipografia" titulo="Tipografía"><TipografiaPlataforma/></PantallaPortal>;
    if(screen==="admin-pagos")return <PantallaPortal sb={sb} active="admin-pagos" titulo="Pagos"><RevisionPagos/></PantallaPortal>;
    // Cursos propios de Zarpi: el mismo tablero y editor que usan las importadoras.
    if(screen==="admin-cursos")return <CoursesPortalScreen sb={sb} active="admin-cursos" role="importadora" headerUser={USER} companyName="Zarpi" cursosDeZarpi onGoDashboard={()=>goTo("admin-dashboard")}/>;
    if(screen==="admin-planes")return <PantallaPortal sb={sb} active="admin-planes" titulo="Planes"><PlanesAdmin/></PantallaPortal>;
    if(screen==="admin-presentaciones")return <PantallaPortal sb={sb} active="admin-presentaciones" titulo="Presentaciones de empresas"><RevisionPresentaciones/></PantallaPortal>;
    if(screen==="admin-cursos-accesos")return <PantallaPortal sb={sb} active="admin-cursos-accesos" titulo="Accesos a cursos"><AccesosCursos/></PantallaPortal>;
    if(screen==="admin-modulos")return <PantallaPortal sb={sb} active="admin-modulos" titulo="Módulos"><ModulosPlataforma onCambio={recargarPlatformConfig}/></PantallaPortal>;
    if(screen==="diseno")return <PantallaPortal sb={sb} active="diseno" titulo="Diseño"><PanelDiseno/></PantallaPortal>;
    if(screen==="tendencias-aprobacion"){
      if(userRole!=="admin"&&!currentUserProfile?.es_curador)return unauthorizedFallback;
      return <PantallaPortal sb={sb} active="tendencias-aprobacion" titulo="Tendencias · Aprobación"><PanelAprobacion esAdmin={userRole==="admin"}/></PantallaPortal>;
    }
    if(screen==="quote-detail")return <QuoteDetailScreen quoteId={selectedQuoteId} quotes={userRole==="solicitante"?requesterQuotes:userRole==="importadora"?importerQuotes:advisorAssignedQuotes} chats={chatConversations} orders={userRole==="importadora"?importerOrders:requesterOrders} onBack={()=>goTo(userRole==="solicitante"?"quotes":getHomeScreenForRole(userRole))} onOpenChat={openChat} sb={sb} onRefreshQuotes={refreshQuoteLists} onDuplicate={duplicateQuote} userRole={userRole} onConfirmProposal={userRole==="importadora"?handleConfirmProposalAsCompany:undefined}/>;
    if(screen==="responses")return <ResponsesScreen onViewDetail={(id,from)=>openResponse(id,from)} sb={sb} responses={requesterResponses} importers={marketplaceImporters} quotes={requesterQuotes} onViewQuote={id=>{setSelectedQuoteId(id);goTo("quote-detail");}}/>;
    if(screen==="response-detail")return <ResponseDetailScreen responseId={selectedResponseId} from={responseFrom} fromQuoteId={responseFromQuoteId} onBack={()=>goTo("responses")} onBackToQuote={id=>{setSelectedQuoteId(id);goTo("quote-detail");}} onOpenChat={openChat} sb={sb} responses={requesterResponses} quotes={requesterQuotes} chats={chatConversations} importers={marketplaceImporters} orders={userRole==="importadora"?importerOrders:requesterOrders} onRefreshData={refreshQuoteLists}/>;
    if(screen==="chats")return <ChatsScreen onViewQuote={id=>{setSelectedQuoteId(id);goTo("quote-detail");}} onViewOrder={id=>{setSelectedOrderDetail(null);setSelectedOrderId(id);goTo("order-detail");}} sb={sb} initialConvId={initialChatConvId} conversations={conversacionesDeChats} messagesByConversation={chatMessagesByConversation} onSendMessage={handleSendChatMessage} onOpenProposalForm={openProposalForm} proposalStateByQuoteId={Object.fromEntries(Object.entries(advisorProposalsByQuoteId).map(([id,propuesta])=>[id,propuesta.estado]))} onShareLocalAttachment={handleShareLocalAttachment} onShareExistingResource={handleShareExistingResource} onTransferConversation={handleTransferConversation} onUpdateOrderStatus={handleUpdateOrderStatus} onAttachOrderDocument={handleAttachOrderDocument} onActiveConversationChange={handleActiveConversationChange} onCloseTicket={handleCloseTicket} onReopenTicket={handleReopenTicket} onEscalateTicket={handleEscalateTicket} onRateTicket={handleRateTicket} companyAdvisors={companyAdvisors} currentUserRole={userRole} chatAttachmentsByConversation={chatAttachmentsByConversation} orders={userRole==="importadora"?importerOrders:requesterOrders} quotes={userRole==="importadora"?importerQuotes:requesterQuotes} importers={marketplaceImporters}/>;
    if(screen==="team-channel")return <ChatsScreen modoEquipo miembrosEquipo={miembrosEquipo} onAbrirHiloEquipo={abrirHiloEquipo} onViewQuote={id=>{setSelectedQuoteId(id);goTo("quote-detail");}} onViewOrder={id=>{setSelectedOrderDetail(null);setSelectedOrderId(id);goTo("order-detail");}} sb={sb} initialConvId={initialChatConvId} conversations={conversacionesDelEquipo} messagesByConversation={chatMessagesByConversation} onSendMessage={handleSendChatMessage} onOpenProposalForm={openProposalForm} proposalStateByQuoteId={Object.fromEntries(Object.entries(advisorProposalsByQuoteId).map(([id,propuesta])=>[id,propuesta.estado]))} onShareLocalAttachment={handleShareLocalAttachment} onShareExistingResource={handleShareExistingResource} onTransferConversation={handleTransferConversation} onUpdateOrderStatus={handleUpdateOrderStatus} onAttachOrderDocument={handleAttachOrderDocument} onActiveConversationChange={handleActiveConversationChange} onCloseTicket={handleCloseTicket} onReopenTicket={handleReopenTicket} onEscalateTicket={handleEscalateTicket} onRateTicket={handleRateTicket} companyAdvisors={companyAdvisors} currentUserRole={userRole} chatAttachmentsByConversation={chatAttachmentsByConversation} orders={userRole==="importadora"?importerOrders:requesterOrders} quotes={userRole==="importadora"?importerQuotes:requesterQuotes} importers={marketplaceImporters}/>;
    if(screen==="orders")return <OrdersScreen onViewOrder={id=>{setSelectedOrderDetail(null);setSelectedOrderId(id);goTo("order-detail");}} sb={sb} orders={userRole==="importadora"?importerOrders:requesterOrders} importers={marketplaceImporters}/>;
    if(screen==="order-detail")return <OrderDetailScreen order={selectedOrderDetail} isLoading={isOrderDetailLoading} onBack={()=>goTo("orders")} onOpenChat={openChat} sb={sb} importers={marketplaceImporters} advisorName={selectedOrderDetail ? chatConversations.find((conversation)=>conversation.refId===selectedOrderDetail.id)?.counterpartName : undefined} onViewImporterProfile={id=>{setSelectedImporterId(id);goTo("importer-profile");}} canManageOrder={userRole==="importadora"||userRole==="asesor"} esCliente={userRole==="solicitante"} onUpdateOrderStatus={handleUpdateOrderStatus}/>;
    if(screen==="documentos")return <DocumentosScreen sb={sb} explorer={documentExplorer} isLoading={isDocumentExplorerLoading} currentFolderId={documentCurrentFolderId} onLoadFolder={async(parentId)=>{await reloadDocumentExplorer(parentId);}} onCreateFolder={handleCreateDocumentFolder} onRegisterFile={handleRegisterLocalDocument} onSearch={handleSearchDocuments} onMoveFile={handleMoveDocumentFile} onMoveFolder={handleMoveDocumentFolder} onRenameFile={handleRenameDocumentFile} onRenameFolder={handleRenameDocumentFolder} onDeleteFile={handleDeleteDocumentFile} onDeleteFolder={handleDeleteDocumentFolder} protectedFolders={protectedRootFolders}/>;
    if(screen==="pagos")return <PantallaPortal sb={sb} active="pagos" titulo="Pagos"><CargueDescarguePagos rol={userRole} cursoInicial={cursoAPagar} onCursoInicialUsado={()=>setCursoAPagar(null)} carpetaInicial={carpetaPagos}/></PantallaPortal>;
    if(screen==="user-profile")return (
      <PantallaPortal sb={sb} active="user-profile" titulo="Mi perfil">
        <PerfilUsuario
          onActualizado={async()=>{await Promise.allSettled([reloadCurrentUserProfile(),refreshUser()]);}}
          onIrAEmpresa={userRole==="importadora"?()=>goTo("imp-profile"):undefined}
          // Solo aparece para el cotizante: el componente se oculta si el backend no le devuelve código.
          extra={userRole==="solicitante"?<TarjetaReferidos/>:undefined}
        />
      </PantallaPortal>
    );
    return null;
  };

  if(!isAuthenticated&&!isInitializing&&(screen==="tendencias"||screen==="tendencia-detalle"||screen==="reto")){
    return (
      <PantallaPublica activa={screen==="reto"?"reto":"tendencias"} onLanding={()=>goTo("landing")} onPlanes={irAPlanesDelInicio} onLogin={()=>goTo("login")} onRegister={()=>goTo("register")} onTendencias={()=>goTo("tendencias")} onReto={()=>goTo("reto")} onPolicy={page=>goTo(PANTALLA_LEGAL[page])}>
        {screen==="tendencias"&&<TendenciasFeed rol={null} onAbrir={abrirTendencia} onPedirPropuestas={pedirPropuestasDesde} onEnviarEnlace={()=>goTo("register")} onRegistrarse={()=>goTo("register")} onIniciarSesion={()=>goTo("login")}/>}
        {screen==="tendencia-detalle"&&<TendenciaFicha id={selectedTendenciaId} rol={null} onVolver={()=>goTo("tendencias")} onPedirPropuestas={pedirPropuestasDesde} onRegistrarse={()=>goTo("register")} onIniciarSesion={()=>goTo("login")}/>}
        {screen==="reto"&&<RetoPagina autenticado={false} onIrARegistro={()=>goTo("register")} onEnviarEnlace={()=>goTo("register")}/>}
      </PantallaPublica>
    );
  }

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
