import type { AuthErrorResponse } from "@/types/auth";

const ENV = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};

const RAW_API_URL = String(ENV.VITE_API_URL ?? "").trim();

/**
 * Prefijo del proxy same-origin hacia el backend (ver `server.proxy` en vite.config.ts).
 * El backend NO monta sus routers bajo `/api`: ese prefijo lo agrega y lo quita el proxy.
 * Por eso hay que poder retirarlo de todo lo que venga guardado en base de datos.
 */
const API_PROXY_PREFIX = normalizePathPrefix(ENV.VITE_API_PROXY_PREFIX ?? "/api");

const FALLBACK_API_URL = "http://localhost:8000";

const TOKEN_STORAGE_KEY = "auth_token";
const ROLE_STORAGE_KEY = "auth_role";
export const SESSION_EXPIRED_EVENT = "auth:session-expired";

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

function normalizePathPrefix(value: string | null | undefined): string {
  const trimmed = String(value ?? "").trim().replace(/\/+$/, "");
  if (!trimmed || trimmed === "/") {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTNAMES.has(hostname.toLowerCase());
}

function getWindowLocation(): Location | null {
  return typeof window !== "undefined" && window.location ? window.location : null;
}

function computeApiBaseUrl(): string {
  const location = getWindowLocation();
  const sameOriginBase = location ? `${location.origin}${API_PROXY_PREFIX}` : "";

  if (!RAW_API_URL) {
    return sameOriginBase || FALLBACK_API_URL;
  }

  let configured: URL;
  try {
    configured = new URL(RAW_API_URL, location?.origin);
  } catch {
    return sameOriginBase || FALLBACK_API_URL;
  }

  if (location && sameOriginBase) {
    const servedFromLoopback = isLoopbackHostname(location.hostname);

    // La app se sirve desde un host remoto (Dev Tunnel, LAN, staging) pero la
    // config apunta a loopback: el browser del usuario no puede alcanzar esa
    // máquina, así que se usa el proxy same-origin, que sí viaja por el túnel.
    if (isLoopbackHostname(configured.hostname) && !servedFromLoopback) {
      return sameOriginBase;
    }

    // Página https + backend http en otro host: el browser bloquea el contenido
    // mixto. El proxy same-origin conserva el esquema y evita el bloqueo.
    if (location.protocol === "https:" && configured.protocol === "http:" && configured.host !== location.host) {
      return sameOriginBase;
    }
  }

  return `${configured.origin}${normalizePathPrefix(configured.pathname)}`;
}

let cachedApiBaseUrl: string | null = null;

export function getApiBaseUrl(): string {
  if (cachedApiBaseUrl === null) {
    cachedApiBaseUrl = computeApiBaseUrl();
  }
  return cachedApiBaseUrl;
}

function getApiBasePathPrefix(): string {
  try {
    return normalizePathPrefix(new URL(getApiBaseUrl()).pathname);
  } catch {
    return "";
  }
}

/** Quita `prefix` del inicio de `pathname` tantas veces como aparezca (`/api/api/...`). */
function stripPathPrefix(pathname: string, prefix: string): string {
  if (!prefix) {
    return pathname;
  }

  const lowerPrefix = prefix.toLowerCase();
  let result = pathname;
  while (result.toLowerCase() === lowerPrefix || result.toLowerCase().startsWith(`${lowerPrefix}/`)) {
    result = result.slice(prefix.length) || "/";
  }

  return result.startsWith("/") ? result : `/${result}`;
}

/**
 * Un host es "interno" si el recurso realmente vive en nuestro backend: el host
 * del base actual, el origen desde el que se sirve la app, cualquier loopback
 * (queda `http://localhost:5173/api/...` guardado por entornos viejos) o el host
 * configurado en VITE_API_URL.
 */
function isInternalHost(url: URL): boolean {
  const candidates = new Set<string>();

  try {
    candidates.add(new URL(getApiBaseUrl()).host);
  } catch {
    /* base inválida: se ignora */
  }

  const location = getWindowLocation();
  if (location?.host) {
    candidates.add(location.host);
  }

  if (RAW_API_URL) {
    try {
      candidates.add(new URL(RAW_API_URL, location?.origin).host);
    } catch {
      /* configuración inválida: se ignora */
    }
  }

  return candidates.has(url.host) || isLoopbackHostname(url.hostname);
}

function canonicalizePathname(value: string): string {
  const normalized = value.startsWith("/") ? value : `/${value}`;

  const hashIndex = normalized.indexOf("#");
  const hash = hashIndex >= 0 ? normalized.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? normalized.slice(0, hashIndex) : normalized;

  const queryIndex = withoutHash.indexOf("?");
  const search = queryIndex >= 0 ? withoutHash.slice(queryIndex) : "";

  let pathname = (queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash).replace(/\/{2,}/g, "/");

  // Retira prefijos de proxy acumulados en cualquier orden hasta estabilizar.
  const basePrefix = getApiBasePathPrefix();
  let previous = "";
  while (previous !== pathname) {
    previous = pathname;
    pathname = stripPathPrefix(pathname, API_PROXY_PREFIX);
    pathname = stripPathPrefix(pathname, basePrefix);
  }

  return `${pathname}${search}${hash}`;
}

/**
 * Reduce cualquier forma almacenada a la ruta canónica del backend
 * (`/documentos/archivos/<id>/descargar`), sin host y sin prefijo de proxy.
 * Devuelve la URL intacta cuando apunta a un host externo real (CDN, S3, video).
 * Devuelve "" para esquemas no http(s) (`javascript:`, `data:`).
 */
export function toApiPath(pathOrUrl: string | null | undefined): string {
  const raw = String(pathOrUrl ?? "").trim();
  if (!raw) {
    return "";
  }

  const isProtocolRelative = raw.startsWith("//");
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);

  if (hasScheme || isProtocolRelative) {
    const location = getWindowLocation();
    const absolute = isProtocolRelative ? `${location?.protocol ?? "https:"}${raw}` : raw;

    let parsed: URL;
    try {
      parsed = new URL(absolute);
    } catch {
      return "";
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    if (!isInternalHost(parsed)) {
      return parsed.toString();
    }

    return canonicalizePathname(`${parsed.pathname}${parsed.search}${parsed.hash}`);
  }

  return canonicalizePathname(raw);
}

/** Ruta canónica resuelta contra el backend alcanzable desde este browser. */
export function resolveApiUrl(pathOrUrl: string | null | undefined): string {
  const canonical = toApiPath(pathOrUrl);
  if (!canonical) {
    return "";
  }

  if (/^https?:\/\//i.test(canonical)) {
    return canonical;
  }

  let base: URL;
  try {
    base = new URL(getApiBaseUrl());
  } catch {
    return canonical;
  }

  return `${base.origin}${normalizePathPrefix(base.pathname)}${canonical}`;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizePath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const [pathname, search] = normalized.split("?");

  // Solo normaliza raíces de colección que en backend están definidas como "/" bajo su prefijo.
  // Evita tocar rutas como /notificaciones o /chat/conversaciones, que no llevan slash final.
  const trailingSlashRoots = new Set(["/importadores", "/cotizaciones", "/ordenes", "/propuestas"]);
  const canonicalPathname =
    trailingSlashRoots.has(pathname) && !pathname.endsWith("/") ? `${pathname}/` : pathname;

  return search ? `${canonicalPathname}?${search}` : canonicalPathname;
}

function isProtectedPath(pathname: string): boolean {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const protectedPrefixes = [
    "/usuarios",
    "/notificaciones",
    "/chat",
    "/cotizaciones",
    "/propuestas",
    "/asesores",
    "/ordenes",
    "/pagos",
    "/creditos",
    "/organizaciones",
    "/disputas",
    "/referidos",
    "/admin",
  ];

  return protectedPrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

function formatErrorDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => formatErrorDetail(item))
      .filter(Boolean)
      .join(". ");
  }

  if (isObject(detail)) {
    if (typeof detail.msg === "string") return detail.msg;
    if (typeof detail.message === "string") return detail.message;

    return Object.values(detail)
      .map((value) => formatErrorDetail(value))
      .filter(Boolean)
      .join(". ");
  }

  return "";
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(ROLE_STORAGE_KEY);
}

export function setStoredRole(role: string): void {
  localStorage.setItem(ROLE_STORAGE_KEY, role);
}

export function getStoredRole(): string | null {
  return localStorage.getItem(ROLE_STORAGE_KEY);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token: providedToken, headers = {} } = options;

  const safePath = sanitizePath(path);
  const fullUrl = resolveApiUrl(safePath);

  // Lee el token justo antes de construir la petición para evitar carreras post-login.
  const activeToken = getStoredToken() ?? providedToken;
  const [pathname] = safePath.split("?");

  if (isProtectedPath(pathname) && !activeToken) {
    throw new Error("No hay token de autenticación disponible para esta petición protegida");
  }

  const isFormDataBody = typeof FormData !== "undefined" && body instanceof FormData;

  const response = await fetch(fullUrl, {
    method,
    headers: {
      ...(!isFormDataBody && body ? { "Content-Type": "application/json" } : {}),
      ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
      ...headers,
    },
    ...(body ? { body: isFormDataBody ? body as FormData : JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const fallbackMessage = "Ocurrio un error al conectar con el servidor";
    const errorPayload = (await response.json().catch(() => ({}))) as AuthErrorResponse & {
      detail?: unknown;
    };
    throw new Error(formatErrorDetail(errorPayload.detail) || fallbackMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}