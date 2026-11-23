import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import { ImageOff, Loader2, Play } from "lucide-react";

import { ImagenArchivo } from "@shared/ui/files/ImagenArchivo";
import { resolveApiUrl } from "@/services/api-client";
import { obtenerUrlLocalArchivo } from "@/utils/abrir-archivo";
import type { EstadoLote, MedioRef } from "@apps/liquidaciones/features/tipos";

const ESTADOS_PUBLICOS: EstadoLote[] = ["publicado", "reservado", "vendido"];

/** Hueco rayado para cuando un lote aún no tiene foto (o mientras carga). */
export function FotoVacia({ className, texto = "foto real del lote" }: { className?: string; texto?: string }) {
  return (
    <div
      className={clsx("flex items-center justify-center text-[11px] font-mono text-muted-foreground", className)}
      style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(127,127,127,.08) 0 10px, transparent 10px 20px)" }}
    >
      {texto}
    </div>
  );
}

export function FotoLote({ foto, alt, className }: { foto?: MedioRef | null; alt: string; className?: string }) {
  if (!foto) return <FotoVacia className={className} />;
  return <ImagenArchivo src={foto.url} alt={alt} className={clsx("w-full", className)} />;
}

/**
 * Video del lote. Publicado, se sirve directo con Range (se puede adelantar sin
 * descargarlo entero); en revisión solo lo ven el dueño y el equipo, así que se
 * descarga con la sesión.
 */
export function VideoLote({ video, estado, className }: { video: MedioRef; estado: EstadoLote; className?: string }) {
  const publico = ESTADOS_PUBLICOS.includes(estado);
  const [url, setUrl] = useState(publico ? resolveApiUrl(video.url) : "");
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    if (publico) {
      setUrl(resolveApiUrl(video.url));
      return;
    }
    let vigente = true;
    let local = "";
    obtenerUrlLocalArchivo(video.url)
      .then((resultado) => { local = resultado; if (vigente) setUrl(resultado); })
      .catch(() => { if (vigente) setFallo(true); });
    return () => {
      vigente = false;
      if (local.startsWith("blob:")) URL.revokeObjectURL(local);
    };
  }, [video.url, publico]);

  if (fallo) {
    return <div className={clsx("flex items-center justify-center bg-muted text-muted-foreground", className)}><ImageOff className="h-5 w-5" /></div>;
  }
  if (!url) {
    return <div className={clsx("flex items-center justify-center bg-muted text-muted-foreground", className)}><Loader2 className="h-4 w-4 animate-spin" /></div>;
  }
  return <video src={url} controls preload="metadata" className={clsx("bg-black object-contain", className)} />;
}

function FotoConZoom({ foto, nombre }: { foto: MedioRef; nombre: string }) {
  const [zoom, setZoom] = useState<{
    src: string; left: number; top: number; size: number;
    backgroundWidth: number; backgroundHeight: number; x: number; y: number;
  } | null>(null);

  function mover(e: MouseEvent<HTMLDivElement>) {
    const imagen = e.currentTarget.querySelector("img");
    if (!imagen || !imagen.naturalWidth || !imagen.naturalHeight) return;
    const rect = imagen.getBoundingClientRect();
    const escala = Math.min(rect.width / imagen.naturalWidth, rect.height / imagen.naturalHeight);
    const ancho = imagen.naturalWidth * escala;
    const alto = imagen.naturalHeight * escala;
    const x = e.clientX - rect.left - (rect.width - ancho) / 2;
    const y = e.clientY - rect.top - (rect.height - alto) / 2;
    if (x < 0 || y < 0 || x > ancho || y > alto) {
      setZoom(null);
      return;
    }

    const size = Math.min(300, window.innerWidth - 24, window.innerHeight - 24);
    const ampliacion = Math.max(2.5, size / ancho, size / alto);
    const backgroundWidth = ancho * ampliacion;
    const backgroundHeight = alto * ampliacion;
    const left = rect.right + size + 12 <= window.innerWidth
      ? rect.right + 8
      : rect.left - size - 8 >= 0 ? rect.left - size - 8 : Math.max(12, Math.min(rect.right - size, window.innerWidth - size - 12));
    setZoom({
      src: imagen.currentSrc,
      left,
      top: Math.max(12, Math.min(rect.top, window.innerHeight - size - 12)),
      size,
      backgroundWidth,
      backgroundHeight,
      x: Math.max(size - backgroundWidth, Math.min(0, size / 2 - x * ampliacion)),
      y: Math.max(size - backgroundHeight, Math.min(0, size / 2 - y * ampliacion)),
    });
  }

  return (
    <div className="h-full w-full [&_img]:!object-contain" onMouseMove={mover} onMouseLeave={() => setZoom(null)} onWheel={() => setZoom(null)}>
      <FotoLote foto={foto} alt={nombre} className="h-full object-contain" />
      {zoom && createPortal(
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 rounded-xl border border-border bg-white shadow-xl"
          style={{
            left: zoom.left, top: zoom.top, width: zoom.size, height: zoom.size,
            backgroundImage: `url("${zoom.src}")`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${zoom.backgroundWidth}px ${zoom.backgroundHeight}px`,
            backgroundPosition: `${zoom.x}px ${zoom.y}px`,
          }}
        />,
        document.body,
      )}
    </div>
  );
}

/** Galería de la ficha: una vista grande y las miniaturas (fotos y videos). */
export function GaleriaLote({ fotos, videos, estado, nombre }: { fotos: MedioRef[]; videos: MedioRef[]; estado: EstadoLote; nombre: string }) {
  const medios = [...fotos.map((m) => ({ ...m, tipo: "foto" as const })), ...videos.map((m) => ({ ...m, tipo: "video" as const }))];
  const [indice, setIndice] = useState(0);
  const actual = medios[Math.min(indice, medios.length - 1)];

  return (
    <div className="space-y-3">
      <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-white">
        {!actual ? (
          <FotoVacia className="h-full w-full" />
        ) : actual.tipo === "video" ? (
          <VideoLote video={actual} estado={estado} className="h-full w-full" />
        ) : (
          <FotoConZoom key={actual.id} foto={actual} nombre={nombre} />
        )}
      </div>
      {medios.length > 1 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {medios.map((medio, i) => (
            <button
              key={medio.id}
              type="button"
              onClick={() => setIndice(i)}
              className={clsx(
                "relative aspect-square overflow-hidden rounded-lg border bg-white transition",
                i === indice ? "border-primary ring-2 ring-primary/30 dark:border-accent dark:ring-accent/30" : "border-border hover:border-muted-foreground/40",
              )}
              aria-label={medio.tipo === "video" ? `Video ${i + 1}` : `Foto ${i + 1}`}
            >
              {medio.tipo === "video" ? (
                <span className="flex h-full w-full items-center justify-center bg-black/80 text-white"><Play className="h-5 w-5" /></span>
              ) : (
                <FotoLote foto={medio} alt={`${nombre} ${i + 1}`} className="h-full" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
