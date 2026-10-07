/**
 * Normalises raw catalyst events (from edgar.js filings, asxAnnouncements.js,
 * or an exchange calendar) into the shape the candidate page renders, and
 * decides CONFIRMED vs SPECULATIVE.
 *
 * A catalyst is only ever CONFIRMED when it both (a) comes from a primary
 * source type and (b) carries a retrievable source date. Either missing keeps
 * it SPECULATIVE - an official source we cannot date-stamp is exactly the kind
 * of "turn a rumour into a confirmed event" mistake the spec forbids.
 */

const PRIMARY_SOURCE_TYPES = new Set(["SEC_FILING", "ASX_ANNOUNCEMENT", "EXCHANGE_CALENDAR"]);

export function classifyCatalyst(raw = {}) {
  if (raw.officiallyConfirmed === false) return "SPECULATIVE";
  const primarySource = PRIMARY_SOURCE_TYPES.has(raw.sourceType);
  const hasSourceDate = Boolean(raw.sourceDate);
  return primarySource && hasSourceDate ? "CONFIRMED" : "SPECULATIVE";
}

/**
 * @param {Object} raw
 * @param {string} raw.description
 * @param {string} raw.sourceType  "SEC_FILING" | "ASX_ANNOUNCEMENT" | "EXCHANGE_CALENDAR" | "ESTIMATE"
 * @param {string} [raw.sourceUrl]
 * @param {string} [raw.sourceDate]  ISO date the source was published/filed
 * @param {Object} [raw.timing]  { type: "DATE"|"WINDOW"|"UNKNOWN", date, windowStart, windowEnd, label }
 * @param {string} [raw.whyItMatters]
 * @param {string} [raw.potentialPositiveEffect]
 * @param {string} [raw.failureConsequence]
 */
export function buildCatalystEntry(raw = {}) {
  const classification = classifyCatalyst(raw);
  const timing = raw.timing && raw.timing.type ? raw.timing : { type: "UNKNOWN", label: "Timing not disclosed." };

  return {
    catalyst: raw.description || null,
    timing,
    classification,
    source: raw.sourceType || null,
    sourceUrl: raw.sourceUrl || null,
    sourceDate: raw.sourceDate || null,
    whyItMatters: raw.whyItMatters || null,
    potentialPositiveEffect: raw.potentialPositiveEffect || null,
    failureConsequence: raw.failureConsequence || null,
  };
}

export function buildCatalysts(rawList = []) {
  return rawList.filter(Boolean).map(buildCatalystEntry);
}

/** The best catalyst to headline with: prefer CONFIRMED, then the nearest-dated one. */
export function primaryCatalyst(catalysts = []) {
  if (!catalysts.length) return null;
  const confirmed = catalysts.filter((c) => c.classification === "CONFIRMED");
  const pool = confirmed.length ? confirmed : catalysts;
  return [...pool].sort((a, b) => timingSortKey(a.timing) - timingSortKey(b.timing))[0];
}

function timingSortKey(timing = {}) {
  const date = timing.date || timing.windowStart;
  const ms = date ? Date.parse(date) : NaN;
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}
