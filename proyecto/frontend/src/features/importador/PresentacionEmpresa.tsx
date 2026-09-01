import { useCallback, useEffect, useState } from "react";
import { Clock, Film, ImageIcon, Trash2 } from "lucide-react";

import { DocumentUploadButton } from "@/app/components/files/DocumentUploadButton";
import {
  businessService,
  type BackendEvidenciaImportador,
  type TipoEvidenciaImportador,
} from "@/services/business.service";
import { resolveApiUrl, toApiPath } from "@/services/api-client";

/**
 * Presentación breve de la empresa importadora: un video corto y algunas fotos.
 *
 * Los archivos se suben a gestión documental y se guarda su ruta canónica, no
 * una URL absoluta: así siguen resolviendo desde cualquier entorno. Pasan por
 * la moderación del equipo de la plataforma (`estado`) y solo las **aprobadas**
 * se sirven sin sesión, que es lo que permite reproducirlas en la ficha pública
 * a un visitante que todavía no se ha registrado.
 */

const TIPOS_VISIBLES: TipoEvidenciaImportador[] = ["video_presentacion", "foto_producto", "foto_fabrica"];

const VIDEO_ACCEPT = ".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime";
const IMAGEN_ACCEPT = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";

function esVideo(evidencia: BackendEvidenciaImportador): boolean {
  return evidencia.tipo === "video_presentacion";
}

function EtiquetaEstado({ estado }: { estado: string }) {
  if (estado === "aprobada") {
    return <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">Publicada</span>;
  }
  if (estado === "rechazada") {
    return <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-red-50 text-red-700">Rechazada</span>;
  }
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-700 inline-flex items-center gap-1">
      <Clock className="w-3 h-3" />
      En revisión
    </span>
  );
}

function Pieza({ evidencia }: { evidencia: BackendEvidenciaImportador }) {
  const fuente = resolveApiUrl(evidencia.url);
  return (
    <figure className="rounded-xl border border-border overflow-hidden bg-white">
      <div className="aspect-video bg-slate-100 flex items-center justify-center">
        {esVideo(evidencia) ? (
          <video src={fuente} controls preload="metadata" className="w-full h-full object-cover">
            Tu navegador no puede reproducir este video.
          </video>
        ) : (
          <img src={fuente} alt={evidencia.titulo} className="w-full h-full object-cover" loading="lazy" />
        )}
      </div>
      <figcaption className="px-3 py-2">
        <p className="text-sm font-medium truncate">{evidencia.titulo}</p>
        {evidencia.descripcion ? (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{evidencia.descripcion}</p>
        ) : null}
      </figcaption>
    </figure>
  );
}

/** Bloque de solo lectura para la ficha pública que ve el solicitante. */
export function PresentacionPublica({ importadorId }: { importadorId: string }) {
  const [piezas, setPiezas] = useState<BackendEvidenciaImportador[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    if (!importadorId) {
      return;
    }

    void businessService
      .listPublicImporterEvidence(importadorId)
      .then((filas) => {
        if (!cancelado) {
          setPiezas(filas.filter((fila) => TIPOS_VISIBLES.includes(fila.tipo)));
        }
      })
      .catch(() => {
        if (!cancelado) setPiezas([]);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => { cancelado = true; };
  }, [importadorId]);

  if (cargando) {
    return null;
  }

  // Cuando la empresa todavía no ha publicado nada se enseña el hueco en vez de
  // desaparecer: al solicitante le dice algo real sobre el proveedor que está
  // comparando, y a la empresa le hace descubrir que la sección existe.
  if (piezas.length === 0) {
    return null;
  }

  // El video de presentación va primero: es lo que resume la empresa de un vistazo.
  const ordenadas = [...piezas].sort((a, b) => Number(esVideo(b)) - Number(esVideo(a)));

  return (
    <section className="rounded-xl border border-border bg-white p-4">
      <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
        <Film className="w-4 h-4 text-primary" />
        Conoce a la empresa
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Material que publica la propia empresa, revisado por el equipo de ImportacionesQ8.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {ordenadas.map((pieza) => (
          <Pieza key={pieza.id} evidencia={pieza} />
        ))}
      </div>
    </section>
  );
}

/** Editor que usa la propia empresa desde su perfil. */
export function EditorPresentacion() {
  const [piezas, setPiezas] = useState<BackendEvidenciaImportador[]>([]);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(async () => {
    try {
      setPiezas(await businessService.listMyImporterEvidence());
    } catch {
      setPiezas([]);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function registrar(tipo: TipoEvidenciaImportador, url: string, nombreArchivo: string) {
    setError("");
    try {
      await businessService.createImporterEvidence({
        tipo,
        // Sin título explícito se usa el nombre del archivo: obligar a escribirlo
        // antes de subir solo añade fricción a algo que ya se entiende.
        titulo: titulo.trim() || nombreArchivo,
        descripcion: descripcion.trim() || undefined,
        // Ruta canónica del backend, no la URL absoluta del host actual.
        url: toApiPath(url),
      });
      setTitulo("");
      setDescripcion("");
      setAviso("Enviado. Aparecerá en tu perfil público cuando el equipo de la plataforma lo revise.");
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el archivo.");
    }
  }

  async function eliminar(evidenciaId: string) {
    setError("");
    try {
      await businessService.deleteImporterEvidence(evidenciaId);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  const visibles = piezas.filter((pieza) => TIPOS_VISIBLES.includes(pieza.tipo));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium block mb-1.5" htmlFor="titulo-presentacion">Título</label>
          <input
            id="titulo-presentacion"
            value={titulo}
            onChange={(evento) => setTitulo(evento.target.value)}
            placeholder="Ej. Recorrido por nuestro taller"
            className="w-full h-9 rounded-lg border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5" htmlFor="descripcion-presentacion">Descripción breve</label>
          <input
            id="descripcion-presentacion"
            value={descripcion}
            onChange={(evento) => setDescripcion(evento.target.value)}
            maxLength={600}
            placeholder="Una o dos frases sobre lo que se ve"
            className="w-full h-9 rounded-lg border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <DocumentUploadButton
          label="Subir video de presentación"
          accept={VIDEO_ACCEPT}
          origen="presentacion-empresa"
          variant="primary"
          onUploaded={(archivo) => registrar(
            "video_presentacion",
            archivo.storage_url || `/documentos/archivos/${archivo.id}/descargar`,
            archivo.nombre,
          )}
          onError={setError}
        />
        <DocumentUploadButton
          label="Subir fotos"
          accept={IMAGEN_ACCEPT}
          origen="presentacion-empresa"
          multiple
          onUploaded={(archivo) => registrar(
            "foto_producto",
            archivo.storage_url || `/documentos/archivos/${archivo.id}/descargar`,
            archivo.nombre,
          )}
          onError={setError}
        />
      </div>

      {aviso ? <p className="text-xs text-muted-foreground">{aviso}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {visibles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-8 text-center">
          <Film className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm font-medium">Aún no has subido tu presentación</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Un video corto de tu taller y unas fotos de producto le dicen más a un cliente que cualquier descripción.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visibles.map((pieza) => (
            <div key={pieza.id} className="rounded-xl border border-border overflow-hidden">
              <div className="aspect-video bg-slate-100 flex items-center justify-center">
                {esVideo(pieza) ? (
                  <video src={resolveApiUrl(pieza.url)} controls preload="metadata" className="w-full h-full object-cover" />
                ) : (
                  <img src={resolveApiUrl(pieza.url)} alt={pieza.titulo} className="w-full h-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="px-3 py-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate flex items-center gap-1.5">
                    {esVideo(pieza) ? <Film className="w-3.5 h-3.5 flex-shrink-0" /> : <ImageIcon className="w-3.5 h-3.5 flex-shrink-0" />}
                    {pieza.titulo}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <EtiquetaEstado estado={pieza.estado} />
                    {pieza.estado === "rechazada" && pieza.nota_revision ? (
                      <span className="text-[11px] text-muted-foreground truncate">{pieza.nota_revision}</span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { void eliminar(pieza.id); }}
                  aria-label={`Eliminar ${pieza.titulo}`}
                  className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
