import type { Ruta } from "@/app/rutas";

/** Pantallas de Zarpi Maquilas (producto, registro público y su panel dentro del admin). */
export type ScreenMaquilas =
  | "maq-landing"
  | "maq-registro"
  | "maq-panel"
  | "maq-perfil"
  | "maq-admin-verificacion";

/** Las rutas fijas van antes que las de parámetro. */
export const RUTAS_MAQUILAS: Ruta[] = [
  { screen: "maq-landing", path: "/maquilas" },
  { screen: "maq-registro", path: "/maquilas/registro" },
  { screen: "maq-panel", path: "/maquilas/panel" },
  { screen: "maq-perfil", path: "/maquilas/perfil" },
  // Su administración vive en el panel admin de siempre.
  { screen: "maq-admin-verificacion", path: "/admin/maquilas/verificacion" },
  { screen: "maq-admin-verificacion", path: "/admin/maquilas/verificacion", param: "maquiladora" },
];

/** Pantallas públicas del módulo (se ven sin sesión). */
export const PANTALLAS_PUBLICAS_MAQUILAS = ["maq-landing", "maq-registro"] as const;
