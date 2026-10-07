import { apiRequest } from "@/services/api-client";

/**
 * Tendencias semanales: microcatálogo curado por Zarpi, de acceso por
 * suscripción. Ver backend/routers/tendencias.py.
 */

export type PresetEstilo = "lavanda" | "violeta" | "amarillo" | "noche";
export type EstadoEdicion = "borrador" | "programada" | "publicada" | "archivada";
export type ModoTransporte = "mar" | "aereo";
export type EstadoProducto =
  | "todo_el_anio"
  | "pidelo_ya"
  | "ventana_abierta"
  | "futura"
  | "solo_aereo"
  | "fuera_de_tiempo";

export interface LimiteFecha {
  /** YYYY-MM-DD, hora de Bogotá. */
  fecha: string;
  dias_puerta_a_puerta: number;
  /** La fecha se adelantó por el cierre de fábricas del Año Nuevo Lunar. */
  aviso_cierre_fabricas: boolean;
}

export interface FechasProducto {
  fecha_en_bodega: string | null;
  limite_mar: LimiteFecha | null;
  limite_aereo: LimiteFecha | null;
  /** "Pídelo antes del 12 de octubre (estimado con 75 días por mar)" */
  texto_mar: string | null;
  texto_aereo: string | null;
  estado: EstadoProducto;
  /** "Pídelo esta semana", "Ventana abierta · quedan N días", "Solo aéreo"... */
  estado_texto: string;
  dias_restantes: number | null;
}

export interface TemporadaResumen {
  id: string;
  nombre: string;
  fecha: string;
}

export interface ProductoTendencia {
  id: string;
  nombre: string;
  categoria_visible: string;
  linea_producto: string | null;
  pais_origen: string;
  /** Rutas de archivo (`/documentos/archivos/{id}/descargar`); requieren sesión. */
  fotos: string[];
  /** Video 16:9 para pantallas anchas. */
  video_horizontal: string | null;
  /** Video 9:16 para celulares. Si falta uno, se muestra el otro en todas las pantallas. */
  video_vertical: string | null;
  por_que_ahora: string;
  temporada: TemporadaResumen | null;
  transporte_sugerido: ModoTransporte;
  dias_mar: number | null;
  dias_aereo: number | null;
  revisar_requisitos: boolean;
  para_negocio: boolean;
  guia_para_quien: string | null;
  guia_angulos: string[];
  guia_donde: string | null;
  guia_contenido: string | null;
  que_pedir_en_cotizacion: string | null;
  pagina_prueba: boolean;
  fechas: FechasProducto;
  guardado: boolean;
  destacado: boolean;
  orden: number;
}

export interface PortadaEdicion {
  id: string;
  numero: number;
  semana_inicio: string;
  titulo_linea1: string;
  titulo_linea2: string;
  subtitulo: string;
  preset_estilo: PresetEstilo;
  estado: EstadoEdicion;
  /** ISO en UTC con "Z". */
  publicar_en: string | null;
  publicada_en: string | null;
}

export interface EdicionCompleta extends PortadaEdicion {
  productos: ProductoTendencia[];
  pie: string;
}

export interface TemporadaConLimites {
  id: string;
  nombre: string;
  fecha: string;
  ejemplos: string | null;
  fechas: FechasProducto;
}

export interface AccesoTendencias {
  tiene_acceso: boolean;
  es_curador: boolean;
  origen: "pago" | "cortesia" | null;
  vigente_hasta: string | null;
  /** Precio en COP de un periodo. null: la suscripción no está a la venta. */
  precio_cop: number | null;
  dias_suscripcion: number;
  venta_habilitada: boolean;
  /** WOMPI_SIMULATE: en local se puede confirmar el pago sin pasarela. */
  pago_simulado: boolean;
  aviso_suscrito: boolean;
}

export interface CheckoutSuscripcion {
  pago_id: string;
  wompi_payment_id: string;
  checkout_url: string;
  monto_cop: number;
  dias: number;
  pago_simulado: boolean;
}

export interface PortadaSinAcceso {
  edicion: PortadaEdicion | null;
  total_productos?: number;
  categorias?: string[];
  pie?: string;
}

export interface EdicionActual {
  edicion: EdicionCompleta | null;
  /** Próximas 4 temporadas que todavía se alcanzan a pedir. */
  pide_a_tiempo: TemporadaConLimites[];
  hoy: string;
  pie: string;
}

export interface CierreFabricas {
  id?: string;
  inicio: string;
  fin: string;
  fin_produccion_previa: string;
}

export interface Calendario {
  hoy: string;
  hasta: string;
  temporadas: TemporadaConLimites[];
  cierres: CierreFabricas[];
  parametros: { dias_mar: number; dias_aereo: number; dias_produccion: number };
  pie: string;
}

export interface ProductoGuardado extends ProductoTendencia {
  edicion_id: string | null;
  guardado_en: string;
}

export type EventoCliente =
  | "edicion_vista"
  | "producto_visto"
  | "modo_cambiado"
  | "pedir_propuestas_clic"
  | "calendario_visto"
  | "aviso_abierto"
  | "video_reproducido";

// ── Curaduría ────────────────────────────────────────────────────────────────

export interface EdicionCurador extends EdicionCompleta {
  fecha_referencia: string;
  /** Hora de publicación en Bogotá, ISO sin zona. */
  publicar_en_bogota: string | null;
  /** Lo que impide programarla (sin productos, sin destacado...). */
  problemas: string[];
  /** Productos que a la fecha de publicación ya no llegan ni por aéreo. */
  fuera_de_tiempo: string[];
}

export interface EdicionListado extends PortadaEdicion {
  total_productos: number;
}

export interface ProductoCurador extends ProductoTendencia {
  temporada_id: string | null;
  fecha_en_bodega_explicita: string | null;
  ediciones?: { id: string; numero: number; estado: EstadoEdicion }[];
}

export interface ProductoDatos {
  nombre: string;
  categoria_visible: string;
  linea_producto?: string | null;
  pais_origen?: string;
  fotos: string[];
  video_horizontal?: string | null;
  video_vertical?: string | null;
  por_que_ahora: string;
  temporada_id?: string | null;
  fecha_en_bodega?: string | null;
  transporte_sugerido?: ModoTransporte;
  dias_mar?: number | null;
  dias_aereo?: number | null;
  revisar_requisitos?: boolean;
  para_negocio?: boolean;
  guia_para_quien?: string | null;
  guia_angulos?: string[];
  guia_donde?: string | null;
  guia_contenido?: string | null;
  que_pedir_en_cotizacion?: string | null;
}

export interface EdicionDatos {
  semana_inicio: string;
  titulo_linea1: string;
  titulo_linea2: string;
  subtitulo: string;
  preset_estilo: PresetEstilo;
}

export interface Temporada {
  id: string;
  nombre: string;
  fecha: string;
  ejemplos: string | null;
}

export interface ParametrosTendencias {
  dias_mar: number;
  dias_aereo: number;
  dias_produccion: number;
  precio_cop: number | null;
  dias_suscripcion: number;
}

export interface CambioTendencias {
  id: string;
  edicion_id: string | null;
  producto_id: string | null;
  usuario: string;
  accion: string;
  sobre_publicada: boolean;
  datos: Record<string, unknown> | null;
  fecha: string;
}

export interface MetricasConteo {
  vistas: number;
  guardados: number;
  clics_pedir_propuestas: number;
  solicitudes: number;
  operaciones: number;
}

export interface MetricasEdicion extends PortadaEdicion, MetricasConteo {
  productos: (MetricasConteo & { id: string; nombre: string })[];
}

export interface AccesoAdmin {
  id: string;
  usuario_id: string;
  email: string | null;
  nombre: string | null;
  origen: "pago" | "cortesia";
  inicio: string;
  fin: string;
  nota: string | null;
  revocado: boolean;
  vigente: boolean;
}

export interface CuradorItem {
  id: string;
  email: string;
  nombre: string | null;
  rol: string;
}

const C = "/tendencias/curaduria";

export const tendenciasService = {
  // Comprador
  getAcceso: () => apiRequest<AccesoTendencias>("/tendencias/acceso"),
  iniciarSuscripcion: () => apiRequest<CheckoutSuscripcion>("/tendencias/suscripcion/checkout", { method: "POST" }),
  simularPago: (pagoId: string) =>
    apiRequest<{ vigente_hasta: string }>(`/tendencias/suscripcion/simular-pago/${pagoId}`, { method: "POST" }),
  getPortada: () => apiRequest<PortadaSinAcceso>("/tendencias/portada"),
  getEdicionActual: () => apiRequest<EdicionActual>("/tendencias/edicion-actual"),
  getArchivo: () => apiRequest<PortadaEdicion[]>("/tendencias/ediciones"),
  getEdicion: (id: string) => apiRequest<EdicionCompleta>(`/tendencias/ediciones/${id}`),
  getCalendario: () => apiRequest<Calendario>("/tendencias/calendario"),
  getGuardados: () => apiRequest<ProductoGuardado[]>("/tendencias/guardados"),
  guardar: (productoId: string, edicionId?: string | null) =>
    apiRequest<void>(`/tendencias/guardados/${productoId}`, { method: "PUT", body: { edicion_id: edicionId ?? null } }),
  quitarGuardado: (productoId: string) => apiRequest<void>(`/tendencias/guardados/${productoId}`, { method: "DELETE" }),
  suscribirAviso: () => apiRequest<void>("/tendencias/aviso", { method: "PUT" }),
  cancelarAviso: () => apiRequest<void>("/tendencias/aviso", { method: "DELETE" }),
  /** Medición: nunca rompe la pantalla si falla. */
  registrarEvento: (
    tipo: EventoCliente,
    datos: { edicion_id?: string; producto_id?: string; modo?: ModoTransporte; encuadre?: "horizontal" | "vertical" } = {},
  ) => apiRequest<void>("/tendencias/eventos", { method: "POST", body: { tipo, ...datos } }).catch(() => undefined),

  // Curador
  listarEdiciones: () => apiRequest<EdicionListado[]>(`${C}/ediciones`),
  crearEdicion: (datos: EdicionDatos) => apiRequest<EdicionCurador>(`${C}/ediciones`, { method: "POST", body: datos }),
  getEdicionCurador: (id: string) => apiRequest<EdicionCurador>(`${C}/ediciones/${id}`),
  editarEdicion: (id: string, datos: Partial<EdicionDatos>) =>
    apiRequest<EdicionCurador>(`${C}/ediciones/${id}`, { method: "PUT", body: datos }),
  /** Lista completa y ordenada; reemplaza la anterior. Para programar: exactamente un destacado. */
  ponerProductos: (id: string, productos: { producto_id: string; destacado: boolean }[]) =>
    apiRequest<EdicionCurador>(`${C}/ediciones/${id}/productos`, { method: "PUT", body: { productos } }),
  /** `publicarEnBogota`: "YYYY-MM-DDTHH:mm" en hora de Bogotá. Sin valor, publica ya. */
  programar: (id: string, publicarEnBogota?: string | null) =>
    apiRequest<EdicionCurador>(`${C}/ediciones/${id}/programar`, {
      method: "POST", body: { publicar_en: publicarEnBogota || null },
    }),
  desprogramar: (id: string) => apiRequest<EdicionCurador>(`${C}/ediciones/${id}/desprogramar`, { method: "POST" }),
  /** Solo admin. */
  retirar: (id: string) => apiRequest<EdicionCurador>(`${C}/ediciones/${id}/retirar`, { method: "POST" }),
  borrarEdicion: (id: string) => apiRequest<void>(`${C}/ediciones/${id}`, { method: "DELETE" }),
  listarProductos: () => apiRequest<ProductoCurador[]>(`${C}/productos`),
  getProducto: (id: string) => apiRequest<ProductoCurador>(`${C}/productos/${id}`),
  crearProducto: (datos: ProductoDatos) => apiRequest<ProductoCurador>(`${C}/productos`, { method: "POST", body: datos }),
  editarProducto: (id: string, datos: ProductoDatos) =>
    apiRequest<ProductoCurador>(`${C}/productos/${id}`, { method: "PUT", body: datos }),
  calcular: (datos: {
    temporada_id?: string | null; fecha_en_bodega?: string | null; dias_mar?: number | null;
    dias_aereo?: number | null; fecha_referencia?: string | null;
  }) => apiRequest<FechasProducto>(`${C}/calcular`, { method: "POST", body: datos }),
  listarTemporadas: () => apiRequest<Temporada[]>(`${C}/temporadas`),
  /** Solo admin. */
  crearTemporada: (datos: Omit<Temporada, "id">) => apiRequest<Temporada>(`${C}/temporadas`, { method: "POST", body: datos }),
  editarTemporada: (id: string, datos: Omit<Temporada, "id">) =>
    apiRequest<Temporada>(`${C}/temporadas/${id}`, { method: "PUT", body: datos }),
  borrarTemporada: (id: string) => apiRequest<void>(`${C}/temporadas/${id}`, { method: "DELETE" }),
  listarCierres: () => apiRequest<CierreFabricas[]>(`${C}/cierres`),
  crearCierre: (datos: CierreFabricas) => apiRequest<CierreFabricas>(`${C}/cierres`, { method: "POST", body: datos }),
  borrarCierre: (id: string) => apiRequest<void>(`${C}/cierres/${id}`, { method: "DELETE" }),
  getParametros: () => apiRequest<ParametrosTendencias>(`${C}/parametros`),
  /** Solo admin. */
  guardarParametros: (datos: ParametrosTendencias) =>
    apiRequest<ParametrosTendencias>(`${C}/parametros`, { method: "PUT", body: datos }),
  /** Solo admin. */
  getCambios: (filtros: { edicion_id?: string; solo_publicadas?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (filtros.edicion_id) q.set("edicion_id", filtros.edicion_id);
    if (filtros.solo_publicadas) q.set("solo_publicadas", "true");
    const qs = q.toString();
    return apiRequest<CambioTendencias[]>(`${C}/cambios${qs ? `?${qs}` : ""}`);
  },
  getMetricas: () => apiRequest<MetricasEdicion[]>(`${C}/metricas`),

  // Admin
  listarAccesos: (soloVigentes = true) =>
    apiRequest<AccesoAdmin[]>(`/tendencias/admin/accesos?solo_vigentes=${soloVigentes}`),
  otorgarAcceso: (datos: { email: string; dias: number; nota?: string }) =>
    apiRequest<AccesoAdmin>("/tendencias/admin/accesos", { method: "POST", body: datos }),
  revocarAcceso: (id: string) => apiRequest<AccesoAdmin>(`/tendencias/admin/accesos/${id}/revocar`, { method: "POST" }),
  listarCuradores: () => apiRequest<CuradorItem[]>("/tendencias/admin/curadores"),
  asignarCurador: (email: string, esCurador: boolean) =>
    apiRequest<CuradorItem & { es_curador: boolean }>(
      `/tendencias/admin/curadores?email=${encodeURIComponent(email)}`,
      { method: "PUT", body: { es_curador: esCurador } },
    ),
};

/** Paleta de cada preset de portada (especificación, sección 06). */
export const PRESETS: Record<PresetEstilo, {
  nombre: string; fondo: string; texto: string; acento: string; manchas: [string, string, string];
}> = {
  lavanda: { nombre: "Lavanda", fondo: "#CFC8F6", texto: "#16151B", acento: "#EDF953", manchas: ["#5A2BF2", "#EDF953", "#4A35B8"] },
  violeta: { nombre: "Violeta", fondo: "#4F06EB", texto: "#FFFFFF", acento: "#EDF953", manchas: ["#8A6CF5", "#EDF953", "#2A0A8F"] },
  amarillo: { nombre: "Amarillo", fondo: "#EDF953", texto: "#16151B", acento: "#4F06EB", manchas: ["#4F06EB", "#FFFFFF", "#CFC8F6"] },
  noche: { nombre: "Noche", fondo: "#111113", texto: "#FFFFFF", acento: "#EDF953", manchas: ["#4F06EB", "#EDF953", "#2A2930"] },
};

export const PIE_INFORMATIVO =
  "Selección informativa del equipo de Zarpi. Las fechas son estimados; el tiempo real lo da cada "
  + "nacionalizadora en su propuesta. No es una recomendación de inversión ni garantiza ventas.";
