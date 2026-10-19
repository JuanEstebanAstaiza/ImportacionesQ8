import type { ReactNode } from "react";

type GuardRole = "solicitante" | "importadora" | "asesor" | "admin" | "soporte" | "designer";

interface ProtectedRouteProps {
  isInitializing: boolean;
  isAuthenticated: boolean;
  currentRole: GuardRole;
  allowedRoles?: GuardRole[];
  loadingFallback: ReactNode;
  unauthenticatedFallback: ReactNode;
  unauthorizedFallback: ReactNode;
  children: ReactNode;
}

export function ProtectedRoute({
  isInitializing,
  isAuthenticated,
  currentRole,
  allowedRoles,
  loadingFallback,
  unauthenticatedFallback,
  unauthorizedFallback,
  children,
}: ProtectedRouteProps) {
  if (isInitializing) {
    return <>{loadingFallback}</>;
  }

  if (!isAuthenticated) {
    return <>{unauthenticatedFallback}</>;
  }

  if (allowedRoles && !allowedRoles.includes(currentRole)) {
    return <>{unauthorizedFallback}</>;
  }

  return <>{children}</>;
}
