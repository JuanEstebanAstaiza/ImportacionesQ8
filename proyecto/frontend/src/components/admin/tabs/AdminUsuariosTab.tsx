
import type { RefObject } from "react";
import type { AdminUser } from "@/services/admin.service";

type RoleFilter = "todos" | "solicitante" | "importador" | "asesor" | "soporte" | "designer" | "admin";
type ActiveFilter = "todos" | "activos" | "inactivos";
const ROLE_OPTIONS: RoleFilter[] = ["todos", "solicitante", "importador", "asesor", "soporte", "designer", "admin"];

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

export interface AdminUsuariosTabProps {
  sectionRef: RefObject<HTMLElement | null>;
  users: AdminUser[];
  companyNameById: Record<string, string>;
  usersByRole: Record<string, number>;
  isLoading: boolean;
  userRoleFilter: RoleFilter;
  userActiveFilter: ActiveFilter;
  onRoleFilterChange: (filter: RoleFilter) => void;
  onActiveFilterChange: (filter: ActiveFilter) => void;
  onCreateUser: () => void;
  onToggleUserStatus: (user: AdminUser) => void;
}

export function AdminUsuariosTab({ sectionRef, users, companyNameById, usersByRole, isLoading, userRoleFilter, userActiveFilter, onRoleFilterChange, onActiveFilterChange, onCreateUser, onToggleUserStatus }: AdminUsuariosTabProps) {
  return (
    <section ref={sectionRef} className="space-y-4 scroll-mt-6">        <div className="flex items-center justify-between rounded-xl border border-border bg-white p-4 shadow-sm">
          <div>
            <p className="text-base font-semibold">Gestión de Usuarios</p>
            <p className="text-sm text-muted-foreground">Administra usuarios, roles visibles y su empresa asignada cuando aplique.</p>
          </div>
          <button
            type="button"
            onClick={() => onCreateUser()}
            className="rounded-lg bg-primary dark:bg-accent px-3 py-2 text-sm font-medium !text-white dark:!text-black hover:!bg-primary dark:hover:!bg-accent hover:opacity-80"
          >
            + Crear / Invitar Usuario
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm md:col-span-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold">Usuarios y Roles</p>
                <p className="text-sm text-muted-foreground">Filtros por rol/estado y visibilidad de empresa asociada.</p>
              </div>
              <div className="flex gap-2">
                <select
                  value={userRoleFilter}
                  onChange={(event) => onRoleFilterChange(event.target.value as RoleFilter)}
                  className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary dark:bg-card dark:text-foreground dark:focus:border-accent dark:focus:ring-accent [&>option]:bg-white [&>option]:text-black dark:[&>option]:bg-card dark:[&>option]:text-white"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <select
                  value={userActiveFilter}
                  onChange={(event) => onActiveFilterChange(event.target.value as ActiveFilter)}
                  className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary dark:bg-card dark:text-foreground dark:focus:border-accent dark:focus:ring-accent [&>option]:bg-white [&>option]:text-black dark:[&>option]:bg-card dark:[&>option]:text-white"
                >
                  <option value="todos">todos</option>
                  <option value="activos">activos</option>
                  <option value="inactivos">inactivos</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Usuario</th>
                    <th className="px-3 py-2">Empresa</th>
                    <th className="px-3 py-2">Rol</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Alta</th>
                    <th className="px-3 py-2 text-right">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-border hover:!bg-primary/10 dark:hover:!bg-accent/10"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">
                        {user.nombre || user.email}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {user.email}
                      </div>
                    </td>

                    <td className="px-3 py-2 text-muted-foreground">
                      {user.importador_id
                        ? companyNameById[user.importador_id] || user.importador_id
                        : "—"}
                    </td>

                    <td className="px-3 py-2 text-muted-foreground">
                      {user.rol}
                    </td>

                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium dark:!bg-accent/15 ${
                          user.activo
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {user.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    <td className="px-3 py-2 text-muted-foreground">
                      {formatDate(user.fecha_creacion)}
                    </td>

                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          onToggleUserStatus(user);
                        }}
                        className="rounded-md border border-primary/40 dark:border-accent/40 hover:!bg-primary dark:hover:!bg-accent hover:!text-white dark:hover:!text-black px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        {user.activo ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                  ))}
                  {!users.length && !isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                        No hay usuarios para el filtro seleccionado.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <p className="text-base font-semibold">Resumen rápido</p>
            <p className="mt-1 text-xs text-muted-foreground">La creación directa soportada por API actual es para compradores e importadores.</p>
            <div className="mt-4 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Distribucion actual por rol:</p>
              {Object.entries(usersByRole).map(([role, total]) => (
                <p key={role}>
                  {role}: {total}
                </p>
              ))}
            </div>
          </div>
        </div>    </section>
  );
}





