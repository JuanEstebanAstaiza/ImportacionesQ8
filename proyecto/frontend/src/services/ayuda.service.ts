import { apiRequest } from "@/services/api-client";

/**
 * Documentación de la plataforma.
 *
 * Vive en la base de datos y la mantiene el equipo de soporte desde el panel:
 * antes era un archivo de código, así que responder a una duda nueva exigía
 * desplegar y en la práctica la documentación no crecía.
 */
export interface ArticuloAyuda {
  id: string;
  titulo: string;
  /** Respuesta corta: muchas dudas se resuelven sin desplegar el artículo. */
  resumen: string;
  contenido: string | null;
  categoria: string;
  /** A qué perfiles aplica. Vacío o nulo significa "a todos". */
  roles: string[] | null;
  orden: number;
  publicado: boolean;
  vistas: number;
  votos_util: number;
  votos_inutil: number;
  fecha_actualizacion: string | null;
}

export interface ArticulosAyudaResponse {
  articulos: ArticuloAyuda[];
  categorias: string[];
  total: number;
}

export interface ArticuloAyudaPayload {
  titulo: string;
  resumen: string;
  contenido?: string | null;
  categoria: string;
  roles?: string[] | null;
  orden?: number;
  publicado?: boolean;
}

export const ayudaService = {
  /** Documentación aplicable al perfil de quien consulta. */
  listArticles(filtros?: { buscar?: string; categoria?: string }): Promise<ArticulosAyudaResponse> {
    const query = new URLSearchParams();
    if (filtros?.buscar?.trim()) {
      query.set("buscar", filtros.buscar.trim());
    }
    if (filtros?.categoria) {
      query.set("categoria", filtros.categoria);
    }
    const sufijo = query.toString();
    return apiRequest<ArticulosAyudaResponse>(`/ayuda/articulos${sufijo ? `?${sufijo}` : ""}`, {
      method: "GET",
    });
  },

  /** Suma una lectura, para saber qué se consulta de verdad. */
  markRead(articuloId: string): Promise<void> {
    return apiRequest<void>(`/ayuda/articulos/${articuloId}/visto`, { method: "POST" });
  },

  /** Marca si el artículo resolvió la duda. Es la señal de qué reescribir. */
  vote(articuloId: string, util: boolean): Promise<ArticuloAyuda> {
    return apiRequest<ArticuloAyuda>(`/ayuda/articulos/${articuloId}/voto`, {
      method: "POST",
      body: { util },
    });
  },

  /* ---- Mantenimiento: solo administración y atención al cliente ---- */

  listCategories(): Promise<string[]> {
    return apiRequest<string[]>("/ayuda/categorias", { method: "GET" });
  },

  createArticle(payload: ArticuloAyudaPayload): Promise<ArticuloAyuda> {
    return apiRequest<ArticuloAyuda>("/ayuda/articulos", { method: "POST", body: payload });
  },

  updateArticle(articuloId: string, payload: Partial<ArticuloAyudaPayload>): Promise<ArticuloAyuda> {
    return apiRequest<ArticuloAyuda>(`/ayuda/articulos/${articuloId}`, { method: "PUT", body: payload });
  },

  /** Retira el artículo de la vista pública sin borrarlo. */
  unpublishArticle(articuloId: string): Promise<ArticuloAyuda> {
    return apiRequest<ArticuloAyuda>(`/ayuda/articulos/${articuloId}`, { method: "DELETE" });
  },
};
