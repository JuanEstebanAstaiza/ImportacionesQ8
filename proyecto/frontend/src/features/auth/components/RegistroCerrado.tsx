import { Lock, Moon, Sun, ChevronLeft, BellRing } from "lucide-react";

import { Button, Logo } from "@/components/design-system";
import { PublicSicLogo } from "@/components/navigation/PublicSicLogo";
import type { LegalPage } from "@/features/legal/types";
import { LISTA_CERRADA } from "@/features/planes/SeccionPlanes";
import { useBrandTheme } from "@/app/hooks/useBrandTheme";

export function RegistroCerrado({onLogin,onLanding,onListaEspera,onPolicy}:{onLogin:()=>void;onLanding:()=>void;onListaEspera:()=>void;onPolicy:(page:LegalPage)=>void}) {
  const { dark, toggleTheme } = useBrandTheme();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-background px-6 py-3.5 relative z-10">
        <button type="button" onClick={onLanding} aria-label="Ir al inicio">
          <Logo/>
        </button>
        <div className="flex items-center gap-1.5 w-fit">
          <button
            type="button"
            onClick={toggleTheme}
            title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-primary hover:text-primary-foreground dark:hover:bg-accent dark:hover:text-accent-foreground transition-colors"
          >
            {dark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
          </button>
          <Button variant="ghost" size="sm" icon={<ChevronLeft className="w-3.5 h-3.5"/>} onClick={onLanding}>Volver</Button>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-10 overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img
            src={dark ? "/brand/fondo-1.png" : "/brand/fondo-4.png"}
            alt="Fondo de solicitud de acceso"
            className="auth-background w-full h-full object-cover object-center transition-all duration-300"
          />
        </div>

        <div className="relative z-10 w-full max-w-[480px]">
          <div className="bg-white rounded-2xl border border-border shadow-sm p-6 sm:p-8">
            <div className="text-center">
              <Lock className="w-10 h-10 text-primary dark:text-accent mx-auto mb-4"/>
              <h1 className="text-xl font-semibold tracking-tight mb-2">{LISTA_CERRADA.titulo.replace(/\.$/, "")}</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">{LISTA_CERRADA.texto}</p>
              <Button variant="primary" icon={<BellRing className="w-4 h-4"/>} className="mt-5 dark:bg-accent dark:text-accent-foreground" onClick={onListaEspera}>Avísame cuando abra</Button>
            </div>
            <div className="mt-6 flex flex-col items-center gap-3 border-t border-border pt-6">
              <Button variant="secondary" fullWidth onClick={onLogin}>Ya tengo cuenta: iniciar sesión</Button>
              <button type="button" onClick={onLanding} className="text-xs text-muted-foreground hover:text-foreground">Volver al inicio</button>
            </div>
          </div>
        </div>
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-4 border-t border-border bg-background py-4 text-center text-xs text-muted-foreground relative z-10">
        <span>? 2026 Zarpi</span>
        <button onClick={() => onPolicy("data")} className="transition-colors hover:text-foreground">
          Tratamiento de Datos
        </button>
        <button onClick={() => onPolicy("terms")} className="transition-colors hover:text-foreground">
          Términos
        </button>
        <button onClick={() => onPolicy("payments")} className="transition-colors hover:text-foreground">
          Pagos y Reembolsos
        </button>
        <PublicSicLogo />
      </footer>
    </div>
  );
}
