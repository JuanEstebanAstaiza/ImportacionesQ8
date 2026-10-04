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

/**
 * `motivo` va como opcional en vez de como unión discriminada porque el
 * proyecto compila con `strict: false`, y ahí TypeScript no estrecha
 * `{ok: true} | {ok: false; motivo: string}` al comprobar `!resultado.ok`.
 */
export type ResultadoArchivo = { ok: boolean; motivo?: string };

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

function escaparHtml(valor: string): string {
  return valor.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
  ));
}

/**
 * Pinta el archivo dentro de la pestaña ya abierta, enmarcándolo.
 *
 * `pestana.location.replace(blobUrl)` NO sirve: Chrome bloquea la navegación de
 * primer nivel a una `blob:` URL, así que la pestaña se quedaba en `about:blank`
 * —en blanco o con la página de inicio del navegador— y el archivo no aparecía
 * nunca. Dentro de un `<iframe>` sí se muestra, que es lo mismo que ya hacía la
 * previsualización del chat.
 */
function mostrarEnPestana(pestana: Window, urlObjeto: string, nombre: string): void {
  const titulo = escaparHtml(nombre || "Archivo");
  pestana.document.open();
  pestana.document.write(
    `<!doctype html><html lang="es"><head><meta charset="utf-8">`
    + `<title>${titulo}</title>`
    + `<style>html,body{margin:0;height:100%;background:#1b1b1b}`
    + `iframe{border:0;display:block;width:100%;height:100%}</style>`
    + `</head><body><iframe src="${urlObjeto}" title="${titulo}"></iframe></body></html>`,
  );
  pestana.document.close();
}

/** Abre el archivo en una pestaña nueva, autenticando la petición. */
export async function abrirArchivoEnPestana(
  valor: string | null | undefined,
  nombreSugerido?: string,
): Promise<ResultadoArchivo> {
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
  const nombre = nombreSugerido || canonica.split("/").filter(Boolean).pop() || "Archivo";

  try {
    const blob = await descargarComoBlob(destino, token);
    const urlObjeto = window.URL.createObjectURL(blob);

    if (pestana) {
      mostrarEnPestana(pestana, urlObjeto, nombre);
    } else {
      // Sin pestaña (bloqueador de emergentes): un enlace temporal. Sin
      // `noopener`, porque con él el navegador descarta la `blob:` URL.
      const enlace = document.createElement("a");
      enlace.href = urlObjeto;
      enlace.target = "_blank";
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
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
): Promise<ResultadoArchivo> {
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
