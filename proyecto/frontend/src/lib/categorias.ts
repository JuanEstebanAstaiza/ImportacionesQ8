/**
 * Vocabulario único de líneas de producto / especialidades.
 *
 * Antes había dos listas distintas: `LINES` alimentaba el selector "Línea de
 * producto" del formulario de cotización y `ALL_CATEGORIES` las "Categorías"
 * del perfil de la empresa. No coincidían ("Químicos" frente a "Química",
 * "Confección" solo en una de las dos, "Automotriz" solo en la otra), y como el
 * backend comparaba cadenas exactas había líneas que ningún importador podía
 * responder jamás: la empresa veía la cotización y recibía un 400 al pulsar
 * "Responder", que se leía como un problema de permisos.
 *
 * El backend replica este listado en `proyecto/backend/utils/categorias.py` y
 * además compara de forma tolerante (tildes, plurales, variantes léxicas) para
 * que los datos ya guardados sigan encajando. Si se añade una categoría hay que
 * tocar los dos ficheros.
 */
export const CATEGORIAS_PRODUCTO = [
  "Tecnología",
  "Electrónica",
  "Software",
  "Textil",
  "Confección",
  "Alimentos",
  "Bebidas",
  "Agroindustria",
  "Maquinaria",
  "Industrial",
  "Automotriz",
  "Construcción",
  "Química",
  "Farmacéutico",
  "Consumo masivo",
  "Seguridad",
  "Televenta",
] as const;

export type CategoriaProducto = (typeof CATEGORIAS_PRODUCTO)[number];
