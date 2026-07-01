const TYPE_PRICING = [
  {
    match: /doors - aluminium sliding|sliding door/i,
    min: 1650,
    base: 1050,
    areaRate: 260,
    panelRate: 120,
    label: "approx sliding door allowance",
  },
  {
    match: /louvre/i,
    min: 520,
    base: 420,
    areaRate: 520,
    panelRate: 55,
    label: "approx louvre window allowance",
  },
  {
    match: /double hung/i,
    min: 560,
    base: 420,
    areaRate: 390,
    panelRate: 55,
    label: "approx double hung window allowance",
  },
  {
    match: /awning/i,
    min: 520,
    base: 390,
    areaRate: 370,
    panelRate: 45,
    label: "approx awning window allowance",
  },
  {
    match: /casement/i,
    min: 520,
    base: 390,
    areaRate: 370,
    panelRate: 45,
    label: "approx casement window allowance",
  },
  {
    match: /sliding/i,
    min: 450,
    base: 330,
    areaRate: 300,
    panelRate: 45,
    label: "approx sliding window allowance",
  },
  {
    match: /fixed/i,
    min: 340,
    base: 260,
    areaRate: 250,
    panelRate: 35,
    label: "approx fixed window allowance",
  },
];

export function windowDoorApproximateRate(row = {}) {
  if (isEntryDoorLike(row)) return "";
  const pricing = windowDoorPricing(row);
  if (!pricing) return "";
  const width = positiveNumber(row.width) || dimensionFromCode(row.code, 1);
  const height = positiveNumber(row.height) || dimensionFromCode(row.code, 0);
  if (!width || !height) return "";
  const area = Math.max(0.1, width * height);
  const panels = panelCount(row.code);
  const rawRate = Math.max(pricing.min, pricing.base + area * pricing.areaRate + panels * pricing.panelRate);
  return money(roundToNearest(rawRate, 10));
}

export function windowDoorApproximateRateSource(row = {}) {
  return windowDoorPricing(row)?.label || "";
}

export function withWindowDoorApproximateRate(row = {}) {
  if (String(row.supplierQuote || "").trim()) return row;
  if (String(row.rate || "").trim() && !isApproximateWindowDoorRate(row)) return row;
  const rate = windowDoorApproximateRate(row);
  if (!rate) return row;
  const source = windowDoorApproximateRateSource(row);
  return {
    ...row,
    rate,
    sourceOfRate: source,
    notes: row.notes || "Approximate initial estimate rate. Confirm with supplier quote.",
  };
}

export function isApproximateWindowDoorRate(row = {}) {
  return String(row.sourceOfRate || "").startsWith("approx ")
    || String(row.notes || "").toLowerCase().includes("approximate initial estimate rate");
}

function windowDoorPricing(row = {}) {
  const text = `${row.section || ""} ${row.type || ""} ${row.code || ""}`;
  return TYPE_PRICING.find((pricing) => pricing.match.test(text)) || null;
}

function isEntryDoorLike(row = {}) {
  const text = `${row.section || ""} ${row.type || ""} ${row.code || ""}`.toLowerCase();
  return text.includes("entry door") || text.includes("garage door") || text.includes("internal door");
}

function positiveNumber(value) {
  const numeric = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function dimensionFromCode(code, index) {
  const match = String(code || "").match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
  if (!match) return 0;
  const value = Number(match[index + 1]);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value > 20 ? value / 1000 : value;
}

function panelCount(code) {
  const match = String(code || "").match(/\b(\d+)\s*(?:L|A|C|T)\b/i);
  return match ? Math.max(0, Number(match[1]) || 0) : 0;
}

function roundToNearest(value, nearest) {
  return Math.round(value / nearest) * nearest;
}

function money(value) {
  return `$${Number(value || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
