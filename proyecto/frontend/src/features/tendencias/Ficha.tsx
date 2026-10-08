import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Clock,
  ExternalLink,
  Flame,
  Loader2,
  PackageX,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Star,
  Users,
  Video,
} from "lucide-react";

import { ETIQUETA_PLATAFORMA, tendenciasService, type EmpresaTendencia, type FichaTendencia } from "@/services/tendencias.service";

import type { PrefillSolicitud } from "./prefill";
import {
  ImagenPublica,
  iniciales,
  prefillDesdeFicha,
  puedeCotizar,
  textoBotonCotizar,
  textoOrigen,
  type RolTendencias,
} from "./piezas";

/**
 * Ficha pública de un producto de Tendencias. Aquí sí se carga el reproductor
 * oficial de la plataforma (iframe). Sin precio: la única acción es pedir propuestas.
 */

type Props = {
  id: string;
  rol: RolTendencias;
  onVolver: () => void;
  onPedirPropuestas: (p: PrefillSolicitud) => void;
};

const CLASE_CTA =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

function BotonVolver({ onVolver }: { onVolver: () => void }) {
  return (
    <button type="button" onClick={onVolver} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> Volver a Tendencias
    </button>
  );
}

function Reproductor({ ficha }: { ficha: FichaTendencia }) {
  const vertical = ficha.plataforma !== "youtube";
  if (!ficha.embed_url) {
    return (
      <a
        href={ficha.url_video}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative mx-auto block w-full max-w-sm overflow-hidden rounded-2xl bg-neutral-900"
        style={{ aspectRatio: "4 / 5" }}
      >
        <ImagenPublica src={ficha.portada_url} alt={ficha.nombre} className="h-full w-full" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-semibold text-white">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5">
            <ExternalLink className="h-4 w-4" /> Ver video en {ficha.plataforma_nombre}
          </span>
        </span>
      </a>
    );
  }
  return (
    <div
      className="mx-auto w-full overflow-hidden rounded-2xl bg-black shadow-sm"
      style={
        vertical
          ? { aspectRatio: "9 / 16", maxHeight: "80vh", maxWidth: "min(100%, calc(80vh * 9 / 16))" }
          : { aspectRatio: "16 / 9" }
      }
    >
      <iframe
        src={ficha.embed_url}
        title={`Video de ${ficha.nombre} en ${ficha.plataforma_nombre}`}
        className="h-full w-full border-0"
        allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

function Dato({ icono: Icono, texto, tono = "neutro" }: { icono: typeof Users; texto: string; tono?: "neutro" | "aviso" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
        tono === "aviso"
          ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-200"
          : "border-border bg-muted/40 text-foreground"
      }`}
    >
      <Icono className="h-3.5 w-3.5 shrink-0" />
      {texto}
    </span>
  );
}

function BloqueEmpresa({ empresa }: { empresa: EmpresaTendencia }) {
  const calificacion = typeof empresa.calificacion_promedio === "number" && empresa.calificacion_promedio > 0 ? empresa.calificacion_promedio : null;
  const especialidades = empresa.especialidades ?? [];
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Lo recomienda</p>
      <div className="mt-2 flex items-center gap-3">
        {empresa.logo_url ? (
          <ImagenPublica src={empresa.logo_url} alt={`Logo de ${empresa.nombre}`} className="h-12 w-12 shrink-0 rounded-lg border border-border bg-white" />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white">
            {iniciales(empresa.nombre)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold">{empresa.nombre}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {empresa.verificado ? (
              <span className="inline-flex items-center gap-0.5 font-medium text-emerald-700 dark:text-emerald-300">
                <BadgeCheck className="h-3.5 w-3.5" /> Verificada
              </span>
            ) : null}
            {calificacion ? (
              <span className="inline-flex items-center gap-0.5">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {calificacion.toFixed(1)}
              </span>
            ) : null}
            {empresa.tiempo_respuesta_promedio ? (
              <span className="inline-flex items-center gap-0.5">
                <Clock className="h-3.5 w-3.5" /> Responde en {empresa.tiempo_respuesta_promedio}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {especialidades.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {especialidades.slice(0, 6).map((e) => (
            <span key={e} className="rounded-full bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary dark:bg-primary/15 dark:text-violet-200">{e}</span>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">La solicitud que crees desde aquí le llega solo a esta importadora.</p>
    </div>
  );
}

export function TendenciaFicha({ id, rol, onVolver, onPedirPropuestas }: Props) {
  const [ficha, setFicha] = useState<FichaTendencia | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    setNoExiste(false);
    tendenciasService
      .ficha(id)
      .then((f) => { if (vigente) setFicha(f); })
      .catch((e: unknown) => {
        if (!vigente) return;
        const mensaje = e instanceof Error ? e.message : "";
        if (/no encontrado/i.test(mensaje)) setNoExiste(true);
        else setError(mensaje || "No pudimos cargar este producto.");
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [id, intento]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando producto…
      </div>
    );
  }

  if (noExiste) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-border bg-white px-6 py-12 text-center shadow-sm">
        <PackageX className="h-8 w-8 text-muted-foreground" />
        <p className="text-base font-semibold">Este producto ya no está disponible</p>
        <p className="text-sm text-muted-foreground">Puede que el video se haya eliminado o que lo hayamos retirado de Tendencias.</p>
        <BotonVolver onVolver={onVolver} />
      </div>
    );
  }

  if (error || !ficha) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-border bg-white px-6 py-12 text-center shadow-sm">
        <AlertTriangle className="h-6 w-6 text-rose-500" />
        <p className="text-sm text-muted-foreground">{error ?? "No pudimos cargar este producto."}</p>
        <div className="flex gap-3">
          <button type="button" onClick={() => setIntento((n) => n + 1)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
            <RefreshCw className="h-3.5 w-3.5" /> Reintentar
          </button>
          <BotonVolver onVolver={onVolver} />
        </div>
      </div>
    );
  }

  const mostrarBoton = puedeCotizar(rol);
  const plataforma = ficha.plataforma_nombre || ETIQUETA_PLATAFORMA[ficha.plataforma];
  const cotizaron = ficha.cotizaciones_semana > 0 ? `Lo cotizaron ${ficha.cotizaciones_semana} esta semana` : "Sé el primero en cotizarlo";
  const pedir = () => onPedirPropuestas(prefillDesdeFicha(ficha));

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-4">
      <BotonVolver onVolver={onVolver} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
        <div className="space-y-3 lg:sticky lg:top-4">
          <Reproductor ficha={ficha} />
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
            <a href={ficha.url_video} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline dark:text-violet-300">
              Abrir en {plataforma} <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {ficha.autor_plataforma ? <span className="text-muted-foreground">Video de {ficha.autor_plataforma}</span> : null}
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary dark:text-violet-300">{ficha.categoria}</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl">{ficha.nombre}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{textoOrigen(ficha)}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Dato icono={Users} texto={cotizaron} />
            {ficha.regulado ? (
              <Dato icono={ShieldAlert} texto="Puede ser regulado" tono="aviso" />
            ) : (
              <Dato icono={ShieldCheck} texto="Sin requisitos especiales marcados" />
            )}
            <Dato icono={Video} texto={ficha.autor_plataforma ? `${plataforma} · ${ficha.autor_plataforma}` : plataforma} />
          </div>

          {ficha.por_que_tendencia ? (
            <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <p className="flex items-center gap-1.5 text-sm font-semibold"><Flame className="h-4 w-4 text-primary dark:text-violet-300" /> Por qué está en tendencia</p>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed">{ficha.por_que_tendencia}</p>
            </div>
          ) : null}

          {ficha.ojo_antes ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-400/40 dark:bg-amber-500/10">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-200"><AlertTriangle className="h-4 w-4" /> Ojo antes de traerlo</p>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-amber-900 dark:text-amber-100">{ficha.ojo_antes}</p>
            </div>
          ) : null}

          {ficha.empresa ? <BloqueEmpresa empresa={ficha.empresa} /> : null}

          {mostrarBoton ? (
            <div className="hidden space-y-2 lg:block">
              <button type="button" onClick={pedir} className={`${CLASE_CTA} w-full`}>
                <Send className="h-4 w-4" /> {textoBotonCotizar(ficha)}
              </button>
              <p className="text-center text-xs text-muted-foreground">Recibes propuestas con precio y tiempos. Sin compromiso.</p>
            </div>
          ) : null}
        </div>
      </div>

      <footer className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-center text-xs leading-relaxed text-muted-foreground">
        {ficha.pie}
      </footer>

      {mostrarBoton ? (
        // En móvil el botón queda siempre a la vista.
        <div className="sticky bottom-0 border-t border-border bg-background/95 py-3 backdrop-blur lg:hidden">
          <button type="button" onClick={pedir} className={`${CLASE_CTA} w-full`}>
            <Send className="h-4 w-4 shrink-0" /> <span className="truncate">{textoBotonCotizar(ficha)}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
