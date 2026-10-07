import { asRichHtml } from "./wbVariantStyles";


export const shouldLogHeroVideoDebug = () => typeof window !== "undefined" && process.env.NODE_ENV !== "production";


export function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}


export function snapToGrid(value, size = 24) {
  return Math.round(value / size) * size;
}


export function shouldSkipToolbarBlur(event) {
  return !!event?.relatedTarget?.closest?.('[data-text-toolbar="true"]');
}


export function htmlToPlainText(value) {
  const raw = String(value || "").replace(/\u200b/g, "");
  if (!/[<&]/.test(raw)) return raw;

  if (typeof document !== "undefined") {
    const container = document.createElement("div");
    container.innerHTML = raw;
    return (container.textContent || container.innerText || "").replace(/\u00a0/g, " ");
  }

  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}


export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


export function renderStatLabelHtml(value) {
  const raw = String(value ?? "");
  const looksLikePastedCodeBlock = /<(pre|code)\b/i.test(raw) || /code-block-viewer|cm-content|token-border-light/i.test(raw);
  return looksLikePastedCodeBlock ? escapeHtml(htmlToPlainText(raw).trim()) : asRichHtml(raw);
}
