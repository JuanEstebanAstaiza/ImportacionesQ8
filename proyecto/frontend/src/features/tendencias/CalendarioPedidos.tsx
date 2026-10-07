import { useCallback, useEffect, useRef, useState } from "react";

import { tendenciasService, type Calendario } from "@/services/tendencias.service";
import { fechaLarga, fechaLocal, mensajeError, sumarDias } from "@/features/tendencias/formato";
import { Cargando, ErrorCarga, EstadoChip, PieInformativo } from "@/features/tendencias/ui";

/**
 * Calendario de pedidos (especificación, sección 07): temporadas de los
 * próximos 14 meses con la ventana por mar, el tramo solo aéreo, la fecha de
 * la temporada, la línea de hoy y las franjas de cierre de fábricas. Se pinta
 * con posiciones en porcentaje; en móvil se desplaza en horizontal dentro del
 * bloque.
 */

const MESES = 14;
/** La ventana por mar se abre 21 días antes de la fecha límite ("Pídelo desde..."). */
const DIAS_VENTANA = 21;

type Rango = { inicio: number; fin: number };

function posicion(fecha: Date, rango: Rango): number {
  const pct = ((fecha.getTime() - rango.inicio) / (rango.fin - rango.inicio)) * 100;
  return Math.min(100, Math.max(0, pct));
}

function Barra({ desde, hasta, rango, className, titulo }: {
  desde: Date; hasta: Date; rango: Rango; className: string; titulo: string;
}) {
  const izquierda = posicion(desde, rango);
  const derecha = posicion(hasta, rango);
  if (derecha <= izquierda) return null;
  return (
    <span
      title={titulo}
      className={`absolute top-1/2 h-3 -translate-y-1/2 ${className}`}
      style={{ left: `${izquierda}%`, width: `${derecha - izquierda}%` }}
    />
  );
}

export function CalendarioPedidos() {
  const [datos, setDatos] = useState<Calendario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const registrado = useRef(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const respuesta = await tendenciasService.getCalendario();
      setDatos(respuesta);
      if (!registrado.current) {
        registrado.current = true;
        tendenciasService.registrarEvento("calendario_visto");
      }
    } catch (e) {
      setError(mensajeError(e, "No pudimos cargar el calendario de pedidos."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando && !datos) return <Cargando texto="Cargando el calendario..." />;
  if (error && !datos) return <ErrorCarga mensaje={error} onReintentar={cargar} />;
  if (!datos) return null;

  const hoy = fechaLocal(datos.hoy) ?? new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const fin = new Date(inicio.getFullYear(), inicio.getMonth() + MESES, 1);
  const rango: Rango = { inicio: inicio.getTime(), fin: fin.getTime() };
  const meses = Array.from({ length: MESES }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth() + i, 1));
  const temporadas = datos.temporadas.filter((t) => {
    const fecha = fechaLocal(t.fecha);
    return fecha && fecha.getTime() >= hoy.getTime() && fecha.getTime() < rango.fin;
  });
  const cierres = datos.cierres
    .map((c) => ({ inicio: fechaLocal(c.inicio), fin: fechaLocal(c.fin) }))
    .filter((c) => c.inicio && c.fin);
  const posHoy = posicion(hoy, rango);

  // Fondo común de cada fila: líneas de mes, cierres de fábricas y la línea de hoy.
  const fondoPista = (
    <>
      {meses.map((mes, i) => i > 0 && (
        <span key={mes.getTime()} aria-hidden className="absolute bottom-0 top-0 w-px bg-border/70" style={{ left: `${posicion(mes, rango)}%` }} />
      ))}
      {cierres.map((c, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute bottom-0 top-0 bg-zinc-400/25 dark:bg-white/10"
          style={{ left: `${posicion(c.inicio, rango)}%`, width: `${posicion(sumarDias(c.fin, 1), rango) - posicion(c.inicio, rango)}%` }}
        />
      ))}
      <span aria-hidden className="absolute bottom-0 top-0 z-[1] w-0.5 bg-rose-500" style={{ left: `${posHoy}%` }} />
    </>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Calendario de pedidos</h2>
            <p className="text-sm text-muted-foreground">
              Temporadas de los próximos {MESES} meses y hasta cuándo alcanzas a pedir. Estimado con {datos.parametros.dias_mar} días
              por mar y {datos.parametros.dias_aereo} por aéreo, puerta a puerta.
            </p>
          </div>
        </div>

        <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5"><span className="h-2.5 w-6 rounded-full bg-[#4F06EB]" />Ventana para pedir por mar</li>
          <li className="flex items-center gap-1.5"><span className="h-2.5 w-6 rounded-full border border-[#C9D21E] bg-[#EDF953]" />Solo aéreo</li>
          <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-white bg-[#16151B] ring-1 ring-[#16151B] dark:border-[#16151B] dark:bg-white dark:ring-white" />Temporada</li>
          <li className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-rose-500" />Hoy</li>
          <li className="flex items-center gap-1.5"><span className="h-3 w-5 bg-zinc-400/40 dark:bg-white/15" />Cierre de fábricas (Año Nuevo chino)</li>
        </ul>

        {temporadas.length === 0 ? (
          <p className="rounded-lg bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay temporadas cargadas para los próximos meses.
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <div className="min-w-[960px] px-4 sm:px-0">
              <div className="flex">
                <div className="sticky left-0 z-20 w-44 shrink-0 bg-white" />
                <div className="relative h-8 flex-1">
                  {meses.map((mes, i) => {
                    const siguiente = new Date(mes.getFullYear(), mes.getMonth() + 1, 1);
                    const izquierda = posicion(mes, rango);
                    return (
                      <span
                        key={mes.getTime()}
                        className="absolute top-0 truncate px-1.5 text-[11px] font-semibold capitalize text-muted-foreground"
                        style={{ left: `${izquierda}%`, width: `${posicion(siguiente, rango) - izquierda}%` }}
                      >
                        {mes.toLocaleDateString("es-CO", { month: "short" }).replace(".", "")}
                        {(i === 0 || mes.getMonth() === 0) && <span className="font-normal"> {mes.getFullYear()}</span>}
                      </span>
                    );
                  })}
                  <span
                    className="absolute bottom-0 z-[2] -translate-x-1/2 rounded bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white"
                    style={{ left: `${posHoy}%` }}
                  >
                    Hoy
                  </span>
                </div>
              </div>

              {temporadas.map((t) => {
                const fechaTemporada = fechaLocal(t.fecha);
                const limiteMar = fechaLocal(t.fechas.limite_mar?.fecha);
                const limiteAereo = fechaLocal(t.fechas.limite_aereo?.fecha);
                const cierre = t.fechas.limite_mar?.aviso_cierre_fabricas || t.fechas.limite_aereo?.aviso_cierre_fabricas;
                const tarde = t.fechas.estado === "fuera_de_tiempo";
                return (
                  <div key={`${t.id}-${t.fecha}`} className={`flex border-t border-border ${tarde ? "opacity-50" : ""}`}>
                    <div className="sticky left-0 z-20 w-44 shrink-0 bg-white py-2 pr-3">
                      <p className="truncate text-sm font-semibold" title={t.ejemplos || t.nombre}>{t.nombre}</p>
                      <p className="text-[11px] text-muted-foreground">{fechaLarga(t.fecha, true)}</p>
                      <EstadoChip fechas={t.fechas} className="mt-1 max-w-full truncate" />
                    </div>
                    <div className="relative min-h-[72px] flex-1">
                      {fondoPista}
                      {limiteMar && (
                        <Barra
                          desde={sumarDias(limiteMar, -DIAS_VENTANA)}
                          hasta={limiteMar}
                          rango={rango}
                          className="z-[3] rounded-l-full bg-[#4F06EB]"
                          titulo={`Por mar: pide entre el ${fechaLarga(sumarDias(limiteMar, -DIAS_VENTANA))} y el ${fechaLarga(t.fechas.limite_mar.fecha)} (estimado)${cierre ? " · adelantada por el cierre de fábricas" : ""}`}
                        />
                      )}
                      {limiteMar && limiteAereo && (
                        <Barra
                          desde={limiteMar}
                          hasta={limiteAereo}
                          rango={rango}
                          className="z-[3] rounded-r-full border border-[#C9D21E] bg-[#EDF953]"
                          titulo={`Solo aéreo hasta el ${fechaLarga(t.fechas.limite_aereo.fecha)} (estimado)`}
                        />
                      )}
                      {fechaTemporada && (
                        <span
                          title={`${t.nombre}: ${fechaLarga(t.fecha, true)}`}
                          className="absolute top-1/2 z-[4] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#16151B] dark:border-[#16151B] dark:bg-white"
                          style={{ left: `${posicion(fechaTemporada, rango)}%` }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground sm:hidden">Desliza el calendario hacia los lados para ver todos los meses.</p>
      </div>
      <PieInformativo />
    </div>
  );
}
