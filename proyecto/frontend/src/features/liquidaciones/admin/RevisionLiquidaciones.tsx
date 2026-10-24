import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { clsx } from "clsx";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, ClipboardCheck, CircleX, FileText, Inbox, Loader2, ShieldCheck } from "lucide-react";

import { Button, Textarea } from "@/components/design-system";
import { Modal } from "@/components/ui/Modal";
import { abrirArchivoEnPestana } from "@/utils/abrir-archivo";
import { liquidacionesService } from "@/services/liquidaciones.service";
import { InsigniaCondicion } from "@/features/liquidaciones/componentes/Insignias";
import { FotoLote, VideoLote } from "@/features/liquidaciones/componentes/MediosLote";
import { useAhora } from "@/features/liquidaciones/componentes/CuentaRegresiva";
import { ENTREGAS, cantidad, cop, porUnidad } from "@/features/liquidaciones/constantes";
import { useInvalidarLiquidaciones } from "@/features/liquidaciones/useLiquidaciones";
import type { Lote, MedioRef } from "@/features/liquidaciones/tipos";

const CLAVE_COLA = ["liquidaciones", "admin", "revision"] as const;

/** «hace 5 min», «hace 3 h», «hace 2 d»: lo que importa en la cola es cuánto lleva esperando. */
function haceCuanto(iso: string | null | undefined, ahora: number): string {
  if (!iso) return "";
  const ms = ahora - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const min = Math.max(Math.floor(ms / 60000), 0);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

function mensajeError(error: unknown, defecto: string): string {
  return error instanceof Error && error.message ? error.message : defecto;
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-border px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{etiqueta}</p>
      <div className="mt-0.5 text-sm text-foreground">{children}</div>
    </div>
  );
}

export function RevisionLiquidaciones() {
  const ahora = useAhora();
  const invalidar = useInvalidarLiquidaciones();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: CLAVE_COLA,
    queryFn: liquidacionesService.colaRevision,
    refetchInterval: 60_000,
  });

  // El backend ya las ordena, pero se reordena aquí para que la promesa
  // «las más antiguas primero» no dependa de ello.
  const lotes = useMemo(
    () => [...(data?.lotes ?? [])].sort((a, b) => (a.enviado_en ?? "").localeCompare(b.enviado_en ?? "")),
    [data],
  );
  const checklist = data?.parametros.checklist_revision ?? [];
  const motivos = data?.parametros.motivos_rechazo ?? [];

  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<number[]>([]);
  const [aprobando, setAprobando] = useState(false);
  const [rechazoAbierto, setRechazoAbierto] = useState(false);
  const [motivosElegidos, setMotivosElegidos] = useState<string[]>([]);
  const [nota, setNota] = useState("");
  const [rechazando, setRechazando] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState<MedioRef | null>(null);

  const lote: Lote | undefined = lotes.find((l) => l.id === seleccionId) ?? lotes[0];

  // La lista de revisión es por lote: cambiar de lote obliga a revisarlo de nuevo.
  useEffect(() => {
    setMarcados([]);
  }, [lote?.id]);

  const todoRevisado = checklist.length === 0 || checklist.every((_, i) => marcados.includes(i));

  /** Tras decidir, se pasa al siguiente de la cola para no perder el ritmo. */
  function avanzar(actualId: string) {
    const indice = lotes.findIndex((l) => l.id === actualId);
    const siguiente = lotes[indice + 1] ?? lotes[indice - 1] ?? null;
    setSeleccionId(siguiente?.id ?? null);
    void invalidar();
    void refetch();
  }

  async function aprobar() {
    if (!lote) return;
    setAprobando(true);
    try {
      await liquidacionesService.aprobar(lote.id);
      toast.success(`«${lote.nombre}» quedó publicado`);
      avanzar(lote.id);
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo aprobar la liquidación."));
    } finally {
      setAprobando(false);
    }
  }

  async function rechazar() {
    if (!lote || motivosElegidos.length === 0) return;
    setRechazando(true);
    try {
      await liquidacionesService.rechazar(lote.id, motivosElegidos, nota.trim() || undefined);
      toast.success("Liquidación devuelta al vendedor con los motivos");
      setRechazoAbierto(false);
      setMotivosElegidos([]);
      setNota("");
      avanzar(lote.id);
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo rechazar la liquidación."));
    } finally {
      setRechazando(false);
    }
  }

  function alternarMotivo(motivo: string) {
    setMotivosElegidos((actuales) =>
      actuales.includes(motivo) ? actuales.filter((m) => m !== motivo) : [...actuales, motivo],
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div>
          <p className="flex items-center gap-2 text-base font-semibold">
            <ClipboardCheck className="h-4 w-4 text-primary dark:text-accent" />
            Revisión de liquidaciones
          </p>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Cargando cola…" : `${lotes.length} ${lotes.length === 1 ? "liquidación pendiente" : "liquidaciones pendientes"} · Las más antiguas primero`}
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 px-1 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando liquidaciones…</p>
      ) : error ? (
        <div className="rounded-xl border border-border bg-white p-6 text-center text-sm text-muted-foreground shadow-sm">
          No pudimos cargar la cola de revisión. {mensajeError(error, "")}
        </div>
      ) : !lote ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-10 text-center shadow-sm">
          <Inbox className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No hay liquidaciones pendientes</p>
          <p className="text-sm text-muted-foreground">Cuando una empresa envíe un lote a revisión aparecerá aquí.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* Cola */}
          <div className="rounded-xl border border-border bg-white p-2 shadow-sm lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto">
            {lotes.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setSeleccionId(l.id)}
                className={clsx(
                  "flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition",
                  l.id === lote.id ? "bg-primary/10 dark:bg-accent/15" : "hover:bg-muted",
                )}
              >
                <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-amber-500" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{l.nombre}</span>
                  <span className="block truncate text-xs text-muted-foreground">{l.vendedor.razon_social || "Vendedor sin nombre"}</span>
                  <span className="block text-[11px] text-muted-foreground/80">Enviada {haceCuanto(l.enviado_en, ahora)}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Detalle */}
          <div className="space-y-4 rounded-xl border border-border bg-white p-5 shadow-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{lote.categoria}</p>
              <h2 className="mt-0.5 text-lg font-semibold text-foreground">{lote.nombre}</h2>
              <p className="text-sm text-muted-foreground">
                {lote.vendedor.razon_social || "Vendedor sin nombre"}{lote.vendedor.nit ? ` · NIT ${lote.vendedor.nit}` : ""}
              </p>
            </div>

            {(lote.fotos.length > 0 || lote.videos.length > 0) && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {lote.fotos.map((foto, i) => (
                  <button
                    key={foto.id}
                    type="button"
                    onClick={() => setFotoAmpliada(foto)}
                    className="aspect-square overflow-hidden rounded-lg border border-border bg-white hover:border-primary/50 dark:hover:border-accent/50"
                    aria-label={`Ampliar foto ${i + 1}`}
                  >
                    <FotoLote foto={foto} alt={`${lote.nombre} ${i + 1}`} className="h-full object-cover" />
                  </button>
                ))}
                {lote.videos.map((video) => (
                  <VideoLote key={video.id} video={video} estado={lote.estado} className="col-span-2 aspect-video w-full rounded-lg" />
                ))}
              </div>
            )}

            <p className="whitespace-pre-line text-sm text-foreground">{lote.descripcion}</p>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <Dato etiqueta="Unidades">{cantidad(lote)}</Dato>
              <Dato etiqueta="Estado">
                <InsigniaCondicion condicion={lote.condicion} />
                {lote.detalle_condicion && <p className="mt-1 text-xs text-muted-foreground">{lote.detalle_condicion}</p>}
              </Dato>
              <Dato etiqueta="Precio del lote"><span className="font-semibold">{cop(lote.precio_cop)}</span></Dato>
              <Dato etiqueta="Precio por unidad">{cop(lote.precio_unidad_cop)} <span className="text-xs text-muted-foreground">{porUnidad(lote)}</span></Dato>
              <Dato etiqueta="Ciudad">{lote.ciudad}</Dato>
              <Dato etiqueta="Entrega">{ENTREGAS[lote.entrega] ?? lote.entrega}</Dato>
              <Dato etiqueta="Registro sanitario">{lote.registro_sanitario || "No aplica"}</Dato>
              <Dato etiqueta="Cierre">{lote.dias_cierre} {lote.dias_cierre === 1 ? "día" : "días"} después de publicar</Dato>
              <Dato etiqueta="Destacado">{lote.destacado ? "Sí" : "No"}</Dato>
            </div>

            {lote.ficha_tecnica && (
              <button
                type="button"
                onClick={() => void abrirArchivoEnPestana(lote.ficha_tecnica?.url, lote.ficha_tecnica?.nombre)}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                <FileText className="h-4 w-4 text-primary dark:text-accent" />
                {lote.ficha_tecnica.nombre || "Ficha técnica"}
              </button>
            )}

            <div className="border-t border-border pt-4">
              <p className="mb-2 text-sm font-semibold">Lista de revisión</p>
              <ul className="space-y-1.5">
                {checklist.map((punto, i) => (
                  <li key={punto}>
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={marcados.includes(i)}
                        onChange={() => setMarcados((m) => (m.includes(i) ? m.filter((x) => x !== i) : [...m, i]))}
                        className="h-4 w-4 accent-primary"
                      />
                      {punto}
                    </label>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button variant="danger" icon={<CircleX className="h-4 w-4" />} onClick={() => setRechazoAbierto(true)} disabled={aprobando}>
                  Rechazar
                </Button>
                <Button icon={<CircleCheck className="h-4 w-4" />} onClick={() => void aprobar()} loading={aprobando} disabled={!todoRevisado}>
                  Aprobar y publicar
                </Button>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Al aprobar se publica con la etiqueta «Revisado por Zarpi»
              </p>
            </div>
          </div>
        </div>
      )}

      <Modal open={rechazoAbierto} onClose={() => !rechazando && setRechazoAbierto(false)} title="Rechazar liquidación">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">El vendedor verá el motivo y podrá corregir y volver a enviar.</p>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Motivos</p>
            {motivos.map((motivo) => {
              const activo = motivosElegidos.includes(motivo);
              return (
                <button
                  key={motivo}
                  type="button"
                  onClick={() => alternarMotivo(motivo)}
                  aria-pressed={activo}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition",
                    activo ? "border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-300" : "border-border hover:bg-muted",
                  )}
                >
                  <span className={clsx("h-3.5 w-3.5 flex-shrink-0 rounded border", activo ? "border-rose-500 bg-rose-500" : "border-border")} />
                  {motivo}
                </button>
              );
            })}
          </div>
          <Textarea label="Nota para el vendedor (opcional)" rows={3} maxLength={1000} value={nota} onChange={(e) => setNota(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRechazoAbierto(false)} disabled={rechazando}>Cancelar</Button>
            <Button variant="danger" onClick={() => void rechazar()} loading={rechazando} disabled={motivosElegidos.length === 0}>Rechazar</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(fotoAmpliada)} onClose={() => setFotoAmpliada(null)} title={lote?.nombre ?? "Foto"} width="max-w-3xl">
        {fotoAmpliada && <FotoLote foto={fotoAmpliada} alt={lote?.nombre ?? ""} className="max-h-[70vh] object-contain" />}
      </Modal>
    </div>
  );
}
