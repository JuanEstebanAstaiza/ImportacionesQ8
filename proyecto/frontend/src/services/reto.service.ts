import { apiRequest } from "@/services/api-client";

/**
 * Reto comunitario de Tendencias: «te pagamos por subirnos los productos más
 * virales». Rondas de cupos limitados; por cada `umbral_aprobados` (10)
 * productos aprobados se reclama una recompensa: efectivo por transferencia o
 * cotizaciones gratis. Una por persona y ronda. Ver backend/routers/reto.py.
 */

export type EstadoRonda = "abierta" | "llena" | "cerrada";
export type EstadoRecompensa = "pendiente" | "reclamable" | "solicitada" | "pagada";
export type Eleccion = "efectivo" | "cotizaciones";

export interface Ronda {
  id: string;
  nombre: string;
  max_participantes: number;
  /** Cupos libres, calculados en vivo. */
  cupos_restantes: number;
  umbral_aprobados: number;
  recompensa_cop: number;
  recompensa_cotizaciones: number;
  /** ISO en UTC con "Z". */
  fecha_limite: string;
  estado: EstadoRonda;
  /** Texto fijo que va antes del botón de inscribirse. */
  exclusiones: string;
}

export interface RondaAdmin extends Ronda {
  inscritos: number;
  /** Cupos × recompensa. */
  presupuesto_cop: number;
  pagado_cop: number;
  abrir_siguiente_al_llenarse: boolean;
  fecha_creacion: string;
}

export interface Participacion {
  id: string;
  ronda: Ronda;
  aprobados: number;
  umbral: number;
  eleccion: Eleccion | null;
  estado_recompensa: EstadoRecompensa;
  pagado_en: string | null;
  referencia_pago: string | null;
  /** Solo banco, tipo y últimos 4 dígitos: el número completo nunca vuelve al navegador del usuario. */
  cuenta: { banco: string; tipo_cuenta: string; ultimos_digitos: string } | null;
}

export interface CuentaPagoDatos {
  banco: string;
  tipo_cuenta: "ahorros" | "corriente";
  numero_cuenta: string;
  titular: string;
  documento_titular: string;
}

export interface ParticipanteAdmin {
  id: string;
  usuario: { id: string; nombre: string | null; email: string };
  aprobados: number;
  eleccion: Eleccion | null;
  estado_recompensa: EstadoRecompensa;
  /** Descifrada: solo la ve el admin que hace la transferencia. */
  cuenta: { banco: string; tipo_cuenta: string; numero: string; titular: string; documento: string } | { error: string } | null;
  pagado_en: string | null;
  referencia_pago: string | null;
  fecha_inscripcion: string;
}

export interface RondaDatos {
  nombre: string;
  max_participantes: number;
  umbral_aprobados: number;
  recompensa_cop: number;
  recompensa_cotizaciones: number;
  /** "YYYY-MM-DDTHH:mm", hora de Bogotá. */
  fecha_limite: string;
  abrir_siguiente_al_llenarse: boolean;
}

export const BANCOS_COLOMBIA = [
  "Bancolombia", "Banco de Bogotá", "Davivienda", "BBVA", "Banco de Occidente", "Banco Popular",
  "Banco AV Villas", "Banco Caja Social", "Scotiabank Colpatria", "Banco Agrario", "Itaú",
  "Banco Falabella", "Banco Pichincha", "Banco GNB Sudameris", "Nequi", "Daviplata", "Lulo Bank", "Nu",
];

export function pesos(valor: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);
}

export const retoService = {
  // Público
  rondaAbierta: () => apiRequest<{ ronda: Ronda | null; exclusiones: string }>("/reto/rondas/abierta"),
  /** «Ronda cerrada. Avisame de la próxima». */
  listaEspera: (email: string) => apiRequest<void>("/reto/lista-espera", { method: "POST", body: { email } }),

  // Usuario registrado
  inscribirme: (rondaId: string) => apiRequest<Participacion>(`/reto/rondas/${rondaId}/inscribirme`, { method: "POST" }),
  miParticipacion: () => apiRequest<{ participacion: Participacion | null; cotizaciones_gratis: number }>("/reto/mi-participacion"),
  reclamar: (participacionId: string, eleccion: Eleccion) =>
    apiRequest<Participacion>(`/reto/participaciones/${participacionId}/reclamar`, { method: "POST", body: { eleccion } }),
  guardarCuenta: (participacionId: string, datos: CuentaPagoDatos) =>
    apiRequest<Participacion>(`/reto/participaciones/${participacionId}/cuenta-pago`, { method: "PUT", body: datos }),

  // Admin
  rondas: () => apiRequest<RondaAdmin[]>("/reto/rondas"),
  crearRonda: (datos: RondaDatos) => apiRequest<RondaAdmin>("/reto/rondas", { method: "POST", body: datos }),
  editarRonda: (id: string, cambios: Partial<Omit<RondaDatos, "umbral_aprobados" | "recompensa_cop" | "recompensa_cotizaciones">> & { cerrar?: boolean }) =>
    apiRequest<RondaAdmin>(`/reto/rondas/${id}`, { method: "PATCH", body: cambios }),
  participantes: (rondaId: string) => apiRequest<ParticipanteAdmin[]>(`/reto/rondas/${rondaId}/participantes`),
  marcarPagado: (participacionId: string, referencia: string) =>
    apiRequest<{ ok: boolean }>(`/reto/participaciones/${participacionId}/pagado`, { method: "PATCH", body: { referencia } }),
};
