/** Tipos de Zarpi Maquilas, espejo de lo que devuelve `/maquilas/*`. */

export type EstadoMaquiladora = "registrada" | "en_revision" | "verificada" | "rechazada" | "suspendida";
export type BucketMaquilas = "medios" | "documentos";
export type TipoArchivoMaquila =
  | "foto" | "rut" | "camara_comercio" | "certificado"
  | "referencia" | "ficha_tecnica" | "muestra" | "evidencia" | "comprobante" | "adjunto";
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

export interface ParametrosMaquilas extends ParametrosFabricacion {
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

// ── Fase 2: solicitudes, propuestas, pedidos y chat ─────────────────────────

export interface CampoPlantilla {
  clave: string;
  etiqueta: string;
  tipo: "texto" | "texto_largo";
  ayuda?: string;
}

export interface ParametrosFabricacion {
  plantillas: Record<string, CampoPlantilla[]>;
  etapas: { clave: string; nombre: string }[];
  hitos: { clave: string; nombre: string }[];
  hitos_por_defecto: Record<string, number>;
  mb_max_video: number;
}

export type EstadoSolicitud = "abierta" | "con_propuestas" | "aceptada" | "cancelada";

export interface Tramo {
  cantidad_min: number;
  precio_unitario: number;
}

export interface HitoMonto {
  clave: string;
  nombre: string;
  porcentaje: number;
  monto: number;
}

export interface Propuesta {
  id: string;
  maquiladora: { id: string; nombre_comercial: string; ciudad: string; verificada: boolean };
  tramos: Tramo[];
  precio_unitario: number;
  costo_muestra: number;
  total: number;
  dias_muestra: number;
  dias_produccion: number;
  hitos: HitoMonto[];
  condiciones: string;
  valida_hasta: string | null;
  vencida: boolean;
  estado: "enviada" | "aceptada" | "descartada" | "retirada";
  motivo_eleccion?: string | null;
  hilo: string;
}

export interface Solicitud {
  id: string;
  codigo: string;
  modalidad: "dirigida" | "abierta";
  estado: EstadoSolicitud;
  estado_etiqueta: string;
  categoria: string;
  categoria_nombre: string;
  titulo: string;
  cantidad: number;
  ciudad_entrega: string;
  fecha_objetivo: string | null;
  presupuesto_unitario: number | null;
  confidencial: boolean;
  cliente: { nombre?: string; empresa?: string | null };
  creado_en: string | null;
  pedido_id: string | null;
  detalle_visible: boolean;
  descripcion?: string;
  campos?: { clave: string; etiqueta: string; valor: string }[];
  referencias?: ArchivoMaquila[];
  ficha_tecnica?: ArchivoMaquila | null;
  // Vista del cliente
  destinos?: { maquiladora_id: string; nombre_comercial: string; estado: "pendiente" | "propuesta" | "rechazada"; motivo?: string | null; hilo: string }[];
  propuestas?: Propuesta[];
  // Vista de la maquiladora
  mi_destino?: { estado: "pendiente" | "propuesta" | "rechazada"; motivo?: string | null; acuerdo_pendiente: boolean; nda_aceptado_en: string | null };
  mi_propuesta?: Propuesta | null;
  hilo?: string;
}

export interface SolicitudResumen {
  id: string;
  codigo: string;
  modalidad: "dirigida" | "abierta";
  estado: EstadoSolicitud;
  estado_etiqueta: string;
  categoria_nombre: string;
  titulo: string;
  cantidad: number;
  creado_en: string | null;
  pedido_id: string | null;
  propuestas?: number;
  destinos?: number;
  ciudad_entrega?: string;
  fecha_objetivo?: string | null;
  confidencial?: boolean;
  mi_destino?: Solicitud["mi_destino"];
  mi_propuesta_estado?: Propuesta["estado"] | null;
}

export interface SolicitudEntrada {
  modalidad: "dirigida" | "abierta";
  maquiladora_id?: string;
  categoria: string;
  titulo: string;
  descripcion: string;
  cantidad: number;
  presupuesto_unitario?: number | null;
  fecha_objetivo?: string | null;
  ciudad_entrega: string;
  campos: Record<string, string>;
  referencias: string[];
  ficha_tecnica?: string | null;
  confidencial: boolean;
}

export interface PropuestaEntrada {
  tramos: Tramo[];
  costo_muestra: number;
  dias_muestra: number;
  dias_produccion: number;
  hitos: Record<string, number>;
  condiciones: string;
  validez_dias: number;
}

export type EstadoPedido = "muestra" | "produccion" | "despachado" | "entregado" | "cancelado";

export interface Pedido {
  id: string;
  codigo: string;
  solicitud_id: string;
  hilo: string;
  lado: "cliente" | "maquiladora" | "equipo";
  estado: EstadoPedido;
  estado_etiqueta: string;
  producto: string;
  categoria: string;
  cantidad: number;
  precio_unitario: number;
  costo_muestra: number;
  total: number;
  pagado: number;
  dias_muestra: number;
  dias_produccion: number;
  condiciones: string;
  fecha_compromiso: string | null;
  retrasado: boolean;
  cliente: { nombre?: string; empresa?: string | null };
  maquiladora: { id: string; nombre_comercial?: string; ciudad?: string };
  muestras: { ronda: number; archivos: ArchivoMaquila[]; nota: string; estado: "enviada" | "aprobada" | "ajustes"; comentario: string; enviada_en: string | null; respondida_en: string | null }[];
  etapas: { clave: string; nombre: string; estado: "pendiente" | "en_curso" | "hecha"; completada_en: string | null; nota: string; fotos: ArchivoMaquila[] }[];
  etapa_siguiente: string | null;
  hitos: (HitoMonto & { estado: "pendiente" | "enviado" | "confirmado" | "rechazado"; motivo_rechazo: string | null; confirmado_en: string | null;
    comprobantes: { archivo: ArchivoMaquila; nota: string; subido_en: string | null }[] })[];
  acciones: {
    enviar_muestra?: boolean;
    completar_etapa?: string | null;
    revisar_comprobantes?: string[];
    responder_muestra?: boolean;
    subir_comprobante?: string[];
    marcar_recibido?: boolean;
    cancelar?: boolean;
  };
  bloqueo: string | null;
  creado_en: string | null;
  entregado_en: string | null;
  cancelacion: { por: "cliente" | "maquiladora"; motivo: string; en: string | null } | null;
}

export interface PedidoResumen {
  id: string;
  codigo: string;
  lado: "cliente" | "maquiladora" | "equipo";
  estado: EstadoPedido;
  estado_etiqueta: string;
  producto: string;
  cantidad: number;
  total: number;
  pagado: number;
  fecha_compromiso: string | null;
  retrasado: boolean;
  cliente: { nombre?: string; empresa?: string | null };
  maquiladora: { id: string; nombre_comercial?: string };
  creado_en: string | null;
  bloqueo: string | null;
  etapas_hechas: number;
  etapas_total: number;
  pendiente_de_mi: boolean;
}

export interface MensajeHilo {
  id: string;
  tipo: "texto" | "archivo" | "sistema";
  contenido: string;
  lado: "cliente" | "maquiladora" | null;
  remitente_nombre?: string | null;
  remitente_id?: string | null;
  archivo: ArchivoMaquila | null;
  fecha: string | null;
}
