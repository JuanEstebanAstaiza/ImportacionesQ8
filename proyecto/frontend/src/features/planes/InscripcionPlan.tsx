import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, CheckCircle2, FileUp, Loader2 } from "lucide-react";

import { PublicSicLogo } from "@/app/components/navigation/PublicSicLogo";
import { EncabezadoPlanes, FormularioListaEspera } from "@/features/planes/ListaEspera";
import { ApiError } from "@/services/api-client";
import { planesService, pesos, type DatosInscripcion, type Plan } from "@/services/planes.service";

/**
 * Inscripción a un plan (`/planes/inscripcion?plan=importador`). Pública: la
 * persona todavía no tiene cuenta. Deja sus datos, acepta las condiciones y
 * sube el comprobante de la transferencia; el equipo lo verifica en
 * Admin › Planes y, al activarlo, le llega el acceso por correo. Sin cupos, se
 * muestra el formulario de la lista de espera (ListaEspera.tsx).
 */

const TIPOS_DOCUMENTO = ["CC", "CE", "Pasaporte", "PPT", "DNI"];
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";
const MAX_BYTES = 10 * 1024 * 1024;
const CAMPO = "mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground focus:border-primary focus:outline-none dark:bg-card dark:focus:border-accent";

export interface PrefillInscripcion {
  email?: string;
  nombre?: string;
  apellido?: string;
  telefono?: string;
}

function claveDeLaUrl(): string {
  return new URLSearchParams(window.location.search).get("plan") ?? "";
}

export function InscripcionPlan({ claveInicial, onVolver, onVerPlanes, onCondiciones, onPoliticaDatos, prefill }: {
  /** El plan elegido en el inicio; si no viene, el de la URL (?plan=). */
  claveInicial?: string;
  onVolver: () => void;
  onVerPlanes: () => void;
  onCondiciones: () => void;
  onPoliticaDatos: () => void;
  prefill?: PrefillInscripcion;
}) {
  const [planes, setPlanes] = useState<Plan[] | null>(null);
  const [datosPago, setDatosPago] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [clave, setClave] = useState(() => claveInicial || claveDeLaUrl());

  const [tipoPersona, setTipoPersona] = useState<"natural" | "juridica">("natural");
  const [nombre, setNombre] = useState(prefill?.nombre ?? "");
  const [apellido, setApellido] = useState(prefill?.apellido ?? "");
  const [tipoDocumento, setTipoDocumento] = useState("CC");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [nit, setNit] = useState("");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [indicativo, setIndicativo] = useState("+57");
  const [telefono, setTelefono] = useState(prefill?.telefono ?? "");
  const [ciudad, setCiudad] = useState("");
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [aceptoCondiciones, setAceptoCondiciones] = useState(false);
  const [aceptoDatos, setAceptoDatos] = useState(false);
  const [forzarEspera, setForzarEspera] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);

  useEffect(() => {
    planesService.listar()
      .then((r) => { setPlanes(r.planes); setDatosPago(r.datos_pago); })
      .catch(() => setErrorCarga(true));
  }, []);

  const plan = useMemo(() => planes?.find((p) => p.clave === clave) ?? null, [planes, clave]);
  const enEspera = forzarEspera || (plan !== null && plan.cupos_restantes !== null && plan.cupos_restantes < 1);

  const elegir = (nueva: string) => {
    setClave(nueva);
    setForzarEspera(false);
    setError("");
    const url = new URL(window.location.href);
    url.searchParams.set("plan", nueva);
    window.history.replaceState(window.history.state, "", url);
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!plan) return;
    setError("");
    if (!email.trim() || telefono.trim().length < 7) { setError("Escribe tu correo y un teléfono de contacto."); return; }
    if (tipoPersona === "natural" && (!nombre.trim() || !apellido.trim() || !numeroDocumento.trim())) {
      setError("Escribe tu nombre, tu apellido y tu número de documento."); return;
    }
    if (tipoPersona === "juridica" && (!razonSocial.trim() || !nit.trim())) {
      setError("Escribe la razón social y el NIT de la empresa."); return;
    }
    if (!comprobante) { setError("Adjunta el comprobante de la transferencia."); return; }
    if (comprobante && comprobante.size > MAX_BYTES) { setError("El comprobante supera los 10 MB."); return; }
    if (!aceptoCondiciones || !aceptoDatos) { setError("Para continuar, acepta las condiciones y la autorización de datos."); return; }

    const datos: DatosInscripcion = {
      email: email.trim(),
      tipo_persona: tipoPersona,
      indicativo_pais_telefono: indicativo.trim() || "+57",
      telefono: telefono.trim(),
      ciudad: ciudad.trim() || undefined,
      acepto_condiciones: aceptoCondiciones,
      acepto_datos: aceptoDatos,
      ...(tipoPersona === "natural"
        ? { nombre: nombre.trim(), apellido: apellido.trim(), tipo_documento: tipoDocumento, numero_documento: numeroDocumento.trim() }
        : { razon_social: razonSocial.trim(), nit: nit.trim() }),
    };
    setEnviando(true);
    try {
      await planesService.inscribir(plan.clave, datos, comprobante);
      setListo(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      const detalle = err instanceof ApiError ? err.detail : null;
      if (detalle && typeof detalle === "object" && (detalle as { codigo?: string }).codigo === "sin_cupos") {
        setForzarEspera(true);
        setError((detalle as { mensaje?: string }).mensaje ?? "Se acabaron los cupos de este plan.");
      } else {
        setError(err instanceof Error && err.message ? err.message : "No se pudo enviar. Intenta de nuevo.");
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <EncabezadoPlanes onVolver={onVolver} />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        {listo ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-primary dark:text-accent" />
            <h1 className="text-xl font-bold">Recibimos tu inscripción</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Verificamos tu pago y activamos tu plan en máximo 2 horas en horario hábil. Te escribimos a {email.trim()} con
              el acceso a tu cuenta.
            </p>
            <button type="button" onClick={onVolver} className="mt-6 h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-white dark:bg-accent dark:text-accent-foreground">
              Volver al inicio
            </button>
          </div>
        ) : planes === null && !errorCarga ? (
          <div className="flex justify-center py-20 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !plan ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
            <h1 className="text-xl font-bold">Elige un plan</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {errorCarga ? "No pudimos cargar los planes. Intenta de nuevo en un momento." : "Ese plan no existe o ya no está disponible."}
            </p>
            {(planes ?? []).length > 0 && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {(planes ?? []).map((p) => (
                  <button key={p.id} type="button" onClick={() => elegir(p.clave)} className="h-9 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">
                    {p.nombre}
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={onVerPlanes} className="mt-4 text-sm font-medium text-primary hover:underline dark:text-accent">Ver los planes</button>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            {enEspera ? (
              <div className="order-2 lg:order-1">
                <FormularioListaEspera
                  plan={plan}
                  aviso={error}
                  prefill={prefill ? { ...prefill, nombre: [prefill.nombre, prefill.apellido].filter(Boolean).join(" ") || undefined } : undefined}
                  onPoliticaDatos={onPoliticaDatos}
                  onVolver={onVolver}
                  encabezado={
                    <>
                      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{plan.nombre}</h1>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Este plan no tiene cupos en este momento. Déjanos tus datos y te escribimos apenas se abra uno; no tienes que pagar nada todavía.
                      </p>
                    </>
                  }
                />
              </div>
            ) : (
            <form onSubmit={(e) => void enviar(e)} noValidate className="order-2 space-y-6 lg:order-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary dark:text-accent">Inscripción</p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{plan.nombre}</h1>
              </div>

              <fieldset className="space-y-4 rounded-2xl border border-border bg-card p-5">
                <legend className="px-1 text-sm font-semibold">Tus datos</legend>
                <div className="flex gap-2">
                  {(["natural", "juridica"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setTipoPersona(t)} aria-pressed={tipoPersona === t}
                      className={`h-9 flex-1 rounded-lg border text-sm font-medium transition-colors ${
                        tipoPersona === t
                          ? "border-primary bg-primary text-white dark:border-accent dark:bg-accent dark:text-accent-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"}`}>
                      {t === "natural" ? "Persona natural" : "Empresa"}
                    </button>
                  ))}
                </div>
                {tipoPersona === "natural" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium">Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="given-name" maxLength={120} className={CAMPO} /></label>
                    <label className="text-sm font-medium">Apellido<input value={apellido} onChange={(e) => setApellido(e.target.value)} autoComplete="family-name" maxLength={120} className={CAMPO} /></label>
                    <label className="text-sm font-medium">Tipo de documento
                      <select value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)} className={CAMPO}>
                        {TIPOS_DOCUMENTO.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                    <label className="text-sm font-medium">Número de documento<input value={numeroDocumento} onChange={(e) => setNumeroDocumento(e.target.value)} maxLength={50} className={CAMPO} /></label>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium">Razón social<input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} autoComplete="organization" maxLength={255} className={CAMPO} /></label>
                    <label className="text-sm font-medium">NIT<input value={nit} onChange={(e) => setNit(e.target.value)} maxLength={50} className={CAMPO} /></label>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium sm:col-span-2">Correo
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={CAMPO} />
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">Será tu usuario en Zarpi y ahí te llega el acceso.</span>
                  </label>
                  <label className="text-sm font-medium">Teléfono o WhatsApp
                    <div className="flex gap-2">
                      <input value={indicativo} onChange={(e) => setIndicativo(e.target.value)} aria-label="Indicativo" maxLength={5} className={`${CAMPO} w-20`} />
                      <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel-national" maxLength={30} className={CAMPO} />
                    </div>
                  </label>
                  <label className="text-sm font-medium">Ciudad (opcional)<input value={ciudad} onChange={(e) => setCiudad(e.target.value)} autoComplete="address-level2" maxLength={100} className={CAMPO} /></label>
                </div>
              </fieldset>

              <fieldset className="space-y-3 rounded-2xl border border-border bg-card p-5">
                <legend className="px-1 text-sm font-semibold">Pago por transferencia</legend>
                <p className="text-sm text-muted-foreground">
                  Transfiere <strong className="text-foreground">{pesos(plan.total_cop)}</strong> (IVA incluido) y adjunta el comprobante.
                </p>
                {datosPago ? (
                  <pre className="whitespace-pre-wrap rounded-lg bg-muted px-4 py-3 font-sans text-sm">{datosPago}</pre>
                ) : (
                  <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                    Escríbenos desde Contacto y te enviamos los datos de la cuenta.
                  </p>
                )}
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-sm hover:bg-muted/50">
                  <FileUp className="h-5 w-5 flex-shrink-0 text-primary dark:text-accent" />
                  <span className="min-w-0 flex-1 truncate">{comprobante ? comprobante.name : "Adjuntar comprobante (PDF o imagen, máximo 10 MB)"}</span>
                  <input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => setComprobante(e.target.files?.[0] ?? null)} />
                </label>
              </fieldset>

              <div className="space-y-3 text-sm">
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={aceptoCondiciones} onChange={(e) => setAceptoCondiciones(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                  <span>Acepto las <button type="button" onClick={onCondiciones} className="font-medium text-primary underline-offset-2 hover:underline dark:text-accent">condiciones de los planes</button>.</span>
                </label>
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={aceptoDatos} onChange={(e) => setAceptoDatos(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                  <span>Autorizo el tratamiento de mis datos personales según la <button type="button" onClick={onPoliticaDatos} className="font-medium text-primary underline-offset-2 hover:underline dark:text-accent">Política de Tratamiento de Datos</button>.</span>
                </label>
              </div>

              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <button type="submit" disabled={enviando}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 dark:bg-accent dark:text-accent-foreground sm:w-auto sm:px-8">
                {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
                Enviar inscripción
              </button>
            </form>
            )}

            <aside className="order-1 lg:order-2">
              <div className="rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-20">
                <p className="text-sm font-semibold">{plan.nombre}</p>
                {plan.para_quien && <p className="text-xs text-muted-foreground">{plan.para_quien}</p>}
                <p className="mt-3 text-2xl font-bold">{pesos(plan.precio_cop)}{plan.iva_pct > 0 && <span className="ml-1 text-sm font-semibold text-muted-foreground">+ IVA</span>}</p>
                {plan.iva_pct > 0 && <p className="text-xs text-muted-foreground">{pesos(plan.total_cop)} con IVA</p>}
                <ul className="mt-4 space-y-2 text-sm">
                  {plan.incluye.map((item) => (
                    <li key={item} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary dark:text-accent" />{item}</li>
                  ))}
                </ul>
                {(planes ?? []).length > 1 && (
                  <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                    Cambiar a:{" "}
                    {(planes ?? []).filter((p) => p.clave !== plan.clave).map((p, i) => (
                      <span key={p.id}>{i > 0 && " · "}<button type="button" onClick={() => elegir(p.clave)} className="font-medium text-primary hover:underline dark:text-accent">{p.nombre}</button></span>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </main>
      <footer className="flex justify-center border-t border-border bg-background py-4">
        <PublicSicLogo />
      </footer>
    </div>
  );
}
