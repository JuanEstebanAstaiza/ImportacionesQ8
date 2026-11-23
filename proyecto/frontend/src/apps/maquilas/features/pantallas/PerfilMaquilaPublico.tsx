import { BadgeCheck, Loader2, MapPin, Send, Star } from "lucide-react";

import { Button, Card } from "@shared/ui/design-system";
import { mensajeDeError } from "@apps/maquilas/features/errores";
import { fecha, unidades } from "@apps/maquilas/features/formato";
import { useCatalogo, useParametrosMaquilas, usePerfilPublico, useResenasPublicas } from "@apps/maquilas/features/useMaquilas";
import { ArchivosVista } from "@apps/maquilas/features/componentes/ArchivosVista";
import { MetricasMaquila } from "@apps/maquilas/features/componentes/MetricasMaquila";
import { TarjetaProducto } from "@apps/maquilas/features/pantallas/MarcaBlanca";
import { TarjetaResena } from "@apps/maquilas/features/pantallas/ResenasMaquila";

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className="text-sm font-medium">{valor}</p>
    </div>
  );
}

/** Perfil de una maquila verificada, como lo ve un cliente. */
export function PerfilMaquilaPublico({ maquiladoraId, onSolicitar, onVerProducto }: {
  maquiladoraId: string; onSolicitar: (id: string) => void; onVerProducto?: (productoId: string) => void;
}) {
  const { data: m, isLoading, error } = usePerfilPublico(maquiladoraId);
  const { data: parametros } = useParametrosMaquilas();
  const { data: productos } = useCatalogo({ maquiladora: maquiladoraId });
  const { data: resenas } = useResenasPublicas(maquiladoraId);
  if (isLoading) return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>;
  if (error || !m) return <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error, "Esa maquila no está disponible.")}</p></Card>;
  const nombres = new Map((parametros?.categorias ?? []).map((c) => [c.clave, c.nombre]));

  return (
    <div className="space-y-5">
      <Card padding="lg" className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{m.nombre_comercial}</h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verificada por Zarpi
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{m.ciudad} · verificada desde {fecha(m.verificada_en)}</p>
          <div className="mt-2"><MetricasMaquila metricas={m.metricas} /></div>
          <p className="mt-3 max-w-3xl whitespace-pre-line text-sm">{m.descripcion}</p>
        </div>
        <Button icon={<Send className="h-4 w-4" />} onClick={() => onSolicitar(m.id)}>Pedirle una cotización</Button>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Dato etiqueta="Pedido mínimo" valor={unidades(m.pedido_minimo)} />
        <Dato etiqueta="Capacidad al mes" valor={unidades(m.capacidad_mensual)} />
        <Dato etiqueta="Muestra" valor={m.dias_muestra ? `${m.dias_muestra} días` : "—"} />
        <Dato etiqueta="Producción" valor={m.dias_produccion ? `${m.dias_produccion} días` : "—"} />
      </div>

      <Card padding="lg" className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Qué fabrica</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">{m.categorias.map((c) => <span key={c} className="rounded-full bg-muted px-2.5 py-1 text-xs">{nombres.get(c) ?? c}</span>)}</div>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Procesos</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">{m.procesos.map((p) => <span key={p} className="rounded-full border border-border px-2.5 py-1 text-xs">{p}</span>)}</div>
        </div>
        {m.certificaciones.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold">Certificaciones declaradas</h3>
            <p className="mt-1 text-sm text-muted-foreground">{m.certificaciones.join(" · ")}</p>
          </div>
        )}
      </Card>

      {!!productos?.length && onVerProducto && (
        <Card padding="lg" className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Listos para tu marca</h3>
            <p className="text-xs text-muted-foreground">Productos que ya fabrica: los pides con tu logo y empiezas con poco volumen.</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {productos.map((p) => <li key={p.id}><TarjetaProducto p={p} onAbrir={onVerProducto} /></li>)}
          </ul>
        </Card>
      )}

      {m.galeria.length > 0 && (
        <Card padding="lg" className="space-y-3">
          <h3 className="text-sm font-semibold">Trabajos y planta</h3>
          <ArchivosVista archivos={m.galeria} />
        </Card>
      )}

      <Card padding="lg" className="space-y-3">
        <h3 className="flex items-center gap-1 text-sm font-semibold"><Star className="h-4 w-4 text-amber-400" aria-hidden="true" />Lo que dicen sus clientes</h3>
        {!resenas?.length ? <p className="text-sm text-muted-foreground">Todavía no tiene reseñas en Zarpi.</p>
          : <div className="space-y-3">{resenas.map((r) => <TarjetaResena key={r.id} r={r} />)}</div>}
      </Card>
    </div>
  );
}
