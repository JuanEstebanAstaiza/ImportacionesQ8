import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Mail, Send } from "lucide-react";

import {
  adminService,
  type AdminUser,
} from "@/services/admin.service";

const SEGMENTS = [
  { value: "solicitante", label: "Cotizantes" },
  { value: "importador", label: "Empresas importadoras" },
  { value: "asesor", label: "Asesores" },
  { value: "soporte", label: "Soporte" },
  { value: "admin", label: "Administradores" },
] as const;

type CampaignForm = {
  asunto: string;
  cuerpo: string;
  roles: string[];
  usuarios_ids: string[];
  correos: string;
};

const EMPTY_FORM: CampaignForm = {
  asunto: "",
  cuerpo: "",
  roles: [],
  usuarios_ids: [],
  correos: "",
};

function inputClassName(): string {
  return "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary dark:focus:border-accent";
}

export function AdminEmailCampaign() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [form, setForm] = useState<CampaignForm>(EMPTY_FORM);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    adminService.listUsers({ activo: true })
      .then((rows) => {
        if (active) setUsers(rows);
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los usuarios.");
      })
      .finally(() => {
        if (active) setLoadingUsers(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedCount = useMemo(() => {
    const specificEmails = form.correos.split(",").map((email) => email.trim()).filter(Boolean);
    const roleUsers = users.filter((user) => form.roles.includes(user.rol)).length;
    return new Set([...specificEmails, ...form.usuarios_ids, ...Array.from({ length: roleUsers }, (_, index) => `role-${index}`)]).size;
  }, [form.correos, form.roles, form.usuarios_ids, users]);

  function toggleRole(role: string) {
    setForm((current) => ({
      ...current,
      roles: current.roles.includes(role) ? current.roles.filter((item) => item !== role) : [...current.roles, role],
    }));
  }

  function toggleUser(userId: string) {
    setForm((current) => ({
      ...current,
      usuarios_ids: current.usuarios_ids.includes(userId)
        ? current.usuarios_ids.filter((id) => id !== userId)
        : [...current.usuarios_ids, userId],
    }));
  }

  async function sendCampaign() {
    setError("");
    setMessage("");
    const correos = form.correos.split(",").map((email) => email.trim()).filter(Boolean);
    if (!form.asunto.trim() || !form.cuerpo.trim()) {
      setError("Completa el asunto y el mensaje.");
      return;
    }
    if (!form.roles.length && !form.usuarios_ids.length && !correos.length) {
      setError("Selecciona al menos un segmento, usuario o correo específico.");
      return;
    }

    setSending(true);
    try {
      const result = await adminService.sendBulkEmail({
        asunto: form.asunto.trim(),
        cuerpo: form.cuerpo.trim(),
        roles: form.roles,
        usuarios_ids: form.usuarios_ids,
        correos,
      });
      setMessage(`Campaña procesada: ${result.enviados} enviados de ${result.destinatarios}.`);
      if (result.fallidos > 0) {
        setError(`No se pudieron enviar ${result.fallidos} mensajes.`);
      }
      setForm((current) => ({ ...EMPTY_FORM, asunto: current.asunto }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo enviar la campaña.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="space-y-4 scroll-mt-6">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:bg-card/80">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Envío de correos</h2>
            <p className="text-sm text-muted-foreground">Redacta un correo y envíalo a segmentos completos o a destinatarios concretos.</p>
          </div>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-300/60 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">{error}</div> : null}
      {message ? <div className="flex items-center gap-2 rounded-lg border border-emerald-300/60 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />{message}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:bg-card/80">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Asunto</label>
              <input className={inputClassName()} maxLength={180} value={form.asunto} onChange={(event) => setForm((current) => ({ ...current, asunto: event.target.value }))} placeholder="Novedades importantes de Zarpi" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Mensaje</label>
              <textarea className={`${inputClassName()} min-h-64 resize-y`} maxLength={20000} value={form.cuerpo} onChange={(event) => setForm((current) => ({ ...current, cuerpo: event.target.value }))} placeholder="Escribe el contenido del correo..." />
              <p className="mt-1 text-right text-[11px] text-muted-foreground">{form.cuerpo.length.toLocaleString("es-CO")} / 20.000</p>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">Los correos se envían desde la cuenta SMTP configurada en el backend.</p>
              <button type="button" disabled={sending} onClick={() => { void sendCampaign(); }} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-accent dark:text-accent-foreground">
                <Send className="h-4 w-4" />{sending ? "Enviando..." : "Enviar campaña"}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:bg-card/80">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Segmentos</h3>
                <p className="text-xs text-muted-foreground">Se combinan y se deduplican.</p>
              </div>
              <span className="text-xs font-semibold text-primary dark:text-accent">{selectedCount} aprox.</span>
            </div>
            <div className="space-y-2">
              {SEGMENTS.map((segment) => (
                <label key={segment.value} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={form.roles.includes(segment.value)} onChange={() => toggleRole(segment.value)} className="h-4 w-4 rounded border-border accent-primary" />
                  {segment.label}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:bg-card/80">
            <h3 className="mb-1 text-sm font-semibold text-foreground">Usuarios específicos</h3>
            <p className="mb-2 text-xs text-muted-foreground">Selecciona cuentas activas.</p>
            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {loadingUsers ? <p className="text-xs text-muted-foreground">Cargando usuarios...</p> : users.map((user) => (
                <label key={user.id} className="flex cursor-pointer items-start gap-2 text-xs text-foreground">
                  <input type="checkbox" checked={form.usuarios_ids.includes(user.id)} onChange={() => toggleUser(user.id)} className="mt-0.5 h-4 w-4 rounded border-border accent-primary" />
                  <span className="min-w-0"><span className="block truncate font-medium">{user.nombre || user.email}</span><span className="block truncate text-muted-foreground">{user.email} · {user.rol}</span></span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:bg-card/80">
            <label className="mb-1 block text-sm font-semibold text-foreground">Correos específicos</label>
            <p className="mb-2 text-xs text-muted-foreground">Sepáralos por coma.</p>
            <textarea className={`${inputClassName()} min-h-20 resize-y`} value={form.correos} onChange={(event) => setForm((current) => ({ ...current, correos: event.target.value }))} placeholder="persona@dominio.com, otra@dominio.com" />
          </div>
        </div>
      </div>
    </section>
  );
}
