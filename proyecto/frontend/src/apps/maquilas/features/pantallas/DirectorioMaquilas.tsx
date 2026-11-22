import { useState } from "react";
import { BadgeCheck, Factory, Loader2, MapPin, Search } from "lucide-react";

import { Button, Card, Input, Select } from "@shared/ui/design-system";
import { ImagenArchivo } from "@shared/ui/files/ImagenArchivo";
import { mensajeDeError } from "@apps/maquilas/features/errores";
import { unidades } from "@apps/maquilas/features/formato";
import { useDirectorio, useParametrosMaquilas } from "@apps/maquilas/features/useMaquilas";
import { MetricasMaquila } from "@apps/maquilas/features/componentes/MetricasMaquila";

/** Directorio de maquilas verificadas: el cliente filtra, compara y elige a quién pedirle. */
export function DirectorioMaquilas({ onAbrir, onSolicitarAbierta }: { onAbrir: (id: string) => void; onSolicitarAbierta: () => void }) {
  const { data: parametros } = useParametrosMaquilas();
  const [categoria, setCategoria] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<{ categoria?: string; ciudad?: string; q?: string; cantidad?: number }>({});
  const { data, isLoading, error } = useDirectorio(filtros);
  const nombres = new Map((parametros?.categorias ?? []).map((c) => [c.clave, c.nombre]));

  function aplicar(evento?: React.FormEvent) {
    evento?.preventDefault();
    const n = Number.parseInt(cantidad, 10);
    setFiltros({ categoria: categoria || undefined, ciudad: ciudad.trim() || undefined, q: busqueda.trim() || undefined,
      cantidad: Number.isFinite(n) && n > 0 ? n : undefined });
  }

  return (
    <div className="space-y-5">
      <Card padding="lg" className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Encuentra quién fabrique tu producto</h2>
          <p className="text-sm text-muted-foreground">Todas las maquilas del directorio fueron verificadas por Zarpi (RUT y cámara de comercio).</p>
        </div>
        <Button onClick={onSolicitarAbierta}>No sé a quién elegir: pedir propuestas</Button>
      </Card>

      <form onSubmit={aplicar} className="grid gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-5">
        <Select label="Qué quieres fabricar" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {(parametros?.categorias ?? []).map((c) => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
        </Select>
        <Input label="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Cualquiera" />
        <Input label="Cantidad" type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Unidades" />
        <Input label="Buscar" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Proceso o nombre" />
        <div className="flex items-end">
          <Button type="submit" fullWidth icon={<Search className="h-4 w-4" />}>Buscar</Button>
        </div>
      </form>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>
      ) : error ? (
        <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error)}</p></Card>
      ) : !data?.length ? (
        <Card padding="lg" className="text-center">
          <Factory className="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">No hay maquilas con esos filtros</p>
          <p className="text-sm text-muted-foreground">Prueba con otra cantidad o pide propuestas y te conectamos con las compatibles.</p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onAbrir(m.id)}
                className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:border-primary/40 hover:shadow-md dark:hover:border-accent/50">
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                  {m.galeria[0] ? <ImagenArchivo src={m.galeria[0].url} alt={`Trabajo de ${m.nombre_comercial}`} className="absolute inset-0 h-full w-full object-cover" />
                    : <div className="flex h-full items-center justify-center"><Factory className="h-10 w-10 text-muted-foreground" aria-hidden="true" /></div>}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{m.nombre_comercial}</p>
                    <BadgeCheck className="h-5 w-5 flex-shrink-0 text-emerald-500" aria-label="Verificada por Zarpi" />
                  </div>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{m.ciudad}</p>
                  <MetricasMaquila metricas={m.metricas} compacto />
                  <p className="line-clamp-2 text-sm text-muted-foreground">{m.descripcion}</p>
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                    {m.categorias.map((c) => <span key={c} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{nombres.get(c) ?? c}</span>)}
                  </div>
                  <p className="text-xs text-muted-foreground">Desde {unidades(m.pedido_minimo)}{m.dias_produccion ? ` · ${m.dias_produccion} días de producción` : ""}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
