import { ResetPasswordForm } from "@shared/auth/components/ResetPasswordForm";
import { PublicSicLogo } from "@/components/navigation/PublicSicLogo";
import { Logo } from "@shared/ui/design-system";

export function ResetPasswordScreen({ token, onBackToLogin }: { token: string; onBackToLogin: () => void }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-white px-6 py-3.5"><Logo /></header>
      <main className="flex flex-1 items-center justify-center px-4 py-10"><div className="w-full max-w-[420px]"><ResetPasswordForm token={token} onBackToLogin={onBackToLogin} /></div></main>
      <footer className="flex justify-center border-t border-border bg-background py-4"><PublicSicLogo /></footer>
    </div>
  );
}
