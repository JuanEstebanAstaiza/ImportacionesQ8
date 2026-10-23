import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Quote } from "../types/quote";
import type { QuoteResponse, ResponseFrom } from "../types/response";
import type { ChatConv, ChatMsg } from "@/types/chat";
import type { StoredRole, UserRole } from "@/types/roles";
import type { CompanyAdvisor, SidebarCtrl } from "../types/portal";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { LoginScreen } from "@/features/auth/LoginScreen";

import { CoursesPortalScreen } from "@/features/courses/CoursesPortalScreen";
import { ChatsScreen } from "@/features/chat/ChatsScreen";
import { DocumentosScreen } from "@/features/documents/DocumentosScreen";
import { HelpSupportScreen } from "@/features/help/HelpSupportScreen";
import { SoporteModal } from "@/features/help/SoporteModal";
import { LegalPolicyScreen } from "@/features/legal/components/LegalPolicyScreen";
import type { LegalPage } from "@/features/legal/types";
import { BuyerRouter } from "@/pages/buyer/BuyerRouter";
import { ImporterRouter } from "@/pages/importer/ImporterRouter";
import { AdvisorRouter } from "@/pages/advisor/AdvisorRouter";
import { BuyerPortalProvider } from "@/app/contexts/BuyerPortalContext";
import { ImporterPortalProvider } from "@/app/contexts/ImporterPortalContext";
import { AdvisorPortalProvider } from "@/app/contexts/AdvisorPortalContext";
import { AdminRouter, isAdminScreen } from "@/pages/admin/AdminRouter";
import type { QuoteFormState, OrigenSolicitud } from "@/features/buyer/components/tabs/NewQuoteScreen";
import { ResetPasswordScreen } from "@/features/auth/ResetPasswordScreen";
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
import { resolveHeaderSubtitle } from "@/utils/header-profile-subtitle";
import { useBrandTheme } from "@/hooks/useBrandTheme";
import { businessService as domainService } from "@/services/business.service";
import { useSupportActions } from "@/hooks/useSupportActions";
import { useChatActions } from "@/hooks/useChatActions";
import { useQuoteActions } from "@/hooks/useQuoteActions";
import { useAdvisorActions } from "@/hooks/useAdvisorActions";
import { useOrderActions } from "@/hooks/useOrderActions";
import { useDocumentActions } from "@/hooks/useDocumentActions";
import { mapBackendChatMessage } from "@/features/chat/mappers";
import { mapBackendImporterToUi } from "@/features/importador/mappers";
import { mapBackendQuoteToUi } from "@/features/quotes/mappers";
import { mapBackendAdvisorToUi } from "@/features/advisors/mappers";
import { mapBackendProposalToUiResponse } from "@/features/propuestas/mappers";
import { mapBackendOrderToUiOrder } from "@/features/ordenes/mappers";
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
// De este archivo ya solo se usan las buenas prÃ¡cticas por rol: la FAQ vive
// ahora en la base de datos, mantenida por el equipo de soporte.
import type {
  BackendChatAttachmentItem,
  BackendChatConversation,
  BackendMiembroEquipo,
  BackendCotizacion,
  BackendExplorerResponse,
  BackendImporter,
  BackendPropuesta,
  UnidadCantidad,
  BackendUserProfile,
  CreateAsesorPayload,
  CreateCotizacionPayload,
  CreatePropuestaPayload,
} from "@/services/business.service";
import { getStoredRole, getStoredToken, resolveApiUrl, toApiPath } from "@/services/api-client";
import { safeHttpUrl } from "@/utils/safe-url";
import { TarjetaReferidos } from "@/features/referidos/TarjetaReferidos";
import { destinoDe, esPantalla, rutaDe, type ParamRuta, type Screen } from "@/app/rutas";
import type { UrgenciaSoporte } from "@/services/business.service";
import { CLAVE_PREFILL_PENDIENTE, RESET_PASSWORD_PATH } from "@/utils/paths";
import { normalizeFolderName } from "@/utils/folders";
import { formatShortDate } from "@/utils/format";
import { initialsFromName, importerColorFromId } from "@/utils/profile";
import {
  applyQuoteStatusOverride,
  loadHiddenOpenQuotesByCompany,
  loadQuoteStatusOverrides,
} from "@/features/quotes/storage";
import { MAX_FOTOS_PRODUCTO, SYSTEM_ROOT_FOLDER_NAMES } from "@/config/business";
import {
  NAV_ITEMS,
  NAV_IMPORTADORA,
  NAV_ASESOR,
  NAV_ADMIN,
  NAV_SOPORTE,
  NAV_DISENO,
  PANTALLAS_DESIGNER,
} from "@/config/navigation";
import type { NavItem } from "@/types/navigation";

// Compatibilidad para las vistas de dominio que todavÃ­a consumen los contratos
// pÃºblicos histÃ³ricos de App.tsx; la implementaciÃ³n vive en sus mÃ³dulos.
export { Sidebar, AppHeader, PantallaPortal, Modal, USER, USER_IMPORTADORA, USER_ASESOR };

/** Pantalla (y por tanto URL) de cada documento legal. */
const PANTALLA_LEGAL: Record<LegalPage, Screen> = {
  data: "policy-data",
  terms: "policy-terms",
  payments: "policy-payments",
  planes: "policy-planes",
};

// ----------------------------------------------------------------------------------------------------
// DATA
// ----------------------------------------------------------------------------------------------------
// ------ Portal data ----------------------------------------------------------------------------------------------------------------------------
// "soporte" es el equipo de atención al cliente de la plataforma: atiende los
// tickets y resuelve incidentes, pero no administra (ni empresas, ni cuentas,
// ni certificaciones, ni copias de seguridad).
// "designer" es el equipo de Diseño: pone portada e imágenes con la identidad de
// Zarpi a lo aprobado en Tendencias y lo publica. Está en el canal del equipo,
// pero no ve soporte ni clientes.

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


/** Lee una clave de `perfil_publico` sin asumir su forma (es JSON libre). */




/**
 * Convierte lo que la empresa escribiÃ³ en Â«Sitio webÂ» en un href navegable.
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

/**
 * Contacto principal de la empresa. Manda lo que la empresa escribiÃ³ en su
 * perfil; si no escribiÃ³ nada, la primera persona real que atiende (antes
 * aparecÃ­a el texto de relleno Â«Asesor asignadoÂ»), y si no hay nadie, la propia
 * empresa.
 */








function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
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

// ----------------------------------------------------------------------------------------------------

// ----------------------------------------------------------------------------------------------------
const IMPORTER_ROUTES: Screen[] = ["imp-dashboard", "imp-profile", "imp-advisors", "imp-quotes", "imp-catalogos"];
const ADVISOR_ROUTES: Screen[] = ["adv-dashboard", "adv-available", "adv-my-quotes"];
const BUYER_ROUTES: Screen[] = ["dashboard", "importer-profile", "quotes", "new-quote", "quote-detail", "responses", "response-detail", "orders", "order-detail", "catalogos"];

// ----------------------------------------------------------------------------------------------------
// ROOT
// ----------------------------------------------------------------------------------------------------
// `Screen` y la correspondencia con las URL viven en `@/app/rutas`.

export default function App() {
  useBrandTheme();
  const storedRole = normalizeStoredRole(getStoredRole() as StoredRole | null);
  const hasStoredSession = Boolean(getStoredToken() && storedRole);

  const { isAuthenticated, isInitializing, appRole, signOut, token, refreshUser } = useAuth();

  // La direcciÃ³n manda al entrar: es lo que hace que un enlace a una cotizaciÃ³n
  // abra esa cotizaciÃ³n, y que recargar no devuelva al inicio. Solo la raÃ­z se
  // resuelve por sesiÃ³n, porque "/" no identifica ninguna pantalla concreta.
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
  /** Identificador que traÃ­a la direcciÃ³n de entrada, si era de ese tipo. */
  const idInicialDe = (param: ParamRuta) => destinoInicial?.param === param ? (destinoInicial.id ?? "") : "";
  const [selectedQuoteId,setSelectedQuoteId]=useState(()=>idInicialDe("quote"));
  const [selectedResponseId,setSelectedResponseId]=useState(()=>idInicialDe("response"));
  const [responseFrom,setResponseFrom]=useState<ResponseFrom>("responses");
  const [responseFromQuoteId,setResponseFromQuoteId]=useState("");
  const [selectedOrderId,setSelectedOrderId]=useState(()=>idInicialDe("order"));
  const [selectedOrderDetail,setSelectedOrderDetail]=useState<Order|null>(null);
  const [selectedTendenciaId,setSelectedTendenciaId]=useState(()=>idInicialDe("tendencia"));
  // Plan elegido en el inicio (Â«InscribirmeÂ»): viaja en la URL como ?plan=.
  const [planElegido,setPlanElegido]=useState(()=>new URLSearchParams(window.location.search).get("plan") ?? "");
  const [isOrderDetailLoading,setIsOrderDetailLoading]=useState(false);
  // QuÃ© orden está en pantalla: si se vuelve a pedir la misma, se refresca sin
  // pasar por Â«Cargando...Â» (eso desmontaba el detalle y se perdÃ­a lo que el
  // usuario estaba haciendo, p. ej. el comprobante de pago reciÃ©n elegido).
  const orderDetailIdRef=useRef<string|null>(null);
  orderDetailIdRef.current=selectedOrderDetail?.id ?? null;
  const [selectedImporterId,setSelectedImporterId]=useState(()=>idInicialDe("importer"));
  const [preselectedImporterId,setPreselectedImporterId]=useState<string|undefined>();
  const [quotePrefill,setQuotePrefill]=useState<Partial<QuoteFormState>|undefined>();
  // Producto de Tendencias o de un catÃ¡logo del que sale la solicitud en curso.
  const [origenSolicitud,setOrigenSolicitud]=useState<OrigenSolicitud|null>(null);
  // Â«Comprar accesoÂ» en Cursos (pago manual): Pagos abre la ventana de ese curso.
  const [cursoAPagar,setCursoAPagar]=useState<string|null>(null);
  // Muro de pago de Tendencias: Pagos abre en la carpeta de la suscripciÃ³n.
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
  // Propuestas de la empresa vistas desde la cuenta dueña: de aquÃ­ sale la
  // bandeja de "esperan tu confirmaciÃ³n".
  const [companyProposalsByQuoteId,setCompanyProposalsByQuoteId]=useState<Record<string, BackendPropuesta>>({});
  const [currentUserProfile,setCurrentUserProfile]=useState<BackendUserProfile|null>(null);
  const [companyProfile,setCompanyProfile]=useState<BackendImporter|null>(null);
  const [requesterResponses,setRequesterResponses]=useState<QuoteResponse[]>([]);
  const [requesterOrders,setRequesterOrders]=useState<Order[]>([]);
  const [importerOrders,setImporterOrders]=useState<Order[]>([]);
  const [chatConversations,setChatConversations]=useState<ChatConv[]>([]);
  // Con quiÃ©n se puede abrir un hilo privado en el canal del equipo.
  const [miembrosEquipo,setMiembrosEquipo]=useState<BackendMiembroEquipo[]>([]);
  // ConversaciÃ³n abierta en pantalla: es la Ãºnica que necesita canal en vivo.
  const [activeChatId,setActiveChatId]=useState<string|null>(null);
  const { config: platformConfig, isLoading: platformConfigLoading, recargar: recargarPlatformConfig } = usePlatformConfig();
  // Lo leen los botones de Â«Crear cuentaÂ» de toda la app (ver app/registro.ts).
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

  // ---- DirecciÃ³n del navegador ------------------------------------------------------------------------------------------------
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
  // Pantalla con la que se escribiÃ³ la Ãºltima vez, para decidir entre apilar una
  // entrada nueva o reemplazarla.
  const ultimaPantallaEscritaRef = useRef<Screen|null>(null);

  useEffect(() => {
    const actual = window.location.pathname.replace(/\/+$/, "") || "/";
    const destino = rutaActual.replace(/\/+$/, "") || "/";
    if (actual === destino) {
      ultimaPantallaEscritaRef.current = screen;
      return;
    }

    // El token de restablecimiento y el cÃ³digo de referido viajan en la query;
    // se conservan mientras se estÃ© en las pantallas que los usan.
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

    // Moverse dentro de la misma pantalla (abrir otra conversaciÃ³n del chat) no
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
    const rows = await domainService.listImporters();
    setMarketplaceImporters(rows.map(mapBackendImporterToUi));
  }, []);

  const reloadRequesterQuotes = useCallback(async () => {
    const rows = await domainService.listQuotes();
    setRequesterQuotes(
      rows
        .map((row: BackendCotizacion) => mapBackendQuoteToUi(row, marketplaceImporters))
        .map((quote) => applyQuoteStatusOverride(quote, quoteStatusOverrides)),
    );
  }, [marketplaceImporters, quoteStatusOverrides]);

  const reloadImporterQuotes = useCallback(async () => {
    const rows = await domainService.listQuotes();
    setImporterQuotes(
      rows
        .map((row: BackendCotizacion) => mapBackendQuoteToUi(row, marketplaceImporters))
        .map((quote) => applyQuoteStatusOverride(quote, quoteStatusOverrides)),
    );

    // Propuestas de esta empresa, para saber cuÃ¡les esperan la confirmaciÃ³n de
    // la cuenta dueña (el cliente ya aceptÃ³ y falta cerrar la orden).
    const companyId = currentUserProfile?.importador_id;
    if (!companyId) {
      setCompanyProposalsByQuoteId({});
      return;
    }
    const proposalRows = await Promise.all(
      rows.map(async (row) => {
        try {
          return await domainService.listQuoteProposals(row.id);
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
    const rows = await domainService.listCompanyAdvisors();
    setCompanyAdvisors(rows.map(mapBackendAdvisorToUi));
  }, [currentUserProfile?.importador_id]);

  const reloadCurrentUserProfile = useCallback(async () => {
    const profile = await domainService.getMyUserProfile();
    setCurrentUserProfile(profile);
    if (profile.importador_id) {
      const importer = await domainService.getImporterById(profile.importador_id);
      setCompanyProfile(importer);
    } else {
      setCompanyProfile(null);
    }
  }, []);

  const reloadRequesterResponses = useCallback(async () => {
    const quotes = await domainService.listQuotes();
    const proposalsByQuote = await Promise.all(
      quotes.map(async (quote) => {
        try {
          return await domainService.listQuoteProposals(quote.id);
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
      domainService.listOrders(),
      domainService.listQuotes(),
    ]);
    const quoteMap = new Map(quotes.map((q) => [q.id, mapBackendQuoteToUi(q, marketplaceImporters)]));
    setRequesterOrders(orders.map((order) => mapBackendOrderToUiOrder(order, quoteMap.get(order.cotizacion_id))));
  }, [marketplaceImporters]);

  const reloadImporterOrders = useCallback(async () => {
    const [orders, quotes] = await Promise.all([
      domainService.listOrders(),
      domainService.listQuotes(),
    ]);
    const quoteMap = new Map(quotes.map((q) => [q.id, mapBackendQuoteToUi(q, marketplaceImporters)]));
    setImporterOrders(orders.map((order) => mapBackendOrderToUiOrder(order, quoteMap.get(order.cotizacion_id))));
  }, [marketplaceImporters]);

  // Las empresas se leen de una ref: si `loadOrderDetail` dependiera de la
  // lista, cada auto-refresco (que la vuelve a pedir, p. ej. al cerrar el
  // selector de archivos y recuperar el foco) recreaba la funciÃ³n y el efecto
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
        domainService.getOrderById(orderId),
        domainService.listQuotes().catch(() => [] as BackendCotizacion[]),
      ]);
      const quoteMap = new Map(quotes.map((quote) => [quote.id, mapBackendQuoteToUi(quote, marketplaceImportersRef.current)]));
      setSelectedOrderDetail(mapBackendOrderToUiOrder(orderRow, quoteMap.get(orderRow.cotizacion_id)));
    } finally {
      if (!silencioso) setIsOrderDetailLoading(false);
    }
  }, []);

  const reloadChatData = useCallback(async () => {
    const [rows, quotes] = await Promise.all([
      domainService.listChatConversations(),
      domainService.listQuotes().catch(() => [] as BackendCotizacion[]),
    ]);
    const importerByQuoteId = new Map(quotes.map((quote) => [quote.id, quote.importador_id]));
    const cotizanteTierByQuoteId = new Map(quotes.map((quote) => [quote.id, quote.solicitante_tier || "Bronze"]));
    const importerById = new Map(marketplaceImporters.map((importer) => [importer.id, importer]));
    const mappedConversations: ChatConv[] = rows.map((row) => {
      // Ni el hilo interno, ni el ticket de soporte, ni el canal del equipo de
      // la plataforma cuelgan de una cotizaciÃ³n.
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
        // estaba escrito a cero y el filtro de no leÃ­das no filtraba nada.
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
        const messages = await domainService.listChatMessages(conversation.id);
        const mappedMessages: ChatMsg[] = messages.map((message) => mapBackendChatMessage(message, currentUserProfile?.id));
        return [conversation.id, mappedMessages] as const;
      }),
    );
    setChatMessagesByConversation(Object.fromEntries(messagePairs));

    const attachmentPairs = await Promise.all(
      mappedConversations.map(async (conversation) => {
        try {
          const attachments = await domainService.listChatAttachments(conversation.id);
          return [conversation.id, attachments] as const;
        } catch {
          return [conversation.id, [] as BackendChatAttachmentItem[]] as const;
        }
      }),
    );
    setChatAttachmentsByConversation(Object.fromEntries(attachmentPairs));
  }, [currentUserProfile?.id, marketplaceImporters]);

  const ensureSystemRootFolders = useCallback(async () => {
    let rootExplorer = await domainService.listDocumentExplorer(null);
    const backendProtectedRoots = rootExplorer.carpetas.filter((folder) => folder.is_protected || folder.is_system);
    const existingRootNames = new Set(rootExplorer.carpetas.map((folder) => normalizeFolderName(folder.nombre)));
    const missingRootNames = backendProtectedRoots.length > 0
      ? []
      : SYSTEM_ROOT_FOLDER_NAMES.filter((name) => !existingRootNames.has(normalizeFolderName(name)));

    if (missingRootNames.length > 0) {
      await Promise.all(
        missingRootNames.map(async (name) => {
          try {
            await domainService.createDocumentFolder({ nombre: name, parent_id: null });
          } catch {
            // Folder may be created concurrently by another session.
          }
        }),
      );
      rootExplorer = await domainService.listDocumentExplorer(null);
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
        : await domainService.listDocumentExplorer(resolvedParent);
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
    const rows = await domainService.listMyAssignedQuotes();
    const detailedRows = await Promise.all(
      rows.map(async (row) => {
        try {
          return await domainService.getQuoteById(row.id);
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
    const rows = await domainService.listAdvisorAvailableQuotes();
    setAvailableQuotes(
      rows
        .map((row) => mapBackendQuoteToUi(row, marketplaceImporters))
        .map((quote) => applyQuoteStatusOverride(quote, quoteStatusOverrides)),
    );
  }, [marketplaceImporters, quoteStatusOverrides, currentUserProfile?.importador_id]);

  /**
   * Ãndice "cotizaciÃ³n Ã¢â€ â€™ propuesta de mi empresa" (incluye borradores).
   *
   * Lo usa tanto el asesor como la cuenta dueña: sin Ã©l, la empresa no sabÃ­a
   * que un asesor ya habÃ­a redactado un borrador, pulsaba "Responder" y el
   * backend la rechazaba con un 400. Por eso se recorren tambiÃ©n las
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
          return await domainService.listQuoteProposals(quoteId);
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
      const response = await domainService.listNotifications();
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
   * `useAutoRefresh` al volver a la pestaÃ±a y cada pocos segundos, para que la
   * pantalla deje de depender de un F5 manual.
   */
  const refreshAllData = useCallback(async (reason: AutoRefreshReason = "focus") => {
    const tareas: Array<Promise<unknown>> = [
      reloadImporters(),
      reloadCurrentUserProfile(),
      reloadNotifications(),
    ];

    // El chat cuesta 2 peticiones por conversaciÃ³n, así­ que en el tick periÃ³dico
    // se omite: la conversaciÃ³n abierta ya llega en vivo por WebSocket y el
    // resto se refresca al volver a la pestaÃ±a.
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

  // Mensajes en vivo de la conversaciÃ³n abierta: el backend ya publicaba en
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
  /** Â«Solicitar accesoÂ» fuera de la landing: lleva a la secciÃ³n Planes del inicio (/#planes). */
  function irAPlanesDelInicio(){goTo("landing");window.setTimeout(()=>{window.location.hash="planes";},0);}

  /** Â«Nueva propuestaÂ» desde el chat: abre el formulario de esa cotizaciÃ³n. */
  function openProposalForm(quoteId:string){
    setSelectedQuoteId(quoteId);
    goTo("create-response");
  }

  function handleNav(key:string){
    // La clave de cada entrada del menÃº ES el nombre de la pantalla, así­ que se
    // valida contra la tabla de rutas. Antes habÃ­a aquÃ­ una segunda lista
    // escrita a mano y cualquier entrada nueva del sidebar nacÃ­a muerta: el
    // botÃ³n existÃ­a pero no navegaba a ninguna parte.
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
    // Con el mÃ³dulo educativo apagado en el backend, "Cursos" desaparece del
    // menÃº: dejarlo visible llevarÃ­a a una pantalla cuya API responde 404.
    let items = moduloEducativoHabilitado ? base : base.filter(item=>item.key!=="courses"&&item.key!=="admin-cursos"&&item.key!=="admin-cursos-accesos");
    // El curador de Tendencias es una capacidad, no un rol: se le suma la
    // entrada del panel a su menÃº, sea soporte, asesor o cualquier otro.
    if(currentUserProfile?.es_curador&&!items.some(item=>item.key==="tendencias-aprobacion")){
      items=[...items,{icon:Sparkles,label:"Aprobación",key:"tendencias-aprobacion"}];
    }
    return items as NavItem[];
  }

  function handleProfileClick(){
    // El perfil personal es para todos; la empresa importadora llega desde ahÃ­
    // (o desde Â«Mi empresaÂ» en el menÃº) a los datos de su empresa.
    goTo("user-profile");
  }

  function handleHelpClick(){
    if(userRole==="admin"){
      return;
    }
    goTo("help-support");
  }

  /**
   * Abre (o reutiliza) la sala comÃºn del equipo y lleva a SU pantalla.
   *
   * Es la vÃ­a que sustituye al ticket para administraciÃ³n y soporte: el ticket
   * es el canal de los usuarios CON la plataforma, y un agente atendiÃ©ndose a
   * sÃ­ mismo no significa nada.
   *
   * Tiene pantalla propia (`/equipo`) y no la bandeja de `/chats`: ahÃ­ están
   * los tickets de clientes y empresas, y mezclar las dos cosas es justo lo que
   * no debe pasar en un canal interno.
   */
  const actionOptions = {
    userRole, currentUserProfile, chatConversations, companyAdvisors, selectedOrderId,
    setInitialChatConvId, setSoporteAbierto, openChat, goTo, setChatMessagesByConversation,
    setActiveChatId, markConversationRead: (conversationId: string) => {
      setChatConversations((previous) => previous.some((conversation) => conversation.id === conversationId && conversation.unread > 0)
        ? previous.map((conversation) => conversation.id === conversationId ? { ...conversation, unread: 0 } : conversation) : previous);
    },
    setMiembrosEquipo, reloadChatData, reloadAdvisorAvailableQuotes, reloadAdvisorAssignedQuotes,
    reloadRequesterQuotes, reloadRequesterResponses, reloadRequesterOrders, reloadImporterQuotes,
    reloadImporterOrders, reloadCompanyAdvisors, reloadCurrentUserProfile, reloadImporters,
    loadOrderDetail, reloadDocumentExplorer, documentCurrentFolderRef, refreshUser,
  };
  const supportActions = useSupportActions(actionOptions);
  const chatActions = useChatActions(actionOptions);
  const quoteActions = useQuoteActions(actionOptions);
  const advisorActions = useAdvisorActions(actionOptions);
  const orderActions = useOrderActions(actionOptions);
  const documentActions = useDocumentActions(actionOptions);
  const {
    abrirCanalEquipo, abrirHiloEquipo, handleCloseTicket, handleReopenTicket, handleEscalateTicket,
    handleRateTicket, handleOpenSupportTicket,
  } = supportActions;
  const {
    handleActiveConversationChange, openInternalChat, handleSendChatMessage,
    handleShareLocalAttachment, handleShareExistingResource,
  } = chatActions;
  const { handleCreateQuote } = quoteActions;
  const {
    claimQuote, handleCreateAdvisor, handleSetAdvisorActive, handleSaveCompanyProfile,
    handleTransferConversation, handleAssignAdvisorToQuote, handleConfirmProposalAsCompany,
  } = advisorActions;
  const { handleUpdateOrderStatus, handleAttachOrderDocument } = orderActions;
  const {
    handleCreateDocumentFolder, handleRegisterLocalDocument, handleMoveDocumentFile,
    handleMoveDocumentFolder, handleRenameDocumentFile, handleRenameDocumentFolder,
    handleDeleteDocumentFile, handleDeleteDocumentFolder, handleSearchDocuments,
  } = documentActions;

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
    // El equipo de la plataforma no se pide soporte a sÃ­ mismo: el ticket es el
    // canal de los usuarios con la plataforma. Antes el botÃ³n seguÃ­a saliendo
    // para soporte, y al pulsarlo el backend respondÃ­a 403.
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
  const conversacionesDelEquipo = chatConversations.filter((c)=>c.type==="equipo");
  const conversacionesDeChats = chatConversations.filter((c)=>c.type!=="equipo");

  function openChat(convId:string){setInitialChatConvId(convId);goTo("chats");}

  /**
   * ConversaciÃ³n abierta en pantalla. Abrirla es leerla: se marca en el backend
   * y se pone el contador a cero aquÃ­ mismo para que el badge no siga en rojo
   * hasta la siguiente recarga.
   */
  /**
   * Abre el canal interno con un asesor y lleva al chat ya posicionado en Ã©l.
   * El backend reutiliza el hilo si ya existÃ­a, así­ que llamarlo varias veces
   * no crea conversaciones nuevas.
   */
  function openNewQuote(importerId?:string){setQuotePrefill(undefined);setOrigenSolicitud(null);setPreselectedImporterId(importerId);goTo("new-quote");}

  /**
   * Â«Pedir propuestasÂ» desde Tendencias o desde el catÃ¡logo de una empresa:
   * abre el asistente de solicitud con el producto ya cargado. Desde un
   * catÃ¡logo la solicitud va dirigida a la empresa dueña.
   */
  function pedirPropuestasDesde(p:PrefillSolicitud){
    if(!isAuthenticated){
      // Se guarda el producto y se retoma al iniciar sesiÃ³n (efecto de abajo).
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

  // Al iniciar sesiÃ³n como comprador, retoma el Â«Pedir propuestasÂ» que quedÃ³
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
   * Duplicar una cotizaciÃ³n: se abre el formulario con sus datos copiados.
   * No hay endpoint de duplicado en el backend ni hace falta ? lo que se
   * envÃ­a despuÃ©s es una cotizaciÃ³n nueva y corriente.
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
    void domainService.markNotificationAsRead(id).catch(() => undefined);
  }
  async function openNotification(notification: AppNotification){
    if (notification.destino) {
      goTo(notification.destino);
      return;
    }
    if (!notification.cotizacionId && !notification.conversationId) return;
    const conversations = await domainService.listChatConversations().catch(() => []);
    const conversation = notification.conversationId
      ? conversations.find((item) => item.id === notification.conversationId)
      : conversations.find((item) => item.cotizacion_id === notification.cotizacionId);
    if (conversation) {
      openChat(conversation.id);
      return;
    }
    goTo("chats");
  }
  function handleLogin(role:UserRole|"admin"){
    setUserRole(role);
    // Si hay un producto de Tendencias por retomar, el efecto de arriba lleva al
    // formulario: no se pisa esa navegaciÃ³n con la pantalla de inicio. SegÃºn el
    // orden de los renders, el efecto corre antes (marca prefillRetomado hace un
    // instante) o despuÃ©s (el producto sigue guardado).
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

  async function refrescarSaldoYTier(){
    await Promise.allSettled([reloadCurrentUserProfile(), refreshUser()]);
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
    // Perfil personal: cualquier cuenta con sesiÃ³n.
    "user-profile": ["solicitante", "asesor", "importadora", "admin", "soporte", "designer"],
    "help-support": ["solicitante", "importadora", "asesor"],
    "notifications": ["solicitante", "importadora", "asesor", "admin", "soporte", "designer"],
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
    // empresa que escribiera /equipo veÃ­a el armazÃ³n de la pantalla (tÃ­tulo y
    // selector), aunque vacÃ­o y con el backend negÃ¡ndole los datos.
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

  // Si alguien llega a "courses" con el mÃ³dulo apagado (enlace guardado, botÃ³n
  // atrÃ¡s), se le devuelve a su inicio en vez de dejarlo en una pantalla muerta.
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
  // Â«AvÃ­same cuando abraÂ» (secciÃ³n Planes): lista de espera de la apertura al pÃºblico.
  if(screen==="lista-espera")return <ListaEsperaApertura
    onVolver={()=>goTo(isAuthenticated?getHomeScreenForRole(userRole):"landing")}
    onPoliticaDatos={()=>goTo("policy-data")}
    prefill={isAuthenticated&&currentUserProfile?{email:currentUserProfile.email,nombre:currentUserProfile.nombre??undefined,telefono:currentUserProfile.telefono??undefined}:undefined}
  />;
  // InscripciÃ³n a un plan: pÃºblica; con sesiÃ³n de comprador se precargan sus datos.
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
  // Pasar de un documento legal a otro no toca `prevScreen`, para que Â«VolverÂ»
  // regrese a donde estaba el usuario antes de abrir el primero.
  const legalPage=(Object.keys(PANTALLA_LEGAL) as LegalPage[]).find(page=>PANTALLA_LEGAL[page]===screen);
  if(legalPage)return <LegalPolicyScreen page={legalPage} onBack={()=>goTo(prevScreen)} onOpen={page=>setScreen(PANTALLA_LEGAL[page])}/>;
  if(screen==="login")return <LoginScreen onLogin={handleLogin} onRegister={()=>goTo("register")} onLanding={()=>goTo("landing")} onPolicy={page=>goTo(PANTALLA_LEGAL[page])} initialEmail={loginPrefillEmail}/>;

  const renderPrivateScreen = () => {
    if (IMPORTER_ROUTES.includes(screen)) return <ImporterPortalProvider value={{ quotes: importerQuotes, advisors: companyAdvisors, chats: chatConversations, companyProfile, companyName: companyProfile?.nombre_empresa || "", userRole, onSave: handleSaveCompanyProfile, onCreateAdvisor: handleCreateAdvisor, onSetAdvisorActive: handleSetAdvisorActive, openInternalChat, onRespond: id => { setSelectedQuoteId(id); goTo("create-response"); }, openChat, onAssignAdvisor: handleAssignAdvisorToQuote, proposalsByQuoteId: companyProposalsByQuoteId, onConfirmProposal: handleConfirmProposalAsCompany, onRechazada: refreshQuoteLists }}><ImporterRouter screen={screen} sb={sb} /></ImporterPortalProvider>;
    if (ADVISOR_ROUTES.includes(screen)) return <AdvisorPortalProvider value={{ available: visibleAvailableQuotes, quotes: advisorAssignedQuotes, headerUser: advisorHeaderUser, proposals: advisorProposalsByQuoteId, chats: chatConversations, availableCount: visibleAvailableQuotes.length, activeChatsCount: activeChatCount, onClaim: claimQuote, refresh: refreshQuoteLists, onRespond: id => { setSelectedQuoteId(id); goTo("create-response"); }, openChat, onOpenInternalChat: () => openInternalChat(), onRechazada: refreshQuoteLists }}><AdvisorRouter screen={screen} sb={sb} /></AdvisorPortalProvider>;
    if (isAdminScreen(screen)) return <AdminRouter screen={screen} sb={sb} onRefreshGlobal={refreshQuoteLists} />;
    if (screen === "help-support" && (userRole === "solicitante" || userRole === "importadora" || userRole === "asesor")) {
      return <HelpSupportScreen sb={sb} role={userRole} onPedirSoporte={() => setSoporteAbierto(true)} />;
    }
    if (screen === "notifications") {
      return <NotificationsScreen notifications={notifications} onMark={markNotif} onOpen={openNotification} onBack={() => goTo(getHomeScreenForRole(userRole))} sb={sb} />;
    }
    if (screen === "courses" && (userRole === "solicitante" || userRole === "importadora")) {
      const headerUser = userRole === "importadora" ? importerHeaderUser : USER;
      return (
        <CoursesPortalScreen
          sb={sb}
          role={userRole}
          headerUser={headerUser}
          companyName={userRole === "importadora" ? (companyProfile?.nombre_empresa || USER_IMPORTADORA.company) : USER.company}
          onGoDashboard={() => goTo(getHomeScreenForRole(userRole))}
          onComprarAcceso={(courseId) => {
            setCursoAPagar(courseId);
            goTo("pagos");
          }}
          SidebarComponent={Sidebar}
          HeaderComponent={AppHeader}
        />
      );
    }
    if (BUYER_ROUTES.includes(screen)) return <BuyerPortalProvider value={{ importers: marketplaceImporters, quotes: requesterQuotes, responses: requesterResponses, orders: userRole === "importadora" || userRole === "asesor" ? importerOrders : requesterOrders, chats: chatConversations, selectedImporterId, selectedQuoteId, selectedResponseId, selectedOrder: selectedOrderDetail, isOrderDetailLoading, responseFrom, responseFromQuoteId, currentUserProfile, platformConfig, preselectedImporterId, quotePrefill, origenSolicitud, userRole, onGo: goTo, onViewProfile: id => { setSelectedImporterId(id); goTo("importer-profile"); }, onCreateQuote: openNewQuote, openNewQuote, onSubmitQuote: handleCreateQuote, openChat, refreshQuoteLists, refrescarSaldoYTier, duplicateQuote, openResponse, onSelectQuote: id => setSelectedQuoteId(id), onSelectOrder: id => { setSelectedOrderDetail(null); setSelectedOrderId(id); }, advisorName: selectedOrderDetail ? chatConversations.find(conversation => conversation.refId === selectedOrderDetail.id)?.counterpartName : undefined, onUpdateOrderStatus: handleUpdateOrderStatus, pedirPropuestasDesde, abrirTendencia, irAPagos: () => goTo("pagos"), irAPlanesDelInicio }}><BuyerRouter screen={screen} sb={sb} /></BuyerPortalProvider>;    if(screen==="tendencias")return <PantallaPortal sb={sb} active="tendencias" titulo="Tendencias"><TendenciasFeed rol={rolPortal} onAbrir={abrirTendencia} onPedirPropuestas={pedirPropuestasDesde} onEnviarEnlace={()=>goTo("tendencias-enviar")} onIrAPagos={pagarSuscripcionTendencias}/></PantallaPortal>;
    if(screen==="tendencia-detalle")return <PantallaPortal sb={sb} active="tendencias" titulo="Tendencias"><TendenciaFicha id={selectedTendenciaId} rol={rolPortal} onVolver={()=>goTo("tendencias")} onPedirPropuestas={pedirPropuestasDesde} onIrAPagos={pagarSuscripcionTendencias}/></PantallaPortal>;
    if(screen==="tendencias-enviar")return <PantallaPortal sb={sb} active="tendencias" titulo="Subir un producto viral"><EnviarEnlace rol={rolPortal ?? "solicitante"}/></PantallaPortal>;
    if(screen==="reto")return <PantallaPortal sb={sb} active="reto" titulo="Reto"><RetoPagina autenticado onIrARegistro={()=>goTo("register")} onEnviarEnlace={()=>goTo("tendencias-enviar")}/></PantallaPortal>;
    if(screen==="admin-reto")return <PantallaPortal sb={sb} active="admin-reto" titulo="Reto Â· Rondas y pagos"><RetoAdmin/></PantallaPortal>;
    if(screen==="admin-tipografia")return <PantallaPortal sb={sb} active="admin-tipografia" titulo="Tipografía"><TipografiaPlataforma/></PantallaPortal>;
    if(screen==="admin-pagos")return <PantallaPortal sb={sb} active="admin-pagos" titulo="Pagos"><RevisionPagos/></PantallaPortal>;
    // Cursos propios de Zarpi: el mismo tablero y editor que usan las importadoras.
    if(screen==="admin-cursos")return <CoursesPortalScreen sb={sb} active="admin-cursos" role="importadora" headerUser={USER} companyName="Zarpi" cursosDeZarpi onGoDashboard={()=>goTo("admin-dashboard")} SidebarComponent={Sidebar} HeaderComponent={AppHeader}/>;
    if(screen==="admin-planes")return <PantallaPortal sb={sb} active="admin-planes" titulo="Planes"><PlanesAdmin/></PantallaPortal>;
    if(screen==="admin-presentaciones")return <PantallaPortal sb={sb} active="admin-presentaciones" titulo="Presentaciones de empresas"><RevisionPresentaciones/></PantallaPortal>;
    if(screen==="admin-cursos-accesos")return <PantallaPortal sb={sb} active="admin-cursos-accesos" titulo="Accesos a cursos"><AccesosCursos/></PantallaPortal>;
    if(screen==="admin-modulos")return <PantallaPortal sb={sb} active="admin-modulos" titulo="MÃ³dulos"><ModulosPlataforma onCambio={recargarPlatformConfig}/></PantallaPortal>;
    if(screen==="diseno")return <PantallaPortal sb={sb} active="diseno" titulo="Diseño"><PanelDiseno/></PantallaPortal>;
    if(screen==="tendencias-aprobacion"){
      if(userRole!=="admin"&&!currentUserProfile?.es_curador)return unauthorizedFallback;
      return <PantallaPortal sb={sb} active="tendencias-aprobacion" titulo="Tendencias Â· Aprobación"><PanelAprobacion esAdmin={userRole==="admin"}/></PantallaPortal>;
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
          // Solo aparece para el cotizante: el componente se oculta si el backend no le devuelve cÃ³digo.
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
          cualquiera de ellas sin perder dÃ³nde estabas. */}
      <SoporteModal
        open={soporteAbierto}
        onClose={()=>setSoporteAbierto(false)}
        onSubmit={handleOpenSupportTicket}
      />
    </ProtectedRoute>
  );
}
