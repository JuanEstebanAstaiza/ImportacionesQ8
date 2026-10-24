import { CircleCheck, CirclePlus, Hourglass, Loader2, Bookmark, Tag } from "lucide-react";

import { Button, Card } from "@/components/design-system";
import { InsigniaEstadoLote } from "@/features/liquidaciones/componentes/Insignias";
import { FotoLote } from "@/features/liquidaciones/componentes/MediosLote";
import { useAhora } from "@/features/liquidaciones/componentes/CuentaRegresiva";
import { cantidad, cop, tiempoRestante } from "@/features/liquidaciones/constantes";
import { useMisLotes, useParametros } from "@/features/liquidaciones/useLiquidaciones";
import type { Lote } from "@/features/liquidaciones/tipos";

function Contador({ icono, valor, etiqueta, tono }: { icono: React.ReactNode; valor: number; etiqueta: string; tono: string }) {
  return (
    <Card padding="sm" className="flex items-center gap-3">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tono}`}>{icono}</span>
      <div>
        <p className="text-lg font-semibold leading-none">{valor}</p>
        <p className="mt-1 text-xs text-muted-foreground">{etiqueta}</p>
      </div>
    </Card>
  );
}

/** Panel del vendedor: contadores por estado y la lista de sus lotes con la acción que toca en cada uno. */
export function MisLiquidaciones({
  empresa,
  onPublicar,
  onEditar,
  onVerLote,
  onVerOperacion,
}: {
  empresa: string;
  onPublicar: () => void;
  onEditar: (id: string) => void;
  onVerLote: (id: string) => void;
  onVerOperacion: (id: string) => void;
}) {
  const { data, isLoading, error } = useMisLotes();
  const { data: parametros } = useParametros();
  const ahora = useAhora();
  const horas = parametros?.horas_para_confirmar ?? 48;

  function detalle(lote: Lote) {
    switch (lote.estado) {
      case "reservado":
        return lote.operacion ? `Quedan ${tiempoRestante(lote.operacion.vence_en, ahora)} para marcarlo vendido` : "Reservado";
      case "en_revision":
        return "El equipo de Zarpi la está revisando";
      case "publicado":
        return `Cierra en ${tiempoRestante(lote.cierra_en, ahora)}${lote.destacado ? " · Destacada" : ""}`;
      case "rechazado":
        return lote.rechazo?.motivos.join("; ") || "Revisa los comentarios del equipo";
      case "vendido":
        return "Operación cerrada";
      default:
        return "Llegó la fecha de cierre";
    }
  }

  function acciones(lote: Lote) {
    if (lote.estado === "reservado" && lote.operacion) {
      return <Button size="sm" variant="acento" onClick={() => onVerOperacion(lote.operacion!.id)}>Ver operación</Button>;
    }
    if (lote.estado === "publicado") return <Button size="sm" variant="secondary" onClick={() => onVerLote(lote.id)}>Ver publicación</Button>;
    if (lote.estado === "rechazado" || lote.estado === "en_revision") {
      return <Button size="sm" variant="secondary" onClick={() => onEditar(lote.id)}>{lote.estado === "rechazado" ? "Corregir y reenviar" : "Editar"}</Button>;
    }
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Mis liquidaciones</h1>
          <p className="text-sm text-muted-foreground">Lotes publicados por {empresa || "tu empresa"}</p>
        </div>
        <Button variant="acento" icon={<CirclePlus className="h-4 w-4" />} onClick={onPublicar}>Publicar liquidación</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Contador icono={<Tag className="h-4 w-4" />} valor={data?.contadores.disponibles ?? 0} etiqueta="Disponibles" tono="bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" />
        <Contador icono={<Hourglass className="h-4 w-4" />} valor={data?.contadores.pendientes ?? 0} etiqueta="Pendientes de revisión" tono="bg-amber-500/10 text-amber-600 dark:text-amber-300" />
        <Contador icono={<Bookmark className="h-4 w-4" />} valor={data?.contadores.reservadas ?? 0} etiqueta="Reservadas" tono="bg-violet-500/10 text-violet-600 dark:text-violet-300" />
        <Contador icono={<CircleCheck className="h-4 w-4" />} valor={data?.contadores.vendidas ?? 0} etiqueta="Vendidas" tono="bg-slate-500/10 text-slate-600 dark:text-slate-300" />
      </div>

      <Card padding="none">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Lotes</p>
          <p className="text-xs text-muted-foreground">Tienes {horas} horas para marcar como vendido un lote reservado. Si no, vuelve a estar disponible.</p>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>
        ) : error ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">{error instanceof Error ? error.message : "No se pudieron cargar tus lotes."}</p>
        ) : !data || data.lotes.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">Aún no has publicado lotes.</p>
            <button type="button" onClick={onPublicar} className="mt-2 text-sm font-medium text-primary hover:underline dark:text-accent">Publica tu primera liquidación</button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data.lotes.map((lote) => (
              <li key={lote.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-border">
                  <FotoLote foto={lote.fotos[0]} alt={lote.nombre} className="h-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{lote.nombre}</p>
                  <p className="text-xs text-muted-foreground">{cantidad(lote)} · {cop(lote.precio_cop)} · {lote.ciudad}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 text-right">
                  <InsigniaEstadoLote estado={lote.estado} />
                  <p className="max-w-[260px] text-[11px] text-muted-foreground">{detalle(lote)}</p>
                  {lote.estado === "rechazado" && lote.rechazo?.nota && <p className="max-w-[260px] text-[11px] italic text-muted-foreground">«{lote.rechazo.nota}»</p>}
                </div>
                <div className="flex gap-2">{acciones(lote)}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
