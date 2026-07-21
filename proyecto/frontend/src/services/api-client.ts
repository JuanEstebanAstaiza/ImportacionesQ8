import type { AuthErrorResponse } from "@/types/auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_STORAGE_KEY = "auth_token";
const ROLE_STORAGE_KEY = "auth_role";

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

function formatErrorDetail(detail: unknown): string {
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => formatErrorDetail(item))
      .filter(Boolean)
      .join(". ");
  }

  if (isObject(detail)) {
    if (typeof detail.msg === "string") {
      return detail.msg;
    }

    if (typeof detail.message === "string") {
      return detail.message;
    }

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
  const { method = "GET", body, token = getStoredToken(), headers = {} } = options;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
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