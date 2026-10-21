import type React from "react";
import { Bell, ClipboardList, FileText, MessageSquare, ShoppingCart, TrendingUp, Users } from "lucide-react";

import type { AppNotification } from "@/features/notifications/types";

export const INIT_NOTIFICATIONS: AppNotification[] = [];

export const NOTIF_ICON: Record<AppNotification["type"], React.ReactNode> = {
  response: <ClipboardList className="w-4 h-4 text-blue-600" />,
  message: <MessageSquare className="w-4 h-4 text-purple-600" />,
  status: <TrendingUp className="w-4 h-4 text-amber-600" />,
  order: <ShoppingCart className="w-4 h-4 text-emerald-600" />,
  document: <FileText className="w-4 h-4 text-slate-600" />,
  advisor: <Users className="w-4 h-4 text-cyan-600" />,
  update: <Bell className="w-4 h-4 text-rose-600" />,
};
