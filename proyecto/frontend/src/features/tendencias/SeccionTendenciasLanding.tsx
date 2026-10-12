import { useEffect, useState } from "react";
import { ArrowRight, Lock, Play, TrendingUp } from "lucide-react";

import { ETIQUETA_PLATAFORMA, tendenciasService, type FeedTendencias, type TarjetaTendencia } from "@/services/tendencias.service";

import { ImagenPublica } from "./piezas";

/**
 * Sección de Tendencias en la landing pública: los últimos productos publicados.
 * Solo portadas (nada de reproductores ni scripts de terceros). Si no hay
 * productos o la petición falla, no se muestra.
 */

function TarjetaLanding({ item, bloqueada, indice, onAbrir }: { item: TarjetaTendencia; bloqueada: boolean; indice: number; onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={`Ver ${item.nombre}`}
      className="landing-reveal group flex flex-col overflow-hidden rounded-2xl border border-border bg-card/80 text-left backdrop-blur-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 dark:focus-visible:ring-accent/60"
      style={{ animationDelay: `${indice * 70}ms` }}
    >
      <span className="relative block aspect-[4/5] w-full overflow-hidden bg-neutral-900">
        <ImagenPublica src={item.portada_url} alt={item.nombre} className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]" />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
        <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-transform group-hover:scale-110 sm:h-12 sm:w-12">
          <Play className="ml-0.5 h-5 w-5 fill-current" />
        </span>
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          {ETIQUETA_PLATAFORMA[item.plataforma] ?? item.plataforma}
        </span>
        {bloqueada ? (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-[#EDF953] px-2 py-0.5 text-[10px] font-semibold text-[#16151B]">
            <Lock className="h-3 w-3" /> Con suscripción
          </span>
        ) : null}
      </span>
      <span className="flex flex-1 flex-col gap-1 p-3">
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-primary dark:text-accent">{item.categoria}</span>
        <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{item.nombre}</span>
        {item.empresa ? (
          <span className="mt-auto truncate pt-0.5 text-xs text-muted-foreground">Lo recomienda {item.empresa.nombre}</span>
        ) : null}
      </span>
    </button>
  );
}

export function SeccionTendenciasLanding({ onAbrir, onVerTodas }: { onAbrir: (id: string) => void; onVerTodas: () => void }) {
  const [datos, setDatos] = useState<FeedTendencias | null>(null);

  useEffect(() => {
    let vigente = true;
    tendenciasService
      .feed({ recientes: true, limite: 8 })
      .then((r) => { if (vigente) setDatos(r); })
      .catch(() => { /* sección opcional: si falla, no se muestra */ });
    return () => { vigente = false; };
  }, []);

  const items = datos?.items ?? [];
  if (items.length === 0) return null;
  const bloqueada = datos?.acceso ? !datos.acceso.completo : false;

  return (
    <section className="py-20 px-6 bg-background relative overflow-hidden">
      <div className="zarpi-blob zarpi-blob-violet absolute -left-24 top-16 pointer-events-none opacity-30 scale-90" />
      <div className="zarpi-blob zarpi-blob-acid absolute -right-20 bottom-0 pointer-events-none opacity-25 scale-75" />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-10 sm:mb-12">
          <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-primary dark:text-accent font-semibold mb-3">
            <TrendingUp className="h-3.5 w-3.5" /> Tendencias
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Lo que se está moviendo para importar</h2>
          <p className="text-muted-foreground mt-2">Productos virales de TikTok, Instagram, YouTube y Pinterest, revisados por Zarpi.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item, i) => (
            <TarjetaLanding key={item.id} item={item} bloqueada={bloqueada} indice={i} onAbrir={() => onAbrir(item.id)} />
          ))}
        </div>

        <div className="text-center mt-8">
          <button
            type="button"
            onClick={onVerTodas}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/80"
          >
            Ver todas las tendencias <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
