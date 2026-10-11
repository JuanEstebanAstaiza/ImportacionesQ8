import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AlertTriangle, GraduationCap, Inbox, Loader2, RefreshCw, Search, Trash2, UserPlus } from "lucide-react";

import {
  accesoCursosService,
  type AccesoCurso,
  type CursoCatalogo,
  type OrigenAccesoCurso,
} from "@/services/acceso-cursos.service";

import {
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_INPUT,
  fechaCorta,
  mensajeError,
} from "../tendencias/AprobacionComun";

/**
 * Accesos a cursos: mientras no hay pasarela, el equipo da (o quita) el acceso
 * a un curso a mano cuando confirma el pago por fuera. Los comprobantes que
 * suben los usuarios se aprueban en Pagos y también aparecen aquí.
 */

const ORIGEN: Record<OrigenAccesoCurso, { texto: string; clase: string }> = {
  manual: { texto: "Dado a mano", clase: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  comprobante: { texto: "Comprobante aprobado", clase: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  inscripcion: { texto: "Inscripción", clase: "bg-muted text-muted-foreground" },
};

function pesos(valor: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);
}

function DarAcceso({ cursos, cursoId, onCursoId, onDado }: {
  cursos: CursoCatalogo[];
  cursoId: string;
  onCursoId: (id: string) => void;
  onDado: (acceso: AccesoCurso) => void;
}) {
  const [email, setEmail] = useState("");
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const curso = cursos.find((c) => c.id === cursoId) ?? null;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!curso) { setError("Elige el curso."); return; }
    if (!email.trim()) { setError("Escribe el correo de la cuenta."); return; }
    setEnviando(true);
    setError(null);
    try {
      const acceso = await accesoCursosService.dar({ curso_id: curso.id, email: email.trim(), nota: nota.trim() || undefined });
      toast.success(`${acceso.usuario.email} ya tiene acceso a «${curso.titulo}»`);
      setEmail("");
      setNota("");
      onDado(acceso);
    } catch (err) {
      setError(mensajeError(err, "No se pudo dar el acceso."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={(e) => void enviar(e)} className="space-y-3 rounded-xl border border-border bg-white p-4 shadow-sm" noValidate>
      <p className="flex items-center gap-2 text-sm font-semibold"><UserPlus className="h-4 w-4 text-primary dark:text-accent" /> Dar acceso</p>
      <label className="block text-sm">
        <span className="font-medium">Curso</span>
        <select value={cursoId} onChange={(e) => onCursoId(e.target.value)} className={`${CLASE_INPUT} mt-1`}>
          <option value="">Elige un curso</option>
          {cursos.map((c) => <option key={c.id} value={c.id}>{c.titulo} · {pesos(c.precio)}</option>)}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium">Correo de la cuenta</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="persona@correo.com" className={`${CLASE_INPUT} mt-1`} />
        <span className="mt-0.5 block text-xs text-muted-foreground">La cuenta ya debe existir. Si no, créala primero en Usuarios.</span>
      </label>
      <label className="block text-sm">
        <span className="font-medium">Nota (opcional)</span>
        <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} placeholder="Ej. Transferencia confirmada el 10/10" className={`${CLASE_INPUT} mt-1`} />
      </label>
      {error ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      <button type="submit" disabled={enviando} className={`w-full ${CLASE_BOTON_PRIMARIO}`}>
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Dar acceso
      </button>
      <p className="text-xs text-muted-foreground">Le llega un correo desde pagos@ avisando que ya puede entrar al curso.</p>
    </form>
  );
}

function FilaAcceso({ acceso, onQuitado }: { acceso: AccesoCurso; onQuitado: (id: string) => void }) {
  const [confirmar, setConfirmar] = useState(false);
  const [quitando, setQuitando] = useState(false);
  const origen = ORIGEN[acceso.origen] ?? ORIGEN.inscripcion;

  const quitar = async () => {
    setQuitando(true);
    try {
      await accesoCursosService.quitar(acceso.id);
      toast.success(`Se quitó el acceso de ${acceso.usuario.email}`);
      onQuitado(acceso.id);
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo quitar el acceso."));
      setQuitando(false);
    }
  };

  return (
    <li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{acceso.usuario.nombre || acceso.usuario.email}</p>
        {acceso.usuario.nombre ? <p className="truncate text-xs text-muted-foreground">{acceso.usuario.email}</p> : null}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${origen.clase}`}>{origen.texto}</span>
          <span className="truncate">{acceso.curso.titulo}</span>
          {acceso.fecha ? <span>· {fechaCorta(acceso.fecha)}</span> : null}
          {acceso.otorgado_por ? <span>· por {acceso.otorgado_por}</span> : null}
        </div>
        {acceso.nota ? <p className="mt-1 text-xs text-muted-foreground">«{acceso.nota}»</p> : null}
      </div>
      {confirmar ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">¿Quitar el acceso?</span>
          <button type="button" onClick={() => setConfirmar(false)} className={CLASE_BOTON_SECUNDARIO}>No</button>
          <button
            type="button"
            onClick={() => void quitar()}
            disabled={quitando}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {quitando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Quitar
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmar(true)} className={`${CLASE_BOTON_SECUNDARIO} text-rose-700 dark:text-rose-400`}>
          <Trash2 className="h-3.5 w-3.5" /> Quitar acceso
        </button>
      )}
    </li>
  );
}

export function AccesosCursos() {
  const [cursos, setCursos] = useState<CursoCatalogo[]>([]);
  const [cursoId, setCursoId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [accesos, setAccesos] = useState<AccesoCurso[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    accesoCursosService.catalogo().then(setCursos).catch((err) => toast.error(mensajeError(err, "No se pudieron cargar los cursos.")));
  }, []);

  const cargar = useCallback(async () => {
    setAccesos(null);
    setError(null);
    try {
      setAccesos(await accesoCursosService.listar({ curso_id: cursoId || undefined }));
    } catch (err) {
      setError(mensajeError(err, "No se pudieron cargar los accesos."));
    }
  }, [cursoId]);

  useEffect(() => { void cargar(); }, [cargar]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!accesos || !q) return accesos;
    return accesos.filter((a) => a.usuario.email.toLowerCase().includes(q) || (a.usuario.nombre ?? "").toLowerCase().includes(q));
  }, [accesos, busqueda]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Accesos a cursos</h1>
          <p className="text-sm text-muted-foreground">
            Da acceso a un curso cuando confirmes el pago por fuera, o quítalo. Los comprobantes que suben los usuarios se aprueban en Pagos.
          </p>
        </div>
        <button type="button" onClick={() => void cargar()} className={CLASE_BOTON_SECUNDARIO} title="Actualizar">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <DarAcceso
          cursos={cursos}
          cursoId={cursoId}
          onCursoId={setCursoId}
          onDado={(acceso) => setAccesos((lista) => [acceso, ...(lista ?? []).filter((a) => a.id !== acceso.id)])}
        />

        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <GraduationCap className="h-4 w-4 text-primary dark:text-accent" />
              <span className="truncate">{cursos.find((c) => c.id === cursoId)?.titulo ?? "Todos los cursos"}</span>
              {accesos ? <span className="font-normal text-muted-foreground">· {accesos.length}</span> : null}
            </p>
            <label className="relative sm:ml-auto">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por correo o nombre"
                aria-label="Buscar por correo o nombre"
                className={`${CLASE_INPUT} w-full pl-8 sm:w-64`}
              />
            </label>
          </div>

          {error ? (
            <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
              <button type="button" onClick={() => void cargar()} className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
                <RefreshCw className="h-3.5 w-3.5" /> Reintentar
              </button>
            </div>
          ) : visibles === null ? (
            <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando accesos...</p>
          ) : visibles.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">
              <Inbox className="h-6 w-6" />
              <p>{busqueda.trim() ? "Nadie coincide con la búsqueda." : "Nadie tiene acceso todavía."}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              {visibles.map((a) => (
                <FilaAcceso key={a.id} acceso={a} onQuitado={(id) => setAccesos((lista) => (lista ?? []).filter((x) => x.id !== id))} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
