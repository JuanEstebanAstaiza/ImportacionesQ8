export function initialsFromName(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "IM";
}
export function importerColorFromId(id: string): string {
  const palette = ["bg-blue-600", "bg-emerald-600", "bg-cyan-600", "bg-orange-600", "bg-slate-600", "bg-rose-600", "bg-indigo-600"];
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash + id.charCodeAt(i)) % 997;
  return palette[hash % palette.length];
}
function normalizeText(value: unknown): string { return String(value ?? "").trim().toLowerCase(); }
export function findCustomFieldValue(customFields: Record<string, unknown> | null | undefined, aliases: string[]): string {
  if (!customFields) return "";
  const match = Object.entries(customFields).find(([key, value]) => {
    if (aliases.some((alias) => normalizeText(key).includes(alias))) return true;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      return aliases.some((alias) => normalizeText(nested.label ?? nested.nombre ?? nested.name ?? "").includes(alias));
    }
    return false;
  });
  if (!match) return "";
  const rawValue = match[1];
  if (typeof rawValue === "string" || typeof rawValue === "number") return String(rawValue);
  if (Array.isArray(rawValue)) return rawValue.map((item) => String(item)).join(", ");
  if (rawValue && typeof rawValue === "object") {
    const nested = rawValue as Record<string, unknown>;
    const possible = nested.valor ?? nested.value ?? nested.url ?? nested.archivo ?? nested.adjunto;
    if (possible) return String(possible);
  }
  return "";
}
