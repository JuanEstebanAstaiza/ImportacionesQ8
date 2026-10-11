import { apiRequest } from "@/services/api-client";

/**
 * Cargue y descargue de pagos: comprobantes manuales mientras se habilita la
 * pasarela. Carpetas:
 * - `tokens`: el usuario sube el pago de tokens de cotización; el admin aprueba y se acreditan.
 * - `suscripcion`: igual, para la suscripción a Tendencias (días).
 * - `curso`: el pago de un curso (con el pago manual de cursos encendido); al aprobar, se abre el curso.
 * - `reto`: el equipo sube el comprobante de la recompensa en efectivo; el usuario solo lo ve.
 * Ver backend/routers/comprobantes.py.
 */

export type TipoComprobante = "tokens" | "suscripcion" | "curso" | "reto";
export type EstadoComprobante = "pendiente" | "aprobado" | "rechazado" | "enviado";

/** Origen con el que se sube el archivo: el backend lo guarda en «Pagos/…». */
export const ORIGEN_COMPROBANTE = "comprobante-pago";
export const ACEPTA_COMPROBANTE = ".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf";

export const CARPETA_COMPROBANTE: Record<TipoComprobante, string> = {
  tokens: "Comprobantes de cotizaciones",
  suscripcion: "Suscripción Tendencias",
  curso: "Cursos",
  reto: "Pagos del reto",
};

/** Un curso con precio que el usuario todavía no tiene. */
export interface CursoPorPagar {
  id: string;
  titulo: string;
  precio: number;
  importadora_nombre: string | null;
  /** Ya mandó el comprobante y lo están revisando. */
  pendiente: boolean;
}

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
  /** Solo en los comprobantes de un curso. */
  curso: { id: string; titulo: string; precio: number } | null;
  /** Solo en las vistas del admin. */
  usuario?: { id: string; email: string | null; nombre: string | null; tokens: number };
}

export interface ResumenPagos {
  /** Los cursos con precio se pagan subiendo el comprobante (carpeta «Cursos»). */
  cursos_pago_manual: boolean;
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
  subir: (datos: { tipo: "tokens" | "suscripcion" | "curso"; archivo_id: string; curso_id?: string; cantidad?: number; monto_cop?: number; nota?: string }) =>
    apiRequest<Comprobante>("/comprobantes", { method: "POST", body: datos }),
  cursosPorPagar: () => apiRequest<CursoPorPagar[]>("/comprobantes/cursos"),

  // Admin
  paraAdmin: (filtros: { estado?: EstadoComprobante; tipo?: TipoComprobante } = {}) => {
    const q = new URLSearchParams();
    if (filtros.estado) q.set("estado", filtros.estado);
    if (filtros.tipo) q.set("tipo", filtros.tipo);
    const qs = q.toString();
    return apiRequest<Comprobante[]>(`/comprobantes/admin${qs ? `?${qs}` : ""}`);
  },
  /** `cantidad`: tokens a acreditar o días de suscripción. Un curso no lleva cantidad: se da el acceso. */
  aprobar: (id: string, cantidad?: number) =>
    apiRequest<Comprobante>(`/comprobantes/${id}/aprobar`, { method: "POST", body: cantidad == null ? {} : { cantidad } }),
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
