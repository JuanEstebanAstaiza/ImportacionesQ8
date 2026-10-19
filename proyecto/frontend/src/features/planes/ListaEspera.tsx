import { useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, ChevronLeft, Loader2, Moon, Sun } from "lucide-react";

import { PublicSicLogo } from "@/components/navigation/PublicSicLogo";
import { useBrandTheme } from "@/app/hooks/useBrandTheme";
import { CATEGORIAS_PRODUCTO } from "@/utils/categorias";
import { planesService, type DatosListaEspera, type Plan } from "@/services/planes.service";

/**
 * Lista de espera. Pide nombre, WhatsApp, correo, sector y «¿qué te gustaría
 * importar?», y llega a Admin › Planes › Lista de espera con la fecha.
 *
 * - Sin plan: la de la apertura al público (`/lista-espera`, el botón
 *   «Avísame cuando abra» de la sección Planes).
 * - Con plan: la de un plan que se quedó sin cupos (desde la inscripción).
 */

const CAMPO = "mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground focus:border-primary focus:outline-none dark:bg-card dark:focus:border-accent";

export interface PrefillListaEspera {
  email?: string;
  nombre?: string;
  telefono?: string;
}

const OTRO_SECTOR = "Otro";

/**
 * Sector: qué le interesa traer. Las mismas categorías de las importadoras
 * (`lib/categorias.ts`), para cruzarlas después, y «Otro» con texto libre.
 */
export function CampoSector({ valor, onChange, className = "" }: {
  valor: string;
  onChange: (valor: string) => void;
  className?: string;
}) {
  const [otro, setOtro] = useState(() => valor !== "" && !(CATEGORIAS_PRODUCTO as readonly string[]).includes(valor));
  return (
    <div className={className}>
      <label className="block text-sm font-medium">Sector
        <select value={otro ? OTRO_SECTOR : valor} className={CAMPO}
          onChange={(e) => {
            const elegido = e.target.value;
            setOtro(elegido === OTRO_SECTOR);
            onChange(elegido === OTRO_SECTOR ? "" : elegido);
          }}>
          <option value="" disabled>Elige el sector</option>
          {CATEGORIAS_PRODUCTO.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value={OTRO_SECTOR}>Otro</option>
        </select>
      </label>
      {otro && (
        <input value={valor} onChange={(e) => onChange(e.target.value)} maxLength={80} autoFocus
          aria-label="¿Cuál sector?" placeholder="¿Cuál?" className={CAMPO} />
      )}
      <span className="mt-1 block text-xs text-muted-foreground">Lo que te interesa traer: textiles, tecnología, televenta…</span>
    </div>
  );
}

/** Encabezado de las páginas públicas de planes: logo, tema y «Volver». */
export function EncabezadoPlanes({ onVolver }: { onVolver: () => void }) {
  const { dark, toggleTheme } = useBrandTheme();
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-6 py-3.5 dark:bg-card">
      <img src={dark ? "/brand/zarpi-wordmark-acid.svg" : "/brand/zarpi-wordmark.svg"} alt="Zarpi" className="h-8 w-28 object-contain object-left" />
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
  );
}

export function FormularioListaEspera({ plan, prefill, aviso, encabezado, onPoliticaDatos, onVolver }: {
  /** El plan sin cupos; sin plan, es la lista de la apertura al público. */
  plan?: Plan | null;
  prefill?: PrefillListaEspera;
  /** Mensaje que trae quien llegó aquí al quedarse sin cupo. */
  aviso?: string;
  /** Título y explicación que van sobre el formulario. */
  encabezado: ReactNode;
  onPoliticaDatos: () => void;
  onVolver: () => void;
}) {
  const [nombre, setNombre] = useState(prefill?.nombre ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [indicativo, setIndicativo] = useState("+57");
  const [telefono, setTelefono] = useState(prefill?.telefono ?? "");
  const [sector, setSector] = useState("");
  const [interes, setInteres] = useState("");
  const [aceptoDatos, setAceptoDatos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(aviso ?? "");
  const [listo, setListo] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (nombre.trim().length < 2) { setError("Escribe tu nombre."); return; }
    if (telefono.trim().length < 7) { setError("Escribe tu número de WhatsApp."); return; }
    if (!email.trim()) { setError("Escribe tu correo."); return; }
    if (sector.trim().length < 2) { setError("Elige tu sector."); return; }
    if (interes.trim().length < 3) { setError("Cuéntanos qué te gustaría importar."); return; }
    if (!aceptoDatos) { setError("Para continuar, autoriza el tratamiento de tus datos."); return; }

    const datos: DatosListaEspera = {
      nombre: nombre.trim(),
      email: email.trim(),
      indicativo_pais_telefono: indicativo.trim() || "+57",
      telefono: telefono.trim(),
      sector: sector.trim(),
      interes: interes.trim(),
      acepto_datos: aceptoDatos,
    };
    setEnviando(true);
    try {
      if (plan) await planesService.listaEspera(plan.clave, datos);
      else await planesService.listaEsperaApertura(datos);
      setListo(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "No se pudo enviar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  if (listo) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-primary dark:text-accent" />
        <h1 className="text-xl font-bold">Quedaste en la lista de espera</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {plan
            ? `Te escribimos a ${email.trim()} apenas se abra un cupo en ${plan.nombre}.`
            : `Te escribimos a ${email.trim()} apenas Zarpi abra al público.`}
        </p>
        <button type="button" onClick={onVolver} className="mt-6 h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-white dark:bg-accent dark:text-accent-foreground">
          Volver al inicio
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void enviar(e)} noValidate className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary dark:text-accent">Lista de espera</p>
        {encabezado}
      </div>

      <fieldset className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <legend className="px-1 text-sm font-semibold">Tus datos</legend>
        <label className="block text-sm font-medium">Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" maxLength={120} className={CAMPO} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">WhatsApp
            <div className="flex gap-2">
              <input value={indicativo} onChange={(e) => setIndicativo(e.target.value)} aria-label="Indicativo" maxLength={5} className={`${CAMPO} w-20`} />
              <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel-national" maxLength={30} className={CAMPO} />
            </div>
          </label>
          <label className="text-sm font-medium">Correo
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={CAMPO} />
          </label>
        </div>
        <CampoSector valor={sector} onChange={setSector} />
        <label className="block text-sm font-medium">¿Qué te gustaría importar?
          <textarea value={interes} onChange={(e) => setInteres(e.target.value)} maxLength={500} rows={3}
            placeholder="Ej. termos de acero para regalos corporativos, unas 500 unidades"
            className={`${CAMPO} h-auto resize-y py-2`} />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">Con tus palabras: el producto y, si lo sabes, cuánto.</span>
        </label>
      </fieldset>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={aceptoDatos} onChange={(e) => setAceptoDatos(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
        <span>Autorizo el tratamiento de mis datos personales según la <button type="button" onClick={onPoliticaDatos} className="font-medium text-primary underline-offset-2 hover:underline dark:text-accent">Política de Tratamiento de Datos</button>.</span>
      </label>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={enviando}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 dark:bg-accent dark:text-accent-foreground sm:w-auto sm:px-8">
        {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
        Entrar a la lista de espera
      </button>
    </form>
  );
}

/** `/lista-espera`: «Avísame cuando abra». Pública, como la inscripción. */
export function ListaEsperaApertura({ prefill, onVolver, onPoliticaDatos }: {
  prefill?: PrefillListaEspera;
  onVolver: () => void;
  onPoliticaDatos: () => void;
}) {
  return (
    <div className="min-h-screen bg-background">
      <EncabezadoPlanes onVolver={onVolver} />
      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-14">
        <FormularioListaEspera
          prefill={prefill}
          onPoliticaDatos={onPoliticaDatos}
          onVolver={onVolver}
          encabezado={
            <>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Te avisamos cuando abra</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Por ahora el acceso es por lista cerrada: solo publican solicitudes quienes entran con el plan de
                lanzamiento. Déjanos tus datos y te escribimos apenas abramos al público. No tienes que pagar nada.
              </p>
            </>
          }
        />
      </main>
      <footer className="flex justify-center border-t border-border bg-background py-4">
        <PublicSicLogo />
      </footer>
    </div>
  );
}
