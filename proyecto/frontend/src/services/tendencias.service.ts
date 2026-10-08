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
}

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
  feed: (filtros: { semana?: string; categoria?: string; importadorId?: string } = {}) => {
    const q = new URLSearchParams();
    if (filtros.semana) q.set("semana", filtros.semana);
    if (filtros.categoria) q.set("categoria", filtros.categoria);
    if (filtros.importadorId) q.set("importador_id", filtros.importadorId);
    const qs = q.toString();
    return apiRequest<FeedTendencias>(`/tendencias/feed${qs ? `?${qs}` : ""}`);
  },
  ficha: (id: string) => apiRequest<FichaTendencia>(`/tendencias/items/${id}`),

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
