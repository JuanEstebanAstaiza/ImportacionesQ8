import { clsx } from "clsx";
function getFileFormatToken(extension: string, mimeType: string): { label: string; classes: string } {
  const ext = String(extension || "").trim().toLowerCase(); const mime = String(mimeType || "").toLowerCase();
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) return { label: "IMG", classes: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700" };
  if (mime.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(ext)) return { label: "VID", classes: "border-indigo-200 bg-indigo-50 text-indigo-700" };
  if (ext === "pdf") return { label: "PDF", classes: "border-red-200 bg-red-50 text-red-700" };
  if (["xlsx", "xls", "csv"].includes(ext)) return { label: "XLS", classes: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return { label: "DOC", classes: "border-blue-200 bg-blue-50 text-blue-700" };
  if (["ppt", "pptx"].includes(ext)) return { label: "PPT", classes: "border-amber-200 bg-amber-50 text-amber-700" };
  return { label: (ext || "FILE").slice(0, 4).toUpperCase(), classes: "border-slate-200 bg-slate-100 text-slate-700" };
}
export function FormatFileIcon({ extension, mimeType, compact = false }: { extension: string; mimeType: string; compact?: boolean }) {
  const token = getFileFormatToken(extension, mimeType);
  return <div className={clsx("rounded-lg border font-semibold tracking-wide flex items-center justify-center", compact ? "w-10 h-10 text-[10px]" : "w-12 h-12 text-[11px]", token.classes)} title={`Formato ${token.label}`} aria-label={`Formato ${token.label}`}>{token.label}</div>;
}
