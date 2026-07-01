export function htmlEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

export function addDays(base, n) {
  const d = new Date(base); d.setDate(d.getDate() + n); return d;
}

export function dateISO(value) {
  const d = new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function domSafeId(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

export function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtMoney(value) {
  const amount = Number(value) || 0;
  return amount.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: amount % 1 ? 2 : 0 });
}
