import { Building2, Upload } from "lucide-react";
import { resolveApiUrl } from "@/services/api-client";
import {
  LOGO_UPLOAD_ACCEPT,
  TIPOS_DOCUMENTO,
  type CompanyFormState,
} from "./AdminModalTypes";

type Props = {
  form: CompanyFormState; submitting: boolean; uploadingLogo: boolean;
  onChange: (update: Partial<CompanyFormState>) => void; onClose: () => void; onSubmit: () => void; onUploadLogo: (file: File) => void;
};

export function CompanyCreationModal({ form, submitting, uploadingLogo, onChange, onClose, onSubmit, onUploadLogo }: Props) {
  return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
    <div className="w-full max-w-2xl rounded-xl border border-border bg-white p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Crear empresa importadora</h2>
        <button
          type="button"
          onClick={() => onClose()}
          className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
        >
          Cerrar
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <input
          value={form.nombre_empresa}
          onChange={(event) => onChange({ nombre_empresa: event.target.value })}
          placeholder="Nombre comercial"
          className="h-9 rounded-lg border border-border px-3 text-sm"
        />
        <input
          value={form.razon_social}
          onChange={(event) => onChange({ razon_social: event.target.value })}
          placeholder="Razón social"
          className="h-9 rounded-lg border border-border px-3 text-sm"
        />
        <p className="text-xs font-semibold text-muted-foreground md:col-span-2">Representante legal (cuenta dueña)</p>
        <input
          value={form.nombre_dueño}
          onChange={(event) => onChange({ nombre_dueño: event.target.value })}
          placeholder="Nombre del representante"
          className="h-9 rounded-lg border border-border px-3 text-sm"
        />
        <input
          value={form.apellido_dueño}
          onChange={(event) => onChange({ apellido_dueño: event.target.value })}
          placeholder="Apellido del representante"
          className="h-9 rounded-lg border border-border px-3 text-sm"
        />
        <div className="flex gap-2">
          <select
            aria-label="Tipo de documento del representante"
            value={form.tipo_documento_dueño}
            onChange={(event) => onChange({ tipo_documento_dueño: event.target.value })}
            className="h-9 w-28 shrink-0 rounded-lg border border-border px-2 text-sm"
          >
            {TIPOS_DOCUMENTO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
          </select>
          <input
            value={form.numero_documento_dueño}
            onChange={(event) => onChange({ numero_documento_dueño: event.target.value })}
            placeholder="Número de documento"
            className="h-9 w-full rounded-lg border border-border px-3 text-sm"
          />
        </div>
        <input
          value={form.email_dueño}
          onChange={(event) => onChange({ email_dueño: event.target.value })}
          placeholder="Correo de la cuenta dueña (inicia sesión con él)"
          className="h-9 rounded-lg border border-border px-3 text-sm"
        />
        <input
          aria-label="Indicativo del teléfono"
          value={form.indicativo_dueño}
          onChange={(event) => onChange({ indicativo_dueño: event.target.value })}
          placeholder="Indicativo (+57)"
          className="h-9 rounded-lg border border-border px-3 text-sm"
        />
        <input
          value={form.email_contacto}
          onChange={(event) => onChange({ email_contacto: event.target.value })}
          placeholder="Email contacto"
          className="h-9 rounded-lg border border-border px-3 text-sm"
        />
        <input
          value={form.password_dueño}
          onChange={(event) => onChange({ password_dueño: event.target.value })}
          placeholder="Password dueno"
          type="password"
          className="h-9 rounded-lg border border-border px-3 text-sm"
        />
        <input
          value={form.nit}
          onChange={(event) => onChange({ nit: event.target.value })}
          placeholder="NIT / RUT"
          className="h-9 rounded-lg border border-border px-3 text-sm"
        />
        <input
          value={form.especialidad_producto}
          onChange={(event) => onChange({ especialidad_producto: event.target.value })}
          placeholder="Especialidades (CSV)"
          className="h-9 rounded-lg border border-border px-3 text-sm"
        />
        <input
          value={form.paises_origen}
          onChange={(event) => onChange({ paises_origen: event.target.value })}
          placeholder="Paises origen (CSV)"
          className="h-9 rounded-lg border border-border px-3 text-sm"
        />
        <input
          value={form.tiempo_respuesta_promedio}
          onChange={(event) =>
            onChange({ tiempo_respuesta_promedio: event.target.value })
          }
          placeholder="Tiempo respuesta"
          className="h-9 rounded-lg border border-border px-3 text-sm"
        />
        <input
          value={form.telefono}
          onChange={(event) => onChange({ telefono: event.target.value })}
          placeholder="Telefono"
          className="h-9 rounded-lg border border-border px-3 text-sm"
        />
        <input
          value={form.sitio_web}
          onChange={(event) => onChange({ sitio_web: event.target.value })}
          placeholder="Sitio web (ej. miempresa.com)"
          className="h-9 rounded-lg border border-border px-3 text-sm"
        />
        <input
          value={form.direccion}
          onChange={(event) => onChange({ direccion: event.target.value })}
          placeholder="Direccion"
          className="h-9 rounded-lg border border-border px-3 text-sm md:col-span-2"
        />
        <div className="col-span-full flex items-center gap-3">
          {form.logo_url ? (
            <img
              src={resolveApiUrl(form.logo_url)}
              alt="Logo de la empresa"
              className="h-16 w-16 rounded-xl border border-border bg-white object-contain p-1"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground">
              <Building2 className="h-6 w-6" />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted">
              <Upload className="h-3.5 w-3.5" />
              {uploadingLogo ? "Subiendo..." : form.logo_url ? "Cambiar logo" : "Subir logo"}
              <input
                type="file"
                accept={LOGO_UPLOAD_ACCEPT}
                className="hidden"
                onChange={(event) => {
                  const archivo = event.target.files?.[0];
                  event.target.value = "";
                  if (archivo) {
                    void onUploadLogo(archivo);
                  }
                }}
              />
            </label>
            <span className="text-xs text-muted-foreground">PNG, JPG o WebP hasta 2 MB.</span>
          </div>
        </div>
        <label className="col-span-full flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.solo_cotizaciones_directas}
            onChange={(event) => onChange({ solo_cotizaciones_directas: event.target.checked })}
          />
          Solo cotizaciones directas
        </label>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onClose()}
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            void onSubmit();
          }}
          disabled={submitting}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "Creando..." : "Guardar"}
        </button>
      </div>
    </div>
  </div>
  );
}
