import { useEffect, useRef, useState } from "react";
import { Bell, HelpCircle, Info, MessageCircle, Moon, Sun, WalletCards } from "lucide-react";

import { Avatar, NotifIcon } from "@/components/design-system";
import { useAuth } from "@/hooks/useAuth";
import type { SidebarCtrl } from "@/types/portal";
import { resolveApiUrl } from "@/services/api-client";
import { useBrandTheme } from "@/app/hooks/useBrandTheme";

function initialsFromName(name: string): string {
  const words = (name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

export function AppHeader({ user, notifCount = 0, onNotif, onProfile, sb }: { user: { name: string; company: string; initials: string; photoUrl?: string }; notifCount?: number; onNotif?: () => void; onProfile?: () => void; sb?: SidebarCtrl }) {
  const { dark, toggleTheme } = useBrandTheme();
  const { user: authUser } = useAuth();
  
  // Estado para el popover de créditos
  const [showCreditosModal, setShowCreditosModal] = useState(false);
  const creditosRef = useRef<HTMLDivElement>(null);

  const count = sb?.notifCount ?? notifCount;
  const handler = sb?.onNotif ?? onNotif;
  const profileHandler = sb?.onProfile ?? onProfile;
  const chatHandler = sb?.onChat;
  const helpHandler = sb?.onHelp;
  const chatCount = sb?.chatCount ?? 0;
  const showHelp = sb?.showHelp ?? true;
  const displayName = authUser?.nombre?.trim() || authUser?.email || user.name;
  const displayCompany = sb?.profileSubtitle || user.company || authUser?.email || "";
  const initialsSource = authUser?.nombre?.trim() || authUser?.email || user.name;
  const displayInitials = initialsFromName(initialsSource);
  const authUserPhoto = (authUser as { foto_url?: string | null } | null)?.foto_url || "";
  const displayPhotoUrl = authUserPhoto || sb?.profilePhotoUrl || user.photoUrl || "";
  const creditos = Number((authUser as { puntos_cotizacion?: number } | null)?.puntos_cotizacion ?? 0);

  // Cierre automático al hacer clic fuera del badge/popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (creditosRef.current && !creditosRef.current.contains(event.target as Node)) {
        setShowCreditosModal(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-[57px] flex items-center justify-between px-5 bg-white border-b border-border flex-shrink-0 relative">
      {/* LADO IZQUIERDO: BADGE Y POPOVER DE CRÉDITOS */}
      <div className="flex items-center">
        {authUser?.rol === "solicitante" && (
          <div className="relative" ref={creditosRef}>
            <button
              type="button"
              onClick={() => setShowCreditosModal((prev) => !prev)}
              onMouseEnter={() => setShowCreditosModal(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold text-primary transition-all duration-200 hover:border-primary/40 hover:shadow-sm dark:border-accent/30 dark:text-accent dark:hover:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <WalletCards className="h-3.5 w-3.5 animate-pulse" />
              <span>{creditos} créditos</span>
            </button>

            {/* Popover animado */}
            {showCreditosModal && (
              <div 
                className="absolute left-0 top-full mt-2.5 w-72 z-50 rounded-2xl border border-border bg-card p-4 shadow-xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-accent/10 dark:text-accent">
                    <WalletCards className="h-4 w-4" />
                  </div>
                  <div className="space-y-1 text-left">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-foreground">Créditos disponibles</p>
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary dark:bg-accent/20 dark:text-accent">
                        {creditos}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong>1 crédito</strong> te permite enviar una cotización a empresas de categorías superiores (Plata, Oro, etc.).
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Info className="h-3 w-3 text-primary dark:text-accent" /> Se descuentan por solicitud
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCreditosModal(false)}
                    className="font-medium text-primary hover:underline dark:text-accent"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* LADO DERECHO */}
      <div className="flex items-center gap-1">
        <div className="relative">
          <button onClick={handler} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            <Bell className="w-4 h-4"/>
          </button>
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none pointer-events-none">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </div>

        <NotifIcon icon={<MessageCircle className="w-4 h-4"/>} count={chatCount} onClick={chatHandler} title="Ir a chats"/>

        {showHelp && <NotifIcon icon={<HelpCircle className="w-4 h-4"/>} count={0} onClick={helpHandler} title="Ayuda y soporte"/>}

        <button
          onClick={toggleTheme}
          title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          aria-label={dark ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground dark:hover:bg-accent dark:hover:text-accent-foreground active:bg-primary/90 dark:active:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {dark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
        </button>

        <div className="w-px h-5 bg-border mx-2"/>

        <div className="flex items-center gap-2.5">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-foreground leading-tight">{displayName}</p>
            <p className="text-xs text-muted-foreground leading-tight">{displayCompany}</p>
          </div>
          <button onClick={profileHandler} title="Editar perfil">
            <Avatar initials={displayInitials} size="md" src={displayPhotoUrl ? resolveApiUrl(displayPhotoUrl) : undefined}/>
          </button>
        </div>
      </div>
    </header>
  );
}

export const USER={name:"Ana García",company:"Importaciones del Norte S.A.",initials:"AG"};
export const USER_IMPORTADORA={name:"María López",company:"Grupo Nexus S.A.",initials:"ML"};
export const USER_ASESOR={name:"Carlos Mendoza",company:"Grupo Nexus S.A. ? Asesor",initials:"CM"};

// ----------------------------------------------------------------------------------------------------
// IMPORTER CARD ? used in Dashboard and profile screens
// ----------------------------------------------------------------------------------------------------
