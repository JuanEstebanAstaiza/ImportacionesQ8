/** Tipos de Zarpi Maquilas, espejo de lo que devuelve `/maquilas/*`. */

export type EstadoMaquiladora = "registrada" | "en_revision" | "verificada" | "rechazada" | "suspendida";
export type BucketMaquilas = "medios" | "documentos";
export type TipoArchivoMaquila =
  | "foto" | "rut" | "camara_comercio" | "certificado"
  | "referencia" | "ficha_tecnica" | "muestra" | "evidencia" | "comprobante" | "adjunto" | "producto"
  | "marca" | "marca_archivo" | "diseno";
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
  metricas: MetricasMaquila;
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
  personalizaciones: { clave: string; nombre: string }[];
  productos_max: number;
  fotos_producto_max: number;
  criterios_calidad: Record<string, CriterioCalidad[]>;
  marcas_max: number;
  paleta_max: number;
  archivos_marca_max: number;
  tipos_encargo: TipoEncargo[];
  ruta_legal: PasoRutaParametro[];
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
  criterios_calidad: CriterioCalidad[];
  valida_hasta: string | null;
  vencida: boolean;
  estado: "enviada" | "aceptada" | "descartada" | "retirada";
  motivo_eleccion?: string | null;
  hilo: string;
}

export type ModalidadSolicitud = "dirigida" | "abierta" | "marca_blanca";

export interface Solicitud {
  id: string;
  codigo: string;
  modalidad: ModalidadSolicitud;
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
  ficha_guiada?: { clave: string; etiqueta: string; valor: string }[];
  producto: ProductoEnSolicitud | null;
  personalizacion: { clave: string; nombre: string }[];
  repite_de: { pedido_id: string; codigo: string } | null;
  /** Kit de marca adjunto (con confidencialidad, solo el nombre hasta el acuerdo). */
  marca: MarcaEnSolicitud | { nombre: string } | null;
  // Vista del cliente
  destinos?: { maquiladora_id: string; nombre_comercial: string; estado: "pendiente" | "propuesta" | "rechazada"; motivo?: string | null; hilo: string }[];
  propuestas?: Propuesta[];
  // Vista de la maquiladora
  mi_destino?: { estado: "pendiente" | "propuesta" | "rechazada"; motivo?: string | null; acuerdo_pendiente: boolean; nda_aceptado_en: string | null };
  mi_propuesta?: Propuesta | null;
  propuesta_anterior?: Propuesta | null;
  hilo?: string;
}

export interface SolicitudResumen {
  id: string;
  codigo: string;
  modalidad: ModalidadSolicitud;
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
  repite_de?: { pedido_id: string; codigo: string } | null;
}

export interface SolicitudEntrada {
  modalidad: ModalidadSolicitud;
  maquiladora_id?: string;
  producto_id?: string;
  personalizacion?: string[];
  ficha_guiada?: FichaGuiada | null;
  marca_id?: string | null;
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
  criterios_calidad: CriterioCalidad[];
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
  calidad: { criterios: CriterioCalidad[]; reportes: ReporteCalidad[]; etapa: boolean };
  resena: Resena | null;
  producto_mb_id: string | null;
  acciones: {
    enviar_muestra?: boolean;
    completar_etapa?: string | null;
    enviar_reporte_calidad?: boolean;
    revisar_comprobantes?: string[];
    responder_resena?: boolean;
    responder_muestra?: boolean;
    responder_calidad?: boolean;
    subir_comprobante?: string[];
    marcar_recibido?: boolean;
    resenar?: boolean;
    repetir?: boolean;
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

// ── Fase 3: marca blanca, ficha guiada, calidad, reseñas ────────────────────

export interface MetricasMaquila {
  calificacion: number | null;
  resenas: number;
  pedidos_entregados: number;
  /** % de pedidos entregados a tiempo. */
  cumplimiento: number | null;
  puntualidad: number | null;
  calidad: number | null;
  comunicacion: number | null;
}

export interface CriterioCalidad {
  criterio: string;
  tolerancia: string;
}

export interface ReporteCalidad {
  ronda: number;
  unidades_inspeccionadas: number;
  resultados: (CriterioCalidad & { cumple: boolean; observacion: string })[];
  fotos: ArchivoMaquila[];
  nota: string;
  estado: "enviado" | "aprobado" | "objetado";
  comentario: string;
  enviado_en: string | null;
  respondido_en: string | null;
}

export interface FichaGuiada {
  medidas: string;
  materiales: string;
  colores: string;
  acabados: string;
  empaque: string;
  etiquetado: string;
  notas: string;
}

export interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  categoria_nombre: string;
  descripcion: string;
  fotos: ArchivoMaquila[];
  tramos: Tramo[];
  precio_desde: number | null;
  pedido_minimo: number;
  personalizable: { clave: string; nombre: string }[];
  costo_muestra: number;
  dias_muestra: number | null;
  dias_produccion: number | null;
  pedidos: number;
  maquiladora: { id: string; nombre_comercial?: string; ciudad?: string; metricas?: MetricasMaquila | null };
  actualizado_en: string | null;
  // Solo la maquiladora y el equipo.
  activo?: boolean;
  oculto?: { motivo: string; en: string | null } | null;
  visible?: boolean;
}

export interface ProductoEntrada {
  nombre: string;
  categoria: string;
  descripcion: string;
  fotos: string[];
  tramos: Tramo[];
  pedido_minimo: number;
  personalizable: string[];
  costo_muestra: number;
  dias_muestra: number;
  dias_produccion: number;
  activo: boolean;
}

export interface ProductoEnSolicitud {
  id: string;
  nombre: string;
  tramos: Tramo[];
  pedido_minimo: number;
  costo_muestra: number;
  dias_muestra: number | null;
  dias_produccion: number | null;
  foto: ArchivoMaquila | null;
}

export interface Resena {
  id: string;
  pedido_id: string;
  producto: string | null;
  autor: string;
  calificacion: number;
  puntualidad: number;
  calidad: number;
  comunicacion: number;
  comentario: string;
  creado_en: string | null;
  respuesta: { texto: string; en: string | null } | null;
  // Maquiladora y equipo
  oculta?: { motivo: string; en: string | null } | null;
  maquiladora?: string | null;
}

export interface ResenaEntrada {
  calificacion: number;
  puntualidad: number;
  calidad: number;
  comunicacion: number;
  comentario: string;
}

// ── Fase 4: estudio de marca, encargos de diseño, equipo y panel ────────────

export interface ColorMarca {
  nombre: string;
  hex: string;
}

export interface TipoEncargo {
  clave: string;
  nombre: string;
  descripcion: string;
}

export interface PasoRutaParametro {
  clave: string;
  nombre: string;
  descripcion: string;
  enlace: string;
  categorias: string[];
}

export type EstadoPaso = "pendiente" | "en_curso" | "hecho" | "no_aplica";

export interface PasoRuta {
  clave: string;
  nombre: string;
  descripcion: string;
  enlace: string;
  estado: EstadoPaso;
  nota: string;
  actualizado_en: string | null;
}

export interface MarcaResumen {
  id: string;
  nombre: string;
  eslogan: string;
  categoria: string | null;
  categoria_nombre: string | null;
  logo: ArchivoMaquila | null;
  paleta: ColorMarca[];
  ruta_avance: { hechos: number; total: number };
  encargos_abiertos: number;
  actualizado_en: string | null;
}

export interface Marca extends MarcaResumen {
  descripcion: string;
  tipografias: string[];
  archivos: ArchivoMaquila[];
  ruta_legal: PasoRuta[];
  creado_en: string | null;
}

export interface MarcaEntrada {
  nombre: string;
  eslogan: string;
  descripcion: string;
  categoria: string | null;
  logo: string | null;
  paleta: ColorMarca[];
  tipografias: string[];
  archivos: string[];
}

export interface MarcaEnSolicitud {
  id: string;
  nombre: string;
  eslogan: string;
  logo: ArchivoMaquila | null;
  paleta: ColorMarca[];
  tipografias: string[];
  archivos: ArchivoMaquila[];
}

export type EstadoEncargo = "nuevo" | "en_proceso" | "entregado" | "cambios" | "aprobado" | "cancelado";

export interface EncargoResumen {
  id: string;
  codigo: string;
  tipo_nombre: string;
  estado: EstadoEncargo;
  estado_etiqueta: string;
  marca: { id: string; nombre?: string; eslogan: string; logo: ArchivoMaquila | null; paleta: ColorMarca[]; tipografias: string[] };
  cliente: { nombre?: string; empresa?: string | null };
  disenador: { id: string; nombre?: string | null } | null;
  version_vigente: number | null;
  creado_en: string | null;
  actualizado_en: string | null;
  pendiente_de_mi: boolean;
}

export interface Encargo extends Omit<EncargoResumen, "pendiente_de_mi"> {
  tipo: string;
  brief: string;
  referencias: ArchivoMaquila[];
  versiones: { numero: number; archivos: ArchivoMaquila[]; nota: string; estado: "enviada" | "aprobada" | "cambios"; comentario: string; entregada_en: string | null; respondida_en: string | null }[];
  acciones: { responder?: boolean; cancelar?: boolean; tomar?: boolean; entregar?: boolean };
  aprobado_en: string | null;
}

export interface Colaborador {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  rol: "dueno" | "colaborador";
  activo: boolean;
  creado_en: string | null;
}

export interface ResumenAdminMaquilas {
  maquiladoras: Record<string, number>;
  solicitudes: Record<string, number>;
  solicitudes_30_dias: number;
  solicitudes_por_modalidad: Record<string, number>;
  solicitudes_sin_propuesta: number;
  pedidos: Record<string, number>;
  pedidos_activos: number;
  valor_activo: number;
  pedidos_retrasados: number;
  comprobantes_por_revisar: number;
  entregados_30_dias: { n: number; valor: number };
  resenas: { n: number; promedio: number | null };
  productos_publicados: number;
  marcas: number;
  encargos: Record<string, number>;
  mejores_maquilas: { id: string; nombre_comercial: string; ciudad: string; metricas: MetricasMaquila }[];
}

export interface SolicitudAdmin {
  id: string;
  codigo: string;
  modalidad: ModalidadSolicitud;
  estado: EstadoSolicitud;
  estado_etiqueta: string;
  categoria_nombre: string;
  titulo: string;
  cantidad: number;
  cliente: { nombre?: string; empresa?: string | null };
  creado_en: string | null;
  pedido_id: string | null;
  destinos: number;
  propuestas: number;
}

export interface PedidoAdmin {
  id: string;
  codigo: string;
  estado: EstadoPedido;
  estado_etiqueta: string;
  producto: string;
  cantidad: number;
  total: number;
  pagado: number;
  cliente: { nombre?: string; empresa?: string | null };
  maquiladora: { id: string; nombre_comercial?: string; ciudad?: string };
  fecha_compromiso: string | null;
  retrasado: boolean;
  etapas_hechas: number;
  etapas_total: number;
  aviso_cliente: string | null;
  aviso_maquila: string | null;
  creado_en: string | null;
}

/** Lo que devuelve `GET /maquilas/admin/configuracion` (todos los parámetros). */
export type ConfiguracionMaquilas = ParametrosMaquilas & {
  cupo_abierta: number;
  versiones_max: number;
  colaboradores_max: number;
  [clave: string]: unknown;
};
