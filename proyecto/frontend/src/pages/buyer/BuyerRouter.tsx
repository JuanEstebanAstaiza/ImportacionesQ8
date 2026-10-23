import type { ReactNode } from "react";
import type { Screen } from "@/app/rutas";
import type { SidebarCtrl } from "@/types/portal";
import { DashboardScreen } from "./BuyerDashboard";
import { ImporterProfileScreen } from "@/features/importador/components/ImporterProfileScreen";
import { QuotesScreen } from "@/features/buyer/components/tabs/QuotesScreen";
import { QuoteDetailScreen } from "@/features/buyer/components/tabs/QuoteDetailScreen";
import { ResponseDetailScreen } from "@/features/buyer/components/tabs/ResponseDetailScreen";
import { ResponsesScreen } from "@/features/buyer/components/tabs/ResponsesScreen";
import { OrdersScreen } from "@/features/buyer/components/tabs/OrdersScreen";
import { OrderDetailScreen } from "@/features/buyer/components/tabs/OrderDetailScreen";
import { NewQuoteScreen, type QuoteFormState, type OrigenSolicitud } from "@/features/buyer/components/tabs/NewQuoteScreen";
import { PantallaPortal } from "@/components/layout/PantallaPortal";
import { CatalogosComprador } from "@/features/catalogos/CatalogosComprador";
import { useBuyerPortal } from "@/app/contexts/BuyerPortalContext";

export type BuyerRouterProps = {
  screen: Screen; sb: SidebarCtrl; importers: any[]; quotes: any[]; responses: any[]; orders: any[];
  chats: any[]; selectedImporterId: string; selectedQuoteId: string; selectedResponseId: string;
  selectedOrder: any; isOrderDetailLoading: boolean; responseFrom: any; responseFromQuoteId: string;
  currentUserProfile: any; platformConfig: any; preselectedImporterId?: string; quotePrefill?: Partial<QuoteFormState>;
  origenSolicitud: OrigenSolicitud | null; userRole: any; onGo: (screen: Screen) => void;
  onViewProfile: (id: string) => void; onCreateQuote: (id: string) => void; openNewQuote: (id?: string) => void;
  onSubmitQuote: (...args: any[]) => any; openChat: (...args: any[]) => any; refreshQuoteLists: () => Promise<void>;
  refrescarSaldoYTier: () => Promise<void>; duplicateQuote: (...args: any[]) => any; openResponse: (...args: any[]) => any;
  onUpdateOrderStatus: (...args: any[]) => any; pedirPropuestasDesde: (...args: any[]) => any;
  abrirTendencia: (...args: any[]) => any; irAPagos: () => void; irAPlanesDelInicio: () => void;
  onSelectQuote: (id: string) => void; onSelectOrder: (id: string) => void;
  advisorName?: string;
};

/** Composición y enrutamiento de las pantallas del portal comprador. */
export function BuyerRouter({ screen, sb }: Pick<BuyerRouterProps, "screen" | "sb">) {
  const portal = useBuyerPortal();
  const p = { ...portal, screen, sb };
  const orders = p.userRole === "importadora" || p.userRole === "asesor" ? p.orders : p.orders;
  const views: Record<string, ReactNode> = {
    "importer-profile": <ImporterProfileScreen importerId={p.selectedImporterId} importers={p.importers} quotes={p.quotes} chats={p.chats} orders={p.orders} onBack={() => p.onGo("dashboard")} onCreateQuote={p.openNewQuote} onOpenChat={p.openChat} sb={p.sb} onAbrirTendencia={p.abrirTendencia} />,
    quotes: <QuotesScreen quotes={p.quotes} responses={p.responses} creditos={Number(p.currentUserProfile?.puntos_cotizacion ?? 0)} onNewQuote={() => p.openNewQuote()} onViewDetail={id => { p.onSelectQuote(id); p.onGo("quote-detail"); }} onRefreshQuotes={async () => { await p.refreshQuoteLists(); await p.refrescarSaldoYTier(); }} sb={p.sb} />,
    "new-quote": <NewQuoteScreen key={p.origenSolicitud?.tendenciaItemId || p.origenSolicitud?.catalogoProductoId || (p.quotePrefill ? "duplicada" : "nueva")} onBack={() => p.onGo(p.origenSolicitud ? (p.origenSolicitud.origen === "tendencias" ? "tendencias" : "catalogos") : "quotes")} sb={p.sb} preselectedImporterId={p.preselectedImporterId} importers={p.importers} cotizanteTier={p.currentUserProfile?.tier || "Bronze"} creditos={Number(p.currentUserProfile?.puntos_cotizacion ?? 0)} onSubmitQuote={p.onSubmitQuote} prefill={p.quotePrefill} origen={p.origenSolicitud} cobroTokens={p.platformConfig.cobro_cotizaciones && p.userRole === "solicitante"} cotizacionesGratis={Number(p.currentUserProfile?.cotizaciones_gratis ?? 0)} solicitudesPlan={Number(p.currentUserProfile?.solicitudes_plan_vigentes ?? 0)} sinPlan={p.platformConfig.solo_con_plan && p.userRole === "solicitante" && p.currentUserProfile !== null && !p.currentUserProfile.plan_vigente} permiteAbierta={p.platformConfig.cotizaciones_abiertas} onIrAPagos={p.irAPagos} onVerPlanes={p.irAPlanesDelInicio} />,
    "quote-detail": <QuoteDetailScreen quoteId={p.selectedQuoteId} quotes={p.quotes} chats={p.chats} orders={p.orders} onBack={() => p.onGo("quotes")} onOpenChat={p.openChat} sb={p.sb} onRefreshQuotes={p.refreshQuoteLists} onDuplicate={p.duplicateQuote} userRole={p.userRole} />,
    responses: <ResponsesScreen onViewDetail={p.openResponse} sb={p.sb} responses={p.responses} importers={p.importers} quotes={p.quotes} onViewQuote={id => { p.onSelectQuote(id); p.onGo("quote-detail"); }} />,
    "response-detail": <ResponseDetailScreen responseId={p.selectedResponseId} from={p.responseFrom} fromQuoteId={p.responseFromQuoteId} onBack={() => p.onGo("responses")} onBackToQuote={id => { p.onSelectQuote(id); p.onGo("quote-detail"); }} onOpenChat={p.openChat} sb={p.sb} responses={p.responses} quotes={p.quotes} chats={p.chats} importers={p.importers} orders={p.orders} onRefreshData={p.refreshQuoteLists} />,
    orders: <OrdersScreen onViewOrder={id => { p.onSelectOrder(id); p.onGo("order-detail"); }} sb={p.sb} orders={orders} importers={p.importers} />,
    "order-detail": <OrderDetailScreen order={p.selectedOrder} isLoading={p.isOrderDetailLoading} onBack={() => p.onGo("orders")} onOpenChat={p.openChat} sb={p.sb} importers={p.importers} advisorName={p.advisorName} onViewImporterProfile={p.onViewProfile} canManageOrder={false} esCliente onUpdateOrderStatus={p.onUpdateOrderStatus} />,
    catalogos: <PantallaPortal sb={p.sb} active="catalogos" titulo="Catálogos"><CatalogosComprador onPedirPropuesta={p.pedirPropuestasDesde} /></PantallaPortal>,
  };
  return <DashboardScreen screen={p.screen} sb={p.sb} onViewProfile={p.onViewProfile} onCreateQuote={p.openNewQuote} views={views} />;
}
