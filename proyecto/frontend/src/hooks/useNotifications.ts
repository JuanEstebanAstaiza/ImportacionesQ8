import { useCallback, useState } from "react";
import type { AppNotification } from "@shared/notifications/types";
import { INIT_NOTIFICATIONS } from "@shared/notifications/constants";
import { businessService } from "@/services/business.service";
import { mapBackendNotificationToUi } from "@shared/notifications/mappers";
import type { Importer } from "@/types/importer";

/** Notification state and read-state mutation. */
export function useNotifications(importers: Importer[] = []) {
  const [notifications, setNotifications] = useState<AppNotification[]>(INIT_NOTIFICATIONS);
  const markAsRead = (notificationId: string) => {
    setNotifications((previous) => previous.map((notification) =>
      notification.id === notificationId ? { ...notification, read: true } : notification,
    ));
    void businessService.markNotificationAsRead(notificationId).catch(() => undefined);
  };
  const reloadNotifications = useCallback(async () => {
    try {
      const response = await businessService.listNotifications();
      const companies = new Map(importers.map((company) => [company.id, company.name]));
      setNotifications(response.items.map((notification) => {
        const importerId = typeof notification.data?.importador_id === "string" ? notification.data.importador_id : "";
        return mapBackendNotificationToUi(notification, companies.get(importerId));
      }));
    } catch {
      setNotifications([]);
    }
  }, [importers]);
  return { notifications, setNotifications, markAsRead, reloadNotifications };
}
