import type { AuthErrorResponse } from "@/types/auth";

const API_URL =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
    ?.VITE_API_URL || "http://localhost:8000";
const TOKEN_STORAGE_KEY = "auth_token";
const ROLE_STORAGE_KEY = "auth_role";
export const SESSION_EXPIRED_EVENT = "auth:session-expired";

export function getApiBaseUrl(): string {
  return API_URL.endsWith("/") ? API_URL.slice(0, -1) : API_URL;
}

export function resolveApiUrl(pathOrUrl: string | null | undefined): string {
  const raw = String(pathOrUrl ?? "").trim();
  if (!raw) {
    return "";
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  const baseUrl = getApiBaseUrl();
  const base = new URL(baseUrl);
  const normalizedRaw = raw.startsWith("/") ? raw : `/${raw}`;

  // Evita rutas duplicadas como /api/api/... cuando la base ya contiene /api.
  const baseApiPrefix = base.pathname.replace(/\/+$/, "");
  let dedupedRaw = normalizedRaw;
  if (baseApiPrefix && baseApiPrefix !== "/") {
    while (dedupedRaw.startsWith(`${baseApiPrefix}/`)) {
      dedupedRaw = dedupedRaw.slice(baseApiPrefix.length);
    }
  }

  return `${base.origin}${baseApiPrefix}${dedupedRaw}`;
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
  const baseUrl = getApiBaseUrl();
  const fullUrl = `${baseUrl}${safePath}`;

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