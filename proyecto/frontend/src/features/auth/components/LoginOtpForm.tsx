import { ArrowLeft, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/app/components/ui/input-otp";

interface LoginOtpFormProps {
  email: string;
  reasonMessage?: string;
  isPending: boolean;
  isResending: boolean;
  errorMessage?: string;
  infoMessage?: string;
  onSubmit: (otp: string) => void;
  onResend: () => void;
  onBackToLogin: () => void;
}

export function LoginOtpForm({
  email,
  reasonMessage,
  isPending,
  isResending,
  errorMessage,
  infoMessage,
  onSubmit,
  onResend,
  onBackToLogin,
}: LoginOtpFormProps) {
  const [otp, setOtp] = useState("");

  useEffect(() => {
    setOtp("");
  }, [email]);

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-xl font-semibold tracking-tight">Verificación de seguridad</CardTitle>
        <CardDescription>
          Ingresa el código de 6 dígitos enviado a <span className="font-medium text-foreground">{email}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Banner informativo adaptado a la paleta de la app */}
        <div className="flex gap-2.5 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2.5 text-xs text-primary dark:border-accent/30 dark:bg-accent/15 dark:text-accent">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary dark:text-accent" />
          <p>{reasonMessage || "Por seguridad, confirma el código OTP enviado a tu correo."}</p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(otp);
          }}
        >
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
              autoFocus
              pattern="^[0-9]*$"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {errorMessage && <p className="text-xs text-destructive text-center font-medium">{errorMessage}</p>}
          {infoMessage && <p className="text-xs text-muted-foreground text-center">{infoMessage}</p>}

          {/* Botón Principal: Primary en claro, Accent en oscuro */}
          <Button
            className="w-full bg-primary text-primary-foreground hover:bg-primary/80 dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/80 transition-colors"
            type="submit"
            disabled={isPending || otp.length !== 6}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              "Verificar código"
            )}
          </Button>
        </form>

        {/* Contenedor corregido: solo estructura flex/gap */}
        <div className="flex flex-col gap-2 pt-1">
          <Button 
            type="button" 
            variant="outline" 
            className="w-full gap-2 hover:bg-primary/10 hover:text-primary hover:border-primary dark:hover:bg-accent/15 dark:hover:text-accent dark:hover:border-accent transition-colors" 
            onClick={onResend} 
            disabled={isResending}
          >
            {isResending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Reenviando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Reenviar código OTP
              </>
            )}
          </Button>

          <Button 
            type="button" 
            variant="ghost" 
            className="w-full gap-2 text-muted-foreground hover:text-white hover:bg-primary/80 dark:hover:bg-accent/70 dark:hover:text-accent-foreground transition-colors" 
            onClick={onBackToLogin}
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al login
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}