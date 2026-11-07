import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { Award, Loader2, Search } from "lucide-react";

import { Select } from "@shared/ui/design-system";
import { TarjetaLote } from "@apps/liquidaciones/features/componentes/TarjetaLote";
import { CONDICIONES, ENTREGAS, ORDEN_CONDICIONES } from "@apps/liquidaciones/features/constantes";
import { useCatalogo } from "@apps/liquidaciones/features/useLiquidaciones";
import type { Condicion, Entrega, FiltrosCatalogo } from "@apps/liquidaciones/features/tipos";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** «Oportunidades por lote, a precio fijo»: el catálogo que ven compradores y el equipo. */
export function CatalogoLotes({ onAbrir, titulo = "Oportunidades por lote, a precio fijo" }: { onAbrir: (id: string) => void; titulo?: string }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FiltrosCatalogo>({});

  // La búsqueda espera a que se deje de escribir: cada tecla no merece una consulta.
  useEffect(() => {
    const id = window.setTimeout(() => setFiltros((f) => ({ ...f, q: busqueda.trim() || undefined })), 300);
    return () => window.clearTimeout(id);
  }, [busqueda]);

  const { data, isLoading, error } = useCatalogo(filtros);
  const categorias = useMemo(() => data?.categorias ?? [], [data]);
  const fijar = (cambio: Partial<FiltrosCatalogo>) => setFiltros((f) => ({ ...f, ...cambio }));
  const conFiltros = Object.values(filtros).some(Boolean);
  const destacados = data?.destacados.length ?? 0;
  const resto = data?.lotes.length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary dark:text-accent">Liquidaciones</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{titulo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lotes por tiempo limitado de importadoras, distribuidores y bodegas registradas, con margen para revender.
            Se vende el lote completo; el primero en dar clic en «Comprar lote» lo reserva.
          </p>
        </div>
        {data && <p className="text-xs text-muted-foreground">{plural(data.disponibles, "disponible", "disponibles")} · {plural(data.publicados, "publicada", "publicadas")}</p>}
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_180px_180px_200px]">
        <label className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por producto, categoría o vendedor…"
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <Select aria-label="Ciudad" value={filtros.ciudad ?? ""} onChange={(e) => fijar({ ciudad: e.target.value || undefined })}>
          <option value="">Ciudad</option>
          {(data?.ciudades ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select aria-label="Estado" value={filtros.condicion ?? ""} onChange={(e) => fijar({ condicion: (e.target.value || undefined) as Condicion | undefined })}>
          <option value="">Estado</option>
          {ORDEN_CONDICIONES.map((c) => <option key={c} value={c}>{CONDICIONES[c].label}</option>)}
        </Select>
        <Select aria-label="Forma de entrega" value={filtros.entrega ?? ""} onChange={(e) => fijar({ entrega: (e.target.value || undefined) as Entrega | undefined })}>
          <option value="">Forma de entrega</option>
          {(Object.keys(ENTREGAS) as Entrega[]).map((e) => <option key={e} value={e}>{ENTREGAS[e]}</option>)}
        </Select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {["", ...categorias].map((cat) => {
          const activa = (filtros.categoria ?? "") === cat;
          return (
            <button
              key={cat || "todas"}
              type="button"
              onClick={() => fijar({ categoria: cat || undefined })}
              className={clsx(
                "rounded-full border px-3 py-1 text-xs font-medium transition",
                activa ? "border-accent bg-accent text-black" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {cat || "Todas"}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando oportunidades…</div>
      ) : error ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{error instanceof Error ? error.message : "No se pudo cargar el catálogo."}</p>
      ) : (
        <>
          {data && data.destacados.length > 0 && (
            <section className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Award className="h-4 w-4 text-accent" /> Destacadas
                <span className="font-normal text-muted-foreground">· Aparecen primero hasta su fecha de cierre</span>
              </p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {data.destacados.map((lote) => <TarjetaLote key={lote.id} lote={lote} onAbrir={onAbrir} />)}
              </div>
            </section>
          )}
          {/* Con destacadas arriba, esta sección es «el resto»: si está vacía, no se muestra. */}
          {(resto > 0 || destacados === 0) && (
            <section className="space-y-2">
              <p className="text-sm font-semibold">
                {destacados > 0 ? `Más liquidaciones · ${resto}` : plural(resto, "liquidación", "liquidaciones")}
              </p>
              {resto === 0 ? (
                <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                  {conFiltros
                    ? "No hay lotes con esos filtros por ahora. Prueba quitando alguno."
                    : "Todavía no hay lotes publicados. Vuelve pronto: cada día se publican oportunidades nuevas."}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                  {data?.lotes.map((lote) => <TarjetaLote key={lote.id} lote={lote} onAbrir={onAbrir} compacta />)}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
