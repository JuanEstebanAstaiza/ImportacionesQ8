import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Eye, EyeOff, Info, Loader2, LogIn, Mail, Lock, UserRound, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { cn } from "@/app/components/ui/utils";
import type { BackendAuthRole } from "@/types/auth";

const loginSchema = z.object({
  email: z.string().email("Ingresa un correo valido."),
  password: z.string().min(1, "La contraseña es requerida."),
});

export type LoginFormValues = z.infer<typeof loginSchema> & { rol?: BackendAuthRole };
export type PortalRole = "solicitante" | "importadora" | "asesor";

interface LoginFormProps {
  onSubmit: (values: LoginFormValues) => void;
  onForgotPassword: () => void;
  onRegister: () => void;
  onLanding: () => void;
  isPending: boolean;
  errorMessage?: string;
  initialEmail?: string;
}

// El backend guarda "importador", no "importadora": este selector es la única
// pantalla donde ese desajuste de nombres tiene que traducirse antes de viajar.
const ROLE_OPTIONS: Array<{ role: PortalRole; backendRole: BackendAuthRole; label: string; icon: React.ReactNode }> = [
  { role: "solicitante", backendRole: "solicitante", label: "Solicitante", icon: <UserRound className="h-4 w-4" /> },
  { role: "importadora", backendRole: "importador", label: "Importadora", icon: <Building2 className="h-4 w-4" /> },
  { role: "asesor", backendRole: "asesor", label: "Asesor", icon: <Users className="h-4 w-4" /> },
];

export function LoginForm({
  onSubmit,
  onForgotPassword,
  onRegister,
  onLanding,
  isPending,
  errorMessage,
  initialEmail,
}: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<PortalRole>("solicitante");

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (!initialEmail) {
      return;
    }

    form.setValue("email", initialEmail, { shouldDirty: true, shouldValidate: true });
  }, [initialEmail, form]);

  function handleSubmit(values: LoginFormValues) {
    const backendRole = ROLE_OPTIONS.find((option) => option.role === selectedRole)?.backendRole;
    onSubmit({
      email: String(values.email ?? "").trim(),
      password: String(values.password ?? ""),
      rol: backendRole,
    });
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-xl font-semibold tracking-tight">Iniciar sesion</CardTitle>
        <CardDescription>Selecciona tu rol y accede a tu portal</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Acceder como</p>
          <div className="grid grid-cols-3 gap-2">
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.role}
                type="button"
                onClick={() => setSelectedRole(option.role)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                  selectedRole === option.role
                    ? "border-primary bg-primary/20 text-primary dark:border-accent dark:bg-accent/10 dark:text-accent"
                    : "border-border text-muted-foreground hover:border-primary/40 dark:hover:border-accent/40"
                )}
              >
                {option.icon}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        <form className="space-y-4" noValidate onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="login-email">Correo electronico</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="login-password">Contraseña</Label>
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-xs font-medium text-primary dark:text-accent hover:underline"
              >
                Olvidaste tu contraseña?
              </button>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="pl-9 pr-9"
                placeholder="••••••••"
                aria-invalid={Boolean(form.formState.errors.password)}
                {...form.register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-2.5 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>

          {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}

          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-primary text-white hover:bg-primary dark:bg-accent dark:text-black dark:hover:bg-accent/70 transition-colors"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Validando...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Ingresar
              </>
            )}
          </Button>
        </form>

        <div className="space-y-1 text-center text-xs text-muted-foreground">
          <p>
            No tienes cuenta?{"  "}
            <button type="button" onClick={onRegister} className="text-primary dark:text-accent hover:underline">
              Registrate gratis
            </button>
          </p>
          <button type="button" onClick={onLanding} className="hover:text-foreground">
            Volver a la pagina principal
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
