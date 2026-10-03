import { apiRequest, getStoredToken, resolveApiUrl } from "@/services/api-client";
import type { BackendImporter } from "@/services/business.service";
import type { RegisterResponse } from "@/types/auth";

export type AdminUserRole = "solicitante" | "importador" | "asesor" | "admin";

export interface AdminUser {
  id: string;
  email: string;
  rol: AdminUserRole | string;
  importador_id: string | null;
  nombre: string | null;
  activo: boolean;
  perfil_completo: boolean;
  fecha_creacion: string;
  tier?: string;
  tier_manual?: boolean;
  puntos_cotizacion?: number;
}

export interface AdminCotizante {
  id: string;
  email: string;
  nombre: string | null;
  tier: string;
  tier_manual: boolean;
  puntos_cotizacion: number;
  fecha_creacion: string;
}

export interface AdminTierThreshold {
  tier: string;
  minimo_cotizaciones: number;
  minimo_ordenes: number;
  minimo_valor_operaciones_usd: number;
}

export interface AdminPointMovement {
  id: string;
  usuario_id: string;
  admin_id: string | null;
  cotizacion_id: string | null;
  tipo: string;
  delta: number;
  saldo_resultante: number;
  descripcion: string | null;
  fecha: string;
}

export interface AdminMetricas {
  total_cotizaciones: number;
  cotizaciones_dirigidas: number;
  cotizaciones_abiertas: number;
  tasa_respuesta_abiertas: number;
  tiempo_promedio_primera_propuesta_horas: number | null;
  tasa_conversion_a_orden: number;
  importadores_activos: number;
  importadores_verificados: number;
  ordenes_en_disputa: number;
}

export interface AdminCotizacionAbierta {
  id: string;
  solicitante_id: string;
  nombre_producto: string;
  pais_importacion: string;
  linea_producto: string;
  estado: string;
  fecha_creacion: string;
}

/**
 * Orden con un incidente abierto reportado por el solicitante. `id` ES el id de
 * la orden: la disputa vive en la propia orden (`en_disputa`), no en una tabla
 * aparte, y es ese id el que espera `resolveDispute`.
 */
export interface AdminDisputa {
  id: string;
  cotizacion_id: string;
  importador_id: string;
  solicitante_id: string;
  estado: string;
  motivo_disputa: string | null;
  fecha_actualizacion: string;
}

/** Un punto comprobable del expediente de verificación de una empresa. */
export interface RequisitoVerificacion {
  clave: string;
  titulo: string;
  detalle: string;
  cumple: boolean;
  valor: string;
}

/** Qué cumple y qué le falta a una empresa para llevar el sello. */
export interface ExpedienteVerificacion {
  importador_id: string;
  nombre_empresa: string;
  verificado: boolean;
  estado: string;
  obligatorios: RequisitoVerificacion[];
  recomendables: RequisitoVerificacion[];
  obligatorios_cumplidos: number;
  obligatorios_totales: number;
  recomendables_cumplidos: number;
  recomendables_totales: number;
  listo_para_verificar: boolean;
  pendientes: string[];
}

/** Ficha de un agente de la mesa de soporte, con su desempeño. */
export interface AdminAgenteSoporte {
  id: string;
  email: string;
  nombre: string | null;
  activo: boolean;
  nivel: number | null;
  tickets_asignados: number;
  tickets_cerrados: number;
  calificaciones_recibidas: number;
  calificacion_promedio: number | null;
}

/** Fila del supervisor de chats: una conversación con sus dos participantes. */
export interface AdminConversacion {
  id: string;
  /** "negociacion" o "interna" (coordinación de una empresa con su asesor). */
  tipo: string;
  cotizacion_id: string | null;
  orden_id: string | null;
  fecha_creacion: string;
  solicitante_id: string | null;
  solicitante_nombre: string | null;
  solicitante_email: string | null;
  importador_usuario_id: string;
  importador_usuario_nombre: string | null;
  importador_usuario_email: string | null;
  importador_id: string | null;
  empresa_nombre: string | null;
  total_mensajes: number;
  ultimo_mensaje_texto: string | null;
  ultimo_mensaje_fecha: string | null;
}

export interface AdminConversacionesResponse {
  items: AdminConversacion[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminMensaje {
  id: string;
  conversacion_id: string;
  remitente_id: string;
  remitente_nombre: string | null;
  remitente_email: string | null;
  remitente_rol: string | null;
  contenido: string;
  tipo: string;
  fecha_envio: string;
}

/** Sello que la plataforma crea y otorga a las empresas que respalda. */
export interface AdminCertificacion {
  id: string;
  nombre: string;
  descripcion: string;
  logo_url: string | null;
  /** Cuánto empuja a la empresa hacia arriba en el catálogo del solicitante. */
  peso_publicidad: number;
  activa: boolean;
  fecha_creacion: string | null;
  empresas_certificadas: number;
}

export interface CertificacionOtorgada {
  id: string;
  certificacion_id: string;
  nombre: string;
  descripcion: string;
  logo_url: string | null;
  peso_publicidad: number;
  fecha_otorgada: string | null;
}

export interface CertificacionesDeEmpresa {
  importador_id: string;
  puntaje_publicidad: number;
  certificaciones: CertificacionOtorgada[];
}

export interface CertificacionPayload {
  nombre: string;
  descripcion: string;
  logo_url?: string | null;
  peso_publicidad: number;
  activa?: boolean;
}

export interface BackupResumen {
  revision_alembic: string | null;
  tablas: Record<string, number>;
  total_filas: number;
  archivos: number;
  bytes_archivos: number;
}

export interface TablaBackupComparada {
  tabla: string;
  en_backup: number;
  /** null: la tabla no existe en esta versión de la plataforma. */
  actual: number | null;
}

/** Vista previa de un ZIP subido, antes de restaurarlo. */
export interface BackupSubido {
  subida_id: string;
  nombre_original: string;
  tamano_bytes: number;
  generado_en: string | null;
  revision_alembic: string | null;
  revision_actual: string | null;
  incluye_archivos: boolean;
  archivos: number;
  total_filas_backup: number;
  total_filas_actual: number;
  tablas: TablaBackupComparada[];
  advertencias: string[];
}

export interface ResultadoRestauracion {
  tablas_restauradas: number;
  filas_restauradas: number;
  archivos_restaurados: number;
  tablas_desconocidas: string[];
  cotizaciones_abiertas_reindexadas: number;
  backup_previo: string | null;
  /** false: la cuenta que restauró no existe en la copia; hay que volver a entrar. */
  sesion_vigente: boolean;
}

export interface BackupPrevio {
  nombre: string;
  tamano_bytes: number;
}

function detalleDeError(cuerpo: unknown, porDefecto: string): string {
  if (cuerpo && typeof cuerpo === "object" && "detail" in cuerpo) {
    const detalle = (cuerpo as { detail: unknown }).detail;
    if (typeof detalle === "string" && detalle.trim()) return detalle;
  }
  return porDefecto;
}

async function descargarBlob(ruta: string, nombrePorDefecto: string): Promise<string> {
  const token = getStoredToken();
  const response = await fetch(resolveApiUrl(ruta), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error(detalleDeError(await response.json().catch(() => null), "No se pudo descargar la copia."));
  }
  const disposition = response.headers.get("content-disposition") || "";
  const nombre = /filename="?([^";]+)"?/i.exec(disposition)?.[1] || nombrePorDefecto;
  const objectUrl = window.URL.createObjectURL(await response.blob());
  const enlace = document.createElement("a");
  enlace.href = objectUrl;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.URL.revokeObjectURL(objectUrl);
  return nombre;
}

export interface CreateImporterWithOwnerPayload {
  nombre_empresa: string;
  logo_url?: string;
  especialidad_producto: string[];
  paises_origen: string[];
  tiempo_respuesta_promedio: string;
  capacidad_volumen?: number;
  solo_cotizaciones_directas?: boolean;
  /**
   * Ficha pública de la empresa (sitio web, contacto, NIT...). Antes estos
   * datos solo vivían en el `localStorage` del navegador del administrador que
   * dio de alta la empresa: nadie más los veía y se perdían al limpiar el
   * navegador.
   */
  perfil_publico?: Record<string, unknown>;
  email_dueño: string;
  password_dueño: string;
  nombre_dueño?: string;
}

export interface CreateImporterWithOwnerResponse {
  importador: BackendImporter;
  usuario_dueño_id: string;
  email_dueño: string;
}

export interface InviteSolicitantePayload {
  email: string;
  password: string;
  nombre: string;
  telefono: string;
  indicativo_pais_telefono: string;
}

export interface EnvioCorreoMasivoPayload {
  asunto: string;
  cuerpo: string;
  roles?: string[];
  usuarios_ids?: string[];
  correos?: string[];
}

export interface EnvioCorreoMasivoResponse {
  destinatarios: number;
  enviados: number;
  fallidos: number;
  fallos: string[];
}

// ---- Asignación de solicitudes abiertas y ajustes de operación ----

export type ModoAsignacion = "manual" | "automatica";

export interface EstadoTrm {
  valor: number;
  /** oficial · respaldo_admin · ultima_oficial · por_defecto */
  fuente: string;
  vigencia: string | null;
  fecha_consulta: string | null;
  consulta_automatica: boolean;
  respaldo_admin: number | null;
  ultima_oficial: number | null;
  ultima_oficial_vigencia: string | null;
  ultima_oficial_consulta: string | null;
  valor_por_defecto: number;
}

export interface ConfiguracionOperacion {
  asignacion: { modo: ModoAsignacion; cupo_por_solicitud: number };
  trm: EstadoTrm;
}

export interface AsignacionResumen {
  importador_id: string;
  nombre_empresa: string;
  origen: string | null;
  fecha_asignacion: string | null;
  estado_propuesta: string | null;
}

export interface SolicitudAbiertaAdmin {
  id: string;
  nombre_producto: string;
  linea_producto: string;
  pais_importacion: string;
  cantidad_minima: number;
  unidad_cantidad: string;
  precio_objetivo_usd: number | null;
  moneda_precio_objetivo: string;
  tipo_calidad: string;
  incoterm: string;
  estado: string;
  fecha_creacion: string;
  horas_desde_creacion: number;
  asignadas: number;
  cupo_por_solicitud: number;
  propuestas_enviadas: number;
  empresas: AsignacionResumen[];
}

export interface CriterioEncaje {
  cumple: boolean | null;
  detalle: string;
}

export interface CandidatoAsignacion {
  importador_id: string;
  nombre_empresa: string;
  logo_url: string | null;
  verificado: boolean;
  especialidades: string[];
  paises_origen: string[];
  calificacion_promedio: number;
  tiempo_respuesta_promedio: string | null;
  pedido_minimo: number | null;
  pedido_minimo_unidad: string | null;
  capacidad_volumen: number | null;
  limite_cotizaciones_diarias: number | null;
  recibidas_hoy: number;
  cupo_diario_agotado: boolean;
  encaje: { categoria: boolean; pais: boolean; pedido_minimo: CriterioEncaje; capacidad: CriterioEncaje };
  desempeno: {
    solicitudes_asignadas: number;
    propuestas_enviadas: number;
    propuestas_aceptadas: number;
    tasa_respuesta_pct: number | null;
    tasa_cierre_pct: number | null;
    pedidos_entregados: number;
    pedidos_activos: number;
  };
  asignada: boolean;
  origen_asignacion: string | null;
  fecha_asignacion: string | null;
  estado_propuesta: string | null;
  puntaje: number;
}

export interface CandidatosResponse {
  solicitud: SolicitudAbiertaAdmin;
  candidatos: CandidatoAsignacion[];
}

export const adminService = {
  /**
   * `/importadores` pagina con un tope por defecto de 50: sin pedir el máximo,
   * el panel de administración dejaba fuera empresas sin avisar.
   */
  listCompanies(): Promise<BackendImporter[]> {
    return apiRequest<BackendImporter[]>("/importadores?limit=200&offset=0", { method: "GET" });
  },

  createImporterWithOwner(payload: CreateImporterWithOwnerPayload): Promise<CreateImporterWithOwnerResponse> {
    return apiRequest<CreateImporterWithOwnerResponse>("/admin/importadores", {
      method: "POST",
      body: payload,
    });
  },

  updateImporterStatus(importadorId: string, estado: "activo" | "inactivo"): Promise<BackendImporter> {
    return apiRequest<BackendImporter>(`/admin/importadores/${importadorId}/estado?estado=${estado}`, {
      method: "PUT",
    });
  },

  verifyImporter(importadorId: string): Promise<BackendImporter> {
    return apiRequest<BackendImporter>(`/admin/importadores/${importadorId}/verificar`, {
      method: "POST",
    });
  },

  /** Qué cumple y qué le falta a una empresa antes de decidir si se verifica. */
  getVerificationFile(importadorId: string): Promise<ExpedienteVerificacion> {
    return apiRequest<ExpedienteVerificacion>(`/admin/importadores/${importadorId}/expediente`, {
      method: "GET",
    });
  },

  /** Retira el sello dejando escrito el motivo. No desactiva la empresa. */
  revokeImporterVerification(importadorId: string, motivo: string): Promise<BackendImporter> {
    return apiRequest<BackendImporter>(`/admin/importadores/${importadorId}/retirar-verificacion`, {
      method: "POST",
      body: { motivo },
    });
  },

  listUsers(filters?: { rol?: string; activo?: boolean }): Promise<AdminUser[]> {
    const query = new URLSearchParams();
    if (filters?.rol) {
      query.set("rol", filters.rol);
    }
    if (typeof filters?.activo === "boolean") {
      query.set("activo", String(filters.activo));
    }
    const suffix = query.toString();
    return apiRequest<AdminUser[]>(`/admin/usuarios${suffix ? `?${suffix}` : ""}`, {
      method: "GET",
    });
  },

  sendBulkEmail(payload: EnvioCorreoMasivoPayload): Promise<EnvioCorreoMasivoResponse> {
    return apiRequest<EnvioCorreoMasivoResponse>("/admin/correos/masivo", {
      method: "POST",
      body: payload,
    });
  },

  updateUserStatus(usuarioId: string, activo: boolean): Promise<AdminUser> {
    return apiRequest<AdminUser>(`/admin/usuarios/${usuarioId}/estado`, {
      method: "PUT",
      body: { activo },
    });
  },

  listCotizantes(search?: string): Promise<AdminCotizante[]> {
    const suffix = search?.trim() ? `?buscar=${encodeURIComponent(search.trim())}` : "";
    return apiRequest<AdminCotizante[]>(`/admin/cotizantes${suffix}`, { method: "GET" });
  },

  updateCotizanteTier(usuarioId: string, tier: string): Promise<AdminCotizante> {
    return apiRequest<AdminCotizante>(`/admin/cotizantes/${usuarioId}/tier`, {
      method: "PUT",
      body: { tier },
    });
  },

  getTierThresholds(): Promise<AdminTierThreshold[]> {
    return apiRequest<AdminTierThreshold[]>("/admin/cotizantes/tier-umbrales", { method: "GET" });
  },

  updateTierThresholds(umbrales: AdminTierThreshold[]): Promise<AdminTierThreshold[]> {
    return apiRequest<AdminTierThreshold[]>("/admin/cotizantes/tier-umbrales", {
      method: "PUT",
      body: { umbrales },
    });
  },

  adjustCotizantePoints(usuarioId: string, delta: number, tipo: "recarga" | "ajuste", descripcion?: string): Promise<AdminCotizante> {
    return apiRequest<AdminCotizante>(`/admin/cotizantes/${usuarioId}/puntos`, {
      method: "POST",
      body: { delta, tipo, descripcion: descripcion?.trim() || undefined },
    });
  },

  listCotizantePointMovements(usuarioId: string): Promise<AdminPointMovement[]> {
    return apiRequest<AdminPointMovement[]>(`/admin/cotizantes/${usuarioId}/puntos/movimientos`, { method: "GET" });
  },

  getMetricas(): Promise<AdminMetricas> {
    return apiRequest<AdminMetricas>("/admin/metricas", { method: "GET" });
  },

  /** Supervisión: todas las conversaciones de la plataforma, paginadas. */
  listConversations(filters?: { buscar?: string; importadorId?: string; limit?: number; offset?: number }): Promise<AdminConversacionesResponse> {
    const query = new URLSearchParams();
    if (filters?.buscar?.trim()) {
      query.set("buscar", filters.buscar.trim());
    }
    if (filters?.importadorId) {
      query.set("importador_id", filters.importadorId);
    }
    query.set("limit", String(filters?.limit ?? 50));
    query.set("offset", String(filters?.offset ?? 0));
    return apiRequest<AdminConversacionesResponse>(`/admin/conversaciones?${query.toString()}`, { method: "GET" });
  },

  /** Historial completo de una conversación, para atender el caso desde soporte. */
  getConversationMessages(conversacionId: string): Promise<AdminMensaje[]> {
    return apiRequest<AdminMensaje[]>(`/admin/conversaciones/${conversacionId}/mensajes`, { method: "GET" });
  },

  /**
   * Responde en la conversación como equipo de la plataforma. Queda marcado
   * como mensaje de sistema y avisa a las dos partes.
   */
  replyAsSupport(conversacionId: string, contenido: string): Promise<AdminMensaje> {
    return apiRequest<AdminMensaje>(`/admin/conversaciones/${conversacionId}/mensajes`, {
      method: "POST",
      body: { contenido },
    });
  },

  /** La mesa de soporte con su nivel y su desempeño. */
  listSupportTeam(): Promise<AdminAgenteSoporte[]> {
    return apiRequest<AdminAgenteSoporte[]>("/admin/equipo-soporte", { method: "GET" });
  },

  /** Sube o baja a un agente de nivel. Solo administración. */
  setAgentLevel(usuarioId: string, nivel: number): Promise<AdminAgenteSoporte> {
    return apiRequest<AdminAgenteSoporte>(`/admin/equipo-soporte/${usuarioId}/nivel`, {
      method: "PUT",
      body: { nivel },
    });
  },

  /** Órdenes con un incidente abierto reportado por el solicitante. */
  listDisputes(): Promise<AdminDisputa[]> {
    return apiRequest<AdminDisputa[]>("/admin/disputas", { method: "GET" });
  },

  /** Cierra el incidente dejando constancia de la resolución aplicada. */
  resolveDispute(ordenId: string, resolucion: string): Promise<unknown> {
    return apiRequest<unknown>(`/admin/disputas/${ordenId}/resolver`, {
      method: "PUT",
      body: { resolucion },
    });
  },

  listOpenQuotes(): Promise<AdminCotizacionAbierta[]> {
    return apiRequest<AdminCotizacionAbierta[]>("/admin/cotizaciones-abiertas", { method: "GET" });
  },

  // ---- Certificaciones de plataforma ----

  listCertifications(): Promise<AdminCertificacion[]> {
    return apiRequest<AdminCertificacion[]>("/admin/certificaciones", { method: "GET" });
  },

  createCertification(payload: CertificacionPayload): Promise<AdminCertificacion> {
    return apiRequest<AdminCertificacion>("/admin/certificaciones", { method: "POST", body: payload });
  },

  updateCertification(certificacionId: string, payload: Partial<CertificacionPayload>): Promise<AdminCertificacion> {
    return apiRequest<AdminCertificacion>(`/admin/certificaciones/${certificacionId}`, {
      method: "PUT",
      body: payload,
    });
  },

  /** Retira el sello del catálogo sin borrar a quién se le había otorgado. */
  retireCertification(certificacionId: string): Promise<AdminCertificacion> {
    return apiRequest<AdminCertificacion>(`/admin/certificaciones/${certificacionId}`, { method: "DELETE" });
  },

  grantCertification(importadorId: string, certificacionId: string, notas?: string): Promise<CertificacionesDeEmpresa> {
    return apiRequest<CertificacionesDeEmpresa>(`/admin/importadores/${importadorId}/certificaciones`, {
      method: "POST",
      body: { certificacion_id: certificacionId, notas: notas || null },
    });
  },

  revokeCertification(importadorId: string, certificacionId: string): Promise<CertificacionesDeEmpresa> {
    return apiRequest<CertificacionesDeEmpresa>(
      `/admin/importadores/${importadorId}/certificaciones/${certificacionId}`,
      { method: "DELETE" },
    );
  },

  // ---- Copia de seguridad ----

  getBackupSummary(): Promise<BackupResumen> {
    return apiRequest<BackupResumen>("/admin/backup/resumen", { method: "GET" });
  },

  /**
   * Descarga el ZIP. No usa `apiRequest` porque la respuesta es binaria: se pide
   * como blob y se dispara la descarga desde el navegador.
   */
  async downloadBackup(incluirArchivos = true): Promise<string> {
    const token = getStoredToken();
    const url = resolveApiUrl(`/admin/backup?incluir_archivos=${incluirArchivos ? "true" : "false"}`);

    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const detalle = await response.json().catch(() => ({}));
      throw new Error(typeof detalle?.detail === "string" ? detalle.detail : "No se pudo generar la copia de seguridad.");
    }

    // El backend propone el nombre con marca de tiempo en Content-Disposition.
    const disposition = response.headers.get("content-disposition") || "";
    const propuesto = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
    const nombre = propuesto || `importacionesq8-backup-${new Date().toISOString().slice(0, 10)}.zip`;

    const objectUrl = window.URL.createObjectURL(await response.blob());
    const enlace = document.createElement("a");
    enlace.href = objectUrl;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    window.URL.revokeObjectURL(objectUrl);

    return nombre;
  },

  /**
   * Sube un ZIP de copia para restaurarlo y devuelve la vista previa (no cambia
   * nada todavía). Usa XMLHttpRequest y no fetch porque fetch no informa del
   * progreso de subida, y un ZIP con archivos puede pesar cientos de MB.
   */
  validateBackupUpload(archivo: File, onProgress?: (porcentaje: number) => void): Promise<BackupSubido> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", resolveApiUrl("/admin/backup/restaurar/validar"));
      const token = getStoredToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (evento) => {
        if (evento.lengthComputable && onProgress) onProgress(Math.round((evento.loaded / evento.total) * 100));
      };
      xhr.onload = () => {
        let cuerpo: unknown = null;
        try {
          cuerpo = JSON.parse(xhr.responseText);
        } catch {
          /* respuesta no JSON */
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(cuerpo as BackupSubido);
        } else {
          reject(new Error(detalleDeError(cuerpo, `No se pudo subir la copia (HTTP ${xhr.status}).`)));
        }
      };
      xhr.onerror = () => reject(new Error("Se perdió la conexión mientras se subía la copia."));
      const formulario = new FormData();
      formulario.append("archivo", archivo);
      xhr.send(formulario);
    });
  },

  applyBackupRestore(subidaId: string, incluirArchivos: boolean): Promise<ResultadoRestauracion> {
    return apiRequest<ResultadoRestauracion>(`/admin/backup/restaurar/${subidaId}`, {
      method: "POST",
      body: { confirmacion: "RESTAURAR", incluir_archivos: incluirArchivos },
    });
  },

  discardBackupUpload(subidaId: string): Promise<void> {
    return apiRequest<void>(`/admin/backup/restaurar/${subidaId}`, { method: "DELETE" });
  },

  listPreviousBackups(): Promise<BackupPrevio[]> {
    return apiRequest<BackupPrevio[]>("/admin/backup/previos", { method: "GET" });
  },

  downloadPreviousBackup(nombre: string): Promise<string> {
    return descargarBlob(`/admin/backup/previos/${encodeURIComponent(nombre)}`, nombre);
  },

  /** Deja una copia previa lista para restaurar (deshacer) sin volver a subirla. */
  preparePreviousBackup(nombre: string): Promise<BackupSubido> {
    return apiRequest<BackupSubido>(`/admin/backup/previos/${encodeURIComponent(nombre)}/preparar`, { method: "POST" });
  },

  inviteSolicitante(payload: InviteSolicitantePayload): Promise<RegisterResponse> {
    return apiRequest<RegisterResponse>("/auth/register", {
      method: "POST",
      body: {
        email: payload.email,
        password: payload.password,
        rol: "solicitante",
        tipo_persona: "natural",
        nombre: payload.nombre,
        tipo_documento: "CC",
        numero_documento: `INV-${Date.now()}`,
        indicativo_pais_telefono: payload.indicativo_pais_telefono,
        telefono: payload.telefono,
        acepto_politica_datos: true,
      },
    });
  },

  // ---- Asignación de solicitudes abiertas ----

  getOperationSettings(): Promise<ConfiguracionOperacion> {
    return apiRequest<ConfiguracionOperacion>("/admin/configuracion-operacion", { method: "GET" });
  },

  updateAssignmentSettings(payload: { modo?: ModoAsignacion; cupo_por_solicitud?: number }): Promise<ConfiguracionOperacion> {
    return apiRequest<ConfiguracionOperacion>("/admin/configuracion-operacion/asignacion", { method: "PUT", body: payload });
  },

  updateTrmFallback(respaldo: number | null): Promise<EstadoTrm> {
    return apiRequest<EstadoTrm>("/admin/configuracion-operacion/trm", { method: "PUT", body: { respaldo } });
  },

  refreshTrm(): Promise<EstadoTrm> {
    return apiRequest<EstadoTrm>("/admin/configuracion-operacion/trm/consultar", { method: "POST" });
  },

  listOpenRequests(filtro: "por_asignar" | "vigentes" | "todas" = "vigentes"): Promise<SolicitudAbiertaAdmin[]> {
    return apiRequest<SolicitudAbiertaAdmin[]>(`/admin/solicitudes-abiertas?filtro=${filtro}`, { method: "GET" });
  },

  listAssignmentCandidates(cotizacionId: string, soloQueEncajan = true): Promise<CandidatosResponse> {
    return apiRequest<CandidatosResponse>(
      `/admin/solicitudes-abiertas/${cotizacionId}/candidatos?solo_que_encajan=${soloQueEncajan}`,
      { method: "GET" },
    );
  },

  assignRequest(cotizacionId: string, importadorIds: string[]): Promise<SolicitudAbiertaAdmin> {
    return apiRequest<SolicitudAbiertaAdmin>(`/admin/solicitudes-abiertas/${cotizacionId}/asignar`, {
      method: "POST",
      body: { importador_ids: importadorIds },
    });
  },

  unassignRequest(cotizacionId: string, importadorId: string): Promise<SolicitudAbiertaAdmin> {
    return apiRequest<SolicitudAbiertaAdmin>(
      `/admin/solicitudes-abiertas/${cotizacionId}/asignaciones/${importadorId}`,
      { method: "DELETE" },
    );
  },
};
