import { RefreshCw } from "lucide-react";
interface AdminSectionHeaderProps {
  label: string;
  hint: string;
  onRefresh: () => void;
}

export function AdminSectionHeader({ label, hint, onRefresh }: AdminSectionHeaderProps) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{label}</h1>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:!bg-primary hover:!text-white dark:hover:!bg-accent dark:hover:!text-black hover:!border-primary dark:hover:!border-accent"
        >
          <RefreshCw className="h-4 w-4" />
          Refrescar
        </button>
      </div>
    </div>
  );
}
