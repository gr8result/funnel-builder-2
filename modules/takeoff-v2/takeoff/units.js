// Unit parsing/formatting for the takeoff tools. All real-world values are
// stored internally in millimetres, per spec.

const UNIT_TO_MM = { mm: 1, cm: 10, m: 1000 };

// Accepts "6000", "6000 mm", "6 m", "6000mm", "6m", "6 cm" etc. Returns a
// positive finite mm value, or null if the input is invalid/zero/negative.
export function parseDistanceInput(text, defaultUnit = "mm") {
  if (text == null) return null;
  const raw = String(text).trim().toLowerCase();
  const match = raw.match(/^(-?[\d.,]+)\s*(mm|cm|m)?$/);
  if (!match) return null;
  const numeric = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const unit = match[2] || defaultUnit;
  const factor = UNIT_TO_MM[unit];
  if (!factor) return null;
  return numeric * factor;
}

export function formatLength(mm) {
  if (!Number.isFinite(mm)) return "";
  if (Math.abs(mm) < 1000) return `${Math.round(mm)} mm`;
  return `${(mm / 1000).toFixed(2)} m`;
}

export function formatArea(m2) {
  if (!Number.isFinite(m2)) return "";
  return `${m2.toFixed(2)} m²`;
}

// 1 PDF point = 1/72 inch = 25.4/72 mm of *paper*, regardless of zoom/scale.
export const PAPER_MM_PER_DOC_UNIT = 25.4 / 72;

const COMMON_SCALES = [1, 2, 5, 10, 20, 25, 50, 75, 100, 125, 150, 200, 250, 500, 1000, 2000, 5000];

// Purely a display approximation ("1:100") — never used in calculations.
export function approximateDrawingScale(mmPerDocumentUnit) {
  if (!Number.isFinite(mmPerDocumentUnit) || mmPerDocumentUnit <= 0) return null;
  const rawDenominator = mmPerDocumentUnit / PAPER_MM_PER_DOC_UNIT;
  let nearest = COMMON_SCALES[0];
  let bestDiff = Infinity;
  for (const candidate of COMMON_SCALES) {
    const diff = Math.abs(candidate - rawDenominator) / rawDenominator;
    if (diff < bestDiff) {
      bestDiff = diff;
      nearest = candidate;
    }
  }
  const denominator = bestDiff <= 0.12 ? nearest : Math.round(rawDenominator);
  return `1:${denominator}`;
}
