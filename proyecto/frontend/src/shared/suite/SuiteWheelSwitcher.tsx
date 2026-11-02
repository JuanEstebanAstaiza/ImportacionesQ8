import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import gsap from "gsap";
import { ChevronDown, Factory, Layers, Package, ShoppingBag, Tag } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { APPS_SUITE, type AppSuite, type IconoApp } from "@shared/suite/suite";
import { reproducirOndaSuite } from "./ondaSuite";

const ICONOS: Record<IconoApp, LucideIcon> = {
  package: Package,
  tag: Tag,
  "shopping-bag": ShoppingBag,
  factory: Factory,
};

const NODO = 56;

type Props = {
  /** id (shared/suite/suite.ts) de la app donde está el selector. */
  actual: string;
  /** Cómo se llega a cada app activa; las activas que no vengan (módulo apagado) no se muestran. */
  destinos: Record<string, (() => void) | undefined>;
  className?: string;
};

/**
 * Selector de apps de la suite: un botón en el header que se transforma en una
 * rueda radial con las apps. Al elegir una activa, la rueda gira hasta dejarla
 * arriba y una onda de color lleva a su pantalla. Las apps previstas
 * ("Próximamente") aparecen pero no se abren.
 */
export function SuiteWheelSwitcher({ actual, destinos, className }: Props) {
  const apps = APPS_SUITE.filter((a) => !a.active || a.id === actual || destinos[a.id]);
  const appActual = APPS_SUITE.find((a) => a.id === actual);

  const [abierto, setAbierto] = useState(false);
  const [enfocada, setEnfocada] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const nodosRef = useRef<HTMLDivElement>(null);
  const ocupado = useRef(false);
  const rotacion = useRef(0);
  const abiertoRef = useRef(false);

  const cerrar = useCallback((alTerminar?: () => void) => {
    const overlay = overlayRef.current;
    const trigger = triggerRef.current;
    if (!abiertoRef.current || !overlay || !trigger || (ocupado.current && !alTerminar)) return;
    abiertoRef.current = false;
    ocupado.current = true;
    setAbierto(false);
    setEnfocada(null);

    const r = trigger.getBoundingClientRect();
    gsap.to(overlay.querySelectorAll("[data-nodo]"), { scale: 0, opacity: 0, duration: 0.2, stagger: 0.03, ease: "power2.in" });
    gsap.to(overlay, {
      top: r.top, left: r.left, width: r.width, height: r.height, borderRadius: 9999, autoAlpha: 0,
      duration: 0.38, ease: "power3.inOut",
      onComplete: () => {
        ocupado.current = false;
        alTerminar?.();
      },
    });
  }, []);

  const abrir = useCallback(() => {
    const overlay = overlayRef.current;
    const nodos = nodosRef.current;
    const trigger = triggerRef.current;
    if (abiertoRef.current || ocupado.current || !overlay || !nodos || !trigger) return;
    abiertoRef.current = true;
    ocupado.current = true;
    setAbierto(true);

    const r = trigger.getBoundingClientRect();
    const lado = Math.min(window.innerWidth < 768 ? 290 : 340, window.innerWidth - 32, window.innerHeight - 32);
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const left = Math.min(Math.max(16, cx - lado / 2), window.innerWidth - lado - 16);
    const top = Math.min(Math.max(16, cy - lado / 2), window.innerHeight - lado - 16);

    overlay.style.setProperty("--radio", `${lado * 0.34}px`);
    rotacion.current = 0;
    gsap.set(nodos, { rotation: 0 });
    gsap.set(overlay, { top: r.top, left: r.left, width: r.width, height: r.height, borderRadius: 9999, autoAlpha: 1 });
    gsap.to(overlay, {
      top, left, width: lado, height: lado, borderRadius: "50%", duration: 0.5, ease: "back.out(1.4)",
      onComplete: () => {
        ocupado.current = false;
        overlay.querySelector<HTMLButtonElement>("[data-nodo]:not([aria-disabled='true'])")?.focus();
      },
    });
    gsap.fromTo(
      overlay.querySelectorAll("[data-nodo]"),
      { scale: 0, opacity: 0, rotation: 0 },
      { scale: 1, opacity: 1, duration: 0.4, delay: 0.15, stagger: 0.05, ease: "back.out(1.7)" },
    );
  }, []);

  const elegir = (app: AppSuite, indice: number) => {
    if (ocupado.current) return;
    if (!app.active) {
      setEnfocada(app.id);
      return;
    }
    if (app.id === actual) {
      cerrar();
      return;
    }
    const nodos = nodosRef.current;
    const trigger = triggerRef.current;
    const destino = destinos[app.id];
    if (!nodos || !trigger || !destino) return;
    ocupado.current = true;

    // Giro horario (mínimo una vuelta) que deja el nodo elegido arriba.
    const angulo = (360 / apps.length) * indice;
    let delta = (-angulo - (rotacion.current % 360)) % 360;
    if (delta < 0) delta += 360;
    delta += 360;
    const inicio = rotacion.current;
    rotacion.current += delta;
    const proxy = { r: inicio };
    const hijos = nodos.querySelectorAll("[data-nodo]");

    gsap.to(proxy, {
      r: rotacion.current,
      duration: 0.75,
      ease: "power3.inOut",
      onUpdate: () => {
        gsap.set(nodos, { rotation: proxy.r });
        gsap.set(hijos, { rotation: -proxy.r }); // los iconos no se inclinan
      },
      onComplete: () => {
        ocupado.current = false;
        cerrar(() => {
          const r = trigger.getBoundingClientRect();
          reproducirOndaSuite({ x: r.left + r.width / 2, y: r.top + r.height / 2, color: app.accentColor, alCubrir: destino });
        });
      },
    });
  };

  useEffect(() => {
    if (!abierto) return;
    const alClic = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!overlayRef.current?.contains(t) && !triggerRef.current?.contains(t)) cerrar();
    };
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !ocupado.current) {
        cerrar();
        triggerRef.current?.focus();
      }
    };
    const alRedimensionar = () => cerrar();
    document.addEventListener("mousedown", alClic);
    document.addEventListener("keydown", alTecla);
    window.addEventListener("resize", alRedimensionar);
    return () => {
      document.removeEventListener("mousedown", alClic);
      document.removeEventListener("keydown", alTecla);
      window.removeEventListener("resize", alRedimensionar);
    };
  }, [abierto, cerrar]);

  useEffect(() => {
    const overlay = overlayRef.current;
    return () => {
      if (overlay) gsap.killTweensOf([overlay, ...overlay.querySelectorAll("[data-nodo]")]);
    };
  }, []);

  if (!appActual || apps.length < 2) return null;

  const enHub = apps.find((a) => a.id === enfocada) ?? appActual;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (abierto ? cerrar() : abrir())}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={`Apps de la suite Zarpi. Estás en ${appActual.shortName}`}
        className={clsx(
          "flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:focus-visible:ring-accent/60",
          className ?? "inline-flex",
        )}
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: appActual.accentColor }} />
        {appActual.shortName}
        <ChevronDown className={clsx("h-3.5 w-3.5 text-muted-foreground transition-transform duration-300", abierto && "rotate-180")} />
      </button>

      {createPortal(
        <div
          ref={overlayRef}
          role="menu"
          aria-label="Apps de la suite Zarpi"
          style={{ visibility: "hidden", opacity: 0 }}
          className="fixed z-[60] flex items-center justify-center overflow-hidden border border-border bg-card/90 text-foreground shadow-2xl backdrop-blur-xl"
        >
          <div className="pointer-events-none absolute inset-4 rounded-full border border-dashed border-foreground/15" />
          <div className="pointer-events-none absolute inset-14 rounded-full border border-foreground/10" />

          <div className="absolute z-10 flex h-24 w-24 flex-col items-center justify-center rounded-full border border-border bg-muted/60 p-2 text-center">
            {enHub === appActual && !enfocada ? <Layers className="mb-0.5 h-4 w-4 text-muted-foreground" /> : null}
            <span className="text-[11px] font-bold leading-tight">{enfocada ? enHub.shortName : "Suite Zarpi"}</span>
            <span className="mt-0.5 text-[9px] leading-tight text-muted-foreground">{enfocada ? enHub.badge : "Elige una app"}</span>
          </div>

          <div ref={nodosRef} className="absolute inset-0">
            {apps.map((app, i) => {
              const Icono = ICONOS[app.icon];
              const ang = ((-90 + (360 / apps.length) * i) * Math.PI) / 180;
              const esActual = app.id === actual;
              return (
                <button
                  key={app.id}
                  data-nodo
                  type="button"
                  role="menuitem"
                  aria-disabled={!app.active}
                  aria-current={esActual ? "page" : undefined}
                  aria-label={app.active ? app.name : `${app.name} (${app.badge})`}
                  title={app.active ? app.name : `${app.name} · ${app.badge}`}
                  onClick={() => elegir(app, i)}
                  onMouseEnter={() => setEnfocada(app.id)}
                  onMouseLeave={() => setEnfocada(null)}
                  onFocus={() => setEnfocada(app.id)}
                  onBlur={() => setEnfocada(null)}
                  style={{
                    width: NODO,
                    height: NODO,
                    left: `calc(50% + ${Math.cos(ang)} * var(--radio) - ${NODO / 2}px)`,
                    top: `calc(50% + ${Math.sin(ang)} * var(--radio) - ${NODO / 2}px)`,
                    borderColor: app.accentColor,
                    boxShadow: esActual ? `0 0 0 3px ${app.accentColor}55` : undefined,
                  }}
                  className={clsx(
                    "absolute flex items-center justify-center rounded-2xl border-2 bg-card transition-[box-shadow,filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50",
                    app.active ? "cursor-pointer hover:brightness-110" :                     "cursor-not-allowed grayscale",
                  )}
                >
                                      <Icono className={clsx("h-6 w-6", !app.active && "opacity-50")} />
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
