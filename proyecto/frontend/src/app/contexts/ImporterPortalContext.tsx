import { createContext, useContext, type ReactNode } from "react";
import type { ImporterRouterProps } from "@/pages/importer/ImporterRouter";

export type ImporterPortalData = Omit<ImporterRouterProps, "screen" | "sb">;
const ImporterPortalContext = createContext<ImporterPortalData | null>(null);

export function ImporterPortalProvider({ value, children }: { value: ImporterPortalData; children: ReactNode }) {
  return <ImporterPortalContext.Provider value={value}>{children}</ImporterPortalContext.Provider>;
}

export function useImporterPortal(): ImporterPortalData {
  const value = useContext(ImporterPortalContext);
  if (!value) throw new Error("useImporterPortal must be used within ImporterPortalProvider");
  return value;
}
