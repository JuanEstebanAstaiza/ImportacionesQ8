import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Check,
  Coins,
  Copy,
  Download,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  Gift,
  Inbox,
  Info,
  Landmark,
  Loader2,
  RefreshCw,
  Send,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { DocumentUploadButton } from "@/app/components/files/DocumentUploadButton";
import { ImagenArchivo } from "@/app/components/files/ImagenArchivo";
import {
  CLASE_BOTON_PRIMARIO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_INPUT,
  fechaCorta,
  mensajeError,
} from "@/features/tendencias/AprobacionComun";
import { abrirArchivoEnPestana, descargarArchivo } from "@/lib/abrir-archivo";
import type { BackendArchivoItem } from "@/services/business.service";
import {
  ACEPTA_COMPROBANTE,
  CARPETA_COMPROBANTE,
  ORIGEN_COMPROBANTE,
  comprobantesService,
  type Comprobante,
  type ResumenPagos,
  type TipoComprobante,
} from "@/services/comprobantes.service";

/**
 * Cargue y descargue de pagos: mientras se habilita la pasarela, el usuario paga
 * por transferencia y sube el comprobante. Tres carpetas: tokens de cotización,
 * suscripción a Tendencias (ambas con formulario) y pagos del reto (solo lectura).
 */

const FORMATO_COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

function cop(valor: number | null | undefined): string {
  return valor == null ? "—" : FORMATO_COP.format(valor);
}

const ORDEN_CARPETAS: TipoComprobante[] = ["tokens", "suscripcion", "reto"];

type Listas = Record<TipoComprobante, Comprobante[]>;

const LISTAS_VACIAS: Listas = { tokens: [], suscripcion: [], reto: [] };

const VACIO_CARPETA: Record<TipoComprobante, string> = {
  tokens: "Aún no has subido comprobantes de tokens.",
  suscripcion: "Aún no has subido comprobantes de la suscripción.",
  reto: "Cuando te paguemos una recompensa del reto en efectivo, aquí verás el comprobante.",
};

function suscripcionVigente(hasta: string | null): boolean {
  if (!hasta) return false;
  const t = new Date(hasta).getTime();
  return Number.isFinite(t) && t > Date.now();
}

async function abrir(ruta: string, nombre?: string | null) {
  const r = await abrirArchivoEnPestana(ruta, nombre ?? undefined);
  if (!r.ok) toast.error(r.motivo || "No se pudo abrir el comprobante.");
}

async function descargar(ruta: string, nombre?: string | null) {
  const r = await descargarArchivo(ruta, nombre ?? undefined);
  if (!r.ok) toast.error(r.motivo || "No se pudo descargar el comprobante.");
}

export function CargueDescarguePagos({ rol }: { rol: string }) {
  const [resumen, setResumen] = useState<ResumenPagos | null>(null);
  const [listas, setListas] = useState<Listas>(LISTAS_VACIAS);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [carpeta, setCarpeta] = useState<TipoComprobante>("tokens");

  // `silencioso`: refresco tras subir; si falla no se tumba la vista, solo se avisa.
  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) {
      setCargando(true);
      setError(null);
    }
    try {
      const [r, tokens, suscripcion, reto] = await Promise.all([
        comprobantesService.resumen(),
        comprobantesService.mios("tokens"),
        comprobantesService.mios("suscripcion"),
        comprobantesService.mios("reto"),
      ]);
      setResumen(r);
      setListas({ tokens: tokens ?? [], suscripcion: suscripcion ?? [], reto: reto ?? [] });
      setError(null);
    } catch (e) {
      const mensaje = mensajeError(e, "No pudimos cargar tus pagos.");
      if (silencioso) toast.error(mensaje);
      else setError(mensaje);
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Cargue y descargue de pagos</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Mientras habilitamos los pagos en línea, paga por transferencia y sube aquí tu comprobante. Lo revisamos y te acreditamos.
        </p>
      </div>

      {cargando && !resumen ? (
        <p className="flex items-center justify-center gap-2 rounded-xl border border-border bg-white py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando tus pagos…
        </p>
      ) : error && !resumen ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-10 text-center dark:border-rose-900 dark:bg-rose-950/30">
          <AlertTriangle className="h-6 w-6 text-rose-600 dark:text-rose-400" />
          <p className="text-sm text-rose-800 dark:text-rose-300">{error}</p>
          <button type="button" onClick={() => void cargar()} className={CLASE_BOTON_SECUNDARIO}>
            <RefreshCw className="h-3.5 w-3.5" /> Reintentar
          </button>
        </div>
      ) : resumen ? (
        <>
          <Saldos resumen={resumen} />
          <ComoPagar resumen={resumen} />

          <div role="tablist" aria-label="Carpetas de pagos" className="grid gap-2 sm:grid-cols-3">
            {ORDEN_CARPETAS.map((tipo) => (
              <TarjetaCarpeta
                key={tipo}
                tipo={tipo}
                activa={carpeta === tipo}
                comprobantes={listas[tipo]}
                onElegir={() => setCarpeta(tipo)}
              />
            ))}
          </div>

          <section role="tabpanel" aria-label={CARPETA_COMPROBANTE[carpeta]} className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="flex min-w-0 items-center gap-2 text-base font-semibold">
                <FolderOpen className="h-4 w-4 flex-shrink-0 text-amber-500" />
                <span className="truncate">{CARPETA_COMPROBANTE[carpeta]}</span>
              </p>
              <button type="button" onClick={() => void cargar()} disabled={cargando} aria-label="Actualizar" title="Actualizar" className={CLASE_BOTON_SECUNDARIO}>
                <RefreshCw className={`h-3.5 w-3.5 ${cargando ? "animate-spin" : ""}`} />
              </button>
            </div>

            {carpeta === "reto" ? (
              <ListaComprobantes tipo="reto" comprobantes={listas.reto} />
            ) : (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
                {carpeta === "suscripcion" && rol !== "solicitante" ? (
                  <p className="flex h-fit items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
                    <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    La suscripción a Tendencias es para cuentas de comprador. Desde esta cuenta no puedes pagarla.
                  </p>
                ) : (
                  <FormularioComprobante
                    key={carpeta}
                    tipo={carpeta}
                    resumen={resumen}
                    onSubido={() => cargar(true)}
                  />
                )}
                <div className="min-w-0">
                  <p className="mb-1 text-sm font-medium">Tus comprobantes</p>
                  <ListaComprobantes tipo={carpeta} comprobantes={listas[carpeta]} />
                </div>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ saldos */

function TarjetaSaldo({ etiqueta, valor, icono: Icono, clase }: { etiqueta: string; valor: string; icono: typeof Coins; clase: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-white p-3 shadow-sm">
      <span className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${clase}`}>
        <Icono className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold leading-tight tabular-nums">{valor}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{etiqueta}</p>
      </div>
    </div>
  );
}

function Saldos({ resumen }: { resumen: ResumenPagos }) {
  const vigente = suscripcionVigente(resumen.suscripcion.vigente_hasta);
  const conGratis = resumen.cotizaciones_gratis > 0;
  return (
    <div className={`grid gap-3 ${conGratis ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      <TarjetaSaldo
        etiqueta="Tokens de cotización"
        valor={String(resumen.tokens)}
        icono={Coins}
        clase="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      />
      {conGratis && (
        <TarjetaSaldo
          etiqueta="Cotizaciones gratis"
          valor={String(resumen.cotizaciones_gratis)}
          icono={Gift}
          clase="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        />
      )}
      <TarjetaSaldo
        etiqueta="Tendencias"
        valor={vigente ? `Activa hasta ${fechaCorta(resumen.suscripcion.vigente_hasta)}` : "Sin suscripción"}
        icono={TrendingUp}
        clase={vigente
          ? "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
          : "bg-muted text-muted-foreground"}
      />
    </div>
  );
}

/* ------------------------------------------------------------- cómo pagar */

function ComoPagar({ resumen }: { resumen: ResumenPagos }) {
  const [copiado, setCopiado] = useState(false);
  const { precio_cop: precioSuscripcion, dias } = resumen.suscripcion;

  const copiar = async () => {
    if (!resumen.datos_pago) return;
    try {
      await navigator.clipboard.writeText(resumen.datos_pago);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("No se pudo copiar. Selecciona el texto y cópialo a mano.");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-base font-semibold">
          <Landmark className="h-4 w-4 text-primary dark:text-accent" /> Cómo pagar
        </p>
        {resumen.datos_pago && (
          <button type="button" onClick={() => void copiar()} className={CLASE_BOTON_SECUNDARIO}>
            {copiado ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copiado ? "Copiado" : "Copiar"}
          </button>
        )}
      </div>

      {resumen.datos_pago ? (
        <p className="whitespace-pre-line break-words rounded-lg bg-muted/60 p-3 text-sm">{resumen.datos_pago}</p>
      ) : (
        <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">Pronto publicaremos los datos de pago.</p>
      )}

      {(resumen.precio_token_cop != null || precioSuscripcion != null) && (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {resumen.precio_token_cop != null && (
            <div className="rounded-lg border border-border px-3 py-2">
              <dt className="text-xs text-muted-foreground">Precio por token</dt>
              <dd className="font-semibold tabular-nums">{cop(resumen.precio_token_cop)}</dd>
            </div>
          )}
          {precioSuscripcion != null && (
            <div className="rounded-lg border border-border px-3 py-2">
              <dt className="text-xs text-muted-foreground">Suscripción Tendencias</dt>
              <dd className="font-semibold tabular-nums">
                {cop(precioSuscripcion)}
                {dias > 0 && <span className="font-normal text-muted-foreground"> · {dias} {dias === 1 ? "día" : "días"}</span>}
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- carpetas */

function TarjetaCarpeta({ tipo, activa, comprobantes, onElegir }: {
  tipo: TipoComprobante;
  activa: boolean;
  comprobantes: Comprobante[];
  onElegir: () => void;
}) {
  const Icono = activa ? FolderOpen : Folder;
  const pendientes = comprobantes.filter((c) => c.estado === "pendiente").length;
  const total = comprobantes.length;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activa}
      onClick={onElegir}
      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
        activa
          ? "border-primary bg-primary/5 ring-1 ring-primary dark:border-accent dark:bg-accent/10 dark:ring-accent"
          : "border-border bg-white hover:bg-muted"
      }`}
    >
      <Icono className={`h-7 w-7 flex-shrink-0 ${activa ? "text-amber-500" : "text-amber-400/80"}`} />
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{CARPETA_COMPROBANTE[tipo]}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {total === 0 ? "Vacía" : `${total} ${total === 1 ? "comprobante" : "comprobantes"}`}
          {pendientes > 0 && <span className="text-amber-700 dark:text-amber-400"> · {pendientes} {pendientes === 1 ? "pendiente" : "pendientes"}</span>}
        </p>
      </div>
    </button>
  );
}

/* -------------------------------------------------------------- formulario */

function FormularioComprobante({ tipo, resumen, onSubido }: {
  tipo: "tokens" | "suscripcion";
  resumen: ResumenPagos;
  onSubido: () => Promise<void> | void;
}) {
  const esTokens = tipo === "tokens";
  const diasPorDefecto = resumen.suscripcion.dias > 0 ? String(resumen.suscripcion.dias) : "";

  const [archivo, setArchivo] = useState<BackendArchivoItem | null>(null);
  const [cantidad, setCantidad] = useState(esTokens ? "" : diasPorDefecto);
  // null = el monto sigue al sugerido; con texto, el usuario lo escribió a mano.
  const [montoManual, setMontoManual] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);

  const n = Number(cantidad);
  let sugerido: number | null = null;
  if (esTokens) {
    if (resumen.precio_token_cop != null && cantidad.trim() !== "" && Number.isFinite(n) && n > 0) {
      sugerido = Math.round(n * resumen.precio_token_cop);
    }
  } else if (resumen.suscripcion.precio_cop != null) {
    sugerido = resumen.suscripcion.precio_cop;
  }
  const monto = montoManual ?? (sugerido != null ? String(sugerido) : "");

  const limpiar = () => {
    setArchivo(null);
    setCantidad(esTokens ? "" : diasPorDefecto);
    setMontoManual(null);
    setNota("");
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!archivo) return;
    const cantidadNum = Number(cantidad);
    if (!Number.isInteger(cantidadNum) || cantidadNum < 1) {
      toast.error(esTokens ? "Indica cuántos tokens compraste." : "Indica cuántos días pagaste.");
      return;
    }
    const montoNum = Number(monto);
    if (monto.trim() === "" || !Number.isFinite(montoNum) || montoNum <= 0) {
      toast.error("Indica el monto que pagaste.");
      return;
    }
    setEnviando(true);
    try {
      await comprobantesService.subir({
        tipo,
        archivo_id: archivo.id,
        cantidad: cantidadNum,
        monto_cop: Math.round(montoNum),
        nota: nota.trim() || undefined,
      });
      toast.success("Comprobante enviado. Te avisaremos cuando lo revisemos.");
      limpiar();
      await onSubido();
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo enviar el comprobante."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={(e) => void enviar(e)} className="h-fit space-y-3 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">Subir comprobante</p>

      {/* Archivo: ya queda en sus documentos; el comprobante se crea al enviar. */}
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
              origen={ORIGEN_COMPROBANTE}
              accept={ACEPTA_COMPROBANTE}
              disabled={enviando}
              onUploaded={(a) => setArchivo(a)}
              onError={(m) => toast.error(m)}
            />
            <span className="text-xs text-muted-foreground">Imagen o PDF</span>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            {esTokens ? "¿Cuántos tokens compraste?" : "Días"}
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder={esTokens ? "Ej.: 10" : "Ej.: 30"}
            className={CLASE_INPUT}
          />
          {esTokens && <span className="mt-1 block text-[11px] text-muted-foreground">1 token = 1 cotización.</span>}
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Monto pagado (COP)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={monto}
            onChange={(e) => setMontoManual(e.target.value)}
            placeholder="Ej.: 50000"
            className={CLASE_INPUT}
          />
          {sugerido != null && (
            montoManual !== null && montoManual !== String(sugerido) ? (
              <button
                type="button"
                onClick={() => setMontoManual(null)}
                className="mt-1 text-[11px] font-medium text-primary hover:underline dark:text-accent"
              >
                Usar el sugerido: {cop(sugerido)}
              </button>
            ) : (
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {esTokens ? `Sugerido: ${cantidad} × ${cop(resumen.precio_token_cop)}` : "Precio de la suscripción"}
              </span>
            )
          )}
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Nota (opcional)</span>
        <textarea
          rows={2}
          maxLength={500}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej.: transferí desde la cuenta de mi empresa"
          className={`${CLASE_INPUT} resize-y`}
        />
      </label>

      <button type="submit" disabled={!archivo || enviando} className={`w-full ${CLASE_BOTON_PRIMARIO}`}>
        {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        Subir comprobante
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------- lista */

function InsigniaEstado({ comprobante }: { comprobante: Comprobante }) {
  const base = "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium";
  switch (comprobante.estado) {
    case "aprobado":
      return <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300`}>Aprobado</span>;
    case "rechazado":
      return <span className={`${base} border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300`}>Rechazado</span>;
    case "enviado":
      return <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300`}>Pago enviado</span>;
    default:
      return <span className={`${base} border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300`}>Pendiente</span>;
  }
}

function ListaComprobantes({ tipo, comprobantes }: { tipo: TipoComprobante; comprobantes: Comprobante[] }) {
  if (comprobantes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        <Inbox className="h-6 w-6" />
        <p className="max-w-sm">{VACIO_CARPETA[tipo]}</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {comprobantes.map((c) => <FilaComprobante key={c.id} comprobante={c} soloLectura={tipo === "reto"} />)}
    </ul>
  );
}

function FilaComprobante({ comprobante: c, soloLectura }: { comprobante: Comprobante; soloLectura: boolean }) {
  const nombre = c.archivo.nombre || "Comprobante";
  const unidad = c.tipo === "suscripcion" ? ["día", "días"] : ["token", "tokens"];
  const plural = (v: number) => (v === 1 ? unidad[0] : unidad[1]);
  const acreditado = c.cantidad_acreditada ?? c.cantidad_solicitada;

  return (
    <li className="flex gap-3 py-3">
      <button
        type="button"
        onClick={() => void abrir(c.archivo.url, nombre)}
        title="Ver comprobante"
        className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-border hover:ring-2 hover:ring-primary/40"
      >
        {c.archivo.tipo_recurso === "imagen" ? (
          <ImagenArchivo src={c.archivo.url} alt={nombre} className="h-full w-full" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
            <FileText className="h-5 w-5" />
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="min-w-0 truncate text-sm font-medium" title={nombre}>{nombre}</p>
          <InsigniaEstado comprobante={c} />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span>{fechaCorta(c.fecha)}</span>
          {!soloLectura && c.cantidad_solicitada != null && (
            <>
              <span>·</span>
              <span className="tabular-nums">{c.cantidad_solicitada} {plural(c.cantidad_solicitada)}</span>
            </>
          )}
          {c.monto_cop != null && (
            <>
              <span>·</span>
              <span className="tabular-nums">{cop(c.monto_cop)}</span>
            </>
          )}
        </div>
        {c.estado === "aprobado" && acreditado != null && (
          <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            +{acreditado} {plural(acreditado)} acreditados
          </p>
        )}
        {c.estado === "rechazado" && c.motivo_rechazo && (
          <p className="mt-1 rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
            {c.motivo_rechazo}
          </p>
        )}
        {c.nota && !soloLectura && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">Nota: {c.nota}</p>}

        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => void abrir(c.archivo.url, nombre)} className={CLASE_BOTON_SECUNDARIO}>
            <Eye className="h-3.5 w-3.5" /> Ver
          </button>
          {soloLectura && (
            <button type="button" onClick={() => void descargar(c.archivo.url, nombre)} className={CLASE_BOTON_SECUNDARIO}>
              <Download className="h-3.5 w-3.5" /> Descargar
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
