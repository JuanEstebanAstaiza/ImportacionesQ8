import type { UserRole } from "@/types/roles";
import type { PortalRole } from "@shared/auth/components/LoginForm";
import type { LegalPage } from "@shared/legal/types";
import { AuthScreen } from "@shared/auth/components/AuthScreen";
import { Logo } from "@shared/ui/design-system";

export function LoginScreen({ onLogin, onRegister, onLanding, onPolicy, initialEmail, initialRole }: {
  onLogin: (role: UserRole | "admin") => void;
  onRegister: () => void;
  onLanding: () => void;
  onPolicy: (page: LegalPage) => void;
  initialEmail?: string;
  initialRole?: PortalRole;
}) {
  return <AuthScreen onLogin={onLogin} onRegister={onRegister} onLanding={onLanding} onPolicy={onPolicy} logo={<Logo />} initialEmail={initialEmail} initialRole={initialRole} />;
}
