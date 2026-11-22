import { useState } from "react";
import {
  AlertTriangle, ArrowLeft, Calculator, CheckCircle2, Circle, CircleDot, ClipboardCheck, Clock, LifeBuoy, Loader2, Package, PackageCheck,
  Repeat, Star, XCircle,
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

import { Button, Card, Input, Textarea } from "@shared/ui/design-system";
import { Modal } from "@shared/ui/kit/Modal";
import { maquilasService } from "@/services/maquilas.service";
import { mensajeDeError } from "@apps/maquilas/features/errores";
import { fecha, fechaHora, pesos, unidades } from "@apps/maquilas/features/formato";
import { useInvalidarMaquilas, useParametrosMaquilas, usePedido, usePedidos } from "@apps/maquilas/features/useMaquilas";
import { ArchivosVista } from "@apps/maquilas/features/componentes/ArchivosVista";
import { CalculadoraMargen } from "@apps/maquilas/features/componentes/CalculadoraMargen";
import { SelectorEstrellas } from "@apps/maquilas/features/componentes/Estrellas";
import { TarjetaResena } from "@apps/maquilas/features/pantallas/ResenasMaquila";
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
              {e.clave === "control_calidad" && e.estado === "en_curso" && (
                <p className="mt-1 text-xs text-muted-foreground">Se cierra cuando el cliente aprueba el reporte de calidad (más abajo).</p>
              )}
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

const ESTADO_REPORTE: Record<string, { texto: string; clase: string }> = {
  enviado: { texto: "Esperando respuesta del cliente", clase: "text-sky-600" },
  aprobado: { texto: "Aprobado", clase: "text-emerald-600" },
  objetado: { texto: "Objetado", clase: "text-amber-600" },
};

function SeccionCalidad({ p }: { p: Pedido }) {
  const { ocupado, ejecutar } = useAccion();
  const criterios = p.calidad.criterios;
  const [unidadesInsp, setUnidadesInsp] = useState("");
  const [resultados, setResultados] = useState<{ cumple: boolean | null; observacion: string }[]>(() => criterios.map(() => ({ cumple: null, observacion: "" })));
  const [fotos, setFotos] = useState<ArchivoMaquila[]>([]);
  const [nota, setNota] = useState("");
  const [objetando, setObjetando] = useState(false);
  if (!p.calidad.etapa) return null;
  const n = Number.parseInt(unidadesInsp, 10) || 0;
  const completo = n >= 1 && n <= p.cantidad && fotos.length > 0 && resultados.every((r) => r.cumple !== null);

  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex items-start gap-3">
        <ClipboardCheck className="mt-0.5 h-5 w-5 text-primary dark:text-accent" aria-hidden="true" />
        <div>
          <h3 className="font-semibold">Control de calidad</h3>
          <p className="text-sm text-muted-foreground">Antes de empacar, la maquila inspecciona el lote contra este checklist y el cliente aprueba el reporte.</p>
        </div>
      </div>
      {criterios.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {criterios.map((c) => <li key={c.criterio} className="flex gap-2"><span aria-hidden="true">•</span><span>{c.criterio}{c.tolerancia && <span className="text-muted-foreground"> (tolerancia {c.tolerancia})</span>}</span></li>)}
        </ul>
      ) : <p className="text-sm text-muted-foreground">La propuesta no fijó criterios: el reporte lleva fotos del lote y una nota.</p>}

      {p.calidad.reportes.map((r) => (
        <div key={r.ronda} className="space-y-2 rounded-xl border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Reporte {r.ronda} · {r.unidades_inspeccionadas.toLocaleString("es-CO")} unidades inspeccionadas · {fechaHora(r.enviado_en)}</p>
            <span className={clsx("text-xs font-medium", ESTADO_REPORTE[r.estado]?.clase)}>{ESTADO_REPORTE[r.estado]?.texto}</span>
          </div>
          {r.resultados.length > 0 && (
            <ul className="space-y-1 text-sm">
              {r.resultados.map((x) => (
                <li key={x.criterio} className="flex items-start gap-2">
                  {x.cumple ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" aria-label="Cumple" />
                    : <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" aria-label="No cumple" />}
                  <span>{x.criterio}{x.observacion && <span className="text-muted-foreground"> — {x.observacion}</span>}</span>
                </li>
              ))}
            </ul>
          )}
          {r.nota && <p className="text-sm">{r.nota}</p>}
          <ArchivosVista archivos={r.fotos} tamano="sm" />
          {r.comentario && <p className="rounded-lg bg-muted px-3 py-2 text-sm"><span className="font-medium">Cliente:</span> {r.comentario}</p>}
        </div>
      ))}

      {p.acciones.enviar_reporte_calidad && (
        <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
          <p className="text-sm font-medium">{p.calidad.reportes.length ? "Enviar un nuevo reporte" : "Enviar el reporte de inspección"}</p>
          <Input label="Unidades inspeccionadas" type="number" min={1} max={p.cantidad} value={unidadesInsp} onChange={(e) => setUnidadesInsp(e.target.value)} />
          {criterios.map((c, i) => (
            <fieldset key={c.criterio} className="space-y-2 rounded-lg bg-muted/40 p-3">
              <legend className="sr-only">{c.criterio}</legend>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">{c.criterio}</span>
                <span className="flex gap-1">
                  {([true, false] as const).map((v) => (
                    <button key={String(v)} type="button" aria-pressed={resultados[i]?.cumple === v}
                      onClick={() => setResultados((x) => x.map((r, j) => (j === i ? { ...r, cumple: v } : r)))}
                      className={clsx("rounded-full border px-3 py-0.5 text-xs font-medium", resultados[i]?.cumple === v
                        ? (v ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-destructive bg-destructive/10 text-destructive")
                        : "border-border text-muted-foreground")}>
                      {v ? "Cumple" : "No cumple"}
                    </button>
                  ))}
                </span>
              </div>
              <input aria-label={`Observación: ${c.criterio}`} placeholder="Observación (opcional)" maxLength={500} value={resultados[i]?.observacion ?? ""}
                onChange={(e) => setResultados((x) => x.map((r, j) => (j === i ? { ...r, observacion: e.target.value } : r)))}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </fieldset>
          ))}
          <SubirArchivoMaquila tipo="evidencia" etiqueta="Fotos de la inspección" multiple maxArchivos={10 - fotos.length}
            disabled={fotos.length >= 10} onSubido={(a) => setFotos((x) => [...x, a])} />
          <ArchivosVista archivos={fotos} tamano="sm" onQuitar={(id) => setFotos((x) => x.filter((f) => f.id !== id))} />
          <Textarea label="Nota (opcional)" rows={2} value={nota} maxLength={1000} onChange={(e) => setNota(e.target.value)} />
          <Button disabled={!completo} loading={ocupado === "calidad"}
            onClick={() => void ejecutar("calidad", () => maquilasService.enviarReporteCalidad(p.id, {
              unidades_inspeccionadas: n, fotos: fotos.map((f) => f.id), nota: nota.trim(),
              resultados: resultados.map((r) => ({ cumple: Boolean(r.cumple), observacion: r.observacion.trim() })),
            }), "Enviaste el reporte de calidad").then((ok) => {
              if (ok) { setFotos([]); setNota(""); setUnidadesInsp(""); setResultados(criterios.map(() => ({ cumple: null, observacion: "" }))); }
            })}>
            Enviar reporte
          </Button>
        </div>
      )}
      {p.acciones.responder_calidad && (
        <div className="flex flex-wrap gap-2">
          <Button icon={<CheckCircle2 className="h-4 w-4" />} loading={ocupado === "aprobar-calidad"}
            onClick={() => void ejecutar("aprobar-calidad", () => maquilasService.responderCalidad(p.id, true, ""), "Aprobaste la calidad: sigue el empaque")}>
            Aprobar la calidad
          </Button>
          <Button variant="secondary" onClick={() => setObjetando(true)}>Objetar</Button>
        </div>
      )}
      <MotivoModal abierto={objetando} titulo="Objetar el reporte de calidad" etiqueta="Qué no cumple" textoBoton="Enviar objeción"
        ocupado={ocupado === "objetar"} onCerrar={() => setObjetando(false)}
        onConfirmar={(t) => void ejecutar("objetar", () => maquilasService.responderCalidad(p.id, false, t), "Le enviamos tu objeción a la maquila")
          .then(() => setObjetando(false))} />
    </Card>
  );
}

function SeccionResena({ p }: { p: Pedido }) {
  const { ocupado, ejecutar } = useAccion();
  const [valores, setValores] = useState({ calificacion: 0, puntualidad: 0, calidad: 0, comunicacion: 0 });
  const [comentario, setComentario] = useState("");
  if (p.estado !== "entregado") return null;
  if (p.resena) {
    return (
      <Card padding="lg" className="space-y-3">
        <h3 className="font-semibold">{p.lado === "cliente" ? "Tu reseña" : "Reseña del cliente"}</h3>
        <TarjetaResena r={p.resena} onResponder={p.acciones.responder_resena
          ? (t) => ejecutar("responder", () => maquilasService.responderResena(p.resena!.id, t), "Publicamos tu respuesta").then(() => undefined)
          : undefined} />
      </Card>
    );
  }
  if (!p.acciones.resenar) return null;
  const completo = Object.values(valores).every((v) => v >= 1);
  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex items-start gap-3">
        <Star className="mt-0.5 h-5 w-5 text-amber-400" aria-hidden="true" />
        <div>
          <h3 className="font-semibold">¿Cómo te fue con {p.maquiladora.nombre_comercial}?</h3>
          <p className="text-sm text-muted-foreground">Tu calificación ayuda a otros emprendedores a elegir. Se publica con tu nombre de pila o el de tu empresa.</p>
        </div>
      </div>
      <div className="space-y-2">
        <SelectorEstrellas etiqueta="En general" valor={valores.calificacion} onChange={(v) => setValores((x) => ({ ...x, calificacion: v }))} />
        <SelectorEstrellas etiqueta="Puntualidad" valor={valores.puntualidad} onChange={(v) => setValores((x) => ({ ...x, puntualidad: v }))} />
        <SelectorEstrellas etiqueta="Calidad del producto" valor={valores.calidad} onChange={(v) => setValores((x) => ({ ...x, calidad: v }))} />
        <SelectorEstrellas etiqueta="Comunicación" valor={valores.comunicacion} onChange={(v) => setValores((x) => ({ ...x, comunicacion: v }))} />
      </div>
      <Textarea label="Comentario (opcional)" rows={3} value={comentario} maxLength={1000} onChange={(e) => setComentario(e.target.value)} />
      <Button disabled={!completo} loading={ocupado === "resena"}
        onClick={() => void ejecutar("resena", () => maquilasService.calificar(p.id, { ...valores, comentario: comentario.trim() }), "¡Gracias por calificar!")}>
        Publicar reseña
      </Button>
    </Card>
  );
}

function RepetirModal({ p, abierto, onCerrar, onRepetido }: { p: Pedido; abierto: boolean; onCerrar: () => void; onRepetido: (solicitudId: string) => void }) {
  const invalidar = useInvalidarMaquilas();
  const [cantidad, setCantidad] = useState(String(p.cantidad));
  const [fechaObjetivo, setFechaObjetivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function repetir() {
    setEnviando(true);
    try {
      const solicitud = await maquilasService.repetirPedido(p.id, Number.parseInt(cantidad, 10) || 0, fechaObjetivo || null);
      await invalidar();
      toast.success(`Le pedimos a ${p.maquiladora.nombre_comercial} una propuesta para repetir el pedido.`);
      onRepetido(solicitud.id);
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Modal open={abierto} onClose={onCerrar} title="Repetir el pedido">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Le enviamos a {p.maquiladora.nombre_comercial} el mismo brief, con referencias y ficha técnica. Te responde con una propuesta nueva
          (parte de la anterior) y, al aceptarla, se abre otro pedido.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Cantidad" type="number" min={1} suffix="und." value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          <Input label="¿Para cuándo? (opcional)" type="date" value={fechaObjetivo} onChange={(e) => setFechaObjetivo(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCerrar}>Cancelar</Button>
          <Button icon={<Repeat className="h-4 w-4" />} loading={enviando} disabled={!(Number.parseInt(cantidad, 10) > 0)} onClick={() => void repetir()}>Pedir propuesta</Button>
        </div>
      </div>
    </Modal>
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

function DetallePedido({ id, onVolver, onReportar, onRepetido }: {
  id: string; onVolver: () => void; onReportar?: (referencia: string) => void; onRepetido?: (solicitudId: string) => void;
}) {
  const { data: p, isLoading, error } = usePedido(id);
  const { ocupado, ejecutar } = useAccion();
  const [cancelando, setCancelando] = useState(false);
  const [repitiendo, setRepitiendo] = useState(false);
  const [calculando, setCalculando] = useState(false);
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
          {p.acciones.repetir && onRepetido && <Button variant="secondary" icon={<Repeat className="h-4 w-4" />} onClick={() => setRepitiendo(true)}>Repetir pedido</Button>}
          {p.lado === "cliente" && <Button variant="ghost" icon={<Calculator className="h-4 w-4" />} onClick={() => setCalculando(true)}>Calcular mi margen</Button>}
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
          <SeccionResena p={p} />
          <SeccionMuestra p={p} />
          <SeccionEtapas p={p} />
          <SeccionCalidad key={`calidad-${p.calidad.reportes.length}`} p={p} />
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
      {onRepetido && repitiendo && <RepetirModal p={p} abierto onCerrar={() => setRepitiendo(false)} onRepetido={onRepetido} />}
      <Modal open={calculando} onClose={() => setCalculando(false)} title="¿A cuánto lo vendo?" width="max-w-5xl">
        <CalculadoraMargen precio={p.precio_unitario} cantidad={p.cantidad} costosFijos={p.costo_muestra || undefined} />
      </Modal>
    </div>
  );
}

/** Pedidos del cliente o de la maquila (cada uno ve los suyos y sus acciones). */
export function PedidosMaquilas({ pedidoId, onAbrir, onReportar, onRepetido }: {
  pedidoId?: string; onAbrir: (id?: string) => void; onReportar?: (referencia: string) => void; onRepetido?: (solicitudId: string) => void;
}) {
  const { data, isLoading, error } = usePedidos();
  if (pedidoId) return <DetallePedido id={pedidoId} onVolver={() => onAbrir(undefined)} onReportar={onReportar} onRepetido={onRepetido} />;

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
