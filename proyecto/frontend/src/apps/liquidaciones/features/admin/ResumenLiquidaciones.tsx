import type { ReactNode } from "react";
import { clsx } from "clsx";
import { useQuery } from "@tanstack/react-query";
import {
  ChartColumn, ChevronRight, CircleCheck, ClipboardCheck, Clock, Handshake, Loader2, Package, Percent, TimerOff, Users,
} from "lucide-react";

import { liquidacionesService } from "@/services/liquidaciones.service";
import { cop } from "@apps/liquidaciones/features/constantes";

type Destino = "liq-revision" | "liq-admin-lotes" | "liq-admin-operaciones" | "liq-admin-cuentas";

const CLAVE_METRICAS = ["liquidaciones", "admin", "metricas"] as const;
const ENTERO = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

/**
 * Sin reintentos: si el módulo está apagado (404) o el rol no ve métricas (403),
 * reintentar solo retrasa el mismo error.
 */
function useMetricas() {
  return useQuery({
    queryKey: CLAVE_METRICAS,
    queryFn: liquidacionesService.metricas,
    retry: false,
    refetchInterval: 120_000,
  });
}

function porcentaje(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? "—" : `${Math.round(valor * 100)} %`;
}

function horas(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  // Las revisiones rápidas se leen mejor en minutos que como «0 h».
  if (valor < 1) return valor < 1 / 60 ? "< 1 min" : `${Math.round(valor * 60)} min`;
  return `${valor.toLocaleString("es-CO", { maximumFractionDigits: 1 })} h`;
}

function TarjetaMetrica({ icono, titulo, valor, detalle, onClick, resaltar }: {
  icono: ReactNode; titulo: string; valor: ReactNode; detalle?: ReactNode; onClick?: () => void; resaltar?: boolean;
}) {
  const contenido = (
    <>
      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
        {icono} {titulo}
        {onClick && <ChevronRight className="ml-auto h-4 w-4 opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" />}
      </div>
      <p className={clsx("text-2xl font-semibold", resaltar ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>{valor}</p>
      {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
    </>
  );
  const clases = "rounded-xl border border-border bg-white p-4 text-left shadow-sm";
  if (!onClick) return <div className={clases}>{contenido}</div>;
  return (
    <button type="button" onClick={onClick} className={clsx(clases, "group transition hover:border-primary/40 dark:hover:border-accent/40")}>
      {contenido}
    </button>
  );
}

export function ResumenLiquidaciones({ onIr }: { onIr: (destino: Destino) => void }) {
  const { data: m, isLoading, error } = useMetricas();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div>
          <p className="flex items-center gap-2 text-base font-semibold">
            <ChartColumn className="h-4 w-4 text-primary dark:text-accent" />
            Resumen de Liquidaciones
          </p>
          <p className="text-sm text-muted-foreground">
            Cómo se mueven las oportunidades del módulo: lo publicado, lo que espera revisión y lo que se cerró en los últimos 30 días.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 px-1 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando métricas…</p>
      ) : error || !m ? (
        <div className="rounded-xl border border-border bg-white p-6 text-center text-sm text-muted-foreground shadow-sm">
          No pudimos cargar las métricas del módulo. {error instanceof Error ? error.message : ""}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <TarjetaMetrica
            icono={<Package className="h-4 w-4" />}
            titulo="Publicados"
            valor={ENTERO.format(m.publicados)}
            detalle={`Disponibles ahora · ${ENTERO.format(m.cerrados_sin_venta_30d ?? 0)} cerraron sin venta en 30 d`}
            onClick={() => onIr("liq-admin-lotes")}
          />
          <TarjetaMetrica
            icono={<ClipboardCheck className="h-4 w-4" />}
            titulo="En revisión"
            valor={ENTERO.format(m.en_revision)}
            detalle={m.en_revision ? "Esperan al equipo de Zarpi" : "Cola al día"}
            onClick={() => onIr("liq-revision")}
            resaltar={m.en_revision > 0}
          />
          <TarjetaMetrica
            icono={<Handshake className="h-4 w-4" />}
            titulo="Reservas activas"
            valor={ENTERO.format(m.reservas_activas)}
            detalle="Comprador y vendedor coordinando"
            onClick={() => onIr("liq-admin-operaciones")}
          />
          <TarjetaMetrica
            icono={<CircleCheck className="h-4 w-4" />}
            titulo="Vendidos 30 d"
            valor={ENTERO.format(m.vendidos_30d)}
            detalle={cop(m.valor_vendido_30d_cop)}
          />
          <TarjetaMetrica
            icono={<Percent className="h-4 w-4" />}
            titulo="Tasa de venta 30 d"
            valor={porcentaje(m.tasa_venta_30d)}
            detalle="Reservas cerradas que terminaron en venta"
          />
          <TarjetaMetrica
            icono={<Clock className="h-4 w-4" />}
            titulo="Tiempo promedio de revisión"
            valor={horas(m.horas_promedio_revision)}
            detalle="Desde el envío hasta la decisión, 30 d"
          />
          <TarjetaMetrica
            icono={<TimerOff className="h-4 w-4" />}
            titulo="Vencidas / Canceladas 30 d"
            valor={`${ENTERO.format(m.vencidas_30d)} / ${ENTERO.format(m.canceladas_30d)}`}
            detalle="Reservas que liberaron el lote"
          />
          <TarjetaMetrica
            icono={<Users className="h-4 w-4" />}
            titulo="Cuentas activadas"
            valor={ENTERO.format(m.cuentas_activadas)}
            detalle={`${ENTERO.format(m.cuentas_suspendidas)} suspendidas`}
            onClick={() => onIr("liq-admin-cuentas")}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Bloque compacto para el resumen general del panel admin. Calla ante cualquier
 * error (módulo apagado, rol sin acceso) para no ensuciar el tablero global.
 */
export function TarjetasMetricasLiquidaciones({ onAbrir }: { onAbrir?: () => void }) {
  const { data: m, error } = useMetricas();
  if (error || !m) return null;

  const tarjetas = [
    { titulo: "Publicados", valor: m.publicados },
    { titulo: "En revisión", valor: m.en_revision },
    { titulo: "Reservas activas", valor: m.reservas_activas },
    { titulo: "Vendidos 30 d", valor: m.vendidos_30d },
  ];

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-base font-semibold">
          <Package className="h-4 w-4 text-primary dark:text-accent" />
          Zarpi Liquidaciones
        </p>
        {onAbrir && (
          <button type="button" onClick={onAbrir} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline dark:text-accent">
            Ver resumen <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {tarjetas.map((t) => (
          <div key={t.titulo} className="rounded-lg border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">{t.titulo}</p>
            <p className="text-lg font-semibold text-foreground">{ENTERO.format(t.valor)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
