import type { ReactNode } from "react";
import { clsx } from "clsx";

import type { LandingBlock, LandingFontFamily } from "@/services/landing.service";

/**
 * Un bloque del CMS de la landing. Lo usan la landing pública y la vista previa
 * del editor, para que lo que el admin ve al editar sea lo que se publica.
 *
 * Fuentes: "titulos" y "texto" siguen a la tipografía de la plataforma (el
 * gestor de Tipografía cambia `--font-display` y `--font-avenor`); "elvellon"
 * y "avenor" son las de marca fijas. Las clases están en styles/theme.css y no
 * son las utilitarias `.font-elvellon`/`.font-avenor`, que el gestor pisa con
 * `!important` para el resto de la plataforma.
 */

/** "auto" sigue el tema de la página (`dark:`); la vista previa fuerza uno. */
export type ModoBloque = "auto" | "claro" | "oscuro";

export const CLASE_FUENTE: Record<LandingFontFamily, string> = {
  titulos: "fuente-titulos",
  texto: "fuente-texto",
  elvellon: "fuente-marca-elvellon",
  avenor: "fuente-marca-avenor",
};

/** Tolera valores viejos o desconocidos: caen en la fuente de texto. */
export function claseFuente(fuente: string | null | undefined): string {
  return CLASE_FUENTE[fuente as LandingFontFamily] ?? CLASE_FUENTE.texto;
}

export const TAMANOS_TITULO = ["xl", "lg", "md", "sm"];
export const TAMANOS_TEXTO = ["lg", "md", "sm"];
export const CLASE_TAMANO_TITULO: Record<string, string> = { xl: "text-3xl font-bold", lg: "text-2xl font-bold", md: "text-xl font-semibold", sm: "text-lg font-semibold" };
export const CLASE_TAMANO_TEXTO: Record<string, string> = { lg: "text-base", md: "text-sm", sm: "text-xs" };
export const CLASE_ALINEACION: Record<string, string> = { left: "text-left", center: "text-center", right: "text-right" };

// Tokens de marca: cada uno con su versión automática (`dark:`) y las dos
// forzadas, escritas completas para que Tailwind las genere.
const TOKEN_TEXTO: Record<string, Record<ModoBloque, string>> = {
  primary: { auto: "text-[#4F06EB] dark:text-[#EDF953]", claro: "text-[#4F06EB]", oscuro: "text-[#EDF953]" },
  surface: { auto: "text-black dark:text-white", claro: "text-black", oscuro: "text-white" },
  border: { auto: "text-slate-400 dark:text-zinc-500", claro: "text-slate-400", oscuro: "text-zinc-500" },
  foreground: { auto: "text-black dark:text-white", claro: "text-black", oscuro: "text-white" },
  muted: { auto: "text-slate-500 dark:text-zinc-400", claro: "text-slate-500", oscuro: "text-zinc-400" },
};
const TOKEN_BOTON: Record<string, Record<ModoBloque, string>> = {
  primary: { auto: "bg-[#4F06EB] text-white dark:bg-[#EDF953] dark:text-black", claro: "bg-[#4F06EB] text-white", oscuro: "bg-[#EDF953] text-black" },
  surface: { auto: "bg-white text-black dark:bg-[#0F0F0F] dark:text-white", claro: "bg-white text-black", oscuro: "bg-[#0F0F0F] text-white" },
  border: { auto: "bg-transparent border border-slate-200 dark:border-zinc-800", claro: "bg-transparent border border-slate-200", oscuro: "bg-transparent border border-zinc-800" },
  foreground: { auto: "bg-black text-white dark:bg-white dark:text-black", claro: "bg-black text-white", oscuro: "bg-white text-black" },
  muted: { auto: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300", claro: "bg-slate-100 text-slate-600", oscuro: "bg-zinc-800 text-zinc-300" },
};
const BORDE_MEDIO: Record<ModoBloque, string> = {
  auto: "border-slate-200 dark:border-zinc-800",
  claro: "border-slate-200",
  oscuro: "border-zinc-800",
};

export function BloqueLanding({
  block,
  modo = "auto",
  onBoton,
  imagen,
  video,
}: {
  block: LandingBlock;
  modo?: ModoBloque;
  /** Sin él, el botón se muestra pero no hace nada (vista previa). */
  onBoton?: () => void;
  /** Cómo se dibuja una imagen o un video: la landing usa la URL pública; el editor, la protegida. */
  imagen: (ruta: string, className: string) => ReactNode;
  video: (ruta: string, className: string) => ReactNode;
}) {
  const alineacion = CLASE_ALINEACION[block.alineacion] || "text-left";
  const colorTexto = (TOKEN_TEXTO[block.token_color] ?? TOKEN_TEXTO.foreground)[modo];

  if (block.tipo === "heading" || block.tipo === "paragraph") {
    const tamano = block.tipo === "heading"
      ? CLASE_TAMANO_TITULO[block.tamano_fuente] || CLASE_TAMANO_TITULO.md
      : CLASE_TAMANO_TEXTO[block.tamano_fuente] || CLASE_TAMANO_TEXTO.md;
    // pre-line: los saltos de línea que el admin escribe se respetan.
    return (
      <p className={clsx(alineacion, colorTexto, claseFuente(block.fuente), tamano, "whitespace-pre-line break-words")}>
        {block.contenido}
      </p>
    );
  }
  if (block.tipo === "image") {
    if (!block.contenido) return null;
    return <div className={alineacion}>{imagen(block.contenido, clsx("inline-block max-h-80 rounded-xl border object-cover", BORDE_MEDIO[modo]))}</div>;
  }
  if (block.tipo === "video") {
    if (!block.contenido) return null;
    return <div className={alineacion}>{video(block.contenido, clsx("inline-block max-h-80 w-full max-w-2xl rounded-xl border", BORDE_MEDIO[modo]))}</div>;
  }
  if (block.tipo === "button") {
    const clase = clsx("inline-flex items-center rounded-lg px-6 py-3 text-sm font-semibold", (TOKEN_BOTON[block.token_color] ?? TOKEN_BOTON.primary)[modo]);
    return (
      <div className={alineacion}>
        {onBoton
          ? <button type="button" onClick={onBoton} className={clase}>{block.contenido || "Continuar"}</button>
          : <span className={clase}>{block.contenido || "Continuar"}</span>}
      </div>
    );
  }
  return null;
}
