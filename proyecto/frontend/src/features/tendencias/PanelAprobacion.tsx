import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, ImageOff, XCircle } from "lucide-react";

import {
  tendenciasService,
  type ContadoresAprobacion,
  type MotivoRechazo,
} from "@/services/tendencias.service";

import { ColaAprobacion } from "./AprobacionCola";
import { EquipoDiseno } from "./AprobacionDisenadores";
import { EquipoAprobacion } from "./AprobacionEquipo";
import { PublicadosAprobacion } from "./AprobacionPublicados";

/**
 * Panel del equipo aprobador de Tendencias: revisa los enlaces que llegan,
 * les pone portada y los publica. Ver docs/Tendencias · Guía de construcción.html (5 B).
 */

type Pestana = "revisar" | "en_diseno" | "publicados" | "equipo";

function Contador({ etiqueta, valor, icono, clase }: { etiqueta: string; valor: number | null; icono: typeof Clock; clase: string }) {
  const Icono = icono;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-white p-3 shadow-sm">
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${clase}`}>
        <Icono className="h-4 w-4" />
      </span>
      <div>
        <p className="text-xl font-semibold leading-none tabular-nums">{valor ?? "—"}</p>
        <p className="mt-1 text-xs text-muted-foreground">{etiqueta}</p>
      </div>
    </div>
  );
}

export function PanelAprobacion({ esAdmin }: { esAdmin: boolean }) {
  const [pestana, setPestana] = useState<Pestana>("revisar");
  const [contadores, setContadores] = useState<ContadoresAprobacion | null>(null);
  const [motivos, setMotivos] = useState<{ valor: MotivoRechazo; texto: string }[]>([]);

  const cargarContadores = useCallback(() => {
    tendenciasService.contadores().then(setContadores).catch(() => undefined);
  }, []);

  useEffect(() => {
    cargarContadores();
    tendenciasService.motivos().then(setMotivos).catch(() => setMotivos([]));
  }, [cargarContadores]);

  const pestanas: { clave: Pestana; etiqueta: string; cuenta?: number }[] = [
    { clave: "revisar", etiqueta: "Por revisar", cuenta: contadores?.pendientes },
    { clave: "en_diseno", etiqueta: "En diseño", cuenta: contadores?.en_diseno },
    { clave: "publicados", etiqueta: "Publicados" },
    ...(esAdmin ? [{ clave: "equipo" as const, etiqueta: "Equipo" }] : []),
  ];

  const enCola = pestana === "revisar" || pestana === "en_diseno";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Aprobación de Tendencias</h1>
        <p className="text-sm text-muted-foreground">
          Revisa los enlaces que llegan, ponles portada y publícalos. Nada sale al feed sin aprobación y sin portada propia.
        </p>
      </div>

      <div role="tablist" aria-label="Secciones del panel" className="flex flex-wrap gap-2 border-b border-border pb-2">
        {pestanas.map((p) => (
          <button
            key={p.clave}
            type="button"
            role="tab"
            aria-selected={pestana === p.clave}
            onClick={() => setPestana(p.clave)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
              pestana === p.clave
                ? "bg-primary text-white dark:bg-accent dark:text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {p.etiqueta}
            {p.cuenta !== undefined && p.cuenta > 0 && (
              <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${pestana === p.clave ? "bg-white/20" : "bg-muted"}`}>{p.cuenta}</span>
            )}
          </button>
        ))}
      </div>

      {enCola && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Contador etiqueta="Pendientes" valor={contadores?.pendientes ?? null} icono={Clock} clase="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" />
          <Contador etiqueta="En diseño" valor={contadores?.en_diseno ?? null} icono={ImageOff} clase="bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" />
          <Contador etiqueta="Aprobados hoy" valor={contadores?.aprobados_hoy ?? null} icono={CheckCircle2} clase="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" />
          <Contador etiqueta="Rechazados hoy" valor={contadores?.rechazados_hoy ?? null} icono={XCircle} clase="bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" />
        </div>
      )}

      {pestana === "revisar" && <ColaAprobacion key="pendiente" modo="pendiente" esAdmin={esAdmin} motivos={motivos} onRevisado={cargarContadores} />}
      {pestana === "en_diseno" && <ColaAprobacion key="en_diseno" modo="en_diseno" esAdmin={esAdmin} motivos={motivos} onRevisado={cargarContadores} />}
      {pestana === "publicados" && <PublicadosAprobacion />}
      {pestana === "equipo" && esAdmin && (
        <div className="space-y-4">
          <EquipoAprobacion />
          <EquipoDiseno />
        </div>
      )}
    </div>
  );
}
