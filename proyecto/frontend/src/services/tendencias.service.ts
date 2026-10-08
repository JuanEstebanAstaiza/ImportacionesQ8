import { apiRequest } from "@/services/api-client";

/**
 * Tendencias v2: feed de productos virales para importar. Los productos llegan
 * como enlaces a TikTok, Instagram o YouTube (comunidad, importadoras, equipo),
 * una persona del equipo los aprueba y les pone portada, y se publican. La
 * ficha no muestra precio: su única acción es pedir propuestas.
 *
 * Ver backend/routers/tendencias_virales.py y docs/Tendencias · Guía de construcción.html.
 */

export type Plataforma = "tiktok" | "instagram" | "youtube";
export type OrigenTendencia = "comunidad" | "importadora" | "equipo";
export type EstadoTendencia =
  | "pendiente"
  | "duplicado"
  | "rechazado"
  | "aprobado_sin_portada"
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

export interface ContadoresAprobacion {
  pendientes: number;
  sin_portada: number;
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
  cola: (estado: "pendiente" | "aprobado_sin_portada" = "pendiente") =>
    apiRequest<ItemAprobacion[]>(`/tendencias/aprobacion/cola?estado=${estado}`),
  contadores: () => apiRequest<ContadoresAprobacion>("/tendencias/aprobacion/contadores"),
  motivos: () => apiRequest<{ valor: MotivoRechazo; texto: string }[]>("/tendencias/aprobacion/motivos"),
  publicados: () => apiRequest<ItemAprobacion[]>("/tendencias/aprobacion/publicados"),
  editar: (id: string, cambios: CambiosFicha) =>
    apiRequest<ItemAprobacion>(`/tendencias/items/${id}`, { method: "PATCH", body: cambios }),
  /** Sin portada falla (400) salvo con `sinPortada`. */
  aprobar: (id: string, sinPortada = false) =>
    apiRequest<ItemAprobacion>(`/tendencias/items/${id}/aprobar`, { method: "POST", body: { sin_portada: sinPortada } }),
  rechazar: (id: string, motivo: MotivoRechazo) =>
    apiRequest<ItemAprobacion>(`/tendencias/items/${id}/rechazar`, { method: "POST", body: { motivo } }),
  archivar: (id: string) => apiRequest<ItemAprobacion>(`/tendencias/items/${id}/archivar`, { method: "POST" }),

  // Admin: equipo aprobador
  listarAprobadores: () => apiRequest<AprobadorItem[]>("/tendencias/admin/curadores"),
  asignarAprobador: (email: string, activo: boolean) =>
    apiRequest<AprobadorItem & { es_curador: boolean }>(
      `/tendencias/admin/curadores?email=${encodeURIComponent(email)}`,
      { method: "PUT", body: { es_curador: activo } },
    ),
};

export const PIE_GENERAL = "Zarpi conecta, no importa ni vende la mercancía.";
