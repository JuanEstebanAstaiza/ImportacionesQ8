import { CATEGORIAS_PRODUCTO } from "@/utils/categorias";
import { textoCategoria } from "@/features/admin/CategoriasCotizante";
import type { CategoriaCotizante } from "@/services/admin.service";
import {
  TIPOS_DOCUMENTO,
  type InviteRole,
  type UserFormState,
} from "./AdminModalTypes";

type Props = {
  form: UserFormState; categorias: CategoriaCotizante[]; submitting: boolean;
  onChange: (update: Partial<UserFormState>) => void; onClose: () => void; onSubmit: () => void;
};

export function UserCreationModal({ form, categorias, submitting, onChange, onClose, onSubmit }: Props) {
  return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
    <div className="w-full max-w-2xl rounded-xl border border-border bg-white p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Crear usuario</h2>
        <button
          type="button"
          onClick={() => onClose()}
          className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
        >
          Cerrar
        </button>
      </div>

      {/* Los campos cambian con el tipo de cuenta: los mismos del registro público. */}
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-medium text-muted-foreground">Tipo de cuenta
            <select
              value={form.rol}
              onChange={(event) => onChange({ rol: event.target.value as InviteRole })}
              className="h-9 w-full rounded-lg border border-border px-3 text-sm"
            >
              <option value="solicitante">Cotizante</option>
              <option value="importador">Empresa importadora (crea también su empresa)</option>
              <option value="soporte">Atención al cliente</option>
              <option value="designer">Diseño (portadas de Tendencias)</option>
              <option value="asesor">Asesor</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          {form.rol === "solicitante" ? (
            <div className="text-xs font-medium text-muted-foreground">Tipo de persona
              <div className="mt-1 flex gap-2">
                {(["natural", "juridica"] as const).map((tipo) => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => onChange({ tipoPersona: tipo })}
                    className={`h-9 flex-1 rounded-lg border text-sm ${form.tipoPersona === tipo ? "border-primary bg-primary/5 font-medium text-primary dark:text-accent" : "border-border"}`}
                  >
                    {tipo === "natural" ? "Persona natural" : "Persona jurídica"}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {/* El nivel decide qué tickets se le pueden asignar. */}
          {form.rol === "soporte" ? (
            <label className="text-xs font-medium text-muted-foreground">Nivel de soporte
              <select
                value={form.nivelSoporte}
                onChange={(event) => onChange({ nivelSoporte: Number(event.target.value) })}
                className="h-9 w-full rounded-lg border border-border px-3 text-sm"
              >
                <option value={1}>Nivel 1 — consultas corrientes</option>
                <option value={2}>Nivel 2 — casos intermedios</option>
                <option value={3}>Nivel 3 — casos complejos</option>
              </select>
            </label>
          ) : null}
        </div>

        {form.rol === "importador" ? (
          <fieldset className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-2">
            <legend className="px-1 text-xs font-semibold">Empresa</legend>
            <input value={form.companyName} onChange={(event) => onChange({ companyName: event.target.value })} placeholder="Nombre comercial" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
            <input value={form.razonSocial} onChange={(event) => onChange({ razonSocial: event.target.value })} placeholder="Razón social" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
            <input value={form.nit} onChange={(event) => onChange({ nit: event.target.value })} placeholder="NIT" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
            <input value={form.tiempoRespuesta} onChange={(event) => onChange({ tiempoRespuesta: event.target.value })} placeholder="Tiempo de respuesta (ej. ~24h)" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
            <input value={form.paises} onChange={(event) => onChange({ paises: event.target.value })} placeholder="Países de origen (separados por coma)" className="h-9 w-full rounded-lg border border-border px-3 text-sm md:col-span-2" />
            <div className="md:col-span-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Especialidades</p>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIAS_PRODUCTO.map((categoria) => {
                  const activa = form.especialidades.includes(categoria);
                  return (
                    <button
                      key={categoria}
                      type="button"
                      aria-pressed={activa}
                      onClick={() => onChange({ especialidades: activa ? form.especialidades.filter((c) => c !== categoria) : [...form.especialidades, categoria] })}
                    >
                      {categoria}
                    </button>
                  );
                })}
              </div>
            </div>
          </fieldset>
        ) : null}

        {form.rol === "solicitante" && form.tipoPersona === "juridica" ? (
          <fieldset className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-2">
            <legend className="px-1 text-xs font-semibold">Empresa del cotizante</legend>
            <input value={form.razonSocial} onChange={(event) => onChange({ razonSocial: event.target.value })} placeholder="Razón social" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
            <input value={form.nit} onChange={(event) => onChange({ nit: event.target.value })} placeholder="NIT" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
          </fieldset>
        ) : null}

        <fieldset className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-2">
          <legend className="px-1 text-xs font-semibold">
            {form.rol === "importador" ? "Representante legal (cuenta dueña)" : form.rol === "solicitante" && form.tipoPersona === "juridica" ? "Contacto y acceso" : "Datos de la persona"}
          </legend>
          {!(form.rol === "solicitante" && form.tipoPersona === "juridica") ? (
            <>
              <input value={form.nombre} onChange={(event) => onChange({ nombre: event.target.value })} placeholder="Nombre" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
              {form.rol === "solicitante" || form.rol === "importador" ? (
                <input value={form.apellido} onChange={(event) => onChange({ apellido: event.target.value })} placeholder="Apellido" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
              ) : null}
            </>
          ) : null}
          {(form.rol === "solicitante" && form.tipoPersona === "natural") || form.rol === "importador" ? (
            <div className="flex gap-2">
              <select
                aria-label="Tipo de documento"
                value={form.tipoDocumento}
                onChange={(event) => onChange({ tipoDocumento: event.target.value })}
                className="h-9 w-28 shrink-0 rounded-lg border border-border px-2 text-sm"
              >
                {TIPOS_DOCUMENTO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
              </select>
              <input value={form.numeroDocumento} onChange={(event) => onChange({ numeroDocumento: event.target.value })} placeholder="Número de documento" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
            </div>
          ) : null}
          <div className="flex gap-2">
            <input
              aria-label="Indicativo"
              value={form.indicativo_pais_telefono}
              onChange={(event) => onChange({ indicativo_pais_telefono: event.target.value })}
              placeholder="+57"
              className="h-9 w-20 shrink-0 rounded-lg border border-border px-2 text-sm"
            />
            <input value={form.telefono} onChange={(event) => onChange({ telefono: event.target.value })} placeholder="Teléfono" inputMode="tel" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
          </div>
          <input value={form.email} onChange={(event) => onChange({ email: event.target.value })} placeholder="Correo (con él inicia sesión)" type="email" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
          <input
            value={form.password}
            onChange={(event) => onChange({ password: event.target.value })}
            placeholder="Contraseña temporal (9+ caracteres, letras y números)"
            type="password"
            autoComplete="new-password"
            className="h-9 w-full rounded-lg border border-border px-3 text-sm"
          />
          {form.rol === "solicitante" ? (
            <label className="text-xs font-medium text-muted-foreground">Tokens de cotización iniciales
              <input
                type="number"
                min={0}
                value={form.tokensIniciales}
                onChange={(event) => onChange({ tokensIniciales: event.target.value })}
                className="h-9 w-full rounded-lg border border-border px-3 text-sm"
              />
            </label>
          ) : null}
          {form.rol === "solicitante" ? (
            <label className="text-xs font-medium text-muted-foreground">Categoría
              <select
                value={form.categoriaId}
                onChange={(event) => onChange({ categoriaId: event.target.value })}
                className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm"
              >
                <option value="">Sin categoría</option>
                {categorias.filter((c) => c.activa).map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre} · {textoCategoria(c)}</option>
                ))}
              </select>
              <span className="mt-0.5 block font-normal">
                Aplica su tier (si abajo no eliges otro) y sus días de Tendencias. Las categorías se crean en Cotizantes.
              </span>
            </label>
          ) : null}
          {form.rol === "solicitante" ? (
            <label className="text-xs font-medium text-muted-foreground">Tier
              <select
                value={form.tier}
                onChange={(event) => onChange({ tier: event.target.value as UserFormState["tier"] })}
                className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm"
              >
                <option value="">{form.categoriaId ? "El de la categoría" : "Automático (empieza en Bronze y sube con su actividad)"}</option>
                <option value="Bronze">Bronze (fijo)</option>
                <option value="Silver">Silver (fijo)</option>
                <option value="Gold">Gold (fijo)</option>
                <option value="Élite">Élite (fijo)</option>
              </select>
              <span className="mt-0.5 block font-normal">
                Elegido a mano, el tier no cambia solo. Lo puedes liberar después en Cotizantes.
              </span>
            </label>
          ) : null}
        </fieldset>
      </div>

      <div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        {form.rol === "asesor" || form.rol === "admin"
          ? "Los asesores los crea cada empresa desde su panel; las cuentas de administración no se crean desde aquí."
          : form.rol === "solicitante"
            ? "El cotizante queda verificado: entra con este correo y contraseña sin código de verificación, aunque el registro público esté cerrado. Puede cambiar la contraseña en Mi perfil."
          : form.rol === "importador"
            ? "Se crea la empresa y su cuenta dueña (el representante legal). Logo, descripción y demás datos los completa la empresa en «Mi empresa»."
          : form.rol === "designer"
            ? "Diseño pone portada e imágenes con la identidad de Zarpi a lo aprobado en Tendencias y lo publica. Entra al canal del equipo; no ve soporte ni clientes."
            : "Atención al cliente atiende tickets e incidentes; no administra la plataforma."}
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
          {submitting ? "Guardando..." : "Crear cuenta"}
        </button>
      </div>
    </div>
  </div>
  );
}
