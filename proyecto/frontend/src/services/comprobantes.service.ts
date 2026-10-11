import { apiRequest } from "@/services/api-client";

/**
 * Cargue y descargue de pagos: comprobantes manuales mientras se habilita la
 * pasarela. Tres carpetas:
 * - `tokens`: el usuario sube el pago de tokens de cotización; el admin aprueba y se acreditan.
 * - `suscripcion`: igual, para la suscripción a Tendencias (días).
 * - `reto`: el equipo sube el comprobante de la recompensa en efectivo; el usuario solo lo ve.
 * Ver backend/routers/comprobantes.py.
 */

export type TipoComprobante = "tokens" | "suscripcion" | "reto";
export type EstadoComprobante = "pendiente" | "aprobado" | "rechazado" | "enviado";

/** Origen con el que se sube el archivo: el backend lo guarda en «Pagos/…». */
export const ORIGEN_COMPROBANTE = "comprobante-pago";
export const ACEPTA_COMPROBANTE = ".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf";

export const CARPETA_COMPROBANTE: Record<TipoComprobante, string> = {
  tokens: "Comprobantes de cotizaciones",
  suscripcion: "Suscripción Tendencias",
  reto: "Pagos del reto",
};

export interface Comprobante {
  id: string;
  tipo: TipoComprobante;
  estado: EstadoComprobante;
  archivo: {
    id: string;
    nombre: string | null;
    tipo_recurso: "imagen" | "documento" | string | null;
    /** Ruta protegida de gestión documental (se abre con sesión). */
    url: string;
  };
  cantidad_solicitada: number | null;
  monto_cop: number | null;
  nota: string | null;
  cantidad_acreditada: number | null;
  motivo_rechazo: string | null;
  revisado_en: string | null;
  fecha: string;
  /** Solo en las vistas del admin. */
  usuario?: { id: string; email: string | null; nombre: string | null; tokens: number };
}

export interface ResumenPagos {
  precio_token_cop: number | null;
  /** Cuenta y titular para transferir, como lo escribió el admin. */
  datos_pago: string | null;
  tokens: number;
  cotizaciones_gratis: number;
  suscripcion: { precio_cop: number | null; dias: number; vigente_hasta: string | null };
}

export interface ConfigPagos {
  precio_token_cop: number | null;
  datos_pago: string | null;
}

export const comprobantesService = {
  // Usuario
  resumen: () => apiRequest<ResumenPagos>("/comprobantes/resumen"),
  mios: (tipo?: TipoComprobante) => apiRequest<Comprobante[]>(`/comprobantes${tipo ? `?tipo=${tipo}` : ""}`),
  /** El archivo ya debe estar subido (DocumentUploadButton con `origen={ORIGEN_COMPROBANTE}`). */
  subir: (datos: { tipo: "tokens" | "suscripcion"; archivo_id: string; cantidad?: number; monto_cop?: number; nota?: string }) =>
    apiRequest<Comprobante>("/comprobantes", { method: "POST", body: datos }),

  // Admin
  paraAdmin: (filtros: { estado?: EstadoComprobante; tipo?: TipoComprobante } = {}) => {
    const q = new URLSearchParams();
    if (filtros.estado) q.set("estado", filtros.estado);
    if (filtros.tipo) q.set("tipo", filtros.tipo);
    const qs = q.toString();
    return apiRequest<Comprobante[]>(`/comprobantes/admin${qs ? `?${qs}` : ""}`);
  },
  /** `cantidad`: tokens a acreditar o días de suscripción. */
  aprobar: (id: string, cantidad: number) =>
    apiRequest<Comprobante>(`/comprobantes/${id}/aprobar`, { method: "POST", body: { cantidad } }),
  rechazar: (id: string, motivo: string) =>
    apiRequest<Comprobante>(`/comprobantes/${id}/rechazar`, { method: "POST", body: { motivo } }),
  subirReto: (participacionId: string, archivoId: string) =>
    apiRequest<Comprobante>("/comprobantes/admin/reto", {
      method: "POST", body: { participacion_id: participacionId, archivo_id: archivoId },
    }),
  config: () => apiRequest<ConfigPagos>("/comprobantes/admin/config"),
  guardarConfig: (datos: ConfigPagos) =>
    apiRequest<ConfigPagos>("/comprobantes/admin/config", { method: "PUT", body: datos }),
};
