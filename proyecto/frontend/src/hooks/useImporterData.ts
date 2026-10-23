import { useCallback, useState } from "react";
import type { Importer } from "@/types/importer";
import type { CompanyAdvisor } from "@/types/portal";
import type { Quote } from "@/types/quote";
import type { Order } from "@/types/order";
import type { BackendImporter, BackendPropuesta } from "@/services/business.service";
import { businessService } from "@/services/business.service";
import { mapBackendImporterToUi } from "@/features/importador/mappers";
import { mapBackendQuoteToUi } from "@/features/quotes/mappers";
import { mapBackendOrderToUiOrder } from "@/features/ordenes/mappers";
import { mapBackendAdvisorToUi } from "@/features/advisors/mappers";

const HIDDEN_QUOTES_KEY = "advisor_hidden_open_quotes_by_company";
const QUOTE_OVERRIDES_KEY = "quote_status_overrides";

function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

/** State owned by the importer/company portal. */
export function useImporterData() {
  const [marketplaceImporters, setMarketplaceImporters] = useState<Importer[]>([]);
  const [importerQuotes, setImporterQuotes] = useState<Quote[]>([]);
  const [companyAdvisors, setCompanyAdvisors] = useState<CompanyAdvisor[]>([]);
  const [importerOrders, setImporterOrders] = useState<Order[]>([]);
  const [companyProfile, setCompanyProfile] = useState<BackendImporter | null>(null);
  const [companyProposalsByQuoteId, setCompanyProposalsByQuoteId] = useState<Record<string, BackendPropuesta>>({});
  const [hiddenOpenQuotesByCompany, setHiddenOpenQuotesByCompany] = useState<Record<string, string[]>>(
    () => readStorage(HIDDEN_QUOTES_KEY, {}),
  );
  const [quoteStatusOverrides, setQuoteStatusOverrides] = useState<Record<string, Quote["status"]>>(
    () => readStorage(QUOTE_OVERRIDES_KEY, {}),
  );
  const reloadImporters = useCallback(async () => {
    const rows = await businessService.listImporters();
    setMarketplaceImporters(rows.map(mapBackendImporterToUi));
  }, []);
  const reloadImporterOrders = useCallback(async () => {
    const [orders, quotes] = await Promise.all([businessService.listOrders(), businessService.listQuotes()]);
    const quoteMap = new Map(quotes.map((quote) => [quote.id, mapBackendQuoteToUi(quote, marketplaceImporters)]));
    setImporterOrders(orders.map((order) => mapBackendOrderToUiOrder(order, quoteMap.get(order.cotizacion_id))));
  }, [marketplaceImporters]);
  const reloadImporterQuotes = useCallback(async (importadorId?: string) => {
    const rows = await businessService.listQuotes();
    setImporterQuotes(rows.map((row) => {
      const quote = mapBackendQuoteToUi(row, marketplaceImporters);
      return quoteStatusOverrides[quote.id] ? { ...quote, status: quoteStatusOverrides[quote.id] } : quote;
    }));
    if (!importadorId) { setCompanyProposalsByQuoteId({}); return; }
    const proposals = await Promise.all(rows.map(async (row) => {
      try { return await businessService.listQuoteProposals(row.id); } catch { return []; }
    }));
    const byQuote: Record<string, BackendPropuesta> = {};
    proposals.flat().forEach((proposal) => { if (proposal.importador_id === importadorId) byQuote[proposal.cotizacion_id] = proposal; });
    setCompanyProposalsByQuoteId(byQuote);
  }, [marketplaceImporters, quoteStatusOverrides]);
  const reloadCompanyAdvisors = useCallback(async (importadorId?: string) => {
    if (!importadorId) { setCompanyAdvisors([]); return; }
    const rows = await businessService.listCompanyAdvisors();
    setCompanyAdvisors(rows.map(mapBackendAdvisorToUi));
  }, []);

  return {
    marketplaceImporters,
    setMarketplaceImporters,
    importerQuotes,
    setImporterQuotes,
    companyAdvisors,
    setCompanyAdvisors,
    importerOrders,
    setImporterOrders,
    companyProfile,
    setCompanyProfile,
    companyProposalsByQuoteId,
    setCompanyProposalsByQuoteId,
    hiddenOpenQuotesByCompany,
    setHiddenOpenQuotesByCompany,
    quoteStatusOverrides,
    setQuoteStatusOverrides,
    reloadImporters,
    reloadImporterOrders,
    reloadImporterQuotes,
    reloadCompanyAdvisors,
  };
}
