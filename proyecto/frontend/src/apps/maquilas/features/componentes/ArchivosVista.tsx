import { FileText, PlayCircle, X } from "lucide-react";

import { ImagenArchivo } from "@shared/ui/files/ImagenArchivo";
import { abrirArchivoEnPestana } from "@/utils/abrir-archivo";
import { esImagen } from "@apps/maquilas/features/formato";
import type { ArchivoMaquila } from "@apps/maquilas/features/tipos";

/**
 * Miniaturas de archivos del módulo: las imágenes se ven en cuadrícula y lo demás
 * (PDF, video) como un botón que abre el archivo con la sesión. Con `onQuitar`,
 * cada uno tiene su botón para sacarlo (antes de enviar un formulario).
 */
export function ArchivosVista({ archivos, onQuitar, tamano = "md" }: {
  archivos: ArchivoMaquila[];
  onQuitar?: (id: string) => void;
  tamano?: "sm" | "md";
}) {
  if (!archivos.length) return null;
  const lado = tamano === "sm" ? "h-16 w-16" : "h-24 w-24";
  return (
    <ul className="flex flex-wrap gap-2">
      {archivos.map((a, i) => (
        <li key={a.id} className="relative">
          {esImagen(a.content_type) ? (
            <button type="button" onClick={() => void abrirArchivoEnPestana(a.url, a.nombre)}
              className={`${lado} overflow-hidden rounded-lg border border-border bg-muted`} aria-label={`Abrir ${a.nombre || `imagen ${i + 1}`}`}>
              <ImagenArchivo src={a.url} alt={a.nombre || `Imagen ${i + 1}`} className="h-full w-full object-cover" />
            </button>
          ) : (
            <button type="button" onClick={() => void abrirArchivoEnPestana(a.url, a.nombre)}
              className="flex max-w-[220px] items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-xs hover:bg-muted">
              {a.content_type?.startsWith("video/") ? <PlayCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                : <FileText className="h-4 w-4 flex-shrink-0" aria-hidden="true" />}
              <span className="truncate">{a.nombre || "Archivo"}</span>
            </button>
          )}
          {onQuitar && (
            <button type="button" onClick={() => onQuitar(a.id)} aria-label={`Quitar ${a.nombre || "archivo"}`}
              className="absolute -right-1.5 -top-1.5 rounded-full bg-black/70 p-0.5 text-white hover:bg-black">
              <X className="h-3 w-3" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
