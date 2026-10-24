import type { Condicion, Entrega, EstadoLote, EstadoOperacion, UnidadVenta } from "@/features/liquidaciones/tipos";

/**
 * Etiquetas y colores del módulo. El estado de la mercancía se declara siempre
 * (lo exigen las reglas), pero el tono del módulo es de oportunidad: nunca
 * «baja rotación», «sobrantes» ni «lo que no se vendió».
 */

export const CONDICIONES: Record<Condicion, { label: string; dot: string; chip: string }> = {
  nuevo: {
    label: "Nuevo",
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
  },
  devolucion: {
    label: "Devolución",
    dot: "bg-sky-500",
    chip: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30",
  },
  empaque_abierto: {
    label: "Empaque abierto",
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
  },
  con_averias: {
    label: "Con averías",
    dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30",
  },
};

export const ORDEN_CONDICIONES: Condicion[] = ["nuevo", "devolucion", "empaque_abierto", "con_averias"];

export const ESTADOS_LOTE: Record<EstadoLote, { label: string; chip: string; dot: string }> = {
  en_revision: { label: "Pendiente de revisión", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
  publicado: { label: "Disponible", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
  rechazado: { label: "Necesita cambios", dot: "bg-rose-500", chip: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" },
  reservado: { label: "Reservado", dot: "bg-violet-500", chip: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  vendido: { label: "Vendido", dot: "bg-slate-400", chip: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300" },
  cerrado_sin_venta: { label: "Cerrada sin venta", dot: "bg-slate-400", chip: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300" },
};

export const ESTADOS_OPERACION: Record<EstadoOperacion, { label: string; chip: string; dot: string }> = {
  activa: { label: "Reservado", dot: "bg-violet-500", chip: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  vendida: { label: "Vendido", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
  cancelada: { label: "Cancelada", dot: "bg-slate-400", chip: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300" },
  vencida: { label: "Vencida", dot: "bg-slate-400", chip: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300" },
};

export const ENTREGAS: Record<Entrega, string> = {
  vendedor_despacha: "El vendedor despacha",
  comprador_recoge: "El comprador recoge",
};

export const UNIDADES_VENTA: Record<UnidadVenta, { plural: string; singular: string }> = {
  unidades: { plural: "unidades", singular: "unidad" },
  juegos: { plural: "juegos", singular: "juego" },
  cajas: { plural: "cajas", singular: "caja" },
  paquetes: { plural: "paquetes", singular: "paquete" },
  pares: { plural: "pares", singular: "par" },
  kilos: { plural: "kilos", singular: "kilo" },
};

export const QUE_REVISA_ZARPI = [
  "Que las fotos sean reales",
  "Que el estado esté bien declarado",
  "Que el producto esté permitido",
  "Que el precio sea coherente",
];

export const NO_SE_PERMITEN = [
  "Productos que exigen registro sanitario y no lo tienen",
  "Réplicas o marcas sin autorización",
  "Productos vencidos",
  "Productos regulados, como medicamentos o armas",
];

export const LO_QUE_HACE_ZARPI = [
  "Conecta a vendedor y comprador",
  "Deja registro de la operación y del chat",
  "No recibe el dinero del lote, no lo transporta ni lo almacena",
];

export const AVISO_PAGO_DIRECTO =
  "El pago y la entrega se cierran entre ustedes. El vendedor emite la factura. Zarpi no recibe el dinero del lote, no lo transporta ni lo almacena.";

const PESOS = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export function cop(valor: number | null | undefined): string {
  return `$${PESOS.format(Math.round(valor ?? 0))} COP`;
}

export function cantidad(lote: { unidades: number; unidad_venta?: UnidadVenta }): string {
  const u = UNIDADES_VENTA[lote.unidad_venta ?? "unidades"] ?? UNIDADES_VENTA.unidades;
  return `${PESOS.format(lote.unidades)} ${lote.unidades === 1 ? u.singular : u.plural}`;
}

export function porUnidad(lote: { unidad_venta?: UnidadVenta }): string {
  return `por ${(UNIDADES_VENTA[lote.unidad_venta ?? "unidades"] ?? UNIDADES_VENTA.unidades).singular}`;
}

/** «Cierra en 2 d 4 h», «11 h 18 min»... a partir de una fecha ISO en UTC. */
export function tiempoRestante(iso: string | null | undefined, ahora = Date.now()): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - ahora;
  if (Number.isNaN(ms) || ms <= 0) return "Cerrado";
  const min = Math.floor(ms / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${Math.max(m, 1)} min`;
}

export function horasRestantes(iso: string | null | undefined, ahora = Date.now()): number {
  if (!iso) return 0;
  return (new Date(iso).getTime() - ahora) / 3600000;
}

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
}

export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("es-CO", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}`;
}
