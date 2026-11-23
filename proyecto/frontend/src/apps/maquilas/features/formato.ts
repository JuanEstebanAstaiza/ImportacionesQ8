/** Formatos de Zarpi Maquilas (montos en pesos colombianos, fechas en español). */

export function pesos(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);
}

export function unidades(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? "—" : `${valor.toLocaleString("es-CO")} und.`;
}

export function fecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function esImagen(contentType: string | undefined): boolean {
  return Boolean(contentType?.startsWith("image/"));
}
