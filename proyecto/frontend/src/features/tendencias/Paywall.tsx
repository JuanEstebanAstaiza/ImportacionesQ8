import { useCallback, useEffect, useState } from "react";
import {
  BellRing,
  BookOpenCheck,
  CalendarDays,
  CalendarRange,
  FlaskConical,
  Loader2,
  Lock,
  Megaphone,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import {
  tendenciasService,
  type AccesoTendencias,
  type CheckoutSuscripcion,
  type PortadaSinAcceso,
} from "@/services/tendencias.service";
import { PortadaEdicion } from "@/features/tendencias/PortadaEdicion";
import { fechaInstante, mensajeError, pesosCop } from "@/features/tendencias/formato";
import { PieInformativo } from "@/features/tendencias/ui";

/**
 * Lo que ve quien no tiene acceso a Tendencias: la portada de la edición como
 * adelanto, cuántos productos trae y de qué categorías, y cómo entrar. El
 * acceso es por suscripción pagada o por cortesía del equipo de Zarpi.
 */

type PaywallProps = {
  acceso: AccesoTendencias;
  /** Tras confirmar el pago: vuelve a pedir el acceso. */
  onAccesoActivado: () => void;
};

const BENEFICIOS = [
  { icono: Sparkles, titulo: "Una edición cada semana", texto: "Seis productos elegidos por el equipo de Zarpi, con el porqué de cada uno." },
  { icono: CalendarDays, titulo: "La fecha ideal para pedir", texto: "Hasta cuándo pedir por mar o por aéreo para llegar a tiempo a la temporada." },
  { icono: Megaphone, titulo: "Guía para venderlo", texto: "Para quién es, ángulos de venta, dónde moverlo e ideas de contenido." },
  { icono: CalendarRange, titulo: "Calendario de pedidos", texto: "Las temporadas de los próximos 14 meses con sus ventanas de pedido." },
  { icono: BellRing, titulo: "Aviso semanal por correo", texto: "Cada lunes, la nueva edición en tu bandeja de entrada." },
];

function TarjetaFantasma() {
  return (
    <div aria-hidden className="overflow-hidden rounded-xl border border-white/10 bg-[#18171C]">
      <div className="aspect-square w-full bg-gradient-to-br from-[#4F06EB]/60 via-[#2A0A8F]/50 to-[#EDF953]/30" />
      <div className="space-y-2 p-4">
        <div className="h-2.5 w-1/3 rounded bg-white/20" />
        <div className="h-4 w-2/3 rounded bg-white/40" />
        <div className="h-2.5 w-full rounded bg-white/15" />
        <div className="h-2.5 w-4/5 rounded bg-white/15" />
      </div>
    </div>
  );
}

export function Paywall({ acceso, onAccesoActivado }: PaywallProps) {
  const [portada, setPortada] = useState<PortadaSinAcceso | null>(null);
  const [cargandoPortada, setCargandoPortada] = useState(true);
  const [iniciando, setIniciando] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutSuscripcion | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const cargarPortada = useCallback(async () => {
    setCargandoPortada(true);
    try {
      setPortada(await tendenciasService.getPortada());
    } catch {
      // La portada es solo un adelanto: sin ella el muro sigue funcionando.
      setPortada({ edicion: null });
    } finally {
      setCargandoPortada(false);
    }
  }, []);

  useEffect(() => { cargarPortada(); }, [cargarPortada]);

  const suscribirme = async () => {
    setIniciando(true);
    try {
      const respuesta = await tendenciasService.iniciarSuscripcion();
      if (respuesta.pago_simulado) {
        setCheckout(respuesta);
      } else {
        window.location.href = respuesta.checkout_url;
      }
    } catch (e) {
      toast.error(mensajeError(e, "No pudimos iniciar el pago. Inténtalo de nuevo."));
    } finally {
      setIniciando(false);
    }
  };

  const simularPago = async () => {
    if (!checkout) return;
    setConfirmando(true);
    try {
      const { vigente_hasta } = await tendenciasService.simularPago(checkout.pago_id);
      toast.success(`Listo: tienes acceso a Tendencias hasta el ${fechaInstante(vigente_hasta)}.`);
      setCheckout(null);
      onAccesoActivado();
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo confirmar el pago simulado."));
    } finally {
      setConfirmando(false);
    }
  };

  const edicion = portada?.edicion ?? null;
  const categorias = Array.from(new Set(portada?.categorias ?? []));
  const total = portada?.total_productos ?? 0;
  const soloCompradores = acceso.precio_cop !== null && !acceso.venta_habilitada;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {cargandoPortada ? (
        <div className="flex h-48 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : edicion ? (
        <PortadaEdicion
          preset={edicion.preset_estilo}
          numero={edicion.numero}
          semanaInicio={edicion.semana_inicio}
          tituloLinea1={edicion.titulo_linea1}
          tituloLinea2={edicion.titulo_linea2}
          subtitulo={edicion.subtitulo}
        />
      ) : (
        <PortadaEdicion
          preset="noche"
          tituloLinea1="Tendencias"
          tituloLinea2="semanales"
          subtitulo="Productos para cotizar cada semana, con la fecha ideal de pedido y una guía para venderlos."
        />
      )}

      <section className="relative overflow-hidden rounded-2xl bg-[#0F0F0F] p-5 text-white sm:p-8">
        <div className="relative z-10 space-y-3">
          <p className="text-lg font-bold sm:text-xl">
            {edicion && total > 0
              ? `Esta semana: ${total} ${total === 1 ? "producto" : "productos"} en tendencia`
              : "La próxima edición está en preparación"}
          </p>
          {categorias.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {categorias.map((c) => (
                <span key={c} className="rounded-full border border-white/20 px-2.5 py-1 text-xs font-medium text-white/85">{c}</span>
              ))}
            </div>
          )}
        </div>
        <div className="relative mt-5">
          <div className="pointer-events-none grid select-none grid-cols-2 gap-3 blur-[6px] sm:grid-cols-3">
            <TarjetaFantasma />
            <TarjetaFantasma />
            <div className="hidden sm:block"><TarjetaFantasma /></div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm font-semibold backdrop-blur">
              <Lock className="h-4 w-4 text-[#EDF953]" />
              Contenido para suscriptores
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold">Qué incluye Tendencias</h2>
          <ul className="mt-4 space-y-4">
            {BENEFICIOS.map(({ icono: Icono, titulo, texto }) => (
              <li key={titulo} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <Icono className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{titulo}</p>
                  <p className="text-sm text-muted-foreground">{texto}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
            <BookOpenCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Zarpi no vende los productos ni muestra precios: con un clic pides propuestas a nacionalizadoras verificadas.
          </p>
        </section>

        <section className="flex flex-col rounded-xl border border-border bg-white p-5 shadow-sm">
          {checkout ? (
            <div className="space-y-3">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                <FlaskConical className="h-3 w-3" />
                Pago simulado
              </p>
              <p className="text-sm">
                Estás en un entorno local sin pasarela de pagos. Confirma el pago de{" "}
                <strong>{pesosCop(checkout.monto_cop)}</strong> por {checkout.dias} días como si Wompi lo hubiera aprobado.
              </p>
              <button
                type="button"
                onClick={simularPago}
                disabled={confirmando}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 dark:bg-accent dark:text-accent-foreground"
              >
                {confirmando && <Loader2 className="h-4 w-4 animate-spin" />}
                Simular pago aprobado
              </button>
              <button
                type="button"
                onClick={() => setCheckout(null)}
                disabled={confirmando}
                className="inline-flex h-9 w-full items-center justify-center rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
          ) : acceso.venta_habilitada && acceso.precio_cop !== null ? (
            <div className="flex flex-1 flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Suscripción</p>
              <p>
                <span className="text-3xl font-bold tracking-tight">{pesosCop(acceso.precio_cop)}</span>
                <span className="text-sm text-muted-foreground"> / {acceso.dias_suscripcion} días</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Pago único con Wompi. Al terminar el periodo puedes renovarlo; no se cobra solo.
              </p>
              <button
                type="button"
                onClick={suscribirme}
                disabled={iniciando}
                className="mt-auto inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#EDF953] text-sm font-bold text-[#16151B] transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {iniciando && <Loader2 className="h-4 w-4 animate-spin" />}
                Suscribirme
              </button>
              {acceso.vigente_hasta && (
                <p className="text-xs text-muted-foreground">Tu acceso anterior venció el {fechaInstante(acceso.vigente_hasta)}.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Lock className="h-4 w-4" />
              </span>
              <p className="text-sm font-semibold">
                {soloCompradores
                  ? "La suscripción a Tendencias es para cuentas de comprador."
                  : "Por ahora el acceso a Tendencias es por invitación del equipo de Zarpi."}
              </p>
              <p className="text-sm text-muted-foreground">
                Si te interesa, escríbenos desde <strong>Ayuda y soporte</strong> (el ícono de ayuda en la parte superior) y te contamos cómo entrar.
              </p>
            </div>
          )}
        </section>
      </div>

      <PieInformativo />
    </div>
  );
}
