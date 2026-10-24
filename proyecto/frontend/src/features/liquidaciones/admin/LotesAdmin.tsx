import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { toast } from "sonner";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { EyeOff, Loader2, Package, Search, Star } from "lucide-react";

import { Button, Textarea } from "@/components/design-system";
import { Modal } from "@/components/ui/Modal";
import { liquidacionesService } from "@/services/liquidaciones.service";
import { InsigniaEstadoLote } from "@/features/liquidaciones/componentes/Insignias";
import { FotoLote } from "@/features/liquidaciones/componentes/MediosLote";
import { useAhora } from "@/features/liquidaciones/componentes/CuentaRegresiva";
import { ESTADOS_LOTE, cop, tiempoRestante } from "@/features/liquidaciones/constantes";
import { useInvalidarLiquidaciones } from "@/features/liquidaciones/useLiquidaciones";
import type { EstadoLote, Lote } from "@/features/liquidaciones/tipos";

const POR_PAGINA = 25;
const ESTADOS = Object.keys(ESTADOS_LOTE) as EstadoLote[];

function mensajeError(error: unknown, defecto: string): string {
  return error instanceof Error && error.message ? error.message : defecto;
}

/** La búsqueda espera a que se deje de teclear para no lanzar una consulta por letra. */
function useRetrasado<T>(valor: T, ms = 300): T {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const id = window.setTimeout(() => setRetrasado(valor), ms);
    return () => window.clearTimeout(id);
  }, [valor, ms]);
  return retrasado;
}

export function LotesAdmin({ onVerLote }: { onVerLote: (id: string) => void }) {
  const ahora = useAhora();
  const invalidar = useInvalidarLiquidaciones();
  const [estado, setEstado] = useState<EstadoLote | "">("");
  const [busqueda, setBusqueda] = useState("");
  const q = useRetrasado(busqueda.trim());
  const [pagina, setPagina] = useState(0);
  const [destacando, setDestacando] = useState<string | null>(null);
  const [despublicando, setDespublicando] = useState<Lote | null>(null);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { setPagina(0); }, [estado, q]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["liquidaciones", "admin", "lotes", { estado, q, pagina }],
    queryFn: () => liquidacionesService.lotesAdmin({ estado: estado || undefined, q: q || undefined, limite: POR_PAGINA, desde: pagina * POR_PAGINA }),
    placeholderData: keepPreviousData,
  });
  const lotes = data?.lotes ?? [];
  const total = data?.total ?? 0;

  async function alternarDestacado(lote: Lote) {
    setDestacando(lote.id);
    try {
      await liquidacionesService.destacar(lote.id, !lote.destacado);
      toast.success(lote.destacado ? "Ya no aparece como destacado" : "Lote destacado en el catálogo");
      await invalidar();
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo cambiar el destacado."));
    } finally {
      setDestacando(null);
    }
  }

  async function despublicar() {
    if (!despublicando || motivo.trim().length < 5) return;
    setEnviando(true);
    try {
      await liquidacionesService.despublicar(despublicando.id, motivo.trim());
      toast.success(`«${despublicando.nombre}» ya no está publicado`);
      setDespublicando(null);
      setMotivo("");
      await invalidar();
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo despublicar el lote."));
    } finally {
      setEnviando(false);
    }
  }

  const chip = (activo: boolean) =>
    clsx(
      "rounded-full border px-3 py-1 text-xs font-medium transition",
      activo
        ? "border-primary bg-primary text-white dark:border-accent dark:bg-accent dark:text-black"
        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div>
          <p className="flex items-center gap-2 text-base font-semibold">
            <Package className="h-4 w-4 text-primary dark:text-accent" />
            Liquidaciones
          </p>
          <p className="text-sm text-muted-foreground">Todos los lotes del módulo: destaca oportunidades o retira publicaciones que no cumplan las reglas.</p>
        </div>
        <span className="text-xs text-muted-foreground">{total} lotes</span>
      </div>

      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button type="button" className={chip(estado === "")} onClick={() => setEstado("")}>Todos</button>
          {ESTADOS.map((clave) => (
            <button key={clave} type="button" className={chip(estado === clave)} onClick={() => setEstado(clave)}>
              {ESTADOS_LOTE[clave].label}
            </button>
          ))}
        </div>

        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por lote, categoría o vendedor..."
              className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm"
            />
          </div>
          {busqueda && (
            <button type="button" onClick={() => setBusqueda("")} className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
              Limpiar
            </button>
          )}
          {isFetching && !isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {isLoading ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando lotes…</p>
        ) : error ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No pudimos cargar los lotes. {mensajeError(error, "")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3">Lote</th>
                  <th className="py-2 pr-3">Vendedor</th>
                  <th className="py-2 pr-3 text-right">Precio</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Cierre</th>
                  <th className="py-2 pr-3 text-center">Destacado</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {lotes.map((lote) => (
                  <tr key={lote.id} className="border-b border-border/60 align-middle hover:!bg-muted dark:hover:!bg-muted">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md border border-border">
                          <FotoLote foto={lote.fotos[0]} alt={lote.nombre} className="h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="max-w-[240px] truncate font-medium text-foreground">{lote.nombre}</p>
                          <p className="text-xs text-muted-foreground">{lote.categoria}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <p className="text-foreground">{lote.vendedor.razon_social || "Sin nombre"}</p>
                      {lote.vendedor.nit && <p className="text-xs text-muted-foreground">NIT {lote.vendedor.nit}</p>}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-medium whitespace-nowrap">{cop(lote.precio_cop)}</td>
                    <td className="py-2.5 pr-3"><InsigniaEstadoLote estado={lote.estado} /></td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                      {lote.estado === "publicado" && lote.cierra_en ? tiempoRestante(lote.cierra_en, ahora) : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-center">
                      <button
                        type="button"
                        onClick={() => void alternarDestacado(lote)}
                        disabled={destacando === lote.id}
                        aria-pressed={lote.destacado}
                        title={lote.destacado ? "Quitar destacado" : "Destacar"}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-50"
                      >
                        {destacando === lote.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Star className={clsx("h-4 w-4", lote.destacado ? "fill-amber-400 text-amber-500" : "text-muted-foreground")} />
                        )}
                      </button>
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => onVerLote(lote.id)}>Ver</Button>
                        {lote.estado === "publicado" && (
                          <Button size="sm" variant="ghost" icon={<EyeOff className="h-3.5 w-3.5" />} onClick={() => { setMotivo(""); setDespublicando(lote); }}>
                            Despublicar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {lotes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No hay lotes que coincidan con el filtro.</td>
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

      <Modal open={Boolean(despublicando)} onClose={() => !enviando && setDespublicando(null)} title="Despublicar liquidación">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            «{despublicando?.nombre}» dejará de verse en el catálogo. El vendedor recibirá el motivo.
          </p>
          <Textarea
            label="Motivo"
            rows={3}
            maxLength={500}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            hint="Mínimo 5 caracteres."
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDespublicando(null)} disabled={enviando}>Cancelar</Button>
            <Button variant="danger" onClick={() => void despublicar()} loading={enviando} disabled={motivo.trim().length < 5}>Despublicar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
