import { useEffect, useState, type ChangeEvent } from "react";
import { CalendarDays, Gift, History, Loader2, Pencil, Plus, Save, Settings2, Trash2, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";

import {
  tendenciasService,
  type AccesoAdmin, type CambioTendencias, type CierreFabricas, type CuradorItem, type Temporada,
} from "@/services/tendencias.service";
import { BuscadorUsuarios, UsuarioElegido } from "@/app/components/busqueda/BuscadorUsuarios";

import {
  BTN, BTN_ICONO, BotonConfirmar, CARD, Campo, Cargando, INPUT, Vacio, formatoBogota,
  formatoFecha, mensajeError, numeroOpcional,
} from "./CuradorComun";

type Seccion = "suscripcion" | "accesos" | "curadores" | "calendario" | "bitacora";

const SECCIONES: { clave: Seccion; titulo: string; icono: typeof Settings2 }[] = [
  { clave: "suscripcion", titulo: "Suscripción y parámetros", icono: Settings2 },
  { clave: "accesos", titulo: "Accesos", icono: Gift },
  { clave: "curadores", titulo: "Curadores", icono: Users },
  { clave: "calendario", titulo: "Calendario", icono: CalendarDays },
  { clave: "bitacora", titulo: "Bitácora", icono: History },
];

const ENCABEZADO = "border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground";

// ── Suscripción y parámetros ─────────────────────────────────────────────────

function Parametros() {
  const [form, setForm] = useState({ precio_cop: "", dias_suscripcion: "", dias_mar: "", dias_aereo: "", dias_produccion: "" });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  function aplicar(p: { precio_cop: number | null; dias_suscripcion: number; dias_mar: number; dias_aereo: number; dias_produccion: number }) {
    setForm({
      precio_cop: p.precio_cop ? String(p.precio_cop) : "",
      dias_suscripcion: String(p.dias_suscripcion),
      dias_mar: String(p.dias_mar),
      dias_aereo: String(p.dias_aereo),
      dias_produccion: String(p.dias_produccion),
    });
  }

  useEffect(() => {
    tendenciasService.getParametros()
      .then(aplicar)
      .catch((err) => toast.error(mensajeError(err, "No se pudieron cargar los parámetros.")))
      .finally(() => setCargando(false));
  }, []);

  async function guardar() {
    const n = {
      precio_cop: numeroOpcional(form.precio_cop),
      dias_suscripcion: numeroOpcional(form.dias_suscripcion),
      dias_mar: numeroOpcional(form.dias_mar),
      dias_aereo: numeroOpcional(form.dias_aereo),
      dias_produccion: numeroOpcional(form.dias_produccion),
    };
    if (n.dias_suscripcion == null || n.dias_suscripcion < 1) { toast.error("Días de suscripción: mínimo 1."); return; }
    if (n.dias_mar == null || n.dias_mar < 1 || n.dias_mar > 365) { toast.error("Días por mar: entre 1 y 365."); return; }
    if (n.dias_aereo == null || n.dias_aereo < 1 || n.dias_aereo > 365) { toast.error("Días por aéreo: entre 1 y 365."); return; }
    if (n.dias_produccion == null || n.dias_produccion < 0 || n.dias_produccion > 180) { toast.error("Días de producción: entre 0 y 180."); return; }
    if (n.precio_cop != null && n.precio_cop < 0) { toast.error("El precio no puede ser negativo."); return; }
    setGuardando(true);
    try {
      const r = await tendenciasService.guardarParametros({
        precio_cop: n.precio_cop || null,
        dias_suscripcion: n.dias_suscripcion,
        dias_mar: n.dias_mar,
        dias_aereo: n.dias_aereo,
        dias_produccion: n.dias_produccion,
      });
      aplicar(r);
      toast.success("Parámetros guardados");
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <Cargando />;
  const precio = numeroOpcional(form.precio_cop);
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={`${CARD} space-y-3`}>
        <h3 className="text-base font-semibold">Suscripción</h3>
        <Campo label="Precio por periodo (COP)"
          hint={precio ? `Se vende a ${precio.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}.` : "Vacío o 0: no se vende, solo por invitación."}>
          <input type="number" min={0} className={INPUT} value={form.precio_cop} onChange={set("precio_cop")} placeholder="Sin precio" />
        </Campo>
        <Campo label="Días por periodo">
          <input type="number" min={1} className={INPUT} value={form.dias_suscripcion} onChange={set("dias_suscripcion")} />
        </Campo>
      </section>
      <section className={`${CARD} space-y-3`}>
        <h3 className="text-base font-semibold">Tiempos de importación</h3>
        <p className="text-xs text-muted-foreground">Días puerta a puerta por defecto. Cada producto puede tener los suyos.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo label="Por mar"><input type="number" min={1} max={365} className={INPUT} value={form.dias_mar} onChange={set("dias_mar")} /></Campo>
          <Campo label="Por aéreo"><input type="number" min={1} max={365} className={INPUT} value={form.dias_aereo} onChange={set("dias_aereo")} /></Campo>
          <Campo label="Producción"><input type="number" min={0} max={180} className={INPUT} value={form.dias_produccion} onChange={set("dias_produccion")} /></Campo>
        </div>
      </section>
      <div className="flex justify-end lg:col-span-2">
        <button type="button" onClick={() => void guardar()} disabled={guardando} className={BTN}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Guardar parámetros
        </button>
      </div>
    </div>
  );
}

// ── Accesos ──────────────────────────────────────────────────────────────────

function Accesos() {
  const [accesos, setAccesos] = useState<AccesoAdmin[]>([]);
  const [soloVigentes, setSoloVigentes] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [email, setEmail] = useState("");
  const [nombreElegido, setNombreElegido] = useState<string | null>(null);
  const [dias, setDias] = useState("30");
  const [nota, setNota] = useState("");
  const [otorgando, setOtorgando] = useState(false);

  async function cargar(vigentes = soloVigentes) {
    setCargando(true);
    try {
      setAccesos(await tendenciasService.listarAccesos(vigentes));
    } catch (err) {
      toast.error(mensajeError(err, "No se pudieron cargar los accesos."));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { void cargar(soloVigentes); }, [soloVigentes]);

  async function otorgar() {
    const n = numeroOpcional(dias);
    if (!email.trim()) { toast.error("Elige la cuenta."); return; }
    if (n == null || n < 1 || n > 3650) { toast.error("Días: entre 1 y 3650."); return; }
    setOtorgando(true);
    try {
      const a = await tendenciasService.otorgarAcceso({ email: email.trim(), dias: n, nota: nota.trim() || undefined });
      toast.success(`Acceso regalado a ${a.email ?? email.trim()} hasta el ${formatoBogota(a.fin)}`);
      setEmail("");
      setNombreElegido(null);
      setNota("");
      await cargar();
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setOtorgando(false);
    }
  }

  async function revocar(id: string) {
    try {
      const a = await tendenciasService.revocarAcceso(id);
      setAccesos((lista) => (soloVigentes ? lista.filter((x) => x.id !== id) : lista.map((x) => (x.id === id ? a : x))));
      toast.success("Acceso revocado");
    } catch (err) {
      toast.error(mensajeError(err));
    }
  }

  const presetActivo = ["7", "30", "90"].includes(dias);

  return (
    <div className="space-y-4">
      <section className={`${CARD} space-y-3`}>
        <h3 className="flex items-center gap-2 text-base font-semibold"><Gift className="h-4 w-4" />Regalar acceso</h3>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <Campo label="Cuenta">
            {email ? (
              <UsuarioElegido email={email} nombre={nombreElegido} onCambiar={() => { setEmail(""); setNombreElegido(null); }} />
            ) : (
              <BuscadorUsuarios
                placeholder="Busca por correo o nombre"
                onSeleccionar={(u) => { setEmail(u.email); setNombreElegido(u.nombre); }}
              />
            )}
          </Campo>
          <div>
            <p className="mb-1 text-sm font-medium">Días</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {["7", "30", "90"].map((d) => (
                <button key={d} type="button" onClick={() => setDias(d)}
                  className={`h-9 rounded-lg border px-3 text-sm font-medium ${dias === d ? "border-primary bg-primary text-white dark:border-accent dark:bg-accent dark:text-accent-foreground" : "border-border bg-card hover:bg-muted"}`}>
                  {d}
                </button>
              ))}
              <input type="number" min={1} max={3650} value={dias} onChange={(e) => setDias(e.target.value)} aria-label="Días personalizados"
                className={`${INPUT} w-24 ${presetActivo ? "" : "border-primary dark:border-accent"}`} />
            </div>
          </div>
        </div>
        <Campo label="Nota (opcional)">
          <input className={INPUT} maxLength={255} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. Cliente piloto" />
        </Campo>
        <div className="flex justify-end">
          <button type="button" onClick={() => void otorgar()} disabled={otorgando} className={BTN}>
            {otorgando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}Regalar acceso
          </button>
        </div>
      </section>

      <section className={CARD}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Accesos</h3>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={soloVigentes} onChange={(e) => setSoloVigentes(e.target.checked)} className="h-4 w-4 accent-primary" />
            Solo vigentes
          </label>
        </div>
        {cargando ? <Cargando /> : accesos.length === 0 ? <Vacio>No hay accesos para mostrar.</Vacio> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className={ENCABEZADO}>
                  <th className="px-3 py-2">Cuenta</th>
                  <th className="px-3 py-2">Origen</th>
                  <th className="px-3 py-2">Inicio</th>
                  <th className="px-3 py-2">Fin</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {accesos.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{a.nombre || "Sin nombre"}</p>
                      <p className="text-xs text-muted-foreground">{a.email ?? "—"}</p>
                      {a.nota && <p className="text-xs italic text-muted-foreground">{a.nota}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.origen === "pago" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200" : "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200"}`}>
                        {a.origen === "pago" ? "Pago" : "Cortesía"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs">{formatoBogota(a.inicio)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs">{formatoBogota(a.fin)}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {a.revocado ? <span className="text-destructive">Revocado</span> : a.vigente ? <span className="font-medium text-emerald-700 dark:text-emerald-300">Vigente</span> : <span className="text-muted-foreground">Vencido</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {a.vigente && !a.revocado && (
                        <BotonConfirmar label="Revocar" pregunta="¿Quitar el acceso ya?" confirmar="Revocar" peligro
                          className="h-8 rounded-md border border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/10"
                          onConfirm={() => revocar(a.id)} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Curadores ────────────────────────────────────────────────────────────────

function Curadores() {
  const [curadores, setCuradores] = useState<CuradorItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);

  async function cargar() {
    try {
      setCuradores(await tendenciasService.listarCuradores());
    } catch (err) {
      toast.error(mensajeError(err, "No se pudieron cargar los curadores."));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { void cargar(); }, []);

  async function asignar(correo: string, valor: boolean) {
    if (!correo.trim()) { toast.error("Elige la cuenta."); return; }
    setOcupado(true);
    try {
      await tendenciasService.asignarCurador(correo.trim(), valor);
      toast.success(valor ? "Curador agregado" : "Curador quitado");
      await cargar();
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className={`${CARD} space-y-4`}>
      <div>
        <h3 className="text-base font-semibold">Equipo curador</h3>
        <p className="text-sm text-muted-foreground">Crean y editan ediciones y productos. El rol se asigna a cuentas existentes.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <BuscadorUsuarios
          className="flex-1 sm:max-w-sm"
          placeholder="Agrega a alguien: busca por correo o nombre"
          excluir={new Set(curadores.map((c) => c.id))}
          disabled={ocupado}
          onSeleccionar={(u) => void asignar(u.email, true)}
        />
        {ocupado ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <UserPlus className="h-4 w-4 text-muted-foreground" aria-hidden />}
      </div>
      {cargando ? <Cargando /> : curadores.length === 0 ? <Vacio>No hay curadores asignados.</Vacio> : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {curadores.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.nombre || "Sin nombre"} <span className="text-xs font-normal text-muted-foreground">· {c.rol}</span></p>
                <p className="truncate text-xs text-muted-foreground">{c.email}</p>
              </div>
              <BotonConfirmar label="Quitar" pregunta="¿Quitar el rol de curador?" confirmar="Quitar" peligro disabled={ocupado}
                className="h-8 rounded-md border border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/10"
                onConfirm={() => asignar(c.email, false)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Calendario: temporadas y cierres ─────────────────────────────────────────

const TEMPORADA_VACIA = { nombre: "", fecha: "", ejemplos: "" };

function Temporadas() {
  const [temporadas, setTemporadas] = useState<Temporada[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nueva, setNueva] = useState(TEMPORADA_VACIA);
  const [edicion, setEdicion] = useState<{ id: string; nombre: string; fecha: string; ejemplos: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function cargar() {
    try {
      setTemporadas(await tendenciasService.listarTemporadas());
    } catch (err) {
      toast.error(mensajeError(err, "No se pudieron cargar las temporadas."));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { void cargar(); }, []);

  function datos(t: { nombre: string; fecha: string; ejemplos: string }) {
    return { nombre: t.nombre.trim(), fecha: t.fecha, ejemplos: t.ejemplos.trim() || null };
  }

  async function ejecutar(fn: () => Promise<unknown>, exito: string) {
    setOcupado(true);
    try {
      await fn();
      toast.success(exito);
      await cargar();
      return true;
    } catch (err) {
      toast.error(mensajeError(err));
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function crear() {
    if (!nueva.nombre.trim() || !nueva.fecha) { toast.error("Nombre y fecha son obligatorios."); return; }
    if (await ejecutar(() => tendenciasService.crearTemporada(datos(nueva)), "Temporada creada")) setNueva(TEMPORADA_VACIA);
  }

  async function guardarEdicion() {
    if (!edicion) return;
    if (!edicion.nombre.trim() || !edicion.fecha) { toast.error("Nombre y fecha son obligatorios."); return; }
    if (await ejecutar(() => tendenciasService.editarTemporada(edicion.id, datos(edicion)), "Temporada guardada")) setEdicion(null);
  }

  return (
    <section className={`${CARD} space-y-4`}>
      <div>
        <h3 className="text-base font-semibold">Temporadas</h3>
        <p className="text-sm text-muted-foreground">El día de cada temporada. Se cargan por año.</p>
      </div>
      <div className="grid gap-2 rounded-lg border border-dashed border-border p-3 sm:grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)_auto] sm:items-end">
        <Campo label="Nombre"><input className={INPUT} maxLength={80} value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} placeholder="Día de la Madre" /></Campo>
        <Campo label="Fecha"><input type="date" className={INPUT} value={nueva.fecha} onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })} /></Campo>
        <Campo label="Ejemplos"><input className={INPUT} maxLength={200} value={nueva.ejemplos} onChange={(e) => setNueva({ ...nueva, ejemplos: e.target.value })} placeholder="Regalos, flores, accesorios" /></Campo>
        <button type="button" disabled={ocupado} onClick={() => void crear()} className={BTN}><Plus className="h-4 w-4" />Agregar</button>
      </div>
      {cargando ? <Cargando /> : temporadas.length === 0 ? <Vacio>No hay temporadas.</Vacio> : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {temporadas.map((t) => edicion?.id === t.id ? (
            <li key={t.id} className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)_auto] sm:items-center">
              <input className={INPUT} maxLength={80} value={edicion.nombre} onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })} aria-label="Nombre" />
              <input type="date" className={INPUT} value={edicion.fecha} onChange={(e) => setEdicion({ ...edicion, fecha: e.target.value })} aria-label="Fecha" />
              <input className={INPUT} maxLength={200} value={edicion.ejemplos} onChange={(e) => setEdicion({ ...edicion, ejemplos: e.target.value })} aria-label="Ejemplos" />
              <div className="flex gap-1">
                <button type="button" disabled={ocupado} onClick={() => void guardarEdicion()} className={BTN_ICONO} aria-label="Guardar"><Save className="h-4 w-4" /></button>
                <button type="button" onClick={() => setEdicion(null)} className={BTN_ICONO} aria-label="Cancelar"><X className="h-4 w-4" /></button>
              </div>
            </li>
          ) : (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t.nombre} <span className="font-normal text-muted-foreground">· {formatoFecha(t.fecha)}</span></p>
                {t.ejemplos && <p className="truncate text-xs text-muted-foreground">{t.ejemplos}</p>}
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setEdicion({ id: t.id, nombre: t.nombre, fecha: t.fecha, ejemplos: t.ejemplos ?? "" })} className={BTN_ICONO} aria-label="Editar"><Pencil className="h-4 w-4" /></button>
                <BotonConfirmar label={<Trash2 className="h-4 w-4" />} pregunta="¿Borrar temporada?" confirmar="Borrar" peligro className={`${BTN_ICONO} hover:text-destructive`}
                  onConfirm={async () => { await ejecutar(() => tendenciasService.borrarTemporada(t.id), "Temporada borrada"); }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const CIERRE_VACIO: CierreFabricas = { inicio: "", fin: "", fin_produccion_previa: "" };

function Cierres() {
  const [cierres, setCierres] = useState<CierreFabricas[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState<CierreFabricas>(CIERRE_VACIO);
  const [ocupado, setOcupado] = useState(false);

  async function cargar() {
    try {
      setCierres(await tendenciasService.listarCierres());
    } catch (err) {
      toast.error(mensajeError(err, "No se pudieron cargar los cierres."));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { void cargar(); }, []);

  async function crear() {
    if (!nuevo.inicio || !nuevo.fin || !nuevo.fin_produccion_previa) { toast.error("Completa las tres fechas."); return; }
    if (nuevo.fin < nuevo.inicio) { toast.error("El fin del cierre no puede ser anterior a su inicio."); return; }
    if (nuevo.fin_produccion_previa > nuevo.inicio) { toast.error("La producción previa debe terminar antes de que empiece el cierre."); return; }
    setOcupado(true);
    try {
      await tendenciasService.crearCierre(nuevo);
      toast.success("Cierre agregado");
      setNuevo(CIERRE_VACIO);
      await cargar();
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setOcupado(false);
    }
  }

  async function borrar(id: string) {
    try {
      await tendenciasService.borrarCierre(id);
      setCierres((lista) => lista.filter((c) => c.id !== id));
      toast.success("Cierre borrado");
    } catch (err) {
      toast.error(mensajeError(err));
    }
  }

  return (
    <section className={`${CARD} space-y-4`}>
      <div>
        <h3 className="text-base font-semibold">Cierres de fábricas</h3>
        <p className="text-sm text-muted-foreground">Año Nuevo Lunar. Si la producción termina dentro del cierre, la fecha límite se adelanta.</p>
      </div>
      <div className="grid gap-2 rounded-lg border border-dashed border-border p-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end">
        <Campo label="Inicio del cierre"><input type="date" className={INPUT} value={nuevo.inicio} onChange={(e) => setNuevo({ ...nuevo, inicio: e.target.value })} /></Campo>
        <Campo label="Fin del cierre"><input type="date" className={INPUT} value={nuevo.fin} onChange={(e) => setNuevo({ ...nuevo, fin: e.target.value })} /></Campo>
        <Campo label="Fin de producción previa"><input type="date" className={INPUT} value={nuevo.fin_produccion_previa} onChange={(e) => setNuevo({ ...nuevo, fin_produccion_previa: e.target.value })} /></Campo>
        <button type="button" disabled={ocupado} onClick={() => void crear()} className={BTN}><Plus className="h-4 w-4" />Agregar</button>
      </div>
      {cargando ? <Cargando /> : cierres.length === 0 ? <Vacio>No hay cierres cargados.</Vacio> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className={ENCABEZADO}>
                <th className="px-3 py-2">Inicio</th>
                <th className="px-3 py-2">Fin</th>
                <th className="px-3 py-2">Producción previa hasta</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cierres.map((c) => (
                <tr key={c.id ?? c.inicio}>
                  <td className="px-3 py-2.5">{formatoFecha(c.inicio)}</td>
                  <td className="px-3 py-2.5">{formatoFecha(c.fin)}</td>
                  <td className="px-3 py-2.5">{formatoFecha(c.fin_produccion_previa)}</td>
                  <td className="px-3 py-2.5 text-right">
                    {c.id && (
                      <BotonConfirmar label={<Trash2 className="h-4 w-4" />} pregunta="¿Borrar cierre?" confirmar="Borrar" peligro
                        className={`${BTN_ICONO} hover:text-destructive`} onConfirm={() => borrar(c.id as string)} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Bitácora ─────────────────────────────────────────────────────────────────

const ACCIONES: Record<string, string> = {
  edicion_creada: "Edición creada",
  portada_editada: "Portada editada",
  productos_editados: "Productos de la edición",
  programada: "Programada",
  desprogramada: "Desprogramada",
  publicada: "Publicada",
  retirada: "Retirada",
  edicion_borrada: "Edición borrada",
  producto_creado: "Producto creado",
  producto_editado: "Producto editado",
  parametros_editados: "Parámetros editados",
  curador_asignado: "Curador asignado",
  curador_quitado: "Curador quitado",
};

function resumen(c: CambioTendencias): string {
  const d = (c.datos ?? {}) as Record<string, unknown>;
  if (!c.datos) return "";
  if (Array.isArray(d.campos)) return d.campos.length ? `Campos: ${(d.campos as string[]).join(", ")}` : "Sin cambios de campos";
  if (Array.isArray(d.productos)) {
    const lista = d.productos as { destacado?: boolean }[];
    return `${lista.length} producto${lista.length === 1 ? "" : "s"}${lista.some((p) => p.destacado) ? ", con destacado" : ", sin destacado"}`;
  }
  if (d.despues && typeof d.despues === "object") {
    return Object.entries(d.despues as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`).join(" · ");
  }
  if (typeof d.publicar_en === "string") return `Para el ${formatoBogota(d.publicar_en)}`;
  if (typeof d.email === "string") return d.email;
  const texto = Object.entries(d).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ");
  return texto.length > 160 ? `${texto.slice(0, 157)}...` : texto;
}

function Bitacora() {
  const [cambios, setCambios] = useState<CambioTendencias[]>([]);
  const [soloPublicadas, setSoloPublicadas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [numeros, setNumeros] = useState<Record<string, number>>({});
  const [productos, setProductos] = useState<Record<string, string>>({});

  useEffect(() => {
    // Nombres legibles para ediciones y productos; si fallan, se muestran los ids.
    tendenciasService.listarEdiciones()
      .then((l) => setNumeros(Object.fromEntries(l.map((e) => [e.id, e.numero]))))
      .catch(() => undefined);
    tendenciasService.listarProductos()
      .then((l) => setProductos(Object.fromEntries(l.map((p) => [p.id, p.nombre]))))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    tendenciasService.getCambios({ solo_publicadas: soloPublicadas })
      .then((l) => { if (vigente) setCambios(l); })
      .catch((err) => toast.error(mensajeError(err, "No se pudo cargar la bitácora.")))
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [soloPublicadas]);

  return (
    <section className={CARD}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Bitácora de cambios</h3>
          <p className="text-sm text-muted-foreground">Últimos 100 cambios, con autor y fecha.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={soloPublicadas} onChange={(e) => setSoloPublicadas(e.target.checked)} className="h-4 w-4 accent-primary" />
          Solo cambios en ediciones publicadas
        </label>
      </div>
      {cargando ? <Cargando /> : cambios.length === 0 ? <Vacio>Sin cambios registrados.</Vacio> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className={ENCABEZADO}>
                <th className="px-3 py-2">Fecha (Bogotá)</th>
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2">Acción</th>
                <th className="px-3 py-2">Edición / producto</th>
                <th className="px-3 py-2">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cambios.map((c) => (
                <tr key={c.id} className={c.sobre_publicada ? "bg-amber-50/60 dark:bg-amber-500/5" : ""}>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatoBogota(c.fecha)}</td>
                  <td className="px-3 py-2">{c.usuario}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{ACCIONES[c.accion] ?? c.accion}</span>
                    {c.sobre_publicada && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">publicada</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {c.edicion_id && <p>Edición {numeros[c.edicion_id] != null ? `N.º ${numeros[c.edicion_id]}` : c.edicion_id.slice(0, 8)}</p>}
                    {c.producto_id && <p className="text-muted-foreground">{productos[c.producto_id] ?? c.producto_id.slice(0, 8)}</p>}
                    {!c.edicion_id && !c.producto_id && <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="max-w-[320px] px-3 py-2 text-xs text-muted-foreground"><span className="line-clamp-2 break-words">{resumen(c)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function CuradorAdmin() {
  const [seccion, setSeccion] = useState<Seccion>("suscripcion");

  return (
    <div className="space-y-4">
      <nav className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Secciones de administración">
        {SECCIONES.map(({ clave, titulo, icono: Icono }) => (
          <button key={clave} type="button" onClick={() => setSeccion(clave)}
            className={`inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${
              seccion === clave ? "border-primary bg-primary/10 text-primary dark:border-accent dark:bg-accent/15 dark:text-accent" : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}>
            <Icono className="h-3.5 w-3.5" />{titulo}
          </button>
        ))}
      </nav>
      {seccion === "suscripcion" && <Parametros />}
      {seccion === "accesos" && <Accesos />}
      {seccion === "curadores" && <Curadores />}
      {seccion === "calendario" && <div className="grid gap-4 xl:grid-cols-2"><Temporadas /><Cierres /></div>}
      {seccion === "bitacora" && <Bitacora />}
    </div>
  );
}
