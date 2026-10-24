import { CircleCheck, CircleX, ShieldCheck } from "lucide-react";

import { Card } from "@/components/design-system";
import { LO_QUE_HACE_ZARPI, NO_SE_PERMITEN, QUE_REVISA_ZARPI } from "@/features/liquidaciones/constantes";

/** Columna lateral del formulario de publicación: qué revisa Zarpi y qué no se permite. */
export function ReglasZarpi({ compacto = false }: { compacto?: boolean }) {
  return (
    <div className="space-y-3">
      <Card padding="sm">
        <p className="mb-2 text-sm font-semibold">Qué revisa Zarpi</p>
        <ul className="space-y-1.5">
          {QUE_REVISA_ZARPI.map((regla) => (
            <li key={regla} className="flex items-start gap-2 text-xs text-muted-foreground">
              <CircleCheck className="mt-px h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />{regla}
            </li>
          ))}
        </ul>
      </Card>
      <Card padding="sm">
        <p className="mb-2 text-sm font-semibold">No se permiten</p>
        <ul className="space-y-1.5">
          {NO_SE_PERMITEN.map((regla) => (
            <li key={regla} className="flex items-start gap-2 text-xs text-muted-foreground">
              <CircleX className="mt-px h-3.5 w-3.5 flex-shrink-0 text-rose-500" />{regla}
            </li>
          ))}
        </ul>
      </Card>
      {!compacto && (
        <Card padding="sm">
          <p className="mb-2 text-sm font-semibold">Lo que hace Zarpi</p>
          <ul className="space-y-1.5">
            {LO_QUE_HACE_ZARPI.map((regla) => (
              <li key={regla} className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-px h-3.5 w-3.5 flex-shrink-0 text-primary dark:text-accent" />{regla}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
