import { apiRequest, getStoredToken, resolveApiUrl } from "@/services/api-client";
import type { RegisterResponse } from "@/types/auth";
import type {
  ArchivoMaquila, BucketMaquilas, DocumentosEntrada, EmpresaEntrada, FabricacionEntrada, ListadoMaquiladoras,
  Maquiladora, ParametrosMaquilas, PerfilEntrada, RegistroMaquilaEntrada, RepresentanteEntrada, TipoArchivoMaquila,
} from "@apps/maquilas/features/tipos";

/**
 * API de Zarpi Maquilas (`/maquilas/*`). El módulo guarda sus datos en su propia
 * base (MongoDB); la sesión es la misma de toda la suite.
 */

function query(params: Record<string, string | undefined | null>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([clave, valor]) => {
    if (valor) q.set(clave, valor);
  });
  const texto = q.toString();
  return texto ? `?${texto}` : "";
}

const BUCKET_POR_TIPO: Record<TipoArchivoMaquila, BucketMaquilas> = {
  foto: "medios", rut: "documentos", camara_comercio: "documentos", certificado: "documentos",
};

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
};
