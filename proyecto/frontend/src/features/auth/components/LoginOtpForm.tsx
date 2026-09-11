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
        <CardTitle className="text-xl font-semibold tracking-tight">Verificacion de seguridad</CardTitle>
        <CardDescription>
          Ingresa el codigo de 6 digitos enviado a <span className="font-medium text-foreground">{email}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <p>{reasonMessage || "Por seguridad, confirma el codigo OTP enviado a tu correo."}</p>
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

          {errorMessage && <p className="text-xs text-destructive text-center">{errorMessage}</p>}
          {infoMessage && <p className="text-xs text-muted-foreground text-center">{infoMessage}</p>}

          <Button
            className="w-full bg-purple-600 text-white hover:bg-purple-700 dark:bg-accent dark:text-black dark:hover:bg-accent/70 transition-colors"
            type="submit"
            disabled={isPending || otp.length !== 6}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              "Verificar codigo"
            )}
          </Button>
        </form>

        <div className="w-full bg-purple-600 text-white hover:bg-purple-700 dark:bg-accent dark:text-black dark:hover:bg-accent/70 transition-colors">
          <Button type="button" variant="outline" className="w-full" onClick={onResend} disabled={isResending}>
            {isResending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Reenviando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Reenviar codigo OTP
              </>
            )}
          </Button>

          <Button type="button" variant="ghost" className="w-full" onClick={onBackToLogin}>
            <ArrowLeft className="h-4 w-4" />
            Volver al login
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
