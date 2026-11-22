import { useState } from "react";
import { ArrowLeft, BadgeCheck, Calculator, Loader2, MapPin, Search, Send, Tag } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

import { Button, Card, Input, Select, Textarea } from "@shared/ui/design-system";
import { ImagenArchivo } from "@shared/ui/files/ImagenArchivo";
import { Modal } from "@shared/ui/kit/Modal";
import { maquilasService } from "@/services/maquilas.service";
import { mensajeDeError } from "@apps/maquilas/features/errores";
import { pesos, unidades } from "@apps/maquilas/features/formato";
import { useCatalogo, useInvalidarMaquilas, useParametrosMaquilas, useProducto } from "@apps/maquilas/features/useMaquilas";
import { ArchivosVista } from "@apps/maquilas/features/componentes/ArchivosVista";
import { CalculadoraMargen } from "@apps/maquilas/features/componentes/CalculadoraMargen";
import { MetricasMaquila } from "@apps/maquilas/features/componentes/MetricasMaquila";
import { SubirArchivoMaquila } from "@apps/maquilas/features/componentes/SubirArchivoMaquila";
import type { ArchivoMaquila, Producto, Tramo } from "@apps/maquilas/features/tipos";

const manana = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

export function precioPara(tramos: Tramo[], cantidad: number): number | null {
  const aplicable = [...tramos].sort((a, b) => a.cantidad_min - b.cantidad_min).filter((t) => t.cantidad_min <= cantidad).pop();
  return aplicable ? aplicable.precio_unitario : null;
}

/** Tarjeta de un producto del catálogo (también la usa el perfil de la maquila). */
export function TarjetaProducto({ p, onAbrir }: { p: Producto; onAbrir: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onAbrir(p.id)}
      className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:border-primary/40 hover:shadow-md dark:hover:border-accent/50">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {p.fotos[0] ? <ImagenArchivo src={p.fotos[0].url} alt={p.nombre} className="absolute inset-0 h-full w-full object-cover" />
          : <div className="flex h-full items-center justify-center"><Tag className="h-8 w-8 text-muted-foreground" aria-hidden="true" /></div>}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="font-semibold">{p.nombre}</p>
        <p className="text-xs text-muted-foreground">{p.maquiladora.nombre_comercial} · {p.maquiladora.ciudad}</p>
        <p className="text-sm"><span className="font-semibold">{pesos(p.precio_desde)}</span> <span className="text-muted-foreground">c/u · desde {unidades(p.pedido_minimo)}</span></p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {p.personalizable.map((x) => <span key={x.clave} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">Tu {x.nombre.toLowerCase()}</span>)}
        </div>
      </div>
    </button>
  );
}

function DetalleProducto({ id, onVolver, onCreada, onVerMaquila }: {
  id: string; onVolver: () => void; onCreada: (solicitudId: string) => void; onVerMaquila: (id: string) => void;
}) {
  const { data: p, isLoading, error } = useProducto(id);
  const { data: parametros } = useParametrosMaquilas();
  const invalidar = useInvalidarMaquilas();
  const [cantidad, setCantidad] = useState("");
  const [personalizacion, setPersonalizacion] = useState<string[] | null>(null);
  const [archivos, setArchivos] = useState<ArchivoMaquila[]>([]);
  const [notas, setNotas] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [fechaObjetivo, setFechaObjetivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [foto, setFoto] = useState(0);

  if (isLoading) return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>;
  if (error || !p) return <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error, "Ese producto ya no está disponible.")}</p></Card>;

  const elegidas = personalizacion ?? p.personalizable.map((x) => x.clave);
  const n = Number.parseInt(cantidad, 10) || 0;
  const precio = n ? precioPara(p.tramos, n) : null;
  const total = precio !== null && n >= p.pedido_minimo ? precio * n + p.costo_muestra : null;
  const errores = [
    n < p.pedido_minimo && `Este producto se fabrica desde ${unidades(p.pedido_minimo)}`,
    notas.trim().length < 10 && "Cuéntale a la maquila cómo quieres tu marca (mínimo 10 caracteres)",
    ciudad.trim().length < 2 && "¿A qué ciudad se entrega?",
  ].filter(Boolean) as string[];

  async function pedir() {
    if (errores.length) { toast.error(errores[0]); return; }
    setEnviando(true);
    try {
      const solicitud = await maquilasService.crearSolicitud({
        modalidad: "marca_blanca", producto_id: p!.id, categoria: p!.categoria, titulo: `${p!.nombre} con mi marca`.slice(0, 160),
        descripcion: notas.trim(), cantidad: n, fecha_objetivo: fechaObjetivo || null, ciudad_entrega: ciudad.trim(), campos: {},
        referencias: archivos.map((a) => a.id), personalizacion: elegidas, confidencial: false,
      });
      await invalidar();
      toast.success(`Enviamos tu pedido a ${p!.maquiladora.nombre_comercial}. Te confirma precio y tiempos con su propuesta.`);
      onCreada(solicitud.id);
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-5">
      <button type="button" onClick={onVolver} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Catálogo
      </button>
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border bg-muted">
            {p.fotos[foto] ? <ImagenArchivo src={p.fotos[foto].url} alt={p.nombre} className="absolute inset-0 h-full w-full object-contain" />
              : <div className="flex h-full items-center justify-center"><Tag className="h-10 w-10 text-muted-foreground" aria-hidden="true" /></div>}
          </div>
          {p.fotos.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {p.fotos.map((f, i) => (
                <button key={f.id} type="button" onClick={() => setFoto(i)} aria-label={`Ver foto ${i + 1}`} aria-pressed={i === foto}
                  className={clsx("h-16 w-16 overflow-hidden rounded-lg border-2", i === foto ? "border-primary dark:border-accent" : "border-transparent")}>
                  <ImagenArchivo src={f.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <Card padding="lg" className="space-y-3">
            <p className="whitespace-pre-line text-sm">{p.descripcion}</p>
            <table className="w-full text-sm">
              <caption className="pb-2 text-left text-xs font-medium text-muted-foreground">Precio por unidad según la cantidad</caption>
              <tbody>
                {p.tramos.map((t) => (
                  <tr key={t.cantidad_min} className="border-t border-border"><td className="py-1.5">Desde {unidades(t.cantidad_min)}</td><td className="py-1.5 text-right font-medium">{pesos(t.precio_unitario)}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground">
              Muestra: {p.costo_muestra ? pesos(p.costo_muestra) : "sin costo"} en {p.dias_muestra} días · producción: {p.dias_produccion} días
            </p>
          </Card>
          <Card padding="md" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-1 font-medium">{p.maquiladora.nombre_comercial} <BadgeCheck className="h-4 w-4 text-emerald-500" aria-label="Verificada por Zarpi" /></p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{p.maquiladora.ciudad}</p>
              <div className="mt-1"><MetricasMaquila metricas={p.maquiladora.metricas} compacto /></div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onVerMaquila(p.maquiladora.id)}>Ver la maquila</Button>
          </Card>
        </div>

        <Card padding="lg" className="space-y-4 lg:self-start">
          <div>
            <h2 className="text-xl font-semibold">{p.nombre}</h2>
            <p className="text-sm text-muted-foreground">{p.categoria_nombre} · {p.pedidos} {p.pedidos === 1 ? "pedido" : "pedidos"} en Zarpi</p>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Qué quieres con tu marca</legend>
            <div className="flex flex-wrap gap-2">
              {p.personalizable.map((x) => {
                const activa = elegidas.includes(x.clave);
                return (
                  <button key={x.clave} type="button" aria-pressed={activa}
                    onClick={() => setPersonalizacion(activa ? elegidas.filter((c) => c !== x.clave) : [...elegidas, x.clave])}
                    className={clsx("rounded-full border px-3 py-1 text-sm", activa ? "border-primary bg-primary/10 text-primary dark:border-accent dark:bg-accent/15 dark:text-accent" : "border-border text-muted-foreground")}>
                    {x.nombre}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="space-y-2">
            <SubirArchivoMaquila tipo="referencia" etiqueta="Subir tu logo o referencias" multiple maxArchivos={10 - archivos.length}
              maxMb={parametros?.mb_max_foto} disabled={archivos.length >= 10} onSubido={(a) => setArchivos((x) => [...x, a])} />
            <ArchivosVista archivos={archivos} tamano="sm" onQuitar={(id) => setArchivos((x) => x.filter((a) => a.id !== id))} />
          </div>
          <Textarea label="Cómo quieres tu marca" rows={3} value={notas} maxLength={4000} onChange={(e) => setNotas(e.target.value)}
            hint="Dónde va el logo, colores, tallas o presentaciones, texto de la etiqueta…" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Cantidad" type="number" min={p.pedido_minimo} suffix="und." value={cantidad} onChange={(e) => setCantidad(e.target.value)}
              hint={`Mínimo ${unidades(p.pedido_minimo)}`} />
            <Input label="Ciudad de entrega" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
            <Input label="¿Para cuándo? (opcional)" type="date" min={manana()} value={fechaObjetivo} onChange={(e) => setFechaObjetivo(e.target.value)} />
          </div>
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground">Estimado con el precio de catálogo</p>
            <p className="text-2xl font-semibold">{total !== null ? pesos(total) : "—"}</p>
            {total !== null && precio !== null && <p className="text-xs text-muted-foreground">{pesos(precio)} c/u{p.costo_muestra ? ` + muestra ${pesos(p.costo_muestra)}` : ""}. La maquila lo confirma en su propuesta.</p>}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" icon={<Calculator className="h-4 w-4" />} disabled={precio === null} onClick={() => setCalculando(true)}>Calcular mi margen</Button>
            <Button icon={<Send className="h-4 w-4" />} loading={enviando} onClick={() => void pedir()}>Pedir con mi marca</Button>
          </div>
        </Card>
      </div>
      <Modal open={calculando} onClose={() => setCalculando(false)} title="¿A cuánto lo vendo?" width="max-w-5xl">
        <CalculadoraMargen precio={precio ?? undefined} cantidad={n || undefined} costosFijos={p.costo_muestra || undefined} />
      </Modal>
    </div>
  );
}

/** Catálogo de marca blanca: productos listos de maquilas verificadas para fabricar con tu marca. */
export function MarcaBlanca({ productoId, onAbrir, onCreada, onVerMaquila }: {
  productoId?: string;
  onAbrir: (id?: string) => void;
  onCreada: (solicitudId: string) => void;
  onVerMaquila: (id: string) => void;
}) {
  const { data: parametros } = useParametrosMaquilas();
  const [categoria, setCategoria] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<{ categoria?: string; q?: string }>({});
  const { data, isLoading, error } = useCatalogo(filtros, !productoId);
  if (productoId) return <DetalleProducto id={productoId} onVolver={() => onAbrir(undefined)} onCreada={onCreada} onVerMaquila={onVerMaquila} />;

  return (
    <div className="space-y-5">
      <Card padding="lg">
        <h2 className="text-lg font-semibold">Productos listos para tu marca</h2>
        <p className="text-sm text-muted-foreground">Elige un producto que una maquila verificada ya fabrica, ponle tu logo y empieza con pedidos pequeños.</p>
      </Card>
      <form onSubmit={(e) => { e.preventDefault(); setFiltros({ categoria: categoria || undefined, q: busqueda.trim() || undefined }); }}
        className="grid gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-[1fr_1fr_auto]">
        <Select label="Categoría" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas</option>
          {(parametros?.categorias ?? []).map((c) => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
        </Select>
        <Input label="Buscar" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Camiseta, crema, gorra…" />
        <div className="flex items-end"><Button type="submit" fullWidth icon={<Search className="h-4 w-4" />}>Buscar</Button></div>
      </form>
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>
      ) : error ? (
        <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error)}</p></Card>
      ) : !data?.length ? (
        <Card padding="lg" className="text-center">
          <Tag className="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">No hay productos con esos filtros</p>
          <p className="text-sm text-muted-foreground">Si tienes un diseño propio, pide propuestas desde «Nueva solicitud».</p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => <li key={p.id}><TarjetaProducto p={p} onAbrir={(x) => onAbrir(x)} /></li>)}
        </ul>
      )}
    </div>
  );
}
