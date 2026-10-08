import { useEffect, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";

import { ProtectedVideoPlayer } from "@/app/components/media/ReproductorVideo";

/**
 * Video grabado en dos encuadres: horizontal (16:9, para computador) y vertical
 * (9:16, para celular). Se muestra el que corresponde a la pantalla; si solo
 * hay uno, ese se ve en todas. Cuando existen los dos, quien mira puede
 * cambiar de versión.
 */

export type Encuadre = "horizontal" | "vertical";

// Celulares y tabletas en vertical: ahí rinde el video 9:16.
const CONSULTA_MOVIL = "(max-width: 767px), (orientation: portrait) and (max-width: 1024px)";

function pantallaMovil(): boolean {
  return typeof window !== "undefined" && window.matchMedia(CONSULTA_MOVIL).matches;
}

export function useEncuadrePreferido(): Encuadre {
  const [movil, setMovil] = useState(pantallaMovil);
  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_MOVIL);
    const cambio = () => setMovil(consulta.matches);
    consulta.addEventListener("change", cambio);
    return () => consulta.removeEventListener("change", cambio);
  }, []);
  return movil ? "vertical" : "horizontal";
}

/** El encuadre que se mostraría en esta pantalla, o null si no hay video. */
export function encuadreParaPantalla(
  preferido: Encuadre,
  horizontal?: string | null,
  vertical?: string | null,
): Encuadre | null {
  if (preferido === "vertical") return vertical ? "vertical" : horizontal ? "horizontal" : null;
  return horizontal ? "horizontal" : vertical ? "vertical" : null;
}

type VideoAdaptableProps = {
  horizontal?: string | null;
  vertical?: string | null;
  /** Se llama la primera vez que se reproduce, con el encuadre que se vio. */
  onReproducir?: (encuadre: Encuadre) => void;
  mensajeSinAcceso?: string;
  className?: string;
};

export function VideoAdaptable({ horizontal, vertical, onReproducir, mensajeSinAcceso, className = "" }: VideoAdaptableProps) {
  const preferido = useEncuadrePreferido();
  const [elegido, setElegido] = useState<Encuadre | null>(null);
  const [reproducido, setReproducido] = useState(false);

  const encuadre = encuadreParaPantalla(elegido ?? preferido, horizontal, vertical);
  if (!encuadre) return null;
  const url = encuadre === "vertical" ? vertical! : horizontal!;
  const ambos = Boolean(horizontal && vertical);

  return (
    <div className={className}>
      <div
        className={`mx-auto overflow-hidden rounded-xl bg-black ${
          encuadre === "vertical" ? "aspect-[9/16] h-[min(70vh,640px)] max-w-full" : "aspect-video w-full"
        }`}
      >
        <ProtectedVideoPlayer
          key={url}
          url={url}
          mensajeSinAcceso={mensajeSinAcceso}
          className="h-full w-full object-contain"
          onPlay={() => {
            if (!reproducido) {
              setReproducido(true);
              onReproducir?.(encuadre);
            }
          }}
        />
      </div>
      {ambos ? (
        <div className="mt-2 flex justify-center gap-1" role="group" aria-label="Versión del video">
          {([
            ["horizontal", Monitor, "Computador"],
            ["vertical", Smartphone, "Celular"],
          ] as const).map(([valor, Icono, etiqueta]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setElegido(valor)}
              aria-pressed={encuadre === valor}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                encuadre === valor
                  ? "bg-primary text-white dark:bg-accent dark:text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icono className="h-3.5 w-3.5" /> {etiqueta}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
