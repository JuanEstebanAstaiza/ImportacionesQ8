import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Check, Loader2, Lock, Plus, Save, X } from "lucide-react";
import { clsx } from "clsx";

import { businessService } from "@/services/business.service";

import {
  CONDICIONES_POR_DEFECTO,
  FORMAS_PAGO,
  IGUAL_PARA_TODAS,
  type CondicionesPropuesta,
  type FormaPago,
  type IvaPct,
  type ModoEntrega,
  type RangoDias,
} from "./calculo";

/**
 * «Mi empresa › Condiciones de tus propuestas». Se llenan una vez; cada
 * propuesta las trae listas y en cada una se pueden ajustar la bodega, la
 * entrega, el tiempo y el IVA. Solo la cuenta dueña las cambia.
 */

const CLASE_INPUT =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:focus:border-accent dark:focus:ring-accent/20";

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold">{titulo}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Campo({ texto, ayuda, children }: { texto: string; ayuda?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{texto}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-muted-foreground">{ayuda}</span>}
    </label>
  );
}

function Opciones<T extends string | number>({ valor, opciones, onChange, etiqueta }: {
  valor: T; opciones: { v: T; t: string }[]; onChange: (v: T) => void; etiqueta: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row" role="radiogroup" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={valor === o.v} onClick={() => onChange(o.v)}
          className={clsx("flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
            valor === o.v
              ? "border-primary bg-primary/5 font-medium text-primary ring-1 ring-primary/30 dark:border-accent dark:bg-accent/10 dark:text-accent"
              : "border-border hover:bg-muted/50")}>
          {o.t}
        </button>
      ))}
    </div>
  );
}

function Rango({ etiqueta, valor, onChange }: { etiqueta: string; valor: RangoDias; onChange: (r: RangoDias) => void }) {
  const num = (s: string) => Math.max(0, Math.min(730, Number(s.replace(/\D/g, "")) || 0));
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-20 font-medium">{etiqueta}</span>
      de <input className={`${CLASE_INPUT} w-20`} inputMode="numeric" value={valor.minimo || ""} onChange={(e) => onChange({ ...valor, minimo: num(e.target.value) })} aria-label={`${etiqueta}: mínimo`} />
      a <input className={`${CLASE_INPUT} w-20`} inputMode="numeric" value={valor.maximo || ""} onChange={(e) => onChange({ ...valor, maximo: num(e.target.value) })} aria-label={`${etiqueta}: máximo`} />
      <span className="text-muted-foreground">días</span>
    </div>
  );
}

export function CondicionesEmpresa({ puedeEditar }: { puedeEditar: boolean }) {
  const [c, setC] = useState<CondicionesPropuesta | null>(null);
  const [guardadas, setGuardadas] = useState<CondicionesPropuesta | null>(null);
  const [nuevaCiudad, setNuevaCiudad] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    businessService.getProposalConditions()
      .then(({ configuradas: _c, ...datos }) => { setC(datos); setGuardadas(datos); })
      .catch(() => { setC(CONDICIONES_POR_DEFECTO); setGuardadas(CONDICIONES_POR_DEFECTO); });
  }, []);

  if (!c) {
    return <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const set = (cambios: Partial<CondicionesPropuesta>) => setC((x) => (x ? { ...x, ...cambios } : x));
  const cambiado = JSON.stringify(c) !== JSON.stringify(guardadas);
  const rangoMal = [c.tiempo_maritimo, c.tiempo_aereo].some((r) => r.minimo < 1 || r.maximo < r.minimo);

  const agregarCiudad = () => {
    const ciudad = nuevaCiudad.trim();
    if (ciudad && !c.ciudades_entrega_incluida.some((x) => x.toLowerCase() === ciudad.toLowerCase())) {
      set({ ciudades_entrega_incluida: [...c.ciudades_entrega_incluida, ciudad] });
    }
    setNuevaCiudad("");
  };

  const guardar = async () => {
    if (rangoMal) { toast.error("Revisa los tiempos de entrega: el máximo tiene que ser igual o mayor que el mínimo."); return; }
    setGuardando(true);
    try {
      const { configuradas: _c, ...datos } = await businessService.saveProposalConditions(c);
      setC(datos);
      setGuardadas(datos);
      toast.success("Condiciones guardadas. Tus próximas propuestas las traen listas.");
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "No se pudieron guardar las condiciones.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Condiciones de tus propuestas</h2>
        <p className="text-sm text-muted-foreground">Las llenas una vez. Cada propuesta las trae listas y en cada una puedes ajustarlas.</p>
      </div>

      <fieldset disabled={!puedeEditar} className="space-y-4">
        <Bloque titulo="Entrega">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo texto="Ciudad de tu bodega"><input className={CLASE_INPUT} value={c.bodega_ciudad} onChange={(e) => set({ bodega_ciudad: e.target.value })} placeholder="Cali" maxLength={100} /></Campo>
            <Campo texto="Dirección"><input className={CLASE_INPUT} value={c.bodega_direccion} onChange={(e) => set({ bodega_direccion: e.target.value })} maxLength={200} /></Campo>
          </div>
          <Campo texto="Entrega incluida en">
            <div className="flex flex-wrap gap-2">
              {c.ciudades_entrega_incluida.map((ciudad) => (
                <span key={ciudad} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
                  {ciudad}
                  <button type="button" aria-label={`Quitar ${ciudad}`} onClick={() => set({ ciudades_entrega_incluida: c.ciudades_entrega_incluida.filter((x) => x !== ciudad) })}>
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                </span>
              ))}
              <span className="inline-flex items-center gap-1">
                <input className="h-8 w-36 rounded-full border border-border bg-background px-3 text-sm" value={nuevaCiudad}
                  onChange={(e) => setNuevaCiudad(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarCiudad(); } }}
                  placeholder="Agregar ciudad" maxLength={100} aria-label="Agregar ciudad" />
                <button type="button" onClick={agregarCiudad} className="rounded-full p-1 text-primary hover:bg-muted dark:text-accent" aria-label="Agregar"><Plus className="h-4 w-4" /></button>
              </span>
            </div>
          </Campo>
          <Campo texto="Para otras ciudades, por defecto">
            <Opciones<ModoEntrega> etiqueta="Entrega para otras ciudades" valor={c.entrega_otras_ciudades} onChange={(v) => set({ entrega_otras_ciudades: v })}
              opciones={[{ v: "cliente", t: "A cargo del cliente, por transportadora" }, { v: "fijo", t: "Valor fijo que pongo en cada propuesta" }, { v: "incluida", t: "Incluida en todo el país" }]} />
          </Campo>
        </Bloque>

        <Bloque titulo="Tiempos, vigencia e IVA">
          <Campo texto="Tiempo de entrega por vía, desde el anticipo">
            <div className="space-y-2">
              <Rango etiqueta="Marítimo" valor={c.tiempo_maritimo} onChange={(r) => set({ tiempo_maritimo: r })} />
              <Rango etiqueta="Aéreo" valor={c.tiempo_aereo} onChange={(r) => set({ tiempo_aereo: r })} />
            </div>
          </Campo>
          {rangoMal && <p className="text-xs text-destructive">El máximo tiene que ser igual o mayor que el mínimo.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo texto="Vigencia de tus propuestas">
              <div className="flex items-center gap-2 text-sm">
                <input className={`${CLASE_INPUT} w-20`} inputMode="numeric" value={c.vigencia_dias || ""}
                  onChange={(e) => set({ vigencia_dias: Math.max(1, Math.min(90, Number(e.target.value.replace(/\D/g, "")) || 1)) })} />
                días
              </div>
            </Campo>
            <Campo texto="IVA de tu venta, por defecto">
              <Opciones<IvaPct> etiqueta="IVA por defecto" valor={c.iva_pct} onChange={(v) => set({ iva_pct: v })}
                opciones={[{ v: 19, t: "19 %" }, { v: 5, t: "5 %" }, { v: 0, t: "0 %" }]} />
            </Campo>
          </div>
        </Bloque>

        <Bloque titulo="Pago y recepción">
          <Campo texto="Forma de pago">
            <Opciones<FormaPago> etiqueta="Forma de pago" valor={c.forma_pago} onChange={(v) => set({ forma_pago: v })}
              opciones={(Object.keys(FORMAS_PAGO) as FormaPago[]).map((v) => ({ v, t: FORMAS_PAGO[v] }))} />
          </Campo>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={c.seguro_incluido} onChange={(e) => set({ seguro_incluido: e.target.checked })} />
            Incluir seguro de transporte en todas mis propuestas
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo texto="Tolerancia de cantidad">
              <div className="flex items-center gap-2 text-sm">±
                <input className={`${CLASE_INPUT} w-20`} inputMode="decimal" value={String(c.tolerancia_pct)}
                  onChange={(e) => set({ tolerancia_pct: Math.max(0, Math.min(20, Number(e.target.value.replace(",", ".").replace(/[^0-9.]/g, "")) || 0)) })} />
                %
              </div>
            </Campo>
            <Campo texto="Plazo para reportar faltantes o daños" ayuda="Días hábiles, mínimo 3.">
              <input className={`${CLASE_INPUT} w-24`} inputMode="numeric" value={c.dias_reclamo || ""}
                onChange={(e) => set({ dias_reclamo: Math.min(60, Number(e.target.value.replace(/\D/g, "")) || 0) })}
                onBlur={() => set({ dias_reclamo: Math.max(3, c.dias_reclamo) })} />
            </Campo>
          </div>
        </Bloque>

        <Bloque titulo="Cancelación y supuestos">
          <Campo texto="Antes de la orden al proveedor"><input className={CLASE_INPUT} maxLength={300} value={c.cancelacion.antes_orden} onChange={(e) => set({ cancelacion: { ...c.cancelacion, antes_orden: e.target.value } })} /></Campo>
          <Campo texto="Producto en fabricación"><input className={CLASE_INPUT} maxLength={300} value={c.cancelacion.en_fabricacion} onChange={(e) => set({ cancelacion: { ...c.cancelacion, en_fabricacion: e.target.value } })} /></Campo>
          <Campo texto="Mercancía despachada"><input className={CLASE_INPUT} maxLength={300} value={c.cancelacion.despachada} onChange={(e) => set({ cancelacion: { ...c.cancelacion, despachada: e.target.value } })} /></Campo>
          <Campo texto="Supuestos que pueden mover el precio" ayuda="Solo estos permiten variar el precio, hasta 10 % y con aprobación del cliente.">
            <textarea className={`${CLASE_INPUT} h-auto min-h-[72px] py-2`} maxLength={500} value={c.supuestos} onChange={(e) => set({ supuestos: e.target.value })} />
          </Campo>
        </Bloque>
      </fieldset>

      <section className="rounded-xl border border-dashed border-border bg-muted/30 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4 text-muted-foreground" /> Igual para todas las importadoras</h3>
        <p className="mb-3 text-xs text-muted-foreground">No se configura: es lo que le permite al cliente comparar y confiar.</p>
        <ul className="space-y-1.5 text-sm">
          {IGUAL_PARA_TODAS.map((linea) => (
            <li key={linea} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary dark:text-accent" />{linea}</li>
          ))}
        </ul>
      </section>

      {puedeEditar && (
        <div className="flex justify-end gap-2">
          <button type="button" disabled={!cambiado || guardando} onClick={() => guardadas && setC(guardadas)}
            className="h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50">Cancelar</button>
          <button type="button" disabled={!cambiado || guardando} onClick={() => void guardar()}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 dark:bg-accent dark:text-accent-foreground">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar condiciones
          </button>
        </div>
      )}
    </div>
  );
}
