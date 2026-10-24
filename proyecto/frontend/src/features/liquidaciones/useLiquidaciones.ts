import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { liquidacionesService } from "@/services/liquidaciones.service";
import type { FiltrosCatalogo, LoteEntrada } from "@/features/liquidaciones/tipos";

/**
 * Datos del módulo con react-query: cada pantalla pide lo suyo y se invalida
 * tras cada acción, sin pasar estado por App.tsx.
 */

export const claves = {
  todo: ["liquidaciones"] as const,
  activacion: ["liquidaciones", "activacion"] as const,
  parametros: ["liquidaciones", "parametros"] as const,
  catalogo: (filtros: FiltrosCatalogo) => ["liquidaciones", "catalogo", filtros] as const,
  lote: (id: string) => ["liquidaciones", "lote", id] as const,
  misLotes: ["liquidaciones", "mis-lotes"] as const,
  operaciones: (lado: string) => ["liquidaciones", "operaciones", lado] as const,
  operacion: (id: string) => ["liquidaciones", "operacion", id] as const,
  publico: ["liquidaciones", "publico"] as const,
};

export function useActivacion(habilitado = true) {
  return useQuery({ queryKey: claves.activacion, queryFn: liquidacionesService.estadoActivacion, enabled: habilitado, staleTime: 60_000 });
}

export function useParametros() {
  return useQuery({ queryKey: claves.parametros, queryFn: liquidacionesService.parametros, staleTime: 5 * 60_000 });
}

export function useCatalogo(filtros: FiltrosCatalogo) {
  return useQuery({ queryKey: claves.catalogo(filtros), queryFn: () => liquidacionesService.catalogo(filtros), refetchInterval: 60_000 });
}

export function useLote(id: string) {
  return useQuery({ queryKey: claves.lote(id), queryFn: () => liquidacionesService.lote(id), enabled: Boolean(id) });
}

export function useMisLotes() {
  return useQuery({ queryKey: claves.misLotes, queryFn: liquidacionesService.misLotes, refetchInterval: 60_000 });
}

export function useOperaciones(lado: "comprador" | "vendedor") {
  return useQuery({ queryKey: claves.operaciones(lado), queryFn: () => liquidacionesService.operaciones(lado), refetchInterval: 30_000 });
}

/** El chat de la operación se refresca cada pocos segundos mientras está abierto. */
export function useOperacion(id: string, intervalo = 8_000) {
  return useQuery({
    queryKey: claves.operacion(id),
    queryFn: () => liquidacionesService.operacion(id),
    enabled: Boolean(id),
    refetchInterval: intervalo,
  });
}

export function useVistaPublica() {
  return useQuery({ queryKey: claves.publico, queryFn: () => liquidacionesService.vistaPublica(4), staleTime: 60_000, retry: false });
}

/** Tras cualquier acción del módulo se refresca todo lo suyo: es poco y siempre queda coherente. */
export function useInvalidarLiquidaciones() {
  const cliente = useQueryClient();
  return () => cliente.invalidateQueries({ queryKey: claves.todo });
}

export function useGuardarLote() {
  const invalidar = useInvalidarLiquidaciones();
  return useMutation({
    mutationFn: ({ id, datos }: { id?: string; datos: LoteEntrada }) =>
      id ? liquidacionesService.editarLote(id, datos) : liquidacionesService.crearLote(datos),
    onSuccess: () => { void invalidar(); },
  });
}
