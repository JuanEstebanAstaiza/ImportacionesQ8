/**
 * Vista previa del shipping mark (marca de embarque).
 *
 * La marca que va rotulada en las cajas se forma con el prefijo fijo de la
 * empresa importadora ("ctl") y el sufijo que escribe el cliente al pedir la
 * cotización ("prendas control"), dando "ctl-prendascontrol". Así se distingue
 * la carga de cada cliente dentro del contenedor de la importadora.
 *
 * Esto es solo para enseñar el resultado mientras se escribe: quien compone la
 * marca de verdad es el backend (`proyecto/backend/utils/shipping_mark.py`), y
 * las reglas de normalización tienen que ser las mismas para que lo que se ve
 * aquí sea lo que acaba impreso en el cartón.
 */
export const LONGITUD_MAX_PREFIJO_SHIPPING_MARK = 12;
export const LONGITUD_MAX_SUFIJO_SHIPPING_MARK = 40;

/** Deja solo minúsculas y dígitos ASCII: es lo que se puede estarcir y leer en aduana. */
export function normalizarSegmentoShippingMark(valor: string | null | undefined): string {
  if (!valor) {
    return "";
  }

  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** `("ctl", "prendas control")` → `"ctl-prendascontrol"`. Cadena vacía si falta una parte. */
export function componerShippingMark(
  prefijo: string | null | undefined,
  sufijo: string | null | undefined,
): string {
  const inicio = normalizarSegmentoShippingMark(prefijo);
  const final = normalizarSegmentoShippingMark(sufijo);
  if (!inicio || !final) {
    return "";
  }
  return `${inicio}-${final}`;
}
