import React from "react";
import { Check } from "lucide-react";
import { clsx } from "clsx";
import type { TimelineStage } from "@/types/design-system";

export function Timeline({ stages }: { stages: TimelineStage[] }) {
  return <div className="relative">
    <div className="absolute left-4 top-5 bottom-5 w-0.5 bg-border" />
    <div className="space-y-0">{stages.map((stage, index) => <div key={index} className="flex items-start gap-3 relative">
      <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 mt-0.5 transition-colors", stage.status === "done" ? "bg-primary border-primary text-primary-foreground dark:bg-accent dark:border-accent dark:text-accent-foreground" : stage.status === "current" ? "bg-card border-primary text-primary ring-4 ring-primary/15 dark:border-accent dark:text-accent dark:ring-accent/20" : "bg-card border-border text-muted-foreground/50")}>
        {stage.status === "done" ? <Check className="w-3.5 h-3.5" /> : stage.icon}
      </div>
      <div className={clsx("pb-5 min-w-0 flex-1", index === stages.length - 1 && "pb-0")}>
        <div className="flex items-center justify-between gap-2">
          <p className={clsx("text-sm font-medium", stage.status === "pending" ? "text-muted-foreground" : "text-foreground")}>{stage.label}</p>
          {stage.date && <span className={clsx("text-xs flex-shrink-0", stage.status === "pending" ? "text-muted-foreground/60" : "text-muted-foreground")}>{stage.date}</span>}
        </div>
        {stage.status === "current" && <p className="text-xs font-medium mt-0.5 text-primary dark:text-accent">En curso</p>}
      </div>
    </div>)}</div>
  </div>;
}

export function NotifIcon({ icon, count = 0, onClick, title }: { icon: React.ReactNode; count?: number; onClick?: () => void; title?: string }) {
  return <div className="relative">
    <button onClick={onClick} title={title} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">{icon}</button>
    {count > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none pointer-events-none">{count > 9 ? "9+" : count}</span>}
  </div>;
}
