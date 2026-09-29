import { ShieldCheck } from "lucide-react";

export type TierCotizante = "Bronze" | "Silver" | "Gold" | "Élite";

const TIER_STYLES: Record<TierCotizante, string> = {
  Bronze: "border-amber-300/60 bg-amber-100 text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200",
  Silver: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-200",
  Gold: "border-yellow-300/70 bg-yellow-100 text-yellow-800 dark:border-yellow-600/60 dark:bg-yellow-950/40 dark:text-yellow-200",
  "Élite": "border-primary/30 bg-primary/10 text-primary dark:border-accent/40 dark:bg-accent/15 dark:text-accent",
};

export function TierBadge({ tier = "Bronze" }: { tier?: string }) {
  const normalizedTier: TierCotizante = tier in TIER_STYLES ? tier as TierCotizante : "Bronze";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${TIER_STYLES[normalizedTier]}`}>
      <ShieldCheck className="h-3.5 w-3.5" />
      {normalizedTier}
    </span>
  );
}