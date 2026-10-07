import { useEffect, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";

import { obtenerUrlLocalArchivo } from "@/lib/abrir-archivo";

type ImagenArchivoProps = {
  src: string;
  alt: string;
  className?: string;
};

/** Imagen alojada en el backend, descargada con la sesión del usuario. */
export function ImagenArchivo({ src, alt, className }: ImagenArchivoProps) {
  const [url, setUrl] = useState("");
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vigente = true;
    let local = "";
    setUrl("");
    setFallo(false);
    obtenerUrlLocalArchivo(src)
      .then((resultado) => {
        local = resultado;
        if (vigente) setUrl(resultado);
        else if (resultado.startsWith("blob:")) URL.revokeObjectURL(resultado);
      })
      .catch(() => { if (vigente) setFallo(true); });
    return () => {
      vigente = false;
      if (local.startsWith("blob:")) URL.revokeObjectURL(local);
    };
  }, [src]);

  if (fallo) {
    return (
      <div className={`flex items-center justify-center bg-muted text-muted-foreground ${className ?? ""}`} title="No se pudo cargar la imagen">
        <ImageOff className="h-5 w-5" />
      </div>
    );
  }
  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-muted text-muted-foreground ${className ?? ""}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  return <img src={url} alt={alt} className={`object-cover ${className ?? ""}`} />;
}
