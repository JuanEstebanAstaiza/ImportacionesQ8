import { useCallback } from "react";
import { businessService } from "@/services/business.service";
import type { DomainActionOptions } from "./useDomainActionTypes";

type DocumentOptions = Pick<DomainActionOptions, "reloadDocumentExplorer" | "documentCurrentFolderRef">;

export function useDocumentActions({ reloadDocumentExplorer, documentCurrentFolderRef }: DocumentOptions) {
  const handleCreateDocumentFolder = useCallback(async (name: string, parentId: string | null) => { await businessService.createDocumentFolder({ nombre: name, parent_id: parentId }); await reloadDocumentExplorer(parentId); }, [reloadDocumentExplorer]);
  const handleRegisterLocalDocument = useCallback(async (file: File, parentId: string | null) => { await businessService.uploadDocumentFile(file, parentId, "manual"); await reloadDocumentExplorer(parentId); }, [reloadDocumentExplorer]);
  const handleMoveDocumentFile = useCallback(async (id: string, folderId: string | null) => { await businessService.updateDocumentFile(id, { carpeta_id: folderId }); await reloadDocumentExplorer(documentCurrentFolderRef.current); }, [documentCurrentFolderRef, reloadDocumentExplorer]);
  const handleMoveDocumentFolder = useCallback(async (id: string, parentId: string | null) => { await businessService.updateDocumentFolder(id, { parent_id: parentId }); await reloadDocumentExplorer(documentCurrentFolderRef.current); }, [documentCurrentFolderRef, reloadDocumentExplorer]);
  const handleRenameDocumentFile = useCallback(async (id: string, name: string) => { await businessService.updateDocumentFile(id, { nombre: name }); await reloadDocumentExplorer(documentCurrentFolderRef.current); }, [documentCurrentFolderRef, reloadDocumentExplorer]);
  const handleRenameDocumentFolder = useCallback(async (id: string, name: string) => { await businessService.updateDocumentFolder(id, { nombre: name }); await reloadDocumentExplorer(documentCurrentFolderRef.current); }, [documentCurrentFolderRef, reloadDocumentExplorer]);
  const handleDeleteDocumentFile = useCallback(async (id: string) => { await businessService.deleteDocumentFile(id); await reloadDocumentExplorer(documentCurrentFolderRef.current); }, [documentCurrentFolderRef, reloadDocumentExplorer]);
  const handleDeleteDocumentFolder = useCallback(async (id: string) => { await businessService.deleteDocumentFolder(id); await reloadDocumentExplorer(documentCurrentFolderRef.current); }, [documentCurrentFolderRef, reloadDocumentExplorer]);
  const handleSearchDocuments = useCallback((query: string) => businessService.searchDocumentFiles(query), []);
  return { handleCreateDocumentFolder, handleRegisterLocalDocument, handleMoveDocumentFile, handleMoveDocumentFolder, handleRenameDocumentFile, handleRenameDocumentFolder, handleDeleteDocumentFile, handleDeleteDocumentFolder, handleSearchDocuments };
}
