import { useEffect, useState } from "react";
import { Download } from "lucide-react";

import { RestaurarBackup } from "@/features/admin/RestaurarBackup";
import { adminService, type BackupResumen } from "@/services/admin.service";

function formatBytes(total: number): string {
  if (total < 1024) return `${total} B`;
  if (total < 1024 * 1024) return `${(total / 1024).toFixed(1)} KB`;
  if (total < 1024 * 1024 * 1024) return `${(total / (1024 * 1024)).toFixed(1)} MB`;
  return `${(total / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

interface AdminRespaldosTabProps {
  onSesionCaducada: () => Promise<void>;
}

export function AdminRespaldosTab({
  onSesionCaducada,
}: AdminRespaldosTabProps) {
  const [backupSummary, setBackupSummary] = useState<BackupResumen | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [includeFiles, setIncludeFiles] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSummary() {
    try {
      setBackupSummary(await adminService.getBackupSummary());
    } catch {
      setBackupSummary(null);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, []);

  async function handleDownload() {
    setError("");
    setMessage("");
    setIsDownloading(true);
    try {
      const filename = await adminService.downloadBackup(includeFiles);
      setMessage(`Copia de seguridad descargada: ${filename}. Guárdala en un lugar seguro antes de actualizar.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo generar la copia de seguridad.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <p className="flex items-center gap-2 text-base font-semibold">
          <Download className="h-4 w-4 text-primary dark:text-accent" />
          Copia de seguridad
        </p>
        <p className="text-sm text-muted-foreground">
          Descarga un ZIP con la base de datos y los archivos subidos y guárdalo fuera del servidor.
        </p>

        {backupSummary ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Filas de base de datos", value: backupSummary.total_filas.toLocaleString("es-CO") },
              { label: "Archivos subidos", value: backupSummary.archivos.toLocaleString("es-CO") },
              { label: "Peso de los archivos", value: formatBytes(backupSummary.bytes_archivos) },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-lg font-semibold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isDownloading}
            onClick={() => void handleDownload()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white dark:bg-accent dark:text-black disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {isDownloading ? "Generando ZIP..." : "Descargar copia de seguridad"}
          </button>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={includeFiles} onChange={(event) => setIncludeFiles(event.target.checked)} className="h-4 w-4 rounded border-border" />
            Incluir archivos subidos (más pesado)
          </label>
        </div>

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
        <p className="mt-3 text-xs text-amber-700">
          El ZIP contiene datos personales y hashes de contraseña de toda la plataforma. Guárdalo cifrado y no lo compartas.
        </p>
        {backupSummary?.revision_alembic ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Revisión de esquema actual: <code className="rounded bg-muted px-1">{backupSummary.revision_alembic}</code>
          </p>
        ) : null}

        <RestaurarBackup
          onDescargarActual={handleDownload}
          descargandoActual={isDownloading}
          onRestaurado={loadSummary}
          onSesionCaducada={onSesionCaducada}
        />
      </div>
    </section>
  );
}
