import { X } from "lucide-react";
import type { ExpedienteVerificacion } from "@/services/admin.service";

type Props = {
  expediente: ExpedienteVerificacion | null; cargando: boolean; motivoRetiro: string; procesando: boolean;
  onMotivoChange: (value: string) => void; onClose: () => void;
  onVerify: (companyId: string) => void; onRevoke: (companyId: string) => void;
};

export function VerificationExpedienteModal({ expediente, cargando, motivoRetiro, procesando, onMotivoChange, onClose, onVerify, onRevoke }: Props) {
  if (!expediente && !cargando) {
    return null;
  }

  return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
    <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="text-base font-semibold">
            {cargando ? "Cargando expediente…" : `Verificación de ${expediente?.nombre_empresa}`}
          </h2>
          <p className="text-xs text-muted-foreground">
            Qué se puede comprobar desde la plataforma antes de avalar a esta empresa.
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

      {expediente ? (
        <>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {expediente.verificado ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Esta empresa lleva el sello de socio verificado.
              </div>
            ) : expediente.listo_para_verificar ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Cumple los {expediente.obligatorios_totales} requisitos obligatorios. La decisión final es tuya.
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">Todavía no se puede verificar.</p>
                <p className="mt-1">Falta: {expediente.pendientes.join(" · ")}</p>
              </div>
            )}

            {[
              {
                titulo: "Obligatorios",
                nota: "Sin esto la empresa no puede operar bien en la plataforma.",
                lista: expediente.obligatorios,
                cumplidos: expediente.obligatorios_cumplidos,
                total: expediente.obligatorios_totales,
              },
              {
                titulo: "Recomendables",
                nota: "Hablan de una empresa con recorrido. No impiden verificar.",
                lista: expediente.recomendables,
                cumplidos: expediente.recomendables_cumplidos,
                total: expediente.recomendables_totales,
              },
            ].map((grupo) => (
              <div key={grupo.titulo}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">{grupo.titulo}</p>
                  <span className="text-xs text-muted-foreground">
                    {grupo.cumplidos} de {grupo.total}
                  </span>
                </div>
                <p className="mb-2 text-xs text-muted-foreground">{grupo.nota}</p>
                <div className="space-y-1.5">
                  {grupo.lista.map((requisito) => (
                    <div
                      key={requisito.clave}
                      className={`flex items-start gap-2.5 rounded-lg border p-2.5 ${
                        requisito.cumple ? "border-emerald-200 bg-emerald-50/50" : "border-border bg-muted/30"
                      }`}
                    >
                      <span className={`mt-0.5 text-sm ${requisito.cumple ? "text-emerald-600" : "text-muted-foreground/50"}`}>
                        {requisito.cumple ? "✓" : "○"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{requisito.titulo}</p>
                        <p className="text-xs text-muted-foreground">{requisito.detalle}</p>
                      </div>
                      <span className="max-w-[40%] text-right text-xs text-muted-foreground">
                        {requisito.valor}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              Esta lista solo cubre lo que consta en la plataforma. La comprobación del registro
              mercantil, las referencias comerciales y cualquier documentación legal siguen siendo
              tuyas: el sello dice que respondes por esta empresa.
            </p>
          </div>

          <div className="space-y-2 border-t border-border p-3">
            {expediente.verificado ? (
              <>
                <textarea
                  value={motivoRetiro}
                  onChange={(event) => onMotivoChange(event.target.value)}
                  rows={2}
                  placeholder="Motivo para retirar el sello (se le comunica a la empresa)…"
                  className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={procesando || motivoRetiro.trim().length < 5}
                  onClick={() => {
                    void onRevoke(expediente.importador_id);
                  }}
                  className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-40"
                >
                  {procesando ? "Retirando…" : "Retirar verificación"}
                </button>
                <p className="text-[11px] text-muted-foreground">
                  Retirar el sello no desactiva la empresa: sigue operando, pero deja de estar avalada.
                </p>
              </>
            ) : (
              <button
                type="button"
                disabled={procesando || !expediente.listo_para_verificar}
                onClick={() => {
                  void onVerify(expediente.importador_id);
                }}
                className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {procesando ? "Verificando…" : "Verificar empresa"}
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
      )}
    </div>
  </div>
  );
}
