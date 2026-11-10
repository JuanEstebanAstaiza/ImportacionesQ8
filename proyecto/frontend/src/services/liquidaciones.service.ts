import { apiRequest, getStoredToken, resolveApiUrl } from "@/services/api-client";
import type {
  Activacion, ArchivoSubido, BucketLiquidaciones, CatalogoLotes, CuentaAdmin, DocumentoRef, EstadoActivacion,
  FiltrosCatalogo, Lote, LoteEntrada, MensajeOperacion, MetricasLiquidaciones, MisLotes, Operacion,
  OperacionResumen, ParametrosLiquidaciones, ParametrosPublicos, TipoArchivo,
} from "@apps/liquidaciones/features/tipos";

/**
 * API de Zarpi Liquidaciones (`/liquidaciones/*`). El módulo guarda sus datos en
 * su propia base (MongoDB); aquí solo cambia el prefijo, la sesión es la misma.
 */

function query(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([clave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== "") q.set(clave, String(valor));
  });
  const texto = q.toString();
  return texto ? `?${texto}` : "";
}

const BUCKET_POR_TIPO: Record<TipoArchivo, BucketLiquidaciones> = {
  foto: "medios", video: "medios", ficha_tecnica: "documentos",
  comprobante_pago: "documentos", factura: "documentos", rut: "documentos",
};

/**
 * Sube un archivo a GridFS mostrando el progreso. Va con XMLHttpRequest y no con
 * `fetch` porque `fetch` no informa del avance de la subida, y un video de
 * cientos de MB sin barra de progreso parece colgado.
 */
function subirArchivo(tipo: TipoArchivo, archivo: File, alAvanzar?: (porcentaje: number) => void): Promise<ArchivoSubido> {
  const datos = new FormData();
  datos.append("tipo", tipo);
  datos.append("archivo", archivo);
  const url = resolveApiUrl(`/liquidaciones/archivos/${BUCKET_POR_TIPO[tipo]}`);
  const token = getStoredToken();
  return new Promise((resolver, rechazar) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (evento) => {
      if (evento.lengthComputable && alAvanzar) alAvanzar(Math.round((evento.loaded / evento.total) * 100));
    };
    xhr.onload = () => {
      let cuerpo: { detail?: unknown } & Partial<ArchivoSubido> = {};
      try { cuerpo = JSON.parse(xhr.responseText || "{}"); } catch { cuerpo = {}; }
      if (xhr.status >= 200 && xhr.status < 300) resolver(cuerpo as ArchivoSubido);
      else rechazar(new Error(typeof cuerpo.detail === "string" ? cuerpo.detail : `No se pudo subir el archivo (${xhr.status})`));
    };
    xhr.onerror = () => rechazar(new Error("No se pudo subir el archivo. Revisa tu conexión."));
    xhr.send(datos);
  });
}

export const liquidacionesService = {
  // Público
  vistaPublica: (limite = 8) => apiRequest<Lote[]>(`/liquidaciones/publico/lotes${query({ limite })}`),

  // Cuenta
  parametros: () => apiRequest<ParametrosPublicos>("/liquidaciones/parametros"),
  estadoActivacion: () => apiRequest<EstadoActivacion>("/liquidaciones/activacion"),
  activar: (datos: Omit<Activacion, "cuenta" | "es_empresa" | "suspendida" | "activada_en" | "rut" | "email"> & { rut_archivo_id: string; acepta_declaracion: boolean }) =>
    apiRequest<Activacion>("/liquidaciones/activacion", { method: "POST", body: datos }),
  subirArchivo,

  // Catálogo y compra
  catalogo: (filtros: FiltrosCatalogo) => apiRequest<CatalogoLotes>(`/liquidaciones/lotes${query({ ...filtros })}`),
  lote: (id: string) => apiRequest<Lote>(`/liquidaciones/lotes/${encodeURIComponent(id)}`),
  reservar: (id: string) => apiRequest<Operacion>(`/liquidaciones/lotes/${encodeURIComponent(id)}/reservar`, { method: "POST" }),

  // Operaciones
  operaciones: (lado: "comprador" | "vendedor") => apiRequest<OperacionResumen[]>(`/liquidaciones/operaciones${query({ lado })}`),
  operacion: (id: string) => apiRequest<Operacion>(`/liquidaciones/operaciones/${encodeURIComponent(id)}`),
  enviarMensaje: (id: string, contenido: string) =>
    apiRequest<MensajeOperacion>(`/liquidaciones/operaciones/${encodeURIComponent(id)}/mensajes`, { method: "POST", body: { contenido } }),
  marcarVendido: (id: string) => apiRequest<Operacion>(`/liquidaciones/operaciones/${encodeURIComponent(id)}/vendido`, { method: "POST" }),
  cancelar: (id: string, motivo?: string) =>
    apiRequest<Operacion>(`/liquidaciones/operaciones/${encodeURIComponent(id)}/cancelar`, { method: "POST", body: { motivo: motivo || null } }),
  adjuntar: (id: string, tipo: "comprobante" | "factura", archivoId: string) =>
    apiRequest<Operacion>(`/liquidaciones/operaciones/${encodeURIComponent(id)}/${tipo}`, { method: "POST", body: { archivo_id: archivoId } }),

  // Vendedor
  misLotes: () => apiRequest<MisLotes>("/liquidaciones/mis-lotes"),
  crearLote: (datos: LoteEntrada) => apiRequest<Lote>("/liquidaciones/mis-lotes", { method: "POST", body: datos }),
  editarLote: (id: string, datos: LoteEntrada) =>
    apiRequest<Lote>(`/liquidaciones/mis-lotes/${encodeURIComponent(id)}`, { method: "PUT", body: datos }),

  // Equipo de Zarpi (panel admin)
  colaRevision: () => apiRequest<{ lotes: Lote[]; parametros: Pick<ParametrosLiquidaciones, "motivos_rechazo" | "checklist_revision"> }>("/liquidaciones/admin/revision"),
  aprobar: (id: string) => apiRequest<Lote>(`/liquidaciones/admin/lotes/${encodeURIComponent(id)}/aprobar`, { method: "POST" }),
  rechazar: (id: string, motivos: string[], nota?: string) =>
    apiRequest<Lote>(`/liquidaciones/admin/lotes/${encodeURIComponent(id)}/rechazar`, { method: "POST", body: { motivos, nota: nota || null } }),
  lotesAdmin: (params: { estado?: string; q?: string; limite?: number; desde?: number }) =>
    apiRequest<{ total: number; lotes: Lote[] }>(`/liquidaciones/admin/lotes${query(params)}`),
  despublicar: (id: string, motivo: string) =>
    apiRequest<Lote>(`/liquidaciones/admin/lotes/${encodeURIComponent(id)}/despublicar`, { method: "POST", body: { motivo } }),
  destacar: (id: string, destacado: boolean) =>
    apiRequest<Lote>(`/liquidaciones/admin/lotes/${encodeURIComponent(id)}/destacar`, { method: "POST", body: { destacado } }),
  operacionesAdmin: (params: { q?: string; estado?: string; limite?: number; desde?: number }) =>
    apiRequest<{ total: number; operaciones: OperacionResumen[] }>(`/liquidaciones/admin/operaciones${query(params)}`),
  intervenir: (id: string, contenido: string) =>
    apiRequest<Operacion>(`/liquidaciones/admin/operaciones/${encodeURIComponent(id)}/intervenir`, { method: "POST", body: { contenido } }),
  metricas: () => apiRequest<MetricasLiquidaciones>("/liquidaciones/admin/metricas"),
  cuentas: (params: { q?: string; limite?: number; desde?: number }) =>
    apiRequest<{ total: number; cuentas: CuentaAdmin[] }>(`/liquidaciones/admin/cuentas${query(params)}`),
  suspender: (cuenta: string, suspendida: boolean, motivo?: string) =>
    apiRequest<Activacion>(`/liquidaciones/admin/cuentas/${encodeURIComponent(cuenta)}/suspension`, { method: "PUT", body: { suspendida, motivo: motivo || null } }),
  configuracion: () => apiRequest<ParametrosLiquidaciones>("/liquidaciones/admin/configuracion"),
  guardarConfiguracion: (cambios: Partial<ParametrosLiquidaciones>) =>
    apiRequest<ParametrosLiquidaciones>("/liquidaciones/admin/configuracion", { method: "PUT", body: cambios }),
};

export type { DocumentoRef };
