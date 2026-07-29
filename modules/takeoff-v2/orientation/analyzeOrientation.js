// Pure scoring logic for automatic orientation detection — no pdf.js/DOM
// dependency here so it's directly unit-testable. detectPageOrientation.js is
// the thin pdf.js-dependent wrapper that feeds this from a real page's text
// content.

export const ROTATIONS = [0, 90, 180, 270];

export const ARCHITECTURAL_KEYWORDS = [
  "FLOOR PLAN", "GROUND FLOOR", "FIRST FLOOR", "SITE PLAN", "ELEVATION",
  "SECTION", "BEDROOM", "KITCHEN", "BATHROOM", "GARAGE", "LIVING", "DINING",
  "MEDIA", "LAUNDRY", "SCALE", "DRAWING", "PROJECT", "CLIENT", "NOTES",
];

export const CONFIDENCE_HIGH = 80;
export const CONFIDENCE_MEDIUM = 50;
const LANDSCAPE_BONUS = 5;
const METADATA_ROTATION_BONUS = 8;
const KEYWORD_BONUS = 30;
const HORIZONTAL_READABLE_BONUS = 2;
const MIN_TEXT_LENGTH = 2;
const ANGLE_TOLERANCE_DEGREES = 20;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeAngle(angle) {
  return ((angle % 360) + 360) % 360;
}

function isNearZero(angleDegrees) {
  const a = normalizeAngle(angleDegrees);
  return a <= ANGLE_TOLERANCE_DEGREES || a >= 360 - ANGLE_TOLERANCE_DEGREES;
}

function isDimensionOrSymbol(text) {
  const trimmed = text.trim();
  if (trimmed.length < MIN_TEXT_LENGTH) return true;
  // Pure numbers/dimensions/punctuation, e.g. "3600", "1:100", "2.4m", "45°"
  return /^[\d.,:\-\/×xX°'"′″\s]+m{0,2}$/i.test(trimmed);
}

/**
 * Converts one raw pdf.js text-content item into a weighted angle sample.
 * Returns null for items too trivial to carry orientation signal (isolated
 * glyphs/symbols) — dimension-like text is kept but down-weighted, per spec,
 * rather than dropped entirely (still weak evidence).
 */
export function classifyTextItem(item) {
  const text = String(item?.str || "");
  if (!text.trim()) return null;

  const transform = item.transform || [1, 0, 0, 1, 0, 0];
  const [a, b] = transform;
  const fontSize = Math.hypot(a, b) || 1;
  const angle = normalizeAngle(Math.atan2(b, a) * (180 / Math.PI));

  const trimmed = text.trim();
  if (trimmed.length < MIN_TEXT_LENGTH) return null;

  let weight = clamp(fontSize, 4, 40);
  if (isDimensionOrSymbol(trimmed)) weight *= 0.15;

  const upper = trimmed.toUpperCase();
  const isKeyword = ARCHITECTURAL_KEYWORDS.some((keyword) => upper.includes(keyword));
  if (isKeyword) weight += KEYWORD_BONUS;

  return { angle, weight, text: trimmed, isKeyword, x: Number(transform[4]) || 0, y: Number(transform[5]) || 0 };
}

function baselineConsistencyBonus(items) {
  const buckets = new Map();
  for (const item of items) {
    const key = Math.round(item.y / 8) * 8;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  let bonus = 0;
  for (const count of buckets.values()) {
    if (count >= 2) bonus += Math.min(count, 8);
  }
  return bonus;
}

/**
 * Scores all four rotation candidates from pre-classified text samples plus a
 * small landscape prior. Returns per-candidate scores, the best rotation, and
 * a 0-100 confidence expressed as the winning candidate's share of the total
 * score — naturally low when candidates are close/ambiguous, high when one
 * candidate dominates.
 */
export function scoreOrientationCandidates({ textItems = [], sourceWidth = 0, sourceHeight = 0, metadataRotation = 0 }) {
  const scores = { 0: 0, 90: 0, 180: 0, 270: 0 };
  const horizontalItemsByRotation = { 0: [], 90: [], 180: [], 270: [] };

  for (const item of textItems) {
    if (!item) continue;
    for (const rotation of ROTATIONS) {
      const effectiveAngle = item.angle + rotation;
      if (isNearZero(effectiveAngle)) {
        scores[rotation] += item.weight + HORIZONTAL_READABLE_BONUS;
        horizontalItemsByRotation[rotation].push(item);
      }
    }
  }

  for (const rotation of ROTATIONS) {
    scores[rotation] += baselineConsistencyBonus(horizontalItemsByRotation[rotation]);
  }

  const textOnlyTotal = ROTATIONS.reduce((sum, r) => sum + scores[r], 0);
  const hasNativeText = textItems.filter(Boolean).length > 0;

  // Landscape prior: small, deliberately much smaller than a real keyword/text
  // match, so it can break ties on geometry alone but never outvote text
  // evidence.
  for (const rotation of ROTATIONS) {
    const sideways = rotation === 90 || rotation === 270;
    const width = sideways ? sourceHeight : sourceWidth;
    const height = sideways ? sourceWidth : sourceHeight;
    if (width > height) scores[rotation] += LANDSCAPE_BONUS;
  }

  if (ROTATIONS.includes(normalizeAngle(metadataRotation))) {
    scores[normalizeAngle(metadataRotation)] += METADATA_ROTATION_BONUS;
  }

  const total = ROTATIONS.reduce((sum, r) => sum + scores[r], 0);
  const bestRotation = ROTATIONS.reduce((best, r) => (scores[r] > scores[best] ? r : best), 0);
  const confidence = total > 0 ? Math.round((scores[bestRotation] / total) * 100) : 0;

  return {
    scores,
    bestRotation,
    confidence,
    hasNativeText,
    hasSignal: textOnlyTotal > 0,
  };
}

/** high | medium | low | none (none = no usable native text at all). */
export function confidenceTier({ hasSignal, confidence }) {
  if (!hasSignal) return "none";
  if (confidence >= CONFIDENCE_HIGH) return "high";
  if (confidence >= CONFIDENCE_MEDIUM) return "medium";
  return "low";
}
