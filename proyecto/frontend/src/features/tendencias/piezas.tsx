import { useState } from "react";
import { ImageOff, ShieldAlert } from "lucide-react";

import { resolveApiUrl } from "@/services/api-client";
import type { FichaTendencia, TarjetaTendencia } from "@/services/tendencias.service";

import type { PrefillSolicitud } from "./prefill";

/** Piezas compartidas por el feed, la ficha, el envío de enlaces y los recomendados. */

export type RolTendencias = "solicitante" | "importadora" | "asesor" | "admin" | "soporte" | null;

/** Solo compradores y visitantes ven el botón de cotizar; App lleva al visitante a registrarse. */
export function puedeCotizar(rol: RolTendencias): boolean {
  return rol === null || rol === "solicitante";
}

export function textoBotonCotizar(item: Pick<TarjetaTendencia, "empresa">): string {
  return item.empresa ? `Cotizar con ${item.empresa.nombre}` : "Pedir propuestas";
}

export function textoOrigen(item: Pick<TarjetaTendencia, "origen" | "empresa">): string {
  if (item.empresa) return `Lo recomienda ${item.empresa.nombre}`;
  if (item.origen === "equipo") return "Lo subió el equipo de Zarpi";
  if (item.origen === "importadora") return "Lo recomienda una importadora";
  return "Lo subió un comerciante";
}

export function textoCotizaciones(n: number): string {
  if (n <= 0) return "Sé el primero en cotizarlo";
  return n === 1 ? "1 persona lo cotizó esta semana" : `${n} personas lo cotizaron esta semana`;
}

/** YYYY-MM-DD como fecha local (sin el corrimiento de zona horaria de `new Date(iso)`). */
export function fechaLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function etiquetaSemana(iso: string, actual?: string | null): string {
  const fecha = fechaLocal(iso);
  if (!fecha) return iso;
  const opciones: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  if (fecha.getFullYear() !== new Date().getFullYear()) opciones.year = "numeric";
  const texto = fecha.toLocaleDateString("es-CO", opciones);
  return iso === actual ? `Esta semana · del ${texto}` : `Semana del ${texto}`;
}

export function fechaCorta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return fecha.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

export function prefillDesdeFicha(f: FichaTendencia): PrefillSolicitud {
  return {
    origen: "tendencias",
    nombre: f.nombre,
    descripcion: [f.por_que_tendencia, f.url_video ? `Video de referencia: ${f.url_video}` : null].filter(Boolean).join("\n\n"),
    lineaProducto: f.categoria || null,
    pais: "China",
    fotos: f.portada_url ? [f.portada_url] : [],
    revisarRequisitos: f.regulado,
    tendenciaItemId: f.id,
    urlVideo: f.url_video,
    importadorId: f.empresa?.id,
  };
}

/** Respaldo si la ficha no carga: lo que se sabe desde la tarjeta. */
export function prefillDesdeTarjeta(t: TarjetaTendencia): PrefillSolicitud {
  return {
    origen: "tendencias",
    nombre: t.nombre,
    descripcion: "",
    lineaProducto: t.categoria || null,
    pais: "China",
    fotos: t.portada_url ? [t.portada_url] : [],
    revisarRequisitos: t.regulado,
    tendenciaItemId: t.id,
    importadorId: t.empresa?.id,
  };
}

export function EtiquetaRegulado({ className = "" }: { className?: string }) {
  return (
    <span
      title="Puede requerir permisos o registros de importación"
      className={`inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-200 ${className}`}
    >
      <ShieldAlert className="h-3 w-3" />
      Puede ser regulado
    </span>
  );
}

/** Imagen pública del backend (portadas publicadas, logos). Sin sesión. */
export function ImagenPublica({ src, alt, className = "" }: { src: string | null | undefined; alt: string; className?: string }) {
  const [fallo, setFallo] = useState(false);
  const url = resolveApiUrl(src);
  if (!url || fallo) {
    return (
      <div className={`flex items-center justify-center bg-neutral-800 text-white/40 ${className}`}>
        <ImageOff className="h-6 w-6" />
      </div>
    );
  }
  return <img src={url} alt={alt} loading="lazy" onError={() => setFallo(true)} className={`object-cover ${className}`} />;
}

export function iniciales(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
