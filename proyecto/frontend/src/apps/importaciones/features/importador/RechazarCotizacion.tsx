import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

import { businessService } from "@/services/business.service";

const MINIMO = 10;

/**
 * La empresa (dueño o asesor) no toma una cotización y explica por qué. El
 * motivo le llega al cotizante por correo y en la campana. Una dirigida queda
 * «rechazada»; una abierta sale de la bandeja de la empresa y sigue para las demás.
 */
export function ModalRechazoCotizacion({
  cotizacion,
  onCerrar,
  onRechazada,
}: {
  cotizacion: { id: string; product: string; code: string; mode: string } | null;
  onCerrar: () => void;
  onRechazada: () => void | Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMotivo("");
    setError("");
  }, [cotizacion?.id]);

  if (!cotizacion) return null;
  const abierta = cotizacion.mode === "Abierta";

  async function rechazar() {
    if (!cotizacion) return;
    if (motivo.trim().length < MINIMO) {
      setError(`Escribe el motivo (mínimo ${MINIMO} caracteres). El cotizante lo va a leer.`);
      return;
    }
    setEnviando(true);
    setError("");
    try {
      await businessService.rechazarCotizacion(cotizacion.id, motivo.trim());
      await onRechazada();
      onCerrar();
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo rechazar la cotización.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true" aria-labelledby="rechazo-cotizacion-titulo">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="rechazo-cotizacion-titulo" className="text-base font-semibold text-foreground">Rechazar cotización</h2>
            <p className="text-xs text-muted-foreground">{cotizacion.product} · {cotizacion.code}</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <label htmlFor="motivo-rechazo-cotizacion" className="mb-1 block text-xs font-medium text-muted-foreground">Motivo del rechazo</label>
        <textarea
          id="motivo-rechazo-cotizacion"
          value={motivo}
          maxLength={1000}
          onChange={(evento) => setMotivo(evento.target.value)}
          placeholder="Ej.: No trabajamos con productos de esta categoría / El volumen mínimo es muy bajo para importar."
          className="min-h-28 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary dark:focus:border-accent"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          El cotizante recibe este motivo por correo.{" "}
          {abierta ? "La cotización sale de tu bandeja y sigue abierta para otras empresas." : "La cotización queda rechazada."}
        </p>
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">Cancelar</button>
          <button
            type="button"
            disabled={enviando}
            onClick={() => { void rechazar(); }}
            className="inline-flex items-center gap-2 rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Rechazar y avisar al cotizante
          </button>
        </div>
      </div>
    </div>
  );
}
