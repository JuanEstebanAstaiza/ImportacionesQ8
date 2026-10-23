import { useCallback, useState } from "react";
import type { Quote } from "@/types/quote";
import { businessService, type BackendCotizacion, type BackendPropuesta } from "@/services/business.service";
import { mapBackendQuoteToUi } from "@/features/quotes/mappers";

/** State owned by advisor queues and proposal indexes. */
export function useAdvisorData(
  importers: Parameters<typeof mapBackendQuoteToUi>[1] = [],
  overrides: Record<string, Quote["status"]> = {},
  importerQuotes: Quote[] = [],
) {
  const [availableQuotes, setAvailableQuotes] = useState<Quote[]>([]);
  const [advisorAssignedQuotes, setAdvisorAssignedQuotes] = useState<Quote[]>([]);
  const [advisorProposalsByQuoteId, setAdvisorProposalsByQuoteId] = useState<Record<string, BackendPropuesta>>({});
  const reloadAdvisorAssignedQuotes = useCallback(async (importadorId?: string) => {
    if (!importadorId) { setAdvisorAssignedQuotes([]); return; }
    const rows = await businessService.listMyAssignedQuotes();
    const detailedRows = await Promise.all(rows.map(async (row) => {
      try { return await businessService.getQuoteById(row.id); } catch {
        return { ...row, importador_id: null, foto_producto: null, pais_importacion: "N/A",
          nivel_personalizacion: null, link_referencia: null, linea_producto: "General",
          tipo_calidad: "estandar", modalidad_importacion: null, notas_adicionales: null,
          campos_personalizados_valores: null, fecha_actualizacion: row.fecha_creacion } satisfies BackendCotizacion;
      }
    }));
    setAdvisorAssignedQuotes(detailedRows.map((row) => {
      const quote = mapBackendQuoteToUi(row, importers);
      return overrides[quote.id] ? { ...quote, status: overrides[quote.id] } : quote;
    }));
  }, [importers, overrides]);
  const reloadAdvisorAvailableQuotes = useCallback(async (importadorId?: string) => {
    if (!importadorId) { setAvailableQuotes([]); return; }
    const rows = await businessService.listAdvisorAvailableQuotes();
    setAvailableQuotes(rows.map((row) => {
      const quote = mapBackendQuoteToUi(row, importers);
      return overrides[quote.id] ? { ...quote, status: overrides[quote.id] } : quote;
    }));
  }, [importers, overrides]);
  const reloadAdvisorProposalIndex = useCallback(async (importadorId?: string) => {
    if (!importadorId) { setAdvisorProposalsByQuoteId({}); return; }
    const ids = Array.from(new Set([...advisorAssignedQuotes, ...availableQuotes, ...importerQuotes].map((q) => q.id)));
    const rows = await Promise.all(ids.map(async (id) => {
      try { return await businessService.listQuoteProposals(id); } catch { return []; }
    }));
    const result: Record<string, BackendPropuesta> = {};
    rows.flat().forEach((proposal) => { if (proposal.importador_id === importadorId) result[proposal.cotizacion_id] = proposal; });
    setAdvisorProposalsByQuoteId(result);
  }, [advisorAssignedQuotes, availableQuotes, importerQuotes]);

  return {
    availableQuotes,
    setAvailableQuotes,
    advisorAssignedQuotes,
    setAdvisorAssignedQuotes,
    advisorProposalsByQuoteId,
    setAdvisorProposalsByQuoteId,
    reloadAdvisorAssignedQuotes,
    reloadAdvisorAvailableQuotes,
    reloadAdvisorProposalIndex,
  };
}
