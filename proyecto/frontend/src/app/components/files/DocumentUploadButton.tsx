import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";

import { businessService, type BackendArchivoItem } from "@/services/business.service";

type DocumentUploadButtonProps = {
  label: string;
  accept?: string;
  carpetaId?: string | null;
  origen?: string;
  disabled?: boolean;
  className?: string;
  multiple?: boolean;
  onUploaded: (archivo: BackendArchivoItem) => void | Promise<void>;
  onError?: (message: string) => void;
  variant?: "primary" | "secondary" | "ghost";
};

function getVariantClass(variant: "primary" | "secondary" | "ghost"): string {
  if (variant === "primary") {
    return "bg-primary text-white hover:bg-blue-700";
  }

  if (variant === "ghost") {
    return "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground border border-border";
  }

  return "bg-white text-foreground border border-border hover:bg-muted";
}

export function DocumentUploadButton({
  label,
  accept,
  carpetaId = null,
  origen = "manual",
  disabled = false,
  className,
  multiple = false,
  onUploaded,
  onError,
  variant = "secondary",
}: DocumentUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    if (isUploading) {
      return;
    }

    setIsUploading(true);

    try {
      for (const file of files) {
        const uploaded = await businessService.uploadDocumentFile(file, carpetaId, origen);
        await onUploaded(uploaded);
      }
    } catch (error) {
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : "No se pudo subir el archivo seleccionado.";
      onError?.(message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={(event) => { void handlePick(event); }}
      />
      <button
        type="button"
        disabled={disabled || isUploading}
        onClick={() => inputRef.current?.click()}
        className={[
          "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50",
          getVariantClass(variant),
          className ?? "",
        ].join(" ")}
      >
        {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {label}
      </button>
    </>
  );
}
