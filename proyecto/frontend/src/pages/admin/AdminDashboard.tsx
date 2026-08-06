import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, MessageSquare, RefreshCw, Search, Shield, Users, X } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import {
  adminService,
  type AdminConversacion,
  type AdminCotizacionAbierta,
  type AdminMensaje,
  type AdminMetricas,
  type AdminUser,
} from "@/services/admin.service";
import type { BackendImporter } from "@/services/business.service";

type AdminTab = "empresas" | "usuarios" | "metricas" | "chats";
type InviteRole = "solicitante" | "importador" | "asesor" | "admin";

type CompanyUiDetails = {
  nit: string;
  telefono: string;
  direccion: string;
  email_contacto: string;
};

type CompanyFormState = {
  nombre_empresa: string;
  email_dueño: string;
  password_dueño: string;
  nombre_dueño: string;
  especialidad_producto: string;
  paises_origen: string;
  tiempo_respuesta_promedio: string;
  capacidad_volumen: string;
  solo_cotizaciones_directas: boolean;
  nit: string;
  telefono: string;
  direccion: string;
  email_contacto: string;
};

type UserFormState = {
  nombre: string;
  email: string;
  password: string;
  rol: InviteRole;
  telefono: string;
  indicativo_pais_telefono: string;
  companyId: string;
  companyName: string;
};

interface AdminDashboardProps {
  onRefreshGlobal?: () => Promise<void>;
}

const ADMIN_TABS: Array<{ id: AdminTab; label: string }> = [
  { id: "metricas", label: "Resumen / General" },
  { id: "empresas", label: "Empresas / Importadores" },
  { id: "usuarios", label: "Usuarios y Roles" },
  { id: "chats", label: "Supervisión de chats" },
];

const ROLE_OPTIONS = ["todos", "solicitante", "importador", "asesor", "admin"] as const;

type RoleFilter = (typeof ROLE_OPTIONS)[number];
type ActiveFilter = "todos" | "activos" | "inactivos";

const ADMIN_COMPANY_DETAILS_STORAGE_KEY = "admin-company-ui-details";

const EMPTY_IMPORTER_FORM: CompanyFormState = {
  nombre_empresa: "",
  email_dueño: "",
  password_dueño: "",
  nombre_dueño: "",
  especialidad_producto: "",
  paises_origen: "",
  tiempo_respuesta_promedio: "~48h",
  capacidad_volumen: "",
  solo_cotizaciones_directas: false,
  nit: "",
  telefono: "",
  direccion: "",
  email_contacto: "",
};

const EMPTY_USER_FORM: UserFormState = {
  nombre: "",
  email: "",
  password: "",
  rol: "solicitante",
  telefono: "",
  indicativo_pais_telefono: "+57",
  companyId: "",
  companyName: "",
};

function parseCsvField(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function normalizeRole(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function loadCompanyUiDetails(): Record<string, CompanyUiDetails> {
  try {
    const raw = localStorage.getItem(ADMIN_COMPANY_DETAILS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, CompanyUiDetails>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveCompanyUiDetails(next: Record<string, CompanyUiDetails>): void {
  localStorage.setItem(ADMIN_COMPANY_DETAILS_STORAGE_KEY, JSON.stringify(next));
}

export function AdminDashboard({ onRefreshGlobal }: AdminDashboardProps) {
  const [tab, setTab] = useState<AdminTab>("metricas");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { user, appRole } = useAuth();
  const normalizedRole = normalizeRole(user?.rol);
  const isAdmin = Boolean(user?.rol && ["ADMIN", "SUPERADMIN", "ADMINISTRADOR", "ADMIN_ROLE"].includes(String(user.rol).toUpperCase())) || normalizedRole.includes("admin") || appRole === "admin";

  const [companies, setCompanies] = useState<BackendImporter[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [metrics, setMetrics] = useState<AdminMetricas | null>(null);
  const [openQuotes, setOpenQuotes] = useState<AdminCotizacionAbierta[]>([]);

  const [userRoleFilter, setUserRoleFilter] = useState<RoleFilter>("todos");
  const [userActiveFilter, setUserActiveFilter] = useState<ActiveFilter>("todos");

  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [companyUiDetails, setCompanyUiDetails] = useState<Record<string, CompanyUiDetails>>(() => loadCompanyUiDetails());
  const [companyForm, setCompanyForm] = useState(EMPTY_IMPORTER_FORM);
  const [userForm, setUserForm] = useState<UserFormState>(EMPTY_USER_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const metricsSectionRef = useRef<HTMLElement | null>(null);
  const companiesSectionRef = useRef<HTMLElement | null>(null);
  const usersSectionRef = useRef<HTMLElement | null>(null);
  const chatsSectionRef = useRef<HTMLElement | null>(null);

  // Supervisión de chats (solo lectura).
  const [conversations, setConversations] = useState<AdminConversacion[]>([]);
  const [conversationsTotal, setConversationsTotal] = useState(0);
  const [conversationSearch, setConversationSearch] = useState("");
  const [openConversation, setOpenConversation] = useState<AdminConversacion | null>(null);
  const [conversationMessages, setConversationMessages] = useState<AdminMensaje[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const usersByRole = useMemo(() => {
    return users.reduce<Record<string, number>>((acc, item) => {
      const key = String(item.rol || "sin-rol");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [users]);

  const userFilters = useMemo(() => {
    return {
      rol: userRoleFilter === "todos" ? undefined : userRoleFilter,
      activo:
        userActiveFilter === "todos" ? undefined : userActiveFilter === "activos",
    };
  }, [userRoleFilter, userActiveFilter]);

  const companyNameById = useMemo(
    () => Object.fromEntries(companies.map((company) => [company.id, company.nombre_empresa])),
    [companies],
  );

  const ownerEmailByCompanyId = useMemo(() => {
    return users.reduce<Record<string, string>>((acc, item) => {
      if (item.importador_id && normalizeRole(item.rol) === "importador") {
        acc[item.importador_id] = item.email;
      }
      return acc;
    }, {});
  }, [users]);

  const reloadAdminData = useCallback(async () => {
    if (!isAdmin) {
      setError("Tu sesión no tiene permisos administrativos para cargar este panel.");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const [companyRows, userRows, metricsRow, openQuoteRows, conversationRows] = await Promise.all([
        adminService.listCompanies(),
        adminService.listUsers(userFilters),
        adminService.getMetricas(),
        adminService.listOpenQuotes(),
        adminService.listConversations({ buscar: conversationSearch }),
      ]);

      setCompanies(companyRows);
      setUsers(userRows);
      setMetrics(metricsRow);
      setOpenQuotes(openQuoteRows);
      setConversations(conversationRows.items);
      setConversationsTotal(conversationRows.total);
    } catch (requestError) {
      const errorMessage = requestError instanceof Error ? requestError.message : "No se pudo cargar el panel de administracion.";
      setError(`Error cargando datos del panel: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, userFilters, conversationSearch]);

  /** Abre el historial de una conversación en modo lectura. */
  const openConversationDetail = useCallback(async (conversation: AdminConversacion) => {
    setOpenConversation(conversation);
    setConversationMessages([]);
    setIsLoadingMessages(true);
    try {
      setConversationMessages(await adminService.getConversationMessages(conversation.id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo abrir la conversación.");
      setOpenConversation(null);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setError("Tu sesión no tiene permisos administrativos para cargar este panel.");
      return;
    }
    void reloadAdminData();
  }, [isAdmin, reloadAdminData]);

  async function refreshAll() {
    await reloadAdminData();
    if (onRefreshGlobal) {
      await onRefreshGlobal();
    }
  }

  async function handleCreateCompany() {
    setSubmitting(true);
    setStatusMessage("");
    setError("");

    try {
      const especialidades = parseCsvField(companyForm.especialidad_producto);
      const paises = parseCsvField(companyForm.paises_origen);

      if (!companyForm.nombre_empresa || !companyForm.email_dueño || !companyForm.password_dueño) {
        throw new Error("Nombre de empresa, email dueno y password del dueno son obligatorios.");
      }

      const created = await adminService.createImporterWithOwner({
        nombre_empresa: companyForm.nombre_empresa,
        email_dueño: companyForm.email_dueño,
        password_dueño: companyForm.password_dueño,
        nombre_dueño: companyForm.nombre_dueño || undefined,
        especialidad_producto: especialidades,
        paises_origen: paises,
        tiempo_respuesta_promedio: companyForm.tiempo_respuesta_promedio || "~48h",
        capacidad_volumen: companyForm.capacidad_volumen ? Number(companyForm.capacidad_volumen) : undefined,
        solo_cotizaciones_directas: companyForm.solo_cotizaciones_directas,
      });

      const nextDetails = {
        ...companyUiDetails,
        [created.importador.id]: {
          nit: companyForm.nit,
          telefono: companyForm.telefono,
          direccion: companyForm.direccion,
          email_contacto: companyForm.email_contacto || companyForm.email_dueño,
        },
      };
      setCompanyUiDetails(nextDetails);
      saveCompanyUiDetails(nextDetails);

      setCompanyForm(EMPTY_IMPORTER_FORM);
      setShowCompanyModal(false);
      setStatusMessage("Empresa creada correctamente.");
      await refreshAll();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo crear la empresa.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleUserStatus(user: AdminUser) {
    setError("");
    try {
      await adminService.updateUserStatus(user.id, !user.activo);
      await reloadAdminData();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "No se pudo actualizar el estado del usuario.");
    }
  }

  async function handleToggleCompanyStatus(company: BackendImporter) {
    setError("");
    try {
      const nextStatus = company.estado === "inactivo" ? "activo" : "inactivo";
      await adminService.updateImporterStatus(company.id, nextStatus);
      await reloadAdminData();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "No se pudo actualizar el estado de la empresa.");
    }
  }

  async function handleVerifyCompany(companyId: string) {
    setError("");
    try {
      await adminService.verifyImporter(companyId);
      await reloadAdminData();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "No se pudo verificar la empresa.");
    }
  }

  async function handleInviteUser() {
    setSubmitting(true);
    setStatusMessage("");
    setError("");

    try {
      if (userForm.rol === "asesor" || userForm.rol === "admin") {
        throw new Error("Con los endpoints actuales solo puedes crear solicitantes o importadores desde este panel.");
      }

      if (userForm.rol === "importador") {
        if (!userForm.nombre || !userForm.email || !userForm.password) {
          throw new Error("Para rol importador debes completar nombre, email y password.");
        }

        await adminService.createImporterWithOwner({
          nombre_empresa: userForm.companyName.trim() || `Empresa ${userForm.nombre}`,
          email_dueño: userForm.email,
          password_dueño: userForm.password,
          nombre_dueño: userForm.nombre,
          especialidad_producto: ["General"],
          paises_origen: ["Colombia"],
          tiempo_respuesta_promedio: "~48h",
        });
        setStatusMessage("Usuario importador creado con su empresa base.");
      } else {
        await adminService.inviteSolicitante({
          email: userForm.email,
          password: userForm.password,
          nombre: userForm.nombre,
          telefono: userForm.telefono || "0000000000",
          indicativo_pais_telefono: userForm.indicativo_pais_telefono || "+57",
        });
        setStatusMessage("Invitacion de solicitante enviada correctamente.");
      }

      setUserForm(EMPTY_USER_FORM);
      setShowUserModal(false);
      await refreshAll();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "No se pudo crear/invitar el usuario.");
    } finally {
      setSubmitting(false);
    }
  }

  function focusSection(nextTab: AdminTab): void {
    setTab(nextTab);

    const target =
      nextTab === "metricas"
        ? metricsSectionRef.current
        : nextTab === "empresas"
          ? companiesSectionRef.current
          : nextTab === "chats"
            ? chatsSectionRef.current
            : usersSectionRef.current;

    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Panel de Administracion</h1>
            <p className="text-sm text-muted-foreground">Gestion centralizada de empresas, usuarios y estado operativo.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void refreshAll();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" />
            Refrescar
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {ADMIN_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => focusSection(item.id)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                tab === item.id ? "bg-primary text-white" : "bg-muted text-foreground hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">Cargando datos administrativos...</div>
      ) : null}

      {statusMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{statusMessage}</div>
      ) : null}

      <section ref={metricsSectionRef} className="space-y-4 scroll-mt-6">
        <div className="flex items-center justify-between rounded-xl border border-border bg-white p-4 shadow-sm">
          <div>
            <p className="text-base font-semibold">Resumen / General</p>
            <p className="text-sm text-muted-foreground">Vista ejecutiva con métricas y actividad reciente del sistema.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" /> Empresas activas
            </div>
            <p className="text-2xl font-semibold text-foreground">{metrics?.importadores_activos ?? 0}</p>
            <p className="text-xs text-muted-foreground">Verificadas: {metrics?.importadores_verificados ?? 0}</p>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" /> Cotizaciones
            </div>
            <p className="text-2xl font-semibold text-foreground">{metrics?.total_cotizaciones ?? 0}</p>
            <p className="text-xs text-muted-foreground">Abiertas: {metrics?.cotizaciones_abiertas ?? 0}</p>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" /> Salud operativa
            </div>
            <p className="text-2xl font-semibold text-foreground">{metrics?.ordenes_en_disputa ?? 0}</p>
            <p className="text-xs text-muted-foreground">Ordenes en disputa</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold">Cotizaciones abiertas recientes</h3>
          <p className="text-sm text-muted-foreground">Resumen de actividad para seguimiento administrativo.</p>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2">Pais</th>
                  <th className="px-3 py-2">Linea</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {openQuotes.slice(0, 12).map((quote) => (
                  <tr key={quote.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-foreground">{quote.nombre_producto}</td>
                    <td className="px-3 py-2 text-muted-foreground">{quote.pais_importacion}</td>
                    <td className="px-3 py-2 text-muted-foreground">{quote.linea_producto}</td>
                    <td className="px-3 py-2 text-muted-foreground">{quote.estado}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDate(quote.fecha_creacion)}</td>
                  </tr>
                ))}
                {!openQuotes.length && !isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      No hay cotizaciones abiertas registradas.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section ref={companiesSectionRef} className="space-y-4 scroll-mt-6">
          <div className="flex items-center justify-between rounded-xl border border-border bg-white p-4 shadow-sm">
            <div>
              <p className="text-base font-semibold">Empresas / Importadores</p>
              <p className="text-sm text-muted-foreground">Crea empresas importadoras y revisa su información administrativa principal.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowCompanyModal(true)}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Crear Empresa
            </button>
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
                  <tr key={company.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{company.nombre_empresa}</div>
                      <div className="text-xs text-muted-foreground">{company.especialidad_producto.join(", ") || "General"}</div>
                      <div className="text-xs text-muted-foreground">Cuenta dueña: {ownerEmailByCompanyId[company.id] || "No disponible"}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{companyUiDetails[company.id]?.nit || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{companyUiDetails[company.id]?.email_contacto || ownerEmailByCompanyId[company.id] || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{companyUiDetails[company.id]?.telefono || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{companyUiDetails[company.id]?.direccion || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{company.paises_origen[0] || "N/A"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${company.estado === "activo" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                        {company.estado || "activo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{company.verificado ? "Si" : "No"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void handleToggleCompanyStatus(company);
                          }}
                          className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                        >
                          {company.estado === "inactivo" ? "Activar" : "Desactivar"}
                        </button>
                        {!company.verificado ? (
                          <button
                            type="button"
                            onClick={() => {
                              void handleVerifyCompany(company.id);
                            }}
                            className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                          >
                            Verificar
                          </button>
                        ) : null}
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

      <section ref={usersSectionRef} className="space-y-4 scroll-mt-6">
          <div className="flex items-center justify-between rounded-xl border border-border bg-white p-4 shadow-sm">
            <div>
              <p className="text-base font-semibold">Gestión de Usuarios</p>
              <p className="text-sm text-muted-foreground">Administra usuarios, roles visibles y su empresa asignada cuando aplique.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowUserModal(true)}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
                    onChange={(event) => setUserRoleFilter(event.target.value as RoleFilter)}
                    className="h-9 rounded-lg border border-border px-2 text-sm"
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <select
                    value={userActiveFilter}
                    onChange={(event) => setUserActiveFilter(event.target.value as ActiveFilter)}
                    className="h-9 rounded-lg border border-border px-2 text-sm"
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
                      <tr key={user.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          <div className="font-medium text-foreground">{user.nombre || user.email}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{user.importador_id ? companyNameById[user.importador_id] || user.importador_id : "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{user.rol}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${user.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                            {user.activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{formatDate(user.fecha_creacion)}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              void handleToggleUserStatus(user);
                            }}
                            className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
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
              <p className="mt-1 text-xs text-muted-foreground">La creación directa soportada por API actual es para solicitantes e importadores.</p>
              <div className="mt-4 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">Distribucion actual por rol:</p>
                {Object.entries(usersByRole).map(([role, total]) => (
                  <p key={role}>
                    {role}: {total}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </section>

      <section ref={chatsSectionRef} className="space-y-4 scroll-mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <div>
            <p className="flex items-center gap-2 text-base font-semibold">
              <MessageSquare className="h-4 w-4 text-primary" />
              Supervisión de chats
            </p>
            <p className="text-sm text-muted-foreground">
              Todas las conversaciones entre cotizantes y empresas. Solo lectura: el equipo supervisa, no interviene en la negociación.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{conversationsTotal} conversaciones</span>
        </div>

        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={conversationSearch}
                onChange={(event) => setConversationSearch(event.target.value)}
                placeholder="Buscar por cotizante, asesor o empresa..."
                className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-sm"
              />
            </div>
            {conversationSearch ? (
              <button
                type="button"
                onClick={() => setConversationSearch("")}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Limpiar
              </button>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3">Cotizante</th>
                  <th className="py-2 pr-3">Empresa / asesor</th>
                  <th className="py-2 pr-3">Último mensaje</th>
                  <th className="py-2 pr-3 text-right">Mensajes</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {conversations.map((conversation) => (
                  <tr key={conversation.id} className="border-b border-border/60 align-top">
                    <td className="py-3 pr-3">
                      <p className="font-medium text-foreground">{conversation.solicitante_nombre || "Sin nombre"}</p>
                      <p className="text-xs text-muted-foreground">{conversation.solicitante_email || conversation.solicitante_id}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <p className="font-medium text-foreground">{conversation.empresa_nombre || "Empresa no identificada"}</p>
                      <p className="text-xs text-muted-foreground">
                        {conversation.importador_usuario_nombre || conversation.importador_usuario_email || conversation.importador_usuario_id}
                      </p>
                    </td>
                    <td className="py-3 pr-3">
                      <p className="line-clamp-2 max-w-sm text-xs text-muted-foreground">
                        {conversation.ultimo_mensaje_texto || "Sin mensajes"}
                      </p>
                      {conversation.ultimo_mensaje_fecha ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                          {new Date(conversation.ultimo_mensaje_fecha).toLocaleString("es-CO")}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 text-right font-medium">{conversation.total_mensajes}</td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          void openConversationDetail(conversation);
                        }}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        Ver conversación
                      </button>
                    </td>
                  </tr>
                ))}
                {conversations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      No hay conversaciones que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {openConversation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 className="text-base font-semibold">
                  {openConversation.solicitante_nombre || openConversation.solicitante_email} · {openConversation.empresa_nombre || "Empresa"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Cotización {openConversation.cotizacion_id.slice(0, 8).toUpperCase()}
                  {openConversation.orden_id ? ` · Orden ${openConversation.orden_id.slice(0, 8).toUpperCase()}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenConversation(null)}
                className="rounded-md border border-border p-1.5 hover:bg-muted"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {isLoadingMessages ? (
                <p className="text-sm text-muted-foreground">Cargando conversación...</p>
              ) : null}
              {!isLoadingMessages && conversationMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Esta conversación todavía no tiene mensajes.</p>
              ) : null}
              {conversationMessages.map((message) => {
                const esSolicitante = message.remitente_id === openConversation.solicitante_id;
                return (
                  <div
                    key={message.id}
                    className={`rounded-lg border p-3 ${
                      message.tipo === "sistema"
                        ? "border-border bg-muted/50"
                        : esSolicitante
                          ? "border-blue-100 bg-blue-50"
                          : "border-emerald-100 bg-emerald-50"
                    }`}
                  >
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {message.remitente_nombre || message.remitente_email || message.remitente_id}
                        {message.remitente_rol ? <span className="ml-1 font-normal text-muted-foreground">({message.remitente_rol})</span> : null}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(message.fecha_envio).toLocaleString("es-CO")}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-foreground">{message.contenido}</p>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border p-3 text-center text-xs text-muted-foreground">
              Vista de solo lectura para auditoría. Los participantes no ven que estás consultando el hilo.
            </div>
          </div>
        </div>
      ) : null}

      {showCompanyModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Crear empresa importadora</h2>
              <button
                type="button"
                onClick={() => setShowCompanyModal(false)}
                className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
              >
                Cerrar
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={companyForm.nombre_empresa}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, nombre_empresa: event.target.value }))}
                placeholder="Nombre empresa"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <input
                value={companyForm.nombre_dueño}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, nombre_dueño: event.target.value }))}
                placeholder="Nombre dueno"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <input
                value={companyForm.email_dueño}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, email_dueño: event.target.value }))}
                placeholder="Email dueno"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <input
                value={companyForm.email_contacto}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, email_contacto: event.target.value }))}
                placeholder="Email contacto"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <input
                value={companyForm.password_dueño}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, password_dueño: event.target.value }))}
                placeholder="Password dueno"
                type="password"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <input
                value={companyForm.nit}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, nit: event.target.value }))}
                placeholder="NIT / RUT"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <input
                value={companyForm.especialidad_producto}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, especialidad_producto: event.target.value }))}
                placeholder="Especialidades (CSV)"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <input
                value={companyForm.paises_origen}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, paises_origen: event.target.value }))}
                placeholder="Paises origen (CSV)"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <input
                value={companyForm.tiempo_respuesta_promedio}
                onChange={(event) =>
                  setCompanyForm((prev) => ({ ...prev, tiempo_respuesta_promedio: event.target.value }))
                }
                placeholder="Tiempo respuesta"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <input
                value={companyForm.capacidad_volumen}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, capacidad_volumen: event.target.value }))}
                placeholder="Capacidad volumen"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <input
                value={companyForm.telefono}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, telefono: event.target.value }))}
                placeholder="Telefono"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <input
                value={companyForm.direccion}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, direccion: event.target.value }))}
                placeholder="Direccion"
                className="h-9 rounded-lg border border-border px-3 text-sm md:col-span-2"
              />
              <label className="col-span-full flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={companyForm.solo_cotizaciones_directas}
                  onChange={(event) =>
                    setCompanyForm((prev) => ({
                      ...prev,
                      solo_cotizaciones_directas: event.target.checked,
                    }))
                  }
                />
                Solo cotizaciones directas
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCompanyModal(false)}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleCreateCompany();
                }}
                disabled={submitting}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? "Creando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showUserModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Crear / Invitar Usuario</h2>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
              >
                Cerrar
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={userForm.nombre}
                onChange={(event) => setUserForm((prev) => ({ ...prev, nombre: event.target.value }))}
                placeholder="Nombre"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <input
                value={userForm.email}
                onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="Email"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <input
                value={userForm.password}
                onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Contrasena temporal"
                type="password"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <select
                value={userForm.rol}
                onChange={(event) => setUserForm((prev) => ({ ...prev, rol: event.target.value as InviteRole }))}
                className="h-9 rounded-lg border border-border px-3 text-sm"
              >
                <option value="solicitante">Solicitante</option>
                <option value="importador">Importador</option>
                <option value="asesor">Asesor</option>
                <option value="admin">Admin</option>
              </select>

              <input
                value={userForm.indicativo_pais_telefono}
                onChange={(event) => setUserForm((prev) => ({ ...prev, indicativo_pais_telefono: event.target.value }))}
                placeholder="Indicativo (+57)"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <input
                value={userForm.telefono}
                onChange={(event) => setUserForm((prev) => ({ ...prev, telefono: event.target.value }))}
                placeholder="Telefono"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />

              <select
                value={userForm.companyId}
                onChange={(event) => setUserForm((prev) => ({ ...prev, companyId: event.target.value }))}
                className="h-9 rounded-lg border border-border px-3 text-sm"
              >
                <option value="">Sin empresa asignada</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.nombre_empresa}
                  </option>
                ))}
              </select>

              <input
                value={userForm.companyName}
                onChange={(event) => setUserForm((prev) => ({ ...prev, companyName: event.target.value }))}
                placeholder="Nombre de empresa (si rol importador)"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
            </div>

            <div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              {userForm.rol === "asesor" || userForm.rol === "admin"
                ? "Con la API actual, las altas directas disponibles en este panel son para solicitantes e importadores."
                : "El formulario usará los endpoints existentes del frontend vía apiRequest."}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleInviteUser();
                }}
                disabled={submitting}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? "Guardando..." : "Crear / Invitar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
