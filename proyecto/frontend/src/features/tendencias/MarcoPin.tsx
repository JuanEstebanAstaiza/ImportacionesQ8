/** Mismo pie que proporcion_pin en backend/services/enlaces_video.py. */
const ALTO_PIE_PIN = 100;
/** Proporción de un pin típico (2:3) cuando el oEmbed no la dio. */
const PROPORCION_POR_DEFECTO = 1.5;

/**
 * Reproductor oficial de un pin de Pinterest. A diferencia de TikTok o YouTube,
 * el pin es una tarjeta: la imagen a lo ancho más un pie fijo con el título y
 * quién lo publicó. El marco se calcula con la proporción de la imagen para que
 * no quede espacio vacío debajo, y se angosta si la tarjeta no cabe en el 80 %
 * del alto de la pantalla.
 */
export function MarcoPin({
  src,
  titulo,
  proporcion,
  anchoMaximo = 450,
  className = "",
}: {
  src: string;
  titulo: string;
  proporcion: number | null | undefined;
  anchoMaximo?: number;
  className?: string;
}) {
  const r = proporcion && proporcion > 0.2 && proporcion < 5 ? proporcion : PROPORCION_POR_DEFECTO;
  return (
    <div
      className={`mx-auto w-full overflow-hidden rounded-2xl ${className}`}
      style={{
        containerType: "inline-size",
        maxWidth: `min(${anchoMaximo}px, calc((80vh - ${ALTO_PIE_PIN}px) / ${r}))`,
      }}
    >
      <iframe
        src={src}
        title={titulo}
        scrolling="no"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        className="block w-full border-0"
        style={{ height: `calc(100cqw * ${r} + ${ALTO_PIE_PIN}px)` }}
      />
    </div>
  );
}
