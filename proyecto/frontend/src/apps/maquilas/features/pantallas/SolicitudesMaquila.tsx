import { useEffect, useState } from "react";
import { ArrowLeft, Inbox, Loader2, Lock, Package, Plus, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

import { Button, Card, Input, Textarea } from "@shared/ui/design-system";
import { maquilasService } from "@/services/maquilas.service";
import { mensajeDeError } from "@apps/maquilas/features/errores";
import { fecha, pesos, unidades } from "@apps/maquilas/features/formato";
import { useInvalidarMaquilas, useParametrosMaquilas, useRecibidas, useSolicitud } from "@apps/maquilas/features/useMaquilas";
import { ChatHilo } from "@apps/maquilas/features/componentes/ChatHilo";
import { MotivoModal } from "@apps/maquilas/features/componentes/MotivoModal";
import { BriefSolicitud, EstadoSolicitudChip } from "@apps/maquilas/features/pantallas/SolicitudesCliente";
import type { Propuesta, Solicitud } from "@apps/maquilas/features/tipos";

type Borrador = {
  tramos: { cantidad_min: string; precio_unitario: string }[];
  costo_muestra: string;
  dias_muestra: string;
  dias_produccion: string;
  hitos: Record<string, string>;
  condiciones: string;
  validez_dias: string;
};

function borradorDe(s: Solicitud, p: Propuesta | null | undefined, porDefecto: Record<string, number>): Borrador {
  if (p) {
    const hitos: Record<string, string> = {};
    p.hitos.forEach((h) => { hitos[h.clave] = String(h.porcentaje); });
    return {
      tramos: p.tramos.map((t) => ({ cantidad_min: String(t.cantidad_min), precio_unitario: String(t.precio_unitario) })),
      costo_muestra: String(p.costo_muestra), dias_muestra: String(p.dias_muestra), dias_produccion: String(p.dias_produccion),
      hitos, condiciones: p.condiciones, validez_dias: "15",
    };
  }
  return {
    tramos: [{ cantidad_min: String(s.cantidad), precio_unitario: "" }],
    costo_muestra: "0", dias_muestra: "", dias_produccion: "",
    hitos: Object.fromEntries(Object.entries(porDefecto).map(([k, v]) => [k, String(v)])),
    condiciones: "", validez_dias: "15",
  };
}

const n = (v: string) => Number.parseInt(v, 10) || 0;

function FormularioPropuesta({ s, onGuardada }: { s: Solicitud; onGuardada: () => void }) {
  const { data: parametros } = useParametrosMaquilas();
  const [b, setB] = useState<Borrador>(() => borradorDe(s, s.mi_propuesta, parametros?.hitos_por_defecto ?? { anticipo: 50, contra_entrega: 50 }));
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { setB(borradorDe(s, s.mi_propuesta, parametros?.hitos_por_defecto ?? { anticipo: 50, contra_entrega: 50 })); },
    // Solo al cambiar de solicitud o al llegar los parámetros (no en cada refresco).
    [s.id, parametros?.hitos_por_defecto]);

  const tramos = b.tramos.map((t) => ({ cantidad_min: n(t.cantidad_min), precio_unitario: n(t.precio_unitario) }))
    .filter((t) => t.cantidad_min > 0 && t.precio_unitario > 0).sort((x, y) => x.cantidad_min - y.cantidad_min);
  const aplicable = [...tramos].reverse().find((t) => t.cantidad_min <= s.cantidad);
  const total = aplicable ? aplicable.precio_unitario * s.cantidad + n(b.costo_muestra) : 0;
  const sumaHitos = Object.values(b.hitos).reduce((a, v) => a + n(v), 0);
  const errores = [
    !tramos.length && "Pon al menos un precio por unidad",
    tramos.length > 0 && !aplicable && `El primer tramo tiene que empezar en ${s.cantidad.toLocaleString("es-CO")} unidades o menos`,
    !(n(b.dias_muestra) >= 1) && "¿En cuántos días tienes la muestra?",
    !(n(b.dias_produccion) >= 1) && "¿En cuántos días produces el lote?",
    sumaHitos !== 100 && `Los pagos suman ${sumaHitos} %; deben sumar 100 %`,
  ].filter(Boolean) as string[];
  const editable = s.mi_propuesta?.estado !== "aceptada" && s.mi_propuesta?.estado !== "descartada";

  async function guardar() {
    if (errores.length) return;
    setGuardando(true);
    try {
      await maquilasService.guardarPropuesta(s.id, {
        tramos, costo_muestra: n(b.costo_muestra), dias_muestra: n(b.dias_muestra), dias_produccion: n(b.dias_produccion),
        hitos: Object.fromEntries(Object.entries(b.hitos).map(([k, v]) => [k, n(v)])),
        condiciones: b.condiciones.trim(), validez_dias: n(b.validez_dias) || 15,
      });
      toast.success(s.mi_propuesta ? "Actualizaste tu propuesta" : "Enviaste tu propuesta");
      onGuardada();
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card padding="lg" className="space-y-5">
      <div>
        <h3 className="font-semibold">{s.mi_propuesta ? "Tu propuesta" : "Haz tu propuesta"}</h3>
        <p className="text-sm text-muted-foreground">El cliente la compara lado a lado con las de otras maquilas.</p>
      </div>
      <fieldset className="space-y-2" disabled={!editable}>
        <legend className="text-sm font-medium">Precio por unidad según la cantidad</legend>
        {b.tramos.map((t, i) => (
          <div key={i} className="flex items-end gap-2">
            <Input label={i === 0 ? "Desde (unidades)" : undefined} aria-label="Desde cuántas unidades" type="number" min={1} value={t.cantidad_min}
              onChange={(e) => setB({ ...b, tramos: b.tramos.map((x, j) => (j === i ? { ...x, cantidad_min: e.target.value } : x)) })} />
            <Input label={i === 0 ? "Precio por unidad" : undefined} aria-label="Precio por unidad" type="number" min={1} prefix="$" value={t.precio_unitario}
              onChange={(e) => setB({ ...b, tramos: b.tramos.map((x, j) => (j === i ? { ...x, precio_unitario: e.target.value } : x)) })} />
            {b.tramos.length > 1 && (
              <button type="button" aria-label="Quitar tramo" className="mb-2 text-muted-foreground hover:text-destructive"
                onClick={() => setB({ ...b, tramos: b.tramos.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
            )}
          </div>
        ))}
        {b.tramos.length < 5 && (
          <Button variant="ghost" size="sm" icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setB({ ...b, tramos: [...b.tramos, { cantidad_min: "", precio_unitario: "" }] })}>Agregar tramo por volumen</Button>
        )}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Costo de la muestra" type="number" min={0} prefix="$" value={b.costo_muestra} disabled={!editable}
          onChange={(e) => setB({ ...b, costo_muestra: e.target.value })} hint="0 si la muestra no se cobra" />
        <Input label="Días para la muestra" type="number" min={1} value={b.dias_muestra} disabled={!editable} onChange={(e) => setB({ ...b, dias_muestra: e.target.value })} />
        <Input label="Días de producción" type="number" min={1} value={b.dias_produccion} disabled={!editable} onChange={(e) => setB({ ...b, dias_produccion: e.target.value })} />
      </div>
      <fieldset className="space-y-2" disabled={!editable}>
        <legend className="text-sm font-medium">Cómo se paga (porcentajes del total)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          {(parametros?.hitos ?? []).map((h) => (
            <Input key={h.clave} label={h.nombre} type="number" min={0} max={100} suffix="%" value={b.hitos[h.clave] ?? "0"}
              onChange={(e) => setB({ ...b, hitos: { ...b.hitos, [h.clave]: e.target.value } })} />
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Textarea label="Condiciones" rows={3} value={b.condiciones} disabled={!editable} maxLength={2000}
            onChange={(e) => setB({ ...b, condiciones: e.target.value })} hint="Qué incluye (empaque, etiquetas, transporte), garantías, tolerancias…" />
        </div>
        <Input label="Válida por" type="number" min={1} max={60} suffix="días" value={b.validez_dias} disabled={!editable}
          onChange={(e) => setB({ ...b, validez_dias: e.target.value })} />
      </div>
      <div className="flex flex-col gap-3 rounded-xl bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Total para {unidades(s.cantidad)}</p>
          <p className="text-xl font-semibold">{pesos(total)}</p>
          {aplicable && <p className="text-xs text-muted-foreground">{pesos(aplicable.precio_unitario)} c/u{n(b.costo_muestra) ? ` + muestra ${pesos(n(b.costo_muestra))}` : ""}</p>}
        </div>
        {editable && <Button loading={guardando} disabled={errores.length > 0} onClick={() => void guardar()}>{s.mi_propuesta ? "Actualizar propuesta" : "Enviar propuesta"}</Button>}
      </div>
      {editable && errores.length > 0 && <ul className="list-disc pl-5 text-xs text-amber-700 dark:text-amber-300">{errores.map((e) => <li key={e}>{e}</li>)}</ul>}
    </Card>
  );
}

function DetalleRecibida({ id, onVolver, onVerPedido }: { id: string; onVolver: () => void; onVerPedido: (id: string) => void }) {
  const { data: s, isLoading, error, refetch } = useSolicitud(id);
  const invalidar = useInvalidarMaquilas();
  const [rechazando, setRechazando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  if (isLoading) return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>;
  if (error || !s) return <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error)}</p></Card>;
  const destino = s.mi_destino;
  const viva = ["abierta", "con_propuestas"].includes(s.estado);

  async function aceptarAcuerdo() {
    setOcupado(true);
    try {
      await maquilasService.aceptarAcuerdo(s!.id);
      await invalidar();
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  async function rechazar(motivo: string) {
    setOcupado(true);
    try {
      await maquilasService.rechazarSolicitud(s!.id, motivo);
      await invalidar();
      toast.success("Le avisamos al cliente.");
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setOcupado(false);
      setRechazando(false);
    }
  }

  return (
    <div className="space-y-5">
      <button type="button" onClick={onVolver} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Solicitudes
      </button>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{s.titulo}</h2>
            <EstadoSolicitudChip estado={s.estado} etiqueta={s.estado_etiqueta} />
          </div>
          <p className="text-sm text-muted-foreground">{s.codigo} · {s.cliente.empresa || s.cliente.nombre} · {s.modalidad === "dirigida" ? "Te la enviaron a ti" : "Abierta a varias maquilas"}</p>
        </div>
        <div className="flex gap-2">
          {s.pedido_id && <Button icon={<Package className="h-4 w-4" />} onClick={() => onVerPedido(s.pedido_id!)}>Ver el pedido</Button>}
          {viva && destino?.estado === "pendiente" && (
            <Button variant="ghost" icon={<XCircle className="h-4 w-4" />} onClick={() => setRechazando(true)}>No puedo fabricarla</Button>
          )}
        </div>
      </div>

      {destino?.acuerdo_pendiente && (
        <Card padding="lg" className="flex flex-col gap-4 border-amber-500/40 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 text-amber-600" aria-hidden="true" />
            <div>
              <p className="font-semibold">El cliente pidió confidencialidad</p>
              <p className="text-sm text-muted-foreground">
                Al aceptar te comprometes a no compartir ni usar el diseño, las referencias ni la ficha técnica fuera de esta cotización
                y del pedido que resulte. Queda registrado quién lo aceptó y cuándo.
              </p>
            </div>
          </div>
          <Button icon={<ShieldCheck className="h-4 w-4" />} loading={ocupado} onClick={() => void aceptarAcuerdo()}>Aceptar el acuerdo</Button>
        </Card>
      )}

      <BriefSolicitud s={s} />

      {destino?.estado === "rechazada" ? (
        <Card padding="md"><p className="text-sm text-muted-foreground">Rechazaste esta solicitud: {destino.motivo}</p></Card>
      ) : !destino?.acuerdo_pendiente && (viva || s.mi_propuesta) ? (
        <FormularioPropuesta s={s} onGuardada={() => { void invalidar(); void refetch(); }} />
      ) : null}

      {s.hilo && !destino?.acuerdo_pendiente && destino?.estado !== "rechazada" && (
        <ChatHilo hilo={s.hilo} miLado="maquiladora" titulo={`Conversación con ${s.cliente.empresa || s.cliente.nombre || "el cliente"}`}
          puedeEscribir={s.estado !== "cancelada"} />
      )}

      <MotivoModal abierto={rechazando} titulo="No puedo fabricarla" textoBoton="Avisar al cliente" ocupado={ocupado}
        descripcion="El cliente recibe tu motivo. Ser claro le ayuda a ajustar su solicitud."
        onCerrar={() => setRechazando(false)} onConfirmar={(m) => void rechazar(m)} />
    </div>
  );
}

/** Bandeja de solicitudes que le llegaron a la maquila. */
export function SolicitudesMaquila({ solicitudId, onAbrir, onVerPedido }: {
  solicitudId?: string;
  onAbrir: (id?: string) => void;
  onVerPedido: (id: string) => void;
}) {
  const { data, isLoading, error } = useRecibidas();
  if (solicitudId) return <DetalleRecibida id={solicitudId} onVolver={() => onAbrir(undefined)} onVerPedido={onVerPedido} />;

  return isLoading ? (
    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando…</div>
  ) : error ? (
    <Card padding="lg"><p className="text-sm text-destructive">{mensajeDeError(error)}</p></Card>
  ) : !data?.length ? (
    <Card padding="lg" className="text-center">
      <Inbox className="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium">Aún no te llegan solicitudes</p>
      <p className="text-sm text-muted-foreground">Cuando un cliente pida algo que fabricas, aparece aquí y te avisamos por correo.</p>
    </Card>
  ) : (
    <Card padding="none">
      <ul className="divide-y divide-border">
        {data.map((s) => {
          const pendiente = ["abierta", "con_propuestas"].includes(s.estado) && s.mi_destino?.estado === "pendiente";
          return (
            <li key={s.id}>
              <button type="button" onClick={() => onAbrir(s.id)} className="flex w-full flex-col gap-1 px-5 py-3 text-left hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className={clsx("truncate", pendiente ? "font-semibold" : "font-medium")}>
                    {pendiente && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-primary dark:bg-accent" aria-label="Por responder" />}
                    {s.titulo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.codigo} · {s.categoria_nombre} · {unidades(s.cantidad)} · {s.ciudad_entrega}{s.fecha_objetivo ? ` · para ${fecha(s.fecha_objetivo)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {s.confidencial && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Confidencial" />}
                  <span className="text-muted-foreground">
                    {s.mi_propuesta_estado === "aceptada" ? "¡Ganaste!" : s.mi_propuesta_estado === "descartada" ? "Eligieron otra"
                      : s.mi_destino?.estado === "propuesta" ? "Propuesta enviada" : s.mi_destino?.estado === "rechazada" ? "Rechazada" : "Por responder"}
                  </span>
                  <EstadoSolicitudChip estado={s.estado} etiqueta={s.estado_etiqueta} />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
