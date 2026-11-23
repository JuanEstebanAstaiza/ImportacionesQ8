import { Clock, PackageCheck, Star } from "lucide-react";
import { clsx } from "clsx";

import type { MetricasMaquila as Metricas } from "@apps/maquilas/features/tipos";

/**
 * Lo que respalda a una maquila: calificación de sus clientes, entregas a tiempo y
 * pedidos entregados. Sin historial dice «Nueva en Zarpi» en vez de mostrar ceros.
 */
export function MetricasMaquila({ metricas, compacto = false }: { metricas?: Metricas | null; compacto?: boolean }) {
  const m = metricas;
  if (!m || (!m.pedidos_entregados && !m.resenas)) {
    return <span className="text-xs text-muted-foreground">Nueva en Zarpi · sin pedidos entregados aún</span>;
  }
  const item = "inline-flex items-center gap-1";
  return (
    <span className={clsx("flex flex-wrap items-center gap-x-3 gap-y-1", compacto ? "text-xs" : "text-sm")}>
      {m.calificacion !== null && (
        <span className={item}>
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
          <span className="font-semibold">{m.calificacion.toLocaleString("es-CO")}</span>
          <span className="text-muted-foreground">({m.resenas} {m.resenas === 1 ? "reseña" : "reseñas"})</span>
        </span>
      )}
      {m.cumplimiento !== null && (
        <span className={item}><Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />{m.cumplimiento} % a tiempo</span>
      )}
      <span className={item}><PackageCheck className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        {m.pedidos_entregados} {m.pedidos_entregados === 1 ? "pedido entregado" : "pedidos entregados"}</span>
    </span>
  );
}
