import { useEffect, useState } from "react";
import { BellRing, Check, Loader2, LockKeyhole, Monitor, Smartphone } from "lucide-react";

import { ProtectedVideoPlayer } from "@/app/components/media/ReproductorVideo";
import { encuadreParaPantalla, useEncuadrePreferido, type Encuadre } from "@/app/components/media/VideoAdaptable";
import { planesService, pesos, type Plan, type VideoPlan } from "@/services/planes.service";

/**
 * Sección «Planes» del inicio (id `planes`, a la que lleva «Solicitar acceso»).
 * Precio, IVA, lo que incluye y cupos salen de Admin › Planes: aquí no hay
 * ningún valor escrito a mano.
 */

/**
 * Video del plan dentro de su tarjeta (se sube en Admin › Planes). Igual que el
 * de «Quiénes somos»: la versión de la pantalla y, si hay dos, se puede
 * cambiar. La vertical se limita de alto para que la tarjeta no se estire.
 */
function VideoTarjeta({ video, nombre }: { video: VideoPlan; nombre: string }) {
  const preferido = useEncuadrePreferido();
  const [elegido, setElegido] = useState<Encuadre | null>(null);
  const encuadre = encuadreParaPantalla(elegido ?? preferido, video.horizontal, video.vertical);
  if (!encuadre) return null;
  const url = encuadre === "vertical" ? video.vertical! : video.horizontal!;
  return (
    <div className="mb-5">
      <div
        className={`mx-auto overflow-hidden rounded-xl bg-black ${
          encuadre === "vertical" ? "aspect-[9/16] h-[min(60vh,420px)] max-w-full" : "aspect-video w-full"
        }`}
      >
        <ProtectedVideoPlayer key={url} url={url} className="h-full w-full object-contain" />
      </div>
      {(video.titulo || (video.horizontal && video.vertical)) && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {video.titulo ? <p className="text-xs text-muted-foreground">{video.titulo}</p> : <span />}
          {video.horizontal && video.vertical && (
            <div className="flex gap-1" role="group" aria-label={`Versión del video de ${nombre}`}>
              {([["horizontal", Monitor, "Computador"], ["vertical", Smartphone, "Celular"]] as const).map(([valor, Icono, etiqueta]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setElegido(valor)}
                  aria-pressed={encuadre === valor}
                  title={etiqueta}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    encuadre === valor
                      ? "bg-primary text-white dark:bg-accent dark:text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icono className="h-3 w-3" /> {etiqueta}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Cupos disponibles de la tarjeta: el número que el admin pone a mano en
 * Admin › Planes (hoy 19, mañana 1). Solo dice cuántos quedan, sin detalle.
 */
function ContadorCupos({ plan }: { plan: Plan }) {
  if (plan.cupos_restantes === null) return null;
  const restantes = plan.cupos_restantes;
  return (
    <p className="mt-5 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-sm font-semibold">
      <span className={`h-2 w-2 rounded-full ${restantes < 1 ? "bg-muted-foreground" : "bg-primary dark:bg-accent"}`} />
      {restantes < 1
        ? "Sin cupos disponibles"
        : restantes === 1
          ? "Queda 1 cupo disponible"
          : `Quedan ${restantes} cupos disponibles`}
    </p>
  );
}

function Tarjeta({ plan, onInscribirme }: { plan: Plan; onInscribirme: (plan: Plan) => void }) {
  const sinCupos = plan.cupos_restantes !== null && plan.cupos_restantes < 1;
  return (
    <article
      className={`relative flex flex-col rounded-2xl border p-6 sm:p-7 ${
        plan.destacado
          ? "border-primary bg-card shadow-lg ring-1 ring-primary/30 dark:border-accent dark:ring-accent/30"
          : "border-border bg-card/80 backdrop-blur-sm"
      }`}
    >
      {plan.video && <VideoTarjeta video={plan.video} nombre={plan.nombre} />}
      <h3 className="text-lg font-bold">{plan.nombre}</h3>
      {plan.para_quien && <p className="mt-1 text-sm text-muted-foreground">{plan.para_quien}</p>}
      <p className="mt-5 text-3xl font-bold tracking-tight">
        {pesos(plan.precio_cop)}
        {plan.iva_pct > 0 && <span className="ml-1 text-base font-semibold text-muted-foreground">+ IVA</span>}
      </p>
      {plan.iva_pct > 0 && <p className="text-xs text-muted-foreground">{pesos(plan.total_cop)} con IVA</p>}
      <ContadorCupos plan={plan} />
      <ul className="mt-5 flex-1 space-y-2.5 text-sm">
        {plan.incluye.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary dark:text-accent" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onInscribirme(plan)}
        className={`mt-6 h-11 rounded-lg text-sm font-semibold transition-colors ${
          plan.destacado || !sinCupos
            ? "bg-primary text-white hover:bg-primary/90 dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/85"
            : "border border-border hover:bg-muted"
        }`}
      >
        {sinCupos ? "Lista de espera" : "Inscribirme"}
      </button>
    </article>
  );
}

/**
 * Hasta que los VIP prueben la plataforma no se abre al público: la sección lo
 * dice arriba y ofrece la lista de espera de la apertura.
 */
/** La línea de la lista cerrada: la usan esta sección y el registro cerrado. */
export const LISTA_CERRADA = {
  titulo: "Acceso por lista cerrada.",
  texto: "Por ahora solo publican solicitudes quienes entran con el plan de lanzamiento. Apertura al público: próximamente.",
};

function AvisoListaCerrada({ onAvisame }: { onAvisame: () => void }) {
  return (
    <div className="mx-auto mt-10 flex max-w-3xl flex-col items-center gap-4 rounded-2xl border border-primary/25 bg-card/80 px-5 py-5 text-center backdrop-blur-sm dark:border-accent/25">
      <p className="flex items-start gap-2 text-sm leading-relaxed sm:items-center">
        <LockKeyhole className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary dark:text-accent sm:mt-0" />
        <span>
          <strong className="font-semibold">{LISTA_CERRADA.titulo}</strong> {LISTA_CERRADA.texto}
        </span>
      </p>
      <button
        type="button"
        onClick={onAvisame}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-primary px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white dark:border-accent dark:text-accent dark:hover:bg-accent dark:hover:text-accent-foreground"
      >
        <BellRing className="h-4 w-4" /> Avísame cuando abra
      </button>
    </div>
  );
}

export function SeccionPlanes({ onInscribirme, onCondiciones, onAvisame }: {
  onInscribirme: (plan: Plan) => void;
  onCondiciones: () => void;
  /** «Avísame cuando abra»: lleva a la lista de espera de la apertura. */
  onAvisame: () => void;
}) {
  const [planes, setPlanes] = useState<Plan[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    planesService.listar().then((r) => setPlanes(r.planes)).catch(() => setError(true));
  }, []);

  return (
    <section id="planes" className="scroll-mt-20 py-20 px-6 bg-muted relative overflow-hidden">
      <div className="zarpi-blob zarpi-blob-violet absolute -right-24 top-10 pointer-events-none opacity-30 scale-90" />
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.18em] text-primary dark:text-accent font-semibold mb-3">Precio de lanzamiento</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Elige cómo entrar a Zarpi</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            Cupos limitados para los primeros compradores. El precio de lanzamiento se mantiene mientras haya cupos.
          </p>
        </div>
        {planes === null && !error ? (
          <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : error || !planes?.length ? (
          <p className="rounded-xl border border-dashed border-border bg-card/60 py-10 text-center text-sm text-muted-foreground">
            Los planes no están disponibles en este momento. Escríbenos desde Contacto y te contamos cómo entrar.
          </p>
        ) : (
          <div className={`grid gap-6 ${planes.length > 1 ? "md:grid-cols-2" : "max-w-md mx-auto"} ${planes.length > 2 ? "lg:grid-cols-3" : ""}`}>
            {planes.map((plan) => <Tarjeta key={plan.id} plan={plan} onInscribirme={onInscribirme} />)}
          </div>
        )}
        <AvisoListaCerrada onAvisame={onAvisame} />
        <p className="mt-8 max-w-5xl mx-auto text-center text-xs leading-relaxed text-muted-foreground">
          Una solicitud es una publicación con producto y cantidad que llega a las empresas importadoras. Si no recibe
          propuestas en 72 horas, la unidad vuelve a tu saldo. Pago por transferencia; activamos tu plan en máximo 2 horas
          en horario hábil.{" "}
          <button type="button" onClick={onCondiciones} className="font-medium text-primary underline-offset-2 hover:underline dark:text-accent">
            Ver condiciones de los planes
          </button>
        </p>
      </div>
    </section>
  );
}
