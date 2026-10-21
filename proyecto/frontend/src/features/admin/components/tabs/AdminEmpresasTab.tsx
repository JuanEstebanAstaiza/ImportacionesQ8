import type { RefObject } from "react";
import type { BackendImporter } from "@/services/business.service";

type CompanyUiDetails = { nit: string; telefono: string; direccion: string; email_contacto: string };

function leerPerfilPublico(company: BackendImporter, ...claves: string[]): string {
  const perfil = company.perfil_publico;
  if (!perfil || typeof perfil !== "object") return "";
  for (const clave of claves) {
    const valor = (perfil as Record<string, unknown>)[clave];
    if (typeof valor === "string" && valor.trim()) return valor.trim();
  }
  return "";
}

export interface AdminEmpresasTabProps {
  sectionRef: RefObject<HTMLElement | null>;
  companies: BackendImporter[];
  ownerEmailByCompanyId: Record<string, string>;
  companyUiDetails: Record<string, CompanyUiDetails>;
  isLoading: boolean;
  onToggleCompanyStatus: (company: BackendImporter) => void;
  onOpenVerificationFile: (companyId: string) => void;
}

export function AdminEmpresasTab({ sectionRef, companies, ownerEmailByCompanyId, companyUiDetails, isLoading, onToggleCompanyStatus, onOpenVerificationFile }: AdminEmpresasTabProps) {
  return (
    <section ref={sectionRef} className="space-y-4 scroll-mt-6">
      <div className="flex items-center justify-between rounded-xl border border-border bg-white p-4 shadow-sm">
        <div>
          <p className="text-base font-semibold">Empresas / Importadores</p>
          <p className="text-sm text-muted-foreground">Crea empresas importadoras y revisa su información administrativa principal.</p>
        </div>
        {/*
        <button
          type="button"
          onClick={() => setShowCompanyModal(true)}
          className="rounded-lg px-3 py-2 text-sm font-medium bg-primary dark:bg-accent !text-white dark:!text-black hover:!bg-primary dark:hover:!bg-accent hover:opacity-80 disabled:opacity-60"
        >
          + Crear Empresa
        </button>
        */}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">NIT / RUT</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Telefono</th>
              <th className="px-4 py-3">Direccion</th>
              <th className="px-4 py-3">Pais principal</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Verificada</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              
            <tr key={company.id} className="border-t border-border hover:!bg-primary/8 dark:hover:!bg-accent/8">
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">
                  {company.nombre_empresa}
                </div>
                <div className="text-xs text-muted-foreground">
                  {company.especialidad_producto.join(", ") || "General"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Cuenta dueña: {ownerEmailByCompanyId[company.id] || "No disponible"}
                </div>
              </td>

              <td className="px-4 py-3 text-muted-foreground">
                {leerPerfilPublico(company, "nit") || companyUiDetails[company.id]?.nit || "—"}
              </td>

              <td className="px-4 py-3 text-muted-foreground">
                {leerPerfilPublico(company, "email", "email_contacto") ||
                  companyUiDetails[company.id]?.email_contacto ||
                  ownerEmailByCompanyId[company.id] ||
                  "—"}
              </td>

              <td className="px-4 py-3 text-muted-foreground">
                {leerPerfilPublico(company, "phone", "telefono") ||
                  companyUiDetails[company.id]?.telefono ||
                  "—"}
              </td>

              <td className="px-4 py-3 text-muted-foreground">
                {leerPerfilPublico(company, "address", "direccion") ||
                  companyUiDetails[company.id]?.direccion ||
                  "—"}
              </td>

              <td className="px-4 py-3 text-muted-foreground">
                {company.paises_origen[0] || "N/A"}
              </td>

              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    company.estado === "activo"
                      ? "bg-emerald-100 text-emerald-700 dark:!bg-accent/20"
                      : "bg-slate-100 text-slate-700 dark:!bg-accent/20"
                  }`}
                >
                  {company.estado || "activo"}
                </span>
              </td>

              <td className="px-4 py-3 text-muted-foreground">
                {company.verificado ? "Sí" : "No"}
              </td>

              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onToggleCompanyStatus(company);
                    }}
                    className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    {company.estado === "inactivo" ? "Activar" : "Desactivar"}
                  </button>

                  {/* Verificar no es un interruptor: se abre el expediente
                      y se decide con los requisitos delante. */}
                  <button
                    type="button"
                    onClick={() => {
                      onOpenVerificationFile(company.id);
                    }}
                    className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                      company.verificado
                        ? "border-border hover:bg-muted"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:!bg-accent/20 dark:hover:!bg-accent"
                    }`}
                  >
                    {company.verificado ? "Ver expediente" : "Verificar"}
                  </button>
                </div>
              </td>
            </tr>

            ))}
            {!companies.length && !isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No hay empresas para mostrar.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

