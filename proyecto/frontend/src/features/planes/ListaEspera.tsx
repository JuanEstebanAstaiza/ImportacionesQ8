import { useState, type FormEvent } from "react";
import { BellRing, CheckCircle2, ChevronLeft, Loader2, Moon, Sun } from "lucide-react";

import { useBrandTheme } from "@/app/hooks/useBrandTheme";
import { PublicSicLogo } from "@/app/components/navigation/PublicSicLogo";
import { planesService } from "@/services/planes.service";

/**
 * Lista cerrada: hasta que los VIP prueben la plataforma no se abre al público.
 * El aviso va arriba de la sección Planes, en /registro y donde un comprador
 * sin plan intenta publicar. La lista de espera (`/lista-espera`) pide nombre,
 * WhatsApp, correo y qué le gustaría importar, y cae en
 * Admin › Planes › Lista de espera, con fecha.
 */

export const TEXTO_LISTA_CERRADA =
  "Acceso por lista cerrada. Por ahora solo publican solicitudes quienes entran con el plan de lanzamiento. Apertura al público: próximamente.";

const CAMPO = "mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground focus:border-primary focus:outline-none dark:bg-card dark:focus:border-accent";

export function AvisoListaCerrada({ onListaEspera, className = "" }: { onListaEspera: () => void; className?: string }) {
  return (
    <div className={`mx-auto max-w-2xl text-center ${className}`}>
      <p className="text-sm leading-relaxed text-muted-foreground">{TEXTO_LISTA_CERRADA}</p>
      <button
        type="button"
        onClick={onListaEspera}
        className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-primary px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white dark:border-accent dark:text-accent dark:hover:bg-accent dark:hover:text-accent-foreground"
      >
        <BellRing className="h-4 w-4" /> Avísame cuando abra
      </button>
    </div>
  );
}

/**
 * Formulario corto de la lista de espera. Sin `plan`, es la de la apertura al
 * público; con `plan`, la de un plan que se quedó sin cupos.
 */
export function FormularioListaEspera({ plan, onPoliticaDatos, prefill }: {
  plan?: { clave: string; nombre: string };
  onPoliticaDatos: () => void;
  prefill?: { nombre?: string; email?: string; telefono?: string };
}) {
  const [nombre, setNombre] = useState(prefill?.nombre ?? "");
  const [indicativo, setIndicativo] = useState("+57");
  const [telefono, setTelefono] = useState(prefill?.telefono ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [queImportar, setQueImportar] = useState("");
  const [aceptoDatos, setAceptoDatos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (nombre.trim().length < 2) { setError("Escribe tu nombre."); return; }
    if (telefono.trim().length < 7) { setError("Escribe tu número de WhatsApp."); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError("Escribe un correo válido."); return; }
    if (queImportar.trim().length < 3) { setError("Cuéntanos qué te gustaría importar."); return; }
    if (!aceptoDatos) { setError("Para continuar, autoriza el tratamiento de tus datos."); return; }
    setEnviando(true);
    try {
      await planesService.anotarListaEspera({
        nombre: nombre.trim(),
        email: email.trim(),
        indicativo_pais_telefono: indicativo.trim() || "+57",
        telefono: telefono.trim(),
        que_importar: queImportar.trim(),
        acepto_datos: aceptoDatos,
        ...(plan ? { plan: plan.clave } : {}),
      });
      setListo(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "No se pudo enviar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  if (listo) {
    return (
      <div className="py-4 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-primary dark:text-accent" />
        <p className="font-semibold">Quedaste en la lista de espera</p>
        <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
          {plan
            ? `Te escribimos a ${email.trim()} apenas se abra un cupo en ${plan.nombre}.`
            : `Te escribimos a ${email.trim()} apenas abramos al público.`}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void enviar(e)} noValidate className="space-y-4 text-left">
      <label className="block text-sm font-medium">Nombre
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" maxLength={120} className={CAMPO} />
      </label>
      <label className="block text-sm font-medium">WhatsApp
        <div className="flex gap-2">
          <input value={indicativo} onChange={(e) => setIndicativo(e.target.value)} aria-label="Indicativo" maxLength={5} className={`${CAMPO} w-20`} />
          <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel-national" maxLength={30} className={CAMPO} />
        </div>
      </label>
      <label className="block text-sm font-medium">Correo
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={CAMPO} />
      </label>
      <label className="block text-sm font-medium">¿Qué te gustaría importar?
        <textarea value={queImportar} onChange={(e) => setQueImportar(e.target.value)} rows={4} maxLength={2000}
          placeholder="Por ejemplo: termos de acero para mi tienda, unas 500 unidades."
          className={`${CAMPO} h-auto py-2`} />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={aceptoDatos} onChange={(e) => setAceptoDatos(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
        <span>Autorizo el tratamiento de mis datos personales según la <button type="button" onClick={onPoliticaDatos} className="font-medium text-primary underline-offset-2 hover:underline dark:text-accent">Política de Tratamiento de Datos</button>.</span>
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={enviando}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 dark:bg-accent dark:text-accent-foreground">
        {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
        Entrar a la lista de espera
      </button>
    </form>
  );
}

/** `/lista-espera`: a donde lleva «Avísame cuando abra». Pública. */
export function PantallaListaEspera({ onVolver, onPoliticaDatos }: { onVolver: () => void; onPoliticaDatos: () => void }) {
  const { dark, toggleTheme } = useBrandTheme();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-6 py-3.5 dark:bg-card">
        <button type="button" onClick={onVolver} aria-label="Ir al inicio">
          <img src={dark ? "/brand/zarpi-wordmark-acid.svg" : "/brand/zarpi-wordmark.svg"} alt="Zarpi" className="h-8 w-28 object-contain object-left" />
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleTheme} aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button type="button" onClick={onVolver} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" /> Volver
          </button>
        </div>
      </header>
      <main className="flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary dark:text-accent">Lista de espera</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Te avisamos cuando abra</h1>
          <p className="mt-2 mb-6 text-sm leading-relaxed text-muted-foreground">{TEXTO_LISTA_CERRADA}</p>
          <FormularioListaEspera onPoliticaDatos={onPoliticaDatos} />
        </div>
      </main>
      <footer className="flex justify-center border-t border-border bg-background py-4">
        <PublicSicLogo />
      </footer>
    </div>
  );
}
