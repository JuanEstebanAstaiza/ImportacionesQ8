import type {
  CurrentUserResponse,
  LoginRequest,
  LoginResponse,
} from "@/types/auth";
import {
  clearStoredToken,
  getStoredToken,
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
    setStoredToken(data.access_token);
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