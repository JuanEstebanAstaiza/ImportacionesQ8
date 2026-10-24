import { useEffect, useState } from "react";

import { tiempoRestante } from "@/features/liquidaciones/constantes";

/** Reloj compartido: se refresca cada minuto, que es la resolución que se muestra. */
export function useAhora(intervaloMs = 30_000): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), intervaloMs);
    return () => window.clearInterval(id);
  }, [intervaloMs]);
  return ahora;
}

export function CuentaRegresiva({ hasta, prefijo = "" }: { hasta: string | null | undefined; prefijo?: string }) {
  const ahora = useAhora();
  if (!hasta) return null;
  return <>{prefijo}{tiempoRestante(hasta, ahora)}</>;
}
