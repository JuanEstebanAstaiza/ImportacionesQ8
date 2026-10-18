import { useCallback, useEffect, useMemo, useRef, useState } from "react";


import { useAuth } from "@/hooks/useAuth";
import {
  adminService,
  type AdminCertificacion,
  type AdminConversacion,
  type AdminAgenteSoporte,
  type AdminDisputa,
  type ExpedienteVerificacion,
  type AdminMensaje,
  type AdminUser,
  type CategoriaCotizante,
} from "@/services/admin.service";

import { businessService } from "@/services/business.service";
import { tendenciasService } from "@/services/tendencias.service";

import { toApiPath } from "@/services/api-client";
import type { BackendImporter } from "@/services/business.service";
import { adminTabFromPath, type AdminTab } from "@/app/rutas";
import {
  AdminSectionHeader,
  AdminAsignacionTab,
  AdminCertificacionesTab,
  AdminCorreosTab,
  AdminCotizantesTab,
  AdminEmpresasTab,
  AdminLandingTab,
  AdminMetricasTab,
  AdminRespaldosTab,
  AdminSoporteTab,
  AdminTendenciasAprobacionTab,
  AdminTendenciasTab,
  AdminUsuariosTab,
  ConversationDetailModal,
  VerificationExpedienteModal,
  DisputeResolutionModal,
  CompanyCreationModal,
  UserCreationModal,
} from "@/components/admin";

type InviteRole = "solicitante" | "importador" | "asesor" | "admin" | "soporte" | "designer";

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
  /** Representante legal (cuenta dueña) y datos legales: los del registro de persona jurídica. */
  apellido_dueño: string;
  tipo_documento_dueño: string;
  numero_documento_dueño: string;
  indicativo_dueño: string;
  razon_social: string;
  especialidad_producto: string;
  paises_origen: string;
  tiempo_respuesta_promedio: string;
  solo_cotizaciones_directas: boolean;
  nit: string;
  telefono: string;
  direccion: string;
  email_contacto: string;
  logo_url: string;
  sitio_web: string;
};

type UserFormState = {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  rol: InviteRole;
  telefono: string;
  indicativo_pais_telefono: string;
  /** Cotizante: los mismos datos del registro público. */
  tipoPersona: "natural" | "juridica";
  tipoDocumento: string;
  numeroDocumento: string;
  nit: string;
  razonSocial: string;
  tokensIniciales: string;
  /** "" = automático (Bronze y sube por actividad) o el de la categoría. */
  tier: "" | "Bronze" | "Silver" | "Gold" | "Élite";
  categoriaId: string;
  /** Empresa importadora: nombre comercial y ficha básica. */
  companyName: string;
  especialidades: string[];
  paises: string;
  tiempoRespuesta: string;
  /** Solo para el rol de atención al cliente: nivel de la mesa (1-3). */
  nivelSoporte: number;
};

export interface AdminDashboardProps {
  onRefreshGlobal?: () => Promise<void>;
  /** Fallback para consumidores embebidos; la URL tiene prioridad. */
  section?: AdminTab;
}

/**
 * Qué hace cada área. La navegación entre ellas es el sidebar de la aplicación
 * —igual que en los demás perfiles—, y cada una tiene su propia URL; aquí solo
 * queda el subtítulo que explica dónde está el usuario.
 */
const ADMIN_SECTION_HINTS: Record<AdminTab, { label: string; hint: string }> = {
  metricas: { label: "Resumen", hint: "Cómo va la plataforma" },
  empresas: { label: "Empresas", hint: "Alta y estado de importadoras" },
  usuarios: { label: "Usuarios", hint: "Cuentas, roles y acceso" },
  cotizantes: { label: "Cotizantes", hint: "Tiers, umbrales y puntos" },
  soporte: { label: "Soporte", hint: "Incidentes y dudas" },
  certificaciones: { label: "Certificaciones", hint: "Sellos de la plataforma" },
  respaldos: { label: "Respaldos", hint: "Copias de seguridad y restauración" },
  asignacion: { label: "Asignación", hint: "A qué empresas llega cada solicitud abierta" },
  landing: { label: "Landing", hint: "Contenido publico por bloques" },
  correos: { label: "Correos", hint: "Campañas y avisos a usuarios" },
  tendencias: { label: "Tendencias", hint: "Catálogo de contenido viral" },
  "tendencias-aprobacion": { label: "Aprobación de tendencias", hint: "Revisión y publicación de contenido" },
};

const ROLE_OPTIONS = ["todos", "solicitante", "importador", "asesor", "soporte", "designer", "admin"] as const;

type RoleFilter = (typeof ROLE_OPTIONS)[number];
type ActiveFilter = "todos" | "activos" | "inactivos";

const ADMIN_COMPANY_DETAILS_STORAGE_KEY = "admin-company-ui-details";

const CONVERSACIONES_POR_PAGINA = 25;

const EMPTY_IMPORTER_FORM: CompanyFormState = {
  nombre_empresa: "",
  email_dueño: "",
  password_dueño: "",
  nombre_dueño: "",
  apellido_dueño: "",
  tipo_documento_dueño: "CC",
  numero_documento_dueño: "",
  indicativo_dueño: "+57",
  razon_social: "",
  especialidad_producto: "",
  paises_origen: "",
  tiempo_respuesta_promedio: "~48h",
  solo_cotizaciones_directas: false,
  nit: "",
  telefono: "",
  direccion: "",
  email_contacto: "",
  logo_url: "",
  sitio_web: "",
};

const EMPTY_USER_FORM: UserFormState = {
  nombre: "",
  apellido: "",
  email: "",
  password: "",
  rol: "solicitante",
  telefono: "",
  indicativo_pais_telefono: "+57",
  tipoPersona: "natural",
  tipoDocumento: "CC",
  numeroDocumento: "",
  nit: "",
  razonSocial: "",
  tokensIniciales: "0",
  tier: "",
  categoriaId: "",
  companyName: "",
  especialidades: [],
  paises: "China",
  tiempoRespuesta: "~24h",
  nivelSoporte: 1,
};

type CertificationFormState = {
  nombre: string;
  descripcion: string;
  logo_url: string;
  peso_publicidad: string;
};

const EMPTY_CERTIFICATION_FORM: CertificationFormState = {
  nombre: "",
  descripcion: "",
  logo_url: "",
  // El peso decide qué tan arriba sale la empresa en el catálogo del solicitante.
  peso_publicidad: "10",
};

/** Formatos aceptados por gestión documental como imagen. */
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

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

/**
 * Lee una clave de `perfil_publico` (JSON libre) de una empresa.
 *
 * Los datos de contacto que el panel enseñaba salían del `localStorage` de este
 * navegador: otro administrador veía la columna vacía. Ahora se prefiere lo que
 * guarda el backend y el almacenamiento local queda solo como respaldo de las
 * empresas dadas de alta antes de este cambio.
 */
function leerPerfilPublico(company: BackendImporter, ...claves: string[]): string {
  const perfil = company.perfil_publico;
  if (!perfil || typeof perfil !== "object") {
    return "";
  }
  for (const clave of claves) {
    const valor = (perfil as Record<string, unknown>)[clave];
    if (typeof valor === "string" && valor.trim()) {
      return valor.trim();
    }
  }
  return "";
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

export function AdminDashboard({ onRefreshGlobal, section }: AdminDashboardProps) {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const syncPath = () => setPath(window.location.pathname);
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);
  const tab = section ? adminTabFromPath(path) : "metricas";
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { user, appRole, signOut } = useAuth();
  const normalizedRole = normalizeRole(user?.rol);
  const isAdmin = Boolean(user?.rol && ["ADMIN", "SUPERADMIN", "ADMINISTRADOR", "ADMIN_ROLE"].includes(String(user.rol).toUpperCase())) || normalizedRole.includes("admin") || appRole === "admin";
  // El equipo de atención al cliente entra solo a la sección de soporte. Pedir
  // empresas, cuentas o métricas desde su sesión devolvería 403 y tumbaría la
  // carga entera, así que ni se piden.
  const esSoporte = normalizedRole === "soporte" || appRole === "soporte";
  const esEquipo = isAdmin || esSoporte;

  const [companies, setCompanies] = useState<BackendImporter[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);

  const [userRoleFilter, setUserRoleFilter] = useState<RoleFilter>("todos");
  const [userActiveFilter, setUserActiveFilter] = useState<ActiveFilter>("todos");

  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  // Solo lectura: respaldo de las empresas dadas de alta cuando estos datos
  // vivían únicamente en el navegador del administrador.
  const companyUiDetails = useMemo(() => loadCompanyUiDetails(), []);
  const [companyForm, setCompanyForm] = useState(EMPTY_IMPORTER_FORM);
  const [userForm, setUserForm] = useState<UserFormState>(EMPTY_USER_FORM);
  const [categoriasCotizante, setCategoriasCotizante] = useState<CategoriaCotizante[]>([]);

  // Las categorías se crean en Cotizantes: se recargan cada vez que se abre el alta.
  useEffect(() => {
    if (!showUserModal) return;
    adminService.listarCategoriasCotizante().then(setCategoriasCotizante).catch(() => setCategoriasCotizante([]));
  }, [showUserModal]);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const companiesSectionRef = useRef<HTMLElement | null>(null);
  const usersSectionRef = useRef<HTMLElement | null>(null);
  const chatsSectionRef = useRef<HTMLElement | null>(null);

  // Soporte: conversaciones e incidentes.
  const [conversations, setConversations] = useState<AdminConversacion[]>([]);
  const [conversationsTotal, setConversationsTotal] = useState(0);
  const [conversationSearch, setConversationSearch] = useState("");
  // Sin esto el panel pedía 50 y se quedaba con esas: con 645 conversaciones,
  // 595 eran invisibles y nada lo indicaba.
  const [conversationPage, setConversationPage] = useState(0);
  const [openConversation, setOpenConversation] = useState<AdminConversacion | null>(null);
  const [conversationMessages, setConversationMessages] = useState<AdminMensaje[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [supportReply, setSupportReply] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [disputes, setDisputes] = useState<AdminDisputa[]>([]);
  // Expediente de la empresa que se está revisando para verificar.
  const [expediente, setExpediente] = useState<ExpedienteVerificacion | null>(null);
  const [cargandoExpediente, setCargandoExpediente] = useState(false);
  const [motivoRetiro, setMotivoRetiro] = useState("");
  const [procesandoSello, setProcesandoSello] = useState(false);
  const [supportTeam, setSupportTeam] = useState<AdminAgenteSoporte[]>([]);
  const [resolvingDispute, setResolvingDispute] = useState<AdminDisputa | null>(null);
  const [disputeResolution, setDisputeResolution] = useState("");
  const [isResolvingDispute, setIsResolvingDispute] = useState(false);

  // Certificaciones de plataforma y copia de seguridad.
  const certificationsSectionRef = useRef<HTMLElement | null>(null);
  const certificationLogoInputRef = useRef<HTMLInputElement | null>(null);
  const [certifications, setCertifications] = useState<AdminCertificacion[]>([]);
  const [certificationForm, setCertificationForm] = useState(EMPTY_CERTIFICATION_FORM);
  const [editingCertificationId, setEditingCertificationId] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingCompanyLogo, setIsUploadingCompanyLogo] = useState(false);
  const [grantCompanyId, setGrantCompanyId] = useState("");
  const [grantCertificationId, setGrantCertificationId] = useState("");

  /** Sellos vigentes por empresa, para pintarlos en la tabla de otorgamiento. */
  const certificationsByCompany = useMemo(() => {
    return companies.reduce<Record<string, BackendImporter["certificaciones"]>>((acc, company) => {
      acc[company.id] = company.certificaciones ?? [];
      return acc;
    }, {});
  }, [companies]);

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
    if (!esEquipo) {
      setError("Tu sesión no tiene permisos para cargar este panel.");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      // Lo que ve el equipo de atención: conversaciones e incidentes.
      const [conversationRows, disputeRows, teamRows] = await Promise.all([
        adminService.listConversations({
          buscar: conversationSearch,
          limit: CONVERSACIONES_POR_PAGINA,
          offset: conversationPage * CONVERSACIONES_POR_PAGINA,
        }),
        adminService.listDisputes().catch(() => [] as AdminDisputa[]),
        adminService.listSupportTeam().catch(() => [] as AdminAgenteSoporte[]),
      ]);

      setConversations(conversationRows.items);
      setConversationsTotal(conversationRows.total);
      setDisputes(disputeRows);
      setSupportTeam(teamRows);

      if (!isAdmin) {
        return;
      }

      // Y lo que solo corresponde a administración.
      const [companyRows, userRows, certificationRows] =
        await Promise.all([
          adminService.listCompanies(),
          adminService.listUsers(userFilters),
          adminService.listCertifications(),
        ]);

      setCompanies(companyRows);
      setUsers(userRows);
      setCertifications(certificationRows);
    } catch (requestError) {
      const errorMessage = requestError instanceof Error ? requestError.message : "No se pudo cargar el panel de administracion.";
      setError(`Error cargando datos del panel: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [esEquipo, isAdmin, userFilters, conversationSearch, conversationPage]);

  // Buscar reinicia la paginación: si no, con la página 3 abierta una búsqueda
  // con pocos resultados se vería vacía.
  useEffect(() => {
    setConversationPage(0);
  }, [conversationSearch]);

  /**
   * Sube el logo del sello a gestión documental. Tiene que vivir en la
   * plataforma para que el backend lo reconozca y lo sirva sin sesión en el
   * catálogo público.
   */
  /**
   * Logo de la empresa en el alta. Se sube a gestión documental igual que el
   * resto de imágenes públicas: el modal no tenía forma de adjuntarlo, así que
   * toda empresa nacía sin logo y había que entrar con su cuenta para ponerlo.
   */
  async function handleUploadCompanyLogo(archivo: File) {
    setError("");
    const extension = (archivo.name.split(".").pop() || "").toLowerCase();
    if (!LOGO_EXTENSIONS.includes(extension)) {
      setError(`Formato de logo no soportado (.${extension}). Usa PNG, JPG o WebP.`);
      return;
    }
    if (archivo.size > LOGO_MAX_BYTES) {
      setError("El logo supera 2 MB. Usa una imagen más liviana.");
      return;
    }

    setIsUploadingCompanyLogo(true);
    try {
      const subido = await businessService.uploadDocumentFile(archivo, null, "perfil-empresa");
      const url = toApiPath(subido.storage_url || `/documentos/archivos/${subido.id}/descargar`);
      setCompanyForm((prev) => ({ ...prev, logo_url: url }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo subir el logo.");
    } finally {
      setIsUploadingCompanyLogo(false);
    }
  }

  async function handleUploadCertificationLogo(archivo: File) {
    setError("");
    const extension = (archivo.name.split(".").pop() || "").toLowerCase();
    if (!LOGO_EXTENSIONS.includes(extension)) {
      setError(`Formato de logo no soportado (.${extension}). Usa PNG, JPG o WebP.`);
      return;
    }
    if (archivo.size > LOGO_MAX_BYTES) {
      setError("El logo supera 2 MB. Usa una imagen más liviana.");
      return;
    }

    setIsUploadingLogo(true);
    try {
      const subido = await businessService.uploadDocumentFile(archivo, null, "certificacion");
      const url = toApiPath(subido.storage_url || `/documentos/archivos/${subido.id}/descargar`);
      setCertificationForm((prev) => ({ ...prev, logo_url: url }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo subir el logo.");
    } finally {
      setIsUploadingLogo(false);
    }
  }

  async function handleSaveCertification() {
    setError("");
    setStatusMessage("");

    const nombre = certificationForm.nombre.trim();
    if (nombre.length < 2) {
      setError("La certificación necesita un nombre.");
      return;
    }

    const peso = Number(certificationForm.peso_publicidad);
    if (!Number.isFinite(peso) || peso < 0 || peso > 1000) {
      setError("El peso publicitario debe ser un número entre 0 y 1000.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        nombre,
        descripcion: certificationForm.descripcion.trim(),
        logo_url: certificationForm.logo_url.trim() || null,
        peso_publicidad: peso,
      };

      if (editingCertificationId) {
        await adminService.updateCertification(editingCertificationId, payload);
        setStatusMessage(`Certificación "${nombre}" actualizada.`);
      } else {
        await adminService.createCertification(payload);
        setStatusMessage(`Certificación "${nombre}" creada.`);
      }

      setCertificationForm(EMPTY_CERTIFICATION_FORM);
      setEditingCertificationId(null);
      await reloadAdminData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar la certificación.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEditingCertification(certificacion: AdminCertificacion) {
    setEditingCertificationId(certificacion.id);
    setCertificationForm({
      nombre: certificacion.nombre,
      descripcion: certificacion.descripcion || "",
      logo_url: certificacion.logo_url || "",
      peso_publicidad: String(certificacion.peso_publicidad ?? 0),
    });
    certificationsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleRetireCertification(certificacion: AdminCertificacion) {
    if (!confirm(`¿Retirar "${certificacion.nombre}" del catálogo Las ${certificacion.empresas_certificadas} empresa(s) que la tienen dejarán de mostrarla.`)) {
      return;
    }
    setError("");
    try {
      await adminService.retireCertification(certificacion.id);
      setStatusMessage(`Certificación "${certificacion.nombre}" retirada.`);
      await reloadAdminData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo retirar la certificación.");
    }
  }

  async function handleGrantCertification() {
    if (!grantCompanyId || !grantCertificationId) {
      setError("Elige empresa y certificación para otorgar el respaldo.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const resultado = await adminService.grantCertification(grantCompanyId, grantCertificationId);
      setStatusMessage(
        `Respaldo otorgado. La empresa queda con ${resultado.puntaje_publicidad} punto(s) de peso publicitario.`,
      );
      setGrantCertificationId("");
      await reloadAdminData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo otorgar la certificación.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevokeCertification(importadorId: string, certificacionId: string) {
    setError("");
    try {
      await adminService.revokeCertification(importadorId, certificacionId);
      setStatusMessage("Respaldo revocado. La empresa baja en el catálogo.");
      await reloadAdminData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo revocar la certificación.");
    }
  }

  /** Abre el historial de una conversación en modo lectura. */
  const openConversationDetail = useCallback(async (conversation: AdminConversacion) => {
    setOpenConversation(conversation);
    setConversationMessages([]);
    setSupportReply("");
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

  /** Responde en el hilo como equipo de la plataforma; avisa a las dos partes. */
  async function handleSendSupportReply() {
    const texto = supportReply.trim();
    if (!openConversation || !texto) {
      return;
    }
    setError("");
    setIsSendingReply(true);
    try {
      const enviado = await adminService.replyAsSupport(openConversation.id, texto);
      setConversationMessages((prev) => [...prev, enviado]);
      setSupportReply("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo enviar la respuesta.");
    } finally {
      setIsSendingReply(false);
    }
  }

  /** Sube o baja a un agente de nivel según vaya cogiendo experiencia. */
  async function handleChangeAgentLevel(usuarioId: string, nivel: number) {
    setError("");
    try {
      await adminService.setAgentLevel(usuarioId, nivel);
      setSupportTeam((prev) => prev.map((a) => (a.id === usuarioId ? { ...a, nivel } : a)));
      setStatusMessage(`Agente movido a nivel ${nivel}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cambiar el nivel.");
    }
  }

  /** Cierra el incidente dejando por escrito qué se hizo. */
  async function handleResolveDispute() {
    const texto = disputeResolution.trim();
    if (!resolvingDispute || texto.length < 5) {
      setError("Describe la resolución aplicada (mínimo 5 caracteres).");
      return;
    }
    setError("");
    setIsResolvingDispute(true);
    try {
      await adminService.resolveDispute(resolvingDispute.id, texto);
      setStatusMessage(`Incidente de la operación ${resolvingDispute.id.slice(0, 8).toUpperCase()} resuelto.`);
      setResolvingDispute(null);
      setDisputeResolution("");
      await reloadAdminData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo resolver el incidente.");
    } finally {
      setIsResolvingDispute(false);
    }
  }

  useEffect(() => {
    if (!esEquipo) {
      setError("Tu sesión no tiene permisos para cargar este panel.");
      return;
    }
    void reloadAdminData();
  }, [esEquipo, reloadAdminData]);

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

      const faltan = [
        !companyForm.nombre_empresa.trim() && "nombre comercial",
        !companyForm.razon_social.trim() && "razón social",
        !companyForm.nit.trim() && "NIT",
        !companyForm.nombre_dueño.trim() && "nombre del representante",
        !companyForm.apellido_dueño.trim() && "apellido del representante",
        !companyForm.numero_documento_dueño.trim() && "documento del representante",
        !companyForm.telefono.trim() && "teléfono",
        !companyForm.email_dueño.trim() && "correo de la cuenta dueña",
        !companyForm.password_dueño && "contraseña",
        especialidades.length === 0 && "al menos una especialidad",
      ].filter(Boolean);
      if (faltan.length > 0) {
        throw new Error(`Para la empresa falta: ${faltan.join(", ")}.`);
      }

      await adminService.createImporterWithOwner({
        nombre_empresa: companyForm.nombre_empresa,
        email_dueño: companyForm.email_dueño,
        password_dueño: companyForm.password_dueño,
        nombre_dueño: companyForm.nombre_dueño.trim() || undefined,
        apellido_dueño: companyForm.apellido_dueño.trim() || undefined,
        tipo_documento_dueño: companyForm.tipo_documento_dueño,
        numero_documento_dueño: companyForm.numero_documento_dueño.trim() || undefined,
        indicativo_dueño: companyForm.indicativo_dueño.trim() || "+57",
        telefono_dueño: companyForm.telefono.trim() || undefined,
        nit: companyForm.nit.trim() || undefined,
        razon_social: companyForm.razon_social.trim() || undefined,
        especialidad_producto: especialidades,
        paises_origen: paises,
        tiempo_respuesta_promedio: companyForm.tiempo_respuesta_promedio || "~48h",
        solo_cotizaciones_directas: companyForm.solo_cotizaciones_directas,
        logo_url: companyForm.logo_url.trim() || undefined,
        // Mismas claves que usa el autoservicio del perfil de empresa, para que
        // la empresa vea ya rellenos los datos que cargó el administrador.
        perfil_publico: {
          website: companyForm.sitio_web.trim(),
          email: companyForm.email_contacto.trim() || companyForm.email_dueño.trim(),
          phone: companyForm.telefono.trim(),
          address: companyForm.direccion.trim(),
          nit: companyForm.nit.trim(),
        },
      });

      // Ya no se duplica nada en `localStorage`: estos datos viajan en
      // `perfil_publico` y los ve cualquier administrador, no solo este
      // navegador. Lo guardado antes sigue leyéndose como respaldo.
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

  /** Abre el expediente: qué cumple y qué le falta, antes de decidir. */
  async function handleOpenVerificationFile(companyId: string) {
    setError("");
    setMotivoRetiro("");
    setCargandoExpediente(true);
    try {
      setExpediente(await adminService.getVerificationFile(companyId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo abrir el expediente.");
    } finally {
      setCargandoExpediente(false);
    }
  }

  async function handleVerifyCompany(companyId: string) {
    setError("");
    setProcesandoSello(true);
    try {
      await adminService.verifyImporter(companyId);
      setStatusMessage("Empresa verificada. El sello ya es visible en su ficha pública.");
      setExpediente(null);
      await reloadAdminData();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "No se pudo verificar la empresa.");
    } finally {
      setProcesandoSello(false);
    }
  }

  async function handleRevokeVerification(companyId: string) {
    if (motivoRetiro.trim().length < 5) {
      setError("Explica por qué se retira el sello (mínimo 5 caracteres).");
      return;
    }
    setError("");
    setProcesandoSello(true);
    try {
      await adminService.revokeImporterVerification(companyId, motivoRetiro.trim());
      setStatusMessage("Sello retirado. Se avisó al representante con el motivo.");
      setExpediente(null);
      setMotivoRetiro("");
      await reloadAdminData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo retirar el sello.");
    } finally {
      setProcesandoSello(false);
    }
  }

  async function handleInviteUser() {
    setSubmitting(true);
    setStatusMessage("");
    setError("");

    try {
      if (userForm.rol === "asesor" || userForm.rol === "admin") {
        throw new Error(
          userForm.rol === "asesor"
            ? "Los asesores los crea la cuenta dueña de cada empresa desde su panel."
            : "Las cuentas de administración no se crean desde aquí. Para atención al cliente usa el rol 'soporte'.",
        );
      }

      if (userForm.rol === "designer") {
        // Equipo de diseño: portadas e imágenes de Tendencias, más el canal del equipo.
        if (!userForm.nombre || !userForm.email || !userForm.password) {
          throw new Error("Para una cuenta de diseño debes completar nombre, email y contraseña.");
        }
        await tendenciasService.crearDisenador({
          email: userForm.email,
          password: userForm.password,
          nombre: userForm.nombre,
          telefono: userForm.telefono || undefined,
        });
        setStatusMessage(`Cuenta de diseño creada para ${userForm.email}. Entra directo a «Diseño».`);
      } else if (userForm.rol === "soporte") {
        if (!userForm.nombre || !userForm.email || !userForm.password) {
          throw new Error("Para una cuenta de soporte debes completar nombre, email y contraseña.");
        }
        await businessService.createSupportAgent({
          email: userForm.email,
          password: userForm.password,
          nombre: userForm.nombre,
          telefono: userForm.telefono || undefined,
          nivel: userForm.nivelSoporte,
        });
        setStatusMessage(
          `Cuenta de atención al cliente creada para ${userForm.email} en nivel ${userForm.nivelSoporte}.`,
        );
      } else if (userForm.rol === "importador") {
        const faltan = [
          !userForm.companyName.trim() && "nombre comercial",
          !userForm.razonSocial.trim() && "razón social",
          !userForm.nit.trim() && "NIT",
          !userForm.nombre.trim() && "nombre del representante",
          !userForm.apellido.trim() && "apellido del representante",
          !userForm.numeroDocumento.trim() && "documento del representante",
          !userForm.telefono.trim() && "teléfono",
          !userForm.email.trim() && "correo",
          !userForm.password && "contraseña",
          userForm.especialidades.length === 0 && "al menos una especialidad",
        ].filter(Boolean);
        if (faltan.length > 0) {
          throw new Error(`Para la empresa falta: ${faltan.join(", ")}.`);
        }

        await adminService.createImporterWithOwner({
          nombre_empresa: userForm.companyName.trim(),
          especialidad_producto: userForm.especialidades,
          paises_origen: userForm.paises.split(",").map((pais) => pais.trim()).filter(Boolean),
          tiempo_respuesta_promedio: userForm.tiempoRespuesta.trim() || "~48h",
          email_dueño: userForm.email.trim(),
          password_dueño: userForm.password,
          nombre_dueño: userForm.nombre.trim(),
          apellido_dueño: userForm.apellido.trim(),
          tipo_documento_dueño: userForm.tipoDocumento,
          numero_documento_dueño: userForm.numeroDocumento.trim(),
          nit: userForm.nit.trim(),
          razon_social: userForm.razonSocial.trim(),
          indicativo_dueño: userForm.indicativo_pais_telefono.trim() || "+57",
          telefono_dueño: userForm.telefono.trim(),
        });
        setStatusMessage("Usuario importador creado con su empresa base.");
      } else {
        const natural = userForm.tipoPersona === "natural";
        const faltan = (natural
          ? [
            !userForm.nombre.trim() && "nombre",
            !userForm.apellido.trim() && "apellido",
            !userForm.numeroDocumento.trim() && "número de documento",
          ]
          : [
            !userForm.razonSocial.trim() && "razón social",
            !userForm.nit.trim() && "NIT",
          ]).concat([
            !userForm.telefono.trim() && "teléfono",
            !userForm.email.trim() && "correo",
            !userForm.password && "contraseña",
          ]).filter(Boolean);
        if (faltan.length > 0) {
          throw new Error(`Falta: ${faltan.join(", ")}.`);
        }
        await adminService.crearSolicitante({
          email: userForm.email.trim(),
          password: userForm.password,
          tipo_persona: userForm.tipoPersona,
          ...(natural
            ? {
              nombre: userForm.nombre.trim(),
              apellido: userForm.apellido.trim(),
              tipo_documento: userForm.tipoDocumento,
              numero_documento: userForm.numeroDocumento.trim(),
            }
            : { nit: userForm.nit.trim(), razon_social: userForm.razonSocial.trim() }),
          indicativo_pais_telefono: userForm.indicativo_pais_telefono.trim() || "+57",
          telefono: userForm.telefono.trim(),
          tokens_iniciales: Math.max(0, Math.floor(Number(userForm.tokensIniciales) || 0)),
          ...(userForm.tier ? { tier: userForm.tier } : {}),
          ...(userForm.categoriaId ? { categoria_id: userForm.categoriaId } : {}),
        });
        setStatusMessage(`Cotizante creado: ${userForm.email.trim()} ya puede iniciar sesión (sin código de verificación).`);
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

  return (
    <div className="space-y-5">
      <AdminSectionHeader
        label={ADMIN_SECTION_HINTS[tab].label}
        hint={ADMIN_SECTION_HINTS[tab].hint}
        onRefresh={() => {
          void refreshAll();
        }}
      />

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {tab === "tendencias" ? <AdminTendenciasTab /> : null}

      {tab === "tendencias-aprobacion" ? <AdminTendenciasAprobacionTab esAdmin={isAdmin} /> : null}

      {isLoading ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:!bg-accent/20">Cargando datos administrativos...</div>
      ) : null}

      {statusMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:!bg-accent/15">{statusMessage}</div>
      ) : null}

      {tab === "metricas" ? <AdminMetricasTab /> : null}

      {tab === "empresas" ? (
        <AdminEmpresasTab
          sectionRef={companiesSectionRef}
          companies={companies}
          ownerEmailByCompanyId={ownerEmailByCompanyId}
          companyUiDetails={companyUiDetails}
          isLoading={isLoading}
          onToggleCompanyStatus={(company) => void handleToggleCompanyStatus(company)}
          onOpenVerificationFile={(companyId) => void handleOpenVerificationFile(companyId)}
        />
      ) : null}

      {tab === "usuarios" ? (
        <AdminUsuariosTab
          sectionRef={usersSectionRef}
          users={users}
          companyNameById={companyNameById}
          usersByRole={usersByRole}
          isLoading={isLoading}
          userRoleFilter={userRoleFilter}
          userActiveFilter={userActiveFilter}
          onRoleFilterChange={setUserRoleFilter}
          onActiveFilterChange={setUserActiveFilter}
          onCreateUser={() => setShowUserModal(true)}
          onToggleUserStatus={(user) => void handleToggleUserStatus(user)}
        />
      ) : null}

      {tab === "cotizantes" ? (
        <AdminCotizantesTab />
      ) : null}

      {tab === "correos" ? <AdminCorreosTab /> : null}

      {tab === "landing" ? <AdminLandingTab /> : null}

      {tab === "soporte" ? (
        <AdminSoporteTab
          sectionRef={chatsSectionRef}
          isAdmin={isAdmin}
          conversations={conversations}
          conversationsTotal={conversationsTotal}
          conversationSearch={conversationSearch}
          onSearchChange={setConversationSearch}
          conversationPage={conversationPage}
          supportTeam={supportTeam}
          disputes={disputes}
          openConversation={openConversation}
          conversationMessages={conversationMessages}
          isLoadingMessages={isLoadingMessages}
          isSendingReply={isSendingReply}
          onOpenConversation={(conversation) => void openConversationDetail(conversation)}
          onChangeAgentLevel={(id, level) => void handleChangeAgentLevel(id, level)}
          onResolveDispute={setResolvingDispute}
          onCloseConversation={() => setOpenConversation(null)}
          onSendReply={(text) => { setSupportReply(text); void handleSendSupportReply(); }}
          onPreviousPage={() => setConversationPage((page) => Math.max(0, page - 1))}
          onNextPage={() => setConversationPage((page) => page + 1)}
        />
      ) : null}
      {tab === "certificaciones" ? (
        <AdminCertificacionesTab
          sectionRef={certificationsSectionRef}
          certifications={certifications}
          certificationForm={certificationForm}
          editingCertificationId={editingCertificationId}
          isUploadingLogo={isUploadingLogo}
          submitting={submitting}
          companies={companies}
          companyNameById={companyNameById}
          certificationsByCompany={certificationsByCompany}
          grantCompanyId={grantCompanyId}
          grantCertificationId={grantCertificationId}
          onCertificationFormChange={setCertificationForm}
          onUploadLogo={(file) => void handleUploadCertificationLogo(file)}
          onSave={() => void handleSaveCertification()}
          onEdit={startEditingCertification}
          onCancelEdit={() => { setEditingCertificationId(null); setCertificationForm(EMPTY_CERTIFICATION_FORM); }}
          onRetire={(certification) => void handleRetireCertification(certification)}
          onGrant={() => void handleGrantCertification()}
          onRevoke={(companyId, certificationId) => void handleRevokeCertification(companyId, certificationId)}
          onGrantCompanyChange={setGrantCompanyId}
          onGrantCertificationChange={setGrantCertificationId}
        />
      ) : null}

      {tab === "asignacion" ? <AdminAsignacionTab /> : null}

      {tab === "respaldos" ? <AdminRespaldosTab onSesionCaducada={signOut} /> : null}

      {openConversation ? (
        <ConversationDetailModal
          conversation={openConversation}
          messages={conversationMessages}
          isLoadingMessages={isLoadingMessages}
          isSendingReply={isSendingReply}
          supportReply={supportReply}
          onReplyChange={setSupportReply}
          onClose={() => setOpenConversation(null)}
          onSend={() => void handleSendSupportReply()}
        />
      ) : null}

      <VerificationExpedienteModal
        expediente={expediente}
        cargando={cargandoExpediente}
        motivoRetiro={motivoRetiro}
        procesando={procesandoSello}
        onMotivoChange={setMotivoRetiro}
        onClose={() => { setExpediente(null); setMotivoRetiro(""); }}
        onVerify={(id) => void handleVerifyCompany(id)}
        onRevoke={(id) => void handleRevokeVerification(id)}
      />

      {resolvingDispute ? (
        <DisputeResolutionModal
          dispute={resolvingDispute}
          resolution={disputeResolution}
          isResolving={isResolvingDispute}
          onResolutionChange={setDisputeResolution}
          onClose={() => { setResolvingDispute(null); setDisputeResolution(""); }}
          onResolve={() => void handleResolveDispute()}
        />
      ) : null}

      {showCompanyModal ? (
        <CompanyCreationModal
          form={companyForm}
          submitting={submitting}
          uploadingLogo={isUploadingCompanyLogo}
          onChange={(update) => setCompanyForm((previous) => ({ ...previous, ...update }))}
          onClose={() => setShowCompanyModal(false)}
          onSubmit={() => void handleCreateCompany()}
          onUploadLogo={(file) => void handleUploadCompanyLogo(file)}
        />
      ) : null}

      {showUserModal ? (
        <UserCreationModal
          form={userForm}
          categorias={categoriasCotizante}
          submitting={submitting}
          onChange={(update) => setUserForm((previous) => ({ ...previous, ...update }))}
          onClose={() => setShowUserModal(false)}
          onSubmit={() => void handleInviteUser()}
        />
      ) : null}

    </div>
  );
}
