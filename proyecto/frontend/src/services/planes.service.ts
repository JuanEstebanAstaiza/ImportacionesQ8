import { apiRequest } from "@/services/api-client";

/**
 * Planes de acceso con pago manual (backend/services/planes.py).
 * Público: la sección «Planes» del home y la inscripción, que no exige sesión.
 * Admin: editar los planes y activar o rechazar las inscripciones.
 */

export interface Plan {
  id: string;
  clave: string;
  nombre: string;
  para_quien: string | null;
  precio_cop: number;
  iva_pct: number;
  iva_cop: number;
  total_cop: number;
  solicitudes_incluidas: number;
  vigencia_meses: number;
  dias_tendencias: number | null;
  precio_solicitud_adicional_cop: number | null;
  total_solicitud_adicional_cop: number | null;
  incluye: string[];
  cupos_totales: number | null;
  /** null: sin límite de cupos. */
  cupos_restantes: number | null;
  destacado: boolean;
  orden: number;
  /** Video de la tarjeta (Admin › Planes › Videos). null: sin video. */
  video: VideoPlan | null;
}

/**
 * Como los videos de «Quiénes somos»: horizontal (computador), vertical
 * (celular) o los dos. Rutas de Documentos (`/documentos/archivos/…`).
 */
export interface VideoPlan {
  horizontal: string | null;
  vertical: string | null;
  titulo: string | null;
}

export interface PlanAdmin extends Plan {
  activo: boolean;
  inscripciones: Record<EstadoInscripcion, number>;
}

export type EstadoInscripcion = "pendiente" | "activa" | "rechazada" | "lista_espera";

export interface DatosInscripcion {
  email: string;
  tipo_persona: "natural" | "juridica";
  nombre?: string;
  apellido?: string;
  tipo_documento?: string;
  numero_documento?: string;
  razon_social?: string;
  nit?: string;
  indicativo_pais_telefono: string;
  telefono: string;
  ciudad?: string;
  acepto_condiciones: boolean;
  acepto_datos: boolean;
}

export interface InscripcionAdmin {
  id: string;
  estado: EstadoInscripcion;
  plan: { id: string; nombre: string | null; clave: string | null };
  usuario_id: string | null;
  email: string;
  nombre: string;
  tipo_persona: string;
  documento: string;
  telefono: string;
  ciudad: string | null;
  precio_cop: number | null;
  iva_cop: number | null;
  total_cop: number | null;
  tiene_comprobante: boolean;
  comprobante_nombre: string | null;
  motivo_rechazo: string | null;
  vence_en: string | null;
  revisado_en: string | null;
  fecha: string | null;
}

export type CamposPlan = Omit<Plan, "id" | "iva_cop" | "total_cop" | "total_solicitud_adicional_cop" | "cupos_restantes" | "video"> & {
  activo: boolean;
};

export function pesos(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return "$" + Math.round(valor).toLocaleString("es-CO");
}

export const planesService = {
  listar(): Promise<{ planes: Plan[]; datos_pago: string | null }> {
    return apiRequest("/planes", { method: "GET" });
  },

  inscribir(clave: string, datos: DatosInscripcion, comprobante: File): Promise<{ id: string; total_cop: number }> {
    const form = new FormData();
    form.append("datos", JSON.stringify(datos));
    form.append("comprobante", comprobante);
    return apiRequest(`/planes/${encodeURIComponent(clave)}/inscripcion`, { method: "POST", body: form });
  },

  listaEspera(clave: string, datos: DatosInscripcion): Promise<{ id: string }> {
    return apiRequest(`/planes/${encodeURIComponent(clave)}/lista-espera`, { method: "POST", body: datos });
  },

  // ── Admin ──
  adminPlanes(): Promise<PlanAdmin[]> {
    return apiRequest("/planes/admin/planes", { method: "GET" });
  },

  crearPlan(datos: CamposPlan): Promise<PlanAdmin> {
    return apiRequest("/planes/admin/planes", { method: "POST", body: datos });
  },

  actualizarPlan(id: string, datos: Partial<CamposPlan>): Promise<PlanAdmin> {
    return apiRequest(`/planes/admin/planes/${id}`, { method: "PUT", body: datos });
  },

  guardarVideo(id: string, video: VideoPlan): Promise<{ video: VideoPlan | null }> {
    return apiRequest(`/planes/admin/planes/${id}/video`, { method: "PUT", body: video });
  },

  quitarVideo(id: string): Promise<{ video: null }> {
    return apiRequest(`/planes/admin/planes/${id}/video`, { method: "DELETE" });
  },

  inscripciones(estado?: EstadoInscripcion): Promise<InscripcionAdmin[]> {
    return apiRequest(`/planes/admin/inscripciones${estado ? `?estado=${estado}` : ""}`, { method: "GET" });
  },

  activar(id: string): Promise<InscripcionAdmin> {
    return apiRequest(`/planes/admin/inscripciones/${id}/activar`, { method: "POST" });
  },

  rechazar(id: string, motivo: string): Promise<InscripcionAdmin> {
    return apiRequest(`/planes/admin/inscripciones/${id}/rechazar`, { method: "POST", body: { motivo } });
  },

  /** El comprobante solo lo descarga el admin: se pide con el token (abrir-archivo). */
  rutaComprobante(id: string): string {
    return `/planes/admin/inscripciones/${id}/comprobante`;
  },
};
