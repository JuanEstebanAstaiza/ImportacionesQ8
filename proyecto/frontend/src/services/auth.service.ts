import type {
  CurrentUserResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  ResetPasswordRequest,
  RegisterRequest,
  RegisterResponse,
  VerifyEmailRequest,
} from "@/types/auth";
import { apiRequest } from "@/services/api-client";

export const authService = {
  register(payload: RegisterRequest): Promise<RegisterResponse> {
    return apiRequest<RegisterResponse>("/auth/register", {
      method: "POST",
      body: payload,
    });
  },

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

  verifyEmail(payload: VerifyEmailRequest): Promise<LoginResponse> {
    return apiRequest<LoginResponse>("/auth/verificar-email", {
      method: "POST",
      body: payload,
    });
  },

  resetPassword(payload: ResetPasswordRequest): Promise<void> {
    return apiRequest<void>("/auth/reset-password", {
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
