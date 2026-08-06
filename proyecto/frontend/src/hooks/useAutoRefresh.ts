import { useEffect, useRef } from "react";

/**
 * Vuelve a pedir los datos sin que el usuario tenga que recargar la página.
 *
 * La app carga todo con `useEffect` + `useState` y solo al montar, así que
 * cualquier cambio hecho desde otra sesión (una propuesta nueva, un cambio de
 * estado de orden) quedaba invisible hasta un F5. Este hook cubre los dos
 * momentos en que un dato viejo se nota:
 *
 * - al volver a la pestaña (`visibilitychange` / `focus`), que es cuando el
 *   usuario mira de nuevo la pantalla,
 * - cada `intervalMs` mientras la pestaña está visible, para las pantallas que
 *   se dejan abiertas.
 *
 * Nunca refresca con la pestaña oculta: no tiene sentido gastar peticiones en
 * una vista que nadie está mirando.
 */
/**
 * Por qué se dispara el refresco. Permite que el llamador haga una recarga
 * completa al volver a la pestaña y una más barata en el tick periódico.
 */
export type AutoRefreshReason = "focus" | "interval";

export interface AutoRefreshOptions {
  /** Desactiva el hook (p. ej. mientras no hay sesión). */
  enabled?: boolean;
  /** Periodo del refresco en segundo plano. 0 lo desactiva. */
  intervalMs?: number;
  /** Tiempo mínimo entre dos refrescos, para no encadenarlos. */
  minIntervalMs?: number;
}

const DEFAULT_INTERVAL_MS = 45_000;
const DEFAULT_MIN_INTERVAL_MS = 5_000;

export function useAutoRefresh(
  refresh: (reason: AutoRefreshReason) => void | Promise<void>,
  { enabled = true, intervalMs = DEFAULT_INTERVAL_MS, minIntervalMs = DEFAULT_MIN_INTERVAL_MS }: AutoRefreshOptions = {},
): void {
  const refreshRef = useRef(refresh);
  const runningRef = useRef(false);
  const lastRunRef = useRef(0);

  // La función de refresco se recrea en cada render de App; guardarla en una ref
  // evita reinstalar listeners y timers constantemente.
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    async function run(reason: AutoRefreshReason) {
      if (runningRef.current) {
        return;
      }
      const now = Date.now();
      if (now - lastRunRef.current < minIntervalMs) {
        return;
      }
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      runningRef.current = true;
      lastRunRef.current = now;
      try {
        await refreshRef.current(reason);
      } catch {
        // Un refresco en segundo plano que falla no debe romper la pantalla:
        // el usuario sigue viendo los últimos datos buenos.
      } finally {
        runningRef.current = false;
      }
    }

    function handleVisible() {
      if (!cancelled && document.visibilityState === "visible") {
        void run("focus");
      }
    }

    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleVisible);
    window.addEventListener("online", handleVisible);

    const timer = intervalMs > 0 ? window.setInterval(() => void run("interval"), intervalMs) : undefined;

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleVisible);
      window.removeEventListener("online", handleVisible);
      if (timer !== undefined) {
        window.clearInterval(timer);
      }
    };
  }, [enabled, intervalMs, minIntervalMs]);
}
