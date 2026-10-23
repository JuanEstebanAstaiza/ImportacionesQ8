import { useCallback, useEffect } from "react";
import { businessService, type UrgenciaSoporte } from "@/services/business.service";
import type { DomainActionOptions } from "./useDomainActionTypes";

type SupportOptions = Pick<DomainActionOptions, "userRole" | "setMiembrosEquipo" | "reloadChatData" | "setSoporteAbierto" | "setInitialChatConvId" | "goTo" | "openChat">;

export function useSupportActions({ userRole, setMiembrosEquipo, reloadChatData, setSoporteAbierto, setInitialChatConvId, goTo, openChat }: SupportOptions) {
  const abrirCanalEquipo = useCallback(async () => {
    const canal = await businessService.openTeamChannel();
    await reloadChatData();
    setInitialChatConvId(canal.id);
    goTo("team-channel");
  }, [goTo, reloadChatData, setInitialChatConvId]);
  const abrirHiloEquipo = useCallback(async (miembroId: string) => {
    const hilo = await businessService.openTeamChannel(miembroId);
    await reloadChatData();
    setInitialChatConvId(hilo.id);
    goTo("team-channel");
    return hilo.id;
  }, [goTo, reloadChatData, setInitialChatConvId]);

  useEffect(() => {
    if (!["admin", "soporte", "designer"].includes(userRole)) {
      setMiembrosEquipo([]);
      return;
    }
    let cancelled = false;
    void businessService.listTeamMembers().then((members) => {
      if (!cancelled) setMiembrosEquipo(members);
    }).catch(() => {
      if (!cancelled) setMiembrosEquipo([]);
    });
    return () => { cancelled = true; };
  }, [setMiembrosEquipo, userRole]);

  const handleCloseTicket = useCallback(async (id: string, resolution: string) => {
    await businessService.closeSupportTicket(id, resolution);
    await reloadChatData();
  }, [reloadChatData]);
  const handleReopenTicket = useCallback(async (id: string) => {
    await businessService.reopenSupportTicket(id);
    await reloadChatData();
  }, [reloadChatData]);
  const handleEscalateTicket = useCallback(async (id: string, level: number) => {
    await businessService.escalateSupportTicket(id, level);
    await reloadChatData();
  }, [reloadChatData]);
  const handleRateTicket = useCallback(async (id: string, rating: number, comment?: string) => {
    await businessService.rateSupportTicket(id, rating, comment);
    await reloadChatData();
  }, [reloadChatData]);
  const handleOpenSupportTicket = useCallback(async (data: { asunto: string; urgencia: UrgenciaSoporte; mensaje: string }) => {
    const ticket = await businessService.openSupportTicket({ asunto: data.asunto, urgencia: data.urgencia, mensaje: data.mensaje || undefined });
    setSoporteAbierto(false);
    await reloadChatData();
    openChat(ticket.id);
  }, [openChat, reloadChatData, setSoporteAbierto]);

  return { abrirCanalEquipo, abrirHiloEquipo, handleCloseTicket, handleReopenTicket, handleEscalateTicket, handleRateTicket, handleOpenSupportTicket };
}
