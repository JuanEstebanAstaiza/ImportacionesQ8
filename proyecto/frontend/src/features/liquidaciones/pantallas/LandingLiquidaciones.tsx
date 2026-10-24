import { useState, type ReactNode } from "react";
import { clsx } from "clsx";
import {
  ArrowRight, BadgeCheck, Check, CircleCheck, CircleX, FileCheck, Menu, Moon, ShieldCheck, ShoppingBag, Store, Sun, X,
} from "lucide-react";

import { Button } from "@/components/design-system";
import { useBrandTheme } from "@/hooks/useBrandTheme";
import type { LegalPage } from "@/features/legal/types";
import { FotoVacia } from "@/features/liquidaciones/componentes/MediosLote";
import { TarjetaLote } from "@/features/liquidaciones/componentes/TarjetaLote";
import { LO_QUE_HACE_ZARPI, NO_SE_PERMITEN, QUE_REVISA_ZARPI } from "@/features/liquidaciones/constantes";
import { useVistaPublica } from "@/features/liquidaciones/useLiquidaciones";

/**
 * Portada pública de Zarpi Liquidaciones. Tiene su propio encabezado (no el del
 * portal) pero no su propio acceso: los botones llevan al login y al registro
 * de Zarpi, porque es la misma cuenta para toda la suite.
 */

type Props = {
  autenticado: boolean;
  onIniciarSesion: () => void;
  onCrearCuenta: (intencion: "comprar" | "publicar") => void;
  onEntrar: () => void;
  onPolicy: (page: LegalPage) => void;
  onIrAZarpi: () => void;
};

const SECCIONES = [
  { id: "como-funciona", label: "Cómo funciona" },
  { id: "para-quien", label: "Para quién es" },
  { id: "reglas", label: "Reglas" },
] as const;

const PASOS = [
  {
    titulo: "El vendedor publica",
    texto: "Nombre, unidades, estado, mínimo 3 fotos reales, precio del lote, ciudad, entrega y fecha de cierre de hasta 15 días.",
  },
  {
    titulo: "Zarpi revisa",
    texto: "Fotos reales, estado bien declarado, producto permitido y precio coherente. Si cumple, se publica.",
  },
  {
    titulo: "Compras el lote",
    texto: "Precio fijo, lote completo. El primero en dar clic en «Comprar lote» lo reserva y se abre el chat de la operación.",
  },
  {
    titulo: "Cierran entre ustedes",
    texto: "Pago y entrega directos; el vendedor factura. Tiene 48 horas para marcarlo vendido o el lote vuelve a estar disponible.",
  },
];

const PUBLICAN = [
  "Publica lotes completos de mercancía nueva, devoluciones o con empaque abierto",
  "Precio fijo y fecha de cierre de hasta 15 días",
  "Opción de destacar el lote para que aparezca primero",
];

const COMPRAN = [
  "Lotes completos con precio por unidad calculado",
  "Estado declarado: nuevo, devolución, empaque abierto o con averías",
  "Contacto directo con el vendedor y chat con registro",
];

// El acento ácido va en un botón propio: sobre `Button` competiría con el
// fondo de su variante y el resultado dependería del orden del CSS.
function BotonAcento({ children, onClick, grande = false, className }: { children: ReactNode; onClick: () => void; grande?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent font-semibold text-black shadow-sm transition hover:brightness-95 active:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        grande ? "h-11 px-6 text-sm" : "h-8 px-3 text-xs",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary dark:text-accent">{children}</p>;
}

/** Hueco de vista previa: rayado y sin datos inventados, para no simular lotes que no existen. */
function TarjetaVacia() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-dashed border-border bg-card/60" aria-hidden="true">
      <FotoVacia className="aspect-[4/3] w-full" />
      <div className="space-y-2 p-3">
        <span className="block h-2 w-1/3 rounded-full bg-muted" />
        <span className="block h-3 w-4/5 rounded-full bg-muted" />
        <span className="block h-2 w-1/2 rounded-full bg-muted" />
        <span className="mt-3 block h-3.5 w-2/5 rounded-full bg-muted" />
      </div>
    </div>
  );
}

function VistaPreviaLotes() {
  const { data, isLoading } = useVistaPublica();
  const lotes = (data ?? []).slice(0, 4);
  const huecos = Math.max(0, 4 - lotes.length);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {lotes.map((lote) => <TarjetaLote key={lote.id} lote={lote} />)}
        {Array.from({ length: huecos }, (_, i) => (
          <div key={`hueco-${i}`} className={clsx(isLoading && "animate-pulse")}><TarjetaVacia /></div>
        ))}
      </div>
      {!isLoading && lotes.length === 0 && (
        <p className="mt-3 text-center text-xs text-muted-foreground">Los lotes aparecerán aquí al publicarse.</p>
      )}
    </div>
  );
}

function ListaConIcono({ items, icono }: { items: string[]; icono: ReactNode }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
          <span className="mt-0.5 flex-shrink-0">{icono}</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function LandingLiquidaciones({ autenticado, onIniciarSesion, onCrearCuenta, onEntrar, onPolicy, onIrAZarpi }: Props) {
  const { dark, toggleTheme } = useBrandTheme();
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Quien ya tiene sesión no necesita registrarse: cualquier llamado lo lleva adentro.
  const comprar = () => (autenticado ? onEntrar() : onCrearCuenta("comprar"));
  const publicar = () => (autenticado ? onEntrar() : onCrearCuenta("publicar"));

  const irASeccion = (id: string) => {
    setMenuAbierto(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const botonTema = (
    <button
      type="button"
      onClick={toggleTheme}
      title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground dark:hover:bg-accent dark:hover:text-accent-foreground"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ENCABEZADO */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between gap-4 px-4 sm:px-6">
          <button type="button" onClick={onIrAZarpi} aria-label="Ir a Zarpi" className="flex flex-shrink-0 items-center gap-2.5">
            <img src={dark ? "/brand/zarpi-wordmark-acid.svg" : "/brand/zarpi-wordmark.svg"} alt="Zarpi" className="h-7 w-24 object-contain object-left" />
            <span className="border-l border-border pl-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Liquidaciones</span>
          </button>

          <nav aria-label="Secciones" className="hidden items-center gap-1 md:flex">
            {SECCIONES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => irASeccion(s.id)}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
              >
                {s.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {botonTema}
            <div className="hidden items-center gap-2 sm:flex">
              {autenticado ? (
                <BotonAcento onClick={onEntrar}>Entrar a Liquidaciones <ArrowRight className="h-3.5 w-3.5" /></BotonAcento>
              ) : (
                <>
                  <Button variant="secondary" size="sm" onClick={onIniciarSesion}>Iniciar sesión</Button>
                  <BotonAcento onClick={() => onCrearCuenta("comprar")}>Crear cuenta</BotonAcento>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={menuAbierto}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            >
              {menuAbierto ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {menuAbierto && (
          <div className="border-t border-border bg-background px-4 pb-4 pt-2 md:hidden">
            <nav aria-label="Secciones" className="flex flex-col">
              {SECCIONES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => irASeccion(s.id)}
                  className="rounded-lg px-2 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {s.label}
                </button>
              ))}
            </nav>
            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:hidden">
              {autenticado ? (
                <BotonAcento grande onClick={onEntrar}>Entrar a Liquidaciones</BotonAcento>
              ) : (
                <>
                  <Button variant="secondary" size="lg" fullWidth onClick={onIniciarSesion}>Iniciar sesión</Button>
                  <BotonAcento grande onClick={() => onCrearCuenta("comprar")}>Crear cuenta</BotonAcento>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden px-4 pb-20 pt-14 sm:px-6 lg:pt-20">
          <div className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -right-24 top-40 h-[300px] w-[300px] rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-[1100px] items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <Eyebrow>Zarpi Liquidaciones</Eyebrow>
              <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
                Lotes listos para vender, a <span className="text-primary dark:text-accent">precio de oportunidad.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Importadoras, distribuidores y bodegas publican lotes por tiempo limitado. Compras el lote completo a precio fijo, lo pones a rotar en tu negocio y cierras el pago y la entrega directamente con quien vende.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <BotonAcento grande onClick={comprar}>Quiero comprar lotes <ArrowRight className="h-4 w-4" /></BotonAcento>
                <Button variant="secondary" size="lg" className="h-11 px-6" onClick={publicar}>Quiero publicar lotes</Button>
              </div>
              <ul className="mt-8 space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2.5">
                  <BadgeCheck className="h-4 w-4 flex-shrink-0 text-primary dark:text-accent" />
                  Cada publicación revisada por Zarpi
                </li>
                <li className="flex items-center gap-2.5">
                  <FileCheck className="h-4 w-4 flex-shrink-0 text-primary dark:text-accent" />
                  Solo empresas y comerciantes con RUT
                </li>
              </ul>
            </div>
            <VistaPreviaLotes />
          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section id="como-funciona" className="scroll-mt-16 border-t border-border bg-muted/40 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-[1100px]">
            <Eyebrow>Cómo funciona</Eyebrow>
            <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">Precio fijo. El primero en dar clic se lo lleva.</h2>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PASOS.map((paso, i) => (
                <li key={paso.titulo} className="flex flex-col rounded-2xl border border-border bg-white p-5">
                  <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground dark:bg-accent dark:text-black">
                    {i + 1}
                  </span>
                  <h3 className="mb-1.5 font-semibold">{paso.titulo}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{paso.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* PARA QUIÉN ES */}
        <section id="para-quien" className="scroll-mt-16 border-t border-border px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-[1100px]">
            <Eyebrow>Para quién es</Eyebrow>
            <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">Entre empresas. No vendemos a consumidores finales.</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <article className="flex flex-col rounded-2xl border border-border bg-white p-6 sm:p-8">
                <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent">
                  <Store className="h-5 w-5" />
                </span>
                <h3 className="text-xl font-semibold">Publican</h3>
                <p className="mb-5 mt-1.5 text-sm leading-relaxed text-muted-foreground">Importadoras, distribuidores y bodegas registradas en Zarpi, con NIT o RUT.</p>
                <ListaConIcono items={PUBLICAN} icono={<Check className="h-4 w-4 text-primary dark:text-accent" />} />
                <div className="mt-auto pt-7">
                  <Button variant="secondary" size="lg" onClick={publicar}>{autenticado ? "Entrar a Liquidaciones" : "Registrar mi empresa"}</Button>
                </div>
              </article>
              <article className="flex flex-col rounded-2xl border border-border bg-white p-6 sm:p-8">
                <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent">
                  <ShoppingBag className="h-5 w-5" />
                </span>
                <h3 className="text-xl font-semibold">Compran</h3>
                <p className="mb-5 mt-1.5 text-sm leading-relaxed text-muted-foreground">Empresas o personas naturales con RUT que compran para revender o para su negocio.</p>
                <ListaConIcono items={COMPRAN} icono={<Check className="h-4 w-4 text-primary dark:text-accent" />} />
                <div className="mt-auto pt-7">
                  <Button variant="secondary" size="lg" onClick={comprar}>{autenticado ? "Entrar a Liquidaciones" : "Crear cuenta de comprador"}</Button>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* REGLAS */}
        <section id="reglas" className="scroll-mt-16 border-t border-border bg-muted/40 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-[1100px]">
            <Eyebrow>Reglas</Eyebrow>
            <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">Toda liquidación pasa por revisión antes de publicarse.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              «Revisado por Zarpi» significa que revisamos la publicación, no que garantizamos la mercancía.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-border bg-white p-6">
                <h3 className="mb-4 font-semibold">Qué revisamos</h3>
                <ListaConIcono items={QUE_REVISA_ZARPI} icono={<CircleCheck className="h-4 w-4 text-emerald-500" />} />
              </div>
              <div className="rounded-2xl border border-border bg-white p-6">
                <h3 className="mb-4 font-semibold">No se permiten</h3>
                <ListaConIcono items={NO_SE_PERMITEN} icono={<CircleX className="h-4 w-4 text-rose-500" />} />
              </div>
              <div className="rounded-2xl border border-border bg-white p-6">
                <h3 className="mb-4 font-semibold">Lo que hace Zarpi</h3>
                <ListaConIcono items={LO_QUE_HACE_ZARPI} icono={<ShieldCheck className="h-4 w-4 text-primary dark:text-accent" />} />
              </div>
            </div>
          </div>
        </section>

        {/* CIERRE */}
        <section className="px-4 py-16 sm:px-6">
          <div className="relative mx-auto max-w-[1100px] overflow-hidden rounded-3xl bg-primary px-6 py-12 text-white sm:px-12">
            <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">¿Tienes lotes listos para mover?</h2>
                <p className="mt-2 leading-relaxed text-white/80">Llega a comerciantes que compran para revender. Fecha de cierre de hasta 15 días.</p>
              </div>
              <div className="flex flex-shrink-0 flex-col gap-3 sm:flex-row">
                <BotonAcento grande onClick={publicar}>Publicar un lote <ArrowRight className="h-4 w-4" /></BotonAcento>
                {!autenticado && (
                  <button
                    type="button"
                    onClick={onIniciarSesion}
                    className="inline-flex h-11 items-center justify-center rounded-lg border border-white/40 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Iniciar sesión
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* PIE */}
      <footer className="border-t border-border px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-4 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span>© 2026 Zarpi</span>
            <button type="button" onClick={() => onPolicy("data")} className="transition-colors hover:text-foreground">Tratamiento de Datos</button>
            <button type="button" onClick={() => onPolicy("terms")} className="transition-colors hover:text-foreground">Términos</button>
          </div>
          <p className="max-w-md leading-relaxed md:text-right">
            Zarpi conecta a las partes y deja registro. No vende, no recibe el dinero del lote ni hace la entrega.
          </p>
        </div>
      </footer>
    </div>
  );
}
