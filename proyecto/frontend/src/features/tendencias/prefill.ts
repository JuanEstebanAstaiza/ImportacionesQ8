/**
 * Producto que se lleva al formulario de nueva solicitud al pulsar «Pedir
 * propuestas» desde Tendencias o desde el catálogo de una empresa. App.tsx lo
 * convierte en el prefill del asistente y en los campos de origen que el
 * backend usa para medir cuántas solicitudes trae cada edición y producto.
 */
export interface PrefillSolicitud {
  origen: "tendencias" | "catalogo";
  nombre: string;
  /** Texto de «Qué pedir en la cotización» (o la descripción del producto). */
  descripcion: string;
  lineaProducto: string | null;
  pais: string;
  fotos: string[];
  cantidadMinima?: number | null;
  unidad?: "unidades" | "m3";
  /** Muestra en el formulario el aviso de revisar requisitos de importación. */
  revisarRequisitos?: boolean;
  /** Ficha de Tendencias de la que nace la solicitud (queda atribuida a ella). */
  tendenciaItemId?: string;
  /** Enlace del video de referencia (TikTok, Instagram o YouTube). */
  urlVideo?: string;
  catalogoProductoId?: string;
  /** Desde un catálogo, o una ficha que recomienda una importadora, la solicitud va dirigida a ella. */
  importadorId?: string;
}
