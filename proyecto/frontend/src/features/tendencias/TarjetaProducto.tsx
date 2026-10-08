import type { KeyboardEvent, MouseEvent } from "react";
import { Bookmark, ImageOff, PlayCircle, Sparkles } from "lucide-react";

import { ImagenArchivo } from "@/app/components/files/ImagenArchivo";
import { VideoAdaptable } from "@/app/components/media/VideoAdaptable";
import { tendenciasService, type ProductoTendencia } from "@/services/tendencias.service";
import { EstadoChip, EtiquetaRequisitos } from "@/features/tendencias/ui";

/**
 * Tarjeta de producto de la sección negra de Tendencias. Sin precios ni
 * "comprar": la única acción comercial es pedir propuestas, desde la ficha.
 */

type TarjetaProductoProps = {
  producto: ProductoTendencia;
  guardado: boolean;
  onAbrir: () => void;
  onAlternarGuardado: () => void;
  /** El destacado de la edición: más grande y con el botón de pedir propuestas a la vista. */
  destacado?: boolean;
  onPedirPropuestas?: () => void;
  /** Para atribuir la reproducción del video a la edición en las métricas. */
  edicionId?: string | null;
};

function tieneVideo(producto: ProductoTendencia): boolean {
  return Boolean(producto.video_horizontal || producto.video_vertical);
}

function Foto({ producto, className }: { producto: ProductoTendencia; className: string }) {
  const foto = producto.fotos[0];
  if (!foto) {
    return (
      <div className={`flex items-center justify-center bg-white/5 text-white/40 ${className}`}>
        <ImageOff className="h-6 w-6" />
      </div>
    );
  }
  return <ImagenArchivo src={foto} alt={producto.nombre} className={className} />;
}

function BotonGuardar({ guardado, onClick }: { guardado: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e: MouseEvent) => { e.stopPropagation(); onClick(); }}
      aria-pressed={guardado}
      aria-label={guardado ? "Quitar de guardados" : "Guardar producto"}
      title={guardado ? "Quitar de guardados" : "Guardar"}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EDF953] ${
        guardado
          ? "border-[#EDF953] bg-[#EDF953] text-[#16151B]"
          : "border-white/20 bg-black/40 text-white backdrop-blur hover:border-white/50"
      }`}
    >
      <Bookmark className={`h-4 w-4 ${guardado ? "fill-current" : ""}`} />
    </button>
  );
}

export function TarjetaProducto({
  producto,
  guardado,
  onAbrir,
  onAlternarGuardado,
  destacado = false,
  onPedirPropuestas,
  edicionId = null,
}: TarjetaProductoProps) {
  const alTeclear = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onAbrir();
    }
  };

  if (destacado) {
    return (
      <article
        role="button"
        tabIndex={0}
        onClick={onAbrir}
        onKeyDown={alTeclear}
        className="group grid cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-[#18171C] text-white transition-colors hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EDF953] sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
      >
        <div className="relative">
          {tieneVideo(producto) ? (
            // El video del destacado se reproduce ahí mismo; los clics sobre él
            // no abren la ficha.
            <div
              className="flex h-full items-center bg-black pt-12 sm:pt-0"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <VideoAdaptable
                className="w-full p-2"
                horizontal={producto.video_horizontal}
                vertical={producto.video_vertical}
                mensajeSinAcceso="Necesitas una suscripción vigente a Tendencias para ver este video."
                onReproducir={(encuadre) => {
                  void tendenciasService.registrarEvento("video_reproducido", {
                    producto_id: producto.id,
                    encuadre,
                    ...(edicionId ? { edicion_id: edicionId } : {}),
                  });
                }}
              />
            </div>
          ) : (
            <Foto producto={producto} className="aspect-square w-full sm:h-full" />
          )}
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#EDF953] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#16151B]">
            <Sparkles className="h-3 w-3" />
            Destacado
          </span>
          <div className="absolute right-3 top-3">
            <BotonGuardar guardado={guardado} onClick={onAlternarGuardado} />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3 p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">{producto.categoria_visible}</p>
          <h3 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{producto.nombre}</h3>
          <div className="flex flex-wrap gap-1.5">
            <EstadoChip fechas={producto.fechas} />
            {producto.revisar_requisitos && <EtiquetaRequisitos />}
          </div>
          <p className="text-sm leading-relaxed text-white/80 sm:text-base">{producto.por_que_ahora}</p>
          {(producto.fechas.texto_mar || producto.fechas.texto_aereo) && (
            <p className="text-sm text-white/60">
              {producto.transporte_sugerido === "aereo"
                ? producto.fechas.texto_aereo || producto.fechas.texto_mar
                : producto.fechas.texto_mar || producto.fechas.texto_aereo}
            </p>
          )}
          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            {onPedirPropuestas && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onPedirPropuestas(); }}
                className="inline-flex h-10 items-center rounded-lg bg-[#EDF953] px-4 text-sm font-semibold text-[#16151B] transition-opacity hover:opacity-90"
              >
                Pedir propuestas
              </button>
            )}
            <span className="inline-flex h-10 items-center rounded-lg border border-white/20 px-4 text-sm font-medium text-white/90 group-hover:border-white/40">
              Ver cuándo pedirlo
            </span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={alTeclear}
      className="group flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-white/10 bg-[#18171C] text-white transition-colors hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EDF953]"
    >
      <div className="relative">
        <Foto producto={producto} className="aspect-square w-full" />
        {tieneVideo(producto) && (
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            <PlayCircle className="h-3.5 w-3.5" /> Video
          </span>
        )}
        <div className="absolute right-2.5 top-2.5">
          <BotonGuardar guardado={guardado} onClick={onAlternarGuardado} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{producto.categoria_visible}</p>
        <h3 className="text-base font-bold leading-snug">{producto.nombre}</h3>
        <p className="line-clamp-3 text-sm leading-relaxed text-white/70">{producto.por_que_ahora}</p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          <EstadoChip fechas={producto.fechas} />
          {producto.revisar_requisitos && <EtiquetaRequisitos />}
        </div>
      </div>
    </article>
  );
}
