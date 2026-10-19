import { useRef } from "react";
import type { RefObject } from "react";
import { Award, Shield, Trash2, Upload, X } from "lucide-react";
import type { AdminCertificacion } from "@/services/admin.service";
import type { BackendImporter } from "@/services/business.service";
import { resolveApiUrl } from "@/services/api-client";

type CertificationFormState = { nombre: string; descripcion: string; logo_url: string; peso_publicidad: string };
const EMPTY_CERTIFICATION_FORM: CertificationFormState = { nombre: "", descripcion: "", logo_url: "", peso_publicidad: "10" };
const LOGO_UPLOAD_ACCEPT = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";

export interface AdminCertificacionesTabProps {
  sectionRef: RefObject<HTMLElement | null>;
  certifications: AdminCertificacion[];
  certificationForm: CertificationFormState;
  editingCertificationId: string | null;
  isUploadingLogo: boolean;
  submitting: boolean;
  companies: BackendImporter[];
  companyNameById: Record<string, string>;
  certificationsByCompany: Record<string, BackendImporter["certificaciones"]>;
  grantCompanyId: string;
  grantCertificationId: string;
  onCertificationFormChange: (form: CertificationFormState) => void;
  onUploadLogo: (file: File) => void;
  onSave: () => void;
  onEdit: (certification: AdminCertificacion) => void;
  onCancelEdit: () => void;
  onRetire: (certification: AdminCertificacion) => void;
  onGrant: () => void;
  onRevoke: (companyId: string, certificationId: string) => void;
  onGrantCompanyChange: (id: string) => void;
  onGrantCertificationChange: (id: string) => void;
}

export function AdminCertificacionesTab({ sectionRef, certifications, certificationForm, editingCertificationId, isUploadingLogo, submitting, companies, companyNameById, certificationsByCompany, grantCompanyId, grantCertificationId, onCertificationFormChange, onUploadLogo, onSave, onEdit, onCancelEdit, onRetire, onGrant, onRevoke, onGrantCompanyChange, onGrantCertificationChange }: AdminCertificacionesTabProps) {
  const certificationLogoInputRef = useRef<HTMLInputElement | null>(null);
  return (
    <section ref={sectionRef} className="space-y-4 scroll-mt-6">      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <p className="flex items-center gap-2 text-base font-semibold">
          <Award className="h-4 w-4 text-primary dark:text-accent" />
          Certificaciones de la plataforma
        </p>
        <p className="text-sm text-muted-foreground">
          Sellos con los que respaldas a una empresa. El <strong>peso publicitario</strong> es lo que decide
          qué tan arriba aparece en el catálogo del comprador: a mayor peso, más visibilidad.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
        {/* Crear / editar el sello */}
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold">
            {editingCertificationId ? "Editar certificación" : "Crear certificación"}
          </p>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nombre</label>
              <input
                value={certificationForm.nombre}
                onChange={(event) => onCertificationFormChange({ ...certificationForm, nombre: event.target.value })}
                placeholder="Ej. Socio Verificado Oro"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Descripción</label>
              <textarea
                value={certificationForm.descripcion}
                onChange={(event) => onCertificationFormChange({ ...certificationForm, descripcion: event.target.value })}
                rows={3}
                placeholder="Qué respalda este sello y cómo se obtiene."
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Peso publicitario (0 – 1000)
              </label>
              <input
                type="number"
                min={0}
                max={1000}
                step={1}
                value={certificationForm.peso_publicidad}
                onChange={(event) => onCertificationFormChange({ ...certificationForm, peso_publicidad: event.target.value })}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                El puntaje de una empresa es la suma de los pesos de sus sellos vigentes.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Logo</label>
              <input
                ref={certificationLogoInputRef}
                type="file"
                accept={LOGO_UPLOAD_ACCEPT}
                className="hidden"
                onChange={(event) => {
                  const archivo = event.target.files?.[0];
                  event.target.value = "";
                  if (archivo) onUploadLogo(archivo);
                }}
              />
              <div className="flex items-center gap-3">
                {certificationForm.logo_url ? (
                  <img
                    src={resolveApiUrl(certificationForm.logo_url)}
                    alt="Logo de la certificación"
                    className="h-12 w-12 rounded-lg border border-border object-contain"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border">
                    <Shield className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                )}
                <button
                  type="button"
                  disabled={isUploadingLogo}
                  onClick={() => certificationLogoInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:!bg-primary hover:!text-white hover:!border-primary dark:hover:!bg-accent dark:hover:!text-black dark:hover:!border-accent disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" />
                  {isUploadingLogo ? "Subiendo..." : certificationForm.logo_url ? "Cambiar" : "Subir logo"}
                </button>
                {certificationForm.logo_url ? (
                  <button
                    type="button"
                    onClick={() => onCertificationFormChange({ ...certificationForm, logo_url: "" })}
                    className="text-xs text-muted-foreground rounded-lg border hover:border-transparent px-2 py-1 hover:text-primary dark:hover:text-accent hover:bg-primary/20 dark:hover:bg-accent/20"
                  >
                    Quitar
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  onSave();
                }}
                className="flex-1 rounded-lg bg-primary dark:bg-accent px-3 py-2 text-sm font-medium !text-white dark:!text-black hover:!bg-primary dark:hover:!bg-accent hover:opacity-80 disabled:opacity-60"
              >
                {editingCertificationId ? "Guardar cambios" : "Crear certificación"}
              </button>
              {editingCertificationId ? (
                <button
                  type="button"
                  onClick={() => {
                      onCancelEdit();
                  }}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:!bg-primary/20 hover:!text-primary hover:!border-primary dark:hover:!bg-accent/20 dark:hover:!text-accent dark:hover:!border-accent"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Catálogo de sellos + otorgamiento */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold">Catálogo de sellos</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3">Sello</th>
                    <th className="py-2 pr-3 text-right">Peso</th>
                    <th className="py-2 pr-3 text-right">Empresas</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {certifications.map((certificacion) => (
                    <tr key={certificacion.id} className="border-b border-border/60 hover:!bg-primary/12 dark:hover:!bg-accent/12">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2.5">
                          {certificacion.logo_url ? (
                            <img
                              src={resolveApiUrl(certificacion.logo_url)}
                              alt=""
                              className="h-8 w-8 rounded border border-border object-contain"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded border border-border">
                              <Shield className="h-4 w-4 text-muted-foreground/60" />
                            </div>
                          )}
                          <div>
                            <p className={`font-medium ${certificacion.activa ? "text-foreground" : "text-muted-foreground line-through"}`}>
                              {certificacion.nombre}
                            </p>
                            <p className="line-clamp-1 max-w-xs text-xs text-muted-foreground">
                              {certificacion.descripcion || "Sin descripción"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-right font-semibold">{certificacion.peso_publicidad}</td>
                      <td className="py-3 pr-3 text-right">{certificacion.empresas_certificadas}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEditingCertification(certificacion)}
                            className="rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:!bg-primary hover:!text-white !border-primary/30 hover:!border-primary dark:hover:!bg-accent dark:hover:!text-black dark:!border-accent/30 dark:hover:!border-accent"
                          >
                            Editar
                          </button>
                          {certificacion.activa ? (
                            <button
                              type="button"
                              onClick={() => {
                                onRetire(certificacion);
                              }}
                              className="rounded-lg border bg-red-50 border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/60"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {certifications.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                        Aún no has creado ninguna certificación.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold">Respaldar a una empresa</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Empresa</label>
                <select
                  value={grantCompanyId}
                  onChange={(event) => onGrantCompanyChange(event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-card dark:text-foreground dark:focus:border-accent dark:focus:ring-accent [&>option]:bg-white [&>option]:text-black dark:[&>option]:bg-card dark:[&>option]:text-white"
                >
                  <option value="">Selecciona una empresa</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.nombre_empresa}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Certificación</label>
                <select
                  value={grantCertificationId}
                  onChange={(event) => onGrantCertificationChange(event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-card dark:text-foreground dark:focus:border-accent dark:focus:ring-accent [&>option]:bg-white [&>option]:text-black dark:[&>option]:bg-card dark:[&>option]:text-white"
                >
                  <option value="">Selecciona un sello</option>
                  {certifications.filter((item) => item.activa).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nombre} (peso {item.peso_publicidad})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  onGrant();
                }}
                className="rounded-lg bg-primary dark:bg-accent px-4 py-2 text-sm font-medium !text-white dark:!text-black hover:!bg-primary dark:hover:!bg-accent hover:opacity-80 disabled:opacity-60"
              >
                Otorgar
              </button>
            </div>

            {grantCompanyId ? (
              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Sellos vigentes de {companyNameById[grantCompanyId] || "la empresa"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(certificationsByCompany[grantCompanyId] || []).map((otorgada) => (
                    <span
                      key={otorgada.certificacion_id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-accent dark:!bg-accent/12"
                    >
                      <Shield className="h-3 w-3" />
                      {otorgada.nombre} · {otorgada.peso_publicidad}
                      <button
                        type="button"
                        onClick={() => {
                          onRevoke(grantCompanyId, otorgada.certificacion_id);
                        }}
                        className="ml-0.5 text-emerald-700 hover:text-red-600"
                        aria-label={`Revocar ${otorgada.nombre}`}
                      >
                        <X className="h-3 w-3 rounded-full border border-transparent dark:hover:!border-accent/60 hover:border-red-300" />
                      </button>
                    </span>
                  ))}
                  {(certificationsByCompany[grantCompanyId] || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Esta empresa no tiene sellos vigentes.</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}



