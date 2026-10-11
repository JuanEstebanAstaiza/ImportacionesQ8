import { useCallback, useEffect, useState } from "react";
import { Blocks, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { CLASE_BOTON_SECUNDARIO, mensajeError } from "@/features/tendencias/AprobacionComun";
import { modulosService, type ModulosPlataforma as Modulos } from "@/services/modulos.service";

/**
 * Módulos de la plataforma: el admin enciende o apaga secciones completas
 * (p. ej. el académico) sin redesplegar. Tras cada cambio avisa a App para
 * que recargue la configuración pública y el menú se actualice.
 */

function Interruptor({
  activo,
  disabled,
  etiqueta,
  descripcionId,
  onCambio,
}: {
  activo: boolean;
  disabled: boolean;
  etiqueta: string;
  descripcionId?: string;
  onCambio: (valor: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      aria-describedby={descripcionId}
      disabled={disabled}
      onClick={() => onCambio(!activo)}
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-accent dark:focus-visible:ring-offset-background ${
        activo ? "bg-emerald-500" : "bg-muted-foreground/30"
      }`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${activo ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export function ModulosPlataforma({ onCambio }: { onCambio?: () => void }) {
  const [modulos, setModulos] = useState<Modulos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      setModulos(await modulosService.listar());
    } catch (e) {
      setError(mensajeError(e, "No se pudieron cargar los módulos."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cambiar = async (clave: string, valor: boolean) => {
    if (!modulos) return;
    setGuardando(clave);
    try {
      const resultado = await modulosService.cambiar({ [clave]: valor });
      setModulos(resultado);
      const nombre = resultado[clave]?.nombre ?? modulos[clave]?.nombre ?? "El módulo";
      toast.success(`${nombre} ${valor ? "encendido" : "apagado"}.`);
      onCambio?.();
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo cambiar el módulo."));
    } finally {
      setGuardando(null);
    }
  };

  const entradas = modulos ? Object.entries(modulos) : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Módulos</h1>
        <p className="text-sm text-muted-foreground">Enciende o apaga secciones completas de la plataforma sin redesplegar.</p>
      </div>

      {cargando && !modulos ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-white p-10 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : error && !modulos ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" onClick={() => void cargar()} className={CLASE_BOTON_SECUNDARIO}>
            <RefreshCw className="h-3.5 w-3.5" /> Reintentar
          </button>
        </div>
      ) : entradas.length === 0 ? (
        <p className="rounded-xl border border-border bg-white p-6 text-center text-sm text-muted-foreground shadow-sm">
          No hay módulos para configurar.
        </p>
      ) : (
        <ul className="grid gap-3">
          {entradas.map(([clave, modulo]) => {
            const idDescripcion = `modulo-${clave}-descripcion`;
            return (
              <li key={clave} className="flex items-start gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
                <span
                  className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                    modulo.activo
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Blocks className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {modulo.nombre}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        modulo.activo
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {modulo.activo ? "Encendido" : "Apagado"}
                    </span>
                  </p>
                  <p id={idDescripcion} className="mt-0.5 text-sm text-muted-foreground">{modulo.descripcion}</p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2 pt-1">
                  {guardando === clave && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
                  <Interruptor
                    activo={modulo.activo}
                    disabled={guardando !== null}
                    etiqueta={modulo.nombre}
                    descripcionId={idDescripcion}
                    onCambio={(valor) => void cambiar(clave, valor)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
