import type { Ruta } from "@/app/rutas";

/** Pantallas de Zarpi Maquilas (producto, registro público y su panel dentro del admin). */
export type ScreenMaquilas =
  | "maq-landing"
  | "maq-registro"
  // Maquiladora
  | "maq-panel"
  | "maq-perfil"
  | "maq-recibidas"
  | "maq-produccion"
  // Cliente
  | "maq-directorio"
  | "maq-maquiladora"
  | "maq-solicitar"
  | "maq-solicitudes"
  | "maq-pedidos"
  // Panel admin
  | "maq-admin-verificacion";

/** Las rutas fijas van antes que las de parámetro. */
export const RUTAS_MAQUILAS: Ruta[] = [
  { screen: "maq-landing", path: "/maquilas" },
  { screen: "maq-registro", path: "/maquilas/registro" },
  { screen: "maq-panel", path: "/maquilas/panel" },
  { screen: "maq-perfil", path: "/maquilas/perfil" },
  { screen: "maq-recibidas", path: "/maquilas/recibidas" },
  { screen: "maq-recibidas", path: "/maquilas/recibidas", param: "solicitud" },
  { screen: "maq-produccion", path: "/maquilas/produccion" },
  { screen: "maq-produccion", path: "/maquilas/produccion", param: "pedido" },
  { screen: "maq-directorio", path: "/maquilas/directorio" },
  { screen: "maq-maquiladora", path: "/maquilas/directorio", param: "maquiladora" },
  { screen: "maq-solicitar", path: "/maquilas/solicitar" },
  { screen: "maq-solicitar", path: "/maquilas/solicitar", param: "maquiladora" },
  { screen: "maq-solicitudes", path: "/maquilas/solicitudes" },
  { screen: "maq-solicitudes", path: "/maquilas/solicitudes", param: "solicitud" },
  { screen: "maq-pedidos", path: "/maquilas/pedidos" },
  { screen: "maq-pedidos", path: "/maquilas/pedidos", param: "pedido" },
  // Su administración vive en el panel admin de siempre.
  { screen: "maq-admin-verificacion", path: "/admin/maquilas/verificacion" },
  { screen: "maq-admin-verificacion", path: "/admin/maquilas/verificacion", param: "maquiladora" },
];

/** Pantallas públicas del módulo (se ven sin sesión). */
export const PANTALLAS_PUBLICAS_MAQUILAS = ["maq-landing", "maq-registro"] as const;
