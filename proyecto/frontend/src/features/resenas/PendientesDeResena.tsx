import { useCallback, useEffect, useState } from "react";
import { Star, X } from "lucide-react";

import { businessService, type BackendOrdenResenable } from "@/services/business.service";

/**
 * Aviso y formulario para valorar las importaciones ya recibidas.
 *
 * El backend solo acepta reseñas de órdenes propias que llegaron a bodega o se
 * entregaron: es lo que hace que la nota del catálogo signifique algo. Aquí se
 * le recuerda al cliente cuáles tiene pendientes, porque nadie vuelve por su
 * cuenta a puntuar semanas después de recibir la mercancía.
 */

const DIMENSIONES = [
  { clave: "puntualidad", etiqueta: "Puntualidad en la entrega" },
  { clave: "calidad_producto", etiqueta: "Calidad del producto" },
  { clave: "comunicacion", etiqueta: "Comunicación durante el proceso" },
] as const;

function SelectorEstrellas({
  valor,
  onChange,
  tamano = "md",
}: {
  valor: number;
  onChange: (valor: number) => void;
  tamano?: "md" | "lg";
}) {
  const clase = tamano === "lg" ? "w-7 h-7" : "w-5 h-5";
  return (
    <div className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((estrella) => (
        <button
          key={estrella}
          type="button"
          aria-label={`${estrella} de 5`}
          onClick={() => onChange(estrella)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`${clase} ${estrella <= valor ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
          />
        </button>
      ))}
    </div>
  );
}

export function PendientesDeResena({ onPublicada }: { onPublicada?: () => void | Promise<void> }) {
  const [pendientes, setPendientes] = useState<BackendOrdenResenable[]>([]);
  const [activa, setActiva] = useState<BackendOrdenResenable | null>(null);
  const [calificacion, setCalificacion] = useState(0);
  const [comentario, setComentario] = useState("");
  const [detalle, setDetalle] = useState<Record<string, number>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      setPendientes(await businessService.listPendingReviews());
    } catch {
      // Solo aplica al rol solicitante; para el resto el endpoint responde 403
      // y sencillamente no hay nada que mostrar.
      setPendientes([]);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function abrir(orden: BackendOrdenResenable) {
    setActiva(orden);
    setCalificacion(0);
    setComentario("");
    setDetalle({});
    setError("");
  }

  async function publicar() {
    if (!activa || calificacion === 0) {
      setError("Elige cuántas estrellas le das a esta importación.");
      return;
    }

    setGuardando(true);
    setError("");
    try {
      await businessService.createReview({
        orden_id: activa.orden_id,
        calificacion,
        comentario: comentario.trim() || undefined,
        ...detalle,
      });
      setActiva(null);
      await cargar();
      await onPublicada?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo publicar la reseña.");
    } finally {
      setGuardando(false);
    }
  }

  if (pendientes.length === 0) {
    return null;
  }

  return (
    <>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <Star className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-900">
              {pendientes.length === 1
                ? "Tienes una importación sin valorar"
                : `Tienes ${pendientes.length} importaciones sin valorar`}
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              Tu experiencia es lo que ayuda al siguiente cliente a elegir empresa.
            </p>
            <div className="mt-3 space-y-2">
              {pendientes.slice(0, 3).map((orden) => (
                <div
                  key={orden.orden_id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white border border-amber-200 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{orden.producto}</p>
                    <p className="text-xs text-muted-foreground truncate">{orden.nombre_empresa}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => abrir(orden)}
                    className="h-8 px-3 rounded-lg bg-primary text-white text-xs font-medium flex-shrink-0"
                  >
                    Valorar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {activa ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
              <div>
                <h2 className="font-semibold">¿Qué tal fue tu importación?</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activa.producto} · {activa.nombre_empresa}
                </p>
              </div>
              <button type="button" onClick={() => setActiva(null)} aria-label="Cerrar">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </header>

            <div className="px-5 py-4 space-y-5">
              <div className="text-center">
                <p className="text-sm font-medium mb-2">Valoración general</p>
                <SelectorEstrellas valor={calificacion} onChange={setCalificacion} tamano="lg" />
              </div>

              <div className="space-y-3 pt-3 border-t border-border">
                <p className="text-sm font-medium">Detalle <span className="font-normal text-muted-foreground text-xs">(opcional)</span></p>
                {DIMENSIONES.map((dimension) => (
                  <div key={dimension.clave} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">{dimension.etiqueta}</span>
                    <SelectorEstrellas
                      valor={detalle[dimension.clave] ?? 0}
                      onChange={(valor) => setDetalle((actual) => ({ ...actual, [dimension.clave]: valor }))}
                    />
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-border">
                <label className="text-sm font-medium block mb-1.5" htmlFor="comentario-resena">
                  Cuéntalo con tus palabras <span className="font-normal text-muted-foreground text-xs">(opcional)</span>
                </label>
                <textarea
                  id="comentario-resena"
                  rows={4}
                  maxLength={2000}
                  value={comentario}
                  onChange={(evento) => setComentario(evento.target.value)}
                  placeholder="¿Cumplieron los plazos? ¿La calidad era la acordada? ¿Cómo fue la comunicación?"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>

            <footer className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <button
                type="button"
                onClick={() => setActiva(null)}
                className="h-9 px-4 rounded-lg border border-border text-sm font-medium"
              >
                Ahora no
              </button>
              <button
                type="button"
                onClick={() => { void publicar(); }}
                disabled={guardando}
                className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
              >
                {guardando ? "Publicando…" : "Publicar reseña"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
