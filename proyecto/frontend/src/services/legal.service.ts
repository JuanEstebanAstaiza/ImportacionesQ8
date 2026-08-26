import { apiRequest } from "@/services/api-client";
import type { LegalPage } from "@/features/legal/types";

export interface LegalPolicyPayload {
  endpoint: string;
  title: string;
  apiMessage: string;
}

function extractTextFromPayload(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return "";
  }

  const candidateKeys = ["mensaje", "message", "contenido", "content", "detail", "texto"] as const;
  for (const key of candidateKeys) {
    const value = (payload as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

export const legalService = {
  async getPolicy(page: LegalPage): Promise<LegalPolicyPayload> {
    const endpoint = page === "data"
      ? "/legal/politica-tratamiento-datos"
      : "/legal/terminos-condiciones";

    const title = page === "data"
      ? "Politica de Tratamiento de Datos"
      : "Terminos y Condiciones";

    const payload = await apiRequest<unknown>(endpoint, { method: "GET" });
    const apiMessage = extractTextFromPayload(payload);

    return {
      endpoint,
      title,
      apiMessage,
    };
  },
};
