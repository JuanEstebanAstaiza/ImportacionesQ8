import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";

const forgotSchema = z.object({
  email: z.string().email("Ingresa un correo valido."),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotSchema>;

interface ForgotPasswordFormProps {
  isSuccess: boolean;
  isPending: boolean;
  successEmail?: string;
  errorMessage?: string;
  onSubmit: (values: ForgotPasswordFormValues) => void;
  onBackToLogin: () => void;
}

export function ForgotPasswordForm({
  isSuccess,
  isPending,
  successEmail,
  errorMessage,
  onSubmit,
  onBackToLogin,
}: ForgotPasswordFormProps) {
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  if (isSuccess) {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-xl font-semibold tracking-tight">Correo enviado</CardTitle>
          <CardDescription>
            Revisa tu bandeja en <span className="font-medium text-foreground">{successEmail || "tu correo"}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <div className="flex justify-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <Button type="button" variant="secondary" onClick={onBackToLogin} className="w-full">
            Volver al inicio de sesion
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-xl font-semibold tracking-tight">Recuperar acceso</CardTitle>
        <CardDescription>Te enviaremos un enlace a tu correo</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Correo electronico</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="forgot-email"
                type="email"
                className="pl-9"
                placeholder="correo@empresa.com"
                aria-invalid={Boolean(form.formState.errors.email)}
                {...form.register("email")}
              />
            </div>
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}

          <Button className="w-full" type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar enlace"
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
