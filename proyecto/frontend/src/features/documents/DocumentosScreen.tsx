import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { toast } from "sonner";
import { ChevronRight, Copy, Download, Edit2, FileText, FolderOpen, FolderTree, LayoutGrid, LockKeyhole, MoreHorizontal, RotateCcw, Search, Trash2, Upload, X } from "lucide-react";
import { Button, Card, Input } from "@/components/design-system";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { AppHeader, FormatFileIcon, Sidebar, USER } from "@/app/App";
import type { SidebarCtrl } from "@/types/portal";
import type { BackendArchivoItem, BackendExplorerResponse } from "@/services/business.service";
import { resolveApiUrl } from "@/services/api-client";
import { abrirArchivoEnPestana } from "@/utils/abrir-archivo";
import { normalizeFolderName, SYSTEM_ROOT_FOLDER_NAMES } from "@/app/App";
export function DocumentosScreen({
  sb,
  explorer,
  isLoading,
  currentFolderId,
  onLoadFolder,
  onCreateFolder,
  onRegisterFile,
  onSearch,
  onMoveFile,
  onMoveFolder,
  onRenameFile,
  onRenameFolder,
  onDeleteFile,
  onDeleteFolder,
  protectedFolders,
}: {
  sb: SidebarCtrl;
  explorer: BackendExplorerResponse;
  isLoading: boolean;
  currentFolderId: string | null;
  onLoadFolder: (parentId: string | null) => Promise<void>;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onRegisterFile: (file: File, parentId: string | null) => Promise<void>;
  onSearch: (query: string) => Promise<BackendArchivoItem[]>;
  onMoveFile: (fileId: string, targetFolderId: string | null) => Promise<void>;
  onMoveFolder: (folderId: string, targetParentId: string | null) => Promise<void>;
  onRenameFile: (fileId: string, newName: string) => Promise<void>;
  onRenameFolder: (folderId: string, newName: string) => Promise<void>;
  onDeleteFile: (fileId: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  protectedFolders: Array<{ id: string; nombre: string }>;
}) {
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Drag & drop estados para carga external
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);
  const [dragHoverFolderId, setDragHoverFolderId] = useState<string | null>(null);

  // Drag & drop estados para mover elementos internos
  const [dragFileId, setDragFileId] = useState<string | null>(null);
  const [dragFolderId, setDragFolderId] = useState<string | null>(null);

  const [searchResults, setSearchResults] = useState<{
    files: BackendArchivoItem[];
    folders: BackendExplorerResponse["carpetas"];
  } | null>(null);
  const [folderTrail, setFolderTrail] = useState<Array<{ id: string | null; name: string }>>([
    { id: null, name: "Raíz" },
  ]);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [gridPreviewUrls, setGridPreviewUrls] = useState<Record<string, string>>({});
  const [menuState, setMenuState] = useState<{
    kind: "file" | "folder" | "canvas";
    id: string | null;
    x: number;
    y: number;
    file?: BackendArchivoItem;
    folder?: BackendExplorerResponse["carpetas"][number];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const gridPreviewLoadingRef = useRef<Record<string, boolean>>({});
  const gridPreviewRegistryRef = useRef<Record<string, string>>({});
  const protectedFolderSet = new Set(protectedFolders.map((folder) => folder.id));
  const chatRootFolderId =
    protectedFolders.find((folder) => normalizeFolderName(folder.nombre) === "chats")?.id || null;

  function isProtectedFolder(folderId: string): boolean {
    if (protectedFolderSet.has(folderId)) {
      return true;
    }
    return Boolean(explorer.carpetas.find((folder) => folder.id === folderId)?.is_protected);
  }

  const visibleFiles = searchResults?.files ?? explorer.archivos;
  const visibleFolders = searchResults
    ? searchResults.folders
    : currentFolderId === null
    ? explorer.carpetas.filter((folder, index, all) => {
        if (
          !SYSTEM_ROOT_FOLDER_NAMES.some(
            (name) => normalizeFolderName(name) === normalizeFolderName(folder.nombre)
          )
        ) {
          return true;
        }
        return (
          all.findIndex(
            (candidate) =>
              normalizeFolderName(candidate.nombre) === normalizeFolderName(folder.nombre)
          ) === index
        );
      })
    : explorer.carpetas;

  useEffect(() => {
    if (currentFolderId === null) {
      setFolderTrail([{ id: null, name: "Raíz" }]);
    }
  }, [currentFolderId]);

  // Búsqueda en tiempo real con debounce
  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await onSearch(query);
        const normalizedQuery = normalizeFolderName(query);
        const folderRows = explorer.carpetas.filter((folder) =>
          normalizeFolderName(folder.nombre).includes(normalizedQuery),
        );
        setSearchResults({ files: rows, folders: folderRows });
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, onSearch, explorer.carpetas]);

  useEffect(() => {
    if (!menuState) return;
    const onWindowEvent = () => setMenuState(null);
    window.addEventListener("scroll", onWindowEvent, true);
    window.addEventListener("resize", onWindowEvent);
    return () => {
      window.removeEventListener("scroll", onWindowEvent, true);
      window.removeEventListener("resize", onWindowEvent);
    };
  }, [menuState]);

  async function handleCreateFolderPrompt() {
    const entered = window.prompt("Nombre de la nueva carpeta", "") ?? "";
    const normalized = entered.trim();
    if (!normalized) return;
    setIsSubmitting(true);
    try {
      await onCreateFolder(normalized, currentFolderId);
    } finally {
      setIsSubmitting(false);
      setMenuState(null);
    }
  }

  async function handleFilePick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsSubmitting(true);
    try {
      await onRegisterFile(file, currentFolderId);
    } finally {
      setIsSubmitting(false);
      event.target.value = "";
    }
  }

  // Carga al soltar un archivo externo en el canvas o sobre una carpeta
  async function handleDropUpload(
    event: React.DragEvent<HTMLDivElement>,
    targetFolderId: string | null = currentFolderId
  ) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOverCanvas(false);
    setDragHoverFolderId(null);

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    try {
      await onRegisterFile(file, targetFolderId);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function openFolder(folder: { id: string; nombre: string }) {
    setSearchResults(null);
    setSearch("");
    setFolderTrail((prev) => [...prev, { id: folder.id, name: folder.nombre }]);
    await onLoadFolder(folder.id);
  }

  async function jumpToTrail(index: number) {
    const node = folderTrail[index];
    setSearchResults(null);
    setSearch("");
    setFolderTrail((prev) => prev.slice(0, index + 1));
    await onLoadFolder(node.id);
  }

  async function moveFileTo(fileId: string, targetFolderId: string | null) {
    setMenuState(null);
    await onMoveFile(fileId, targetFolderId);
    if (targetFolderId === null) {
      setFolderTrail([{ id: null, name: "Raíz" }]);
      setSearch("");
      setSearchResults(null);
      await onLoadFolder(null);
    }
  }

  async function moveFolderTo(folderId: string, targetFolderId: string | null) {
    if (isProtectedFolder(folderId)) {
      toast.error("Esta carpeta del sistema no se puede mover.");
      setMenuState(null);
      return;
    }
    setMenuState(null);
    await onMoveFolder(folderId, targetFolderId);
    if (targetFolderId === null) {
      setFolderTrail([{ id: null, name: "Raíz" }]);
      setSearch("");
      setSearchResults(null);
      await onLoadFolder(null);
    }
  }

  async function handleDeleteFile(fileId: string) {
    setMenuState(null);
    await onDeleteFile(fileId);
  }

  async function handleDeleteFolder(folderId: string) {
    if (isProtectedFolder(folderId)) {
      toast.error("Esta carpeta del sistema no se puede eliminar.");
      setMenuState(null);
      return;
    }
    setMenuState(null);
    await onDeleteFolder(folderId);
  }

  async function handleRenameFile(file: BackendArchivoItem) {
    const splitName = (name: string) => {
      const trimmed = name.trim();
      const lastDot = trimmed.lastIndexOf(".");
      if (lastDot <= 0 || lastDot === trimmed.length - 1) {
        return { base: trimmed, ext: "" };
      }
      return {
        base: trimmed.slice(0, lastDot),
        ext: trimmed.slice(lastDot + 1),
      };
    };

    const { base, ext } = splitName(file.nombre);
    const nextBase =
      window.prompt(
        ext ? `Nuevo nombre del archivo (sin .${ext})` : "Nuevo nombre del archivo",
        base
      ) ?? "";
    const normalizedBase = nextBase.trim();

    if (!normalizedBase) {
      setMenuState(null);
      return;
    }

    const nextFullName = ext ? `${normalizedBase}.${ext}` : normalizedBase;
    if (nextFullName === file.nombre) {
      setMenuState(null);
      return;
    }

    await onRenameFile(file.id, nextFullName);
    setMenuState(null);
  }

  async function handleRenameFolder(folder: BackendExplorerResponse["carpetas"][number]) {
    if (isProtectedFolder(folder.id)) {
      toast.error("Esta carpeta del sistema no se puede renombrar.");
      setMenuState(null);
      return;
    }
    const nextName = window.prompt("Nuevo nombre para la carpeta", folder.nombre) ?? "";
    const normalized = nextName.trim();
    if (!normalized || normalized === folder.nombre) {
      setMenuState(null);
      return;
    }
    await onRenameFolder(folder.id, normalized);
    setMenuState(null);
  }

  function fmtBytes(bytes: number | null): string {
    if (!bytes || bytes <= 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  function absoluteResourceUrl(url: string | null): string {
    return resolveApiUrl(url);
  }

  async function fetchProtectedBlob(url: string | null): Promise<Blob | null> {
    const target = absoluteResourceUrl(url);
    const token = getStoredToken();
    if (!target || !token) {
      return null;
    }

    const response = await fetch(target, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`No se pudo cargar el recurso (${response.status})`);
    }
    return response.blob();
  }

  async function handleCopyLink(url: string | null) {
    const shareable = absoluteResourceUrl(url);
    if (!shareable) {
      toast.error("No hay enlace disponible para copiar");
      setMenuState(null);
      return;
    }

    try {
      await navigator.clipboard.writeText(shareable);
      toast.success("Enlace copiado al portapapeles");
    } catch (error) {
      console.error("No se pudo copiar el enlace:", error);
      toast.error("No se pudo copiar el enlace");
    } finally {
      setMenuState(null);
    }
  }

  async function handleDownload(url: string | null, fileName: string) {
    try {
      const blob = await fetchProtectedBlob(url);
      if (!blob) return;
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Error descargando archivo:", error);
      const message = error instanceof Error ? error.message : "Error desconocido";
      if (message.includes("(404)")) {
        toast.error(`No se encontró el archivo en el servidor: ${fileName}`);
      } else {
        toast.error(`No se pudo descargar ${fileName}`);
      }
    } finally {
      setMenuState(null);
    }
  }

  async function handleOpenResource(url: string | null, fileName: string) {
    const resultado = await abrirArchivoEnPestana(url, fileName);
    if (!resultado.ok) {
      toast.error(resultado.motivo || `No se pudo abrir ${fileName}`);
    }
  }

  function handleOpenMenuAtPoint(
    payload: {
      kind: "file" | "folder" | "canvas";
      id: string | null;
      file?: BackendArchivoItem;
      folder?: BackendExplorerResponse["carpetas"][number];
    },
    clientX: number,
    clientY: number
  ) {
    const menuWidth = 176;
    const menuHeight = 200;
    const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, clientX));
    const top = Math.max(8, Math.min(window.innerHeight - menuHeight - 8, clientY));
    setMenuState({
      ...payload,
      x: left,
      y: top,
    });
  }

  function handleOpenMenu(
    event: React.MouseEvent<HTMLButtonElement>,
    payload: {
      kind: "file" | "folder";
      id: string;
      file?: BackendArchivoItem;
      folder?: BackendExplorerResponse["carpetas"][number];
    }
  ) {
    const rect = event.currentTarget.getBoundingClientRect();
    handleOpenMenuAtPoint(payload, rect.right - 170, rect.bottom + 6);
  }

  function previewThumb(file: BackendArchivoItem): string | null {
    const mime = String(file.mime_type || "").toLowerCase();
    if (mime.startsWith("image/") && file.storage_url && gridPreviewUrls[file.id]) {
      return gridPreviewUrls[file.id];
    }
    return null;
  }

  useEffect(() => {
    const fileIds = new Set(visibleFiles.map((file) => file.id));
    Object.entries(gridPreviewRegistryRef.current).forEach(([fileId, objectUrl]) => {
      if (!fileIds.has(fileId)) {
        window.URL.revokeObjectURL(objectUrl);
        delete gridPreviewRegistryRef.current[fileId];
        delete gridPreviewLoadingRef.current[fileId];
      }
    });

    setGridPreviewUrls((current) => {
      const next: Record<string, string> = {};
      visibleFiles.forEach((file) => {
        if (current[file.id]) {
          next[file.id] = current[file.id];
        }
      });
      return next;
    });

    if (viewMode !== "grid") {
      return;
    }

    visibleFiles.forEach((file) => {
      const mime = String(file.mime_type || "").toLowerCase();
      if (!mime.startsWith("image/") || !file.storage_url) {
        return;
      }
      if (gridPreviewRegistryRef.current[file.id] || gridPreviewLoadingRef.current[file.id]) {
        return;
      }

      gridPreviewLoadingRef.current[file.id] = true;
      void fetchProtectedBlob(file.storage_url)
        .then((blob) => {
          if (!blob) return;
          const objectUrl = window.URL.createObjectURL(blob);
          gridPreviewRegistryRef.current[file.id] = objectUrl;
          setGridPreviewUrls((current) => ({ ...current, [file.id]: objectUrl }));
        })
        .catch(() => {
          // Si falla la miniatura, se mantiene fallback de icono.
        })
        .finally(() => {
          delete gridPreviewLoadingRef.current[file.id];
        });
    });
  }, [viewMode, visibleFiles]);

  useEffect(() => {
    return () => {
      Object.values(gridPreviewRegistryRef.current).forEach((objectUrl) => {
        window.URL.revokeObjectURL(objectUrl);
      });
      gridPreviewRegistryRef.current = {};
      gridPreviewLoadingRef.current = {};
    };
  }, []);

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      <Sidebar {...sb} active="documentos" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader user={USER} sb={sb} />
        <main
          className="flex-1 overflow-y-auto px-6 py-6 space-y-5"
          onClick={() => setMenuState(null)}
          onContextMenu={(event) => {
            event.preventDefault();
            handleOpenMenuAtPoint({ kind: "canvas", id: currentFolderId }, event.clientX, event.clientY);
          }}
        >
          <div>
            <Breadcrumb
              items={[
                { label: "Inicio", onClick: () => sb.onNav(sb.navItems[0]?.key || "dashboard") },
                { label: "Documentos" },
              ]}
            />
            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight">Gestión Documental</h1>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(event) => {
              void handleFilePick(event);
            }}
          />

          <Card
            padding="md"
            className="overflow-visible relative"
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes("Files")) {
                event.preventDefault();
                setIsDragOverCanvas(true);
              }
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setIsDragOverCanvas(false);
              }
            }}
            onDrop={(event) => {
              if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
                void handleDropUpload(event);
              }
            }}
          >
            {/* Superposición cuando se arrastran archivos externos al canvas general */}
            {isDragOverCanvas && (
              <div className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-xl flex flex-col items-center justify-center pointer-events-none transition-all">
                <Upload className="w-10 h-10 text-primary animate-bounce mb-2" />
                <p className="text-base font-semibold text-primary">
                  Suelta el archivo para subirlo aquí
                </p>
              </div>
            )}

            {/* Barra de Búsqueda y Botones de Acción Integrados */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 mb-4">
              <div className="w-full md:w-72">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre..."
                  prefix={
                    searching ? (
                      <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )
                  }
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
                <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border">
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className={viewMode === "list" ? "!bg-primary !text-white dark:!bg-accent dark:!text-black" : "hover:!bg-primary/20 hover:!text-primary dark:hover:!bg-accent/20 dark:hover:!text-accent"}
                  >
                    Lista
                  </Button>
                  <Button
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                    size="sm"
                    icon={<LayoutGrid className="w-3.5 h-3.5" />}
                    onClick={() => setViewMode("grid")}
                    className={viewMode === "grid" ? "!bg-primary !text-white dark:!bg-accent dark:!text-black" : "hover:!bg-primary/20 hover:!text-primary dark:hover:!bg-accent/20 dark:hover:!text-accent"}
                  >
                    Cuadrícula
                  </Button>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  onClick={() => {
                    void onLoadFolder(currentFolderId);
                  }}
                >
                  Actualizar
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<FolderOpen className="w-3.5 h-3.5" />}
                  onClick={() => {
                    void handleCreateFolderPrompt();
                  }}
                  disabled={isSubmitting}
                >
                  Nueva carpeta
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Upload className="w-3.5 h-3.5" />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                >
                  Subir archivo
                </Button>
              </div>
            </div>

            {/* Breadcrumb de carpetas */}
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
              {folderTrail.map((node, index) => (
                <button
                  key={`${node.id || "root"}-${index}`}
                  onClick={() => {
                    void jumpToTrail(index);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragFileId) {
                      void moveFileTo(dragFileId, node.id);
                    }
                    if (dragFolderId) {
                      void moveFolderTo(dragFolderId, node.id);
                    }
                    setDragFileId(null);
                    setDragFolderId(null);
                  }}
                  className={clsx(
                    "text-xs px-2 py-1 rounded-md border transition-colors",
                    index === folderTrail.length - 1
                      ? "bg-primary/10 dark:bg-accent/10 text-primary dark:text-accent border-primary/20 dark:border-primary/20 font-medium"
                      : "bg-white text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {node.name}
                </button>
              ))}
            </div>

            {/* Contenido principal (Carpetas y Archivos) */}
            <div
              className={clsx(
                "max-h-[60vh] overflow-y-auto overflow-x-visible pr-1",
                viewMode === "grid" ? "grid grid-cols-2 lg:grid-cols-4 gap-3" : "space-y-2"
              )}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (dragFileId) {
                  void moveFileTo(dragFileId, null);
                }
                if (dragFolderId) {
                  void moveFolderTo(dragFolderId, null);
                }
                setDragFileId(null);
                setDragFolderId(null);
              }}
            >
              {isLoading && (
                <p className="text-sm text-muted-foreground col-span-full py-4 text-center">
                  Cargando documentos...
                </p>
              )}

              {!isLoading &&
                visibleFolders.map((folder) => {
                  const isHoveredForUpload = dragHoverFolderId === folder.id;

                  return (
                    <div
                      key={folder.id}
                      draggable={!isProtectedFolder(folder.id)}
                      onDragStart={() => {
                        if (!isProtectedFolder(folder.id)) setDragFolderId(folder.id);
                      }}
                      onDragEnd={() => setDragFolderId(null)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (event.dataTransfer.types.includes("Files")) {
                          setDragHoverFolderId(folder.id);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragHoverFolderId === folder.id) {
                          setDragHoverFolderId(null);
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDragHoverFolderId(null);

                        // Si es un archivo local arrastrado externamente
                        if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
                          void handleDropUpload(event, folder.id);
                          return;
                        }

                        // Si es un mover interno de archivo o carpeta
                        if (dragFileId) {
                          void moveFileTo(dragFileId, folder.id);
                        }
                        if (
                          dragFolderId &&
                          dragFolderId !== folder.id &&
                          !isProtectedFolder(dragFolderId)
                        ) {
                          void moveFolderTo(dragFolderId, folder.id);
                        }
                        setDragFileId(null);
                        setDragFolderId(null);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleOpenMenuAtPoint(
                          { kind: "folder", id: folder.id, folder },
                          event.clientX,
                          event.clientY
                        );
                      }}
                      className={clsx(
                        "rounded-xl border transition-all relative",
                        isHoveredForUpload
                          ? "border-primary bg-primary/20 scale-[1.01]"
                          : isProtectedFolder(folder.id)
                          ? "doc-system-folder dark:!bg-accent/20"
                          : "doc-folder",
                        viewMode === "grid"
                          ? "min-h-[220px] p-4 flex flex-col items-center justify-center text-center"
                          : "px-3 py-2.5 flex items-center justify-between gap-3"
                      )}
                    >
                      <button
                        className={clsx(
                          "min-w-0",
                          viewMode === "grid"
                            ? "w-full h-full flex flex-col items-center justify-center text-center"
                            : "text-left w-full"
                        )}
                        onClick={() => {
                          void openFolder(folder);
                        }}
                      >
                        <FolderTree
                          className={clsx(
                            isProtectedFolder(folder.id) ? "doc-system-folder-icon" : "doc-folder-icon",
                            viewMode === "grid" ? "w-12 h-12 mb-3" : "w-4 h-4"
                          )}
                        />
                        <p
                          className={clsx(
                            "text-sm font-semibold truncate",
                            viewMode === "grid" ? "max-w-full" : "flex items-center gap-1.5"
                          )}
                        >
                          {folder.nombre}
                        </p>
                        {isProtectedFolder(folder.id) && (
                          <span className="doc-system-badge inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                            <LockKeyhole className="w-2.5 h-2.5" />
                            Sistema
                          </span>
                        )}
                        {chatRootFolderId === currentFolderId && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Conversación ID: {folder.id}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Carpeta · {new Date(folder.created_at).toLocaleDateString("es-CO")}
                        </p>
                      </button>

                      <div
                        className={clsx(
                          "flex justify-end",
                          viewMode === "grid" ? "absolute top-2 right-2" : ""
                        )}
                      >
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenMenu(event, { kind: "folder", id: folder.id, folder });
                          }}
                          className="w-7 h-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

              {!isLoading &&
                visibleFiles.map((file) => (
                  <div
                    key={file.id}
                    draggable
                    onDragStart={() => setDragFileId(file.id)}
                    onDragEnd={() => setDragFileId(null)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleOpenMenuAtPoint(
                        { kind: "file", id: file.id, file },
                        event.clientX,
                        event.clientY
                      );
                    }}
                    className={clsx(
                      "rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors",
                      viewMode === "grid"
                        ? "relative min-h-[220px] p-4 flex flex-col items-center justify-center text-center"
                        : "px-3 py-2.5 flex items-start justify-between gap-3"
                    )}
                  >
                    {viewMode === "grid" && (
                      <div className="h-24 w-full rounded-lg border border-border bg-slate-50 mb-3 overflow-hidden flex items-center justify-center">
                        {previewThumb(file) ? (
                          <img
                            src={previewThumb(file) || ""}
                            alt={file.nombre}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FormatFileIcon extension={file.extension} mimeType={file.mime_type} />
                        )}
                      </div>
                    )}
                    <div
                      className={clsx(
                        "min-w-0",
                        viewMode === "grid" ? "w-full text-center" : "flex-1"
                      )}
                    >
                      <p className="text-sm font-semibold truncate">{file.nombre}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {file.extension.toUpperCase()} · {fmtBytes(file.size_bytes)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(file.created_at).toLocaleDateString("es-CO")}
                      </p>
                    </div>
                    <div
                      className={clsx(
                        "flex items-center gap-1",
                        viewMode === "grid" ? "absolute top-2 right-2" : ""
                      )}
                    >
                      {viewMode !== "grid" && file.storage_url && (
                        <button
                          onClick={() => {
                            void handleOpenResource(file.storage_url, file.nombre);
                          }}
                          className="text-xs text-primary dark:text-accent hover:underline whitespace-nowrap"
                        >
                          Abrir
                        </button>
                      )}
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenMenu(event, { kind: "file", id: file.id, file });
                        }}
                        className="w-7 h-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

              {!isLoading && visibleFolders.length === 0 && visibleFiles.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-full py-8 text-center">
                  No hay elementos en esta carpeta.
                </p>
              )}
            </div>
          </Card>

          {/* Menú Contextual / Desplegable */}
          {menuState && (
            <div className="fixed inset-0 z-[70]" onClick={() => setMenuState(null)}>
              <div
                className="absolute w-44 rounded-lg border border-border bg-white shadow-lg p-1"
                style={{ left: menuState.x, top: menuState.y }}
                onClick={(event) => event.stopPropagation()}
              >
                {menuState.kind === "canvas" && (
                  <>
                    <button
                      onClick={() => {
                        void handleCreateFolderPrompt();
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                    >
                      Nueva carpeta
                    </button>
                    <button
                      onClick={() => {
                        fileInputRef.current?.click();
                        setMenuState(null);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                    >
                      Subir archivo
                    </button>
                    <button
                      onClick={() => {
                        void onLoadFolder(currentFolderId);
                        setMenuState(null);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                    >
                      Refrescar
                    </button>
                  </>
                )}
                {menuState.kind === "folder" && menuState.folder && (
                  <>
                    <button
                      onClick={() => {
                        void openFolder(menuState.folder!);
                        setMenuState(null);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                    >
                      Abrir
                    </button>
                    <button
                      onClick={() => {
                        void onLoadFolder(menuState.folder!.id);
                        setMenuState(null);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                    >
                      Refrescar
                    </button>
                    {!isProtectedFolder(menuState.folder.id) && (
                      <button
                        onClick={() => {
                          void handleRenameFolder(menuState.folder!);
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                      >
                        Renombrar
                      </button>
                    )}
                    {!isProtectedFolder(menuState.folder.id) && (
                      <button
                        onClick={() => {
                          void moveFolderTo(menuState.folder!.id, null);
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                      >
                        Mover a raíz
                      </button>
                    )}
                    {!isProtectedFolder(menuState.folder.id) && (
                      <button
                        onClick={() => {
                          void handleDeleteFolder(menuState.folder!.id);
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 rounded"
                      >
                        Eliminar
                      </button>
                    )}
                    {isProtectedFolder(menuState.folder.id) && (
                      <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
                        Carpeta del sistema protegida.
                      </p>
                    )}
                  </>
                )}
                {menuState.kind === "file" && menuState.file && (
                  <>
                    {menuState.file.storage_url && (
                      <button
                        onClick={() => {
                          void handleOpenResource(
                            menuState.file!.storage_url,
                            menuState.file!.nombre
                          );
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                      >
                        Ver
                      </button>
                    )}
                    {menuState.file.storage_url && (
                      <button
                        onClick={() => {
                          void handleDownload(
                            menuState.file!.storage_url,
                            menuState.file!.nombre
                          );
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                      >
                        Descargar
                      </button>
                    )}
                    <button
                      onClick={() => handleCopyLink(menuState.file!.storage_url)}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                    >
                      Copiar enlace
                    </button>
                    <button
                      onClick={() => {
                        void handleRenameFile(menuState.file!);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                    >
                      Renombrar
                    </button>
                    <button
                      onClick={() => {
                        void moveFileTo(menuState.file!.id, null);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded"
                    >
                      Mover a raíz
                    </button>
                    <button
                      onClick={() => {
                        void handleDeleteFile(menuState.file!.id);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 rounded"
                    >
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
