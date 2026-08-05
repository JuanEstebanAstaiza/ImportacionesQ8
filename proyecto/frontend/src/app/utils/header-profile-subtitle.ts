export type HeaderSubtitleRole = "solicitante" | "importadora" | "asesor" | "admin";

export interface ResolveHeaderSubtitleInput {
  role: HeaderSubtitleRole;
  importerCompanyName?: string | null;
  importerFallbackCompany: string;
  advisorFallbackCompany: string;
}

export function resolveHeaderSubtitle(input: ResolveHeaderSubtitleInput): string {
  const {
    role,
    importerCompanyName,
    importerFallbackCompany,
    advisorFallbackCompany,
  } = input;

  if (role === "importadora") {
    return `${importerCompanyName || importerFallbackCompany} · Empresa importadora`;
  }

  if (role === "asesor") {
    return `${importerCompanyName || advisorFallbackCompany} · Asesor`;
  }

  if (role === "admin") {
    return "Administrador del sistema";
  }

  return "Solicitante";
}
