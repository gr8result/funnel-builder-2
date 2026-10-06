// Retired browsing identifiers only. Never rewrite saved job colours, product IDs or pricing.
export function isInternalPaintColourCategory(value) {
  return String(value || '').trim().toLowerCase().replace(/[ _]+/g, '-') === 'internal-paint-colours';
}

export function paintMaterialCategory(value) {
  return isInternalPaintColourCategory(value) ? 'Painting Materials' : value;
}
