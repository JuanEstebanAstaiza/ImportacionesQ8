import type {
  CurrentUserResponse,
  LoginRequest,
  LoginResponse,
} from "@/types/auth";
import {
  clearStoredToken,
  getStoredToken,
  setStoredRole,
  setStoredToken,
} from "@/services/api-client";
import { authService as authApiService } from "@/services/auth.service";

export type User = CurrentUserResponse;
export type AuthResponse = LoginResponse;

export const authService = {
  setToken(token: string) {
    setStoredToken(token);
  },

  getToken(): string | null {
    return getStoredToken();
  },

  logout() {
    clearStoredToken();
  },

  async login(payload: LoginRequest): Promise<AuthResponse> {
    const data = await authApiService.login(payload);
    if (!data.access_token || !data.rol) {
      throw new Error(data.mensaje || "El login no devolvio access_token y rol");
    }
    setStoredToken(data.access_token);
    setStoredRole(data.rol);
    return data;
  },

  async getCurrentUser(): Promise<User> {
    const token = getStoredToken();
    if (!token) {
      throw new Error("No hay token disponible");
    }

    return authApiService.getCurrentUser(token);
  },
};