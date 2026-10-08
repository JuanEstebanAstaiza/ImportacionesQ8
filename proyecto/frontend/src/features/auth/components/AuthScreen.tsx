import { useMutation } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/auth.service";
import { mapBackendRoleToAppRole } from "@/utils/auth-roles";
import { ForgotPasswordForm, type ForgotPasswordFormValues } from "@/features/auth/components/ForgotPasswordForm";
import { LoginForm, type LoginFormValues } from "@/features/auth/components/LoginForm";
import { LoginOtpForm } from "@/features/auth/components/LoginOtpForm";
import { useBrandTheme } from "@/app/hooks/useBrandTheme";
import type { LegalPage } from "@/features/legal/types";

type AuthView = "login" | "forgot" | "otp";
export type PortalRole = "solicitante" | "importadora" | "asesor" | "admin" | "soporte" | "designer";

interface AuthScreenProps {
  onLogin: (role: PortalRole) => void;
  onRegister: () => void;
  onLanding: () => void;
  onPolicy: (page: LegalPage) => void;
  logo: React.ReactNode;
  initialEmail?: string;
}

export function AuthScreen({ onLogin, onRegister, onLanding, onPolicy, logo, initialEmail }: AuthScreenProps) {
  const { signIn, verifyLoginOtp, requestPasswordReset } = useAuth();
  const [view, setView] = useState<AuthView>("login");
  const { dark, toggleTheme } = useBrandTheme();
  const [success, setSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpChallengeToken, setOtpChallengeToken] = useState("");
  const [otpReasonMessage, setOtpReasonMessage] = useState("");
  const [otpInfoMessage, setOtpInfoMessage] = useState("");
  const [authError, setAuthError] = useState("");

  const loginMutation = useMutation({
    mutationFn: (values: LoginFormValues) => signIn(values),
    onSuccess: (response, variables) => {
      const otpGate = response as typeof response & {
        require_otp?: boolean;
        status?: string;
      };
      if (response.requiere_otp || otpGate.require_otp === true || otpGate.status === "otp_required") {
        if (!response.challenge_token) {
          setAuthError(response.mensaje || "No se pudo iniciar el reto OTP. Intenta de nuevo.");
          return;
        }
        setOtpEmail(String(variables.email ?? "").trim());
        setOtpChallengeToken(response.challenge_token);
        setOtpReasonMessage(response.mensaje || "");
        setOtpInfoMessage("");
        setAuthError("");
        setView("otp");
        return;
      }

      if (!response.rol) {
        setAuthError(response.mensaje || "Respuesta de login invalida: falta rol");
        return;
      }
      const appRole = mapBackendRoleToAppRole(response.rol);
      if (!appRole) {
        setAuthError("No se reconoce el rol del usuario autenticado.");
        return;
      }
      onLogin(appRole);
    },
    onError: (error) => {
      setAuthError(error instanceof Error ? error.message : "No se pudo iniciar sesion");
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: (otp: string) =>
      verifyLoginOtp(
        {
          challenge_token: otpChallengeToken,
          otp,
        },
        otpEmail,
      ),
    onSuccess: (response) => {
      if (!response.rol) {
        setAuthError(response.mensaje || "Respuesta invalida: falta rol");
        return;
      }
      const appRole = mapBackendRoleToAppRole(response.rol);
      if (!appRole) {
        setAuthError("No se reconoce el rol del usuario autenticado.");
        return;
      }
      onLogin(appRole);
    },
    onError: (error) => {
      setAuthError(error instanceof Error ? error.message : "No se pudo verificar el codigo OTP");
    },
  });

  const resendOtpMutation = useMutation({
    mutationFn: () =>
      authService.resendOtp({
        email: otpEmail,
        proposito: "login_tardio",
      }),
    onSuccess: (response) => {
      if (response.challenge_token) {
        setOtpChallengeToken(response.challenge_token);
      }
      setAuthError("");
      setOtpInfoMessage(response.mensaje || "Te enviamos un nuevo codigo OTP.");
    },
    onError: (error) => {
      setAuthError(error instanceof Error ? error.message : "No se pudo reenviar el codigo OTP");
    },
  });

  const forgotMutation = useMutation({
    mutationFn: (values: ForgotPasswordFormValues) => requestPasswordReset(values.email),
    onSuccess: () => {
      setSuccess(true);
      setAuthError("");
    },
    onError: (error) => {
      setAuthError(error instanceof Error ? error.message : "No se pudo enviar el enlace");
    },
  });

  function handleLogin(values: LoginFormValues) {
    setAuthError("");
    loginMutation.mutate(values);
  }

  function handleForgot(values: ForgotPasswordFormValues) {
    setAuthError("");
    setSubmittedEmail(values.email);
    forgotMutation.mutate(values);
  }

  function handleOtpSubmit(otp: string) {
    setAuthError("");
    setOtpInfoMessage("");
    verifyOtpMutation.mutate(String(otp ?? "").trim());
  }

  function handleResendOtp() {
    setAuthError("");
    setOtpInfoMessage("");
    resendOtpMutation.mutate();
  }

  function switchTo(next: AuthView) {
    setView(next);
    setAuthError("");
    setSuccess(false);
    setOtpInfoMessage("");
    if (next === "login") {
      setSubmittedEmail("");
      setOtpEmail("");
      setOtpChallengeToken("");
      setOtpReasonMessage("");
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-background px-6 py-3.5 relative z-10">
        <button onClick={onLanding}>{logo}</button>
        <button
          onClick={toggleTheme}
          title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-primary hover:text-primary-foreground dark:hover:bg-accent dark:hover:text-accent-foreground transition-colors"
        >
          {dark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
        </button>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-10 overflow-hidden">
        {/* Fondo*/}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img
            src={dark ? "/brand/fondo-2.png" : "/brand/fondo-5.png"}
            alt="Fondo de autenticación"
            className="auth-background w-full h-full object-cover object-center transition-all duration-300"
          />
        </div>

        {/* Formulario/Card por encima de la imagen */}
        <div className="relative z-10 w-full max-w-[420px]">
          {view === "login" ? (
            <LoginForm
              onSubmit={handleLogin}
              onForgotPassword={() => switchTo("forgot")}
              onRegister={onRegister}
              onLanding={onLanding}
              isPending={loginMutation.isPending}
              errorMessage={authError}
              initialEmail={initialEmail}
            />
          ) : view === "otp" ? (
            <LoginOtpForm
              email={otpEmail}
              reasonMessage={otpReasonMessage}
              isPending={verifyOtpMutation.isPending}
              isResending={resendOtpMutation.isPending}
              errorMessage={authError}
              infoMessage={otpInfoMessage}
              onSubmit={handleOtpSubmit}
              onResend={handleResendOtp}
              onBackToLogin={() => switchTo("login")}
            />
          ) : (
            <ForgotPasswordForm
              isSuccess={success}
              isPending={forgotMutation.isPending}
              successEmail={submittedEmail}
              errorMessage={authError}
              onSubmit={handleForgot}
              onBackToLogin={() => switchTo("login")}
            />
          )}
        </div>
      </main>

      <footer className="flex items-center justify-center gap-4 border-t border-border bg-background py-4 text-center text-xs text-muted-foreground relative z-10">
        <span>© 2026 Zarpi</span>
        <button onClick={() => onPolicy("data")} className="transition-colors hover:text-foreground">
          Tratamiento de Datos
        </button>
        <button onClick={() => onPolicy("terms")} className="transition-colors hover:text-foreground">
          Términos
        </button>
        <button onClick={() => onPolicy("payments")} className="transition-colors hover:text-foreground">
          Pagos y Reembolsos
        </button>
      </footer>
    </div>
  );
}