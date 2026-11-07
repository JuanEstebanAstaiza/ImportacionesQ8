import type { BackendImporter } from "@/services/business.service";
import type { Importer } from "@/types/importer";
import { safeHttpUrl } from "@/utils/safe-url";

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}
function initialsFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.length > 1 ? `${words[0][0]}${words[1][0]}`.toUpperCase() : (words[0] || "?").slice(0, 2).toUpperCase();
}
function importerColorFromId(id: string): string {
  const palette = ["bg-blue-600","bg-emerald-600","bg-cyan-600","bg-orange-600","bg-slate-600","bg-rose-600","bg-indigo-600"];
  let hash = 0; for (let i = 0; i < id.length; i += 1) hash = (hash + id.charCodeAt(i)) % 997;
  return palette[hash % palette.length];
}

function readPerfilPublicoString(perfil: Record<string, unknown> | null | undefined, ...claves: string[]): string {
  for (const clave of claves) {
    const valor = perfil?.[clave];
    if (typeof valor === "string" && valor.trim()) {
      return valor.trim();
    }
  }
  return "";
}

function readPerfilPublicoStringArray(perfil: Record<string, unknown> | null | undefined, ...claves: string[]): string[] {
  for (const clave of claves) {
    const valor = perfil?.[clave];
    if (Array.isArray(valor)) {
      return valor.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    }
  }
  return [];
}

/**
 * Convierte lo que la empresa escribió en «Sitio web» en un href navegable.
 *
 * Casi nadie escribe el esquema: el campo llega como "miempresa.com" y un
 * `<a href="miempresa.com">` navega a una ruta relativa de la propia
 * plataforma. Se antepone `https://` y se descarta cualquier cosa que no acabe
 * siendo http(s) (defensa en profundidad: el texto lo escribe la empresa).
 */
function enlaceSitioWeb(valor: string | null | undefined): string {
  const limpio = String(valor ?? "").trim();
  if (!limpio) {
    return "";
  }
  const conEsquema = /^[a-z][a-z0-9+.-]*:\/\//i.test(limpio) ? limpio : `https://${limpio}`;
  return safeHttpUrl(conEsquema);
}

/** Texto del enlace: sin esquema ni "www.", que es como se lee una web. */
function etiquetaSitioWeb(valor: string | null | undefined): string {
  return String(valor ?? "")
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}

const ROL_ASESOR_PUBLICO: Record<string, string> = { asesor: "Asesor", importador: "Responsable de la cuenta" };
const PRICE_CURRENCIES = ["USD", "EUR", "COP", "MXN", "CLP", "PEN", "GBP"];

/**
 * Contacto principal de la empresa. Manda lo que la empresa escribió en su
 * perfil; si no escribió nada, la primera persona real que atiende (antes
 * aparecía el texto de relleno «Asesor asignado»), y si no hay nadie, la propia
 * empresa.
 */
function resolveImporterAdvisorProfile(
  perfil: Record<string, unknown> | null | undefined,
  companyName: string,
  asesores: BackendImporter["asesores"] = [],
) {
  const principal = asesores?.[0];
  const advisorName =
    readPerfilPublicoString(perfil, "advisor_name", "asesor_nombre", "contact_name", "nombre_contacto") ||
    principal?.nombre ||
    companyName;
  const advisorRole =
    readPerfilPublicoString(perfil, "advisor_role", "asesor_rol", "cargo_contacto", "contact_role") ||
    (principal ? ROL_ASESOR_PUBLICO[principal.rol] || "Asesor" : "Equipo comercial");
  const advisorEmail = readPerfilPublicoString(perfil, "advisor_email", "asesor_email", "email", "correo");
  const advisorPhone = readPerfilPublicoString(perfil, "advisor_phone", "asesor_telefono", "phone", "telefono");

  return {
    advisorName,
    advisorRole,
    advisorEmail,
    advisorPhone,
    advisorInitials: initialsFromName(advisorName || companyName),
  };
}

export function mapBackendImporterToUi(imp: BackendImporter): Importer {
  const primaryCategory = imp.especialidad_producto[0] ?? "General";
  const primaryCountry = imp.paises_origen[0] ?? "N/A";
  const name = imp.nombre_empresa;
  const perfil = imp.perfil_publico ?? null;
  const tierMinimoRequerido = readPerfilPublicoString(perfil, "tier_minimo_requerido") || imp.tier_minimo_requerido || "Bronze";
  const advisorProfile = resolveImporterAdvisorProfile(perfil, name, imp.asesores);
  return {
    description: readPerfilPublicoString(perfil, "descripcion", "description", "about"),
    certs: readPerfilPublicoStringArray(perfil, "certs", "certificaciones"),
    bannerUrl: readPerfilPublicoString(perfil, "banner_url", "banner"),
    logoUrl: imp.logo_url ?? "",
    // Ficha corporativa: la empresa ya rellenaba estos campos en su perfil,
    // pero nadie los leía, así que no aparecían en ninguna pantalla pública.
    website: readPerfilPublicoString(perfil, "website", "sitio_web", "web"),
    email: readPerfilPublicoString(perfil, "email", "correo", "email_contacto"),
    phone: readPerfilPublicoString(perfil, "phone", "telefono"),
    address: readPerfilPublicoString(perfil, "address", "direccion"),
    foundedYear: readPerfilPublicoString(perfil, "year", "anio_fundacion", "fundacion"),
    industries: readPerfilPublicoStringArray(perfil, "industries", "industrias", "sectores"),
    platformCerts: (imp.certificaciones ?? []).map((cert) => ({
      id: cert.certificacion_id,
      nombre: cert.nombre,
      descripcion: cert.descripcion || "",
      logoUrl: cert.logo_url || "",
      peso: Number(cert.peso_publicidad || 0),
    })),
    adScore: Number(imp.puntaje_publicidad || 0),
    id: imp.id,
    name,
    specialty: `${primaryCategory} internacional`,
    rating: Number(imp.calificacion_promedio || 0),
    responseTime: imp.tiempo_respuesta_promedio || "~48h",
    initials: initialsFromName(name),
    color: importerColorFromId(imp.id),
    memberSince: formatShortDate(imp.fecha_registro),
    // Órdenes entregadas que cuenta el backend. Antes era un 0 fijo y todas las
    // empresas se presentaban como si no hubieran cerrado ni un proyecto.
    projects: Number(imp.proyectos_completados ?? 0),
    verified: Boolean(imp.verificado),
    country: primaryCountry,
    categories: imp.especialidad_producto.length > 0 ? imp.especialidad_producto : ["General"],
    tierMinimoRequerido: ["Bronze", "Silver", "Gold", "Élite"].includes(tierMinimoRequerido) ? tierMinimoRequerido as Importer["tierMinimoRequerido"] : "Bronze",
    shippingMarkPrefix: imp.shipping_mark_prefijo ?? undefined,
    advisors: (imp.asesores ?? []).map((asesor) => ({
      id: asesor.id,
      name: asesor.nombre,
      role: ROL_ASESOR_PUBLICO[asesor.rol] || "Asesor",
      initials: initialsFromName(asesor.nombre),
      color: "bg-slate-600",
    })),
    advisor: {
      name: advisorProfile.advisorName,
      role: advisorProfile.advisorRole,
      initials: advisorProfile.advisorInitials,
      color: "bg-slate-600",
      email: advisorProfile.advisorEmail,
      phone: advisorProfile.advisorPhone,
    },
  };
}
