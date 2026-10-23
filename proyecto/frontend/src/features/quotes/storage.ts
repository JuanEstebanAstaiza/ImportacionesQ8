import type { Quote } from "@/types/quote";

const LOCAL_HIDDEN_OPEN_QUOTES_KEY = "advisor_hidden_open_quotes_by_company";
const LOCAL_QUOTE_STATUS_OVERRIDES_KEY = "quote_status_overrides";

export function loadHiddenOpenQuotesByCompany(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(LOCAL_HIDDEN_OPEN_QUOTES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveHiddenOpenQuotesByCompany(payload: Record<string, string[]>): void {
  localStorage.setItem(LOCAL_HIDDEN_OPEN_QUOTES_KEY, JSON.stringify(payload));
}

export function loadQuoteStatusOverrides(): Record<string, Quote["status"]> {
  try {
    const raw = localStorage.getItem(LOCAL_QUOTE_STATUS_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Quote["status"]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveQuoteStatusOverrides(payload: Record<string, Quote["status"]>): void {
  localStorage.setItem(LOCAL_QUOTE_STATUS_OVERRIDES_KEY, JSON.stringify(payload));
}

export function applyQuoteStatusOverride(
  quote: Quote,
  overrides: Record<string, Quote["status"]>,
): Quote {
  const override = overrides[quote.id];
  return override ? { ...quote, status: override } : quote;
}
