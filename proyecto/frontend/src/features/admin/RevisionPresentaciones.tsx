import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, FileText, Film, ImageIcon, Inbox, Loader2, RefreshCw, X } from "lucide-react";

import { ProtectedVideoPlayer } from "@/app/components/media/ReproductorVideo";
import { ImagenArchivo } from "@/app/components/files/ImagenArchivo";
import { abrirArchivoEnPestana } from "@/lib/abrir-archivo";
import {
  presentacionesService,
  type EstadoPresentacion,
  type PiezaPresentacion,
} from "@/services/presentaciones.service";

import {
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_INPUT,
  fechaCorta,
  mensajeError,
} from "../tendencias/AprobacionComun";

/**
 * Presentaciones de empresas: el video, las fotos y los soportes que cada
 * importadora sube desde «Mi empresa». Quedan «en revisión» hasta que el equipo
 * los aprueba aquí; solo entonces salen en su ficha pública. Al rechazar se
 * pide el motivo, que es lo que la empresa ve para corregirlo.
 */

const PESTANAS: { estado: EstadoPresentacion; texto: string }[] = [
  { estado: "pendiente", texto: "Por revisar" },
  { estado: "aprobada", texto: "Publicadas" },
  { estado: "rechazada", texto: "Rechazadas" },
];

const TIPO: Record<string, string> = {
  video_presentacion: "Video de presentación",
  foto_producto: "Foto de producto",
  foto_fabrica: "Foto de la fábrica",
  certificado: "Certificado",
  catalogo: "Catálogo",
  moq_doc: "Pedido mínimo",
  otro: "Otro archivo",
};

const esVideo = (p: PiezaPresentacion) => p.tipo === "video_presentacion";
const esFoto = (p: PiezaPresentacion) => p.tipo === "foto_producto" || p.tipo === "foto_fabrica";

function Vista({ pieza }: { pieza: PiezaPresentacion }) {
  if (esVideo(pieza)) {
    return (
      <ProtectedVideoPlayer
        url={pieza.url}
        className="h-full w-full bg-black object-contain"
        mensajeSinAcceso="No se pudo cargar el video. Ábrelo aparte para revisarlo."
      />
    );
  }
  if (esFoto(pieza)) {
    return <ImagenArchivo src={pieza.url} alt={pieza.titulo} className="h-full w-full" />;
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <FileText className="h-8 w-8" />
      <span className="text-xs">Documento: ábrelo para revisarlo</span>
    </div>
  );
}

function Tarjeta({ pieza, onRevisada }: { pieza: PiezaPresentacion; onRevisada: () => void }) {
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const revisar = async (estado: "aprobada" | "rechazada") => {
    if (estado === "rechazada" && !motivo.trim()) {
      setError("Escribe el motivo: es lo que la empresa verá para corregirlo.");
      return;
    }
    setEnviando(true);
    setError("");
    try {
      await presentacionesService.revisar(pieza.id, estado, estado === "rechazada" ? motivo.trim() : undefined);
      toast.success(estado === "aprobada"
        ? `Publicado en el perfil de ${pieza.empresa ?? "la empresa"}`
        : "Rechazado. La empresa recibió el motivo.");
      onRevisada();
    } catch (err) {
      setError(mensajeError(err, "No se pudo guardar la revisión."));
    } finally {
      setEnviando(false);
    }
  };

  const abrir = async () => {
    const r = await abrirArchivoEnPestana(pieza.url, pieza.titulo);
    if (!r.ok) toast.error(r.motivo ?? "No se pudo abrir el archivo.");
  };

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm dark:bg-card">
      <div className="aspect-video bg-muted">
        <Vista pieza={pieza} />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-primary dark:text-accent">
            {pieza.empresa ?? "Empresa sin nombre"}
          </p>
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
            {esVideo(pieza) ? <Film className="h-3.5 w-3.5 flex-shrink-0" /> : esFoto(pieza) ? <ImageIcon className="h-3.5 w-3.5 flex-shrink-0" /> : <FileText className="h-3.5 w-3.5 flex-shrink-0" />}
            {pieza.titulo}
          </p>
          <p className="text-xs text-muted-foreground">
            {TIPO[pieza.tipo] ?? pieza.tipo} · subido el {fechaCorta(pieza.fecha_creacion)}
            {pieza.fecha_revision ? ` · revisado el ${fechaCorta(pieza.fecha_revision)}` : ""}
          </p>
          {pieza.descripcion && <p className="mt-1 line-clamp-3 text-xs text-foreground/80">{pieza.descripcion}</p>}
          {pieza.estado === "rechazada" && pieza.nota_revision && (
            <p className="mt-1 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-500/15 dark:text-red-300">
              Motivo: {pieza.nota_revision}
            </p>
          )}
        </div>

        {rechazando && (
          <label className="block text-xs font-medium text-muted-foreground">
            Motivo del rechazo (lo verá la empresa)
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              maxLength={500}
              autoFocus
              placeholder="Ej. El video se ve borroso; súbelo en mejor calidad."
              className={`${CLASE_INPUT} mt-1 resize-none`}
            />
          </label>
        )}
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <button type="button" onClick={() => void abrir()} className={CLASE_BOTON_SECUNDARIO} title="Abrir en una pestaña nueva">
            <ExternalLink className="h-4 w-4" /> Abrir
          </button>
          {rechazando ? (
            <>
              <button type="button" onClick={() => { setRechazando(false); setError(""); }} className={CLASE_BOTON_SECUNDARIO} disabled={enviando}>
                Cancelar
              </button>
              <button type="button" onClick={() => void revisar("rechazada")} disabled={enviando}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-50">
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                {pieza.estado === "aprobada" ? "Despublicar" : "Rechazar"}
              </button>
            </>
          ) : (
            <>
              {pieza.estado !== "rechazada" && (
                <button type="button" onClick={() => setRechazando(true)} className={CLASE_BOTON_SECUNDARIO} disabled={enviando}>
                  <X className="h-4 w-4" /> {pieza.estado === "aprobada" ? "Despublicar" : "Rechazar"}
                </button>
              )}
              {pieza.estado !== "aprobada" && (
                <button type="button" onClick={() => void revisar("aprobada")} className={CLASE_BOTON_PRIMARIO} disabled={enviando}>
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Aprobar y publicar
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export function RevisionPresentaciones() {
  const [estado, setEstado] = useState<EstadoPresentacion>("pendiente");
  const [piezas, setPiezas] = useState<PiezaPresentacion[]>([]);
  const [contadores, setContadores] = useState<Record<EstadoPresentacion, number> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const cola = await presentacionesService.listar(estado);
      setPiezas(cola.items);
      setContadores(cola.contadores);
    } catch (err) {
      setError(mensajeError(err, "No se pudo cargar el material de las empresas."));
    } finally {
      setCargando(false);
    }
  }, [estado]);

  useEffect(() => { void cargar(); }, [cargar]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          El video, las fotos y los soportes que las empresas suben desde «Mi empresa». Solo lo aprobado aparece en su
          ficha pública. Si rechazas, la empresa recibe el motivo para corregirlo.
        </p>
        <button type="button" onClick={() => void cargar()} className={CLASE_BOTON_SECUNDARIO} disabled={cargando}>
          <RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>

      <div role="tablist" className="flex flex-wrap gap-2">
        {PESTANAS.map((p) => (
          <button
            key={p.estado}
            type="button"
            role="tab"
            aria-selected={estado === p.estado}
            onClick={() => setEstado(p.estado)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              estado === p.estado
                ? "border-primary bg-primary text-white dark:border-accent dark:bg-accent dark:text-accent-foreground"
                : "border-border bg-white text-muted-foreground hover:text-foreground dark:bg-card"
            }`}
          >
            {p.texto}
            {contadores && (
              <span className={`rounded-full px-1.5 text-xs ${estado === p.estado ? "bg-white/20" : "bg-muted"}`}>
                {contadores[p.estado] ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {cargando && piezas.length === 0 ? (
        <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : piezas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <Inbox className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
          <p className="text-sm font-medium">
            {estado === "pendiente" ? "No hay nada por revisar" : estado === "aprobada" ? "Todavía no hay material publicado" : "No hay material rechazado"}
          </p>
          {estado === "pendiente" && (
            <p className="mt-1 text-xs text-muted-foreground">Te llega una notificación cada vez que una empresa sube algo.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {piezas.map((p) => <Tarjeta key={p.id} pieza={p} onRevisada={() => void cargar()} />)}
        </div>
      )}
    </div>
  );
}
