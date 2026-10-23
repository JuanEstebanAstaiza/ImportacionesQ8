import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Button, Input } from "@/components/design-system";
import { Modal } from "@/components/ui/Modal";
export type UrgenciaSoporte = "baja" | "media" | "alta" | "critica";
export const URGENCIA_SOPORTE: Record<UrgenciaSoporte, { label: string; clase: string; peso: number }> = {
  critica: { label: "Crítica", clase: "bg-red-100 text-red-800 border-red-200", peso: 4 },
  alta: { label: "Alta", clase: "bg-orange-100 text-orange-800 border-orange-200", peso: 3 },
  media: { label: "Media", clase: "bg-amber-100 text-amber-800 border-amber-200", peso: 2 },
  baja: { label: "Baja", clase: "bg-slate-100 text-slate-700 border-slate-200", peso: 1 },
};
export function SoporteModal({open,onClose,onSubmit}:{open:boolean;onClose:()=>void;onSubmit:(datos:{asunto:string;urgencia:UrgenciaSoporte;mensaje:string})=>Promise<void>}) {
  const [asunto,setAsunto]=useState("");
  const [urgencia,setUrgencia]=useState<UrgenciaSoporte>("media");
  const [mensaje,setMensaje]=useState("");
  const [enviando,setEnviando]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    if(open){
      setAsunto("");setUrgencia("media");setMensaje("");setError("");
    }
  },[open]);

  async function enviar(){
    if(asunto.trim().length<5){
      setError("Describe el asunto en al menos 5 caracteres.");
      return;
    }
    setError("");
    setEnviando(true);
    try{
      await onSubmit({asunto:asunto.trim(),urgencia,mensaje:mensaje.trim()});
    }catch(err){
      setError(err instanceof Error?err.message:"No se pudo abrir la solicitud.");
    }finally{
      setEnviando(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Pedir soporte técnico">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Abre una conversación con el equipo de Zarpi. Se atiende por urgencia, así que
          marca la que corresponda de verdad.
        </p>
        <Input
          label="Asunto"
          placeholder="Ej. No puedo subir el packing list de mi operación"
          value={asunto}
          onChange={e=>setAsunto(e.target.value)}
        />
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Urgencia</label>
          <div className="grid grid-cols-4 gap-2">
            {(["baja","media","alta","critica"] as UrgenciaSoporte[]).map((nivel)=>(
              <button
                key={nivel}
                type="button"
                onClick={()=>setUrgencia(nivel)}
                className={clsx(
                  "rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                  urgencia===nivel?URGENCIA_SOPORTE[nivel].clase:"bg-white border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {URGENCIA_SOPORTE[nivel].label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Cuéntanos qué pasa (opcional)</label>
          <textarea
            value={mensaje}
            onChange={e=>setMensaje(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Qué intentabas hacer, qué viste y desde qué pantalla."
            className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        {error&&<p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={enviando} onClick={()=>{void enviar();}}>Enviar solicitud</Button>
        </div>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------------------------------
// APP HEADER
// ----------------------------------------------------------------------------------------------------


