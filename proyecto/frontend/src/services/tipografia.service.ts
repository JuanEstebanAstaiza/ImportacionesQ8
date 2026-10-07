import { apiRequest, getStoredToken, resolveApiUrl } from "@/services/api-client";

/**
 * Tipografía de la plataforma. El catálogo viene de Fontsource a través del
 * backend; al aplicar una fuente, el backend la descarga y desde entonces la
 * sirve él mismo en `/tipografia/activa.css`. Ver backend/services/tipografia.py.
 */

export type CategoriaFuente = "sans-serif" | "serif" | "display" | "handwriting" | "monospace";

export const CATEGORIAS_FUENTE: { valor: CategoriaFuente; etiqueta: string }[] = [
  { valor: "sans-serif", etiqueta: "Sans serif" },
  { valor: "serif", etiqueta: "Serif" },
  { valor: "display", etiqueta: "Decorativas" },
  { valor: "handwriting", etiqueta: "Manuscritas" },
  { valor: "monospace", etiqueta: "Monoespaciadas" },
];

export interface FuenteCatalogo {
  id: string;
  familia: string;
  categoria: CategoriaFuente;
  pesos: number[];
  estilos: string[];
  variable: boolean;
  licencia: string;
  origen: string;
}

export interface FuenteActiva {
  id: string;
  familia: string;
  categoria: CategoriaFuente;
  licencia: string;
  pesos: number[];
}

export interface TipografiaActiva {
  /** null: tipografía de marca (Elvellon para títulos, AT Avenor para texto). */
  texto: FuenteActiva | null;
  /** null: los títulos usan la fuente del texto. */
  titulos: FuenteActiva | null;
  aplicada_en?: string;
}

const ID_HOJA = "zarpi-tipografia";

/** Agrega (o recarga) la hoja con la tipografía elegida por el admin. */
export function cargarHojaTipografia(recargar = false): void {
  if (typeof document === "undefined") return;
  const href = resolveApiUrl("/tipografia/activa.css") + (recargar ? `?v=${Date.now()}` : "");
  let enlace = document.getElementById(ID_HOJA) as HTMLLinkElement | null;
  if (!enlace) {
    enlace = document.createElement("link");
    enlace.id = ID_HOJA;
    enlace.rel = "stylesheet";
    // Va al final del <head> para ganarle a los estilos de la aplicación.
    document.head.appendChild(enlace);
  }
  enlace.href = href;
}

/** Registra una fuente del catálogo en el navegador, solo para previsualizarla. */
export async function cargarVistaPrevia(fuenteId: string, peso = 400): Promise<string> {
  const alias = `Previa ${fuenteId} ${peso}`;
  if (Array.from(document.fonts).some((f) => f.family === alias)) return alias;
  const token = getStoredToken();
  const respuesta = await fetch(resolveApiUrl(`/admin/tipografia/vista-previa/${fuenteId}?peso=${peso}`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => ({}))) as { detail?: string };
    throw new Error(cuerpo.detail || "No se pudo cargar la vista previa.");
  }
  const fuente = new FontFace(alias, await respuesta.arrayBuffer(), { weight: String(peso) });
  await fuente.load();
  document.fonts.add(fuente);
  return alias;
}

export const tipografiaService = {
  activa: () => apiRequest<TipografiaActiva>("/admin/tipografia"),
  catalogo: (q = "", categoria: CategoriaFuente | "" = "", pagina = 1) => {
    const params = new URLSearchParams({ pagina: String(pagina) });
    if (q.trim()) params.set("q", q.trim());
    if (categoria) params.set("categoria", categoria);
    return apiRequest<{ total: number; pagina: number; fuentes: FuenteCatalogo[] }>(
      `/admin/tipografia/catalogo?${params.toString()}`,
    );
  },
  aplicar: (textoId: string | null, titulosId: string | null) =>
    apiRequest<TipografiaActiva>("/admin/tipografia", {
      method: "PUT",
      body: { texto_id: textoId, titulos_id: titulosId },
    }),
};
