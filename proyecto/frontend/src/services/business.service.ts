import { apiRequest } from "@/services/api-client";

export interface BackendImporter {
  id: string;
  nombre_empresa: string;
  especialidad_producto: string[];
  paises_origen: string[];
  calificacion_promedio: number;
  tiempo_respuesta_promedio: string;
  verificado: boolean;
  fecha_registro: string;
}

export interface BackendCotizacion {
  id: string;
  importador_id: string | null;
  modalidad: "dirigida" | "abierta";
  pais_importacion: string;
  nombre_producto: string;
  descripcion_cliente: string;
  linea_producto: string;
  tipo_calidad: string;
  cantidad_minima: number;
  precio_objetivo_usd: number | null;
  incoterm: string;
  estado: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface CreateCotizacionPayload {
  modalidad: "dirigida" | "abierta";
  importador_id?: string;
  pais_importacion: string;
  nombre_producto: string;
  descripcion_cliente: string;
  link_referencia?: string;
  linea_producto: string;
  tipo_calidad: "economica" | "estandar" | "premium";
  nivel_personalizacion?: string;
  modalidad_importacion?: string;
  cantidad_minima: number;
  precio_objetivo_usd?: number;
  incoterm: string;
  notas_adicionales?: string;
}

export interface BackendAsesor {
  id: string;
  email: string;
  nombre: string | null;
  telefono: string | null;
  activo: boolean;
  fecha_creacion: string;
}

export interface CreateAsesorPayload {
  email: string;
  password: string;
  nombre?: string;
  telefono?: string;
}

export interface BackendAsesorCotizacion {
  id: string;
  modalidad: "dirigida" | "abierta";
  nombre_producto: string;
  cantidad_minima: number;
  precio_objetivo_usd: number | null;
  incoterm: string;
  estado: string;
  fecha_creacion: string;
}

export const businessService = {
  listImporters(): Promise<BackendImporter[]> {
    return apiRequest<BackendImporter[]>("/importadores", { method: "GET" });
  },

  listQuotes(): Promise<BackendCotizacion[]> {
    return apiRequest<BackendCotizacion[]>("/cotizaciones", { method: "GET" });
  },

  createQuote(payload: CreateCotizacionPayload): Promise<BackendCotizacion> {
    return apiRequest<BackendCotizacion>("/cotizaciones", {
      method: "POST",
      body: payload,
    });
  },

  listCompanyAdvisors(): Promise<BackendAsesor[]> {
    return apiRequest<BackendAsesor[]>("/importadores/asesores", { method: "GET" });
  },

  createCompanyAdvisor(payload: CreateAsesorPayload): Promise<BackendAsesor> {
    return apiRequest<BackendAsesor>("/importadores/asesores", {
      method: "POST",
      body: payload,
    });
  },

  listMyAssignedQuotes(): Promise<BackendAsesorCotizacion[]> {
    return apiRequest<BackendAsesorCotizacion[]>("/asesores/me/cotizaciones", {
      method: "GET",
    });
  },
};
