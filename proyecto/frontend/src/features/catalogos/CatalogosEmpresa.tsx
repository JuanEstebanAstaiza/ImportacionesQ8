import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BookOpen,
  Bell,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { DocumentUploadButton } from "@/app/components/files/DocumentUploadButton";
import { ImagenArchivo } from "@/app/components/files/ImagenArchivo";
import { abrirArchivoEnPestana } from "@/lib/abrir-archivo";
import { CATEGORIAS_PRODUCTO } from "@/lib/categorias";
import { toApiPath } from "@/services/api-client";
import {
  CRITERIOS,
  TIERS,
  catalogosService,
  type AccesoManual,
  type Catalogo,
  type CatalogoDatos,
  type ClienteEmpresa,
  type CriterioCatalogo,
  type ProductoCatalogo,
  type ProductoCatalogoDatos,
  type TierCotizante,
} from "@/services/catalogos.service";
import { Autocompletar, Resaltar } from "@/app/components/busqueda/Autocompletar";

import {
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_INPUT,
  Campo,
  InsigniaTier,
  Modal,
  cantidadConUnidad,
  mensajeError,
} from "./comun";

/**
 * Catálogos selectos de la empresa importadora: qué productos ofrece importar y
 * a qué compradores se los muestra. Para el comprador son gratis y no llevan
 * precios; el precio llega en la propuesta. El asesor solo los consulta.
 */

const MAX_FOTOS = 5;
const ACEPTA_IMAGENES = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";
const PAISES = ["China", "Estados Unidos", "Alemania", "Japón", "India", "Italia", "Francia", "España", "Brasil", "Corea del Sur", "Turquía", "México", "Vietnam", "Colombia"];

const ICONO_CRITERIO: Record<CriterioCatalogo, typeof UserCheck> = {
  manual: UserCheck,
  tier_minimo: Award,
  clientes_con_orden: PackageCheck,
  suscriptores_zarpi: Sparkles,
};

type Pestana = "productos" | "acceso" | "datos";

function datosDe(c: Catalogo, cambios: Partial<CatalogoDatos> = {}): CatalogoDatos {
  return {
    titulo: c.titulo,
    descripcion: c.descripcion,
    criterio: c.criterio,
    tier_minimo: c.criterio === "tier_minimo" ? c.tier_minimo : null,
    activo: c.activo,
    ...cambios,
  };
}

function contarActivos(productos: ProductoCatalogo[]): number {
  return productos.filter((p) => p.activo).length;
}

function fechaCorta(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? "" : fecha.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

function ordenarProductos(productos: ProductoCatalogo[]): ProductoCatalogo[] {
  return [...productos].sort((a, b) => a.orden - b.orden);
}

function Interruptor({
  activo,
  onCambio,
  cargando,
  etiqueta,
}: {
  activo: boolean;
  onCambio: () => void;
  cargando?: boolean;
  etiqueta: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      title={etiqueta}
      disabled={cargando}
      onClick={(e) => { e.stopPropagation(); onCambio(); }}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${activo ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${activo ? "translate-x-5" : "translate-x-0.5"}`} />
      {cargando ? <Loader2 className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-spin text-primary" /> : null}
    </button>
  );
}

function EstadoVisible({ activo }: { activo: boolean }) {
  return activo ? (
    <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
      <Eye className="h-3 w-3" /> Activo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
      <EyeOff className="h-3 w-3" /> Oculto
    </span>
  );
}

function AvisoAlcance({ catalogo }: { catalogo: Catalogo }) {
  if (!catalogo.activo) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Está oculto: ningún comprador lo ve.
      </p>
    );
  }
  if (catalogo.criterio === "manual" && (catalogo.accesos_manuales ?? 0) === 0) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Aún nadie lo ve: dale acceso a tus clientes.
      </p>
    );
  }
  if (catalogo.total_productos === 0) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> No tiene productos visibles todavía.
      </p>
    );
  }
  return null;
}

// ── Datos del catálogo ──────────────────────────────────────────────────────

function FormCatalogo({
  catalogo,
  esDueno,
  onGuardado,
  onBorrado,
  onCancelar,
}: {
  catalogo: Catalogo | null;
  esDueno: boolean;
  onGuardado: (c: Catalogo) => void;
  onBorrado: (id: string) => void;
  onCancelar?: () => void;
}) {
  const [titulo, setTitulo] = useState(catalogo?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(catalogo?.descripcion ?? "");
  const [criterio, setCriterio] = useState<CriterioCatalogo>(catalogo?.criterio ?? "manual");
  const [tier, setTier] = useState<TierCotizante>(catalogo?.tier_minimo ?? "Silver");
  const [activo, setActivo] = useState(catalogo?.activo ?? true);
  const [guardando, setGuardando] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [borrando, setBorrando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const limpio = titulo.trim();
    if (!limpio) return toast.error("Ponle un título al catálogo.");
    if (limpio.length > 80) return toast.error("El título admite hasta 80 caracteres.");
    if (descripcion.trim().length > 300) return toast.error("La descripción admite hasta 300 caracteres.");
    const datos: CatalogoDatos = {
      titulo: limpio,
      descripcion: descripcion.trim() || null,
      criterio,
      tier_minimo: criterio === "tier_minimo" ? tier : null,
      activo,
    };
    setGuardando(true);
    try {
      const resultado = catalogo
        ? await catalogosService.editar(catalogo.id, datos)
        : await catalogosService.crear(datos);
      toast.success(catalogo ? "Catálogo guardado." : "Catálogo creado. Ahora agrégale productos.");
      onGuardado(resultado);
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!catalogo) return;
    setBorrando(true);
    try {
      await catalogosService.borrar(catalogo.id);
      toast.success("Catálogo borrado.");
      onBorrado(catalogo.id);
    } catch (error) {
      toast.error(mensajeError(error));
      setBorrando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      <fieldset disabled={!esDueno || guardando} className="space-y-4">
        <Campo etiqueta="Título" contador={[titulo.length, 80]}>
          <input
            className={CLASE_INPUT}
            value={titulo}
            maxLength={80}
            placeholder="Ej. Línea hogar premium 2026"
            onChange={(e) => setTitulo(e.target.value)}
          />
        </Campo>
        <Campo etiqueta="Descripción" contador={[descripcion.length, 300]} ayuda="Qué encontrará el comprador y por qué le conviene.">
          <textarea
            className={`${CLASE_INPUT} min-h-[80px] resize-y`}
            value={descripcion}
            maxLength={300}
            rows={3}
            placeholder="Ej. Productos para el hogar que importamos cada mes desde Yiwu, con empaque para retail."
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </Campo>

        <div>
          <p className="mb-1 text-sm font-medium">¿Quién puede verlo?</p>
          <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
            {CRITERIOS.map((opcion) => {
              const Icono = ICONO_CRITERIO[opcion.valor];
              const elegido = criterio === opcion.valor;
              return (
                <button
                  key={opcion.valor}
                  type="button"
                  role="radio"
                  aria-checked={elegido}
                  onClick={() => setCriterio(opcion.valor)}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed ${
                    elegido ? "border-primary bg-primary/5 ring-1 ring-primary dark:bg-primary/15" : "border-border bg-white hover:border-primary/40"
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${elegido ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                    <Icono className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{opcion.etiqueta}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{opcion.ayuda}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {criterio === "tier_minimo" ? (
            <div className="mt-3 max-w-xs">
              <Campo etiqueta="Nivel mínimo de cotizante" ayuda="Bronze < Silver < Gold < Élite. Lo ven ese nivel y los superiores.">
                <select className={CLASE_INPUT} value={tier} onChange={(e) => setTier(e.target.value as TierCotizante)}>
                  {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Campo>
            </div>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Además del criterio, siempre puedes dar acceso a mano a clientes concretos desde «Quién lo ve», aunque todavía no lo cumplan.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-white p-3">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#4F06EB]" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          <span>
            <span className="block text-sm font-medium">Catálogo activo</span>
            <span className="block text-xs text-muted-foreground">Si lo desactivas, deja de verse sin perder productos ni accesos.</span>
          </span>
        </label>
      </fieldset>

      {esDueno ? (
        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {catalogo && !confirmarBorrado ? (
              <button type="button" onClick={() => setConfirmarBorrado(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline">
                <Trash2 className="h-4 w-4" /> Borrar catálogo
              </button>
            ) : null}
          </div>
          <div className="flex gap-2 sm:justify-end">
            {onCancelar ? (
              <button type="button" onClick={onCancelar} className={`${CLASE_BOTON_SECUNDARIO} flex-1 sm:flex-none`}>Cancelar</button>
            ) : null}
            <button type="submit" disabled={guardando} className={`${CLASE_BOTON_PRIMARIO} flex-1 sm:flex-none`}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {catalogo ? "Guardar cambios" : "Crear catálogo"}
            </button>
          </div>
        </div>
      ) : null}

      {catalogo && confirmarBorrado ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">¿Borrar «{catalogo.titulo}»?</p>
          <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">
            Se borran sus {catalogo.productos.length} productos y los accesos manuales. Los compradores dejan de verlo. No se puede deshacer.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={borrar} disabled={borrando} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
              {borrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Sí, borrar
            </button>
            <button type="button" onClick={() => setConfirmarBorrado(false)} disabled={borrando} className={CLASE_BOTON_SECUNDARIO}>Cancelar</button>
          </div>
        </div>
      ) : null}
    </form>
  );
}

// ── Productos ───────────────────────────────────────────────────────────────

function FormProducto({
  catalogoId,
  producto,
  ordenSugerido,
  soloLectura,
  onGuardado,
  onCerrar,
}: {
  catalogoId: string;
  producto: ProductoCatalogo | null;
  ordenSugerido: number;
  soloLectura: boolean;
  onGuardado: (p: ProductoCatalogo) => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? "");
  const [fotos, setFotos] = useState<string[]>(producto?.fotos ?? []);
  const [linea, setLinea] = useState(producto?.linea_producto ?? "");
  const [pais, setPais] = useState(producto?.pais_origen ?? "China");
  const [cantidad, setCantidad] = useState(producto?.cantidad_minima != null ? String(producto.cantidad_minima) : "");
  
  const [unidad, setUnidad] = useState<"unidades" | "m3" | "ninguno">(
    producto?.cantidad_minima == null 
      ? "ninguno" 
      : (producto.unidad_cantidad ?? "unidades")
  );
  
  const [tiempo, setTiempo] = useState(producto?.tiempo_estimado ?? "");
  const [quePedir, setQuePedir] = useState(producto?.que_pedir_en_cotizacion ?? "");
  const [orden, setOrden] = useState(String(producto?.orden ?? ordenSugerido));
  const [activo, setActivo] = useState(producto?.activo ?? true);
  const [guardando, setGuardando] = useState(false);

  const lineas = useMemo(() => {
    const base: string[] = [...CATEGORIAS_PRODUCTO];
    return linea && !base.includes(linea) ? [linea, ...base] : base;
  }, [linea]);

  function alSubir(archivo: { id: string; storage_url: string | null }) {
    const ruta = toApiPath(archivo.storage_url || `/documentos/archivos/${archivo.id}/descargar`);
    if (!ruta) return;
    setFotos((previas) => (previas.includes(ruta) || previas.length >= MAX_FOTOS ? previas : [...previas, ruta]));
  }

  // Manejar el cambio de unidad
  const manejarCambioUnidad = (nuevaUnidad: "unidades" | "m3" | "ninguno") => {
    setUnidad(nuevaUnidad);
    // Si elige "ninguno", limpiamos la cantidad
    if (nuevaUnidad === "ninguno") {
      setCantidad("");
    }
  };

  async function guardar() {
    const limpio = nombre.trim();
    if (!limpio) return toast.error("Escribe el nombre del producto.");
    
    let cantidadMinima: number | null = null;
    
    // Si la unidad NO es "ninguno", validamos y asignamos la cantidad
    if (unidad !== "ninguno" && cantidad.trim()) {
      cantidadMinima = Number(cantidad.replace(",", "."));
      if (!Number.isFinite(cantidadMinima) || cantidadMinima < 1) {
        return toast.error("La cantidad mínima debe ser un número igual o mayor a 1.");
      }
    }

    const datos: ProductoCatalogoDatos = {
      nombre: limpio,
      descripcion: descripcion.trim() || null,
      fotos,
      linea_producto: linea || null,
      pais_origen: pais.trim() || "China",
      cantidad_minima: unidad === "ninguno" ? null : cantidadMinima, // Si es ninguno, enviamos null
      unidad_cantidad: unidad === "ninguno" ? "unidades" : unidad,   // TypeScript feliz: solo envía "unidades" o "m3"
      tiempo_estimado: tiempo.trim() || null,
      que_pedir_en_cotizacion: quePedir.trim() || null,
      orden: Number.parseInt(orden, 10) || 0,
      activo,
    };

    setGuardando(true);
    try {
      const resultado = producto
        ? await catalogosService.editarProducto(catalogoId, producto.id, datos)
        : await catalogosService.agregarProducto(catalogoId, datos);
      toast.success(producto ? "Producto guardado." : "Producto agregado al catálogo.");
      onGuardado(resultado);
    } catch (error) {
      toast.error(mensajeError(error));
      setGuardando(false);
    }
  }

  const titulo = soloLectura ? producto?.nombre ?? "Producto" : producto ? "Editar producto" : "Agregar producto";

  return (
    <Modal
      titulo={titulo}
      onCerrar={onCerrar}
      pie={
        soloLectura ? (
          <div className="flex justify-end">
            <button type="button" onClick={onCerrar} className={CLASE_BOTON_SECUNDARIO}>Cerrar</button>
          </div>
        ) : (
          <div className="flex gap-2 sm:justify-end">
            <button type="button" onClick={onCerrar} disabled={guardando} className={`${CLASE_BOTON_SECUNDARIO} flex-1 sm:flex-none`}>Cancelar</button>
            <button type="button" onClick={guardar} disabled={guardando} className={`${CLASE_BOTON_PRIMARIO} flex-1 sm:flex-none`}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {producto ? "Guardar producto" : "Agregar producto"}
            </button>
          </div>
        )
      }
    >
      <div className="space-y-4">
        {/* Fotos */}
        <div>
          <p className="mb-1.5 text-sm font-medium">
            Fotos <span className="text-xs font-normal text-muted-foreground">(opcional, hasta {MAX_FOTOS})</span>
          </p>
          <div className="rounded-xl border-2 border-dashed border-border p-4">
            {fotos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {fotos.map((url, i) => (
                  <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
                    <button type="button" onClick={() => { void abrirArchivoEnPestana(url); }} className="block h-full w-full" title="Ver foto">
                      <ImagenArchivo src={url} alt={`Foto ${i + 1} del producto`} className="h-full w-full" />
                    </button>
                    {i === 0 ? <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">Portada</span> : null}
                    {!soloLectura ? (
                      <button
                        type="button"
                        onClick={() => setFotos((previas) => previas.filter((f) => f !== url))}
                        aria-label={`Quitar foto ${i + 1}`}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-100 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 sm:opacity-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-2 text-center">
                <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">{soloLectura ? "Sin fotos." : "Fotos reales del producto, el empaque o la etiqueta."}</p>
                {!soloLectura ? <p className="mt-1 text-xs text-muted-foreground/70">PNG, JPG o WebP · la primera es la portada</p> : null}
              </div>
            )}
            {!soloLectura ? (
              <div className="mt-3 flex items-center justify-center gap-3">
                <DocumentUploadButton
                  label={fotos.length ? "Agregar fotos" : "Subir fotos"}
                  accept={ACEPTA_IMAGENES}
                  origen="catalogo"
                  multiple
                  maxArchivos={MAX_FOTOS - fotos.length}
                  disabled={fotos.length >= MAX_FOTOS || guardando}
                  onUploaded={alSubir}
                  onError={(mensaje) => toast.error(mensaje)}
                />
                <span className="text-xs text-muted-foreground">{fotos.length}/{MAX_FOTOS}</span>
              </div>
            ) : null}
          </div>
        </div>

        <fieldset disabled={soloLectura || guardando} className="space-y-4">
          <Campo etiqueta="Nombre" contador={[nombre.length, 120]}>
            <input className={CLASE_INPUT} value={nombre} maxLength={120} placeholder="Ej. Lámpara LED de escritorio plegable" onChange={(e) => setNombre(e.target.value)} />
          </Campo>
          <Campo etiqueta="Descripción">
            <textarea className={`${CLASE_INPUT} min-h-[80px] resize-y`} rows={3} value={descripcion} placeholder="Materiales, medidas, variantes, para qué sirve…" onChange={(e) => setDescripcion(e.target.value)} />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Línea de producto">
              <select className={CLASE_INPUT} value={linea} onChange={(e) => setLinea(e.target.value)}>
                <option value="">Sin línea</option>
                {lineas.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="País de origen">
              <input className={CLASE_INPUT} list="catalogo-paises" value={pais} maxLength={100} onChange={(e) => setPais(e.target.value)} />
              <datalist id="catalogo-paises">{PAISES.map((p) => <option key={p} value={p} />)}</datalist>
            </Campo>

            {/* SECCIÓN ACTUALIZADA DE CANTIDAD Y UNIDAD */}
            <div>
              <span className="mb-1 block text-sm font-medium">Cantidad mínima</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  step="any"
                  disabled={unidad === "ninguno"}
                  className={`${CLASE_INPUT} w-1/2 min-w-0 disabled:bg-muted/50 disabled:text-muted-foreground disabled:cursor-not-allowed`}
                  value={cantidad}
                  placeholder={unidad === "ninguno" ? "-" : "Ej. 500"}
                  onChange={(e) => setCantidad(e.target.value)}
                />
                <select
                  className={`${CLASE_INPUT} w-1/2`}
                  value={unidad}
                  onChange={(e) => manejarCambioUnidad(e.target.value as "unidades" | "m3" | "ninguno")}
                  aria-label="Unidad"
                >
                  <option value="unidades">unidades</option>
                  <option value="m3">m³</option>
                  <option value="ninguno">Ninguno</option>
                </select>
              </div>
            </div>

            <Campo etiqueta="Tiempo estimado" ayuda="Hasta que llega a Colombia.">
              <input className={CLASE_INPUT} value={tiempo} maxLength={80} placeholder="Ej. 45–60 días" onChange={(e) => setTiempo(e.target.value)} />
            </Campo>
          </div>

          <Campo
            etiqueta="Qué pedir en la cotización"
            ayuda="Se copia en la solicitud cuando el comprador pide propuesta: especificaciones, variantes, empaque o certificaciones a precisar."
          >
            <textarea className={`${CLASE_INPUT} min-h-[72px] resize-y`} rows={3} value={quePedir} placeholder="Ej. Indica color, voltaje (110 V) y si lo quieres con empaque individual." onChange={(e) => setQuePedir(e.target.value)} />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Orden" ayuda="Los números menores salen primero.">
              <input className={CLASE_INPUT} type="number" step={1} value={orden} onChange={(e) => setOrden(e.target.value)} />
            </Campo>
            <label className="flex cursor-pointer items-start gap-3 self-start rounded-xl border border-border bg-white p-3 sm:mt-6">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#4F06EB]" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
              <span>
                <span className="block text-sm font-medium">Visible en el catálogo</span>
                <span className="block text-xs text-muted-foreground">Desactívalo para ocultarlo sin borrarlo.</span>
              </span>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">Los catálogos no llevan precios: el precio va en tu propuesta.</p>
        </fieldset>
      </div>
    </Modal>
  );
}

function SeccionProductos({
  catalogo,
  esDueno,
  onCambio,
}: {
  catalogo: Catalogo;
  esDueno: boolean;
  onCambio: (productos: ProductoCatalogo[]) => void;
}) {
  const [editando, setEditando] = useState<ProductoCatalogo | "nuevo" | null>(null);
  const [porBorrar, setPorBorrar] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const productos = ordenarProductos(catalogo.productos);

  async function borrar(producto: ProductoCatalogo) {
    setBorrando(true);
    try {
      await catalogosService.borrarProducto(catalogo.id, producto.id);
      onCambio(catalogo.productos.filter((p) => p.id !== producto.id));
      toast.success("Producto borrado.");
      setPorBorrar(null);
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setBorrando(false);
    }
  }

  function alGuardar(producto: ProductoCatalogo) {
    const existe = catalogo.productos.some((p) => p.id === producto.id);
    onCambio(existe ? catalogo.productos.map((p) => (p.id === producto.id ? producto : p)) : [...catalogo.productos, producto]);
    setEditando(null);
  }

  const siguienteOrden = productos.length ? Math.max(...productos.map((p) => p.orden)) + 1 : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {productos.length === 0 ? "Sin productos" : `${productos.length} ${productos.length === 1 ? "producto" : "productos"} · ${contarActivos(productos)} visibles`}
        </p>
        {esDueno ? (
          <button type="button" onClick={() => setEditando("nuevo")} className={CLASE_BOTON_PRIMARIO}>
            <Plus className="h-4 w-4" /> Agregar producto
          </button>
        ) : null}
      </div>

      {productos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center">
          <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">Este catálogo aún no tiene productos</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Agrega lo que puedes importarles a tus clientes, con fotos y la cantidad mínima. El comprador te pedirá propuesta desde aquí.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          {productos.map((p) => (
            <li key={p.id} className="p-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditando(p)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  {p.fotos[0] ? (
                    <ImagenArchivo src={p.fotos[0]} alt={p.nombre} className="h-14 w-14 shrink-0 rounded-lg border border-border" />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Package className="h-5 w-5" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`truncate text-sm font-medium ${p.activo ? "" : "text-muted-foreground"}`}>{p.nombre}</span>
                      {!p.activo ? <EstadoVisible activo={false} /> : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {[p.linea_producto, p.pais_origen].filter(Boolean).join(" · ")}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {p.cantidad_minima != null ? `Mín. ${cantidadConUnidad(p.cantidad_minima, p.unidad_cantidad)}` : "Sin cantidad mínima"}
                      {p.tiempo_estimado ? ` · ${p.tiempo_estimado}` : ""}
                    </span>
                  </span>
                </button>
                {esDueno ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => setEditando(p)} aria-label={`Editar ${p.nombre}`} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setPorBorrar(p.id)} aria-label={`Borrar ${p.nombre}`} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </div>
              {porBorrar === p.id ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/40">
                  <span className="flex-1 text-xs text-red-800 dark:text-red-200">¿Borrar este producto del catálogo?</span>
                  <button type="button" onClick={() => borrar(p)} disabled={borrando} className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60">
                    {borrando ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Borrar
                  </button>
                  <button type="button" onClick={() => setPorBorrar(null)} disabled={borrando} className="rounded-md border border-border bg-white px-2.5 py-1 text-xs font-medium">Cancelar</button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {editando ? (
        <FormProducto
          catalogoId={catalogo.id}
          producto={editando === "nuevo" ? null : editando}
          ordenSugerido={siguienteOrden}
          soloLectura={!esDueno}
          onGuardado={alGuardar}
          onCerrar={() => setEditando(null)}
        />
      ) : null}
    </div>
  );
}

// ── Quién lo ve ─────────────────────────────────────────────────────────────

function SeccionAcceso({
  catalogo,
  esDueno,
  onConteo,
}: {
  catalogo: Catalogo;
  esDueno: boolean;
  onConteo: (n: number) => void;
}) {
  const [accesos, setAccesos] = useState<AccesoManual[]>([]);
  const [cargando, setCargando] = useState(true);
  const [eligiendo, setEligiendo] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [porQuitar, setPorQuitar] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    catalogosService
      .accesos(catalogo.id)
      .then((filas) => { if (vigente) setAccesos(filas); })
      .catch((error) => { if (vigente) toast.error(mensajeError(error)); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [catalogo.id]);

  async function dar(cliente: ClienteEmpresa) {
    setProcesando(cliente.usuario_id);
    try {
      await catalogosService.darAcceso(catalogo.id, cliente.usuario_id);
      const nuevos = [{ usuario_id: cliente.usuario_id, nombre: cliente.nombre, tier: cliente.tier, fecha: new Date().toISOString() }, ...accesos];
      setAccesos(nuevos);
      onConteo(nuevos.length);
      toast.success(`${cliente.nombre} ya puede ver el catálogo. Le llegó una notificación.`);
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setProcesando(null);
    }
  }

  async function quitar(acceso: AccesoManual) {
    setProcesando(acceso.usuario_id);
    try {
      await catalogosService.quitarAcceso(catalogo.id, acceso.usuario_id);
      const restantes = accesos.filter((a) => a.usuario_id !== acceso.usuario_id);
      setAccesos(restantes);
      onConteo(restantes.length);
      setPorQuitar(null);
      toast.success(`Le quitaste el acceso manual a ${acceso.nombre}.`);
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setProcesando(null);
    }
  }

  const yaAgregados = useMemo(() => new Set(accesos.map((a) => a.usuario_id)), [accesos]);

  const Icono = ICONO_CRITERIO[catalogo.criterio] ?? Users;
  const ayuda = CRITERIOS.find((c) => c.valor === catalogo.criterio)?.ayuda;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icono className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lo ven</p>
            <p className="text-sm font-semibold">{catalogo.criterio_texto}</p>
            {ayuda ? <p className="mt-0.5 text-xs text-muted-foreground">{ayuda}</p> : null}
            <p className="mt-2 text-xs text-muted-foreground">
              {catalogo.criterio === "manual"
                ? "Solo los clientes de la lista de abajo."
                : "Y, además, los clientes de la lista de abajo, aunque todavía no cumplan el criterio."}
            </p>
          </div>
        </div>
        {!catalogo.activo ? (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> El catálogo está oculto: nadie lo ve hasta que lo actives.
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Acceso manual</h3>
            <p className="text-xs text-muted-foreground">Clientes invitados uno a uno.</p>
          </div>
          {esDueno && !eligiendo ? (
            <button type="button" onClick={() => setEligiendo(true)} className={CLASE_BOTON_PRIMARIO}>
              <UserPlus className="h-4 w-4" /> Dar acceso
            </button>
          ) : null}
        </div>

        {esDueno && eligiendo ? (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-3 dark:bg-primary/10">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Elige a quién darle acceso</p>
              <button type="button" onClick={() => setEligiendo(false)} aria-label="Cerrar selector" className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-2 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Solo aparecen compradores que ya cotizaron o compraron con tu empresa. Al darle acceso le llega una notificación.
            </p>
            <Autocompletar<ClienteEmpresa>
              buscar={(q) => catalogosService.clientes(q)}
              minimo={0}
              placeholder="Busca por nombre o correo"
              excluir={yaAgregados}
              disabled={procesando !== null}
              onSeleccionar={(c) => void dar(c)}
              obtenerClave={(c) => c.usuario_id}
              textoSinResultados="Ningún cliente coincide. Solo aparecen compradores que ya cotizaron o compraron con tu empresa."
              renderOpcion={(c, q) => (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium"><Resaltar texto={c.nombre} consulta={q} /></p>
                    <p className="truncate text-xs text-muted-foreground">{c.email_parcial}</p>
                  </div>
                  <span className="flex shrink-0 flex-col items-end gap-0.5 text-[11px] text-muted-foreground">
                    <InsigniaTier tier={c.tier} />
                    {c.ordenes_con_empresa > 0
                      ? `${c.ordenes_con_empresa} ${c.ordenes_con_empresa === 1 ? "orden" : "órdenes"} contigo`
                      : "Sin órdenes aún"}
                  </span>
                </div>
              )}
            />
            {procesando !== null ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Dando acceso…</p>
            ) : null}
          </div>
        ) : null}

        {cargando ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : accesos.length === 0 ? (
          <p className="rounded-lg bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">
            {catalogo.criterio === "manual"
              ? "Nadie tiene acceso todavía. Dale acceso a tus clientes para que vean este catálogo."
              : "No has invitado a nadie a mano. Lo ven quienes cumplen el criterio."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {accesos.map((a) => (
              <li key={a.usuario_id} className="py-2">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.nombre}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <InsigniaTier tier={a.tier} /> Desde el {fechaCorta(a.fecha)}
                    </p>
                  </div>
                  {esDueno && porQuitar !== a.usuario_id ? (
                    <button type="button" onClick={() => setPorQuitar(a.usuario_id)} className="shrink-0 text-xs font-medium text-red-600 hover:underline">
                      Quitar
                    </button>
                  ) : null}
                </div>
                {porQuitar === a.usuario_id ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/40">
                    <span className="flex-1 text-xs text-red-800 dark:text-red-200">
                      ¿Quitarle el acceso? {catalogo.criterio === "manual" ? "Dejará de ver el catálogo." : "Lo seguirá viendo solo si cumple el criterio."}
                    </span>
                    <button type="button" onClick={() => quitar(a)} disabled={procesando !== null} className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60">
                      {procesando === a.usuario_id ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Quitar
                    </button>
                    <button type="button" onClick={() => setPorQuitar(null)} disabled={procesando !== null} className="rounded-md border border-border bg-white px-2.5 py-1 text-xs font-medium">Cancelar</button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────

export function CatalogosEmpresa({ esDueno }: { esDueno: boolean }) {
  const [catalogos, setCatalogos] = useState<Catalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccion, setSeleccion] = useState<string | null>(null); // id o "nuevo"
  const [pestana, setPestana] = useState<Pestana>("productos");
  const [alternando, setAlternando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setCatalogos(await catalogosService.mios());
    } catch (error) {
      toast.error(mensajeError(error, "No se pudieron cargar los catálogos."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  // La respuesta de editar no trae el conteo de accesos manuales: se conserva el anterior.
  const fusionar = useCallback((nuevo: Catalogo) => {
    setCatalogos((previos) => {
      const existe = previos.some((c) => c.id === nuevo.id);
      if (!existe) return [...previos, nuevo];
      return previos.map((c) => (c.id === nuevo.id ? { ...c, ...nuevo, accesos_manuales: nuevo.accesos_manuales ?? c.accesos_manuales } : c));
    });
  }, []);

  function parchear(id: string, cambios: Partial<Catalogo>) {
    setCatalogos((previos) => previos.map((c) => (c.id === id ? { ...c, ...cambios } : c)));
  }

  async function alternarActivo(c: Catalogo) {
    setAlternando(c.id);
    try {
      fusionar(await catalogosService.editar(c.id, datosDe(c, { activo: !c.activo })));
      toast.success(c.activo ? "Catálogo oculto." : "Catálogo activo: ya lo ven los compradores con acceso.");
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setAlternando(null);
    }
  }

  const actual = seleccion && seleccion !== "nuevo" ? catalogos.find((c) => c.id === seleccion) ?? null : null;

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const notaAsesor = !esDueno ? (
    <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Solo la cuenta de la empresa puede editar los catálogos.
    </p>
  ) : null;

  const volver = (
    <button type="button" onClick={() => setSeleccion(null)} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> Todos los catálogos
    </button>
  );

  if (seleccion === "nuevo" && esDueno) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {volver}
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-6">
          <h1 className="mb-1 text-lg font-semibold">Nuevo catálogo</h1>
          <p className="mb-4 text-sm text-muted-foreground">Primero el nombre y quién lo ve; después le agregas productos.</p>
          <FormCatalogo
            catalogo={null}
            esDueno
            onGuardado={(c) => { fusionar(c); setSeleccion(c.id); setPestana("productos"); }}
            onBorrado={() => setSeleccion(null)}
            onCancelar={() => setSeleccion(null)}
          />
        </div>
      </div>
    );
  }

  if (actual) {
    const pestanas: { clave: Pestana; etiqueta: string }[] = [
      { clave: "productos", etiqueta: `Productos (${actual.productos.length})` },
      { clave: "acceso", etiqueta: "Quién lo ve" },
      { clave: "datos", etiqueta: "Datos del catálogo" },
    ];
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        {volver}
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold">{actual.titulo}</h1>
                <EstadoVisible activo={actual.activo} />
              </div>
              {actual.descripcion ? <p className="mt-1 text-sm text-muted-foreground">{actual.descripcion}</p> : null}
              <p className="mt-2 text-xs text-muted-foreground">Lo ven: {actual.criterio_texto}</p>
            </div>
            {esDueno ? (
              <Interruptor
                activo={actual.activo}
                cargando={alternando === actual.id}
                etiqueta={actual.activo ? "Ocultar catálogo" : "Activar catálogo"}
                onCambio={() => alternarActivo(actual)}
              />
            ) : null}
          </div>
          <div className="mt-2"><AvisoAlcance catalogo={actual} /></div>
        </div>

        {notaAsesor}

        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-white p-1">
          {pestanas.map((p) => (
            <button
              key={p.clave}
              type="button"
              onClick={() => setPestana(p.clave)}
              className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                pestana === p.clave ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>

        {pestana === "productos" ? (
          <SeccionProductos
            catalogo={actual}
            esDueno={esDueno}
            onCambio={(productos) => parchear(actual.id, { productos, total_productos: contarActivos(productos) })}
          />
        ) : pestana === "acceso" ? (
          <SeccionAcceso catalogo={actual} esDueno={esDueno} onConteo={(n) => parchear(actual.id, { accesos_manuales: n })} />
        ) : (
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-6">
            <FormCatalogo
              key={`${actual.id}-${actual.fecha_actualizacion}`}
              catalogo={actual}
              esDueno={esDueno}
              onGuardado={fusionar}
              onBorrado={(id) => { setCatalogos((previos) => previos.filter((c) => c.id !== id)); setSeleccion(null); }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <BookOpen className="h-5 w-5 text-primary" /> Catálogos selectos
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Muestra a tus clientes lo que puedes importarles. Para ellos son gratis y tú decides quién ve cada catálogo.
            No llevan precios: el precio va en tu propuesta cuando te piden cotización.
          </p>
        </div>
        {esDueno ? (
          <button type="button" onClick={() => setSeleccion("nuevo")} className={`${CLASE_BOTON_PRIMARIO} shrink-0`}>
            <Plus className="h-4 w-4" /> Nuevo catálogo
          </button>
        ) : null}
      </div>

      {notaAsesor}

      {catalogos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-[#0f0f0f]">
            <BookOpen className="h-5 w-5" />
          </span>
          <p className="text-sm font-semibold">Aún no tienes catálogos</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Arma un catálogo con los productos que más importas y ábreselo a tus mejores clientes: lo verán en Zarpi y te pedirán propuesta con un clic.
          </p>
          {esDueno ? (
            <button type="button" onClick={() => setSeleccion("nuevo")} className={`${CLASE_BOTON_PRIMARIO} mt-4`}>
              <Plus className="h-4 w-4" /> Crear mi primer catálogo
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {catalogos.map((c) => {
            const Icono = ICONO_CRITERIO[c.criterio] ?? Users;
            const portadas = ordenarProductos(c.productos).filter((p) => p.fotos[0]).slice(0, 4);
            return (
              <article
                key={c.id}
                className={`flex flex-col rounded-xl border border-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${c.activo ? "" : "opacity-80"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold">{c.titulo}</h2>
                      {!esDueno || !c.activo ? <EstadoVisible activo={c.activo} /> : null}
                    </div>
                    {c.descripcion ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.descripcion}</p> : null}
                  </div>
                  {esDueno ? (
                    <Interruptor
                      activo={c.activo}
                      cargando={alternando === c.id}
                      etiqueta={c.activo ? "Ocultar catálogo" : "Activar catálogo"}
                      onCambio={() => alternarActivo(c)}
                    />
                  ) : null}
                </div>

                <p className="mt-3 inline-flex items-center gap-1.5 self-start rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary dark:bg-primary/25 dark:text-violet-200">
                  <Icono className="h-3.5 w-3.5" /> {c.criterio_texto}
                </p>

                {portadas.length > 0 ? (
                  <div className="mt-3 flex gap-2">
                    {portadas.map((p) => (
                      <ImagenArchivo key={p.id} src={p.fotos[0]} alt={p.nombre} className="h-12 w-12 rounded-lg border border-border" />
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {c.total_productos} {c.total_productos === 1 ? "producto visible" : "productos visibles"}</span>
                  <span className="inline-flex items-center gap-1"><UserCheck className="h-3.5 w-3.5" /> {c.accesos_manuales ?? 0} con acceso manual</span>
                </div>
                <div className="mt-2"><AvisoAlcance catalogo={c} /></div>

                <div className="mt-auto flex gap-2 pt-4">
                  <button type="button" onClick={() => { setSeleccion(c.id); setPestana("productos"); }} className={`${CLASE_BOTON_SECUNDARIO} flex-1`}>
                    <Package className="h-4 w-4" /> {esDueno ? "Productos" : "Ver productos"}
                  </button>
                  <button type="button" onClick={() => { setSeleccion(c.id); setPestana("acceso"); }} className={`${CLASE_BOTON_SECUNDARIO} flex-1`}>
                    <Users className="h-4 w-4" /> Quién lo ve
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
