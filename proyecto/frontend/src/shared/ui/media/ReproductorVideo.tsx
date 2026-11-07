import { useEffect, useState } from "react";

import { getStoredToken, resolveApiUrl } from "@/services/api-client";

/**
 * Contenedores que gestión documental acepta y que un <video> reproduce de
 * forma nativa. Debe coincidir con `VIDEO_EXTENSIONS` del backend: si aquí se
 * ofrece un formato que allá se rechaza, la subida falla y el archivo nunca
 * aparece en Documentos.
 */
export const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v"];
export const VIDEO_FORMATS_LABEL = "MP4, WebM, MOV o M4V";
export const VIDEO_UPLOAD_ACCEPT = ".mp4,.webm,.mov,.m4v,video/mp4,video/webm,video/quicktime,video/x-m4v";

type VideoLoadError = "forbidden" | "missing" | "network";

const VIDEO_ERROR_MESSAGE: Record<VideoLoadError, string> = {
  forbidden: "No tienes acceso a este video. Inscríbete en el curso para verlo completo.",
  missing: "El archivo del video ya no está disponible en gestión documental.",
  network: "No se pudo contactar al servidor para cargar el video.",
};

type ProtectedVideoPlayerProps = {
  url: string;
  onEnded?: () => void;
  onPlay?: () => void;
  /** Texto cuando el backend niega el acceso; por defecto, el de los cursos. */
  mensajeSinAcceso?: string;
  /** Clases del <video>; por defecto llena el contenedor. */
  className?: string;
};

/**
 * Reproductor de videos alojados en el backend (cursos, Tendencias).
 *
 * Si el archivo es público se usa la URL directa, que permite adelantar sin
 * descargarlo entero. Si exige sesión, un <video src> no puede mandar la
 * cabecera Authorization, así que se descarga con el token y se reproduce
 * desde un blob.
 */
export function ProtectedVideoPlayer({ url, onEnded, onPlay, mensajeSinAcceso, className = "h-full w-full" }: ProtectedVideoPlayerProps) {
  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [loadError, setLoadError] = useState<VideoLoadError | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let isCancelled = false;

    async function loadVideo(): Promise<void> {
      setLoadError(null);
      setMediaUrl("");

      const absoluteUrl = resolveApiUrl(url);
      if (!absoluteUrl) {
        setLoadError("missing");
        return;
      }

      try {
        // Portadas y lecciones de vista previa son públicas en el backend: si
        // responde sin token se usa la URL directa, que conserva la búsqueda
        // por Range en vez de descargar el archivo entero.
        const publicProbe = await fetch(absoluteUrl, { headers: { Range: "bytes=0-0" } });
        if (publicProbe.ok) {
          if (!isCancelled) {
            setMediaUrl(absoluteUrl);
          }
          return;
        }

        // Para el material privado hay que mandar Authorization, y un
        // <video src> no puede llevar cabeceras: se descarga y se reproduce
        // desde un blob. Nunca se cae a la URL cruda, que volvería a dar 401.
        const token = getStoredToken();
        const response = token
          ? await fetch(absoluteUrl, { headers: { Authorization: `Bearer ${token}` } })
          : publicProbe;

        if (!response.ok) {
          if (!isCancelled) {
            setLoadError(response.status === 404 ? "missing" : "forbidden");
          }
          return;
        }

        const blob = await response.blob();
        objectUrl = window.URL.createObjectURL(blob);
        if (!isCancelled) {
          setMediaUrl(objectUrl);
        }
      } catch {
        if (!isCancelled) {
          setLoadError("network");
        }
      }
    }

    void loadVideo();

    return () => {
      isCancelled = true;
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url]);

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        {loadError === "forbidden" && mensajeSinAcceso ? mensajeSinAcceso : VIDEO_ERROR_MESSAGE[loadError]}
      </div>
    );
  }

  if (!mediaUrl) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Cargando video...
      </div>
    );
  }

  return (
    <video
      src={mediaUrl}
      controls
      playsInline
      preload="metadata"
      className={className}
      onEnded={onEnded}
      onPlay={onPlay}
    />
  );
}
