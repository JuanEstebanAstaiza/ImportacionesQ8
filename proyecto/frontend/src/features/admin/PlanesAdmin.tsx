import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, Inbox, Loader2, Pencil, Plus, RefreshCw, Save, X } from "lucide-react";

import { abrirArchivoEnPestana } from "@/lib/abrir-archivo";
import {
  planesService,
  pesos,
  type CamposPlan,
  type EstadoInscripcion,
  type InscripcionAdmin,
  type PlanAdmin,
} from "@/services/planes.service";

import {
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_INPUT,
  fechaCorta,
  mensajeError,
} from "../tendencias/AprobacionComun";

/**
 * Admin › Planes. Arriba, las inscripciones: se abre el comprobante, se confirma
 * el pago en el banco y se activa (crea la cuenta si no existe y acredita el
 * plan) o se rechaza con motivo, que le llega a la persona. Abajo, los planes
 * que se publican en el inicio: precio, IVA, lo que incluyen y los cupos.
 */

const PESTANAS: { estado: EstadoInscripcion; texto: string }[] = [
  { estado: "pendiente", texto: "Por activar" },
  { estado: "lista_espera", texto: "Lista de espera" },
  { estado: "activa", texto: "Activas" },
  { estado: "rechazada", texto: "Rechazadas" },
];

function FilaInscripcion({ ins, onCambio }: { ins: InscripcionAdmin; onCambio: () => void }) {
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const activar = async () => {
    setEnviando(true);
    try {
      await planesService.activar(ins.id);
      toast.success(`Plan activo para ${ins.email}. Le llegó el acceso por correo.`);
      onCambio();
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo activar."));
    } finally {
      setEnviando(false);
    }
  };

  const rechazar = async () => {
    if (motivo.trim().length < 3) { toast.error("Escribe el motivo: le llega a la persona."); return; }
    setEnviando(true);
    try {
      await planesService.rechazar(ins.id, motivo.trim());
      toast.success("Rechazada. Se liberó el cupo y la persona recibió el motivo.");
      onCambio();
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo rechazar."));
    } finally {
      setEnviando(false);
    }
  };

  const verComprobante = async () => {
    const r = await abrirArchivoEnPestana(planesService.rutaComprobante(ins.id), ins.comprobante_nombre ?? "Comprobante");
    if (!r.ok) toast.error(r.motivo ?? "No se pudo abrir el comprobante.");
  };

  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 text-sm">
          <p className="font-semibold">{ins.nombre} <span className="font-normal text-muted-foreground">· {ins.plan.nombre}</span></p>
          <p className="text-xs text-muted-foreground">
            {ins.email} · {ins.telefono} · {ins.documento}{ins.ciudad ? ` · ${ins.ciudad}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {ins.total_cop !== null ? `${pesos(ins.total_cop)} con IVA · ` : ""}{fechaCorta(ins.fecha)}
            {ins.vence_en ? ` · vence el ${fechaCorta(ins.vence_en)}` : ""}
            {ins.usuario_id && ins.estado === "pendiente" ? " · ya tiene cuenta" : ""}
          </p>
          {ins.motivo_rechazo && <p className="mt-1 text-xs text-red-700 dark:text-red-300">Motivo: {ins.motivo_rechazo}</p>}
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-2">
          {ins.tiene_comprobante && (
            <button type="button" onClick={() => void verComprobante()} className={CLASE_BOTON_SECUNDARIO}>
              <ExternalLink className="h-4 w-4" /> Comprobante
            </button>
          )}
          {ins.estado === "pendiente" && !rechazando && (
            <>
              <button type="button" onClick={() => setRechazando(true)} className={CLASE_BOTON_SECUNDARIO} disabled={enviando}>
                <X className="h-4 w-4" /> Rechazar
              </button>
              <button type="button" onClick={() => void activar()} className={CLASE_BOTON_PRIMARIO} disabled={enviando}>
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Activar plan
              </button>
            </>
          )}
          {ins.estado === "lista_espera" && (
            <a href={`mailto:${ins.email}`} className={CLASE_BOTON_SECUNDARIO}>Escribirle</a>
          )}
        </div>
      </div>
      {rechazando && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} autoFocus
            placeholder="Ej. La transferencia no aparece en la cuenta" className={CLASE_INPUT} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setRechazando(false)} className={CLASE_BOTON_SECUNDARIO} disabled={enviando}>Cancelar</button>
            <button type="button" onClick={() => void rechazar()} disabled={enviando}
              className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Rechazar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function Inscripciones({ onCambio }: { onCambio: () => void }) {
  const [estado, setEstado] = useState<EstadoInscripcion>("pendiente");
  const [filas, setFilas] = useState<InscripcionAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      setFilas(await planesService.inscripciones(estado));
    } catch (err) {
      setError(mensajeError(err, "No se pudieron cargar las inscripciones."));
    } finally {
      setCargando(false);
    }
  }, [estado]);

  useEffect(() => { void cargar(); }, [cargar]);

  return (
    <section className="rounded-xl border border-border bg-white shadow-sm dark:bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <p className="text-base font-semibold">Inscripciones</p>
          <p className="text-sm text-muted-foreground">Confirma la transferencia en el banco antes de activar. Al activar se crea la cuenta y le llega el acceso.</p>
        </div>
        <button type="button" onClick={() => void cargar()} className={CLASE_BOTON_SECUNDARIO} disabled={cargando}>
          <RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>
      <div role="tablist" className="flex flex-wrap gap-2 px-4 pt-3">
        {PESTANAS.map((p) => (
          <button key={p.estado} type="button" role="tab" aria-selected={estado === p.estado} onClick={() => setEstado(p.estado)}
            className={`rounded-full border px-3 py-1 text-sm font-medium ${estado === p.estado
              ? "border-primary bg-primary text-white dark:border-accent dark:bg-accent dark:text-accent-foreground"
              : "border-border text-muted-foreground hover:text-foreground"}`}>
            {p.texto}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="px-4 pt-3 text-sm text-destructive">{error}</p>}
      {cargando && filas.length === 0 ? (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : filas.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <Inbox className="mx-auto mb-2 h-6 w-6 opacity-40" />
          {estado === "pendiente" ? "No hay inscripciones por activar." : "No hay nada aquí todavía."}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {filas.map((ins) => <FilaInscripcion key={ins.id} ins={ins} onCambio={() => { void cargar(); onCambio(); }} />)}
        </ul>
      )}
    </section>
  );
}

type Formulario = Record<"clave" | "nombre" | "para_quien" | "precio_cop" | "iva_pct" | "solicitudes_incluidas" | "vigencia_meses"
  | "dias_tendencias" | "precio_solicitud_adicional_cop" | "cupos_totales" | "orden" | "incluye", string> & { destacado: boolean; activo: boolean };

const VACIO: Formulario = {
  clave: "", nombre: "", para_quien: "", precio_cop: "", iva_pct: "19", solicitudes_incluidas: "10", vigencia_meses: "12",
  dias_tendencias: "", precio_solicitud_adicional_cop: "", cupos_totales: "", orden: "0", incluye: "", destacado: false, activo: true,
};

function aFormulario(p: PlanAdmin): Formulario {
  const t = (v: number | null) => (v === null || v === undefined ? "" : String(v));
  return {
    clave: p.clave, nombre: p.nombre, para_quien: p.para_quien ?? "", precio_cop: t(p.precio_cop), iva_pct: t(p.iva_pct),
    solicitudes_incluidas: t(p.solicitudes_incluidas), vigencia_meses: t(p.vigencia_meses), dias_tendencias: t(p.dias_tendencias),
    precio_solicitud_adicional_cop: t(p.precio_solicitud_adicional_cop), cupos_totales: t(p.cupos_totales), orden: t(p.orden),
    incluye: p.incluye.join("\n"), destacado: p.destacado, activo: p.activo,
  };
}

function EditorPlan({ plan, onGuardado, onCancelar }: { plan: PlanAdmin | null; onGuardado: () => void; onCancelar: () => void }) {
  const [f, setF] = useState<Formulario>(plan ? aFormulario(plan) : VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const campo = (k: keyof Formulario) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const num = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.floor(Number(v.replace(/\D/g, "")))));

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (f.nombre.trim().length < 2 || num(f.precio_cop) === null) { setError("El plan necesita nombre y precio."); return; }
    if (!/^[a-z0-9-]{2,40}$/.test(f.clave)) { setError("La clave va en minúsculas, sin espacios (ej. vip). Es la que sale en el enlace."); return; }
    const datos: CamposPlan = {
      clave: f.clave, nombre: f.nombre.trim(), para_quien: f.para_quien.trim() || null,
      precio_cop: num(f.precio_cop) as number, iva_pct: num(f.iva_pct) ?? 0,
      solicitudes_incluidas: num(f.solicitudes_incluidas) ?? 0, vigencia_meses: Math.max(1, num(f.vigencia_meses) ?? 12),
      dias_tendencias: num(f.dias_tendencias) || null, precio_solicitud_adicional_cop: num(f.precio_solicitud_adicional_cop),
      cupos_totales: num(f.cupos_totales), orden: num(f.orden) ?? 0,
      incluye: f.incluye.split("\n").map((l) => l.trim()).filter(Boolean),
      destacado: f.destacado, activo: f.activo,
    };
    setGuardando(true);
    setError("");
    try {
      if (plan) await planesService.actualizarPlan(plan.id, datos);
      else await planesService.crearPlan(datos);
      toast.success("Plan guardado. Ya se ve así en el inicio.");
      onGuardado();
    } catch (err) {
      setError(mensajeError(err, "No se pudo guardar el plan."));
    } finally {
      setGuardando(false);
    }
  };

  const L = "text-xs font-medium text-muted-foreground";
  return (
    <form onSubmit={(e) => void guardar(e)} noValidate className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className={`${L} sm:col-span-2`}>Nombre<input value={f.nombre} onChange={campo("nombre")} maxLength={80} className={`${CLASE_INPUT} mt-1`} /></label>
      <label className={L}>Clave (en el enlace)<input value={f.clave} onChange={campo("clave")} maxLength={40} placeholder="vip" className={`${CLASE_INPUT} mt-1`} /></label>
      <label className={L}>Orden<input value={f.orden} onChange={campo("orden")} inputMode="numeric" className={`${CLASE_INPUT} mt-1`} /></label>
      <label className={`${L} sm:col-span-2 lg:col-span-4`}>Para quién<input value={f.para_quien} onChange={campo("para_quien")} maxLength={200} placeholder="Para quien ya sabe qué quiere traer." className={`${CLASE_INPUT} mt-1`} /></label>
      <label className={L}>Precio sin IVA (COP)<input value={f.precio_cop} onChange={campo("precio_cop")} inputMode="numeric" className={`${CLASE_INPUT} mt-1`} /></label>
      <label className={L}>IVA (%)<input value={f.iva_pct} onChange={campo("iva_pct")} inputMode="numeric" className={`${CLASE_INPUT} mt-1`} /></label>
      <label className={L}>Solicitudes incluidas<input value={f.solicitudes_incluidas} onChange={campo("solicitudes_incluidas")} inputMode="numeric" className={`${CLASE_INPUT} mt-1`} /></label>
      <label className={L}>Vigencia (meses)<input value={f.vigencia_meses} onChange={campo("vigencia_meses")} inputMode="numeric" className={`${CLASE_INPUT} mt-1`} /></label>
      <label className={L}>Días de Tendencias<input value={f.dias_tendencias} onChange={campo("dias_tendencias")} inputMode="numeric" placeholder="Vacío: sin Tendencias" className={`${CLASE_INPUT} mt-1`} /></label>
      <label className={L}>Solicitud adicional sin IVA<input value={f.precio_solicitud_adicional_cop} onChange={campo("precio_solicitud_adicional_cop")} inputMode="numeric" placeholder="Vacío: precio general" className={`${CLASE_INPUT} mt-1`} /></label>
      <label className={L}>Cupos<input value={f.cupos_totales} onChange={campo("cupos_totales")} inputMode="numeric" placeholder="Vacío: sin límite" className={`${CLASE_INPUT} mt-1`} /></label>
      <div className="flex flex-col justify-end gap-1.5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.destacado} onChange={(e) => setF((x) => ({ ...x, destacado: e.target.checked }))} /> Tarjeta destacada</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.activo} onChange={(e) => setF((x) => ({ ...x, activo: e.target.checked }))} /> Publicado</label>
      </div>
      <label className={`${L} sm:col-span-2 lg:col-span-4`}>Lo que incluye (una línea por punto, así sale en la tarjeta)
        <textarea value={f.incluye} onChange={campo("incluye")} rows={5} className={`${CLASE_INPUT} mt-1`} />
      </label>
      {error && <p role="alert" className="text-sm text-destructive sm:col-span-2 lg:col-span-4">{error}</p>}
      <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-4">
        <button type="button" onClick={onCancelar} className={CLASE_BOTON_SECUNDARIO}><X className="h-4 w-4" /> Cancelar</button>
        <button type="submit" disabled={guardando} className={CLASE_BOTON_PRIMARIO}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
        </button>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">
        Los cambios de precio no afectan las inscripciones ya enviadas: cada una guarda lo que costaba. La vigencia y las solicitudes
        se aplican al activar.
      </p>
    </form>
  );
}

export function PlanesAdmin() {
  const [planes, setPlanes] = useState<PlanAdmin[]>([]);
  const [editando, setEditando] = useState<string | "nuevo" | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      setPlanes(await planesService.adminPlanes());
    } catch (err) {
      setError(mensajeError(err, "No se pudieron cargar los planes."));
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  return (
    <div className="space-y-6">
      <Inscripciones onCambio={() => void cargar()} />

      <section className="rounded-xl border border-border bg-white p-4 shadow-sm dark:bg-card">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold">Planes publicados</p>
            <p className="text-sm text-muted-foreground">Lo que se ve en la sección Planes del inicio. Los cupos cuentan las inscripciones por activar y las activas.</p>
          </div>
          {editando === null && (
            <button type="button" onClick={() => setEditando("nuevo")} className={CLASE_BOTON_PRIMARIO}><Plus className="h-4 w-4" /> Nuevo plan</button>
          )}
        </div>
        {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
        {editando === "nuevo" && (
          <div className="mb-4"><EditorPlan plan={null} onCancelar={() => setEditando(null)} onGuardado={() => { setEditando(null); void cargar(); }} /></div>
        )}
        <ul className="space-y-3">
          {planes.map((p) => (
            <li key={p.id} className={`rounded-lg border border-border p-4 ${p.activo ? "" : "opacity-60"}`}>
              {editando === p.id ? (
                <EditorPlan plan={p} onCancelar={() => setEditando(null)} onGuardado={() => { setEditando(null); void cargar(); }} />
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold">
                      {p.nombre} <span className="font-normal text-muted-foreground">· /planes/inscripcion?plan={p.clave}</span>
                      {!p.activo && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px]">Oculto</span>}
                      {p.destacado && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary dark:bg-accent/15 dark:text-accent">Destacado</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pesos(p.precio_cop)} + IVA ({pesos(p.total_cop)}) · {p.solicitudes_incluidas} solicitudes · {p.vigencia_meses} meses
                      {p.dias_tendencias ? ` · Tendencias ${p.dias_tendencias} días` : ""}
                      {p.precio_solicitud_adicional_cop !== null ? ` · adicional ${pesos(p.precio_solicitud_adicional_cop)} + IVA` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.cupos_totales === null ? "Sin límite de cupos" : `Quedan ${p.cupos_restantes} de ${p.cupos_totales} cupos`}
                      {" · "}{p.inscripciones.pendiente} por activar · {p.inscripciones.activa} activas · {p.inscripciones.lista_espera} en espera
                    </p>
                  </div>
                  {editando === null && (
                    <button type="button" onClick={() => setEditando(p.id)} className={CLASE_BOTON_SECUNDARIO}><Pencil className="h-4 w-4" /> Editar</button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
