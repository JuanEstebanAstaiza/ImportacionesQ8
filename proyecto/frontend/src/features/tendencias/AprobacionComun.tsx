import { Instagram, Music2, Youtube } from "lucide-react";

import type { OrigenTendencia, Plataforma } from "@/services/tendencias.service";

/** Piezas compartidas por las pestañas del panel de aprobación. */

export function mensajeError(error: unknown, defecto: string): string {
  return error instanceof Error && error.message ? error.message : defecto;
}

export function haceCuanto(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const horas = ms / 3_600_000;
  if (horas < 1) return "hace menos de 1 h";
  if (horas < 48) return `hace ${Math.round(horas)} h`;
  return `hace ${Math.round(horas / 24)} días`;
}

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

const ICONOS: Record<Plataforma, typeof Instagram> = {
  tiktok: Music2,
  instagram: Instagram,
  youtube: Youtube,
};

const COLOR_PLATAFORMA: Record<Plataforma, string> = {
  tiktok: "bg-slate-900 text-white dark:bg-white dark:text-black",
  instagram: "bg-pink-600 text-white",
  youtube: "bg-red-600 text-white",
};

export function IconoPlataforma({ plataforma, className = "h-7 w-7" }: { plataforma: Plataforma; className?: string }) {
  const Icono = ICONOS[plataforma] ?? Music2;
  return (
    <span className={`inline-flex flex-shrink-0 items-center justify-center rounded-lg ${COLOR_PLATAFORMA[plataforma] ?? "bg-muted"} ${className}`}>
      <Icono className="h-3.5 w-3.5" />
    </span>
  );
}

const ORIGEN: Record<OrigenTendencia, { texto: string; clase: string }> = {
  comunidad: { texto: "Comunidad", clase: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300" },
  importadora: { texto: "Importadora", clase: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300" },
  equipo: { texto: "Equipo", clase: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" },
};

export function InsigniaOrigen({ origen }: { origen: OrigenTendencia }) {
  const o = ORIGEN[origen] ?? ORIGEN.comunidad;
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${o.clase}`}>{o.texto}</span>;
}

export const CLASE_INPUT =
  "w-full rounded-lg border border-border bg-white px-3 py-1.5 text-sm focus:border-primary focus:outline-none dark:focus:border-accent";

export const CLASE_BOTON_PRIMARIO =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/90";

export const CLASE_BOTON_SECUNDARIO =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

/** Tarjeta de contador de los paneles internos (aprobación, diseño). */
export function Contador({ etiqueta, valor, icono, clase }: { etiqueta: string; valor: number | null; icono: typeof Instagram; clase: string }) {
  const Icono = icono;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-white p-3 shadow-sm">
      <span className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${clase}`}>
        <Icono className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-semibold leading-none tabular-nums">{valor ?? "—"}</p>
        <p className="mt-1 text-xs text-muted-foreground">{etiqueta}</p>
      </div>
    </div>
  );
}
