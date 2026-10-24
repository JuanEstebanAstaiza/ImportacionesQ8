import { clsx } from "clsx";
import { Award, CircleCheck, Clock } from "lucide-react";

import { InsigniaCondicion } from "@/features/liquidaciones/componentes/Insignias";
import { FotoLote } from "@/features/liquidaciones/componentes/MediosLote";
import { useAhora } from "@/features/liquidaciones/componentes/CuentaRegresiva";
import { cantidad, cop, horasRestantes, porUnidad, tiempoRestante } from "@/features/liquidaciones/constantes";
import type { Lote } from "@/features/liquidaciones/tipos";

/** Tarjeta del catálogo, como en el diseño: foto, categoría, cantidad, precio y cierre. */
export function TarjetaLote({ lote, onAbrir, compacta = false }: { lote: Lote; onAbrir?: (id: string) => void; compacta?: boolean }) {
  const ahora = useAhora();
  const reservado = lote.estado === "reservado";
  const urgente = lote.estado === "publicado" && horasRestantes(lote.cierra_en, ahora) < 24;

  return (
    <button
      type="button"
      onClick={() => onAbrir?.(lote.id)}
      disabled={!onAbrir}
      className={clsx(
        "group flex h-full w-full flex-col overflow-hidden rounded-xl border bg-white text-left transition",
        onAbrir && "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg dark:hover:border-accent/40",
        lote.destacado && !reservado ? "border-accent/60" : "border-border",
      )}
    >
      <div className={clsx("relative w-full overflow-hidden", compacta ? "aspect-[4/3]" : "aspect-[4/3]")}>
        <FotoLote foto={lote.fotos[0]} alt={lote.nombre} className={clsx("h-full", reservado && "opacity-40")} />
        <div className="absolute left-2 top-2"><InsigniaCondicion condicion={lote.condicion} className="bg-white/90 dark:bg-black/60 backdrop-blur" /></div>
        {lote.destacado && !reservado && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-black">
            <Award className="h-3 w-3" /> Destacada
          </span>
        )}
        {reservado && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-violet-600/90 px-3 py-1 text-xs font-semibold text-white">Reservado</span>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary dark:text-accent">{lote.categoria}</p>
        <p className="line-clamp-2 text-sm font-semibold text-foreground">{lote.nombre}</p>
        <p className="text-xs text-muted-foreground">{cantidad(lote)} · {lote.ciudad}</p>
        <p className="mt-1.5 text-base font-semibold text-foreground">{cop(lote.precio_cop)}</p>
        <p className="text-xs text-muted-foreground">{cop(lote.precio_unidad_cop)} {porUnidad(lote)}</p>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2 text-[11px]">
          <span className={clsx("inline-flex items-center gap-1", urgente ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
            <Clock className="h-3 w-3" />
            {lote.estado === "publicado" ? `Cierra en ${tiempoRestante(lote.cierra_en, ahora)}` : reservado ? "Reservado" : ""}
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CircleCheck className="h-3 w-3" /> Revisado
          </span>
        </div>
      </div>
    </button>
  );
}
