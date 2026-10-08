import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  BellRing,
  CheckCircle2,
  Clock,
  Link2,
  Loader2,
  Lock,
  MailCheck,
  Search,
  ShieldCheck,
  Ticket,
  Trophy,
  Upload,
  Users,
} from "lucide-react";

import {
  BANCOS_COLOMBIA,
  pesos,
  retoService,
  type CuentaPagoDatos,
  type Eleccion,
  type Participacion,
  type Ronda,
} from "@/services/reto.service";

import {
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_INPUT,
  CLASE_TARJETA,
  fechaBogota,
  mensajeError,
} from "./comun";

/**
 * Reto comunitario de Tendencias: página pública de inscripción con contador
 * de cupos en vivo y, para el participante, su avance y el reclamo de la
 * recompensa (efectivo por transferencia o cotizaciones gratis).
 */

const REFRESCO_MS = 30_000;
const CLASE_BOTON_ACENTO =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-base font-semibold text-[#0f0f0f] shadow-sm hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60";

function vencida(ronda: Ronda): boolean {
  return new Date(ronda.fecha_limite).getTime() <= Date.now();
}

function sinCupos(ronda: Ronda | null): boolean {
  return !ronda || ronda.estado !== "abierta" || ronda.cupos_restantes <= 0 || vencida(ronda);
}

// ── Contador de cupos ────────────────────────────────────────────────────────

function Cupos({ ronda }: { ronda: Ronda }) {
  const ocupados = Math.max(ronda.max_participantes - ronda.cupos_restantes, 0);
  const pct = ronda.max_participantes > 0 ? Math.min(100, (ocupados / ronda.max_participantes) * 100) : 100;
  const conPuntos = ronda.max_participantes <= 40;
  return (
    <div className="rounded-xl bg-white/10 p-4 ring-1 ring-white/15">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/70">
        <Users className="h-3.5 w-3.5" /> {ronda.nombre}
      </p>
      <p className="mt-1 text-2xl font-bold sm:text-3xl" aria-live="polite">
        {ronda.cupos_restantes > 0 ? (
          <>Quedan <span className="text-accent">{ronda.cupos_restantes}</span> de {ronda.max_participantes} cupos</>
        ) : (
          <>Sin cupos: {ronda.max_participantes} de {ronda.max_participantes}</>
        )}
      </p>
      {conPuntos ? (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden="true">
          {Array.from({ length: ronda.max_participantes }, (_, i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < ocupados ? "bg-white/30" : "bg-accent"}`} />
          ))}
        </div>
      ) : (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
          <div className="h-full rounded-full bg-accent" style={{ width: `${100 - pct}%` }} />
        </div>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-sm text-white/80">
        <Clock className="h-4 w-4 shrink-0" /> Cierra el {fechaBogota(ronda.fecha_limite)} (hora de Colombia)
      </p>
    </div>
  );
}

// ── Lista de espera ──────────────────────────────────────────────────────────

function AvisameProxima() {
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const limpio = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) {
      setError("Escribí un correo válido.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await retoService.listaEspera(limpio);
      setEnviado(limpio);
    } catch (err) {
      setError(mensajeError(err, "No pudimos guardar tu correo. Probá de nuevo."));
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
        <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
        Listo. Te escribimos a {enviado} apenas abramos la próxima ronda.
      </p>
    );
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={`${CLASE_BOTON_SECUNDARIO} w-full px-5 py-3 text-base sm:w-auto`}>
        <Lock className="h-4 w-4" /> Ronda cerrada. Avisame de la próxima
      </button>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-2" noValidate>
      <label htmlFor="reto-email" className="block text-sm font-medium">
        Dejanos tu correo y te avisamos cuando abra la próxima ronda
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="reto-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tucorreo@ejemplo.com"
          className={`${CLASE_INPUT} sm:flex-1`}
        />
        <button type="submit" disabled={enviando} className={CLASE_BOTON_PRIMARIO}>
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} Avisame
        </button>
      </div>
      {error ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
    </form>
  );
}

// ── Reclamo de la recompensa ─────────────────────────────────────────────────

function ElegirRecompensa({ participacion, onCambio }: { participacion: Participacion; onCambio: () => void }) {
  const { ronda } = participacion;
  const [eleccion, setEleccion] = useState<Eleccion | null>(null);
  const [enviando, setEnviando] = useState(false);

  const opciones: { clave: Eleccion; icono: typeof Banknote; titulo: string; detalle: string }[] = [
    {
      clave: "efectivo",
      icono: Banknote,
      titulo: pesos(ronda.recompensa_cop),
      detalle: "Por transferencia a tu cuenta. En el siguiente paso te pedimos los datos bancarios.",
    },
    {
      clave: "cotizaciones",
      icono: Ticket,
      titulo: `${ronda.recompensa_cotizaciones} cotizaciones gratis`,
      detalle: "Se acreditan al instante en tu cuenta de Zarpi.",
    },
  ];

  const reclamar = async () => {
    if (!eleccion) return;
    setEnviando(true);
    try {
      await retoService.reclamar(participacion.id, eleccion);
      toast.success(eleccion === "efectivo" ? "Listo. Ahora contanos a qué cuenta te transferimos." : "Te acreditamos tus cotizaciones gratis.");
      onCambio();
    } catch (err) {
      toast.error(mensajeError(err, "No pudimos registrar tu reclamo. Probá de nuevo."));
      onCambio();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="flex items-center gap-2 text-base font-semibold"><Trophy className="h-5 w-5 text-primary dark:text-accent" /> Llegaste a {participacion.umbral}. Elegí tu recompensa</p>
        <p className="mt-0.5 text-sm text-muted-foreground">Es una sola por ronda y la elección es definitiva.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Recompensa">
        {opciones.map(({ clave, icono: Icono, titulo, detalle }) => {
          const activa = eleccion === clave;
          return (
            <button
              key={clave}
              type="button"
              role="radio"
              aria-checked={activa}
              onClick={() => setEleccion(clave)}
              className={`flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-colors ${activa ? "border-primary bg-primary/5" : "border-border bg-white hover:border-primary/40"}`}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${activa ? "bg-primary text-white" : "bg-muted text-foreground"}`}>
                <Icono className="h-5 w-5" />
              </span>
              <span className="text-lg font-bold">{titulo}</span>
              <span className="text-sm text-muted-foreground">{detalle}</span>
            </button>
          );
        })}
      </div>
      <button type="button" disabled={!eleccion || enviando} onClick={reclamar} className={`${CLASE_BOTON_PRIMARIO} w-full px-4 py-2.5 sm:w-auto`}>
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {eleccion === "efectivo" ? `Reclamar ${pesos(ronda.recompensa_cop)}` : eleccion === "cotizaciones" ? `Reclamar ${ronda.recompensa_cotizaciones} cotizaciones` : "Reclamar recompensa"}
      </button>
    </div>
  );
}

const CUENTA_VACIA: CuentaPagoDatos = { banco: "Bancolombia", tipo_cuenta: "ahorros", numero_cuenta: "", titular: "", documento_titular: "" };

function FormCuenta({ participacion, onCambio }: { participacion: Participacion; onCambio: () => void }) {
  const [datos, setDatos] = useState<CuentaPagoDatos>(CUENTA_VACIA);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CuentaPagoDatos>(campo: K, valor: CuentaPagoDatos[K]) => setDatos((d) => ({ ...d, [campo]: valor }));

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const numero = datos.numero_cuenta.replace(/\D/g, "");
    if (numero.length < 6) return setError("El número de cuenta debe tener al menos 6 dígitos.");
    if (datos.titular.trim().length < 3) return setError("Escribí el nombre completo del titular.");
    if (datos.documento_titular.trim().length < 5) return setError("Escribí el documento del titular.");
    setEnviando(true);
    setError(null);
    try {
      await retoService.guardarCuenta(participacion.id, {
        ...datos,
        numero_cuenta: numero,
        titular: datos.titular.trim(),
        documento_titular: datos.documento_titular.trim(),
      });
      toast.success("Recibimos tus datos. El pago sale en máximo 5 días hábiles.");
      onCambio();
    } catch (err) {
      setError(mensajeError(err, "No pudimos guardar tus datos. Probá de nuevo."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={guardar} className="space-y-3" noValidate>
      <div>
        <p className="flex items-center gap-2 text-base font-semibold"><Banknote className="h-5 w-5 text-primary dark:text-accent" /> ¿A qué cuenta te transferimos {pesos(participacion.ronda.recompensa_cop)}?</p>
        <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Guardamos el número y el documento cifrados. Solo los ve el equipo que hace la transferencia.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Banco</span>
          <select value={datos.banco} onChange={(e) => set("banco", e.target.value)} className={`${CLASE_INPUT} mt-1`}>
            {BANCOS_COLOMBIA.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <fieldset className="text-sm">
          <legend className="font-medium">Tipo de cuenta</legend>
          <div className="mt-1 flex gap-2">
            {(["ahorros", "corriente"] as const).map((tipo) => (
              <label key={tipo} className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 ${datos.tipo_cuenta === tipo ? "border-primary bg-primary/5 font-medium text-primary dark:text-accent" : "border-border bg-white"}`}>
                <input type="radio" name="tipo_cuenta" value={tipo} checked={datos.tipo_cuenta === tipo} onChange={() => set("tipo_cuenta", tipo)} className="sr-only" />
                {tipo === "ahorros" ? "Ahorros" : "Corriente"}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium">Número de cuenta</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            value={datos.numero_cuenta}
            onChange={(e) => set("numero_cuenta", e.target.value.replace(/[^\d\s-]/g, ""))}
            placeholder="Solo números"
            className={`${CLASE_INPUT} mt-1`}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Titular de la cuenta</span>
          <input autoComplete="name" value={datos.titular} onChange={(e) => set("titular", e.target.value)} placeholder="Nombre completo" className={`${CLASE_INPUT} mt-1`} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Documento del titular</span>
          <input autoComplete="off" value={datos.documento_titular} onChange={(e) => set("documento_titular", e.target.value)} placeholder="Cédula o NIT" className={`${CLASE_INPUT} mt-1`} />
        </label>
      </div>
      {error ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      <button type="submit" disabled={enviando} className={`${CLASE_BOTON_PRIMARIO} w-full px-4 py-2.5 sm:w-auto`}>
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Guardar datos de pago
      </button>
    </form>
  );
}

function Aviso({ tono, icono: Icono, children }: { tono: "exito" | "espera"; icono: typeof Banknote; children: ReactNode }) {
  const clase = tono === "exito"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
    : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200";
  return (
    <div role="status" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${clase}`}>
      <Icono className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function EstadoRecompensa({ participacion, cotizacionesGratis, onCambio }: { participacion: Participacion; cotizacionesGratis: number; onCambio: () => void }) {
  const { ronda, cuenta } = participacion;
  switch (participacion.estado_recompensa) {
    case "reclamable":
      return <ElegirRecompensa participacion={participacion} onCambio={onCambio} />;
    case "solicitada":
      if (!cuenta) return <FormCuenta participacion={participacion} onCambio={onCambio} />;
      return (
        <Aviso tono="espera" icono={Clock}>
          <p className="font-semibold">Recibimos tus datos. El pago sale en máximo 5 días hábiles.</p>
          <p>Te vamos a transferir {pesos(ronda.recompensa_cop)} a tu cuenta {cuenta.banco} ({cuenta.tipo_cuenta}) terminada en {cuenta.ultimos_digitos}. Te avisamos con la referencia apenas salga.</p>
        </Aviso>
      );
    case "pagada":
      if (participacion.eleccion === "cotizaciones") {
        return (
          <Aviso tono="exito" icono={Ticket}>
            <p className="font-semibold">Te acreditamos {ronda.recompensa_cotizaciones} cotizaciones gratis.</p>
            <p>Tenés {cotizacionesGratis} cotizaciones gratis disponibles.</p>
          </Aviso>
        );
      }
      return (
        <Aviso tono="exito" icono={BadgeCheck}>
          <p className="font-semibold">
            Te transferimos {pesos(ronda.recompensa_cop)}{cuenta ? ` a tu cuenta ${cuenta.banco} terminada en ${cuenta.ultimos_digitos}` : ""}.
          </p>
          {participacion.referencia_pago ? <p>Referencia {participacion.referencia_pago}</p> : null}
          {participacion.pagado_en ? <p className="text-xs opacity-80">{fechaBogota(participacion.pagado_en)}</p> : null}
        </Aviso>
      );
    default: {
      const faltan = Math.max(participacion.umbral - participacion.aprobados, 0);
      return (
        <p className="text-sm text-muted-foreground">
          Te {faltan === 1 ? "falta 1 producto aprobado" : `faltan ${faltan} productos aprobados`} para reclamar {pesos(ronda.recompensa_cop)} o {ronda.recompensa_cotizaciones} cotizaciones gratis.
        </p>
      );
    }
  }
}

function PanelParticipante({
  participacion,
  cotizacionesGratis,
  exclusiones,
  onEnviarEnlace,
  onCambio,
}: {
  participacion: Participacion;
  cotizacionesGratis: number;
  exclusiones: string;
  onEnviarEnlace: () => void;
  onCambio: () => void;
}) {
  const { ronda } = participacion;
  const activa = ronda.estado !== "cerrada" && !vencida(ronda);
  const pct = participacion.umbral > 0 ? Math.min(100, (participacion.aprobados / participacion.umbral) * 100) : 0;

  return (
    <section className={`${CLASE_TARJETA} space-y-5 sm:p-6`} aria-labelledby="reto-mi-avance">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estás en {ronda.nombre}</p>
          <h2 id="reto-mi-avance" className="mt-0.5 text-2xl font-bold">
            Llevás {participacion.aprobados} de {participacion.umbral}
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {activa ? `La ronda cierra el ${fechaBogota(ronda.fecha_limite)}` : `La ronda cerró el ${fechaBogota(ronda.fecha_limite, false)}`}
          </p>
        </div>
        {activa ? (
          <button type="button" onClick={onEnviarEnlace} className={`${CLASE_BOTON_PRIMARIO} px-4 py-2`}>
            <Upload className="h-4 w-4" /> Subir un enlace
          </button>
        ) : null}
      </div>

      <div>
        <div
          className="h-3 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={participacion.umbral}
          aria-valuenow={Math.min(participacion.aprobados, participacion.umbral)}
          aria-label="Productos aprobados"
        >
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">Solo cuentan los productos aprobados. Te avisamos cada vez que revisamos uno.</p>
      </div>

      <EstadoRecompensa participacion={participacion} cotizacionesGratis={cotizacionesGratis} onCambio={onCambio} />

      {activa && exclusiones ? (
        <p className="flex items-start gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {exclusiones}
        </p>
      ) : null}
    </section>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────

const PASOS = [
  { icono: Users, titulo: "Inscribite", texto: "Los cupos son limitados y hay uno por persona." },
  { icono: Search, titulo: "Subí enlaces", texto: "Videos de TikTok, Instagram o YouTube con productos que se estén haciendo virales." },
  { icono: Trophy, titulo: "Reclamá", texto: "Cuando te aprobamos los necesarios, elegís efectivo o cotizaciones gratis." },
];

export function RetoPagina({
  autenticado,
  onIrARegistro,
  onEnviarEnlace,
}: {
  autenticado: boolean;
  onIrARegistro: () => void;
  onEnviarEnlace: () => void;
}) {
  const [ronda, setRonda] = useState<Ronda | null>(null);
  const [exclusiones, setExclusiones] = useState("");
  const [cargandoRonda, setCargandoRonda] = useState(true);
  const [errorRonda, setErrorRonda] = useState<string | null>(null);
  const [participacion, setParticipacion] = useState<Participacion | null>(null);
  const [cotizacionesGratis, setCotizacionesGratis] = useState(0);
  const [cargandoParticipacion, setCargandoParticipacion] = useState(false);
  const [inscribiendo, setInscribiendo] = useState(false);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  const cargarRonda = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargandoRonda(true);
    try {
      const datos = await retoService.rondaAbierta();
      if (!montado.current) return;
      setRonda(datos.ronda);
      setExclusiones(datos.exclusiones || datos.ronda?.exclusiones || "");
      setErrorRonda(null);
    } catch (err) {
      if (montado.current && !silencioso) setErrorRonda(mensajeError(err, "No pudimos cargar el reto."));
    } finally {
      if (montado.current && !silencioso) setCargandoRonda(false);
    }
  }, []);

  const cargarParticipacion = useCallback(async () => {
    if (!autenticado) {
      setParticipacion(null);
      setCotizacionesGratis(0);
      return;
    }
    setCargandoParticipacion(true);
    try {
      const datos = await retoService.miParticipacion();
      if (!montado.current) return;
      setParticipacion(datos.participacion);
      setCotizacionesGratis(datos.cotizaciones_gratis ?? 0);
    } catch {
      // Sin sesión válida o error de red: se muestra la vista pública.
    } finally {
      if (montado.current) setCargandoParticipacion(false);
    }
  }, [autenticado]);

  // Contador en vivo: al cargar y cada 30 s mientras la página está abierta.
  useEffect(() => {
    void cargarRonda();
    const intervalo = window.setInterval(() => { void cargarRonda(true); }, REFRESCO_MS);
    return () => window.clearInterval(intervalo);
  }, [cargarRonda]);

  useEffect(() => { void cargarParticipacion(); }, [cargarParticipacion]);

  const refrescarTodo = useCallback(() => {
    void cargarParticipacion();
    void cargarRonda(true);
  }, [cargarParticipacion, cargarRonda]);

  const inscribirme = async () => {
    if (!autenticado) {
      onIrARegistro();
      return;
    }
    if (!ronda) return;
    setInscribiendo(true);
    try {
      const nueva = await retoService.inscribirme(ronda.id);
      setParticipacion(nueva);
      toast.success(`¡Listo! Ya estás en ${ronda.nombre}. Subí tu primer enlace.`);
      refrescarTodo();
    } catch (err) {
      // 409: se llenó o cerró mientras tanto; se recarga para mostrar el estado real.
      toast.error(mensajeError(err, "No pudimos inscribirte. Probá de nuevo."));
      void cargarRonda(true);
    } finally {
      setInscribiendo(false);
    }
  };

  // Se ofrece inscribirse si no participa, si su participación es de una ronda que ya terminó,
  // o si ya llegó al umbral (una recompensa por ronda) y hay otra ronda abierta.
  const puedeInscribirse = !participacion || participacion.ronda.estado === "cerrada" || vencida(participacion.ronda)
    || (participacion.estado_recompensa !== "pendiente" && !!ronda && ronda.id !== participacion.ronda.id);
  const cerrada = sinCupos(ronda);
  const referencia = ronda ?? participacion?.ronda ?? null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <section className="overflow-hidden rounded-2xl bg-primary p-5 text-white shadow-sm sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-[#0f0f0f]">
          <Trophy className="h-3.5 w-3.5" /> Reto Tendencias
        </span>
        <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-4xl">
          ¿Sabías que te pagamos por subirnos los productos más virales que encontrés?
        </h1>
        <p className="mt-3 text-base text-white/85 sm:text-lg">
          {referencia ? (
            <>
              Por cada {referencia.umbral_aprobados} productos aprobados, reclamás{" "}
              <strong className="font-semibold text-accent">{pesos(referencia.recompensa_cop)}</strong> (o{" "}
              {referencia.recompensa_cotizaciones} cotizaciones gratis).
            </>
          ) : (
            "Juntá productos aprobados y reclamá tu recompensa en efectivo o en cotizaciones gratis."
          )}
        </p>

        <div className="mt-5">
          {cargandoRonda ? (
            <p className="flex items-center gap-2 text-sm text-white/80"><Loader2 className="h-4 w-4 animate-spin" /> Consultando cupos...</p>
          ) : errorRonda ? (
            <p role="alert" className="flex items-center gap-2 text-sm text-white/90">
              <AlertTriangle className="h-4 w-4" /> {errorRonda}
              <button type="button" onClick={() => void cargarRonda()} className="underline underline-offset-2">Reintentar</button>
            </p>
          ) : ronda ? (
            <Cupos ronda={ronda} />
          ) : (
            <p className="rounded-xl bg-white/10 p-4 text-sm ring-1 ring-white/15">
              No hay una ronda abierta en este momento. Dejanos tu correo y te avisamos de la próxima.
            </p>
          )}
        </div>
      </section>

      {autenticado && cotizacionesGratis > 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-accent bg-accent/20 px-4 py-2.5 text-sm font-medium">
          <Ticket className="h-4 w-4 shrink-0 text-primary dark:text-accent" /> Tenés {cotizacionesGratis} {cotizacionesGratis === 1 ? "cotización gratis disponible" : "cotizaciones gratis disponibles"}.
        </p>
      ) : null}

      {autenticado && cargandoParticipacion && !participacion ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando tu avance...</p>
      ) : null}

      {participacion ? (
        <PanelParticipante
          participacion={participacion}
          cotizacionesGratis={cotizacionesGratis}
          exclusiones={exclusiones}
          onEnviarEnlace={onEnviarEnlace}
          onCambio={refrescarTodo}
        />
      ) : null}

      {puedeInscribirse && !cargandoRonda && !errorRonda ? (
        <section className={`${CLASE_TARJETA} space-y-5 sm:p-6`} aria-labelledby="reto-como-funciona">
          <h2 id="reto-como-funciona" className="text-lg font-semibold">Cómo funciona</h2>
          <ol className="grid gap-3 sm:grid-cols-3">
            {PASOS.map(({ icono: Icono, titulo, texto }, i) => (
              <li key={titulo} className="rounded-xl bg-muted/40 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-white">{i + 1}</span>
                  <Icono className="h-4 w-4 text-primary dark:text-accent" /> {titulo}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
              </li>
            ))}
          </ol>

          {exclusiones ? (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {exclusiones}
            </p>
          ) : null}

          {cerrada ? (
            <AvisameProxima />
          ) : (
            <div className="space-y-2">
              <button type="button" onClick={inscribirme} disabled={inscribiendo} className={`${CLASE_BOTON_ACENTO} w-full sm:w-auto`}>
                {inscribiendo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Link2 className="h-5 w-5" />} Inscribirme
              </button>
              {!autenticado ? (
                <p className="text-xs text-muted-foreground">Necesitás una cuenta gratis de Zarpi para inscribirte.</p>
              ) : null}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
