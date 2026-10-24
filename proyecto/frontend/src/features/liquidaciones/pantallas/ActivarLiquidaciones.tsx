import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Ban, CircleCheck, FileText, Info, LifeBuoy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button, Card, Input } from "@/components/design-system";
import { SubirArchivo } from "@/features/liquidaciones/componentes/SubirArchivo";
import { useActivacion, useInvalidarLiquidaciones } from "@/features/liquidaciones/useLiquidaciones";
import { liquidacionesService } from "@/services/liquidaciones.service";
import type { ArchivoSubido, EstadoActivacion } from "@/features/liquidaciones/tipos";

/**
 * Activación única de la cuenta de Zarpi en Liquidaciones. No es un registro
 * aparte: se parte de los datos que la cuenta ya tiene y solo se piden el RUT
 * actualizado y la declaración de que se compra para una actividad comercial.
 */

type TipoPersona = "juridica" | "natural";

type Formulario = {
  tipo_persona: TipoPersona;
  razon_social: string;
  nit: string;
  contacto: string;
  ciudad: string;
  direccion: string;
  telefono: string;
};

type Errores = Partial<Record<keyof Formulario | "rut" | "declaracion", string>>;

// Mismos mínimos que `ActivacionEntrada` en el backend, para avisar antes de enviar.
const MINIMOS: { campo: keyof Formulario; min: number; mensaje: string }[] = [
  { campo: "razon_social", min: 2, mensaje: "Escribe la razón social o el nombre comercial" },
  { campo: "nit", min: 5, mensaje: "Escribe un NIT válido" },
  { campo: "contacto", min: 2, mensaje: "Indica quién atiende las operaciones" },
  { campo: "ciudad", min: 2, mensaje: "Indica la ciudad" },
  { campo: "direccion", min: 4, mensaje: "Escribe la dirección completa" },
  { campo: "telefono", min: 7, mensaje: "Escribe un celular de al menos 7 dígitos" },
];

function desdePrellenado(prellenado: EstadoActivacion["prellenado"] | undefined): Formulario {
  return {
    tipo_persona: prellenado?.tipo_persona === "natural" ? "natural" : "juridica",
    razon_social: prellenado?.razon_social ?? "",
    nit: prellenado?.nit ?? "",
    contacto: prellenado?.contacto ?? "",
    ciudad: prellenado?.ciudad ?? "",
    direccion: prellenado?.direccion ?? "",
    telefono: prellenado?.telefono ?? "",
  };
}

function validar(form: Formulario, rut: ArchivoSubido | null, acepta: boolean): Errores {
  const errores: Errores = {};
  MINIMOS.forEach(({ campo, min, mensaje }) => {
    if (String(form[campo] ?? "").trim().length < min) errores[campo] = mensaje;
  });
  if (!rut) errores.rut = "Sube el RUT actualizado";
  if (!acepta) errores.declaracion = "Debes aceptar la declaración para continuar";
  return errores;
}

const OPCIONES_TIPO: { valor: TipoPersona; label: string }[] = [
  { valor: "juridica", label: "Empresa" },
  { valor: "natural", label: "Persona natural con RUT" },
];

export function ActivarLiquidaciones({ onActivada, onCancelar }: { onActivada: () => void; onCancelar: () => void }) {
  const { data, isLoading, isError, error, refetch } = useActivacion();
  const invalidar = useInvalidarLiquidaciones();

  const [form, setForm] = useState<Formulario | null>(null);
  const [rut, setRut] = useState<ArchivoSubido | null>(null);
  const [acepta, setAcepta] = useState(false);
  const [errores, setErrores] = useState<Errores>({});

  // Se prellena una sola vez: si react-query refresca después, no se pisa lo que la persona ya editó.
  useEffect(() => {
    if (data && !form) setForm(desdePrellenado(data.prellenado));
  }, [data, form]);

  const activar = useMutation({
    mutationFn: (datos: Formulario & { rut_archivo_id: string }) =>
      liquidacionesService.activar({
        tipo_persona: datos.tipo_persona,
        razon_social: datos.razon_social.trim(),
        nit: datos.nit.trim(),
        contacto: datos.contacto.trim(),
        ciudad: datos.ciudad.trim(),
        direccion: datos.direccion.trim(),
        telefono: datos.telefono.trim(),
        rut_archivo_id: datos.rut_archivo_id,
        acepta_declaracion: true,
      }),
    onSuccess: async () => {
      toast.success("Tu cuenta quedó activa en Liquidaciones");
      await invalidar();
      onActivada();
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "No se pudo activar la cuenta");
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="mx-auto max-w-2xl text-center" padding="lg">
        <p className="font-semibold">No pudimos cargar tu cuenta</p>
        <p className="mt-1 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Intenta de nuevo en un momento."}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="secondary" onClick={onCancelar}>Volver</Button>
          <Button onClick={() => void refetch()}>Reintentar</Button>
        </div>
      </Card>
    );
  }

  // La suspensión va primero: el backend marca `activa: false` a una cuenta suspendida.
  if (data.activacion?.suspendida) {
    return (
      <Card className="mx-auto max-w-2xl" padding="lg">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <Ban className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">Tu cuenta de Liquidaciones está suspendida</h1>
            {data.activacion.motivo_suspension && (
              <p className="mt-2 text-sm text-foreground">{data.activacion.motivo_suspension}</p>
            )}
            <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
              <LifeBuoy className="mt-0.5 h-4 w-4 flex-shrink-0" />
              Si crees que es un error o quieres revisarlo, escríbenos desde Soporte técnico.
            </p>
            <Button variant="secondary" className="mt-5" onClick={onCancelar}>Volver</Button>
          </div>
        </div>
      </Card>
    );
  }

  if (data.activa) {
    return (
      <Card className="mx-auto max-w-2xl" padding="lg">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CircleCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Tu cuenta ya está activa</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.puede_publicar ? "Ya puedes comprar y publicar lotes en Liquidaciones." : "Ya puedes comprar lotes en Liquidaciones."}
            </p>
            <button
              type="button"
              onClick={onActivada}
              className="mt-5 inline-flex h-9 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-black shadow-sm transition hover:brightness-95"
            >
              Ir a Liquidaciones
            </button>
          </div>
        </div>
      </Card>
    );
  }

  if (!form) return null;

  const natural = form.tipo_persona === "natural";
  const cambiar = (campo: keyof Formulario) => (e: { target: { value: string } }) => {
    setForm({ ...form, [campo]: e.target.value });
    if (errores[campo]) setErrores({ ...errores, [campo]: undefined });
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const encontrados = validar(form, rut, acepta);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) {
      toast.error("Revisa los campos marcados");
      return;
    }
    activar.mutate({ ...form, rut_archivo_id: rut!.id });
  };

  return (
    <Card className="mx-auto max-w-2xl" padding="lg">
      <form onSubmit={enviar} noValidate className="space-y-6">
        <header>
          <h1 className="text-xl font-semibold tracking-tight">Activa tu cuenta en Liquidaciones</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Zarpi Liquidaciones es solo para empresas y comerciantes. Lo haces una sola vez; usamos los datos que ya tienes en Zarpi.
          </p>
        </header>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Tipo</span>
          <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1">
            {OPCIONES_TIPO.map((opcion) => {
              const elegida = form.tipo_persona === opcion.valor;
              return (
                <button
                  key={opcion.valor}
                  type="button"
                  role="radio"
                  aria-checked={elegida}
                  onClick={() => setForm({ ...form, tipo_persona: opcion.valor })}
                  className={clsx(
                    "rounded-md px-3 py-2 text-sm font-medium transition",
                    elegida ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opcion.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              id="liq-razon-social"
              label={natural ? "Nombre comercial" : "Razón social"}
              value={form.razon_social}
              onChange={cambiar("razon_social")}
              error={errores.razon_social}
              maxLength={200}
              autoComplete="organization"
            />
          </div>
          <Input id="liq-nit" label="NIT" value={form.nit} onChange={cambiar("nit")} error={errores.nit} maxLength={30} />
          <Input
            id="liq-contacto"
            label="Persona de contacto"
            value={form.contacto}
            onChange={cambiar("contacto")}
            error={errores.contacto}
            maxLength={120}
            autoComplete="name"
          />
          <Input id="liq-ciudad" label="Ciudad" value={form.ciudad} onChange={cambiar("ciudad")} error={errores.ciudad} maxLength={80} />
          <Input
            id="liq-telefono"
            label="Celular"
            type="tel"
            inputMode="tel"
            value={form.telefono}
            onChange={cambiar("telefono")}
            error={errores.telefono}
            maxLength={30}
            autoComplete="tel"
          />
          <div className="sm:col-span-2">
            <Input
              id="liq-direccion"
              label="Dirección"
              value={form.direccion}
              onChange={cambiar("direccion")}
              error={errores.direccion}
              maxLength={200}
              autoComplete="street-address"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">RUT actualizado</span>
          {rut && (
            <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
              <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{rut.nombre}</span>
              <CircleCheck className="h-4 w-4 flex-shrink-0 text-emerald-500" aria-label="Subido" />
            </div>
          )}
          <SubirArchivo
            tipo="rut"
            etiqueta={rut ? "Reemplazar documento" : "Subir documento"}
            ayuda="PDF, expedido por la DIAN o la Cámara de Comercio"
            maxMb={15}
            onSubido={(archivo) => {
              setRut(archivo);
              setErrores((previos) => ({ ...previos, rut: undefined }));
            }}
          />
          {errores.rut && <p className="text-xs text-destructive">{errores.rut}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm leading-relaxed">
            <input
              type="checkbox"
              checked={acepta}
              onChange={(e) => {
                setAcepta(e.target.checked);
                if (e.target.checked) setErrores((previos) => ({ ...previos, declaracion: undefined }));
              }}
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-primary"
            />
            <span>
              {data.puede_publicar
                ? "Declaro que compro y vendo para mi actividad comercial, para revender o para uso de mi negocio, y no como consumidor final."
                : "Declaro que compro para mi actividad comercial, para revender o para uso de mi negocio, y no como consumidor final."}
            </span>
          </label>
          {errores.declaracion && <p className="text-xs text-destructive">{errores.declaracion}</p>}
        </div>

        <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-px h-3.5 w-3.5 flex-shrink-0" />
          Al reservar un lote, la otra parte verá tu razón social, NIT, contacto, celular, correo y dirección.
        </p>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onCancelar} disabled={activar.isPending}>Cancelar</Button>
          <button
            type="submit"
            disabled={activar.isPending}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-semibold text-black shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {activar.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Activar mi cuenta
          </button>
        </div>
      </form>
    </Card>
  );
}
