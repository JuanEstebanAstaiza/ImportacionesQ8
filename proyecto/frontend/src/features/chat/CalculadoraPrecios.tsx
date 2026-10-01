import { useEffect, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Calculator, FileSignature, Loader2, Send, X } from "lucide-react";

import {
  businessService,
  type DesgloseEstimacion,
  type EstimacionEnMensaje,
  type EstimacionPrecioEntrada,
  type MonedaEstimacion,
} from "@/services/business.service";

/**
 * Calculadora de precios del chat de negociación.
 *
 * La empresa (dueño o asesor) la abre desde el chat mientras habla con el
 * cliente y le envía un precio estimado de su cotización u orden. El desglose
 * lo calcula siempre el backend: la vista previa y el mensaje salen de la misma
 * función (`services/calculadora_precios.py`), así que lo que la empresa ve es
 * exactamente lo que recibe el cliente.
 */

const MONEDAS: MonedaEstimacion[] = ["USD", "COP", "EUR", "CNY"];
const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];
const RETARDO_VISTA_PREVIA_MS = 350;
// Los porcentajes y la tasa suelen repetirse de un cliente a otro: se recuerdan
// en este navegador para no reescribirlos en cada conversación.
const CLAVE_PREFERENCIAS = "calculadora-precios:preferencias";

type Formulario = {
  moneda: MonedaEstimacion;
  cantidad: string;
  precio_unitario: string;
  flete_internacional: string;
  seguro_pct: string;
  arancel_pct: string;
  iva_pct: string;
  gastos_destino: string;
  margen_pct: string;
  rango_pct: string;
  tasa_cambio_cop: string;
  incoterm: string;
  tiempo_entrega: string;
  validez_dias: string;
  notas: string;
};

const CAMPOS_PREFERENCIA = ["moneda", "seguro_pct", "arancel_pct", "iva_pct", "margen_pct", "rango_pct", "tasa_cambio_cop"] as const;

const FORMULARIO_BASE: Formulario = {
  moneda: "USD",
  cantidad: "",
  precio_unitario: "",
  flete_internacional: "0",
  seguro_pct: "0",
  arancel_pct: "0",
  iva_pct: "19",
  gastos_destino: "0",
  margen_pct: "0",
  rango_pct: "0",
  tasa_cambio_cop: "",
  incoterm: "",
  tiempo_entrega: "",
  validez_dias: "15",
  notas: "",
};

function leerPreferencias(): Partial<Formulario> {
  try {
    const crudo = window.localStorage.getItem(CLAVE_PREFERENCIAS);
    const datos = crudo ? JSON.parse(crudo) : null;
    if (!datos || typeof datos !== "object") return {};
    const resultado: Partial<Formulario> = {};
    for (const campo of CAMPOS_PREFERENCIA) {
      if (typeof datos[campo] === "string") (resultado as Record<string, string>)[campo] = datos[campo];
    }
    if (resultado.moneda && !MONEDAS.includes(resultado.moneda)) delete resultado.moneda;
    return resultado;
  } catch {
    return {};
  }
}

function guardarPreferencias(form: Formulario): void {
  try {
    const datos = Object.fromEntries(CAMPOS_PREFERENCIA.map((campo) => [campo, form[campo]]));
    window.localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify(datos));
  } catch {
    /* sin almacenamiento: la calculadora funciona igual */
  }
}

function numero(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (!limpio) return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : null;
}

/** Convierte el formulario al payload del backend, o explica qué falta. */
function aEntrada(form: Formulario): { entrada?: EstimacionPrecioEntrada; error?: string } {
  const cantidad = numero(form.cantidad);
  if (cantidad === null || !Number.isInteger(cantidad) || cantidad < 1) {
    return { error: "Indica una cantidad entera mayor que 0." };
  }
  const precio = numero(form.precio_unitario);
  if (precio === null || precio < 0) {
    return { error: "Indica el precio unitario." };
  }
  const importes = {
    flete_internacional: numero(form.flete_internacional) ?? 0,
    gastos_destino: numero(form.gastos_destino) ?? 0,
  };
  const porcentajes = {
    seguro_pct: numero(form.seguro_pct) ?? 0,
    arancel_pct: numero(form.arancel_pct) ?? 0,
    iva_pct: numero(form.iva_pct) ?? 0,
    margen_pct: numero(form.margen_pct) ?? 0,
    rango_pct: numero(form.rango_pct) ?? 0,
  };
  if (Object.values(importes).some((v) => v < 0)) {
    return { error: "Los importes no pueden ser negativos." };
  }
  if (Object.values(porcentajes).some((v) => v < 0 || v > 100)) {
    return { error: "Los porcentajes van de 0 a 100." };
  }
  if (porcentajes.rango_pct > 50) {
    return { error: "El rango de precios admite hasta ±50 %." };
  }
  const tasa = numero(form.tasa_cambio_cop);
  if (tasa !== null && tasa <= 0) {
    return { error: "La tasa de cambio debe ser mayor que 0." };
  }
  const validez = numero(form.validez_dias);
  if (validez !== null && (!Number.isInteger(validez) || validez < 1 || validez > 90)) {
    return { error: "La validez va de 1 a 90 días." };
  }
  return {
    entrada: {
      moneda: form.moneda,
      cantidad,
      precio_unitario: precio,
      ...importes,
      ...porcentajes,
      tasa_cambio_cop: form.moneda === "COP" ? null : tasa,
      incoterm: form.incoterm || null,
      tiempo_entrega: form.tiempo_entrega.trim() || null,
      validez_dias: validez,
      notas: form.notas.trim() || null,
    },
  };
}

export function formatoMoneda(valor: number, moneda: string): string {
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: moneda, maximumFractionDigits: 2 }).format(valor);
  } catch {
    return `${moneda} ${valor.toFixed(2)}`;
  }
}

function LineasDesglose({ desglose, entrada }: { desglose: DesgloseEstimacion; entrada: EstimacionPrecioEntrada }) {
  const m = entrada.moneda;
  const lineas: Array<[string, number, boolean?]> = [
    [`Mercancía (${entrada.cantidad.toLocaleString("es-CO")} u.)`, desglose.valor_mercancia],
    ["Flete internacional", desglose.flete_internacional],
    [`Seguro (${entrada.seguro_pct} %)`, desglose.seguro],
    ["Valor CIF", desglose.valor_cif, true],
    [`Arancel (${entrada.arancel_pct} %)`, desglose.arancel],
    [`IVA (${entrada.iva_pct} %)`, desglose.iva],
    ["Gastos en destino", desglose.gastos_destino],
    [`Gestión de la empresa (${entrada.margen_pct} %)`, desglose.margen],
  ];
  return (
    <dl className="space-y-1 text-xs">
      {lineas
        .filter(([, valor, destacado]) => destacado || valor > 0)
        .map(([etiqueta, valor, destacado]) => (
          <div key={etiqueta} className={`flex justify-between gap-3 ${destacado ? "border-t border-border pt-1 font-medium text-foreground" : "text-muted-foreground"}`}>
            <dt className="min-w-0">{etiqueta}</dt>
            <dd className="tabular-nums whitespace-nowrap">{formatoMoneda(valor, m)}</dd>
          </div>
        ))}
    </dl>
  );
}

function Totales({ desglose, entrada }: { desglose: DesgloseEstimacion; entrada: EstimacionPrecioEntrada }) {
  const m = entrada.moneda;
  return (
    <div className="space-y-1">
      <p className="text-2xl font-semibold tabular-nums text-foreground">{formatoMoneda(desglose.total, m)}</p>
      <p className="text-xs text-muted-foreground">
        {formatoMoneda(desglose.costo_unitario, m)} por unidad
        {desglose.total_cop !== null && <> · ≈ {formatoMoneda(desglose.total_cop, "COP")}</>}
      </p>
      {entrada.rango_pct > 0 && (
        <p className="text-xs text-foreground">
          Rango posible: <span className="tabular-nums font-medium">{formatoMoneda(desglose.total_minimo, m)} – {formatoMoneda(desglose.total_maximo, m)}</span>
        </p>
      )}
    </div>
  );
}

/** Valores con los que la estimación prellena la propuesta formal. */
export interface PropuestaDesdeEstimacion {
  /** Vacío si la estimación no está en USD: la propuesta solo admite USD. */
  precioTotalUsd: string;
  precioUnitarioUsd: string;
  monedaOrigen: MonedaEstimacion;
  cantidad: string;
  incoterm: string;
  tiempoEntrega: string;
  descripcion: string;
}

/**
 * Traduce una estimación del chat a los campos de la propuesta formal. El
 * desglose va a la descripción para que el cliente vea en la propuesta lo
 * mismo que se le explicó en el chat.
 */
export function propuestaDesdeEstimacion(estimacion: EstimacionEnMensaje): PropuestaDesdeEstimacion {
  const { entrada, desglose } = estimacion;
  const m = entrada.moneda;
  const lineas = [
    `Precio basado en la estimación enviada por el chat (${m}):`,
    `- Mercancía (${entrada.cantidad} u. × ${formatoMoneda(entrada.precio_unitario, m)}): ${formatoMoneda(desglose.valor_mercancia, m)}`,
    desglose.flete_internacional > 0 ? `- Flete internacional: ${formatoMoneda(desglose.flete_internacional, m)}` : null,
    desglose.seguro > 0 ? `- Seguro (${entrada.seguro_pct} %): ${formatoMoneda(desglose.seguro, m)}` : null,
    `- Valor CIF: ${formatoMoneda(desglose.valor_cif, m)}`,
    desglose.arancel > 0 ? `- Arancel (${entrada.arancel_pct} %): ${formatoMoneda(desglose.arancel, m)}` : null,
    desglose.iva > 0 ? `- IVA (${entrada.iva_pct} %): ${formatoMoneda(desglose.iva, m)}` : null,
    desglose.gastos_destino > 0 ? `- Gastos en destino: ${formatoMoneda(desglose.gastos_destino, m)}` : null,
    desglose.margen > 0 ? `- Gestión de la empresa (${entrada.margen_pct} %): ${formatoMoneda(desglose.margen, m)}` : null,
    `- Total: ${formatoMoneda(desglose.total, m)} (${formatoMoneda(desglose.costo_unitario, m)} por unidad)`,
    entrada.validez_dias ? `Válida por ${entrada.validez_dias} días.` : null,
    entrada.notas ? `\n${entrada.notas}` : null,
  ].filter(Boolean);
  const enUsd = m === "USD";
  return {
    precioTotalUsd: enUsd ? desglose.total.toFixed(2) : "",
    precioUnitarioUsd: enUsd ? desglose.costo_unitario.toFixed(2) : "",
    monedaOrigen: m,
    cantidad: String(entrada.cantidad),
    incoterm: entrada.incoterm || "",
    tiempoEntrega: entrada.tiempo_entrega || "",
    descripcion: lineas.join("\n"),
  };
}

export interface AccionEstimacion {
  etiqueta: string;
  onClick: () => void;
}

/** Tarjeta de la estimación dentro del hilo, para el cliente y para la empresa. */
export function TarjetaEstimacion({
  estimacion,
  propia,
  accion,
}: {
  estimacion: EstimacionEnMensaje;
  propia: boolean;
  /** Solo la empresa: pasar la estimación a la propuesta formal. */
  accion?: AccionEstimacion;
}) {
  const { entrada, desglose } = estimacion;
  const detalles = [
    entrada.incoterm ? `Incoterm ${entrada.incoterm}` : null,
    entrada.tiempo_entrega ? `Entrega: ${entrada.tiempo_entrega}` : null,
    entrada.validez_dias ? `Válida por ${entrada.validez_dias} días` : null,
  ].filter(Boolean);
  return (
    <div className={`w-[300px] max-w-full rounded-2xl border bg-white p-3 shadow-sm ${propia ? "border-primary/40 rounded-br-sm" : "border-border rounded-bl-sm"}`}>
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
        <Calculator className="h-3.5 w-3.5" />Estimación de precio
      </p>
      <Totales desglose={desglose} entrada={entrada} />
      <details className="mt-2 group">
        <summary className="cursor-pointer text-xs font-medium text-primary select-none">Ver desglose</summary>
        <div className="mt-2">
          <LineasDesglose desglose={desglose} entrada={entrada} />
        </div>
      </details>
      {detalles.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{detalles.join(" · ")}</p>}
      {entrada.notas && <p className="mt-1 whitespace-pre-line text-xs text-foreground">{entrada.notas}</p>}
      <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
        Precio estimado. El valor definitivo queda en la propuesta formal de la empresa.
      </p>
      {accion && (
        <button
          onClick={accion.onClick}
          className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-primary/40 text-xs font-medium text-primary hover:bg-primary/5"
        >
          <FileSignature className="h-3.5 w-3.5" />{accion.etiqueta}
        </button>
      )}
    </div>
  );
}

function Campo({ etiqueta, children, ayuda }: { etiqueta: string; children: ReactNode; ayuda?: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-foreground">
      {etiqueta}
      {children}
      {ayuda && <span className="font-normal text-[11px] text-muted-foreground">{ayuda}</span>}
    </label>
  );
}

const CLASE_INPUT =
  "h-9 w-full rounded-lg border border-border bg-white px-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export interface ValoresInicialesCalculadora {
  cantidad?: number;
  moneda?: string;
  incoterm?: string;
  /** Precio objetivo que puso el cliente en su cotización, como referencia. */
  precioObjetivo?: string;
}

export function CalculadoraPreciosChat({
  abierta,
  referencia,
  valoresIniciales,
  onCerrar,
  onEnviar,
}: {
  abierta: boolean;
  referencia: string;
  valoresIniciales: ValoresInicialesCalculadora;
  onCerrar: () => void;
  onEnviar: (entrada: EstimacionPrecioEntrada) => Promise<void>;
}) {
  const [form, setForm] = useState<Formulario>(FORMULARIO_BASE);
  const [vista, setVista] = useState<{ desglose: DesgloseEstimacion; entrada: EstimacionPrecioEntrada } | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [errorServidor, setErrorServidor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const peticionRef = useRef(0);

  // Cada apertura parte de los datos de la cotización del hilo y de las
  // preferencias guardadas; lo escrito en una conversación no se arrastra a otra.
  useEffect(() => {
    if (!abierta) return;
    const moneda = MONEDAS.find((m) => m === valoresIniciales.moneda?.toUpperCase());
    setForm({
      ...FORMULARIO_BASE,
      ...leerPreferencias(),
      ...(moneda ? { moneda } : {}),
      cantidad: valoresIniciales.cantidad ? String(valoresIniciales.cantidad) : "",
      incoterm: INCOTERMS.includes(valoresIniciales.incoterm ?? "") ? String(valoresIniciales.incoterm) : "",
    });
    setVista(null);
    setErrorServidor("");
  }, [abierta, valoresIniciales.cantidad, valoresIniciales.moneda, valoresIniciales.incoterm]);

  const { entrada, error } = useMemo(() => aEntrada(form), [form]);

  // Vista previa con retardo: se pide al backend cuando el usuario deja de
  // escribir, y solo cuenta la respuesta de la última petición.
  useEffect(() => {
    if (!abierta || !entrada) {
      setVista(null);
      return;
    }
    const id = ++peticionRef.current;
    const temporizador = window.setTimeout(async () => {
      setCalculando(true);
      try {
        const respuesta = await businessService.previewPriceEstimate(entrada);
        if (id === peticionRef.current) {
          setVista({ desglose: respuesta.desglose, entrada: respuesta.entrada });
          setErrorServidor("");
        }
      } catch (err) {
        if (id === peticionRef.current) {
          setVista(null);
          setErrorServidor(err instanceof Error ? err.message : "No se pudo calcular la estimación.");
        }
      } finally {
        if (id === peticionRef.current) setCalculando(false);
      }
    }, RETARDO_VISTA_PREVIA_MS);
    return () => window.clearTimeout(temporizador);
  }, [abierta, entrada]);

  if (!abierta) return null;

  function cambiar<K extends keyof Formulario>(campo: K, valor: Formulario[K]) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  async function enviar() {
    if (!entrada || enviando) return;
    setEnviando(true);
    setErrorServidor("");
    try {
      await onEnviar(entrada);
      guardarPreferencias(form);
      onCerrar();
    } catch (err) {
      setErrorServidor(err instanceof Error ? err.message : "No se pudo enviar la estimación.");
    } finally {
      setEnviando(false);
    }
  }

  const monedaSufijo = form.moneda;
  const inputNumero = (campo: keyof Formulario, extra?: InputHTMLAttributes<HTMLInputElement>) => (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      className={CLASE_INPUT}
      value={form[campo]}
      onChange={(e) => cambiar(campo, e.target.value as Formulario[typeof campo])}
      {...extra}
    />
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Calculadora de precios">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold"><Calculator className="h-4 w-4 text-primary" />Calculadora de precios</p>
            <p className="truncate text-xs text-muted-foreground">{referencia}</p>
          </div>
          <button onClick={onCerrar} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" title="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Campo etiqueta="Moneda">
                <select className={CLASE_INPUT} value={form.moneda} onChange={(e) => cambiar("moneda", e.target.value as MonedaEstimacion)}>
                  {MONEDAS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </Campo>
              <Campo etiqueta="Cantidad (unidades)">{inputNumero("cantidad", { min: 1, step: 1, inputMode: "numeric" })}</Campo>
              <Campo etiqueta={`Precio unitario (${monedaSufijo})`} ayuda={valoresIniciales.precioObjetivo ? `Objetivo del cliente: ${valoresIniciales.precioObjetivo}` : undefined}>
                {inputNumero("precio_unitario", { step: "0.01" })}
              </Campo>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Logística y aduana</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Campo etiqueta={`Flete internacional (${monedaSufijo})`}>{inputNumero("flete_internacional", { step: "0.01" })}</Campo>
                <Campo etiqueta="Seguro (%)" ayuda="Sobre mercancía + flete">{inputNumero("seguro_pct", { max: 100, step: "0.01" })}</Campo>
                <Campo etiqueta="Arancel (%)" ayuda="Sobre el valor CIF">{inputNumero("arancel_pct", { max: 100, step: "0.01" })}</Campo>
                <Campo etiqueta="IVA (%)" ayuda="Sobre CIF + arancel">{inputNumero("iva_pct", { max: 100, step: "0.01" })}</Campo>
                <Campo etiqueta={`Gastos en destino (${monedaSufijo})`} ayuda="Agenciamiento, bodegaje, transporte local">{inputNumero("gastos_destino", { step: "0.01" })}</Campo>
                <Campo etiqueta="Gestión de la empresa (%)" ayuda="Sobre CIF + arancel + gastos">{inputNumero("margen_pct", { max: 100, step: "0.01" })}</Campo>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Condiciones</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Campo etiqueta="Rango posible (± %)" ayuda="Margen de variación del precio">{inputNumero("rango_pct", { max: 50, step: "0.5" })}</Campo>
                {form.moneda !== "COP" && (
                  <Campo etiqueta={`Tasa ${form.moneda} → COP`} ayuda="Opcional: muestra el total en pesos">{inputNumero("tasa_cambio_cop", { step: "0.01" })}</Campo>
                )}
                <Campo etiqueta="Incoterm">
                  <select className={CLASE_INPUT} value={form.incoterm} onChange={(e) => cambiar("incoterm", e.target.value)}>
                    <option value="">—</option>
                    {INCOTERMS.map((i) => <option key={i}>{i}</option>)}
                  </select>
                </Campo>
                <Campo etiqueta="Tiempo de entrega">
                  <input className={CLASE_INPUT} maxLength={100} placeholder="Ej. 45 días" value={form.tiempo_entrega} onChange={(e) => cambiar("tiempo_entrega", e.target.value)} />
                </Campo>
                <Campo etiqueta="Validez (días)">{inputNumero("validez_dias", { min: 1, max: 90, step: 1, inputMode: "numeric" })}</Campo>
              </div>
              <div className="mt-3">
                <Campo etiqueta="Notas para el cliente">
                  <textarea
                    className={`${CLASE_INPUT} h-auto py-2`}
                    rows={2}
                    maxLength={1000}
                    placeholder="Ej. No incluye certificaciones adicionales."
                    value={form.notas}
                    onChange={(e) => cambiar("notas", e.target.value)}
                  />
                </Campo>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-slate-50/60 p-3 md:self-start">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Resultado {calculando && <Loader2 className="h-3 w-3 animate-spin" />}
            </p>
            {vista ? (
              <>
                <Totales desglose={vista.desglose} entrada={vista.entrada} />
                <LineasDesglose desglose={vista.desglose} entrada={vista.entrada} />
              </>
            ) : (
              <p className="text-xs text-muted-foreground">{error || (calculando ? "Calculando…" : "Completa los datos para ver el precio.")}</p>
            )}
            {errorServidor && <p className="text-xs text-destructive">{errorServidor}</p>}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="hidden text-[11px] text-muted-foreground sm:block">El cliente verá esta estimación en el chat al instante.</p>
          {/* En móvil el resultado queda debajo del formulario: el total se repite aquí. */}
          <p className="text-sm font-semibold tabular-nums sm:hidden">{vista ? formatoMoneda(vista.desglose.total, vista.entrada.moneda) : ""}</p>
          <div className="flex gap-2">
            <button onClick={onCerrar} className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-muted">Cancelar</button>
            <button
              onClick={() => void enviar()}
              disabled={!entrada || !vista || calculando || enviando}
              className="flex h-9 items-center gap-2 whitespace-nowrap rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar al cliente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
