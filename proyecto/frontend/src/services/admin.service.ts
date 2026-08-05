import { apiRequest } from "@/services/api-client";
import type { BackendImporter } from "@/services/business.service";
import type { RegisterResponse } from "@/types/auth";

export type AdminUserRole = "solicitante" | "importador" | "asesor" | "admin";

export interface AdminUser {
  id: string;
  email: string;
  rol: AdminUserRole | string;
  importador_id: string | null;
  nombre: string | null;
  activo: boolean;
  perfil_completo: boolean;
  fecha_creacion: string;
}

export interface AdminMetricas {
  total_cotizaciones: number;
  cotizaciones_dirigidas: number;
  cotizaciones_abiertas: number;
  tasa_respuesta_abiertas: number;
  tiempo_promedio_primera_propuesta_horas: number | null;
  tasa_conversion_a_orden: number;
  importadores_activos: number;
  importadores_verificados: number;
  ordenes_en_disputa: number;
}

export interface AdminCotizacionAbierta {
  id: string;
  solicitante_id: string;
  nombre_producto: string;
  pais_importacion: string;
  linea_producto: string;
  estado: string;
  fecha_creacion: string;
}

export interface CreateImporterWithOwnerPayload {
  nombre_empresa: string;
  logo_url?: string;
  especialidad_producto: string[];
  paises_origen: string[];
  tiempo_respuesta_promedio: string;
  capacidad_volumen?: number;
  solo_cotizaciones_directas?: boolean;
  email_dueño: string;
  password_dueño: string;
  nombre_dueño?: string;
}

export interface CreateImporterWithOwnerResponse {
  importador: BackendImporter;
  usuario_dueño_id: string;
  email_dueño: string;
}

export interface InviteSolicitantePayload {
  email: string;
  password: string;
  nombre: string;
  telefono: string;
  indicativo_pais_telefono: string;
}

export const adminService = {
  listCompanies(): Promise<BackendImporter[]> {
    return apiRequest<BackendImporter[]>("/importadores", { method: "GET" });
  },

  createImporterWithOwner(payload: CreateImporterWithOwnerPayload): Promise<CreateImporterWithOwnerResponse> {
    return apiRequest<CreateImporterWithOwnerResponse>("/admin/importadores", {
      method: "POST",
      body: payload,
    });
  },

  updateImporterStatus(importadorId: string, estado: "activo" | "inactivo"): Promise<BackendImporter> {
    return apiRequest<BackendImporter>(`/admin/importadores/${importadorId}/estado?estado=${estado}`, {
      method: "PUT",
    });
  },

  verifyImporter(importadorId: string): Promise<BackendImporter> {
    return apiRequest<BackendImporter>(`/admin/importadores/${importadorId}/verificar`, {
      method: "POST",
    });
  },

  listUsers(filters?: { rol?: string; activo?: boolean }): Promise<AdminUser[]> {
    const query = new URLSearchParams();
    if (filters?.rol) {
      query.set("rol", filters.rol);
    }
    if (typeof filters?.activo === "boolean") {
      query.set("activo", String(filters.activo));
    }
    const suffix = query.toString();
    return apiRequest<AdminUser[]>(`/admin/usuarios${suffix ? `?${suffix}` : ""}`, {
      method: "GET",
    });
  },

  updateUserStatus(usuarioId: string, activo: boolean): Promise<AdminUser> {
    return apiRequest<AdminUser>(`/admin/usuarios/${usuarioId}/estado`, {
      method: "PUT",
      body: { activo },
    });
  },

  getMetricas(): Promise<AdminMetricas> {
    return apiRequest<AdminMetricas>("/admin/metricas", { method: "GET" });
  },

  listOpenQuotes(): Promise<AdminCotizacionAbierta[]> {
    return apiRequest<AdminCotizacionAbierta[]>("/admin/cotizaciones-abiertas", { method: "GET" });
  },

  inviteSolicitante(payload: InviteSolicitantePayload): Promise<RegisterResponse> {
    return apiRequest<RegisterResponse>("/auth/register", {
      method: "POST",
      body: {
        email: payload.email,
        password: payload.password,
        rol: "solicitante",
        tipo_persona: "natural",
        nombre: payload.nombre,
        tipo_documento: "CC",
        numero_documento: `INV-${Date.now()}`,
        indicativo_pais_telefono: payload.indicativo_pais_telefono,
        telefono: payload.telefono,
        acepto_politica_datos: true,
      },
    });
  },
};
