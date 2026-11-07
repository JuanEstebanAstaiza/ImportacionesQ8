/** Tipos de Zarpi Liquidaciones, espejo de lo que sirve `/liquidaciones/*`. */

export type Condicion = "nuevo" | "devolucion" | "empaque_abierto" | "con_averias";
export type Entrega = "vendedor_despacha" | "comprador_recoge";
export type UnidadVenta = "unidades" | "juegos" | "cajas" | "paquetes" | "pares" | "kilos";
export type EstadoLote = "en_revision" | "publicado" | "rechazado" | "reservado" | "vendido" | "cerrado_sin_venta";
export type EstadoOperacion = "activa" | "vendida" | "cancelada" | "vencida";
export type LadoOperacion = "comprador" | "vendedor" | "equipo";
export type TipoArchivo = "foto" | "video" | "ficha_tecnica" | "comprobante_pago" | "factura" | "rut";
export type BucketLiquidaciones = "medios" | "documentos";

export interface MedioRef {
  id: string;
  url: string;
}

export interface DocumentoRef extends MedioRef {
  nombre?: string;
  content_type?: string;
  tamano?: number;
  subido_en?: string;
}

export interface ArchivoSubido {
  id: string;
  bucket: BucketLiquidaciones;
  tipo: TipoArchivo;
  nombre: string;
  content_type: string;
  tamano: number;
  url: string;
}

export interface Lote {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  unidades: number;
  unidad_venta: UnidadVenta;
  condicion: Condicion;
  detalle_condicion: string | null;
  fotos: MedioRef[];
  videos: MedioRef[];
  ficha_tecnica: DocumentoRef | null;
  precio_cop: number;
  precio_unidad_cop: number;
  ciudad: string;
  entrega: Entrega;
  requiere_registro_sanitario: boolean;
  registro_sanitario: string | null;
  dias_cierre: number;
  cierra_en: string | null;
  destacado: boolean;
  estado: EstadoLote;
  vendedor: { razon_social: string | null; nit: string | null; ciudad: string | null };
  es_mio: boolean;
  publicado_en: string | null;
  enviado_en: string | null;
  creado_en: string | null;
  rechazo?: { motivos: string[]; nota: string | null; fecha: string | null } | null;
  cuenta_vendedor?: string;
  mi_operacion_id?: string | null;
  /** Solo en «Mis liquidaciones»: la reserva viva del lote. */
  operacion?: { id: string; vence_en: string } | null;
}

export type LoteEntrada = Pick<Lote, "nombre" | "descripcion" | "categoria" | "unidades" | "unidad_venta" | "condicion"
  | "precio_cop" | "ciudad" | "entrega" | "requiere_registro_sanitario" | "dias_cierre" | "destacado"> & {
  detalle_condicion: string | null;
  registro_sanitario: string | null;
  fotos: string[];
  videos: string[];
  ficha_tecnica_id: string | null;
};

export interface FiltrosCatalogo {
  q?: string;
  categoria?: string;
  ciudad?: string;
  condicion?: Condicion | "";
  entrega?: Entrega | "";
}

export interface CatalogoLotes {
  destacados: Lote[];
  lotes: Lote[];
  disponibles: number;
  publicados: number;
  ciudades: string[];
  categorias: string[];
}

export interface MisLotes {
  contadores: { disponibles: number; pendientes: number; reservadas: number; vendidas: number };
  lotes: Lote[];
}

export interface Contacto {
  razon_social: string | null;
  nit: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  ciudad: string | null;
}

export interface OperacionResumen {
  id: string;
  lote_id: string;
  lote: {
    nombre: string;
    unidades: number;
    unidad_venta?: UnidadVenta;
    precio_cop: number;
    entrega: Entrega;
    ciudad?: string;
    foto: MedioRef | null;
  };
  estado: EstadoOperacion;
  lado: LadoOperacion | null;
  vendedor: { razon_social: string | null; nit: string | null } | null;
  comprador: { razon_social: string | null; nit: string | null } | null;
  contraparte: { razon_social: string | null; nit: string | null } | null;
  reservada_en: string;
  vence_en: string;
  cerrada_en: string | null;
  total_mensajes: number;
  ultimo_mensaje_en: string | null;
}

export interface MensajeOperacion {
  id: string;
  tipo: "texto" | "sistema" | "archivo";
  autor: "yo" | "contraparte" | "sistema" | "equipo";
  remitente_nombre: string | null;
  contenido: string;
  archivo: DocumentoRef | null;
  fecha: string;
}

export interface Operacion extends OperacionResumen {
  contactos: { vendedor: Contacto | null; comprador: Contacto | null };
  comprobantes_pago: DocumentoRef[];
  facturas: DocumentoRef[];
  mensajes: MensajeOperacion[];
}

export interface Activacion {
  cuenta: string;
  razon_social: string;
  nit: string;
  tipo_persona: "juridica" | "natural";
  contacto: string;
  ciudad: string;
  direccion: string;
  telefono: string;
  email: string | null;
  es_empresa: boolean;
  suspendida: boolean;
  activada_en: string | null;
  rut?: DocumentoRef | null;
  motivo_suspension?: string | null;
}

export interface EstadoActivacion {
  activa: boolean;
  activacion: Activacion | null;
  prellenado: Pick<Activacion, "razon_social" | "nit" | "tipo_persona" | "contacto" | "ciudad" | "direccion" | "telefono" | "email">;
  puede_publicar: boolean;
}

export interface CuentaAdmin extends Activacion {
  lotes: number;
  compras: number;
}

export interface ParametrosPublicos {
  dias_max_cierre: number;
  horas_para_confirmar: number;
  fotos_min: number;
  fotos_max: number;
  videos_max: number;
  mb_max_foto: number;
  mb_max_video: number;
  mb_max_documento: number;
  categorias: string[];
}

export interface ParametrosLiquidaciones extends ParametrosPublicos {
  motivos_rechazo: string[];
  checklist_revision: string[];
}

export interface MetricasLiquidaciones {
  publicados: number;
  en_revision: number;
  reservas_activas: number;
  vendidos_30d: number;
  valor_vendido_30d_cop: number;
  vencidas_30d: number;
  canceladas_30d: number;
  tasa_venta_30d: number | null;
  horas_promedio_revision: number | null;
  cuentas_activadas: number;
  cuentas_suspendidas: number;
}
