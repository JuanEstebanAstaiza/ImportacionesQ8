export type LegalPage = "data" | "terms" | "payments";

/**
 * Un bloque es un párrafo (texto) o una lista de viñetas (arreglo de textos).
 * Basta para los documentos legales y evita guardar HTML en el contenido.
 */
export type LegalBlock = string | string[];

export interface LegalSection {
  titulo: string;
  bloques: LegalBlock[];
}

export interface LegalDocument {
  titulo: string;
  /** Una frase que resume el documento, bajo el título (los Términos no la llevan). */
  resumen?: string;
  version: string;
  vigenteDesde: string;
  /** Encabezado del cuadro final con los datos de la empresa. */
  tituloDatos: string;
  /** Los Términos incluyen la matrícula mercantil en ese cuadro. */
  mostrarMatricula?: boolean;
  secciones: LegalSection[];
}
