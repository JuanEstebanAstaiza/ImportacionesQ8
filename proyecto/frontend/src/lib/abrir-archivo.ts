import { getStoredToken, resolveApiUrl, toApiPath } from "@/services/api-client";

/**
 * Apertura y descarga de archivos alojados en la plataforma.
 *
 * `GET /documentos/archivos/{id}/descargar` exige `Authorization: Bearer`, y el
 * navegador **no** manda esa cabecera cuando se navega a una URL (un `<a href>`,
 * un `window.open` o pegarla en la barra de direcciones). El token vive en el
 * almacenamiento del cliente, no en una cookie, así que esas navegaciones
 * llegaban al backend sin sesión y devolvían:
 *
 *     {"detail":"Se requiere iniciar sesión para acceder a este archivo"}
 *
 * ...aunque el usuario tuviera la sesión abierta. La solución es descargar el
 * archivo con `fetch` (que sí lleva el token) y abrirlo desde un blob local.
 *
 * Los recursos externos (un CDN, una URL absoluta de otro host) se abren tal
 * cual: nunca se les manda nuestro token.
 */

type Resultado = { ok: true } | { ok: false; motivo: string };

function esRecursoDelBackend(rutaCanonica: string): boolean {
  return rutaCanonica.startsWith("/");
}

async function descargarComoBlob(destino: string, token: string): Promise<Blob> {
  const respuesta = await fetch(destino, { headers: { Authorization: `Bearer ${token}` } });
  if (!respuesta.ok) {
    if (respuesta.status === 401 || respuesta.status === 403) {
      throw new Error("No tienes permiso para ver este archivo.");
    }
    if (respuesta.status === 404) {
      throw new Error("El archivo ya no está disponible.");
    }
    throw new Error(`No se pudo abrir el archivo (${respuesta.status}).`);
  }
  return respuesta.blob();
}

/** Abre el archivo en una pestaña nueva, autenticando la petición. */
export async function abrirArchivoEnPestana(valor: string | null | undefined): Promise<Resultado> {
  const canonica = toApiPath(valor);
  if (!canonica) {
    return { ok: false, motivo: "El archivo no tiene una dirección válida." };
  }

  const destino = resolveApiUrl(canonica);
  const token = getStoredToken();

  if (!esRecursoDelBackend(canonica) || !token) {
    window.open(destino, "_blank", "noopener,noreferrer");
    return { ok: true };
  }

  // La pestaña se abre ANTES del await: si se abriera después, el bloqueador de
  // ventanas emergentes la trataría como no provocada por el usuario.
  const pestana = window.open("about:blank", "_blank");

  try {
    const blob = await descargarComoBlob(destino, token);
    const urlObjeto = window.URL.createObjectURL(blob);

    if (pestana) {
      pestana.location.replace(urlObjeto);
    } else {
      window.open(urlObjeto, "_blank", "noopener,noreferrer");
    }

    // Se revoca con retraso: hacerlo de inmediato deja la pestaña en blanco.
    window.setTimeout(() => window.URL.revokeObjectURL(urlObjeto), 60_000);
    return { ok: true };
  } catch (error) {
    pestana?.close();
    return { ok: false, motivo: error instanceof Error ? error.message : "No se pudo abrir el archivo." };
  }
}

/** Guarda el archivo en el equipo, autenticando la petición. */
export async function descargarArchivo(
  valor: string | null | undefined,
  nombreSugerido?: string,
): Promise<Resultado> {
  const canonica = toApiPath(valor);
  if (!canonica) {
    return { ok: false, motivo: "El archivo no tiene una dirección válida." };
  }

  const destino = resolveApiUrl(canonica);
  const token = getStoredToken();

  if (!esRecursoDelBackend(canonica) || !token) {
    window.open(destino, "_blank", "noopener,noreferrer");
    return { ok: true };
  }

  try {
    const blob = await descargarComoBlob(destino, token);
    const urlObjeto = window.URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = urlObjeto;
    enlace.download = nombreSugerido || canonica.split("/").filter(Boolean).pop() || "archivo";
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(urlObjeto), 60_000);
    return { ok: true };
  } catch (error) {
    return { ok: false, motivo: error instanceof Error ? error.message : "No se pudo descargar el archivo." };
  }
}
