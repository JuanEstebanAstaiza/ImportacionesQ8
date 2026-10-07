import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX } from "lucide-react";

import { resolveApiUrl } from "@/services/api-client";
import { encuadreParaPantalla, useEncuadrePreferido } from "@/app/components/media/VideoAdaptable";

/**
 * Varios videos que se van turnando solos, cada uno en la versión que le
 * corresponde a la pantalla (vertical en celular, horizontal en computador).
 *
 * Pasa al siguiente cuando el video termina o cuando se cumple el intervalo, lo
 * que ocurra primero. Arranca sin sonido (los navegadores solo dejan
 * reproducir solo así); quien mira puede activar el sonido, pausar o saltar.
 * Mientras el puntero está encima, o con «reducir movimiento» activado en el
 * sistema, no rota solo.
 *
 * Los videos deben ser públicos (los de la Landing lo son): se cargan por URL
 * directa para poder adelantar sin descargarlos enteros.
 */

export type VideoCarrusel = {
  id?: string;
  titulo?: string | null;
  horizontal?: string | null;
  vertical?: string | null;
};

type CarruselVideosProps = {
  videos: VideoCarrusel[];
  intervaloSegundos: number;
  className?: string;
};

function prefiereMenosMovimiento(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CarruselVideos({ videos, intervaloSegundos, className = "" }: CarruselVideosProps) {
  const preferido = useEncuadrePreferido();
  const reproducibles = videos
    .map((v) => {
      const encuadre = encuadreParaPantalla(preferido, v.horizontal, v.vertical);
      return encuadre ? { ...v, encuadre, url: (encuadre === "vertical" ? v.vertical : v.horizontal) as string } : null;
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(prefiereMenosMovimiento);
  const [silenciado, setSilenciado] = useState(true);
  const [encima, setEncima] = useState(false);
  const video = useRef<HTMLVideoElement | null>(null);

  const total = reproducibles.length;
  const actual = reproducibles[Math.min(indice, Math.max(total - 1, 0))];

  const ir = useCallback((destino: number) => {
    if (total > 0) setIndice(((destino % total) + total) % total);
  }, [total]);

  // Si cambia la lista (o la pantalla y con ella los reproducibles), se vuelve
  // a un índice válido.
  useEffect(() => {
    if (indice >= total) setIndice(0);
  }, [indice, total]);

  // Rotación por tiempo. Se reinicia en cada video y se detiene en pausa, con el
  // puntero encima o con la pestaña oculta.
  useEffect(() => {
    if (total < 2 || pausado || encima) return;
    let restante = intervaloSegundos * 1000;
    let inicio = Date.now();
    let temporizador = window.setTimeout(() => ir(indice + 1), restante);

    function visibilidad() {
      if (document.hidden) {
        window.clearTimeout(temporizador);
        restante -= Date.now() - inicio;
      } else {
        inicio = Date.now();
        temporizador = window.setTimeout(() => ir(indice + 1), Math.max(restante, 1000));
      }
    }
    document.addEventListener("visibilitychange", visibilidad);
    return () => {
      window.clearTimeout(temporizador);
      document.removeEventListener("visibilitychange", visibilidad);
    };
  }, [indice, total, pausado, encima, intervaloSegundos, ir]);

  // Reproducir o pausar el elemento según el estado.
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    el.muted = silenciado;
    if (pausado) {
      el.pause();
    } else {
      // Puede fallar si el navegador bloquea la reproducción automática: el
      // video queda en pausa y el botón de reproducir sigue disponible.
      el.play().catch(() => setPausado(true));
    }
  }, [actual?.url, pausado, silenciado]);

  if (!actual) return null;

  const vertical = actual.encuadre === "vertical";

  return (
    <div
      className={className}
      onMouseEnter={() => setEncima(true)}
      onMouseLeave={() => setEncima(false)}
      role="region"
      aria-roledescription="carrusel"
      aria-label="Videos de Zarpi"
    >
      <div
        className={`relative mx-auto overflow-hidden rounded-2xl bg-black shadow-lg ${
          vertical ? "aspect-[9/16] h-[min(75vh,680px)] max-w-full" : "aspect-video w-full"
        }`}
      >
        <video
          key={actual.url}
          ref={video}
          src={resolveApiUrl(actual.url)}
          className="h-full w-full object-cover"
          muted={silenciado}
          playsInline
          autoPlay={!pausado}
          preload="metadata"
          loop={total === 1}
          onEnded={() => { if (total > 1 && !pausado) ir(indice + 1); }}
          onError={() => { if (total > 1) ir(indice + 1); }}
          aria-label={actual.titulo || `Video ${indice + 1} de ${total}`}
        />

        {actual.titulo ? (
          <p className="pointer-events-none absolute left-0 right-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-4 pb-6 pt-3 text-sm font-medium text-white">
            {actual.titulo}
          </p>
        ) : null}

        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent px-3 pb-3 pt-8">
          <div className="flex gap-1.5">
            <BotonControl etiqueta={pausado ? "Reproducir" : "Pausar"} onClick={() => setPausado((p) => !p)}>
              {pausado ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </BotonControl>
            <BotonControl etiqueta={silenciado ? "Activar sonido" : "Silenciar"} onClick={() => setSilenciado((s) => !s)}>
              {silenciado ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </BotonControl>
          </div>
          {total > 1 ? (
            <div className="flex items-center gap-1.5">
              <BotonControl etiqueta="Video anterior" onClick={() => ir(indice - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </BotonControl>
              <div className="flex gap-1">
                {reproducibles.map((v, i) => (
                  <button
                    key={v.id ?? `${v.url}-${i}`}
                    type="button"
                    onClick={() => ir(i)}
                    aria-label={`Ir al video ${i + 1}`}
                    aria-current={i === indice}
                    className={`h-1.5 rounded-full transition-all ${i === indice ? "w-5 bg-[#EDF953]" : "w-1.5 bg-white/60 hover:bg-white"}`}
                  />
                ))}
              </div>
              <BotonControl etiqueta="Video siguiente" onClick={() => ir(indice + 1)}>
                <ChevronRight className="h-4 w-4" />
              </BotonControl>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BotonControl({ etiqueta, onClick, children }: { etiqueta: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EDF953]"
    >
      {children}
    </button>
  );
}
