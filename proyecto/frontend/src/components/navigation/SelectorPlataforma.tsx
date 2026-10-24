import { clsx } from "clsx";

import { MODULOS_SUITE, type Producto } from "@/config/suite";

type Props = {
  /** Plataforma de la página donde está el selector: va marcada y no es un botón. */
  actual: Producto;
  /** A dónde lleva cada una de las otras; las que no vienen (módulo apagado) no se muestran. */
  destinos: Partial<Record<Producto, () => void>>;
  className?: string;
};

/**
 * Cambio entre las plataformas de la suite en las páginas públicas (landings),
 * junto al logo. Dentro del portal, el cambio lo hace el selector del sidebar.
 */
export function SelectorPlataforma({ actual, destinos, className }: Props) {
  const plataformas = MODULOS_SUITE.filter((m) => m.clave === actual || destinos[m.clave]);
  if (plataformas.length < 2) return null;

  return (
    <div role="group" aria-label="Plataformas Zarpi" className={clsx("flex-shrink-0 items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5", className)}>
      {plataformas.map((m) =>
        m.clave === actual ? (
          <span key={m.clave} aria-current="page" className="whitespace-nowrap rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground dark:bg-accent dark:text-accent-foreground">
            {m.nombre}
          </span>
        ) : (
          <button
            key={m.clave}
            type="button"
            onClick={destinos[m.clave]}
            className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            {m.nombre}
          </button>
        ),
      )}
    </div>
  );
}
