/**
 * Calculadora de costo y margen (función pura, sin estado ni red).
 *
 * Costo por unidad = fabricación + empaque + etiquetas + (envío + costos fijos) / cantidad.
 * Precio sugerido (antes de IVA) = costo / (1 − comisión − margen), para que, después
 * de pagar la comisión del canal, quede el margen pedido sobre el precio.
 * Punto de equilibrio = unidades a vender para recuperar la inversión del lote.
 */

export interface EntradaCalculadora {
  /** Precio por unidad que cobra la maquila. */
  costoFabricacion: number;
  cantidad: number;
  empaque: number;
  etiquetas: number;
  /** Flete del lote completo. */
  envio: number;
  /** Diseño, muestra, registros… del lote completo. */
  costosFijos: number;
  /** IVA u otro impuesto al consumidor, en %. */
  impuesto: number;
  /** Comisión de la tienda, marketplace o pasarela, en %. */
  comision: number;
  /** Margen que quieres ganar sobre el precio (antes de impuestos), en %. */
  margen: number;
  /** Si ya tienes un precio al público (con impuesto), para ver cuánto ganas. */
  precioPropio?: number | null;
}

export interface ResultadoCalculadora {
  costoUnitario: number;
  inversion: number;
  /** Precio antes de impuesto con el margen pedido; null si comisión + margen ≥ 100 %. */
  precioSugerido: number | null;
  precioSugeridoConImpuesto: number | null;
  gananciaSugerida: number | null;
  /** Con el precio propio (o el sugerido si no hay propio). */
  precioAnalizado: number | null;
  gananciaUnidad: number | null;
  margenReal: number | null;
  puntoEquilibrio: number | null;
  gananciaLote: number | null;
}

const pct = (v: number) => Math.max(0, v) / 100;

export function calcular(e: EntradaCalculadora): ResultadoCalculadora {
  const cantidad = Math.max(1, Math.floor(e.cantidad) || 1);
  const costoUnitario = Math.max(0, e.costoFabricacion) + Math.max(0, e.empaque) + Math.max(0, e.etiquetas)
    + (Math.max(0, e.envio) + Math.max(0, e.costosFijos)) / cantidad;
  const inversion = costoUnitario * cantidad;
  const divisor = 1 - pct(e.comision) - pct(e.margen);
  const precioSugerido = divisor > 0 ? costoUnitario / divisor : null;
  const conImpuesto = (precio: number) => precio * (1 + pct(e.impuesto));
  const gananciaDe = (precio: number) => precio * (1 - pct(e.comision)) - costoUnitario;

  // El precio propio viene con impuesto incluido (como se ve en la vitrina).
  const precioAnalizado = e.precioPropio && e.precioPropio > 0 ? e.precioPropio / (1 + pct(e.impuesto)) : precioSugerido;
  const neto = precioAnalizado !== null ? precioAnalizado * (1 - pct(e.comision)) : null;
  const gananciaUnidad = precioAnalizado !== null ? gananciaDe(precioAnalizado) : null;
  return {
    costoUnitario,
    inversion,
    precioSugerido,
    precioSugeridoConImpuesto: precioSugerido !== null ? conImpuesto(precioSugerido) : null,
    gananciaSugerida: precioSugerido !== null ? gananciaDe(precioSugerido) : null,
    precioAnalizado,
    gananciaUnidad,
    margenReal: precioAnalizado && gananciaUnidad !== null ? (gananciaUnidad / precioAnalizado) * 100 : null,
    puntoEquilibrio: neto && neto > 0 ? Math.ceil(inversion / neto) : null,
    gananciaLote: gananciaUnidad !== null ? gananciaUnidad * cantidad : null,
  };
}
