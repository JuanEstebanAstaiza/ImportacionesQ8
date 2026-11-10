import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { BackendMiembroEquipo } from "@/services/business.service";
import type { CompanyAdvisor } from "@/types/portal";
import type { ChatConv } from "@/types/chat";

export interface DomainActionOptions {
  userRole: string;
  currentUserProfile: { id?: string; importador_id?: string | null; puntos_cotizacion?: number | null } | null;
  chatConversations: ChatConv[];
  companyAdvisors: CompanyAdvisor[];
  selectedOrderId: string;
  setInitialChatConvId: (id: string | undefined) => void;
  setSoporteAbierto: (open: boolean) => void;
  openChat: (id: string) => void;
  goTo: (screen: string) => void;
  setChatMessagesByConversation: Dispatch<SetStateAction<Record<string, any[]>>>;
  setActiveChatId: (id: string | null) => void;
  markConversationRead: (id: string) => void;
  setMiembrosEquipo: (members: BackendMiembroEquipo[]) => void;
  reloadChatData: () => Promise<unknown>;
  reloadAdvisorAvailableQuotes: (id?: string) => Promise<unknown>;
  reloadAdvisorAssignedQuotes: (id?: string) => Promise<unknown>;
  reloadRequesterQuotes: () => Promise<unknown>;
  reloadRequesterResponses: () => Promise<unknown>;
  reloadRequesterOrders: () => Promise<unknown>;
  reloadImporterQuotes: (id?: string) => Promise<unknown>;
  reloadImporterOrders: () => Promise<unknown>;
  reloadCompanyAdvisors: (id?: string) => Promise<unknown>;
  reloadCurrentUserProfile: () => Promise<unknown>;
  reloadImporters: () => Promise<unknown>;
  loadOrderDetail: (id: string) => Promise<unknown>;
  reloadDocumentExplorer: (id?: string | null) => Promise<unknown>;
  documentCurrentFolderRef: MutableRefObject<string | null>;
  refreshUser: () => Promise<unknown>;
}
