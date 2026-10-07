import type { EstadoProducto } from "@/services/tendencias.service";

/** "YYYY-MM-DD" como fecha local: `new Date("2026-10-12")` sería UTC y en Colombia caería el día anterior. */
export function fechaLocal(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const [y, m, d] = valor.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function fechaCorta(valor: string | null | undefined): string {
  const fecha = fechaLocal(valor);
  return fecha ? fecha.toLocaleDateString("es-CO", { day: "numeric", month: "short" }) : "—";
}

export function fechaLarga(valor: string | Date | null | undefined, conAnio = false): string {
  const fecha = valor instanceof Date ? valor : fechaLocal(valor);
  if (!fecha) return "—";
  return fecha.toLocaleDateString("es-CO", { day: "numeric", month: "long", ...(conAnio ? { year: "numeric" } : {}) });
}

/** Instantes ISO del backend (vigencias del acceso), con zona. */
export function fechaInstante(valor: string | null | undefined): string {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + dias);
}

export function pesosCop(valor: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);
}

export function mensajeError(error: unknown, defecto: string): string {
  return error instanceof Error && error.message ? error.message : defecto;
}

/** Color del chip de estado. Los textos los arma el backend (`estado_texto`). */
export const CLASE_ESTADO: Record<EstadoProducto, string> = {
  pidelo_ya: "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200",
  ventana_abierta: "bg-violet-100 text-violet-800 dark:bg-violet-500/25 dark:text-violet-200",
  futura: "bg-zinc-100 text-zinc-700 dark:bg-zinc-700/60 dark:text-zinc-200",
  solo_aereo: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  todo_el_anio: "bg-stone-100 text-stone-700 dark:bg-stone-700/60 dark:text-stone-200",
  fuera_de_tiempo: "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export const ESTADOS_PIDELO_YA: EstadoProducto[] = ["pidelo_ya", "ventana_abierta", "solo_aereo"];
