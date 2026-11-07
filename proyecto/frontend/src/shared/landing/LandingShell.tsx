import { useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { ArrowRight, Menu, Moon, Sun, X } from "lucide-react";

import { Button } from "@shared/ui/design-system";
import { SuiteWheelSwitcher } from "@shared/suite/SuiteWheelSwitcher";
import type { DestinosSuite } from "@shared/suite/destinos";
import { useBrandTheme } from "@/hooks/useBrandTheme";
import type { LegalPage } from "@shared/legal/types";

/** Botón de llamado principal: con `acento` toma el color de la app; sin él, el ácido de Zarpi. */
export function BotonAcento({ children, onClick, grande = false, acento, className }: {
  children: ReactNode; onClick: () => void; grande?: boolean; acento?: string; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={acento ? { backgroundColor: acento } : undefined}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold shadow-sm transition hover:brightness-95 active:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        acento ? "text-white focus-visible:ring-foreground/40" : "bg-accent text-black focus-visible:ring-accent/60",
        grande ? "h-11 px-6 text-sm" : "h-8 px-3 text-xs",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Eyebrow({ children, acento }: { children: ReactNode; acento?: string }) {
  return (
    <p
      style={acento ? { color: acento } : undefined}
      className={clsx("mb-3 text-xs font-semibold uppercase tracking-[0.18em]", !acento && "text-primary dark:text-accent")}
    >
      {children}
    </p>
  );
}

type Props = {
  /** id de la app en APPS_SUITE. */
  appId: string;
  nombre: string;
  destinos: DestinosSuite;
  secciones: readonly { id: string; label: string }[];
  /** Hex del acento de la app; sin él se usan los colores de marca de Zarpi. */
  acento?: string;
  autenticado: boolean;
  onIniciarSesion: () => void;
  onCrearCuenta: () => void;
  onEntrar: () => void;
  textoEntrar?: string;
  onPolicy: (page: LegalPage) => void;
  notaPie: ReactNode;
  children: ReactNode;
};

/**
 * Estructura común de las landings públicas de la suite: header con el selector
 * radial, menú de secciones, tema claro/oscuro, acceso y pie. El contenido va en `children`.
 */
export function LandingShell({
  appId, nombre, destinos, secciones, acento, autenticado, onIniciarSesion, onCrearCuenta, onEntrar,
  textoEntrar = "Entrar", onPolicy, notaPie, children,
}: Props) {
  const { dark, toggleTheme } = useBrandTheme();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const irASeccion = (id: string) => {
    setMenuAbierto(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-9xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex flex-shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label={`${nombre}: volver arriba`}
              className="flex items-center gap-2.5"
            >
              <img src={dark ? "/brand/zarpi-wordmark-acid.svg" : "/brand/zarpi-wordmark.svg"} alt="Zarpi" className="h-8 w-28 object-contain object-left" />
              <span className="border-l border-border pl-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground md:hidden">{nombre}</span>
            </button>
            <SuiteWheelSwitcher actual={appId} destinos={destinos} className="hidden md:inline-flex" />
          </div>

          <nav aria-label="Secciones" className="hidden items-center gap-1 min-[1400px]:flex">
            {secciones.map((s) => (
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
            <button
              type="button"
              onClick={toggleTheme}
              title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground dark:hover:bg-accent dark:hover:text-accent-foreground"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="hidden items-center gap-2 sm:flex">
              {autenticado ? (
                <BotonAcento acento={acento} onClick={onEntrar}>{textoEntrar} <ArrowRight className="h-3.5 w-3.5" /></BotonAcento>
              ) : (
                <>
                  <Button variant="secondary" size="sm" onClick={onIniciarSesion}>Iniciar sesión</Button>
                  <BotonAcento acento={acento} onClick={onCrearCuenta}>Crear cuenta</BotonAcento>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={menuAbierto}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-primary dark:hover:text-accent min-[1400px]:hidden"
            >
              {menuAbierto ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {menuAbierto && (
          <div className="border-t border-border/50 px-4 pb-4 pt-2 backdrop-blur-md min-[1400px]:hidden">
            <SuiteWheelSwitcher actual={appId} destinos={destinos} className="mb-2 mt-1 inline-flex md:hidden" />
            <nav aria-label="Secciones" className="flex flex-col">
              {secciones.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => irASeccion(s.id)}
                  className="rounded-lg px-2 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary dark:hover:bg-accent/10 dark:hover:text-accent"
                >
                  {s.label}
                </button>
              ))}
            </nav>
            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:hidden">
              {autenticado ? (
                <BotonAcento grande acento={acento} onClick={onEntrar}>{textoEntrar}</BotonAcento>
              ) : (
                <>
                  <Button variant="secondary" size="lg" fullWidth onClick={onIniciarSesion}>Iniciar sesión</Button>
                  <BotonAcento grande acento={acento} onClick={onCrearCuenta}>Crear cuenta</BotonAcento>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main>{children}</main>

      <footer className="border-t border-border px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-4 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span>© 2026 Zarpi</span>
            <button type="button" onClick={() => onPolicy("data")} className="transition-colors hover:text-foreground">Tratamiento de Datos</button>
            <button type="button" onClick={() => onPolicy("terms")} className="transition-colors hover:text-foreground">Términos</button>
          </div>
          <p className="max-w-md leading-relaxed md:text-right">{notaPie}</p>
        </div>
      </footer>
    </div>
  );
}
