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
  tendenciaEdicionId?: string | null;
  tendenciaProductoId?: string;
  catalogoProductoId?: string;
  /** Desde un catálogo la solicitud va dirigida a la empresa dueña. */
  importadorId?: string;
}
