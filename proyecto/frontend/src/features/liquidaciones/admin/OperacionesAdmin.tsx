import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MessagesSquare, Search } from "lucide-react";

import { liquidacionesService } from "@/services/liquidaciones.service";
import { InsigniaEstadoOperacion } from "@/features/liquidaciones/componentes/Insignias";
import { PanelOperacion } from "@/features/liquidaciones/componentes/PanelOperacion";
import { ESTADOS_OPERACION, fechaHora } from "@/features/liquidaciones/constantes";
import type { EstadoOperacion } from "@/features/liquidaciones/tipos";

const POR_PAGINA = 25;
const ESTADOS = Object.keys(ESTADOS_OPERACION) as EstadoOperacion[];

/** La búsqueda espera a que se deje de teclear para no lanzar una consulta por letra. */
function useRetrasado<T>(valor: T, ms = 300): T {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const id = window.setTimeout(() => setRetrasado(valor), ms);
    return () => window.clearTimeout(id);
  }, [valor, ms]);
  return retrasado;
}

function Parte({ datos }: { datos: { razon_social: string | null; nit: string | null } | null }) {
  if (!datos) return <span className="text-muted-foreground">—</span>;
  return (
    <>
      <p className="font-medium text-foreground">{datos.razon_social || "Sin nombre"}</p>
      {datos.nit && <p className="text-xs text-muted-foreground">NIT {datos.nit}</p>}
    </>
  );
}

/**
 * Monitoreo de los chats de operación del módulo. El listado conserva filtros y
 * página mientras se mira un chat, porque solo se oculta, no se desmonta.
 */
export function OperacionesAdmin({ operacionId, onAbrir }: { operacionId?: string; onAbrir: (id: string | null) => void }) {
  const [busqueda, setBusqueda] = useState("");
  const q = useRetrasado(busqueda.trim());
  const [estado, setEstado] = useState<EstadoOperacion | "">("");
  const [pagina, setPagina] = useState(0);

  useEffect(() => { setPagina(0); }, [estado, q]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["liquidaciones", "admin", "operaciones", { q, estado, pagina }],
    queryFn: () => liquidacionesService.operacionesAdmin({ q: q || undefined, estado: estado || undefined, limite: POR_PAGINA, desde: pagina * POR_PAGINA }),
    placeholderData: keepPreviousData,
    refetchInterval: operacionId ? false : 30_000,
  });
  const operaciones = data?.operaciones ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div>
          <p className="flex items-center gap-2 text-base font-semibold">
            <MessagesSquare className="h-4 w-4 text-primary dark:text-accent" />
            Operaciones y chats
          </p>
          <p className="text-sm text-muted-foreground">
            Sigue cada reserva entre comprador y vendedor. Puedes intervenir en el chat como Soporte Zarpi; el pago y la entrega los cierran ellos.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{total} operaciones</span>
      </div>

      {operacionId && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => onAbrir(null)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al listado
          </button>
          <PanelOperacion operacionId={operacionId} modo="equipo" />
        </div>
      )}

      <div className={operacionId ? "hidden" : "rounded-xl border border-border bg-white p-4 shadow-sm"}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por lote, comprador, vendedor o NIT..."
              className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoOperacion | "")}
            className="h-[38px] rounded-lg border border-border bg-white px-3 text-sm"
            aria-label="Filtrar por estado"
          >
            <option value="">Todas</option>
            {ESTADOS.map((clave) => <option key={clave} value={clave}>{ESTADOS_OPERACION[clave].label}</option>)}
          </select>
          {(busqueda || estado) && (
            <button type="button" onClick={() => { setBusqueda(""); setEstado(""); }} className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
              Limpiar
            </button>
          )}
          {isFetching && !isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {isLoading ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando operaciones…</p>
        ) : error ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No pudimos cargar las operaciones. {error instanceof Error ? error.message : ""}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3">Lote</th>
                  <th className="py-2 pr-3">Vendedor</th>
                  <th className="py-2 pr-3">Comprador</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3 text-right">Mensajes</th>
                  <th className="py-2 pr-3">Último mensaje</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {operaciones.map((op) => (
                  <tr key={op.id} className="border-b border-border/60 align-top hover:!bg-muted dark:hover:!bg-muted">
                    <td className="py-3 pr-3"><p className="max-w-[220px] truncate font-medium text-foreground">{op.lote.nombre}</p></td>
                    <td className="py-3 pr-3"><Parte datos={op.vendedor} /></td>
                    <td className="py-3 pr-3"><Parte datos={op.comprador} /></td>
                    <td className="py-3 pr-3"><InsigniaEstadoOperacion estado={op.estado} /></td>
                    <td className="py-3 pr-3 text-right font-medium">{op.total_mensajes}</td>
                    <td className="py-3 pr-3 text-xs text-muted-foreground whitespace-nowrap">{fechaHora(op.ultimo_mensaje_en) || "Sin mensajes"}</td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onAbrir(op.id)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium bg-primary dark:bg-accent hover:!border-primary dark:hover:!border-accent !text-white dark:!text-black hover:!bg-primary dark:hover:!bg-accent hover:opacity-80"
                      >
                        Ver chat
                      </button>
                    </td>
                  </tr>
                ))}
                {operaciones.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No hay operaciones que coincidan con la búsqueda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {total > POR_PAGINA && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              {pagina * POR_PAGINA + 1}–{Math.min((pagina + 1) * POR_PAGINA, total)} de {total}
            </p>
            <div className="flex gap-2">
              <button type="button" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40">
                Anterior
              </button>
              <button type="button" disabled={(pagina + 1) * POR_PAGINA >= total} onClick={() => setPagina((p) => p + 1)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40">
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
