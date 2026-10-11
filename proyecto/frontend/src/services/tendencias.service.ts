import { apiRequest } from "@/services/api-client";

/**
 * Tendencias v2: feed de productos virales para importar. Los productos llegan
 * como enlaces a TikTok, Instagram o YouTube (comunidad, importadoras, equipo).
 * El equipo aprobador decide si entran; un designer de Zarpi les pone portada
 * e imágenes con la identidad de marca y los publica. La ficha no muestra
 * precio: su única acción es pedir propuestas.
 *
 * Ver backend/routers/tendencias_virales.py y docs/Tendencias · Guía de construcción.html.
 */

export type Plataforma = "tiktok" | "instagram" | "youtube";
export type OrigenTendencia = "comunidad" | "importadora" | "equipo";
export type EstadoTendencia =
  | "pendiente"
  | "duplicado"
  | "rechazado"
  /** Aprobado: espera portada del equipo de diseño. */
  | "en_diseno"
  | "publicado"
  | "caido"
  | "archivado";
export type MotivoRechazo = "marca_replica" | "repetido" | "no_es_producto" | "regulado_inviable" | "calidad";

export const ETIQUETA_PLATAFORMA: Record<Plataforma, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
};

export interface EmpresaTendencia {
  id: string;
  nombre: string;
  logo_url: string | null;
  verificado: boolean;
  /** Solo en la ficha. */
  calificacion_promedio?: number | null;
  tiempo_respuesta_promedio?: string | null;
  especialidades?: string[];
  paises_origen?: string[];
}

/** Tarjeta del feed: sin reproductor, solo portada. */
export interface TarjetaTendencia {
  id: string;
  nombre: string;
  categoria: string;
  /** Ruta de gestión documental; pública para productos publicados. */
  portada_url: string;
  plataforma: Plataforma;
  regulado: boolean;
  origen: OrigenTendencia;
  /** Si lo recomienda una importadora, la solicitud va solo a ella. */
  empresa: EmpresaTendencia | null;
  cotizaciones_semana: number;
  cotizaciones_total: number;
  semana: string;
  publicado_en: string;
}

export interface FichaTendencia extends TarjetaTendencia {
  /** Iframe oficial de la plataforma (se arma en el backend desde el id del video). */
  embed_url: string | null;
  url_video: string;
  plataforma_nombre: string;
  autor_plataforma: string | null;
  por_que_tendencia: string | null;
  ojo_antes: string | null;
  /** Descripción larga del producto (puede traer saltos de línea). */
  descripcion: string | null;
  /** Imágenes extra del producto con la identidad de Zarpi (rutas de gestión documental). */
  imagenes: string[];
  /** "El video pertenece a su autor y se reproduce desde …" */
  pie: string;
}

export interface FeedTendencias {
  /** Lunes de la semana mostrada (YYYY-MM-DD). */
  semana: string;
  /** Semanas con publicaciones, la más reciente primero. */
  semanas: string[];
  categorias: string[];
  items: TarjetaTendencia[];
  /** Muro de pago: sin acceso completo solo llega la vista previa (pocas portadas). */
  acceso: AccesoFeed;
}

export interface AccesoFeed {
  completo: boolean;
  /** Interruptor del admin: Tendencias abierto para todos. */
  gratis: boolean;
  total: number;
  /** Productos que quedan detrás del muro de pago. */
  ocultos: number;
}

/** Cuerpo del 402 de la ficha cuando el muro de pago está activo. */
export interface FichaBloqueada {
  codigo: "requiere_suscripcion";
  mensaje: string;
  producto: { id: string; nombre: string | null; categoria: string | null; portada_url: string | null };
}

export interface MiAccesoTendencias {
  /** Acceso propio (suscripción, cortesía o acceso libre). */
  tiene_acceso: boolean;
  /** Lo que ve de verdad: con Tendencias gratis, todo. */
  acceso_completo: boolean;
  gratis: boolean;
  origen: string | null;
  vigente_hasta: string | null;
  precio_cop: number | null;
  dias_suscripcion: number;
  /** Solo cuentas de comprador y con precio fijado. */
  venta_habilitada: boolean;
  pago_simulado: boolean;
}

export interface CheckoutSuscripcion {
  pago_id: string;
  checkout_url: string;
  monto_cop: number;
  dias: number;
  pago_simulado: boolean;
}

export interface ParametrosAccesoTendencias {
  precio_cop: number | null;
  dias_suscripcion: number;
  gratis: boolean;
  acceso_libre_hasta: string | null;
  limite_vista_previa: number;
}

export interface AccesoCortesia {
  id: string;
  usuario_id: string;
  email: string | null;
  nombre: string | null;
  origen: string;
  inicio: string;
  fin: string;
  nota: string | null;
  revocado: boolean;
  vigente: boolean;
}

/** Producto del catálogo del equipo (admin › Tendencias). */
export interface ProductoEquipo {
  url: string;
  nombre: string;
  categoria: string;
  descripcion?: string | null;
  por_que_tendencia?: string | null;
  ojo_antes?: string | null;
  regulado?: boolean;
  /** Dueño del video; vacío = el que reporta la plataforma. */
  autor_plataforma?: string | null;
  portada_url?: string | null;
  imagenes?: string[];
  /** Sin portada pasa a diseño aunque se pida publicar. */
  publicar?: boolean;
}

export type EstadoCatalogo = "publicado" | "en_diseno" | "archivado" | "caido" | "todos";

export interface ResumenReto {
  id: string;
  aprobados: number;
  umbral: number;
  estado_recompensa: "pendiente" | "reclamable" | "solicitada" | "pagada";
}

export type RespuestaEnvio =
  | { estado: "recibido"; id: string; plataforma: Plataforma; autor_plataforma: string | null; reto: ResumenReto | null }
  | { estado: "duplicado"; mensaje: string; id: string | null };

export interface MiEnvio {
  id: string;
  url: string;
  plataforma: Plataforma;
  nombre: string | null;
  estado: EstadoTendencia;
  motivo_rechazo: string | null;
  fecha_envio: string;
}

/** Lo que ve el equipo aprobador. */
export interface ItemAprobacion extends FichaTendencia {
  estado: EstadoTendencia;
  motivo_rechazo: string | null;
  nota_remitente: string | null;
  miniatura_plataforma_url: string | null;
  id_video_plataforma: string | null;
  /** Instagram: si ya se pegó el código de inserción oficial. */
  tiene_embed_instagram: boolean | null;
  fecha_envio: string;
  remitente: {
    id: string | null;
    nombre: string | null;
    email: string | null;
    rol: OrigenTendencia;
    en_reto: boolean;
    aprobados_reto: number | null;
  };
}

/** Lo que ve diseño: lo del aprobador más quién diseñó y cuándo. */
export interface ItemDiseno extends ItemAprobacion {
  revisado_en: string | null;
  disenado_en: string | null;
  disenado_por: string | null;
  /** Diseño ya lo revisó. Un publicado sin esto puede no tener la identidad de Zarpi. */
  con_identidad: boolean;
}

/** "sin_diseno": publicado sin revisión de diseño; "mios": lo que diseñó quien pregunta. */
export type FiltroPublicados = "sin_diseno" | "todos" | "mios";

export interface ContadoresDiseno {
  en_cola: number;
  publicados_hoy: number;
  mios_total: number;
  publicados_sin_diseno: number;
}

export const MAX_IMAGENES_DISENO = 8;

export interface DisenadorItem {
  id: string;
  email: string;
  nombre: string | null;
  activo: boolean;
  publicados: number;
  fecha_creacion: string | null;
}

export interface ContadoresAprobacion {
  pendientes: number;
  en_diseno: number;
  aprobados_hoy: number;
  rechazados_hoy: number;
}

export interface CambiosFicha {
  nombre?: string | null;
  categoria?: string | null;
  regulado?: boolean;
  por_que_tendencia?: string | null;
  ojo_antes?: string | null;
  descripcion?: string | null;
  autor_plataforma?: string | null;
  portada_url?: string | null;
  embed_html?: string | null;
}

export interface AprobadorItem {
  id: string;
  email: string;
  nombre: string | null;
  rol: string;
}

export const tendenciasService = {
  // Público
  /** `recientes`: los últimos de todas las semanas (la sección de la landing). */
  feed: (filtros: { semana?: string; categoria?: string; importadorId?: string; recientes?: boolean; limite?: number } = {}) => {
    const q = new URLSearchParams();
    if (filtros.semana) q.set("semana", filtros.semana);
    if (filtros.categoria) q.set("categoria", filtros.categoria);
    if (filtros.importadorId) q.set("importador_id", filtros.importadorId);
    if (filtros.recientes) q.set("recientes", "true");
    if (filtros.limite) q.set("limite", String(filtros.limite));
    const qs = q.toString();
    return apiRequest<FeedTendencias>(`/tendencias/feed${qs ? `?${qs}` : ""}`);
  },
  /** Con el muro de pago y sin acceso falla con 402 (cuerpo: `FichaBloqueada` en `detail`). */
  ficha: (id: string) => apiRequest<FichaTendencia>(`/tendencias/items/${id}`),

  // Acceso y suscripción (con sesión)
  miAcceso: () => apiRequest<MiAccesoTendencias>("/tendencias/acceso"),
  checkout: () => apiRequest<CheckoutSuscripcion>("/tendencias/suscripcion/checkout", { method: "POST" }),
  /** Solo en local (pago simulado): confirma el pago como lo haría Wompi. */
  simularPago: (pagoId: string) =>
    apiRequest<{ vigente_hasta: string }>(`/tendencias/suscripcion/simular-pago/${pagoId}`, { method: "POST" }),

  // Cualquier usuario registrado
  /** Un enlace de video no válido responde con error (422) y su motivo en el mensaje. */
  enviar: (datos: { url: string; nombre?: string; categoria?: string; nota?: string; portada_url?: string }) =>
    apiRequest<RespuestaEnvio>("/tendencias/enviar", { method: "POST", body: datos }),
  misEnvios: () => apiRequest<MiEnvio[]>("/tendencias/mis-envios"),

  // Equipo aprobador (admin o curador)
  cola: (estado: "pendiente" | "en_diseno" = "pendiente") =>
    apiRequest<ItemAprobacion[]>(`/tendencias/aprobacion/cola?estado=${estado}`),
  contadores: () => apiRequest<ContadoresAprobacion>("/tendencias/aprobacion/contadores"),
  motivos: () => apiRequest<{ valor: MotivoRechazo; texto: string }[]>("/tendencias/aprobacion/motivos"),
  publicados: () => apiRequest<ItemAprobacion[]>("/tendencias/aprobacion/publicados"),
  editar: (id: string, cambios: CambiosFicha) =>
    apiRequest<ItemAprobacion>(`/tendencias/items/${id}`, { method: "PATCH", body: cambios }),
  /** Pasa a diseño. `publicar` (solo admin, con portada) lo publica sin pasar por diseño. */
  aprobar: (id: string, publicar = false) =>
    apiRequest<ItemAprobacion>(`/tendencias/items/${id}/aprobar`, { method: "POST", body: { publicar } }),
  rechazar: (id: string, motivo: MotivoRechazo) =>
    apiRequest<ItemAprobacion>(`/tendencias/items/${id}/rechazar`, { method: "POST", body: { motivo } }),
  archivar: (id: string) => apiRequest<ItemAprobacion>(`/tendencias/items/${id}/archivar`, { method: "POST" }),

  // Diseño (designer o admin)
  colaDiseno: () => apiRequest<ItemDiseno[]>("/tendencias/diseno/cola"),
  contadoresDiseno: () => apiRequest<ContadoresDiseno>("/tendencias/diseno/contadores"),
  publicadosDiseno: (filtro: FiltroPublicados = "todos", q = "") => {
    const params = new URLSearchParams({ filtro });
    if (q.trim()) params.set("q", q.trim());
    return apiRequest<ItemDiseno[]>(`/tendencias/diseno/publicados?${params.toString()}`);
  },
  /** Lo publicado ya tiene la identidad de Zarpi: se marca sin cambiarle nada. */
  marcarRevisado: (id: string) =>
    apiRequest<ItemDiseno>(`/tendencias/diseno/items/${id}/revisado`, { method: "POST" }),
  /** Portada y/o imágenes. `portada_url: ""` la quita (no en un publicado). */
  guardarDiseno: (id: string, cambios: { portada_url?: string | null; imagenes?: string[] }) =>
    apiRequest<ItemDiseno>(`/tendencias/diseno/items/${id}`, { method: "PATCH", body: cambios }),
  publicarDiseno: (id: string) =>
    apiRequest<ItemDiseno>(`/tendencias/diseno/items/${id}/publicar`, { method: "POST" }),

  // Catálogo del equipo (admin o aprobador)
  crearProducto: (datos: ProductoEquipo) =>
    apiRequest<ItemDiseno>("/tendencias/catalogo", { method: "POST", body: datos }),
  catalogo: (filtros: { estado?: EstadoCatalogo; q?: string; origen?: OrigenTendencia } = {}) => {
    const q = new URLSearchParams({ estado: filtros.estado ?? "publicado" });
    if (filtros.q?.trim()) q.set("q", filtros.q.trim());
    if (filtros.origen) q.set("origen", filtros.origen);
    return apiRequest<ItemDiseno[]>(`/tendencias/catalogo?${q.toString()}`);
  },
  republicar: (id: string) => apiRequest<ItemDiseno>(`/tendencias/items/${id}/republicar`, { method: "POST" }),

  // Admin: muro de pago, precio y cortesías
  parametrosAcceso: () => apiRequest<ParametrosAccesoTendencias>("/tendencias/admin/suscripcion"),
  guardarParametrosAcceso: (datos: { precio_cop: number | null; dias_suscripcion: number; gratis?: boolean }) =>
    apiRequest<ParametrosAccesoTendencias>("/tendencias/admin/suscripcion", { method: "PUT", body: datos }),
  cortesias: (soloVigentes = true) =>
    apiRequest<AccesoCortesia[]>(`/tendencias/admin/accesos?solo_vigentes=${soloVigentes}`),
  otorgarCortesia: (datos: { email: string; dias: number; nota?: string }) =>
    apiRequest<AccesoCortesia>("/tendencias/admin/accesos", { method: "POST", body: datos }),
  revocarCortesia: (id: string) =>
    apiRequest<AccesoCortesia>(`/tendencias/admin/accesos/${id}/revocar`, { method: "POST" }),

  // Admin: equipo de diseño
  listarDisenadores: () => apiRequest<DisenadorItem[]>("/admin/disenadores"),
  crearDisenador: (datos: { email: string; password: string; nombre: string; telefono?: string }) =>
    apiRequest<DisenadorItem>("/admin/disenadores", { method: "POST", body: datos }),
  /** Activa o desactiva la cuenta (endpoint general de usuarios del admin). */
  cambiarEstadoDisenador: (id: string, activo: boolean) =>
    apiRequest<unknown>(`/admin/usuarios/${id}/estado`, { method: "PUT", body: { activo } }),

  // Admin: equipo aprobador
  listarAprobadores: () => apiRequest<AprobadorItem[]>("/tendencias/admin/curadores"),
  asignarAprobador: (email: string, activo: boolean) =>
    apiRequest<AprobadorItem & { es_curador: boolean }>(
      `/tendencias/admin/curadores?email=${encodeURIComponent(email)}`,
      { method: "PUT", body: { es_curador: activo } },
    ),
};

export const PIE_GENERAL = "Zarpi conecta, no importa ni vende la mercancía.";
