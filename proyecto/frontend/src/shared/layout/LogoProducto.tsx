import { clsx } from "clsx";

/**
 * Logo de Zarpi en la cabecera del sidebar. Es solo marca: el producto en uso
 * y el cambio entre productos los muestra la rueda del encabezado
 * (`SuiteWheelSwitcher`), que es el único selector de la suite.
 */
export function LogoProducto({ dark, expandido }: { dark: boolean; expandido: boolean }) {
  return (
    <img
      src={dark ? (expandido ? "/brand/zarpi-wordmark-acid.svg" : "/brand/zarpi-isotipo-acid.svg") : (expandido ? "/brand/zarpi-wordmark.svg" : "/brand/zarpi-isotipo.svg")}
      alt="Zarpi"
      className={clsx("object-contain object-left transition-all duration-200 flex-shrink-0", expandido ? "h-8 w-28" : "h-8 w-8")}
    />
  );
}
