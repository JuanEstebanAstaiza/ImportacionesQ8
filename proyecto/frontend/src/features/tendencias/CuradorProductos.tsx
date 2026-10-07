import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Film, Loader2, Monitor, Plus, Save, Search, ShieldAlert, Smartphone, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { DocumentUploadButton } from "@/app/components/files/DocumentUploadButton";
import { ImagenArchivo } from "@/app/components/files/ImagenArchivo";
import { ProtectedVideoPlayer, VIDEO_FORMATS_LABEL, VIDEO_UPLOAD_ACCEPT } from "@/app/components/media/ReproductorVideo";
import { abrirArchivoEnPestana } from "@/lib/abrir-archivo";
import { toApiPath } from "@/services/api-client";
import type { BackendArchivoItem } from "@/services/business.service";
import {
  tendenciasService,
  type FechasProducto, type LimiteFecha, type ModoTransporte, type ParametrosTendencias, type ProductoCurador,
  type ProductoDatos, type Temporada,
} from "@/services/tendencias.service";

import {
  Aviso, BTN, BTN_ICONO, BTN_SEC, CARD, Campo, Cargando, EstadoEdicionBadge, EstadoProductoChip, INPUT, MAX_FOTOS,
  TEXTAREA, Vacio, formatoFecha, hoyIso, mensajeError, numeroOpcional,
} from "./CuradorComun";

const RECORDATORIO = "Nombres genéricos, sin marcas. Fotos propias o con permiso: nada de marcas de terceros ni réplicas.";
const MAX_ANGULOS = 3;

type Formulario = {
  nombre: string;
  categoria_visible: string;
  linea_producto: string;
  pais_origen: string;
  fotos: string[];
  /** "" = sin video en ese encuadre. */
  video_horizontal: string;
  video_vertical: string;
  por_que_ahora: string;
  /** "" = Todo el año. */
  temporada_id: string;
  fecha_en_bodega: string;
  transporte_sugerido: ModoTransporte;
  dias_mar: string;
  dias_aereo: string;
  revisar_requisitos: boolean;
  para_negocio: boolean;
  guia_para_quien: string;
  guia_angulos: string[];
  guia_donde: string;
  guia_contenido: string;
  que_pedir_en_cotizacion: string;
};

const VACIO: Formulario = {
  nombre: "", categoria_visible: "", linea_producto: "", pais_origen: "China", fotos: [], video_horizontal: "", video_vertical: "", por_que_ahora: "",
  temporada_id: "", fecha_en_bodega: "", transporte_sugerido: "mar", dias_mar: "", dias_aereo: "",
  revisar_requisitos: false, para_negocio: false, guia_para_quien: "", guia_angulos: ["", "", ""], guia_donde: "",
  guia_contenido: "", que_pedir_en_cotizacion: "",
};

/** Un encuadre de video: vista previa si ya hay uno, o el botón para subirlo. */
function EspacioVideo({
  titulo, detalle, icono: Icono, url, vertical, onCambiar,
}: {
  titulo: string;
  detalle: string;
  icono: typeof Monitor;
  url: string;
  vertical: boolean;
  onCambiar: (url: string) => void;
}) {
  return (
    <div className="rounded-xl border-2 border-dashed border-border p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium"><Icono className="h-4 w-4 text-primary dark:text-accent" />{titulo}</p>
      <p className="mb-2 text-xs text-muted-foreground">{detalle}</p>
      {url ? (
        <div className="space-y-2">
          <div className={`mx-auto overflow-hidden rounded-lg bg-black ${vertical ? "aspect-[9/16] h-64" : "aspect-video w-full"}`}>
            <ProtectedVideoPlayer key={url} url={url} className="h-full w-full object-contain" />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <DocumentUploadButton
              label="Reemplazar"
              accept={VIDEO_UPLOAD_ACCEPT}
              origen="tendencias"
              onUploaded={(a) => onCambiar(toApiPath(a.storage_url || `/documentos/archivos/${a.id}/descargar`))}
              onError={(m) => toast.error(m)}
            />
            <button type="button" onClick={() => onCambiar("")} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs font-medium text-destructive hover:bg-destructive/10">
              <X className="h-3.5 w-3.5" /> Quitar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <Film className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">{VIDEO_FORMATS_LABEL}</p>
          <DocumentUploadButton
            label="Subir video"
            accept={VIDEO_UPLOAD_ACCEPT}
            origen="tendencias"
            onUploaded={(a) => onCambiar(toApiPath(a.storage_url || `/documentos/archivos/${a.id}/descargar`))}
            onError={(m) => toast.error(m)}
          />
        </div>
      )}
    </div>
  );
}

function formularioDe(p: ProductoCurador): Formulario {
  const angulos = [...(p.guia_angulos ?? [])];
  while (angulos.length < MAX_ANGULOS) angulos.push("");
  return {
    nombre: p.nombre,
    categoria_visible: p.categoria_visible,
    linea_producto: p.linea_producto ?? "",
    pais_origen: p.pais_origen || "China",
    fotos: [...p.fotos],
    video_horizontal: p.video_horizontal ?? "",
    video_vertical: p.video_vertical ?? "",
    por_que_ahora: p.por_que_ahora,
    temporada_id: p.temporada_id ?? "",
    fecha_en_bodega: p.fecha_en_bodega_explicita ?? "",
    transporte_sugerido: p.transporte_sugerido,
    dias_mar: p.dias_mar != null ? String(p.dias_mar) : "",
    dias_aereo: p.dias_aereo != null ? String(p.dias_aereo) : "",
    revisar_requisitos: p.revisar_requisitos,
    para_negocio: p.para_negocio,
    guia_para_quien: p.guia_para_quien ?? "",
    guia_angulos: angulos.slice(0, MAX_ANGULOS),
    guia_donde: p.guia_donde ?? "",
    guia_contenido: p.guia_contenido ?? "",
    que_pedir_en_cotizacion: p.que_pedir_en_cotizacion ?? "",
  };
}

/** Días válidos para el backend (1–365) o null. */
function diasValidos(valor: string): number | null {
  const n = numeroOpcional(valor);
  return n != null && n >= 1 && n <= 365 ? n : null;
}

const nulo = (v: string) => (v.trim() ? v.trim() : null);

function datosDe(f: Formulario): ProductoDatos {
  return {
    nombre: f.nombre.trim(),
    categoria_visible: f.categoria_visible.trim(),
    linea_producto: nulo(f.linea_producto),
    pais_origen: f.pais_origen.trim() || "China",
    fotos: f.fotos,
    video_horizontal: f.video_horizontal || null,
    video_vertical: f.video_vertical || null,
    por_que_ahora: f.por_que_ahora.trim(),
    temporada_id: f.temporada_id || null,
    fecha_en_bodega: f.fecha_en_bodega || null,
    transporte_sugerido: f.transporte_sugerido,
    dias_mar: diasValidos(f.dias_mar),
    dias_aereo: diasValidos(f.dias_aereo),
    revisar_requisitos: f.revisar_requisitos,
    para_negocio: f.para_negocio,
    guia_para_quien: nulo(f.guia_para_quien),
    guia_angulos: f.guia_angulos.map((a) => a.trim()).filter(Boolean),
    guia_donde: nulo(f.guia_donde),
    guia_contenido: nulo(f.guia_contenido),
    que_pedir_en_cotizacion: nulo(f.que_pedir_en_cotizacion),
  };
}

function validar(f: Formulario): string | null {
  if (!f.nombre.trim()) return "El nombre es obligatorio.";
  if (f.nombre.trim().length > 80) return "El nombre tiene máximo 80 caracteres.";
  if (!f.categoria_visible.trim()) return "La categoría visible es obligatoria.";
  if (f.categoria_visible.trim().length > 40) return "La categoría tiene máximo 40 caracteres.";
  if (!f.por_que_ahora.trim()) return "Cuenta por qué ahora.";
  if (f.por_que_ahora.trim().length > 220) return "«Por qué ahora» tiene máximo 220 caracteres.";
  if (f.fotos.length > MAX_FOTOS) return `Máximo ${MAX_FOTOS} fotos.`;
  if (f.guia_angulos.some((a) => a.trim().length > 80)) return "Cada ángulo de venta tiene máximo 80 caracteres.";
  for (const [campo, nombre] of [["dias_mar", "Días por mar"], ["dias_aereo", "Días por aéreo"]] as const) {
    if (f[campo].trim() && diasValidos(f[campo]) == null) return `${nombre}: entre 1 y 365.`;
  }
  return null;
}

// ── Cálculo en vivo ──────────────────────────────────────────────────────────

function FilaLimite({ titulo, limite, texto }: { titulo: string; limite: LimiteFecha | null; texto: string | null }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="text-sm font-semibold">{limite ? formatoFecha(limite.fecha) : "—"}</p>
      {limite && <p className="text-[11px] text-muted-foreground">{limite.dias_puerta_a_puerta} días puerta a puerta</p>}
      {texto && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{texto}</p>}
    </div>
  );
}

function CalculoEnVivo({ calculo, calculando, error }: { calculo: FechasProducto | null; calculando: boolean; error: string }) {
  const cierre = !!(calculo?.limite_mar?.aviso_cierre_fabricas || calculo?.limite_aereo?.aviso_cierre_fabricas);
  return (
    <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3 dark:border-accent/30 dark:bg-accent/5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Cálculo en vivo</p>
        {calculando && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {calculo && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <EstadoProductoChip estado={calculo.estado} texto={calculo.estado_texto} />
            {calculo.estado === "fuera_de_tiempo" && <span className="text-xs text-destructive">No llega ni por aéreo: el comprador no lo verá.</span>}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-2.5">
              <p className="text-xs text-muted-foreground">En bodega</p>
              <p className="text-sm font-semibold">{calculo.fecha_en_bodega ? formatoFecha(calculo.fecha_en_bodega) : "Todo el año"}</p>
            </div>
            <FilaLimite titulo="Límite por mar" limite={calculo.limite_mar} texto={calculo.texto_mar} />
            <FilaLimite titulo="Límite por aéreo" limite={calculo.limite_aereo} texto={calculo.texto_aereo} />
          </div>
          {cierre && (
            <p className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              La fecha se adelantó por el cierre de fábricas del Año Nuevo Lunar: la producción debe terminar antes del cierre.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Editor de producto ───────────────────────────────────────────────────────

function EditorProducto({ id, onVolver }: { id: string | null; onVolver: (guardado: boolean) => void }) {
  const [form, setForm] = useState<Formulario>(VACIO);
  const [producto, setProducto] = useState<ProductoCurador | null>(null);
  const [temporadas, setTemporadas] = useState<Temporada[]>([]);
  const [parametros, setParametros] = useState<ParametrosTendencias | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [referencia, setReferencia] = useState(hoyIso());
  const [calculo, setCalculo] = useState<FechasProducto | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [errorCalculo, setErrorCalculo] = useState("");
  const secuencia = useRef(0);

  useEffect(() => {
    let vigente = true;
    Promise.all([
      id ? tendenciasService.getProducto(id) : Promise.resolve(null),
      tendenciasService.listarTemporadas().catch(() => [] as Temporada[]),
      tendenciasService.getParametros().catch(() => null),
    ])
      .then(([p, t, params]) => {
        if (!vigente) return;
        if (p) { setProducto(p); setForm(formularioDe(p)); }
        setTemporadas(t);
        setParametros(params);
      })
      .catch((err) => { toast.error(mensajeError(err, "No se pudo abrir el producto.")); onVolver(false); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [id]);

  // Recalcula fechas y estado con un pequeño retardo mientras se escribe.
  useEffect(() => {
    if (cargando) return;
    const temporizador = setTimeout(() => {
      const n = ++secuencia.current;
      setCalculando(true);
      setErrorCalculo("");
      tendenciasService.calcular({
        temporada_id: form.temporada_id || null,
        fecha_en_bodega: form.fecha_en_bodega || null,
        dias_mar: diasValidos(form.dias_mar),
        dias_aereo: diasValidos(form.dias_aereo),
        fecha_referencia: referencia || null,
      })
        .then((r) => { if (n === secuencia.current) setCalculo(r); })
        .catch((err) => { if (n === secuencia.current) setErrorCalculo(mensajeError(err, "No se pudo calcular.")); })
        .finally(() => { if (n === secuencia.current) setCalculando(false); });
    }, 400);
    return () => clearTimeout(temporizador);
  }, [cargando, form.temporada_id, form.fecha_en_bodega, form.dias_mar, form.dias_aereo, referencia]);

  if (cargando) return <Cargando texto="Abriendo producto..." />;

  const set = <K extends keyof Formulario>(k: K, v: Formulario[K]) => setForm((f) => ({ ...f, [k]: v }));
  const enPublicada = !!producto?.ediciones?.some((e) => e.estado === "publicada");
  const temporadaElegida = temporadas.find((t) => t.id === form.temporada_id);

  function fotoSubida(archivo: BackendArchivoItem) {
    const ruta = toApiPath(archivo.storage_url || `/documentos/archivos/${archivo.id}/descargar`);
    if (!ruta) return;
    setForm((f) => (f.fotos.length >= MAX_FOTOS || f.fotos.includes(ruta) ? f : { ...f, fotos: [...f.fotos, ruta] }));
  }

  function hacerPortada(ruta: string) {
    setForm((f) => ({ ...f, fotos: [ruta, ...f.fotos.filter((x) => x !== ruta)] }));
  }

  async function guardar() {
    const error = validar(form);
    if (error) { toast.error(error); return; }
    setGuardando(true);
    try {
      const datos = datosDe(form);
      if (id) {
        await tendenciasService.editarProducto(id, datos);
        if (enPublicada) toast.warning("Cambio guardado. Quedó en la bitácora de la edición publicada.");
        else toast.success("Producto guardado");
      } else {
        await tendenciasService.crearProducto(datos);
        toast.success("Producto creado");
      }
      onVolver(true);
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => onVolver(false)} className={BTN_ICONO} aria-label="Volver a productos"><ArrowLeft className="h-4 w-4" /></button>
          <div>
            <h2 className="text-lg font-semibold">{id ? form.nombre || "Producto" : "Nuevo producto"}</h2>
            {producto?.ediciones && producto.ediciones.length > 0 && (
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                En ediciones: {producto.ediciones.map((e) => (
                  <span key={e.id} className="inline-flex items-center gap-1">N.º {e.numero} <EstadoEdicionBadge estado={e.estado} /></span>
                ))}
              </p>
            )}
          </div>
        </div>
        <button type="button" onClick={() => void guardar()} disabled={guardando} className={BTN}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar producto
        </button>
      </div>

      <Aviso tono="info"><span className="inline-flex items-start gap-2"><ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />{RECORDATORIO}</span></Aviso>
      {enPublicada && (
        <Aviso tono="alerta">Este producto está en la edición publicada: cualquier cambio queda registrado y lo ve el administrador.</Aviso>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Ficha */}
        <section className={`${CARD} space-y-3`}>
          <h3 className="text-base font-semibold">Ficha</h3>
          <Campo label="Nombre" contador={{ actual: form.nombre.length, max: 80 }}>
            <input className={INPUT} maxLength={80} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Bandas de resistencia" />
          </Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Categoría visible" contador={{ actual: form.categoria_visible.length, max: 40 }}>
              <input className={INPUT} maxLength={40} value={form.categoria_visible} onChange={(e) => set("categoria_visible", e.target.value)} placeholder="Fitness · Año nuevo" />
            </Campo>
            <Campo label="Línea de producto">
              <input className={INPUT} maxLength={100} value={form.linea_producto} onChange={(e) => set("linea_producto", e.target.value)} placeholder="Deportes" />
            </Campo>
          </div>
          <Campo label="País de origen">
            <input className={INPUT} maxLength={100} value={form.pais_origen} onChange={(e) => set("pais_origen", e.target.value)} />
          </Campo>
          <Campo label="Por qué ahora" contador={{ actual: form.por_que_ahora.length, max: 220 }}>
            <textarea className={TEXTAREA} rows={3} maxLength={220} value={form.por_que_ahora} onChange={(e) => set("por_que_ahora", e.target.value)} />
          </Campo>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.revisar_requisitos} onChange={(e) => set("revisar_requisitos", e.target.checked)} className="h-4 w-4 accent-primary" />
              Revisar requisitos de importación
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.para_negocio} onChange={(e) => set("para_negocio", e.target.checked)} className="h-4 w-4 accent-primary" />
              Para tu negocio
            </label>
          </div>
        </section>

        {/* Fotos */}
        <section className={`${CARD} space-y-3`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold">Fotos</h3>
            <span className="text-xs text-muted-foreground">{form.fotos.length}/{MAX_FOTOS}</span>
          </div>
          <div className="rounded-xl border-2 border-dashed border-border p-4">
            {form.fotos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {form.fotos.map((url, i) => (
                  <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
                    <button type="button" onClick={() => { void abrirArchivoEnPestana(url); }} className="block h-full w-full" title="Ver foto">
                      <ImagenArchivo src={url} alt={`Foto ${i + 1}`} className="h-full w-full" />
                    </button>
                    {i === 0 ? (
                      <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">Portada</span>
                    ) : (
                      <button type="button" onClick={() => hacerPortada(url)}
                        className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-100 transition-opacity group-hover:opacity-100 sm:opacity-0">
                        Usar de portada
                      </button>
                    )}
                    <button type="button" onClick={() => set("fotos", form.fotos.filter((f) => f !== url))} aria-label={`Quitar foto ${i + 1}`}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-100 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-3 text-center">
                <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">De 1 a {MAX_FOTOS} fotos cuadradas, mínimo 1200 px.</p>
                <p className="mt-1 text-xs text-muted-foreground/70">PNG, JPG o WebP · la primera es la portada</p>
              </div>
            )}
            <div className="mt-3 flex items-center justify-center">
              <DocumentUploadButton
                label={form.fotos.length ? "Agregar fotos" : "Subir fotos"}
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                origen="tendencias"
                multiple
                maxArchivos={MAX_FOTOS - form.fotos.length}
                disabled={form.fotos.length >= MAX_FOTOS}
                onUploaded={fotoSubida}
                onError={(m) => toast.error(m)}
              />
            </div>
          </div>
          {form.fotos.length === 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300">Sin fotos se puede guardar, pero no se puede programar una edición que lo incluya.</p>
          )}
        </section>

        {/* Video */}
        <section className={`${CARD} space-y-3 lg:col-span-2`}>
          <div>
            <h3 className="text-base font-semibold">Video <span className="text-xs font-normal text-muted-foreground">(opcional)</span></h3>
            <p className="text-sm text-muted-foreground">
              Sube la versión horizontal, la vertical o las dos. En computador se muestra la horizontal y en celular la
              vertical; si solo subes una, se ve esa en todas las pantallas. En el destacado se reproduce directo en la tarjeta.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <EspacioVideo
              titulo="Horizontal · computador"
              detalle="16:9, por ejemplo 1920 × 1080"
              icono={Monitor}
              url={form.video_horizontal}
              vertical={false}
              onCambiar={(v) => set("video_horizontal", v)}
            />
            <EspacioVideo
              titulo="Vertical · celular"
              detalle="9:16, por ejemplo 1080 × 1920"
              icono={Smartphone}
              url={form.video_vertical}
              vertical
              onCambiar={(v) => set("video_vertical", v)}
            />
          </div>
        </section>

        {/* Fechas */}
        <section className={`${CARD} space-y-3 lg:col-span-2`}>
          <h3 className="text-base font-semibold">Cuándo pedirlo</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Campo label="Temporada">
              <select className={INPUT} value={form.temporada_id} onChange={(e) => set("temporada_id", e.target.value)}>
                <option value="">Todo el año</option>
                {temporadas.map((t) => <option key={t.id} value={t.id}>{t.nombre} · {formatoFecha(t.fecha)}</option>)}
              </select>
            </Campo>
            <Campo label="Fecha en bodega" hint="Si la dejas vacía: fecha de la temporada menos 21 días.">
              <div className="flex gap-1">
                <input type="date" className={INPUT} value={form.fecha_en_bodega} onChange={(e) => set("fecha_en_bodega", e.target.value)} />
                {form.fecha_en_bodega && (
                  <button type="button" onClick={() => set("fecha_en_bodega", "")} className={`${BTN_ICONO} h-9 w-9 flex-shrink-0`} aria-label="Quitar fecha"><X className="h-4 w-4" /></button>
                )}
              </div>
            </Campo>
            <div className="text-sm">
              <p className="mb-1 font-medium">Transporte sugerido</p>
              <div className="flex gap-1 rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Transporte sugerido">
                {(["mar", "aereo"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => set("transporte_sugerido", m)}
                    className={`h-7 flex-1 rounded-md text-sm font-medium ${form.transporte_sugerido === m ? "bg-primary text-white dark:bg-accent dark:text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                    {m === "mar" ? "Mar" : "Aéreo"}
                  </button>
                ))}
              </div>
            </div>
            <Campo label="Evaluar estado al" hint="Úsala con la fecha de publicación de la edición.">
              <input type="date" className={INPUT} value={referencia} onChange={(e) => setReferencia(e.target.value)} />
            </Campo>
            <Campo label="Días por mar" hint="Vacío: parámetro global.">
              <input type="number" min={1} max={365} className={INPUT} value={form.dias_mar} onChange={(e) => set("dias_mar", e.target.value)}
                placeholder={parametros ? `${parametros.dias_mar} (global)` : "Global"} />
            </Campo>
            <Campo label="Días por aéreo" hint="Vacío: parámetro global.">
              <input type="number" min={1} max={365} className={INPUT} value={form.dias_aereo} onChange={(e) => set("dias_aereo", e.target.value)}
                placeholder={parametros ? `${parametros.dias_aereo} (global)` : "Global"} />
            </Campo>
          </div>
          {temporadaElegida?.ejemplos && <p className="text-xs text-muted-foreground">Temporada: {temporadaElegida.ejemplos}</p>}
          <CalculoEnVivo calculo={calculo} calculando={calculando} error={errorCalculo} />
        </section>

        {/* Guía de venta */}
        <section className={`${CARD} space-y-3 lg:col-span-2`}>
          <h3 className="text-base font-semibold">Cómo venderlo</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            <Campo label="Para quién">
              <textarea className={TEXTAREA} rows={2} value={form.guia_para_quien} onChange={(e) => set("guia_para_quien", e.target.value)} />
            </Campo>
            <div>
              <p className="mb-1 text-sm font-medium">Ángulos de venta <span className="text-xs font-normal text-muted-foreground">(hasta {MAX_ANGULOS}, 80 caracteres)</span></p>
              <div className="space-y-1.5">
                {form.guia_angulos.map((a, i) => (
                  <input key={i} className={INPUT} maxLength={80} value={a} placeholder={`Ángulo ${i + 1}`}
                    onChange={(e) => set("guia_angulos", form.guia_angulos.map((x, j) => (j === i ? e.target.value : x)))} />
                ))}
              </div>
            </div>
            <Campo label="Dónde venderlo">
              <textarea className={TEXTAREA} rows={2} value={form.guia_donde} onChange={(e) => set("guia_donde", e.target.value)} />
            </Campo>
            <Campo label="Contenido sugerido">
              <textarea className={TEXTAREA} rows={2} value={form.guia_contenido} onChange={(e) => set("guia_contenido", e.target.value)} />
            </Campo>
          </div>
          <Campo label="Qué pedir en la cotización" hint="Se copia a la descripción de la solicitud prellenada.">
            <textarea className={TEXTAREA} rows={3} value={form.que_pedir_en_cotizacion} onChange={(e) => set("que_pedir_en_cotizacion", e.target.value)} />
          </Campo>
        </section>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => onVolver(false)} className={BTN_SEC}>Cancelar</button>
        <button type="button" onClick={() => void guardar()} disabled={guardando} className={BTN}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar producto
        </button>
      </div>
    </div>
  );
}

// ── Lista ────────────────────────────────────────────────────────────────────

function ListaProductos({ onAbrir, version }: { onAbrir: (id: string | null) => void; version: number }) {
  const [productos, setProductos] = useState<ProductoCurador[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    tendenciasService.listarProductos()
      .then((lista) => { if (vigente) setProductos(lista); })
      .catch((err) => toast.error(mensajeError(err, "No se pudieron cargar los productos.")))
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [version]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter((p) => [p.nombre, p.categoria_visible, p.temporada?.nombre ?? ""].some((v) => v.toLowerCase().includes(q)));
  }, [productos, busqueda]);

  return (
    <section className={CARD}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Productos</h2>
          <p className="text-sm text-muted-foreground">Estados evaluados a hoy. Un producto puede repetirse en varias ediciones.</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar producto..." className={`${INPUT} pl-9`} />
          </div>
          <button type="button" onClick={() => onAbrir(null)} className={BTN}><Plus className="h-4 w-4" />Nuevo producto</button>
        </div>
      </div>
      {cargando ? <Cargando /> : visibles.length === 0 ? (
        <Vacio>{productos.length ? "Ningún producto coincide con la búsqueda." : "Todavía no hay productos."}</Vacio>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2">Temporada</th>
                <th className="px-3 py-2">Estado hoy</th>
                <th className="px-3 py-2">Ediciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibles.map((p) => (
                <tr key={p.id} onClick={() => onAbrir(p.id)} className="cursor-pointer hover:bg-muted/40">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      {p.fotos[0]
                        ? <ImagenArchivo src={p.fotos[0]} alt={p.nombre} className="h-10 w-10 flex-shrink-0 rounded-md" />
                        : <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-muted text-[9px] text-muted-foreground">Sin foto</span>}
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.nombre}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.categoria_visible}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {p.temporada ? <>{p.temporada.nombre} <span className="text-xs text-muted-foreground">· {formatoFecha(p.temporada.fecha, false)}</span></> : <span className="text-muted-foreground">Todo el año</span>}
                  </td>
                  <td className="px-3 py-2.5"><EstadoProductoChip estado={p.fechas.estado} texto={p.fechas.estado_texto} /></td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {p.ediciones?.length ? p.ediciones.map((e) => `N.º ${e.numero}`).join(", ") : p.ediciones ? "Ninguna" : "Ver en la ficha"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function CuradorProductos() {
  const [abierto, setAbierto] = useState<{ id: string | null } | null>(null);
  const [version, setVersion] = useState(0);

  if (abierto) {
    return (
      <EditorProducto
        key={abierto.id ?? "nuevo"}
        id={abierto.id}
        onVolver={(guardado) => { setAbierto(null); if (guardado) setVersion((v) => v + 1); }}
      />
    );
  }
  return <ListaProductos version={version} onAbrir={(id) => setAbierto({ id })} />;
}
