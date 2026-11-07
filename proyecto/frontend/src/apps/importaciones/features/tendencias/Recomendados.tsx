import { useEffect, useState } from "react";
import { Play } from "lucide-react";

import { tendenciasService, type TarjetaTendencia } from "@/services/tendencias.service";

import { ImagenPublica } from "./piezas";

/** Bloque del perfil de una importadora: los productos de Tendencias que recomienda. Solo portadas. */
export function RecomendadosEmpresa({ importadorId, onAbrir }: { importadorId: string; onAbrir: (id: string) => void }) {
  const [items, setItems] = useState<TarjetaTendencia[]>([]);

  useEffect(() => {
    let vigente = true;
    setItems([]);
    tendenciasService
      .feed({ importadorId })
      .then((r) => { if (vigente) setItems(r.items); })
      .catch(() => { /* bloque opcional: si falla, no se muestra */ });
    return () => { vigente = false; };
  }, [importadorId]);

  if (items.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold">Productos que recomienda</h2>
      <p className="text-xs text-muted-foreground">Desde Tendencias. La solicitud que crees desde ahí le llega solo a esta empresa.</p>
      <div className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onAbrir(item.id)}
            className="group w-32 shrink-0 snap-start text-left sm:w-36"
          >
            <span className="relative block aspect-[4/5] overflow-hidden rounded-lg bg-neutral-900">
              <ImagenPublica src={item.portada_url} alt={item.nombre} className="h-full w-full transition-transform group-hover:scale-[1.03]" />
              <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white">
                <Play className="ml-0.5 h-4 w-4 fill-current" />
              </span>
            </span>
            <span className="mt-1.5 line-clamp-2 block text-xs font-medium leading-snug">{item.nombre}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{item.categoria}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
