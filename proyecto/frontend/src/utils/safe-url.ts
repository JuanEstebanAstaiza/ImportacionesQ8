/**
 * Validación de URLs en el cliente (defensa en profundidad anti-XSS).
 * Solo permite http: y https:. Rechaza javascript:, data:, vbscript:, etc.
 */

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export function isSafeHttpUrl(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  try {
    const url = new URL(trimmed);
    return ALLOWED_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

/** Devuelve la URL si es segura; si no, un fallback (o vacío). */
export function safeHttpUrl(
  value: string | null | undefined,
  fallback = "",
): string {
  return isSafeHttpUrl(value) ? value!.trim() : fallback;
}

/**
 * Para iframes de video: solo YouTube embed / Vimeo player / https genérico.
 * Evita cargar orígenes arbitrarios como "preview" embebido.
 */
export function isSafeEmbedUrl(value: string | null | undefined): boolean {
  if (!isSafeHttpUrl(value)) {
    return false;
  }
  try {
    const url = new URL(value!.trim());
    const host = url.hostname.toLowerCase();
    if (host === "www.youtube.com" || host === "youtube.com" || host === "www.youtube-nocookie.com") {
      return url.pathname.startsWith("/embed/");
    }
    if (host === "player.vimeo.com") {
      return url.pathname.startsWith("/video/");
    }
    // Otros https: se permiten en <video src> pero no en iframe genérico
    return false;
  } catch {
    return false;
  }
}
