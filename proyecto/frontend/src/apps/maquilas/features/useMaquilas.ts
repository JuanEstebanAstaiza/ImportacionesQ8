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
  directorio: (filtros: object) => ["maquilas", "directorio", filtros] as const,
  perfilPublico: (id: string) => ["maquilas", "directorio", "perfil", id] as const,
  misSolicitudes: ["maquilas", "solicitudes"] as const,
  recibidas: ["maquilas", "recibidas"] as const,
  solicitud: (id: string) => ["maquilas", "solicitud", id] as const,
  pedidos: ["maquilas", "pedidos"] as const,
  pedido: (id: string) => ["maquilas", "pedido", id] as const,
  mensajes: (hilo: string) => ["maquilas", "mensajes", hilo] as const,
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

export function useDirectorio(filtros: { categoria?: string; ciudad?: string; q?: string; cantidad?: number }) {
  return useQuery({ queryKey: claves.directorio(filtros), queryFn: () => maquilasService.directorio(filtros) });
}

export function usePerfilPublico(id: string | undefined) {
  return useQuery({ queryKey: claves.perfilPublico(id ?? ""), queryFn: () => maquilasService.perfilPublico(id!), enabled: Boolean(id) });
}

export function useMisSolicitudes() {
  return useQuery({ queryKey: claves.misSolicitudes, queryFn: maquilasService.misSolicitudes });
}

export function useRecibidas() {
  return useQuery({ queryKey: claves.recibidas, queryFn: maquilasService.recibidas, refetchInterval: 60_000 });
}

export function useSolicitud(id: string | undefined) {
  return useQuery({ queryKey: claves.solicitud(id ?? ""), queryFn: () => maquilasService.solicitud(id!), enabled: Boolean(id),
    refetchInterval: 30_000 });
}

export function usePedidos() {
  return useQuery({ queryKey: claves.pedidos, queryFn: maquilasService.pedidos, refetchInterval: 60_000 });
}

export function usePedido(id: string | undefined) {
  return useQuery({ queryKey: claves.pedido(id ?? ""), queryFn: () => maquilasService.pedido(id!), enabled: Boolean(id),
    refetchInterval: 20_000 });
}

export function useMensajes(hilo: string | undefined) {
  return useQuery({ queryKey: claves.mensajes(hilo ?? ""), queryFn: () => maquilasService.mensajes(hilo!), enabled: Boolean(hilo),
    refetchInterval: 10_000 });
}
