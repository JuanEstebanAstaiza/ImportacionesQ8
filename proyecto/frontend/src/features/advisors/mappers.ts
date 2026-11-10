import type { BackendAsesor } from "@/services/business.service";
import type { CompanyAdvisor } from "@/types/portal";

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}
function initialsFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.length > 1 ? `${words[0][0]}${words[1][0]}`.toUpperCase() : (words[0] || "?").slice(0, 2).toUpperCase();
}

export function mapBackendAdvisorToUi(a: BackendAsesor): CompanyAdvisor {
  const name = a.nombre || a.email;
  return {
    id: a.id,
    name,
    role: "Asesor",
    email: a.email,
    phone: a.telefono || "",
    initials: initialsFromName(name),
    color: "bg-slate-600",
    status: a.activo ? "activo" : "inactivo",
    availability: a.activo ? "media" : "baja",
    activeQuotes: 0,
    avgResponse: "~24h",
    joinDate: formatShortDate(a.fecha_creacion),
  };
}
