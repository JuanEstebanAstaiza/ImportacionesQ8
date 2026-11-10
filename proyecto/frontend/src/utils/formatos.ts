export function cantidadConUnidad(
  cantidad: string | number | null | undefined,
  unidad?: string | null,
  largo = false,
): string {
  if (cantidad === null || cantidad === undefined || cantidad === "") return "—";
  const numero = Number(cantidad);
  const texto = Number.isFinite(numero)
    ? numero.toLocaleString("es-CO", { maximumFractionDigits: 2 })
    : String(cantidad);
  if (unidad === "m3") return `${texto} m³`;
  return `${texto} ${largo ? "unidades" : "u"}`;
}

export function formatDateShort(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}
