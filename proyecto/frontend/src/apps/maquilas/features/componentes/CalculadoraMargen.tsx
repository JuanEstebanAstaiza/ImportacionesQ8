import { useMemo, useState } from "react";
import { AlertTriangle, Calculator } from "lucide-react";
import { clsx } from "clsx";

import { Input } from "@shared/ui/design-system";
import { calcular } from "@apps/maquilas/features/calculadora";
import { pesos } from "@apps/maquilas/features/formato";

type Campos = Record<"costoFabricacion" | "cantidad" | "empaque" | "etiquetas" | "envio" | "costosFijos" | "impuesto" | "comision" | "margen" | "precioPropio", string>;

const num = (v: string) => Number.parseFloat(v.replace(",", ".")) || 0;

function Resultado({ etiqueta, valor, destacado, detalle }: { etiqueta: string; valor: string; destacado?: boolean; detalle?: string }) {
  return (
    <div className={clsx("rounded-xl border p-3", destacado ? "border-primary/30 bg-primary/5 dark:border-accent/40 dark:bg-accent/10" : "border-border")}>
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className={clsx("font-semibold", destacado ? "text-xl" : "text-base")}>{valor}</p>
      {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
    </div>
  );
}

/**
 * Calculadora de costo y margen. Con `precio` y `cantidad` arranca con los datos de
 * una propuesta o pedido; todo se calcula en el navegador.
 */
export function CalculadoraMargen({ precio, cantidad, costosFijos }: { precio?: number; cantidad?: number; costosFijos?: number }) {
  const [c, setC] = useState<Campos>({
    costoFabricacion: precio ? String(precio) : "", cantidad: cantidad ? String(cantidad) : "",
    empaque: "0", etiquetas: "0", envio: "0", costosFijos: costosFijos ? String(costosFijos) : "0",
    impuesto: "19", comision: "0", margen: "30", precioPropio: "",
  });
  const r = useMemo(() => calcular({
    costoFabricacion: num(c.costoFabricacion), cantidad: num(c.cantidad), empaque: num(c.empaque), etiquetas: num(c.etiquetas),
    envio: num(c.envio), costosFijos: num(c.costosFijos), impuesto: num(c.impuesto), comision: num(c.comision),
    margen: num(c.margen), precioPropio: c.precioPropio ? num(c.precioPropio) : null,
  }), [c]);
  const campo = (clave: keyof Campos) => ({ value: c[clave], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [clave]: e.target.value }) });
  const listo = num(c.costoFabricacion) > 0 && num(c.cantidad) > 0;
  const usaPropio = Boolean(c.precioPropio && num(c.precioPropio) > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-5">
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Lo que te cuesta</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Precio de la maquila por unidad" type="number" min={0} prefix="$" {...campo("costoFabricacion")} />
            <Input label="Cantidad del lote" type="number" min={1} suffix="und." {...campo("cantidad")} />
            <Input label="Empaque por unidad" type="number" min={0} prefix="$" {...campo("empaque")} />
            <Input label="Etiquetas por unidad" type="number" min={0} prefix="$" {...campo("etiquetas")} />
            <Input label="Envío del lote" type="number" min={0} prefix="$" {...campo("envio")} hint="Flete hasta tu bodega" />
            <Input label="Otros costos del lote" type="number" min={0} prefix="$" {...campo("costosFijos")} hint="Muestra, diseño, registros, fotos" />
          </div>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Cómo lo vendes</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="IVA" type="number" min={0} max={100} suffix="%" {...campo("impuesto")} />
            <Input label="Comisión del canal" type="number" min={0} max={100} suffix="%" {...campo("comision")} hint="Marketplace o pasarela" />
            <Input label="Margen que quieres" type="number" min={0} max={95} suffix="%" {...campo("margen")} />
          </div>
          <Input label="¿Ya tienes precio al público? (con IVA, opcional)" type="number" min={0} prefix="$" {...campo("precioPropio")}
            hint="Lo ponemos a prueba: cuánto ganas y cuántas unidades necesitas vender" />
        </fieldset>
      </div>

      <div className="space-y-3" aria-live="polite">
        {!listo ? (
          <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            <Calculator className="mb-2 h-8 w-8" aria-hidden="true" />
            Escribe el precio de la maquila y la cantidad para ver tus números.
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Resultado etiqueta="Costo total por unidad" valor={pesos(Math.round(r.costoUnitario))} detalle="Fabricación + empaque + etiquetas + tu parte del envío y los costos del lote" />
              <Resultado etiqueta="Inversión del lote" valor={pesos(Math.round(r.inversion))} />
            </div>
            {r.precioSugerido === null ? (
              <p className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />La comisión más el margen llegan al 100 %: baja alguno de los dos.
              </p>
            ) : (
              <Resultado destacado etiqueta={`Precio sugerido al público (con IVA) para ganar ${num(c.margen)} %`}
                valor={pesos(Math.round(r.precioSugeridoConImpuesto ?? 0))}
                detalle={`${pesos(Math.round(r.precioSugerido))} antes de IVA · ganas ${pesos(Math.round(r.gananciaSugerida ?? 0))} por unidad`} />
            )}
            {r.precioAnalizado !== null && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Resultado etiqueta={usaPropio ? "Con tu precio ganas por unidad" : "Ganancia por unidad"}
                  valor={pesos(Math.round(r.gananciaUnidad ?? 0))}
                  detalle={r.margenReal !== null ? `Margen real: ${r.margenReal.toFixed(1).replace(".", ",")} %` : undefined} />
                <Resultado etiqueta="Punto de equilibrio"
                  valor={r.puntoEquilibrio !== null ? `${r.puntoEquilibrio.toLocaleString("es-CO")} und.` : "No se alcanza"}
                  detalle={r.puntoEquilibrio !== null ? `Vendiendo esas recuperas la inversión de ${num(c.cantidad).toLocaleString("es-CO")} und.` : "Con ese precio no recuperas lo invertido"} />
              </div>
            )}
            {r.gananciaLote !== null && (
              <p className={clsx("rounded-xl px-3 py-2 text-sm", r.gananciaLote >= 0 ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-destructive/10 text-destructive")}>
                Si vendes todo el lote {usaPropio ? "a tu precio" : "al precio sugerido"}, {r.gananciaLote >= 0 ? "ganas" : "pierdes"}{" "}
                <span className="font-semibold">{pesos(Math.abs(Math.round(r.gananciaLote)))}</span>.
              </p>
            )}
            <p className="text-xs text-muted-foreground">Es una estimación para planear. No incluye impuestos de renta ni costos de tu operación.</p>
          </>
        )}
      </div>
    </div>
  );
}
