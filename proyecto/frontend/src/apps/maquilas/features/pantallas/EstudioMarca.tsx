import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, CircleDot, ExternalLink, Loader2, MinusCircle, Palette, PenTool, Plus, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

import { Button, Card, Input, Select, Textarea } from "@shared/ui/design-system";
import { ImagenArchivo } from "@shared/ui/files/ImagenArchivo";
import { maquilasService } from "@/services/maquilas.service";
import { mensajeDeError } from "@apps/maquilas/features/errores";
import { fecha } from "@apps/maquilas/features/formato";
import { useEncargos, useInvalidarMaquilas, useMarca, useMarcas, useParametrosMaquilas } from "@apps/maquilas/features/useMaquilas";
import { ArchivosVista } from "@apps/maquilas/features/componentes/ArchivosVista";
import { Paleta } from "@apps/maquilas/features/componentes/KitMarca";
import { SubirArchivoMaquila } from "@apps/maquilas/features/componentes/SubirArchivoMaquila";
import type { ArchivoMaquila, ColorMarca, EstadoPaso, Marca } from "@apps/maquilas/features/tipos";

type Pestana = "kit" | "ruta" | "disenos";

const ESTADOS_PASO: { valor: EstadoPaso; texto: string }[] = [
  { valor: "pendiente", texto: "Pendiente" },
  { valor: "en_curso", texto: "En curso" },
  { valor: "hecho", texto: "Hecho" },
  { valor: "no_aplica", texto: "No aplica" },
];

const ESTILO_ENCARGO: Record<string, string> = {
  nuevo: "bg-muted text-muted-foreground",
  en_proceso: "bg-sky-500/10 text-sky-800 dark:text-sky-300",
  entregado: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  cambios: "bg-sky-500/10 text-sky-800 dark:text-sky-300",
  aprobado: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  cancelado: "bg-muted text-muted-foreground",
};

export function EstadoEncargoChip({ estado, etiqueta }: { estado: string; etiqueta: string }) {
  return <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", ESTILO_ENCARGO[estado])}>{etiqueta}</span>;
}

// ── Kit de marca (crear y editar) ────────────────────────────────────────────

function FormularioKit({ marca, onGuardada }: { marca: Marca | null; onGuardada: (id: string) => void }) {
  const { data: parametros } = useParametrosMaquilas();
  const invalidar = useInvalidarMaquilas();
  const [nombre, setNombre] = useState(marca?.nombre ?? "");
  const [eslogan, setEslogan] = useState(marca?.eslogan ?? "");
  const [descripcion, setDescripcion] = useState(marca?.descripcion ?? "");
  const [categoria, setCategoria] = useState(marca?.categoria ?? "");
  const [logo, setLogo] = useState<ArchivoMaquila | null>(marca?.logo ?? null);
  const [paleta, setPaleta] = useState<ColorMarca[]>(marca?.paleta ?? []);
  const [tipografias, setTipografias] = useState((marca?.tipografias ?? []).join(", "));
  const [archivos, setArchivos] = useState<ArchivoMaquila[]>(marca?.archivos ?? []);
  const [guardando, setGuardando] = useState(false);
  const maxColores = parametros?.paleta_max ?? 8;

  async function guardar() {
    if (nombre.trim().length < 2) { toast.error("Ponle nombre a tu marca"); return; }
    setGuardando(true);
    const datos = {
      nombre: nombre.trim(), eslogan: eslogan.trim(), descripcion: descripcion.trim(), categoria: categoria || null,
      logo: logo?.id ?? null, paleta, tipografias: tipografias.split(",").map((t) => t.trim()).filter(Boolean), archivos: archivos.map((a) => a.id),
    };
    try {
      const guardada = marca ? await maquilasService.actualizarMarca(marca.id, datos) : await maquilasService.crearMarca(datos);
      await invalidar();
      toast.success(marca ? "Guardamos tu marca" : "Creamos tu marca");
      onGuardada(guardada.id);
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card padding="lg" className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Nombre de la marca" value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} />
        <Input label="Eslogan (opcional)" value={eslogan} maxLength={160} onChange={(e) => setEslogan(e.target.value)} />
        <Select label="Qué vas a vender" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Sin definir</option>
          {(parametros?.categorias ?? []).map((c) => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
        </Select>
        <Input label="Tipografías" value={tipografias} onChange={(e) => setTipografias(e.target.value)} hint="Separadas por coma. Ej.: Montserrat, Inter" />
        <div className="md:col-span-2">
          <Textarea label="Historia y público (opcional)" rows={3} value={descripcion} maxLength={2000} onChange={(e) => setDescripcion(e.target.value)}
            hint="Para quién es, qué la hace distinta. Le sirve al diseñador y a la maquila." />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Logo</p>
        <div className="flex items-center gap-3">
          <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-border bg-muted">
            {logo ? <ImagenArchivo src={logo.url} alt="Logo" className="absolute inset-0 h-full w-full object-contain" />
              : <Palette className="m-auto mt-7 h-6 w-6 text-muted-foreground" aria-hidden="true" />}
          </div>
          <SubirArchivoMaquila tipo="marca" etiqueta={logo ? "Cambiar logo" : "Subir logo (PNG o JPG)"} maxMb={parametros?.mb_max_foto} onSubido={setLogo} />
          {logo && <Button variant="ghost" size="sm" onClick={() => setLogo(null)}>Quitar</Button>}
        </div>
        <p className="text-xs text-muted-foreground">¿No tienes logo? Guarda la marca y pídelo en la pestaña «Diseños».</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Paleta de colores</legend>
        {paleta.map((c, i) => (
          <div key={i} className="flex items-end gap-2">
            <label className="flex flex-col gap-1.5 text-xs">
              <span className="sr-only">Color {i + 1}</span>
              <input type="color" value={c.hex} aria-label={`Color ${i + 1}`}
                onChange={(e) => setPaleta(paleta.map((x, j) => (j === i ? { ...x, hex: e.target.value.toUpperCase() } : x)))}
                className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-background" />
            </label>
            <div className="w-32">
              <Input aria-label="Código" value={c.hex} maxLength={7}
                onChange={(e) => setPaleta(paleta.map((x, j) => (j === i ? { ...x, hex: e.target.value.toUpperCase() } : x)))} />
            </div>
            <div className="flex-1">
              <Input aria-label="Nombre del color" placeholder="Nombre (opcional)" value={c.nombre} maxLength={40}
                onChange={(e) => setPaleta(paleta.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} />
            </div>
            <button type="button" aria-label="Quitar color" className="mb-2 text-muted-foreground hover:text-destructive"
              onClick={() => setPaleta(paleta.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {paleta.length < maxColores && (
          <Button variant="ghost" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setPaleta([...paleta, { nombre: "", hex: "#7C3AED" }])}>Agregar color</Button>
        )}
      </fieldset>

      <div className="space-y-2">
        <p className="text-sm font-medium">Archivos de la marca</p>
        <SubirArchivoMaquila tipo="marca_archivo" etiqueta="Subir etiquetas, empaques o manual (PDF o imagen)" multiple
          maxArchivos={(parametros?.archivos_marca_max ?? 20) - archivos.length} maxMb={parametros?.mb_max_documento}
          onSubido={(a) => setArchivos((x) => [...x, a])} />
        <ArchivosVista archivos={archivos} tamano="sm" onQuitar={(id) => setArchivos((x) => x.filter((a) => a.id !== id))} />
      </div>

      <div className="flex justify-end"><Button loading={guardando} onClick={() => void guardar()}>{marca ? "Guardar cambios" : "Crear marca"}</Button></div>
    </Card>
  );
}

// ── Ruta legal ───────────────────────────────────────────────────────────────

function IconoPaso({ estado }: { estado: EstadoPaso }) {
  if (estado === "hecho") return <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />;
  if (estado === "en_curso") return <CircleDot className="h-5 w-5 text-primary dark:text-accent" aria-hidden="true" />;
  if (estado === "no_aplica") return <MinusCircle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />;
  return <Circle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />;
}

function RutaLegal({ marca }: { marca: Marca }) {
  const invalidar = useInvalidarMaquilas();
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function marcar(clave: string, estado: EstadoPaso, nota: string) {
    setOcupado(clave);
    try {
      await maquilasService.marcarPaso(marca.id, clave, estado, nota);
      await invalidar();
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Card padding="lg" className="space-y-4">
      <div>
        <h3 className="font-semibold">Ruta legal para vender con tu marca</h3>
        <p className="text-sm text-muted-foreground">
          Los pasos que aplican a {marca.categoria_nombre ? marca.categoria_nombre.toLowerCase() : "tu marca (elige qué vendes en el kit para ver los de tu categoría)"}.
          Es una guía: los trámites los haces directamente en cada entidad.
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${marca.ruta_avance.hechos} de ${marca.ruta_avance.total} pasos resueltos`}>
          <div className="h-full bg-emerald-500" style={{ width: `${(marca.ruta_avance.hechos / Math.max(marca.ruta_avance.total, 1)) * 100}%` }} />
        </div>
      </div>
      <ol className="space-y-3">
        {marca.ruta_legal.map((p) => (
          <li key={p.clave} className="flex gap-3 rounded-xl border border-border p-3">
            <IconoPaso estado={p.estado} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{p.nombre}</p>
                  <p className="text-sm text-muted-foreground">{p.descripcion}</p>
                  {p.enlace && (
                    <a href={p.enlace} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline dark:text-accent">
                      Ir al sitio oficial <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
                <select aria-label={`Estado de ${p.nombre}`} value={p.estado} disabled={ocupado === p.clave}
                  onChange={(e) => void marcar(p.clave, e.target.value as EstadoPaso, notas[p.clave] ?? p.nota)}
                  className="rounded-lg border border-border bg-background px-2 py-1 text-sm">
                  {ESTADOS_PASO.map((x) => <option key={x.valor} value={x.valor}>{x.texto}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <input aria-label={`Nota de ${p.nombre}`} placeholder="Nota (número de radicado, fecha…)" maxLength={500}
                  value={notas[p.clave] ?? p.nota} onChange={(e) => setNotas({ ...notas, [p.clave]: e.target.value })}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                {notas[p.clave] !== undefined && notas[p.clave] !== p.nota && (
                  <Button size="sm" variant="secondary" loading={ocupado === p.clave} onClick={() => void marcar(p.clave, p.estado, notas[p.clave])}>Guardar nota</Button>
                )}
              </div>
              {p.actualizado_en && <p className="text-xs text-muted-foreground">Actualizado el {fecha(p.actualizado_en)}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

// ── Diseños (encargos) ───────────────────────────────────────────────────────

function Disenos({ marca, onAbrirEncargo }: { marca: Marca; onAbrirEncargo: (id: string) => void }) {
  const { data: parametros } = useParametrosMaquilas();
  const { data: encargos, isLoading } = useEncargos(marca.id);
  const invalidar = useInvalidarMaquilas();
  const [tipo, setTipo] = useState("");
  const [brief, setBrief] = useState("");
  const [referencias, setReferencias] = useState<ArchivoMaquila[]>([]);
  const [enviando, setEnviando] = useState(false);
  const tipos = parametros?.tipos_encargo ?? [];
  const elegido = tipos.find((t) => t.clave === tipo);

  async function pedir() {
    setEnviando(true);
    try {
      const encargo = await maquilasService.pedirEncargo(marca.id, tipo, brief.trim(), referencias.map((r) => r.id));
      await invalidar();
      toast.success("Le pasamos tu encargo al equipo de Diseño de Zarpi");
      onAbrirEncargo(encargo.id);
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card padding="lg" className="space-y-4">
        <div className="flex items-start gap-3">
          <PenTool className="mt-0.5 h-5 w-5 text-primary dark:text-accent" aria-hidden="true" />
          <div>
            <h3 className="font-semibold">Pide un diseño al equipo de Zarpi</h3>
            <p className="text-sm text-muted-foreground">Un diseñador toma tu encargo, te envía versiones y lo ajusta hasta que lo apruebes. Lo aprobado queda en tu kit de marca.</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {tipos.map((t) => (
            <button key={t.clave} type="button" aria-pressed={tipo === t.clave} onClick={() => setTipo(t.clave)}
              className={clsx("rounded-xl border p-3 text-left text-sm", tipo === t.clave ? "border-primary bg-primary/5 dark:border-accent dark:bg-accent/10" : "border-border hover:bg-muted/50")}>
              <span className="block font-medium">{t.nombre}</span>
              <span className="text-xs text-muted-foreground">{t.descripcion}</span>
            </button>
          ))}
        </div>
        {elegido && (
          <>
            <Textarea label={`Qué necesitas en tu ${elegido.nombre.toLowerCase()}`} rows={4} value={brief} maxLength={4000} onChange={(e) => setBrief(e.target.value)}
              hint="Estilo, qué debe transmitir, medidas, dónde se va a usar. Mínimo 20 caracteres." />
            <SubirArchivoMaquila tipo="marca_archivo" etiqueta="Subir referencias (opcional)" multiple maxArchivos={10 - referencias.length}
              onSubido={(a) => setReferencias((x) => [...x, a])} />
            <ArchivosVista archivos={referencias} tamano="sm" onQuitar={(id) => setReferencias((x) => x.filter((r) => r.id !== id))} />
            <div className="flex justify-end"><Button loading={enviando} disabled={brief.trim().length < 20} onClick={() => void pedir()}>Pedir diseño</Button></div>
          </>
        )}
      </Card>
      <Card padding="none">
        {isLoading ? <p className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando…</p>
          : !encargos?.length ? <p className="p-5 text-sm text-muted-foreground">Todavía no has pedido diseños para esta marca.</p>
          : (
            <ul className="divide-y divide-border">
              {encargos.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => onAbrirEncargo(e.id)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-muted/50">
                    <span className="min-w-0">
                      <span className={clsx("block truncate", e.pendiente_de_mi ? "font-semibold" : "font-medium")}>
                        {e.pendiente_de_mi && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-primary dark:bg-accent" aria-label="Te toca responder" />}
                        {e.tipo_nombre}
                      </span>
                      <span className="text-xs text-muted-foreground">{e.codigo} · {fecha(e.creado_en)}{e.disenador?.nombre ? ` · ${e.disenador.nombre}` : ""}{e.version_vigente ? ` · versión ${e.version_vigente}` : ""}</span>
                    </span>
                    <EstadoEncargoChip estado={e.estado} etiqueta={e.estado_etiqueta} />
                  </button>
                </li>
              ))}
            </ul>
          )}
      </Card>
    </div>
  );
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

function DetalleMarca({ id, onVolver, onAbrirEncargo }: { id: string; onVolver: () => void; onAbrirEncargo: (id: string) => void }) {
  const { data: marca, isLoading, error } = useMarca(id);
  const [pestana, setPestana] = useState<Pestana>("kit");
  if (isLoading) return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>;
  if (error || !marca) return <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error)}</p></Card>;
  return (
    <div className="space-y-5">
      <button type="button" onClick={onVolver} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Mis marcas</button>
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-border bg-muted">
          {marca.logo ? <ImagenArchivo src={marca.logo.url} alt="Logo" className="absolute inset-0 h-full w-full object-contain" /> : <Palette className="m-auto mt-4 h-6 w-6 text-muted-foreground" aria-hidden="true" />}
        </div>
        <div>
          <h2 className="text-xl font-semibold">{marca.nombre}</h2>
          <p className="text-sm text-muted-foreground">{marca.eslogan || marca.categoria_nombre || "Tu marca"}</p>
        </div>
      </div>
      <div className="flex gap-2 border-b border-border" role="tablist" aria-label="Secciones de la marca">
        {([["kit", "Kit de marca"], ["ruta", `Ruta legal (${marca.ruta_avance.hechos}/${marca.ruta_avance.total})`], ["disenos", "Diseños"]] as const).map(([clave, texto]) => (
          <button key={clave} type="button" role="tab" aria-selected={pestana === clave} onClick={() => setPestana(clave)}
            className={clsx("-mb-px border-b-2 px-3 py-2 text-sm font-medium", pestana === clave ? "border-primary text-primary dark:border-accent dark:text-accent" : "border-transparent text-muted-foreground")}>
            {texto}
          </button>
        ))}
      </div>
      {pestana === "kit" ? <FormularioKit key={marca.actualizado_en ?? marca.id} marca={marca} onGuardada={() => undefined} />
        : pestana === "ruta" ? <RutaLegal marca={marca} />
        : <Disenos marca={marca} onAbrirEncargo={onAbrirEncargo} />}
    </div>
  );
}

/** Estudio de marca del cliente: sus marcas, el kit de cada una, la ruta legal y los diseños. */
export function EstudioMarca({ marcaId, onAbrir, onAbrirEncargo }: {
  marcaId?: string; onAbrir: (id?: string) => void; onAbrirEncargo: (id: string) => void;
}) {
  const { data, isLoading, error } = useMarcas(!marcaId);
  const { data: parametros } = useParametrosMaquilas();
  const [creando, setCreando] = useState(false);
  useEffect(() => { setCreando(false); }, [marcaId]);
  if (marcaId) return <DetalleMarca id={marcaId} onVolver={() => onAbrir(undefined)} onAbrirEncargo={onAbrirEncargo} />;
  if (creando) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setCreando(false)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Mis marcas</button>
        <FormularioKit marca={null} onGuardada={(id) => onAbrir(id)} />
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <Card padding="lg" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Palette className="mt-0.5 h-6 w-6 text-primary dark:text-accent" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Estudio de marca</h2>
            <p className="text-sm text-muted-foreground">Guarda tu logo, colores y archivos, pide diseños al equipo de Zarpi y sigue los trámites para vender con tu marca.</p>
          </div>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} disabled={(data?.length ?? 0) >= (parametros?.marcas_max ?? 10)} onClick={() => setCreando(true)}>Nueva marca</Button>
      </Card>
      {isLoading ? <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>
        : error ? <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error)}</p></Card>
        : !data?.length ? (
          <Card padding="lg" className="text-center">
            <Palette className="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Crea tu primera marca</p>
            <p className="text-sm text-muted-foreground">Aunque solo tengas el nombre: desde aquí pides el logo y sigues la ruta legal.</p>
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => onAbrir(m.id)} className="flex h-full w-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40 dark:hover:border-accent/50">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-border bg-muted">
                      {m.logo ? <ImagenArchivo src={m.logo.url} alt="" className="absolute inset-0 h-full w-full object-contain" /> : <Palette className="m-auto mt-3 h-5 w-5 text-muted-foreground" aria-hidden="true" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{m.nombre}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.eslogan || m.categoria_nombre || "Sin categoría"}</p>
                    </div>
                  </div>
                  <Paleta colores={m.paleta} tamano="sm" />
                  <p className="mt-auto text-xs text-muted-foreground">
                    Ruta legal {m.ruta_avance.hechos}/{m.ruta_avance.total}{m.encargos_abiertos ? ` · ${m.encargos_abiertos} diseño(s) en curso` : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
