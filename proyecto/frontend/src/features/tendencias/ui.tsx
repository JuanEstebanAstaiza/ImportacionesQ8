import { AlertTriangle, Info, Loader2, RefreshCw, ShieldAlert } from "lucide-react";

import { PIE_INFORMATIVO, type FechasProducto } from "@/services/tendencias.service";
import { CLASE_ESTADO } from "@/features/tendencias/formato";

/** Piezas pequeñas que comparten las vistas de Tendencias del comprador. */

export function EstadoChip({ fechas, className = "" }: { fechas: FechasProducto; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${CLASE_ESTADO[fechas.estado] ?? CLASE_ESTADO.futura} ${className}`}>
      {fechas.estado_texto}
    </span>
  );
}

export function EtiquetaRequisitos({ className = "" }: { className?: string }) {
  return (
    <span
      title="Puede requerir permisos o registros de importación"
      className={`inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-200 ${className}`}
    >
      <ShieldAlert className="h-3 w-3" />
      Revisar requisitos
    </span>
  );
}

export function Cargando({ texto = "Cargando..." }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-white px-4 py-12 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {texto}
    </div>
  );
}

export function ErrorCarga({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white px-4 py-10 text-center shadow-sm">
      <AlertTriangle className="h-6 w-6 text-rose-500" />
      <p className="max-w-md text-sm text-muted-foreground">{mensaje}</p>
      <button
        type="button"
        onClick={onReintentar}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Reintentar
      </button>
    </div>
  );
}

/** Pie fijo de la especificación (sección 09): va en toda página y ficha de Tendencias. */
export function PieInformativo({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground ${className}`}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{PIE_INFORMATIVO}</span>
    </p>
  );
}
