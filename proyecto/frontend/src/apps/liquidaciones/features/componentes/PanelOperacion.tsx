import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { toast } from "sonner";
import {
  CircleCheck, FileText, Hourglass, LifeBuoy, Loader2, Mail, MapPin, Phone, Send, ShieldCheck,
} from "lucide-react";

import { Button, Card, Textarea } from "@shared/ui/design-system";
import { Modal } from "@shared/ui/kit/Modal";
import { abrirArchivoEnPestana } from "@/utils/abrir-archivo";
import { liquidacionesService } from "@/services/liquidaciones.service";
import { InsigniaEstadoOperacion } from "@apps/liquidaciones/features/componentes/Insignias";
import { FotoLote } from "@apps/liquidaciones/features/componentes/MediosLote";
import { useAhora } from "@apps/liquidaciones/features/componentes/CuentaRegresiva";
import { SubirArchivo } from "@apps/liquidaciones/features/componentes/SubirArchivo";
import { AVISO_PAGO_DIRECTO, ENTREGAS, cantidad, cop, fechaHora, tiempoRestante } from "@apps/liquidaciones/features/constantes";
import { useInvalidarLiquidaciones, useOperacion } from "@apps/liquidaciones/features/useLiquidaciones";
import type { Contacto, DocumentoRef, LadoOperacion, MensajeOperacion } from "@apps/liquidaciones/features/tipos";

function TarjetaContacto({ titulo, contacto, esYo }: { titulo: string; contacto: Contacto | null; esYo: boolean }) {
  return (
    <Card padding="sm" className="min-w-0">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{titulo}</p>
        {esYo && <span className="text-[10px] font-medium text-muted-foreground">Tú</span>}
      </div>
      {!contacto ? (
        <p className="text-sm text-muted-foreground">Sin datos</p>
      ) : (
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-foreground">{contacto.razon_social}</p>
          <p className="text-xs text-muted-foreground">{contacto.contacto} · NIT {contacto.nit}</p>
          {contacto.telefono && <p className="flex items-center gap-1.5 text-xs"><Phone className="h-3 w-3 text-muted-foreground" />{contacto.telefono}</p>}
          {contacto.email && <p className="flex items-center gap-1.5 text-xs break-all"><Mail className="h-3 w-3 flex-shrink-0 text-muted-foreground" />{contacto.email}</p>}
          {contacto.direccion && <p className="flex items-center gap-1.5 text-xs"><MapPin className="h-3 w-3 text-muted-foreground" />{contacto.direccion}{contacto.ciudad ? `, ${contacto.ciudad}` : ""}</p>}
        </div>
      )}
    </Card>
  );
}

function ListaDocumentos({ titulo, documentos, vacio }: { titulo: string; documentos: DocumentoRef[]; vacio: string }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{titulo}</p>
      {documentos.length === 0 ? (
        <p className="text-xs text-muted-foreground">{vacio}</p>
      ) : (
        <ul className="space-y-1">
          {documentos.map((doc) => (
            <li key={doc.id}>
              <button
                type="button"
                onClick={() => void abrirArchivoEnPestana(doc.url, doc.nombre)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
              >
                <FileText className="h-3.5 w-3.5 flex-shrink-0 text-primary dark:text-accent" />
                <span className="truncate">{doc.nombre || "Documento"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Burbuja({ mensaje }: { mensaje: MensajeOperacion }) {
  if (mensaje.tipo === "sistema") {
    const equipo = mensaje.autor === "equipo";
    return (
      <div className="flex justify-center">
        <p className={clsx(
          "max-w-[90%] rounded-full px-3 py-1 text-center text-[11px]",
          equipo ? "bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent" : "bg-muted text-muted-foreground",
        )}>
          {mensaje.contenido} · {fechaHora(mensaje.fecha)}
        </p>
      </div>
    );
  }
  const mio = mensaje.autor === "yo";
  return (
    <div className={clsx("flex flex-col", mio ? "items-end" : "items-start")}>
      {!mio && mensaje.remitente_nombre && <p className="mb-0.5 text-[11px] text-muted-foreground">{mensaje.remitente_nombre}</p>}
      <div className={clsx(
        "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
        mio ? "rounded-br-sm bg-accent text-black" : "rounded-bl-sm bg-muted text-foreground",
      )}>
        {mensaje.contenido}
        {mensaje.archivo && (
          <button
            type="button"
            onClick={() => void abrirArchivoEnPestana(mensaje.archivo!.url, mensaje.archivo!.nombre)}
            className="mt-1 flex items-center gap-1.5 text-xs underline underline-offset-2"
          >
            <FileText className="h-3 w-3" />{mensaje.archivo.nombre || "Ver documento"}
          </button>
        )}
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{fechaHora(mensaje.fecha)}</p>
    </div>
  );
}

/**
 * Detalle de una operación (reserva): contactos de las dos partes, documentos,
 * chat registrado y acciones. Lo usan el comprador (Mis reservas), el vendedor
 * (Operaciones) y el equipo de Zarpi desde el panel admin, donde puede
 * intervenir con mensajes «[Soporte Zarpi]».
 */
export function PanelOperacion({
  operacionId,
  modo,
  onReportar,
}: {
  operacionId: string;
  modo: LadoOperacion;
  onReportar?: (referencia: string) => void;
}) {
  const { data: op, isLoading, error } = useOperacion(operacionId);
  const invalidar = useInvalidarLiquidaciones();
  const ahora = useAhora();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState<"vendido" | "cancelar" | null>(null);
  const [motivo, setMotivo] = useState("");
  const [accionando, setAccionando] = useState(false);
  const finChat = useRef<HTMLDivElement>(null);
  const totalMensajes = op?.mensajes.length ?? 0;

  useEffect(() => {
    finChat.current?.scrollIntoView({ block: "nearest" });
  }, [totalMensajes]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando operación…</div>;
  }
  if (error || !op) {
    return <Card><p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "No se encontró la operación."}</p></Card>;
  }

  const activa = op.estado === "activa";
  const abierta = op.estado === "activa" || op.estado === "vendida";
  const esEquipo = modo === "equipo";

  async function enviar() {
    const contenido = texto.trim();
    if (!contenido) return;
    setEnviando(true);
    try {
      if (esEquipo) await liquidacionesService.intervenir(operacionId, contenido);
      else await liquidacionesService.enviarMensaje(operacionId, contenido);
      setTexto("");
      await invalidar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar el mensaje");
    } finally {
      setEnviando(false);
    }
  }

  async function ejecutar() {
    if (!confirmar) return;
    setAccionando(true);
    try {
      if (confirmar === "vendido") {
        await liquidacionesService.marcarVendido(operacionId);
        toast.success("Operación cerrada como vendida");
      } else {
        await liquidacionesService.cancelar(operacionId, motivo);
        toast.success("Reserva cancelada. El lote volvió a estar disponible.");
      }
      setConfirmar(null);
      setMotivo("");
      await invalidar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar la acción");
    } finally {
      setAccionando(false);
    }
  }

  async function adjuntar(tipo: "comprobante" | "factura", archivoId: string) {
    try {
      await liquidacionesService.adjuntar(operacionId, tipo, archivoId);
      toast.success(tipo === "comprobante" ? "Comprobante adjunto" : "Factura adjunta");
      await invalidar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo adjuntar el documento");
    }
  }

  const plazo = tiempoRestante(op.vence_en, ahora);

  return (
    <div className="space-y-3">
      <Card padding="sm" className="flex flex-wrap items-center gap-3">
        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-border">
          <FotoLote foto={op.lote.foto} alt={op.lote.nombre} className="h-full" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{op.lote.nombre}</p>
          <p className="text-xs text-muted-foreground">{cantidad(op.lote)} · {cop(op.lote.precio_cop)} · {ENTREGAS[op.lote.entrega]}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <InsigniaEstadoOperacion estado={op.estado} />
          {activa && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Hourglass className="h-3 w-3" />
              {modo === "vendedor" ? `Tienes ${plazo} para marcarlo vendido` : `El vendedor tiene ${plazo} para confirmar`}
            </span>
          )}
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <TarjetaContacto titulo="Vendedor" contacto={op.contactos.vendedor} esYo={modo === "vendedor"} />
        <TarjetaContacto titulo="Comprador" contacto={op.contactos.comprador} esYo={modo === "comprador"} />
      </div>

      <Card padding="sm">
        <p className="mb-2 text-sm font-semibold">Documentos de la operación</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <ListaDocumentos titulo="Comprobantes de pago" documentos={op.comprobantes_pago} vacio="El comprador aún no sube el comprobante." />
            {modo === "comprador" && abierta && (
              <SubirArchivo tipo="comprobante_pago" etiqueta="Subir comprobante de pago" ayuda="PDF o imagen" maxMb={15}
                onSubido={(a) => void adjuntar("comprobante", a.id)} />
            )}
          </div>
          <div className="space-y-2">
            <ListaDocumentos titulo="Facturas" documentos={op.facturas} vacio="El vendedor aún no adjunta la factura." />
            {modo === "vendedor" && abierta && (
              <SubirArchivo tipo="factura" etiqueta="Adjuntar factura" ayuda="PDF o imagen" maxMb={15}
                onSubido={(a) => void adjuntar("factura", a.id)} />
            )}
          </div>
        </div>
      </Card>

      <Card padding="none" className="flex flex-col">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">{esEquipo ? "Chat de la operación · monitoreo" : "Chat de la operación"}</p>
          <p className="text-xs text-muted-foreground">Queda registrado en Zarpi para las dos partes.</p>
        </div>
        <div className="max-h-[420px] min-h-[160px] space-y-3 overflow-y-auto px-4 py-3">
          {op.mensajes.map((m) => <Burbuja key={m.id} mensaje={m} />)}
          <div ref={finChat} />
        </div>
        {(esEquipo || (op.estado !== "cancelada" && op.estado !== "vencida")) && (
          <form
            className="flex items-center gap-2 border-t border-border p-3"
            onSubmit={(e) => { e.preventDefault(); void enviar(); }}
          >
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={2000}
              placeholder={esEquipo ? "Escribe como Soporte Zarpi (lo verán las dos partes)…" : "Escribe un mensaje…"}
              className="h-10 flex-1 rounded-lg border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              disabled={enviando || !texto.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-black transition disabled:opacity-50"
              aria-label="Enviar"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto flex max-w-xl items-start gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="mt-px h-3.5 w-3.5 flex-shrink-0" />{AVISO_PAGO_DIRECTO}
        </p>
        {!esEquipo && onReportar && (
          <Button variant="ghost" size="sm" icon={<LifeBuoy className="h-3.5 w-3.5" />} onClick={() => onReportar(`operacion:${op.id}`)}>
            Reportar un problema
          </Button>
        )}
        {activa && (
          <Button variant="secondary" size="sm" onClick={() => setConfirmar("cancelar")}>Cancelar reserva</Button>
        )}
        {activa && modo === "vendedor" && (
          <Button size="sm" icon={<CircleCheck className="h-3.5 w-3.5" />} variant="acento" onClick={() => setConfirmar("vendido")}>
            Marcar como vendido
          </Button>
        )}
      </div>

      <Modal
        open={confirmar !== null}
        onClose={() => !accionando && setConfirmar(null)}
        title={confirmar === "vendido" ? "Marcar como vendido" : "Cancelar reserva"}
      >
        {confirmar === "vendido" ? (
          <p className="text-sm text-muted-foreground">
            Confirma que acordaron el pago y la entrega de «{op.lote.nombre}». La operación se cierra y el lote sale del catálogo.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {esEquipo ? "Se cancelará la reserva por intervención del equipo de Zarpi." : "Se libera la reserva y"} el lote vuelve a estar disponible para otros compradores.
            </p>
            <Textarea label="Motivo (opcional)" rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmar(null)} disabled={accionando}>Volver</Button>
          <Button variant={confirmar === "cancelar" ? "danger" : "primary"} loading={accionando} onClick={() => void ejecutar()}>
            {confirmar === "vendido" ? "Sí, marcar vendido" : "Sí, cancelar"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
