import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Banknote,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  Ticket,
  Trash2,
  UserRound,
} from "lucide-react";

import { DocumentUploadButton } from "@/app/components/files/DocumentUploadButton";
import { resolveApiUrl } from "@/services/api-client";
import { perfilService, type CambiosPerfil, type CuentaPagoResumen, type MiPerfil } from "@/services/perfil.service";
import { CLASE_BOTON_PRIMARIO, CLASE_BOTON_SECUNDARIO, CLASE_INPUT, CLASE_TARJETA, fechaBogota, mensajeError } from "@/features/reto/comun";
import { FormCuentaBancaria } from "./FormCuentaBancaria";

const INDICATIVOS = ["+57", "+1", "+52", "+34", "+44", "+49", "+55", "+54", "+56", "+51", "+593", "+507", "+58", "+86"];

const NOMBRE_ROL: Record<MiPerfil["rol"], string> = {
  solicitante: "Cotizante",
  importador: "Administrador de empresa importadora",
  asesor: "Asesor",
  admin: "Administrador de Zarpi",
};

// Las cuentas viejas guardan el tipo en minúscula ("cedula"); las nuevas, la sigla.
const TIPO_DOCUMENTO: Record<string, string> = {
  cc: "Cédula de ciudadanía",
  cedula: "Cédula de ciudadanía",
  ce: "Cédula de extranjería",
  cedula_extranjeria: "Cédula de extranjería",
  pa: "Pasaporte",
  pasaporte: "Pasaporte",
  ppt: "Permiso por protección temporal",
  nit: "NIT",
  dni: "DNI",
};

function nombreDocumento(tipo: string | null): string {
  if (!tipo) return "Documento";
  return TIPO_DOCUMENTO[tipo.trim().toLowerCase()] ?? tipo;
}

interface Formulario {
  nombre: string;
  apellido: string;
  indicativo_pais_telefono: string;
  telefono: string;
  whatsapp: string;
}

function formularioDesde(p: MiPerfil): Formulario {
  return {
    nombre: p.nombre ?? "",
    apellido: p.apellido ?? "",
    indicativo_pais_telefono: p.indicativo_pais_telefono ?? "+57",
    telefono: p.telefono ?? "",
    whatsapp: p.whatsapp ?? "",
  };
}

function iniciales(p: MiPerfil): string {
  const fuente = [p.nombre, p.apellido].filter(Boolean).join(" ") || p.razon_social || p.email;
  const partes = fuente.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase() || "?";
}

function Seccion({ icono: Icono, titulo, descripcion, children, accion }: {
  icono: typeof UserRound;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <section className={`${CLASE_TARJETA} space-y-4 sm:p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold"><Icono className="h-4 w-4 text-primary dark:text-accent" /> {titulo}</h2>
          {descripcion ? <p className="mt-0.5 text-sm text-muted-foreground">{descripcion}</p> : null}
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}

function Campo({ etiqueta, children, ayuda, className = "" }: { etiqueta: string; children: ReactNode; ayuda?: string; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="font-medium">{etiqueta}</span>
      <div className="mt-1">{children}</div>
      {ayuda ? <span className="mt-1 block text-xs text-muted-foreground">{ayuda}</span> : null}
    </label>
  );
}

// ── Foto ─────────────────────────────────────────────────────────────────────

function FotoPerfil({ perfil, onCambio }: { perfil: MiPerfil; onCambio: (cambios: CambiosPerfil, mensaje: string) => Promise<void> }) {
  const [quitando, setQuitando] = useState(false);
  const [fallo, setFallo] = useState(false);
  useEffect(() => { setFallo(false); }, [perfil.foto_url]);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      {perfil.foto_url && !fallo ? (
        <img
          src={resolveApiUrl(perfil.foto_url)}
          alt="Tu foto de perfil"
          onError={() => setFallo(true)}
          className="h-24 w-24 shrink-0 rounded-full border border-border object-cover"
        />
      ) : (
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-primary text-3xl font-semibold text-white" aria-hidden>
          {iniciales(perfil)}
        </div>
      )}
      <div className="min-w-0 text-center sm:text-left">
        <p className="truncate text-lg font-semibold">{[perfil.nombre, perfil.apellido].filter(Boolean).join(" ") || perfil.razon_social || perfil.email}</p>
        <p className="truncate text-sm text-muted-foreground">{perfil.email}</p>
        <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{NOMBRE_ROL[perfil.rol]}</span>
        <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
          <DocumentUploadButton
            label={perfil.foto_url ? "Cambiar foto" : "Subir foto"}
            accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
            origen="perfil-usuario"
            onUploaded={async (archivo) => {
              await onCambio({ foto_url: `/documentos/archivos/${archivo.id}/descargar` }, "Foto actualizada.");
            }}
            onError={(m) => toast.error(m)}
          />
          {perfil.foto_url ? (
            <button
              type="button"
              disabled={quitando}
              onClick={async () => {
                setQuitando(true);
                try { await onCambio({ foto_url: "" }, "Quitamos tu foto."); } finally { setQuitando(false); }
              }}
              className={CLASE_BOTON_SECUNDARIO}
            >
              {quitando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Quitar
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">PNG, JPG o WEBP. La ven las empresas y personas con las que hablas en Zarpi.</p>
      </div>
    </div>
  );
}

// ── Datos personales ─────────────────────────────────────────────────────────

function DatosPersonales({ perfil, onGuardar }: { perfil: MiPerfil; onGuardar: (cambios: CambiosPerfil, mensaje: string) => Promise<void> }) {
  const [form, setForm] = useState<Formulario>(() => formularioDesde(perfil));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setForm(formularioDesde(perfil)); }, [perfil]);

  const set = (campo: keyof Formulario, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));
  const sinCambios = JSON.stringify(form) === JSON.stringify(formularioDesde(perfil));
  const documento = perfil.tipo_persona === "juridica"
    ? (perfil.nit ? `NIT ${perfil.nit}${perfil.razon_social ? ` · ${perfil.razon_social}` : ""}` : null)
    : (perfil.numero_documento ? `${nombreDocumento(perfil.tipo_documento)} ${perfil.numero_documento}` : null);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) return setError("Escribe tu nombre.");
    if (form.telefono && !/^[0-9 ()+-]{5,30}$/.test(form.telefono)) return setError("Revisa el teléfono: solo números, espacios y guiones.");
    if (form.whatsapp && !/^[0-9 ()+-]{5,20}$/.test(form.whatsapp)) return setError("Revisa el WhatsApp: solo números, espacios y guiones.");
    setError(null);
    setGuardando(true);
    try {
      await onGuardar({ ...form }, "Guardamos tus datos.");
    } catch (err) {
      setError(mensajeError(err, "No pudimos guardar tus datos."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={guardar} className="space-y-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre">
          <input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} autoComplete="given-name" maxLength={120} className={CLASE_INPUT} />
        </Campo>
        <Campo etiqueta="Apellido">
          <input value={form.apellido} onChange={(e) => set("apellido", e.target.value)} autoComplete="family-name" maxLength={120} className={CLASE_INPUT} />
        </Campo>
        <Campo etiqueta="Teléfono">
          <div className="flex gap-2">
            <div className="w-24 shrink-0">
              <select
                aria-label="Indicativo del país"
                value={form.indicativo_pais_telefono}
                onChange={(e) => set("indicativo_pais_telefono", e.target.value)}
                className={CLASE_INPUT}
              >
                {(INDICATIVOS.includes(form.indicativo_pais_telefono) ? INDICATIVOS : [form.indicativo_pais_telefono, ...INDICATIVOS]).map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <input value={form.telefono} onChange={(e) => set("telefono", e.target.value)} inputMode="tel" autoComplete="tel-national" maxLength={30} placeholder="300 123 4567" className={CLASE_INPUT} />
          </div>
        </Campo>
        <Campo etiqueta="WhatsApp" ayuda="Con indicativo, por ejemplo +57 300 123 4567.">
          <input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} inputMode="tel" maxLength={20} className={CLASE_INPUT} />
        </Campo>
        <Campo etiqueta="Correo" ayuda="Es con el que inicias sesión; no se cambia desde aquí.">
          <input value={perfil.email} disabled className={CLASE_INPUT} />
        </Campo>
        {documento ? (
          <Campo etiqueta="Documento" ayuda="Para corregirlo, escríbenos desde Soporte.">
            <input value={documento} disabled className={CLASE_INPUT} />
          </Campo>
        ) : null}
      </div>
      {error ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      <button type="submit" disabled={guardando || sinCambios} className={`${CLASE_BOTON_PRIMARIO} w-full px-4 py-2 sm:w-auto`}>
        {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Guardar cambios
      </button>
    </form>
  );
}

// ── Contraseña ───────────────────────────────────────────────────────────────

function CambiarContrasena() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [ver, setVer] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!actual) return setError("Escribe tu contraseña actual.");
    if (nueva.length < 9 || !/[A-Za-z]/.test(nueva) || !/\d/.test(nueva)) {
      return setError("La nueva contraseña debe tener al menos 9 caracteres, una letra y un número.");
    }
    if (nueva !== confirmar) return setError("Las contraseñas nuevas no coinciden.");
    setError(null);
    setGuardando(true);
    try {
      await perfilService.cambiarContrasena(actual, nueva);
      setActual(""); setNueva(""); setConfirmar("");
      toast.success("Cambiamos tu contraseña.");
    } catch (err) {
      setError(mensajeError(err, "No pudimos cambiar la contraseña."));
    } finally {
      setGuardando(false);
    }
  };

  const tipo = ver ? "text" : "password";
  return (
    <form onSubmit={guardar} className="space-y-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Contraseña actual">
          <input type={tipo} value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" className={CLASE_INPUT} />
        </Campo>
        <Campo etiqueta="Nueva contraseña" ayuda="Mínimo 9 caracteres, con letras y números.">
          <input type={tipo} value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" className={CLASE_INPUT} />
        </Campo>
        <Campo etiqueta="Repite la nueva">
          <input type={tipo} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" className={CLASE_INPUT} />
        </Campo>
      </div>
      <button type="button" onClick={() => setVer((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        {ver ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {ver ? "Ocultar" : "Mostrar"} contraseñas
      </button>
      {error ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
      <div>
        <button type="submit" disabled={guardando} className={`${CLASE_BOTON_PRIMARIO} w-full px-4 py-2 sm:w-auto`}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Cambiar contraseña
        </button>
      </div>
    </form>
  );
}

// ── Cuenta para pagos ────────────────────────────────────────────────────────

function CuentaParaPagos() {
  const [cuenta, setCuenta] = useState<CuentaPagoResumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setCuenta((await perfilService.cuentaPago()).cuenta);
    } catch (err) {
      toast.error(mensajeError(err, "No pudimos cargar tu cuenta bancaria."));
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  if (cargando) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>;
  }

  if (!cuenta || editando) {
    return (
      <FormCuentaBancaria
        key={cuenta?.fecha_actualizacion ?? "nueva"}
        inicial={cuenta ? { banco: cuenta.banco, tipo_cuenta: cuenta.tipo_cuenta, titular: cuenta.titular } : undefined}
        textoBoton={cuenta ? "Guardar la nueva cuenta" : "Guardar cuenta"}
        onCancelar={cuenta ? () => setEditando(false) : undefined}
        onGuardar={async (datos) => {
          const r = await perfilService.guardarCuentaPago(datos);
          setCuenta(r.cuenta);
          setEditando(false);
          toast.success("Guardamos tu cuenta bancaria.");
        }}
      />
    );
  }

  const borrar = async () => {
    setBorrando(true);
    try {
      await perfilService.borrarCuentaPago();
      setCuenta(null);
      toast.success("Borramos tu cuenta bancaria.");
    } catch (err) {
      toast.error(mensajeError(err, "No pudimos borrar la cuenta."));
    } finally {
      setBorrando(false);
      setConfirmarBorrado(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-accent"><Banknote className="h-5 w-5" /></span>
        <div className="min-w-0 text-sm">
          <p className="font-semibold">{cuenta.banco} · {cuenta.tipo_cuenta === "ahorros" ? "Ahorros" : "Corriente"} ···{cuenta.ultimos_digitos}</p>
          <p className="truncate text-muted-foreground">{cuenta.titular}{cuenta.documento ? ` · Doc. ${cuenta.documento}` : ""}</p>
          {cuenta.fecha_actualizacion ? <p className="text-xs text-muted-foreground">Actualizada el {fechaBogota(cuenta.fecha_actualizacion, false)}</p> : null}
        </div>
      </div>
      {confirmarBorrado ? (
        <div className="flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200 sm:flex-row sm:items-center sm:justify-between">
          <p>¿Borrar esta cuenta? Tendrás que cargarla de nuevo para recibir pagos.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => void borrar()} disabled={borrando} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60">
              {borrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Sí, borrar
            </button>
            <button type="button" onClick={() => setConfirmarBorrado(false)} className={CLASE_BOTON_SECUNDARIO}>No</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditando(true)} className={CLASE_BOTON_SECUNDARIO}><Pencil className="h-4 w-4" /> Cambiar cuenta</button>
          <button type="button" onClick={() => setConfirmarBorrado(true)} className={CLASE_BOTON_SECUNDARIO}><Trash2 className="h-4 w-4" /> Borrar</button>
        </div>
      )}
    </div>
  );
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

/**
 * Editor de perfil para cualquier cuenta. El cotizante además carga la cuenta
 * bancaria donde le transferimos las recompensas del reto; la empresa
 * importadora enlaza a los datos de su empresa, que se editan aparte.
 */
export function PerfilUsuario({
  onActualizado,
  onIrAEmpresa,
  extra,
}: {
  /** Tras guardar: refresca la cabecera (nombre y foto). */
  onActualizado?: () => Promise<void> | void;
  /** Solo empresas importadoras: abre el perfil de la empresa. */
  onIrAEmpresa?: () => void;
  extra?: ReactNode;
}) {
  const [perfil, setPerfil] = useState<MiPerfil | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setPerfil(await perfilService.obtener());
      setError(null);
    } catch (err) {
      setError(mensajeError(err, "No pudimos cargar tu perfil."));
    }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const guardar = async (cambios: CambiosPerfil, mensaje: string) => {
    try {
      const nuevo = await perfilService.guardar(cambios);
      setPerfil(nuevo);
      toast.success(mensaje);
      await onActualizado?.();
    } catch (err) {
      toast.error(mensajeError(err, "No pudimos guardar los cambios."));
      throw err;
    }
  };

  if (error) {
    return (
      <div className={`${CLASE_TARJETA} space-y-3 text-sm`}>
        <p className="text-rose-700 dark:text-rose-300">{error}</p>
        <button type="button" onClick={() => void cargar()} className={CLASE_BOTON_SECUNDARIO}>Reintentar</button>
      </div>
    );
  }
  if (!perfil) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando tu perfil…</p>;
  }

  const esCotizante = perfil.rol === "solicitante";
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <section className={`${CLASE_TARJETA} sm:p-5`}>
        <FotoPerfil perfil={perfil} onCambio={guardar} />
      </section>

      {onIrAEmpresa ? (
        <section className={`${CLASE_TARJETA} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:p-5`}>
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-primary dark:text-accent" />
            <div>
              <p className="font-semibold">Perfil de tu empresa</p>
              <p className="text-sm text-muted-foreground">Logo, descripción, certificaciones y datos que ven los clientes.</p>
            </div>
          </div>
          <button type="button" onClick={onIrAEmpresa} className={`${CLASE_BOTON_SECUNDARIO} shrink-0`}>Editar empresa</button>
        </section>
      ) : null}

      <Seccion icono={UserRound} titulo="Tus datos" descripcion="Así te ven las empresas y el equipo de Zarpi.">
        <DatosPersonales perfil={perfil} onGuardar={guardar} />
      </Seccion>

      {esCotizante ? (
        <Seccion
          icono={Banknote}
          titulo="Cuenta para recibir pagos"
          descripcion="Bancolombia, otro banco o billetera (Nequi, Daviplata). Aquí te transferimos las recompensas del reto de Tendencias."
          accion={(perfil.cotizaciones_gratis ?? 0) > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-2.5 py-1 text-xs font-semibold text-foreground">
              <Ticket className="h-3.5 w-3.5" /> {perfil.cotizaciones_gratis} cotizaciones gratis
            </span>
          ) : undefined}
        >
          <CuentaParaPagos />
        </Seccion>
      ) : null}

      <Seccion icono={KeyRound} titulo="Contraseña">
        <CambiarContrasena />
      </Seccion>

      {extra}

      <p className="text-center text-xs text-muted-foreground">Cuenta creada el {fechaBogota(perfil.fecha_creacion, false)}</p>
    </div>
  );
}
