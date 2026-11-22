import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { maquilasService } from "@/services/maquilas.service";

/**
 * Datos del módulo con react-query: cada pantalla pide lo suyo y se invalida
 * tras cada acción, sin pasar estado por App.tsx.
 */
export const claves = {
  todo: ["maquilas"] as const,
  parametros: ["maquilas", "parametros"] as const,
  mia: ["maquilas", "mi-maquiladora"] as const,
  listado: (estado: string, q: string) => ["maquilas", "admin", "listado", estado, q] as const,
  detalle: (id: string) => ["maquilas", "admin", "detalle", id] as const,
};

export function useParametrosMaquilas() {
  return useQuery({ queryKey: claves.parametros, queryFn: maquilasService.parametros, staleTime: 5 * 60_000 });
}

export function useMiMaquiladora() {
  return useQuery({ queryKey: claves.mia, queryFn: maquilasService.miMaquiladora, staleTime: 30_000 });
}

export function useMaquiladorasAdmin(estado: string, q: string) {
  return useQuery({
    queryKey: claves.listado(estado, q),
    queryFn: () => maquilasService.listar({ estado: estado || undefined, q: q || undefined }),
  });
}

export function useMaquiladoraAdmin(id: string | undefined) {
  return useQuery({ queryKey: claves.detalle(id ?? ""), queryFn: () => maquilasService.detalle(id!), enabled: Boolean(id) });
}

export function useInvalidarMaquilas() {
  const cliente = useQueryClient();
  return useCallback(() => cliente.invalidateQueries({ queryKey: claves.todo }), [cliente]);
}
