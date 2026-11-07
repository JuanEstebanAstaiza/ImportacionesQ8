import type React from "react";
import { useEffect, useId } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";

export function Modal({open,onClose,title,children,width="max-w-lg"}:{open:boolean;onClose:()=>void;title:string;children:React.ReactNode;width?:string}) {
  const tituloId = useId();
  // Escape cierra, como en cualquier diálogo.
  useEffect(() => {
    if (!open) return;
    const alPulsar = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [open, onClose]);
  if(!open)return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.35)"}}>
      <div role="dialog" aria-modal="true" aria-labelledby={tituloId} className={clsx("bg-white rounded-2xl border border-border shadow-2xl w-full flex flex-col max-h-[90vh]",width)}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 id={tituloId} className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="w-4 h-4"/></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
