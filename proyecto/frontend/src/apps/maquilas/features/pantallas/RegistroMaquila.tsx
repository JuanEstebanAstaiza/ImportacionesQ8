import { useState } from "react";
import { ArrowLeft, Building2, Check, CheckCircle2, Factory, Loader2, Moon, Sun, UserRound } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

import { Button, Card, Input, Logo, Select } from "@shared/ui/design-system";
import type { LegalPage } from "@shared/legal/types";
import { useBrandTheme } from "@/hooks/useBrandTheme";
import { authService } from "@/services/auth.service";
import { maquilasService } from "@/services/maquilas.service";
import { mensajeDeError } from "@apps/maquilas/features/errores";
import { useParametrosMaquilas } from "@apps/maquilas/features/useMaquilas";
import type { RegistroMaquilaEntrada, TipoDocumento } from "@apps/maquilas/features/tipos";

const PASOS = [
  { titulo: "Empresa", Icono: Building2 },
  { titulo: "Representante", Icono: UserRound },
  { titulo: "Qué fabricas", Icono: Factory },
] as const;

const INDICATIVOS = ["+57", "+1", "+52", "+34", "+51", "+56", "+54", "+55", "+593", "+58"];
const DOCUMENTOS: TipoDocumento[] = ["CC", "CE", "PPT", "Pasaporte", "NIT", "DNI"];

type Formulario = {
  razon_social: string; nombre_comercial: string; nit: string; ciudad: string; direccion: string; telefono_empresa: string; sitio_web: string;
  nombre: string; apellido: string; tipo_documento: TipoDocumento; numero_documento: string; indicativo: string; telefono: string;
  email: string; password: string; confirmar: string;
  categorias: string[]; procesos: string[]; pedido_minimo: string; capacidad_mensual: string; dias_muestra: string; dias_produccion: string;
  acepto: boolean;
};

const VACIO: Formulario = {
  razon_social: "", nombre_comercial: "", nit: "", ciudad: "", direccion: "", telefono_empresa: "", sitio_web: "",
  nombre: "", apellido: "", tipo_documento: "CC", numero_documento: "", indicativo: "+57", telefono: "",
  email: "", password: "", confirmar: "",
  categorias: [], procesos: [], pedido_minimo: "", capacidad_mensual: "", dias_muestra: "", dias_produccion: "",
  acepto: false,
};

const entero = (valor: string) => (valor.trim() ? Number.parseInt(valor, 10) : null);

/** Errores del paso, con los mismos criterios que valida el backend. */
function erroresDelPaso(paso: number, f: Formulario): Partial<Record<keyof Formulario, string>> {
  const e: Partial<Record<keyof Formulario, string>> = {};
  if (paso === 0) {
    if (f.razon_social.trim().length < 2) e.razon_social = "Escribe la razón social";
    if (f.nombre_comercial.trim().length < 2) e.nombre_comercial = "Escribe el nombre comercial";
    if (f.nit.replace(/\D/g, "").length < 5) e.nit = "Escribe el NIT con sus dígitos";
    if (f.ciudad.trim().length < 2) e.ciudad = "¿En qué ciudad está la planta o el taller?";
  }
  if (paso === 1) {
    if (f.nombre.trim().length < 2) e.nombre = "Escribe el nombre";
    if (f.apellido.trim().length < 2) e.apellido = "Escribe el apellido";
    if (f.numero_documento.trim().length < 4) e.numero_documento = "Escribe el número de documento";
    if (f.telefono.replace(/\D/g, "").length < 6) e.telefono = "Escribe un teléfono válido";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Escribe un correo válido";
    if (f.password.length < 9 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) {
      e.password = "Mínimo 9 caracteres, con al menos una letra y un número";
    }
    if (f.confirmar !== f.password) e.confirmar = "Las contraseñas no coinciden";
  }
  if (paso === 2) {
    if (!f.categorias.length) e.categorias = "Elige al menos una categoría";
    if (!f.procesos.length) e.procesos = "Elige al menos un proceso";
    const minimo = entero(f.pedido_minimo);
    if (!minimo || minimo < 1) e.pedido_minimo = "¿Cuántas unidades produces como mínimo por pedido?";
    if (!f.acepto) e.acepto = "Debes aceptar la política de tratamiento de datos";
  }
  return e;
}

function Chips({ opciones, elegidas, onCambiar }: { opciones: { valor: string; etiqueta: string }[]; elegidas: string[]; onCambiar: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map(({ valor, etiqueta }) => {
        const activa = elegidas.includes(valor);
        return (
          <button
            key={valor}
            type="button"
            aria-pressed={activa}
            onClick={() => onCambiar(activa ? elegidas.filter((x) => x !== valor) : [...elegidas, valor])}
            className={clsx(
              "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              activa ? "border-primary bg-primary/10 text-primary dark:border-accent dark:bg-accent/15 dark:text-accent"
                : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
            )}
          >
            {activa && <Check className="h-3 w-3" aria-hidden="true" />}
            {etiqueta}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Registro público de una maquiladora: empresa, representante y qué fabrica.
 * Pide los mismos datos legales que a cualquier empresa de la plataforma; al
 * terminar confirma el correo con el código, como cualquier cuenta de Zarpi.
 */
export function RegistroMaquila({ onVolver, onLogin, onRegistrada, onPolicy }: {
  onVolver: () => void;
  onLogin: () => void;
  /** Cuenta creada y correo confirmado: lleva al login con el correo puesto. */
  onRegistrada: (email: string) => void;
  onPolicy: (page: LegalPage) => void;
}) {
  const { dark, toggleTheme } = useBrandTheme();
  const { data: parametros, isLoading: cargandoParametros } = useParametrosMaquilas();
  const [paso, setPaso] = useState(0);
  const [f, setF] = useState<Formulario>(VACIO);
  const [errores, setErrores] = useState<Partial<Record<keyof Formulario, string>>>({});
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");
  // Tras crear la cuenta: verificación del correo.
  const [registrado, setRegistrado] = useState<{ email: string; correoEnviado: boolean } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState("");

  const poner = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => {
    setF((actual) => ({ ...actual, [campo]: valor }));
    setErrores((actual) => ({ ...actual, [campo]: undefined }));
  };

  function siguiente() {
    const e = erroresDelPaso(paso, f);
    setErrores(e);
    if (Object.keys(e).length) return;
    if (paso < PASOS.length - 1) setPaso(paso + 1);
    else void enviar();
  }

  async function enviar() {
    const datos: RegistroMaquilaEntrada = {
      empresa: {
        razon_social: f.razon_social.trim(), nombre_comercial: f.nombre_comercial.trim(), nit: f.nit.trim(), ciudad: f.ciudad.trim(),
        direccion: f.direccion.trim() || undefined, telefono: f.telefono_empresa.trim() || undefined, sitio_web: f.sitio_web.trim() || undefined,
      },
      representante: {
        nombre: f.nombre.trim(), apellido: f.apellido.trim(), tipo_documento: f.tipo_documento, numero_documento: f.numero_documento.trim(),
        indicativo_pais_telefono: f.indicativo, telefono: f.telefono.trim(), email: f.email.trim(), password: f.password,
      },
      fabricacion: {
        categorias: f.categorias, procesos: f.procesos, pedido_minimo: entero(f.pedido_minimo) ?? 1,
        capacidad_mensual: entero(f.capacidad_mensual), dias_muestra: entero(f.dias_muestra), dias_produccion: entero(f.dias_produccion),
      },
      acepto_politica_datos: f.acepto,
    };
    setEnviando(true);
    setErrorEnvio("");
    try {
      const respuesta = await maquilasService.registrar(datos);
      setRegistrado({ email: datos.representante.email, correoEnviado: respuesta.correo_enviado !== false });
    } catch (error) {
      setErrorEnvio(mensajeDeError(error));
    } finally {
      setEnviando(false);
    }
  }

  async function verificar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!registrado || verificando) return;
    if (!/^\d{6}$/.test(codigo.trim())) {
      setErrorCodigo("Escribe el código de 6 dígitos que te enviamos.");
      return;
    }
    setVerificando(true);
    setErrorCodigo("");
    try {
      await authService.verifyEmail({ email: registrado.email, otp: codigo.trim() });
      toast.success("Correo confirmado. Inicia sesión como «Maquila» para completar tu expediente.");
      onRegistrada(registrado.email);
    } catch (error) {
      setErrorCodigo(mensajeDeError(error));
    } finally {
      setVerificando(false);
    }
  }

  async function reenviar() {
    if (!registrado) return;
    try {
      await authService.resendOtp({ email: registrado.email, proposito: "verificacion_email" });
      toast.success("Te enviamos un código nuevo. Revisa también la carpeta de spam.");
    } catch (error) {
      setErrorCodigo(mensajeDeError(error));
    }
  }

  const categorias = (parametros?.categorias ?? []).map((c) => ({ valor: c.clave, etiqueta: c.nombre }));
  const procesos = (parametros?.procesos ?? []).map((p) => ({ valor: p, etiqueta: p }));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <button type="button" onClick={onVolver} className="flex items-center gap-2" aria-label="Volver a Zarpi Maquilas">
          <Logo />
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Maquilas</span>
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleTheme} aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Button variant="ghost" size="sm" onClick={onLogin}>Iniciar sesión</Button>
        </div>
      </header>

      <main className="flex-1 px-4 py-8">
        <div className="mx-auto w-full max-w-2xl space-y-6">
          {registrado ? (
            <Card padding="lg" className="mx-auto max-w-md text-center">
              <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" aria-hidden="true" />
              <h1 className="text-lg font-semibold">Ya casi: confirma tu correo</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {registrado.correoEnviado
                  ? <>Te enviamos un código de 6 dígitos a <span className="font-medium text-foreground">{registrado.email}</span>.</>
                  : <>Creamos tu cuenta, pero no pudimos enviarte el código a <span className="font-medium">{registrado.email}</span>. Pide uno nuevo.</>}
              </p>
              <form onSubmit={verificar} className="mt-5 space-y-3 text-left">
                <Input label="Código de verificación" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="123456"
                  inputMode="numeric" maxLength={6} error={errorCodigo || undefined} />
                <Button type="submit" fullWidth loading={verificando}>Confirmar correo</Button>
              </form>
              <button type="button" onClick={() => void reenviar()} className="mt-3 text-xs text-primary hover:underline dark:text-accent">
                Enviar un código nuevo
              </button>
            </Card>
          ) : (
            <>
              <div>
                <button type="button" onClick={onVolver} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-3.5 w-3.5" /> Volver a Zarpi Maquilas
                </button>
                <h1 className="text-2xl font-semibold tracking-tight">Registra tu maquila</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Crea la cuenta de tu taller o planta. Después subes tu expediente (RUT y cámara de comercio) y Zarpi lo verifica
                  antes de mostrarte a los clientes.
                </p>
              </div>

              <ol className="grid grid-cols-3 gap-2" aria-label="Pasos del registro">
                {PASOS.map(({ titulo, Icono }, i) => (
                  <li key={titulo} aria-current={i === paso ? "step" : undefined}
                    className={clsx("flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium",
                      i === paso ? "border-primary bg-primary/5 text-primary dark:border-accent dark:bg-accent/10 dark:text-accent"
                        : i < paso ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" : "border-border text-muted-foreground")}>
                    {i < paso ? <Check className="h-4 w-4" aria-hidden="true" /> : <Icono className="h-4 w-4" aria-hidden="true" />}
                    <span className="truncate">{i + 1}. {titulo}</span>
                  </li>
                ))}
              </ol>

              <Card padding="lg" className="space-y-4">
                {paso === 0 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Razón social" value={f.razon_social} onChange={(e) => poner("razon_social", e.target.value)} error={errores.razon_social} placeholder="Tu empresa S.A.S." />
                    <Input label="Nombre comercial" value={f.nombre_comercial} onChange={(e) => poner("nombre_comercial", e.target.value)} error={errores.nombre_comercial} placeholder="Como te conocen tus clientes" />
                    <Input label="NIT" value={f.nit} onChange={(e) => poner("nit", e.target.value)} error={errores.nit} placeholder="900123456-7" />
                    <Input label="Ciudad" value={f.ciudad} onChange={(e) => poner("ciudad", e.target.value)} error={errores.ciudad} placeholder="Ciudad de la planta o el taller" />
                    <Input label="Dirección (opcional)" value={f.direccion} onChange={(e) => poner("direccion", e.target.value)} />
                    <Input label="Teléfono de la empresa (opcional)" value={f.telefono_empresa} onChange={(e) => poner("telefono_empresa", e.target.value)} />
                    <div className="sm:col-span-2">
                      <Input label="Sitio web o red social (opcional)" value={f.sitio_web} onChange={(e) => poner("sitio_web", e.target.value)} placeholder="https://" />
                    </div>
                  </div>
                )}

                {paso === 1 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Nombre" value={f.nombre} onChange={(e) => poner("nombre", e.target.value)} error={errores.nombre} />
                    <Input label="Apellido" value={f.apellido} onChange={(e) => poner("apellido", e.target.value)} error={errores.apellido} />
                    <Select label="Tipo de documento" value={f.tipo_documento} onChange={(e) => poner("tipo_documento", e.target.value as TipoDocumento)}>
                      {DOCUMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </Select>
                    <Input label="Número de documento" value={f.numero_documento} onChange={(e) => poner("numero_documento", e.target.value)} error={errores.numero_documento} />
                    <Select label="Indicativo" value={f.indicativo} onChange={(e) => poner("indicativo", e.target.value)}>
                      {INDICATIVOS.map((i) => <option key={i} value={i}>{i}</option>)}
                    </Select>
                    <Input label="Celular" value={f.telefono} onChange={(e) => poner("telefono", e.target.value)} error={errores.telefono} inputMode="tel" />
                    <div className="sm:col-span-2">
                      <Input label="Correo (con él inicias sesión)" type="email" value={f.email} onChange={(e) => poner("email", e.target.value)} error={errores.email} />
                    </div>
                    <Input label="Contraseña" type="password" value={f.password} onChange={(e) => poner("password", e.target.value)} error={errores.password}
                      hint="Mínimo 9 caracteres, con una letra y un número" autoComplete="new-password" />
                    <Input label="Repite la contraseña" type="password" value={f.confirmar} onChange={(e) => poner("confirmar", e.target.value)} error={errores.confirmar} autoComplete="new-password" />
                  </div>
                )}

                {paso === 2 && (
                  <div className="space-y-5">
                    {cargandoParametros ? (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando categorías…</p>
                    ) : (
                      <>
                        <fieldset className="space-y-2">
                          <legend className="text-sm font-medium">¿Qué fabricas?</legend>
                          <Chips opciones={categorias} elegidas={f.categorias} onCambiar={(v) => poner("categorias", v)} />
                          {errores.categorias && <p className="text-xs text-destructive">{errores.categorias}</p>}
                        </fieldset>
                        <fieldset className="space-y-2">
                          <legend className="text-sm font-medium">¿Qué procesos haces?</legend>
                          <Chips opciones={procesos} elegidas={f.procesos} onCambiar={(v) => poner("procesos", v)} />
                          {errores.procesos && <p className="text-xs text-destructive">{errores.procesos}</p>}
                        </fieldset>
                      </>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input label="Pedido mínimo (unidades)" type="number" min={1} value={f.pedido_minimo} onChange={(e) => poner("pedido_minimo", e.target.value)} error={errores.pedido_minimo} />
                      <Input label="Capacidad al mes (unidades, opcional)" type="number" min={1} value={f.capacidad_mensual} onChange={(e) => poner("capacidad_mensual", e.target.value)} />
                      <Input label="Días para una muestra (opcional)" type="number" min={1} value={f.dias_muestra} onChange={(e) => poner("dias_muestra", e.target.value)} />
                      <Input label="Días de producción (opcional)" type="number" min={1} value={f.dias_produccion} onChange={(e) => poner("dias_produccion", e.target.value)} />
                    </div>
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" checked={f.acepto} onChange={(e) => poner("acepto", e.target.checked)} className="mt-1" />
                      <span>
                        Acepto la{" "}
                        <button type="button" className="text-primary underline dark:text-accent" onClick={() => onPolicy("data")}>política de tratamiento de datos</button>
                        {" "}y los{" "}
                        <button type="button" className="text-primary underline dark:text-accent" onClick={() => onPolicy("terms")}>términos</button> de Zarpi.
                      </span>
                    </label>
                    {errores.acepto && <p className="text-xs text-destructive">{errores.acepto}</p>}
                  </div>
                )}

                {errorEnvio && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{errorEnvio}</p>}

                <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                  <Button variant="ghost" onClick={() => (paso === 0 ? onVolver() : setPaso(paso - 1))} icon={<ArrowLeft className="h-4 w-4" />}>
                    {paso === 0 ? "Cancelar" : "Atrás"}
                  </Button>
                  <Button onClick={siguiente} loading={enviando}>
                    {paso < PASOS.length - 1 ? "Continuar" : "Crear cuenta"}
                  </Button>
                </div>
              </Card>

              <p className="text-center text-xs text-muted-foreground">
                ¿Ya tienes cuenta?{" "}
                <button type="button" onClick={onLogin} className="font-medium text-primary hover:underline dark:text-accent">Inicia sesión</button>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
