import { ComponentPropsWithoutRef } from "react";

export type UserRole = "solicitante" | "importadora" | "asesor";

export interface PortalUser {
  name: string;
  company: string;
  initials: string;
}

export interface CompanyAdvisor {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  initials: string;
  color: string;
  status: "activo" | "inactivo" | "ausente";
  availability: "alta" | "media" | "baja";
  activeQuotes: number;
  avgResponse: string;
  joinDate: string;
}

export interface AppNotification {
  id: string;
  type: "response" | "message" | "status" | "order" | "document" | "advisor" | "update";
  title: string;
  body: string;
  date: string;
  read: boolean;
}

export interface AvailableQuote {
  id: string;
  code: string;
  product: string;
  category: string;
  country: string;
  createdAgo: string;
  priority: "alta" | "media" | "baja";
  claimedBy?: string;
}

export type NavItem = {
  icon: React.FC<{ className?: string }>;
  label: string;
  key: string;
};

export interface SidebarCtrl {
  active: string;
  onNav: (key: string) => void;
  pinned: boolean;
  onToggle: () => void;
  navItems: NavItem[];
  onNotif?: () => void;
  notifCount?: number;
  onLogout?: () => void;
  onProfile?: () => void;
}