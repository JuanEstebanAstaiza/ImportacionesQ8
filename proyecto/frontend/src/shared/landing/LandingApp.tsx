import type { CSSProperties } from "react";
import { ArrowRight, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@shared/ui/design-system";
import type { DestinosSuite } from "@shared/suite/destinos";
import { BotonAcento, Eyebrow, LandingShell } from "@shared/landing/LandingShell";
import type { LegalPage } from "@shared/legal/types";

export interface ContenidoLandingApp {
  /** id de la app en APPS_SUITE (shared/suite/suite.ts). */
  appId: string;
  nombre: string;
  /** Hex del acento de la app. */
  acento: string;
  eyebrow: string;
  titulo: string;
  tituloResaltado: string;
  texto: string;
  ctaPrimario: string;
  ctaSecundario: string;
  puntos: { icono: LucideIcon; texto: string }[];
  estadisticas: { valor: string; etiqueta: string }[];
  pasosTitulo: string;
  pasos: { titulo: string; texto: string }[];
  valorTitulo: string;
  bloques: { icono: LucideIcon; titulo: string; texto: string; items: string[] }[];
  cierreTitulo: string;
  cierreTexto: string;
}

export type PropsLandingApp = {
  contenido: ContenidoLandingApp;
  autenticado: boolean;
  /** Cómo se llega a las otras apps de la suite (alimenta el selector radial). */
  destinos: DestinosSuite;
  onIniciarSesion: () => void;
  onCrearCuenta: () => void;
  onEntrar: () => void;
  onPolicy: (page: LegalPage) => void;
};

const SECCIONES = [
  { id: "como-funciona", label: "Cómo funciona" },
  { id: "valor", label: "Qué ofrece" },
] as const;

/** Landing pública genérica de una app de la suite; el acento llega por `contenido.acento`. */
export function LandingApp({ contenido: c, autenticado, destinos, onIniciarSesion, onCrearCuenta, onEntrar, onPolicy }: PropsLandingApp) {
  const acentoTexto: CSSProperties = { color: c.acento };
  const acentoFondo: CSSProperties = { backgroundColor: c.acento };
  const cta = () => (autenticado ? onEntrar() : onCrearCuenta());

  return (
    <LandingShell
      appId={c.appId}
      nombre={c.nombre}
      destinos={destinos}
      secciones={SECCIONES}
      acento={c.acento}
      autenticado={autenticado}
      onIniciarSesion={onIniciarSesion}
      onCrearCuenta={onCrearCuenta}
      onEntrar={onEntrar}
      onPolicy={onPolicy}
      notaPie={`Prototipo visual con contenido de ejemplo. ${c.nombre} aún no está disponible.`}
    >
      {/* HERO */}
      <section className="relative overflow-hidden px-4 pb-20 pt-14 sm:px-6 lg:pt-20">
        <div className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full opacity-20 blur-3xl" style={acentoFondo} aria-hidden="true" />
        <div className="pointer-events-none absolute -right-24 top-40 h-[300px] w-[300px] rounded-full opacity-10 blur-3xl" style={acentoFondo} aria-hidden="true" />
        <div className="relative mx-auto grid max-w-[1100px] items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <Eyebrow acento={c.acento}>{c.eyebrow}</Eyebrow>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
              {c.titulo} <span style={acentoTexto}>{c.tituloResaltado}</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">{c.texto}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <BotonAcento grande acento={c.acento} onClick={cta}>{c.ctaPrimario} <ArrowRight className="h-4 w-4" /></BotonAcento>
              <Button variant="secondary" size="lg" className="h-11 px-6" onClick={cta}>{c.ctaSecundario}</Button>
            </div>
            <ul className="mt-8 space-y-2.5 text-sm text-muted-foreground">
              {c.puntos.map(({ icono: Icono, texto }) => (
                <li key={texto} className="flex items-center gap-2.5">
                  <Icono className="h-4 w-4 flex-shrink-0" style={acentoTexto} />
                  {texto}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4" aria-hidden="true">
            {c.estadisticas.map((e) => (
              <div key={e.etiqueta} className="relative overflow-hidden rounded-2xl border border-border bg-card/70 p-5">
                <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl" style={acentoFondo} />
                <p className="text-2xl font-bold sm:text-3xl" style={acentoTexto}>{e.valor}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{e.etiqueta}</p>
              </div>
            ))}
            <p className="col-span-2 text-center text-xs text-muted-foreground">Cifras de ejemplo del prototipo.</p>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="scroll-mt-16 border-t border-border bg-muted/40 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-[1100px]">
          <Eyebrow acento={c.acento}>Cómo funciona</Eyebrow>
          <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">{c.pasosTitulo}</h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {c.pasos.map((paso, i) => (
              <li key={paso.titulo} className="flex flex-col rounded-2xl border border-border bg-card p-5">
                <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white" style={acentoFondo}>{i + 1}</span>
                <h3 className="mb-1.5 font-semibold">{paso.titulo}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{paso.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* VALOR */}
      <section id="valor" className="scroll-mt-16 border-t border-border px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-[1100px]">
          <Eyebrow acento={c.acento}>Qué ofrece</Eyebrow>
          <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">{c.valorTitulo}</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {c.bloques.map(({ icono: Icono, titulo, texto, items }) => (
              <article key={titulo} className="flex flex-col rounded-2xl border border-border bg-card p-6">
                <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${c.acento}22`, color: c.acento }}>
                  <Icono className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-semibold">{titulo}</h3>
                <p className="mb-4 mt-1.5 text-sm leading-relaxed text-muted-foreground">{texto}</p>
                <ul className="space-y-2.5">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0" style={acentoTexto} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CIERRE */}
      <section className="px-4 py-16 sm:px-6">
        <div className="relative mx-auto max-w-[1100px] overflow-hidden rounded-3xl px-6 py-12 text-white sm:px-12" style={acentoFondo}>
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{c.cierreTitulo}</h2>
              <p className="mt-2 leading-relaxed text-white/85">{c.cierreTexto}</p>
            </div>
            <div className="flex flex-shrink-0 flex-col gap-3 sm:flex-row">
              <button type="button" onClick={cta} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-white px-6 text-sm font-semibold text-black transition hover:bg-white/90">
                {c.ctaPrimario} <ArrowRight className="h-4 w-4" />
              </button>
              {!autenticado && (
                <button type="button" onClick={onIniciarSesion} className="inline-flex h-11 items-center justify-center rounded-lg border border-white/40 px-6 text-sm font-semibold text-white transition hover:bg-white/10">
                  Iniciar sesión
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </LandingShell>
  );
}
