import { useState } from "react";
import { Eye, EyeOff, Loader2, Tag } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

import { Button, Card } from "@shared/ui/design-system";
import { ImagenArchivo } from "@shared/ui/files/ImagenArchivo";
import { maquilasService } from "@/services/maquilas.service";
import { mensajeDeError } from "@apps/maquilas/features/errores";
import { pesos, unidades } from "@apps/maquilas/features/formato";
import { useInvalidarMaquilas, useProductosAdmin, useResenasAdmin } from "@apps/maquilas/features/useMaquilas";
import { MotivoModal } from "@apps/maquilas/features/componentes/MotivoModal";
import { TarjetaResena } from "@apps/maquilas/features/pantallas/ResenasMaquila";

type Pestana = "productos" | "resenas";
type Filtro = "todos" | "visibles" | "ocultos";

function filtroABool(f: Filtro): boolean | undefined {
  return f === "todos" ? undefined : f === "ocultos";
}

function Filtros({ valor, onCambiar, etiquetas }: { valor: Filtro; onCambiar: (f: Filtro) => void; etiquetas: Record<Filtro, string> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(etiquetas) as Filtro[]).map((f) => (
        <button key={f} type="button" aria-pressed={valor === f} onClick={() => onCambiar(f)}
          className={clsx("rounded-full border px-3 py-1 text-xs font-medium", valor === f ? "border-primary bg-primary/10 text-primary dark:border-accent dark:bg-accent/15 dark:text-accent" : "border-border text-muted-foreground")}>
          {etiquetas[f]}
        </button>
      ))}
    </div>
  );
}

function Productos() {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const { data, isLoading, error } = useProductosAdmin({ ocultos: filtroABool(filtro) });
  const invalidar = useInvalidarMaquilas();
  const [ocultando, setOcultando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function ejecutar(fn: () => Promise<unknown>, exito: string) {
    setOcupado(true);
    try { await fn(); await invalidar(); toast.success(exito); } catch (e) { toast.error(mensajeDeError(e)); } finally { setOcupado(false); setOcultando(null); }
  }

  return (
    <div className="space-y-4">
      <Filtros valor={filtro} onCambiar={setFiltro} etiquetas={{ todos: "Todos", visibles: "Sin ocultar", ocultos: "Ocultos" }} />
      {isLoading ? <div className="flex items-center justify-center py-12 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>
        : error ? <p className="text-sm text-destructive">{mensajeDeError(error)}</p>
        : !data?.length ? <p className="py-8 text-center text-sm text-muted-foreground">No hay productos.</p>
        : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {data.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                  {p.fotos[0] ? <ImagenArchivo src={p.fotos[0].url} alt={p.nombre} className="absolute inset-0 h-full w-full object-cover" />
                    : <Tag className="m-auto mt-5 h-6 w-6 text-muted-foreground" aria-hidden="true" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.nombre}</p>
                  <p className="text-xs text-muted-foreground">{p.maquiladora.nombre_comercial} · {p.categoria_nombre} · desde {unidades(p.pedido_minimo)} · {pesos(p.precio_desde)} c/u · {p.activo ? "publicado" : "borrador"}</p>
                  {p.oculto && <p className="text-xs text-destructive">Oculto: {p.oculto.motivo}</p>}
                </div>
                {p.oculto ? (
                  <Button size="sm" variant="secondary" icon={<Eye className="h-3.5 w-3.5" />} disabled={ocupado}
                    onClick={() => void ejecutar(() => maquilasService.mostrarProducto(p.id), "Producto visible otra vez")}>Mostrar</Button>
                ) : (
                  <Button size="sm" variant="ghost" icon={<EyeOff className="h-3.5 w-3.5" />} onClick={() => setOcultando(p.id)}>Ocultar</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      <MotivoModal abierto={ocultando !== null} titulo="Ocultar el producto" textoBoton="Ocultar" ocupado={ocupado}
        descripcion="Sale del catálogo. La maquila recibe el motivo por correo y lo ve en su catálogo." onCerrar={() => setOcultando(null)}
        onConfirmar={(m) => void ejecutar(() => maquilasService.ocultarProducto(ocultando!, m), "Producto oculto")} />
    </div>
  );
}

function Resenas() {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [soloBajas, setSoloBajas] = useState(false);
  const { data, isLoading, error } = useResenasAdmin({ ocultas: filtroABool(filtro), maximo: soloBajas ? 2 : undefined });
  const invalidar = useInvalidarMaquilas();
  const [ocultando, setOcultando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function ejecutar(fn: () => Promise<unknown>, exito: string) {
    setOcupado(true);
    try { await fn(); await invalidar(); toast.success(exito); } catch (e) { toast.error(mensajeDeError(e)); } finally { setOcupado(false); setOcultando(null); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Filtros valor={filtro} onCambiar={setFiltro} etiquetas={{ todos: "Todas", visibles: "Publicadas", ocultos: "Ocultas" }} />
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={soloBajas} onChange={(e) => setSoloBajas(e.target.checked)} />Solo 1 y 2 estrellas</label>
      </div>
      {isLoading ? <div className="flex items-center justify-center py-12 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>
        : error ? <p className="text-sm text-destructive">{mensajeDeError(error)}</p>
        : !data?.length ? <p className="py-8 text-center text-sm text-muted-foreground">No hay reseñas.</p>
        : (
          <div className="space-y-3">
            {data.map((r) => (
              <div key={r.id} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{r.maquiladora}</p>
                <TarjetaResena r={r} />
                <div className="flex justify-end">
                  {r.oculta ? (
                    <Button size="sm" variant="secondary" icon={<Eye className="h-3.5 w-3.5" />} disabled={ocupado}
                      onClick={() => void ejecutar(() => maquilasService.mostrarResena(r.id), "Reseña publicada otra vez")}>Mostrar</Button>
                  ) : (
                    <Button size="sm" variant="ghost" icon={<EyeOff className="h-3.5 w-3.5" />} onClick={() => setOcultando(r.id)}>Ocultar</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      <MotivoModal abierto={ocultando !== null} titulo="Ocultar la reseña" textoBoton="Ocultar" ocupado={ocupado}
        descripcion="Deja de verse en el perfil y de contar en la calificación. Úsalo para datos personales, insultos o reseñas falsas, no para críticas legítimas."
        onCerrar={() => setOcultando(null)} onConfirmar={(m) => void ejecutar(() => maquilasService.ocultarResena(ocultando!, m), "Reseña oculta")} />
    </div>
  );
}

/** Maquilas › Moderación: productos de marca blanca y reseñas. */
export function ModeracionMaquilas() {
  const [pestana, setPestana] = useState<Pestana>("productos");
  return (
    <Card padding="lg" className="space-y-5">
      <div className="flex gap-2 border-b border-border" role="tablist" aria-label="Qué moderar">
        {([["productos", "Marca blanca"], ["resenas", "Reseñas"]] as const).map(([clave, etiqueta]) => (
          <button key={clave} type="button" role="tab" aria-selected={pestana === clave} onClick={() => setPestana(clave)}
            className={clsx("-mb-px border-b-2 px-3 py-2 text-sm font-medium", pestana === clave ? "border-primary text-primary dark:border-accent dark:text-accent" : "border-transparent text-muted-foreground")}>
            {etiqueta}
          </button>
        ))}
      </div>
      {pestana === "productos" ? <Productos /> : <Resenas />}
    </Card>
  );
}
