import type { Screen } from "@/app/rutas";

export type DestinosSuite = Record<string, (() => void) | undefined>;

/** Destinos del selector radial hacia cada app; las apagadas van como undefined y no se muestran. */
export function crearDestinosSuite(opts: {
  goTo: (screen: Screen) => void;
  /** Pantalla de inicio de Importaciones para quien ya tiene sesión. */
  inicioImportaciones: Screen;
  liquidacionesActiva: boolean;
}): DestinosSuite {
  const { goTo, inicioImportaciones, liquidacionesActiva } = opts;
  return {
    importaciones: () => goTo(inicioImportaciones),
    liquidaciones: liquidacionesActiva ? () => goTo("liq-landing") : undefined,
    marketplace: () => goTo("mkt-landing"),
    maquilas: () => goTo("maq-landing"),
  };
}
