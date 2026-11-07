import type { Ruta } from "@/app/rutas";

/** Pantallas de Zarpi Liquidaciones (producto y su panel dentro del admin). */
export type ScreenLiquidaciones =
  | "liq-landing"
  | "liq-catalogo"
  | "liq-lote"
  | "liq-activar"
  | "liq-reservas"
  | "liq-mis-lotes"
  | "liq-publicar"
  | "liq-operaciones"
  | "liq-revision"
  | "liq-admin-resumen"
  | "liq-admin-lotes"
  | "liq-admin-operaciones"
  | "liq-admin-cuentas"
  | "liq-admin-config";

/** La landing es pública; el resto usa la misma sesión de Zarpi. El orden importa: las rutas fijas van antes que las de parámetro. */
export const RUTAS_LIQUIDACIONES: Ruta[] = [
  { screen: "liq-landing", path: "/liquidaciones" },
  { screen: "liq-catalogo", path: "/liquidaciones/lotes" },
  { screen: "liq-lote", path: "/liquidaciones/lotes", param: "lote" },
  { screen: "liq-activar", path: "/liquidaciones/activar" },
  { screen: "liq-reservas", path: "/liquidaciones/reservas" },
  { screen: "liq-reservas", path: "/liquidaciones/reservas", param: "operacion" },
  { screen: "liq-mis-lotes", path: "/liquidaciones/mis-lotes" },
  { screen: "liq-publicar", path: "/liquidaciones/publicar" },
  { screen: "liq-publicar", path: "/liquidaciones/publicar", param: "lote" },
  { screen: "liq-operaciones", path: "/liquidaciones/operaciones" },
  { screen: "liq-operaciones", path: "/liquidaciones/operaciones", param: "operacion" },
  // Su administración vive en el panel admin de siempre.
  { screen: "liq-admin-resumen", path: "/admin/liquidaciones" },
  { screen: "liq-revision", path: "/admin/liquidaciones/revision" },
  { screen: "liq-admin-lotes", path: "/admin/liquidaciones/lotes" },
  { screen: "liq-admin-operaciones", path: "/admin/liquidaciones/operaciones" },
  { screen: "liq-admin-operaciones", path: "/admin/liquidaciones/operaciones", param: "operacion" },
  { screen: "liq-admin-cuentas", path: "/admin/liquidaciones/cuentas" },
  { screen: "liq-admin-config", path: "/admin/liquidaciones/configuracion" },
];
