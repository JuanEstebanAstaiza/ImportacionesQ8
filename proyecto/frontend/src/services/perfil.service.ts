import { apiRequest } from "@/services/api-client";
import type { CuentaPagoDatos } from "@/services/reto.service";

/**
 * Perfil personal de cualquier cuenta (cliente, dueño o asesor de empresa,
 * admin): datos, foto, contraseña y cuenta bancaria para recibir pagos.
 * Ver backend/routers/usuarios.py.
 */

export interface MiPerfil {
  id: string;
  email: string;
  rol: "solicitante" | "importador" | "asesor" | "admin";
  importador_id: string | null;
  nombre: string | null;
  apellido: string | null;
  indicativo_pais_telefono: string | null;
  telefono: string | null;
  whatsapp: string | null;
  foto_url: string | null;
  // Del registro: se muestran, no se editan.
  tipo_persona: "natural" | "juridica" | null;
  tipo_documento: string | null;
  numero_documento: string | null;
  nit: string | null;
  razon_social: string | null;
  tier?: string;
  cotizaciones_gratis?: number;
  fecha_creacion: string;
}

export interface CambiosPerfil {
  nombre?: string;
  apellido?: string;
  indicativo_pais_telefono?: string;
  telefono?: string;
  whatsapp?: string;
  /** "" la quita. */
  foto_url?: string;
}

/** Lo que vuelve al dueño: el número nunca completo. */
export interface CuentaPagoResumen {
  banco: string;
  tipo_cuenta: "ahorros" | "corriente";
  ultimos_digitos: string;
  titular: string;
  /** Enmascarado: «•••••••050». */
  documento: string | null;
  fecha_actualizacion: string | null;
}

export const perfilService = {
  obtener: () => apiRequest<MiPerfil>("/usuarios/me"),
  guardar: (cambios: CambiosPerfil) => apiRequest<MiPerfil>("/usuarios/me", { method: "PUT", body: cambios }),
  cambiarContrasena: (actual: string, nueva: string) =>
    apiRequest<void>("/usuarios/me/contrasena", { method: "POST", body: { actual, nueva } }),
  cuentaPago: () => apiRequest<{ cuenta: CuentaPagoResumen | null }>("/usuarios/me/cuenta-pago"),
  guardarCuentaPago: (datos: CuentaPagoDatos) =>
    apiRequest<{ cuenta: CuentaPagoResumen }>("/usuarios/me/cuenta-pago", { method: "PUT", body: datos }),
  borrarCuentaPago: () => apiRequest<void>("/usuarios/me/cuenta-pago", { method: "DELETE" }),
};
