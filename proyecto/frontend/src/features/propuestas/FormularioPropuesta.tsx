import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2, Save, Send } from "lucide-react";
import { clsx } from "clsx";

import { businessService } from "@/services/business.service";

import {
  CONDICIONES_POR_DEFECTO,
  FORMAS_PAGO,
  VARIACION_MAXIMA_PCT,
  calcular,
  dolares,
  fechaCorta,
  leerNumero,
  lineasCondiciones,
  numeroEnCampo,
  pesos,
  resumenEntrega,
  sumarDias,
  textoTiempo,
  type CondicionesPropuesta,
  type DatosPropuesta,
  type FormularioPropuesta as Formulario,
  type IvaPct,
  type ModoEntrega,
  type Via,
} from "./calculo";

/**
 * «Nueva propuesta»: lo que llena la importadora para responder una cotización.
 * Reemplaza la calculadora del chat y el formulario de tres pasos.
 *
 * Dos precios (producto en USD y logística), la entrega, el tiempo y los
 * permisos. Lo demás (bodega, tiempos por vía, IVA, vigencia, pago,
 * cancelación…) sale de «Mi empresa › Condiciones de tus propuestas». A la
 * derecha, lo que recibe el cliente: un precio cerrado en pesos, IVA incluido.
 */

export interface CotizacionDePropuesta {
  codigo: string;
  producto: string;
  cantidad: number;
  cantidadTexto: string;
  cliente?: string;
  ciudad?: string | null;
}

type Props = {
  cotizacion: CotizacionDePropuesta;
  empresa: string;
  /** Propuesta del formato nuevo ya guardada (borrador o enviada), para editarla. */
  inicial: DatosPropuesta | null;
  textoEnviar: string;
  esBorrador: boolean;
  guardando: boolean;
  error?: string;
  onEnviar: (formulario: Formulario) => void;
  onCancelar: () => void;
  /** Solo la cuenta dueña puede editar las condiciones. */
  onEditarCondiciones?: () => void;
};

const CLASE_INPUT =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:focus:border-accent dark:focus:ring-accent/20";

function Seccion({ numero, titulo, children }: { numero: number; titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2.5 text-sm font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary dark:bg-accent/15 dark:text-accent">
          {numero}
        </span>
        {titulo}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Opcion({ activa, onClick, titulo, detalle }: { activa: boolean; onClick: () => void; titulo: string; detalle?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      onClick={onClick}
      className={clsx(
        "flex-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
        activa
          ? "border-primary bg-primary/5 ring-1 ring-primary/30 dark:border-accent dark:bg-accent/10 dark:ring-accent/30"
          : "border-border hover:bg-muted/50",
      )}
    >
      <span className={clsx("block text-sm font-medium", activa && "text-primary dark:text-accent")}>{titulo}</span>
      {detalle && <span className="mt-0.5 block text-xs text-muted-foreground">{detalle}</span>}
    </button>
  );
}

function Etiqueta({ texto, children, ayuda }: { texto: string; children: ReactNode; ayuda?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{texto}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-muted-foreground">{ayuda}</span>}
    </label>
  );
}

function ConPrefijo({ prefijo, children }: { prefijo: string; children: ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefijo}</span>
      <div className="[&_input]:pl-11">{children}</div>
    </div>
  );
}

function entregaPorDefecto(c: CondicionesPropuesta, ciudad: string): ModoEntrega {
  const destino = ciudad.trim().toLowerCase();
  if (destino && c.ciudades_entrega_incluida.some((x) => x.trim().toLowerCase() === destino)) return "incluida";
  return c.entrega_otras_ciudades;
}

export function FormularioPropuesta({
  cotizacion, empresa, inicial, textoEnviar, esBorrador, guardando, error, onEnviar, onCancelar, onEditarCondiciones,
}: Props) {
  const [condiciones, setCondiciones] = useState<CondicionesPropuesta | null>(null);
  const [sinCondiciones, setSinCondiciones] = useState(false);

  // Campos como texto: se escriben a la colombiana («1.700», «4,80»).
  const [precio, setPrecio] = useState("");
  const [cantidad, setCantidad] = useState(cotizacion.cantidad > 0 ? numeroEnCampo(cotizacion.cantidad) : "");
  const [logistica, setLogistica] = useState("");
  const [logisticaMoneda, setLogisticaMoneda] = useState<"USD" | "COP">("USD");
  const [trm, setTrm] = useState("");
  const [iva, setIva] = useState<IvaPct>(19);
  const [bodegaCiudad, setBodegaCiudad] = useState("");
  const [bodegaDireccion, setBodegaDireccion] = useState("");
  const [cambiandoBodega, setCambiandoBodega] = useState(false);
  const [destino, setDestino] = useState(cotizacion.ciudad || "");
  const [entrega, setEntrega] = useState<ModoEntrega>("cliente");
  const [entregaValor, setEntregaValor] = useState("");
  const [fleteAprox, setFleteAprox] = useState("");
  const [via, setVia] = useState<Via>("maritimo");
  const [diasMin, setDiasMin] = useState("");
  const [diasMax, setDiasMax] = useState("");
  const [permisos, setPermisos] = useState<"si" | "no" | null>(null);
  const [permisoCual, setPermisoCual] = useState("");
  const [permisoGestiona, setPermisoGestiona] = useState<"importadora" | "cliente">("importadora");
  const [verCondiciones, setVerCondiciones] = useState(false);
  const [conNota, setConNota] = useState(false);
  const [nota, setNota] = useState("");
  const [desglose, setDesglose] = useState(false);

  // Condiciones de la empresa y TRM del día; una propuesta guardada manda.
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const [cond, tasa] = await Promise.all([
        businessService.getProposalConditions().catch(() => null),
        businessService.getTrm().catch(() => null),
      ]);
      if (cancelado) return;
      const c = cond ?? { ...CONDICIONES_POR_DEFECTO, configuradas: false };
      setCondiciones(c);
      setSinCondiciones(!c.configuradas);
      const f = inicial?.formulario;
      if (f) {
        setPrecio(numeroEnCampo(f.precio_unitario_usd));
        setCantidad(numeroEnCampo(f.cantidad));
        setLogistica(numeroEnCampo(f.logistica_valor));
        setLogisticaMoneda(f.logistica_moneda);
        setTrm(numeroEnCampo(f.trm));
        setIva(f.iva_pct);
        setBodegaCiudad(f.bodega_ciudad);
        setBodegaDireccion(f.bodega_direccion || "");
        setDestino(f.ciudad_destino);
        setEntrega(f.entrega_modo);
        setEntregaValor(numeroEnCampo(f.entrega_valor_cop));
        setFleteAprox(numeroEnCampo(f.flete_aprox_cop));
        setVia(f.via);
        setDiasMin(String(f.dias_min));
        setDiasMax(String(f.dias_max));
        setPermisos(f.requiere_permisos ? "si" : "no");
        setPermisoCual(f.permiso_cual || "");
        setPermisoGestiona(f.permiso_gestiona);
        setNota(f.nota || "");
        setConNota(Boolean(f.nota));
        setDesglose(f.mostrar_desglose);
        return;
      }
      setTrm(tasa?.valor ? numeroEnCampo(Math.round(tasa.valor)) : "");
      setIva(c.iva_pct);
      setBodegaCiudad(c.bodega_ciudad);
      setBodegaDireccion(c.bodega_direccion);
      setCambiandoBodega(!c.bodega_ciudad);
      setEntrega(entregaPorDefecto(c, cotizacion.ciudad || ""));
      setDiasMin(String(c.tiempo_maritimo.minimo));
      setDiasMax(String(c.tiempo_maritimo.maximo));
    })();
    return () => { cancelado = true; };
    // Solo al abrir: después manda lo que escriba la empresa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const n = {
    precio: leerNumero(precio), cantidad: leerNumero(cantidad), logistica: leerNumero(logistica), trm: leerNumero(trm),
    entrega: leerNumero(entregaValor), flete: leerNumero(fleteAprox), min: leerNumero(diasMin), max: leerNumero(diasMax),
  };
  const precioOk = n.precio > 0 && n.cantidad > 0 && n.logistica >= 0 && n.trm > 0;
  const entregaOk = entrega !== "fijo" || n.entrega > 0;
  const tiempoOk = n.min > 0 && n.max >= n.min;
  const rangoMal = n.min > 0 && n.max > 0 && n.max < n.min;
  const destinoOk = destino.trim().length >= 2 && bodegaCiudad.trim().length >= 2;

  const formulario: Formulario | null = precioOk && entregaOk
    ? {
        precio_unitario_usd: n.precio,
        cantidad: n.cantidad,
        logistica_valor: n.logistica,
        logistica_moneda: logisticaMoneda,
        trm: n.trm,
        iva_pct: iva,
        bodega_ciudad: bodegaCiudad.trim(),
        bodega_direccion: bodegaDireccion.trim() || null,
        ciudad_destino: destino.trim(),
        entrega_modo: entrega,
        entrega_valor_cop: entrega === "fijo" ? n.entrega : null,
        flete_aprox_cop: entrega === "cliente" && n.flete > 0 ? n.flete : null,
        via,
        dias_min: Math.round(n.min) || 0,
        dias_max: Math.round(n.max) || 0,
        requiere_permisos: permisos === "si",
        permiso_cual: permisos === "si" ? permisoCual.trim() || null : null,
        permiso_gestiona: permisoGestiona,
        nota: conNota ? nota.trim() || null : null,
        mostrar_desglose: desglose,
      }
    : null;
  const totales = formulario ? calcular(formulario) : null;

  const falta: string[] = [];
  if (!precioOk) falta.push("precio");
  if (!destinoOk) falta.push("ciudad de entrega");
  if (!entregaOk) falta.push("valor de la entrega");
  if (!tiempoOk) falta.push("tiempo de entrega");
  if (permisos === null) falta.push("registros y permisos");
  else if (permisos === "si" && permisoCual.trim().length < 2) falta.push("cuál permiso");
  const completa = falta.length === 0 && formulario !== null;

  if (!condiciones) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const ciudadDestino = destino.trim() || "la ciudad del cliente";
  const elegirVia = (v: Via) => {
    setVia(v);
    const rango = v === "aereo" ? condiciones.tiempo_aereo : condiciones.tiempo_maritimo;
    setDiasMin(String(rango.minimo));
    setDiasMax(String(rango.maximo));
  };
  const resumenCondiciones = [
    FORMAS_PAGO[condiciones.forma_pago],
    condiciones.seguro_incluido ? "seguro incluido" : "sin seguro",
    `válida ${condiciones.vigencia_dias} días`,
    "cancelación por etapa",
  ].join(" · ");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:items-start">
      <div className="min-w-0 space-y-4">
        <p className="text-sm text-muted-foreground">
          {[cotizacion.codigo, cotizacion.producto, cotizacion.cantidadTexto,
            [cotizacion.cliente, cotizacion.ciudad].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
        </p>

        {sinCondiciones && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              Tu empresa todavía no llenó sus condiciones de propuesta: se usan las de por defecto.
              {onEditarCondiciones && (
                <> <button type="button" onClick={onEditarCondiciones} className="font-semibold underline">Llenarlas en Mi empresa</button>.</>
              )}
            </span>
          </div>
        )}

        <Seccion numero={1} titulo="Precio">
          <div className="grid gap-4 sm:grid-cols-[1fr_140px_1fr]">
            <Etiqueta texto="Precio por unidad en China">
              <ConPrefijo prefijo="USD"><input className={CLASE_INPUT} inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="4,80" /></ConPrefijo>
            </Etiqueta>
            <Etiqueta texto="Cantidad">
              <input className={CLASE_INPUT} inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            </Etiqueta>
            <Etiqueta texto="Producto">
              <div className="flex h-10 items-center rounded-lg bg-muted/50 px-3 text-sm font-medium">
                {n.precio > 0 && n.cantidad > 0 ? dolares(n.precio * n.cantidad) : "—"}
              </div>
            </Etiqueta>
          </div>
          <Etiqueta
            texto="Logística y nacionalización, total del envío"
            ayuda="Flete, seguro, aranceles, agenciamiento y tu gestión, hasta tu bodega. Sin el IVA de la venta."
          >
            <div className="flex gap-2">
              <input className={CLASE_INPUT} inputMode="decimal" value={logistica} onChange={(e) => setLogistica(e.target.value)} placeholder="1.700" />
              <div className="flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Moneda de la logística">
                {(["USD", "COP"] as const).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={logisticaMoneda === m} onClick={() => setLogisticaMoneda(m)}
                    className={clsx("rounded-md px-3 text-xs font-semibold", logisticaMoneda === m ? "bg-primary text-white dark:bg-accent dark:text-accent-foreground" : "text-muted-foreground")}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </Etiqueta>
        </Seccion>

        <Seccion numero={2} titulo="Entrega">
          <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
            {cambiandoBodega ? (
              <div className="grid w-full gap-3 sm:grid-cols-2">
                <Etiqueta texto="Ciudad de tu bodega"><input className={CLASE_INPUT} value={bodegaCiudad} onChange={(e) => setBodegaCiudad(e.target.value)} placeholder="Cali" /></Etiqueta>
                <Etiqueta texto="Dirección (opcional)"><input className={CLASE_INPUT} value={bodegaDireccion} onChange={(e) => setBodegaDireccion(e.target.value)} /></Etiqueta>
              </div>
            ) : (
              <>
                <span>Tu precio queda puesto en <strong>Bodega {empresa} · {bodegaCiudad}</strong></span>
                <button type="button" onClick={() => setCambiandoBodega(true)} className="text-xs font-semibold text-primary hover:underline dark:text-accent">Cambiar</button>
              </>
            )}
          </div>
          {cotizacion.ciudad ? (
            <p className="text-sm">La solicitud es para <strong>{cotizacion.ciudad}</strong>. Hasta allá, la entrega es:</p>
          ) : (
            <Etiqueta texto="Ciudad de entrega del cliente" ayuda="Esta solicitud no la trae: escríbela.">
              <input className={CLASE_INPUT} value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Medellín" />
            </Etiqueta>
          )}
          <div className="flex flex-col gap-2 sm:flex-row" role="radiogroup" aria-label="Entrega">
            <Opcion activa={entrega === "incluida"} onClick={() => setEntrega("incluida")} titulo="Incluida" detalle="Hasta su dirección" />
            <Opcion activa={entrega === "fijo"} onClick={() => setEntrega("fijo")} titulo="Valor fijo" detalle="Se suma y va en la factura" />
            <Opcion activa={entrega === "cliente"} onClick={() => setEntrega("cliente")} titulo="A cargo del cliente" detalle="Transportadora, paga al recibir" />
          </div>
          {entrega === "fijo" && (
            <Etiqueta texto={`Valor de la entrega en ${ciudadDestino}`} ayuda="Se suma al subtotal y va en la factura.">
              <ConPrefijo prefijo="$"><input className={CLASE_INPUT} inputMode="numeric" value={entregaValor} onChange={(e) => setEntregaValor(e.target.value)} /></ConPrefijo>
            </Etiqueta>
          )}
          {entrega === "cliente" && (
            <Etiqueta texto={`Flete aproximado a ${ciudadDestino} (opcional)`} ayuda="No suma a tu total. Le sirve al cliente para saber cuánto le cuesta en su ciudad.">
              <ConPrefijo prefijo="$"><input className={CLASE_INPUT} inputMode="numeric" value={fleteAprox} onChange={(e) => setFleteAprox(e.target.value)} placeholder="220.000" /></ConPrefijo>
            </Etiqueta>
          )}
          <p className="text-xs text-muted-foreground">
            {entrega === "cliente"
              ? `Tu entrega termina al despachar desde ${bodegaCiudad || "tu bodega"}. La guía de la transportadora es la constancia.`
              : `Tu entrega termina en la dirección del cliente en ${ciudadDestino}, con la constancia de recepción.`}
          </p>
        </Seccion>

        <Seccion numero={3} titulo="Tiempo de entrega">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex gap-2 sm:w-64" role="radiogroup" aria-label="Vía">
              <Opcion activa={via === "maritimo"} onClick={() => elegirVia("maritimo")} titulo="Marítimo" />
              <Opcion activa={via === "aereo"} onClick={() => elegirVia("aereo")} titulo="Aéreo" />
            </div>
            <div className="flex items-center gap-2 text-sm">
              De <input className={`${CLASE_INPUT} w-20`} inputMode="numeric" value={diasMin} onChange={(e) => setDiasMin(e.target.value)} aria-label="Días mínimos" />
              a <input className={`${CLASE_INPUT} w-20`} inputMode="numeric" value={diasMax} onChange={(e) => setDiasMax(e.target.value)} aria-label="Días máximos" />
              <span className="text-muted-foreground">días desde el anticipo</span>
            </div>
          </div>
          {rangoMal && <p className="text-xs text-destructive">El máximo tiene que ser igual o mayor que el mínimo.</p>}
          <p className="text-xs text-muted-foreground">
            Tu cumplimiento se mide contra el máximo de este rango. Al elegir la vía se llenan tus tiempos de Mi empresa.
          </p>
        </Seccion>

        <Seccion numero={4} titulo="Registros y permisos">
          <p className="text-sm">¿El producto necesita registros, permisos o vistos buenos (INVIMA, ICA, reglamentos técnicos)?</p>
          <div className="flex gap-2 sm:w-64" role="radiogroup" aria-label="Requiere permisos">
            <Opcion activa={permisos === "no"} onClick={() => setPermisos("no")} titulo="No" />
            <Opcion activa={permisos === "si"} onClick={() => setPermisos("si")} titulo="Sí" />
          </div>
          {permisos === "si" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Etiqueta texto="¿Cuál?">
                <input className={CLASE_INPUT} value={permisoCual} onChange={(e) => setPermisoCual(e.target.value)} maxLength={200} placeholder="Notificación sanitaria INVIMA" />
              </Etiqueta>
              <Etiqueta texto="¿Quién lo gestiona?">
                <select className={CLASE_INPUT} value={permisoGestiona} onChange={(e) => setPermisoGestiona(e.target.value as "importadora" | "cliente")}>
                  <option value="importadora">Yo, incluido en el precio</option>
                  <option value="cliente">El cliente, por su cuenta</option>
                </select>
              </Etiqueta>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Lo que no se declare aquí no se le puede cobrar después al cliente.</p>
        </Seccion>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Condiciones de {empresa}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{resumenCondiciones}</p>
            </div>
            <button type="button" onClick={() => setVerCondiciones((v) => !v)} className="text-xs font-semibold text-primary hover:underline dark:text-accent">
              {verCondiciones ? "Ocultar" : "Ver todas"}
            </button>
          </div>
          {verCondiciones && (
            <div className="mt-3 border-t border-border pt-3">
              <ul className="space-y-1.5 text-sm">
                {lineasCondiciones(condiciones, empresa).map((linea) => <li key={linea}>{linea}</li>)}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Vienen de tu perfil.
                {onEditarCondiciones && <> <button type="button" onClick={onEditarCondiciones} className="font-semibold text-primary hover:underline dark:text-accent">Editarlas en Mi empresa</button></>}
              </p>
            </div>
          )}
        </section>

        {conNota ? (
          <Etiqueta texto="Nota para el cliente (opcional)">
            <textarea className={`${CLASE_INPUT} h-auto min-h-[80px] py-2`} value={nota} onChange={(e) => setNota(e.target.value)} maxLength={1000} />
          </Etiqueta>
        ) : (
          <button type="button" onClick={() => setConNota(true)} className="text-sm font-medium text-primary hover:underline dark:text-accent">
            + Agregar una nota para el cliente
          </button>
        )}
      </div>

      <aside className="min-w-0 lg:sticky lg:top-0">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lo que recibe el cliente</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{totales ? pesos(totales.total_cop) : "—"}</p>
          <p className="text-xs text-muted-foreground">Total en pesos, IVA incluido</p>
          <p className="mt-1 text-sm">
            <strong>{totales ? pesos(totales.unitario_cop) : "—"}</strong>{" "}
            <span className="text-muted-foreground">por unidad · ≈ {totales ? dolares(totales.unitario_usd) : "—"}</span>
          </p>
          {!completa && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              Falta: {falta.join(", ")}. Sin eso la propuesta no se puede enviar.
            </p>
          )}

          <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Producto · {n.precio > 0 && n.cantidad > 0 ? dolares(n.precio * n.cantidad) : "—"}</dt><dd>{totales ? pesos(totales.producto_cop) : "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Logística · {logisticaMoneda === "USD" ? (n.logistica >= 0 ? dolares(n.logistica) : "—") : "en pesos"}</dt><dd>{totales ? pesos(totales.logistica_cop) : "—"}</dd></div>
            {entrega === "fijo" && (
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Entrega en {ciudadDestino}</dt><dd>{pesos(n.entrega > 0 ? n.entrega : 0)}</dd></div>
            )}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">TRM de esta propuesta</dt>
              <dd><input className="h-8 w-24 rounded-md border border-border bg-background px-2 text-right text-sm" inputMode="decimal" value={trm} onChange={(e) => setTrm(e.target.value)} aria-label="TRM de esta propuesta" /></dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-border pt-2 font-medium"><dt>Subtotal</dt><dd>{totales ? pesos(totales.subtotal_cop) : "—"}</dd></div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-muted-foreground">
                IVA de la venta
                <span className="flex rounded-md border border-border p-0.5" role="radiogroup" aria-label="IVA de la venta">
                  {([19, 5, 0] as const).map((v) => (
                    <button key={v} type="button" role="radio" aria-checked={iva === v} onClick={() => setIva(v)}
                      className={clsx("rounded px-1.5 text-[11px] font-semibold", iva === v ? "bg-primary text-white dark:bg-accent dark:text-accent-foreground" : "text-muted-foreground")}>
                      {v} %
                    </button>
                  ))}
                </span>
              </dt>
              <dd>{totales ? pesos(totales.iva_cop) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-border pt-2 text-base font-bold"><dt>Total</dt><dd>{totales ? pesos(totales.total_cop) : "—"}</dd></div>
          </dl>

          <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
            {formulario && destinoOk && <p>{resumenEntrega(formulario, empresa)}</p>}
            <p>{tiempoOk ? `${textoTiempo({ dias_min: Math.round(n.min), dias_max: Math.round(n.max), via })}.` : "Falta el tiempo de entrega."}</p>
            <p>Válida {condiciones.vigencia_dias} días, hasta el {fechaCorta(sumarDias(condiciones.vigencia_dias))}.</p>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={desglose} onChange={(e) => setDesglose(e.target.checked)} />
            Mostrarle el desglose al cliente
          </label>
          <p className="mt-3 text-xs text-muted-foreground">
            Precio cerrado en pesos. Una vez aceptada, la propuesta solo puede variar hasta {VARIACION_MAXIMA_PCT} % por los
            supuestos declarados y con aprobación del cliente.
          </p>

          {error && <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <div className="mt-4 flex gap-2">
            <button type="button" onClick={onCancelar} className="h-10 flex-1 rounded-lg border border-border text-sm font-medium hover:bg-muted">Cancelar</button>
            <button
              type="button"
              disabled={!completa || guardando}
              onClick={() => formulario && onEnviar(formulario)}
              className="inline-flex h-10 flex-[2] items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent dark:text-accent-foreground"
            >
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : esBorrador ? <Save className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {textoEnviar}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
