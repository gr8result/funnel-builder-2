// Shared formatting primitives for the Product Library.
// Pure functions only - no DOM, no catalogue imports, so every other
// Product Library module can depend on this one without cycles.

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function money(value) {
  return Number(value || 0).toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
}

export function uniqueValues(values) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

export function swatchLabel(swatch) {
  if (swatch && typeof swatch === "object") return swatch.name || swatch.officialName || swatch.hex || swatch.swatchHex || "Colour";
  return String(swatch || "");
}

export function swatchStyle(swatch) {
  const colour = swatch && typeof swatch === "object" ? swatch.hex || swatch.swatchHex : "";
  return colour ? { "--swatch-colour": colour } : {};
}
