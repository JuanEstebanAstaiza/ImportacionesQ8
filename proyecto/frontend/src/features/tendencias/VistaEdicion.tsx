import { useMemo, useState } from "react";
import { CalendarClock, Factory } from "lucide-react";

import type {
  EdicionCompleta,
  ProductoTendencia,
  TemporadaConLimites,
} from "@/services/tendencias.service";
import { PortadaEdicion } from "@/features/tendencias/PortadaEdicion";
import { TarjetaProducto } from "@/features/tendencias/TarjetaProducto";
import { ESTADOS_PIDELO_YA, fechaLarga } from "@/features/tendencias/formato";
import { EstadoChip } from "@/features/tendencias/ui";

/**
 * Una edición vista por el comprador: portada, "Pide a tiempo" (solo en la
 * edición actual), filtros, el destacado en grande y el resto en tarjetas.
 * La usan la edición de la semana y las ediciones anteriores.
 */

type Filtro = "todos" | "pidelo_ya" | "para_negocio" | "guardados";

const FILTROS: { clave: Filtro; etiqueta: string }[] = [
  { clave: "todos", etiqueta: "Todos" },
  { clave: "pidelo_ya", etiqueta: "Pídelo ya" },
  { clave: "para_negocio", etiqueta: "Para tu negocio" },
  { clave: "guardados", etiqueta: "Guardados" },
];

type VistaEdicionProps = {
  edicion: EdicionCompleta;
  /** Próximas temporadas que todavía alcanzan; solo para la edición actual. */
  pideATiempo?: TemporadaConLimites[];
  estaGuardado: (producto: ProductoTendencia) => boolean;
  onAlternarGuardado: (producto: ProductoTendencia) => void;
  onAbrir: (producto: ProductoTendencia) => void;
  onPedirPropuestas: (producto: ProductoTendencia) => void;
};

function PideATiempo({ temporadas }: { temporadas: TemporadaConLimites[] }) {
  return (
    <section className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <CalendarClock className="h-4 w-4 text-primary dark:text-accent" />
        Pide a tiempo
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">Las próximas temporadas y hasta cuándo alcanzas a pedir (estimado).</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {temporadas.map((t) => {
          const texto = t.fechas.estado === "solo_aereo" ? t.fechas.texto_aereo : t.fechas.texto_mar;
          const cierre = t.fechas.limite_mar?.aviso_cierre_fabricas;
          return (
            <li key={`${t.id}-${t.fecha}`} className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-semibold leading-snug">{t.nombre}</p>
                <span className="shrink-0 text-xs text-muted-foreground">{fechaLarga(t.fecha)}</span>
              </div>
              <EstadoChip fechas={t.fechas} className="self-start" />
              {texto && <p className="text-xs leading-snug text-muted-foreground">{texto}</p>}
              {cierre && (
                <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
                  <Factory className="mt-px h-3 w-3 shrink-0" />
                  Adelantada por el cierre de fábricas del Año Nuevo chino.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function VistaEdicion({
  edicion,
  pideATiempo,
  estaGuardado,
  onAlternarGuardado,
  onAbrir,
  onPedirPropuestas,
}: VistaEdicionProps) {
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const productos = useMemo(
    () => [...(edicion.productos ?? [])].sort((a, b) => a.orden - b.orden),
    [edicion.productos],
  );

  const pasaFiltro = (p: ProductoTendencia, f: Filtro): boolean => {
    if (f === "pidelo_ya") return ESTADOS_PIDELO_YA.includes(p.fechas.estado);
    if (f === "para_negocio") return p.para_negocio;
    if (f === "guardados") return estaGuardado(p);
    return true;
  };

  const visibles = productos.filter((p) => pasaFiltro(p, filtro));
  const destacado = visibles.find((p) => p.destacado) ?? null;
  const resto = visibles.filter((p) => p !== destacado);

  return (
    <div className="space-y-6">
      <PortadaEdicion
        preset={edicion.preset_estilo}
        numero={edicion.numero}
        semanaInicio={edicion.semana_inicio}
        tituloLinea1={edicion.titulo_linea1}
        tituloLinea2={edicion.titulo_linea2}
        subtitulo={edicion.subtitulo}
      />

      {pideATiempo && pideATiempo.length > 0 && <PideATiempo temporadas={pideATiempo} />}

      <section className="rounded-2xl bg-[#0F0F0F] p-4 text-white sm:p-6">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {FILTROS.map(({ clave, etiqueta }) => {
            const cuantos = productos.filter((p) => pasaFiltro(p, clave)).length;
            const activo = filtro === clave;
            return (
              <button
                key={clave}
                type="button"
                onClick={() => setFiltro(clave)}
                aria-pressed={activo}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors ${
                  activo ? "bg-[#EDF953] text-[#16151B]" : "border border-white/20 text-white/80 hover:border-white/50 hover:text-white"
                }`}
              >
                {etiqueta}
                <span className={activo ? "opacity-70" : "text-white/50"}>{cuantos}</span>
              </button>
            );
          })}
        </div>

        {visibles.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/15 px-4 py-10 text-center text-sm text-white/60">
            {filtro === "guardados"
              ? "No has guardado productos de esta edición. Usa el marcador de cada tarjeta para guardarlos."
              : "Ningún producto de esta edición entra en este filtro."}
          </p>
        ) : (
          <div className="space-y-4">
            {destacado && (
              <TarjetaProducto
                destacado
                producto={destacado}
                guardado={estaGuardado(destacado)}
                onAbrir={() => onAbrir(destacado)}
                onAlternarGuardado={() => onAlternarGuardado(destacado)}
                onPedirPropuestas={() => onPedirPropuestas(destacado)}
              />
            )}
            {resto.length > 0 && (
              <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3">
                {resto.map((p) => (
                  <TarjetaProducto
                    key={p.id}
                    producto={p}
                    guardado={estaGuardado(p)}
                    onAbrir={() => onAbrir(p)}
                    onAlternarGuardado={() => onAlternarGuardado(p)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
