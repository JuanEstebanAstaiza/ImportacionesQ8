import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, Link2, Loader2, Lock, Play, RefreshCw, Send, Users } from "lucide-react";

import {
  ETIQUETA_PLATAFORMA,
  PIE_GENERAL,
  tendenciasService,
  type FeedTendencias,
  type TarjetaTendencia,
} from "@/services/tendencias.service";

import { MuroPago } from "./MuroPago";
import type { PrefillSolicitud } from "./prefill";
import {
  EtiquetaRegulado,
  ImagenPublica,
  etiquetaSemana,
  prefillDesdeFicha,
  prefillDesdeTarjeta,
  puedeCotizar,
  textoBotonCotizar,
  textoCotizaciones,
  textoOrigen,
  type RolTendencias,
} from "./piezas";

/**
 * Feed público de Tendencias. Regla del módulo: aquí no se carga ningún
 * reproductor ni script de TikTok, Instagram o YouTube; solo la portada.
 */

type Props = {
  rol: RolTendencias;
  onAbrir: (id: string) => void;
  onPedirPropuestas: (p: PrefillSolicitud) => void;
  onEnviarEnlace: () => void;
  /** Muro de pago: sin estos, se navega a /registro y /login. */
  onRegistrarse?: () => void;
  onIniciarSesion?: () => void;
  /** Muro de pago sin pasarela: a Pagos, para subir el comprobante de la suscripción. */
  onIrAPagos?: () => void;
};

const CLASE_CTA =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:bg-[#EDF953] dark:text-[#16151B] dark:hover:bg-[#f3fb8a] dark:focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-60";

function Tarjeta({
  item,
  mostrarBoton,
  pidiendo,
  onAbrir,
  onPedir,
}: {
  item: TarjetaTendencia;
  mostrarBoton: boolean;
  pidiendo: boolean;
  onAbrir: () => void;
  onPedir: () => void;
}) {
  const alTeclear = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onAbrir();
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={alTeclear}
      aria-label={`Ver ${item.nombre}`}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 dark:border-white/10 dark:bg-[#18171C] dark:text-white dark:hover:border-white/25 dark:focus-visible:ring-[#EDF953]"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-neutral-900">
        <ImagenPublica src={item.portada_url} alt={item.nombre} className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]" />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-transform group-hover:scale-110 sm:h-12 sm:w-12">
          <Play className="ml-0.5 h-5 w-5 fill-current" />
        </span>
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          {ETIQUETA_PLATAFORMA[item.plataforma] ?? item.plataforma}
        </span>
        {item.regulado ? (
          <span className="absolute bottom-2 left-2">
            <EtiquetaRegulado />
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-primary dark:text-[#EDF953]/90">{item.categoria}</p>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug sm:text-base">{item.nombre}</h3>
        <p className="line-clamp-1 text-xs text-muted-foreground dark:text-white/60">{textoOrigen(item)}</p>
        <p className="mt-auto flex items-center gap-1 pt-1 text-xs text-muted-foreground dark:text-white/75">
          <Users className="h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-2">{textoCotizaciones(item.cotizaciones_semana)}</span>
        </p>
        {mostrarBoton ? (
          <button
            type="button"
            disabled={pidiendo}
            onClick={(e) => { e.stopPropagation(); onPedir(); }}
            className={`${CLASE_CTA} mt-2 w-full px-2 text-xs sm:text-sm`}
          >
            {pidiendo ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Send className="h-4 w-4 shrink-0" />}
            <span className="truncate">{textoBotonCotizar(item)}</span>
          </button>
        ) : null}
      </div>
    </article>
  );
}

/** Hueco de lo que queda detrás del muro: portada difuminada y candado. */
function TarjetaBloqueada({ portada, texto }: { portada: string | null; texto: string | null }) {
  return (
    <div aria-hidden={texto ? undefined : true} className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-border bg-card dark:border-white/10 dark:bg-[#18171C]">
      {portada ? <ImagenPublica src={portada} alt="" className="absolute inset-0 h-full w-full scale-125 opacity-60 blur-xl" /> : null}
      <span className="absolute inset-0 bg-gradient-to-br from-[#4F06EB]/35 via-black/50 to-black/80" />
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/20 backdrop-blur-sm">
          <Lock className="h-5 w-5" />
        </span>
        {texto ? <span className="text-sm font-semibold text-white">{texto}</span> : null}
      </span>
    </div>
  );
}

export function TendenciasFeed({ rol, onAbrir, onPedirPropuestas, onEnviarEnlace, onRegistrarse, onIniciarSesion, onIrAPagos }: Props) {
  const [semana, setSemana] = useState<string | null>(null);
  const [semanaActual, setSemanaActual] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [datos, setDatos] = useState<FeedTendencias | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [pidiendo, setPidiendo] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    tendenciasService
      .feed({ semana: semana ?? undefined, categoria: categoria ?? undefined })
      .then((r) => {
        if (!vigente) return;
        setDatos(r);
        // Sin semana elegida, el backend responde con la actual.
        if (!semana) setSemanaActual((prev) => prev ?? r.semana);
      })
      .catch((e: unknown) => {
        if (vigente) setError(e instanceof Error && e.message ? e.message : "No pudimos cargar las tendencias.");
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [semana, categoria, intento]);

  const semanaMostrada = semana ?? datos?.semana ?? semanaActual;
  const opcionesSemana = Array.from(new Set([semanaActual, ...(datos?.semanas ?? [])].filter(Boolean) as string[]))
    .sort((a, b) => (a < b ? 1 : -1));
  const categorias = datos?.categorias ?? [];
  const items = datos?.items ?? [];
  const mostrarBoton = puedeCotizar(rol);
  // Semana más reciente con productos, para sugerirla si la elegida está vacía.
  const otraSemana = (datos?.semanas ?? []).find((s) => s !== semanaMostrada) ?? null;
  // Muro de pago: solo vista previa. Con "Tendencias gratis" acceso.completo llega en true.
  const vistaPrevia = datos?.acceso ? !datos.acceso.completo : false;
  const ocultos = vistaPrevia ? datos?.acceso.ocultos ?? 0 : 0;
  const huecos = Math.min(ocultos, 4);

  async function pedir(item: TarjetaTendencia) {
    if (pidiendo) return;
    setPidiendo(item.id);
    try {
      const ficha = await tendenciasService.ficha(item.id);
      onPedirPropuestas(prefillDesdeFicha(ficha));
    } catch (e) {
      if (e instanceof Error && /no encontrado/i.test(e.message)) {
        toast.error("Este producto ya no está disponible.");
        setIntento((n) => n + 1);
      } else {
        onPedirPropuestas(prefillDesdeTarjeta(item));
      }
    } finally {
      setPidiendo(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-sm dark:border-transparent dark:bg-[#0F0F0F] dark:text-white">
      <div className="space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary dark:text-[#EDF953]">Tendencias</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl">Productos virales para importar</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground dark:text-white/70">
              Lo que se está moviendo en TikTok, Instagram y YouTube, revisado por el equipo de Zarpi. Mira el video y pide
              propuestas a importadoras verificadas, sin compromiso.
            </p>
          </div>
          <button type="button" onClick={onEnviarEnlace} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent dark:border-white/20 dark:text-white dark:hover:border-accent">
            <Link2 className="h-4 w-4" /> Sube un producto viral
          </button>
        </header>

        <div className="flex flex-col gap-3">
          <label className="flex w-full items-center gap-2 sm:w-auto">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground dark:text-white/60" />
            <span className="sr-only">Semana</span>
            <select
              value={semanaMostrada ?? ""}
              onChange={(e) => setSemana(e.target.value || null)}
              disabled={opcionesSemana.length === 0}
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary sm:w-auto dark:border-white/15 dark:bg-[#18171C] dark:text-white dark:focus:ring-[#EDF953]"
            >
              {opcionesSemana.length === 0 && semanaMostrada === null ? <option value="">Esta semana</option> : null}
              {opcionesSemana.map((s) => (
                <option key={s} value={s}>{etiquetaSemana(s, semanaActual)}</option>
              ))}
            </select>
          </label>

          {categorias.length > 0 ? (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filtrar por categoría">
              {[null, ...categorias].map((c) => {
                const activa = categoria === c;
                return (
                  <button
                    key={c ?? "todas"}
                    type="button"
                    aria-pressed={activa}
                    onClick={() => setCategoria(c)}
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      activa ? "border-primary bg-primary text-primary-foreground dark:border-[#EDF953] dark:bg-[#EDF953] dark:text-[#16151B]" : "border-border text-muted-foreground hover:border-primary/40 dark:border-white/15 dark:text-white/80 dark:hover:border-white/40"
                    }`}
                  >
                    {c ?? "Todas"}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {cargando && !datos ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground dark:text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando tendencias…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border px-4 py-12 text-center">
            <AlertTriangle className="h-6 w-6 text-rose-400" />
            <p className="max-w-md text-sm text-muted-foreground dark:text-white/70">{error}</p>
            <button type="button" onClick={() => setIntento((n) => n + 1)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:border-primary/50 dark:border-white/20 dark:hover:border-white/50">
              <RefreshCw className="h-3.5 w-3.5" /> Reintentar
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-12 text-center">
            <p className="text-base font-semibold">
              {categoria ? `No hay productos de ${categoria} esta semana` : "Todavía no hay productos esta semana"}
            </p>
            <p className="max-w-md text-sm text-muted-foreground dark:text-white/65">
              ¿Viste un producto viral que valga la pena importar? Pásanos el enlace del video y lo revisamos.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={onEnviarEnlace} className={CLASE_CTA}>
                <Link2 className="h-4 w-4" /> Enviar un enlace
              </button>
              {categoria ? (
                <button type="button" onClick={() => setCategoria(null)} className="rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/50 dark:border-white/20 dark:hover:border-white/50">
                  Ver todas las categorías
                </button>
              ) : otraSemana ? (
                <button type="button" onClick={() => setSemana(otraSemana)} className="rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/50 dark:border-white/20 dark:hover:border-white/50">
                  Ver {etiquetaSemana(otraSemana, semanaActual).toLowerCase()}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className={`grid grid-cols-[repeat(auto-fill,minmax(155px,1fr))] gap-3 sm:gap-4 md:grid-cols-[repeat(auto-fill,minmax(210px,1fr))] ${cargando ? "opacity-60" : ""}`}>
            {items.map((item) => (
              <Tarjeta
                key={item.id}
                item={item}
                mostrarBoton={mostrarBoton}
                pidiendo={pidiendo === item.id}
                onAbrir={() => onAbrir(item.id)}
                onPedir={() => { void pedir(item); }}
              />
            ))}
            {Array.from({ length: huecos }, (_, i) => (
              <TarjetaBloqueada
                key={`oculto-${i}`}
                portada={items[(i + 1) % items.length]?.portada_url ?? null}
                texto={i === huecos - 1 ? `+${ocultos} ${ocultos === 1 ? "producto más" : "productos más"}` : null}
              />
            ))}
          </div>
        )}

        {vistaPrevia && !error && items.length > 0 ? (
          <MuroPago
            autenticado={rol !== null}
            rol={rol}
            onRegistrarse={onRegistrarse ?? (() => window.location.assign("/registro"))}
            onIniciarSesion={onIniciarSesion ?? (() => window.location.assign("/login"))}
            onAccesoConcedido={() => setIntento((n) => n + 1)}
            onPagarConTransferencia={onIrAPagos}
          />
        ) : null}

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-white/[0.03]">
          <div>
            <p className="text-sm font-semibold">¿Encontraste un producto viral? Súbelo</p>
            <p className="text-xs text-muted-foreground dark:text-white/60">Pega el enlace de TikTok, Instagram o YouTube. Lo revisamos en menos de 48 horas.</p>
          </div>
          <button type="button" onClick={onEnviarEnlace} className={`${CLASE_CTA} shrink-0`}>
            <Link2 className="h-4 w-4" /> Enviar enlace
          </button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground dark:text-white/45">
          Los videos pertenecen a sus autores y se ven en la ficha de cada producto. {PIE_GENERAL}
        </p>
      </div>
    </section>
  );
}
