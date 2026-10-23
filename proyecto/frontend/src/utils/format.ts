import { parseBackendDate } from "@/utils/date";

export function formatShortDate(value: string): string {
  const date = parseBackendDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}
