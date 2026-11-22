import { Star } from "lucide-react";
import { clsx } from "clsx";

/** Calificación de 1 a 5 en estrellas (solo lectura). */
export function Estrellas({ valor, tamano = "sm" }: { valor: number; tamano?: "sm" | "md" }) {
  const lado = tamano === "md" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${valor.toLocaleString("es-CO")} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden="true"
          className={clsx(lado, n <= Math.round(valor) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
      ))}
    </span>
  );
}

/** Selector de 1 a 5 estrellas, accesible como grupo de opciones. */
export function SelectorEstrellas({ etiqueta, valor, onChange }: { etiqueta: string; valor: number; onChange: (v: number) => void }) {
  return (
    <fieldset className="flex flex-wrap items-center justify-between gap-2">
      <legend className="sr-only">{etiqueta}</legend>
      <span className="text-sm" aria-hidden="true">{etiqueta}</span>
      <span className="inline-flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`${etiqueta}: ${n} de 5`} aria-pressed={n === valor} onClick={() => onChange(n)}
            className="rounded transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            <Star aria-hidden="true" className={clsx("h-6 w-6", n <= valor ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
          </button>
        ))}
      </span>
    </fieldset>
  );
}
