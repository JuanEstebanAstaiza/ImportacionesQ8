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
  /** Órdenes que la empresa llevó hasta "entregado" (trayectoria pública). */
  proyectos_completados?: number;
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
  tier_minimo_requerido?: string;
  /** Máximo de cotizaciones que la empresa acepta recibir por día; null = sin límite. */
  limite_cotizaciones_diarias?: number | null;
  /** Pedido mínimo que acepta la empresa y su unidad (criterio de asignación). */
  pedido_minimo?: number | null;
  pedido_minimo_unidad?: UnidadCantidad | null;
}

/** "unidades" o "m3" (metros cúbicos). */
export type UnidadCantidad = "unidades" | "m3";

/** Uso del cupo diario de cotizaciones de la empresa (`GET /importadores/cupo-diario`). */
export interface BackendCupoDiario {
  importador_id: string;
  limite_cotizaciones_diarias: number | null;
  recibidas_hoy: number;
  disponibles_hoy: number | null;
  cupo_agotado: boolean;
  /** Momento (UTC) en que el contador vuelve a cero. */
  reinicia_en: string;
}

export interface BackendCotizacion {
  id: string;
  solicitante_id?: string;
  importador_id: string | null;
  modalidad: "dirigida" | "abierta";
  tier_minimo_requerido?: string;
  desbloqueada_por_puntos?: boolean;
  solicitante_tier?: string;
  solicitante_puntos_cotizacion?: number;
  bloqueada?: boolean;
  foto_producto?: string | null;
  fotos_producto?: string[];
  pais_importacion: string;
  nivel_personalizacion?: string | null;
  nombre_producto: string;
  descripcion_cliente: string;
  link_referencia?: string | null;
  linea_producto: string;
  tipo_calidad: string;
  modalidad_importacion?: string | null;
  cantidad_minima: number;
  unidad_cantidad?: UnidadCantidad;
  precio_objetivo_usd: number | null;
  precio_objetivo_moneda?: string | null;
  moneda_precio_objetivo?: string | null;
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
  /** Fotos del producto en orden; la primera es la portada. Máximo 10. */
  fotos_producto?: string[];
  /** De dónde sale la solicitud; el backend valida que el comprador tenga acceso. */
  origen?: "directa" | "tendencias" | "catalogo";
  tendencia_edicion_id?: string | null;
  tendencia_producto_id?: string;
  catalogo_producto_id?: string;
  pais_importacion: string;
  nombre_producto: string;
  descripcion_cliente: string;
  link_referencia?: string;
  linea_producto: string;
  tipo_calidad: "economica" | "estandar" | "premium";
  nivel_personalizacion?: string;
  modalidad_importacion?: string;
  cantidad_minima: number;
  unidad_cantidad?: UnidadCantidad;
  precio_objetivo_usd?: number;
  precio_objetivo_moneda?: string;
  moneda_precio_objetivo?: string;
  incoterm?: string;
  notas_adicionales?: string;
  shipping_mark_sufijo?: string;
  campos_personalizados_valores?: Record<string, unknown>;
  tier_minimo_requerido?: string;
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
  /** Cantidad que cubre el precio (null = la pedida en la cotización). */
  cantidad?: number | null;
  fecha_envio?: string | null;
  /**
   * Veces que la empresa reescribió la propuesta DESPUÉS de enviarla, y cuándo
   * fue el último cambio. El comprador tiene que verlo: lo que compara ya no
   * es la oferta que llegó. La versión que se muestra es `revisiones + 1`.
   */
  revisiones?: number;
  fecha_modificacion?: string | null;
  /** Si el cliente eligió otra propuesta: por qué (precio, tiempo, condiciones, otro). */
  motivo_descarte?: string | null;
  motivo_descarte_detalle?: string | null;
  /** Solo para el comprador: la empresa y cómo cumple. */
  empresa?: BackendEmpresaPropuesta | null;
  contacto_asesor: BackendContactoAsesor | null;
}

export interface BackendEmpresaPropuesta {
  importador_id: string;
  nombre_empresa: string;
  logo_url: string | null;
  verificado: boolean;
  calificacion_promedio: number;
  total_resenas: number;
  pedidos_entregados: number;
  pedidos_en_curso: number;
}

export type MotivoEleccion = "precio" | "tiempo" | "condiciones" | "otro";

/** Una solicitud que la empresa todavía no responde, con su tiempo de espera. */
export interface BackendPendienteResponder {
  cotizacion_id: string;
  nombre_producto: string;
  linea_producto: string;
  modalidad: string;
  cantidad: number;
  unidad: UnidadCantidad;
  recibida: string;
  horas_esperando: number;
  /** a_tiempo (< 24 h) · atencion (24–48 h) · urgente (> 48 h) */
  nivel: "a_tiempo" | "atencion" | "urgente";
  con_borrador: boolean;
}

export type EtapaPedido = "compra" | "embarque" | "transito" | "nacionalizacion" | "entrega";
export type MotivoPerdida = MotivoEleccion | "sin_motivo";

/** Panel comercial de la empresa (`GET /importadores/panel`), montos en COP. */
export interface BackendPanelEmpresa {
  importador_id: string;
  desde: string | null;
  moneda: "COP";
  trm: number;
  trm_fuente: string;
  solicitudes_recibidas: number;
  propuestas_enviadas: number;
  propuestas_aceptadas: number;
  propuestas_descartadas: number;
  propuestas_esperando: number;
  conversion_pct: number | null;
  cierre_uno_de_cada: number | null;
  tasa_respuesta_pct: number | null;
  tiempo_promedio_respuesta_horas: number | null;
  valor_cerrado_cop: number;
  valor_promedio_cerrado_cop: number | null;
  valor_esperando_cop: number;
  pedidos_por_etapa: Record<EtapaPedido, number>;
  pedidos_entregados: number;
  motivos_perdida: Record<MotivoPerdida, number>;
  pendientes_responder: BackendPendienteResponder[];
  total_pendientes_responder: number;
}

/** TRM que usa la plataforma hoy (`GET /trm`). */
export interface BackendTrm {
  valor: number;
  fuente: string;
  vigencia: string | null;
  fecha_consulta: string | null;
}

export interface CreatePropuestaPayload {
  cotizacion_id: string;
  precio_ofrecido_usd: number;
  tiempo_estimado_entrega: string;
  incoterm: string;
  condiciones_adicionales?: string;
  cantidad?: number;
}

export interface PreAceptarPropuestaPayload {
  aceptar: boolean;
  motivo_eleccion?: MotivoEleccion;
  motivo_detalle?: string;
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
  tier?: string;
  puntos_cotizacion?: number;
  /** Curador de Tendencias (capacidad aparte del rol). */
  es_curador?: boolean;
}

export interface BackendCotizantePerfilPublico {
  solicitante_id: string;
  nombre: string;
  volumen_total_importaciones: {
    peso_total_kg: number;
    volumen_total_m3: number;
    contenedores_total: number;
  };
  cantidad_importaciones: {
    total: number;
    dentro_plataforma: number;
    fuera_plataforma: number;
  };
  valor_promedio_importacion_usd: number;
  actividad_plataforma: {
    cotizaciones_solicitadas: number;
    ordenes_generadas: number;
    valor_promedio_operaciones_usd: number;
  };
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
  /** null quita el límite; omitirlo lo deja como está. */
  limite_cotizaciones_diarias?: number | null;
  /** null quita el pedido mínimo; omitirlo lo deja como está. */
  pedido_minimo?: number | null;
  pedido_minimo_unidad?: UnidadCantidad | null;
}

/**
 * Una entrada del historial tal y como la devuelve `EstadoOrdenItem` del
 * backend. Antes se declaraba `{estado, fecha, nota}`, campos que el backend
 * nunca ha enviado: el historial llegaba entero como `undefined` y el
 * seguimiento salía vacío en pantalla.
 */
export interface BackendEstadoOrdenItem {
  id: string;
  orden_id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  fecha_cambio: string;
}

export interface BackendDocumentoOrdenItem {
  id: string;
  orden_id: string;
  nombre: string;
  url: string;
  tipo: string;
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

export type MonedaEstimacion = "USD" | "COP" | "EUR" | "CNY";

/** Lo que la empresa escribe en la calculadora de precios del chat. */
export interface EstimacionPrecioEntrada {
  moneda: MonedaEstimacion;
  cantidad: number;
  precio_unitario: number;
  flete_internacional: number;
  seguro_pct: number;
  arancel_pct: number;
  iva_pct: number;
  gastos_destino: number;
  margen_pct: number;
  rango_pct: number;
  tasa_cambio_cop?: number | null;
  incoterm?: string | null;
  tiempo_entrega?: string | null;
  validez_dias?: number | null;
  notas?: string | null;
}

/** Desglose calculado por el backend (`services/calculadora_precios.py`). */
export interface DesgloseEstimacion {
  valor_mercancia: number;
  flete_internacional: number;
  seguro: number;
  valor_cif: number;
  arancel: number;
  iva: number;
  gastos_destino: number;
  margen: number;
  total: number;
  costo_unitario: number;
  total_minimo: number;
  total_maximo: number;
  total_cop: number | null;
}

export interface EstimacionPrecioResponse {
  entrada: EstimacionPrecioEntrada;
  desglose: DesgloseEstimacion;
  resumen: string;
}

/** `metadata.estimacion` de un mensaje de chat con `tipo: "estimacion"`. */
export interface EstimacionEnMensaje {
  entrada: EstimacionPrecioEntrada;
  desglose: DesgloseEstimacion;
  cotizacion_id?: string | null;
  orden_id?: string | null;
}

/** Alguien del equipo de la plataforma, para el canal interno. */
export interface BackendMiembroEquipo {
  id: string;
  nombre: string | null;
  email: string;
  rol: string;
  nivel_soporte: number | null;
  activo: boolean;
}

export interface BackendChatConversation {
  id: string;
  /**
   * "negociacion" es el hilo solicitante ↔ empresa; "interna" es el canal de
   * coordinación de la empresa con uno de sus asesores, que el cliente no ve.
   * En las internas no hay cotización ni solicitante.
   */
  tipo: "negociacion" | "interna" | "soporte";
  cotizacion_id: string | null;
  orden_id: string | null;
  solicitante_id: string | null;
  importador_usuario_id: string | null;
  importador_id: string | null;
  /** Nombre de la otra parte, ya resuelto por el backend. */
  contraparte_nombre: string | null;
  /**
   * Quién está al otro lado, resuelto por el backend según quién consulta.
   * Sin el rol y la empresa, la cabecera del chat rotulaba todas las
   * conversaciones igual y no se distinguía un cliente de un asesor.
   */
  contraparte_id?: string | null;
  contraparte_rol?: string | null;
  contraparte_empresa?: string | null;
  contraparte_foto_url?: string | null;
  /** Solo en tickets de soporte. */
  asunto: string | null;
  urgencia: UrgenciaSoporte | null;
  solicitante_rol: string | null;
  /** Mensajes ajenos posteriores a la última lectura de quien consulta. */
  no_leidos: number;
  /** Cierre del ticket: qué se hizo, quién lo cerró y cuándo. */
  cerrada: boolean;
  resolucion: string | null;
  cerrada_por_nombre: string | null;
  fecha_cierre: string | null;
  /** Mesa de soporte: nivel del caso y agente que lo atiende. */
  nivel: number | null;
  agente_asignado_id: string | null;
  agente_nombre: string | null;
  agente_nivel: number | null;
  calificacion: number | null;
  comentario_calificacion: string | null;
  fecha_creacion: string;
  ultimo_mensaje: BackendChatMessage | null;
}

export type UrgenciaSoporte = "critica" | "alta" | "media" | "baja";

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
  is_system?: boolean;
  is_protected?: boolean;
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

  /** La empresa abrió la solicitud (evento `solicitud_vista`; solo cuenta la primera vez). */
  markQuoteViewed(cotizacionId: string): Promise<void> {
    return apiRequest<void>(`/cotizaciones/${cotizacionId}/vista`, { method: "POST" });
  },

  getQuoteById(cotizacionId: string): Promise<BackendCotizacion> {
    return apiRequest<BackendCotizacion>(`/cotizaciones/${cotizacionId}`, {
      method: "GET",
    });
  },

  unlockQuoteByPoint(cotizacionId: string): Promise<BackendCotizacion> {
    return apiRequest<BackendCotizacion>(`/cotizaciones/${cotizacionId}/desbloquear`, {
      method: "POST",
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

  getCotizantePublicProfile(solicitanteId: string): Promise<BackendCotizantePerfilPublico> {
    return apiRequest<BackendCotizantePerfilPublico>(`/usuarios/${solicitanteId}/perfil-publico`, {
      method: "GET",
    });
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

  getDailyQuoteQuota(): Promise<BackendCupoDiario> {
    return apiRequest<BackendCupoDiario>("/importadores/cupo-diario", { method: "GET" });
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

  /**
   * Abre (o reutiliza) el canal interno empresa ↔ asesor. La cuenta dueña indica
   * el asesor; el asesor lo llama sin argumentos y abre el suyo.
   */
  startInternalChat(asesorId?: string, mensajeInicial?: string): Promise<BackendChatConversation> {
    return apiRequest<BackendChatConversation>("/chat/interno", {
      method: "POST",
      body: { asesor_id: asesorId ?? null, mensaje_inicial: mensajeInicial ?? null },
    });
  },

  /**
   * Canal interno del equipo de la plataforma (administración ↔ soporte).
   *
   * Sin `miembroId` entra en la sala común, donde está todo el equipo; con él,
   * abre el hilo privado con esa persona. Es lo que usa el equipo en vez de
   * abrirse un ticket, que el backend le niega.
   */
  openTeamChannel(miembroId?: string, mensajeInicial?: string): Promise<BackendChatConversation> {
    return apiRequest<BackendChatConversation>("/chat/equipo", {
      method: "POST",
      body: { miembro_id: miembroId ?? null, mensaje_inicial: mensajeInicial ?? null },
    });
  },

  /** El resto del equipo de la plataforma, para elegir con quién abrir un hilo. */
  listTeamMembers(): Promise<BackendMiembroEquipo[]> {
    return apiRequest<BackendMiembroEquipo[]>("/chat/equipo/miembros", { method: "GET" });
  },

  /** Pide ayuda al equipo de la plataforma. Cada llamada abre un ticket propio. */
  openSupportTicket(payload: { asunto: string; urgencia: UrgenciaSoporte; mensaje?: string }): Promise<BackendChatConversation> {
    return apiRequest<BackendChatConversation>("/chat/soporte", {
      method: "POST",
      body: payload,
    });
  },

  /** Cierra un ticket dejando escrito qué se hizo. Solo equipo de la plataforma. */
  closeSupportTicket(conversationId: string, resolucion: string): Promise<BackendChatConversation> {
    return apiRequest<BackendChatConversation>(`/chat/soporte/${conversationId}/cerrar`, {
      method: "POST",
      body: { resolucion },
    });
  },

  /** Reabre un ticket cerrado. Lo puede hacer el equipo o quien lo abrió. */
  reopenSupportTicket(conversationId: string): Promise<BackendChatConversation> {
    return apiRequest<BackendChatConversation>(`/chat/soporte/${conversationId}/reabrir`, {
      method: "POST",
    });
  },

  /** Sube el ticket de nivel y lo pasa a alguien que pueda con él. */
  escalateSupportTicket(conversationId: string, nivel: number, motivo?: string): Promise<BackendChatConversation> {
    return apiRequest<BackendChatConversation>(`/chat/soporte/${conversationId}/escalar`, {
      method: "POST",
      body: { nivel, motivo: motivo || null },
    });
  },

  /** Puntúa la atención recibida. Solo quien pidió ayuda y con el ticket cerrado. */
  rateSupportTicket(conversationId: string, calificacion: number, comentario?: string): Promise<BackendChatConversation> {
    return apiRequest<BackendChatConversation>(`/chat/soporte/${conversationId}/calificar`, {
      method: "POST",
      body: { calificacion, comentario: comentario || null },
    });
  },

  /** Alta de una cuenta del equipo de atención al cliente. Solo administración. */
  createSupportAgent(payload: { email: string; password: string; nombre: string; telefono?: string; nivel: number }): Promise<unknown> {
    return apiRequest<unknown>("/admin/equipo-soporte", { method: "POST", body: payload });
  },

  /** Marca el hilo como leído hasta ahora para el usuario en sesión. */
  markConversationRead(conversationId: string): Promise<void> {
    return apiRequest<void>(`/chat/conversaciones/${conversationId}/leida`, { method: "POST" });
  },

  previewPriceEstimate(payload: EstimacionPrecioEntrada): Promise<EstimacionPrecioResponse> {
    return apiRequest<EstimacionPrecioResponse>("/chat/calculadora/calcular", {
      method: "POST",
      body: payload,
    });
  },

  sendPriceEstimate(conversationId: string, payload: EstimacionPrecioEntrada): Promise<BackendChatMessage> {
    return apiRequest<BackendChatMessage>(`/chat/conversaciones/${conversationId}/estimaciones`, {
      method: "POST",
      body: payload,
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

  preAcceptProposal(
    propuestaId: string,
    aceptar: boolean,
    motivo?: { motivo_eleccion: MotivoEleccion; motivo_detalle?: string },
  ): Promise<BackendPropuesta> {
    return apiRequest<BackendPropuesta>(`/propuestas/${propuestaId}/pre-aceptar`, {
      method: "POST",
      body: { aceptar, ...(motivo ?? {}) } satisfies PreAceptarPropuestaPayload,
    });
  },

  getCompanyPanel(dias = 90): Promise<BackendPanelEmpresa> {
    return apiRequest<BackendPanelEmpresa>(`/importadores/panel?dias=${dias}`, { method: "GET" });
  },

  getTrm(): Promise<BackendTrm> {
    return apiRequest<BackendTrm>("/trm", { method: "GET" });
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
