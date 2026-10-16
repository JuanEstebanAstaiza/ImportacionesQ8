import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Download, Eye, FileText, Loader2, Wallet, X } from "lucide-react";
import { toast } from "sonner";

import { DocumentUploadButton } from "@/app/components/files/DocumentUploadButton";
import {
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_INPUT,
  fechaCorta,
  mensajeError,
} from "@/features/tendencias/AprobacionComun";
import { abrirArchivoEnPestana, descargarArchivo } from "@/lib/abrir-archivo";
import type { BackendArchivoItem } from "@/services/business.service";
import { ACEPTA_COMPROBANTE, ORIGEN_COMPROBANTE } from "@/services/comprobantes.service";
import { pagosOrdenService, type ComprobanteOrden, type PagosOrden } from "@/services/pagosOrden.service";

/**
 * «Pago» de una orden. La orden nace como «Orden generada · pago pendiente»:
 * el cliente sube el comprobante (queda en su carpeta «Pagos/Operaciones/ORD-…»
 * de Documentos) y la empresa lo confirma o lo rechaza con un motivo. Con el
 * pago confirmado la empresa puede pasar la orden a producción.
 */

const FORMATO_COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const CHIP_COMPROBANTE: Record<ComprobanteOrden["estado"], { texto: string; clase: string }> = {
  pendiente: { texto: "Por confirmar", clase: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" },
  confirmado: { texto: "Confirmado", clase: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  rechazado: { texto: "Rechazado", clase: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
};

function estadoGeneral(p: PagosOrden): { texto: string; clase: string } {
  if (p.pago_confirmado) return { texto: "Pago confirmado", clase: CHIP_COMPROBANTE.confirmado.clase };
  if (p.comprobante_por_revisar) return { texto: "Comprobante en revisión", clase: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" };
  return { texto: "Pago pendiente", clase: CHIP_COMPROBANTE.pendiente.clase };
}

function explicacion(p: PagosOrden, esCliente: boolean): string {
  if (p.pago_confirmado) {
    return esCliente
      ? "La empresa confirmó tu pago. El siguiente paso es la producción."
      : "Pago confirmado. Ya puedes pasar la orden a «Orden en producción».";
  }
  if (p.comprobante_por_revisar) {
    return esCliente
      ? "Enviaste el comprobante: la empresa lo está revisando."
      : "El cliente envió el comprobante. Verifica que el dinero llegó y confirma el pago para pasar a producción.";
  }
  return esCliente
    ? "Realiza el pago acordado a la empresa y sube aquí el comprobante. La orden pasa a producción cuando la empresa confirme el pago."
    : "Esperando el comprobante del cliente. La orden no puede pasar a producción hasta que confirmes el pago.";
}

function FormularioComprobante({ pagos, onEnviado }: { pagos: PagosOrden; onEnviado: () => Promise<void> }) {
  const [archivo, setArchivo] = useState<BackendArchivoItem | null>(null);
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!archivo) return;
    const montoNum = Number(monto);
    if (monto.trim() !== "" && (!Number.isFinite(montoNum) || montoNum < 0)) {
      toast.error("Escribe el monto en pesos, sin puntos ni símbolos.");
      return;
    }
    setEnviando(true);
    try {
      await pagosOrdenService.enviar(pagos.orden_id, {
        archivo_id: archivo.id,
        monto_cop: monto.trim() === "" ? undefined : Math.round(montoNum),
        nota: nota.trim() || undefined,
      });
      toast.success("Comprobante enviado. Te avisaremos cuando la empresa lo confirme.");
      setArchivo(null);
      setMonto("");
      setNota("");
      await onEnviado();
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo enviar el comprobante."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={(e) => void enviar(e)} className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          Comprobante <span className="text-rose-600">*</span>
        </p>
        {archivo ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2">
            <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm" title={archivo.nombre}>{archivo.nombre}</span>
            <button
              type="button"
              onClick={() => setArchivo(null)}
              disabled={enviando}
              className="inline-flex flex-shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
            >
              <X className="h-3.5 w-3.5" /> Quitar
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <DocumentUploadButton
              label="Elegir archivo"
              carpetaId={pagos.carpeta_id}
              origen={ORIGEN_COMPROBANTE}
              accept={ACEPTA_COMPROBANTE}
              disabled={enviando}
              onUploaded={(a) => setArchivo(a)}
              onError={(m) => toast.error(m)}
            />
            <span className="text-xs text-muted-foreground">Imagen o PDF. Queda guardado en Documentos › Pagos › Operaciones.</span>
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Monto pagado (COP, opcional)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="Ej.: 7000000"
            className={CLASE_INPUT}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Nota para la empresa (opcional)</span>
          <input
            type="text"
            maxLength={500}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ej.: transferencia Bancolombia"
            className={CLASE_INPUT}
          />
        </label>
      </div>
      <button type="submit" disabled={!archivo || enviando} className={CLASE_BOTON_PRIMARIO}>
        {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Enviar comprobante a la empresa
      </button>
    </form>
  );
}

function FilaComprobante({ c, puedeRevisar, ordenId, onRevisado }: {
  c: ComprobanteOrden;
  puedeRevisar: boolean;
  ordenId: string;
  onRevisado: () => Promise<void>;
}) {
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const chip = CHIP_COMPROBANTE[c.estado];
  const nombre = c.archivo.nombre || "Comprobante";

  const confirmar = async () => {
    setTrabajando(true);
    try {
      await pagosOrdenService.confirmar(ordenId, c.id);
      toast.success("Pago confirmado. Ya puedes pasar la orden a producción.");
      await onRevisado();
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo confirmar el pago."));
    } finally {
      setTrabajando(false);
    }
  };

  const rechazar = async () => {
    if (motivo.trim().length < 5) {
      toast.error("Cuéntale al cliente por qué no confirmas el pago.");
      return;
    }
    setTrabajando(true);
    try {
      await pagosOrdenService.rechazar(ordenId, c.id, motivo.trim());
      toast.success("Le avisamos al cliente para que envíe otro comprobante.");
      setRechazando(false);
      setMotivo("");
      await onRevisado();
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo rechazar el comprobante."));
    } finally {
      setTrabajando(false);
    }
  };

  const abrir = async (descargar: boolean) => {
    const r = descargar ? await descargarArchivo(c.archivo.url, nombre) : await abrirArchivoEnPestana(c.archivo.url, nombre);
    if (!r.ok) toast.error(r.motivo);
  };

  return (
    <li className="px-1 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={nombre}>{nombre}</p>
            <p className="text-xs text-muted-foreground">
              Enviado el {fechaCorta(c.fecha)}
              {c.monto_cop != null && ` · ${FORMATO_COP.format(c.monto_cop)}`}
            </p>
            {c.nota && <p className="mt-0.5 text-xs text-muted-foreground">«{c.nota}»</p>}
            {c.estado === "rechazado" && c.motivo_rechazo && (
              <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">Motivo: {c.motivo_rechazo}</p>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${chip.clase}`}>{chip.texto}</span>
          <button type="button" onClick={() => void abrir(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Ver" aria-label={`Ver ${nombre}`}>
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => void abrir(true)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Descargar" aria-label={`Descargar ${nombre}`}>
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {puedeRevisar && c.estado === "pendiente" && (
        rechazando ? (
          <div className="mt-3 space-y-2 pl-6">
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Ej.: el valor no coincide con el total acordado, o el dinero no ha llegado."
              className={CLASE_INPUT}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void rechazar()} disabled={trabajando} className={CLASE_BOTON_PRIMARIO}>
                {trabajando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Enviar motivo al cliente
              </button>
              <button type="button" onClick={() => setRechazando(false)} disabled={trabajando} className={CLASE_BOTON_SECUNDARIO}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2 pl-6">
            <button type="button" onClick={() => void confirmar()} disabled={trabajando} className={CLASE_BOTON_PRIMARIO}>
              {trabajando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Confirmar pago recibido
            </button>
            <button type="button" onClick={() => setRechazando(true)} disabled={trabajando} className={CLASE_BOTON_SECUNDARIO}>
              No llegó / rechazar
            </button>
          </div>
        )
      )}
    </li>
  );
}

export function PagoOrden({ ordenId, esCliente, onPagoConfirmado }: {
  ordenId: string;
  esCliente: boolean;
  /** Avisa si el pago está confirmado: el botón de «Orden en producción» depende de esto. */
  onPagoConfirmado?: (confirmado: boolean) => void;
}) {
  const [pagos, setPagos] = useState<PagosOrden | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      const datos = await pagosOrdenService.ver(ordenId);
      setPagos(datos);
      setError("");
      onPagoConfirmado?.(datos.pago_confirmado);
    } catch (err) {
      setError(mensajeError(err, "No se pudo cargar el pago de la orden."));
    }
  }, [ordenId, onPagoConfirmado]);

  useEffect(() => {
    setPagos(null);
    void cargar();
  }, [cargar]);

  const chip = pagos ? estadoGeneral(pagos) : null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Wallet className="h-4 w-4 text-primary dark:text-accent" /> Pago de la orden
        </h3>
        {chip && <span className={`rounded px-2 py-0.5 text-xs font-medium ${chip.clase}`}>{chip.texto}</span>}
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !pagos ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Valor acordado</p>
              <p className="text-sm font-semibold">
                {pagos.monto_acordado ?? (pagos.precio_acordado_usd != null ? `US$${pagos.precio_acordado_usd.toLocaleString("es-CO")}` : "Ver propuesta")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Referencia</p>
              <p className="font-mono text-sm font-medium">{pagos.codigo}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{explicacion(pagos, esCliente)}</p>
          {pagos.puede_subir && <FormularioComprobante pagos={pagos} onEnviado={cargar} />}
          {pagos.comprobantes.length > 0 ? (
            <ul className="divide-y divide-border/60 border-t border-border">
              {pagos.comprobantes.map((c) => (
                <FilaComprobante key={c.id} c={c} ordenId={pagos.orden_id} puedeRevisar={pagos.puede_revisar} onRevisado={cargar} />
              ))}
            </ul>
          ) : (
            !pagos.puede_subir && <p className="text-xs text-muted-foreground">Aún no hay comprobantes.</p>
          )}
        </div>
      )}
    </div>
  );
}
