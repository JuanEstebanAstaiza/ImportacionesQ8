import { useState } from "react";
import { ShoppingCart, ChevronRight, Send, ClipboardList, MessageSquare, Zap } from "lucide-react";
import { clsx } from "clsx";

import { Quote } from "@/types/quote";

import { SidebarCtrl } from "@/types/portal";

import { Breadcrumb } from "@/components/navigation/Breadcrumb";

import type { LegalPage } from "@/features/legal/types";

import { Badge, Button, Card } from "@/components/design-system";

// De este archivo ya solo se usan las buenas prácticas por rol: la FAQ vive
// ahora en la base de datos, mantenida por el equipo de soporte.

import { RUTA_RESTABLECER, type Screen } from "@/app/rutas";

const RESET_PASSWORD_PATH = RUTA_RESTABLECER;
/** Producto de Tendencias que un visitante quiso cotizar antes de registrarse. */
const CLAVE_PREFILL_PENDIENTE = "zarpi:prefill-pendiente";
/** Pantalla (y por tanto URL) de cada documento legal. */
const PANTALLA_LEGAL: Record<LegalPage, Screen> = {
  data: "policy-data",
  terms: "policy-terms",
  payments: "policy-payments",
  planes: "policy-planes",
};

import { Sidebar, AppHeader } from "@/app/App";

export function AdvisorDashboardScreen({sb,availableCount,quotes,headerUser,responsesSentCount,activeChatsCount,onOpenInternalChat}:{sb:SidebarCtrl;availableCount:number;quotes:Quote[];headerUser:{name:string;company:string;initials:string};responsesSentCount:number;activeChatsCount:number;onOpenInternalChat:()=>Promise<void>}) {
  const [errorCanal,setErrorCanal]=useState("");
  const myQuotesCount = quotes.length;
  const activeOrdersCount = quotes.filter(q=>q.status==="active-order").length;
  const recentQuotes = quotes.slice(0,3);
  const metrics=[
    {label:"Cotizaciones disponibles",value:availableCount.toString(),icon:<Zap className="w-5 h-5"/>,color:"text-amber-600",bg:"bg-amber-50"},
    {label:"Mis cotizaciones",value:myQuotesCount.toString(),icon:<ClipboardList className="w-5 h-5"/>,color:"text-blue-600",bg:"bg-blue-50"},
    {label:"Respuestas enviadas",value:responsesSentCount.toString(),icon:<Send className="w-5 h-5"/>,color:"text-emerald-600",bg:"bg-emerald-50"},
    {label:"Chats activos",value:activeChatsCount.toString(),icon:<MessageSquare className="w-5 h-5"/>,color:"text-purple-600",bg:"bg-purple-50"},
    {label:"Operaciones en seguimiento",value:activeOrdersCount.toString(),icon:<ShoppingCart className="w-5 h-5"/>,color:"text-cyan-600",bg:"bg-cyan-50"},
  ];
  const activity:{text:string;time:string}[]=[];
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar {...sb} active="adv-dashboard"/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={headerUser} sb={sb}/>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div>
            <Breadcrumb items={[{label:"Inicio",onClick:()=>sb.onNav("adv-dashboard")},{label:"Mi dashboard"}]}/>
            <div className="flex items-start justify-between gap-4 flex-wrap mt-3">
              <div>
                <h1 className="text-xl font-semibold">Panel del asesor</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{headerUser.company}</p>
              </div>
              {/* Canal privado con la empresa: por aquí llegan las instrucciones
                  de cuándo mover el estado de cada orden. */}
              <Button variant="secondary" size="sm" icon={<MessageSquare className="w-3.5 h-3.5"/>}
                onClick={()=>{void onOpenInternalChat().catch((err)=>setErrorCanal(err instanceof Error?err.message:"No se pudo abrir el canal."));}}>
                Canal con mi empresa
              </Button>
            </div>
            {errorCanal&&<p className="text-xs text-destructive mt-2">{errorCanal}</p>}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {metrics.map((m,i)=>(
              <Card key={i} padding="md" className="metric-card flex items-start gap-3">
                <div className={clsx("metric-icon w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 dark:!bg-accent/24",m.bg,m.color)}>{m.icon}</div>
                <div className="min-w-0">
                  <p className="text-xl font-bold text-foreground leading-none">{m.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{m.label}</p>
                </div>
              </Card>
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <Card padding="none">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-sm">Mis cotizaciones recientes</h2>
                <Button variant="ghost" size="sm" iconRight={<ChevronRight className="w-3.5 h-3.5"/>} onClick={()=>sb.onNav("adv-my-quotes")}>Ver todas</Button>
              </div>
              {recentQuotes.map(q=>(
                <div key={q.id} className="flex items-center gap-3 px-5 py-3 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{q.product}</p>
                    <p className="text-xs text-muted-foreground">{q.code} · {q.date}</p>
                  </div>
                  <Badge variant={q.status as BadgeVariant}/>
                </div>
              ))}
              {recentQuotes.length===0&&<div className="px-5 py-8 text-sm text-muted-foreground text-center">Sin cotizaciones asignadas.</div>}
            </Card>
            <Card padding="none">
              <div className="px-5 py-4 border-b border-border"><h2 className="font-semibold text-sm">Actividad reciente</h2></div>
              <div className="px-5 py-4 space-y-3">
                {activity.map((a,i)=>(
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"/>
                    <div><p className="text-sm">{a.text}</p><p className="text-xs text-muted-foreground">{a.time}</p></div>
                  </div>
                ))}
                {activity.length===0&&<p className="text-xs text-muted-foreground">Sin actividad reciente disponible en API.</p>}
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVISOR PORTAL — AVAILABLE QUOTES (Uber style)
// ─────────────────────────────────────────────────────────────────────────────
/** La empresa todavía puede rechazar la cotización: no hay orden ni rechazo previo. */