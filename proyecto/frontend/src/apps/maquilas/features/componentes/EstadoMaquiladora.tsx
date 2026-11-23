import { BadgeCheck, Clock, FileWarning, PauseCircle, PencilLine } from "lucide-react";
import { clsx } from "clsx";

import type { EstadoMaquiladora } from "@apps/maquilas/features/tipos";

const ESTILO: Record<EstadoMaquiladora, { etiqueta: string; clase: string; Icono: typeof Clock }> = {
  registrada: { etiqueta: "Por completar", clase: "bg-muted text-muted-foreground border-border", Icono: PencilLine },
  en_revision: { etiqueta: "En revisión", clase: "bg-sky-500/10 text-sky-800 border-sky-500/30 dark:text-sky-300", Icono: Clock },
  verificada: {
    etiqueta: "Verificada por Zarpi",
    clase: "bg-emerald-500/10 text-emerald-800 border-emerald-500/30 dark:text-emerald-300",
    Icono: BadgeCheck,
  },
  rechazada: { etiqueta: "Requiere cambios", clase: "bg-amber-500/10 text-amber-800 border-amber-500/30 dark:text-amber-300", Icono: FileWarning },
  suspendida: { etiqueta: "Suspendida", clase: "bg-rose-500/10 text-rose-800 border-rose-500/30 dark:text-rose-300", Icono: PauseCircle },
};

export function EstadoMaquiladoraBadge({ estado, className }: { estado: EstadoMaquiladora; className?: string }) {
  const { etiqueta, clase, Icono } = ESTILO[estado] ?? ESTILO.registrada;
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", clase, className)}>
      <Icono className="h-3.5 w-3.5" aria-hidden="true" />
      {etiqueta}
    </span>
  );
}
