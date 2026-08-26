import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { authService } from "@/services/auth.service";

const resetSchema = z
  .object({
    otp: z.string().min(6, "Ingresa el codigo OTP de 6 digitos."),
    nuevaPassword: z
      .string()
      .min(9, "La nueva contrasena debe tener al menos 9 caracteres."),
    confirmarPassword: z.string().min(1, "Confirma la nueva contrasena."),
  })
  .refine((data) => data.nuevaPassword === data.confirmarPassword, {
    path: ["confirmarPassword"],
    message: "Las contrasenas no coinciden.",
  });

type ResetFormValues = z.infer<typeof resetSchema>;

interface ResetPasswordFormProps {
  token: string;
  onBackToLogin: () => void;
}

export function ResetPasswordForm({
  token,
  onBackToLogin,
}: ResetPasswordFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      otp: "",
      nuevaPassword: "",
      confirmarPassword: "",
    },
  });

  async function onSubmit(values: ResetFormValues) {
    setErrorMessage("");

    if (!token) {
      setErrorMessage(
        "Token invalido o ausente en el enlace de recuperacion."
      );
      return;
    }

    try {
      setIsPending(true);

      await authService.resetPassword({
        token: String(token ?? "").trim(),
        otp: String(values.otp ?? "").trim(),
        nueva_password: String(values.nuevaPassword ?? ""),
      });

      setIsSuccess(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo restablecer la contrasena"
      );
    } finally {
      setIsPending(false);
    }
  }

  if (isSuccess) {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-xl font-semibold tracking-tight">
            Contrasena actualizada
          </CardTitle>

          <CardDescription>
            Ya puedes iniciar sesion con tu nueva contrasena.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-center">
          <div className="flex justify-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={onBackToLogin}
            className="w-full"
          >
            Ir a iniciar sesion
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-xl font-semibold tracking-tight">
          Restablecer contrasena
        </CardTitle>

        <CardDescription>
          Ingresa el OTP recibido y define una nueva contrasena.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form
          className="space-y-4"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
        >
          {/* OTP */}
          <div className="space-y-2">
            <Label htmlFor="reset-otp">Codigo OTP</Label>

            <Input
              id="reset-otp"
              type="text"
              placeholder="123456"
              autoComplete="one-time-code"
              aria-invalid={Boolean(form.formState.errors.otp)}
              className="
                border-gray-300
                dark:border-gray-600
                focus-visible:border-ring
                focus-visible:ring-ring/50
              "
              {...form.register("otp")}
            />

            {form.formState.errors.otp && (
              <p className="text-xs text-destructive">
                {form.formState.errors.otp.message}
              </p>
            )}
          </div>

          {/* Nueva contraseña */}
          <div className="space-y-2">
            <Label htmlFor="reset-new-password">
              Nueva contrasena
            </Label>

            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />

              <Input
                id="reset-new-password"
                type="password"
                className="
                  pl-9
                  border-gray-300
                  dark:border-gray-600
                  focus-visible:border-ring
                  focus-visible:ring-ring/50
                "
                placeholder="Minimo 9 caracteres"
                autoComplete="new-password"
                aria-invalid={Boolean(
                  form.formState.errors.nuevaPassword
                )}
                {...form.register("nuevaPassword")}
              />
            </div>

            {form.formState.errors.nuevaPassword && (
              <p className="text-xs text-destructive">
                {form.formState.errors.nuevaPassword.message}
              </p>
            )}
          </div>

          {/* Confirmar contraseña */}
          <div className="space-y-2">
            <Label htmlFor="reset-confirm-password">
              Confirmar nueva contrasena
            </Label>

            <div className="relative">
              <ShieldCheck className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />

              <Input
                id="reset-confirm-password"
                type="password"
                className="
                  pl-9
                  border-gray-300
                  dark:border-gray-600
                  focus-visible:border-ring
                  focus-visible:ring-ring/50
                "
                placeholder="Repite la nueva contrasena"
                autoComplete="new-password"
                aria-invalid={Boolean(
                  form.formState.errors.confirmarPassword
                )}
                {...form.register("confirmarPassword")}
              />
            </div>

            {form.formState.errors.confirmarPassword && (
              <p className="text-xs text-destructive">
                {form.formState.errors.confirmarPassword.message}
              </p>
            )}
          </div>

          {/* Error general */}
          {errorMessage && (
            <p className="text-xs text-destructive">
              {errorMessage}
            </p>
          )}

          {/* Submit */}
          <Button
            className="w-full"
            type="submit"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Actualizando...
              </>
            ) : (
              "Actualizar contrasena"
            )}
          </Button>
        </form>

        <button
          type="button"
          onClick={onBackToLogin}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          Volver al inicio de sesion
        </button>
      </CardContent>
    </Card>
  );
}