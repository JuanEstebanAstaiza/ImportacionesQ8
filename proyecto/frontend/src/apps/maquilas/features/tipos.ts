/** Tipos de Zarpi Maquilas, espejo de lo que devuelve `/maquilas/*`. */

export type EstadoMaquiladora = "registrada" | "en_revision" | "verificada" | "rechazada" | "suspendida";
export type BucketMaquilas = "medios" | "documentos";
export type TipoArchivoMaquila = "foto" | "rut" | "camara_comercio" | "certificado";
export type TipoDocumento = "CC" | "CE" | "PPT" | "Pasaporte" | "NIT" | "DNI";

export interface ArchivoMaquila {
  id: string;
  bucket: BucketMaquilas;
  nombre: string;
  content_type: string;
  tamano: number;
  url: string;
  tipo?: TipoArchivoMaquila;
}

export interface CategoriaMaquila {
  clave: string;
  nombre: string;
}

export interface ParametrosMaquilas {
  categorias: CategoriaMaquila[];
  procesos: string[];
  certificaciones: string[];
  fotos_galeria_max: number;
  certificados_max: number;
  mb_max_foto: number;
  mb_max_documento: number;
}

export interface Maquiladora {
  id: string;
  estado: EstadoMaquiladora;
  estado_etiqueta: string;
  razon_social: string;
  nombre_comercial: string;
  ciudad: string;
  descripcion: string;
  categorias: string[];
  procesos: string[];
  certificaciones: string[];
  pedido_minimo: number | null;
  capacidad_mensual: number | null;
  dias_muestra: number | null;
  dias_produccion: number | null;
  sitio_web: string | null;
  galeria: ArchivoMaquila[];
  verificada_en: string | null;
  // Solo para la maquiladora y el equipo de Zarpi.
  nit?: string;
  direccion?: string | null;
  telefono?: string | null;
  representante?: { nombre?: string; apellido?: string; email?: string; telefono?: string; tipo_documento?: string; numero_documento?: string };
  documentos?: { rut: ArchivoMaquila | null; camara_comercio: ArchivoMaquila | null; certificados: ArchivoMaquila[] };
  motivo?: string | null;
  enviada_en?: string | null;
  creado_en?: string | null;
  creada_por_equipo?: boolean;
  pendientes?: string[];
  mi_rol?: "dueno" | "colaborador";
}

export interface EmpresaEntrada {
  razon_social: string;
  nombre_comercial: string;
  nit: string;
  ciudad: string;
  direccion?: string;
  telefono?: string;
  sitio_web?: string;
}

export interface RepresentanteEntrada {
  nombre: string;
  apellido: string;
  tipo_documento: TipoDocumento;
  numero_documento: string;
  indicativo_pais_telefono: string;
  telefono: string;
  email: string;
  password: string;
}

export interface FabricacionEntrada {
  categorias: string[];
  procesos: string[];
  pedido_minimo: number;
  capacidad_mensual?: number | null;
  dias_muestra?: number | null;
  dias_produccion?: number | null;
}

export interface RegistroMaquilaEntrada {
  empresa: EmpresaEntrada;
  representante: RepresentanteEntrada;
  fabricacion: FabricacionEntrada;
  acepto_politica_datos: boolean;
}

export type PerfilEntrada = Partial<Omit<EmpresaEntrada, "nit" | "razon_social">> & Partial<FabricacionEntrada> & {
  razon_social?: string;
  nit?: string;
  descripcion?: string;
  certificaciones?: string[];
};

export interface DocumentosEntrada {
  rut?: string;
  camara_comercio?: string;
  certificados?: string[];
  galeria?: string[];
}

export interface ListadoMaquiladoras {
  maquiladoras: Maquiladora[];
  contadores: Record<EstadoMaquiladora, number>;
}
