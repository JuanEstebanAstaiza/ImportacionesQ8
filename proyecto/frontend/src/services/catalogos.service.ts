import { apiRequest } from "@/services/api-client";

/** Catálogos selectos de las empresas importadoras. Ver backend/routers/catalogos.py. */

export type CriterioCatalogo = "manual" | "tier_minimo" | "clientes_con_orden" | "suscriptores_zarpi";
export type TierCotizante = "Bronze" | "Silver" | "Gold" | "Élite";

export const CRITERIOS: { valor: CriterioCatalogo; etiqueta: string; ayuda: string }[] = [
  { valor: "manual", etiqueta: "Clientes que yo elija", ayuda: "Solo los compradores que agregues a mano." },
  { valor: "tier_minimo", etiqueta: "Por nivel de cotizante", ayuda: "Compradores con el nivel elegido o superior." },
  { valor: "clientes_con_orden", etiqueta: "Clientes con orden", ayuda: "Compradores con al menos una orden con tu empresa." },
  { valor: "suscriptores_zarpi", etiqueta: "Suscriptores de Zarpi", ayuda: "Compradores con suscripción vigente a Tendencias." },
];

export const TIERS: TierCotizante[] = ["Bronze", "Silver", "Gold", "Élite"];

export interface ProductoCatalogo {
  id: string;
  catalogo_id: string;
  nombre: string;
  descripcion: string | null;
  /** Rutas de archivo; requieren sesión. Máximo 5. */
  fotos: string[];
  linea_producto: string | null;
  pais_origen: string;
  cantidad_minima: number | null;
  unidad_cantidad: "unidades" | "m3";
  tiempo_estimado: string | null;
  que_pedir_en_cotizacion: string | null;
  orden: number;
  activo: boolean;
}

export type ProductoCatalogoDatos = Omit<ProductoCatalogo, "id" | "catalogo_id">;

export interface Catalogo {
  id: string;
  importador_id: string;
  titulo: string;
  descripcion: string | null;
  criterio: CriterioCatalogo;
  /** "Clientes con nivel de cotizante Gold o superior" */
  criterio_texto: string;
  tier_minimo: TierCotizante | null;
  activo: boolean;
  productos: ProductoCatalogo[];
  total_productos: number;
  fecha_actualizacion: string;
  /** Solo en la vista del comprador. */
  empresa?: { id: string; nombre: string; logo_url: string | null; verificado: boolean };
  /** Solo en la vista del comprador: lo ve por cumplir el criterio o porque la empresa lo invitó. */
  acceso_por?: "criterio" | "manual";
  /** Solo en la vista de la empresa. */
  accesos_manuales?: number;
}

export interface CatalogoDatos {
  titulo: string;
  descripcion?: string | null;
  criterio: CriterioCatalogo;
  tier_minimo?: TierCotizante | null;
  activo: boolean;
}

export interface ClienteEmpresa {
  usuario_id: string;
  nombre: string;
  tier: TierCotizante;
  ordenes_con_empresa: number;
}

export interface AccesoManual {
  usuario_id: string;
  nombre: string;
  tier: TierCotizante;
  fecha: string;
}

export const catalogosService = {
  // Comprador
  disponibles: () => apiRequest<Catalogo[]>("/catalogos/disponibles"),
  ver: (id: string) => apiRequest<Catalogo>(`/catalogos/ver/${id}`),

  // Empresa (crear, editar y dar acceso: solo la cuenta dueña; el asesor solo lee)
  mios: () => apiRequest<Catalogo[]>("/catalogos/mios"),
  crear: (datos: CatalogoDatos) => apiRequest<Catalogo>("/catalogos", { method: "POST", body: datos }),
  editar: (id: string, datos: CatalogoDatos) => apiRequest<Catalogo>(`/catalogos/${id}`, { method: "PUT", body: datos }),
  borrar: (id: string) => apiRequest<void>(`/catalogos/${id}`, { method: "DELETE" }),
  agregarProducto: (catalogoId: string, datos: ProductoCatalogoDatos) =>
    apiRequest<ProductoCatalogo>(`/catalogos/${catalogoId}/productos`, { method: "POST", body: datos }),
  editarProducto: (catalogoId: string, productoId: string, datos: ProductoCatalogoDatos) =>
    apiRequest<ProductoCatalogo>(`/catalogos/${catalogoId}/productos/${productoId}`, { method: "PUT", body: datos }),
  borrarProducto: (catalogoId: string, productoId: string) =>
    apiRequest<void>(`/catalogos/${catalogoId}/productos/${productoId}`, { method: "DELETE" }),
  /** Compradores que ya cotizaron con la empresa: entre ellos se elige a mano. */
  clientes: () => apiRequest<ClienteEmpresa[]>("/catalogos/clientes"),
  accesos: (catalogoId: string) => apiRequest<AccesoManual[]>(`/catalogos/${catalogoId}/accesos`),
  darAcceso: (catalogoId: string, usuarioId: string) =>
    apiRequest<{ usuario_id: string }>(`/catalogos/${catalogoId}/accesos`, { method: "POST", body: { usuario_id: usuarioId } }),
  quitarAcceso: (catalogoId: string, usuarioId: string) =>
    apiRequest<void>(`/catalogos/${catalogoId}/accesos/${usuarioId}`, { method: "DELETE" }),
};
