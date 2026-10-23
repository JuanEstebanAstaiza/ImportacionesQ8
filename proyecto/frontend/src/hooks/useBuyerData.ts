import { useCallback, useRef, useState } from "react";
import type { Quote } from "@/types/quote";
import type { QuoteResponse } from "@/types/response";
import type { Order } from "@/types/order";
import { businessService, type BackendCotizacion, type BackendImporter } from "@/services/business.service";
import { mapBackendQuoteToUi } from "@/features/quotes/mappers";
import { mapBackendOrderToUiOrder } from "@/features/ordenes/mappers";
import { mapBackendProposalToUiResponse } from "@/features/propuestas/mappers";
import type { Importer } from "@/types/importer";
import type { BackendUserProfile } from "@/services/business.service";

/** State owned by the buyer portal (quotes, responses, orders and profile). */
export function useBuyerData(importers: Importer[] = [], overrides: Record<string, Quote["status"]> = {}, onCompanyProfile?: (profile: BackendImporter | null) => void) {
  const [requesterQuotes, setRequesterQuotes] = useState<Quote[]>([]);
  const [requesterResponses, setRequesterResponses] = useState<QuoteResponse[]>([]);
  const [requesterOrders, setRequesterOrders] = useState<Order[]>([]);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);
  const [isOrderDetailLoading, setIsOrderDetailLoading] = useState(false);
  const orderDetailIdRef = useRef<string | null>(null);
  orderDetailIdRef.current = selectedOrderDetail?.id ?? null;
  const [currentUserProfile, setCurrentUserProfile] = useState<BackendUserProfile | null>(null);
  const importersRef = useRef(importers);
  importersRef.current = importers;

  const reloadCurrentUserProfile = useCallback(async () => {
    const profile = await businessService.getMyUserProfile();
    setCurrentUserProfile(profile);
    onCompanyProfile?.(profile.importador_id ? await businessService.getImporterById(profile.importador_id) : null);
  }, []);
  const reloadRequesterQuotes = useCallback(async () => {
    const rows = await businessService.listQuotes();
    setRequesterQuotes(rows.map((row) => {
      const quote = mapBackendQuoteToUi(row, importersRef.current);
      return overrides[quote.id] ? { ...quote, status: overrides[quote.id] } : quote;
    }));
  }, [overrides]);
  const reloadRequesterResponses = useCallback(async () => {
    const quotes = await businessService.listQuotes();
    const proposals = await Promise.all(quotes.map(async (quote) => {
      try { return await businessService.listQuoteProposals(quote.id); } catch { return []; }
    }));
    setRequesterResponses(proposals.flat().map(mapBackendProposalToUiResponse));
  }, []);
  const reloadRequesterOrders = useCallback(async () => {
    const [orders, quotes] = await Promise.all([businessService.listOrders(), businessService.listQuotes()]);
    const quoteMap = new Map(quotes.map((quote) => [quote.id, mapBackendQuoteToUi(quote, importersRef.current)]));
    setRequesterOrders(orders.map((order) => mapBackendOrderToUiOrder(order, quoteMap.get(order.cotizacion_id))));
  }, []);
  const loadOrderDetail = useCallback(async (orderId: string) => {
    if (!orderId) { setSelectedOrderDetail(null); return; }
    const silent = orderDetailIdRef.current === orderId;
    if (!silent) setIsOrderDetailLoading(true);
    try {
      const [order, quotes] = await Promise.all([
        businessService.getOrderById(orderId),
        businessService.listQuotes().catch(() => [] as BackendCotizacion[]),
      ]);
      const quoteMap = new Map(quotes.map((quote) => [quote.id, mapBackendQuoteToUi(quote, importersRef.current)]));
      setSelectedOrderDetail(mapBackendOrderToUiOrder(order, quoteMap.get(order.cotizacion_id)));
    } finally {
      if (!silent) setIsOrderDetailLoading(false);
    }
  }, []);

  return {
    requesterQuotes,
    setRequesterQuotes,
    requesterResponses,
    setRequesterResponses,
    requesterOrders,
    setRequesterOrders,
    selectedOrderDetail,
    setSelectedOrderDetail,
    isOrderDetailLoading,
    setIsOrderDetailLoading,
    orderDetailIdRef,
    currentUserProfile,
    setCurrentUserProfile,
    reloadCurrentUserProfile,
    reloadRequesterQuotes,
    reloadRequesterResponses,
    reloadRequesterOrders,
    loadOrderDetail,
  };
}
