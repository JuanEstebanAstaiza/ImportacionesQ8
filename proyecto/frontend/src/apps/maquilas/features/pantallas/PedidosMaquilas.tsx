import { useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Circle, CircleDot, Clock, LifeBuoy, Loader2, Package, PackageCheck, XCircle } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

import { Button, Card, Textarea } from "@shared/ui/design-system";
import { maquilasService } from "@/services/maquilas.service";
import { mensajeDeError } from "@apps/maquilas/features/errores";
import { fecha, fechaHora, pesos, unidades } from "@apps/maquilas/features/formato";
import { useInvalidarMaquilas, useParametrosMaquilas, usePedido, usePedidos } from "@apps/maquilas/features/useMaquilas";
import { ArchivosVista } from "@apps/maquilas/features/componentes/ArchivosVista";
import { ChatHilo } from "@apps/maquilas/features/componentes/ChatHilo";
import { MotivoModal } from "@apps/maquilas/features/componentes/MotivoModal";
import { SubirArchivoMaquila } from "@apps/maquilas/features/componentes/SubirArchivoMaquila";
import type { ArchivoMaquila, Pedido } from "@apps/maquilas/features/tipos";

const ESTILO: Record<string, string> = {
  muestra: "bg-sky-500/10 text-sky-800 dark:text-sky-300",
  produccion: "bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent",
  despachado: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  entregado: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  cancelado: "bg-muted text-muted-foreground",
};

const ESTILO_PAGO: Record<string, string> = {
  pendiente: "text-muted-foreground",
  enviado: "text-sky-700 dark:text-sky-300",
  confirmado: "text-emerald-700 dark:text-emerald-300",
  rechazado: "text-destructive",
};
const ETIQUETA_PAGO: Record<string, string> = { pendiente: "Pendiente", enviado: "Comprobante en revisión", confirmado: "Confirmado", rechazado: "Comprobante rechazado" };

function useAccion() {
  const invalidar = useInvalidarMaquilas();
  const [ocupado, setOcupado] = useState<string | null>(null);
  async function ejecutar(clave: string, fn: () => Promise<unknown>, exito?: string) {
    setOcupado(clave);
    try {
      await fn();
      await invalidar();
      if (exito) toast.success(exito);
      return true;
    } catch (e) {
      toast.error(mensajeDeError(e));
      return false;
    } finally {
      setOcupado(null);
    }
  }
  return { ocupado, ejecutar };
}

function SeccionMuestra({ p }: { p: Pedido }) {
  const { data: parametros } = useParametrosMaquilas();
  const { ocupado, ejecutar } = useAccion();
  const [archivos, setArchivos] = useState<ArchivoMaquila[]>([]);
  const [nota, setNota] = useState("");
  const [pidiendoAjustes, setPidiendoAjustes] = useState(false);

  return (
    <Card padding="lg" className="space-y-4">
      <div>
        <h3 className="font-semibold">Muestra</h3>
        <p className="text-sm text-muted-foreground">La producción arranca cuando el cliente aprueba la muestra.</p>
      </div>
      {p.muestras.length === 0 && <p className="text-sm text-muted-foreground">Todavía no se ha enviado la muestra.</p>}
      <ol className="space-y-3">
        {p.muestras.map((m) => (
          <li key={m.ronda} className="rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Ronda {m.ronda} · {fechaHora(m.enviada_en)}</p>
              <span className={clsx("text-xs font-medium", m.estado === "aprobada" ? "text-emerald-600" : m.estado === "ajustes" ? "text-amber-600" : "text-sky-600")}>
                {m.estado === "aprobada" ? "Aprobada" : m.estado === "ajustes" ? "Pidieron ajustes" : "Esperando respuesta del cliente"}
              </span>
            </div>
            {m.nota && <p className="mt-1 text-sm">{m.nota}</p>}
            <div className="mt-2"><ArchivosVista archivos={m.archivos} /></div>
            {m.comentario && <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm"><span className="font-medium">Cliente:</span> {m.comentario}</p>}
          </li>
        ))}
      </ol>

      {p.acciones.enviar_muestra && (
        <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
          <p className="text-sm font-medium">{p.muestras.length ? "Enviar una nueva ronda" : "Enviar la muestra"}</p>
          <SubirArchivoMaquila tipo="muestra" etiqueta="Subir fotos o video" multiple maxArchivos={8 - archivos.length} maxMb={parametros?.mb_max_video}
            disabled={archivos.length >= 8} onSubido={(a) => setArchivos((x) => [...x, a])} />
          <ArchivosVista archivos={archivos} onQuitar={(id) => setArchivos((x) => x.filter((a) => a.id !== id))} />
          <Textarea label="Nota para el cliente (opcional)" rows={2} value={nota} maxLength={1000} onChange={(e) => setNota(e.target.value)} />
          <Button disabled={!archivos.length} loading={ocupado === "muestra"}
            onClick={() => void ejecutar("muestra", () => maquilasService.enviarMuestra(p.id, archivos.map((a) => a.id), nota.trim()), "Enviaste la muestra")
              .then((ok) => { if (ok) { setArchivos([]); setNota(""); } })}>
            Enviar muestra
          </Button>
        </div>
      )}
      {p.acciones.responder_muestra && (
        <div className="flex flex-wrap gap-2">
          <Button icon={<CheckCircle2 className="h-4 w-4" />} loading={ocupado === "aprobar"}
            onClick={() => void ejecutar("aprobar", () => maquilasService.responderMuestra(p.id, true, ""), "Aprobaste la muestra: arranca la producción")}>
            Aprobar la muestra
          </Button>
          <Button variant="secondary" onClick={() => setPidiendoAjustes(true)}>Pedir ajustes</Button>
        </div>
      )}
      <MotivoModal abierto={pidiendoAjustes} titulo="Pedir ajustes a la muestra" etiqueta="Qué hay que ajustar" textoBoton="Enviar ajustes"
        ocupado={ocupado === "ajustes"} onCerrar={() => setPidiendoAjustes(false)}
        onConfirmar={(t) => void ejecutar("ajustes", () => maquilasService.responderMuestra(p.id, false, t), "Le pediste ajustes a la maquila")
          .then(() => setPidiendoAjustes(false))} />
    </Card>
  );
}

function SeccionEtapas({ p }: { p: Pedido }) {
  const { ocupado, ejecutar } = useAccion();
  const [nota, setNota] = useState("");
  const [fotos, setFotos] = useState<ArchivoMaquila[]>([]);
  const siguiente = p.acciones.completar_etapa;

  return (
    <Card padding="lg" className="space-y-4">
      <h3 className="font-semibold">Producción</h3>
      <ol className="space-y-3">
        {p.etapas.map((e) => (
          <li key={e.clave} className="flex gap-3">
            {e.estado === "hecha" ? <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500" aria-hidden="true" />
              : e.estado === "en_curso" ? <CircleDot className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary dark:text-accent" aria-hidden="true" />
              : <Circle className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />}
            <div className="min-w-0 flex-1">
              <p className={clsx("text-sm", e.estado === "pendiente" ? "text-muted-foreground" : "font-medium")}>
                {e.nombre}{e.estado === "en_curso" && <span className="ml-2 text-xs font-normal text-primary dark:text-accent">En curso</span>}
              </p>
              {e.completada_en && <p className="text-xs text-muted-foreground">{fechaHora(e.completada_en)}{e.nota ? ` · ${e.nota}` : ""}</p>}
              {e.fotos.length > 0 && <div className="mt-2"><ArchivosVista archivos={e.fotos} tamano="sm" /></div>}
              {siguiente === e.clave && (
                <div className="mt-3 space-y-3 rounded-xl border border-dashed border-border p-3">
                  <Textarea label="Nota (opcional)" rows={2} value={nota} maxLength={1000} onChange={(ev) => setNota(ev.target.value)}
                    hint={e.clave === "despacho" ? "Transportadora y número de guía" : undefined} />
                  <SubirArchivoMaquila tipo="evidencia" etiqueta="Subir fotos de la etapa" multiple maxArchivos={8 - fotos.length}
                    disabled={fotos.length >= 8} onSubido={(a) => setFotos((x) => [...x, a])} />
                  <ArchivosVista archivos={fotos} tamano="sm" onQuitar={(id) => setFotos((x) => x.filter((f) => f.id !== id))} />
                  <Button size="sm" loading={ocupado === e.clave}
                    onClick={() => void ejecutar(e.clave, () => maquilasService.completarEtapa(p.id, e.clave, nota.trim(), fotos.map((f) => f.id)),
                      `Etapa completada: ${e.nombre}`).then((ok) => { if (ok) { setNota(""); setFotos([]); } })}>
                    Marcar «{e.nombre}» como hecha
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function SeccionPagos({ p }: { p: Pedido }) {
  const { ocupado, ejecutar } = useAccion();
  const [rechazando, setRechazando] = useState<string | null>(null);
  const subir = new Set(p.acciones.subir_comprobante ?? []);
  const revisar = new Set(p.acciones.revisar_comprobantes ?? []);

  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-semibold">Pagos</h3>
          <p className="text-sm text-muted-foreground">El pago va directo a la maquila; aquí queda el registro de cada comprobante.</p>
        </div>
        <p className="text-sm"><span className="font-semibold">{pesos(p.pagado)}</span> <span className="text-muted-foreground">de {pesos(p.total)} confirmados</span></p>
      </div>
      <ul className="space-y-3">
        {p.hitos.map((h) => (
          <li key={h.clave} className="rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{h.nombre} · {h.porcentaje} %</p>
                <p className="text-lg font-semibold">{pesos(h.monto)}</p>
              </div>
              <span className={clsx("text-xs font-medium", ESTILO_PAGO[h.estado])}>{ETIQUETA_PAGO[h.estado]}</span>
            </div>
            {h.motivo_rechazo && h.estado === "rechazado" && <p className="mt-1 text-sm text-destructive">Motivo: {h.motivo_rechazo}</p>}
            {h.comprobantes.length > 0 && (
              <div className="mt-2"><ArchivosVista archivos={h.comprobantes.map((c) => c.archivo)} tamano="sm" /></div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {subir.has(h.clave) && (
                <SubirArchivoMaquila tipo="comprobante" etiqueta={h.estado === "rechazado" ? "Subir otro comprobante" : "Subir comprobante"}
                  onSubido={(a) => void ejecutar(`subir-${h.clave}`, () => maquilasService.subirComprobante(p.id, h.clave, a.id, ""), "Enviamos tu comprobante a la maquila")} />
              )}
              {revisar.has(h.clave) && (
                <>
                  <Button size="sm" loading={ocupado === `ok-${h.clave}`}
                    onClick={() => void ejecutar(`ok-${h.clave}`, () => maquilasService.confirmarPago(p.id, h.clave), "Pago confirmado")}>
                    Confirmar pago
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRechazando(h.clave)}>Rechazar comprobante</Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <MotivoModal abierto={rechazando !== null} titulo="Rechazar el comprobante" textoBoton="Rechazar" ocupado={ocupado === "rechazo"}
        descripcion="El cliente ve el motivo y puede subir otro comprobante." onCerrar={() => setRechazando(null)}
        onConfirmar={(t) => void ejecutar("rechazo", () => maquilasService.rechazarPago(p.id, rechazando!, t), "Le avisamos al cliente")
          .then(() => setRechazando(null))} />
    </Card>
  );
}

function DetallePedido({ id, onVolver, onReportar }: { id: string; onVolver: () => void; onReportar?: (referencia: string) => void }) {
  const { data: p, isLoading, error } = usePedido(id);
  const { ocupado, ejecutar } = useAccion();
  const [cancelando, setCancelando] = useState(false);
  if (isLoading) return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>;
  if (error || !p) return <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error)}</p></Card>;
  const contraparte = p.lado === "maquiladora" ? (p.cliente.empresa || p.cliente.nombre) : p.maquiladora.nombre_comercial;

  return (
    <div className="space-y-5">
      <button type="button" onClick={onVolver} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Pedidos
      </button>
      <Card padding="lg" className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{p.producto}</h2>
            <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", ESTILO[p.estado])}>{p.estado_etiqueta}</span>
            {p.retrasado && <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive"><AlertTriangle className="h-3.5 w-3.5" />Retrasado</span>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{p.codigo} · {p.lado === "maquiladora" ? "Cliente" : "Maquila"}: {contraparte}</p>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">Cantidad</p><p className="font-medium">{unidades(p.cantidad)}</p></div>
            <div><p className="text-xs text-muted-foreground">Precio por unidad</p><p className="font-medium">{pesos(p.precio_unitario)}</p></div>
            <div><p className="text-xs text-muted-foreground">Total</p><p className="font-medium">{pesos(p.total)}</p></div>
            <div><p className="text-xs text-muted-foreground">Entrega comprometida</p><p className="font-medium">{fecha(p.fecha_compromiso)}</p></div>
          </div>
          {p.condiciones && <p className="mt-3 text-sm"><span className="text-muted-foreground">Condiciones:</span> {p.condiciones}</p>}
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-2">
          {p.acciones.marcar_recibido && (
            <Button icon={<PackageCheck className="h-4 w-4" />} loading={ocupado === "recibido"}
              onClick={() => void ejecutar("recibido", () => maquilasService.marcarRecibido(p.id), "¡Pedido entregado!")}>Ya lo recibí</Button>
          )}
          {p.acciones.cancelar && <Button variant="ghost" icon={<XCircle className="h-4 w-4" />} onClick={() => setCancelando(true)}>Cancelar pedido</Button>}
          {onReportar && p.lado !== "equipo" && (
            <Button variant="ghost" icon={<LifeBuoy className="h-4 w-4" />} onClick={() => onReportar(`pedido:${p.id}`)}>Reportar un problema</Button>
          )}
        </div>
      </Card>

      {p.bloqueo && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <Clock className="h-4 w-4 flex-shrink-0" aria-hidden="true" />{p.bloqueo}
        </p>
      )}
      {p.cancelacion && (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm">Cancelado por {p.cancelacion.por === "cliente" ? "el cliente" : "la maquila"}: {p.cancelacion.motivo}</p>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <SeccionMuestra p={p} />
          <SeccionEtapas p={p} />
          <SeccionPagos p={p} />
        </div>
        <div className="xl:sticky xl:top-4 xl:self-start">
          <ChatHilo hilo={p.hilo} miLado={p.lado} titulo={`Conversación con ${contraparte ?? "la otra parte"}`}
            puedeEscribir={p.lado !== "equipo" && p.estado !== "cancelado"} alto="h-[28rem]" />
        </div>
      </div>

      <MotivoModal abierto={cancelando} titulo="Cancelar el pedido" textoBoton="Cancelar pedido" ocupado={ocupado === "cancelar"}
        descripcion="Solo se puede cancelar mientras el pedido está en la muestra. La otra parte recibe el motivo."
        onCerrar={() => setCancelando(false)}
        onConfirmar={(t) => void ejecutar("cancelar", () => maquilasService.cancelarPedido(p.id, t), "Cancelaste el pedido").then(() => setCancelando(false))} />
    </div>
  );
}

/** Pedidos del cliente o de la maquila (cada uno ve los suyos y sus acciones). */
export function PedidosMaquilas({ pedidoId, onAbrir, onReportar }: { pedidoId?: string; onAbrir: (id?: string) => void; onReportar?: (referencia: string) => void }) {
  const { data, isLoading, error } = usePedidos();
  if (pedidoId) return <DetallePedido id={pedidoId} onVolver={() => onAbrir(undefined)} onReportar={onReportar} />;

  return isLoading ? (
    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>
  ) : error ? (
    <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error)}</p></Card>
  ) : !data?.length ? (
    <Card padding="lg" className="text-center">
      <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium">Todavía no hay pedidos</p>
      <p className="text-sm text-muted-foreground">Un pedido se abre cuando el cliente acepta una propuesta.</p>
    </Card>
  ) : (
    <Card padding="none">
      <ul className="divide-y divide-border">
        {data.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onAbrir(p.id)} className="flex w-full flex-col gap-2 px-5 py-3 text-left hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className={clsx("truncate", p.pendiente_de_mi ? "font-semibold" : "font-medium")}>
                  {p.pendiente_de_mi && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-primary dark:bg-accent" aria-label="Tienes algo pendiente" />}
                  {p.producto}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.codigo} · {unidades(p.cantidad)} · {pesos(p.total)} · {p.lado === "maquiladora" ? (p.cliente.empresa || p.cliente.nombre) : p.maquiladora.nombre_comercial}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${p.etapas_hechas} de ${p.etapas_total} etapas`}>
                  <div className="h-full bg-primary dark:bg-accent" style={{ width: `${(p.etapas_hechas / Math.max(p.etapas_total, 1)) * 100}%` }} />
                </div>
                {p.retrasado && <AlertTriangle className="h-4 w-4 text-destructive" aria-label="Retrasado" />}
                <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", ESTILO[p.estado])}>{p.estado_etiqueta}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
