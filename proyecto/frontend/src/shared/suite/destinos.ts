import type { Screen } from "@/app/rutas";

export type DestinosSuite = Record<string, (() => void) | undefined>;

/** Destinos del selector radial hacia cada app; las apagadas van como undefined y no se muestran. */
export function crearDestinosSuite(opts: {
  goTo: (screen: Screen) => void;
  /** Pantalla de inicio de Importaciones para quien ya tiene sesión. */
  inicioImportaciones: Screen;
  liquidacionesActiva: boolean;
  maquilasActiva: boolean;
}): DestinosSuite {
  const { goTo, inicioImportaciones, liquidacionesActiva, maquilasActiva } = opts;
  return {
    importaciones: () => goTo(inicioImportaciones),
    liquidaciones: liquidacionesActiva ? () => goTo("liq-landing") : undefined,
    marketplace: () => goTo("mkt-landing"),
    maquilas: maquilasActiva ? () => goTo("maq-landing") : undefined,
  };
}
