import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { clsx } from "clsx";

/**
 * Logo del sidebar que, con más de un producto de la suite, cambia entre ellos.
 *
 * Una misma cuenta Zarpi entra a Importaciones y a Liquidaciones; el producto en
 * uso se nombra junto al logo («zarpi LIQUIDACIONES») para que siempre se sepa
 * dónde se está.
 */
export function SelectorProducto({
  dark,
  expandido,
  productos,
  producto,
  onProducto,
}: {
  dark: boolean;
  expandido: boolean;
  productos: { clave: string; nombre: string; descripcion: string }[];
  producto?: string;
  onProducto?: (clave: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const actual = productos.find((p) => p.clave === producto);
  const conSelector = productos.length > 1 && Boolean(onProducto);
  // Importaciones es la marca de siempre: el nombre solo acompaña al logo en los demás productos.
  const etiqueta = actual && actual.clave !== "importaciones" ? actual.nombre : null;

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (evento: MouseEvent) => {
      if (ref.current && !ref.current.contains(evento.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [abierto]);

  useEffect(() => {
    if (!expandido) setAbierto(false);
  }, [expandido]);

  const logo = (
    <img
      src={dark ? (expandido ? "/brand/zarpi-wordmark-acid.svg" : "/brand/zarpi-isotipo-acid.svg") : (expandido ? "/brand/zarpi-wordmark.svg" : "/brand/zarpi-isotipo.svg")}
      alt="Zarpi"
      className={clsx("object-contain object-left transition-all duration-200 flex-shrink-0", expandido ? (etiqueta ? "h-6 w-[4.5rem]" : "h-8 w-28") : "h-8 w-8")}
    />
  );

  if (!conSelector) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        {logo}
        {expandido && etiqueta && <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground truncate">{etiqueta}</span>}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => expandido && setAbierto((v) => !v)}
        className={clsx(
          "flex items-center w-full rounded-lg transition-colors",
          expandido ? "gap-2 px-1.5 py-1 hover:bg-muted" : "justify-center",
        )}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        title={expandido ? "Cambiar de producto" : actual?.nombre}
      >
        {logo}
        {expandido && (
          <>
            {etiqueta && <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground truncate">{etiqueta}</span>}
            <ChevronsUpDown className="ml-auto w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          </>
        )}
      </button>

      {abierto && (
        <div role="listbox" className="absolute left-0 right-0 top-full mt-2 z-[70] rounded-xl border border-border bg-white shadow-xl p-1.5">
          <p className="px-2.5 pt-1.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Suite Zarpi</p>
          {productos.map((p) => {
            const activo = p.clave === producto;
            return (
              <button
                key={p.clave}
                type="button"
                role="option"
                aria-selected={activo}
                onClick={() => {
                  setAbierto(false);
                  if (!activo) onProducto?.(p.clave);
                }}
                className={clsx(
                  "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                  activo ? "bg-primary/8 dark:bg-accent/15" : "hover:bg-muted",
                )}
              >
                <span className="flex-1 min-w-0">
                  <span className={clsx("block text-sm font-medium", activo ? "text-primary dark:text-accent" : "text-foreground")}>{p.nombre}</span>
                  <span className="block text-xs text-muted-foreground">{p.descripcion}</span>
                </span>
                {activo && <Check className="w-4 h-4 mt-0.5 text-primary dark:text-accent flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
