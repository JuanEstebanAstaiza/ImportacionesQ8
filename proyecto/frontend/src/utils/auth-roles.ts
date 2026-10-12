export type AppUserRole = "solicitante" | "importadora" | "asesor" | "admin" | "soporte" | "designer";

function normalizeRole(role: string): string {
  return role
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function mapBackendRoleToAppRole(role: string | null | undefined): AppUserRole | null {
  if (!role) {
    return null;
  }

  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "importador" || normalizedRole === "importadora") {
    return "importadora";
  }

  if (
    normalizedRole === "admin"
    || normalizedRole === "administrador"
    || normalizedRole === "superadmin"
    || normalizedRole === "admin_role"
  ) {
    return "admin";
  }

  if (
    normalizedRole === "solicitante"
    || normalizedRole === "asesor"
    // Equipo de atención al cliente: personal de la plataforma, pero sin las
    // facultades de administración.
    || normalizedRole === "soporte"
    // Diseño: pone portadas e imágenes a Tendencias. Interno, sin administración.
    || normalizedRole === "designer"
  ) {
    return normalizedRole;
  }

  return null;
}
