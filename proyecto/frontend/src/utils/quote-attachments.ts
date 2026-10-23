import type { Quote } from "@/types/quote";
export function getQuoteAttachmentLinks(quote: Quote): string[] {
  const links = new Set<string>();
  const maybePushLink = (value: unknown) => { const text = String(value ?? "").trim(); if (/^https?:\/\//i.test(text)) links.add(text); };
  (quote.productPhotoUrls ?? []).forEach(maybePushLink); maybePushLink(quote.referenceLink);
  if (quote.customFields && typeof quote.customFields === "object") Object.entries(quote.customFields).forEach(([key, value]) => {
    if (!/(archivo|adjunto|file|url|imagen|foto|link)/.test(key.trim().toLowerCase())) return;
    if (typeof value === "string") maybePushLink(value);
    else if (Array.isArray(value)) value.forEach(maybePushLink);
    else if (value && typeof value === "object") {
      const nested = value as Record<string, unknown>;
      [nested.url, nested.link, nested.archivo, nested.adjunto, nested.imagen, nested.foto].forEach(maybePushLink);
    }
  });
  return Array.from(links);
}
