import { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, Send } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

import { Button } from "@shared/ui/design-system";
import { maquilasService } from "@/services/maquilas.service";
import { mensajeDeError } from "@apps/maquilas/features/errores";
import { fechaHora } from "@apps/maquilas/features/formato";
import { useInvalidarMaquilas, useMensajes } from "@apps/maquilas/features/useMaquilas";
import { ArchivosVista } from "@apps/maquilas/features/componentes/ArchivosVista";
import { SubirArchivoMaquila } from "@apps/maquilas/features/componentes/SubirArchivoMaquila";
import type { ArchivoMaquila } from "@apps/maquilas/features/tipos";

/**
 * Conversación entre el cliente y una maquila (de la negociación al pedido).
 * `miLado` alinea los mensajes; sin `puedeEscribir` queda en solo lectura.
 */
export function ChatHilo({ hilo, miLado, puedeEscribir = true, titulo = "Conversación", alto = "h-96" }: {
  hilo: string;
  miLado: "cliente" | "maquiladora" | "equipo";
  puedeEscribir?: boolean;
  titulo?: string;
  alto?: string;
}) {
  const { data: mensajes, isLoading, error } = useMensajes(hilo);
  const invalidar = useInvalidarMaquilas();
  const [texto, setTexto] = useState("");
  const [adjunto, setAdjunto] = useState<ArchivoMaquila | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fondo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fondo.current?.scrollTo({ top: fondo.current.scrollHeight });
  }, [mensajes?.length]);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!texto.trim() && !adjunto) return;
    setEnviando(true);
    try {
      await maquilasService.enviarMensaje(hilo, texto.trim(), adjunto?.id);
      setTexto("");
      setAdjunto(null);
      await invalidar();
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="flex flex-col rounded-2xl border border-border bg-card" aria-label={titulo}>
      <header className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{titulo}</h3>
      </header>
      <div ref={fondo} className={clsx("space-y-3 overflow-y-auto px-4 py-3", alto)}>
        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{mensajeDeError(error)}</p>
        ) : !mensajes?.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Todavía no hay mensajes.</p>
        ) : (
          mensajes.map((m) => m.tipo === "sistema" ? (
            <p key={m.id} className="mx-auto max-w-md rounded-full bg-muted px-3 py-1 text-center text-xs text-muted-foreground">
              {m.contenido} <span className="opacity-70">· {fechaHora(m.fecha)}</span>
            </p>
          ) : (
            <div key={m.id} className={clsx("flex", m.lado === miLado ? "justify-end" : "justify-start")}>
              <div className={clsx("max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                m.lado === miLado ? "bg-primary text-primary-foreground dark:bg-accent dark:text-accent-foreground" : "bg-muted")}>
                {m.lado !== miLado && <p className="mb-0.5 text-xs font-semibold opacity-80">{m.remitente_nombre}</p>}
                {m.contenido && <p className="whitespace-pre-line break-words">{m.contenido}</p>}
                {m.archivo && <div className="mt-2"><ArchivosVista archivos={[m.archivo]} tamano="sm" /></div>}
                <p className="mt-1 text-[10px] opacity-70">{fechaHora(m.fecha)}</p>
              </div>
            </div>
          ))
        )}
      </div>
      {puedeEscribir ? (
        // `relative`: la etiqueta `sr-only` es absoluta; sin un ancestro posicionado estiraba la página.
        <form onSubmit={enviar} className="relative space-y-2 border-t border-border p-3">
          {adjunto && <ArchivosVista archivos={[adjunto]} tamano="sm" onQuitar={() => setAdjunto(null)} />}
          <div className="flex items-end gap-2">
            <SubirArchivoMaquila tipo="adjunto" etiqueta="Adjuntar archivo (PDF o imagen)" compacto onSubido={setAdjunto} />
            <label className="sr-only" htmlFor={`mensaje-${hilo}`}>Mensaje</label>
            <textarea id={`mensaje-${hilo}`} value={texto} onChange={(e) => setTexto(e.target.value)} rows={1} maxLength={4000}
              placeholder="Escribe un mensaje…"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(e); } }}
              className="min-h-[38px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <Button type="submit" size="sm" loading={enviando} disabled={!texto.trim() && !adjunto} aria-label="Enviar mensaje"
              icon={<Send className="h-4 w-4" />} />
          </div>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Paperclip className="h-3 w-3" />Enter envía · Mayús+Enter salta de línea</p>
        </form>
      ) : (
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Solo lectura.</p>
      )}
    </section>
  );
}
