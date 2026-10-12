import { apiRequest } from "@/services/api-client";

/**
 * Moderación del material que suben las empresas desde «Mi empresa» (video de
 * presentación, fotos, certificados). Nada sale en la ficha pública hasta que
 * el admin lo aprueba. Ver backend/services/presentacion_empresa.py.
 */

export type EstadoPresentacion = "pendiente" | "aprobada" | "rechazada";

export interface PiezaPresentacion {
  id: string;
  importador_id: string;
  empresa: string | null;
  tipo: string;
  titulo: string;
  descripcion: string | null;
  url: string;
  estado: EstadoPresentacion;
  nota_revision: string | null;
  fecha_creacion: string | null;
  fecha_revision: string | null;
}

export interface ColaPresentaciones {
  items: PiezaPresentacion[];
  contadores: Record<EstadoPresentacion, number>;
}

export const presentacionesService = {
  listar(estado?: EstadoPresentacion): Promise<ColaPresentaciones> {
    const query = estado ? `?estado=${estado}` : "";
    return apiRequest<ColaPresentaciones>(`/admin/evidencias${query}`, { method: "GET" });
  },

  /** Aprobar la publica en la ficha; rechazar exige motivo (la empresa lo ve). */
  revisar(id: string, estado: "aprobada" | "rechazada", nota?: string): Promise<{ id: string; estado: string }> {
    return apiRequest(`/admin/evidencias/${id}/revisar`, {
      method: "PUT",
      body: { estado, nota_revision: nota || null },
    });
  },
};
