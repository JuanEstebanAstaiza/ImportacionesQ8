export type HeaderSubtitleRole = "solicitante" | "importadora" | "asesor" | "admin" | "soporte" | "designer";

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

  // Sin esta rama, un agente de soporte se veía rotulado como "Solicitante" en
  // su propia cabecera: el tipo ya contemplaba el rol, pero no había caso y
  // caía en el valor por defecto.
  if (role === "soporte") {
    return "Equipo de soporte de la plataforma";
  }

  if (role === "designer") {
    return "Equipo de diseño";
  }

  return "Solicitante";
}
