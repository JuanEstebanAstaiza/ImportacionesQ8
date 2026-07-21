import { apiRequest } from "@/services/api-client";

export interface BackendImporter {
  id: string;
  nombre_empresa: string;
  especialidad_producto: string[];
  paises_origen: string[];
  calificacion_promedio: number;
  tiempo_respuesta_promedio: string;
  verificado: boolean;
  fecha_registro: string;
}

export interface BackendCotizacion {
  id: string;
  importador_id: string | null;
  modalidad: "dirigida" | "abierta";
  pais_importacion: string;
  nombre_producto: string;
  descripcion_cliente: string;
  linea_producto: string;
  tipo_calidad: string;
  cantidad_minima: number;
  precio_objetivo_usd: number | null;
  incoterm: string;
  estado: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface CreateCotizacionPayload {
  modalidad: "dirigida" | "abierta";
  importador_id?: string;
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
}

export interface BackendAsesor {
  id: string;
  email: string;
  nombre: string | null;
  telefono: string | null;
  activo: boolean;
  fecha_creacion: string;
}

export interface CreateAsesorPayload {
  email: string;
  password: string;
  nombre?: string;
  telefono?: string;
}

export interface BackendAsesorCotizacion {
  id: string;
  modalidad: "dirigida" | "abierta";
  nombre_producto: string;
  cantidad_minima: number;
  precio_objetivo_usd: number | null;
  incoterm: string;
  estado: string;
  fecha_creacion: string;
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
  solo_cotizaciones_directas?: boolean;
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
  en_disputa: boolean;
  motivo_disputa: string | null;
  conversacion_id: string | null;
  historial_estados: BackendEstadoOrdenItem[];
  documentos_adjuntos: BackendDocumentoOrdenItem[];
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

export const businessService = {
  listImporters(): Promise<BackendImporter[]> {
    return apiRequest<BackendImporter[]>("/importadores", { method: "GET" });
  },

  listQuotes(): Promise<BackendCotizacion[]> {
    return apiRequest<BackendCotizacion[]>("/cotizaciones", { method: "GET" });
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

  deleteCompanyAdvisor(asesorId: string): Promise<void> {
    return apiRequest<void>(`/importadores/asesores/${asesorId}`, {
      method: "DELETE",
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
    return apiRequest<BackendOrder[]>("/ordenes/", { method: "GET" });
  },

  getOrderById(orderId: string): Promise<BackendOrder> {
    return apiRequest<BackendOrder>(`/ordenes/${orderId}`, {
      method: "GET",
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

  sendChatMessage(conversationId: string, payload: { contenido: string; tipo?: string }): Promise<BackendChatMessage> {
    return apiRequest<BackendChatMessage>(`/chat/conversaciones/${conversationId}/mensajes`, {
      method: "POST",
      body: payload,
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
};
