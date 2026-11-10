import { X } from "lucide-react";
import type { AdminConversacion, AdminMensaje } from "@/services/admin.service";

type Props = {
  conversation: AdminConversacion; messages: AdminMensaje[]; isLoadingMessages: boolean;
  isSendingReply: boolean; supportReply: string; onReplyChange: (value: string) => void;
  onClose: () => void; onSend: () => void;
};

export function ConversationDetailModal({ conversation, messages, isLoadingMessages, isSendingReply, supportReply, onReplyChange, onClose, onSend }: Props) {
  return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
    <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="text-base font-semibold">
            {conversation.solicitante_nombre || conversation.solicitante_email} · {conversation.empresa_nombre || "Empresa"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {/* Los hilos internos de una empresa no cuelgan de ninguna cotización. */}
            {conversation.cotizacion_id
              ? `Cotización ${conversation.cotizacion_id.slice(0, 8).toUpperCase()}`
              : "Canal interno de la empresa"}
            {conversation.orden_id ? ` · Operación ${conversation.orden_id.slice(0, 8).toUpperCase()}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border p-1.5 hover:!bg-primary hover:!text-white hover:!border-primary dark:hover:!bg-accent dark:hover:!text-black dark:hover:!border-accent"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoadingMessages ? (
          <p className="text-sm text-muted-foreground">Cargando conversación...</p>
        ) : null}
        {!isLoadingMessages && messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Esta conversación todavía no tiene mensajes.</p>
        ) : null}
        {messages.map((message) => {
          const esSolicitante = message.remitente_id === conversation.solicitante_id;
          return (
            <div
              key={message.id}
              className={`rounded-lg border p-3 ${
                message.tipo === "sistema"
                   ? "border-border bg-muted/50 dark:!border-border dark:!bg-muted/50"
                  : esSolicitante
                    ? "border-blue-100 bg-blue-50 dark:!border-primary/20 dark:!bg-primary/30"
                    : "border-emerald-100 bg-emerald-50 dark:!border-accent/20 dark:!bg-accent/20"
              }`}
            >
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {message.remitente_nombre || message.remitente_email || message.remitente_id}
                  {message.remitente_rol ? <span className="ml-1 font-normal text-muted-foreground">({message.remitente_rol})</span> : null}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(message.fecha_envio).toLocaleString("es-CO")}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">{message.contenido}</p>
            </div>
          );
        })}
      </div>

      <div className="space-y-2 border-t border-border p-3">
        <p className="text-[11px] text-muted-foreground">
          Lo que escribas aquí entra en el hilo como <strong>equipo de Zarpi</strong> y avisa a las dos
          partes. Consultar el hilo sin escribir no deja rastro.
        </p>
        <div className="flex items-end gap-2">
          <textarea
            value={supportReply}
            onChange={(event) => onReplyChange(event.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Responder como soporte…"
            className="flex-1 resize-none rounded-lg border border-border px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={isSendingReply || !supportReply.trim()}
            onClick={() => {
              void onSend();
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {isSendingReply ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  </div>
  );
}
