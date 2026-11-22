/** Mensaje legible de un error de la API (apiRequest ya trae el `detail` del backend). */
export function mensajeDeError(error: unknown, porDefecto = "No pudimos completar la acción. Intenta de nuevo."): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return porDefecto;
}
