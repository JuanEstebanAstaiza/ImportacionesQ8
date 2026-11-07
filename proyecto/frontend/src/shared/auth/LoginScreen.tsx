import type { UserRole } from "@/types/roles";
import type { LegalPage } from "@shared/legal/types";
import { AuthScreen } from "@shared/auth/components/AuthScreen";
import { Logo } from "@shared/ui/design-system";

export function LoginScreen({ onLogin, onRegister, onLanding, onPolicy, initialEmail }: {
  onLogin: (role: UserRole | "admin") => void;
  onRegister: () => void;
  onLanding: () => void;
  onPolicy: (page: LegalPage) => void;
  initialEmail?: string;
}) {
  return <AuthScreen onLogin={onLogin} onRegister={onRegister} onLanding={onLanding} onPolicy={onPolicy} logo={<Logo />} initialEmail={initialEmail} />;
}
