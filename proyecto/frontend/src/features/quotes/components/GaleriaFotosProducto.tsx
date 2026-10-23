import { toast } from "sonner";
import { ImagenArchivo } from "@/components/files/ImagenArchivo";
import { abrirArchivoEnPestana } from "@/utils/abrir-archivo";

export function GaleriaFotosProducto({ fotos }: { fotos: string[] }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">Fotos del producto ({fotos.length})</p>
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {fotos.map((url, index) => (
          <button key={url} type="button" onClick={() => { void abrirArchivoEnPestana(url).then((result) => { if (!result.ok) toast.error(result.motivo || "No se pudo abrir la foto."); }); }} className="aspect-square rounded-lg overflow-hidden border border-border hover:ring-2 hover:ring-primary/40 transition" title={`Ver foto ${index + 1}`}>
            <ImagenArchivo src={url} alt={`Foto ${index + 1} del producto`} className="w-full h-full" />
          </button>
        ))}
      </div>
    </div>
  );
}
