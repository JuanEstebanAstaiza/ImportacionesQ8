import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Award, Building2, Download, MessageSquare, RefreshCw, Search, Shield, Trash2, Upload, Users, X } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import {
  adminService,
  type AdminCertificacion,
  type AdminConversacion,
  type AdminCotizacionAbierta,
  type AdminAgenteSoporte,
  type AdminDisputa,
  type ExpedienteVerificacion,
  type AdminMensaje,
  type AdminMetricas,
  type AdminUser,
  type BackupResumen,
  type CategoriaCotizante,
} from "@/services/admin.service";
import { textoCategoria } from "@/features/admin/CategoriasCotizante";
import { businessService } from "@/services/business.service";
import { tendenciasService } from "@/services/tendencias.service";
import { CATEGORIAS_PRODUCTO } from "@/lib/categorias";
import { EditorDocumentacion } from "@/features/help/EditorDocumentacion";
import { LandingCmsEditor } from "@/features/admin/LandingCmsEditor";
import { GestionCotizantes } from "@/features/admin/GestionCotizantes";
import { AdminEmailCampaign } from "@/features/admin/AdminEmailCampaign";
import { RestaurarBackup } from "@/features/admin/RestaurarBackup";
import { AsignacionSolicitudes } from "@/features/admin/AsignacionSolicitudes";
import { resolveApiUrl, toApiPath } from "@/services/api-client";
import type { BackendImporter } from "@/services/business.service";

type AdminTab = "metricas" | "empresas" | "asignacion" | "usuarios" | "cotizantes" | "soporte" | "certificaciones" | "respaldos" | "landing" | "correos";
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

const TIPOS_DOCUMENTO = ["CC", "CE", "Pasaporte", "PPT", "DNI"];

interface AdminDashboardProps {
  onRefreshGlobal?: () => Promise<void>;
  /** Área a mostrar. La elige el sidebar de la aplicación, no este componente. */
  section: AdminTab;
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
const LOGO_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
const LOGO_UPLOAD_ACCEPT = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

function formatBytes(total: number): string {
  if (total < 1024) return `${total} B`;
  if (total < 1024 * 1024) return `${(total / 1024).toFixed(1)} KB`;
  if (total < 1024 * 1024 * 1024) return `${(total / (1024 * 1024)).toFixed(1)} MB`;
  return `${(total / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

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
  const tab = section;
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
  const [metrics, setMetrics] = useState<AdminMetricas | null>(null);
  const [openQuotes, setOpenQuotes] = useState<AdminCotizacionAbierta[]>([]);

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
  const metricsSectionRef = useRef<HTMLElement | null>(null);
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
  const [backupSummary, setBackupSummary] = useState<BackupResumen | null>(null);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
  const [includeFilesInBackup, setIncludeFilesInBackup] = useState(true);

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
      const [companyRows, userRows, metricsRow, openQuoteRows, certificationRows, backupRow] =
        await Promise.all([
          adminService.listCompanies(),
          adminService.listUsers(userFilters),
          adminService.getMetricas(),
          adminService.listOpenQuotes(),
          adminService.listCertifications(),
          // El resumen del backup es informativo: que falle no debe tumbar el panel.
          adminService.getBackupSummary().catch(() => null),
        ]);

      setCompanies(companyRows);
      setUsers(userRows);
      setMetrics(metricsRow);
      setOpenQuotes(openQuoteRows);
      setCertifications(certificationRows);
      setBackupSummary(backupRow);
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
    if (!confirm(`¿Retirar "${certificacion.nombre}" del catálogo? Las ${certificacion.empresas_certificadas} empresa(s) que la tienen dejarán de mostrarla.`)) {
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

  async function handleDownloadBackup() {
    setError("");
    setStatusMessage("");
    setIsDownloadingBackup(true);
    try {
      const nombre = await adminService.downloadBackup(includeFilesInBackup);
      setStatusMessage(`Copia de seguridad descargada: ${nombre}. Guárdala en un lugar seguro antes de actualizar.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo generar la copia de seguridad.");
    } finally {
      setIsDownloadingBackup(false);
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
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{ADMIN_SECTION_HINTS[tab].label}</h1>
            <p className="text-sm text-muted-foreground">{ADMIN_SECTION_HINTS[tab].hint}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void refreshAll();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:!bg-primary hover:!text-white dark:hover:!bg-accent dark:hover:!text-black hover:!border-primary dark:hover:!border-accent"
          >
            <RefreshCw className="h-4 w-4" />
            Refrescar
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:!bg-accent/20">Cargando datos administrativos...</div>
      ) : null}

      {statusMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:!bg-accent/15">{statusMessage}</div>
      ) : null}

      {tab === "metricas" ? (
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
            <p className="text-xs text-muted-foreground">Operaciones en disputa</p>
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
                  <tr 
                    key={quote.id} 
                    className="border-t border-border transition-colors hover:bg-primary/12 dark:hover:!bg-accent/12"
                  >
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
      ) : null}

      {tab === "empresas" ? (
      <section ref={companiesSectionRef} className="space-y-4 scroll-mt-6">
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
                      <div className="font-medium text-foreground">{company.nombre_empresa}</div>
                      <div className="text-xs text-muted-foreground">{company.especialidad_producto.join(", ") || "General"}</div>
                      <div className="text-xs text-muted-foreground">Cuenta dueña: {ownerEmailByCompanyId[company.id] || "No disponible"}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{leerPerfilPublico(company, "nit") || companyUiDetails[company.id]?.nit || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{leerPerfilPublico(company, "email", "email_contacto") || companyUiDetails[company.id]?.email_contacto || ownerEmailByCompanyId[company.id] || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{leerPerfilPublico(company, "phone", "telefono") || companyUiDetails[company.id]?.telefono || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{leerPerfilPublico(company, "address", "direccion") || companyUiDetails[company.id]?.direccion || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{company.paises_origen[0] || "N/A"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${company.estado === "activo" ? "bg-emerald-100 text-emerald-700 dark:!bg-accent/20" : "bg-slate-100 text-slate-700 dark:!bg-accent/20"}`}>
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
                        {/* Verificar no es un interruptor: se abre el expediente
                            y se decide con los requisitos delante. */}
                        <button
                          type="button"
                          onClick={() => {
                            void handleOpenVerificationFile(company.id);
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
      ) : null}

      {tab === "usuarios" ? (
      <section ref={usersSectionRef} className="space-y-4 scroll-mt-6">
          <div className="flex items-center justify-between rounded-xl border border-border bg-white p-4 shadow-sm">
            <div>
              <p className="text-base font-semibold">Gestión de Usuarios</p>
              <p className="text-sm text-muted-foreground">Administra usuarios, roles visibles y su empresa asignada cuando aplique.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowUserModal(true)}
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
                    onChange={(event) => setUserRoleFilter(event.target.value as RoleFilter)}
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
                    onChange={(event) => setUserActiveFilter(event.target.value as ActiveFilter)}
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
                      <tr key={user.id} className="border-t border-border hover:!bg-primary/10 dark:hover:!bg-accent/10">
                        <td className="px-3 py-2">
                          <div className="font-medium text-foreground">{user.nombre || user.email}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{user.importador_id ? companyNameById[user.importador_id] || user.importador_id : "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{user.rol}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium dark:!bg-accent/15 ${user.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
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
          </div>
        </section>
      ) : null}

      {tab === "cotizantes" ? (
        <section className="space-y-4">
          <GestionCotizantes />
        </section>
      ) : null}

      {tab === "correos" ? <AdminEmailCampaign /> : null}

      {tab === "landing" ? (
        <section className="space-y-4 scroll-mt-6">
          <LandingCmsEditor />
        </section>
      ) : null}

      {tab === "soporte" ? (
      <section ref={chatsSectionRef} className="space-y-4 scroll-mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <div>
            <p className="flex items-center gap-2 text-base font-semibold">
              <MessageSquare className="h-4 w-4 text-primary dark:text-accent" />
              Soporte y gestión de incidentes
            </p>
            <p className="text-sm text-muted-foreground">
              Atiende dudas de compradores y media en incidentes con empresas importadoras. Puedes responder
              dentro de la conversación como equipo de la plataforma.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{conversationsTotal} conversaciones</span>
        </div>

        {/* Cada duda que se repite en los tickets debería acabar aquí: es lo
            que hace que el volumen de soporte baje en vez de crecer. */}
        <EditorDocumentacion />

        {/* La mesa: quién puede atender qué y cómo lo está haciendo. */}
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-primary dark:text-accent" />
              Mesa de soporte
            </p>
            <span className="text-xs text-muted-foreground">{supportTeam.length} agentes</span>
          </div>

          {supportTeam.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              Todavía no hay agentes. Créalos desde Usuarios con el rol «Atención al cliente».
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3">Agente</th>
                    <th className="py-2 pr-3">Nivel</th>
                    <th className="py-2 pr-3 text-right">Asignados</th>
                    <th className="py-2 pr-3 text-right">Cerrados</th>
                    <th className="py-2 pr-3 text-right">Calificación</th>
                  </tr>
                </thead>
                <tbody>
                  {supportTeam.map((agente) => (
                    <tr key={agente.id} className="border-b border-border/60">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium text-foreground">{agente.nombre || agente.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {agente.email}
                          {agente.activo ? "" : " · inactivo"}
                        </p>
                      </td>
                      <td className="py-2.5 pr-3">
                        {isAdmin ? (
                          <select
                            value={agente.nivel ?? 1}
                            onChange={(event) => {
                              void handleChangeAgentLevel(agente.id, Number(event.target.value));
                            }}
                            className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary dark:bg-card dark:text-foreground dark:focus:border-accent dark:focus:ring-accent [&>option]:bg-white [&>option]:text-black dark:[&>option]:bg-card dark:[&>option]:text-white"
                          >
                            <option value={1}>Nivel 1</option>
                            <option value={2}>Nivel 2</option>
                            <option value={3}>Nivel 3</option>
                          </select>
                        ) : (
                          <span className="text-xs text-foreground">Nivel {agente.nivel ?? 1}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right">{agente.tickets_asignados}</td>
                      <td className="py-2.5 pr-3 text-right">{agente.tickets_cerrados}</td>
                      <td className="py-2.5 pr-3 text-right">
                        {agente.calificacion_promedio !== null ? (
                          <span className="font-medium">
                            ★ {agente.calificacion_promedio.toFixed(1)}
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              ({agente.calificaciones_recibidas})
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin calificar</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Los incidentes son lo urgente: van primero y con acción, no como una
            cifra suelta en el resumen. */}
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Shield className="h-4 w-4 text-amber-600 dark:text-accent" />
              Incidentes abiertos
            </p>
            <span className="text-xs text-muted-foreground">{disputes.length} sin resolver</span>
          </div>

          {disputes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              No hay incidentes abiertos.
            </p>
          ) : (
            <div className="space-y-2">
              {disputes.map((dispute) => (
                <div key={dispute.id} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        Operación {dispute.id.slice(0, 8).toUpperCase()} · estado {dispute.estado}
                      </p>
                      <p className="mt-0.5 text-xs text-amber-900">{dispute.motivo_disputa || "Sin motivo indicado"}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Reportado el {formatDate(dispute.fecha_actualizacion)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setResolvingDispute(dispute)}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                    >
                      Resolver
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                  <tr key={conversation.id} className="border-b border-border/60 align-top hover:!bg-muted dark:hover:!bg-muted">
                    <td className="py-3 pr-3">
                      {conversation.tipo === "interna" ? (
                        <span className="inline-flex rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:!bg-accent/20">
                          Canal interno de empresa
                        </span>
                      ) : (
                        <>
                          <p className="font-medium text-foreground">{conversation.solicitante_nombre || "Sin nombre"}</p>
                          <p className="text-xs text-muted-foreground">
                            {conversation.solicitante_email || conversation.solicitante_id}
                          </p>
                        </>
                      )}
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
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium bg-primary dark:bg-accent hover:!border-primary dark:hover:!border-accent !text-white dark:!text-black hover:!bg-primary dark:hover:!bg-accent hover:opacity-80"
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

          {conversationsTotal > CONVERSACIONES_POR_PAGINA ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                {conversationPage * CONVERSACIONES_POR_PAGINA + 1}–
                {Math.min((conversationPage + 1) * CONVERSACIONES_POR_PAGINA, conversationsTotal)} de {conversationsTotal}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={conversationPage === 0}
                  onClick={() => setConversationPage((prev) => Math.max(0, prev - 1))}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40"
                >
                  Anteriores
                </button>
                <button
                  type="button"
                  disabled={(conversationPage + 1) * CONVERSACIONES_POR_PAGINA >= conversationsTotal}
                  onClick={() => setConversationPage((prev) => prev + 1)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40"
                >
                  Siguientes
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
      ) : null}

      {tab === "certificaciones" ? (
      <section ref={certificationsSectionRef} className="space-y-4 scroll-mt-6">
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
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
                  onChange={(event) => setCertificationForm((prev) => ({ ...prev, nombre: event.target.value }))}
                  placeholder="Ej. Socio Verificado Oro"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Descripción</label>
                <textarea
                  value={certificationForm.descripcion}
                  onChange={(event) => setCertificationForm((prev) => ({ ...prev, descripcion: event.target.value }))}
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
                  onChange={(event) => setCertificationForm((prev) => ({ ...prev, peso_publicidad: event.target.value }))}
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
                    if (archivo) void handleUploadCertificationLogo(archivo);
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
                      onClick={() => setCertificationForm((prev) => ({ ...prev, logo_url: "" }))}
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
                    void handleSaveCertification();
                  }}
                  className="flex-1 rounded-lg bg-primary dark:bg-accent px-3 py-2 text-sm font-medium !text-white dark:!text-black hover:!bg-primary dark:hover:!bg-accent hover:opacity-80 disabled:opacity-60"
                >
                  {editingCertificationId ? "Guardar cambios" : "Crear certificación"}
                </button>
                {editingCertificationId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCertificationId(null);
                      setCertificationForm(EMPTY_CERTIFICATION_FORM);
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
                                  void handleRetireCertification(certificacion);
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
                    onChange={(event) => setGrantCompanyId(event.target.value)}
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
                    onChange={(event) => setGrantCertificationId(event.target.value)}
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
                    void handleGrantCertification();
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
                    {(certificationsByCompany[grantCompanyId] ?? []).map((otorgada) => (
                      <span
                        key={otorgada.certificacion_id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800"
                      >
                        <Shield className="h-3 w-3" />
                        {otorgada.nombre} · {otorgada.peso_publicidad}
                        <button
                          type="button"
                          onClick={() => {
                            void handleRevokeCertification(grantCompanyId, otorgada.certificacion_id);
                          }}
                          className="ml-0.5 text-emerald-700 hover:text-red-600"
                          aria-label={`Revocar ${otorgada.nombre}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    {(certificationsByCompany[grantCompanyId] ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">Esta empresa no tiene sellos vigentes.</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {tab === "asignacion" ? <AsignacionSolicitudes /> : null}

      {tab === "respaldos" ? (
      <section className="space-y-4">
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-base font-semibold">
            <Download className="h-4 w-4 text-primary dark:text-accent" />
            Copia de seguridad
          </p>
          <p className="text-sm text-muted-foreground">
            Descarga un ZIP con la base de datos y los archivos subidos y guárdalo fuera del servidor. Tómala antes de
            cada actualización: si algo sale mal, se vuelve a cargar desde aquí mismo, más abajo.
          </p>

          {backupSummary ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Filas de base de datos", value: backupSummary.total_filas.toLocaleString("es-CO") },
                { label: "Archivos subidos", value: backupSummary.archivos.toLocaleString("es-CO") },
                { label: "Peso de los archivos", value: formatBytes(backupSummary.bytes_archivos) },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-lg font-semibold">{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isDownloadingBackup}
              onClick={() => {
                void handleDownloadBackup();
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-primary dark:bg-accent px-4 py-2 text-sm font-medium text-white dark:text-black disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {isDownloadingBackup ? "Generando ZIP..." : "Descargar copia de seguridad"}
            </button>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={includeFilesInBackup}
                onChange={(event) => setIncludeFilesInBackup(event.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Incluir archivos subidos (más pesado)
            </label>
          </div>

          <p className="mt-3 text-xs text-amber-700">
            El ZIP contiene datos personales y hashes de contraseña de toda la plataforma. Guárdalo cifrado y no lo compartas.
          </p>
          {backupSummary?.revision_alembic ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Revisión de esquema actual: <code className="rounded bg-muted px-1">{backupSummary.revision_alembic}</code>
            </p>
          ) : null}

          <RestaurarBackup
            onDescargarActual={() => {
              void handleDownloadBackup();
            }}
            descargandoActual={isDownloadingBackup}
            onRestaurado={() => {
              void reloadAdminData();
            }}
            onSesionCaducada={() => {
              void signOut();
            }}
          />
        </div>
      </section>
      ) : null}

      {openConversation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 className="text-base font-semibold">
                  {openConversation.solicitante_nombre || openConversation.solicitante_email} · {openConversation.empresa_nombre || "Empresa"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {/* Los hilos internos de una empresa no cuelgan de ninguna cotización. */}
                  {openConversation.cotizacion_id
                    ? `Cotización ${openConversation.cotizacion_id.slice(0, 8).toUpperCase()}`
                    : "Canal interno de la empresa"}
                  {openConversation.orden_id ? ` · Operación ${openConversation.orden_id.slice(0, 8).toUpperCase()}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenConversation(null)}
                className="rounded-md border border-border p-1.5 hover:!bg-primary hover:!text-white hover:!border-primary dark:hover:!bg-accent dark:hover:!text-black dark:hover:!border-accent"
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
                        ? "border-border bg-muted/50 dark:!border-border dark:!bg-muted/50"
                        : esSolicitante
                          ? "border-blue-100 bg-blue-50 dark:!border-primary/20 dark:!bg-primary/30"
                          : "border-emerald-100 bg-emerald-50 dark:!border-accent/20 dark:!bg-accent/20"
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

            <div className="space-y-2 border-t border-border p-3">
              <p className="text-[11px] text-muted-foreground">
                Lo que escribas aquí entra en el hilo como <strong>equipo de Zarpi</strong> y avisa a las dos
                partes. Consultar el hilo sin escribir no deja rastro.
              </p>
              <div className="flex items-end gap-2">
                <textarea
                  value={supportReply}
                  onChange={(event) => setSupportReply(event.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="Responder como soporte…"
                  className="flex-1 resize-none rounded-lg border border-border px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={isSendingReply || !supportReply.trim()}
                  onClick={() => {
                    void handleSendSupportReply();
                  }}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {isSendingReply ? "Enviando…" : "Enviar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {expediente || cargandoExpediente ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 className="text-base font-semibold">
                  {cargandoExpediente ? "Cargando expediente…" : `Verificación de ${expediente?.nombre_empresa}`}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Qué se puede comprobar desde la plataforma antes de avalar a esta empresa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setExpediente(null);
                  setMotivoRetiro("");
                }}
                className="rounded-md border border-border p-1.5 hover:bg-muted"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {expediente ? (
              <>
                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  {expediente.verificado ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                      Esta empresa lleva el sello de socio verificado.
                    </div>
                  ) : expediente.listo_para_verificar ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                      Cumple los {expediente.obligatorios_totales} requisitos obligatorios. La decisión final es tuya.
                    </div>
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <p className="font-medium">Todavía no se puede verificar.</p>
                      <p className="mt-1">Falta: {expediente.pendientes.join(" · ")}</p>
                    </div>
                  )}

                  {[
                    {
                      titulo: "Obligatorios",
                      nota: "Sin esto la empresa no puede operar bien en la plataforma.",
                      lista: expediente.obligatorios,
                      cumplidos: expediente.obligatorios_cumplidos,
                      total: expediente.obligatorios_totales,
                    },
                    {
                      titulo: "Recomendables",
                      nota: "Hablan de una empresa con recorrido. No impiden verificar.",
                      lista: expediente.recomendables,
                      cumplidos: expediente.recomendables_cumplidos,
                      total: expediente.recomendables_totales,
                    },
                  ].map((grupo) => (
                    <div key={grupo.titulo}>
                      <div className="mb-2 flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold">{grupo.titulo}</p>
                        <span className="text-xs text-muted-foreground">
                          {grupo.cumplidos} de {grupo.total}
                        </span>
                      </div>
                      <p className="mb-2 text-xs text-muted-foreground">{grupo.nota}</p>
                      <div className="space-y-1.5">
                        {grupo.lista.map((requisito) => (
                          <div
                            key={requisito.clave}
                            className={`flex items-start gap-2.5 rounded-lg border p-2.5 ${
                              requisito.cumple ? "border-emerald-200 bg-emerald-50/50" : "border-border bg-muted/30"
                            }`}
                          >
                            <span className={`mt-0.5 text-sm ${requisito.cumple ? "text-emerald-600" : "text-muted-foreground/50"}`}>
                              {requisito.cumple ? "✓" : "○"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground">{requisito.titulo}</p>
                              <p className="text-xs text-muted-foreground">{requisito.detalle}</p>
                            </div>
                            <span className="max-w-[40%] text-right text-xs text-muted-foreground">
                              {requisito.valor}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                    Esta lista solo cubre lo que consta en la plataforma. La comprobación del registro
                    mercantil, las referencias comerciales y cualquier documentación legal siguen siendo
                    tuyas: el sello dice que respondes por esta empresa.
                  </p>
                </div>

                <div className="space-y-2 border-t border-border p-3">
                  {expediente.verificado ? (
                    <>
                      <textarea
                        value={motivoRetiro}
                        onChange={(event) => setMotivoRetiro(event.target.value)}
                        rows={2}
                        placeholder="Motivo para retirar el sello (se le comunica a la empresa)…"
                        className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={procesandoSello || motivoRetiro.trim().length < 5}
                        onClick={() => {
                          void handleRevokeVerification(expediente.importador_id);
                        }}
                        className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-40"
                      >
                        {procesandoSello ? "Retirando…" : "Retirar verificación"}
                      </button>
                      <p className="text-[11px] text-muted-foreground">
                        Retirar el sello no desactiva la empresa: sigue operando, pero deja de estar avalada.
                      </p>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={procesandoSello || !expediente.listo_para_verificar}
                      onClick={() => {
                        void handleVerifyCompany(expediente.importador_id);
                      }}
                      className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      {procesandoSello ? "Verificando…" : "Verificar empresa"}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
            )}
          </div>
        </div>
      ) : null}

      {resolvingDispute ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Resolver incidente</h2>
                <p className="text-xs text-muted-foreground">
                  Operación {resolvingDispute.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResolvingDispute(null);
                  setDisputeResolution("");
                }}
                className="rounded-md border border-border p-1.5 hover:bg-muted"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-medium">Motivo reportado</p>
              <p className="mt-1">{resolvingDispute.motivo_disputa || "Sin motivo indicado"}</p>
            </div>

            <textarea
              value={disputeResolution}
              onChange={(event) => setDisputeResolution(event.target.value)}
              rows={4}
              placeholder="Qué se hizo para resolverlo. Queda registrado en la operación y en la sala del incidente."
              className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setResolvingDispute(null);
                  setDisputeResolution("");
                }}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isResolvingDispute || disputeResolution.trim().length < 5}
                onClick={() => {
                  void handleResolveDispute();
                }}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {isResolvingDispute ? "Resolviendo…" : "Marcar como resuelto"}
              </button>
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
                placeholder="Nombre comercial"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <input
                value={companyForm.razon_social}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, razon_social: event.target.value }))}
                placeholder="Razón social"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <p className="text-xs font-semibold text-muted-foreground md:col-span-2">Representante legal (cuenta dueña)</p>
              <input
                value={companyForm.nombre_dueño}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, nombre_dueño: event.target.value }))}
                placeholder="Nombre del representante"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <input
                value={companyForm.apellido_dueño}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, apellido_dueño: event.target.value }))}
                placeholder="Apellido del representante"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <div className="flex gap-2">
                <select
                  aria-label="Tipo de documento del representante"
                  value={companyForm.tipo_documento_dueño}
                  onChange={(event) => setCompanyForm((prev) => ({ ...prev, tipo_documento_dueño: event.target.value }))}
                  className="h-9 w-28 shrink-0 rounded-lg border border-border px-2 text-sm"
                >
                  {TIPOS_DOCUMENTO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                </select>
                <input
                  value={companyForm.numero_documento_dueño}
                  onChange={(event) => setCompanyForm((prev) => ({ ...prev, numero_documento_dueño: event.target.value }))}
                  placeholder="Número de documento"
                  className="h-9 w-full rounded-lg border border-border px-3 text-sm"
                />
              </div>
              <input
                value={companyForm.email_dueño}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, email_dueño: event.target.value }))}
                placeholder="Correo de la cuenta dueña (inicia sesión con él)"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <input
                aria-label="Indicativo del teléfono"
                value={companyForm.indicativo_dueño}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, indicativo_dueño: event.target.value }))}
                placeholder="Indicativo (+57)"
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
                value={companyForm.telefono}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, telefono: event.target.value }))}
                placeholder="Telefono"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <input
                value={companyForm.sitio_web}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, sitio_web: event.target.value }))}
                placeholder="Sitio web (ej. miempresa.com)"
                className="h-9 rounded-lg border border-border px-3 text-sm"
              />
              <input
                value={companyForm.direccion}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, direccion: event.target.value }))}
                placeholder="Direccion"
                className="h-9 rounded-lg border border-border px-3 text-sm md:col-span-2"
              />
              <div className="col-span-full flex items-center gap-3">
                {companyForm.logo_url ? (
                  <img
                    src={resolveApiUrl(companyForm.logo_url)}
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
                    {isUploadingCompanyLogo ? "Subiendo..." : companyForm.logo_url ? "Cambiar logo" : "Subir logo"}
                    <input
                      type="file"
                      accept={LOGO_UPLOAD_ACCEPT}
                      className="hidden"
                      onChange={(event) => {
                        const archivo = event.target.files?.[0];
                        event.target.value = "";
                        if (archivo) {
                          void handleUploadCompanyLogo(archivo);
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
              <h2 className="text-lg font-semibold">Crear usuario</h2>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
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
                    value={userForm.rol}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, rol: event.target.value as InviteRole }))}
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
                {userForm.rol === "solicitante" ? (
                  <div className="text-xs font-medium text-muted-foreground">Tipo de persona
                    <div className="mt-1 flex gap-2">
                      {(["natural", "juridica"] as const).map((tipo) => (
                        <button
                          key={tipo}
                          type="button"
                          onClick={() => setUserForm((prev) => ({ ...prev, tipoPersona: tipo }))}
                          className={`h-9 flex-1 rounded-lg border text-sm ${userForm.tipoPersona === tipo ? "border-primary bg-primary/5 font-medium text-primary dark:text-accent" : "border-border"}`}
                        >
                          {tipo === "natural" ? "Persona natural" : "Persona jurídica"}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {/* El nivel decide qué tickets se le pueden asignar. */}
                {userForm.rol === "soporte" ? (
                  <label className="text-xs font-medium text-muted-foreground">Nivel de soporte
                    <select
                      value={userForm.nivelSoporte}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, nivelSoporte: Number(event.target.value) }))}
                      className="h-9 w-full rounded-lg border border-border px-3 text-sm"
                    >
                      <option value={1}>Nivel 1 — consultas corrientes</option>
                      <option value={2}>Nivel 2 — casos intermedios</option>
                      <option value={3}>Nivel 3 — casos complejos</option>
                    </select>
                  </label>
                ) : null}
              </div>

              {userForm.rol === "importador" ? (
                <fieldset className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-2">
                  <legend className="px-1 text-xs font-semibold">Empresa</legend>
                  <input value={userForm.companyName} onChange={(event) => setUserForm((prev) => ({ ...prev, companyName: event.target.value }))} placeholder="Nombre comercial" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
                  <input value={userForm.razonSocial} onChange={(event) => setUserForm((prev) => ({ ...prev, razonSocial: event.target.value }))} placeholder="Razón social" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
                  <input value={userForm.nit} onChange={(event) => setUserForm((prev) => ({ ...prev, nit: event.target.value }))} placeholder="NIT" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
                  <input value={userForm.tiempoRespuesta} onChange={(event) => setUserForm((prev) => ({ ...prev, tiempoRespuesta: event.target.value }))} placeholder="Tiempo de respuesta (ej. ~24h)" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
                  <input value={userForm.paises} onChange={(event) => setUserForm((prev) => ({ ...prev, paises: event.target.value }))} placeholder="Países de origen (separados por coma)" className="h-9 w-full rounded-lg border border-border px-3 text-sm md:col-span-2" />
                  <div className="md:col-span-2">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Especialidades</p>
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORIAS_PRODUCTO.map((categoria) => {
                        const activa = userForm.especialidades.includes(categoria);
                        return (
                          <button
                            key={categoria}
                            type="button"
                            aria-pressed={activa}
                            onClick={() => setUserForm((prev) => ({
                              ...prev,
                              especialidades: activa ? prev.especialidades.filter((c) => c !== categoria) : [...prev.especialidades, categoria],
                            }))}
                            className={`rounded-full border px-2.5 py-1 text-xs ${activa ? "border-primary bg-primary/10 font-medium text-primary dark:text-accent" : "border-border text-muted-foreground"}`}
                          >
                            {categoria}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </fieldset>
              ) : null}

              {userForm.rol === "solicitante" && userForm.tipoPersona === "juridica" ? (
                <fieldset className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-2">
                  <legend className="px-1 text-xs font-semibold">Empresa del cotizante</legend>
                  <input value={userForm.razonSocial} onChange={(event) => setUserForm((prev) => ({ ...prev, razonSocial: event.target.value }))} placeholder="Razón social" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
                  <input value={userForm.nit} onChange={(event) => setUserForm((prev) => ({ ...prev, nit: event.target.value }))} placeholder="NIT" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
                </fieldset>
              ) : null}

              <fieldset className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-2">
                <legend className="px-1 text-xs font-semibold">
                  {userForm.rol === "importador" ? "Representante legal (cuenta dueña)" : userForm.rol === "solicitante" && userForm.tipoPersona === "juridica" ? "Contacto y acceso" : "Datos de la persona"}
                </legend>
                {!(userForm.rol === "solicitante" && userForm.tipoPersona === "juridica") ? (
                  <>
                    <input value={userForm.nombre} onChange={(event) => setUserForm((prev) => ({ ...prev, nombre: event.target.value }))} placeholder="Nombre" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
                    {userForm.rol === "solicitante" || userForm.rol === "importador" ? (
                      <input value={userForm.apellido} onChange={(event) => setUserForm((prev) => ({ ...prev, apellido: event.target.value }))} placeholder="Apellido" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
                    ) : null}
                  </>
                ) : null}
                {(userForm.rol === "solicitante" && userForm.tipoPersona === "natural") || userForm.rol === "importador" ? (
                  <div className="flex gap-2">
                    <select
                      aria-label="Tipo de documento"
                      value={userForm.tipoDocumento}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, tipoDocumento: event.target.value }))}
                      className="h-9 w-28 shrink-0 rounded-lg border border-border px-2 text-sm"
                    >
                      {TIPOS_DOCUMENTO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                    </select>
                    <input value={userForm.numeroDocumento} onChange={(event) => setUserForm((prev) => ({ ...prev, numeroDocumento: event.target.value }))} placeholder="Número de documento" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <input
                    aria-label="Indicativo"
                    value={userForm.indicativo_pais_telefono}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, indicativo_pais_telefono: event.target.value }))}
                    placeholder="+57"
                    className="h-9 w-20 shrink-0 rounded-lg border border-border px-2 text-sm"
                  />
                  <input value={userForm.telefono} onChange={(event) => setUserForm((prev) => ({ ...prev, telefono: event.target.value }))} placeholder="Teléfono" inputMode="tel" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
                </div>
                <input value={userForm.email} onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="Correo (con él inicia sesión)" type="email" className="h-9 w-full rounded-lg border border-border px-3 text-sm" />
                <input
                  value={userForm.password}
                  onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="Contraseña temporal (9+ caracteres, letras y números)"
                  type="password"
                  autoComplete="new-password"
                  className="h-9 w-full rounded-lg border border-border px-3 text-sm"
                />
                {userForm.rol === "solicitante" ? (
                  <label className="text-xs font-medium text-muted-foreground">Tokens de cotización iniciales
                    <input
                      type="number"
                      min={0}
                      value={userForm.tokensIniciales}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, tokensIniciales: event.target.value }))}
                      className="h-9 w-full rounded-lg border border-border px-3 text-sm"
                    />
                  </label>
                ) : null}
                {userForm.rol === "solicitante" ? (
                  <label className="text-xs font-medium text-muted-foreground">Categoría
                    <select
                      value={userForm.categoriaId}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, categoriaId: event.target.value }))}
                      className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm"
                    >
                      <option value="">Sin categoría</option>
                      {categoriasCotizante.filter((c) => c.activa).map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre} · {textoCategoria(c)}</option>
                      ))}
                    </select>
                    <span className="mt-0.5 block font-normal">
                      Aplica su tier (si abajo no eliges otro) y sus días de Tendencias. Las categorías se crean en Cotizantes.
                    </span>
                  </label>
                ) : null}
                {userForm.rol === "solicitante" ? (
                  <label className="text-xs font-medium text-muted-foreground">Tier
                    <select
                      value={userForm.tier}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, tier: event.target.value as UserFormState["tier"] }))}
                      className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm"
                    >
                      <option value="">{userForm.categoriaId ? "El de la categoría" : "Automático (empieza en Bronze y sube con su actividad)"}</option>
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
              {userForm.rol === "asesor" || userForm.rol === "admin"
                ? "Los asesores los crea cada empresa desde su panel; las cuentas de administración no se crean desde aquí."
                : userForm.rol === "solicitante"
                  ? "El cotizante queda verificado: entra con este correo y contraseña sin código de verificación, aunque el registro público esté cerrado. Puede cambiar la contraseña en Mi perfil."
                : userForm.rol === "importador"
                  ? "Se crea la empresa y su cuenta dueña (el representante legal). Logo, descripción y demás datos los completa la empresa en «Mi empresa»."
                : userForm.rol === "designer"
                  ? "Diseño pone portada e imágenes con la identidad de Zarpi a lo aprobado en Tendencias y lo publica. Entra al canal del equipo; no ve soporte ni clientes."
                  : "Atención al cliente atiende tickets e incidentes; no administra la plataforma."}
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
                {submitting ? "Guardando..." : "Crear cuenta"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
