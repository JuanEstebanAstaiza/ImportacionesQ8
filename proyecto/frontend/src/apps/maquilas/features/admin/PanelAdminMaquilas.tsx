import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Plus, Save, Search, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

import type { Screen } from "@/app/rutas";
import { Button, Card, Input, Select, Textarea } from "@shared/ui/design-system";
import { maquilasService } from "@/services/maquilas.service";
import { mensajeDeError } from "@apps/maquilas/features/errores";
import { fecha, pesos, unidades } from "@apps/maquilas/features/formato";
import {
  useConfiguracionMaquilas, useInvalidarMaquilas, usePedidosAdmin, useResumenAdmin, useSolicitudesAdmin,
} from "@apps/maquilas/features/useMaquilas";
import { MetricasMaquila } from "@apps/maquilas/features/componentes/MetricasMaquila";
import { PedidosMaquilas } from "@apps/maquilas/features/pantallas/PedidosMaquilas";
import { EstadoSolicitudChip } from "@apps/maquilas/features/pantallas/SolicitudesCliente";
import type { CategoriaMaquila, ConfiguracionMaquilas, PasoRutaParametro, TipoEncargo } from "@apps/maquilas/features/tipos";

const cargando = <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>;

function Cifra({ etiqueta, valor, detalle, alerta, onClick }: { etiqueta: string; valor: string | number; detalle?: string; alerta?: boolean; onClick?: () => void }) {
  const Contenedor = onClick ? "button" : "div";
  return (
    <Contenedor type={onClick ? "button" : undefined} onClick={onClick}
      className={clsx("rounded-2xl border bg-card p-4 text-left", alerta ? "border-destructive/40" : "border-border", onClick && "transition hover:border-primary/40 dark:hover:border-accent/50")}>
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className={clsx("text-2xl font-semibold", alerta && "text-destructive")}>{valor}</p>
      {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
    </Contenedor>
  );
}

const n = (r: Record<string, number> | undefined, ...claves: string[]) => claves.reduce((a, c) => a + (r?.[c] ?? 0), 0);

// ── Resumen ──────────────────────────────────────────────────────────────────

/** Maquilas › Resumen: el estado del módulo de un vistazo. */
export function ResumenMaquilas({ onIr }: { onIr: (screen: Screen, id?: string) => void }) {
  const { data: r, isLoading, error } = useResumenAdmin();
  if (isLoading) return cargando;
  if (error || !r) return <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error)}</p></Card>;
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Pedidos</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Cifra etiqueta="Activos" valor={r.pedidos_activos} detalle={`${pesos(r.valor_activo)} en producción`} onClick={() => onIr("maq-admin-monitoreo")} />
          <Cifra etiqueta="Retrasados" valor={r.pedidos_retrasados} alerta={r.pedidos_retrasados > 0} detalle="Pasaron la fecha comprometida" onClick={() => onIr("maq-admin-monitoreo")} />
          <Cifra etiqueta="Entregados (30 días)" valor={r.entregados_30_dias.n} detalle={pesos(r.entregados_30_dias.valor)} />
          <Cifra etiqueta="Comprobantes sin revisar" valor={r.comprobantes_por_revisar} detalle="Esperan a la maquila" />
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Solicitudes y oferta</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Cifra etiqueta="Solicitudes (30 días)" valor={r.solicitudes_30_dias}
            detalle={`${n(r.solicitudes_por_modalidad, "abierta")} abiertas · ${n(r.solicitudes_por_modalidad, "dirigida")} dirigidas · ${n(r.solicitudes_por_modalidad, "marca_blanca")} marca blanca`} />
          <Cifra etiqueta="Sin propuesta hace 3 días o más" valor={r.solicitudes_sin_propuesta} alerta={r.solicitudes_sin_propuesta > 0} onClick={() => onIr("maq-admin-monitoreo")} />
          <Cifra etiqueta="Maquilas verificadas" valor={n(r.maquiladoras, "verificada")} detalle={`${n(r.maquiladoras, "en_revision")} esperando verificación`} onClick={() => onIr("maq-admin-verificacion")} />
          <Cifra etiqueta="Productos de marca blanca" valor={r.productos_publicados} onClick={() => onIr("maq-admin-moderacion")} />
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Marca y confianza</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Cifra etiqueta="Calificación promedio" valor={r.resenas.promedio?.toLocaleString("es-CO") ?? "—"} detalle={`${r.resenas.n} reseñas`} onClick={() => onIr("maq-admin-moderacion")} />
          <Cifra etiqueta="Marcas creadas" valor={r.marcas} />
          <Cifra etiqueta="Encargos de diseño abiertos" valor={n(r.encargos, "nuevo", "en_proceso", "entregado", "cambios")} detalle={`${n(r.encargos, "nuevo")} sin tomar · ${n(r.encargos, "aprobado")} aprobados`} />
        </div>
      </section>
      {r.mejores_maquilas.length > 0 && (
        <Card padding="lg" className="space-y-3">
          <h2 className="font-semibold">Maquilas con más entregas</h2>
          <ul className="divide-y divide-border">
            {r.mejores_maquilas.map((m) => (
              <li key={m.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium">{m.nombre_comercial} <span className="text-xs font-normal text-muted-foreground">· {m.ciudad}</span></span>
                <MetricasMaquila metricas={m.metricas} compacto />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// ── Monitoreo ────────────────────────────────────────────────────────────────

function ListaPedidos({ onAbrir }: { onAbrir: (id: string) => void }) {
  const [estado, setEstado] = useState("");
  const [retrasados, setRetrasados] = useState(false);
  const [q, setQ] = useState("");
  const [filtros, setFiltros] = useState<{ estado?: string; q?: string; retrasados?: boolean }>({});
  const { data, isLoading, error } = usePedidosAdmin(filtros);
  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); setFiltros({ estado: estado || undefined, q: q.trim() || undefined, retrasados: retrasados || undefined }); }}
        className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
        <Input label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código, producto, cliente o maquila" />
        <Select label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos</option>
          <option value="muestra">Muestra</option><option value="produccion">En producción</option><option value="despachado">Despachado</option>
          <option value="entregado">Entregado</option><option value="cancelado">Cancelado</option>
        </Select>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={retrasados} onChange={(e) => setRetrasados(e.target.checked)} />Solo retrasados</label>
        <Button type="submit" icon={<Search className="h-4 w-4" />}>Filtrar</Button>
      </form>
      {isLoading ? cargando : error ? <p className="text-sm text-destructive">{mensajeDeError(error)}</p>
        : !data?.length ? <p className="py-8 text-center text-sm text-muted-foreground">No hay pedidos con esos filtros.</p>
        : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {data.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => onAbrir(p.id)} className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-muted/50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{p.producto} <span className="text-xs font-normal text-muted-foreground">· {p.codigo}</span></p>
                    <span className="flex items-center gap-2 text-xs">
                      {p.retrasado && <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="h-3.5 w-3.5" />Retrasado</span>}
                      <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium">{p.estado_etiqueta}</span>
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.cliente.empresa || p.cliente.nombre} → {p.maquiladora.nombre_comercial} · {unidades(p.cantidad)} · {pesos(p.pagado)} de {pesos(p.total)} · etapa {p.etapas_hechas}/{p.etapas_total} · entrega {fecha(p.fecha_compromiso)}
                  </p>
                  {(p.aviso_cliente || p.aviso_maquila) && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      {p.aviso_cliente && <>Cliente: {p.aviso_cliente} </>}{p.aviso_maquila && <>· Maquila: {p.aviso_maquila}</>}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

function ListaSolicitudes({ onAbrirPedido }: { onAbrirPedido: (id: string) => void }) {
  const [estado, setEstado] = useState("");
  const [modalidad, setModalidad] = useState("");
  const [q, setQ] = useState("");
  const [filtros, setFiltros] = useState<{ estado?: string; modalidad?: string; q?: string }>({});
  const { data, isLoading, error } = useSolicitudesAdmin(filtros);
  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); setFiltros({ estado: estado || undefined, modalidad: modalidad || undefined, q: q.trim() || undefined }); }}
        className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
        <Input label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código, producto o cliente" />
        <Select label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos</option><option value="abierta">Esperando propuestas</option><option value="con_propuestas">Con propuestas</option>
          <option value="aceptada">Aceptada</option><option value="cancelada">Cancelada</option>
        </Select>
        <Select label="Modalidad" value={modalidad} onChange={(e) => setModalidad(e.target.value)}>
          <option value="">Todas</option><option value="abierta">Abierta</option><option value="dirigida">Dirigida</option><option value="marca_blanca">Marca blanca</option>
        </Select>
        <Button type="submit" icon={<Search className="h-4 w-4" />}>Filtrar</Button>
      </form>
      {isLoading ? cargando : error ? <p className="text-sm text-destructive">{mensajeDeError(error)}</p>
        : !data?.length ? <p className="py-8 text-center text-sm text-muted-foreground">No hay solicitudes con esos filtros.</p>
        : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {data.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.titulo} <span className="text-xs font-normal text-muted-foreground">· {s.codigo}</span></p>
                  <p className="text-xs text-muted-foreground">
                    {s.cliente.empresa || s.cliente.nombre} · {s.categoria_nombre} · {unidades(s.cantidad)} · {s.modalidad === "marca_blanca" ? "marca blanca" : s.modalidad} · {s.propuestas} de {s.destinos} propuestas · {fecha(s.creado_en)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {s.pedido_id && <Button size="sm" variant="ghost" onClick={() => onAbrirPedido(s.pedido_id!)}>Ver pedido</Button>}
                  <EstadoSolicitudChip estado={s.estado} etiqueta={s.estado_etiqueta} />
                </div>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

/** Maquilas › Monitoreo: solicitudes y pedidos de todo el módulo (solo lectura). */
export function MonitoreoMaquilas({ pedidoId, onAbrir }: { pedidoId?: string; onAbrir: (id?: string) => void }) {
  const [pestana, setPestana] = useState<"pedidos" | "solicitudes">("pedidos");
  if (pedidoId) {
    return (
      <div className="space-y-3">
        <p className="rounded-xl bg-muted px-4 py-2 text-sm text-muted-foreground">Vista del equipo: solo lectura. Para intervenir, usa la mesa de ayuda con la referencia del pedido.</p>
        <PedidosMaquilas pedidoId={pedidoId} onAbrir={onAbrir} />
      </div>
    );
  }
  return (
    <Card padding="lg" className="space-y-5">
      <div className="flex gap-2 border-b border-border" role="tablist" aria-label="Qué monitorear">
        {([["pedidos", "Pedidos"], ["solicitudes", "Solicitudes"]] as const).map(([clave, texto]) => (
          <button key={clave} type="button" role="tab" aria-selected={pestana === clave} onClick={() => setPestana(clave)}
            className={clsx("-mb-px border-b-2 px-3 py-2 text-sm font-medium", pestana === clave ? "border-primary text-primary dark:border-accent dark:text-accent" : "border-transparent text-muted-foreground")}>
            {texto}
          </button>
        ))}
      </div>
      {pestana === "pedidos" ? <ListaPedidos onAbrir={onAbrir} /> : <ListaSolicitudes onAbrirPedido={onAbrir} />}
    </Card>
  );
}

// ── Configuración ────────────────────────────────────────────────────────────

const NUMEROS: { clave: string; etiqueta: string; ayuda?: string }[] = [
  { clave: "cupo_abierta", etiqueta: "Maquilas por solicitud abierta", ayuda: "A cuántas compatibles se reparte" },
  { clave: "productos_max", etiqueta: "Productos de marca blanca por maquila" },
  { clave: "fotos_producto_max", etiqueta: "Fotos por producto" },
  { clave: "fotos_galeria_max", etiqueta: "Fotos de la galería de una maquila" },
  { clave: "certificados_max", etiqueta: "Certificados por maquila" },
  { clave: "colaboradores_max", etiqueta: "Colaboradores por maquila" },
  { clave: "marcas_max", etiqueta: "Marcas por cliente" },
  { clave: "paleta_max", etiqueta: "Colores por paleta" },
  { clave: "archivos_marca_max", etiqueta: "Archivos por marca" },
  { clave: "versiones_max", etiqueta: "Versiones por encargo de diseño" },
  { clave: "mb_max_foto", etiqueta: "MB por foto" },
  { clave: "mb_max_documento", etiqueta: "MB por documento" },
  { clave: "mb_max_video", etiqueta: "MB por video" },
];

const aClave = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

function ListaConClave<T extends { clave: string; nombre: string }>({ titulo, ayuda, items, existentes, onCambiar, nuevo, extra }: {
  titulo: string; ayuda: string; items: T[]; existentes: Set<string>; onCambiar: (items: T[]) => void; nuevo: () => T;
  extra?: (item: T, cambiar: (parcial: Partial<T>) => void) => React.ReactNode;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="font-semibold">{titulo}</legend>
      <p className="text-xs text-muted-foreground">{ayuda}</p>
      {items.map((item, i) => {
        const cambiar = (parcial: Partial<T>) => onCambiar(items.map((x, j) => (j === i ? { ...x, ...parcial } : x)));
        const fija = existentes.has(item.clave);
        return (
          <div key={i} className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input label="Nombre" value={item.nombre}
                  onChange={(e) => cambiar({ nombre: e.target.value, ...(fija ? {} : { clave: aClave(e.target.value) }) } as Partial<T>)} />
              </div>
              <span className="mb-2 text-xs text-muted-foreground">clave: {item.clave || "—"}</span>
              {!fija && (
                <button type="button" aria-label="Quitar" className="mb-2 text-muted-foreground hover:text-destructive"
                  onClick={() => onCambiar(items.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
            {extra?.(item, cambiar)}
          </div>
        );
      })}
      <Button variant="ghost" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => onCambiar([...items, nuevo()])}>Agregar</Button>
    </fieldset>
  );
}

/** Maquilas › Configuración (solo admin): límites, catálogos y la ruta legal. */
export function ConfiguracionMaquilas() {
  const { data, isLoading, error } = useConfiguracionMaquilas();
  const invalidar = useInvalidarMaquilas();
  const [b, setB] = useState<ConfiguracionMaquilas | null>(null);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (data) setB(structuredClone(data)); }, [data]);
  if (isLoading || !b) return error ? <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error)}</p></Card> : cargando;
  const existentes = (lista: { clave: string }[] | undefined) => new Set((lista ?? []).map((x) => x.clave));

  async function guardar() {
    setGuardando(true);
    try {
      const cambios: Record<string, unknown> = {};
      for (const { clave } of NUMEROS) cambios[clave] = Number(b![clave]);
      for (const clave of ["procesos", "certificaciones", "categorias", "personalizaciones", "tipos_encargo", "ruta_legal"]) cambios[clave] = b![clave];
      await maquilasService.guardarConfiguracion(cambios);
      await invalidar();
      toast.success("Guardamos la configuración de Maquilas");
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  const set = (parcial: Partial<ConfiguracionMaquilas>) => setB({ ...b, ...parcial });
  return (
    <div className="space-y-5">
      <Card padding="lg" className="space-y-4">
        <h2 className="font-semibold">Límites</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {NUMEROS.map((x) => (
            <Input key={x.clave} label={x.etiqueta} hint={x.ayuda} type="number" min={0} value={String(b[x.clave] ?? "")}
              onChange={(e) => set({ [x.clave]: e.target.value } as Partial<ConfiguracionMaquilas>)} />
          ))}
        </div>
      </Card>
      <Card padding="lg" className="grid gap-5 lg:grid-cols-2">
        <Textarea label="Procesos (uno por línea)" rows={8} value={b.procesos.join("\n")}
          onChange={(e) => set({ procesos: e.target.value.split("\n") })} hint="Los eligen las maquilas en su perfil y sirven de filtro en el directorio." />
        <Textarea label="Certificaciones (una por línea)" rows={8} value={b.certificaciones.join("\n")}
          onChange={(e) => set({ certificaciones: e.target.value.split("\n") })} />
      </Card>
      <Card padding="lg" className="grid gap-6 lg:grid-cols-2">
        <ListaConClave<CategoriaMaquila> titulo="Categorías" ayuda="Las que ya existen se pueden renombrar pero no quitar: las usan maquilas, productos y marcas."
          items={b.categorias} existentes={existentes(data?.categorias)} onCambiar={(categorias) => set({ categorias })} nuevo={() => ({ clave: "", nombre: "" })} />
        <ListaConClave<{ clave: string; nombre: string }> titulo="Personalizaciones de marca blanca" ayuda="Lo que el cliente puede personalizar en un producto del catálogo."
          items={b.personalizaciones} existentes={existentes(data?.personalizaciones)} onCambiar={(personalizaciones) => set({ personalizaciones })} nuevo={() => ({ clave: "", nombre: "" })} />
      </Card>
      <Card padding="lg">
        <ListaConClave<TipoEncargo> titulo="Tipos de encargo de diseño" ayuda="Lo que el cliente le puede pedir al equipo de Diseño."
          items={b.tipos_encargo} existentes={existentes(data?.tipos_encargo)} onCambiar={(tipos_encargo) => set({ tipos_encargo })}
          nuevo={() => ({ clave: "", nombre: "", descripcion: "" })}
          extra={(item, cambiar) => <Input label="Descripción" value={item.descripcion} onChange={(e) => cambiar({ descripcion: e.target.value })} />} />
      </Card>
      <Card padding="lg">
        <ListaConClave<PasoRutaParametro> titulo="Ruta legal" ayuda="Pasos que ve el cliente en su marca. Sin categorías marcadas, aplica a todas."
          items={b.ruta_legal} existentes={existentes(data?.ruta_legal)} onCambiar={(ruta_legal) => set({ ruta_legal })}
          nuevo={() => ({ clave: "", nombre: "", descripcion: "", enlace: "https://", categorias: [] })}
          extra={(item, cambiar) => (
            <div className="space-y-2">
              <Textarea label="Guía" rows={2} value={item.descripcion} onChange={(e) => cambiar({ descripcion: e.target.value })} />
              <Input label="Enlace oficial" value={item.enlace} onChange={(e) => cambiar({ enlace: e.target.value })} />
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categorías a las que aplica">
                {b.categorias.filter((c) => c.clave).map((c) => {
                  const activa = item.categorias.includes(c.clave);
                  return (
                    <button key={c.clave} type="button" aria-pressed={activa}
                      onClick={() => cambiar({ categorias: activa ? item.categorias.filter((x) => x !== c.clave) : [...item.categorias, c.clave] })}
                      className={clsx("rounded-full border px-2.5 py-0.5 text-xs", activa ? "border-primary bg-primary/10 text-primary dark:border-accent dark:bg-accent/15 dark:text-accent" : "border-border text-muted-foreground")}>
                      {c.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
          )} />
      </Card>
      <div className="sticky bottom-4 flex justify-end">
        <Button icon={<Save className="h-4 w-4" />} loading={guardando} onClick={() => void guardar()}>Guardar configuración</Button>
      </div>
    </div>
  );
}

