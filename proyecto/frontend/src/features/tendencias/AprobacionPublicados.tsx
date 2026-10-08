import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ExternalLink, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { ImagenArchivo } from "@/app/components/files/ImagenArchivo";
import { tendenciasService, type ItemAprobacion } from "@/services/tendencias.service";

import {
  CLASE_BOTON_SECUNDARIO,
  CLASE_INPUT,
  IconoPlataforma,
  InsigniaOrigen,
  fechaCorta,
  mensajeError,
} from "./AprobacionComun";

/** Productos publicados (y caídos): ver la ficha o sacarlos del feed. */

function EstadoPublicado({ estado }: { estado: ItemAprobacion["estado"] }) {
  return estado === "caido" ? (
    <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300" title="El video ya no está disponible en la plataforma">
      Caído
    </span>
  ) : (
    <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
      Publicado
    </span>
  );
}

export function PublicadosAprobacion() {
  const [items, setItems] = useState<ItemAprobacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("");
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [archivando, setArchivando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      setItems(await tendenciasService.publicados());
    } catch (e) {
      setError(mensajeError(e, "No se pudieron cargar los publicados."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const visibles = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => `${i.nombre ?? ""} ${i.categoria ?? ""} ${i.empresa?.nombre ?? ""}`.toLowerCase().includes(q));
  }, [items, filtro]);

  const archivar = async (id: string) => {
    setArchivando(id);
    try {
      await tendenciasService.archivar(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setConfirmando(null);
      toast.success("Archivado. Ya no aparece en el feed.");
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo archivar."));
    } finally {
      setArchivando(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-semibold">
          Publicados <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
        </p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Filtrar por nombre o categoría"
              className={`w-56 pl-8 ${CLASE_INPUT}`}
            />
          </div>
          <button type="button" onClick={() => void cargar()} disabled={cargando} aria-label="Actualizar" className={CLASE_BOTON_SECUNDARIO}>
            <RefreshCw className={`h-3.5 w-3.5 ${cargando ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}

      {cargando && items.length === 0 ? (
        <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>
      ) : visibles.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{filtro ? "Nada coincide con el filtro." : "Aún no hay productos publicados."}</p>
      ) : (
        <ul className="divide-y divide-border">
          {visibles.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap">
              {item.portada_url ? (
                <ImagenArchivo src={item.portada_url} alt={item.nombre ?? "Portada"} className="h-14 w-14 flex-shrink-0 rounded-lg" />
              ) : (
                <div className="h-14 w-14 flex-shrink-0 rounded-lg bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <IconoPlataforma plataforma={item.plataforma} className="h-5 w-5" />
                  <p className="truncate text-sm font-medium">{item.nombre}</p>
                  <EstadoPublicado estado={item.estado} />
                  {item.regulado && (
                    <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">Regulado</span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>{item.categoria}</span>
                  <span>·</span>
                  <InsigniaOrigen origen={item.origen} />
                  {item.empresa && <span>{item.empresa.nombre}</span>}
                  <span>·</span>
                  <span>{item.cotizaciones_total} {item.cotizaciones_total === 1 ? "cotización" : "cotizaciones"}</span>
                  <span>·</span>
                  <span>{fechaCorta(item.publicado_en)}</span>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <button type="button" onClick={() => window.open(`/tendencias/${item.id}`, "_blank")} className={CLASE_BOTON_SECUNDARIO}>
                  <ExternalLink className="h-3.5 w-3.5" /> Ver ficha
                </button>
                {confirmando === item.id ? (
                  <span className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">¿Sacarlo del feed?</span>
                    <button
                      type="button"
                      disabled={archivando === item.id}
                      onClick={() => void archivar(item.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      {archivando === item.id && <Loader2 className="h-3 w-3 animate-spin" />} Archivar
                    </button>
                    <button type="button" disabled={archivando === item.id} onClick={() => setConfirmando(null)} className="rounded-lg px-2 py-1.5 text-muted-foreground hover:bg-muted">
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmando(item.id)} className={`${CLASE_BOTON_SECUNDARIO} text-rose-700 dark:text-rose-400`}>
                    <Archive className="h-3.5 w-3.5" /> Archivar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
