import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Banknote,
  Clock,
  FileText,
  Hourglass,
  Loader2,
  Percent,
  Send,
  ShoppingCart,
  Target,
  Users,
} from "lucide-react";

import {
  businessService,
  type BackendPanelEmpresa,
  type BackendPendienteResponder,
  type EtapaPedido,
  type MotivoPerdida,
} from "@/services/business.service";

/**
 * Panel comercial de la empresa importadora.
 *
 * Los números salen de la bitácora de eventos del backend (`GET
 * /importadores/panel`) y los montos van siempre en pesos con la moneda a la
 * vista: "$250k" no dice si son pesos o dólares.
 */

const PERIODOS = [
  { dias: 30, etiqueta: "30 días" },
  { dias: 90, etiqueta: "90 días" },
  { dias: 365, etiqueta: "12 meses" },
  { dias: 0, etiqueta: "Todo" },
];

const ETAPAS: { clave: EtapaPedido; etiqueta: string }[] = [
  { clave: "compra", etiqueta: "Compra" },
  { clave: "embarque", etiqueta: "Embarque" },
  { clave: "transito", etiqueta: "Tránsito" },
  { clave: "nacionalizacion", etiqueta: "Nacionalización" },
  { clave: "entrega", etiqueta: "Entrega" },
];

const MOTIVOS: { clave: MotivoPerdida; etiqueta: string }[] = [
  { clave: "precio", etiqueta: "Precio" },
  { clave: "tiempo", etiqueta: "Tiempo de entrega" },
  { clave: "condiciones", etiqueta: "Condiciones" },
  { clave: "otro", etiqueta: "Otro" },
  { clave: "sin_motivo", etiqueta: "Sin motivo indicado" },
];

const NIVEL_ESPERA: Record<BackendPendienteResponder["nivel"], { etiqueta: string; punto: string; chip: string }> = {
  a_tiempo: { etiqueta: "Menos de 24 h", punto: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  atencion: { etiqueta: "24 a 48 h", punto: "bg-amber-500", chip: "bg-amber-50 text-amber-800 border-amber-200" },
  urgente: { etiqueta: "Más de 48 h", punto: "bg-rose-500", chip: "bg-rose-50 text-rose-700 border-rose-200" },
};

/** "$4.250.000 COP" — sin abreviar, con la moneda. */
export function pesos(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return `$${Math.round(valor).toLocaleString("es-CO")} COP`;
}

function espera(horas: number): string {
  if (horas < 1) return "menos de 1 h";
  if (horas < 48) return `${Math.round(horas)} h`;
  return `${Math.round(horas / 24)} días`;
}

function cantidad(valor: number, unidad: string): string {
  return `${valor.toLocaleString("es-CO", { maximumFractionDigits: 2 })} ${unidad === "m3" ? "m³" : "u"}`;
}

function Metrica({ icono, etiqueta, valor, detalle, color }: { icono: ReactNode; etiqueta: string; valor: string; detalle?: string; color: string }) {
  return (
    <div className="metric-card flex items-start gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className={`metric-icon flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg dark:!bg-accent/24 ${color}`}>{icono}</div>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-tight text-foreground break-words">{valor}</p>
        <p className="mt-0.5 text-xs leading-tight text-muted-foreground">{etiqueta}</p>
        {detalle ? <p className="mt-1 text-xs font-medium text-foreground/80">{detalle}</p> : null}
      </div>
    </div>
  );
}

export function PanelEmpresa({
  asesoresConectados,
  chatsActivos,
  onAbrirSolicitudes,
  onAbrirPedidos,
}: {
  asesoresConectados: number;
  chatsActivos: number;
  onAbrirSolicitudes: () => void;
  onAbrirPedidos: () => void;
}) {
  const [dias, setDias] = useState(90);
  const [panel, setPanel] = useState<BackendPanelEmpresa | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      setPanel(await businessService.getCompanyPanel(dias));
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "No se pudo cargar el panel.");
    } finally {
      setCargando(false);
    }
  }, [dias]);

  useEffect(() => { void cargar(); }, [cargar]);

  if (!panel) {
    return (
      <div className="rounded-xl border border-border bg-white p-6 text-sm text-muted-foreground">
        {error ? <p role="alert" className="text-rose-700">{error}</p> : <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Cargando el panel...</p>}
      </div>
    );
  }

  const enProceso = ETAPAS.reduce((total, e) => total + (panel.pedidos_por_etapa[e.clave] ?? 0), 0);
  const perdidas = MOTIVOS.reduce((total, m) => total + (panel.motivos_perdida[m.clave] ?? 0), 0);
  const maxEtapa = Math.max(1, ...ETAPAS.map((e) => panel.pedidos_por_etapa[e.clave] ?? 0));
  const urgentes = panel.pendientes_responder.filter((p) => p.nivel === "urgente").length;

  const cierre = panel.cierre_uno_de_cada
    ? panel.cierre_uno_de_cada <= 1
      ? "Cierras todas tus propuestas"
      : `Cierras 1 de cada ${panel.cierre_uno_de_cada.toLocaleString("es-CO", { maximumFractionDigits: 1 })} propuestas`
    : panel.propuestas_enviadas
      ? "Aún no cierras ninguna propuesta del periodo"
      : "Sin propuestas en el periodo";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Montos en pesos colombianos (COP). Conversión con la TRM de cada momento; hoy {pesos(panel.trm)} por dólar.
        </p>
        <div className="flex flex-wrap rounded-lg border border-border bg-white p-0.5" role="tablist" aria-label="Periodo">
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              type="button"
              role="tab"
              aria-selected={dias === p.dias}
              onClick={() => setDias(p.dias)}
              className={`rounded-md px-3 py-1 text-xs font-medium ${dias === p.dias ? "bg-primary text-white" : "text-muted-foreground"}`}
            >
              {p.etiqueta}
            </button>
          ))}
          {cargando ? <Loader2 className="mx-1 h-4 w-4 self-center animate-spin text-muted-foreground" /> : null}
        </div>
      </div>
      {error ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica icono={<FileText className="h-5 w-5" />} color="bg-blue-50 text-blue-600" etiqueta="Solicitudes recibidas" valor={String(panel.solicitudes_recibidas)}
          detalle={panel.tasa_respuesta_pct !== null ? `Respondes el ${Math.round(panel.tasa_respuesta_pct)} %` : undefined} />
        <Metrica icono={<Send className="h-5 w-5" />} color="bg-emerald-50 text-emerald-600" etiqueta="Propuestas enviadas" valor={String(panel.propuestas_enviadas)}
          detalle={`${panel.propuestas_aceptadas} aceptadas · ${panel.propuestas_descartadas} no elegidas`} />
        <Metrica icono={<Percent className="h-5 w-5" />} color="bg-purple-50 text-purple-600" etiqueta="Propuesta a pedido"
          valor={panel.conversion_pct !== null ? `${panel.conversion_pct.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %` : "—"} detalle={cierre} />
        <Metrica icono={<Target className="h-5 w-5" />} color="bg-cyan-50 text-cyan-600" etiqueta="Tasa de respuesta"
          valor={panel.tasa_respuesta_pct !== null ? `${Math.round(panel.tasa_respuesta_pct)} %` : "—"} detalle="Propuestas enviadas ÷ solicitudes recibidas" />
        <Metrica icono={<Banknote className="h-5 w-5" />} color="bg-amber-50 text-amber-600" etiqueta="Valor promedio de los negocios cerrados"
          valor={pesos(panel.valor_promedio_cerrado_cop)} detalle={panel.valor_cerrado_cop ? `Total cerrado ${pesos(panel.valor_cerrado_cop)}` : undefined} />
        <Metrica icono={<Hourglass className="h-5 w-5" />} color="bg-orange-50 text-orange-600" etiqueta="Propuestas esperando respuesta del comprador"
          valor={pesos(panel.valor_esperando_cop)} detalle={`${panel.propuestas_esperando} ${panel.propuestas_esperando === 1 ? "propuesta" : "propuestas"}`} />
        <Metrica icono={<Clock className="h-5 w-5" />} color="bg-sky-50 text-sky-600" etiqueta="Tiempo promedio de respuesta"
          valor={panel.tiempo_promedio_respuesta_horas === null ? "—" : panel.tiempo_promedio_respuesta_horas < 1 ? "< 1 h" : `${panel.tiempo_promedio_respuesta_horas.toLocaleString("es-CO", { maximumFractionDigits: 1 })} h`} detalle={`${chatsActivos} chats activos`} />
        <Metrica icono={<Users className="h-5 w-5" />} color="bg-lime-50 text-lime-600" etiqueta="Asesores conectados" valor={String(asesoresConectados)} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-white shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">Pendientes de responder</h2>
              <p className="text-xs text-muted-foreground">
                {panel.total_pendientes_responder} {panel.total_pendientes_responder === 1 ? "solicitud" : "solicitudes"}
                {urgentes ? ` · ${urgentes} con más de 48 h` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              {Object.values(NIVEL_ESPERA).map((n) => (
                <span key={n.etiqueta} className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${n.punto}`} />{n.etiqueta}</span>
              ))}
            </div>
          </div>
          <div className="divide-y divide-border">
            {panel.pendientes_responder.map((p) => {
              const nivel = NIVEL_ESPERA[p.nivel];
              return (
                <button key={p.cotizacion_id} type="button" onClick={onAbrirSolicitudes} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-muted/40">
                  <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${nivel.punto}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.nombre_producto}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.linea_producto} · {cantidad(p.cantidad, p.unidad)} · {p.modalidad === "abierta" ? "Asignada por Zarpi" : "Dirigida a tu empresa"}
                      {p.con_borrador ? " · borrador en curso" : ""}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${nivel.chip}`}>{espera(p.horas_esperando)}</span>
                </button>
              );
            })}
            {!panel.pendientes_responder.length ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">Estás al día: no hay solicitudes por responder.</p> : null}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><ShoppingCart className="h-4 w-4 text-primary" />Pedidos en proceso</h2>
              <button type="button" onClick={onAbrirPedidos} className="text-xs font-medium text-primary">{enProceso} en curso</button>
            </div>
            <div className="space-y-2">
              {ETAPAS.map((e) => {
                const n = panel.pedidos_por_etapa[e.clave] ?? 0;
                return (
                  <div key={e.clave} className="flex items-center gap-3 text-sm">
                    <span className="w-28 flex-shrink-0 text-xs text-muted-foreground">{e.etiqueta}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(n / maxEtapa) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right text-xs font-semibold">{n}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{panel.pedidos_entregados} {panel.pedidos_entregados === 1 ? "pedido entregado" : "pedidos entregados"}</p>
          </div>

          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Por qué no te eligen</h2>
            <p className="mb-3 text-xs text-muted-foreground">Lo que dijo el comprador al elegir otra propuesta</p>
            {perdidas ? (
              <div className="space-y-2">
                {MOTIVOS.filter((m) => m.clave !== "sin_motivo" || panel.motivos_perdida.sin_motivo).map((m) => {
                  const n = panel.motivos_perdida[m.clave] ?? 0;
                  return (
                    <div key={m.clave} className="flex items-center gap-3 text-sm">
                      <span className="w-28 flex-shrink-0 text-xs text-muted-foreground">{m.etiqueta}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-rose-400" style={{ width: `${(n / perdidas) * 100}%` }} />
                      </div>
                      <span className="w-12 whitespace-nowrap text-right text-xs font-semibold">{Math.round((n / perdidas) * 100)} %</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Ninguna propuesta perdida en el periodo.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
