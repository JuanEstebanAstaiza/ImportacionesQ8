import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  Coins,
  ExternalLink,
  FileText,
  GraduationCap,
  Inbox,
  Landmark,
  Loader2,
  RefreshCw,
  Save,
  X,
} from "lucide-react";

import { ImagenArchivo } from "@/app/components/files/ImagenArchivo";
import { abrirArchivoEnPestana } from "@/lib/abrir-archivo";
import {
  comprobantesService,
  type Comprobante,
  type ConfigPagos,
  type EstadoComprobante,
  type TipoComprobante,
} from "@/services/comprobantes.service";

import {
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_INPUT,
  Contador,
  fechaCorta,
  haceCuanto,
  mensajeError,
} from "../tendencias/AprobacionComun";

/**
 * Revisión de comprobantes de transferencia mientras se habilita la pasarela.
 * El admin abre el comprobante, confirma cuánto acredita (tokens o días de
 * Tendencias) o, si es un curso, le da el acceso; o lo rechaza con un motivo
 * que el usuario ve.
 */

const MAX_DATOS_PAGO = 2000;

const TIPO: Record<TipoComprobante, { texto: string; clase: string }> = {
  tokens: { texto: "Tokens", clase: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  suscripcion: { texto: "Suscripción Tendencias", clase: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  curso: { texto: "Curso", clase: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  reto: { texto: "Pago del reto", clase: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
};

const ESTADO: Record<EstadoComprobante, { texto: string; clase: string }> = {
  pendiente: { texto: "Por revisar", clase: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  aprobado: { texto: "Aprobado", clase: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  rechazado: { texto: "Rechazado", clase: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  enviado: { texto: "Enviado", clase: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
};

function pesos(valor: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);
}

function Insignia({ texto, clase }: { texto: string; clase: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${clase}`}>{texto}</span>;
}

function nombreUsuario(c: Comprobante): string {
  return c.usuario?.nombre || c.usuario?.email || "Usuario";
}

/** «10 tokens» / «30 días» según el tipo. */
function cantidadTexto(tipo: TipoComprobante, n: number): string {
  if (tipo === "suscripcion") return `${n} ${n === 1 ? "día" : "días"}`;
  return `${n} ${n === 1 ? "token" : "tokens"}`;
}

async function verComprobante(c: Comprobante) {
  const resultado = await abrirArchivoEnPestana(c.archivo.url, c.archivo.nombre ?? undefined);
  if (!resultado.ok) toast.error(resultado.motivo ?? "No se pudo abrir el comprobante.");
}

function EstadoCarga({ error, cargando, onReintentar, textoCarga }: { error: string | null; cargando: boolean; onReintentar: () => void; textoCarga: string }) {
  if (error) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
        <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        <button type="button" onClick={onReintentar} className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
          <RefreshCw className="h-3.5 w-3.5" /> Reintentar
        </button>
      </div>
    );
  }
  if (cargando) {
    return <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {textoCarga}</p>;
  }
  return null;
}

function Vacio({ texto }: { texto: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">
      <Inbox className="h-6 w-6" />
      <p>{texto}</p>
    </div>
  );
}

/** Miniatura del comprobante: la imagen si lo es; si no, un ícono de PDF. */
function Miniatura({ c }: { c: Comprobante }) {
  return (
    <button
      type="button"
      onClick={() => void verComprobante(c)}
      className="group relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-muted"
      title="Ver comprobante"
    >
      {c.archivo.tipo_recurso === "imagen" ? (
        <ImagenArchivo src={c.archivo.url} alt={`Comprobante de ${nombreUsuario(c)}`} className="h-full w-full" />
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
          <FileText className="h-7 w-7" />
          <span className="text-[10px] font-semibold uppercase">PDF</span>
        </span>
      )}
      <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-white group-hover:flex">
        <ExternalLink className="h-4 w-4" />
      </span>
    </button>
  );
}

// ── Por revisar ──────────────────────────────────────────────────────────────

function TarjetaPendiente({
  c,
  precioToken,
  onResuelto,
}: {
  c: Comprobante;
  precioToken: number | null;
  onResuelto: (resuelto: Comprobante) => void;
}) {
  const esSuscripcion = c.tipo === "suscripcion";
  const esCurso = c.tipo === "curso";
  const [modo, setModo] = useState<"aprobar" | "rechazar" | null>(null);
  const [cantidad, setCantidad] = useState(() => String((esSuscripcion ? c.cantidad_solicitada ?? 30 : c.cantidad_solicitada) ?? ""));
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tipo = TIPO[c.tipo] ?? { texto: c.tipo, clase: "bg-muted text-muted-foreground" };
  // Lo que alcanza el monto declarado al precio actual: solo orienta, no se aplica solo.
  const tokensPorMonto = c.tipo === "tokens" && c.monto_cop && precioToken ? Math.floor(c.monto_cop / precioToken) : null;

  const abrir = (nuevo: "aprobar" | "rechazar") => {
    setModo(modo === nuevo ? null : nuevo);
    setError(null);
  };

  const aprobar = async () => {
    if (esCurso) {
      setEnviando(true);
      setError(null);
      try {
        const resuelto = await comprobantesService.aprobar(c.id);
        toast.success(`${nombreUsuario(c)} ya tiene acceso a «${c.curso?.titulo ?? "el curso"}»`);
        onResuelto(resuelto);
      } catch (err) {
        setError(mensajeError(err, "No se pudo aprobar el comprobante."));
      } finally {
        setEnviando(false);
      }
      return;
    }
    const n = Math.floor(Number(cantidad));
    if (!Number.isFinite(n) || n < 1) {
      setError(esSuscripcion ? "Escribe cuántos días (mínimo 1)." : "Escribe cuántos tokens (mínimo 1).");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const resuelto = await comprobantesService.aprobar(c.id, n);
      toast.success(esSuscripcion
        ? `${cantidadTexto("suscripcion", n)} de Tendencias para ${nombreUsuario(c)}`
        : `+${cantidadTexto("tokens", n)} para ${nombreUsuario(c)}`);
      onResuelto(resuelto);
    } catch (err) {
      setError(mensajeError(err, "No se pudo aprobar el comprobante."));
    } finally {
      setEnviando(false);
    }
  };

  const rechazar = async () => {
    if (motivo.trim().length < 3) {
      setError("Escribe el motivo (mínimo 3 caracteres). El usuario lo verá.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const resuelto = await comprobantesService.rechazar(c.id, motivo.trim());
      toast.success(`Comprobante de ${nombreUsuario(c)} rechazado`);
      onResuelto(resuelto);
    } catch (err) {
      setError(mensajeError(err, "No se pudo rechazar el comprobante."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <li className="rounded-xl border border-border bg-white p-3 shadow-sm sm:p-4">
      <div className="flex gap-3">
        <Miniatura c={c} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{nombreUsuario(c)}</p>
              {c.usuario?.nombre && c.usuario.email ? <p className="truncate text-xs text-muted-foreground">{c.usuario.email}</p> : null}
            </div>
            <Insignia texto={tipo.texto} clase={tipo.clase} />
          </div>
          {esCurso ? (
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <GraduationCap className="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="min-w-0 truncate">{c.curso?.titulo ?? "Curso eliminado"}</span>
            </p>
          ) : null}
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {esCurso ? null : <>
            <div>
              <dt className="inline text-muted-foreground">Saldo: </dt>
              <dd className="inline font-medium tabular-nums">{cantidadTexto("tokens", c.usuario?.tokens ?? 0)}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Pide: </dt>
              <dd className="inline font-medium tabular-nums">
                {c.cantidad_solicitada != null ? cantidadTexto(c.tipo, c.cantidad_solicitada) : "—"}
              </dd>
            </div>
            </>}
            <div>
              <dt className="inline text-muted-foreground">{esCurso ? "Valor del curso: " : "Monto: "}</dt>
              <dd className="inline font-medium tabular-nums">{c.monto_cop != null ? pesos(c.monto_cop) : "—"}</dd>
            </div>
            <div className="text-muted-foreground" title={new Date(c.fecha).toLocaleString("es-CO")}>
              {fechaCorta(c.fecha)} · {haceCuanto(c.fecha)}
            </div>
          </dl>
          {c.nota ? <p className="whitespace-pre-line rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs">«{c.nota}»</p> : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => void verComprobante(c)} className={`${CLASE_BOTON_SECUNDARIO} mr-auto`}>
          <ExternalLink className="h-3.5 w-3.5" /> Ver comprobante
        </button>
        <button
          type="button"
          onClick={() => abrir("rechazar")}
          aria-expanded={modo === "rechazar"}
          className={`${CLASE_BOTON_SECUNDARIO} text-rose-700 dark:text-rose-400`}
        >
          <X className="h-3.5 w-3.5" /> Rechazar
        </button>
        <button type="button" onClick={() => abrir("aprobar")} aria-expanded={modo === "aprobar"} className={CLASE_BOTON_PRIMARIO}>
          <Check className="h-3.5 w-3.5" /> Aprobar
        </button>
      </div>

      {modo === "aprobar" && esCurso ? (
        <form
          onSubmit={(e) => { e.preventDefault(); void aprobar(); }}
          className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-muted/40 p-3"
          noValidate
        >
          <p className="min-w-0 flex-1 text-sm">
            ¿Confirmaste la transferencia? {nombreUsuario(c)} queda con acceso al curso y le avisamos por correo desde pagos@.
          </p>
          <button type="button" onClick={() => setModo(null)} className={CLASE_BOTON_SECUNDARIO}>Cancelar</button>
          <button type="submit" disabled={enviando} className={CLASE_BOTON_PRIMARIO}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Dar acceso
          </button>
        </form>
      ) : modo === "aprobar" ? (
        <form
          onSubmit={(e) => { e.preventDefault(); void aprobar(); }}
          className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-muted/40 p-3"
          noValidate
        >
          <label className="text-sm">
            <span className="font-medium">{esSuscripcion ? "Días de suscripción" : "Tokens a acreditar"}</span>
            <input
              type="number"
              min={1}
              step={1}
              autoFocus
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className={`${CLASE_INPUT} mt-1 w-32`}
            />
          </label>
          <button type="submit" disabled={enviando} className={CLASE_BOTON_PRIMARIO}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar
          </button>
          <button type="button" onClick={() => setModo(null)} className={CLASE_BOTON_SECUNDARIO}>Cancelar</button>
          <p className="w-full text-xs text-muted-foreground">
            {esSuscripcion
              ? "Se suman a la suscripción vigente del usuario."
              : `Cada cotización cuesta 1 token.${tokensPorMonto != null ? ` Al precio actual, ${pesos(c.monto_cop ?? 0)} alcanza para ${cantidadTexto("tokens", tokensPorMonto)}.` : ""}`}
          </p>
        </form>
      ) : null}

      {modo === "rechazar" ? (
        <form
          onSubmit={(e) => { e.preventDefault(); void rechazar(); }}
          className="mt-3 space-y-2 rounded-lg bg-muted/40 p-3"
          noValidate
        >
          <label className="block text-sm">
            <span className="font-medium">Motivo del rechazo</span>
            <textarea
              autoFocus
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Ej. El monto no coincide con la transferencia recibida."
              className={`${CLASE_INPUT} mt-1 resize-y`}
            />
          </label>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-xs text-muted-foreground">El usuario verá este motivo.</span>
            <button type="button" onClick={() => setModo(null)} className={CLASE_BOTON_SECUNDARIO}>Cancelar</button>
            <button
              type="submit"
              disabled={enviando}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Rechazar
            </button>
          </div>
        </form>
      ) : null}

      {error ? <p role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
    </li>
  );
}

function PorRevisar({
  pendientes,
  error,
  precioToken,
  onReintentar,
  onResuelto,
}: {
  pendientes: Comprobante[] | null;
  error: string | null;
  precioToken: number | null;
  onReintentar: () => void;
  onResuelto: (resuelto: Comprobante) => void;
}) {
  if (error || pendientes === null) {
    return <EstadoCarga error={error} cargando={pendientes === null} onReintentar={onReintentar} textoCarga="Cargando comprobantes..." />;
  }
  if (pendientes.length === 0) return <Vacio texto="No hay comprobantes por revisar. Todo al día." />;
  return (
    <ul className="space-y-3">
      {pendientes.map((c) => (
        <TarjetaPendiente key={c.id} c={c} precioToken={precioToken} onResuelto={onResuelto} />
      ))}
    </ul>
  );
}

// ── Historial ────────────────────────────────────────────────────────────────

type FiltroEstado = "aprobado" | "rechazado" | "enviado" | "todos";
type FiltroTipo = TipoComprobante | "todos";

const FILTROS_ESTADO: { clave: FiltroEstado; texto: string }[] = [
  { clave: "aprobado", texto: "Aprobados" },
  { clave: "rechazado", texto: "Rechazados" },
  { clave: "enviado", texto: "Enviados" },
  { clave: "todos", texto: "Todos" },
];

const FILTROS_TIPO: { clave: FiltroTipo; texto: string }[] = [
  { clave: "todos", texto: "Todos los tipos" },
  { clave: "tokens", texto: "Tokens" },
  { clave: "suscripcion", texto: "Suscripción Tendencias" },
  { clave: "curso", texto: "Cursos" },
  { clave: "reto", texto: "Pagos del reto" },
];

function Resultado({ c }: { c: Comprobante }) {
  if (c.estado === "rechazado") {
    return <p className="text-xs text-rose-700 dark:text-rose-300">Motivo: {c.motivo_rechazo || "—"}</p>;
  }
  if (c.estado === "aprobado" && c.tipo === "curso") {
    return (
      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
        Acceso a «{c.curso?.titulo ?? "curso"}»
      </p>
    );
  }
  if (c.estado === "aprobado") {
    const n = c.cantidad_acreditada ?? 0;
    return (
      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
        {c.tipo === "suscripcion" ? cantidadTexto("suscripcion", n) : `+${cantidadTexto("tokens", n)}`}
      </p>
    );
  }
  if (c.estado === "enviado") return <p className="text-xs text-muted-foreground">Visible para el participante</p>;
  return <p className="text-xs text-amber-700 dark:text-amber-300">Por revisar</p>;
}

function Historial() {
  const [estado, setEstado] = useState<FiltroEstado>("aprobado");
  const [tipo, setTipo] = useState<FiltroTipo>("todos");
  const [lista, setLista] = useState<Comprobante[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLista(null);
    setError(null);
    try {
      const datos = await comprobantesService.paraAdmin({
        estado: estado === "todos" ? undefined : estado,
        tipo: tipo === "todos" ? undefined : tipo,
      });
      // Lo más reciente primero.
      setLista([...datos].sort((a, b) => (b.revisado_en ?? b.fecha).localeCompare(a.revisado_en ?? a.fecha)));
    } catch (err) {
      setError(mensajeError(err, "No se pudo cargar el historial."));
    }
  }, [estado, tipo]);

  useEffect(() => { void cargar(); }, [cargar]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Filtrar por estado">
          {FILTROS_ESTADO.map((f) => (
            <button
              key={f.clave}
              type="button"
              role="radio"
              aria-checked={estado === f.clave}
              onClick={() => setEstado(f.clave)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                estado === f.clave
                  ? "border-primary bg-primary text-white dark:border-accent dark:bg-accent dark:text-accent-foreground"
                  : "border-border bg-white text-foreground hover:bg-muted"
              }`}
            >
              {f.texto}
            </button>
          ))}
        </div>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as FiltroTipo)}
          aria-label="Filtrar por tipo"
          className={`${CLASE_INPUT} w-auto sm:ml-auto`}
        >
          {FILTROS_TIPO.map((f) => <option key={f.clave} value={f.clave}>{f.texto}</option>)}
        </select>
      </div>

      {error || lista === null ? (
        <EstadoCarga error={error} cargando={lista === null} onReintentar={() => void cargar()} textoCarga="Cargando historial..." />
      ) : lista.length === 0 ? (
        <Vacio texto="No hay comprobantes con estos filtros." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          {lista.map((c) => {
            const t = TIPO[c.tipo] ?? { texto: c.tipo, clase: "bg-muted text-muted-foreground" };
            const e = ESTADO[c.estado] ?? { texto: c.estado, clase: "bg-muted text-muted-foreground" };
            return (
              <li key={c.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{nombreUsuario(c)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Insignia texto={t.texto} clase={t.clase} />
                    <Insignia texto={e.texto} clase={e.clase} />
                    <span>{fechaCorta(c.fecha)}</span>
                    {c.revisado_en ? <span>· revisado {fechaCorta(c.revisado_en)}</span> : null}
                    {c.monto_cop != null ? <span>· {pesos(c.monto_cop)}</span> : null}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:max-w-[45%] sm:justify-end">
                  <div className="min-w-0 sm:text-right"><Resultado c={c} /></div>
                  <button type="button" onClick={() => void verComprobante(c)} className={CLASE_BOTON_SECUNDARIO} title="Ver comprobante">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Configuración ────────────────────────────────────────────────────────────

function Configuracion({ onGuardada }: { onGuardada: (config: ConfigPagos) => void }) {
  const [precio, setPrecio] = useState("");
  const [datos, setDatos] = useState("");
  const [cargado, setCargado] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargado(false);
    setErrorCarga(null);
    try {
      const config = await comprobantesService.config();
      setPrecio(config.precio_token_cop != null ? String(config.precio_token_cop) : "");
      setDatos(config.datos_pago ?? "");
      setCargado(true);
    } catch (err) {
      setErrorCarga(mensajeError(err, "No se pudo cargar la configuración."));
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const precioNum = precio.trim() === "" ? null : Math.floor(Number(precio));

  const guardar = async () => {
    if (precioNum !== null && (!Number.isFinite(precioNum) || precioNum < 1)) {
      setError("El precio debe ser un número mayor que 0.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const guardada = await comprobantesService.guardarConfig({
        precio_token_cop: precioNum,
        datos_pago: datos.trim() || null,
      });
      onGuardada(guardada);
      toast.success("Configuración de pagos guardada");
    } catch (err) {
      setError(mensajeError(err, "No se pudo guardar la configuración."));
    } finally {
      setGuardando(false);
    }
  };

  if (!cargado) {
    return <EstadoCarga error={errorCarga} cargando onReintentar={() => void cargar()} textoCarga="Cargando configuración..." />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,300px)]">
      <form
        onSubmit={(e) => { e.preventDefault(); void guardar(); }}
        className="space-y-4 rounded-xl border border-border bg-white p-4 shadow-sm"
        noValidate
      >
        <label className="block text-sm">
          <span className="font-medium">Precio por token de cotización (COP)</span>
          <input
            type="number"
            min={1}
            step={100}
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="Ej. 15000"
            className={`${CLASE_INPUT} mt-1 sm:w-48`}
          />
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {precioNum && precioNum > 0 ? `${pesos(precioNum)} por token. ` : ""}Cada cotización cuesta 1 token.
          </span>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Datos para transferir</span>
          <textarea
            value={datos}
            onChange={(e) => setDatos(e.target.value)}
            maxLength={MAX_DATOS_PAGO}
            rows={6}
            placeholder={"Bancolombia · Cuenta de ahorros\nN.º 000-000000-00\nTitular: Zarpi S.A.S.\nNIT 900.000.000-0"}
            className={`${CLASE_INPUT} mt-1 resize-y`}
          />
          <span className="mt-0.5 flex justify-between gap-2 text-xs text-muted-foreground">
            <span>Banco, tipo y número de cuenta, titular y NIT.</span>
            <span className="tabular-nums">{datos.length}/{MAX_DATOS_PAGO}</span>
          </span>
        </label>
        {error ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
        <div className="flex justify-end">
          <button type="submit" disabled={guardando} className={CLASE_BOTON_PRIMARIO}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
          </button>
        </div>
      </form>

      <aside aria-label="Vista previa para el usuario" className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Así lo ve el usuario</p>
        <div className="space-y-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-semibold"><Landmark className="h-4 w-4 text-primary dark:text-accent" /> Transfiere a</p>
          {datos.trim() ? (
            <p className="whitespace-pre-line break-words rounded-lg bg-muted/50 p-3 text-sm">{datos.trim()}</p>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">Todavía no hay datos de pago.</p>
          )}
          <p className="text-xs text-muted-foreground">
            {precioNum && precioNum > 0 ? <><strong className="text-foreground">{pesos(precioNum)}</strong> por token · </> : null}
            1 token = 1 cotización. Sube el comprobante y lo revisamos.
          </p>
        </div>
      </aside>
    </div>
  );
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

type Pestana = "revisar" | "historial" | "config";

function esDeEsteMes(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const hoy = new Date();
  return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth();
}

export function RevisionPagos() {
  const [pestana, setPestana] = useState<Pestana>("revisar");
  const [pendientes, setPendientes] = useState<Comprobante[] | null>(null);
  const [errorPendientes, setErrorPendientes] = useState<string | null>(null);
  const [aprobados, setAprobados] = useState<Comprobante[] | null>(null);
  const [precioToken, setPrecioToken] = useState<number | null>(null);

  const cargarPendientes = useCallback(async () => {
    setPendientes(null);
    setErrorPendientes(null);
    try {
      const datos = await comprobantesService.paraAdmin({ estado: "pendiente" });
      // El más antiguo primero: se atiende por orden de llegada.
      setPendientes([...datos].sort((a, b) => a.fecha.localeCompare(b.fecha)));
    } catch (err) {
      setErrorPendientes(mensajeError(err, "No se pudieron cargar los comprobantes."));
    }
  }, []);

  const cargarResumen = useCallback(async () => {
    // Contador del mes y precio para orientar: si fallan, la pantalla sigue sirviendo.
    const [aprob, config] = await Promise.allSettled([
      comprobantesService.paraAdmin({ estado: "aprobado" }),
      comprobantesService.config(),
    ]);
    if (aprob.status === "fulfilled") setAprobados(aprob.value);
    if (config.status === "fulfilled") setPrecioToken(config.value.precio_token_cop);
  }, []);

  useEffect(() => {
    void cargarPendientes();
    void cargarResumen();
  }, [cargarPendientes, cargarResumen]);

  const resuelto = (c: Comprobante) => {
    setPendientes((lista) => (lista ?? []).filter((p) => p.id !== c.id));
    if (c.estado === "aprobado") setAprobados((lista) => (lista ? [c, ...lista.filter((a) => a.id !== c.id)] : lista));
  };

  const contadores = useMemo(() => ({
    tokens: pendientes ? pendientes.filter((c) => c.tipo === "tokens").length : null,
    suscripcion: pendientes ? pendientes.filter((c) => c.tipo === "suscripcion").length : null,
    curso: pendientes ? pendientes.filter((c) => c.tipo === "curso").length : null,
    mes: aprobados ? aprobados.filter((c) => esDeEsteMes(c.revisado_en ?? c.fecha)).length : null,
  }), [pendientes, aprobados]);

  const pestanas: { clave: Pestana; etiqueta: string }[] = [
    { clave: "revisar", etiqueta: `Por revisar${pendientes ? ` (${pendientes.length})` : ""}` },
    { clave: "historial", etiqueta: "Historial" },
    { clave: "config", etiqueta: "Configuración" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Pagos</h1>
          <p className="text-sm text-muted-foreground">
            Comprobantes de transferencia: revísalos y acredita tokens, suscripción o el acceso a un curso. Mientras habilitamos la pasarela.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void cargarPendientes(); void cargarResumen(); }}
          className={CLASE_BOTON_SECUNDARIO}
          title="Actualizar"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Contador etiqueta="Tokens por revisar" valor={contadores.tokens} icono={Coins} clase="bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" />
        <Contador etiqueta="Suscripciones por revisar" valor={contadores.suscripcion} icono={CalendarClock} clase="bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" />
        <Contador etiqueta="Cursos por revisar" valor={contadores.curso} icono={GraduationCap} clase="bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" />
        <Contador etiqueta="Aprobados este mes" valor={contadores.mes} icono={CheckCircle2} clase="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" />
      </div>

      <div role="tablist" aria-label="Secciones de pagos" className="flex flex-wrap gap-2 border-b border-border pb-2">
        {pestanas.map((p) => (
          <button
            key={p.clave}
            id={`pagos-pestana-${p.clave}`}
            type="button"
            role="tab"
            aria-selected={pestana === p.clave}
            aria-controls={`pagos-panel-${p.clave}`}
            onClick={() => setPestana(p.clave)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
              pestana === p.clave
                ? "bg-primary text-white dark:bg-accent dark:text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      <div id={`pagos-panel-${pestana}`} role="tabpanel" aria-labelledby={`pagos-pestana-${pestana}`}>
        {pestana === "revisar" ? (
          <PorRevisar
            pendientes={pendientes}
            error={errorPendientes}
            precioToken={precioToken}
            onReintentar={() => void cargarPendientes()}
            onResuelto={resuelto}
          />
        ) : pestana === "historial" ? (
          <Historial />
        ) : (
          <Configuracion onGuardada={(config) => setPrecioToken(config.precio_token_cop)} />
        )}
      </div>
    </div>
  );
}
