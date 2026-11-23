import { useState } from "react";
import { EyeOff, Loader2, MessageSquareReply, Star } from "lucide-react";
import { toast } from "sonner";

import { Button, Card, Textarea } from "@shared/ui/design-system";
import { maquilasService } from "@/services/maquilas.service";
import { mensajeDeError } from "@apps/maquilas/features/errores";
import { fecha } from "@apps/maquilas/features/formato";
import { useInvalidarMaquilas, useMisResenas } from "@apps/maquilas/features/useMaquilas";
import { Estrellas } from "@apps/maquilas/features/componentes/Estrellas";
import { MetricasMaquila } from "@apps/maquilas/features/componentes/MetricasMaquila";
import type { Resena } from "@apps/maquilas/features/tipos";

const DIMENSIONES = [
  { clave: "puntualidad", etiqueta: "Puntualidad" },
  { clave: "calidad", etiqueta: "Calidad" },
  { clave: "comunicacion", etiqueta: "Comunicación" },
] as const;

/** Una reseña con sus estrellas por dimensión y la respuesta de la maquila. */
export function TarjetaResena({ r, onResponder }: { r: Resena; onResponder?: (texto: string) => Promise<void> }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  return (
    <article className="space-y-2 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Estrellas valor={r.calificacion} />
          <span className="text-sm font-medium">{r.autor}</span>
          {r.producto && <span className="text-xs text-muted-foreground">· {r.producto}</span>}
        </div>
        <span className="text-xs text-muted-foreground">{fecha(r.creado_en)}</span>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {DIMENSIONES.map((d) => <span key={d.clave}>{d.etiqueta}: {r[d.clave]}/5</span>)}
      </p>
      {r.comentario && <p className="whitespace-pre-line text-sm">{r.comentario}</p>}
      {r.oculta && <p className="flex items-center gap-1 text-xs text-destructive"><EyeOff className="h-3.5 w-3.5" />Oculta por Zarpi: {r.oculta.motivo}</p>}
      {r.respuesta ? (
        <div className="rounded-lg bg-muted px-3 py-2 text-sm"><p className="text-xs font-medium text-muted-foreground">Respuesta de la maquila</p>{r.respuesta.texto}</div>
      ) : onResponder ? (
        <div className="space-y-2">
          <Textarea label="Responder (una sola vez, se ve en tu perfil)" rows={2} value={texto} maxLength={1000} onChange={(e) => setTexto(e.target.value)} />
          <Button size="sm" icon={<MessageSquareReply className="h-3.5 w-3.5" />} disabled={texto.trim().length < 2} loading={enviando}
            onClick={() => { setEnviando(true); void onResponder(texto.trim()).finally(() => setEnviando(false)); }}>Publicar respuesta</Button>
        </div>
      ) : null}
    </article>
  );
}

/** Reseñas que dejaron los clientes de la maquila y sus métricas públicas. */
export function ResenasMaquila() {
  const { data, isLoading, error } = useMisResenas();
  const invalidar = useInvalidarMaquilas();

  async function responder(id: string, texto: string) {
    try {
      await maquilasService.responderResena(id, texto);
      await invalidar();
      toast.success("Publicamos tu respuesta");
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }

  if (isLoading) return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>;
  if (error || !data) return <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error)}</p></Card>;
  const m = data.metricas;

  return (
    <div className="space-y-5">
      <Card padding="lg" className="space-y-3">
        <h2 className="font-semibold">Lo que ven los clientes en tu perfil</h2>
        <MetricasMaquila metricas={m} />
        {m.resenas > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {DIMENSIONES.map((d) => (
              <div key={d.clave} className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">{d.etiqueta}</p>
                <p className="flex items-center gap-1 text-lg font-semibold"><Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />{m[d.clave]?.toLocaleString("es-CO") ?? "—"}</p>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">«A tiempo» compara la fecha en que el cliente confirmó la entrega con la fecha comprometida del pedido.</p>
      </Card>
      {!data.resenas.length ? (
        <Card padding="lg" className="text-center">
          <Star className="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">Aún no tienes reseñas</p>
          <p className="text-sm text-muted-foreground">El cliente puede calificarte cuando confirma que recibió el pedido.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.resenas.map((r) => <TarjetaResena key={r.id} r={r} onResponder={(t) => responder(r.id, t)} />)}
        </div>
      )}
    </div>
  );
}
