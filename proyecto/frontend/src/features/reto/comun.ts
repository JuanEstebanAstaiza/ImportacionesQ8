import type { EstadoRonda } from "@/services/reto.service";

/** Utilidades compartidas por la página del reto y el panel de pagos. */

const ZONA = "America/Bogota";

export const CLASE_INPUT =
  "w-full rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-70";

export const CLASE_BOTON_PRIMARIO =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60";

export const CLASE_BOTON_SECUNDARIO =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60";

export const CLASE_TARJETA = "rounded-xl border border-border bg-white p-4 shadow-sm";

export function mensajeError(error: unknown, defecto: string): string {
  return error instanceof Error && error.message ? error.message : defecto;
}

/** Fecha y hora en Bogotá, p. ej. «15 de octubre de 2026, 11:59 p. m.». */
export function fechaBogota(iso: string | null | undefined, conHora = true): string {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA,
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(conHora ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(fecha);
}

/** Valor para un `<input type="datetime-local">` en hora de Bogotá ("YYYY-MM-DDTHH:mm"). */
export function aDatetimeLocalBogota(fecha: Date | string): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? "00";
  return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}`;
}

/** Bogotá es UTC−5 todo el año (sin horario de verano). */
export function datetimeLocalBogotaAUtc(valor: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(valor)) return null;
  const d = new Date(`${valor.slice(0, 16)}:00-05:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const ESTADO_RONDA: Record<EstadoRonda, { texto: string; clase: string }> = {
  abierta: { texto: "Abierta", clase: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  llena: { texto: "Llena", clase: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  cerrada: { texto: "Cerrada", clase: "bg-muted text-muted-foreground" },
};
