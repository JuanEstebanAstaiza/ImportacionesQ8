import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CurrentUserResponse,
  LoginRequest,
  LoginResponse,
} from "@/types/auth";
import { authService } from "@/services/auth.service";
import {
  clearStoredToken,
  getStoredToken,
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
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const token = getStoredToken();

  const meQuery = useQuery({
    queryKey: ["auth", "me", token],
    queryFn: () => authService.getCurrentUser(token ?? undefined),
    enabled: Boolean(token),
    retry: false,
    staleTime: 60_000,
  });

  const signIn = useCallback(
    async (payload: LoginRequest) => {
      const loginResponse = await authService.login(payload);
      setStoredToken(loginResponse.access_token);
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      await queryClient.refetchQueries({ queryKey: ["auth", "me"] });
      return loginResponse;
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    const activeToken = getStoredToken();
    if (activeToken) {
      await authService.logout(activeToken).catch(() => undefined);
    }
    clearStoredToken();
    await queryClient.resetQueries({ queryKey: ["auth", "me"] });
  }, [queryClient]);

  const requestPasswordReset = useCallback(async (email: string) => {
    await authService.forgotPassword({ email });
  }, []);

  const user = meQuery.data ?? null;
  const appRole = user ? mapBackendRoleToAppRole(user.rol) : null;

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(token && user),
      isInitializing: Boolean(token) && meQuery.isLoading,
      token,
      user,
      appRole,
      signIn,
      signOut,
      requestPasswordReset,
    }),
    [token, user, appRole, signIn, signOut, requestPasswordReset, meQuery.isLoading],
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
