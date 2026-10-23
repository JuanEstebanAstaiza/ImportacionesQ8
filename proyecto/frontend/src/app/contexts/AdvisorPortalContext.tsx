import { createContext, useContext, type ReactNode } from "react";
import type { AdvisorRouterProps } from "@/pages/advisor/AdvisorRouter";

export type AdvisorPortalData = Omit<AdvisorRouterProps, "screen" | "sb">;
const AdvisorPortalContext = createContext<AdvisorPortalData | null>(null);

export function AdvisorPortalProvider({ value, children }: { value: AdvisorPortalData; children: ReactNode }) {
  return <AdvisorPortalContext.Provider value={value}>{children}</AdvisorPortalContext.Provider>;
}

export function useAdvisorPortal(): AdvisorPortalData {
  const value = useContext(AdvisorPortalContext);
  if (!value) throw new Error("useAdvisorPortal must be used within AdvisorPortalProvider");
  return value;
}
