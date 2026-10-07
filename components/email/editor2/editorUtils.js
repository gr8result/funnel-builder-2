export function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function rich(s) {
  const str = String(s ?? "");
  return /<\/?[a-z][\s\S]*>/i.test(str) ? str : esc(str);
}

export function toAbsoluteUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(data:|mailto:|tel:|#|blob:)/i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (/^https?:/i.test(raw)) return raw;
  const supabaseBase =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    (typeof process !== "undefined" && process.env.SUPABASE_URL) ||
    "";
  if (raw.startsWith("/email-assets/") && supabaseBase) {
    const cleanBase = String(supabaseBase).replace(/\/+$/, "");
    return `${cleanBase}/storage/v1/object/public${raw}`;
  }
  const publicBase =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SITE_URL) ||
    (typeof process !== "undefined" && process.env.SITE_URL) ||
    "";
  const runtimeBase = typeof window !== "undefined" ? window.location.origin : "";
  const base = String(publicBase || runtimeBase || "").replace(/\/$/, "");
  if (raw.startsWith("/") && base) return `${base}${raw}`;
  return raw;
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, Number(v) || 0));
}

export function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}

export function chunkItems(items = [], size = 1) {
  const n = Math.max(1, Number(size) || 1);
  const rows = [];
  for (let i = 0; i < items.length; i += n) rows.push(items.slice(i, i + n));
  return rows;
}

export function pixelWidthFromPercent(totalWidth, percent = 100, horizontalPadding = 0) {
  const safeTotal = Math.max(0, Number(totalWidth || 600) - Number(horizontalPadding || 0));
  const safePercent = clamp(Number(percent || 100), 1, 100);
  return Math.max(1, Math.round((safeTotal * safePercent) / 100));
}

export function clampOverlayCenterPct(value, boxSizePx, containerSizePx, edgePaddingPx = 28) {
  const safeContainer = Math.max(1, Number(containerSizePx || 1));
  const halfBox = Math.max(0, Number(boxSizePx || 0)) / 2;
  const minPct = ((halfBox + Math.max(0, Number(edgePaddingPx || 0))) / safeContainer) * 100;
  const maxPct = 100 - minPct;
  if (minPct >= maxPct) return 50;
  return clamp(Number(value ?? 50), minPct, maxPct);
}
