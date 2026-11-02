import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

import type { TierCotizante } from "@/services/catalogos.service";

/** Piezas compartidas por la vista de la empresa y la del comprador. */

export function mensajeError(error: unknown, defecto = "Algo salió mal. Intenta de nuevo."): string {
  return error instanceof Error && error.message ? error.message : defecto;
}

export function cantidadConUnidad(valor: number | null | undefined, unidad: string | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  const numero = valor.toLocaleString("es-CO", { maximumFractionDigits: 2 });
  return `${numero} ${unidad === "m3" ? "m³" : valor === 1 ? "unidad" : "unidades"}`;
}

const CLASE_TIER: Record<TierCotizante, string> = {
  Bronze: "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-900",
  Silver: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
  Gold: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900",
  Élite: "bg-primary/10 text-primary border-primary/30 dark:bg-primary/25 dark:text-violet-200 dark:border-primary/50",
};

export function InsigniaTier({ tier }: { tier: TierCotizante | null | undefined }) {
  const valor = (tier || "Bronze") as TierCotizante;
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${CLASE_TIER[valor] ?? CLASE_TIER.Bronze}`}>
      {valor}
    </span>
  );
}

/** Ventana modal: pantalla completa en el teléfono, centrada desde `sm`. */
export function Modal({
  titulo,
  onCerrar,
  children,
  pie,
  ancho = "sm:max-w-2xl",
}: {
  titulo: ReactNode;
  onCerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
  ancho?: string;
}) {
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", alPulsar);
    const desbordeAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alPulsar);
      document.body.style.overflow = desbordeAnterior;
    };
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        className={`flex h-full w-full flex-col bg-white shadow-xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl ${ancho}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="min-w-0 truncate text-base font-semibold">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {pie ? <div className="border-t border-border px-4 py-3">{pie}</div> : null}
      </div>
    </div>
  );
}

export const CLASE_INPUT =
  "w-full rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-70";

export const CLASE_BOTON_PRIMARIO =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60";

export const CLASE_BOTON_SECUNDARIO =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60";

export function Campo({
  etiqueta,
  ayuda,
  contador,
  children,
}: {
  etiqueta: string;
  ayuda?: ReactNode;
  contador?: [number, number];
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-2 text-sm font-medium">
        {etiqueta}
        {contador ? (
          <span className={`text-[11px] font-normal ${contador[0] > contador[1] ? "text-red-600" : "text-muted-foreground"}`}>
            {contador[0]}/{contador[1]}
          </span>
        ) : null}
      </span>
      {children}
      {ayuda ? <span className="mt-1 block text-xs text-muted-foreground">{ayuda}</span> : null}
    </label>
  );
}
