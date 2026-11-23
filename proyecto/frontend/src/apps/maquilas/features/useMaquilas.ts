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
  vitrina: ["maquilas", "vitrina"] as const,
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
  catalogo: (filtros: object) => ["maquilas", "catalogo", filtros] as const,
  producto: (id: string) => ["maquilas", "catalogo", "producto", id] as const,
  misProductos: ["maquilas", "mis-productos"] as const,
  misResenas: ["maquilas", "mis-resenas"] as const,
  resenasPublicas: (id: string) => ["maquilas", "resenas", id] as const,
  productosAdmin: (filtros: object) => ["maquilas", "admin", "productos", filtros] as const,
  resenasAdmin: (filtros: object) => ["maquilas", "admin", "resenas", filtros] as const,
  marcas: ["maquilas", "marcas"] as const,
  marca: (id: string) => ["maquilas", "marcas", id] as const,
  encargos: (marca: string) => ["maquilas", "encargos", marca] as const,
  encargo: (id: string) => ["maquilas", "encargo", id] as const,
  colaDiseno: (filtros: object) => ["maquilas", "diseno", filtros] as const,
  equipo: ["maquilas", "equipo"] as const,
  resumenAdmin: ["maquilas", "admin", "resumen"] as const,
  solicitudesAdmin: (filtros: object) => ["maquilas", "admin", "solicitudes", filtros] as const,
  pedidosAdmin: (filtros: object) => ["maquilas", "admin", "pedidos", filtros] as const,
  configuracion: ["maquilas", "admin", "configuracion"] as const,
};

export function useParametrosMaquilas() {
  return useQuery({ queryKey: claves.parametros, queryFn: maquilasService.parametros, staleTime: 5 * 60_000 });
}

/** Landing pública: si el módulo falla, la portada se muestra igual con su contenido fijo. */
export function useVitrinaMaquilas() {
  return useQuery({ queryKey: claves.vitrina, queryFn: maquilasService.vitrina, staleTime: 60_000, retry: false });
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

// ── Fase 3 ──────────────────────────────────────────────────────────────────

export function useCatalogo(filtros: { categoria?: string; q?: string; cantidad?: number; maquiladora?: string }, enabled = true) {
  return useQuery({ queryKey: claves.catalogo(filtros), queryFn: () => maquilasService.catalogo(filtros), enabled });
}

export function useProducto(id: string | undefined) {
  return useQuery({ queryKey: claves.producto(id ?? ""), queryFn: () => maquilasService.producto(id!), enabled: Boolean(id) });
}

export function useMisProductos() {
  return useQuery({ queryKey: claves.misProductos, queryFn: maquilasService.misProductos });
}

export function useMisResenas() {
  return useQuery({ queryKey: claves.misResenas, queryFn: maquilasService.misResenas });
}

export function useResenasPublicas(id: string | undefined) {
  return useQuery({ queryKey: claves.resenasPublicas(id ?? ""), queryFn: () => maquilasService.resenasPublicas(id!), enabled: Boolean(id) });
}

export function useProductosAdmin(filtros: { q?: string; ocultos?: boolean }) {
  return useQuery({ queryKey: claves.productosAdmin(filtros), queryFn: () => maquilasService.productosAdmin(filtros) });
}

export function useResenasAdmin(filtros: { ocultas?: boolean; maximo?: number }) {
  return useQuery({ queryKey: claves.resenasAdmin(filtros), queryFn: () => maquilasService.resenasAdmin(filtros) });
}

// ── Fase 4 ──────────────────────────────────────────────────────────────────

export function useMarcas(enabled = true) {
  return useQuery({ queryKey: claves.marcas, queryFn: maquilasService.marcas, enabled });
}

export function useMarca(id: string | undefined) {
  return useQuery({ queryKey: claves.marca(id ?? ""), queryFn: () => maquilasService.marca(id!), enabled: Boolean(id) });
}

export function useEncargos(marcaId?: string) {
  return useQuery({ queryKey: claves.encargos(marcaId ?? ""), queryFn: () => maquilasService.misEncargos(marcaId) });
}

export function useEncargo(id: string | undefined) {
  return useQuery({ queryKey: claves.encargo(id ?? ""), queryFn: () => maquilasService.encargo(id!), enabled: Boolean(id), refetchInterval: 30_000 });
}

export function useColaDiseno(filtros: { estado?: string; mios?: boolean }) {
  return useQuery({ queryKey: claves.colaDiseno(filtros), queryFn: () => maquilasService.colaDiseno(filtros), refetchInterval: 60_000 });
}

export function useEquipo(enabled = true) {
  return useQuery({ queryKey: claves.equipo, queryFn: maquilasService.equipo, retry: false, enabled });
}

export function useResumenAdmin() {
  return useQuery({ queryKey: claves.resumenAdmin, queryFn: maquilasService.resumenAdmin, refetchInterval: 120_000 });
}

export function useSolicitudesAdmin(filtros: { estado?: string; modalidad?: string; q?: string }) {
  return useQuery({ queryKey: claves.solicitudesAdmin(filtros), queryFn: () => maquilasService.solicitudesAdmin(filtros) });
}

export function usePedidosAdmin(filtros: { estado?: string; q?: string; retrasados?: boolean }) {
  return useQuery({ queryKey: claves.pedidosAdmin(filtros), queryFn: () => maquilasService.pedidosAdmin(filtros) });
}

export function useConfiguracionMaquilas() {
  return useQuery({ queryKey: claves.configuracion, queryFn: maquilasService.configuracion });
}
