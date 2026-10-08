import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Check,
  Copy,
  Info,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Ticket,
  Trophy,
  Users,
  X,
} from "lucide-react";

import {
  pesos,
  retoService,
  type EstadoRecompensa,
  type ParticipanteAdmin,
  type RondaAdmin,
  type RondaDatos,
} from "@/services/reto.service";

import {
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_INPUT,
  CLASE_TARJETA,
  ESTADO_RONDA,
  aDatetimeLocalBogota,
  datetimeLocalBogotaAUtc,
  fechaBogota,
  mensajeError,
} from "./comun";

/**
 * Rondas y pagos del reto comunitario. La plataforma solo registra quién, cuánto
 * y cuándo: la transferencia se hace a mano desde Bancolombia.
 */

const ESTADO_RECOMPENSA: Record<EstadoRecompensa, { texto: string; clase: string }> = {
  pendiente: { texto: "En curso", clase: "bg-muted text-muted-foreground" },
  reclamable: { texto: "Puede reclamar", clase: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  solicitada: { texto: "Por pagar", clase: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  pagada: { texto: "Pagada", clase: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
};

function Insignia({ texto, clase }: { texto: string; clase: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${clase}`}>{texto}</span>;
}

async function copiar(texto: string, etiqueta: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(`${etiqueta} copiado`);
  } catch {
    toast.error("No se pudo copiar. Selecciona el texto a mano.");
  }
}

// ── Nueva ronda ──────────────────────────────────────────────────────────────

function NuevaRonda({ nombreSugerido, onCreada, onCancelar }: { nombreSugerido: string; onCreada: () => void; onCancelar: () => void }) {
  const [datos, setDatos] = useState<RondaDatos>(() => ({
    nombre: nombreSugerido,
    max_participantes: 20,
    umbral_aprobados: 10,
    recompensa_cop: 50000,
    recompensa_cotizaciones: 5,
    fecha_limite: aDatetimeLocalBogota(new Date(Date.now() + 30 * 24 * 3600 * 1000)).slice(0, 11) + "23:59",
    abrir_siguiente_al_llenarse: true,
  }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof RondaDatos>(campo: K, valor: RondaDatos[K]) => setDatos((d) => ({ ...d, [campo]: valor }));
  const numero = (valor: string) => (valor === "" ? 0 : Math.max(0, Math.floor(Number(valor) || 0)));

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    const fin = datetimeLocalBogotaAUtc(datos.fecha_limite);
    if (datos.nombre.trim().length < 2) return setError("El nombre debe tener al menos 2 caracteres.");
    if (datos.max_participantes < 1 || datos.umbral_aprobados < 1) return setError("Cupos y umbral deben ser al menos 1.");
    if (!fin || fin.getTime() <= Date.now()) return setError("La fecha límite debe ser futura.");
    setGuardando(true);
    setError(null);
    try {
      await retoService.crearRonda({ ...datos, nombre: datos.nombre.trim() });
      toast.success("Ronda creada. Avisamos a la lista de espera.");
      onCreada();
    } catch (err) {
      // 409: ya hay otra abierta.
      setError(mensajeError(err, "No se pudo crear la ronda."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={crear} className={`${CLASE_TARJETA} space-y-4`} noValidate>
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-base font-semibold"><Plus className="h-4 w-4 text-primary dark:text-accent" /> Nueva ronda</p>
        <button type="button" onClick={onCancelar} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" title="Cancelar">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm">
          <span className="font-medium">Nombre</span>
          <input value={datos.nombre} onChange={(e) => set("nombre", e.target.value)} maxLength={80} className={`${CLASE_INPUT} mt-1`} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Cupos</span>
          <input type="number" min={1} value={datos.max_participantes} onChange={(e) => set("max_participantes", numero(e.target.value))} className={`${CLASE_INPUT} mt-1`} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Aprobados para reclamar</span>
          <input type="number" min={1} value={datos.umbral_aprobados} onChange={(e) => set("umbral_aprobados", numero(e.target.value))} className={`${CLASE_INPUT} mt-1`} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Recompensa en efectivo (COP)</span>
          <input type="number" min={0} step={1000} value={datos.recompensa_cop} onChange={(e) => set("recompensa_cop", numero(e.target.value))} className={`${CLASE_INPUT} mt-1`} />
          <span className="mt-0.5 block text-xs text-muted-foreground">{pesos(datos.recompensa_cop)}</span>
        </label>
        <label className="block text-sm">
          <span className="font-medium">O cotizaciones gratis</span>
          <input type="number" min={0} value={datos.recompensa_cotizaciones} onChange={(e) => set("recompensa_cotizaciones", numero(e.target.value))} className={`${CLASE_INPUT} mt-1`} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Fecha límite (hora de Bogotá)</span>
          <input type="datetime-local" value={datos.fecha_limite} onChange={(e) => set("fecha_limite", e.target.value)} className={`${CLASE_INPUT} mt-1`} />
        </label>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={datos.abrir_siguiente_al_llenarse} onChange={(e) => set("abrir_siguiente_al_llenarse", e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border" />
        <span>Abrir la siguiente ronda automáticamente al llenarse <span className="text-muted-foreground">(misma configuración y duración)</span></span>
      </label>
      <p className="text-sm text-muted-foreground">
        Presupuesto máximo: <strong className="text-foreground">{pesos(datos.max_participantes * datos.recompensa_cop)}</strong> ({datos.max_participantes} cupos × {pesos(datos.recompensa_cop)})
      </p>
      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancelar} className={CLASE_BOTON_SECUNDARIO}>Cancelar</button>
        <button type="submit" disabled={guardando} className={CLASE_BOTON_PRIMARIO}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Crear ronda
        </button>
      </div>
    </form>
  );
}

// ── Edición en línea ─────────────────────────────────────────────────────────

function EditarRonda({ ronda, onGuardada, onCancelar }: { ronda: RondaAdmin; onGuardada: () => void; onCancelar: () => void }) {
  const [max, setMax] = useState(String(ronda.max_participantes));
  const [fecha, setFecha] = useState(aDatetimeLocalBogota(ronda.fecha_limite));
  const [abrirSiguiente, setAbrirSiguiente] = useState(ronda.abrir_siguiente_al_llenarse);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    const cupos = Math.floor(Number(max));
    if (!Number.isFinite(cupos) || cupos < Math.max(1, ronda.inscritos)) {
      setError(`Los cupos no pueden ser menos que los inscritos (${ronda.inscritos}).`);
      return;
    }
    if (!datetimeLocalBogotaAUtc(fecha)) {
      setError("Fecha límite no válida.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await retoService.editarRonda(ronda.id, { max_participantes: cupos, fecha_limite: fecha, abrir_siguiente_al_llenarse: abrirSiguiente });
      toast.success("Ronda actualizada");
      onGuardada();
    } catch (err) {
      setError(mensajeError(err, "No se pudo guardar."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-3 bg-muted/40 px-3 py-3">
      <label className="text-sm">
        <span className="font-medium">Cupos</span>
        <input type="number" min={Math.max(1, ronda.inscritos)} value={max} onChange={(e) => setMax(e.target.value)} className={`${CLASE_INPUT} mt-1 w-24`} />
      </label>
      <label className="text-sm">
        <span className="font-medium">Fecha límite (Bogotá)</span>
        <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${CLASE_INPUT} mt-1`} />
      </label>
      <label className="flex items-center gap-2 pb-1.5 text-sm">
        <input type="checkbox" checked={abrirSiguiente} onChange={(e) => setAbrirSiguiente(e.target.checked)} className="h-4 w-4 rounded border-border" />
        Abrir la siguiente al llenarse
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onCancelar} className={CLASE_BOTON_SECUNDARIO}>Cancelar</button>
        <button type="button" onClick={guardar} disabled={guardando} className={CLASE_BOTON_PRIMARIO}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Guardar
        </button>
      </div>
      {error ? <p role="alert" className="w-full text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
    </div>
  );
}

// ── Participantes y pagos ────────────────────────────────────────────────────

function MarcarPagado({ participante, monto, onPagado }: { participante: ParticipanteAdmin; monto: number; onPagado: () => void }) {
  const [referencia, setReferencia] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marcar = async (e: FormEvent) => {
    e.preventDefault();
    if (referencia.trim().length < 3) {
      setError("Escribe la referencia de la transferencia (mínimo 3 caracteres).");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await retoService.marcarPagado(participante.id, referencia.trim());
      toast.success("Pago registrado. Le avisamos al participante.");
      onPagado();
    } catch (err) {
      setError(mensajeError(err, "No se pudo registrar el pago."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={marcar} className="mt-3 space-y-1.5 border-t border-border pt-3" noValidate>
      <label htmlFor={`ref-${participante.id}`} className="block text-sm font-medium">
        Referencia de la transferencia de {pesos(monto)}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`ref-${participante.id}`}
          value={referencia}
          onChange={(e) => setReferencia(e.target.value)}
          maxLength={120}
          placeholder="Ej. comprobante Bancolombia"
          className={`${CLASE_INPUT} sm:flex-1`}
        />
        <button type="submit" disabled={guardando} className={CLASE_BOTON_PRIMARIO}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Marcar pagado
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Al marcarlo, el participante recibe una notificación y un correo con el monto, su banco y esta referencia.
      </p>
      {error ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
    </form>
  );
}

function DatoCuenta({ etiqueta, valor, copiable }: { etiqueta: string; valor: string; copiable?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{etiqueta}</dt>
      <dd className="flex items-center gap-1.5 break-all font-medium">
        <span className={copiable ? "font-mono" : ""}>{valor}</span>
        {copiable ? (
          <button type="button" onClick={() => void copiar(valor, etiqueta)} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground" title={`Copiar ${etiqueta.toLowerCase()}`}>
            <Copy className="h-3 w-3" /> copiar
          </button>
        ) : null}
      </dd>
    </div>
  );
}

function TarjetaParticipante({ p, ronda, onCambio }: { p: ParticipanteAdmin; ronda: RondaAdmin; onCambio: () => void }) {
  const estado = ESTADO_RECOMPENSA[p.estado_recompensa] ?? { texto: p.estado_recompensa, clase: "bg-muted text-muted-foreground" };
  const pct = ronda.umbral_aprobados > 0 ? Math.min(100, (p.aprobados / ronda.umbral_aprobados) * 100) : 0;
  const cuenta = p.cuenta && !("error" in p.cuenta) ? p.cuenta : null;
  const errorCuenta = p.cuenta && "error" in p.cuenta ? p.cuenta.error : null;

  return (
    <li className="rounded-xl border border-border bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{p.usuario.nombre || p.usuario.email}</p>
          {p.usuario.nombre ? <p className="truncate text-xs text-muted-foreground">{p.usuario.email}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {p.eleccion === "efectivo" ? (
            <Insignia texto={`Efectivo ${pesos(ronda.recompensa_cop)}`} clase="bg-primary/10 text-primary dark:text-accent" />
          ) : p.eleccion === "cotizaciones" ? (
            <Insignia texto={`${ronda.recompensa_cotizaciones} cotizaciones`} clase="bg-primary/10 text-primary dark:text-accent" />
          ) : null}
          <Insignia texto={p.estado_recompensa === "pagada" && p.eleccion === "cotizaciones" ? "Acreditada" : estado.texto} clase={estado.clase} />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-medium tabular-nums">{p.aprobados}/{ronda.umbral_aprobados} aprobados</span>
      </div>

      {cuenta ? (
        <dl className="mt-3 grid gap-x-4 gap-y-2 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-2">
          <DatoCuenta etiqueta="Banco" valor={`${cuenta.banco} · ${cuenta.tipo_cuenta}`} />
          <DatoCuenta etiqueta="Número" valor={cuenta.numero} copiable />
          <DatoCuenta etiqueta="Titular" valor={cuenta.titular} />
          <DatoCuenta etiqueta="Documento" valor={cuenta.documento} copiable />
        </dl>
      ) : null}
      {errorCuenta ? <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">{errorCuenta}</p> : null}

      {p.estado_recompensa === "solicitada" && !p.cuenta ? (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Eligió efectivo. Esperando sus datos bancarios.</p>
      ) : null}
      {p.estado_recompensa === "solicitada" && cuenta ? (
        <MarcarPagado participante={p} monto={ronda.recompensa_cop} onPagado={onCambio} />
      ) : null}
      {p.estado_recompensa === "pagada" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {p.eleccion === "cotizaciones" ? "Acreditadas" : "Pagado"} el {fechaBogota(p.pagado_en)}
          {p.referencia_pago ? <> · Ref. <span className="font-mono">{p.referencia_pago}</span></> : null}
        </p>
      ) : null}
    </li>
  );
}

function Participantes({ ronda, onCerrar, onCambio }: { ronda: RondaAdmin; onCerrar: () => void; onCambio: () => void }) {
  const [lista, setLista] = useState<ParticipanteAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [soloPorPagar, setSoloPorPagar] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setLista(await retoService.participantes(ronda.id));
    } catch (err) {
      setError(mensajeError(err, "No se pudieron cargar los participantes."));
    }
  }, [ronda.id]);

  useEffect(() => {
    setLista(null);
    void cargar();
  }, [cargar]);

  const porPagar = useMemo(() => (lista ?? []).filter((p) => p.estado_recompensa === "solicitada"), [lista]);
  const visibles = soloPorPagar ? porPagar : lista ?? [];

  return (
    <section id="reto-participantes" className={`${CLASE_TARJETA} space-y-3`} aria-label={`Participantes de ${ronda.nombre}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-base font-semibold"><Users className="h-4 w-4 text-primary dark:text-accent" /> Participantes de {ronda.nombre}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {ronda.inscritos} inscritos · pagado {pesos(ronda.pagado_cop)} de {pesos(ronda.presupuesto_cop)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void cargar()} className={CLASE_BOTON_SECUNDARIO} title="Actualizar">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onCerrar} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" title="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Filtro de participantes">
        {[
          { clave: false, texto: `Todos (${lista?.length ?? 0})` },
          { clave: true, texto: `Por pagar (${porPagar.length})` },
        ].map((f) => (
          <button
            key={String(f.clave)}
            type="button"
            role="radio"
            aria-checked={soloPorPagar === f.clave}
            onClick={() => setSoloPorPagar(f.clave)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${soloPorPagar === f.clave ? "border-primary bg-primary text-white" : "border-border bg-white text-foreground"}`}
          >
            {f.texto}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
      ) : lista === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando participantes...</p>
      ) : visibles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{soloPorPagar ? "No hay pagos pendientes en esta ronda." : "Todavía no hay inscritos en esta ronda."}</p>
      ) : (
        <ul className="space-y-2">
          {visibles.map((p) => (
            <TarjetaParticipante key={p.id} p={p} ronda={ronda} onCambio={() => { void cargar(); onCambio(); }} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

export function RetoAdmin() {
  const [rondas, setRondas] = useState<RondaAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [confirmarCierre, setConfirmarCierre] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setRondas(await retoService.rondas());
      setError(null);
    } catch (err) {
      setError(mensajeError(err, "No se pudieron cargar las rondas."));
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const cerrar = async (id: string) => {
    setCerrando(true);
    try {
      await retoService.editarRonda(id, { cerrar: true });
      toast.success("Ronda cerrada");
      setConfirmarCierre(null);
      void cargar();
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo cerrar la ronda."));
    } finally {
      setCerrando(false);
    }
  };

  const verParticipantes = (id: string) => {
    setSeleccionada(id);
    window.setTimeout(() => document.getElementById("reto-participantes")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const rondaSeleccionada = rondas?.find((r) => r.id === seleccionada) ?? null;
  const hayAbierta = (rondas ?? []).some((r) => r.estado === "abierta");
  const totales = useMemo(() => (rondas ?? []).reduce(
    (acc, r) => ({ presupuesto: acc.presupuesto + r.presupuesto_cop, pagado: acc.pagado + r.pagado_cop }),
    { presupuesto: 0, pagado: 0 },
  ), [rondas]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Trophy className="h-5 w-5 text-primary dark:text-accent" /> Reto comunitario: rondas y pagos</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Cupos, avance de los participantes y pagos de recompensas.</p>
        </div>
        {!creando ? (
          <button type="button" onClick={() => setCreando(true)} className={CLASE_BOTON_PRIMARIO}>
            <Plus className="h-4 w-4" /> Nueva ronda
          </button>
        ) : null}
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>La plataforma no mueve dinero: transferí desde Bancolombia y registrá aquí la referencia.</span>
      </p>

      {creando ? (
        <>
          {hayAbierta ? (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Ya hay una ronda abierta. Ciérrala antes de crear otra.
            </p>
          ) : null}
          <NuevaRonda
            nombreSugerido={`Ronda ${(rondas?.length ?? 0) + 1}`}
            onCreada={() => { setCreando(false); void cargar(); }}
            onCancelar={() => setCreando(false)}
          />
        </>
      ) : null}

      {rondas && rondas.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className={CLASE_TARJETA}>
            <p className="text-xs text-muted-foreground">Presupuesto total</p>
            <p className="mt-0.5 text-lg font-semibold">{pesos(totales.presupuesto)}</p>
          </div>
          <div className={CLASE_TARJETA}>
            <p className="text-xs text-muted-foreground">Pagado</p>
            <p className="mt-0.5 text-lg font-semibold">{pesos(totales.pagado)}</p>
          </div>
          <div className={`${CLASE_TARJETA} col-span-2 sm:col-span-1`}>
            <p className="text-xs text-muted-foreground">Rondas</p>
            <p className="mt-0.5 text-lg font-semibold">{rondas.length}</p>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {error ? (
          <p role="alert" className="flex items-center gap-2 p-4 text-sm text-rose-700 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4" /> {error}
            <button type="button" onClick={() => void cargar()} className="underline underline-offset-2">Reintentar</button>
          </p>
        ) : rondas === null ? (
          <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando rondas...</p>
        ) : rondas.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Todavía no hay rondas. Crea la primera con «Nueva ronda».</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Ronda</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Inscritos</th>
                  <th className="px-3 py-2 font-medium">Cierra</th>
                  <th className="px-3 py-2 font-medium">Recompensa</th>
                  <th className="px-3 py-2 text-right font-medium">Presupuesto</th>
                  <th className="px-3 py-2 text-right font-medium">Pagado</th>
                  <th className="px-3 py-2 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rondas.map((r) => {
                  const estado = ESTADO_RONDA[r.estado] ?? ESTADO_RONDA.cerrada;
                  return (
                    <Fragment key={r.id}>
                      <tr className={`border-b border-border align-top ${seleccionada === r.id ? "bg-primary/5" : ""}`}>
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{r.nombre}</p>
                          <p className="text-xs text-muted-foreground">Creada {fechaBogota(r.fecha_creacion, false)}</p>
                        </td>
                        <td className="px-3 py-2.5"><Insignia texto={estado.texto} clase={estado.clase} /></td>
                        <td className="px-3 py-2.5 tabular-nums">{r.inscritos}/{r.max_participantes}</td>
                        <td className="px-3 py-2.5 text-xs">{fechaBogota(r.fecha_limite)}</td>
                        <td className="px-3 py-2.5 text-xs">
                          <span className="inline-flex items-center gap-1"><Banknote className="h-3.5 w-3.5" />{pesos(r.recompensa_cop)}</span>
                          <span className="ml-2 inline-flex items-center gap-1"><Ticket className="h-3.5 w-3.5" />{r.recompensa_cotizaciones}</span>
                          <span className="block text-muted-foreground">cada {r.umbral_aprobados} aprobados</span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{pesos(r.presupuesto_cop)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{pesos(r.pagado_cop)}</td>
                        <td className="px-3 py-2.5">
                          {confirmarCierre === r.id ? (
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <span className="text-xs text-muted-foreground">¿Cerrar? Nadie más podrá inscribirse.</span>
                              <button type="button" onClick={() => setConfirmarCierre(null)} className={CLASE_BOTON_SECUNDARIO}>No</button>
                              <button type="button" disabled={cerrando} onClick={() => void cerrar(r.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60">
                                {cerrando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />} Sí, cerrar
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap justify-end gap-2">
                              <button type="button" onClick={() => verParticipantes(r.id)} className={CLASE_BOTON_SECUNDARIO}>
                                <Users className="h-3.5 w-3.5" /> Participantes
                              </button>
                              {r.estado !== "cerrada" ? (
                                <>
                                  <button type="button" onClick={() => setEditando(editando === r.id ? null : r.id)} className={CLASE_BOTON_SECUNDARIO} title="Editar cupos y fecha">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button type="button" onClick={() => setConfirmarCierre(r.id)} className={CLASE_BOTON_SECUNDARIO}>
                                    <Lock className="h-3.5 w-3.5" /> Cerrar
                                  </button>
                                </>
                              ) : null}
                            </div>
                          )}
                        </td>
                      </tr>
                      {editando === r.id ? (
                        <tr className="border-b border-border">
                          <td colSpan={8} className="p-0">
                            <EditarRonda ronda={r} onCancelar={() => setEditando(null)} onGuardada={() => { setEditando(null); void cargar(); }} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rondaSeleccionada ? (
        <Participantes ronda={rondaSeleccionada} onCerrar={() => setSeleccionada(null)} onCambio={() => void cargar()} />
      ) : null}
    </div>
  );
}
