import { clsx } from "clsx";

/**
 * Logo del sidebar con el nombre del producto de la suite en uso
 * («zarpi LIQUIDACIONES»), para que siempre se sepa dónde se está.
 * Importaciones es la marca de siempre y va sin nombre. El cambio de producto
 * lo hace la rueda del encabezado (`SuiteWheelSwitcher`).
 */
export function LogoProducto({ dark, expandido, nombre }: { dark: boolean; expandido: boolean; nombre?: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0" title={nombre ? `Zarpi ${nombre}` : "Zarpi"}>
      <img
        src={dark ? (expandido ? "/brand/zarpi-wordmark-acid.svg" : "/brand/zarpi-isotipo-acid.svg") : (expandido ? "/brand/zarpi-wordmark.svg" : "/brand/zarpi-isotipo.svg")}
        alt="Zarpi"
        className={clsx("object-contain object-left transition-all duration-200 flex-shrink-0", expandido ? (nombre ? "h-6 w-[4.5rem]" : "h-8 w-28") : "h-8 w-8")}
      />
      {expandido && nombre && <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground whitespace-nowrap">{nombre}</span>}
    </div>
  );
}
