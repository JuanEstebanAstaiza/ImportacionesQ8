import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { DocumentUploadButton } from "@/app/components/files/DocumentUploadButton";
import { ImagenArchivo } from "@/app/components/files/ImagenArchivo";
import { CATEGORIAS_PRODUCTO } from "@/lib/categorias";
import { formatearTamano, obtenerLimiteSubida } from "@/lib/limite-subida";
import { toApiPath } from "@/services/api-client";
import { businessService, type BackendArchivoItem } from "@/services/business.service";
import {
  tendenciasService,
  type CambiosFicha,
  type ItemAprobacion,
  type MotivoRechazo,
} from "@/services/tendencias.service";

import { CLASE_BOTON_PRIMARIO, CLASE_BOTON_SECUNDARIO, CLASE_INPUT, mensajeError } from "./AprobacionComun";

/**
 * Formulario de la ficha en el panel del aprobador: completa los datos, pone
 * la portada (arrastrar, pegar o elegir) y aprueba o rechaza. Guarda primero
 * los cambios y luego resuelve, para que el aprobador despache con un clic.
 */

export interface FormularioFicha {
  nombre: string;
  categoria: string;
  regulado: boolean;
  por_que_tendencia: string;
  ojo_antes: string;
  portada_url: string;
  embed_html: string;
}

export type ModoCola = "pendiente" | "aprobado_sin_portada";

const ACEPTA_IMAGEN = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";
const TIPOS_IMAGEN = ["image/png", "image/jpeg", "image/webp"];
const MAX_TEXTO = 200;

export function formularioDesde(item: ItemAprobacion): FormularioFicha {
  return {
    nombre: item.nombre ?? "",
    categoria: item.categoria ?? "",
    regulado: Boolean(item.regulado),
    por_que_tendencia: item.por_que_tendencia ?? "",
    ojo_antes: item.ojo_antes ?? "",
    portada_url: item.portada_url ?? "",
    embed_html: "",
  };
}

/** Solo lo que cambió respecto a lo guardado. */
export function cambiosDe(item: ItemAprobacion, f: FormularioFicha): CambiosFicha {
  const base = formularioDesde(item);
  const cambios: CambiosFicha = {};
  const texto = (v: string) => v.trim() || null;
  if (f.nombre.trim() !== base.nombre.trim()) cambios.nombre = texto(f.nombre);
  if (f.categoria !== base.categoria) cambios.categoria = texto(f.categoria);
  if (f.regulado !== base.regulado) cambios.regulado = f.regulado;
  if (f.por_que_tendencia.trim() !== base.por_que_tendencia.trim()) cambios.por_que_tendencia = texto(f.por_que_tendencia);
  if (f.ojo_antes.trim() !== base.ojo_antes.trim()) cambios.ojo_antes = texto(f.ojo_antes);
  if (f.portada_url !== base.portada_url) cambios.portada_url = f.portada_url || null;
  if (item.plataforma === "instagram" && f.embed_html.trim()) cambios.embed_html = f.embed_html.trim();
  return cambios;
}

function rutaArchivo(archivo: BackendArchivoItem): string {
  return toApiPath(archivo.storage_url || `/documentos/archivos/${archivo.id}/descargar`);
}

function primeraImagen(lista: FileList | null | undefined): File | null {
  return Array.from(lista ?? []).find((f) => TIPOS_IMAGEN.includes(f.type)) ?? null;
}

// ── Zona de portada ──────────────────────────────────────────────────────────

function ZonaPortada({
  valor,
  propuesta,
  disabled,
  onCambio,
}: {
  valor: string;
  /** Portada que mandó la importadora al enviar el enlace, si la hay. */
  propuesta: string | null;
  disabled: boolean;
  onCambio: (ruta: string) => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [encima, setEncima] = useState(false);
  const subiendoRef = useRef(false);

  const subir = async (file: File) => {
    if (subiendoRef.current || disabled) return;
    if (!TIPOS_IMAGEN.includes(file.type)) {
      toast.error("La portada debe ser una imagen PNG, JPG o WebP.");
      return;
    }
    subiendoRef.current = true;
    setSubiendo(true);
    try {
      const limite = await obtenerLimiteSubida();
      if (file.size > limite) {
        toast.error(`La imagen pesa ${formatearTamano(file.size)} y el máximo es ${formatearTamano(limite)}.`);
        return;
      }
      const archivo = await businessService.uploadDocumentFile(file, null, "tendencias");
      onCambio(rutaArchivo(archivo));
    } catch (error) {
      toast.error(mensajeError(error, "No se pudo subir la portada."));
    } finally {
      subiendoRef.current = false;
      setSubiendo(false);
    }
  };

  // Pegar una imagen en cualquier parte del panel la usa como portada.
  const subirRef = useRef(subir);
  subirRef.current = subir;
  useEffect(() => {
    const alPegar = (e: ClipboardEvent) => {
      if (e.defaultPrevented) return;
      const file = primeraImagen(e.clipboardData?.files);
      if (!file) return;
      e.preventDefault();
      void subirRef.current(file);
    };
    window.addEventListener("paste", alPegar);
    return () => window.removeEventListener("paste", alPegar);
  }, []);

  const esPropuesta = Boolean(propuesta) && valor === propuesta;

  return (
    <div>
      <p className="text-sm font-medium">
        Portada <span className="text-rose-600">*</span>
        {esPropuesta && <span className="ml-2 text-xs font-normal text-muted-foreground">Propuesta por la importadora</span>}
      </p>
      <div
        tabIndex={0}
        role="group"
        aria-label="Zona de portada: arrastra, pega o elige una imagen"
        onPaste={(e) => {
          const file = primeraImagen(e.clipboardData?.files);
          if (!file) return;
          e.preventDefault();
          void subir(file);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!encima) setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          const file = primeraImagen(e.dataTransfer?.files);
          if (file) void subir(file);
          else toast.error("Suelta una imagen PNG, JPG o WebP.");
        }}
        className={`mt-1 rounded-xl border-2 border-dashed p-3 outline-none transition-colors focus:border-primary dark:focus:border-accent ${
          encima ? "border-primary bg-primary/5 dark:border-accent dark:bg-accent/10" : "border-border"
        }`}
      >
        {valor ? (
          <div className="flex items-start gap-3">
            <ImagenArchivo src={valor} alt="Portada" className="h-28 w-28 flex-shrink-0 rounded-lg" />
            <div className="min-w-0 space-y-2 text-xs text-muted-foreground">
              <p>Arrastra o pega otra imagen para reemplazarla.</p>
              <div className="flex flex-wrap gap-2">
                <DocumentUploadButton
                  label="Cambiar"
                  accept={ACEPTA_IMAGEN}
                  origen="tendencias"
                  disabled={disabled || subiendo}
                  onUploaded={(archivo) => onCambio(rutaArchivo(archivo))}
                  onError={(m) => toast.error(m)}
                />
                <button
                  type="button"
                  disabled={disabled || subiendo}
                  onClick={() => onCambio("")}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Quitar
                </button>
              </div>
              {subiendo && <p className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Subiendo…</p>}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-3 text-center text-xs text-muted-foreground">
            {subiendo ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
            <p>{subiendo ? "Subiendo portada…" : "Arrastra una imagen aquí o pégala con Ctrl+V"}</p>
            <DocumentUploadButton
              label="Elegir imagen"
              accept={ACEPTA_IMAGEN}
              origen="tendencias"
              disabled={disabled || subiendo}
              onUploaded={(archivo) => onCambio(rutaArchivo(archivo))}
              onError={(m) => toast.error(m)}
            />
          </div>
        )}
      </div>
      {propuesta && !esPropuesta && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onCambio(propuesta)}
          className="mt-1 text-xs font-medium text-primary hover:underline dark:text-accent"
        >
          Usar la portada que propuso la importadora
        </button>
      )}
    </div>
  );
}

// ── Formulario ───────────────────────────────────────────────────────────────

function Contador({ valor }: { valor: string }) {
  const n = valor.length;
  return <span className={`text-[11px] ${n >= MAX_TEXTO ? "text-rose-600" : "text-muted-foreground"}`}>{n}/{MAX_TEXTO}</span>;
}

export function FichaAprobacion({
  item,
  modo,
  inicial,
  motivos,
  onCambio,
  onResuelto,
}: {
  item: ItemAprobacion;
  modo: ModoCola;
  inicial: FormularioFicha;
  motivos: { valor: MotivoRechazo; texto: string }[];
  onCambio: (f: FormularioFicha) => void;
  onResuelto: (item: ItemAprobacion, mensaje: string) => void;
}) {
  const [f, setF] = useState<FormularioFicha>(inicial);
  const [ocupado, setOcupado] = useState<null | "aprobar" | "sin_portada" | MotivoRechazo>(null);
  const [rechazando, setRechazando] = useState(false);

  const poner = <K extends keyof FormularioFicha>(clave: K, valor: FormularioFicha[K]) => {
    setF((prev) => ({ ...prev, [clave]: valor }));
  };

  // El borrador vive en la cola: cambiar de enlace no pierde lo escrito.
  const onCambioRef = useRef(onCambio);
  onCambioRef.current = onCambio;
  const primeraVez = useRef(true);
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    onCambioRef.current(f);
  }, [f]);

  const categorias: string[] = [...CATEGORIAS_PRODUCTO];
  if (f.categoria && !categorias.includes(f.categoria)) categorias.unshift(f.categoria);

  const faltaBase = !f.nombre.trim() || !f.categoria;
  const bloqueado = ocupado !== null;

  // Guarda lo que cambió y luego ejecuta la acción.
  const resolver = async (
    clave: NonNullable<typeof ocupado>,
    accion: () => Promise<ItemAprobacion>,
    mensaje: string,
  ) => {
    setOcupado(clave);
    try {
      const cambios = cambiosDe(item, f);
      if (Object.keys(cambios).length > 0) {
        await tendenciasService.editar(item.id, cambios);
      }
      const resultado = await accion();
      onResuelto(resultado, mensaje);
    } catch (error) {
      toast.error(mensajeError(error, "No se pudo guardar la revisión."));
      setOcupado(null);
    }
  };

  const aprobar = (sinPortada: boolean) =>
    void resolver(
      sinPortada ? "sin_portada" : "aprobar",
      () => tendenciasService.aprobar(item.id, sinPortada),
      sinPortada ? "Aprobado. Queda en «Sin portada» hasta que le pongas una." : "Publicado en el feed.",
    );

  const rechazar = (motivo: MotivoRechazo) =>
    void resolver(motivo, () => tendenciasService.rechazar(item.id, motivo), "Enlace rechazado.");

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="ficha-nombre" className="text-sm font-medium">
          Nombre <span className="text-rose-600">*</span>
        </label>
        <input
          id="ficha-nombre"
          value={f.nombre}
          maxLength={120}
          disabled={bloqueado}
          onChange={(e) => poner("nombre", e.target.value)}
          placeholder="Nombre genérico, sin marcas"
          className={`mt-1 ${CLASE_INPUT}`}
        />
      </div>

      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <div>
          <label htmlFor="ficha-categoria" className="text-sm font-medium">
            Categoría <span className="text-rose-600">*</span>
          </label>
          <select
            id="ficha-categoria"
            value={f.categoria}
            disabled={bloqueado}
            onChange={(e) => poner("categoria", e.target.value)}
            className={`mt-1 ${CLASE_INPUT}`}
          >
            <option value="">Elige una categoría</option>
            {categorias.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 pb-1.5 text-sm">
          <button
            type="button"
            role="switch"
            aria-checked={f.regulado}
            disabled={bloqueado}
            onClick={() => poner("regulado", !f.regulado)}
            className={`relative h-5 w-9 rounded-full transition-colors ${f.regulado ? "bg-amber-500" : "bg-muted-foreground/30"}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${f.regulado ? "left-[18px]" : "left-0.5"}`} />
          </button>
          Regulado
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="ficha-porque" className="text-sm font-medium">Por qué está en tendencia</label>
          <Contador valor={f.por_que_tendencia} />
        </div>
        <textarea
          id="ficha-porque"
          rows={2}
          maxLength={MAX_TEXTO}
          disabled={bloqueado}
          value={f.por_que_tendencia}
          onChange={(e) => poner("por_que_tendencia", e.target.value)}
          className={`mt-1 resize-none ${CLASE_INPUT}`}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="ficha-ojo" className="text-sm font-medium">Ojo antes de traerlo</label>
          <Contador valor={f.ojo_antes} />
        </div>
        <textarea
          id="ficha-ojo"
          rows={2}
          maxLength={MAX_TEXTO}
          disabled={bloqueado}
          value={f.ojo_antes}
          onChange={(e) => poner("ojo_antes", e.target.value)}
          className={`mt-1 resize-none ${CLASE_INPUT}`}
        />
      </div>

      <ZonaPortada
        valor={f.portada_url}
        propuesta={item.remitente?.rol === "importadora" ? item.portada_url : null}
        disabled={bloqueado}
        onCambio={(ruta) => poner("portada_url", ruta)}
      />

      {item.plataforma === "instagram" && (
        <div>
          <label htmlFor="ficha-embed" className="text-sm font-medium">Código de inserción de Instagram</label>
          <p className="text-xs text-muted-foreground">
            {item.tiene_embed_instagram
              ? "Ya hay un código guardado. Pega otro solo si quieres reemplazarlo."
              : "En Instagram: ··· › Insertar › Copiar código. Debe ser de esta misma publicación."}
          </p>
          <textarea
            id="ficha-embed"
            rows={3}
            disabled={bloqueado}
            value={f.embed_html}
            onChange={(e) => poner("embed_html", e.target.value)}
            placeholder='<blockquote class="instagram-media" …'
            className={`mt-1 font-mono text-xs ${CLASE_INPUT}`}
          />
        </div>
      )}

      <div className="space-y-2 border-t border-border pt-3">
        {rechazando && modo === "pendiente" && (
          <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-2 dark:border-rose-900 dark:bg-rose-950/20">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">¿Por qué se rechaza?</p>
              <button type="button" onClick={() => setRechazando(false)} disabled={bloqueado} aria-label="Cancelar rechazo" className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-1">
              {motivos.map((m) => (
                <button
                  key={m.valor}
                  type="button"
                  disabled={bloqueado}
                  onClick={() => rechazar(m.valor)}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-white px-2.5 py-1.5 text-left text-xs hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-950/30"
                >
                  {m.texto}
                  {ocupado === m.valor && <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin" />}
                </button>
              ))}
              {motivos.length === 0 && <p className="text-xs text-muted-foreground">No se pudieron cargar los motivos.</p>}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {modo === "pendiente" && (
            <button
              type="button"
              disabled={bloqueado}
              onClick={() => setRechazando((v) => !v)}
              className={`${CLASE_BOTON_SECUNDARIO} text-rose-700 dark:text-rose-400`}
            >
              Rechazar <ChevronDown className={`h-3.5 w-3.5 transition-transform ${rechazando ? "rotate-180" : ""}`} />
            </button>
          )}
          <button
            type="button"
            disabled={bloqueado || faltaBase || !f.portada_url}
            onClick={() => aprobar(false)}
            title={faltaBase ? "Falta nombre o categoría" : !f.portada_url ? "Falta la portada" : undefined}
            className={`${CLASE_BOTON_PRIMARIO} flex-1`}
          >
            {ocupado === "aprobar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Aprobar y publicar
          </button>
        </div>
        {(faltaBase || !f.portada_url) && (
          <p className="text-xs text-muted-foreground">
            Para publicar falta{" "}
            {[!f.nombre.trim() && "el nombre", !f.categoria && "la categoría", !f.portada_url && "la portada"].filter(Boolean).join(", ")}.
          </p>
        )}
        {modo === "pendiente" && !f.portada_url && (
          <button
            type="button"
            disabled={bloqueado || faltaBase}
            onClick={() => aprobar(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline dark:text-accent"
          >
            {ocupado === "sin_portada" && <Loader2 className="h-3 w-3 animate-spin" />}
            Aprobar sin portada
          </button>
        )}
      </div>
    </div>
  );
}
