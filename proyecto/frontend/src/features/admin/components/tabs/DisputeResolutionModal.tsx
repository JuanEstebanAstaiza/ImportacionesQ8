import { X } from "lucide-react";
import type { AdminDisputa } from "@/services/admin.service";

type Props = {
  dispute: AdminDisputa; resolution: string; isResolving: boolean;
  onResolutionChange: (value: string) => void; onClose: () => void; onResolve: () => void;
};

export function DisputeResolutionModal({ dispute, resolution, isResolving, onResolutionChange, onClose, onResolve }: Props) {
  return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
    <div className="w-full max-w-lg rounded-xl border border-border bg-white p-5 shadow-2xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Resolver incidente</h2>
          <p className="text-xs text-muted-foreground">
            Operación {dispute.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onClose();
          }}
          className="rounded-md border border-border p-1.5 hover:bg-muted"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <p className="font-medium">Motivo reportado</p>
        <p className="mt-1">{dispute.motivo_disputa || "Sin motivo indicado"}</p>
      </div>

      <textarea
        value={resolution}
        onChange={(event) => onResolutionChange(event.target.value)}
        rows={4}
        placeholder="Qué se hizo para resolverlo. Queda registrado en la operación y en la sala del incidente."
        className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm"
      />

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            onClose();
          }}
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={isResolving || resolution.trim().length < 5}
          onClick={() => {
            void onResolve();
          }}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {isResolving ? "Resolviendo…" : "Marcar como resuelto"}
        </button>
      </div>
    </div>
  </div>
  );
}
