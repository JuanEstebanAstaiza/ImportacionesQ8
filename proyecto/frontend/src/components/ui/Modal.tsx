import type React from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";

export function Modal({open,onClose,title,children,width="max-w-lg"}:{open:boolean;onClose:()=>void;title:string;children:React.ReactNode;width?:string}) {
  if(!open)return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.35)"}}>
      <div className={clsx("bg-white rounded-2xl border border-border shadow-2xl w-full flex flex-col max-h-[90vh]",width)}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="w-4 h-4"/></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
