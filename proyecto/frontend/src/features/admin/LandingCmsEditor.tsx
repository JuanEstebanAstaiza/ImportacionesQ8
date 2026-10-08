import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { clsx } from "clsx";
import {
  ArrowDown,
  ArrowUp,
  Clapperboard,
  Layers,
  Monitor,
  Moon,
  Newspaper,
  Plus,
  Save,
  Smartphone,
  Sun,
  Trash2,
  Upload,
  Users,
  Video,
  X,
} from "lucide-react";

import { businessService, type BackendArchivoItem, type BackendExplorerResponse } from "@/services/business.service";
import { getStoredToken, resolveApiUrl, toApiPath } from "@/services/api-client";
import { abrirArchivoEnPestana } from "@/lib/abrir-archivo";
import {
  landingService,
  type LandingAlly,
  type LandingBlock,
  type LandingBrandToken,
  type LandingButtonAction,
  type LandingFontFamily,
  type LandingNews,
  type VideoRotativo,
  type VideosQuienesSomos,
  VIDEOS_QUIENES_SOMOS_VACIO,
  leerVideosQuienesSomos,
} from "@/services/landing.service";

const MAX_VIDEOS_QUIENES_SOMOS = 10;
const VIDEO_PESADO_BYTES = 30 * 1024 * 1024;
const INTERVALOS_SEGUNDOS = [10, 15, 20, 30, 45, 60];

// Este editor solo administra el contenido dinámico de "Novedades y aliados":
// es la única sección de la Landing que consume el CMS por bloques.
const CMS_SECTION = "news" as const;

const IMAGE_FALLBACK = "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=80";

const BLOCK_TYPE_LABEL: Record<LandingBlock["tipo"], string> = {
  heading: "Encabezado",
  paragraph: "Parrafo",
  image: "Imagen",
  video: "Video",
  button: "Boton (CTA)",
  allies_grid: "Muro de aliados",
  video_rotativo: "Videos rotativos",
};

// Valores citados en Zarpi_Modelo_de_Monetizacion: el admin ve exactamente
// cómo luce el token en cada modo antes de aplicarlo, sin picker HEX libre.
const TOKEN_SWATCHES: Record<LandingBrandToken, { label: string; light: string; dark: string }> = {
  primary: { label: "Primario", light: "#4F06EB", dark: "#EDF953" },
  surface: { label: "Superficie neutra", light: "#FFFFFF", dark: "#0F0F0F" },
  border: { label: "Borde adaptativo", light: "#DEDED7", dark: "#353535" },
  foreground: { label: "Texto principal", light: "#0F0F0F", dark: "#FFFFFF" },
  muted: { label: "Texto secundario", light: "#68686A", dark: "#B6B6B6" },
};

// Clases Tailwind adaptativas (claro/oscuro): nunca HEX fijo en lo renderizado.
const TOKEN_TEXT_CLASS: Record<LandingBrandToken, string> = {
  primary: "text-[#4F06EB] dark:text-[#EDF953]",
  surface: "text-black dark:text-white",
  border: "text-slate-400 dark:text-zinc-500",
  foreground: "text-black dark:text-white",
  muted: "text-slate-500 dark:text-zinc-400",
};
const TOKEN_BUTTON_CLASS: Record<LandingBrandToken, string> = {
  primary: "bg-[#4F06EB] text-white dark:bg-[#EDF953] dark:text-black",
  surface: "bg-white text-black dark:bg-[#0F0F0F] dark:text-white",
  border: "bg-transparent border border-slate-200 dark:border-zinc-800",
  foreground: "bg-black text-white dark:bg-white dark:text-black",
  muted: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300",
};

const BUTTON_ACTIONS: { key: LandingButtonAction; label: string }[] = [
  { key: "open_login", label: "Abrir inicio de sesion" },
  { key: "open_register", label: "Abrir registro" },
  { key: "external_link", label: "Enlace externo" },
];

const FONT_OPTIONS: { key: LandingFontFamily; label: string; sample: string; className: string }[] = [
  { key: "elvellon", label: "Elvellon · Titulos", sample: "Zarpi", className: "font-elvellon" },
  { key: "avenor", label: "AT Avenor · Cuerpo", sample: "Aa texto", className: "font-avenor" },
];

const HEADING_SIZES = ["xl", "lg", "md", "sm"];
const TEXT_SIZES = ["lg", "md", "sm"];
const HEADING_SIZE_PREVIEW: Record<string, string> = { xl: "1.75rem", lg: "1.4rem", md: "1.15rem", sm: "0.95rem" };
const TEXT_SIZE_PREVIEW: Record<string, string> = { lg: "1rem", md: "0.875rem", sm: "0.75rem" };
const HEADING_SIZE_CLASS: Record<string, string> = { xl: "text-3xl font-bold", lg: "text-2xl font-bold", md: "text-xl font-semibold", sm: "text-lg font-semibold" };
const TEXT_SIZE_CLASS: Record<string, string> = { lg: "text-base", md: "text-sm", sm: "text-xs" };
const ALIGN_CLASS: Record<string, string> = { left: "text-left", center: "text-center", right: "text-right" };
const FONT_CLASS: Record<LandingFontFamily, string> = { elvellon: "font-elvellon", avenor: "font-avenor" };

function newTempId(): string {
  return `new-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function isTempId(id: string): boolean {
  return id.startsWith("new-");
}

function isImageDocument(doc: BackendArchivoItem): boolean {
  const mime = String(doc.mime_type || "").toLowerCase();
  const ext = String(doc.extension || "").toLowerCase();
  return mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext);
}

function isVideoDocument(doc: BackendArchivoItem): boolean {
  const mime = String(doc.mime_type || "").toLowerCase();
  const ext = String(doc.extension || "").toLowerCase();
  return mime.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(ext);
}

// Único punto de selección de multimedia: subir un archivo o elegirlo del
// módulo documental, navegando por carpetas igual que en Cursos. Nunca una URL
// escrita a mano.
type MediaTarget =
  | { kind: "block-image"; blockId: string }
  | { kind: "block-video"; blockId: string }
  | { kind: "about-video"; videoId: string; encuadre: "horizontal" | "vertical" }
  | { kind: "ally-logo"; allyId: string }
  | { kind: "news-image"; newsId: string };

/**
 * Descarga con `Authorization` y expone un blob local: un `<img>`/`<video>`
 * normal nunca manda el token, así que un archivo todavía no público (recién
 * subido y sin guardar, o de una empresa/curso ajeno) siempre daba 401 y el
 * editor mostraba el placeholder aunque la subida hubiera funcionado.
 */
function useProtectedObjectUrl(canonicalPath: string): string {
  const [objectUrl, setObjectUrl] = useState("");

  useEffect(() => {
    setObjectUrl("");
    if (!canonicalPath) {
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;
    const target = resolveApiUrl(canonicalPath);
    const token = getStoredToken();

    void (async () => {
      try {
        const response = await fetch(target, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
        if (!response.ok) {
          return;
        }
        const blob = await response.blob();
        if (cancelled) {
          return;
        }
        createdUrl = window.URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      } catch {
        // Se mantiene el fallback visual; no hay nada más que hacer aquí.
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) {
        window.URL.revokeObjectURL(createdUrl);
      }
    };
  }, [canonicalPath]);

  return objectUrl;
}

function ProtectedImage({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const objectUrl = useProtectedObjectUrl(path);
  return (
    <img
      src={objectUrl || IMAGE_FALLBACK}
      alt={alt}
      className={className}
      onError={(event) => { event.currentTarget.src = IMAGE_FALLBACK; }}
    />
  );
}

/**
 * Vista previa de un video privado. Se descarga solo al pedirla: con el
 * archivo entero en un blob, un video de cien megas se bajaba en cada render y
 * dejaba el editor congelado.
 */
function ProtectedVideo({ path, className }: { path: string; className?: string }) {
  const [cargar, setCargar] = useState(false);
  const objectUrl = useProtectedObjectUrl(cargar ? path : "");
  useEffect(() => { setCargar(false); }, [path]);
  if (!cargar) {
    return (
      <button
        type="button"
        onClick={() => setCargar(true)}
        className={clsx(className, "flex flex-col items-center justify-center gap-1 bg-slate-900 text-xs text-white/80 hover:text-white")}
      >
        <Video className="h-5 w-5" />
        Video listo · Previsualizar
      </button>
    );
  }
  if (!objectUrl) {
    return <div className={clsx(className, "flex items-center justify-center text-xs text-muted-foreground")}>Cargando video...</div>;
  }
  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <video src={objectUrl} controls className={className} />;
}

function FontFamilyPicker({ value, onChange }: { value: LandingFontFamily; onChange: (font: LandingFontFamily) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FONT_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={clsx(
            "rounded-lg border px-2.5 py-1.5 text-left leading-none transition-colors",
            value === option.key ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
          )}
        >
          <span className={clsx(option.className, "block text-base")}>{option.sample}</span>
          <span className="text-[10px] text-muted-foreground">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function FontSizeSelector({ tipo, fuente, value, onChange }: { tipo: "heading" | "paragraph"; fuente: LandingFontFamily; value: string; onChange: (size: string) => void }) {
  const sizes = tipo === "heading" ? HEADING_SIZES : TEXT_SIZES;
  const previewSize = tipo === "heading" ? HEADING_SIZE_PREVIEW : TEXT_SIZE_PREVIEW;
  const fontClass = FONT_CLASS[fuente] || FONT_CLASS.avenor;
  const sampleText = tipo === "heading" ? "Zarpi" : "Aa texto";

  return (
    <div className="flex flex-wrap gap-1.5">
      {sizes.map((size) => (
        <button
          key={size}
          type="button"
          onClick={() => onChange(size)}
          className={clsx(
            "rounded-lg border px-2.5 py-1.5 leading-none transition-colors",
            value === size ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
          )}
        >
          <span className={fontClass} style={{ fontSize: previewSize[size] }}>{sampleText}</span>
          <span className="ml-1.5 text-[10px] text-muted-foreground">{size.toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
}

function TokenColorPicker({ value, onChange }: { value: LandingBrandToken; onChange: (token: LandingBrandToken) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(TOKEN_SWATCHES) as LandingBrandToken[]).map((token) => {
        const swatch = TOKEN_SWATCHES[token];
        const selected = value === token;
        return (
          <button
            key={token}
            type="button"
            title={`${swatch.label} · claro ${swatch.light} / oscuro ${swatch.dark}`}
            onClick={() => onChange(token)}
            className={clsx(
              "flex items-center gap-1 rounded-full border px-1.5 py-1 transition-colors",
              selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40",
            )}
          >
            <span className="h-4 w-4 rounded-full border border-border" style={{ background: swatch.light }} />
            <span className="h-4 w-4 rounded-full border border-border" style={{ background: swatch.dark }} />
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vista previa en tiempo real, con toggle claro/oscuro local: `.dark` solo se
// aplica al wrapper interno de la previsualización, no al tema de la sesión.
// ─────────────────────────────────────────────────────────────────────────────
function LandingLivePreview({ blocks, allies }: { blocks: LandingBlock[]; allies: LandingAlly[] }) {
  const [dark, setDark] = useState(false);
  const ordered = [...blocks].filter((block) => block.activo).sort((a, b) => a.orden - b.orden);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm text-foreground">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Vista previa en vivo — Novedades y aliados</p>
        <button
          type="button"
          onClick={() => setDark((current) => !current)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors text-foreground"
        >
          {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />} 
          {dark ? "Ver en claro" : "Ver en oscuro"}
        </button>
      </div>

      {/* Contenedor con fondo e iluminación forzada vía style */}
      <div 
        style={{
          backgroundColor: dark ? "#0F0F0F" : "#FFFFFF",
          color: dark ? "#FFFFFF" : "#000000",
        }}
        className={clsx(
          "rounded-xl border p-6 transition-colors duration-200 space-y-4",
          dark ? "border-zinc-800" : "border-slate-200"
        )}
      >
        {ordered.map((block) => (
          <div key={block.id} className={ALIGN_CLASS[block.alineacion] || "text-left"}>
            {block.tipo === "heading" ? (
              <p
                className={clsx(
                  HEADING_SIZE_CLASS[block.tamano_fuente] || HEADING_SIZE_CLASS.md,
                  FONT_CLASS[block.fuente],
                  dark ? "text-accent" : "text-primary"
                )}
              >
                {block.contenido || "Encabezado de ejemplo"}
              </p>
            ) : null}

            {block.tipo === "paragraph" ? (
              <p
                className={clsx(
                  TEXT_SIZE_CLASS[block.tamano_fuente] || TEXT_SIZE_CLASS.md,
                  FONT_CLASS[block.fuente],
                  dark ? "text-white" : "text-black"
                )}
              >
                {block.contenido || "Texto de ejemplo."}
              </p>
            ) : null}

            {block.tipo === "image" && block.contenido ? (
              <ProtectedImage
                path={block.contenido}
                alt=""
                className={clsx(
                  "inline-block max-h-40 rounded-lg border object-cover",
                  dark ? "border-zinc-800" : "border-slate-200"
                )}
              />
            ) : null}

            {block.tipo === "video" && block.contenido ? (
              <ProtectedVideo 
                path={block.contenido} 
                className={clsx(
                  "inline-block max-h-40 rounded-lg border",
                  dark ? "border-zinc-800" : "border-slate-200"
                )} 
              />
            ) : null}

            {block.tipo === "button" ? (
              <span
                className={clsx(
                  "inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                  dark ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"
                )}
              >
                {block.contenido || "Boton"}
              </span>
            ) : null}

            {block.tipo === "allies_grid" ? (
              <div className="grid grid-cols-3 gap-3">
                {allies.filter((a) => a.activo).slice(0, 6).map((ally) => (
                  <div 
                    key={ally.id} 
                    style={{ backgroundColor: dark ? "#171717" : "#FFFFFF" }}
                    className={clsx(
                      "rounded-lg border p-2 text-center text-xs",
                      dark ? "border-zinc-800 text-white" : "border-slate-200 text-black"
                    )}
                  >
                    {ally.logo_url ? (
                      <ProtectedImage path={ally.logo_url} alt={ally.nombre} className="mx-auto h-8 object-contain" />
                    ) : ally.nombre}
                  </div>
                ))}
                {allies.length === 0 ? (
                  <p className={clsx("col-span-3 text-xs", dark ? "text-zinc-400" : "text-slate-500")}>
                    Sin aliados
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}

        {ordered.length === 0 ? (
          <p className={clsx("text-sm", dark ? "text-zinc-400" : "text-slate-500")}>
            Esta sección no tiene bloques visibles.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function LandingCmsEditor() {
  const [blocks, setBlocks] = useState<LandingBlock[]>([]);
  const [allies, setAllies] = useState<LandingAlly[]>([]);
  const [news, setNews] = useState<LandingNews[]>([]);
  // Carrusel de "Quiénes somos": se guarda aparte de la estructura de bloques.
  const [videosQS, setVideosQS] = useState<VideosQuienesSomos>(VIDEOS_QUIENES_SOMOS_VACIO);
  const [guardandoVideos, setGuardandoVideos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Selector de multimedia estilo Cursos: navegación por carpetas + subida.
  const [resourcePickerOpen, setResourcePickerOpen] = useState(false);
  const [resourcePickerTarget, setResourcePickerTarget] = useState<MediaTarget | null>(null);
  const [resourceUploadTarget, setResourceUploadTarget] = useState<MediaTarget | null>(null);
  const [resourceUploadAccept, setResourceUploadAccept] = useState("image/*");
  const [resourceExplorer, setResourceExplorer] = useState<BackendExplorerResponse>({ carpetas: [], archivos: [] });
  const [resourceCurrentFolderId, setResourceCurrentFolderId] = useState<string | null>(null);
  const [resourceFolderTrail, setResourceFolderTrail] = useState<Array<{ id: string | null; name: string }>>([{ id: null, name: "Raiz" }]);
  const [resourceSearch, setResourceSearch] = useState("");
  const [resourceSearchResults, setResourceSearchResults] = useState<BackendArchivoItem[] | null>(null);
  const [resourceLoading, setResourceLoading] = useState(false);
  const resourceUploadInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await landingService.getDynamicContentForAdmin();
      setBlocks(data.blocks);
      setAllies(data.allies);
      setNews(data.news);
      setVideosQS(leerVideosQuienesSomos(data.blocks));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el contenido de la Landing.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sectionBlocks = blocks.filter((block) => block.seccion === CMS_SECTION).sort((a, b) => a.orden - b.orden);

  function updateBlock(id: string, patch: Partial<LandingBlock>) {
    setBlocks((prev) => prev.map((block) => (block.id === id ? { ...block, ...patch } : block)));
  }

  function addBlock() {
    const maxOrden = sectionBlocks.reduce((acc, block) => Math.max(acc, block.orden), 0);
    setBlocks((prev) => [
      ...prev,
      {
        id: newTempId(),
        seccion: CMS_SECTION,
        tipo: "paragraph",
        contenido: "",
        alineacion: "left",
        tamano_fuente: "md",
        accion_boton: null,
        accion_url: null,
        token_color: "foreground",
        fuente: "avenor",
        orden: maxOrden + 10,
        activo: true,
      },
    ]);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((block) => block.id !== id));
  }

  function moveBlock(id: string, direction: -1 | 1) {
    const ordered = [...sectionBlocks];
    const index = ordered.findIndex((block) => block.id === id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;
    const a = ordered[index];
    const b = ordered[targetIndex];
    updateBlock(a.id, { orden: b.orden });
    updateBlock(b.id, { orden: a.orden });
  }

  async function saveBlocks() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      // El backend genera id definitivo para los bloques nuevos (id "new-...").
      const payload = blocks.map((block) => ({ ...block, id: isTempId(block.id) ? "" : block.id }));
      const saved = await landingService.saveBlocks(payload as LandingBlock[]);
      setBlocks(saved);
      setMessage("Estructura de la Landing guardada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la estructura de bloques.");
    } finally {
      setSaving(false);
    }
  }

  function actualizarVideoQS(id: string, cambios: Partial<VideoRotativo>) {
    setVideosQS((c) => ({ ...c, videos: c.videos.map((v) => (v.id === id ? { ...v, ...cambios } : v)) }));
  }

  function agregarVideoQS() {
    setVideosQS((c) => (c.videos.length >= MAX_VIDEOS_QUIENES_SOMOS
      ? c
      : { ...c, videos: [...c.videos, { id: newTempId(), titulo: "", horizontal: null, vertical: null }] }));
  }

  function moverVideoQS(id: string, direccion: -1 | 1) {
    setVideosQS((c) => {
      const lista = [...c.videos];
      const i = lista.findIndex((v) => v.id === id);
      const j = i + direccion;
      if (i < 0 || j < 0 || j >= lista.length) return c;
      [lista[i], lista[j]] = [lista[j], lista[i]];
      return { ...c, videos: lista };
    });
  }

  async function guardarVideosQS() {
    const sinArchivo = videosQS.videos.findIndex((v) => !v.horizontal && !v.vertical);
    if (sinArchivo >= 0) {
      setError(`El video ${sinArchivo + 1} no tiene archivo: sube la versión horizontal, la vertical o las dos, o quítalo.`);
      return;
    }
    setGuardandoVideos(true);
    setMessage("");
    setError("");
    try {
      const guardado = await landingService.saveVideosQuienesSomos({
        ...videosQS,
        // Los ids temporales del editor no se guardan: el backend asigna los suyos.
        videos: videosQS.videos.map((v) => ({ ...v, id: v.id && !isTempId(v.id) ? v.id : undefined })),
      });
      setVideosQS(leerVideosQuienesSomos([guardado]));
      setMessage(videosQS.videos.length
        ? "Videos de «Quiénes somos» publicados."
        : "Sin videos: el carrusel de «Quiénes somos» queda oculto.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los videos.");
    } finally {
      setGuardandoVideos(false);
    }
  }

  async function addAlly() {
    try {
      const created = await landingService.createAlly({
        nombre: "Nuevo aliado",
        logo_url: "",
        categoria: "",
        enlace: "",
        orden: allies.length * 10 + 10,
        activo: true,
      });
      setAllies((prev) => [...prev, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el aliado.");
    }
  }

  async function saveAlly(ally: LandingAlly) {
    try {
      const updated = await landingService.updateAlly(ally.id, ally);
      setAllies((prev) => prev.map((item) => (item.id === ally.id ? updated : item)));
      setMessage("Aliado actualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el aliado.");
    }
  }

  async function removeAlly(id: string) {
    try {
      await landingService.deleteAlly(id);
      setAllies((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el aliado.");
    }
  }

  async function addNews() {
    try {
      const created = await landingService.createNews({
        titulo: "Nueva novedad",
        resumen: "Resumen breve de la novedad.",
        contenido: "",
        imagen_url: "",
        orden: news.length * 10 + 10,
        activo: true,
      });
      setNews((prev) => [...prev, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la novedad.");
    }
  }

  async function saveNewsItem(item: LandingNews) {
    try {
      const updated = await landingService.updateNews(item.id, item);
      setNews((prev) => prev.map((row) => (row.id === item.id ? updated : row)));
      setMessage("Novedad actualizada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la novedad.");
    }
  }

  async function removeNews(id: string) {
    try {
      await landingService.deleteNews(id);
      setNews((prev) => prev.filter((row) => row.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la novedad.");
    }
  }

  function applyDocumentToTarget(target: MediaTarget, doc: BackendArchivoItem): void {
    const resolvedUrl = toApiPath(doc.storage_url);
    if (!resolvedUrl) {
      setError("El recurso seleccionado no tiene URL disponible.");
      return;
    }

    if (target.kind === "block-image" || target.kind === "block-video") {
      updateBlock(target.blockId, { contenido: resolvedUrl });
      return;
    }
    if (target.kind === "about-video") {
      actualizarVideoQS(target.videoId, { [target.encuadre]: resolvedUrl });
      return;
    }
    if (target.kind === "ally-logo") {
      setAllies((prev) => prev.map((item) => (item.id === target.allyId ? { ...item, logo_url: resolvedUrl } : item)));
      return;
    }
    setNews((prev) => prev.map((item) => (item.id === target.newsId ? { ...item, imagen_url: resolvedUrl } : item)));
  }

  async function loadResourceFolder(parentId: string | null): Promise<void> {
    setResourceLoading(true);
    try {
      const explorer = await businessService.listDocumentExplorer(parentId);
      setResourceExplorer(explorer);
      setResourceCurrentFolderId(parentId);
    } catch {
      setError("No se pudieron cargar las carpetas de documentos.");
    } finally {
      setResourceLoading(false);
    }
  }

  async function handleSearchResource(query: string): Promise<void> {
    if (!query.trim()) {
      setResourceSearchResults(null);
      return;
    }
    try {
      const rows = await businessService.searchDocumentFiles(query.trim());
      setResourceSearchResults(rows);
    } catch {
      setError("No se pudieron buscar recursos en tus carpetas.");
    }
  }

  async function openPickerForTarget(target: MediaTarget): Promise<void> {
    setResourcePickerTarget(target);
    setResourcePickerOpen(true);
    setResourceSearch("");
    setResourceSearchResults(null);
    setResourceFolderTrail([{ id: null, name: "Raiz" }]);
    await loadResourceFolder(null);
  }

  function triggerUploadForTarget(target: MediaTarget): void {
    setResourceUploadTarget(target);
    setResourceUploadAccept(target.kind === "block-video" || target.kind === "about-video" ? "video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v" : "image/png,image/jpeg,image/webp");
    window.setTimeout(() => resourceUploadInputRef.current?.click(), 0);
  }

  async function openResourceFolder(folder: { id: string; nombre: string }): Promise<void> {
    setResourceSearch("");
    setResourceSearchResults(null);
    setResourceFolderTrail((prev) => [...prev, { id: folder.id, name: folder.nombre }]);
    await loadResourceFolder(folder.id);
  }

  async function jumpResourceTrail(index: number): Promise<void> {
    const node = resourceFolderTrail[index];
    setResourceSearch("");
    setResourceSearchResults(null);
    setResourceFolderTrail((prev) => prev.slice(0, index + 1));
    await loadResourceFolder(node.id);
  }

  function selectDocumentResource(doc: BackendArchivoItem): void {
    if (!resourcePickerTarget) return;
    const isVideoTarget = resourcePickerTarget.kind === "block-video" || resourcePickerTarget.kind === "about-video";
    if (isVideoTarget && !isVideoDocument(doc)) {
      setError("Este bloque necesita un archivo de video.");
      return;
    }
    if (!isVideoTarget && !isImageDocument(doc)) {
      setError("Este campo necesita un archivo de imagen.");
      return;
    }
    applyDocumentToTarget(resourcePickerTarget, doc);
    setResourcePickerOpen(false);
    setResourcePickerTarget(null);
  }

  async function handleUploadResourceFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file || !resourceUploadTarget) {
      event.target.value = "";
      return;
    }

    const isVideoTarget = resourceUploadTarget.kind === "block-video" || resourceUploadTarget.kind === "about-video";
    if (isVideoTarget && !file.type.startsWith("video/")) {
      setError("Este bloque necesita un archivo de video.");
      event.target.value = "";
      setResourceUploadTarget(null);
      return;
    }
    if (!isVideoTarget && !file.type.startsWith("image/")) {
      setError("Este campo necesita un archivo de imagen.");
      event.target.value = "";
      setResourceUploadTarget(null);
      return;
    }

    try {
      const created = await businessService.uploadDocumentFile(file, resourceCurrentFolderId, "landing");
      applyDocumentToTarget(resourceUploadTarget, created);
      if (isVideoTarget && file.size > VIDEO_PESADO_BYTES) {
        // La Landing la abre cualquiera, a menudo desde el celular: un video
        // pesado se nota en datos y en el tiempo de carga.
        setMessage(
          `Video subido. Pesa ${Math.round(file.size / 1024 / 1024)} MB: para la Landing conviene comprimirlo `
          + "a menos de 30 MB (por ejemplo, 1080p en MP4).",
        );
      }
      await loadResourceFolder(resourceCurrentFolderId);
    } catch (err) {
      setError(err instanceof Error && err.message.trim() ? err.message : "No se pudo subir el archivo.");
    } finally {
      setResourceUploadTarget(null);
      event.target.value = "";
    }
  }

  // Se invoca como función (`mediaControls({...})`), no como <Componente/>:
  // declarado aquí dentro, cada render sería un tipo nuevo y React remontaría la
  // vista previa en cada tecla, volviendo a descargar el archivo.
  function mediaControls({ target, value, kind }: { target: MediaTarget; value: string; kind: "image" | "video" }) {
    return (
      <div className="space-y-2">
        {kind === "image" ? (
          value ? (
            <ProtectedImage path={value} alt="" className="h-24 w-full max-w-xs rounded-lg border border-border object-cover" />
          ) : (
            <img src={IMAGE_FALLBACK} alt="" className="h-24 w-full max-w-xs rounded-lg border border-border object-cover" />
          )
        ) : value ? (
          <ProtectedVideo path={value} className="h-24 w-full max-w-xs rounded-lg border border-border object-cover" />
        ) : (
          <div className="flex h-16 w-full max-w-xs items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">Sin video</div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void openPickerForTarget(target)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Seleccionar {kind === "image" ? "imagen" : "video"}
          </button>
          <button
            type="button"
            onClick={() => triggerUploadForTarget(target)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Upload className="h-3.5 w-3.5" /> Subir {kind === "image" ? "imagen" : "video"}
          </button>
          {value ? (
            <button
              type="button"
              onClick={() => { void abrirArchivoEnPestana(value); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Ver
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const pickerVisibleFiles = resourceSearchResults ?? resourceExplorer.archivos;
  const pickerVisibleFolders = resourceSearchResults ? [] : resourceExplorer.carpetas;

  return (
    <div className="space-y-5">
      <input
        ref={resourceUploadInputRef}
        type="file"
        accept={resourceUploadAccept}
        className="hidden"
        onChange={(event) => void handleUploadResourceFile(event)}
      />

      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-base font-semibold">
              <Layers className="h-4 w-4 text-primary" />
              Gestion de Landing — Novedades y aliados
            </p>
            <p className="text-sm text-muted-foreground">
              Edita por bloques el contenido publico de la seccion &quot;Novedades y aliados&quot;. Los cambios
              de bloques solo se publican al pulsar &quot;Guardar estructura&quot;.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void saveBlocks()}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar estructura"}
          </button>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
      {loading ? <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">Cargando contenido...</div> : null}

      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-base font-semibold">
              <Clapperboard className="h-4 w-4 text-primary" />
              Quiénes somos — videos
            </p>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Videos que se turnan solos en la sección &quot;Quiénes somos&quot;. Sube por cada uno la versión horizontal
              (computador, 16:9), la vertical (celular, 9:16) o las dos: cada visitante ve la de su pantalla y, si solo
              hay una, esa se ve en todas. Se guardan con su propio botón.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void guardarVideosQS()}
            disabled={guardandoVideos || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {guardandoVideos ? "Guardando..." : "Guardar videos"}
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={videosQS.activo}
              onChange={(e) => setVideosQS((c) => ({ ...c, activo: e.target.checked }))}
              className="h-4 w-4 accent-primary"
            />
            Mostrar en la Landing
          </label>
          <label className="inline-flex flex-wrap items-center gap-2">
            Cambiar de video cada
            <select
              value={INTERVALOS_SEGUNDOS.includes(videosQS.intervalo_segundos) ? String(videosQS.intervalo_segundos) : "otro"}
              onChange={(e) => {
                if (e.target.value !== "otro") setVideosQS((c) => ({ ...c, intervalo_segundos: Number(e.target.value) }));
              }}
              className="rounded-lg border border-border bg-white px-2 py-1 text-sm"
            >
              {INTERVALOS_SEGUNDOS.map((s) => <option key={s} value={s}>{s} segundos</option>)}
              <option value="otro">Otro…</option>
            </select>
            <input
              type="number"
              min={5}
              max={300}
              value={videosQS.intervalo_segundos}
              onChange={(e) => setVideosQS((c) => ({ ...c, intervalo_segundos: Math.min(300, Math.max(5, Number(e.target.value) || 5)) }))}
              aria-label="Segundos entre videos"
              className="w-20 rounded-lg border border-border bg-white px-2 py-1 text-sm"
            />
          </label>
          <span className="text-xs text-muted-foreground">Si un video termina antes, pasa al siguiente en ese momento.</span>
        </div>

        {videosQS.videos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Todavía no hay videos. Agrega el primero.
          </p>
        ) : (
          <ol className="space-y-3">
            {videosQS.videos.map((video, i) => (
              <li key={video.id} className="rounded-lg border border-border p-3">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                  <input
                    value={video.titulo ?? ""}
                    maxLength={120}
                    onChange={(e) => actualizarVideoQS(video.id as string, { titulo: e.target.value })}
                    placeholder="Título (opcional, se muestra sobre el video)"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-1.5 text-sm"
                  />
                  <button type="button" onClick={() => moverVideoQS(video.id as string, -1)} disabled={i === 0} aria-label="Subir" className="rounded-lg border border-border p-1.5 hover:bg-muted disabled:opacity-40">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => moverVideoQS(video.id as string, 1)} disabled={i === videosQS.videos.length - 1} aria-label="Bajar" className="rounded-lg border border-border p-1.5 hover:bg-muted disabled:opacity-40">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideosQS((c) => ({ ...c, videos: c.videos.filter((v) => v.id !== video.id) }))}
                    aria-label={`Quitar video ${i + 1}`}
                    className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><Monitor className="h-3.5 w-3.5" /> Horizontal · computador (16:9)</p>
                    {mediaControls({ target: { kind: "about-video", videoId: video.id as string, encuadre: "horizontal" }, value: video.horizontal ?? "", kind: "video" })}
                    {video.horizontal ? (
                      <button type="button" onClick={() => actualizarVideoQS(video.id as string, { horizontal: null })} className="mt-1 text-xs text-red-600 hover:underline">Quitar versión horizontal</button>
                    ) : null}
                  </div>
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><Smartphone className="h-3.5 w-3.5" /> Vertical · celular (9:16)</p>
                    {mediaControls({ target: { kind: "about-video", videoId: video.id as string, encuadre: "vertical" }, value: video.vertical ?? "", kind: "video" })}
                    {video.vertical ? (
                      <button type="button" onClick={() => actualizarVideoQS(video.id as string, { vertical: null })} className="mt-1 text-xs text-red-600 hover:underline">Quitar versión vertical</button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        <button
          type="button"
          onClick={agregarVideoQS}
          disabled={videosQS.videos.length >= MAX_VIDEOS_QUIENES_SOMOS}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Agregar video
          <span className="text-xs text-muted-foreground">({videosQS.videos.length}/{MAX_VIDEOS_QUIENES_SOMOS})</span>
        </button>
      </div>

      <LandingLivePreview blocks={sectionBlocks} allies={allies} />

      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Bloques de la seccion</p>
          <button
            type="button"
            onClick={addBlock}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar bloque
          </button>
        </div>

        <div className="space-y-3">
          {sectionBlocks.map((block, index) => (
            <div key={block.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={block.tipo}
                  onChange={(event) => updateBlock(block.id, { tipo: event.target.value as LandingBlock["tipo"] })}
                  className="h-8 rounded-lg border border-border px-2 text-xs"
                >
                  {Object.entries(BLOCK_TYPE_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>

                <select
                  value={block.alineacion}
                  onChange={(event) => updateBlock(block.id, { alineacion: event.target.value as LandingBlock["alineacion"] })}
                  className="h-8 rounded-lg border border-border px-2 text-xs"
                >
                  <option value="left">Izquierda</option>
                  <option value="center">Centro</option>
                  <option value="right">Derecha</option>
                </select>

                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={block.activo} onChange={(event) => updateBlock(block.id, { activo: event.target.checked })} />
                  Visible
                </label>

                <div className="ml-auto flex items-center gap-1.5">
                  <button type="button" onClick={() => moveBlock(block.id, -1)} disabled={index === 0} className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-40">
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(block.id, 1)}
                    disabled={index === sectionBlocks.length - 1}
                    className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-40"
                  >
                    ↓
                  </button>
                  <button type="button" onClick={() => removeBlock(block.id)} className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Color (token de marca)</p>
                  <TokenColorPicker value={block.token_color} onChange={(token) => updateBlock(block.id, { token_color: token })} />
                </div>
                {(block.tipo === "heading" || block.tipo === "paragraph") ? (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Tipografia</p>
                    <FontFamilyPicker value={block.fuente} onChange={(font) => updateBlock(block.id, { fuente: font })} />
                  </div>
                ) : null}
              </div>

              {(block.tipo === "heading" || block.tipo === "paragraph") ? (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Tamano</p>
                  <FontSizeSelector tipo={block.tipo} fuente={block.fuente} value={block.tamano_fuente} onChange={(size) => updateBlock(block.id, { tamano_fuente: size })} />
                </div>
              ) : null}

              {block.tipo === "heading" || block.tipo === "paragraph" ? (
                <textarea
                  value={block.contenido ?? ""}
                  onChange={(event) => updateBlock(block.id, { contenido: event.target.value })}
                  rows={block.tipo === "heading" ? 1 : 3}
                  placeholder={block.tipo === "heading" ? "Texto del encabezado" : "Texto del parrafo"}
                  className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              ) : null}

              {block.tipo === "image" ? (
                <div className="mt-3">
                  {mediaControls({ target: { kind: "block-image", blockId: block.id }, value: block.contenido ?? "", kind: "image" })}
                </div>
              ) : null}

              {block.tipo === "video" ? (
                <div className="mt-3">
                  {mediaControls({ target: { kind: "block-video", blockId: block.id }, value: block.contenido ?? "", kind: "video" })}
                </div>
              ) : null}

              {block.tipo === "button" ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <input
                    value={block.contenido ?? ""}
                    onChange={(event) => updateBlock(block.id, { contenido: event.target.value })}
                    placeholder="Texto del boton"
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  />
                  <select
                    value={block.accion_boton ?? "open_login"}
                    onChange={(event) => updateBlock(block.id, { accion_boton: event.target.value as LandingButtonAction })}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    {BUTTON_ACTIONS.map((action) => (
                      <option key={action.key} value={action.key}>
                        {action.label}
                      </option>
                    ))}
                  </select>
                  {block.accion_boton === "external_link" ? (
                    <input
                      value={block.accion_url ?? ""}
                      onChange={(event) => updateBlock(block.id, { accion_url: event.target.value })}
                      placeholder="https://..."
                      className="rounded-lg border border-border px-3 py-2 text-sm"
                    />
                  ) : null}
                </div>
              ) : null}

              {block.tipo === "allies_grid" ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Inserta aqui la cuadricula con los aliados activos administrados abajo.
                </p>
              ) : null}
            </div>
          ))}
          {!sectionBlocks.length && !loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Esta seccion todavia no tiene bloques.</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-primary" /> Muro de aliados
          </p>
          <button
            type="button"
            onClick={() => void addAlly()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar aliado
          </button>
        </div>
        <div className="space-y-3">
          {allies.map((ally) => (
            <div key={ally.id} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[auto_1fr]">
              {mediaControls({ target: { kind: "ally-logo", allyId: ally.id }, value: ally.logo_url ?? "", kind: "image" })}
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={ally.nombre}
                  onChange={(event) => setAllies((prev) => prev.map((item) => (item.id === ally.id ? { ...item, nombre: event.target.value } : item)))}
                  placeholder="Nombre"
                  className="rounded-lg border border-border px-2 py-1.5 text-sm"
                />
                <input
                  value={ally.categoria ?? ""}
                  onChange={(event) => setAllies((prev) => prev.map((item) => (item.id === ally.id ? { ...item, categoria: event.target.value } : item)))}
                  placeholder="Categoria"
                  className="rounded-lg border border-border px-2 py-1.5 text-sm"
                />
                <input
                  value={ally.enlace ?? ""}
                  onChange={(event) => setAllies((prev) => prev.map((item) => (item.id === ally.id ? { ...item, enlace: event.target.value } : item)))}
                  placeholder="Enlace (sitio del aliado)"
                  className="rounded-lg border border-border px-2 py-1.5 text-sm sm:col-span-2"
                />
                <div className="flex items-center gap-2 sm:col-span-2">
                  <button type="button" onClick={() => void saveAlly(ally)} className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted">
                    Guardar
                  </button>
                  <button type="button" onClick={() => void removeAlly(ally.id)} className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!allies.length && !loading ? <p className="py-4 text-center text-sm text-muted-foreground">Sin aliados registrados.</p> : null}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Newspaper className="h-4 w-4 text-primary" /> Miniblog de novedades
          </p>
          <button
            type="button"
            onClick={() => void addNews()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar novedad
          </button>
        </div>
        <div className="space-y-3">
          {news.map((item) => (
            <div key={item.id} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[auto_1fr]">
              {mediaControls({ target: { kind: "news-image", newsId: item.id }, value: item.imagen_url ?? "", kind: "image" })}
              <div className="space-y-2">
                <input
                  value={item.titulo}
                  onChange={(event) => setNews((prev) => prev.map((row) => (row.id === item.id ? { ...row, titulo: event.target.value } : row)))}
                  placeholder="Titulo"
                  className="w-full rounded-lg border border-border px-2 py-1.5 text-sm font-medium"
                />
                <textarea
                  value={item.resumen}
                  onChange={(event) => setNews((prev) => prev.map((row) => (row.id === item.id ? { ...row, resumen: event.target.value } : row)))}
                  placeholder="Resumen"
                  rows={2}
                  className="w-full rounded-lg border border-border px-2 py-1.5 text-sm"
                />
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => void saveNewsItem(item)} className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted">
                    Guardar
                  </button>
                  <button type="button" onClick={() => void removeNews(item.id)} className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!news.length && !loading ? <p className="py-4 text-center text-sm text-muted-foreground">Sin novedades publicadas.</p> : null}
        </div>
      </div>

      {resourcePickerOpen ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.35)" }}>
          <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <p className="text-sm font-semibold">Seleccionar recurso desde Documentos</p>
              <button type="button" onClick={() => setResourcePickerOpen(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 border-b border-border px-5 py-3">
              <input
                value={resourceSearch}
                onChange={(event) => {
                  setResourceSearch(event.target.value);
                  void handleSearchResource(event.target.value);
                }}
                placeholder="Buscar por nombre..."
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {resourceFolderTrail.map((node, index) => (
                  <button
                    key={`${node.id || "root"}-${index}`}
                    type="button"
                    onClick={() => void jumpResourceTrail(index)}
                    className={clsx(
                      "rounded-md border px-2 py-1 text-xs",
                      index === resourceFolderTrail.length - 1 ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {node.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {resourceLoading ? <p className="text-center text-sm text-muted-foreground">Cargando...</p> : null}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {pickerVisibleFolders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => void openResourceFolder(folder)}
                    className="rounded-lg border border-border bg-sky-50/40 p-3 text-left hover:bg-sky-50"
                  >
                    <p className="truncate text-sm font-medium">{folder.nombre}</p>
                    <p className="text-[11px] text-muted-foreground">Carpeta</p>
                  </button>
                ))}
                {pickerVisibleFiles.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => selectDocumentResource(file)}
                    className="group flex flex-col items-center gap-1.5 rounded-lg border border-border p-2 text-left hover:border-primary/40"
                  >
                    {isImageDocument(file) && file.storage_url ? (
                      <ProtectedImage path={file.storage_url} alt={file.nombre} className="h-16 w-full rounded object-cover" />
                    ) : (
                      <div className="flex h-16 w-full items-center justify-center rounded bg-muted">
                        <Video className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <span className="w-full truncate text-[11px] text-muted-foreground group-hover:text-foreground">{file.nombre}</span>
                  </button>
                ))}
              </div>
              {!resourceLoading && pickerVisibleFolders.length === 0 && pickerVisibleFiles.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No hay archivos en esta carpeta.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
