import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Gift,
  ImageOff,
  ImagePlus,
  Inbox,
  Loader2,
  Lock,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Star,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { DocumentUploadButton } from "@/components/files/DocumentUploadButton";
import { ImagenArchivo } from "@/components/files/ImagenArchivo";
import { CATEGORIAS_PRODUCTO } from "@/utils/categorias";
import { formatearTamano, obtenerLimiteSubida } from "@/utils/limite-subida";
import { ApiError } from "@/services/api-client";
import { businessService } from "@/services/business.service";
import {
  tendenciasService,
  ETIQUETA_PLATAFORMA,
  MAX_IMAGENES_DISENO,
  type AccesoCortesia,
  type CambiosFicha,
  type EstadoCatalogo,
  type EstadoTendencia,
  type ItemDiseno,
  type OrigenTendencia,
  type ParametrosAccesoTendencias,
  type ProductoEquipo,
} from "@/services/tendencias.service";

import {
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_INPUT,
  IconoPlataforma,
  InsigniaOrigen,
  fechaCorta,
  mensajeError,
} from "./AprobacionComun";
import { ACEPTA_IMAGEN, rutaArchivo } from "./AprobacionFicha";
import { CLASE_ICONO_TILE, ZonaSoltar, soloImagenes } from "./PanelDiseno";

/**
 * Admin › Tendencias: el catálogo de productos virales que sube el equipo
 * (sin pasar por la cola de aprobación), el muro de pago, el precio de la
 * suscripción y las cortesías por persona.
 *
 * Crear con portada publica de una vez; sin portada, el producto pasa a
 * Diseño y el backend avisa a los designers.
 */

type Pestana = "catalogo" | "acceso";
type FiltroOrigen = "" | OrigenTendencia;

const ESPERA_BUSQUEDA_MS = 350;
const MAX_DESCRIPCION = 4000;
const MAX_TEXTO_CORTO = 200;
const MAX_NOTA_CORTESIA = 255;
const ZONA_BOGOTA = "America/Bogota";

const FILTROS_ESTADO: { valor: EstadoCatalogo; etiqueta: string }[] = [
  { valor: "publicado", etiqueta: "Publicados" },
  { valor: "en_diseno", etiqueta: "En diseño" },
  { valor: "archivado", etiqueta: "Archivados" },
  { valor: "caido", etiqueta: "Caídos" },
  { valor: "todos", etiqueta: "Todos" },
];

const OPCIONES_ORIGEN: { valor: FiltroOrigen; etiqueta: string }[] = [
  { valor: "", etiqueta: "Todos" },
  { valor: "equipo", etiqueta: "Equipo" },
  { valor: "importadora", etiqueta: "Importadoras" },
  { valor: "comunidad", etiqueta: "Comunidad" },
];

const ESTADOS: Partial<Record<EstadoTendencia, { texto: string; clase: string; titulo?: string }>> = {
  publicado: {
    texto: "Publicado",
    clase: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
  en_diseno: {
    texto: "En diseño",
    clase: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300",
    titulo: "Espera la portada del equipo de diseño",
  },
  archivado: {
    texto: "Archivado",
    clase: "border-border bg-muted text-muted-foreground",
  },
  caido: {
    texto: "Caído",
    clase: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300",
    titulo: "El video ya no está disponible en la plataforma",
  },
};

const ETIQUETA_ORIGEN_ACCESO: Record<string, string> = {
  cortesia: "Cortesía",
  pago: "Pago",
};

// ── Utilidades ───────────────────────────────────────────────────────────────

function fechaBogota(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("es-CO", { timeZone: ZONA_BOGOTA, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function pesos(valor: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);
}

/** Texto opcional: vacío viaja como null. Conserva los saltos de línea internos. */
function textoOpcional(v: string): string | null {
  return v.trim() || null;
}

interface Duplicado {
  mensaje: string;
  id: string | null;
  estado: string | null;
}

/** El 409 de un video repetido trae `{codigo: "duplicado", mensaje, id, estado}`. */
function duplicadoDe(error: unknown): Duplicado | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const d = error.detail as { codigo?: unknown; mensaje?: unknown; id?: unknown; estado?: unknown } | null;
  if (!d || typeof d !== "object" || d.codigo !== "duplicado") return null;
  return {
    mensaje: typeof d.mensaje === "string" ? d.mensaje : error.message,
    id: typeof d.id === "string" ? d.id : null,
    estado: typeof d.estado === "string" ? d.estado : null,
  };
}

// ── Piezas ───────────────────────────────────────────────────────────────────

function InsigniaEstado({ estado }: { estado: EstadoTendencia }) {
  const e = ESTADOS[estado] ?? { texto: estado, clase: "border-border bg-muted text-muted-foreground" };
  return (
    <span title={e.titulo} className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${e.clase}`}>
      {e.texto}
    </span>
  );
}

function Interruptor({
  id,
  activo,
  disabled = false,
  etiqueta,
  etiquetadoPor,
  descritoPor,
  claseActivo = "bg-emerald-500",
  onCambio,
}: {
  id?: string;
  activo: boolean;
  disabled?: boolean;
  /** Nombre accesible si no hay una etiqueta visible enlazada. */
  etiqueta?: string;
  etiquetadoPor?: string;
  descritoPor?: string;
  claseActivo?: string;
  onCambio: (valor: boolean) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      aria-labelledby={etiquetadoPor}
      aria-describedby={descritoPor}
      disabled={disabled}
      onClick={() => onCambio(!activo)}
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-accent dark:focus-visible:ring-offset-background ${
        activo ? claseActivo : "bg-muted-foreground/30"
      }`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${activo ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function ContadorCaracteres({ valor, max }: { valor: string; max: number }) {
  const n = valor.length;
  return (
    <span className={`text-[11px] tabular-nums ${n >= max ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`} aria-live="polite">
      {n.toLocaleString("es-CO")}/{max.toLocaleString("es-CO")}
    </span>
  );
}

function Campo({
  id,
  etiqueta,
  requerido = false,
  extra,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  requerido?: boolean;
  /** A la derecha de la etiqueta (p. ej. el contador). */
  extra?: ReactNode;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {etiqueta} {requerido && <span className="text-rose-600">*</span>}
        </label>
        {extra}
      </div>
      <div className="mt-1">{children}</div>
      {ayuda && <p id={`${id}-ayuda`} className="mt-1 text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

function AvisoError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
      {children}
    </p>
  );
}

// ── Formulario de producto ───────────────────────────────────────────────────

interface Formulario {
  url: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  por_que_tendencia: string;
  ojo_antes: string;
  regulado: boolean;
  autor_plataforma: string;
  portada: string;
  imagenes: string[];
}

function formularioDesde(item: ItemDiseno | null): Formulario {
  return {
    url: item?.url_video ?? "",
    nombre: item?.nombre ?? "",
    categoria: item?.categoria ?? "",
    descripcion: item?.descripcion ?? "",
    por_que_tendencia: item?.por_que_tendencia ?? "",
    ojo_antes: item?.ojo_antes ?? "",
    regulado: Boolean(item?.regulado),
    autor_plataforma: item?.autor_plataforma ?? "",
    portada: item?.portada_url ?? "",
    imagenes: [...(item?.imagenes ?? [])],
  };
}

/** Solo los textos que cambiaron respecto a lo guardado. */
function cambiosTexto(item: ItemDiseno, f: Formulario): CambiosFicha {
  const base = formularioDesde(item);
  const cambios: CambiosFicha = {};
  if (f.nombre.trim() !== base.nombre.trim()) cambios.nombre = f.nombre.trim();
  if (f.categoria !== base.categoria) cambios.categoria = f.categoria;
  if (f.regulado !== base.regulado) cambios.regulado = f.regulado;
  if (f.descripcion.trim() !== base.descripcion.trim()) cambios.descripcion = textoOpcional(f.descripcion);
  if (f.por_que_tendencia.trim() !== base.por_que_tendencia.trim()) cambios.por_que_tendencia = textoOpcional(f.por_que_tendencia);
  if (f.ojo_antes.trim() !== base.ojo_antes.trim()) cambios.ojo_antes = textoOpcional(f.ojo_antes);
  if (f.autor_plataforma.trim() !== base.autor_plataforma.trim()) cambios.autor_plataforma = textoOpcional(f.autor_plataforma);
  return cambios;
}

/** Portada e imágenes que cambiaron; `portada_url: ""` quita la portada. */
function cambiosVisuales(item: ItemDiseno, f: Formulario): { portada_url?: string; imagenes?: string[] } | null {
  const base = formularioDesde(item);
  const cambios: { portada_url?: string; imagenes?: string[] } = {};
  if (f.portada !== base.portada) cambios.portada_url = f.portada;
  if (f.imagenes.length !== base.imagenes.length || f.imagenes.some((r, i) => r !== base.imagenes[i])) cambios.imagenes = f.imagenes;
  return Object.keys(cambios).length > 0 ? cambios : null;
}

function PanelProducto({
  item,
  onCerrar,
  onGuardado,
  onCambioParcial,
  onAbrirExistente,
}: {
  /** null: producto nuevo. */
  item: ItemDiseno | null;
  onCerrar: () => void;
  onGuardado: () => void;
  /** Se guardó una parte (textos) y falló el resto: la lista se refresca igual. */
  onCambioParcial: () => void;
  onAbrirExistente: (id: string, estado: string | null) => void;
}) {
  const nuevo = item === null;
  const [f, setF] = useState<Formulario>(() => formularioDesde(item));
  const fRef = useRef(f);
  fRef.current = f;
  const [subiendo, setSubiendo] = useState<null | "portada" | "imagenes">(null);
  const subiendoRef = useRef(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [duplicado, setDuplicado] = useState<Duplicado | null>(null);
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const primerCampo = useRef<HTMLInputElement | null>(null);

  // Portada e imágenes solo se cambian en diseño o publicado (regla del backend).
  const visualesEditables = nuevo || item.estado === "en_diseno" || item.estado === "publicado";
  const publicado = item?.estado === "publicado";
  const bloqueado = guardando;
  const restantes = MAX_IMAGENES_DISENO - f.imagenes.length;

  const sucio = nuevo
    ? JSON.stringify(f) !== JSON.stringify(formularioDesde(null))
    : Object.keys(cambiosTexto(item, f)).length > 0 || (visualesEditables && cambiosVisuales(item, f) !== null);

  const poner = <K extends keyof Formulario>(clave: K, valor: Formulario[K]) => {
    setF((prev) => ({ ...prev, [clave]: valor }));
  };

  const agregarImagenes = (rutas: string[]) => {
    setF((prev) => {
      const imagenes = [...prev.imagenes];
      for (const r of rutas) if (!imagenes.includes(r)) imagenes.push(r);
      return { ...prev, imagenes: imagenes.slice(0, MAX_IMAGENES_DISENO) };
    });
  };

  const subir = async (archivos: File[], destino: "portada" | "imagenes") => {
    if (subiendoRef.current || bloqueado || !visualesEditables) return;
    if (archivos.length === 0) {
      toast.error("Usa imágenes PNG, JPG o WebP.");
      return;
    }
    const cupo = destino === "portada" ? 1 : MAX_IMAGENES_DISENO - fRef.current.imagenes.length;
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
      const grande = lote.find((archivo) => archivo.size > limite);
      if (grande) {
        toast.error(`«${grande.name}» pesa ${formatearTamano(grande.size)} y el máximo es ${formatearTamano(limite)}.`);
        return;
      }
      for (const archivo of lote) {
        const subido = await businessService.uploadDocumentFile(archivo, null, "tendencias");
        rutas.push(rutaArchivo(subido));
      }
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo subir la imagen."));
    } finally {
      subiendoRef.current = false;
      setSubiendo(null);
      // Lo que alcanzó a subir se conserva aunque una falle.
      if (rutas.length > 0) {
        if (destino === "portada") poner("portada", rutas[0]);
        else agregarImagenes(rutas);
      }
    }
  };

  // Pegar una imagen fuera de las zonas: va a la portada si falta, si no a las imágenes.
  const subirRef = useRef(subir);
  subirRef.current = subir;
  useEffect(() => {
    if (!visualesEditables) return;
    const alPegar = (e: ClipboardEvent) => {
      if (e.defaultPrevented) return;
      const archivos = soloImagenes(e.clipboardData?.files);
      if (archivos.length === 0) return;
      e.preventDefault();
      void subirRef.current(archivos, fRef.current.portada ? "imagenes" : "portada");
    };
    window.addEventListener("paste", alPegar);
    return () => window.removeEventListener("paste", alPegar);
  }, [visualesEditables]);

  const mover = (i: number, delta: -1 | 1) => {
    setF((prev) => {
      const j = i + delta;
      if (j < 0 || j >= prev.imagenes.length) return prev;
      const imagenes = [...prev.imagenes];
      [imagenes[i], imagenes[j]] = [imagenes[j], imagenes[i]];
      return { ...prev, imagenes };
    });
  };

  const quitarImagen = (i: number) => {
    setF((prev) => ({ ...prev, imagenes: prev.imagenes.filter((_, k) => k !== i) }));
  };

  // La imagen pasa a portada y la portada anterior ocupa su lugar: no se pierde nada.
  const usarComoPortada = (ruta: string) => {
    setF((prev) => {
      const i = prev.imagenes.indexOf(ruta);
      const imagenes = [...prev.imagenes];
      if (i >= 0) {
        if (prev.portada && !imagenes.includes(prev.portada)) imagenes[i] = prev.portada;
        else imagenes.splice(i, 1);
      }
      return { ...prev, portada: ruta, imagenes };
    });
  };

  const intentarCerrar = () => {
    if (guardando) return;
    if (sucio && !confirmarCierre) {
      setConfirmarCierre(true);
      return;
    }
    onCerrar();
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (guardando || subiendoRef.current) return;
    const faltan = [
      nuevo && !f.url.trim() && "la URL del video",
      f.nombre.trim().length < 2 && "el nombre",
      !f.categoria && "la categoría",
    ].filter(Boolean);
    if (faltan.length > 0) {
      setError(`Falta ${faltan.join(", ")}.`);
      return;
    }
    setGuardando(true);
    setError("");
    setDuplicado(null);
    setConfirmarCierre(false);
    let textosGuardados = false;
    try {
      if (nuevo) {
        const datos: ProductoEquipo = {
          url: f.url.trim(),
          nombre: f.nombre.trim(),
          categoria: f.categoria,
          descripcion: textoOpcional(f.descripcion),
          por_que_tendencia: textoOpcional(f.por_que_tendencia),
          ojo_antes: textoOpcional(f.ojo_antes),
          regulado: f.regulado,
          autor_plataforma: textoOpcional(f.autor_plataforma),
          portada_url: f.portada || null,
          imagenes: f.imagenes,
          publicar: true,
        };
        const creado = await tendenciasService.crearProducto(datos);
        toast.success(creado.estado === "publicado" ? "Publicado en Tendencias." : "Guardado. Pasa a Diseño para la portada.");
      } else {
        const textos = cambiosTexto(item, f);
        const visuales = visualesEditables ? cambiosVisuales(item, f) : null;
        if (Object.keys(textos).length === 0 && !visuales) {
          toast.success("No hay cambios por guardar.");
          onCerrar();
          return;
        }
        if (Object.keys(textos).length > 0) {
          await tendenciasService.editar(item.id, textos);
          textosGuardados = true;
        }
        if (visuales) await tendenciasService.guardarDiseno(item.id, visuales);
        toast.success("Cambios guardados.");
      }
      onGuardado();
    } catch (err) {
      const dup = duplicadoDe(err);
      if (dup) {
        setDuplicado(dup);
      } else {
        const mensaje = mensajeError(err, "No se pudo guardar el producto.");
        setError(textosGuardados ? `Se guardaron los textos, pero no la portada ni las imágenes: ${mensaje}` : mensaje);
        if (textosGuardados) onCambioParcial();
      }
    } finally {
      setGuardando(false);
    }
  };

  const categorias: string[] = [...CATEGORIAS_PRODUCTO];
  if (f.categoria && !categorias.includes(f.categoria)) categorias.unshift(f.categoria);

  const textoBoton = nuevo ? (f.portada ? "Publicar" : "Enviar a Diseño") : "Guardar cambios";

  return (
    <Dialog.Root open onOpenChange={(abierto) => !abierto && intentarCerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            primerCampo.current?.focus();
          }}
          className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-2xl flex-col border-l border-border bg-white text-foreground shadow-xl outline-none"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold">{nuevo ? "Nuevo producto" : "Editar producto"}</Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">
                {nuevo
                  ? "Con portada se publica de una vez; sin portada pasa a Diseño."
                  : <span className="inline-flex flex-wrap items-center gap-1.5">{item.nombre || "Sin nombre"} <InsigniaEstado estado={item.estado} /></span>}
              </Dialog.Description>
            </div>
            <button
              type="button"
              onClick={intentarCerrar}
              disabled={guardando}
              aria-label="Cerrar"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form id="form-producto" onSubmit={(e) => void guardar(e)} className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5" noValidate>
            <Campo
              id="producto-url"
              etiqueta="URL del video"
              requerido={nuevo}
              ayuda={nuevo ? "TikTok, Instagram, YouTube o Pinterest." : "El video no se cambia: si es otro, crea un producto nuevo."}
            >
              <div className="flex items-center gap-2">
                {!nuevo && <IconoPlataforma plataforma={item.plataforma} className="h-8 w-8" />}
                <input
                  id="producto-url"
                  ref={nuevo ? primerCampo : undefined}
                  type="url"
                  inputMode="url"
                  value={f.url}
                  readOnly={!nuevo}
                  required={nuevo}
                  maxLength={1000}
                  disabled={bloqueado}
                  aria-describedby="producto-url-ayuda"
                  onChange={(e) => {
                    poner("url", e.target.value);
                    setDuplicado(null);
                  }}
                  placeholder="https://www.tiktok.com/@cuenta/video/…"
                  className={`${CLASE_INPUT} ${nuevo ? "" : "cursor-default bg-muted/40 text-muted-foreground"}`}
                />
              </div>
            </Campo>

            {duplicado && (
              <div role="alert" className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                <p className="flex items-start gap-1.5 font-medium">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {duplicado.mensaje}
                </p>
                {duplicado.id && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 pl-5 text-xs">
                    {duplicado.estado === "publicado" && (
                      <a
                        href={`/tendencias/${duplicado.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium underline"
                      >
                        Ver la ficha <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <button type="button" onClick={() => onAbrirExistente(duplicado.id as string, duplicado.estado)} className="font-medium underline">
                      Abrirlo en el catálogo
                    </button>
                  </div>
                )}
              </div>
            )}

            <Campo id="producto-nombre" etiqueta="Nombre" requerido>
              <input
                id="producto-nombre"
                ref={nuevo ? undefined : primerCampo}
                value={f.nombre}
                maxLength={120}
                required
                disabled={bloqueado}
                onChange={(e) => poner("nombre", e.target.value)}
                placeholder="Nombre genérico, sin marcas"
                className={CLASE_INPUT}
              />
            </Campo>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <Campo id="producto-categoria" etiqueta="Categoría" requerido>
                <select
                  id="producto-categoria"
                  value={f.categoria}
                  required
                  disabled={bloqueado}
                  onChange={(e) => poner("categoria", e.target.value)}
                  className={CLASE_INPUT}
                >
                  <option value="">Elige una categoría</option>
                  {categorias.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Campo>
              <div className="flex items-center gap-2 pb-1">
                <Interruptor
                  id="producto-regulado"
                  activo={f.regulado}
                  disabled={bloqueado}
                  etiquetadoPor="producto-regulado-etiqueta"
                  claseActivo="bg-amber-500"
                  onCambio={(v) => poner("regulado", v)}
                />
                <label id="producto-regulado-etiqueta" htmlFor="producto-regulado" className="cursor-pointer text-sm">
                  Regulado
                </label>
              </div>
            </div>

            <Campo
              id="producto-descripcion"
              etiqueta="Descripción"
              extra={<ContadorCaracteres valor={f.descripcion} max={MAX_DESCRIPCION} />}
            >
              <textarea
                id="producto-descripcion"
                rows={5}
                maxLength={MAX_DESCRIPCION}
                disabled={bloqueado}
                value={f.descripcion}
                onChange={(e) => poner("descripcion", e.target.value)}
                placeholder="Qué es, para qué sirve, materiales, medidas… Los saltos de línea se respetan."
                className={`resize-y ${CLASE_INPUT}`}
              />
            </Campo>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                id="producto-porque"
                etiqueta="Por qué está en tendencia"
                extra={<ContadorCaracteres valor={f.por_que_tendencia} max={MAX_TEXTO_CORTO} />}
              >
                <textarea
                  id="producto-porque"
                  rows={3}
                  maxLength={MAX_TEXTO_CORTO}
                  disabled={bloqueado}
                  value={f.por_que_tendencia}
                  onChange={(e) => poner("por_que_tendencia", e.target.value)}
                  className={`resize-none ${CLASE_INPUT}`}
                />
              </Campo>
              <Campo
                id="producto-ojo"
                etiqueta="Ojo antes de traerlo"
                extra={<ContadorCaracteres valor={f.ojo_antes} max={MAX_TEXTO_CORTO} />}
              >
                <textarea
                  id="producto-ojo"
                  rows={3}
                  maxLength={MAX_TEXTO_CORTO}
                  disabled={bloqueado}
                  value={f.ojo_antes}
                  onChange={(e) => poner("ojo_antes", e.target.value)}
                  className={`resize-none ${CLASE_INPUT}`}
                />
              </Campo>
            </div>

            <Campo id="producto-autor" etiqueta="Dueño del video" ayuda="Vacío: el autor que reporta TikTok, YouTube o Pinterest.">
              <input
                id="producto-autor"
                value={f.autor_plataforma}
                maxLength={200}
                disabled={bloqueado}
                aria-describedby="producto-autor-ayuda"
                onChange={(e) => poner("autor_plataforma", e.target.value)}
                placeholder="@cuenta"
                className={CLASE_INPUT}
              />
            </Campo>

            {!visualesEditables && (
              <p className="flex items-start gap-1.5 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                <ImageOff className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                Para cambiar la portada o las imágenes, publícalo de nuevo.
              </p>
            )}
            {!nuevo && item.estado === "en_diseno" && (
              <p className="flex items-start gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
                <Palette className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                Espera diseño. Lo que pongas aquí lo verá el designer; lo publica Diseño.
              </p>
            )}

            {/* Portada */}
            <div>
              <p className="mb-1 text-sm font-medium">
                Portada {publicado && <span className="text-rose-600">*</span>}
              </p>
              <ZonaSoltar
                etiqueta="Zona de portada: arrastra, pega o elige una imagen"
                disabled={bloqueado || !visualesEditables}
                onArchivos={(a) => void subir(a, "portada")}
              >
                {f.portada ? (
                  <div className="flex flex-wrap items-start gap-3">
                    <ImagenArchivo src={f.portada} alt="Portada" className="aspect-square w-28 flex-shrink-0 rounded-lg sm:w-32" />
                    <div className="min-w-0 flex-1 basis-40 space-y-2 text-xs text-muted-foreground">
                      {visualesEditables && <p>Arrastra o pega otra imagen para reemplazarla.</p>}
                      <div className="flex flex-wrap gap-2">
                        <DocumentUploadButton
                          label="Cambiar"
                          accept={ACEPTA_IMAGEN}
                          origen="tendencias"
                          disabled={bloqueado || !visualesEditables || subiendo !== null}
                          onUploaded={(archivo) => poner("portada", rutaArchivo(archivo))}
                          onError={(m) => toast.error(m)}
                        />
                        <button
                          type="button"
                          disabled={bloqueado || publicado || !visualesEditables || subiendo !== null}
                          onClick={() => poner("portada", "")}
                          title={publicado ? "Un producto publicado no puede quedar sin portada" : undefined}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Quitar
                        </button>
                      </div>
                      {publicado && <p>Publicado: se puede cambiar, no quitar.</p>}
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
                      disabled={bloqueado || !visualesEditables || subiendo !== null}
                      onUploaded={(archivo) => poner("portada", rutaArchivo(archivo))}
                      onError={(m) => toast.error(m)}
                    />
                  </div>
                )}
              </ZonaSoltar>
              {nuevo && !f.portada && (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-sky-800 dark:text-sky-200">
                  <Palette className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  Sin portada, el producto pasa a Diseño y el equipo de diseño recibe el aviso.
                </p>
              )}
            </div>

            {/* Imágenes del producto */}
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  Imágenes del producto{" "}
                  <span className="font-normal tabular-nums text-muted-foreground">({f.imagenes.length}/{MAX_IMAGENES_DISENO})</span>
                </p>
                <DocumentUploadButton
                  label="Agregar"
                  accept={ACEPTA_IMAGEN}
                  origen="tendencias"
                  multiple
                  maxArchivos={Math.max(restantes, 1)}
                  disabled={bloqueado || !visualesEditables || restantes <= 0 || subiendo !== null}
                  onUploaded={(archivo) => agregarImagenes([rutaArchivo(archivo)])}
                  onError={(m) => toast.error(m)}
                />
              </div>
              <ZonaSoltar
                etiqueta="Zona de imágenes: arrastra o pega una o varias imágenes"
                disabled={bloqueado || !visualesEditables}
                onArchivos={(a) => void subir(a, "imagenes")}
              >
                {f.imagenes.length === 0 ? (
                  <div className="flex flex-col items-center gap-1.5 py-3 text-center text-xs text-muted-foreground">
                    {subiendo === "imagenes" ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
                    <p>{subiendo === "imagenes" ? "Subiendo imágenes…" : `Opcional: hasta ${MAX_IMAGENES_DISENO} fotos del producto. Arrástralas o pégalas aquí.`}</p>
                  </div>
                ) : (
                  <>
                    <ul className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-4">
                      {f.imagenes.map((ruta, i) => (
                        <li key={ruta} className="min-w-0">
                          <div className="relative">
                            <ImagenArchivo src={ruta} alt={`Imagen ${i + 1} del producto`} className="aspect-square w-full rounded-lg" />
                            <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[11px] font-medium tabular-nums text-white">{i + 1}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between">
                            <button type="button" disabled={bloqueado || !visualesEditables || i === 0} onClick={() => mover(i, -1)} aria-label={`Mover la imagen ${i + 1} a la izquierda`} title="Mover a la izquierda" className={CLASE_ICONO_TILE}>
                              <ArrowLeft className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" disabled={bloqueado || !visualesEditables} onClick={() => usarComoPortada(ruta)} aria-label={`Usar la imagen ${i + 1} como portada`} title="Usar como portada" className={CLASE_ICONO_TILE}>
                              <Star className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" disabled={bloqueado || !visualesEditables} onClick={() => quitarImagen(i)} aria-label={`Quitar la imagen ${i + 1}`} title="Quitar" className={`${CLASE_ICONO_TILE} hover:text-rose-600`}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" disabled={bloqueado || !visualesEditables || i === f.imagenes.length - 1} onClick={() => mover(i, 1)} aria-label={`Mover la imagen ${i + 1} a la derecha`} title="Mover a la derecha" className={CLASE_ICONO_TILE}>
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
          </form>

          <div className="space-y-2 border-t border-border px-4 py-3 sm:px-5">
            {error && <AvisoError>{error}</AvisoError>}
            {confirmarCierre && (
              <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                <span className="min-w-0 flex-1">Tienes cambios sin guardar.</span>
                <button type="button" onClick={onCerrar} className="rounded-lg bg-rose-600 px-2.5 py-1.5 font-medium text-white hover:bg-rose-700">
                  Descartar
                </button>
                <button type="button" onClick={() => setConfirmarCierre(false)} className="rounded-lg px-2 py-1.5 font-medium hover:bg-amber-100 dark:hover:bg-amber-500/20">
                  Seguir editando
                </button>
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={intentarCerrar} disabled={guardando} className={CLASE_BOTON_SECUNDARIO}>
                Cancelar
              </button>
              <button
                type="submit"
                form="form-producto"
                disabled={guardando || subiendo !== null || (!nuevo && !sucio)}
                className={CLASE_BOTON_PRIMARIO}
              >
                {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : nuevo ? <Plus className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {textoBoton}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Catálogo ─────────────────────────────────────────────────────────────────

function FilaCatalogo({
  item,
  confirmando,
  ocupado,
  onEditar,
  onConfirmar,
  onArchivar,
  onRepublicar,
}: {
  item: ItemDiseno;
  confirmando: boolean;
  ocupado: boolean;
  onEditar: () => void;
  onConfirmar: (si: boolean) => void;
  onArchivar: () => void;
  onRepublicar: () => void;
}) {
  const plataforma = ETIQUETA_PLATAFORMA[item.plataforma] ?? item.plataforma;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <div className="flex min-w-0 flex-1 basis-72 items-start gap-3">
        {item.portada_url ? (
          <ImagenArchivo src={item.portada_url} alt={item.nombre ? `Portada de ${item.nombre}` : "Portada"} className="h-16 w-16 flex-shrink-0 rounded-lg" />
        ) : (
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" title="Sin portada">
            <ImageOff className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="min-w-0 truncate text-sm font-medium">{item.nombre || "Sin nombre"}</p>
            <InsigniaEstado estado={item.estado} />
            {item.regulado && (
              <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                Regulado
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{item.categoria || "Sin categoría"}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <IconoPlataforma plataforma={item.plataforma} className="h-4 w-4" /> {plataforma}
            </span>
            <InsigniaOrigen origen={item.origen} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.publicado_en ? `Publicado ${fechaCorta(item.publicado_en)}` : "Sin publicar"}
            {" · "}
            {item.cotizaciones_total} {item.cotizaciones_total === 1 ? "cotización" : "cotizaciones"}
          </p>
          {item.estado === "en_diseno" && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-sky-700 dark:text-sky-300">
              <Palette className="h-3.5 w-3.5" /> Espera la portada del equipo de diseño.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onEditar} disabled={ocupado} className={CLASE_BOTON_SECUNDARIO}>
          <Pencil className="h-3.5 w-3.5" /> Editar
        </button>
        {item.estado === "publicado" && (
          <a href={`/tendencias/${item.id}`} target="_blank" rel="noopener noreferrer" className={CLASE_BOTON_SECUNDARIO}>
            <ExternalLink className="h-3.5 w-3.5" /> Ver ficha
          </a>
        )}
        {item.estado === "publicado" &&
          (confirmando ? (
            <span className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Confirmar archivo">
              <span className="text-muted-foreground">¿Sacarlo del feed?</span>
              <button
                type="button"
                disabled={ocupado}
                onClick={onArchivar}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {ocupado && <Loader2 className="h-3 w-3 animate-spin" />} Archivar
              </button>
              <button type="button" disabled={ocupado} onClick={() => onConfirmar(false)} className="rounded-lg px-2 py-1.5 text-muted-foreground hover:bg-muted">
                Cancelar
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => onConfirmar(true)} disabled={ocupado} className={`${CLASE_BOTON_SECUNDARIO} text-rose-700 dark:text-rose-400`}>
              <Archive className="h-3.5 w-3.5" /> Archivar
            </button>
          ))}
        {(item.estado === "archivado" || item.estado === "caido") && (
          <button type="button" onClick={onRepublicar} disabled={ocupado} className={CLASE_BOTON_SECUNDARIO}>
            {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Publicar de nuevo
          </button>
        )}
      </div>
    </li>
  );
}

const ESTADOS_CATALOGO: EstadoCatalogo[] = ["publicado", "en_diseno", "archivado", "caido"];

function PestanaCatalogo() {
  const [estado, setEstado] = useState<EstadoCatalogo>("publicado");
  const [origen, setOrigen] = useState<FiltroOrigen>("");
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [items, setItems] = useState<ItemDiseno[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  // undefined: cerrado; null: producto nuevo.
  const [editando, setEditando] = useState<ItemDiseno | null | undefined>(undefined);
  const peticion = useRef(0);
  // Tras un duplicado: el id que hay que abrir cuando llegue la lista.
  const abrirTrasCargar = useRef<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setBusqueda(texto.trim()), ESPERA_BUSQUEDA_MS);
    return () => window.clearTimeout(t);
  }, [texto]);

  const cargar = useCallback(async () => {
    const n = ++peticion.current;
    setCargando(true);
    setError("");
    try {
      const lista = await tendenciasService.catalogo({ estado, q: busqueda, origen: origen || undefined });
      if (n !== peticion.current) return;
      setItems(lista);
      if (abrirTrasCargar.current) {
        const encontrado = lista.find((i) => i.id === abrirTrasCargar.current);
        abrirTrasCargar.current = null;
        if (encontrado) setEditando(encontrado);
        else toast.info("Ese producto no está en el catálogo (puede estar en la cola de aprobación).");
      }
    } catch (e) {
      if (n !== peticion.current) return;
      setError(mensajeError(e, "No se pudo cargar el catálogo."));
    } finally {
      if (n === peticion.current) setCargando(false);
    }
  }, [estado, busqueda, origen]);

  useEffect(() => {
    void cargar();
  }, [cargar, recarga]);

  const archivar = async (id: string) => {
    setOcupado(id);
    try {
      await tendenciasService.archivar(id);
      setConfirmando(null);
      toast.success("Archivado. Ya no aparece en el feed.");
      void cargar();
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo archivar."));
    } finally {
      setOcupado(null);
    }
  };

  const republicar = async (id: string) => {
    setOcupado(id);
    try {
      await tendenciasService.republicar(id);
      toast.success("Publicado de nuevo en Tendencias.");
      void cargar();
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo publicar de nuevo."));
    } finally {
      setOcupado(null);
    }
  };

  const abrirExistente = (id: string, estadoExistente: string | null) => {
    setEditando(undefined);
    abrirTrasCargar.current = id;
    setEstado(ESTADOS_CATALOGO.includes(estadoExistente as EstadoCatalogo) ? (estadoExistente as EstadoCatalogo) : "todos");
    setOrigen("");
    setTexto("");
    setBusqueda("");
    setRecarga((r) => r + 1);
  };

  const filtrado = Boolean(busqueda) || origen !== "";

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-xl border border-border bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
          {FILTROS_ESTADO.map((e) => (
            <button
              key={e.valor}
              type="button"
              aria-pressed={estado === e.valor}
              onClick={() => setEstado(e.valor)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                estado === e.valor
                  ? "border-primary bg-primary/10 text-primary dark:border-accent dark:bg-accent/15 dark:text-accent"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {e.etiqueta}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-48">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar por nombre"
              aria-label="Buscar productos por nombre"
              className={`pl-8 ${CLASE_INPUT}`}
            />
          </div>
          <label className="sr-only" htmlFor="catalogo-origen">Origen</label>
          <select
            id="catalogo-origen"
            value={origen}
            onChange={(e) => setOrigen(e.target.value as FiltroOrigen)}
            className={`w-auto ${CLASE_INPUT}`}
          >
            {OPCIONES_ORIGEN.map((o) => (
              <option key={o.valor} value={o.valor}>{o.valor ? o.etiqueta : "Origen: todos"}</option>
            ))}
          </select>
          <button type="button" onClick={() => void cargar()} disabled={cargando} aria-label="Actualizar la lista" className={CLASE_BOTON_SECUNDARIO}>
            <RefreshCw className={`h-3.5 w-3.5 ${cargando ? "animate-spin" : ""}`} />
          </button>
          <button type="button" onClick={() => setEditando(null)} className={CLASE_BOTON_PRIMARIO}>
            <Plus className="h-4 w-4" /> Nuevo producto
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white px-4 py-1 shadow-sm">
        {error && items.length === 0 ? (
          <div className="flex flex-wrap items-center gap-2 py-6 text-sm text-rose-800 dark:text-rose-300">
            <span className="min-w-0 flex-1">{error}</span>
            <button type="button" onClick={() => void cargar()} className={CLASE_BOTON_SECUNDARIO}>
              <RefreshCw className="h-3.5 w-3.5" /> Reintentar
            </button>
          </div>
        ) : cargando && items.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">{filtrado ? "No hay productos que coincidan" : "No hay productos aquí"}</p>
            {estado === "publicado" && !filtrado && (
              <button type="button" onClick={() => setEditando(null)} className={`${CLASE_BOTON_SECUNDARIO} mt-1`}>
                <Plus className="h-3.5 w-3.5" /> Sube el primero
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="pt-2 text-xs text-muted-foreground" aria-live="polite">
              {items.length} {items.length === 1 ? "producto" : "productos"}
              {cargando && <Loader2 className="ml-1.5 inline h-3 w-3 animate-spin" />}
            </p>
            {error && <p className="pt-2 text-xs text-rose-700 dark:text-rose-300">{error}</p>}
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <FilaCatalogo
                  key={item.id}
                  item={item}
                  confirmando={confirmando === item.id}
                  ocupado={ocupado === item.id}
                  onEditar={() => setEditando(item)}
                  onConfirmar={(si) => setConfirmando(si ? item.id : null)}
                  onArchivar={() => void archivar(item.id)}
                  onRepublicar={() => void republicar(item.id)}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      {editando !== undefined && (
        <PanelProducto
          key={editando?.id ?? "nuevo"}
          item={editando}
          onCerrar={() => setEditando(undefined)}
          onGuardado={() => {
            setEditando(undefined);
            void cargar();
          }}
          onCambioParcial={() => void cargar()}
          onAbrirExistente={abrirExistente}
        />
      )}
    </div>
  );
}

// ── Acceso y precio ──────────────────────────────────────────────────────────

function soloDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

function FilaCortesia({
  acceso,
  confirmando,
  revocando,
  onConfirmar,
  onRevocar,
}: {
  acceso: AccesoCortesia;
  confirmando: boolean;
  revocando: boolean;
  onConfirmar: (si: boolean) => void;
  onRevocar: () => void;
}) {
  const estado = acceso.revocado ? "Revocado" : acceso.vigente ? "Vigente" : "Vencido";
  const claseEstado = acceso.vigente
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
    : "bg-muted text-muted-foreground";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="min-w-0 truncate text-sm font-medium">{acceso.nombre || acceso.email || "Usuario sin correo"}</p>
          <span className="rounded border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {ETIQUETA_ORIGEN_ACCESO[acceso.origen] ?? acceso.origen}
          </span>
          <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${claseEstado}`}>{estado}</span>
        </div>
        {acceso.nombre && acceso.email && <p className="truncate text-xs text-muted-foreground">{acceso.email}</p>}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {acceso.vigente ? "Hasta" : "Fue hasta"} {fechaBogota(acceso.fin)}
        </p>
        {acceso.nota && <p className="mt-0.5 whitespace-pre-line text-xs text-foreground">“{acceso.nota}”</p>}
      </div>
      {acceso.vigente &&
        (confirmando ? (
          <span className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Confirmar revocación">
            <span className="text-muted-foreground">¿Quitarle el acceso?</span>
            <button
              type="button"
              disabled={revocando}
              onClick={onRevocar}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {revocando && <Loader2 className="h-3 w-3 animate-spin" />} Revocar
            </button>
            <button type="button" disabled={revocando} onClick={() => onConfirmar(false)} className="rounded-lg px-2 py-1.5 text-muted-foreground hover:bg-muted">
              Cancelar
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => onConfirmar(true)} className={`${CLASE_BOTON_SECUNDARIO} text-rose-700 dark:text-rose-400`}>
            Revocar
          </button>
        ))}
    </li>
  );
}

function Cortesias() {
  const [email, setEmail] = useState("");
  const [dias, setDias] = useState("30");
  const [nota, setNota] = useState("");
  const [otorgando, setOtorgando] = useState(false);
  const [errorForm, setErrorForm] = useState("");
  const [verVencidas, setVerVencidas] = useState(false);
  const [lista, setLista] = useState<AccesoCortesia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [revocando, setRevocando] = useState<string | null>(null);
  const peticion = useRef(0);

  const cargar = useCallback(async () => {
    const n = ++peticion.current;
    setCargando(true);
    setError("");
    try {
      const resultado = await tendenciasService.cortesias(!verVencidas);
      if (n === peticion.current) setLista(resultado);
    } catch (e) {
      if (n === peticion.current) setError(mensajeError(e, "No se pudieron cargar los accesos."));
    } finally {
      if (n === peticion.current) setCargando(false);
    }
  }, [verVencidas]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const otorgar = async (e: FormEvent) => {
    e.preventDefault();
    const correo = email.trim();
    const n = Number(dias);
    if (!correo || !/^\S+@\S+\.\S+$/.test(correo)) {
      setErrorForm("Escribe un correo válido.");
      return;
    }
    if (!Number.isInteger(n) || n < 1 || n > 3650) {
      setErrorForm("Los días van de 1 a 3.650.");
      return;
    }
    setOtorgando(true);
    setErrorForm("");
    try {
      const acceso = await tendenciasService.otorgarCortesia({ email: correo, dias: n, nota: nota.trim() || undefined });
      toast.success(`Acceso dado a ${acceso.nombre || acceso.email || correo} hasta ${fechaBogota(acceso.fin)}.`);
      setEmail("");
      setNota("");
      void cargar();
    } catch (err) {
      setErrorForm(mensajeError(err, "No se pudo dar el acceso."));
    } finally {
      setOtorgando(false);
    }
  };

  const revocar = async (id: string) => {
    setRevocando(id);
    try {
      await tendenciasService.revocarCortesia(id);
      setConfirmando(null);
      toast.success("Acceso revocado.");
      void cargar();
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo revocar el acceso."));
    } finally {
      setRevocando(null);
    }
  };

  return (
    <section aria-labelledby="titulo-cortesias" className="space-y-3 rounded-xl border border-border bg-white p-4 shadow-sm">
      <div>
        <h2 id="titulo-cortesias" className="flex items-center gap-1.5 text-base font-semibold">
          <Gift className="h-4 w-4 text-primary dark:text-accent" /> Cortesías
        </h2>
        <p className="text-sm text-muted-foreground">Accesos gratis por persona. La cuenta debe existir; le llega un aviso.</p>
      </div>

      <form onSubmit={(e) => void otorgar(e)} noValidate className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
        <Campo id="cortesia-email" etiqueta="Correo" requerido>
          <input
            id="cortesia-email"
            type="email"
            autoComplete="off"
            value={email}
            required
            disabled={otorgando}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="persona@correo.com"
            className={CLASE_INPUT}
          />
        </Campo>
        <Campo id="cortesia-dias" etiqueta="Días" requerido>
          <input
            id="cortesia-dias"
            inputMode="numeric"
            value={dias}
            required
            disabled={otorgando}
            onChange={(e) => setDias(soloDigitos(e.target.value).slice(0, 4))}
            className={`tabular-nums ${CLASE_INPUT}`}
          />
        </Campo>
        <div className="sm:col-span-2">
          <Campo id="cortesia-nota" etiqueta="Nota (opcional)" extra={<ContadorCaracteres valor={nota} max={MAX_NOTA_CORTESIA} />}>
            <input
              id="cortesia-nota"
              value={nota}
              maxLength={MAX_NOTA_CORTESIA}
              disabled={otorgando}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Por qué se le da (solo lo ve el equipo)"
              className={CLASE_INPUT}
            />
          </Campo>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <button type="submit" disabled={otorgando} className={CLASE_BOTON_PRIMARIO}>
            {otorgando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />} Dar acceso
          </button>
          {errorForm && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{errorForm}</p>}
        </div>
      </form>

      <div className="border-t border-border pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            {verVencidas ? "Todos los accesos" : "Accesos vigentes"} <span className="font-normal text-muted-foreground">({lista.length})</span>
          </p>
          <div className="flex items-center gap-2">
            <Interruptor
              id="cortesias-vencidas"
              activo={verVencidas}
              etiquetadoPor="cortesias-vencidas-etiqueta"
              claseActivo="bg-primary dark:bg-accent"
              onCambio={setVerVencidas}
            />
            <label id="cortesias-vencidas-etiqueta" htmlFor="cortesias-vencidas" className="cursor-pointer text-xs text-muted-foreground">
              Ver también vencidos y revocados
            </label>
          </div>
        </div>

        {error && lista.length === 0 ? (
          <div className="flex flex-wrap items-center gap-2 py-4 text-sm text-rose-800 dark:text-rose-300">
            <span className="min-w-0 flex-1">{error}</span>
            <button type="button" onClick={() => void cargar()} className={CLASE_BOTON_SECUNDARIO}>
              <RefreshCw className="h-3.5 w-3.5" /> Reintentar
            </button>
          </div>
        ) : cargando && lista.length === 0 ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>
        ) : lista.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{verVencidas ? "Aún no hay accesos." : "No hay accesos vigentes."}</p>
        ) : (
          <ul className={`divide-y divide-border ${cargando ? "opacity-60" : ""}`}>
            {lista.map((a) => (
              <FilaCortesia
                key={a.id}
                acceso={a}
                confirmando={confirmando === a.id}
                revocando={revocando === a.id}
                onConfirmar={(si) => setConfirmando(si ? a.id : null)}
                onRevocar={() => void revocar(a.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PestanaAcceso() {
  const [parametros, setParametros] = useState<ParametrosAccesoTendencias | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [precio, setPrecio] = useState("");
  const [dias, setDias] = useState("30");
  const [guardandoGratis, setGuardandoGratis] = useState(false);
  const [guardandoPrecio, setGuardandoPrecio] = useState(false);
  const [errorPrecio, setErrorPrecio] = useState("");

  const aplicar = (p: ParametrosAccesoTendencias) => {
    setParametros(p);
    setPrecio(p.precio_cop ? String(p.precio_cop) : "");
    setDias(String(p.dias_suscripcion));
  };

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      aplicar(await tendenciasService.parametrosAcceso());
    } catch (e) {
      setError(mensajeError(e, "No se pudieron cargar los parámetros de acceso."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (cargando && !parametros) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-white p-10 text-sm text-muted-foreground shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  if (!parametros) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
        <span className="min-w-0 flex-1">{error || "No se pudieron cargar los parámetros de acceso."}</span>
        <button type="button" onClick={() => void cargar()} className={CLASE_BOTON_SECUNDARIO}>
          <RefreshCw className="h-3.5 w-3.5" /> Reintentar
        </button>
      </div>
    );
  }

  const gratis = parametros.gratis;
  const precioNumero = precio ? Number(precio) : 0;
  const diasNumero = Number(dias);
  const precioSucio =
    (precioNumero || null) !== (parametros.precio_cop || null) || diasNumero !== parametros.dias_suscripcion;

  // Al cambiar el interruptor se mandan el precio y los días guardados, no el borrador.
  const cambiarGratis = async (valor: boolean) => {
    setGuardandoGratis(true);
    try {
      const resultado = await tendenciasService.guardarParametrosAcceso({
        precio_cop: parametros.precio_cop,
        dias_suscripcion: parametros.dias_suscripcion,
        gratis: valor,
      });
      setParametros(resultado);
      toast.success(valor ? "Tendencias queda gratis para todos." : "Muro de pago activado.");
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo cambiar el acceso."));
    } finally {
      setGuardandoGratis(false);
    }
  };

  const guardarPrecio = async (e: FormEvent) => {
    e.preventDefault();
    if (precioNumero > 100_000_000) {
      setErrorPrecio("El precio máximo es $100.000.000.");
      return;
    }
    if (!Number.isInteger(diasNumero) || diasNumero < 1 || diasNumero > 3650) {
      setErrorPrecio("Los días por periodo van de 1 a 3.650.");
      return;
    }
    setGuardandoPrecio(true);
    setErrorPrecio("");
    try {
      const resultado = await tendenciasService.guardarParametrosAcceso({
        precio_cop: precioNumero > 0 ? precioNumero : null,
        dias_suscripcion: diasNumero,
        gratis: parametros.gratis,
      });
      aplicar(resultado);
      toast.success("Precio guardado.");
    } catch (err) {
      setErrorPrecio(mensajeError(err, "No se pudo guardar el precio."));
    } finally {
      setGuardandoPrecio(false);
    }
  };

  const estados = [
    {
      clave: true,
      icono: Unlock,
      titulo: "Encendido",
      texto: "Todos ven todo, incluso sin cuenta, mientras se configura la pasarela de pago.",
    },
    {
      clave: false,
      icono: Lock,
      titulo: "Apagado",
      texto: `Quien no ha pagado ve una vista previa de ${parametros.limite_vista_previa} portadas y nombres; el video, las fotos y la ficha completa piden suscripción.`,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Tendencias gratis */}
      <section aria-labelledby="titulo-gratis" className="space-y-3 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="titulo-gratis" className="text-base font-semibold">Tendencias gratis</h2>
            <p id="descripcion-gratis" className="text-sm text-muted-foreground">
              {gratis ? "Ahora está abierto para todos." : "Ahora el muro de pago está activo."}
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2 pt-1">
            {guardandoGratis && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
            <Interruptor
              activo={gratis}
              disabled={guardandoGratis}
              etiquetadoPor="titulo-gratis"
              descritoPor="descripcion-gratis"
              onCambio={(v) => void cambiarGratis(v)}
            />
          </div>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {estados.map((e) => {
            const Icono = e.icono;
            const actual = e.clave === gratis;
            return (
              <li
                key={e.titulo}
                className={`flex gap-2.5 rounded-lg border p-3 text-sm ${
                  actual
                    ? "border-primary bg-primary/5 dark:border-accent dark:bg-accent/10"
                    : "border-border text-muted-foreground"
                }`}
              >
                <Icono className={`mt-0.5 h-4 w-4 flex-shrink-0 ${actual ? "text-primary dark:text-accent" : ""}`} />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {e.titulo}
                    {actual && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(actual)</span>}
                  </p>
                  <p className="mt-0.5 text-xs">{e.texto}</p>
                </div>
              </li>
            );
          })}
        </ul>
        {parametros.acceso_libre_hasta && (
          <p className="text-xs text-muted-foreground">Acceso libre programado hasta {fechaBogota(parametros.acceso_libre_hasta)}.</p>
        )}
      </section>

      {/* Precio y duración */}
      <section aria-labelledby="titulo-precio" className="space-y-3 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div>
          <h2 id="titulo-precio" className="text-base font-semibold">Precio de la suscripción</h2>
          <p className="text-sm text-muted-foreground">
            {parametros.precio_cop
              ? `Se vende a ${pesos(parametros.precio_cop)} por ${parametros.dias_suscripcion} ${parametros.dias_suscripcion === 1 ? "día" : "días"}.`
              : "Sin precio no se vende: solo hay cortesías."}
            {gratis && " Con Tendencias gratis no se cobra."}
          </p>
        </div>
        <form onSubmit={(e) => void guardarPrecio(e)} noValidate className="grid gap-3 sm:grid-cols-2">
          <Campo
            id="precio-cop"
            etiqueta="Precio de la suscripción (COP)"
            ayuda={precioNumero > 0 ? pesos(precioNumero) : "Vacío: no está a la venta."}
          >
            <input
              id="precio-cop"
              inputMode="numeric"
              value={precio}
              disabled={guardandoPrecio}
              aria-describedby="precio-cop-ayuda"
              onChange={(e) => setPrecio(soloDigitos(e.target.value).slice(0, 9))}
              placeholder="Sin precio"
              className={`tabular-nums ${CLASE_INPUT}`}
            />
          </Campo>
          <Campo id="dias-periodo" etiqueta="Días por periodo" requerido>
            <input
              id="dias-periodo"
              inputMode="numeric"
              value={dias}
              required
              disabled={guardandoPrecio}
              onChange={(e) => setDias(soloDigitos(e.target.value).slice(0, 4))}
              className={`tabular-nums ${CLASE_INPUT}`}
            />
          </Campo>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <button type="submit" disabled={guardandoPrecio || !precioSucio} className={CLASE_BOTON_PRIMARIO}>
              {guardandoPrecio ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar precio
            </button>
            {errorPrecio && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{errorPrecio}</p>}
          </div>
        </form>
      </section>

      <Cortesias />
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────

export function AdminTendencias() {
  const [pestana, setPestana] = useState<Pestana>("catalogo");

  const pestanas: { clave: Pestana; etiqueta: string }[] = [
    { clave: "catalogo", etiqueta: "Catálogo" },
    { clave: "acceso", etiqueta: "Acceso y precio" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Tendencias</h1>
        <p className="text-sm text-muted-foreground">
          El catálogo de productos virales que sube el equipo, el muro de pago y el precio de la suscripción.
        </p>
      </div>

      <div role="tablist" aria-label="Secciones de Tendencias" className="flex flex-wrap gap-2 border-b border-border pb-2">
        {pestanas.map((p) => (
          <button
            key={p.clave}
            id={`pestana-${p.clave}`}
            type="button"
            role="tab"
            aria-selected={pestana === p.clave}
            aria-controls={`panel-${p.clave}`}
            onClick={() => setPestana(p.clave)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
              pestana === p.clave
                ? "bg-primary text-white dark:bg-accent dark:text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      <div id={`panel-${pestana}`} role="tabpanel" aria-labelledby={`pestana-${pestana}`}>
        {pestana === "catalogo" ? <PestanaCatalogo /> : <PestanaAcceso />}
      </div>
    </div>
  );
}
