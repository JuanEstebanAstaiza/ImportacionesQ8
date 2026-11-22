import { apiRequest, getStoredToken, resolveApiUrl } from "@/services/api-client";
import type { RegisterResponse } from "@/types/auth";
import type {
  ArchivoMaquila, BucketMaquilas, DocumentosEntrada, EmpresaEntrada, FabricacionEntrada, FichaGuiada, ListadoMaquiladoras,
  Maquiladora, MensajeHilo, MetricasMaquila, ParametrosMaquilas, Pedido, PedidoResumen, PerfilEntrada, Producto, ProductoEntrada,
  PropuestaEntrada, RegistroMaquilaEntrada, RepresentanteEntrada, Resena, ResenaEntrada, Solicitud, SolicitudEntrada,
  SolicitudResumen, TipoArchivoMaquila, Colaborador, ConfiguracionMaquilas, Encargo, EncargoResumen, EstadoPaso, Marca,
  MarcaEntrada, MarcaResumen, PedidoAdmin, ResumenAdminMaquilas, SolicitudAdmin,
} from "@apps/maquilas/features/tipos";

/**
 * API de Zarpi Maquilas (`/maquilas/*`). El módulo guarda sus datos en su propia
 * base (MongoDB); la sesión es la misma de toda la suite.
 */

function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([clave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== "") q.set(clave, String(valor));
  });
  const texto = q.toString();
  return texto ? `?${texto}` : "";
}

const BUCKET_POR_TIPO: Record<TipoArchivoMaquila, BucketMaquilas> = {
  foto: "medios", rut: "documentos", camara_comercio: "documentos", certificado: "documentos",
  referencia: "medios", ficha_tecnica: "documentos", muestra: "medios", evidencia: "medios",
  comprobante: "documentos", adjunto: "documentos", producto: "medios",
  marca: "medios", marca_archivo: "documentos", diseno: "documentos",
};

const id = (valor: string) => encodeURIComponent(valor);

/** Sube a GridFS con progreso (XMLHttpRequest: `fetch` no informa del avance de la subida). */
function subirArchivo(tipo: TipoArchivoMaquila, archivo: File, alAvanzar?: (porcentaje: number) => void): Promise<ArchivoMaquila> {
  const datos = new FormData();
  datos.append("tipo", tipo);
  datos.append("archivo", archivo);
  const url = resolveApiUrl(`/maquilas/archivos/${BUCKET_POR_TIPO[tipo]}`);
  const token = getStoredToken();
  return new Promise((resolver, rechazar) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (evento) => {
      if (evento.lengthComputable && alAvanzar) alAvanzar(Math.round((evento.loaded / evento.total) * 100));
    };
    xhr.onload = () => {
      let cuerpo: { detail?: unknown } & Partial<ArchivoMaquila> = {};
      try { cuerpo = JSON.parse(xhr.responseText || "{}"); } catch { cuerpo = {}; }
      if (xhr.status >= 200 && xhr.status < 300) resolver(cuerpo as ArchivoMaquila);
      else rechazar(new Error(typeof cuerpo.detail === "string" ? cuerpo.detail : `No se pudo subir el archivo (${xhr.status})`));
    };
    xhr.onerror = () => rechazar(new Error("No se pudo subir el archivo. Revisa tu conexión."));
    xhr.send(datos);
  });
}

/** PDF de la ficha guiada para revisarlo antes de enviar (se abre en otra pestaña). */
async function vistaPreviaFicha(datos: { titulo: string; categoria: string; cantidad?: number; ficha: FichaGuiada }): Promise<Blob> {
  const token = getStoredToken();
  const respuesta = await fetch(resolveApiUrl("/maquilas/fichas/vista-previa"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(datos),
  });
  if (!respuesta.ok) throw new Error("No pudimos generar la ficha. Revisa que tenga al menos una sección llena.");
  return respuesta.blob();
}

export const maquilasService = {
  // Público
  parametros: () => apiRequest<ParametrosMaquilas>("/maquilas/parametros"),
  registrar: (datos: RegistroMaquilaEntrada) =>
    apiRequest<RegisterResponse>("/maquilas/registro", { method: "POST", body: datos }),

  // La maquiladora
  subirArchivo,
  miMaquiladora: () => apiRequest<Maquiladora>("/maquilas/mi-maquiladora"),
  actualizarPerfil: (datos: PerfilEntrada) => apiRequest<Maquiladora>("/maquilas/mi-maquiladora", { method: "PUT", body: datos }),
  actualizarDocumentos: (datos: DocumentosEntrada) =>
    apiRequest<Maquiladora>("/maquilas/mi-maquiladora/documentos", { method: "PUT", body: datos }),
  enviarAVerificacion: () => apiRequest<Maquiladora>("/maquilas/mi-maquiladora/enviar-verificacion", { method: "POST" }),

  // Directorio (clientes)
  directorio: (filtros: { categoria?: string; proceso?: string; ciudad?: string; q?: string; cantidad?: number }) =>
    apiRequest<Maquiladora[]>(`/maquilas/directorio${query(filtros)}`),
  perfilPublico: (maquiladoraId: string) => apiRequest<Maquiladora>(`/maquilas/directorio/${id(maquiladoraId)}`),

  // Solicitudes y propuestas
  crearSolicitud: (datos: SolicitudEntrada) => apiRequest<Solicitud>("/maquilas/solicitudes", { method: "POST", body: datos }),
  misSolicitudes: () => apiRequest<SolicitudResumen[]>("/maquilas/solicitudes"),
  recibidas: () => apiRequest<SolicitudResumen[]>("/maquilas/recibidas"),
  solicitud: (solicitudId: string) => apiRequest<Solicitud>(`/maquilas/solicitudes/${id(solicitudId)}`),
  cancelarSolicitud: (solicitudId: string) => apiRequest<Solicitud>(`/maquilas/solicitudes/${id(solicitudId)}/cancelar`, { method: "POST" }),
  aceptarAcuerdo: (solicitudId: string) => apiRequest<Solicitud>(`/maquilas/solicitudes/${id(solicitudId)}/acuerdo`, { method: "POST" }),
  rechazarSolicitud: (solicitudId: string, motivo: string) =>
    apiRequest<Solicitud>(`/maquilas/solicitudes/${id(solicitudId)}/rechazar`, { method: "POST", body: { motivo } }),
  guardarPropuesta: (solicitudId: string, datos: PropuestaEntrada) =>
    apiRequest<Solicitud>(`/maquilas/solicitudes/${id(solicitudId)}/propuesta`, { method: "PUT", body: datos }),
  aceptarPropuesta: (propuestaId: string, motivo?: string) =>
    apiRequest<Pedido>(`/maquilas/propuestas/${id(propuestaId)}/aceptar`, { method: "POST", body: { motivo: motivo || null } }),

  // Pedidos
  pedidos: () => apiRequest<PedidoResumen[]>("/maquilas/pedidos"),
  pedido: (pedidoId: string) => apiRequest<Pedido>(`/maquilas/pedidos/${id(pedidoId)}`),
  enviarMuestra: (pedidoId: string, archivos: string[], nota: string) =>
    apiRequest<Pedido>(`/maquilas/pedidos/${id(pedidoId)}/muestras`, { method: "POST", body: { archivos, nota } }),
  responderMuestra: (pedidoId: string, aprobada: boolean, comentario: string) =>
    apiRequest<Pedido>(`/maquilas/pedidos/${id(pedidoId)}/muestras/responder`, { method: "POST", body: { aprobada, comentario } }),
  completarEtapa: (pedidoId: string, clave: string, nota: string, fotos: string[]) =>
    apiRequest<Pedido>(`/maquilas/pedidos/${id(pedidoId)}/etapas/${id(clave)}`, { method: "POST", body: { nota, fotos } }),
  subirComprobante: (pedidoId: string, clave: string, archivoId: string, nota: string) =>
    apiRequest<Pedido>(`/maquilas/pedidos/${id(pedidoId)}/hitos/${id(clave)}/comprobante`, { method: "POST", body: { archivo_id: archivoId, nota } }),
  confirmarPago: (pedidoId: string, clave: string) =>
    apiRequest<Pedido>(`/maquilas/pedidos/${id(pedidoId)}/hitos/${id(clave)}/confirmar`, { method: "POST" }),
  rechazarPago: (pedidoId: string, clave: string, motivo: string) =>
    apiRequest<Pedido>(`/maquilas/pedidos/${id(pedidoId)}/hitos/${id(clave)}/rechazar`, { method: "POST", body: { motivo } }),
  marcarRecibido: (pedidoId: string) => apiRequest<Pedido>(`/maquilas/pedidos/${id(pedidoId)}/recibido`, { method: "POST" }),
  cancelarPedido: (pedidoId: string, motivo: string) =>
    apiRequest<Pedido>(`/maquilas/pedidos/${id(pedidoId)}/cancelar`, { method: "POST", body: { motivo } }),

  // Fase 3: marca blanca, ficha guiada, calidad, reseñas y repetir
  vistaPreviaFicha,
  catalogo: (filtros: { categoria?: string; q?: string; cantidad?: number; maquiladora?: string }) =>
    apiRequest<Producto[]>(`/maquilas/catalogo${query(filtros)}`),
  producto: (productoId: string) => apiRequest<Producto>(`/maquilas/catalogo/${id(productoId)}`),
  misProductos: () => apiRequest<Producto[]>("/maquilas/mi-maquiladora/productos"),
  crearProducto: (datos: ProductoEntrada) => apiRequest<Producto>("/maquilas/mi-maquiladora/productos", { method: "POST", body: datos }),
  actualizarProducto: (productoId: string, datos: ProductoEntrada) =>
    apiRequest<Producto>(`/maquilas/mi-maquiladora/productos/${id(productoId)}`, { method: "PUT", body: datos }),
  enviarReporteCalidad: (pedidoId: string, datos: { unidades_inspeccionadas: number; resultados: { cumple: boolean; observacion: string }[]; fotos: string[]; nota: string }) =>
    apiRequest<Pedido>(`/maquilas/pedidos/${id(pedidoId)}/calidad`, { method: "POST", body: datos }),
  responderCalidad: (pedidoId: string, aprobado: boolean, comentario: string) =>
    apiRequest<Pedido>(`/maquilas/pedidos/${id(pedidoId)}/calidad/responder`, { method: "POST", body: { aprobado, comentario } }),
  calificar: (pedidoId: string, datos: ResenaEntrada) =>
    apiRequest<Resena>(`/maquilas/pedidos/${id(pedidoId)}/resena`, { method: "POST", body: datos }),
  responderResena: (resenaId: string, respuesta: string) =>
    apiRequest<Resena>(`/maquilas/resenas/${id(resenaId)}/respuesta`, { method: "POST", body: { respuesta } }),
  misResenas: () => apiRequest<{ metricas: MetricasMaquila; resenas: Resena[] }>("/maquilas/mi-maquiladora/resenas"),
  resenasPublicas: (maquiladoraId: string) => apiRequest<Resena[]>(`/maquilas/directorio/${id(maquiladoraId)}/resenas`),
  repetirPedido: (pedidoId: string, cantidad: number, fechaObjetivo?: string | null) =>
    apiRequest<Solicitud>(`/maquilas/pedidos/${id(pedidoId)}/repetir`, { method: "POST", body: { cantidad, fecha_objetivo: fechaObjetivo || null } }),

  // Fase 4: estudio de marca, encargos de diseño y equipo de la maquila
  marcas: () => apiRequest<MarcaResumen[]>("/maquilas/marcas"),
  marca: (marcaId: string) => apiRequest<Marca>(`/maquilas/marcas/${id(marcaId)}`),
  crearMarca: (datos: MarcaEntrada) => apiRequest<Marca>("/maquilas/marcas", { method: "POST", body: datos }),
  actualizarMarca: (marcaId: string, datos: MarcaEntrada) => apiRequest<Marca>(`/maquilas/marcas/${id(marcaId)}`, { method: "PUT", body: datos }),
  marcarPaso: (marcaId: string, clave: string, estado: EstadoPaso, nota: string) =>
    apiRequest<Marca>(`/maquilas/marcas/${id(marcaId)}/ruta/${id(clave)}`, { method: "PUT", body: { estado, nota } }),
  pedirEncargo: (marcaId: string, tipo: string, brief: string, referencias: string[]) =>
    apiRequest<Encargo>(`/maquilas/marcas/${id(marcaId)}/encargos`, { method: "POST", body: { tipo, brief, referencias } }),
  misEncargos: (marcaId?: string) => apiRequest<EncargoResumen[]>(`/maquilas/encargos${query({ marca: marcaId })}`),
  encargo: (encargoId: string) => apiRequest<Encargo>(`/maquilas/encargos/${id(encargoId)}`),
  responderEncargo: (encargoId: string, aprobado: boolean, comentario: string) =>
    apiRequest<Encargo>(`/maquilas/encargos/${id(encargoId)}/responder`, { method: "POST", body: { aprobado, comentario } }),
  cancelarEncargo: (encargoId: string) => apiRequest<Encargo>(`/maquilas/encargos/${id(encargoId)}/cancelar`, { method: "POST" }),
  colaDiseno: (params: { estado?: string; mios?: boolean }) => apiRequest<EncargoResumen[]>(`/maquilas/diseno/encargos${query(params)}`),
  tomarEncargo: (encargoId: string) => apiRequest<Encargo>(`/maquilas/diseno/encargos/${id(encargoId)}/tomar`, { method: "POST" }),
  entregarVersion: (encargoId: string, archivos: string[], nota: string) =>
    apiRequest<Encargo>(`/maquilas/diseno/encargos/${id(encargoId)}/versiones`, { method: "POST", body: { archivos, nota } }),
  equipo: () => apiRequest<Colaborador[]>("/maquilas/mi-maquiladora/equipo"),
  crearColaborador: (datos: { nombre: string; apellido: string; email: string; telefono?: string; password: string }) =>
    apiRequest<Colaborador>("/maquilas/mi-maquiladora/equipo", { method: "POST", body: datos }),
  cambiarColaborador: (colaboradorId: string, activo: boolean) =>
    apiRequest<Colaborador>(`/maquilas/mi-maquiladora/equipo/${id(colaboradorId)}/${activo ? "activar" : "desactivar"}`, { method: "POST" }),

  // Chat
  mensajes: (hilo: string) => apiRequest<MensajeHilo[]>(`/maquilas/hilos/${id(hilo)}/mensajes`),
  enviarMensaje: (hilo: string, contenido: string, archivoId?: string) =>
    apiRequest<MensajeHilo>(`/maquilas/hilos/${id(hilo)}/mensajes`, { method: "POST", body: { contenido, archivo_id: archivoId || null } }),

  // Equipo de Zarpi (panel admin)
  crearPorEquipo: (datos: { empresa: EmpresaEntrada; representante: RepresentanteEntrada; fabricacion: FabricacionEntrada }) =>
    apiRequest<Maquiladora>("/maquilas/admin/maquiladoras", { method: "POST", body: datos }),
  listar: (params: { estado?: string; q?: string }) =>
    apiRequest<ListadoMaquiladoras>(`/maquilas/admin/maquiladoras${query(params)}`),
  detalle: (id: string) => apiRequest<Maquiladora>(`/maquilas/admin/maquiladoras/${encodeURIComponent(id)}`),
  aprobar: (id: string) => apiRequest<Maquiladora>(`/maquilas/admin/maquiladoras/${encodeURIComponent(id)}/aprobar`, { method: "POST" }),
  rechazar: (id: string, motivo: string) =>
    apiRequest<Maquiladora>(`/maquilas/admin/maquiladoras/${encodeURIComponent(id)}/rechazar`, { method: "POST", body: { motivo } }),
  suspender: (id: string, motivo: string) =>
    apiRequest<Maquiladora>(`/maquilas/admin/maquiladoras/${encodeURIComponent(id)}/suspender`, { method: "POST", body: { motivo } }),
  reactivar: (id: string) => apiRequest<Maquiladora>(`/maquilas/admin/maquiladoras/${encodeURIComponent(id)}/reactivar`, { method: "POST" }),
  productosAdmin: (params: { q?: string; ocultos?: boolean }) => apiRequest<Producto[]>(`/maquilas/admin/productos${query(params)}`),
  ocultarProducto: (productoId: string, motivo: string) =>
    apiRequest<Producto>(`/maquilas/admin/productos/${id(productoId)}/ocultar`, { method: "POST", body: { motivo } }),
  mostrarProducto: (productoId: string) => apiRequest<Producto>(`/maquilas/admin/productos/${id(productoId)}/mostrar`, { method: "POST" }),
  resenasAdmin: (params: { ocultas?: boolean; maximo?: number }) => apiRequest<Resena[]>(`/maquilas/admin/resenas${query(params)}`),
  ocultarResena: (resenaId: string, motivo: string) =>
    apiRequest<Resena>(`/maquilas/admin/resenas/${id(resenaId)}/ocultar`, { method: "POST", body: { motivo } }),
  mostrarResena: (resenaId: string) => apiRequest<Resena>(`/maquilas/admin/resenas/${id(resenaId)}/mostrar`, { method: "POST" }),
  resumenAdmin: () => apiRequest<ResumenAdminMaquilas>("/maquilas/admin/resumen"),
  solicitudesAdmin: (params: { estado?: string; modalidad?: string; q?: string }) =>
    apiRequest<SolicitudAdmin[]>(`/maquilas/admin/solicitudes${query(params)}`),
  pedidosAdmin: (params: { estado?: string; q?: string; retrasados?: boolean }) => apiRequest<PedidoAdmin[]>(`/maquilas/admin/pedidos${query(params)}`),
  configuracion: () => apiRequest<ConfiguracionMaquilas>("/maquilas/admin/configuracion"),
  guardarConfiguracion: (cambios: Record<string, unknown>) =>
    apiRequest<ConfiguracionMaquilas>("/maquilas/admin/configuracion", { method: "PUT", body: { cambios } }),
};
