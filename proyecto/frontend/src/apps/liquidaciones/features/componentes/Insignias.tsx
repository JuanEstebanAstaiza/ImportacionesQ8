import { clsx } from "clsx";

import { CONDICIONES, ESTADOS_LOTE, ESTADOS_OPERACION } from "@apps/liquidaciones/features/constantes";
import type { Condicion, EstadoLote, EstadoOperacion } from "@apps/liquidaciones/features/tipos";

function Pastilla({ dot, cls, label, className }: { dot: string; cls: string; label: string; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", cls, className)}>
      <span className={clsx("h-1.5 w-1.5 rounded-full flex-shrink-0", dot)} />
      {label}
    </span>
  );
}

export function InsigniaCondicion({ condicion, className }: { condicion: Condicion; className?: string }) {
  const c = CONDICIONES[condicion] ?? CONDICIONES.nuevo;
  return <Pastilla dot={c.dot} cls={clsx("border", c.chip)} label={c.label} className={className} />;
}

export function InsigniaEstadoLote({ estado, className }: { estado: EstadoLote; className?: string }) {
  const e = ESTADOS_LOTE[estado] ?? ESTADOS_LOTE.publicado;
  return <Pastilla dot={e.dot} cls={e.chip} label={e.label} className={className} />;
}

export function InsigniaEstadoOperacion({ estado, className }: { estado: EstadoOperacion; className?: string }) {
  const e = ESTADOS_OPERACION[estado] ?? ESTADOS_OPERACION.activa;
  return <Pastilla dot={e.dot} cls={e.chip} label={e.label} className={className} />;
}
