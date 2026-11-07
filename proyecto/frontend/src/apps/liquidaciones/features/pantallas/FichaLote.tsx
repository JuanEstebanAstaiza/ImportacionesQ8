import { useState } from "react";
import { toast } from "sonner";
import {
  CircleCheck, Clock, FileText, Info, LifeBuoy, Loader2, Lock, MapPin, ShieldCheck, ShoppingCart, Stethoscope, Truck,
} from "lucide-react";

import { Button, Card } from "@shared/ui/design-system";
import { Modal } from "@shared/ui/kit/Modal";
import { abrirArchivoEnPestana } from "@/utils/abrir-archivo";
import { liquidacionesService } from "@/services/liquidaciones.service";
import { InsigniaCondicion, InsigniaEstadoLote } from "@apps/liquidaciones/features/componentes/Insignias";
import { GaleriaLote } from "@apps/liquidaciones/features/componentes/MediosLote";
import { useAhora } from "@apps/liquidaciones/features/componentes/CuentaRegresiva";
import { CONDICIONES, ENTREGAS, cantidad, cop, porUnidad, tiempoRestante } from "@apps/liquidaciones/features/constantes";
import { useActivacion, useInvalidarLiquidaciones, useLote, useParametros } from "@apps/liquidaciones/features/useLiquidaciones";

function Dato({ icono, etiqueta, valor }: { icono: React.ReactNode; etiqueta: string; valor: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icono}</span>
      <div>
        <p className="text-[11px] text-muted-foreground">{etiqueta}</p>
        <p className="text-sm font-medium text-foreground">{valor}</p>
      </div>
    </div>
  );
}

/** Ficha de un lote con la compra en tres pasos del diseño (reserva → contacto y chat → cierre directo). */
export function FichaLote({
  loteId,
  puedeComprar,
  onReservado,
  onVerOperacion,
  onActivar,
  onReportar,
}: {
  loteId: string;
  /** El equipo de Zarpi ve la ficha pero no compra. */
  puedeComprar: boolean;
  onReservado: (operacionId: string) => void;
  onVerOperacion: (operacionId: string) => void;
  onActivar: () => void;
  onReportar?: (referencia: string) => void;
}) {
  const { data: lote, isLoading, error } = useLote(loteId);
  const { data: activacion } = useActivacion(puedeComprar);
  const { data: parametros } = useParametros();
  const invalidar = useInvalidarLiquidaciones();
  const ahora = useAhora();
  const [confirmando, setConfirmando] = useState(false);
  const [reservando, setReservando] = useState(false);

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando lote…</div>;
  }
  if (error || !lote) {
    return <Card><p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Este lote ya no está disponible."}</p></Card>;
  }

  const horas = parametros?.horas_para_confirmar ?? 48;
  const disponible = lote.estado === "publicado";

  async function reservar() {
    setReservando(true);
    try {
      const operacion = await liquidacionesService.reservar(lote!.id);
      toast.success("¡Lote reservado! Ya puedes coordinar con el vendedor.");
      setConfirmando(false);
      await invalidar();
      onReservado(operacion.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo reservar el lote");
      setConfirmando(false);
      await invalidar();
    } finally {
      setReservando(false);
    }
  }

  function alComprar() {
    if (activacion && !activacion.activa) {
      onActivar();
      return;
    }
    setConfirmando(true);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <GaleriaLote fotos={lote.fotos} videos={lote.videos} estado={lote.estado} nombre={lote.nombre} />
        <Card padding="sm">
          <p className="mb-1 text-sm font-semibold">Descripción</p>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{lote.descripcion || "Sin descripción."}</p>
          {lote.condicion !== "nuevo" && lote.detalle_condicion && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 dark:border-sky-500/30 dark:bg-sky-500/10">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-600 dark:text-sky-300" />
              <div>
                <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">Estado: {CONDICIONES[lote.condicion].label}</p>
                <p className="text-sm text-foreground">{lote.detalle_condicion}</p>
              </div>
            </div>
          )}
          {lote.ficha_tecnica && (
            <button
              type="button"
              onClick={() => void abrirArchivoEnPestana(lote.ficha_tecnica!.url, lote.ficha_tecnica!.nombre)}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline dark:text-accent"
            >
              <FileText className="h-4 w-4" /> Ver ficha técnica
            </button>
          )}
        </Card>
      </div>

      <div className="space-y-3">
        <Card padding="md">
          <div className="flex flex-wrap items-center gap-1.5">
            <InsigniaCondicion condicion={lote.condicion} />
            <InsigniaEstadoLote estado={lote.estado} />
          </div>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary dark:text-accent">{lote.categoria}</p>
          <h1 className="text-xl font-semibold text-foreground">{lote.nombre}</h1>

          <div className="mt-4 rounded-xl bg-muted/60 p-4">
            <p className="text-xs text-muted-foreground">Precio del lote completo</p>
            <p className="text-2xl font-semibold text-foreground">{cop(lote.precio_cop)}</p>
            <p className="text-xs text-muted-foreground">{cop(lote.precio_unidad_cop)} {porUnidad(lote)} · {cantidad(lote)}</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Dato icono={<MapPin className="h-4 w-4" />} etiqueta="Ciudad" valor={lote.ciudad} />
            <Dato icono={<Truck className="h-4 w-4" />} etiqueta="Entrega" valor={ENTREGAS[lote.entrega]} />
            <Dato icono={<Clock className="h-4 w-4" />} etiqueta="Cierre" valor={disponible ? `Cierra en ${tiempoRestante(lote.cierra_en, ahora)}` : "—"} />
            <Dato icono={<Stethoscope className="h-4 w-4" />} etiqueta="Registro sanitario" valor={lote.requiere_registro_sanitario ? (lote.registro_sanitario || "Sí") : "No aplica"} />
          </div>

          {lote.mi_operacion_id ? (
            <Button className="mt-4" fullWidth size="lg" onClick={() => onVerOperacion(lote.mi_operacion_id!)}>Ver mi operación</Button>
          ) : lote.es_mio ? (
            <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">Es una publicación de tu empresa.</p>
          ) : puedeComprar ? (
            <>
              <Button
                variant="acento" className="mt-4"
                fullWidth
                size="lg"
                disabled={!disponible}
                icon={<ShoppingCart className="h-4 w-4" />}
                onClick={alComprar}
              >
                {disponible ? "Comprar lote" : lote.estado === "reservado" ? "Reservado por otro comprador" : "No disponible"}
              </Button>
              {disponible && <p className="mt-2 text-center text-[11px] text-muted-foreground">Al dar clic reservas el lote y se abre el chat con el vendedor.</p>}
            </>
          ) : null}
        </Card>

        <Card padding="sm" className="flex items-center gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary dark:bg-accent/15 dark:text-accent">
            {(lote.vendedor.razon_social || "?").split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1 truncate text-sm font-semibold">{lote.vendedor.razon_social}<CircleCheck className="h-3.5 w-3.5 text-emerald-500" /></p>
            <p className="text-xs text-muted-foreground">NIT {lote.vendedor.nit}{lote.vendedor.ciudad ? ` · ${lote.vendedor.ciudad}` : ""}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground"><Lock className="h-3 w-3" />Teléfono, correo y dirección se muestran a las dos partes cuando reservas el lote.</p>
          </div>
        </Card>

        <Card padding="sm" className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Revisado por Zarpi</span> significa que revisamos la publicación: fotos reales,
            estado declarado, producto permitido y precio coherente. No garantizamos la mercancía. El pago y la entrega se acuerdan
            directamente con el vendedor, que emite la factura.
          </p>
        </Card>

        {onReportar && !lote.es_mio && (
          <button type="button" onClick={() => onReportar(`lote:${lote.id}`)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <LifeBuoy className="h-3.5 w-3.5" /> Reportar esta publicación
          </button>
        )}
      </div>

      <Modal open={confirmando} onClose={() => !reservando && setConfirmando(false)} title="Comprar este lote">
        <div className="rounded-lg bg-muted/60 px-3 py-2">
          <p className="text-sm font-semibold">{lote.nombre}</p>
          <p className="text-xs text-muted-foreground">{cantidad(lote)} · {cop(lote.precio_cop)}</p>
        </div>
        <ol className="mt-4 space-y-3">
          {[
            "El lote queda reservado a tu nombre y marcado como «Reservado».",
            "Ves los datos de contacto del vendedor y se abre el chat de la operación, que queda registrado.",
            `Acuerdan el pago y la entrega directamente. El vendedor factura. Si no se cierra en ${horas} horas o alguno cancela, el lote vuelve a estar disponible.`,
          ].map((paso, i) => (
            <li key={paso} className="flex items-start gap-2.5 text-sm">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-black">{i + 1}</span>
              {paso}
            </li>
          ))}
        </ol>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmando(false)} disabled={reservando}>Cancelar</Button>
          <Button variant="acento" loading={reservando} onClick={() => void reservar()}>Sí, comprar lote</Button>
        </div>
      </Modal>
    </div>
  );
}
