import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FlaskConical, Images, Landmark, Loader2, Lock, RefreshCw, Sparkles, Video } from "lucide-react";

import { registroAbierto } from "@/app/registro";

import {
  tendenciasService,
  type CheckoutSuscripcion,
  type FichaBloqueada,
  type MiAccesoTendencias,
} from "@/services/tendencias.service";

import { ImagenPublica, type RolTendencias } from "./piezas";

/**
 * Muro de pago de Tendencias. Lo usan el feed (sin producto) y la ficha
 * bloqueada (con la portada del producto). La tarjeta es oscura en ambos temas:
 * así se lee igual sobre el feed negro y sobre la ficha clara.
 */

type ProductoVistaPrevia = Pick<FichaBloqueada["producto"], "nombre" | "categoria" | "portada_url">;

type Props = {
  autenticado: boolean;
  rol: RolTendencias;
  producto?: ProductoVistaPrevia | null;
  onRegistrarse: () => void;
  onIniciarSesion: () => void;
  /** Tras pagar (de prueba o real): el padre recarga. */
  onAccesoConcedido: () => void;
  /** Sin pasarela: lleva a Pagos (carpeta «Suscripción Tendencias») para subir el comprobante. */
  onPagarConTransferencia?: () => void;
};

const BENEFICIOS = [
  { icono: Video, texto: "Videos de cada producto" },
  { icono: Images, texto: "Fotos y ficha completa" },
  { icono: AlertTriangle, texto: "Lo que hay que saber antes de importarlo" },
  { icono: Sparkles, texto: "Productos nuevos cada semana" },
];

const CLASE_CTA =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#EDF953] px-4 py-3 text-sm font-semibold text-[#16151B] transition-colors hover:bg-[#f3fb8a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

const formatoCOP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function textoDias(dias: number): string {
  return `${dias} ${dias === 1 ? "día" : "días"}`;
}

function Portada({ producto }: { producto?: ProductoVistaPrevia | null }) {
  if (!producto?.portada_url) {
    return (
      <div className="relative flex h-28 items-center justify-center overflow-hidden md:h-auto md:min-h-full">
        <span className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-[#4F06EB]/50 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-12 right-0 h-32 w-32 rounded-full bg-[#EDF953]/25 blur-3xl" />
        <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EDF953] text-[#16151B] shadow-lg shadow-[#EDF953]/20">
          <Lock className="h-6 w-6" />
        </span>
      </div>
    );
  }
  return (
    <div className="relative h-44 overflow-hidden sm:h-56 md:h-auto md:min-h-[18rem]">
      <ImagenPublica src={producto.portada_url} alt="" className="absolute inset-0 h-full w-full scale-110 blur-[6px]" />
      <span className="absolute inset-0 bg-gradient-to-t from-[#16151B] via-black/45 to-black/30 md:bg-gradient-to-r md:from-transparent md:via-black/30 md:to-[#16151B]" />
      <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/20 backdrop-blur-sm">
        <Lock className="h-6 w-6" />
      </span>
    </div>
  );
}

export function MuroPago({ autenticado, rol, producto, onRegistrarse, onIniciarSesion, onAccesoConcedido, onPagarConTransferencia }: Props) {
  const [acceso, setAcceso] = useState<MiAccesoTendencias | null>(null);
  const [cargando, setCargando] = useState(autenticado);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [pagando, setPagando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [pago, setPago] = useState<CheckoutSuscripcion | null>(null);

  // El precio y si puede comprar solo se saben con sesión.
  useEffect(() => {
    if (!autenticado) {
      setAcceso(null);
      setCargando(false);
      return;
    }
    let vigente = true;
    setCargando(true);
    setError(null);
    tendenciasService
      .miAcceso()
      .then((r) => { if (vigente) setAcceso(r); })
      .catch((e: unknown) => {
        if (vigente) setError(e instanceof Error && e.message ? e.message : "No pudimos cargar la suscripción.");
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [autenticado, intento]);

  async function suscribirme() {
    if (pagando) return;
    setPagando(true);
    try {
      const r = await tendenciasService.checkout();
      if (r.pago_simulado) {
        setPago(r);
        setPagando(false);
      } else {
        // La pasarela vuelve a Zarpi al terminar; el botón queda cargando mientras se va.
        window.location.assign(r.checkout_url);
      }
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "No pudimos iniciar el pago.");
      setPagando(false);
    }
  }

  async function confirmarPrueba() {
    if (!pago || confirmando) return;
    setConfirmando(true);
    try {
      await tendenciasService.simularPago(pago.pago_id);
      toast.success("¡Listo! Ya tienes acceso a Tendencias.");
      onAccesoConcedido();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "No pudimos confirmar el pago de prueba.");
    } finally {
      setConfirmando(false);
    }
  }

  // Con un pago iniciado manda lo que cobra el checkout.
  const monto = pago?.monto_cop ?? acceso?.precio_cop ?? null;
  const dias = pago?.dias ?? acceso?.dias_suscripcion ?? 0;
  const mostrarPrecio = autenticado && monto !== null && monto > 0 && dias > 0;

  let accion: ReactNode;
  if (!autenticado) {
    accion = (
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <button type="button" onClick={onRegistrarse} className={CLASE_CTA}>
          {registroAbierto() ? "Crea tu cuenta gratis" : "Solicitar acceso"}
        </button>
        <button type="button" onClick={onIniciarSesion} className="text-sm font-medium text-white/75 underline-offset-4 transition-colors hover:text-white hover:underline">
          Ya tengo cuenta
        </button>
      </div>
    );
  } else if (cargando) {
    accion = (
      <p className="flex items-center gap-2 text-sm text-white/60">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando tu suscripción…
      </p>
    );
  } else if (error || !acceso) {
    accion = (
      <div className="flex flex-col items-start gap-2">
        <p className="flex items-start gap-1.5 text-sm text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error ?? "No pudimos cargar la suscripción."}
        </p>
        <button type="button" onClick={() => setIntento((n) => n + 1)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white hover:border-white/50">
          <RefreshCw className="h-3.5 w-3.5" /> Reintentar
        </button>
      </div>
    );
  } else if (acceso.acceso_completo) {
    // Ya tiene acceso (p. ej. pagó en otra pestaña o le dieron cortesía): solo falta recargar.
    accion = (
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <p className="flex items-center gap-1.5 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Ya tienes acceso a Tendencias.
        </p>
        <button type="button" onClick={onAccesoConcedido} className={CLASE_CTA}>Ver todo</button>
      </div>
    );
  } else if (rol !== "solicitante") {
    accion = <p className="text-sm text-white/70">La suscripción a Tendencias es para cuentas de comprador.</p>;
  } else if (!acceso.venta_habilitada) {
    accion = <p className="text-sm font-medium text-white/80">Muy pronto podrás suscribirte.</p>;
  } else if (acceso.pago_simulado && onPagarConTransferencia) {
    // Sin pasarela en línea: se paga por transferencia y el comprobante se sube en Pagos.
    accion = (
      <div className="space-y-2">
        <button type="button" onClick={onPagarConTransferencia} className={CLASE_CTA}>
          <Landmark className="h-4 w-4" />
          Suscribirme
        </button>
        <p className="text-xs text-white/60">
          Pagas por transferencia y subes el comprobante en Pagos. Cuando lo confirmemos, se abre Tendencias.
        </p>
      </div>
    );
  } else if (pago) {
    accion = (
      <div className="space-y-3">
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span><span className="font-semibold">Pago de prueba.</span> Estás en un entorno de pruebas: no se cobra nada.</span>
        </p>
        <button type="button" onClick={() => { void confirmarPrueba(); }} disabled={confirmando} className={CLASE_CTA}>
          {confirmando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Confirmar pago de prueba
        </button>
      </div>
    );
  } else {
    accion = (
      <button type="button" onClick={() => { void suscribirme(); }} disabled={pagando} className={CLASE_CTA}>
        {pagando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        Suscribirme
      </button>
    );
  }

  return (
    <section
      aria-label="Suscripción a Tendencias"
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#16151B] text-white shadow-xl shadow-black/10 dark:border-white/15"
    >
      <div className={`grid ${producto ? "md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" : "md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]"}`}>
        <Portada producto={producto} />

        <div className="relative space-y-5 p-5 sm:p-7">
          <span className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#4F06EB]/35 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#EDF953]">Tendencias</p>
            <h2 className="mt-1 text-xl font-bold leading-tight sm:text-2xl">Suscríbete a Tendencias</h2>
            {producto?.nombre ? (
              <p className="mt-1.5 text-sm text-white/70">
                Para ver el video y la ficha de <span className="font-semibold text-white">{producto.nombre}</span>.
              </p>
            ) : (
              <p className="mt-1.5 text-sm text-white/70">Mira los videos y la ficha completa de cada producto viral.</p>
            )}
          </div>

          <ul className="relative grid gap-2.5 sm:grid-cols-2">
            {BENEFICIOS.map(({ icono: Icono, texto }) => (
              <li key={texto} className="flex items-start gap-2.5 text-sm text-white/90">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[#EDF953]">
                  <Icono className="h-4 w-4" />
                </span>
                <span className="pt-1 leading-snug">{texto}</span>
              </li>
            ))}
          </ul>

          {mostrarPrecio ? (
            <p className="relative text-2xl font-bold tabular-nums">
              {formatoCOP.format(monto ?? 0)}
              <span className="ml-1.5 text-sm font-medium text-white/60">por {textoDias(dias)}</span>
            </p>
          ) : null}

          <div className="relative">{accion}</div>
        </div>
      </div>
    </section>
  );
}
