import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Clock,
  Loader2,
  RefreshCw,
  Settings2,
  Star,
  UserPlus,
  X,
} from "lucide-react";

import {
  adminService,
  type CandidatoAsignacion,
  type CandidatosResponse,
  type ConfiguracionOperacion,
  type CriterioEncaje,
  type SolicitudAbiertaAdmin,
} from "@/services/admin.service";

/**
 * Asignación de solicitudes abiertas.
 *
 * Cada solicitud abierta llega como mucho a `cupo_por_solicitud` empresas. En el
 * piloto las elige el admin desde aquí ("Asignar a"), mirando el encaje de cada
 * candidata: categoría, país, pedido mínimo, capacidad, su desempeño y si le
 * queda cupo hoy. El modo automático usa ese mismo criterio sin intervención.
 */

type Filtro = "por_asignar" | "vigentes" | "todas";

const FILTROS: { clave: Filtro; etiqueta: string }[] = [
  { clave: "por_asignar", etiqueta: "Por asignar" },
  { clave: "vigentes", etiqueta: "Vigentes" },
  { clave: "todas", etiqueta: "Todas" },
];

const FUENTES_TRM: Record<string, string> = {
  oficial: "TRM oficial del día",
  respaldo_admin: "Valor de respaldo (la consulta oficial falló)",
  ultima_oficial: "Última TRM oficial conocida (la consulta falló)",
  por_defecto: "Valor por defecto del servidor (sin TRM oficial ni respaldo)",
};

const ESTADO_PROPUESTA: Record<string, string> = {
  borrador: "En redacción",
  pendiente: "Propuesta enviada",
  aceptada: "Ganó",
  rechazada: "No elegida",
};

function pesos(valor: number): string {
  return `$${Math.round(valor).toLocaleString("es-CO")} COP`;
}

function unidad(u: string | null | undefined): string {
  return u === "m3" ? "m³" : "unidades";
}

function cantidad(valor: number, u: string | null | undefined): string {
  return `${valor.toLocaleString("es-CO", { maximumFractionDigits: 2 })} ${unidad(u)}`;
}

function espera(horas: number): { texto: string; clase: string } {
  const texto = horas < 1 ? "hace menos de 1 h" : horas < 48 ? `hace ${Math.round(horas)} h` : `hace ${Math.round(horas / 24)} días`;
  const clase = horas < 4 ? "text-emerald-700 bg-emerald-50" : horas < 24 ? "text-amber-700 bg-amber-50" : "text-rose-700 bg-rose-50";
  return { texto, clase };
}

function mensajeError(error: unknown, defecto: string): string {
  return error instanceof Error && error.message ? error.message : defecto;
}

function Criterio({ etiqueta, criterio }: { etiqueta: string; criterio: CriterioEncaje | boolean }) {
  const cumple = typeof criterio === "boolean" ? criterio : criterio.cumple;
  const detalle = typeof criterio === "boolean" ? "" : criterio.detalle;
  const clase =
    cumple === true
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : cumple === false
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-border bg-muted/40 text-muted-foreground";
  return (
    <span title={detalle} className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium ${clase}`}>
      {cumple === true ? <Check className="h-3 w-3" /> : cumple === false ? <X className="h-3 w-3" /> : null}
      {etiqueta}
    </span>
  );
}

function porcentaje(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? "—" : `${Math.round(valor)} %`;
}

function AjustesOperacion({
  ajustes,
  onCambio,
}: {
  ajustes: ConfiguracionOperacion | null;
  onCambio: (ajustes: ConfiguracionOperacion) => void;
}) {
  const [cupo, setCupo] = useState("");
  const [respaldo, setRespaldo] = useState("");
  const [guardando, setGuardando] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ajustes) return;
    setCupo(String(ajustes.asignacion.cupo_por_solicitud));
    setRespaldo(ajustes.trm.respaldo_admin ? String(ajustes.trm.respaldo_admin) : "");
  }, [ajustes]);

  if (!ajustes) {
    return null;
  }

  const ejecutar = async (clave: string, accion: () => Promise<void>, exito: string) => {
    setGuardando(clave);
    setError("");
    setAviso("");
    try {
      await accion();
      setAviso(exito);
    } catch (e) {
      setError(mensajeError(e, "No se pudo guardar el cambio."));
    } finally {
      setGuardando(null);
    }
  };

  const cambiarModo = (modo: "manual" | "automatica") =>
    ejecutar("modo", async () => onCambio(await adminService.updateAssignmentSettings({ modo })),
      modo === "manual" ? "Las nuevas abiertas esperarán tu asignación." : "Las nuevas abiertas se repartirán solas por encaje.");

  const guardarCupo = () => {
    const valor = Number.parseInt(cupo, 10);
    if (!Number.isFinite(valor) || valor < 1 || valor > 20) {
      setError("El cupo debe estar entre 1 y 20 empresas.");
      return;
    }
    void ejecutar("cupo", async () => onCambio(await adminService.updateAssignmentSettings({ cupo_por_solicitud: valor })),
      `Cada solicitud llegará a máximo ${valor} empresas.`);
  };

  const guardarRespaldo = (quitar = false) => {
    const valor = quitar ? null : Number.parseFloat(respaldo.replace(/\./g, "").replace(",", "."));
    if (!quitar && (!Number.isFinite(valor) || (valor as number) < 500)) {
      setError("Escribe la TRM en pesos por dólar, por ejemplo 4100.");
      return;
    }
    void ejecutar("trm", async () => {
      const trm = await adminService.updateTrmFallback(valor);
      onCambio({ ...ajustes, trm });
    }, quitar ? "Se quitó el valor de respaldo." : "TRM de respaldo guardada.");
  };

  const consultarTrm = () =>
    void ejecutar("consultar", async () => {
      const trm = await adminService.refreshTrm();
      onCambio({ ...ajustes, trm });
    }, "TRM consultada.");

  const { asignacion, trm } = ajustes;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <p className="flex items-center gap-2 text-base font-semibold"><Settings2 className="h-4 w-4 text-primary" />Reparto de solicitudes abiertas</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada solicitud llega a pocas empresas elegidas por encaje, no a toda la red. Ninguna ve las propuestas de las otras.
        </p>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Modo de asignación">
          {(["manual", "automatica"] as const).map((modo) => (
            <button
              key={modo}
              type="button"
              role="radio"
              aria-checked={asignacion.modo === modo}
              disabled={guardando !== null}
              onClick={() => { if (asignacion.modo !== modo) void cambiarModo(modo); }}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${asignacion.modo === modo ? "border-primary bg-primary text-white" : "border-border bg-white text-foreground"}`}
            >
              {modo === "manual" ? "Manual (asigno yo)" : "Automático por encaje"}
            </button>
          ))}
        </div>
        <label className="mt-4 block text-sm font-medium" htmlFor="cupo-solicitud">Empresas por solicitud (cupo)</label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id="cupo-solicitud"
            type="number"
            min={1}
            max={20}
            value={cupo}
            onChange={(e) => setCupo(e.target.value)}
            className="w-24 rounded-lg border border-border bg-white px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={guardando !== null || cupo === String(asignacion.cupo_por_solicitud)}
            onClick={guardarCupo}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {guardando === "cupo" ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <p className="text-base font-semibold">TRM para los montos en pesos</p>
        <p className="mt-1 text-2xl font-semibold">{pesos(trm.valor)} <span className="text-sm font-normal text-muted-foreground">por dólar</span></p>
        <p className={`mt-1 text-xs ${trm.fuente === "oficial" ? "text-muted-foreground" : "text-amber-700"}`}>
          {FUENTES_TRM[trm.fuente] ?? trm.fuente}
          {trm.vigencia ? ` · vigente desde ${trm.vigencia}` : ""}
        </p>
        <label className="mt-3 block text-sm font-medium" htmlFor="trm-respaldo">Respaldo si falla la consulta oficial</label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            id="trm-respaldo"
            inputMode="decimal"
            placeholder="Ej. 4100"
            value={respaldo}
            onChange={(e) => setRespaldo(e.target.value)}
            className="w-32 rounded-lg border border-border bg-white px-3 py-1.5 text-sm"
          />
          <button type="button" disabled={guardando !== null} onClick={() => guardarRespaldo()} className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-50">
            {guardando === "trm" ? "Guardando..." : "Guardar"}
          </button>
          {trm.respaldo_admin ? (
            <button type="button" disabled={guardando !== null} onClick={() => guardarRespaldo(true)} className="rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground">
              Quitar
            </button>
          ) : null}
          <button type="button" disabled={guardando !== null || !trm.consulta_automatica} onClick={consultarTrm} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-50" title={trm.consulta_automatica ? "Volver a consultar la TRM oficial" : "La consulta automática está desactivada en el servidor"}>
            <RefreshCw className={`h-3.5 w-3.5 ${guardando === "consultar" ? "animate-spin" : ""}`} />Consultar ahora
          </button>
        </div>
      </div>

      {aviso || error ? (
        <p role={error ? "alert" : "status"} className={`lg:col-span-2 rounded-lg border px-3 py-2 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || aviso}
        </p>
      ) : null}
    </div>
  );
}

function ModalAsignar({
  solicitudId,
  onCerrar,
  onAsignada,
}: {
  solicitudId: string;
  onCerrar: () => void;
  onAsignada: (solicitud: SolicitudAbiertaAdmin) => void;
}) {
  const [datos, setDatos] = useState<CandidatosResponse | null>(null);
  const [soloQueEncajan, setSoloQueEncajan] = useState(true);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      setDatos(await adminService.listAssignmentCandidates(solicitudId, soloQueEncajan));
    } catch (e) {
      setError(mensajeError(e, "No se pudieron cargar las empresas."));
    } finally {
      setCargando(false);
    }
  }, [solicitudId, soloQueEncajan]);

  useEffect(() => { void cargar(); }, [cargar]);

  const solicitud = datos?.solicitud;
  const libres = solicitud ? Math.max(solicitud.cupo_por_solicitud - solicitud.asignadas, 0) : 0;

  const motivoBloqueo = (c: CandidatoAsignacion): string | null => {
    if (c.asignada) return "Ya asignada";
    if (!c.encaje.categoria) return "No trabaja esta categoría";
    if (c.cupo_diario_agotado) return "Sin cupo hoy";
    return null;
  };

  const alternar = (id: string) => {
    setSeleccion((actual) => {
      if (actual.includes(id)) return actual.filter((x) => x !== id);
      if (actual.length >= libres) return actual;
      return [...actual, id];
    });
  };

  const asignar = async () => {
    if (!seleccion.length) return;
    setGuardando(true);
    setError("");
    try {
      onAsignada(await adminService.assignRequest(solicitudId, seleccion));
      onCerrar();
    } catch (e) {
      setError(mensajeError(e, "No se pudo asignar la solicitud."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Asignar solicitud">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Asignar a</p>
            {solicitud ? (
              <p className="text-xs text-muted-foreground">
                {solicitud.nombre_producto} · {solicitud.linea_producto} · {solicitud.pais_importacion} · {cantidad(solicitud.cantidad_minima, solicitud.unidad_cantidad)}
              </p>
            ) : null}
          </div>
          <button onClick={onCerrar} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" title="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2 text-sm">
          <span>
            {solicitud ? (
              <>Asignadas <strong>{solicitud.asignadas}</strong> de {solicitud.cupo_por_solicitud}. {libres > 0 ? `Puedes elegir ${libres} más.` : "El cupo de esta solicitud está completo."}</>
            ) : "Cargando..."}
          </span>
          <label className="flex items-center gap-2 text-muted-foreground">
            <input type="checkbox" checked={soloQueEncajan} onChange={(e) => setSoloQueEncajan(e.target.checked)} className="h-4 w-4 rounded border-border" />
            Solo empresas de esta categoría y país
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {cargando ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando empresas...</p>
          ) : datos && datos.candidatos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguna empresa activa trabaja esta categoría desde este país. Desmarca el filtro para ver todas.</p>
          ) : (
            <div className="space-y-2">
              {datos?.candidatos.map((c) => {
                const bloqueo = motivoBloqueo(c);
                const elegida = seleccion.includes(c.importador_id);
                const sinHueco = !elegida && seleccion.length >= libres;
                return (
                  <label
                    key={c.importador_id}
                    className={`flex cursor-pointer flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center ${elegida ? "border-primary bg-primary/5" : "border-border"} ${bloqueo ? "cursor-default opacity-70" : ""}`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 flex-shrink-0 rounded border-border"
                      checked={c.asignada || elegida}
                      disabled={Boolean(bloqueo) || sinHueco}
                      onChange={() => alternar(c.importador_id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        {c.nombre_empresa}
                        {c.verificado ? <BadgeCheck className="h-4 w-4 text-primary" aria-label="Verificada" /> : null}
                        {bloqueo ? <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{bloqueo}</span> : null}
                        {c.estado_propuesta ? <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">{ESTADO_PROPUESTA[c.estado_propuesta] ?? c.estado_propuesta}</span> : null}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Criterio etiqueta="Categoría" criterio={c.encaje.categoria} />
                        <Criterio etiqueta="País" criterio={c.encaje.pais} />
                        <Criterio etiqueta="Pedido mínimo" criterio={c.encaje.pedido_minimo} />
                        <Criterio etiqueta="Capacidad" criterio={c.encaje.capacidad} />
                      </div>
                    </div>
                    <dl className="grid flex-shrink-0 grid-cols-4 gap-3 text-center text-xs sm:w-[360px]">
                      <div><dt className="text-muted-foreground">Calificación</dt><dd className="flex items-center justify-center gap-0.5 font-semibold"><Star className="h-3 w-3 text-amber-500" />{c.calificacion_promedio.toFixed(1)}</dd></div>
                      <div><dt className="text-muted-foreground">Responde</dt><dd className="font-semibold">{porcentaje(c.desempeno.tasa_respuesta_pct)}</dd></div>
                      <div><dt className="text-muted-foreground">Cierra</dt><dd className="font-semibold">{porcentaje(c.desempeno.tasa_cierre_pct)}</dd></div>
                      <div><dt className="text-muted-foreground">Hoy</dt><dd className={`font-semibold ${c.cupo_diario_agotado ? "text-rose-700" : ""}`}>{c.recibidas_hoy}{c.limite_cotizaciones_diarias ? `/${c.limite_cotizaciones_diarias}` : ""}</dd></div>
                    </dl>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
          {error ? <p role="alert" className="mr-auto text-sm text-rose-700">{error}</p> : null}
          <button type="button" onClick={onCerrar} className="rounded-lg border border-border px-4 py-2 text-sm font-medium">Cancelar</button>
          <button
            type="button"
            disabled={!seleccion.length || guardando}
            onClick={() => { void asignar(); }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Asignar{seleccion.length ? ` (${seleccion.length})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AsignacionSolicitudes() {
  const [ajustes, setAjustes] = useState<ConfiguracionOperacion | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("por_asignar");
  const [solicitudes, setSolicitudes] = useState<SolicitudAbiertaAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const [config, lista] = await Promise.all([
        adminService.getOperationSettings(),
        adminService.listOpenRequests(filtro),
      ]);
      setAjustes(config);
      setSolicitudes(lista);
    } catch (e) {
      setError(mensajeError(e, "No se pudieron cargar las solicitudes."));
    } finally {
      setCargando(false);
    }
  }, [filtro]);

  useEffect(() => { void cargar(); }, [cargar]);

  const reemplazar = (actualizada: SolicitudAbiertaAdmin) => {
    setSolicitudes((lista) =>
      lista
        .map((s) => (s.id === actualizada.id ? actualizada : s))
        .filter((s) => filtro !== "por_asignar" || s.asignadas < s.cupo_por_solicitud),
    );
  };

  const quitar = async (solicitud: SolicitudAbiertaAdmin, importadorId: string) => {
    setQuitando(`${solicitud.id}:${importadorId}`);
    setError("");
    try {
      const actualizada = await adminService.unassignRequest(solicitud.id, importadorId);
      setSolicitudes((lista) => lista.map((s) => (s.id === actualizada.id ? actualizada : s)));
    } catch (e) {
      setError(mensajeError(e, "No se pudo quitar la asignación."));
    } finally {
      setQuitando(null);
    }
  };

  const porAsignar = useMemo(() => solicitudes.filter((s) => s.asignadas === 0).length, [solicitudes]);

  return (
    <section className="space-y-4">
      <AjustesOperacion ajustes={ajustes} onCambio={setAjustes} />

      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold">Solicitudes abiertas</p>
            <p className="text-sm text-muted-foreground">
              {ajustes?.asignacion.modo === "manual"
                ? "Modo manual: ninguna empresa ve una solicitud abierta hasta que se la asignas."
                : "Modo automático: se asignan solas al crearse. Aquí puedes completar o corregir."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border p-0.5" role="tablist">
              {FILTROS.map((f) => (
                <button
                  key={f.clave}
                  type="button"
                  role="tab"
                  aria-selected={filtro === f.clave}
                  onClick={() => setFiltro(f.clave)}
                  className={`rounded-md px-3 py-1 text-sm ${filtro === f.clave ? "bg-primary text-white" : "text-muted-foreground"}`}
                >
                  {f.etiqueta}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { void cargar(); }} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border" title="Actualizar">
              <RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {error ? <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        {filtro === "por_asignar" && porAsignar > 0 ? (
          <p className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4" />{porAsignar} {porAsignar === 1 ? "solicitud no ha llegado" : "solicitudes no han llegado"} a ninguna empresa todavía.
          </p>
        ) : null}

        <div className="mt-4 space-y-2">
          {cargando && !solicitudes.length ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando...</p>
          ) : !solicitudes.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {filtro === "por_asignar" ? "No hay solicitudes esperando asignación." : "No hay solicitudes abiertas."}
            </p>
          ) : (
            solicitudes.map((s) => {
              const tiempo = espera(s.horas_desde_creacion);
              const lleno = s.asignadas >= s.cupo_por_solicitud;
              const vigente = s.estado === "abierta" || s.estado === "propuestas_recibidas";
              return (
                <div key={s.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {s.nombre_producto}
                      <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${tiempo.clase}`}><Clock className="h-3 w-3" />{tiempo.texto}</span>
                      {!vigente ? <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{s.estado}</span> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {s.linea_producto} · {s.pais_importacion} · {cantidad(s.cantidad_minima, s.unidad_cantidad)} · {s.tipo_calidad} · {s.incoterm}
                      {s.precio_objetivo_usd ? ` · objetivo ${s.precio_objetivo_usd.toLocaleString("es-CO")} ${s.moneda_precio_objetivo}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.empresas.map((e) => {
                        const clave = `${s.id}:${e.importador_id}`;
                        const conPropuesta = e.estado_propuesta && e.estado_propuesta !== "borrador";
                        return (
                          <span key={e.importador_id} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pl-2.5 pr-1 text-xs">
                            {e.nombre_empresa}
                            {e.estado_propuesta ? <span className="text-muted-foreground">· {ESTADO_PROPUESTA[e.estado_propuesta] ?? e.estado_propuesta}</span> : null}
                            {e.origen === "automatica" ? <span className="text-muted-foreground">· auto</span> : null}
                            {!conPropuesta && vigente ? (
                              <button
                                type="button"
                                disabled={quitando === clave}
                                onClick={() => { void quitar(s, e.importador_id); }}
                                className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="Quitar asignación"
                              >
                                {quitando === clave ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                              </button>
                            ) : <span className="w-1" />}
                          </span>
                        );
                      })}
                      {!s.empresas.length ? <span className="text-xs text-amber-700">Sin empresas asignadas</span> : null}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <span className="text-xs text-muted-foreground">{s.asignadas}/{s.cupo_por_solicitud} · {s.propuestas_enviadas} {s.propuestas_enviadas === 1 ? "propuesta" : "propuestas"}</span>
                    <button
                      type="button"
                      disabled={lleno || !vigente}
                      onClick={() => setAbierta(s.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                      title={lleno ? "El cupo de empresas de esta solicitud está completo" : undefined}
                    >
                      <UserPlus className="h-4 w-4" />Asignar a
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {abierta ? <ModalAsignar solicitudId={abierta} onCerrar={() => setAbierta(null)} onAsignada={reemplazar} /> : null}
    </section>
  );
}
