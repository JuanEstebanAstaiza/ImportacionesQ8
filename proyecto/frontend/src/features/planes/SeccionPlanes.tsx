import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { planesService, pesos, type Plan } from "@/services/planes.service";

/**
 * Sección «Planes» del inicio (id `planes`, a la que lleva «Solicitar acceso»).
 * Precio, IVA, lo que incluye y cupos salen de Admin › Planes: aquí no hay
 * ningún valor escrito a mano.
 */

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
      <h3 className="text-lg font-bold">{plan.nombre}</h3>
      {plan.para_quien && <p className="mt-1 text-sm text-muted-foreground">{plan.para_quien}</p>}
      <p className="mt-5 text-3xl font-bold tracking-tight">
        {pesos(plan.precio_cop)}
        {plan.iva_pct > 0 && <span className="ml-1 text-base font-semibold text-muted-foreground">+ IVA</span>}
      </p>
      {plan.iva_pct > 0 && <p className="text-xs text-muted-foreground">{pesos(plan.total_cop)} con IVA</p>}
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
      {plan.cupos_restantes !== null && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {sinCupos ? "Sin cupos por ahora" : `Quedan ${plan.cupos_restantes} ${plan.cupos_restantes === 1 ? "cupo" : "cupos"}`}
        </p>
      )}
    </article>
  );
}

export function SeccionPlanes({ onInscribirme, onCondiciones }: {
  onInscribirme: (plan: Plan) => void;
  onCondiciones: () => void;
}) {
  const [planes, setPlanes] = useState<Plan[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    planesService.listar().then((r) => setPlanes(r.planes)).catch(() => setError(true));
  }, []);

  return (
    <section id="planes" className="scroll-mt-20 py-20 px-6 bg-muted relative overflow-hidden">
      <div className="zarpi-blob zarpi-blob-violet absolute -right-24 top-10 pointer-events-none opacity-30 scale-90" />
      <div className="max-w-5xl mx-auto relative z-10">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.18em] text-primary dark:text-accent font-semibold mb-3">Precio de lanzamiento</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Elige cómo entrar a Zarpi</h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
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
        <p className="mt-8 max-w-3xl mx-auto text-center text-xs leading-relaxed text-muted-foreground">
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
