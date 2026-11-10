import { useCallback, useRef, useState } from "react";
import { businessService, type BackendExplorerResponse } from "@/services/business.service";

/** Folder navigation state, including the ref used by silent refreshes. */
export function useDocumentExplorer(systemRootNames: string[] = []) {
  const [documentExplorer, setDocumentExplorer] = useState<BackendExplorerResponse>({ carpetas: [], archivos: [] });
  const [protectedRootFolders, setProtectedRootFolders] = useState<Array<{ id: string; nombre: string }>>([]);
  const [documentCurrentFolderId, setDocumentCurrentFolderId] = useState<string | null>(null);
  const [isDocumentExplorerLoading, setIsDocumentExplorerLoading] = useState(false);
  const documentCurrentFolderRef = useRef<string | null>(null);
  const normalize = (name: string) => name.trim().toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const ensureSystemRootFolders = useCallback(async () => {
    let root = await businessService.listDocumentExplorer(null);
    const protectedRoots = root.carpetas.filter((folder) => folder.is_protected || folder.is_system);
    const existing = new Set(root.carpetas.map((folder) => normalize(folder.nombre)));
    const missing = protectedRoots.length ? [] : systemRootNames.filter((name) => !existing.has(normalize(name)));
    await Promise.all(missing.map(async (name) => {
      try { await businessService.createDocumentFolder({ nombre: name, parent_id: null }); } catch { /* concurrent creation */ }
    }));
    if (missing.length) root = await businessService.listDocumentExplorer(null);
    const protectedSet = new Set((protectedRoots.length ? protectedRoots.map((folder) => folder.nombre) : systemRootNames).map(normalize));
    const unique = new Map<string, { id: string; nombre: string }>();
    root.carpetas.forEach((folder) => {
      const key = normalize(folder.nombre);
      if (protectedSet.has(key) && !unique.has(key)) unique.set(key, { id: folder.id, nombre: folder.nombre });
    });
    setProtectedRootFolders([...unique.values()]);
    return { ...root, carpetas: root.carpetas.filter((folder) => !protectedSet.has(normalize(folder.nombre)) || unique.get(normalize(folder.nombre))?.id === folder.id) };
  }, [systemRootNames]);
  const reloadDocumentExplorer = useCallback(async (parentId?: string | null) => {
    const resolved = typeof parentId === "undefined" ? documentCurrentFolderRef.current : parentId;
    setIsDocumentExplorerLoading(true);
    try {
      const explorer = resolved === null ? await ensureSystemRootFolders() : await businessService.listDocumentExplorer(resolved);
      documentCurrentFolderRef.current = resolved ?? null;
      setDocumentCurrentFolderId(resolved ?? null);
      setDocumentExplorer(explorer);
      return explorer;
    } finally { setIsDocumentExplorerLoading(false); }
  }, [ensureSystemRootFolders]);

  return {
    documentExplorer,
    setDocumentExplorer,
    protectedRootFolders,
    setProtectedRootFolders,
    documentCurrentFolderId,
    setDocumentCurrentFolderId,
    isDocumentExplorerLoading,
    setIsDocumentExplorerLoading,
    documentCurrentFolderRef,
    reloadDocumentExplorer,
  };
}
