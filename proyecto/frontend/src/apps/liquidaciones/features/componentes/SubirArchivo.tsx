import { useRef, useState } from "react";
import { clsx } from "clsx";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { liquidacionesService } from "@/services/liquidaciones.service";
import type { ArchivoSubido, TipoArchivo } from "@apps/liquidaciones/features/tipos";

const ACEPTA: Record<TipoArchivo, string> = {
  foto: "image/jpeg,image/png,image/webp",
  video: "video/mp4,video/webm,video/quicktime",
  ficha_tecnica: "application/pdf",
  comprobante_pago: "application/pdf,image/jpeg,image/png",
  factura: "application/pdf,image/jpeg,image/png",
  rut: "application/pdf,image/jpeg,image/png",
};

/**
 * Botón para subir al GridFS del módulo, con barra de progreso. Valida el
 * tamaño antes de subir para no hacer esperar una subida que el backend
 * rechazaría al final.
 */
export function SubirArchivo({
  tipo,
  etiqueta,
  ayuda,
  maxMb,
  multiple = false,
  maxArchivos = 1,
  disabled,
  variante = "boton",
  onSubido,
}: {
  tipo: TipoArchivo;
  etiqueta: string;
  ayuda?: string;
  maxMb?: number;
  multiple?: boolean;
  maxArchivos?: number;
  disabled?: boolean;
  variante?: "boton" | "casilla";
  onSubido: (archivo: ArchivoSubido) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progreso, setProgreso] = useState<number | null>(null);

  async function alElegir(lista: FileList | null) {
    const archivos = Array.from(lista ?? []).slice(0, Math.max(maxArchivos, 1));
    if (input.current) input.current.value = "";
    for (const archivo of archivos) {
      if (maxMb && archivo.size > maxMb * 1024 * 1024) {
        toast.error(`«${archivo.name}» supera el máximo de ${maxMb} MB`);
        continue;
      }
      setProgreso(0);
      try {
        const subido = await liquidacionesService.subirArchivo(tipo, archivo, setProgreso);
        onSubido(subido);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo subir el archivo");
      }
    }
    setProgreso(null);
  }

  const ocupado = progreso !== null;

  return (
    <>
      <input
        ref={input}
        type="file"
        className="hidden"
        accept={ACEPTA[tipo]}
        multiple={multiple}
        onChange={(e) => void alElegir(e.target.files)}
      />
      {variante === "casilla" ? (
        <button
          type="button"
          disabled={disabled || ocupado}
          onClick={() => input.current?.click()}
          className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-accent/50"
        >
          {ocupado ? <><Loader2 className="h-4 w-4 animate-spin" />{progreso}%</> : <><Upload className="h-4 w-4" />{etiqueta}</>}
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled || ocupado}
          onClick={() => input.current?.click()}
          className={clsx(
            "flex w-full items-center gap-3 rounded-lg border border-border bg-white px-3 py-2.5 text-left transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-accent/40",
          )}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent">
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">{ocupado ? `Subiendo… ${progreso}%` : etiqueta}</span>
            {ayuda && <span className="block text-xs text-muted-foreground">{ayuda}</span>}
          </span>
        </button>
      )}
      {ocupado && variante === "boton" && (
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all dark:bg-accent" style={{ width: `${progreso}%` }} />
        </div>
      )}
    </>
  );
}
