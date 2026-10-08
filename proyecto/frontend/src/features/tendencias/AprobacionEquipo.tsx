import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck, UserMinus } from "lucide-react";
import { toast } from "sonner";

import { BuscadorUsuarios } from "@/app/components/busqueda/BuscadorUsuarios";
import { tendenciasService, type AprobadorItem } from "@/services/tendencias.service";

import { mensajeError } from "./AprobacionComun";

const ROLES: Record<string, string> = {
  solicitante: "Comprador",
  importador: "Empresa",
  asesor: "Asesor",
  admin: "Admin",
  soporte: "Soporte",
  designer: "Diseño",
};

/** Admin: quién más del equipo puede aprobar enlaces de Tendencias. */
export function EquipoAprobacion() {
  const [aprobadores, setAprobadores] = useState<AprobadorItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [agregando, setAgregando] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      setAprobadores(await tendenciasService.listarAprobadores());
    } catch (e) {
      setError(mensajeError(e, "No se pudo cargar el equipo aprobador."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const excluir = useMemo(() => new Set(aprobadores.map((a) => a.id)), [aprobadores]);

  const agregar = async (email: string) => {
    setAgregando(true);
    try {
      const nuevo = await tendenciasService.asignarAprobador(email, true);
      setAprobadores((prev) => (prev.some((a) => a.id === nuevo.id) ? prev : [...prev, nuevo]));
      toast.success(`${nuevo.nombre || nuevo.email} ya puede aprobar enlaces.`);
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo agregar a esa persona."));
    } finally {
      setAgregando(false);
    }
  };

  const quitar = async (a: AprobadorItem) => {
    setQuitando(a.id);
    try {
      await tendenciasService.asignarAprobador(a.email, false);
      setAprobadores((prev) => prev.filter((x) => x.id !== a.id));
      setConfirmando(null);
      toast.success(`${a.nombre || a.email} ya no aprueba enlaces.`);
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo quitar el permiso."));
    } finally {
      setQuitando(null);
    }
  };

  return (
    <div className="max-w-3xl rounded-xl border border-border bg-white p-4 shadow-sm">
      <p className="flex items-center gap-2 text-base font-semibold">
        <ShieldCheck className="h-4 w-4 text-primary dark:text-accent" /> Equipo aprobador
      </p>
      <p className="mt-1 text-sm text-muted-foreground">Admins aprueban siempre; aquí agregas a otras personas del equipo.</p>

      <div className="mt-3 flex items-center gap-2">
        <BuscadorUsuarios
          onSeleccionar={(u) => void agregar(u.email)}
          placeholder="Agregar por correo o nombre"
          excluir={excluir}
          disabled={agregando}
          className="flex-1"
        />
        {agregando && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}

      {cargando ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>
      ) : aprobadores.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Por ahora solo aprueban los admins.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {aprobadores.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{a.nombre || a.email}</p>
                <p className="truncate text-xs text-muted-foreground">{a.nombre ? `${a.email} · ` : ""}{ROLES[a.rol] ?? a.rol}</p>
              </div>
              {confirmando === a.id ? (
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">¿Quitarle el permiso?</span>
                  <button
                    type="button"
                    disabled={quitando === a.id}
                    onClick={() => void quitar(a)}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {quitando === a.id && <Loader2 className="h-3 w-3 animate-spin" />} Quitar
                  </button>
                  <button type="button" disabled={quitando === a.id} onClick={() => setConfirmando(null)} className="rounded-lg px-2 py-1.5 text-muted-foreground hover:bg-muted">
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmando(a.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                >
                  <UserMinus className="h-3.5 w-3.5" /> Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
