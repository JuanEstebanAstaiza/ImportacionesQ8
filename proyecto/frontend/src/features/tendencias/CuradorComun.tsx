import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import type { EstadoEdicion, EstadoProducto } from "@/services/tendencias.service";

/** Piezas compartidas por las pestañas del panel del curador. */

export const MAX_PRODUCTOS_EDICION = 6;
export const MAX_FOTOS = 5;

export const CARD = "rounded-xl border border-border bg-card p-4 shadow-sm";
export const INPUT =
  "h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary disabled:opacity-60 dark:focus:border-accent";
export const TEXTAREA =
  "w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60 dark:focus:border-accent";
export const BTN =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent dark:text-accent-foreground";
export const BTN_SEC =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";
export const BTN_PELIGRO =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-card px-3 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50";
export const BTN_ICONO =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40";

export function mensajeError(err: unknown, porDefecto = "Algo salió mal. Inténtalo de nuevo."): string {
  return err instanceof Error && err.message ? err.message : porDefecto;
}

/** "YYYY-MM-DD" como fecha local, sin corrimiento por UTC. */
export function fechaLocal(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const [y, m, d] = valor.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function formatoFecha(valor: string | null | undefined, conAnio = true): string {
  const fecha = fechaLocal(valor);
  if (!fecha) return "—";
  return fecha.toLocaleDateString("es-CO", { day: "numeric", month: "short", ...(conAnio ? { year: "numeric" } : {}) });
}

/** ISO en UTC (con "Z") mostrado en hora de Bogotá. */
export function formatoBogota(iso: string | null | undefined): string {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleString("es-CO", {
    timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function hoyIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Texto corto a número opcional: "" → null. */
export function numeroOpcional(valor: string): number | null {
  const limpio = valor.trim();
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? Math.round(n) : null;
}

const ESTILO_EDICION: Record<EstadoEdicion, string> = {
  borrador: "bg-muted text-muted-foreground",
  programada: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200",
  publicada: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  archivada: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
};

const TEXTO_EDICION: Record<EstadoEdicion, string> = {
  borrador: "Borrador",
  programada: "Programada",
  publicada: "Publicada",
  archivada: "Archivada",
};

export function EstadoEdicionBadge({ estado }: { estado: EstadoEdicion }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ESTILO_EDICION[estado] ?? ESTILO_EDICION.borrador}`}>
      {TEXTO_EDICION[estado] ?? estado}
    </span>
  );
}

const ESTILO_PRODUCTO: Record<EstadoProducto, string> = {
  todo_el_anio: "bg-muted text-muted-foreground",
  pidelo_ya: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  ventana_abierta: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  futura: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200",
  solo_aereo: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  fuera_de_tiempo: "bg-destructive/15 text-destructive",
};

export function EstadoProductoChip({ estado, texto }: { estado: EstadoProducto; texto: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${ESTILO_PRODUCTO[estado] ?? ESTILO_PRODUCTO.todo_el_anio}`}>
      {estado === "fuera_de_tiempo" ? "Fuera de tiempo" : texto}
    </span>
  );
}

export function Cargando({ texto = "Cargando..." }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {texto}
    </div>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

type CampoProps = {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  /** Muestra "n/max" a la derecha de la etiqueta. */
  contador?: { actual: number; max: number };
  className?: string;
};

export function Campo({ label, children, hint, contador, className }: CampoProps) {
  return (
    <label className={`block text-sm ${className ?? ""}`}>
      <span className="mb-1 flex items-center justify-between gap-2 font-medium text-foreground">
        <span>{label}</span>
        {contador && (
          <span className={`text-xs font-normal ${contador.actual > contador.max ? "text-destructive" : "text-muted-foreground"}`}>
            {contador.actual}/{contador.max}
          </span>
        )}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

type BotonConfirmarProps = {
  label: ReactNode;
  pregunta: string;
  confirmar: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
  disabled?: boolean;
  peligro?: boolean;
};

/** Botón con confirmación en línea (sin window.confirm). */
export function BotonConfirmar({ label, pregunta, confirmar, onConfirm, className, disabled, peligro }: BotonConfirmarProps) {
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  if (!abierto) {
    return (
      <button type="button" disabled={disabled} onClick={() => setAbierto(true)} className={className ?? BTN_SEC}>
        {label}
      </button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-2 py-1">
      <span className="text-xs font-medium text-foreground">{pregunta}</span>
      <button
        type="button"
        disabled={ocupado}
        onClick={async () => {
          setOcupado(true);
          try {
            await onConfirm();
          } finally {
            setOcupado(false);
            setAbierto(false);
          }
        }}
        className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-white disabled:opacity-50 ${
          peligro ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90 dark:bg-accent dark:text-accent-foreground"
        }`}
      >
        {ocupado && <Loader2 className="h-3 w-3 animate-spin" />}
        {confirmar}
      </button>
      <button
        type="button"
        disabled={ocupado}
        onClick={() => setAbierto(false)}
        className="inline-flex h-7 items-center rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        Cancelar
      </button>
    </span>
  );
}

export function Aviso({ tono = "info", children }: { tono?: "info" | "alerta" | "error"; children: ReactNode }) {
  const estilo = {
    info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100",
    alerta: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
    error: "border-destructive/30 bg-destructive/10 text-destructive",
  }[tono];
  return <div className={`rounded-lg border p-3 text-sm ${estilo}`}>{children}</div>;
}
