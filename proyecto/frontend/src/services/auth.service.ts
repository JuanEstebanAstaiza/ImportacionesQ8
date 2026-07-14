import type {
  CurrentUserResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
} from "@/types/auth";
import { apiRequest } from "@/services/api-client";

export const authService = {
  login(payload: LoginRequest): Promise<LoginResponse> {
    return apiRequest<LoginResponse>("/auth/login", {
      method: "POST",
      body: payload,
    });
  },

  getCurrentUser(token?: string): Promise<CurrentUserResponse> {
    return apiRequest<CurrentUserResponse>("/usuarios/me", {
      method: "GET",
      token,
    });
  },

  forgotPassword(payload: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    return apiRequest<ForgotPasswordResponse>("/auth/forgot-password", {
      method: "POST",
      body: payload,
    });
  },

  logout(token?: string): Promise<void> {
    return apiRequest<void>("/auth/logout", {
      method: "POST",
      token,
    });
  },
};
