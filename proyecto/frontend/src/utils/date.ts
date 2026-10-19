export function parseBackendDate(value: string): Date {
  const normalized = String(value || "").trim();
  const utcValue = normalized.includes("T") &&
    !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)
      ? `${normalized}Z`
      : normalized;

  return new Date(utcValue);
}


export function formatChatTime(value: string): string {
  const date = parseBackendDate(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
