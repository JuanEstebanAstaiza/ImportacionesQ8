import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Star } from "lucide-react";

import {
  businessService,
  type BackendResena,
  type BackendResumenResenas,
} from "@/services/business.service";

/**
 * Reseñas públicas de una empresa importadora.
 *
 * `Importador.calificacion_promedio` existía como columna desde el principio,
 * pero nadie la escribía: el catálogo mostraba un número que no venía de
 * ninguna experiencia real. Este bloque enseña de dónde sale la nota — quién
 * la puso, cuándo y por qué — y deja a la empresa responder.
 */

function Estrellas({ valor, tamano = "sm" }: { valor: number; tamano?: "sm" | "md" | "lg" }) {
  const clase = tamano === "lg" ? "w-5 h-5" : tamano === "md" ? "w-4 h-4" : "w-3.5 h-3.5";
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${valor} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((estrella) => (
        <Star
          key={estrella}
          className={`${clase} ${estrella <= Math.round(valor) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
        />
      ))}
    </span>
  );
}

function formatearFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function BarraDeReparto({ estrellas, cantidad, total }: { estrellas: number; cantidad: number; total: number }) {
  const porcentaje = total > 0 ? Math.round((cantidad / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-8 text-muted-foreground tabular-nums">{estrellas}★</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${porcentaje}%` }} />
      </div>
      <span className="w-8 text-right text-muted-foreground tabular-nums">{cantidad}</span>
    </div>
  );
}

function Dimension({ etiqueta, valor }: { etiqueta: string; valor?: number | null }) {
  if (valor === null || valor === undefined) {
    return null;
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{etiqueta}</span>
      <span className="flex items-center gap-1.5">
        <Estrellas valor={valor} />
        <span className="text-xs font-medium tabular-nums">{valor.toFixed(1)}</span>
      </span>
    </div>
  );
}

export function ResenasImportador({
  importadorId,
  /** Cuando la mira la propia empresa, puede responder cada reseña. */
  puedeResponder = false,
}: {
  importadorId: string;
  puedeResponder?: boolean;
}) {
  const [resumen, setResumen] = useState<BackendResumenResenas | null>(null);
  const [resenas, setResenas] = useState<BackendResena[]>([]);
  const [cargando, setCargando] = useState(true);
  const [respondiendo, setRespondiendo] = useState<string | null>(null);
  const [borradorRespuesta, setBorradorRespuesta] = useState("");
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    if (!importadorId) {
      return;
    }
    setCargando(true);
    try {
      const [datosResumen, lista] = await Promise.all([
        businessService.getImporterReviewsSummary(importadorId),
        businessService.listImporterReviews(importadorId),
      ]);
      setResumen(datosResumen);
      setResenas(lista);
    } catch {
      // Un fallo al leer las reseñas no debe tumbar la ficha de la empresa.
      setResumen(null);
      setResenas([]);
    } finally {
      setCargando(false);
    }
  }, [importadorId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function enviarRespuesta(resenaId: string) {
    if (!borradorRespuesta.trim()) {
      return;
    }
    setError("");
    try {
      await businessService.replyToReview(resenaId, borradorRespuesta.trim());
      setRespondiendo(null);
      setBorradorRespuesta("");
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo publicar la respuesta.");
    }
  }

  if (cargando) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Cargando reseñas…</div>;
  }

  const total = resumen?.total ?? 0;

  return (
    <div className="space-y-5">
      {total === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <Star className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm font-medium">Todavía no hay reseñas</p>
          <p className="text-xs text-muted-foreground mt-1">
            Las publican los clientes que ya recibieron su importación con esta empresa.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-[auto_1fr_auto] items-center rounded-xl border border-border p-4">
            <div className="text-center sm:pr-5 sm:border-r border-border">
              <p className="text-3xl font-semibold tabular-nums">{resumen?.promedio.toFixed(1)}</p>
              <Estrellas valor={resumen?.promedio ?? 0} tamano="md" />
              <p className="text-xs text-muted-foreground mt-1">
                {total} {total === 1 ? "reseña" : "reseñas"}
              </p>
            </div>

            <div className="space-y-1">
              {[5, 4, 3, 2, 1].map((estrellas) => (
                <BarraDeReparto
                  key={estrellas}
                  estrellas={estrellas}
                  cantidad={resumen?.reparto?.[String(estrellas)] ?? 0}
                  total={total}
                />
              ))}
            </div>

            <div className="space-y-2 sm:pl-5 sm:border-l border-border min-w-[180px]">
              <Dimension etiqueta="Puntualidad" valor={resumen?.puntualidad} />
              <Dimension etiqueta="Calidad del producto" valor={resumen?.calidad_producto} />
              <Dimension etiqueta="Comunicación" valor={resumen?.comunicacion} />
            </div>
          </div>

          <div className="space-y-3">
            {resenas.map((resena) => (
              <article key={resena.id} className="rounded-xl border border-border p-4">
                <header className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <Estrellas valor={resena.calificacion} />
                      <span className="text-sm font-medium">{resena.autor_nombre}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Compra verificada · {formatearFecha(resena.fecha_creacion)}
                    </p>
                  </div>
                </header>

                {resena.comentario ? (
                  <p className="text-sm mt-3 leading-relaxed whitespace-pre-line">{resena.comentario}</p>
                ) : null}

                {resena.respuesta_empresa ? (
                  <div className="mt-3 pl-3 border-l-2 border-primary/30">
                    <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3" />
                      Respuesta de la empresa
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{resena.respuesta_empresa}</p>
                  </div>
                ) : puedeResponder ? (
                  respondiendo === resena.id ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        rows={3}
                        autoFocus
                        value={borradorRespuesta}
                        onChange={(evento) => setBorradorRespuesta(evento.target.value)}
                        placeholder="Responde públicamente a este cliente…"
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { void enviarRespuesta(resena.id); }}
                          disabled={!borradorRespuesta.trim()}
                          className="h-8 px-3 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50"
                        >
                          Publicar respuesta
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRespondiendo(null); setBorradorRespuesta(""); }}
                          className="h-8 px-3 rounded-lg border border-border text-xs font-medium"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setRespondiendo(resena.id); setBorradorRespuesta(""); }}
                      className="mt-3 text-xs font-medium text-primary hover:underline"
                    >
                      Responder
                    </button>
                  )
                ) : null}
              </article>
            ))}
          </div>
        </>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export { Estrellas };
