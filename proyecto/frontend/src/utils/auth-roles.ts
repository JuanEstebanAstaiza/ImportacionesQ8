import type { BackendAuthRole } from "@/types/auth";

export type AppUserRole = "solicitante" | "importadora" | "asesor" | "admin";

export function mapBackendRoleToAppRole(role: BackendAuthRole): AppUserRole {
  if (role === "importador") {
    return "importadora";
  }
  return role;
}
