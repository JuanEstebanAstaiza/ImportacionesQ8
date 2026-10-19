import type { Quote } from "@/types/quote";

export function puedeRechazarse(q: Quote): boolean {
  return q.status === "created" || q.status === "directed" || q.status === "open";
}
