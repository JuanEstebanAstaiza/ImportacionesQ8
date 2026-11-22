import { useState } from "react";
import { ArrowLeft, CheckCircle2, ClipboardList, Clock, Loader2, Lock, Package, Plus, XCircle } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

import { Button, Card } from "@shared/ui/design-system";
import { maquilasService } from "@/services/maquilas.service";
import { mensajeDeError } from "@apps/maquilas/features/errores";
import { fecha, pesos, unidades } from "@apps/maquilas/features/formato";
import { useInvalidarMaquilas, useMisSolicitudes, useSolicitud } from "@apps/maquilas/features/useMaquilas";
import { ArchivosVista } from "@apps/maquilas/features/componentes/ArchivosVista";
import { ChatHilo } from "@apps/maquilas/features/componentes/ChatHilo";
import { MotivoModal } from "@apps/maquilas/features/componentes/MotivoModal";
import type { Propuesta, Solicitud } from "@apps/maquilas/features/tipos";

const ESTILO_ESTADO: Record<string, string> = {
  abierta: "bg-sky-500/10 text-sky-800 dark:text-sky-300",
  con_propuestas: "bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent",
  aceptada: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  cancelada: "bg-muted text-muted-foreground",
};

export function EstadoSolicitudChip({ estado, etiqueta }: { estado: string; etiqueta: string }) {
  return <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", ESTILO_ESTADO[estado])}>{etiqueta}</span>;
}

/** Resumen del brief: lo usan el cliente y la maquila. */
export function BriefSolicitud({ s }: { s: Solicitud }) {
  return (
    <Card padding="lg" className="space-y-4">
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-xs text-muted-foreground">Categoría</p><p className="font-medium">{s.categoria_nombre}</p></div>
        <div><p className="text-xs text-muted-foreground">Cantidad</p><p className="font-medium">{unidades(s.cantidad)}</p></div>
        <div><p className="text-xs text-muted-foreground">Entrega</p><p className="font-medium">{s.ciudad_entrega}{s.fecha_objetivo ? ` · ${fecha(s.fecha_objetivo)}` : ""}</p></div>
        <div><p className="text-xs text-muted-foreground">Presupuesto por unidad</p><p className="font-medium">{s.presupuesto_unitario ? pesos(s.presupuesto_unitario) : "Abierto"}</p></div>
      </div>
      {s.detalle_visible ? (
        <>
          <p className="whitespace-pre-line text-sm">{s.descripcion}</p>
          {!!s.campos?.length && (
            <dl className="grid gap-3 sm:grid-cols-2">
              {s.campos.map((c) => (
                <div key={c.clave} className="rounded-xl border border-border p-3">
                  <dt className="text-xs text-muted-foreground">{c.etiqueta}</dt>
                  <dd className="whitespace-pre-line text-sm">{c.valor}</dd>
                </div>
              ))}
            </dl>
          )}
          <ArchivosVista archivos={[...(s.referencias ?? []), ...(s.ficha_tecnica ? [s.ficha_tecnica] : [])]} />
        </>
      ) : (
        <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" aria-hidden="true" />El detalle se ve después de aceptar el acuerdo de confidencialidad.
        </p>
      )}
    </Card>
  );
}

function Comparador({ s, onAceptar }: { s: Solicitud; onAceptar: (p: Propuesta) => void }) {
  const propuestas = s.propuestas ?? [];
  if (!propuestas.length) {
    return (
      <Card padding="lg" className="text-center">
        <Clock className="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium">Esperando propuestas</p>
        <p className="text-sm text-muted-foreground">Te avisamos en cuanto una maquila te responda.</p>
      </Card>
    );
  }
  const masBarata = Math.min(...propuestas.map((p) => p.total));
  const masRapida = Math.min(...propuestas.map((p) => p.dias_muestra + p.dias_produccion));
  const filas: { etiqueta: string; valor: (p: Propuesta) => React.ReactNode }[] = [
    { etiqueta: "Precio por unidad", valor: (p) => pesos(p.precio_unitario) },
    { etiqueta: "Muestra", valor: (p) => (p.costo_muestra ? pesos(p.costo_muestra) : "Sin costo") },
    { etiqueta: "Total", valor: (p) => <span className={clsx("font-semibold", p.total === masBarata && "text-emerald-600 dark:text-emerald-400")}>{pesos(p.total)}</span> },
    { etiqueta: "Tiempos", valor: (p) => <span className={clsx(p.dias_muestra + p.dias_produccion === masRapida && "font-semibold text-emerald-600 dark:text-emerald-400")}>{p.dias_muestra} d muestra + {p.dias_produccion} d producción</span> },
    { etiqueta: "Pagos", valor: (p) => p.hitos.map((h) => `${h.porcentaje} % ${h.nombre.toLowerCase()}`).join(" · ") },
    { etiqueta: "Precios por cantidad", valor: (p) => p.tramos.map((t) => `desde ${t.cantidad_min.toLocaleString("es-CO")}: ${pesos(t.precio_unitario)}`).join(" · ") },
    { etiqueta: "Condiciones", valor: (p) => p.condiciones || "—" },
    { etiqueta: "Válida hasta", valor: (p) => (p.vencida ? <span className="text-destructive">Vencida</span> : fecha(p.valida_hasta)) },
  ];
  return (
    <Card padding="none" className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="px-4 pt-4 text-left font-semibold">Propuestas lado a lado</caption>
        <thead>
          <tr className="border-b border-border">
            <th className="w-44 px-4 py-3 text-left text-xs font-medium text-muted-foreground" scope="col">Maquila</th>
            {propuestas.map((p) => <th key={p.id} className="px-4 py-3 text-left" scope="col">{p.maquiladora.nombre_comercial}<span className="block text-xs font-normal text-muted-foreground">{p.maquiladora.ciudad}</span></th>)}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.etiqueta} className="border-b border-border align-top">
              <th scope="row" className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{f.etiqueta}</th>
              {propuestas.map((p) => <td key={p.id} className="px-4 py-2.5">{f.valor(p)}</td>)}
            </tr>
          ))}
          <tr>
            <td />
            {propuestas.map((p) => (
              <td key={p.id} className="px-4 py-3">
                {p.estado === "aceptada" ? <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600"><CheckCircle2 className="h-4 w-4" />Elegida</span>
                  : p.estado === "descartada" ? <span className="text-xs text-muted-foreground">No elegida</span>
                  : <Button size="sm" disabled={p.vencida || !["abierta", "con_propuestas"].includes(s.estado)} onClick={() => onAceptar(p)}>Elegir esta</Button>}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </Card>
  );
}

function DetalleSolicitud({ id, onVolver, onVerPedido }: { id: string; onVolver: () => void; onVerPedido: (id: string) => void }) {
  const { data: s, isLoading, error } = useSolicitud(id);
  const invalidar = useInvalidarMaquilas();
  const [eligiendo, setEligiendo] = useState<Propuesta | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [hilo, setHilo] = useState<string | null>(null);

  if (isLoading) return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>;
  if (error || !s) return <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error)}</p></Card>;

  const conversaciones = (s.destinos ?? []).filter((d) => d.estado !== "rechazada");
  const hiloActivo = hilo ?? conversaciones.find((d) => d.estado === "propuesta")?.hilo ?? conversaciones[0]?.hilo;

  async function aceptar(motivo: string) {
    if (!eligiendo) return;
    setOcupado(true);
    try {
      const pedido = await maquilasService.aceptarPropuesta(eligiendo.id, motivo);
      await invalidar();
      toast.success(`Listo: abrimos el pedido ${pedido.codigo}.`);
      onVerPedido(pedido.id);
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setOcupado(false);
      setEligiendo(null);
    }
  }

  async function cancelar() {
    setOcupado(true);
    try {
      await maquilasService.cancelarSolicitud(s!.id);
      await invalidar();
      toast.success("Cancelaste la solicitud.");
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setOcupado(false);
      setCancelando(false);
    }
  }

  return (
    <div className="space-y-5">
      <button type="button" onClick={onVolver} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Mis solicitudes
      </button>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{s.titulo}</h2>
            <EstadoSolicitudChip estado={s.estado} etiqueta={s.estado_etiqueta} />
            {s.confidencial && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" />Confidencial</span>}
          </div>
          <p className="text-sm text-muted-foreground">{s.codigo} · {s.modalidad === "dirigida" ? "Dirigida" : "Abierta"} · {fecha(s.creado_en)}</p>
        </div>
        <div className="flex gap-2">
          {s.pedido_id && <Button icon={<Package className="h-4 w-4" />} onClick={() => onVerPedido(s.pedido_id!)}>Ver el pedido</Button>}
          {["abierta", "con_propuestas"].includes(s.estado) && (
            <Button variant="ghost" icon={<XCircle className="h-4 w-4" />} onClick={() => setCancelando(true)}>Cancelar solicitud</Button>
          )}
        </div>
      </div>

      <BriefSolicitud s={s} />

      <Card padding="md">
        <p className="text-sm font-medium">Enviada a {s.destinos?.length ?? 0} {s.destinos?.length === 1 ? "maquila" : "maquilas"}</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {(s.destinos ?? []).map((d) => (
            <li key={d.maquiladora_id} className="rounded-full border border-border px-3 py-1 text-xs" title={d.motivo ?? undefined}>
              {d.nombre_comercial} · {d.estado === "propuesta" ? "propuso" : d.estado === "rechazada" ? "no la tomará" : "revisando"}
            </li>
          ))}
        </ul>
      </Card>

      <Comparador s={s} onAceptar={setEligiendo} />

      {conversaciones.length > 0 && (
        <div className="space-y-2">
          {conversaciones.length > 1 && (
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Conversaciones">
              {conversaciones.map((d) => (
                <button key={d.hilo} type="button" role="tab" aria-selected={hiloActivo === d.hilo} onClick={() => setHilo(d.hilo)}
                  className={clsx("rounded-full border px-3 py-1 text-xs font-medium", hiloActivo === d.hilo
                    ? "border-primary bg-primary/10 text-primary dark:border-accent dark:bg-accent/15 dark:text-accent" : "border-border text-muted-foreground")}>
                  {d.nombre_comercial}
                </button>
              ))}
            </div>
          )}
          {hiloActivo && <ChatHilo key={hiloActivo} hilo={hiloActivo} miLado="cliente"
            titulo={`Conversación con ${conversaciones.find((d) => d.hilo === hiloActivo)?.nombre_comercial ?? "la maquila"}`}
            puedeEscribir={s.estado !== "cancelada"} />}
        </div>
      )}

      <MotivoModal abierto={eligiendo !== null} titulo={`Elegir a ${eligiendo?.maquiladora.nombre_comercial ?? ""}`} opcional
        descripcion={eligiendo ? `Se abre el pedido por ${pesos(eligiendo.total)}. Las demás propuestas quedan descartadas.` : undefined}
        etiqueta="¿Por qué la elegiste? (opcional, nos ayuda a mejorar)" textoBoton="Confirmar y abrir pedido" ocupado={ocupado}
        onCerrar={() => setEligiendo(null)} onConfirmar={(m) => void aceptar(m)} />
      <MotivoModal abierto={cancelando} titulo="Cancelar la solicitud" opcional etiqueta="Comentario (opcional)"
        descripcion="Las maquilas dejan de verla y se descartan las propuestas." textoBoton="Cancelar solicitud" ocupado={ocupado}
        onCerrar={() => setCancelando(false)} onConfirmar={() => void cancelar()} />
    </div>
  );
}

/** «Mis solicitudes» del cliente: la lista y el detalle con el comparador. */
export function SolicitudesCliente({ solicitudId, onAbrir, onNueva, onVerPedido }: {
  solicitudId?: string;
  onAbrir: (id?: string) => void;
  onNueva: () => void;
  onVerPedido: (id: string) => void;
}) {
  const { data, isLoading, error } = useMisSolicitudes();
  if (solicitudId) return <DetalleSolicitud id={solicitudId} onVolver={() => onAbrir(undefined)} onVerPedido={onVerPedido} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button icon={<Plus className="h-4 w-4" />} onClick={onNueva}>Nueva solicitud</Button></div>
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>
      ) : error ? (
        <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error)}</p></Card>
      ) : !data?.length ? (
        <Card padding="lg" className="text-center">
          <ClipboardList className="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">Todavía no has pedido nada</p>
          <p className="text-sm text-muted-foreground">Cuéntanos qué quieres fabricar y te llegan propuestas de maquilas verificadas.</p>
        </Card>
      ) : (
        <Card padding="none">
          <ul className="divide-y divide-border">
            {data.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => onAbrir(s.id)} className="flex w-full flex-col gap-1 px-5 py-3 text-left hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.titulo}</p>
                    <p className="text-xs text-muted-foreground">{s.codigo} · {s.categoria_nombre} · {unidades(s.cantidad)} · {fecha(s.creado_en)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{s.propuestas ?? 0} de {s.destinos ?? 0} propuestas</span>
                    <EstadoSolicitudChip estado={s.estado} etiqueta={s.estado_etiqueta} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
