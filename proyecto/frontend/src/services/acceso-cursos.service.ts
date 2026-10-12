import { apiRequest } from "@/services/api-client";

/**
 * Accesos a cursos (admin): quién tiene acceso a cada curso y de dónde salió.
 * Mientras no hay pasarela, el equipo da el acceso a mano cuando confirma un
 * pago por fuera (o lo quita). Ver backend/services/acceso_cursos.py.
 */

export type OrigenAccesoCurso = "inscripcion" | "comprobante" | "manual";

export interface CursoCatalogo {
  id: string;
  titulo: string;
  precio: number;
  importadora_nombre: string | null;
  estudiantes: number;
}

export interface AccesoCurso {
  id: string;
  curso: { id: string; titulo: string };
  usuario: { id: string; email: string; nombre: string | null };
  origen: OrigenAccesoCurso;
  precio_pagado: number;
  /** Correo del admin que lo dio (o aprobó el comprobante). */
  otorgado_por: string | null;
  nota: string | null;
  fecha: string | null;
}

export const accesoCursosService = {
  catalogo: () => apiRequest<CursoCatalogo[]>("/admin/cursos/catalogo"),
  listar: (filtros: { curso_id?: string; q?: string } = {}) => {
    const q = new URLSearchParams();
    if (filtros.curso_id) q.set("curso_id", filtros.curso_id);
    if (filtros.q) q.set("q", filtros.q);
    const qs = q.toString();
    return apiRequest<AccesoCurso[]>(`/admin/cursos/accesos${qs ? `?${qs}` : ""}`);
  },
  dar: (datos: { curso_id: string; email: string; nota?: string }) =>
    apiRequest<AccesoCurso>("/admin/cursos/accesos", { method: "POST", body: datos }),
  quitar: (id: string) => apiRequest<{ ok: boolean }>(`/admin/cursos/accesos/${id}`, { method: "DELETE" }),
};
