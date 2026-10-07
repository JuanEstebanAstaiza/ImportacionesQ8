import { adminService, type UsuarioEncontrado } from "@/services/admin.service";
import { Autocompletar, Resaltar } from "@/app/components/busqueda/Autocompletar";

/**
 * Autocompletado de cuentas para el panel de administración: basta con
 * recordar parte del correo o del nombre. Solo para el admin (el endpoint lo
 * exige).
 */

const ROLES: Record<string, string> = {
  solicitante: "Comprador",
  importador: "Empresa",
  asesor: "Asesor",
  admin: "Admin",
  soporte: "Soporte",
};

type BuscadorUsuariosProps = {
  onSeleccionar: (usuario: UsuarioEncontrado) => void;
  placeholder?: string;
  /** Solo cuentas de este rol (por ejemplo "solicitante"). */
  rol?: string;
  /** Ids que no se ofrecen porque ya están elegidos. */
  excluir?: Set<string>;
  disabled?: boolean;
  className?: string;
};

export function BuscadorUsuarios({
  onSeleccionar,
  placeholder = "Busca por correo o nombre",
  rol,
  excluir,
  disabled,
  className,
}: BuscadorUsuariosProps) {
  return (
    <Autocompletar<UsuarioEncontrado>
      buscar={(q) => adminService.buscarUsuarios(q, { rol })}
      onSeleccionar={onSeleccionar}
      obtenerClave={(u) => u.id}
      excluir={excluir}
      disabled={disabled}
      className={className}
      placeholder={placeholder}
      textoSinResultados="Ninguna cuenta activa coincide. Prueba con otra parte del correo o del nombre."
      renderOpcion={(u, q) => (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium"><Resaltar texto={u.email} consulta={q} /></p>
            <p className="truncate text-xs text-muted-foreground">
              {u.nombre ? <Resaltar texto={u.nombre} consulta={q} /> : "Sin nombre"}
              {u.empresa ? ` · ${u.empresa}` : ""}
            </p>
          </div>
          <span className="flex-shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {ROLES[u.rol] ?? u.rol}{u.es_curador ? " · curador" : ""}
          </span>
        </div>
      )}
    />
  );
}

/** La cuenta ya elegida, con opción de cambiarla. */
export function UsuarioElegido({ email, nombre, onCambiar }: { email: string; nombre?: string | null; onCambiar: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 dark:border-accent/40 dark:bg-accent/10">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{email}</p>
        {nombre ? <p className="truncate text-xs text-muted-foreground">{nombre}</p> : null}
      </div>
      <button type="button" onClick={onCambiar} className="flex-shrink-0 text-xs font-medium text-primary hover:underline dark:text-accent">
        Cambiar
      </button>
    </div>
  );
}
