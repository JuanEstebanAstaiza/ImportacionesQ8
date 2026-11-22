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
  | "maq-catalogo"
  | "maq-resenas"
  // Cliente
  | "maq-directorio"
  | "maq-maquiladora"
  | "maq-solicitar"
  | "maq-solicitudes"
  | "maq-pedidos"
  | "maq-marca-blanca"
  | "maq-calculadora"
  // Panel admin
  | "maq-admin-verificacion"
  | "maq-admin-moderacion";

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
  { screen: "maq-catalogo", path: "/maquilas/catalogo" },
  { screen: "maq-resenas", path: "/maquilas/resenas" },
  { screen: "maq-directorio", path: "/maquilas/directorio" },
  { screen: "maq-maquiladora", path: "/maquilas/directorio", param: "maquiladora" },
  { screen: "maq-solicitar", path: "/maquilas/solicitar" },
  { screen: "maq-solicitar", path: "/maquilas/solicitar", param: "maquiladora" },
  { screen: "maq-solicitudes", path: "/maquilas/solicitudes" },
  { screen: "maq-solicitudes", path: "/maquilas/solicitudes", param: "solicitud" },
  { screen: "maq-pedidos", path: "/maquilas/pedidos" },
  { screen: "maq-pedidos", path: "/maquilas/pedidos", param: "pedido" },
  { screen: "maq-marca-blanca", path: "/maquilas/marca-blanca" },
  { screen: "maq-marca-blanca", path: "/maquilas/marca-blanca", param: "producto" },
  { screen: "maq-calculadora", path: "/maquilas/calculadora" },
  // Su administración vive en el panel admin de siempre.
  { screen: "maq-admin-verificacion", path: "/admin/maquilas/verificacion" },
  { screen: "maq-admin-verificacion", path: "/admin/maquilas/verificacion", param: "maquiladora" },
  { screen: "maq-admin-moderacion", path: "/admin/maquilas/moderacion" },
];

/** Pantallas públicas del módulo (se ven sin sesión). */
export const PANTALLAS_PUBLICAS_MAQUILAS = ["maq-landing", "maq-registro"] as const;
