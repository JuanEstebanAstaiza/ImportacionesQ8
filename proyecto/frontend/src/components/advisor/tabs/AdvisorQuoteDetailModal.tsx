import { useState } from "react";
import { CheckCircle2, MessageCircle, ExternalLink, Tag, Receipt, Paperclip } from "lucide-react";

import { Quote } from "@/types/quote";

import type { LegalPage } from "@/features/legal/types";

import { Button, Card } from "@/app/components/design-system";

// De este archivo ya solo se usan las buenas prácticas por rol: la FAQ vive
// ahora en la base de datos, mantenida por el equipo de soporte.

import { type BackendPropuesta } from "@/services/business.service";

import { safeHttpUrl } from "@/utils/safe-url";
import { cantidadConUnidad } from "@/utils/formatos";

import { PerfilPublicoCotizanteCard } from "@/features/cotizante/PerfilPublicoCotizanteCard";
import { TierBadge } from "@/features/cotizante/TierBadge";

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

import { Modal, GaleriaFotosProducto, findCustomFieldValue, getQuoteAttachmentLinks } from "@/app/App";
import type { ChatConv } from "@/app/App";

export function AdvisorQuoteDetailModal({quote,open,onClose,onAccept,accepting,proposal,negotiationChat,onConfirmProposal,onOpenChat}:{quote:Quote|null;open:boolean;onClose:()=>void;onAccept?:()=>Promise<void>;accepting?:boolean;proposal?:BackendPropuesta;negotiationChat?:ChatConv;onConfirmProposal?:(propuestaId:string)=>Promise<void>;onOpenChat?:(conversationId:string)=>void}) {
  const [confirmingProposal, setConfirmingProposal] = useState(false);
  const [confirmationError, setConfirmationError] = useState("");
  if (!quote) {
    return null;
  }

  // Mismos campos, en el mismo orden, que el formulario que llena el
  // comprador (y que su propio detalle). Antes este modal mostraba una «ficha
  // técnica» con peso, volumen, dimensiones y destino —que el formulario no
  // pide, así que siempre decían «No especificado»— y se saltaba línea,
  // calidad, cantidad, precio objetivo y el link de referencia.
  const custom = quote.customFields;
  const peso = findCustomFieldValue(custom, ["peso", "weight"]);
  const volumen = findCustomFieldValue(custom, ["volumen", "volume", "cbm", "m3"]);
  const dimensiones = findCustomFieldValue(custom, ["dimension", "medida", "tamano", "size"]);
  const destino = findCustomFieldValue(custom, ["destino", "destination", "puerto_destino"]);
  const extras = [["Peso", peso], ["Volumen", volumen], ["Dimensiones", dimensiones], ["Destino", destino]].filter(([, v]) => v);
  const linkReferencia = safeHttpUrl(quote.referenceLink);
  const adjuntos = getQuoteAttachmentLinks(quote).filter((link) => link !== quote.referenceLink);
  const conMayuscula = (texto?: string | null) => (texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "");
  const proposito = quote.importMode === "corporativo" ? "Corporativo" : quote.importMode === "ecommerce" ? "Ecommerce" : conMayuscula(quote.importMode);
  const dato = (etiqueta: string, valor: React.ReactNode, clase = "") => (
    <div key={etiqueta} className={clase}>
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <div className="text-sm font-medium mt-0.5 whitespace-pre-line break-words">{valor || "—"}</div>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={`Detalle completo · ${quote.code}`} width="max-w-3xl">
      <div className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Card padding="sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Producto</p>
                <p className="mt-1 truncate text-sm font-semibold">{quote.product}</p>
              </div>
              <TierBadge tier={quote.solicitanteTier} />
            </div>
          </Card>
          <Card padding="sm">
            <p className="text-xs text-muted-foreground">Modalidad</p>
            <p className="text-sm font-semibold mt-1">{quote.mode}</p>
          </Card>
        </div>

        <Card padding="md">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Tag className="w-4 h-4 text-primary dark:text-accent"/>Información del producto</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
            {dato("Nombre", quote.product)}
            {dato("Línea", quote.productLine)}
            {dato("País de importación", quote.country)}
            {dato("Calidad", conMayuscula(quote.quality))}
            {dato("Personalización", quote.personalizationLevel)}
            {dato("Descripción", quote.description, "col-span-2 sm:col-span-3")}
            {linkReferencia && dato(
              "Link de referencia",
              <a href={linkReferencia} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary dark:text-accent hover:underline break-all">
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0"/>{quote.referenceLink}
              </a>,
              "col-span-2 sm:col-span-3",
            )}
          </div>
          {(quote.productPhotoUrls??[]).length>0&&(
            <div className="mt-4 pt-4 border-t border-border"><GaleriaFotosProducto fotos={quote.productPhotoUrls??[]}/></div>
          )}
        </Card>

        <Card padding="md">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Receipt className="w-4 h-4 text-primary dark:text-accent"/>Información comercial</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
            {dato("Propósito", proposito)}
            {dato("Cantidad", cantidadConUnidad(quote.minQuantity, quote.unit))}
            {dato("Ciudad de entrega", quote.deliveryCity)}
            {dato("Precio objetivo", quote.targetPrice && quote.targetPrice !== "N/A" ? quote.targetPrice : "Sin precio objetivo")}
            {dato("Incoterm", quote.incoterm)}
            {dato("Shipping mark", <span className="font-mono">{quote.shippingMark || quote.shippingMarkSufijo || "Sin marca"}</span>)}
            {extras.map(([k, v]) => dato(k, v))}
            {dato("Notas", quote.notes, "col-span-2 sm:col-span-3")}
          </div>
        </Card>

        <PerfilPublicoCotizanteCard solicitanteId={quote.requesterId} />

        {proposal?.estado==="pendiente" && proposal.preaceptada_por_solicitante && !proposal.preaceptada_por_empresa && onConfirmProposal && (
          <Card padding="md" className="border-amber-300 bg-amber-50 dark:border-accent/40 dark:!bg-accent/10">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-amber-700 dark:text-accent flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-900 dark:!text-accent">El comprador ya aceptó la propuesta</p>
                <p className="text-xs text-amber-800 dark:!text-accent mt-0.5">Revisa la negociación y confirma para crear la operación.</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {negotiationChat && onOpenChat && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<MessageCircle className="w-3.5 h-3.5" />}
                      onClick={() => onOpenChat(negotiationChat.id)}
                      className=" dark:!border-accent/40"
                    >
                      Ver negociación
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    loading={confirmingProposal}
                    onClick={() => {
                      setConfirmationError("");
                      setConfirmingProposal(true);
                      void onConfirmProposal(proposal.id)
                        .catch((error) => {
                          setConfirmationError(error instanceof Error ? error.message : "No se pudo confirmar la propuesta.");
                        })
                        .finally(() => setConfirmingProposal(false));
                    }}
                    className="dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/90"
                  >
                    Confirmar y crear operación
                  </Button>
                </div>
                {confirmationError && <p role="alert" className="text-xs text-destructive mt-2">{confirmationError}</p>}
              </div>
            </div>
          </Card>
        )}

        {onAccept && (
          <div className="flex justify-end border-t border-border pt-4">
            <Button
              variant="primary"
              loading={accepting}
              icon={<CheckCircle2 className="w-4 h-4" />}
              onClick={() => { void onAccept(); }}
              className="dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/90"
            >
              Aceptar y abrir chat
            </Button>
          </div>
        )}

        {adjuntos.length>0&&(
          <Card padding="md">
            <h3 className="text-sm font-semibold mb-3">Archivos adjuntos</h3>
            <div className="space-y-2">
              {adjuntos.map((link)=> (
                <a key={link} href={link} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline break-all inline-flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5"/>{link}
                </a>
              ))}
            </div>
          </Card>
        )}
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVISOR PORTAL — DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────