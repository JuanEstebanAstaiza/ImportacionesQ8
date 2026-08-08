import { apiRequest } from "@/services/api-client";

/** Sello otorgado por la plataforma, tal como llega en el catálogo. */
export interface BackendCertificacionOtorgada {
  id: string;
  certificacion_id: string;
  nombre: string;
  descripcion: string;
  logo_url: string | null;
  peso_publicidad: number;
  fecha_otorgada: string | null;
}

export interface BackendImporter {
  id: string;
  nombre_empresa: string;
  logo_url?: string | null;
  certificaciones?: BackendCertificacionOtorgada[];
  /** Suma de los pesos de sus sellos: define el orden del catálogo. */
  puntaje_publicidad?: number;
  especialidad_producto: string[];
  paises_origen: string[];
  calificacion_promedio: number;
  tiempo_respuesta_promedio: string;
  capacidad_volumen?: number | null;
  perfil_publico?: Record<string, unknown> | null;
  solo_cotizaciones_directas?: boolean;
  estado?: string;
  verificado: boolean;
  /** Prefijo de la empresa en el shipping mark (ej. "ctl"). */
  shipping_mark_prefijo?: string | null;
  fecha_registro: string;
}

export interface BackendCotizacion {
  id: string;
  solicitante_id?: string;
  importador_id: string | null;
  modalidad: "dirigida" | "abierta";
  foto_producto?: string | null;
  pais_importacion: string;
  nivel_personalizacion?: string | null;
  nombre_producto: string;
  descripcion_cliente: string;
  link_referencia?: string | null;
  linea_producto: string;
  tipo_calidad: string;
  modalidad_importacion?: string | null;
  cantidad_minima: number;
  precio_objetivo_usd: number | null;
  incoterm: string;
  notas_adicionales?: string | null;
  /** Parte del shipping mark que escribe el cliente (ej. "prendas control"). */
  shipping_mark_sufijo?: string | null;
  /** Marca ya compuesta ("ctl-prendascontrol"); null mientras no se sepa la empresa. */
  shipping_mark?: string | null;
  campos_personalizados_valores?: Record<string, unknown> | null;
  asesor_asignado_id?: string | null;
  conversacion_id?: string | null;
  estado: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface CreateCotizacionPayload {
  modalidad: "dirigida" | "abierta";
  importador_id?: string;
  foto_producto?: string;
  pais_importacion: string;
  nombre_producto: string;
  descripcion_cliente: string;
  link_referencia?: string;
  linea_producto: string;
  tipo_calidad: "economica" | "estandar" | "premium";
  nivel_personalizacion?: string;
  modalidad_importacion?: string;
  cantidad_minima: number;
  precio_objetivo_usd?: number;
  incoterm: string;
  notas_adicionales?: string;
  shipping_mark_sufijo?: string;
  campos_personalizados_valores?: Record<string, unknown>;
}

export interface BackendAsesor {
  id: string;
  email: string;
  nombre: string | null;
  telefono: string | null;
  activo: boolean;
  fecha_creacion: string;
}

/** Qué se movió al reasignar trabajo entre cuentas de la empresa. */
export interface BackendReasignacion {
  cotizaciones_reasignadas: number;
  ordenes_reasignadas: number;
  conversaciones_reasignadas: number;
}

export interface BackendAsesorEstadoResponse extends BackendAsesor, BackendReasignacion {}

export interface UpdateAsesorEstadoPayload {
  activo: boolean;
}

export interface CreateAsesorPayload {
  email: string;
  password: string;
  nombre?: string;
  telefono?: string;
}

export interface BackendAsesorCotizacion {
  id: string;
  solicitante_id: string;
  modalidad: "dirigida" | "abierta";
  nombre_producto: string;
  descripcion_cliente: string;
  cantidad_minima: number;
  precio_objetivo_usd: number | null;
  incoterm: string;
  estado: string;
  fecha_creacion: string;
  asesor_asignado_id: string | null;
}

export interface BackendContactoAsesor {
  usuario_id: string;
  nombre: string | null;
  foto_url: string | null;
  whatsapp: string | null;
}

export interface BackendPropuesta {
  id: string;
  cotizacion_id: string;
  importador_id: string;
  precio_ofrecido_usd: number;
  tiempo_estimado_entrega: string;
  incoterm: string;
  condiciones_adicionales: string | null;
  estado: string;
  creado_por_usuario_id: string | null;
  preaceptada_por_solicitante: boolean;
  preaceptada_por_empresa: boolean;
  contacto_asesor: BackendContactoAsesor | null;
}

export interface CreatePropuestaPayload {
  cotizacion_id: string;
  precio_ofrecido_usd: number;
  tiempo_estimado_entrega: string;
  incoterm: string;
  condiciones_adicionales?: string;
}

export interface PreAceptarPropuestaPayload {
  aceptar: boolean;
}

export interface StartNegotiationPayload {
  importador_id: string;
}

export interface BackendUserProfile {
  id: string;
  email: string;
  rol: "solicitante" | "importador" | "asesor" | "admin";
  importador_id: string | null;
  nombre: string | null;
  telefono: string | null;
  foto_url: string | null;
  whatsapp: string | null;
  activo: boolean;
  perfil_completo: boolean;
  fecha_creacion: string;
}

export interface UpdateUserProfilePayload {
  nombre?: string;
  telefono?: string;
  foto_url?: string;
  whatsapp?: string;
}

export interface UpdateImporterPayload {
  nombre_empresa?: string;
  logo_url?: string;
  especialidad_producto?: string[];
  paises_origen?: string[];
  tiempo_respuesta_promedio?: string;
  capacidad_volumen?: number;
  perfil_publico?: Record<string, unknown>;
  solo_cotizaciones_directas?: boolean;
  shipping_mark_prefijo?: string;
}

export interface BackendEstadoOrdenItem {
  estado: string;
  fecha: string;
  nota: string | null;
}

export interface BackendDocumentoOrdenItem {
  nombre: string;
  url: string;
  tipo: string;
  fecha_subida: string;
}

/* ------------------------------------------------------------------
 * Resenas de empresas importadoras
 * ---------------------------------------------------------------- */

export interface BackendResena {
  id: string;
  importador_id: string;
  orden_id: string;
  calificacion: number;
  comentario?: string | null;
  puntualidad?: number | null;
  calidad_producto?: number | null;
  comunicacion?: number | null;
  respuesta_empresa?: string | null;
  fecha_respuesta?: string | null;
  visible: boolean;
  /** Nombre de pila de quien la escribio; el backend no expone su correo ni su id. */
  autor_nombre?: string | null;
  fecha_creacion: string;
}

export interface BackendResumenResenas {
  promedio: number;
  total: number;
  /** Reparto por estrellas: {"5": 12, "4": 3, ...} */
  reparto: Record<string, number>;
  puntualidad?: number | null;
  calidad_producto?: number | null;
  comunicacion?: number | null;
}

/** Orden ya entregada que todavia no tiene resena. */
export interface BackendOrdenResenable {
  orden_id: string;
  importador_id: string;
  nombre_empresa: string;
  producto: string;
  fecha_creacion: string;
}

export interface CrearResenaPayload {
  orden_id: string;
  calificacion: number;
  comentario?: string;
  puntualidad?: number;
  calidad_producto?: number;
  comunicacion?: number;
}

/* ------------------------------------------------------------------
 * Presentacion de la empresa (video breve y fotos)
 * ---------------------------------------------------------------- */

export type TipoEvidenciaImportador =
  | "certificado"
  | "foto_fabrica"
  | "catalogo"
  | "moq_doc"
  | "video_presentacion"
  | "foto_producto"
  | "otro";

export interface BackendEvidenciaImportador {
  id: string;
  importador_id: string;
  tipo: TipoEvidenciaImportador;
  titulo: string;
  descripcion?: string | null;
  url: string;
  /** "pendiente" | "aprobada" | "rechazada": solo las aprobadas salen en la ficha publica. */
  estado: string;
  nota_revision?: string | null;
  fecha_creacion?: string | null;
  fecha_revision?: string | null;
}

export interface CrearEvidenciaPayload {
  tipo: TipoEvidenciaImportador;
  titulo: string;
  descripcion?: string;
  url: string;
}

/* ------------------------------------------------------------------
 * Referidos
 * ---------------------------------------------------------------- */

export interface BackendCodigoReferido {
  codigo: string;
  activo?: boolean;
}

export interface BackendEstadisticasReferido {
  total_referidos: number;
  creditos_ganados: number;
}

export interface BackendOrder {
  id: string;
  cotizacion_id: string;
  importador_id: string;
  solicitante_id: string;
  asesor_asignado_id: string | null;
  estado: string;
  precio_acordado_usd: number;
  tiempo_estimado_entrega: string | null;
  condiciones_adicionales: string | null;
  /** Marca de embarque congelada al crear la orden ("ctl-prendascontrol"). */
  shipping_mark: string | null;
  en_disputa: boolean;
  motivo_disputa: string | null;
  conversacion_id: string | null;
  historial_estados: BackendEstadoOrdenItem[];
  documentos_adjuntos: BackendDocumentoOrdenItem[];
}

export interface UpdateOrderStatusPayload {
  estado: string;
}

export interface AddOrderDocumentPayload {
  nombre: string;
  url: string;
  tipo: string;
}

export interface BackendChatMessage {
  id: string;
  conversacion_id: string;
  remitente_id: string;
  contenido: string;
  tipo: string;
  fecha_envio: string;
  metadata: Record<string, unknown> | null;
}

export interface BackendChatConversation {
  id: string;
  cotizacion_id: string;
  orden_id: string | null;
  solicitante_id: string;
  importador_usuario_id: string;
  fecha_creacion: string;
  ultimo_mensaje: BackendChatMessage | null;
}

export interface BackendEtiquetaItem {
  id: string;
  owner_user_id: string;
  nombre: string;
  color: string | null;
  created_at: string;
}

export interface BackendCarpetaItem {
  id: string;
  owner_user_id: string;
  parent_id: string | null;
  nombre: string;
  created_at: string;
  updated_at: string;
}

export interface BackendArchivoItem {
  id: string;
  owner_user_id: string;
  carpeta_id: string | null;
  nombre: string;
  extension: string;
  mime_type: string;
  tipo_recurso: string;
  size_bytes: number | null;
  storage_url: string | null;
  origen: string;
  created_at: string;
  updated_at: string;
  favorito: boolean;
  etiquetas: BackendEtiquetaItem[];
}

export interface BackendExplorerResponse {
  carpetas: BackendCarpetaItem[];
  archivos: BackendArchivoItem[];
}

export interface CreateDocumentFolderPayload {
  nombre: string;
  parent_id?: string | null;
}

export interface UpdateDocumentFolderPayload {
  nombre?: string;
  parent_id?: string | null;
}

export interface CreateDocumentFilePayload {
  nombre: string;
  carpeta_id?: string | null;
  mime_type?: string;
  extension?: string;
  size_bytes?: number;
  storage_url?: string;
  origen?: string;
}

export interface UpdateDocumentFilePayload {
  nombre?: string;
  carpeta_id?: string | null;
  favorito?: boolean;
}

export interface ShareDocumentsToChatPayload {
  conversacion_ids: string[];
  archivo_ids: string[];
  mensaje?: string;
}

export interface BackendChatAttachmentItem {
  archivo_id: string;
  mensaje_id: string;
  conversacion_id: string;
  nombre: string;
  mime_type: string;
  extension: string;
  tipo_recurso: string;
  size_bytes: number | null;
  storage_url: string | null;
  created_at: string;
}

export interface BackendNotification {
  id: string;
  usuario_id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  data: Record<string, unknown> | null;
  leida: boolean;
  fecha_creacion: string;
  fecha_lectura: string | null;
}

export interface BackendNotificationsListResponse {
  items: BackendNotification[];
  total: number;
  no_leidas: number;
}

export interface BackendMarkAllNotificationsReadResponse {
  actualizadas: number;
  mensaje: string;
}

export const businessService = {
  listImporters(): Promise<BackendImporter[]> {
    return apiRequest<BackendImporter[]>("/importadores", { method: "GET" });
  },

  listQuotes(): Promise<BackendCotizacion[]> {
    return apiRequest<BackendCotizacion[]>("/cotizaciones", { method: "GET" });
  },

  getQuoteById(cotizacionId: string): Promise<BackendCotizacion> {
    return apiRequest<BackendCotizacion>(`/cotizaciones/${cotizacionId}`, {
      method: "GET",
    });
  },

  createQuote(payload: CreateCotizacionPayload): Promise<BackendCotizacion> {
    return apiRequest<BackendCotizacion>("/cotizaciones", {
      method: "POST",
      body: payload,
    });
  },

  listCompanyAdvisors(): Promise<BackendAsesor[]> {
    return apiRequest<BackendAsesor[]>("/importadores/asesores", { method: "GET" });
  },

  createCompanyAdvisor(payload: CreateAsesorPayload): Promise<BackendAsesor> {
    return apiRequest<BackendAsesor>("/importadores/asesores", {
      method: "POST",
      body: payload,
    });
  },

  /**
   * Activa o desactiva un asesor. Al desactivarlo el backend traspasa su carga
   * (cotizaciones, órdenes y chats) a la cuenta dueña y devuelve cuánto movió,
   * para poder avisárselo al usuario.
   */
  updateCompanyAdvisorStatus(asesorId: string, activo: boolean): Promise<BackendAsesorEstadoResponse> {
    return apiRequest<BackendAsesorEstadoResponse>(`/importadores/asesores/${asesorId}/estado`, {
      method: "PUT",
      body: { activo } satisfies UpdateAsesorEstadoPayload,
    });
  },

  /** Reasigna el responsable de una cotización (o la devuelve al pool con null). */
  assignAdvisorToQuote(cotizacionId: string, asesorId: string | null): Promise<BackendReasignacion> {
    return apiRequest<BackendReasignacion>(`/importadores/cotizaciones/${cotizacionId}/asignar`, {
      method: "PUT",
      body: { asesor_id: asesorId },
    });
  },

  getMyUserProfile(): Promise<BackendUserProfile> {
    return apiRequest<BackendUserProfile>("/usuarios/me", { method: "GET" });
  },

  updateMyUserProfile(payload: UpdateUserProfilePayload): Promise<BackendUserProfile> {
    return apiRequest<BackendUserProfile>("/usuarios/me", {
      method: "PUT",
      body: payload,
    });
  },

  getImporterById(importadorId: string): Promise<BackendImporter> {
    return apiRequest<BackendImporter>(`/importadores/${importadorId}`, {
      method: "GET",
    });
  },

  updateImporterById(importadorId: string, payload: UpdateImporterPayload): Promise<BackendImporter> {
    return apiRequest<BackendImporter>(`/importadores/${importadorId}`, {
      method: "PUT",
      body: payload,
    });
  },

  listOrders(): Promise<BackendOrder[]> {
    return apiRequest<BackendOrder[]>("/ordenes", { method: "GET" });
  },

  getOrderById(orderId: string): Promise<BackendOrder> {
    return apiRequest<BackendOrder>(`/ordenes/${orderId}`, {
      method: "GET",
    });
  },

  updateOrderStatus(orderId: string, payload: UpdateOrderStatusPayload): Promise<Record<string, unknown>> {
    return apiRequest<Record<string, unknown>>(`/ordenes/${orderId}/estado`, {
      method: "PUT",
      body: payload,
    });
  },

  addOrderDocument(orderId: string, payload: AddOrderDocumentPayload): Promise<BackendDocumentoOrdenItem> {
    return apiRequest<BackendDocumentoOrdenItem>(`/ordenes/${orderId}/documentos`, {
      method: "POST",
      body: payload,
    });
  },

  listChatConversations(): Promise<BackendChatConversation[]> {
    return apiRequest<BackendChatConversation[]>("/chat/conversaciones", {
      method: "GET",
    });
  },

  listChatMessages(conversationId: string): Promise<BackendChatMessage[]> {
    return apiRequest<BackendChatMessage[]>(`/chat/conversaciones/${conversationId}/mensajes`, {
      method: "GET",
    });
  },

  sendChatMessage(conversationId: string, payload: { contenido: string; tipo?: string; metadata?: Record<string, unknown> | null }): Promise<BackendChatMessage> {
    return apiRequest<BackendChatMessage>(`/chat/conversaciones/${conversationId}/mensajes`, {
      method: "POST",
      body: payload,
    });
  },

  listDocumentExplorer(parentId?: string | null): Promise<BackendExplorerResponse> {
    const query = parentId ? `?parent_id=${encodeURIComponent(parentId)}` : "";
    return apiRequest<BackendExplorerResponse>(`/documentos/explorador${query}`, {
      method: "GET",
    });
  },

  createDocumentFolder(payload: CreateDocumentFolderPayload): Promise<BackendCarpetaItem> {
    return apiRequest<BackendCarpetaItem>("/documentos/carpetas", {
      method: "POST",
      body: payload,
    });
  },

  updateDocumentFolder(folderId: string, payload: UpdateDocumentFolderPayload): Promise<BackendCarpetaItem> {
    return apiRequest<BackendCarpetaItem>(`/documentos/carpetas/${folderId}`, {
      method: "PATCH",
      body: payload,
    });
  },

  deleteDocumentFolder(folderId: string): Promise<{ success?: boolean }> {
    return apiRequest<{ success?: boolean }>(`/documentos/carpetas/${folderId}`, {
      method: "DELETE",
    });
  },

  createDocumentFile(payload: CreateDocumentFilePayload): Promise<BackendArchivoItem> {
    return apiRequest<BackendArchivoItem>("/documentos/archivos", {
      method: "POST",
      body: payload,
    });
  },

  uploadDocumentFile(file: File, carpetaId?: string | null, origen = "manual"): Promise<BackendArchivoItem> {
    const formData = new FormData();
    formData.append("archivo", file);
    formData.append("origen", origen);
    if (carpetaId) {
      formData.append("carpeta_id", carpetaId);
    }
    return apiRequest<BackendArchivoItem>("/documentos/archivos/upload", {
      method: "POST",
      body: formData,
    });
  },

  updateDocumentFile(fileId: string, payload: UpdateDocumentFilePayload): Promise<BackendArchivoItem> {
    return apiRequest<BackendArchivoItem>(`/documentos/archivos/${fileId}`, {
      method: "PATCH",
      body: payload,
    });
  },

  deleteDocumentFile(fileId: string): Promise<{ success?: boolean }> {
    return apiRequest<{ success?: boolean }>(`/documentos/archivos/${fileId}`, {
      method: "DELETE",
    });
  },

  searchDocumentFiles(query: string): Promise<BackendArchivoItem[]> {
    return apiRequest<BackendArchivoItem[]>(`/documentos/buscar?q=${encodeURIComponent(query)}`, {
      method: "GET",
    });
  },

  shareDocumentsToChat(payload: ShareDocumentsToChatPayload): Promise<{ success: boolean; mensajes_creados: number }> {
    return apiRequest<{ success: boolean; mensajes_creados: number }>("/documentos/compartir-chat", {
      method: "POST",
      body: payload,
    });
  },

  listChatAttachments(conversationId: string): Promise<BackendChatAttachmentItem[]> {
    return apiRequest<BackendChatAttachmentItem[]>(`/documentos/chats/${conversationId}/adjuntos`, {
      method: "GET",
    });
  },

  listMyAssignedQuotes(): Promise<BackendAsesorCotizacion[]> {
    return apiRequest<BackendAsesorCotizacion[]>("/asesores/me/cotizaciones", {
      method: "GET",
    });
  },
  
  listAdvisorAvailableQuotes(): Promise<BackendCotizacion[]> {
    return apiRequest<BackendCotizacion[]>("/cotizaciones/pool-empresa", {
      method: "GET",
    });
  },
  
  claimAdvisorQuote(cotizacionId: string): Promise<BackendCotizacion> {
    return apiRequest<BackendCotizacion>(`/cotizaciones/${cotizacionId}/reclamar`, {
      method: "POST",
    });
  },

  listQuoteProposals(cotizacionId: string): Promise<BackendPropuesta[]> {
    return apiRequest<BackendPropuesta[]>(`/cotizaciones/${cotizacionId}/propuestas`, {
      method: "GET",
    });
  },

  createProposal(payload: CreatePropuestaPayload): Promise<BackendPropuesta> {
    return apiRequest<BackendPropuesta>("/propuestas", {
      method: "POST",
      body: payload,
    });
  },

  createProposalDraft(payload: CreatePropuestaPayload): Promise<BackendPropuesta> {
    return apiRequest<BackendPropuesta>("/propuestas/borrador", {
      method: "POST",
      body: payload,
    });
  },

  sendProposal(propuestaId: string): Promise<BackendPropuesta> {
    return apiRequest<BackendPropuesta>(`/propuestas/${propuestaId}/enviar`, {
      method: "POST",
    });
  },

  updateProposal(propuestaId: string, payload: CreatePropuestaPayload): Promise<BackendPropuesta> {
    return apiRequest<BackendPropuesta>(`/propuestas/${propuestaId}`, {
      method: "PUT",
      body: payload,
    });
  },

  preAcceptProposal(propuestaId: string, aceptar: boolean): Promise<BackendPropuesta> {
    return apiRequest<BackendPropuesta>(`/propuestas/${propuestaId}/pre-aceptar`, {
      method: "POST",
      body: { aceptar } satisfies PreAceptarPropuestaPayload,
    });
  },

  startProposalNegotiation(cotizacionId: string, importadorId: string): Promise<BackendCotizacion> {
    return apiRequest<BackendCotizacion>(`/cotizaciones/${cotizacionId}/propuestas/aceptar`, {
      method: "PUT",
      body: { importador_id: importadorId } satisfies StartNegotiationPayload,
    });
  },

  /* ---------------- Resenas de empresas importadoras ---------------- */

  /** Resenas publicas de una empresa. No exige sesion: el catalogo es publico. */
  listImporterReviews(importadorId: string): Promise<BackendResena[]> {
    return apiRequest<BackendResena[]>(`/resenas/importador/${importadorId}`, { method: "GET" });
  },

  getImporterReviewsSummary(importadorId: string): Promise<BackendResumenResenas> {
    return apiRequest<BackendResumenResenas>(`/resenas/importador/${importadorId}/resumen`, { method: "GET" });
  },

  /** Ordenes entregadas del solicitante que todavia no ha valorado. */
  listPendingReviews(): Promise<BackendOrdenResenable[]> {
    return apiRequest<BackendOrdenResenable[]>("/resenas/pendientes", { method: "GET" });
  },

  listMyReviews(): Promise<BackendResena[]> {
    return apiRequest<BackendResena[]>("/resenas/mias", { method: "GET" });
  },

  createReview(payload: CrearResenaPayload): Promise<BackendResena> {
    return apiRequest<BackendResena>("/resenas", { method: "POST", body: payload });
  },

  updateReview(resenaId: string, payload: Partial<CrearResenaPayload>): Promise<BackendResena> {
    return apiRequest<BackendResena>(`/resenas/${resenaId}`, { method: "PUT", body: payload });
  },

  /** Derecho de replica de la empresa resenada. */
  replyToReview(resenaId: string, respuesta: string): Promise<BackendResena> {
    return apiRequest<BackendResena>(`/resenas/${resenaId}/responder`, {
      method: "POST",
      body: { respuesta },
    });
  },

  /* ---------------- Presentacion de la empresa ---------------- */

  listMyImporterEvidence(): Promise<BackendEvidenciaImportador[]> {
    return apiRequest<BackendEvidenciaImportador[]>("/importadores/evidencias", { method: "GET" });
  },

  /** Presentacion aprobada y visible en la ficha publica de una empresa. */
  listPublicImporterEvidence(importadorId: string): Promise<BackendEvidenciaImportador[]> {
    return apiRequest<BackendEvidenciaImportador[]>(`/importadores/${importadorId}/evidencias`, { method: "GET" });
  },

  createImporterEvidence(payload: CrearEvidenciaPayload): Promise<BackendEvidenciaImportador> {
    return apiRequest<BackendEvidenciaImportador>("/importadores/evidencias", { method: "POST", body: payload });
  },

  deleteImporterEvidence(evidenciaId: string): Promise<void> {
    return apiRequest<void>(`/importadores/evidencias/${evidenciaId}`, { method: "DELETE" });
  },

  /* ---------------- Referidos ---------------- */

  getMyReferralCode(): Promise<BackendCodigoReferido> {
    return apiRequest<BackendCodigoReferido>("/referidos/mi-codigo", { method: "GET" });
  },

  getReferralStats(): Promise<BackendEstadisticasReferido> {
    return apiRequest<BackendEstadisticasReferido>("/referidos/estadisticas", { method: "GET" });
  },

  listNotifications(soloNoLeidas = false): Promise<BackendNotificationsListResponse> {
    const query = soloNoLeidas ? "?solo_no_leidas=true" : "";
    return apiRequest<BackendNotificationsListResponse>(`/notificaciones${query}`, {
      method: "GET",
    });
  },

  markNotificationAsRead(notificationId: string): Promise<BackendNotification> {
    return apiRequest<BackendNotification>(`/notificaciones/${notificationId}/leer`, {
      method: "PUT",
    });
  },

  markAllNotificationsAsRead(): Promise<BackendMarkAllNotificationsReadResponse> {
    return apiRequest<BackendMarkAllNotificationsReadResponse>("/notificaciones/leer-todas", {
      method: "PUT",
    });
  },
};
