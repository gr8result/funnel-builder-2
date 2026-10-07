/**
 * ASX company announcements - best effort.
 *
 * There is no documented, contractually-supported free public API for ASX
 * announcements (ASX's official Announcements Platform and market-data feeds
 * are commercial products). The endpoint used below is the same JSON endpoint
 * asx.com.au's own public website calls client-side to render a company's
 * announcements page, so it requires no key - but it is UNDOCUMENTED and
 * unsupported, and can change or start blocking non-browser requests without
 * notice.
 *
 * Because of that, this module never lets an ASX catalyst be silently
 * confused with a verified SEC filing: every result carries
 * `sourceReliability: "UNOFFICIAL_ENDPOINT"` and any failure returns
 * `available: false` with an explicit reason rather than throwing or quietly
 * returning an empty (and misleadingly "clean") list.
 */

const ANNOUNCEMENTS_URL = (code, count) =>
  `https://www.asx.com.au/asx/1/company/${encodeURIComponent(code)}/announcements?count=${count}`;

const FETCH_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const cache = globalThis.__freedomAsxAnnouncementsCache || new Map();
globalThis.__freedomAsxAnnouncementsCache = cache;

function normalizeCode(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/\.AX$/, "");
}

/**
 * @param {string} symbol  e.g. "CBA" or "CBA.AX"
 * @param {number} [count]
 * @returns {Promise<{ available: boolean, reason: string|null, sourceReliability: "UNOFFICIAL_ENDPOINT",
 *                      announcements: Array<{ headline, date, url, priceSensitive }> }>}
 */
export async function fetchAsxAnnouncements(symbol, count = 15) {
  const code = normalizeCode(symbol);
  if (!code) return { available: false, reason: "No ASX code provided.", sourceReliability: "UNOFFICIAL_ENDPOINT", announcements: [] };

  const cached = cache.get(code);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.result;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let result;
  try {
    const response = await fetch(ANNOUNCEMENTS_URL(code, count), {
      headers: { Accept: "application/json", "User-Agent": "FreedomOpportunityScanner/1.0" },
      signal: controller.signal,
    });
    if (!response.ok) {
      result = { available: false, reason: `ASX announcements endpoint returned ${response.status}.`, sourceReliability: "UNOFFICIAL_ENDPOINT", announcements: [] };
    } else {
      const data = await response.json();
      const rows = Array.isArray(data?.data) ? data.data : [];
      result = {
        available: true,
        reason: null,
        sourceReliability: "UNOFFICIAL_ENDPOINT",
        announcements: rows.map((row) => ({
          headline: row.header || row.headline || null,
          date: row.document_date || row.date || null,
          url: row.url ? (row.url.startsWith("http") ? row.url : `https://www.asx.com.au${row.url}`) : null,
          priceSensitive: Boolean(row.market_sensitive),
        })).filter((row) => row.headline),
      };
    }
  } catch (error) {
    result = { available: false, reason: `ASX announcements fetch failed: ${error?.message || "unknown error"}.`, sourceReliability: "UNOFFICIAL_ENDPOINT", announcements: [] };
  } finally {
    clearTimeout(timer);
  }

  cache.set(code, { fetchedAt: Date.now(), result });
  return result;
}

/**
 * Turns raw ASX announcements into the same catalyst shape catalysts.js
 * expects. Every entry is CONFIRMED-eligible (it is an official company
 * disclosure with a date) but source reliability is downstream-visible via
 * `sourceType: "ASX_ANNOUNCEMENT"` plus the fetch-level sourceReliability flag,
 * so the candidate page can still show the caveat next to it.
 */
export function announcementsToCatalystInputs(announcements = []) {
  return announcements.map((row) => ({
    description: row.headline,
    sourceType: "ASX_ANNOUNCEMENT",
    sourceUrl: row.url,
    sourceDate: row.date,
    timing: { type: "DATE", date: row.date, label: "Already disclosed" },
    whyItMatters: row.priceSensitive ? "Marked price-sensitive by the company." : "Company announcement.",
  }));
}
