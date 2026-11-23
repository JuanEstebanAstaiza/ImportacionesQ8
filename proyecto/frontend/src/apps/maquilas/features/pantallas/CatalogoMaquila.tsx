import { useEffect, useState } from "react";
import { EyeOff, Loader2, Pencil, Plus, Store, Tag, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

import { Button, Card, Input, Select, Textarea } from "@shared/ui/design-system";
import { ImagenArchivo } from "@shared/ui/files/ImagenArchivo";
import { maquilasService } from "@/services/maquilas.service";
import { mensajeDeError } from "@apps/maquilas/features/errores";
import { pesos, unidades } from "@apps/maquilas/features/formato";
import { useInvalidarMaquilas, useMiMaquiladora, useMisProductos, useParametrosMaquilas } from "@apps/maquilas/features/useMaquilas";
import { ArchivosVista } from "@apps/maquilas/features/componentes/ArchivosVista";
import { SubirArchivoMaquila } from "@apps/maquilas/features/componentes/SubirArchivoMaquila";
import type { ArchivoMaquila, Producto } from "@apps/maquilas/features/tipos";

type Borrador = {
  nombre: string; categoria: string; descripcion: string; fotos: ArchivoMaquila[];
  tramos: { cantidad_min: string; precio_unitario: string }[];
  pedido_minimo: string; personalizable: string[]; costo_muestra: string; dias_muestra: string; dias_produccion: string;
};

const VACIO: Borrador = {
  nombre: "", categoria: "", descripcion: "", fotos: [], tramos: [{ cantidad_min: "", precio_unitario: "" }],
  pedido_minimo: "", personalizable: ["logo"], costo_muestra: "0", dias_muestra: "", dias_produccion: "",
};

function borradorDe(p: Producto): Borrador {
  return {
    nombre: p.nombre, categoria: p.categoria, descripcion: p.descripcion, fotos: p.fotos,
    tramos: p.tramos.map((t) => ({ cantidad_min: String(t.cantidad_min), precio_unitario: String(t.precio_unitario) })),
    pedido_minimo: String(p.pedido_minimo), personalizable: p.personalizable.map((x) => x.clave), costo_muestra: String(p.costo_muestra),
    dias_muestra: String(p.dias_muestra ?? ""), dias_produccion: String(p.dias_produccion ?? ""),
  };
}

const n = (v: string) => Number.parseInt(v, 10) || 0;

function Editor({ producto, onCerrar }: { producto: Producto | null; onCerrar: () => void }) {
  const { data: parametros } = useParametrosMaquilas();
  const { data: mia } = useMiMaquiladora();
  const invalidar = useInvalidarMaquilas();
  const [b, setB] = useState<Borrador>(() => (producto ? borradorDe(producto) : { ...VACIO, categoria: mia?.categorias[0] ?? "" }));
  const [guardando, setGuardando] = useState<"borrador" | "publicar" | null>(null);
  // Si los datos de la maquila llegan después de abrir el formulario, preselecciona su primera categoría.
  useEffect(() => {
    if (!producto && mia?.categorias[0]) setB((x) => (x.categoria ? x : { ...x, categoria: mia.categorias[0] }));
  }, [producto, mia?.categorias]);
  const verificada = mia?.estado === "verificada";
  const maxFotos = parametros?.fotos_producto_max ?? 6;
  const categorias = (parametros?.categorias ?? []).filter((c) => mia?.categorias.includes(c.clave));

  const tramos = b.tramos.map((t) => ({ cantidad_min: n(t.cantidad_min), precio_unitario: n(t.precio_unitario) }))
    .filter((t) => t.cantidad_min > 0 && t.precio_unitario > 0).sort((x, y) => x.cantidad_min - y.cantidad_min);
  const errores = [
    b.nombre.trim().length < 3 && "Ponle nombre al producto",
    !b.categoria && "Elige la categoría",
    b.descripcion.trim().length < 10 && "Descríbelo (mínimo 10 caracteres)",
    !(n(b.pedido_minimo) >= 1) && "¿Desde cuántas unidades lo fabricas?",
    !tramos.length && "Pon al menos un precio por unidad",
    tramos.length > 0 && n(b.pedido_minimo) > 0 && tramos[0].cantidad_min > n(b.pedido_minimo) && "El primer precio tiene que empezar en el pedido mínimo o antes",
    !(n(b.dias_muestra) >= 1) && "¿En cuántos días tienes la muestra?",
    !(n(b.dias_produccion) >= 1) && "¿En cuántos días produces?",
  ].filter(Boolean) as string[];

  async function guardar(publicar: boolean) {
    if (errores.length) return;
    if (publicar && !b.fotos.length) { toast.error("Sube al menos una foto para publicarlo"); return; }
    setGuardando(publicar ? "publicar" : "borrador");
    const datos = {
      nombre: b.nombre.trim(), categoria: b.categoria, descripcion: b.descripcion.trim(), fotos: b.fotos.map((f) => f.id), tramos,
      pedido_minimo: n(b.pedido_minimo), personalizable: b.personalizable, costo_muestra: n(b.costo_muestra),
      dias_muestra: n(b.dias_muestra), dias_produccion: n(b.dias_produccion), activo: publicar,
    };
    try {
      if (producto) await maquilasService.actualizarProducto(producto.id, datos);
      else await maquilasService.crearProducto(datos);
      await invalidar();
      toast.success(publicar ? "Producto publicado en el catálogo" : "Guardamos el borrador");
      onCerrar();
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setGuardando(null);
    }
  }

  return (
    <Card padding="lg" className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{producto ? "Editar producto" : "Nuevo producto de marca blanca"}</h3>
          <p className="text-sm text-muted-foreground">Un producto que ya fabricas y que el cliente puede pedir con su marca.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onCerrar}>Cerrar</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Nombre" value={b.nombre} maxLength={120} onChange={(e) => setB({ ...b, nombre: e.target.value })} placeholder="Ej.: Camiseta oversize algodón 220 g" />
        <Select label="Categoría" value={b.categoria} onChange={(e) => setB({ ...b, categoria: e.target.value })}>
          <option value="">Elige una</option>
          {categorias.map((c) => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
        </Select>
        <div className="md:col-span-2">
          <Textarea label="Descripción" rows={3} value={b.descripcion} maxLength={2000} onChange={(e) => setB({ ...b, descripcion: e.target.value })}
            hint="Materiales, medidas, presentaciones, colores disponibles." />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Fotos <span className="font-normal text-muted-foreground">({b.fotos.length} de {maxFotos})</span></p>
        <SubirArchivoMaquila tipo="producto" etiqueta="Subir fotos" multiple maxArchivos={maxFotos - b.fotos.length} maxMb={parametros?.mb_max_foto}
          disabled={b.fotos.length >= maxFotos} onSubido={(a) => setB((x) => ({ ...x, fotos: [...x.fotos, a] }))} />
        <ArchivosVista archivos={b.fotos} onQuitar={(id) => setB({ ...b, fotos: b.fotos.filter((f) => f.id !== id) })} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Qué puede personalizar el cliente</legend>
        <div className="flex flex-wrap gap-2">
          {(parametros?.personalizaciones ?? []).map((p) => {
            const activa = b.personalizable.includes(p.clave);
            return (
              <button key={p.clave} type="button" aria-pressed={activa}
                onClick={() => setB({ ...b, personalizable: activa ? b.personalizable.filter((x) => x !== p.clave) : [...b.personalizable, p.clave] })}
                className={clsx("rounded-full border px-3 py-1 text-sm", activa ? "border-primary bg-primary/10 text-primary dark:border-accent dark:bg-accent/15 dark:text-accent" : "border-border text-muted-foreground")}>
                {p.nombre}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-4">
        <Input label="Pedido mínimo" type="number" min={1} suffix="und." value={b.pedido_minimo} onChange={(e) => setB({ ...b, pedido_minimo: e.target.value })} />
        <Input label="Costo de la muestra" type="number" min={0} prefix="$" value={b.costo_muestra} onChange={(e) => setB({ ...b, costo_muestra: e.target.value })} />
        <Input label="Días para la muestra" type="number" min={1} value={b.dias_muestra} onChange={(e) => setB({ ...b, dias_muestra: e.target.value })} />
        <Input label="Días de producción" type="number" min={1} value={b.dias_produccion} onChange={(e) => setB({ ...b, dias_produccion: e.target.value })} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Precio por unidad según la cantidad</legend>
        {b.tramos.map((t, i) => (
          <div key={i} className="flex items-end gap-2">
            <Input label={i === 0 ? "Desde (unidades)" : undefined} aria-label="Desde cuántas unidades" type="number" min={1} value={t.cantidad_min}
              onChange={(e) => setB({ ...b, tramos: b.tramos.map((x, j) => (j === i ? { ...x, cantidad_min: e.target.value } : x)) })} />
            <Input label={i === 0 ? "Precio por unidad" : undefined} aria-label="Precio por unidad" type="number" min={1} prefix="$" value={t.precio_unitario}
              onChange={(e) => setB({ ...b, tramos: b.tramos.map((x, j) => (j === i ? { ...x, precio_unitario: e.target.value } : x)) })} />
            {b.tramos.length > 1 && (
              <button type="button" aria-label="Quitar precio" className="mb-2 text-muted-foreground hover:text-destructive"
                onClick={() => setB({ ...b, tramos: b.tramos.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
            )}
          </div>
        ))}
        {b.tramos.length < 5 && (
          <Button variant="ghost" size="sm" icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setB({ ...b, tramos: [...b.tramos, { cantidad_min: "", precio_unitario: "" }] })}>Agregar precio por volumen</Button>
        )}
      </fieldset>
      {errores.length > 0 && <ul className="list-disc pl-5 text-xs text-amber-700 dark:text-amber-300">{errores.map((e) => <li key={e}>{e}</li>)}</ul>}
      {!verificada && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Puedes preparar tus productos; se publican cuando Zarpi verifique tu maquila.</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" loading={guardando === "borrador"} disabled={errores.length > 0 || guardando !== null} onClick={() => void guardar(false)}>
          {producto?.activo ? "Pausar y guardar" : "Guardar borrador"}
        </Button>
        <Button loading={guardando === "publicar"} disabled={errores.length > 0 || !verificada || guardando !== null} onClick={() => void guardar(true)}>
          {producto?.activo ? "Guardar cambios" : "Publicar"}
        </Button>
      </div>
    </Card>
  );
}

function EstadoProducto({ p }: { p: Producto }) {
  if (p.oculto) return <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive"><EyeOff className="h-3 w-3" />Oculto por Zarpi</span>;
  if (p.visible) return <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">Publicado</span>;
  return <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{p.activo ? "Esperando verificación" : "Borrador"}</span>;
}

/** Catálogo de marca blanca de la maquila: sus productos listos para que el cliente ponga su marca. */
export function CatalogoMaquila() {
  const { data, isLoading, error } = useMisProductos();
  const { data: parametros } = useParametrosMaquilas();
  const [editando, setEditando] = useState<Producto | "nuevo" | null>(null);

  if (editando) return <Editor key={editando === "nuevo" ? "nuevo" : editando.id} producto={editando === "nuevo" ? null : editando} onCerrar={() => setEditando(null)} />;

  return (
    <div className="space-y-5">
      <Card padding="lg" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Store className="mt-0.5 h-6 w-6 text-primary dark:text-accent" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Marca blanca</h2>
            <p className="text-sm text-muted-foreground">Publica productos que ya fabricas. El cliente elige, sube su logo y te llega la solicitud con tu precio de catálogo.</p>
          </div>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} disabled={(data?.length ?? 0) >= (parametros?.productos_max ?? 30)} onClick={() => setEditando("nuevo")}>
          Nuevo producto
        </Button>
      </Card>
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>
      ) : error ? (
        <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error)}</p></Card>
      ) : !data?.length ? (
        <Card padding="lg" className="text-center">
          <Tag className="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">Todavía no tienes productos</p>
          <p className="text-sm text-muted-foreground">Los productos de marca blanca son la forma más rápida de que un emprendedor te compre.</p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => (
            <li key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
              <div className="relative aspect-[4/3] w-full bg-muted">
                {p.fotos[0] ? <ImagenArchivo src={p.fotos[0].url} alt={p.nombre} className="absolute inset-0 h-full w-full object-cover" />
                  : <div className="flex h-full items-center justify-center"><Tag className="h-8 w-8 text-muted-foreground" aria-hidden="true" /></div>}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{p.nombre}</p>
                  <EstadoProducto p={p} />
                </div>
                <p className="text-xs text-muted-foreground">{p.categoria_nombre} · desde {unidades(p.pedido_minimo)} · {pesos(p.precio_desde)} c/u</p>
                {p.oculto && <p className="text-xs text-destructive">Motivo: {p.oculto.motivo}</p>}
                <p className="text-xs text-muted-foreground">{p.pedidos} {p.pedidos === 1 ? "pedido" : "pedidos"}</p>
                <div className="mt-auto pt-2">
                  <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditando(p)}>Editar</Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
