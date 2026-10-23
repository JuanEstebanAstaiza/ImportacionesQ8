import { Bell, ChevronLeft } from "lucide-react";
import { clsx } from "clsx";

import { AppHeader } from "@/components/layout/AppHeader";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button, Card } from "@/components/design-system";
import type { SidebarCtrl } from "@/types/portal";
import { NOTIF_ICON } from "@/features/notifications/constants.tsx";
import type { AppNotification } from "@/features/notifications/types";

const DEFAULT_HEADER_USER = { name: "Ana García", company: "Importaciones del Norte S.A.", initials: "AG" };

export function NotificationsScreen({onOpen,onBack,sb,notifications,onMark}:{onOpen:(notification:AppNotification)=>Promise<void>;onBack:()=>void;sb:SidebarCtrl;notifications:AppNotification[];onMark:(id:string)=>void}) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="notifications"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={DEFAULT_HEADER_USER} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="sm" icon={<ChevronLeft className="w-3.5 h-3.5"/>} onClick={onBack}>Volver</Button>
            <div>
              <h1 className="text-xl font-semibold">Notificaciones</h1>
              <p className="text-sm text-muted-foreground">{notifications.filter(n=>!n.read).length} sin leer</p>
            </div>
          </div>
          <Card padding="none" className="divide-y divide-border">
            {notifications.length===0&&(
              <div className="px-5 py-10 text-center">
                <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2"/>
                <p className="text-sm font-medium">No tienes notificaciones pendientes</p>
                <p className="text-xs text-muted-foreground mt-1">Cuando haya cambios en cotizaciones, propuestas, chats u operaciones aparecerán aquí.</p>
              </div>
            )}
            {notifications.map(n=>(
              <button key={n.id} type="button" onClick={()=>{onMark(n.id);void onOpen(n);}} className={clsx("w-full text-left flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-primary/5 dark:hover:bg-accent/10 transition-colors",!n.read&&"bg-primary/5 dark:bg-accent/10")}>
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">{NOTIF_ICON[n.type]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={clsx("text-sm",!n.read?"font-semibold text-primary dark:text-accent":"font-medium text-foreground/80")}>{n.title}</p>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{n.date}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                </div>
                {!n.read&&<span className="w-2 h-2 rounded-full bg-primary dark:bg-accent flex-shrink-0 mt-1.5"/>}
              </button>
            ))}
          </Card>
        </main>
      </div>
    </div>
  );
}
