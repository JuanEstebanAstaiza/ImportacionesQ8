import { useEffect } from "react";
import { clsx } from "clsx";
import { Loader2 } from "lucide-react";

import { InsigniaEstadoOperacion } from "@/features/liquidaciones/componentes/Insignias";
import { PanelOperacion } from "@/features/liquidaciones/componentes/PanelOperacion";
import { useOperaciones } from "@/features/liquidaciones/useLiquidaciones";

/**
 * «Mis reservas» (comprador) y «Operaciones» (vendedor): la lista de lotes
 * reservados a la izquierda y la operación elegida a la derecha.
 */
export function OperacionesLotes({
  lado,
  operacionId,
  onElegir,
  onReportar,
  onIrCatalogo,
}: {
  lado: "comprador" | "vendedor";
  operacionId?: string;
  onElegir: (id: string) => void;
  onReportar?: (referencia: string) => void;
  onIrCatalogo?: () => void;
}) {
  const { data: operaciones, isLoading } = useOperaciones(lado);
  const comprador = lado === "comprador";

  // Sin una operación elegida en la URL, se abre la más reciente.
  useEffect(() => {
    if (!operacionId && operaciones && operaciones.length > 0) onElegir(operaciones[0].id);
  }, [operacionId, operaciones, onElegir]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{comprador ? "Mis reservas" : "Operaciones"}</h1>
        <p className="text-sm text-muted-foreground">
          {comprador ? "Lotes que reservaste. Coordina el pago y la entrega con el vendedor." : "Lotes reservados por compradores. Coordina el pago y la entrega por el chat."}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>
      ) : !operaciones || operaciones.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-14 text-center">
          <p className="text-sm text-muted-foreground">
            {comprador ? "Aún no has reservado ningún lote." : "Ningún comprador ha reservado tus lotes todavía."}
          </p>
          {comprador && onIrCatalogo && (
            <button type="button" onClick={onIrCatalogo} className="mt-2 text-sm font-medium text-primary hover:underline dark:text-accent">
              Ver oportunidades
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <ul className="space-y-1.5">
            {operaciones.map((op) => {
              const activa = op.id === operacionId;
              return (
                <li key={op.id}>
                  <button
                    type="button"
                    onClick={() => onElegir(op.id)}
                    className={clsx(
                      "w-full rounded-lg border px-3 py-2.5 text-left transition",
                      activa ? "border-accent/60 bg-accent/10" : "border-border bg-white hover:border-muted-foreground/30",
                    )}
                  >
                    <p className="line-clamp-2 text-sm font-medium">{op.lote.nombre}</p>
                    <p className="truncate text-xs text-muted-foreground">{op.contraparte?.razon_social}</p>
                    <InsigniaEstadoOperacion estado={op.estado} className="mt-1.5" />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="min-w-0">
            {operacionId && <PanelOperacion key={operacionId} operacionId={operacionId} modo={lado} onReportar={onReportar} />}
          </div>
        </div>
      )}
    </div>
  );
}
