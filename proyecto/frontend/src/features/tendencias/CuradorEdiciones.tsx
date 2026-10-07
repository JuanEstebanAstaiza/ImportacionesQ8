import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, CalendarClock, Check, Eye, Lock, Plus, Rocket, Save, Search, Star,
  Trash2, Undo2, X,
} from "lucide-react";
import { toast } from "sonner";

import { ImagenArchivo } from "@/app/components/files/ImagenArchivo";
import { PortadaEdicion } from "@/features/tendencias/PortadaEdicion";
import {
  PIE_INFORMATIVO, PRESETS, tendenciasService,
  type EdicionCurador, type EdicionDatos, type EdicionListado, type PresetEstilo, type ProductoCurador,
  type ProductoTendencia,
} from "@/services/tendencias.service";

import {
  Aviso, BTN, BTN_ICONO, BTN_PELIGRO, BTN_SEC, BotonConfirmar, CARD, Campo, Cargando, EstadoEdicionBadge,
  EstadoProductoChip, INPUT, MAX_PRODUCTOS_EDICION, Vacio, formatoBogota, formatoFecha, mensajeError,
} from "./CuradorComun";

function proximoLunes(): string {
  const d = new Date();
  const dias = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function portadaDe(e: EdicionCurador): EdicionDatos {
  return {
    semana_inicio: e.semana_inicio,
    titulo_linea1: e.titulo_linea1,
    titulo_linea2: e.titulo_linea2,
    subtitulo: e.subtitulo,
    preset_estilo: e.preset_estilo,
  };
}

/** Valor del datetime-local: hora de Bogotá, por defecto el lunes a las 7:00. */
function valorProgramacion(e: EdicionCurador): string {
  return e.publicar_en_bogota ? e.publicar_en_bogota.slice(0, 16) : `${e.semana_inicio}T07:00`;
}

function ordenarProductos(lista: ProductoTendencia[]): ProductoTendencia[] {
  return [...lista].sort((a, b) => a.orden - b.orden);
}

// ── Selector de preset ───────────────────────────────────────────────────────

function SelectorPreset({ valor, onChange, disabled }: {
  valor: PresetEstilo; onChange: (p: PresetEstilo) => void; disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Estilo de portada">
      {(Object.keys(PRESETS) as PresetEstilo[]).map((clave) => {
        const p = PRESETS[clave];
        const activo = valor === clave;
        return (
          <button
            key={clave}
            type="button"
            role="radio"
            aria-checked={activo}
            disabled={disabled}
            onClick={() => onChange(clave)}
            className={`flex flex-col gap-1.5 rounded-lg border p-2 text-left text-xs transition disabled:opacity-60 ${
              activo ? "border-primary ring-2 ring-primary/30 dark:border-accent dark:ring-accent/30" : "border-border hover:border-primary/40"
            }`}
          >
            <span className="relative flex h-10 w-full overflow-hidden rounded-md" style={{ background: p.fondo }}>
              {p.manchas.map((m, i) => (
                <span
                  key={i}
                  className="absolute h-6 w-6 rounded-full blur-[6px]"
                  style={{ background: m, left: `${10 + i * 28}%`, top: i === 1 ? "45%" : "5%" }}
                />
              ))}
              <span className="relative ml-auto mr-1.5 self-center text-[10px] font-bold" style={{ color: p.acento }}>Aa</span>
            </span>
            <span className="flex items-center justify-between font-medium">
              {p.nombre}
              {activo && <Check className="h-3.5 w-3.5 text-primary dark:text-accent" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CamposPortada({ datos, onChange, disabled }: {
  datos: EdicionDatos; onChange: (d: EdicionDatos) => void; disabled?: boolean;
}) {
  const set = <K extends keyof EdicionDatos>(k: K, v: EdicionDatos[K]) => onChange({ ...datos, [k]: v });
  return (
    <div className="space-y-3">
      <Campo label="Semana" hint="Se ajusta al lunes de esa semana.">
        <input type="date" className={INPUT} value={datos.semana_inicio} disabled={disabled}
          onChange={(e) => set("semana_inicio", e.target.value)} />
      </Campo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Título, línea 1" contador={{ actual: datos.titulo_linea1.length, max: 40 }}>
          <input className={INPUT} maxLength={40} value={datos.titulo_linea1} disabled={disabled}
            onChange={(e) => set("titulo_linea1", e.target.value)} placeholder="Lo que se pide" />
        </Campo>
        <Campo label="Título, línea 2 (acento)" contador={{ actual: datos.titulo_linea2.length, max: 40 }}>
          <input className={INPUT} maxLength={40} value={datos.titulo_linea2} disabled={disabled}
            onChange={(e) => set("titulo_linea2", e.target.value)} placeholder="esta temporada" />
        </Campo>
      </div>
      <Campo label="Subtítulo" contador={{ actual: datos.subtitulo.length, max: 140 }}>
        <input className={INPUT} maxLength={140} value={datos.subtitulo} disabled={disabled}
          onChange={(e) => set("subtitulo", e.target.value)} />
      </Campo>
      <div>
        <p className="mb-1 text-sm font-medium">Estilo</p>
        <SelectorPreset valor={datos.preset_estilo} onChange={(p) => set("preset_estilo", p)} disabled={disabled} />
      </div>
    </div>
  );
}

function portadaValida(d: EdicionDatos): string | null {
  if (!d.semana_inicio) return "Elige la semana.";
  if (!d.titulo_linea1.trim() || !d.titulo_linea2.trim()) return "Las dos líneas del título son obligatorias.";
  if (!d.subtitulo.trim()) return "El subtítulo es obligatorio.";
  return null;
}

// ── Lista y creación ─────────────────────────────────────────────────────────

function NuevaEdicion({ onCreada, onCancelar }: { onCreada: (e: EdicionCurador) => void; onCancelar: () => void }) {
  const [datos, setDatos] = useState<EdicionDatos>({
    semana_inicio: proximoLunes(), titulo_linea1: "", titulo_linea2: "", subtitulo: "", preset_estilo: "lavanda",
  });
  const [guardando, setGuardando] = useState(false);

  async function crear() {
    const error = portadaValida(datos);
    if (error) { toast.error(error); return; }
    setGuardando(true);
    try {
      const creada = await tendenciasService.crearEdicion({
        ...datos,
        titulo_linea1: datos.titulo_linea1.trim(),
        titulo_linea2: datos.titulo_linea2.trim(),
        subtitulo: datos.subtitulo.trim(),
      });
      toast.success(`Edición N.º ${creada.numero} creada`);
      onCreada(creada);
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className={CARD}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Nueva edición</h2>
        <button type="button" onClick={onCancelar} className={BTN_ICONO} aria-label="Cerrar"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <CamposPortada datos={datos} onChange={setDatos} disabled={guardando} />
        <div className="space-y-3">
          <PortadaEdicion preset={datos.preset_estilo} semanaInicio={datos.semana_inicio}
            tituloLinea1={datos.titulo_linea1 || "Título línea 1"} tituloLinea2={datos.titulo_linea2 || "línea 2"}
            subtitulo={datos.subtitulo || "Subtítulo de la edición"} compacta />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancelar} className={BTN_SEC}>Cancelar</button>
            <button type="button" onClick={() => void crear()} disabled={guardando} className={BTN}>
              <Plus className="h-4 w-4" />Crear edición
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ListaEdiciones({ onAbrir }: { onAbrir: (id: string, inicial?: EdicionCurador) => void }) {
  const [ediciones, setEdiciones] = useState<EdicionListado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    let vigente = true;
    tendenciasService.listarEdiciones()
      .then((lista) => { if (vigente) setEdiciones(lista); })
      .catch((err) => toast.error(mensajeError(err, "No se pudieron cargar las ediciones.")))
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, []);

  return (
    <div className="space-y-4">
      {creando && <NuevaEdicion onCancelar={() => setCreando(false)} onCreada={(e) => onAbrir(e.id, e)} />}
      <section className={CARD}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Ediciones</h2>
            <p className="text-sm text-muted-foreground">Una edición por semana, máximo {MAX_PRODUCTOS_EDICION} productos y un destacado.</p>
          </div>
          {!creando && (
            <button type="button" onClick={() => setCreando(true)} className={BTN}>
              <Plus className="h-4 w-4" />Nueva edición
            </button>
          )}
        </div>
        {cargando ? <Cargando /> : ediciones.length === 0 ? (
          <Vacio>Todavía no hay ediciones. Crea la primera.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">N.º</th>
                  <th className="px-3 py-2">Portada</th>
                  <th className="px-3 py-2">Semana</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2 text-center">Productos</th>
                  <th className="px-3 py-2">Publicación (Bogotá)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ediciones.map((e) => (
                  <tr key={e.id} onClick={() => onAbrir(e.id)} className="cursor-pointer hover:bg-muted/40">
                    <td className="px-3 py-2.5 font-semibold">{e.numero}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-6 flex-shrink-0 rounded-md border border-border" style={{ background: PRESETS[e.preset_estilo]?.fondo }} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{e.titulo_linea1} <span className="text-muted-foreground">{e.titulo_linea2}</span></p>
                          <p className="truncate text-xs text-muted-foreground">{e.subtitulo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{formatoFecha(e.semana_inicio)}</td>
                    <td className="px-3 py-2.5"><EstadoEdicionBadge estado={e.estado} /></td>
                    <td className="px-3 py-2.5 text-center">{e.total_productos}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                      {formatoBogota(e.estado === "publicada" || e.estado === "archivada" ? e.publicada_en ?? e.publicar_en : e.publicar_en)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Selector de productos del catálogo ───────────────────────────────────────

function SelectorProductos({ excluir, cupo, onAgregar, onCerrar }: {
  excluir: string[]; cupo: number; onAgregar: (p: ProductoCurador) => void; onCerrar: () => void;
}) {
  const [productos, setProductos] = useState<ProductoCurador[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    let vigente = true;
    tendenciasService.listarProductos()
      .then((lista) => { if (vigente) setProductos(lista); })
      .catch((err) => toast.error(mensajeError(err, "No se pudieron cargar los productos.")))
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, []);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter((p) => !excluir.includes(p.id)
      && (!q || p.nombre.toLowerCase().includes(q) || p.categoria_visible.toLowerCase().includes(q)));
  }, [productos, excluir, busqueda]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-label="Agregar producto"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-xl border border-border bg-card shadow-xl sm:rounded-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h3 className="text-base font-semibold">Agregar producto</h3>
            <p className="text-xs text-muted-foreground">Quedan {cupo} cupo{cupo === 1 ? "" : "s"} en esta edición.</p>
          </div>
          <button type="button" onClick={onCerrar} className={BTN_ICONO} aria-label="Cerrar"><X className="h-4 w-4" /></button>
        </div>
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input autoFocus value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o categoría..."
              className={`${INPUT} pl-9`} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {cargando ? <Cargando /> : visibles.length === 0 ? (
            <Vacio>{productos.length ? "Ningún producto coincide." : "No hay productos. Créalos en la pestaña Productos."}</Vacio>
          ) : visibles.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={cupo <= 0}
              onClick={() => onAgregar(p)}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted disabled:opacity-50"
            >
              {p.fotos[0]
                ? <ImagenArchivo src={p.fotos[0]} alt={p.nombre} className="h-12 w-12 flex-shrink-0 rounded-md" />
                : <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">Sin foto</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{p.nombre}</span>
                <span className="block truncate text-xs text-muted-foreground">{p.categoria_visible}{p.temporada ? ` · ${p.temporada.nombre}` : ""}</span>
              </span>
              <EstadoProductoChip estado={p.fechas.estado} texto={p.fechas.estado_texto} />
            </button>
          ))}
        </div>
        <div className="flex justify-end border-t border-border p-3">
          <button type="button" onClick={onCerrar} className={BTN}>Listo</button>
        </div>
      </div>
    </div>
  );
}

// ── Vista previa móvil ───────────────────────────────────────────────────────

function VistaPreviaMovil({ portada, numero, productos }: {
  portada: EdicionDatos; numero: number; productos: ProductoTendencia[];
}) {
  const visibles = productos.filter((p) => p.fechas.estado !== "fuera_de_tiempo");
  const ocultos = productos.length - visibles.length;
  const destacado = visibles.find((p) => p.destacado);
  const resto = visibles.filter((p) => p !== destacado);

  const tarjeta = (p: ProductoTendencia, grande: boolean) => (
    <div key={p.id} className="overflow-hidden rounded-xl bg-[#1d1c22]">
      {p.fotos[0]
        ? <ImagenArchivo src={p.fotos[0]} alt={p.nombre} className={`w-full ${grande ? "aspect-[4/3]" : "aspect-square"}`} />
        : <div className={`flex w-full items-center justify-center bg-[#2a2930] text-[10px] text-white/50 ${grande ? "aspect-[4/3]" : "aspect-square"}`}>Sin foto</div>}
      <div className="space-y-1 p-2.5">
        {grande && <span className="inline-block rounded-full bg-[#EDF953] px-2 py-0.5 text-[10px] font-semibold text-[#16151B]">Destacado</span>}
        <p className="text-[10px] uppercase tracking-wide text-white/60">{p.categoria_visible}</p>
        <p className={`font-semibold leading-tight text-white ${grande ? "text-base" : "text-xs"}`}>{p.nombre}</p>
        {grande && <p className="text-xs leading-snug text-white/70">{p.por_que_ahora}</p>}
        <EstadoProductoChip estado={p.fechas.estado} texto={p.fechas.estado_texto} />
        {p.revisar_requisitos && <p className="text-[10px] text-amber-300">Revisar requisitos</p>}
        {(p.video_vertical || p.video_horizontal) && (
          // La vista previa es la de celular: avisa qué versión del video verá.
          <p className="text-[10px] text-white/60">
            ▶ {p.video_vertical ? "Video vertical" : "Video horizontal (no hay versión vertical)"}
            {grande ? " · se reproduce en la tarjeta" : ""}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[2rem] border-[6px] border-slate-900 bg-[#111113] shadow-lg dark:border-slate-600">
      <div className="max-h-[720px] overflow-y-auto">
        <div className="p-3">
          <PortadaEdicion preset={portada.preset_estilo} numero={numero} semanaInicio={portada.semana_inicio}
            tituloLinea1={portada.titulo_linea1 || "Título línea 1"} tituloLinea2={portada.titulo_linea2 || "línea 2"}
            subtitulo={portada.subtitulo || "Subtítulo"} compacta />
        </div>
        <div className="space-y-3 px-3 pb-4">
          {visibles.length === 0 && <p className="py-6 text-center text-xs text-white/60">Sin productos visibles.</p>}
          {destacado && tarjeta(destacado, true)}
          {resto.length > 0 && <div className="grid grid-cols-2 gap-2">{resto.map((p) => tarjeta(p, false))}</div>}
          {ocultos > 0 && (
            <p className="text-center text-[11px] text-amber-300">
              {ocultos} producto{ocultos === 1 ? "" : "s"} fuera de tiempo no se muestra{ocultos === 1 ? "" : "n"} al comprador.
            </p>
          )}
          <p className="pt-2 text-[10px] leading-snug text-white/50">{PIE_INFORMATIVO}</p>
        </div>
      </div>
    </div>
  );
}

// ── Editor de una edición ────────────────────────────────────────────────────

function EditorEdicion({ id, inicial, esAdmin, onVolver }: {
  id: string; inicial?: EdicionCurador; esAdmin: boolean; onVolver: () => void;
}) {
  const [edicion, setEdicion] = useState<EdicionCurador | null>(inicial ?? null);
  const [portada, setPortada] = useState<EdicionDatos | null>(inicial ? portadaDe(inicial) : null);
  const [items, setItems] = useState<ProductoTendencia[]>(inicial ? ordenarProductos(inicial.productos) : []);
  const [productosSucios, setProductosSucios] = useState(false);
  const [publicarEn, setPublicarEn] = useState(inicial ? valorProgramacion(inicial) : "");
  const [ocupado, setOcupado] = useState<null | "portada" | "productos" | "programar">(null);
  const [selector, setSelector] = useState(false);
  const [verPrevia, setVerPrevia] = useState(true);

  useEffect(() => {
    if (inicial) return;
    let vigente = true;
    tendenciasService.getEdicionCurador(id)
      .then((e) => {
        if (!vigente) return;
        setEdicion(e);
        setPortada(portadaDe(e));
        setItems(ordenarProductos(e.productos));
        setPublicarEn(valorProgramacion(e));
      })
      .catch((err) => { toast.error(mensajeError(err, "No se pudo abrir la edición.")); onVolver(); });
    return () => { vigente = false; };
  }, [id]);

  if (!edicion || !portada) return <Cargando texto="Abriendo edición..." />;

  const soloLectura = edicion.estado === "archivada";
  const original = portadaDe(edicion);
  const portadaSucia = (Object.keys(original) as (keyof EdicionDatos)[]).some((k) => original[k] !== portada[k]);
  const hayCambios = portadaSucia || productosSucios;

  function aplicarProductos(e: EdicionCurador) {
    setEdicion(e);
    setItems(ordenarProductos(e.productos));
    setProductosSucios(false);
  }

  async function guardarPortada() {
    const error = portadaValida(portada);
    if (error) { toast.error(error); return; }
    const cambios: Partial<EdicionDatos> = {};
    (Object.keys(original) as (keyof EdicionDatos)[]).forEach((k) => {
      if (original[k] !== portada[k]) (cambios as Record<string, string>)[k] = String(portada[k]).trim();
    });
    setOcupado("portada");
    try {
      const e = await tendenciasService.editarEdicion(id, cambios);
      setEdicion(e);
      setPortada(portadaDe(e));
      toast.success("Portada guardada");
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setOcupado(null);
    }
  }

  async function guardarProductos() {
    setOcupado("productos");
    try {
      const e = await tendenciasService.ponerProductos(id, items.map((p) => ({ producto_id: p.id, destacado: !!p.destacado })));
      aplicarProductos(e);
      toast.success("Productos guardados");
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setOcupado(null);
    }
  }

  async function accion(fn: () => Promise<EdicionCurador>, exito: string) {
    setOcupado("programar");
    try {
      const e = await fn();
      setEdicion(e);
      setPortada(portadaDe(e));
      setItems(ordenarProductos(e.productos));
      setProductosSucios(false);
      setPublicarEn(valorProgramacion(e));
      toast.success(exito);
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setOcupado(null);
    }
  }

  async function borrar() {
    try {
      await tendenciasService.borrarEdicion(id);
      toast.success("Edición borrada");
      onVolver();
    } catch (err) {
      toast.error(mensajeError(err));
    }
  }

  function mover(indice: number, delta: number) {
    const destino = indice + delta;
    if (destino < 0 || destino >= items.length) return;
    const copia = [...items];
    [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
    setItems(copia);
    setProductosSucios(true);
  }

  function elegirDestacado(productoId: string) {
    setItems(items.map((p) => ({ ...p, destacado: p.id === productoId })));
    setProductosSucios(true);
  }

  function quitar(productoId: string) {
    setItems(items.filter((p) => p.id !== productoId));
    setProductosSucios(true);
  }

  function agregar(p: ProductoCurador) {
    if (items.length >= MAX_PRODUCTOS_EDICION) {
      toast.error(`Máximo ${MAX_PRODUCTOS_EDICION} productos por edición.`);
      return;
    }
    const sinDestacado = !items.some((i) => i.destacado);
    setItems([...items, { ...p, destacado: sinDestacado, orden: items.length }]);
    setProductosSucios(true);
  }

  const destacados = items.filter((p) => p.destacado).length;
  const puedeProgramar = !soloLectura && !hayCambios && edicion.problemas.length === 0 && !ocupado;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onVolver} className={BTN_ICONO} aria-label="Volver a ediciones"><ArrowLeft className="h-4 w-4" /></button>
          <div>
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
              Edición N.º {edicion.numero} <EstadoEdicionBadge estado={edicion.estado} />
            </h2>
            <p className="text-xs text-muted-foreground">
              Semana del {formatoFecha(edicion.semana_inicio)} · estados evaluados al {formatoFecha(edicion.fecha_referencia)}
            </p>
          </div>
        </div>
        <button type="button" onClick={() => setVerPrevia((v) => !v)} className={BTN_SEC}>
          <Eye className="h-4 w-4" />{verPrevia ? "Ocultar vista previa" : "Vista previa móvil"}
        </button>
      </div>

      {soloLectura && (
        <Aviso tono="info"><span className="inline-flex items-center gap-2"><Lock className="h-4 w-4" />Edición archivada: solo lectura.</span></Aviso>
      )}
      {edicion.estado === "publicada" && (
        <Aviso tono="alerta">Esta edición está publicada. Cada cambio queda en la bitácora y lo ve el administrador.</Aviso>
      )}
      {edicion.problemas.length > 0 && !soloLectura && (
        <Aviso tono="error">
          <p className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Falta para poder programarla</p>
          <ul className="list-disc space-y-0.5 pl-6">{edicion.problemas.map((p) => <li key={p}>{p}</li>)}</ul>
        </Aviso>
      )}
      {edicion.fuera_de_tiempo.length > 0 && (
        <Aviso tono="alerta">
          <p className="font-semibold">No llegan a tiempo ni por aéreo en la fecha de publicación:</p>
          <p>{edicion.fuera_de_tiempo.join(", ")}. El comprador no los verá.</p>
        </Aviso>
      )}

      <div className={`grid gap-4 ${verPrevia ? "xl:grid-cols-[minmax(0,1fr)_400px]" : ""}`}>
        <div className="min-w-0 space-y-4">
          {/* Portada */}
          <section className={CARD}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold">Portada</h3>
              {!soloLectura && (
                <button type="button" onClick={() => void guardarPortada()} disabled={!portadaSucia || !!ocupado} className={BTN}>
                  <Save className="h-4 w-4" />Guardar portada
                </button>
              )}
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
              <CamposPortada datos={portada} onChange={setPortada} disabled={soloLectura || !!ocupado} />
              <PortadaEdicion preset={portada.preset_estilo} numero={edicion.numero} semanaInicio={portada.semana_inicio}
                tituloLinea1={portada.titulo_linea1 || "Título línea 1"} tituloLinea2={portada.titulo_linea2 || "línea 2"}
                subtitulo={portada.subtitulo || "Subtítulo"} compacta />
            </div>
          </section>

          {/* Productos */}
          <section className={CARD}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold">Productos ({items.length}/{MAX_PRODUCTOS_EDICION})</h3>
                <p className="text-xs text-muted-foreground">En este orden los ve el comprador. Elige un solo destacado.</p>
              </div>
              {!soloLectura && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setSelector(true)} disabled={items.length >= MAX_PRODUCTOS_EDICION || !!ocupado} className={BTN_SEC}>
                    <Plus className="h-4 w-4" />Agregar producto
                  </button>
                  <button type="button" onClick={() => void guardarProductos()} disabled={!productosSucios || !!ocupado} className={BTN}>
                    <Save className="h-4 w-4" />Guardar productos
                  </button>
                </div>
              )}
            </div>
            {productosSucios && (
              <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">
                Cambios sin guardar. Los estados de los productos nuevos se recalculan contra la fecha de publicación al guardar.
              </p>
            )}
            {items.length > 0 && destacados !== 1 && (
              <p className="mb-2 text-xs text-destructive">Marca exactamente un producto como destacado.</p>
            )}
            {items.length === 0 ? <Vacio>La edición no tiene productos.</Vacio> : (
              <ol className="divide-y divide-border rounded-lg border border-border">
                {items.map((p, i) => {
                  const fuera = p.fechas.estado === "fuera_de_tiempo";
                  return (
                    <li key={p.id} className={`flex flex-wrap items-center gap-3 p-2.5 sm:flex-nowrap ${fuera ? "bg-destructive/5" : ""}`}>
                      <span className="w-5 text-center text-xs font-semibold text-muted-foreground">{i + 1}</span>
                      {p.fotos[0]
                        ? <ImagenArchivo src={p.fotos[0]} alt={p.nombre} className="h-12 w-12 flex-shrink-0 rounded-md" />
                        : <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-destructive/10 text-[10px] text-destructive">Sin foto</span>}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.nombre}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.categoria_visible}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <EstadoProductoChip estado={p.fechas.estado} texto={p.fechas.estado_texto} />
                          {fuera && <span className="text-[11px] text-destructive">No llega a tiempo ni por aéreo</span>}
                        </div>
                      </div>
                      <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs ${p.destacado ? "bg-primary/10 font-semibold text-primary dark:bg-accent/15 dark:text-accent" : "text-muted-foreground"}`}>
                        <input type="radio" name={`destacado-${id}`} checked={!!p.destacado} disabled={soloLectura}
                          onChange={() => elegirDestacado(p.id)} className="accent-primary" />
                        <Star className="h-3.5 w-3.5" />Destacado
                      </label>
                      {!soloLectura && (
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className={BTN_ICONO} aria-label="Subir"><ArrowUp className="h-4 w-4" /></button>
                          <button type="button" onClick={() => mover(i, 1)} disabled={i === items.length - 1} className={BTN_ICONO} aria-label="Bajar"><ArrowDown className="h-4 w-4" /></button>
                          <button type="button" onClick={() => quitar(p.id)} className={`${BTN_ICONO} hover:text-destructive`} aria-label="Quitar de la edición"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* Publicación */}
          <section className={CARD}>
            <h3 className="mb-1 flex items-center gap-2 text-base font-semibold"><CalendarClock className="h-4 w-4" />Publicación</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              {edicion.estado === "programada" && <>Programada para el <strong>{formatoBogota(edicion.publicar_en)}</strong> (hora de Bogotá).</>}
              {edicion.estado === "publicada" && <>Publicada el <strong>{formatoBogota(edicion.publicada_en ?? edicion.publicar_en)}</strong>.</>}
              {edicion.estado === "archivada" && <>Archivada. Se publicó el {formatoBogota(edicion.publicada_en ?? edicion.publicar_en)}.</>}
              {edicion.estado === "borrador" && <>Al llegar la hora, se publica y la edición anterior pasa al archivo.</>}
            </p>
            {(edicion.estado === "borrador" || edicion.estado === "programada") && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-2">
                  <Campo label="Fecha y hora (Bogotá)" className="w-full sm:w-64">
                    <input type="datetime-local" className={INPUT} value={publicarEn} onChange={(e) => setPublicarEn(e.target.value)} />
                  </Campo>
                  <button type="button" disabled={!puedeProgramar || !publicarEn}
                    onClick={() => void accion(() => tendenciasService.programar(id, publicarEn), "Edición programada")} className={BTN}>
                    <CalendarClock className="h-4 w-4" />{edicion.estado === "programada" ? "Reprogramar" : "Programar"}
                  </button>
                  <BotonConfirmar
                    label={<><Rocket className="h-4 w-4" />Publicar ahora</>}
                    pregunta="Se publica ya y la anterior pasa al archivo."
                    confirmar="Publicar"
                    disabled={!puedeProgramar}
                    onConfirm={() => accion(() => tendenciasService.programar(id, null), "Edición publicada")}
                  />
                  {edicion.estado === "programada" && (
                    <button type="button" disabled={!!ocupado}
                      onClick={() => void accion(() => tendenciasService.desprogramar(id), "Volvió a borrador")} className={BTN_SEC}>
                      <Undo2 className="h-4 w-4" />Desprogramar
                    </button>
                  )}
                </div>
                {hayCambios && <p className="text-xs text-amber-700 dark:text-amber-300">Guarda los cambios antes de programar.</p>}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {edicion.estado === "publicada" && esAdmin && (
                <BotonConfirmar
                  label={<><Undo2 className="h-4 w-4" />Retirar edición</>}
                  pregunta="Deja de verse y pasa al archivo."
                  confirmar="Retirar"
                  peligro
                  className={BTN_PELIGRO}
                  onConfirm={() => accion(() => tendenciasService.retirar(id), "Edición retirada")}
                />
              )}
              {edicion.estado === "borrador" && (
                <BotonConfirmar
                  label={<><Trash2 className="h-4 w-4" />Borrar</>}
                  pregunta="¿Borrar este borrador?"
                  confirmar="Borrar"
                  peligro
                  className={BTN_PELIGRO}
                  onConfirm={borrar}
                />
              )}
            </div>
          </section>
        </div>

        {verPrevia && (
          <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
            <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">Vista previa móvil</p>
            <VistaPreviaMovil portada={portada} numero={edicion.numero} productos={items} />
          </aside>
        )}
      </div>

      {selector && (
        <SelectorProductos
          excluir={items.map((p) => p.id)}
          cupo={MAX_PRODUCTOS_EDICION - items.length}
          onAgregar={agregar}
          onCerrar={() => setSelector(false)}
        />
      )}
    </div>
  );
}

export function CuradorEdiciones({ esAdmin }: { esAdmin: boolean }) {
  const [abierta, setAbierta] = useState<{ id: string; inicial?: EdicionCurador } | null>(null);

  if (abierta) {
    return (
      <EditorEdicion
        key={abierta.id}
        id={abierta.id}
        inicial={abierta.inicial}
        esAdmin={esAdmin}
        onVolver={() => setAbierta(null)}
      />
    );
  }
  return <ListaEdiciones onAbrir={(id, inicial) => setAbierta({ id, inicial })} />;
}
