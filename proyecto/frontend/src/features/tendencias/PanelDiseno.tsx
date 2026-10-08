import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  ImagePlus,
  Inbox,
  Loader2,
  Palette,
  RefreshCw,
  Save,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { DocumentUploadButton } from "@/app/components/files/DocumentUploadButton";
import { ImagenArchivo } from "@/app/components/files/ImagenArchivo";
import { formatearTamano, obtenerLimiteSubida } from "@/lib/limite-subida";
import { businessService } from "@/services/business.service";
import {
  tendenciasService,
  ETIQUETA_PLATAFORMA,
  MAX_IMAGENES_DISENO,
  type ContadoresDiseno,
  type FiltroPublicados,
  type ItemDiseno,
} from "@/services/tendencias.service";

import {
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  Contador,
  IconoPlataforma,
  InsigniaOrigen,
  haceCuanto,
  mensajeError,
} from "./AprobacionComun";
import { nombreRemitente } from "./AprobacionCola";
import { ACEPTA_IMAGEN, TIPOS_IMAGEN, rutaArchivo } from "./AprobacionFicha";
import { EtiquetaRegulado } from "./piezas";

/**
 * Panel del equipo de diseño de Tendencias: a lo que aprobó el equipo
 * aprobador le pone portada e imágenes con la identidad de Zarpi y lo publica.
 * No edita textos ni aprueba: eso es del aprobador.
 *
 * La cola sigue el patrón de AprobacionCola (lista, video y área de trabajo).
 * La zona de portada es propia y no la de AprobacionFicha: aquí la portada es
 * obligatoria, admite varias imágenes y no se puede quitar en un publicado.
 */

type Pestana = "por_disenar" | "publicados";

interface Borrador {
  portada: string;
  imagenes: string[];
}

type CambiosDiseno = { portada_url?: string; imagenes?: string[] };

function borradorDesde(item: ItemDiseno): Borrador {
  return { portada: item.portada_url ?? "", imagenes: [...(item.imagenes ?? [])] };
}

/** Solo lo que cambió respecto a lo guardado; `portada_url: ""` quita la portada. */
function cambiosDiseno(item: ItemDiseno, b: Borrador): CambiosDiseno | null {
  const base = borradorDesde(item);
  const cambios: CambiosDiseno = {};
  if (b.portada !== base.portada) cambios.portada_url = b.portada;
  if (b.imagenes.length !== base.imagenes.length || b.imagenes.some((r, i) => r !== base.imagenes[i])) {
    cambios.imagenes = b.imagenes;
  }
  return Object.keys(cambios).length > 0 ? cambios : null;
}

function soloImagenes(lista: FileList | null | undefined): File[] {
  return Array.from(lista ?? []).filter((f) => TIPOS_IMAGEN.includes(f.type));
}

// ── Piezas ───────────────────────────────────────────────────────────────────

function FilaDiseno({ item, modo, activo, onClick }: { item: ItemDiseno; modo: Pestana; activo: boolean; onClick: () => void }) {
  const fecha = modo === "publicados" ? item.publicado_en : item.revisado_en ?? item.fecha_envio;
  const imagenes = item.imagenes?.length ?? 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={activo ? "true" : undefined}
      className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
        activo
          ? "border-primary bg-primary/5 ring-1 ring-primary dark:border-accent dark:bg-accent/10 dark:ring-accent"
          : "border-border bg-white hover:bg-muted/40"
      }`}
    >
      <div className="flex items-start gap-2">
        <IconoPlataforma plataforma={item.plataforma} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.nombre || ETIQUETA_PLATAFORMA[item.plataforma]}</p>
          <p className="truncate text-xs text-muted-foreground">
            {item.categoria || "Sin categoría"} · {ETIQUETA_PLATAFORMA[item.plataforma]}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <InsigniaOrigen origen={item.remitente?.rol ?? item.origen} />
            <span className="text-[11px] text-muted-foreground">
              {modo === "publicados" ? "publicado" : "aprobado"} {haceCuanto(fecha)}
            </span>
            {modo === "publicados" && !item.con_identidad && (
              <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                Sin identidad Zarpi
              </span>
            )}
          </div>
          {(item.portada_url || imagenes > 0) && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {[item.portada_url && "Con portada", imagenes > 0 && `${imagenes} ${imagenes === 1 ? "imagen" : "imágenes"}`].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

/** Mismo reproductor que el del aprobador, sin el aviso del código de Instagram (el designer no lo pega). */
function VideoDiseno({ item }: { item: ItemDiseno }) {
  const vertical = item.plataforma !== "youtube";
  return (
    <div className="space-y-2">
      {item.embed_url ? (
        <div className={vertical ? "mx-auto w-full max-w-[340px]" : "w-full"}>
          <div className={`overflow-hidden rounded-xl bg-black ${vertical ? "aspect-[9/16]" : "aspect-video"}`}>
            <iframe
              key={item.id}
              src={item.embed_url}
              title={`Video de ${item.plataforma_nombre}${item.autor_plataforma ? ` de ${item.autor_plataforma}` : ""}`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
        </div>
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl bg-muted p-3 text-center text-sm text-muted-foreground">
          {item.miniatura_plataforma_url && (
            <img src={item.miniatura_plataforma_url} alt="" referrerPolicy="no-referrer" className="max-h-40 rounded-lg object-contain" />
          )}
          <p>No se pudo armar el reproductor. Ábrelo en la plataforma.</p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <a
          href={item.url_video}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline dark:text-accent"
        >
          Abrir en {item.plataforma_nombre || ETIQUETA_PLATAFORMA[item.plataforma]} <ExternalLink className="h-3.5 w-3.5" />
        </a>
        {item.autor_plataforma && <span className="text-xs text-muted-foreground">Autor: {item.autor_plataforma}</span>}
      </div>
    </div>
  );
}

/** Lo que escribió el aprobador, solo lectura. */
function BriefProducto({ item }: { item: ItemDiseno }) {
  return (
    <div className="min-w-0 space-y-3 text-sm">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary dark:text-accent">{item.categoria || "Sin categoría"}</p>
        <h2 className="text-base font-semibold leading-snug">{item.nombre || "Sin nombre"}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {item.regulado && <EtiquetaRegulado />}
          {item.empresa && <span className="text-xs text-muted-foreground">Lo recomienda {item.empresa.nombre}</span>}
        </div>
      </div>

      <div>
        <p className="flex items-center gap-1 text-xs font-semibold"><Flame className="h-3.5 w-3.5 text-primary dark:text-accent" /> Por qué está en tendencia</p>
        <p className="mt-0.5 whitespace-pre-line text-muted-foreground">{item.por_que_tendencia || "—"}</p>
      </div>

      <div>
        <p className="flex items-center gap-1 text-xs font-semibold"><AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" /> Ojo antes de traerlo</p>
        <p className="mt-0.5 whitespace-pre-line text-muted-foreground">{item.ojo_antes || "—"}</p>
      </div>

      <div className="rounded-lg border border-border p-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">Enviado por {nombreRemitente(item)}</span>
          <InsigniaOrigen origen={item.remitente?.rol ?? item.origen} />
        </div>
        {item.nota_remitente ? (
          <p className="mt-1.5 whitespace-pre-line text-foreground">“{item.nota_remitente}”</p>
        ) : (
          <p className="mt-1 text-muted-foreground">Sin nota del remitente.</p>
        )}
      </div>

      {item.disenado_por && (
        <p className="text-xs text-muted-foreground">
          Diseñado por {item.disenado_por}
          {item.disenado_en ? ` ${haceCuanto(item.disenado_en)}` : ""}
        </p>
      )}
    </div>
  );
}

function GuiaMarca() {
  return (
    <div className="flex gap-2.5 rounded-lg border border-violet-200 bg-violet-50/60 p-2.5 text-xs text-violet-900 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200">
      <Palette className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="space-y-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
          Identidad Zarpi
          <span className="inline-flex items-center gap-1 font-normal">
            <span className="h-3 w-3 rounded-sm border border-black/10" style={{ background: "#4F06EB" }} /> #4F06EB
          </span>
          <span className="inline-flex items-center gap-1 font-normal">
            <span className="h-3 w-3 rounded-sm border border-black/10" style={{ background: "#EDF953" }} /> #EDF953
          </span>
        </p>
        <p>Portada cuadrada 1:1 de mínimo 1080 px, con el producto bien visible y sin logos de terceros.</p>
      </div>
    </div>
  );
}

/** Contenedor que acepta imágenes arrastradas o pegadas mientras tiene el foco. */
function ZonaSoltar({
  etiqueta,
  disabled,
  onArchivos,
  children,
}: {
  etiqueta: string;
  disabled: boolean;
  onArchivos: (archivos: File[]) => void;
  children: ReactNode;
}) {
  const [encima, setEncima] = useState(false);
  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={etiqueta}
      onPaste={(e) => {
        const archivos = soloImagenes(e.clipboardData?.files);
        if (archivos.length === 0) return;
        // Así el pegado global (que va a la portada) no lo procesa otra vez.
        e.preventDefault();
        if (!disabled) onArchivos(archivos);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!encima) setEncima(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEncima(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        if (disabled) return;
        const archivos = soloImagenes(e.dataTransfer?.files);
        if (archivos.length > 0) onArchivos(archivos);
        else toast.error("Suelta una imagen PNG, JPG o WebP.");
      }}
      className={`rounded-xl border-2 border-dashed p-3 outline-none transition-colors focus:border-primary dark:focus:border-accent ${
        encima ? "border-primary bg-primary/5 dark:border-accent dark:bg-accent/10" : "border-border"
      }`}
    >
      {children}
    </div>
  );
}

const CLASE_ICONO_TILE =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40";

// ── Área de trabajo ──────────────────────────────────────────────────────────

function EspacioDiseno({
  item,
  modo,
  propuesta,
  inicial,
  onCambio,
  onGuardado,
  onPublicado,
}: {
  item: ItemDiseno;
  modo: Pestana;
  /** Foto que mandó la importadora al enviar el enlace, si la hay. */
  propuesta: string | null;
  inicial: Borrador;
  onCambio: (b: Borrador) => void;
  onGuardado: (item: ItemDiseno) => void;
  onPublicado: (item: ItemDiseno) => void;
}) {
  const [guardado, setGuardado] = useState<ItemDiseno>(item);
  const guardadoRef = useRef(item);
  const [borrador, setBorradorEstado] = useState<Borrador>(inicial);
  const borradorRef = useRef(inicial);
  const [subiendo, setSubiendo] = useState<null | "portada" | "imagenes">(null);
  const subiendoRef = useRef(false);
  const [guardando, setGuardando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const colaGuardado = useRef<Promise<boolean>>(Promise.resolve(true));

  const publicado = modo === "publicados";
  const bloqueado = publicando;
  const restantes = MAX_IMAGENES_DISENO - borrador.imagenes.length;
  const sucio = cambiosDiseno(guardado, borrador) !== null;

  // Las subidas terminan en callbacks asíncronos: se trabaja sobre la ref para no pisar cambios.
  const onCambioRef = useRef(onCambio);
  onCambioRef.current = onCambio;
  const cambiar = (fn: (b: Borrador) => Borrador) => {
    const nuevo = fn(borradorRef.current);
    borradorRef.current = nuevo;
    setBorradorEstado(nuevo);
    onCambioRef.current(nuevo);
  };

  // Guardados en serie: un auto-guardado tras subir no se cruza con el botón «Guardar».
  const guardar = (aviso = false): Promise<boolean> => {
    const tarea = colaGuardado.current.then(async () => {
      const cambios = cambiosDiseno(guardadoRef.current, borradorRef.current);
      if (!cambios) {
        if (aviso) toast.success("No hay cambios por guardar.");
        return true;
      }
      setGuardando(true);
      try {
        const resultado = await tendenciasService.guardarDiseno(guardadoRef.current.id, cambios);
        guardadoRef.current = resultado;
        setGuardado(resultado);
        onGuardado(resultado);
        if (aviso) toast.success("Cambios guardados.");
        return true;
      } catch (error) {
        toast.error(mensajeError(error, "No se pudieron guardar los cambios."));
        return false;
      } finally {
        setGuardando(false);
      }
    });
    colaGuardado.current = tarea;
    return tarea;
  };

  const ponerPortada = (ruta: string) => {
    cambiar((b) => ({ ...b, portada: ruta }));
  };

  const agregarImagenes = (rutas: string[]) => {
    cambiar((b) => {
      const imagenes = [...b.imagenes];
      for (const r of rutas) if (!imagenes.includes(r)) imagenes.push(r);
      return { ...b, imagenes: imagenes.slice(0, MAX_IMAGENES_DISENO) };
    });
  };

  // Tras subir se guarda de una vez para que el trabajo no se pierda.
  const trasSubir = (destino: "portada" | "imagenes", rutas: string[]) => {
    if (rutas.length === 0) return;
    if (destino === "portada") ponerPortada(rutas[0]);
    else agregarImagenes(rutas);
    void guardar();
  };

  const subir = async (archivos: File[], destino: "portada" | "imagenes") => {
    if (subiendoRef.current || bloqueado) return;
    if (archivos.length === 0) {
      toast.error("Usa imágenes PNG, JPG o WebP.");
      return;
    }
    const cupo = destino === "portada" ? 1 : MAX_IMAGENES_DISENO - borradorRef.current.imagenes.length;
    if (cupo <= 0) {
      toast.error(`Ya hay ${MAX_IMAGENES_DISENO} imágenes. Quita una para subir otra.`);
      return;
    }
    const lote = archivos.slice(0, cupo);
    if (destino === "imagenes" && archivos.length > cupo) toast.info(`Solo caben ${cupo} más: se suben las primeras.`);
    subiendoRef.current = true;
    setSubiendo(destino);
    const rutas: string[] = [];
    try {
      const limite = await obtenerLimiteSubida();
      const grande = lote.find((f) => f.size > limite);
      if (grande) {
        toast.error(`«${grande.name}» pesa ${formatearTamano(grande.size)} y el máximo es ${formatearTamano(limite)}.`);
        return;
      }
      for (const archivo of lote) {
        const subido = await businessService.uploadDocumentFile(archivo, null, "tendencias");
        rutas.push(rutaArchivo(subido));
      }
    } catch (error) {
      toast.error(mensajeError(error, "No se pudo subir la imagen."));
    } finally {
      subiendoRef.current = false;
      setSubiendo(null);
      // Lo que alcanzó a subir se conserva aunque una falle.
      trasSubir(destino, rutas);
    }
  };

  // Pegar una imagen fuera de las zonas: va a la portada si falta, si no a las imágenes.
  const subirRef = useRef(subir);
  subirRef.current = subir;
  useEffect(() => {
    const alPegar = (e: ClipboardEvent) => {
      if (e.defaultPrevented) return;
      const archivos = soloImagenes(e.clipboardData?.files);
      if (archivos.length === 0) return;
      e.preventDefault();
      void subirRef.current(archivos, borradorRef.current.portada ? "imagenes" : "portada");
    };
    window.addEventListener("paste", alPegar);
    return () => window.removeEventListener("paste", alPegar);
  }, []);

  const mover = (i: number, delta: -1 | 1) => {
    cambiar((b) => {
      const j = i + delta;
      if (j < 0 || j >= b.imagenes.length) return b;
      const imagenes = [...b.imagenes];
      [imagenes[i], imagenes[j]] = [imagenes[j], imagenes[i]];
      return { ...b, imagenes };
    });
  };

  const quitarImagen = (i: number) => {
    cambiar((b) => ({ ...b, imagenes: b.imagenes.filter((_, k) => k !== i) }));
  };

  // La imagen pasa a portada y la portada anterior ocupa su lugar: no se pierde nada.
  const usarComoPortada = (ruta: string) => {
    cambiar((b) => {
      const i = b.imagenes.indexOf(ruta);
      const imagenes = [...b.imagenes];
      if (i >= 0) {
        if (b.portada && !imagenes.includes(b.portada)) imagenes[i] = b.portada;
        else imagenes.splice(i, 1);
      }
      return { portada: ruta, imagenes };
    });
  };

  const publicar = async () => {
    if (!borradorRef.current.portada) return;
    setPublicando(true);
    const ok = await guardar();
    if (!ok) {
      setPublicando(false);
      return;
    }
    try {
      const resultado = await tendenciasService.publicarDiseno(item.id);
      onPublicado(resultado);
    } catch (error) {
      toast.error(mensajeError(error, "No se pudo publicar."));
      setPublicando(false);
    }
  };

  // El backend solo acepta la foto de la importadora mientras el producto la conserve.
  const propuestaVigente =
    propuesta && (propuesta === guardado.portada_url || (guardado.imagenes ?? []).includes(propuesta) || propuesta === borrador.portada)
      ? propuesta
      : null;

  const estado = guardando ? "Guardando…" : sucio ? "Cambios sin guardar" : "Todo guardado";

  return (
    <div className="space-y-4">
      <GuiaMarca />

      {propuestaVigente && (
        <div className="flex items-center gap-3 rounded-lg border border-border p-2.5">
          <ImagenArchivo src={propuestaVigente} alt="Foto propuesta por la importadora" className="h-16 w-16 flex-shrink-0 rounded-lg" />
          <div className="min-w-0 space-y-1 text-xs">
            <p className="font-medium">Foto propuesta por la importadora</p>
            {borrador.portada === propuestaVigente ? (
              <p className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" /> Es la portada actual
              </p>
            ) : (
              <button
                type="button"
                disabled={bloqueado}
                onClick={() => usarComoPortada(propuestaVigente)}
                className="font-medium text-primary hover:underline disabled:opacity-50 dark:text-accent"
              >
                Usar como portada
              </button>
            )}
          </div>
        </div>
      )}

      {/* Portada */}
      <div>
        <p className="mb-1 text-sm font-medium">
          Portada <span className="text-rose-600">*</span>
        </p>
        <ZonaSoltar etiqueta="Zona de portada: arrastra, pega o elige una imagen" disabled={bloqueado} onArchivos={(a) => void subir(a, "portada")}>
          {borrador.portada ? (
            <div className="flex flex-wrap items-start gap-3">
              <ImagenArchivo src={borrador.portada} alt="Portada" className="aspect-square w-32 flex-shrink-0 rounded-lg sm:w-36" />
              <div className="min-w-0 flex-1 basis-40 space-y-2 text-xs text-muted-foreground">
                <p>Arrastra o pega otra imagen para reemplazarla.</p>
                <div className="flex flex-wrap gap-2">
                  <DocumentUploadButton
                    label="Cambiar"
                    accept={ACEPTA_IMAGEN}
                    origen="tendencias"
                    disabled={bloqueado || subiendo !== null}
                    onUploaded={(archivo) => trasSubir("portada", [rutaArchivo(archivo)])}
                    onError={(m) => toast.error(m)}
                  />
                  {!publicado && (
                    <button
                      type="button"
                      disabled={bloqueado || subiendo !== null}
                      onClick={() => ponerPortada("")}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Quitar
                    </button>
                  )}
                </div>
                {subiendo === "portada" && <p className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Subiendo…</p>}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-3 text-center text-xs text-muted-foreground">
              {subiendo === "portada" ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
              <p>{subiendo === "portada" ? "Subiendo portada…" : "Arrastra la portada aquí o pégala con Ctrl+V"}</p>
              <DocumentUploadButton
                label="Elegir imagen"
                accept={ACEPTA_IMAGEN}
                origen="tendencias"
                disabled={bloqueado || subiendo !== null}
                onUploaded={(archivo) => trasSubir("portada", [rutaArchivo(archivo)])}
                onError={(m) => toast.error(m)}
              />
            </div>
          )}
        </ZonaSoltar>
      </div>

      {/* Imágenes del producto */}
      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            Imágenes del producto{" "}
            <span className="font-normal tabular-nums text-muted-foreground">({borrador.imagenes.length}/{MAX_IMAGENES_DISENO})</span>
          </p>
          <DocumentUploadButton
            label="Agregar"
            accept={ACEPTA_IMAGEN}
            origen="tendencias"
            multiple
            maxArchivos={Math.max(restantes, 1)}
            disabled={bloqueado || restantes <= 0 || subiendo !== null}
            onUploaded={(archivo) => trasSubir("imagenes", [rutaArchivo(archivo)])}
            onError={(m) => toast.error(m)}
          />
        </div>
        <ZonaSoltar etiqueta="Zona de imágenes: arrastra o pega una o varias imágenes" disabled={bloqueado} onArchivos={(a) => void subir(a, "imagenes")}>
          {borrador.imagenes.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-3 text-center text-xs text-muted-foreground">
              {subiendo === "imagenes" ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
              <p>{subiendo === "imagenes" ? "Subiendo imágenes…" : `Opcional: hasta ${MAX_IMAGENES_DISENO} fotos extra del producto. Arrástralas o pégalas aquí.`}</p>
            </div>
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
                {borrador.imagenes.map((ruta, i) => (
                  <li key={ruta} className="min-w-0">
                    <div className="relative">
                      <ImagenArchivo src={ruta} alt={`Imagen ${i + 1} del producto`} className="aspect-square w-full rounded-lg" />
                      <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[11px] font-medium tabular-nums text-white">{i + 1}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <button type="button" disabled={bloqueado || i === 0} onClick={() => mover(i, -1)} aria-label={`Mover la imagen ${i + 1} a la izquierda`} title="Mover a la izquierda" className={CLASE_ICONO_TILE}>
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" disabled={bloqueado} onClick={() => usarComoPortada(ruta)} aria-label={`Usar la imagen ${i + 1} como portada`} title="Usar como portada" className={CLASE_ICONO_TILE}>
                        <Star className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" disabled={bloqueado} onClick={() => quitarImagen(i)} aria-label={`Quitar la imagen ${i + 1}`} title="Quitar" className={`${CLASE_ICONO_TILE} hover:text-rose-600`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" disabled={bloqueado || i === borrador.imagenes.length - 1} onClick={() => mover(i, 1)} aria-label={`Mover la imagen ${i + 1} a la derecha`} title="Mover a la derecha" className={CLASE_ICONO_TILE}>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {subiendo === "imagenes" ? (
                  <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Subiendo imágenes…</span>
                ) : restantes > 0 ? (
                  `Arrastra o pega aquí para agregar. Caben ${restantes} más.`
                ) : (
                  "Llegaste al máximo de imágenes."
                )}
              </p>
            </>
          )}
        </ZonaSoltar>
      </div>

      {/* Acciones */}
      <div className="space-y-2 border-t border-border pt-3">
        <p className={`flex items-center gap-1 text-xs ${sucio && !guardando ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`} aria-live="polite">
          {guardando && <Loader2 className="h-3 w-3 animate-spin" />}
          {estado}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={bloqueado || guardando || !sucio}
            onClick={() => void guardar(true)}
            className={publicado ? `${CLASE_BOTON_PRIMARIO} flex-1` : CLASE_BOTON_SECUNDARIO}
          >
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </button>
          {!publicado && (
            <button
              type="button"
              disabled={bloqueado || !borrador.portada || subiendo !== null}
              onClick={() => void publicar()}
              title={!borrador.portada ? "Falta la portada" : undefined}
              className={`${CLASE_BOTON_PRIMARIO} flex-1`}
            >
              {publicando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Publicar en Tendencias
            </button>
          )}
        </div>
        {!publicado && !borrador.portada && <p className="text-xs text-muted-foreground">Para publicar falta la portada.</p>}
        {publicado && !guardado.con_identidad && (
          <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            <p>Se publicó sin pasar por diseño. Cámbiale la portada o las imágenes y guarda; si ya tiene la identidad de Zarpi, márcalo como revisado.</p>
            <button
              type="button"
              disabled={marcando || guardando || sucio}
              title={sucio ? "Guarda primero los cambios" : undefined}
              onClick={async () => {
                setMarcando(true);
                try {
                  const resultado = await tendenciasService.marcarRevisado(item.id);
                  guardadoRef.current = resultado;
                  setGuardado(resultado);
                  onGuardado(resultado);
                  toast.success("Marcado con la identidad de Zarpi.");
                } catch (error) {
                  toast.error(mensajeError(error, "No se pudo marcar."));
                } finally {
                  setMarcando(false);
                }
              }}
              className={CLASE_BOTON_SECUNDARIO}
            >
              {marcando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Ya tiene la identidad de Zarpi
            </button>
          </div>
        )}
        {publicado && (
          <a
            href={`/tendencias/${item.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline dark:text-accent"
          >
            Ver la ficha pública <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

// ── Cola ─────────────────────────────────────────────────────────────────────

function ColaDiseno({ modo, filtro = "sin_diseno", busqueda = "", onPublicado }: {
  modo: Pestana;
  filtro?: FiltroPublicados;
  busqueda?: string;
  /** Tras publicar o retocar algo: el panel refresca contadores. */
  onPublicado: () => void;
}) {
  const [items, setItems] = useState<ItemDiseno[]>([]);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const borradores = useRef(new Map<string, Borrador>());
  // Se fija al cargar: al reemplazarla, el producto deja de traerla.
  const propuestas = useRef(new Map<string, string>());

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      let lista: ItemDiseno[];
      if (modo === "por_disenar") {
        const cola = await tendenciasService.colaDiseno();
        // Lo aprobado hace más tiempo, primero.
        lista = [...cola].sort((a, b) => (a.revisado_en ?? a.fecha_envio).localeCompare(b.revisado_en ?? b.fecha_envio));
        for (const i of lista) {
          if (i.remitente?.rol === "importadora" && i.portada_url && !propuestas.current.has(i.id)) {
            propuestas.current.set(i.id, i.portada_url);
          }
        }
      } else {
        lista = await tendenciasService.publicadosDiseno(filtro, busqueda);
      }
      setItems(lista);
      setSeleccionado((actual) => (actual && lista.some((i) => i.id === actual) ? actual : lista[0]?.id ?? null));
    } catch (e) {
      setError(mensajeError(e, "No se pudo cargar la cola."));
    } finally {
      setCargando(false);
    }
  }, [modo, filtro, busqueda]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const guardado = (resultado: ItemDiseno) => {
    setItems((prev) => prev.map((i) => (i.id === resultado.id ? resultado : i)));
    // Retocar algo publicado cambia «sin identidad»: el contador se refresca.
    if (modo === "publicados") onPublicado();
  };

  const publicado = (resultado: ItemDiseno) => {
    toast.success("Publicado en Tendencias.");
    borradores.current.delete(resultado.id);
    const idx = items.findIndex((i) => i.id === resultado.id);
    const quedan = items.filter((i) => i.id !== resultado.id);
    const siguiente = quedan[idx] ?? quedan[idx - 1] ?? null;
    setItems(quedan);
    setSeleccionado(siguiente?.id ?? null);
    onPublicado();
  };

  const actual = items.find((i) => i.id === seleccionado) ?? null;

  if (cargando && items.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-white p-10 text-sm text-muted-foreground shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
        {error}{" "}
        <button type="button" onClick={() => void cargar()} className="font-medium underline">Reintentar</button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-10 text-center shadow-sm">
        <Inbox className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium">{modo === "por_disenar" ? "No hay productos por diseñar" : filtro === "sin_diseno" && !busqueda ? "Todo lo publicado ya tiene la identidad de Zarpi" : "No hay productos que coincidan"}</p>
        {modo === "por_disenar" && (
          <p className="text-sm text-muted-foreground">Cuando el equipo aprobador apruebe uno, aparecerá aquí.</p>
        )}
        <button type="button" onClick={() => void cargar()} className={`${CLASE_BOTON_SECUNDARIO} mt-1`}>
          <RefreshCw className="h-3.5 w-3.5" /> {modo === "por_disenar" ? "Buscar nuevos" : "Actualizar"}
        </button>
      </div>
    );
  }

  return (
    // Igual que la cola del aprobador: tres columnas solo con pantalla ancha;
    // antes, el video y el brief van encima del área de trabajo.
    <div className="grid gap-4 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(240px,300px)_minmax(300px,380px)_minmax(0,1fr)]">
      <section className="rounded-xl border border-border bg-white p-3 shadow-sm lg:row-span-2 lg:self-start 2xl:row-span-1">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">
            {modo === "por_disenar" ? "Por diseñar" : "Publicados"} <span className="font-normal text-muted-foreground">({items.length})</span>
          </p>
          <button
            type="button"
            onClick={() => void cargar()}
            disabled={cargando}
            aria-label="Actualizar la lista"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${cargando ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1 lg:max-h-[calc(100vh-260px)]">
          {items.map((item) => (
            <FilaDiseno key={item.id} item={item} modo={modo} activo={item.id === seleccionado} onClick={() => setSeleccionado(item.id)} />
          ))}
        </div>
      </section>

      {actual && (
        <>
          <section
            className={`grid min-w-0 gap-4 rounded-xl border border-border bg-white p-4 shadow-sm ${
              actual.plataforma !== "youtube" ? "sm:grid-cols-[minmax(160px,200px)_minmax(0,1fr)] 2xl:grid-cols-1" : ""
            }`}
          >
            <VideoDiseno item={actual} />
            <BriefProducto item={actual} />
          </section>
          <section className="min-w-0 rounded-xl border border-border bg-white p-4 shadow-sm">
            <EspacioDiseno
              key={actual.id}
              item={actual}
              modo={modo}
              propuesta={modo === "por_disenar" ? propuestas.current.get(actual.id) ?? null : null}
              inicial={borradores.current.get(actual.id) ?? borradorDesde(actual)}
              onCambio={(b) => borradores.current.set(actual.id, b)}
              onGuardado={guardado}
              onPublicado={publicado}
            />
          </section>
        </>
      )}
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────

export function PanelDiseno() {
  const [pestana, setPestana] = useState<Pestana>("por_disenar");
  const [contadores, setContadores] = useState<ContadoresDiseno | null>(null);
  // Publicados: por defecto, lo que salió sin pasar por diseño.
  const [filtro, setFiltro] = useState<FiltroPublicados>("sin_diseno");
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setBusqueda(texto.trim()), 350);
    return () => window.clearTimeout(t);
  }, [texto]);

  const cargarContadores = useCallback(() => {
    tendenciasService.contadoresDiseno().then(setContadores).catch(() => undefined);
  }, []);

  useEffect(() => {
    cargarContadores();
  }, [cargarContadores]);

  const pestanas: { clave: Pestana; etiqueta: string; cuenta?: number }[] = [
    { clave: "por_disenar", etiqueta: "Por diseñar", cuenta: contadores?.en_cola },
    { clave: "publicados", etiqueta: "Publicados", cuenta: contadores?.publicados_sin_diseno },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Diseño de Tendencias</h1>
        <p className="text-sm text-muted-foreground">
          Ponle portada e imágenes con la identidad de Zarpi a los productos aprobados y publícalos.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Contador etiqueta="En cola" valor={contadores?.en_cola ?? null} icono={Clock} clase="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" />
        <Contador etiqueta="Publicados hoy" valor={contadores?.publicados_hoy ?? null} icono={CheckCircle2} clase="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" />
        <Contador etiqueta="Diseñados por ti" valor={contadores?.mios_total ?? null} icono={Palette} clase="bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" />
      </div>

      <div role="tablist" aria-label="Secciones del panel" className="flex flex-wrap gap-2 border-b border-border pb-2">
        {pestanas.map((p) => (
          <button
            key={p.clave}
            type="button"
            role="tab"
            aria-selected={pestana === p.clave}
            onClick={() => setPestana(p.clave)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
              pestana === p.clave
                ? "bg-primary text-white dark:bg-accent dark:text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {p.etiqueta}
            {p.cuenta !== undefined && p.cuenta > 0 && (
              <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${pestana === p.clave ? "bg-white/20" : "bg-muted"}`}>{p.cuenta}</span>
            )}
          </button>
        ))}
      </div>

      {pestana === "publicados" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Retoca la portada o las imágenes de cualquier producto publicado que no tenga la identidad de Zarpi. Los cambios salen al guardar.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar publicados">
              {([
                ["sin_diseno", `Sin identidad Zarpi${contadores ? ` (${contadores.publicados_sin_diseno})` : ""}`],
                ["todos", "Todos"],
                ["mios", "Diseñados por ti"],
              ] as [FiltroPublicados, string][]).map(([clave, etiqueta]) => (
                <button
                  key={clave}
                  type="button"
                  aria-pressed={filtro === clave}
                  onClick={() => setFiltro(clave)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    filtro === clave
                      ? "border-primary bg-primary/10 text-primary dark:border-accent dark:bg-accent/15 dark:text-accent"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar por nombre"
              aria-label="Buscar productos publicados por nombre"
              className="w-full rounded-lg border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary sm:ml-auto sm:w-64"
            />
          </div>
        </div>
      )}

      <ColaDiseno
        key={pestana === "publicados" ? `publicados-${filtro}-${busqueda}` : pestana}
        modo={pestana}
        filtro={filtro}
        busqueda={busqueda}
        onPublicado={cargarContadores}
      />
    </div>
  );
}
