import { apiRequest } from "@/services/api-client";

export type LandingBlockType = "heading" | "paragraph" | "image" | "video" | "button" | "allies_grid" | "video_rotativo";
export type LandingBlockAlign = "left" | "center" | "right";
export type LandingButtonAction = "open_login" | "open_register" | "external_link";
export type LandingBrandToken = "primary" | "surface" | "border" | "foreground" | "muted";
export type LandingFontFamily = "elvellon" | "avenor";
export type LandingSection = "home" | "about" | "how-it-works" | "news" | "contact";

export interface LandingBlock {
  id: string;
  seccion: LandingSection | string;
  tipo: LandingBlockType;
  contenido: string | null;
  alineacion: LandingBlockAlign;
  tamano_fuente: string;
  accion_boton: LandingButtonAction | null;
  accion_url: string | null;
  token_color: LandingBrandToken;
  fuente: LandingFontFamily;
  orden: number;
  activo: boolean;
}

export interface LandingAlly {
  id: string;
  nombre: string;
  logo_url: string | null;
  categoria: string | null;
  enlace: string | null;
  orden: number;
  activo: boolean;
}

export interface LandingNews {
  id: string;
  titulo: string;
  resumen: string;
  contenido: string | null;
  imagen_url: string | null;
  fecha_publicacion: string | null;
  orden: number;
  activo: boolean;
}

export interface LandingDynamicContent {
  blocks: LandingBlock[];
  allies: LandingAlly[];
  news: LandingNews[];
}

export type LandingAllyPayload = Omit<LandingAlly, "id">;
export type LandingNewsPayload = Omit<LandingNews, "id" | "fecha_publicacion">;

export interface LandingContactPayload {
  nombre: string;
  email: string;
  telefono?: string;
  perfil: "comprador" | "nacionalizadora";
  mensaje: string;
}

export interface LandingContactResponse {
  enviado: boolean;
  mensaje: string;
}

/** Un video del carrusel de "Quiénes somos", en uno o dos encuadres. */
export interface VideoRotativo {
  id?: string;
  titulo?: string | null;
  /** 16:9, para computador. Ruta de gestión documental. */
  horizontal?: string | null;
  /** 9:16, para celular. */
  vertical?: string | null;
}

export interface VideosQuienesSomos {
  activo: boolean;
  /** Cada cuántos segundos pasa al siguiente (si el video no termina antes). Entre 5 y 300. */
  intervalo_segundos: number;
  videos: VideoRotativo[];
}

export const VIDEOS_QUIENES_SOMOS_VACIO: VideosQuienesSomos = { activo: true, intervalo_segundos: 20, videos: [] };

/** Lee la configuración del carrusel guardada como JSON en su bloque `video_rotativo`. */
export function leerVideosQuienesSomos(blocks: LandingBlock[] | undefined | null): VideosQuienesSomos {
  const bloque = (blocks ?? []).find((b) => b.tipo === "video_rotativo" && b.seccion === "about");
  if (!bloque?.contenido) return { ...VIDEOS_QUIENES_SOMOS_VACIO, activo: bloque?.activo ?? true };
  try {
    const datos = JSON.parse(bloque.contenido) as Partial<VideosQuienesSomos>;
    return {
      activo: bloque.activo,
      intervalo_segundos: Number(datos.intervalo_segundos) || VIDEOS_QUIENES_SOMOS_VACIO.intervalo_segundos,
      videos: Array.isArray(datos.videos) ? datos.videos.filter((v) => v && (v.horizontal || v.vertical)) : [],
    };
  } catch {
    return { ...VIDEOS_QUIENES_SOMOS_VACIO, activo: bloque.activo };
  }
}

export const landingService = {
  /** Vista pública: solo bloques/aliados/noticias activos. Sin autenticación. */
  getDynamicContent(): Promise<LandingDynamicContent> {
    return apiRequest<LandingDynamicContent>("/landing/dynamic-content", { method: "GET" });
  },

  /** Vista de edición: incluye lo inactivo/borrador. Solo admin. */
  getDynamicContentForAdmin(): Promise<LandingDynamicContent> {
    return apiRequest<LandingDynamicContent>("/landing/dynamic-content/admin", { method: "GET" });
  },

  saveBlocks(blocks: LandingBlock[]): Promise<LandingBlock[]> {
    return apiRequest<LandingBlock[]>("/landing/dynamic-content", {
      method: "PUT",
      body: { blocks },
    });
  },

  /** Carrusel de "Quiénes somos". Tiene su propio guardado: "Guardar estructura" no lo toca. Solo admin. */
  saveVideosQuienesSomos(config: VideosQuienesSomos): Promise<LandingBlock> {
    return apiRequest<LandingBlock>("/landing/videos-quienes-somos", { method: "PUT", body: config });
  },

  createAlly(payload: LandingAllyPayload): Promise<LandingAlly> {
    return apiRequest<LandingAlly>("/landing/allies", { method: "POST", body: payload });
  },

  updateAlly(id: string, payload: Partial<LandingAllyPayload>): Promise<LandingAlly> {
    return apiRequest<LandingAlly>(`/landing/allies/${id}`, { method: "PUT", body: payload });
  },

  deleteAlly(id: string): Promise<void> {
    return apiRequest<void>(`/landing/allies/${id}`, { method: "DELETE" });
  },

  createNews(payload: LandingNewsPayload): Promise<LandingNews> {
    return apiRequest<LandingNews>("/landing/news", { method: "POST", body: payload });
  },

  updateNews(id: string, payload: Partial<LandingNewsPayload>): Promise<LandingNews> {
    return apiRequest<LandingNews>(`/landing/news/${id}`, { method: "PUT", body: payload });
  },

  deleteNews(id: string): Promise<void> {
    return apiRequest<void>(`/landing/news/${id}`, { method: "DELETE" });
  },

  /** Formulario de contacto público de la Landing. Sin autenticación. */
  sendContact(payload: LandingContactPayload): Promise<LandingContactResponse> {
    return apiRequest<LandingContactResponse>("/landing/contacto", { method: "POST", body: payload });
  },
};
