import {
  createContext,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CurrentUserResponse,
  LoginOtpRequest,
  LoginRequest,
  LoginResponse,
} from "@/types/auth";
import { authService } from "@/services/auth.service";
import {
  SESSION_EXPIRED_EVENT,
  clearStoredToken,
  getStoredToken,
  setStoredRole,
  setStoredToken,
} from "@/services/api-client";
import { mapBackendRoleToAppRole, type AppUserRole } from "@/utils/auth-roles";

interface AuthContextValue {
  isAuthenticated: boolean;
  isInitializing: boolean;
  token: string | null;
  user: CurrentUserResponse | null;
  appRole: AppUserRole | null;
  signIn: (payload: LoginRequest) => Promise<LoginResponse>;
  verifyLoginOtp: (payload: LoginOtpRequest, email: string) => Promise<LoginResponse>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => getStoredToken());

  const clearSession = useCallback(async () => {
    clearStoredToken();
    setToken(null);
    queryClient.removeQueries({ queryKey: ["auth", "me"] });
  }, [queryClient]);

  const meQuery = useQuery({
    queryKey: ["auth", "me", token],
    queryFn: () => authService.getCurrentUser(token ?? undefined),
    enabled: Boolean(token),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const completeAuthenticatedSession = useCallback(
    async (loginResponse: LoginResponse, email: string) => {
      if (!loginResponse.access_token || !loginResponse.rol) {
        throw new Error(loginResponse.mensaje || "El login no devolvió access_token y rol");
      }

      const newToken = loginResponse.access_token;

      // 1) Guarda token y rol sincrónicamente antes de cualquier render/react-query.
      setStoredToken(newToken);
      setStoredRole(loginResponse.rol);

      // 2) Puebla la caché de /me para el nuevo token antes de actualizar el estado de React.
      let currentUser: CurrentUserResponse;
      try {
        currentUser = await authService.getCurrentUser(newToken);
      } catch {
        currentUser = {
          id: loginResponse.user_id ?? "pending",
          email,
          rol: loginResponse.rol,
          importador_id: null,
          nombre: null,
          telefono: null,
          foto_url: null,
          whatsapp: null,
          activo: true,
          perfil_completo: Boolean(loginResponse.perfil_completo),
          fecha_creacion: new Date().toISOString(),
        };
      }
      queryClient.setQueryData(["auth", "me", newToken], currentUser);

      // 3) Por último actualiza el estado de React para disparar el re-render.
      setToken(newToken);
    },
    [queryClient],
  );

  const signIn = useCallback(
    async (payload: LoginRequest) => {
      const normalizedPayload: LoginRequest = {
        email: String(payload.email ?? "").trim(),
        password: String(payload.password ?? ""),
      };

      if (!normalizedPayload.email || !normalizedPayload.password) {
        throw new Error("Email y contraseña son obligatorios");
      }

      const loginResponse = await authService.login(normalizedPayload);
      const otpGate = loginResponse as LoginResponse & {
        require_otp?: boolean;
        status?: string;
      };
      if (loginResponse.requiere_otp || otpGate.require_otp === true || otpGate.status === "otp_required") {
        return loginResponse;
      }

      await completeAuthenticatedSession(loginResponse, normalizedPayload.email);
      return loginResponse;
    },
    [completeAuthenticatedSession],
  );

  const verifyLoginOtp = useCallback(
    async (payload: LoginOtpRequest, email: string) => {
      const normalizedOtp = String(payload.otp ?? "").trim();
      if (!payload.challenge_token || normalizedOtp.length !== 6) {
        throw new Error("Debes ingresar un código OTP válido de 6 dígitos");
      }

      const loginResponse = await authService.verifyLoginOtp({
        challenge_token: payload.challenge_token,
        otp: normalizedOtp,
      });
      await completeAuthenticatedSession(loginResponse, String(email ?? "").trim());
      return loginResponse;
    },
    [completeAuthenticatedSession],
  );

  const signOut = useCallback(async () => {
    const activeToken = getStoredToken();
    if (activeToken) {
      await authService.logout(activeToken).catch(() => undefined);
    }
    await clearSession();
  }, [clearSession]);

  useEffect(() => {
    function handleSessionExpired() {
      void clearSession();
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [clearSession]);

  const requestPasswordReset = useCallback(async (email: string) => {
    await authService.forgotPassword({ email });
  }, []);

  const user = meQuery.data ?? null;
  const normalizedUserRole = String(user?.rol ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const mappedRole = user ? mapBackendRoleToAppRole(user.rol) : null;
  const appRole = mappedRole ?? (normalizedUserRole.includes("admin") ? "admin" : null);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(token && user),
      isInitializing: Boolean(token) && meQuery.isLoading,
      token,
      user,
      appRole,
      signIn,
      verifyLoginOtp,
      signOut,
      requestPasswordReset,
    }),
    [token, user, appRole, signIn, verifyLoginOtp, signOut, requestPasswordReset, meQuery.isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext debe usarse dentro de AuthProvider");
  }
  return context;
}