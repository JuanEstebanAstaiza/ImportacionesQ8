import { useState, useEffect, useRef, useCallback } from "react";
import {
  Film, Mail, Building2, CheckCircle2, Loader2, Package2, FileText,
  ShoppingCart, FolderOpen, CreditCard, Plus, Clock, Users, MapPin, Layers,
  BadgeCheck, GitCompare, ClipboardList, MessageSquare, LayoutGrid, Award,
  Shield, BookOpen, Zap, LifeBuoy, WalletCards, DatabaseBackup, Sparkles,
  LibraryBig, Type, Trophy, Palette, ToggleRight, Flame, GraduationCap,
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

import { Quote } from "../types/quote";
import type { QuoteResponse, ResponseFrom } from "../types/response";
import { Importer } from "../types/importer";
import type { CompanyAdvisor, SidebarCtrl } from "../types/portal";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { AuthScreen } from "@/features/auth/components/AuthScreen";
import { PublicSicLogo } from "@/components/navigation/PublicSicLogo";
import { CoursesPortalScreen } from "@/features/courses/CoursesPortalScreen";
import { ChatsScreen } from "@/features/chat/ChatsScreen";
import { DocumentosScreen } from "@/features/documents/DocumentosScreen";
import { HelpSupportScreen } from "@/features/help/HelpSupportScreen";
import { SoporteModal } from "@/features/help/SoporteModal";
import { LegalPolicyScreen } from "@/features/legal/components/LegalPolicyScreen";
import type { LegalPage } from "@/features/legal/types";
import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { DashboardScreen } from "@/pages/buyer/BuyerDashboard";
import { ImporterDashboard } from "@/pages/importer/ImporterDashboard";
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
import { ImpAdvisorDashboard } from "@/pages/advisor/AdvisorDashboard";
import { AdvisorAvailableScreen } from "@/components/advisor/tabs/AdvisorAvailableScreen";
import { AdvisorMyQuotesScreen } from "@/components/advisor/tabs/AdvisorMyQuotesScreen";
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";
import { ImagenArchivo } from "@/components/files/ImagenArchivo";
import { TendenciasFeed } from "@/features/tendencias/Feed";
import { TendenciaFicha } from "@/features/tendencias/Ficha";
import { EnviarEnlace } from "@/features/tendencias/EnviarEnlace";
import { PanelAprobacion } from "@/features/tendencias/PanelAprobacion";
import { PanelDiseno } from "@/features/tendencias/PanelDiseno";
import { ModulosPlataforma } from "@/features/admin/ModulosPlataforma";
import { RevisionPagos } from "@/features/admin/RevisionPagos";
import { AccesosCursos } from "@/features/admin/AccesosCursos";
import { RevisionPresentaciones } from "@/features/admin/RevisionPresentaciones";
import { PlanesAdmin } from "@/features/admin/PlanesAdmin";
import { ListaEsperaApertura } from "@/features/planes/ListaEspera";
import { InscripcionPlan } from "@/features/planes/InscripcionPlan";
import { CargueDescarguePagos } from "@/features/pagos/CargueDescarguePagos";
import { fijarRegistro, registroAbierto } from "@/app/registro";
import { RetoPagina } from "@/features/reto/RetoPagina";
import { PerfilUsuario } from "@/features/perfil/PerfilUsuario";
import { RetoAdmin } from "@/features/reto/RetoAdmin";
import type { PrefillSolicitud } from "@/features/tendencias/prefill";
import { CatalogosEmpresa } from "@/features/catalogos/CatalogosEmpresa";
import { CatalogosComprador } from "@/features/catalogos/CatalogosComprador";
import { TipografiaPlataforma } from "@/features/admin/TipografiaPlataforma";
import { LandingScreen, PantallaPublica } from "@/pages/public/LandingScreen";
import { useAuth } from "@/hooks/useAuth";
import { useAutoRefresh, type AutoRefreshReason } from "@/hooks/useAutoRefresh";
import { useChatSocket } from "@/hooks/useChatSocket";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { resolveHeaderSubtitle } from "@/app/utils/header-profile-subtitle";
import { useBrandTheme } from "@/app/hooks/useBrandTheme";
import { mapBackendChatMessage } from "@/features/chat/mappers";
import { mapBackendImporterToUi } from "@/features/importador/mappers";
import { mapBackendQuoteToUi } from "@/features/quotes/mappers";
import { mapBackendAdvisorToUi } from "@/features/advisors/mappers";
import { mapBackendProposalToUiResponse } from "@/features/propuestas/mappers";
import { mapBackendOrderToUiOrder } from "@/features/ordenes/mappers";
import type { PropuestaEnMensaje } from "@/features/propuestas/TarjetaPropuestaChat";
export type { Order, OrderHistoryItem, OrderDocumentItem, LifecycleDocItem } from "@/features/ordenes/types";
export { orderDocumentTypeLabel, orderStateLabel, nextOrderState, inferLifecycleStageIndex, buildLifecycleTimeline } from "@/features/ordenes/constants";

import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader, USER, USER_IMPORTADORA, USER_ASESOR } from "@/components/layout/AppHeader";
import { PantallaPortal } from "@/components/layout/PantallaPortal";
import { Modal } from "@/components/ui/Modal";
import { ImporterProfileScreen } from "@/features/importador/components/ImporterProfileScreen";
import { NotificationsScreen } from "@/features/notifications/components/NotificationsScreen";
import { RegisterScreen } from "@/features/auth/components/RegisterScreen";
import { RegistroCerrado } from "@/features/auth/components/RegistroCerrado";
import { CreateResponseScreen } from "@/features/propuestas/components/CreateResponseScreen";
import type { AppNotification } from "@/features/notifications/types";
import { INIT_NOTIFICATIONS } from "@/features/notifications/constants.tsx";
import { mapBackendNotificationToUi } from "@/features/notifications/mappers";
import {
  Avatar, Button, Card, Logo,
} from "@/components/design-system";
import { parseBackendDate } from "@/utils/date";
// De este archivo ya solo se usan las buenas prácticas por rol: la FAQ vive
// ahora en la base de datos, mantenida por el equipo de soporte.
import {
  businessService,
  type BackendChatAttachmentItem,
  type BackendChatConversation,
  type BackendMiembroEquipo,
  type BackendCotizacion,
  type BackendExplorerResponse,
  type BackendImporter,
  type BackendPropuesta,
  type MotivoEleccion,
  type UnidadCantidad,
  type BackendUserProfile,
  type CreateAsesorPayload,
  type CreateCotizacionPayload,
  type CreatePropuestaPayload,
} from "@/services/business.service";
import { leerPropuesta, pesos as pesosCop } from "@/features/propuestas/calculo";
import { getStoredRole, getStoredToken, resolveApiUrl, toApiPath } from "@/services/api-client";
import { safeHttpUrl } from "@/utils/safe-url";
import { CATEGORIAS_PRODUCTO } from "@/utils/categorias";
import { abrirArchivoEnPestana } from "@/utils/abrir-archivo";
import { TarjetaReferidos } from "@/features/referidos/TarjetaReferidos";
import { destinoDe, esPantalla, rutaDe, type ParamRuta, type Screen } from "@/app/rutas";
import type { UrgenciaSoporte } from "@/services/business.service";
import { CLAVE_PREFILL_PENDIENTE, RESET_PASSWORD_PATH } from "@/utils/paths";

// Compatibilidad para las vistas de dominio que todavía consumen los contratos
// públicos históricos de App.tsx; la implementación vive en sus módulos.
export { Sidebar, AppHeader, PantallaPortal, Modal, USER, USER_IMPORTADORA, USER_ASESOR };

/** Pantalla (y por tanto URL) de cada documento legal. */
const PANTALLA_LEGAL: Record<LegalPage, Screen> = {
  data: "policy-data",
  terms: "policy-terms",
  payments: "policy-payments",
  planes: "policy-planes",
};

const MAX_FOTOS_PRODUCTO = 10;

// ----------------------------------------------------------------------------------------------------
// DATA
// ----------------------------------------------------------------------------------------------------
type ChatType="orden"|"cotizacion"|"interno"|"soporte"|"equipo";

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

  function formatoPesos(valor: number): string {
    return `$${Math.round(valor).toLocaleString("es-CO")} COP`;
  }

  function DatosDeContactoEmpresa({ imp }: { imp: Importer }) {
    const datos = [
      ["Sitio web", imp.website],
      ["Correo", imp.email],
      ["Teléfono", imp.phone],
      ["Dirección", imp.address],
      ["Fundada", imp.foundedYear],
    ].filter(([, value]) => value);

    if (datos.length === 0) {
      return null;
    }

    return (
      <Card padding="md">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          Datos de contacto
        </h3>
        <div className="grid gap-2 text-sm">
          {datos.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <span className="text-muted-foreground">{label}</span>
              <span className="text-right">{value}</span>
            </div>
          ))}
        </div>
      </Card>
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
export type MsgFileType="pdf"|"excel"|"word"|"image";
export interface MsgFile {name:string;type:MsgFileType;size:string;}
export interface ChatMsg {
  id:string;sender:"client"|"provider";text?:string;file?:MsgFile;
  time:string;read:boolean;dateGroup?:string;
  // Propuesta enviada (`tipo: "propuesta"`): se muestra como tarjeta.
  proposal?:PropuestaEnMensaje;
  // Nombre de quien lo escribió, cuando no es quien mira.
  authorName?:string;
}

const INCOTERMS=["EXW","FCA","FAS","FOB","CFR","CIF","CPT","CIP","DAP","DPU","DDP"];
const COUNTRIES=["China","Estados Unidos","Alemania","Japón","India","Italia","Francia","España","Brasil","Corea del Sur","Turquía","México","Colombia"];
// Una sola lista para la línea de producto que pide el cliente y para las
// categorías que declara la empresa: eran dos listas distintas y el backend
// compara ambas para decidir si la empresa puede responder. Ver
// `src/utils/categorias.ts`.
const LINES=CATEGORIAS_PRODUCTO;
const ALL_CATEGORIES=CATEGORIAS_PRODUCTO;
export const SYSTEM_ROOT_FOLDER_NAMES=["?rdenes","Cotizaciones","Respuestas","Cursos","Chats","Certificados"];
// Buzón al que escribe quien quiere dar de alta una empresa importadora: el
// alta la hace el equipo de la plataforma, no hay auto-registro.
const CORREO_ADMINISTRACION="admin@zarpi.co";

export function normalizeFolderName(value:string):string{
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

export function FormatFileIcon({ extension, mimeType, compact = false }: { extension: string; mimeType: string; compact?: boolean }) {
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

// ----------------------------------------------------------------------------------------------------
// SIDEBAR ? pinned / floating / toggle tab
// ----------------------------------------------------------------------------------------------------
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

export function formatShortDate(value: string): string {
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

export function importerColorFromId(id: string): string {
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








function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function findCustomFieldValue(customFields: Record<string, unknown> | null | undefined, aliases: string[]): string {
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

export function getQuoteAttachmentLinks(quote: Quote): string[] {
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









type NavItem={icon:React.FC<{className?:string}>;label:string;key:string};

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
    "Esta empresa aún no ha publicado su descripción.";

  const certs =
    imp.certs && imp.certs.length > 0
      ? imp.certs
      : [];

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

// ----------------------------------------------------------------------------------------------------
// DASHBOARD SCREEN ? importer marketplace catalog
// ----------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------
// IMPORTER PROFILE SCREEN ? read-only public profile for the requester
// ----------------------------------------------------------------------------------------------------
const STEPS=["Modalidad","Información del producto","Confirmación"];
// ----------------------------------------------------------------------------------------------------
/** Estado del autoguardado del perfil de empresa, en la cabecera. */
export function IndicadorAutoguardado({estado}:{estado:"sin-cambios"|"pendiente"|"guardando"|"guardado"}) {
  if(estado==="sin-cambios"){
    return <span className="text-xs text-muted-foreground">Se guarda automáticamente</span>;
  }
  if(estado==="pendiente"){
    return <span className="text-xs text-amber-700 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/>Cambios sin guardar</span>;
  }
  if(estado==="guardando"){
    return <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin"/>Guardando...</span>;
  }
  return <span className="text-xs text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5"/>Guardado</span>;
}

/**
 * Retardo del autoguardado. Suficiente para no disparar una petición por
 * pulsación y corto para que el usuario vea "Guardado" mientras sigue en el
 * mismo campo: el perfil se perdía porque nadie volvía a pulsar el botón.
 */
const RETARDO_AUTOGUARDADO_MS = 1200;



// ----------------------------------------------------------------------------------------------------
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
const IMPORTER_ROUTES: Screen[] = ["imp-dashboard", "imp-profile", "imp-advisors", "imp-quotes", "imp-catalogos"];
const ADVISOR_ROUTES: Screen[] = ["adv-dashboard", "adv-available", "adv-my-quotes"];
const BUYER_ROUTES: Screen[] = ["dashboard", "importer-profile", "quotes", "new-quote", "quote-detail", "responses", "response-detail", "orders", "order-detail", "catalogos"];

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

// ----------------------------------------------------------------------------------------------------
// ROOT
// ----------------------------------------------------------------------------------------------------
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
  // pasar por «Cargando...» (eso desmontaba el detalle y se perdía lo que el
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

  useEffect(() => {
    if (!isAuthenticated || !token || isInitializing || screen !== "chats") {
      return;
    }
    void reloadChatData();
  }, [isAuthenticated, token, isInitializing, screen, reloadChatData]);

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
  const chatUnreadCount=chatConversations
    .filter((conversation)=>conversation.type!=="equipo"&&!conversation.closed)
    .reduce((acc,conversation)=>acc+(conversation.unread||0),0);
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

  const importerViews = {
    "imp-profile": <ImporterCompanyProfileScreen sb={sb} company={companyProfile} onSave={handleSaveCompanyProfile}/>,
    "imp-advisors": <ImporterAdvisorsScreen sb={sb} initialAdvisors={companyAdvisors} onCreateAdvisor={handleCreateAdvisor} onSetAdvisorActive={handleSetAdvisorActive} onOpenInternalChat={openInternalChat}/>,
    "imp-quotes": <ImporterQuotesScreen sb={sb} quotes={importerQuotes} onRespond={id=>{setSelectedQuoteId(id);goTo("create-response");}} advisors={companyAdvisors} chats={chatConversations} onOpenChat={openChat} onAssignAdvisor={handleAssignAdvisorToQuote} proposalsByQuoteId={companyProposalsByQuoteId} onConfirmProposal={handleConfirmProposalAsCompany} onRechazada={refreshQuoteLists}/>,
    "imp-catalogos": <PantallaPortal sb={sb} active="imp-catalogos" titulo="Catálogos"><CatalogosEmpresa esDueno={userRole==="importadora"}/></PantallaPortal>,
  };

  const advisorViews = {
    "adv-available": <AdvisorAvailableScreen sb={sb} available={visibleAvailableQuotes} onClaim={claimQuote} onDiscard={async()=>{await refreshQuoteLists();}} headerUser={advisorHeaderUser}/>,
    "adv-my-quotes": <AdvisorMyQuotesScreen sb={sb} quotes={advisorAssignedQuotes} onRespond={id=>{setSelectedQuoteId(id);goTo("create-response");}} headerUser={advisorHeaderUser} existingProposalByQuoteId={advisorProposalsByQuoteId} chats={chatConversations} onOpenChat={openChat} onRechazada={refreshQuoteLists}/>,
  };

  const buyerViews = {
    "importer-profile": <ImporterProfileScreen importerId={selectedImporterId} importers={marketplaceImporters} quotes={requesterQuotes} chats={chatConversations} orders={requesterOrders} onBack={()=>goTo("dashboard")} onCreateQuote={id=>openNewQuote(id)} onOpenChat={openChat} sb={sb} onAbrirTendencia={abrirTendencia}/>,
    "quotes": <QuotesScreen quotes={requesterQuotes} responses={requesterResponses} creditos={Number(currentUserProfile?.puntos_cotizacion ?? 0)} onNewQuote={()=>openNewQuote()} onViewDetail={id=>{setSelectedQuoteId(id);goTo("quote-detail");}} onRefreshQuotes={async()=>{await refreshQuoteLists();await refrescarSaldoYTier();}} sb={sb}/>,
    "new-quote": <NewQuoteScreen key={origenSolicitud?.tendenciaItemId||origenSolicitud?.catalogoProductoId||(quotePrefill?"duplicada":"nueva")} onBack={()=>goTo(origenSolicitud?(origenSolicitud.origen==="tendencias"?"tendencias":"catalogos"):"quotes")} sb={sb} preselectedImporterId={preselectedImporterId} importers={marketplaceImporters} cotizanteTier={currentUserProfile?.tier || "Bronze"} creditos={Number(currentUserProfile?.puntos_cotizacion ?? 0)} onSubmitQuote={handleCreateQuote} prefill={quotePrefill} origen={origenSolicitud} cobroTokens={platformConfig.cobro_cotizaciones&&userRole==="solicitante"} cotizacionesGratis={Number(currentUserProfile?.cotizaciones_gratis ?? 0)} solicitudesPlan={Number(currentUserProfile?.solicitudes_plan_vigentes ?? 0)} sinPlan={platformConfig.solo_con_plan&&userRole==="solicitante"&&currentUserProfile!==null&&!currentUserProfile.plan_vigente} permiteAbierta={platformConfig.cotizaciones_abiertas} onIrAPagos={()=>goTo("pagos")} onVerPlanes={irAPlanesDelInicio}/>,
    "quote-detail": <QuoteDetailScreen quoteId={selectedQuoteId} quotes={requesterQuotes} chats={chatConversations} orders={requesterOrders} onBack={()=>goTo("quotes")} onOpenChat={openChat} sb={sb} onRefreshQuotes={refreshQuoteLists} onDuplicate={duplicateQuote} userRole={userRole}/>,
    "responses": <ResponsesScreen onViewDetail={(id,from)=>openResponse(id,from)} sb={sb} responses={requesterResponses} importers={marketplaceImporters} quotes={requesterQuotes} onViewQuote={id=>{setSelectedQuoteId(id);goTo("quote-detail");}}/>,
    "response-detail": <ResponseDetailScreen responseId={selectedResponseId} from={responseFrom} fromQuoteId={responseFromQuoteId} onBack={()=>goTo("responses")} onBackToQuote={id=>{setSelectedQuoteId(id);goTo("quote-detail");}} onOpenChat={openChat} sb={sb} responses={requesterResponses} quotes={requesterQuotes} chats={chatConversations} importers={marketplaceImporters} orders={requesterOrders} onRefreshData={refreshQuoteLists}/>,
    "orders": <OrdersScreen onViewOrder={id=>{setSelectedOrderDetail(null);setSelectedOrderId(id);goTo("order-detail");}} sb={sb} orders={requesterOrders} importers={marketplaceImporters}/>,
    "order-detail": <OrderDetailScreen order={selectedOrderDetail} isLoading={isOrderDetailLoading} onBack={()=>goTo("orders")} onOpenChat={openChat} sb={sb} importers={marketplaceImporters} advisorName={selectedOrderDetail ? chatConversations.find((conversation)=>conversation.refId===selectedOrderDetail.id)?.counterpartName : undefined} onViewImporterProfile={id=>{setSelectedImporterId(id);goTo("importer-profile");}} canManageOrder={false} esCliente onUpdateOrderStatus={handleUpdateOrderStatus}/>,
    "catalogos": <PantallaPortal sb={sb} active="catalogos" titulo="Catálogos"><CatalogosComprador onPedirPropuesta={pedirPropuestasDesde}/></PantallaPortal>,
  };

  const renderPrivateScreen = () => {
    // â”€â”€ Importer portal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if(IMPORTER_ROUTES.includes(screen)) {
      return <ImporterDashboard screen={screen} sb={sb} quotes={importerQuotes} advisors={companyAdvisors} chats={chatConversations} companyName={companyProfile?.nombre_empresa||""} views={importerViews}/>;
    }

    // â”€â”€ Advisor portal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if(ADVISOR_ROUTES.includes(screen)) {
      return <ImpAdvisorDashboard screen={screen} sb={sb} availableCount={visibleAvailableQuotes.length} quotes={advisorAssignedQuotes} headerUser={advisorHeaderUser} responsesSentCount={Object.keys(advisorProposalsByQuoteId).length} activeChatsCount={activeChatCount} onOpenInternalChat={()=>openInternalChat()} views={advisorViews}/>;
    }

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
        SidebarComponent={Sidebar}
        HeaderComponent={AppHeader}
      />
    );

    // â”€â”€ Solicitante portal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if(BUYER_ROUTES.includes(screen)) {
      return <DashboardScreen screen={screen} sb={sb} importers={marketplaceImporters} onViewProfile={id=>{setSelectedImporterId(id);goTo("importer-profile");}} onCreateQuote={id=>openNewQuote(id)} views={buyerViews}/>;
    }
    if(screen==="tendencias")return <PantallaPortal sb={sb} active="tendencias" titulo="Tendencias"><TendenciasFeed rol={rolPortal} onAbrir={abrirTendencia} onPedirPropuestas={pedirPropuestasDesde} onEnviarEnlace={()=>goTo("tendencias-enviar")} onIrAPagos={pagarSuscripcionTendencias}/></PantallaPortal>;
    if(screen==="tendencia-detalle")return <PantallaPortal sb={sb} active="tendencias" titulo="Tendencias"><TendenciaFicha id={selectedTendenciaId} rol={rolPortal} onVolver={()=>goTo("tendencias")} onPedirPropuestas={pedirPropuestasDesde} onIrAPagos={pagarSuscripcionTendencias}/></PantallaPortal>;
    if(screen==="tendencias-enviar")return <PantallaPortal sb={sb} active="tendencias" titulo="Subir un producto viral"><EnviarEnlace rol={rolPortal ?? "solicitante"}/></PantallaPortal>;
    if(screen==="reto")return <PantallaPortal sb={sb} active="reto" titulo="Reto"><RetoPagina autenticado onIrARegistro={()=>goTo("register")} onEnviarEnlace={()=>goTo("tendencias-enviar")}/></PantallaPortal>;
    if(screen==="admin-reto")return <PantallaPortal sb={sb} active="admin-reto" titulo="Reto · Rondas y pagos"><RetoAdmin/></PantallaPortal>;
    if(screen==="admin-tipografia")return <PantallaPortal sb={sb} active="admin-tipografia" titulo="Tipografía"><TipografiaPlataforma/></PantallaPortal>;
    if(screen==="admin-pagos")return <PantallaPortal sb={sb} active="admin-pagos" titulo="Pagos"><RevisionPagos/></PantallaPortal>;
    // Cursos propios de Zarpi: el mismo tablero y editor que usan las importadoras.
    if(screen==="admin-cursos")return <CoursesPortalScreen sb={sb} active="admin-cursos" role="importadora" headerUser={USER} companyName="Zarpi" cursosDeZarpi onGoDashboard={()=>goTo("admin-dashboard")} SidebarComponent={Sidebar} HeaderComponent={AppHeader}/>;
    if(screen==="admin-planes")return <PantallaPortal sb={sb} active="admin-planes" titulo="Planes"><PlanesAdmin/></PantallaPortal>;
    if(screen==="admin-presentaciones")return <PantallaPortal sb={sb} active="admin-presentaciones" titulo="Presentaciones de empresas"><RevisionPresentaciones/></PantallaPortal>;
    if(screen==="admin-cursos-accesos")return <PantallaPortal sb={sb} active="admin-cursos-accesos" titulo="Accesos a cursos"><AccesosCursos/></PantallaPortal>;
    if(screen==="admin-modulos")return <PantallaPortal sb={sb} active="admin-modulos" titulo="Módulos"><ModulosPlataforma onCambio={recargarPlatformConfig}/></PantallaPortal>;
    if(screen==="diseno")return <PantallaPortal sb={sb} active="diseno" titulo="Diseño"><PanelDiseno/></PantallaPortal>;
    if(screen==="tendencias-aprobacion"){
      if(userRole!=="admin"&&!currentUserProfile?.es_curador)return unauthorizedFallback;
      return <PantallaPortal sb={sb} active="tendencias-aprobacion" titulo="Tendencias · Aprobación"><PanelAprobacion esAdmin={userRole==="admin"}/></PantallaPortal>;
    }
    if(screen==="chats")return <ChatsScreen onViewQuote={id=>{setSelectedQuoteId(id);goTo("quote-detail");}} onViewOrder={id=>{setSelectedOrderDetail(null);setSelectedOrderId(id);goTo("order-detail");}} sb={sb} initialConvId={initialChatConvId} conversations={conversacionesDeChats} messagesByConversation={chatMessagesByConversation} onSendMessage={handleSendChatMessage} onOpenProposalForm={openProposalForm} proposalStateByQuoteId={Object.fromEntries(Object.entries(advisorProposalsByQuoteId).map(([id,propuesta])=>[id,propuesta.estado]))} onShareLocalAttachment={handleShareLocalAttachment} onShareExistingResource={handleShareExistingResource} onTransferConversation={handleTransferConversation} onUpdateOrderStatus={handleUpdateOrderStatus} onAttachOrderDocument={handleAttachOrderDocument} onActiveConversationChange={handleActiveConversationChange} onCloseTicket={handleCloseTicket} onReopenTicket={handleReopenTicket} onEscalateTicket={handleEscalateTicket} onRateTicket={handleRateTicket} companyAdvisors={companyAdvisors} currentUserRole={userRole} chatAttachmentsByConversation={chatAttachmentsByConversation} orders={userRole==="importadora"?importerOrders:requesterOrders} quotes={userRole==="importadora"?importerQuotes:requesterQuotes} importers={marketplaceImporters} onLoadResourceFolder={reloadDocumentExplorer} userPhotoUrl={currentUserProfile?.foto_url || undefined}/>;
    if(screen==="team-channel")return <ChatsScreen modoEquipo miembrosEquipo={miembrosEquipo} onAbrirHiloEquipo={abrirHiloEquipo} onViewQuote={id=>{setSelectedQuoteId(id);goTo("quote-detail");}} onViewOrder={id=>{setSelectedOrderDetail(null);setSelectedOrderId(id);goTo("order-detail");}} sb={sb} initialConvId={initialChatConvId} conversations={conversacionesDelEquipo} messagesByConversation={chatMessagesByConversation} onSendMessage={handleSendChatMessage} onOpenProposalForm={openProposalForm} proposalStateByQuoteId={Object.fromEntries(Object.entries(advisorProposalsByQuoteId).map(([id,propuesta])=>[id,propuesta.estado]))} onShareLocalAttachment={handleShareLocalAttachment} onShareExistingResource={handleShareExistingResource} onTransferConversation={handleTransferConversation} onUpdateOrderStatus={handleUpdateOrderStatus} onAttachOrderDocument={handleAttachOrderDocument} onActiveConversationChange={handleActiveConversationChange} onCloseTicket={handleCloseTicket} onReopenTicket={handleReopenTicket} onEscalateTicket={handleEscalateTicket} onRateTicket={handleRateTicket} companyAdvisors={companyAdvisors} currentUserRole={userRole} chatAttachmentsByConversation={chatAttachmentsByConversation} orders={userRole==="importadora"?importerOrders:requesterOrders} quotes={userRole==="importadora"?importerQuotes:requesterQuotes} importers={marketplaceImporters} onLoadResourceFolder={reloadDocumentExplorer} userPhotoUrl={currentUserProfile?.foto_url || undefined}/>;
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
