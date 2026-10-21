import { useState } from "react";
import type { RefObject } from "react";
import { MessageSquare, Search, Shield, Users } from "lucide-react";
import type { AdminAgenteSoporte, AdminConversacion, AdminDisputa, AdminMensaje } from "@/services/admin.service";
import { EditorDocumentacion } from "@/features/help/EditorDocumentacion";

const CONVERSACIONES_POR_PAGINA = 25;
function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

export interface AdminSoporteTabProps {
  sectionRef: RefObject<HTMLElement | null>;
  isAdmin: boolean;
  conversations: AdminConversacion[];
  conversationsTotal: number;
  conversationSearch: string;
  onSearchChange: (value: string) => void;
  conversationPage: number;
  supportTeam: AdminAgenteSoporte[];
  disputes: AdminDisputa[];
  openConversation: AdminConversacion | null;
  conversationMessages: AdminMensaje[];
  isLoadingMessages: boolean;
  isSendingReply: boolean;
  onOpenConversation: (conversation: AdminConversacion) => void;
  onChangeAgentLevel: (userId: string, level: number) => void;
  onResolveDispute: (dispute: AdminDisputa) => void;
  onCloseConversation: () => void;
  onSendReply: (text: string) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export function AdminSoporteTab({ sectionRef, isAdmin, conversations, conversationsTotal, conversationSearch, onSearchChange, conversationPage, supportTeam, disputes, openConversation, conversationMessages, isLoadingMessages, isSendingReply, onOpenConversation, onChangeAgentLevel, onResolveDispute, onCloseConversation, onSendReply, onPreviousPage, onNextPage }: AdminSoporteTabProps) {
  const [supportReply, setSupportReply] = useState("");
  const [disputeResolution, setDisputeResolution] = useState("");
  return (
    <section ref={sectionRef} className="space-y-4 scroll-mt-6">      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div>
          <p className="flex items-center gap-2 text-base font-semibold">
            <MessageSquare className="h-4 w-4 text-primary dark:text-accent" />
            Soporte y gestión de incidentes
          </p>
          <p className="text-sm text-muted-foreground">
            Atiende dudas de compradores y media en incidentes con empresas importadoras. Puedes responder
            dentro de la conversación como equipo de la plataforma.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{conversationsTotal} conversaciones</span>
      </div>

      {/* Cada duda que se repite en los tickets debería acabar aquí: es lo
          que hace que el volumen de soporte baje en vez de crecer. */}
      <EditorDocumentacion />

      {/* La mesa: quién puede atender qué y cómo lo está haciendo. */}
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-primary dark:text-accent" />
            Mesa de soporte
          </p>
          <span className="text-xs text-muted-foreground">{supportTeam.length} agentes</span>
        </div>

        {supportTeam.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            Todavía no hay agentes. Créalos desde Usuarios con el rol «Atención al cliente».
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3">Agente</th>
                  <th className="py-2 pr-3">Nivel</th>
                  <th className="py-2 pr-3 text-right">Asignados</th>
                  <th className="py-2 pr-3 text-right">Cerrados</th>
                  <th className="py-2 pr-3 text-right">Calificación</th>
                </tr>
              </thead>
              <tbody>
                {supportTeam.map((agente) => (
                  <tr key={agente.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-foreground">
                        {agente.nombre || agente.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {agente.email}
                        {agente.activo ? "" : " · inactivo"}
                      </p>
                    </td>

                    <td className="py-2.5 pr-3">
                      {isAdmin ? (
                        <select
                          value={agente.nivel ?? 1}
                          onChange={(event) => {
                            onChangeAgentLevel(agente.id, Number(event.target.value));
                          }}
                          className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary dark:bg-card dark:text-foreground dark:focus:border-accent dark:focus:ring-accent [&>option]:bg-white [&>option]:text-black dark:[&>option]:bg-card dark:[&>option]:text-white"
                        >
                          <option value={1}>Nivel 1</option>
                          <option value={2}>Nivel 2</option>
                          <option value={3}>Nivel 3</option>
                        </select>
                      ) : (
                        <span className="text-xs text-foreground">
                          Nivel {agente.nivel ?? 1}
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 pr-3 text-right">
                      {agente.tickets_asignados}
                    </td>

                    <td className="py-2.5 pr-3 text-right">
                      {agente.tickets_cerrados}
                    </td>

                    <td className="py-2.5 pr-3 text-right">
                      {agente.calificacion_promedio !== null &&
                      agente.calificacion_promedio !== undefined ? (
                        <span className="font-medium">
                          ★ {agente.calificacion_promedio.toFixed(1)}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            ({agente.calificaciones_recibidas})
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Sin calificar
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Los incidentes son lo urgente: van primero y con acción, no como una
          cifra suelta en el resumen. */}
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Shield className="h-4 w-4 text-amber-600 dark:text-accent" />
            Incidentes abiertos
          </p>
          <span className="text-xs text-muted-foreground">{disputes.length} sin resolver</span>
        </div>

        {disputes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            No hay incidentes abiertos.
          </p>
        ) : (
          <div className="space-y-2">
            {disputes.map((dispute) => (
              <div key={dispute.id} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Operación {dispute.id.slice(0, 8).toUpperCase()} · estado {dispute.estado}
                    </p>
                    <p className="mt-0.5 text-xs text-amber-900">{dispute.motivo_disputa || "Sin motivo indicado"}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Reportado el {formatDate(dispute.fecha_actualizacion)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onResolveDispute(dispute)}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                  >
                    Resolver
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={conversationSearch}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar por cotizante, asesor o empresa..."
              className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-sm"
            />
          </div>
          {conversationSearch ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Limpiar
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3">Cotizante</th>
                <th className="py-2 pr-3">Empresa / asesor</th>
                <th className="py-2 pr-3">Último mensaje</th>
                <th className="py-2 pr-3 text-right">Mensajes</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {conversations.map((conversation) => (
                <tr key={conversation.id} className="border-b border-border/60 align-top hover:!bg-muted dark:hover:!bg-muted">
                  <td className="py-3 pr-3">
                    {conversation.tipo === "interna" ? (
                      <span className="inline-flex rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:!bg-accent/20">
                        Canal interno de empresa
                      </span>
                    ) : (
                      <>
                        <p className="font-medium text-foreground">{conversation.solicitante_nombre || "Sin nombre"}</p>
                        <p className="text-xs text-muted-foreground">
                          {conversation.solicitante_email || conversation.solicitante_id}
                        </p>
                      </>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <p className="font-medium text-foreground">{conversation.empresa_nombre || "Empresa no identificada"}</p>
                    <p className="text-xs text-muted-foreground">
                      {conversation.importador_usuario_nombre || conversation.importador_usuario_email || conversation.importador_usuario_id}
                    </p>
                  </td>
                  <td className="py-3 pr-3">
                    <p className="line-clamp-2 max-w-sm text-xs text-muted-foreground">
                      {conversation.ultimo_mensaje_texto || "Sin mensajes"}
                    </p>
                    {conversation.ultimo_mensaje_fecha  ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                        {new Date(conversation.ultimo_mensaje_fecha).toLocaleString("es-CO")}
                      </p>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3 text-right font-medium">{conversation.total_mensajes}</td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenConversation(conversation);
                      }}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium bg-primary dark:bg-accent hover:!border-primary dark:hover:!border-accent !text-white dark:!text-black hover:!bg-primary dark:hover:!bg-accent hover:opacity-80"
                    >
                      Ver conversación
                    </button>
                  </td>
                </tr>
              ))}
              {conversations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No hay conversaciones que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {conversationsTotal > CONVERSACIONES_POR_PAGINA ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              {conversationPage * CONVERSACIONES_POR_PAGINA + 1}–
              {Math.min((conversationPage + 1) * CONVERSACIONES_POR_PAGINA, conversationsTotal)} de {conversationsTotal}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={conversationPage === 0}
                onClick={() => onPreviousPage()}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40"
              >
                Anteriores
              </button>
              <button
                type="button"
                disabled={(conversationPage + 1) * CONVERSACIONES_POR_PAGINA >= conversationsTotal}
                onClick={() => onNextPage()}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40"
              >
                Siguientes
              </button>
            </div>
          </div>
        ) : null}
      </div>    </section>
  );
}


