import { CheckCircle2, Clock, Loader2 } from "lucide-react";

type EstadoAutoguardado = "sin-cambios" | "pendiente" | "guardando" | "guardado";

export function IndicadorAutoguardado({ estado }: { estado: EstadoAutoguardado }) {
  if (estado === "sin-cambios") {
    return <span className="text-xs text-muted-foreground">Se guarda automáticamente</span>;
  }

  if (estado === "guardando") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Guardando…
      </span>
    );
  }

  if (estado === "guardado") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Guardado
      </span>
    );
  }

  return <span className="text-xs text-amber-700 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Cambios sin guardar</span>;
}