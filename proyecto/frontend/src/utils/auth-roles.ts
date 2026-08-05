export type AppUserRole = "solicitante" | "importadora" | "asesor" | "admin";

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

  if (normalizedRole === "solicitante" || normalizedRole === "asesor") {
    return normalizedRole;
  }

  return null;
}
