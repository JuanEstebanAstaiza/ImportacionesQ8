import { useCallback } from "react";
import { businessService } from "@/services/business.service";
import { toApiPath } from "@/services/api-client";
import type { DomainActionOptions } from "./useDomainActionTypes";

type OrderOptions = Pick<DomainActionOptions, "selectedOrderId" | "reloadRequesterOrders" | "reloadImporterOrders" | "reloadChatData" | "loadOrderDetail" | "reloadDocumentExplorer" | "documentCurrentFolderRef">;

export function useOrderActions(options: OrderOptions) {
  const { selectedOrderId, reloadRequesterOrders, reloadImporterOrders, reloadChatData, loadOrderDetail, reloadDocumentExplorer, documentCurrentFolderRef } = options;
  const handleUpdateOrderStatus = useCallback(async (orderId: string, status: string) => {
    await businessService.updateOrderStatus(orderId, { estado: status });
    await Promise.all([reloadRequesterOrders(), reloadImporterOrders(), reloadChatData()]);
    if (selectedOrderId === orderId) await loadOrderDetail(orderId);
  }, [loadOrderDetail, reloadChatData, reloadImporterOrders, reloadRequesterOrders, selectedOrderId]);
  const handleAttachOrderDocument = useCallback(async (orderId: string, file: File) => {
    const created = await businessService.uploadDocumentFile(file, null, "orden");
    const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "";
    const type = extension === "pdf"
      ? "factura_comercial"
      : extension === "xlsx" || extension === "xls" || extension === "csv"
        ? "packing_list"
        : "factura_proforma";
    await businessService.addOrderDocument(orderId, { nombre: file.name, url: toApiPath(created.storage_url), tipo: type });
    await Promise.all([reloadRequesterOrders(), reloadImporterOrders(), reloadChatData(), reloadDocumentExplorer(documentCurrentFolderRef.current)]);
    if (selectedOrderId === orderId) await loadOrderDetail(orderId);
  }, [documentCurrentFolderRef, loadOrderDetail, reloadChatData, reloadDocumentExplorer, reloadImporterOrders, reloadRequesterOrders, selectedOrderId]);
  return { handleUpdateOrderStatus, handleAttachOrderDocument };
}
