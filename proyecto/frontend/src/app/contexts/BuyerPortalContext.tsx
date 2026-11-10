import { createContext, useContext, type ReactNode } from "react";
import type { BuyerRouterProps } from "@/pages/buyer/BuyerRouter";

export type BuyerPortalData = Omit<BuyerRouterProps, "screen" | "sb">;

const BuyerPortalContext = createContext<BuyerPortalData | null>(null);

export function BuyerPortalProvider({ value, children }: { value: BuyerPortalData; children: ReactNode }) {
  return <BuyerPortalContext.Provider value={value}>{children}</BuyerPortalContext.Provider>;
}

export function useBuyerPortal(): BuyerPortalData {
  const value = useContext(BuyerPortalContext);
  if (!value) throw new Error("useBuyerPortal must be used within BuyerPortalProvider");
  return value;
}
