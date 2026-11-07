import { useState, type ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { clsx } from "clsx";

import {
  FORMAS_PAGO,
  dolares,
  fechaCorta,
  incluyeYNo,
  lineasCondiciones,
  pesos,
  resumenEntrega,
  textoTiempo,
  type DatosPropuesta,
} from "./calculo";

/**
 * La propuesta como tarjeta en el chat de la negociación. La crea el backend al
 * enviar o editar la propuesta (`tipo: "propuesta"`): cada versión es una
 * tarjeta, y las anteriores quedan marcadas como reemplazadas.
 */

export interface PropuestaEnMensaje {
  propuesta_id: string;
  cotizacion_id: string;
  version: number;
  empresa: string;
  producto: string;
  propuesta: DatosPropuesta;
}

/** `metadata` de un mensaje `tipo: "propuesta"`, o null si no tiene la forma esperada. */
export function leerPropuestaDeMensaje(metadata: Record<string, unknown> | null | undefined): PropuestaEnMensaje | null {
  const m = metadata as Partial<PropuestaEnMensaje> | null | undefined;
  if (m && typeof m.propuesta_id === "string" && m.propuesta?.schema === "propuesta-v2" && m.propuesta.totales) {
    return m as PropuestaEnMensaje;
  }
  return null;
}

type Props = {
  datos: PropuestaEnMensaje;
  /** El comprador ve los botones; la empresa ve su propia propuesta. */
  esCliente: boolean;
  /** Hay una versión más nueva de esta propuesta en el chat. */
  reemplazada: boolean;
  onElegir?: () => void;
  onPreguntar?: () => void;
};

function Fila({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className="mt-0.5 text-sm leading-relaxed">{children}</p>
    </div>
  );
}

export function TarjetaPropuestaChat({ datos, esCliente, reemplazada, onElegir, onPreguntar }: Props) {
  const [verCondiciones, setVerCondiciones] = useState(false);
  const { propuesta: d, empresa, producto, version } = datos;
  const f = d.formulario;
  const t = d.totales;
  const { incluye, noIncluye } = incluyeYNo(d);

  return (
    <div className={clsx("w-full max-w-md overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm",
      reemplazada ? "border-border opacity-70" : "border-primary/40 dark:border-accent/40")}>
      <div className="border-b border-border bg-primary/5 px-4 py-3 dark:bg-accent/10">
        <p className="text-sm font-semibold">{esCliente ? `Propuesta de ${empresa}` : "Tu propuesta"}</p>
        <p className="text-xs text-muted-foreground">
          Versión {version} · válida hasta el {fechaCorta(d.vigencia_hasta, false)}
          {reemplazada && " · reemplazada por una versión más nueva"}
        </p>
      </div>

      <div className="space-y-3 px-4 py-4">
        <p className="text-sm text-muted-foreground">{producto} · {f.cantidad.toLocaleString("es-CO")} unidades</p>
        <div>
          <p className="text-3xl font-bold tracking-tight">{pesos(t.total_cop)}</p>
          <p className="text-xs text-muted-foreground">Total con IVA. {empresa} te factura el total con factura electrónica.</p>
          <p className="mt-1 text-sm">
            <strong>{pesos(t.unitario_cop)}</strong> <span className="text-muted-foreground">por unidad · ≈ {dolares(t.unitario_usd)}</span>
          </p>
        </div>

        {f.mostrar_desglose && (
          <dl className="space-y-1 rounded-lg bg-muted/40 px-3 py-2 text-xs">
            <div className="flex justify-between"><dt className="text-muted-foreground">Producto · {dolares(t.producto_usd)}</dt><dd>{pesos(t.producto_cop)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Logística y nacionalización</dt><dd>{pesos(t.logistica_cop)}</dd></div>
            {t.entrega_cop > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Entrega en {f.ciudad_destino}</dt><dd>{pesos(t.entrega_cop)}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted-foreground">IVA {f.iva_pct} %</dt><dd>{pesos(t.iva_cop)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">TRM</dt><dd>{pesos(f.trm)}</dd></div>
          </dl>
        )}

        <Fila titulo="Entrega">{resumenEntrega(f, empresa)}</Fila>
        <Fila titulo="Tiempo">{textoTiempo(f)}.</Fila>
        <Fila titulo="Pago">{FORMAS_PAGO[d.condiciones.forma_pago]}, solo a la cuenta de {empresa} que ves en Zarpi.</Fila>
        <Fila titulo="Permisos">
          {f.requiere_permisos
            ? `Requiere ${f.permiso_cual}. ${f.permiso_gestiona === "importadora" ? `La gestiona ${empresa} y está incluida.` : "La gestionas tú, por tu cuenta."}`
            : "No requiere registros ni permisos especiales."}
        </Fila>

        <p className="text-sm"><strong>Incluye:</strong> {incluye.join(", ")}.</p>
        {noIncluye.length > 0 && <p className="text-sm"><strong>No incluye:</strong> {noIncluye.join(", ")}.</p>}
        {f.nota && <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm italic">«{f.nota}»</p>}

        <p className="text-xs text-muted-foreground">
          Precio cerrado: solo puede cambiar hasta un {d.variacion_maxima_pct} % por los supuestos de esta propuesta y solo con tu aprobación.
        </p>

        {esCliente && !reemplazada && (
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <button type="button" onClick={onElegir}
              className="h-10 flex-1 rounded-lg bg-primary text-sm font-semibold text-white hover:bg-primary/90 dark:bg-accent dark:text-accent-foreground">
              Elegir esta propuesta
            </button>
            <button type="button" onClick={onPreguntar}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-medium hover:bg-muted">
              <MessageCircle className="h-4 w-4" /> Hacer una pregunta
            </button>
          </div>
        )}

        <button type="button" onClick={() => setVerCondiciones((v) => !v)} className="text-left text-xs font-medium text-primary hover:underline dark:text-accent">
          {verCondiciones ? "Ocultar condiciones" : "Ver condiciones completas: cancelación, faltantes, tolerancia y documentos"}
        </button>
        {verCondiciones && (
          <ul className="space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
            {lineasCondiciones(d.condiciones, empresa).map((linea) => <li key={linea}>{linea}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
