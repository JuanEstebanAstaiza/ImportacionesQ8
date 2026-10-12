import { apiRequest } from "@/services/api-client";

/**
 * Módulos de la plataforma que el admin enciende o apaga sin redesplegar.
 * Lo que se elige aquí manda sobre el `.env`. Ver backend/services/modulos.py.
 */

export interface ModuloPlataforma {
  activo: boolean;
  nombre: string;
  descripcion: string;
}

/** Clave pública del módulo (p. ej. "academico") → su estado. */
export type ModulosPlataforma = Record<string, ModuloPlataforma>;

/** Solo se mandan los módulos que cambian. */
export interface CambioModulos {
  academico?: boolean;
  [clave: string]: boolean | undefined;
}

export const modulosService = {
  listar: () => apiRequest<ModulosPlataforma>("/admin/modulos"),
  cambiar: (cambios: CambioModulos) => apiRequest<ModulosPlataforma>("/admin/modulos", { method: "PUT", body: cambios }),
};
