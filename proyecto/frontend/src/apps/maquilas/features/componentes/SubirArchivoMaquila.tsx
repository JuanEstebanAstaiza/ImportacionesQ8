import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@shared/ui/design-system";
import { maquilasService } from "@/services/maquilas.service";
import type { ArchivoMaquila, TipoArchivoMaquila } from "@apps/maquilas/features/tipos";

const ACEPTA: Record<TipoArchivoMaquila, string> = {
  foto: "image/jpeg,image/png,image/webp",
  rut: "application/pdf,image/jpeg,image/png",
  camara_comercio: "application/pdf,image/jpeg,image/png",
  certificado: "application/pdf,image/jpeg,image/png",
  referencia: "image/jpeg,image/png,image/webp",
  ficha_tecnica: "application/pdf",
  muestra: "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime",
  evidencia: "image/jpeg,image/png,image/webp",
  comprobante: "application/pdf,image/jpeg,image/png",
  adjunto: "application/pdf,image/jpeg,image/png",
};

/**
 * Botón para subir al GridFS del módulo, con progreso. Valida el tamaño antes
 * de subir para no hacer esperar una subida que el backend rechazaría.
 */
export function SubirArchivoMaquila({
  tipo,
  etiqueta,
  maxMb,
  multiple = false,
  maxArchivos = 1,
  disabled,
  compacto = false,
  onSubido,
}: {
  tipo: TipoArchivoMaquila;
  etiqueta: string;
  maxMb?: number;
  multiple?: boolean;
  maxArchivos?: number;
  disabled?: boolean;
  /** Solo el icono (p. ej. el clip del chat). */
  compacto?: boolean;
  onSubido: (archivo: ArchivoMaquila) => void;
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
        onSubido(await maquilasService.subirArchivo(tipo, archivo, setProgreso));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo subir el archivo");
      }
    }
    setProgreso(null);
  }

  return (
    <>
      <input ref={input} type="file" className="hidden" accept={ACEPTA[tipo]} multiple={multiple}
        onChange={(e) => void alElegir(e.target.files)} />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled || progreso !== null}
        icon={progreso !== null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        onClick={() => input.current?.click()}
        aria-label={compacto ? etiqueta : undefined}
        title={compacto ? etiqueta : undefined}
      >
        {compacto ? (progreso !== null ? `${progreso}%` : null) : progreso !== null ? `Subiendo… ${progreso}%` : etiqueta}
      </Button>
    </>
  );
}
