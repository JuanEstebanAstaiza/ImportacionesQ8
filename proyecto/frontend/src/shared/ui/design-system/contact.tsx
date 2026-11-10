import { Mail as MailIcon, MessageCircle } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";
import { Button } from "./primitives";
import type { ContactType } from "@/types/design-system";

export function ContactBtn({ type, size = "sm", label, className, onClick, disabled, title }: { type: ContactType; size?: "sm" | "md"; label?: string; className?: string; onClick?: () => void; disabled?: boolean; title?: string }) {
  const config = {
    chat: { icon: MessageCircle, defaultLabel: "Chat", cls: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100" },
    email: { icon: MailIcon, defaultLabel: "Correo", cls: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50" },
  }[type];
  const Icon = config.icon;
  return <Button variant="secondary" size={size} icon={<Icon className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />} className={clsx(config.cls, className)} onClick={onClick} disabled={disabled} title={title}>{label || config.defaultLabel}</Button>;
}

export function openSmartContact({ type, email, onOpenChat }: { type: ContactType; email?: string | null; onOpenChat?: () => void }) {
  if (type === "chat") {
    if (onOpenChat) {
      onOpenChat();
      return;
    }
    toast.error("No hay chat disponible para esta conversación.");
    return;
  }
  const normalizedEmail = String(email || "").trim();
  if (normalizedEmail) {
    window.open(`mailto:${normalizedEmail}`, "_blank", "noopener,noreferrer");
    return;
  }
  toast.error("No hay correo disponible para este contacto.");
}
