import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { tendenciasService, type MetricasConteo, type MetricasEdicion } from "@/services/tendencias.service";

import { CARD, Cargando, EstadoEdicionBadge, Vacio, formatoFecha, mensajeError } from "./CuradorComun";

const COLUMNAS: { clave: keyof MetricasConteo; titulo: string }[] = [
  { clave: "vistas", titulo: "Vistas" },
  { clave: "guardados", titulo: "Guardados" },
  { clave: "clics_pedir_propuestas", titulo: "Clics pedir propuestas" },
  { clave: "solicitudes", titulo: "Solicitudes" },
  { clave: "operaciones", titulo: "Operaciones" },
];

function Celdas({ fila }: { fila: MetricasConteo }) {
  return (
    <>
      {COLUMNAS.map(({ clave }) => (
        <td
          key={clave}
          className={`px-3 py-2.5 text-right tabular-nums ${
            clave === "solicitudes" ? "bg-primary/5 text-base font-bold text-primary dark:bg-accent/10 dark:text-accent" : ""
          }`}
        >
          {fila[clave]}
        </td>
      ))}
    </>
  );
}

export function CuradorMetricas() {
  const [filas, setFilas] = useState<MetricasEdicion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());

  useEffect(() => {
    let vigente = true;
    tendenciasService.getMetricas()
      .then((m) => { if (vigente) setFilas(m); })
      .catch((err) => toast.error(mensajeError(err, "No se pudieron cargar las métricas.")))
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, []);

  function alternar(id: string) {
    setAbiertas((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id); else nuevo.add(id);
      return nuevo;
    });
  }

  const total = filas.reduce((s, f) => s + f.solicitudes, 0);
  const operaciones = filas.reduce((s, f) => s + f.operaciones, 0);

  return (
    <section className={CARD}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Métricas por edición</h2>
          <p className="text-sm text-muted-foreground">Ediciones publicadas y archivadas. La que importa: solicitudes que salieron de cada edición.</p>
        </div>
        {filas.length > 0 && (
          <div className="flex gap-4 text-right">
            <div>
              <p className="text-2xl font-bold text-primary dark:text-accent">{total}</p>
              <p className="text-xs text-muted-foreground">solicitudes</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{operaciones}</p>
              <p className="text-xs text-muted-foreground">operaciones</p>
            </div>
          </div>
        )}
      </div>
      {cargando ? <Cargando /> : filas.length === 0 ? (
        <Vacio>Aún no hay ediciones publicadas con métricas.</Vacio>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Edición</th>
                {COLUMNAS.map((c) => (
                  <th key={c.clave} className={`px-3 py-2 text-right ${c.clave === "solicitudes" ? "text-primary dark:text-accent" : ""}`}>{c.titulo}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filas.map((e) => {
                const abierta = abiertas.has(e.id);
                return (
                  <Fragment key={e.id}>
                    <tr onClick={() => alternar(e.id)} className="cursor-pointer hover:bg-muted/40">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          {abierta ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-medium">N.º {e.numero} <EstadoEdicionBadge estado={e.estado} /></p>
                            <p className="truncate text-xs text-muted-foreground">{e.titulo_linea1} {e.titulo_linea2} · {formatoFecha(e.semana_inicio)}</p>
                          </div>
                        </div>
                      </td>
                      <Celdas fila={e} />
                    </tr>
                    {abierta && (e.productos.length === 0 ? (
                      <tr><td colSpan={COLUMNAS.length + 1} className="bg-muted/20 px-10 py-2 text-xs text-muted-foreground">Sin productos.</td></tr>
                    ) : e.productos.map((p) => (
                      <tr key={`${e.id}-${p.id}`} className="bg-muted/20 text-xs">
                        <td className="py-2 pl-10 pr-3">{p.nombre}</td>
                        <Celdas fila={p} />
                      </tr>
                    )))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
