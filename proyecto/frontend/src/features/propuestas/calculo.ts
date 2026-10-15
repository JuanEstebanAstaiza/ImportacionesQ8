/**
 * Propuesta rápida: dos precios, entrega, tiempo y permisos.
 *
 * Mismo cálculo que `backend/services/formulario_propuesta.py`. El navegador lo
 * hace para mostrar el total mientras se escribe; al enviar, el servidor lo
 * rehace y guarda el suyo.
 */

export type ModoEntrega = "incluida" | "fijo" | "cliente";
export type Via = "maritimo" | "aereo";
export type IvaPct = 0 | 5 | 19;
export type FormaPago = "50-50" | "30-70" | "100";

export interface RangoDias { minimo: number; maximo: number; }

/** «Mi empresa › Condiciones de tus propuestas». */
export interface CondicionesPropuesta {
  bodega_ciudad: string;
  bodega_direccion: string;
  ciudades_entrega_incluida: string[];
  entrega_otras_ciudades: ModoEntrega;
  tiempo_maritimo: RangoDias;
  tiempo_aereo: RangoDias;
  vigencia_dias: number;
  iva_pct: IvaPct;
  forma_pago: FormaPago;
  seguro_incluido: boolean;
  tolerancia_pct: number;
  dias_reclamo: number;
  cancelacion: { antes_orden: string; en_fabricacion: string; despachada: string };
  supuestos: string;
}

export interface FormularioPropuesta {
  precio_unitario_usd: number;
  cantidad: number;
  logistica_valor: number;
  logistica_moneda: "USD" | "COP";
  trm: number;
  iva_pct: IvaPct;
  bodega_ciudad: string;
  bodega_direccion: string | null;
  ciudad_destino: string;
  entrega_modo: ModoEntrega;
  entrega_valor_cop: number | null;
  flete_aprox_cop: number | null;
  via: Via;
  dias_min: number;
  dias_max: number;
  requiere_permisos: boolean;
  permiso_cual: string | null;
  permiso_gestiona: "importadora" | "cliente";
  nota: string | null;
  mostrar_desglose: boolean;
}

export interface TotalesPropuesta {
  producto_usd: number;
  producto_cop: number;
  logistica_cop: number;
  entrega_cop: number;
  subtotal_cop: number;
  iva_cop: number;
  total_cop: number;
  unitario_cop: number;
  unitario_usd: number;
  total_usd: number;
}

/** Lo que el backend guarda en `condiciones_adicionales` (schema "propuesta-v2"). */
export interface DatosPropuesta {
  schema: "propuesta-v2";
  formulario: FormularioPropuesta;
  totales: TotalesPropuesta;
  condiciones: CondicionesPropuesta;
  vigencia_hasta: string;
  variacion_maxima_pct: number;
}

export const FORMAS_PAGO: Record<FormaPago, string> = {
  "50-50": "50 % de anticipo y 50 % al llegar a bodega",
  "30-70": "30 % de anticipo y 70 % antes del despacho",
  "100": "100 % anticipado",
};

export const VIAS: Record<Via, string> = { maritimo: "marítimo", aereo: "aéreo" };

/** Lo que el diseño fija para todas las importadoras. */
export const VARIACION_MAXIMA_PCT = 10;
export const IGUAL_PARA_TODAS = [
  `Precio cerrado en pesos, con IVA. Variación máxima de ${VARIACION_MAXIMA_PCT} % por supuestos declarados y con aprobación del cliente.`,
  "Punto de entrega exacto en cada propuesta.",
  "Propuesta completa en máximo 3 días hábiles.",
  "Documentos al cliente: factura electrónica, constancia de entrega y, si la pide, copia de la declaración de importación con levante.",
  "Pagos solo a tu cuenta registrada en Zarpi.",
  "Métricas de cumplimiento calculadas con la misma fórmula para todas.",
];
export const DOCUMENTOS_AL_CLIENTE =
  "factura electrónica, constancia de entrega y, a solicitud, copia de la declaración de importación con levante";

/**
 * Número escrito a la colombiana o a la inglesa: «1.700», «4,80», «3.920»,
 * «4.80». Un solo punto con uno o dos decimales es separador decimal; si no,
 * es de miles.
 */
export function leerNumero(x: string | number | null | undefined): number {
  let t = String(x ?? "").replace(/[^0-9.,]/g, "");
  if (!t) return NaN;
  const comas = t.split(",").length - 1;
  if (comas > 1) {
    t = t.replace(/,/g, "");
  } else if (comas === 1) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else {
    const partes = t.split(".");
    if (!(partes.length === 2 && partes[1].length > 0 && partes[1].length <= 2)) t = t.replace(/\./g, "");
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : NaN;
}

function miles(n: number, decimales: number): string {
  const s = decimales > 0 ? Math.abs(n).toFixed(decimales) : String(Math.round(Math.abs(n)));
  const [entera, frac] = s.split(".");
  let salida = entera.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (decimales > 0 && frac) salida += "," + frac;
  return (n < 0 ? "-" : "") + salida;
}

export function pesos(n: number | null | undefined): string {
  return n !== null && n !== undefined && Number.isFinite(n) ? "$" + miles(n, 0) : "—";
}

export function dolares(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return "USD " + miles(n, Math.abs(n - Math.round(n)) < 0.005 ? 0 : 2);
}

/** Para mostrar un número en un campo: «4,8», «1.700». */
export function numeroEnCampo(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  return miles(n, Math.abs(n - Math.round(n)) < 0.005 ? 0 : 2);
}

export function calcular(f: FormularioPropuesta): TotalesPropuesta {
  const productoUsd = f.precio_unitario_usd * f.cantidad;
  const productoCop = productoUsd * f.trm;
  const logisticaCop = f.logistica_moneda === "USD" ? f.logistica_valor * f.trm : f.logistica_valor;
  const entregaCop = f.entrega_modo === "fijo" ? f.entrega_valor_cop || 0 : 0;
  const subtotal = productoCop + logisticaCop + entregaCop;
  const iva = (subtotal * f.iva_pct) / 100;
  const total = subtotal + iva;
  return {
    producto_usd: Math.round(productoUsd * 100) / 100,
    producto_cop: Math.round(productoCop),
    logistica_cop: Math.round(logisticaCop),
    entrega_cop: Math.round(entregaCop),
    subtotal_cop: Math.round(subtotal),
    iva_cop: Math.round(iva),
    total_cop: Math.round(total),
    unitario_cop: Math.round(total / f.cantidad),
    unitario_usd: Math.round((total / f.cantidad / f.trm) * 100) / 100,
    total_usd: Math.round((total / f.trm) * 100) / 100,
  };
}

export function textoTiempo(f: Pick<FormularioPropuesta, "dias_min" | "dias_max" | "via">): string {
  return `De ${f.dias_min} a ${f.dias_max} días desde el anticipo, ${VIAS[f.via]}`;
}

/** Datos de una propuesta del formato nuevo, o null si es de las anteriores. */
export function leerPropuesta(texto: string | null | undefined): DatosPropuesta | null {
  if (!texto) return null;
  try {
    const datos = JSON.parse(texto) as Partial<DatosPropuesta> | null;
    if (datos && datos.schema === "propuesta-v2" && datos.totales && datos.formulario && datos.condiciones) {
      return datos as DatosPropuesta;
    }
  } catch {
    // Texto libre de las propuestas anteriores.
  }
  return null;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «28 oct 2026» a partir de «2026-10-28». */
export function fechaCorta(iso: string | null | undefined, conAnio = true): string {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!a || !m || !d) return "";
  return `${d} ${MESES[m - 1]}${conAnio ? ` ${a}` : ""}`;
}

export function sumarDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Cómo termina la entrega, en las palabras del diseño. */
export function resumenEntrega(f: FormularioPropuesta, empresa: string): string {
  if (f.entrega_modo === "cliente") {
    const aprox = f.flete_aprox_cop && f.flete_aprox_cop > 0 ? `, aprox. ${pesos(f.flete_aprox_cop)}` : "";
    return `Puesto en la bodega de ${empresa} en ${f.bodega_ciudad}. A ${f.ciudad_destino} va por transportadora y el flete lo pagas al recibir${aprox}.`;
  }
  return f.entrega_modo === "fijo"
    ? `Entregado en ${f.ciudad_destino}. El valor de la entrega va en el total.`
    : `Entregado en ${f.ciudad_destino}, incluido en el total.`;
}

/** Qué incluye y qué no, para la tarjeta del cliente. */
export function incluyeYNo(d: DatosPropuesta): { incluye: string[]; noIncluye: string[] } {
  const f = d.formulario;
  const incluye = ["compra en China", "flete internacional"];
  if (d.condiciones.seguro_incluido) incluye.push("seguro");
  incluye.push("nacionalización");
  const noIncluye: string[] = [];
  if (f.requiere_permisos && f.permiso_cual) {
    (f.permiso_gestiona === "importadora" ? incluye : noIncluye).push(f.permiso_cual.toLowerCase());
  }
  if (f.entrega_modo === "cliente") noIncluye.push(`el flete de ${f.bodega_ciudad} a ${f.ciudad_destino}`);
  else incluye.push(`entrega en ${f.ciudad_destino}`);
  incluye.push("factura electrónica");
  return { incluye, noIncluye };
}

export const CONDICIONES_POR_DEFECTO: CondicionesPropuesta = {
  bodega_ciudad: "",
  bodega_direccion: "",
  ciudades_entrega_incluida: [],
  entrega_otras_ciudades: "cliente",
  tiempo_maritimo: { minimo: 40, maximo: 50 },
  tiempo_aereo: { minimo: 15, maximo: 20 },
  vigencia_dias: 15,
  iva_pct: 19,
  forma_pago: "50-50",
  seguro_incluido: true,
  tolerancia_pct: 3,
  dias_reclamo: 3,
  cancelacion: {
    antes_orden: "Reintegro total.",
    en_fabricacion: "Se retienen los costos no recuperables acreditados.",
    despachada: "No se cancela.",
  },
  supuestos: "Cambio de peso o volumen frente a lo informado por el proveedor.",
};

/** Las condiciones completas, en líneas, para «Ver todas» y la tarjeta del cliente. */
export function lineasCondiciones(c: CondicionesPropuesta, empresa: string): string[] {
  return [
    `Pago: ${FORMAS_PAGO[c.forma_pago]}, solo a la cuenta de ${empresa} registrada en Zarpi.`,
    c.seguro_incluido ? "Seguro de transporte incluido." : "Seguro de transporte no incluido.",
    `Tolerancia de cantidad: ±${numeroEnCampo(c.tolerancia_pct)} %.`,
    `Faltantes o daños: el cliente los reporta hasta ${c.dias_reclamo} días hábiles después de la entrega.`,
    `Cancelación: antes de la orden al proveedor, ${minuscula(c.cancelacion.antes_orden)} En fabricación, ${minuscula(c.cancelacion.en_fabricacion)} Despachada, ${minuscula(c.cancelacion.despachada)}`,
    `Supuestos de precio: ${c.supuestos}`,
    `Documentos: ${DOCUMENTOS_AL_CLIENTE}.`,
  ];
}

function minuscula(texto: string): string {
  const t = texto.trim();
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}
