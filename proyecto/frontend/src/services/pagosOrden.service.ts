import { apiRequest } from "@/services/api-client";

/**
 * Pago del cliente a la empresa importadora por cada orden. La orden nace como
 * «Orden generada · pago pendiente»: el cliente sube el comprobante a la carpeta
 * de pagos de la operación y la empresa lo confirma; hasta entonces no pasa a
 * producción. Ver backend/services/pagos_orden.py.
 */

export type EstadoComprobanteOrden = "pendiente" | "confirmado" | "rechazado";

export interface ComprobanteOrden {
  id: string;
  estado: EstadoComprobanteOrden;
  archivo: { id: string; nombre: string | null; tipo_recurso: string | null; url: string };
  monto_cop: number | null;
  nota: string | null;
  motivo_rechazo: string | null;
  fecha: string | null;
  revisado_en: string | null;
}

export interface PagosOrden {
  orden_id: string;
  codigo: string;
  estado_orden: string;
  pago_confirmado: boolean;
  comprobante_por_revisar: boolean;
  /** Total del formulario de la propuesta aceptada: «$… (COP, IVA incluido)». */
  monto_acordado: string | null;
  precio_acordado_usd: number | null;
  /** Solo para el cliente: su carpeta «Pagos/Operaciones/ORD-…» en gestión documental. */
  carpeta_id: string | null;
  puede_subir: boolean;
  puede_revisar: boolean;
  comprobantes: ComprobanteOrden[];
}

export const pagosOrdenService = {
  ver: (ordenId: string) => apiRequest<PagosOrden>(`/ordenes/${ordenId}/pagos`),
  /** El archivo ya debe estar subido a la carpeta de pagos de la operación. */
  enviar: (ordenId: string, datos: { archivo_id: string; monto_cop?: number; nota?: string }) =>
    apiRequest<ComprobanteOrden>(`/ordenes/${ordenId}/pagos`, { method: "POST", body: datos }),
  confirmar: (ordenId: string, comprobanteId: string) =>
    apiRequest<ComprobanteOrden>(`/ordenes/${ordenId}/pagos/${comprobanteId}/confirmar`, { method: "POST", body: {} }),
  rechazar: (ordenId: string, comprobanteId: string, motivo: string) =>
    apiRequest<ComprobanteOrden>(`/ordenes/${ordenId}/pagos/${comprobanteId}/rechazar`, {
      method: "POST", body: { motivo },
    }),
};
