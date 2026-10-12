import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2, Palette, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { tendenciasService, type DisenadorItem } from "@/services/tendencias.service";

import { CLASE_BOTON_PRIMARIO, CLASE_BOTON_SECUNDARIO, CLASE_INPUT, mensajeError } from "./AprobacionComun";

const VACIO = { nombre: "", email: "", password: "" };

/**
 * Admin: el equipo de diseño. Un designer pone portada e imágenes con la
 * identidad de Zarpi a lo aprobado y lo publica; entra al canal del equipo,
 * pero no ve soporte ni administra nada. Las cuentas se crean aquí.
 */
export function EquipoDiseno() {
  const [disenadores, setDisenadores] = useState<DisenadorItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState(VACIO);
  const [enviando, setEnviando] = useState(false);
  const [cambiando, setCambiando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      setDisenadores(await tendenciasService.listarDisenadores());
    } catch (e) {
      setError(mensajeError(e, "No se pudo cargar el equipo de diseño."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (form.nombre.trim().length < 2) return toast.error("Escribe el nombre.");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return toast.error("Revisa el correo.");
    if (form.password.length < 9 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      return toast.error("La contraseña necesita al menos 9 caracteres, letras y números.");
    }
    setEnviando(true);
    try {
      const nuevo = await tendenciasService.crearDisenador({
        nombre: form.nombre.trim(), email: form.email.trim().toLowerCase(), password: form.password,
      });
      setDisenadores((prev) => [nuevo, ...prev]);
      setForm(VACIO);
      setCreando(false);
      toast.success(`Listo: ${nuevo.nombre || nuevo.email} ya puede entrar a Diseño.`);
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo crear la cuenta."));
    } finally {
      setEnviando(false);
    }
  };

  const cambiarEstado = async (d: DisenadorItem) => {
    setCambiando(d.id);
    try {
      await tendenciasService.cambiarEstadoDisenador(d.id, !d.activo);
      setDisenadores((prev) => prev.map((x) => (x.id === d.id ? { ...x, activo: !d.activo } : x)));
      toast.success(d.activo ? "Cuenta desactivada." : "Cuenta activada.");
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo cambiar el estado."));
    } finally {
      setCambiando(null);
    }
  };

  return (
    <div className="max-w-3xl rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-base font-semibold">
            <Palette className="h-4 w-4 text-primary dark:text-accent" /> Equipo de diseño
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ponen portada e imágenes con la identidad de Zarpi a lo aprobado y lo publican. Entran al canal del equipo; no ven soporte.
          </p>
        </div>
        {!creando && (
          <button type="button" onClick={() => setCreando(true)} className={CLASE_BOTON_PRIMARIO}>
            <Plus className="h-4 w-4" /> Nuevo designer
          </button>
        )}
      </div>

      {creando && (
        <form onSubmit={crear} noValidate className="mt-3 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="font-medium">Nombre</span>
              <input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} autoComplete="off" className={`mt-1 ${CLASE_INPUT}`} />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Correo</span>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} autoComplete="off" className={`mt-1 ${CLASE_INPUT}`} />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Contraseña inicial</span>
              <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} autoComplete="new-password" className={`mt-1 ${CLASE_INPUT}`} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">Compártela por un canal seguro; la puede cambiar desde «Mi perfil».</p>
          <div className="flex gap-2">
            <button type="submit" disabled={enviando} className={CLASE_BOTON_PRIMARIO}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear cuenta
            </button>
            <button type="button" disabled={enviando} onClick={() => { setCreando(false); setForm(VACIO); }} className={CLASE_BOTON_SECUNDARIO}>
              <X className="h-4 w-4" /> Cancelar
            </button>
          </div>
        </form>
      )}

      {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}

      {cargando ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>
      ) : disenadores.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Todavía no hay designers. Mientras tanto, un admin puede diseñar desde «Diseño».</p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {disenadores.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {d.nombre || d.email}
                  {!d.activo && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">Inactivo</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {d.nombre ? `${d.email} · ` : ""}{d.publicados === 1 ? "1 publicado" : `${d.publicados} publicados`}
                </p>
              </div>
              <button
                type="button"
                disabled={cambiando === d.id}
                onClick={() => void cambiarEstado(d)}
                className={`${CLASE_BOTON_SECUNDARIO} text-xs ${d.activo ? "text-rose-700 dark:text-rose-400" : ""}`}
              >
                {cambiando === d.id && <Loader2 className="h-3 w-3 animate-spin" />}
                {d.activo ? "Desactivar" : "Activar"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
