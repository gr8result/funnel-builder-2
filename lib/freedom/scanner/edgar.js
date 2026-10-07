/**
 * SEC EDGAR client - the primary source for US fundamentals and catalysts.
 *
 * Three free, unauthenticated data.sec.gov/www.sec.gov JSON endpoints:
 *   - company_tickers.json          ticker -> CIK
 *   - submissions/CIK##########.json   recent filings, including each 8-K's item codes
 *   - api/xbrl/companyfacts/CIK##########.json   structured XBRL facts (cash, debt,
 *     shares outstanding, revenue, ...), each with a full history of values
 *
 * SEC requires every automated caller to send an identifying User-Agent
 * (https://www.sec.gov/os/webmaster-faq#code-support) - this never sends a
 * user's personal identity, only an operator contact configured via env var,
 * exactly as SEC's own policy asks for.
 *
 * Every extractor here returns null/UNAVAILABLE rather than a fabricated
 * number when the tag it needs is not present in a given company's XBRL -
 * companies disclose different tags depending on their business.
 */

const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SUBMISSIONS_URL = (cik) => `https://data.sec.gov/submissions/CIK${cik}.json`;
const COMPANY_FACTS_URL = (cik) => `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;

const TICKER_MAP_TTL_MS = 24 * 60 * 60 * 1000;
const FACTS_TTL_MS = 12 * 60 * 60 * 1000;
const SUBMISSIONS_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

const store = globalThis.__freedomEdgarCache || { tickerMap: null, tickerMapAt: 0, facts: new Map(), submissions: new Map() };
globalThis.__freedomEdgarCache = store;

function userAgent() {
  const contact = String(process.env.FREEDOM_EDGAR_CONTACT_EMAIL || process.env.FREEDOM_EDGAR_USER_AGENT || "").trim();
  return contact ? `FreedomOpportunityScanner/1.0 (${contact})` : "FreedomOpportunityScanner/1.0 (contact not configured - set FREEDOM_EDGAR_CONTACT_EMAIL)";
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent(), Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error(`EDGAR request failed: ${response.status} ${response.statusText} (${url})`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function padCik(cik) {
  return String(cik).padStart(10, "0");
}

/** Ticker -> CIK, from SEC's full company list. Cached 24h. */
export async function loadTickerCikMap() {
  if (store.tickerMap && Date.now() - store.tickerMapAt < TICKER_MAP_TTL_MS) return store.tickerMap;
  const raw = await fetchJson(TICKERS_URL);
  const map = new Map();
  for (const row of Object.values(raw || {})) {
    const symbol = normalizeSymbol(row.ticker);
    if (symbol && !map.has(symbol)) map.set(symbol, padCik(row.cik_str));
  }
  store.tickerMap = map;
  store.tickerMapAt = Date.now();
  return map;
}

export async function cikForSymbol(symbol) {
  const map = await loadTickerCikMap();
  return map.get(normalizeSymbol(symbol)) || null;
}

export async function fetchCompanyFacts(cik) {
  const cached = store.facts.get(cik);
  if (cached && Date.now() - cached.fetchedAt < FACTS_TTL_MS) return cached.data;
  const data = await fetchJson(COMPANY_FACTS_URL(cik));
  store.facts.set(cik, { fetchedAt: Date.now(), data });
  return data;
}

export async function fetchSubmissions(cik) {
  const cached = store.submissions.get(cik);
  if (cached && Date.now() - cached.fetchedAt < SUBMISSIONS_TTL_MS) return cached.data;
  const data = await fetchJson(SUBMISSIONS_URL(cik));
  store.submissions.set(cik, { fetchedAt: Date.now(), data });
  return data;
}

// ---------------------------------------------------------------------------
// XBRL fact extraction
// ---------------------------------------------------------------------------

function factSeries(companyFacts, taxonomy, tags) {
  const forTaxonomy = companyFacts?.facts?.[taxonomy];
  if (!forTaxonomy) return null;
  for (const tag of tags) {
    const entry = forTaxonomy[tag];
    const unitKey = entry?.units ? Object.keys(entry.units)[0] : null;
    const series = unitKey ? entry.units[unitKey] : null;
    if (Array.isArray(series) && series.length) return { tag, unit: unitKey, series };
  }
  return null;
}

function mostRecentEntry(series, forms = ["10-Q", "10-K"]) {
  return [...series]
    .filter((e) => !forms.length || forms.includes(e.form))
    .filter((e) => e.end)
    .sort((a, b) => Date.parse(b.end) - Date.parse(a.end))[0] || null;
}

/** The entry whose `end` date is closest to `targetDaysAgo` days before `from`, within `toleranceDays`. */
function nearestPriorEntry(series, from, targetDaysAgo, toleranceDays, forms = ["10-Q", "10-K"]) {
  const targetMs = Date.parse(from) - targetDaysAgo * 86400000;
  let best = null;
  let bestDelta = Infinity;
  for (const entry of series) {
    if (forms.length && !forms.includes(entry.form)) continue;
    if (!entry.end) continue;
    const ms = Date.parse(entry.end);
    if (!Number.isFinite(ms)) continue;
    const delta = Math.abs(ms - targetMs);
    if (delta < bestDelta && delta <= toleranceDays * 86400000) {
      best = entry;
      bestDelta = delta;
    }
  }
  return best;
}

const TAGS = {
  cash: { taxonomy: "us-gaap", names: ["CashAndCashEquivalentsAtCarryingValue", "CashAndCashEquivalentsAtCarryingValueIncludingDiscontinuedOperations", "Cash"] },
  debtCurrent: { taxonomy: "us-gaap", names: ["DebtCurrent", "LongTermDebtCurrent"] },
  debtNoncurrent: { taxonomy: "us-gaap", names: ["LongTermDebtNoncurrent", "LongTermDebt"] },
  sharesOutstanding: { taxonomy: "dei", names: ["EntityCommonStockSharesOutstanding"] },
  revenue: { taxonomy: "us-gaap", names: ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "RevenueFromContractWithCustomerIncludingAssessedTax"] },
  netIncome: { taxonomy: "us-gaap", names: ["NetIncomeLoss"] },
  operatingCashFlow: { taxonomy: "us-gaap", names: ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"] },
  warrants: { taxonomy: "us-gaap", names: ["ClassOfWarrantOrRightOutstanding"] },
  convertibleNotesCurrent: { taxonomy: "us-gaap", names: ["ConvertibleNotesPayableCurrent", "ConvertibleNotesPayable"] },
  convertibleNotesNoncurrent: { taxonomy: "us-gaap", names: ["ConvertibleNotesPayableNoncurrent", "ConvertibleDebtNoncurrent"] },
  goingConcern: { taxonomy: "us-gaap", names: ["SubstantialDoubtAboutGoingConcernTextBlock"] },
};

/**
 * Pulls the fundamentals fields the scanner needs out of a raw companyFacts
 * document, each tagged AVAILABLE/UNAVAILABLE so the caller never has to
 * guess whether a null means "zero" or "not disclosed".
 */
export function extractFundamentalsFromCompanyFacts(companyFacts) {
  const availability = {};
  const result = {};

  const cashSeries = factSeries(companyFacts, TAGS.cash.taxonomy, TAGS.cash.names);
  const cashLatest = cashSeries ? mostRecentEntry(cashSeries.series) : null;
  result.cash = cashLatest ? Number(cashLatest.val) : null;
  availability.cash = cashLatest ? "AVAILABLE" : "UNAVAILABLE";
  if (cashSeries && cashLatest) {
    const prior = nearestPriorEntry(cashSeries.series, cashLatest.end, 91, 30);
    result.cashPriorPeriod = prior ? Number(prior.val) : null;
    result.periodMonths = prior ? round((Date.parse(cashLatest.end) - Date.parse(prior.end)) / (30.44 * 86400000), 1) : null;
  }

  const debtCurrentSeries = factSeries(companyFacts, TAGS.debtCurrent.taxonomy, TAGS.debtCurrent.names);
  const debtNoncurrentSeries = factSeries(companyFacts, TAGS.debtNoncurrent.taxonomy, TAGS.debtNoncurrent.names);
  const debtCurrent = debtCurrentSeries ? mostRecentEntry(debtCurrentSeries.series) : null;
  const debtNoncurrent = debtNoncurrentSeries ? mostRecentEntry(debtNoncurrentSeries.series) : null;
  if (debtCurrent || debtNoncurrent) {
    result.debt = (Number(debtCurrent?.val) || 0) + (Number(debtNoncurrent?.val) || 0);
    availability.debt = "AVAILABLE";
  } else {
    result.debt = null;
    availability.debt = "UNAVAILABLE";
  }

  const sharesSeries = factSeries(companyFacts, TAGS.sharesOutstanding.taxonomy, TAGS.sharesOutstanding.names);
  const sharesLatest = sharesSeries ? mostRecentEntry(sharesSeries.series, []) : null;
  result.sharesOutstanding = sharesLatest ? Number(sharesLatest.val) : null;
  availability.sharesOutstanding = sharesLatest ? "AVAILABLE" : "UNAVAILABLE";
  if (sharesSeries && sharesLatest) {
    const yearAgo = nearestPriorEntry(sharesSeries.series, sharesLatest.end, 365, 60, []);
    result.sharesOutstandingPriorPeriod = yearAgo ? Number(yearAgo.val) : null;
    result.shareCountGrowthPercent = yearAgo && Number(yearAgo.val) > 0
      ? round(((Number(sharesLatest.val) - Number(yearAgo.val)) / Number(yearAgo.val)) * 100, 2)
      : null;
  }

  const revenueSeries = factSeries(companyFacts, TAGS.revenue.taxonomy, TAGS.revenue.names);
  const revenueAnnual = revenueSeries ? mostRecentEntry(revenueSeries.series, ["10-K"]) : null;
  const revenueLatest = revenueAnnual || (revenueSeries ? mostRecentEntry(revenueSeries.series, ["10-Q"]) : null);
  result.revenue = revenueLatest ? Number(revenueLatest.val) : null;
  availability.revenue = revenueLatest ? "AVAILABLE" : "UNAVAILABLE";
  if (revenueSeries && revenueLatest) {
    const priorYear = nearestPriorEntry(revenueSeries.series, revenueLatest.end, 365, 45, [revenueLatest.form]);
    result.revenueGrowthPercent = priorYear && Number(priorYear.val) !== 0
      ? round(((Number(revenueLatest.val) - Number(priorYear.val)) / Math.abs(Number(priorYear.val))) * 100, 2)
      : null;
  }
  availability.revenueGrowthPercent = Number.isFinite(result.revenueGrowthPercent) ? "AVAILABLE" : "UNAVAILABLE";

  const netIncomeSeries = factSeries(companyFacts, TAGS.netIncome.taxonomy, TAGS.netIncome.names);
  const netIncomeLatest = netIncomeSeries ? mostRecentEntry(netIncomeSeries.series) : null;
  result.netIncome = netIncomeLatest ? Number(netIncomeLatest.val) : null;
  if (netIncomeSeries && netIncomeLatest) {
    const priorYear = nearestPriorEntry(netIncomeSeries.series, netIncomeLatest.end, 365, 45, [netIncomeLatest.form]);
    if (priorYear && Number(netIncomeLatest.val) < 0 && Number(priorYear.val) < 0) {
      result.netLossNarrowing = Math.abs(Number(netIncomeLatest.val)) < Math.abs(Number(priorYear.val));
    }
  }

  const ocfSeries = factSeries(companyFacts, TAGS.operatingCashFlow.taxonomy, TAGS.operatingCashFlow.names);
  const ocfLatest = ocfSeries ? mostRecentEntry(ocfSeries.series) : null;
  result.operatingCashFlow = ocfLatest ? Number(ocfLatest.val) : null;
  availability.operatingCashFlow = ocfLatest ? "AVAILABLE" : "UNAVAILABLE";
  if (ocfSeries && ocfLatest) {
    const priorYear = nearestPriorEntry(ocfSeries.series, ocfLatest.end, 365, 45, [ocfLatest.form]);
    result.operatingCashFlowPriorPeriod = priorYear ? Number(priorYear.val) : null;
  }

  const warrantSeries = factSeries(companyFacts, TAGS.warrants.taxonomy, TAGS.warrants.names);
  const warrantLatest = warrantSeries ? mostRecentEntry(warrantSeries.series, []) : null;
  if (warrantLatest && Number.isFinite(result.sharesOutstanding) && result.sharesOutstanding > 0) {
    result.warrantsOutstandingRatio = round(Number(warrantLatest.val) / result.sharesOutstanding, 4);
  }

  const convCurrentSeries = factSeries(companyFacts, TAGS.convertibleNotesCurrent.taxonomy, TAGS.convertibleNotesCurrent.names);
  const convNoncurrentSeries = factSeries(companyFacts, TAGS.convertibleNotesNoncurrent.taxonomy, TAGS.convertibleNotesNoncurrent.names);
  const convCurrent = convCurrentSeries ? mostRecentEntry(convCurrentSeries.series) : null;
  const convNoncurrent = convNoncurrentSeries ? mostRecentEntry(convNoncurrentSeries.series) : null;
  if (convCurrent || convNoncurrent) {
    result.convertibleSecuritiesFaceValue = (Number(convCurrent?.val) || 0) + (Number(convNoncurrent?.val) || 0);
  }

  const goingConcernSeries = factSeries(companyFacts, TAGS.goingConcern.taxonomy, TAGS.goingConcern.names);
  if (goingConcernSeries) {
    const latest = mostRecentEntry(goingConcernSeries.series, []);
    // A recent (within ~9 months) disclosure of this text block means the tag was actually
    // asserted in the most recent filing, not merely present historically.
    result.goingConcernWarning = Boolean(latest && Date.now() - Date.parse(latest.end) < 275 * 86400000);
  } else {
    result.goingConcernWarning = false; // tag absent across all filings ever seen = no disclosed going-concern doubt
  }
  availability.goingConcernWarning = "AVAILABLE"; // absence of the tag is itself meaningful information, not missing data

  result.sourceDate = cashLatest?.filed || revenueLatest?.filed || sharesLatest?.filed || null;
  result.source = "SEC EDGAR (XBRL company facts)";
  result.availability = availability;
  return result;
}

// ---------------------------------------------------------------------------
// Submissions -> catalysts + red-flag inputs
// ---------------------------------------------------------------------------

const ITEM_CATALYST_MEANING = {
  "1.01": { description: "Entry into a material definitive agreement", materiality: "MODERATE" },
  "1.02": { description: "Termination of a material definitive agreement", materiality: "MODERATE" },
  "1.03": { description: "Bankruptcy or receivership", materiality: "MAJOR" },
  "2.01": { description: "Completion of acquisition or disposition of assets", materiality: "MAJOR" },
  "2.02": { description: "Results of operations and financial condition", materiality: "MODERATE" },
  "2.03": { description: "Creation of a direct financial obligation", materiality: "MODERATE" },
  "3.02": { description: "Unregistered sale of equity securities", materiality: "MINOR" },
  "5.02": { description: "Departure/election of directors or officers", materiality: "MINOR" },
  "5.03": { description: "Amendment to articles of incorporation / bylaws", materiality: "MODERATE" },
  "7.01": { description: "Regulation FD disclosure", materiality: "MINOR" },
  "8.01": { description: "Other material events", materiality: "MODERATE" },
};

/**
 * @returns {{ catalysts: Array, redFlagInputs: Object, latestFilings: Array }}
 */
export function extractSignalsFromSubmissions(submissions) {
  const recent = submissions?.filings?.recent;
  if (!recent || !Array.isArray(recent.form)) {
    return { catalysts: [], redFlagInputs: {}, latestFilings: [] };
  }

  const rows = recent.form.map((form, i) => ({
    form,
    filingDate: recent.filingDate?.[i] || null,
    items: (recent.items?.[i] || "").split(",").map((s) => s.trim()).filter(Boolean),
    accessionNumber: recent.accessionNumber?.[i] || null,
    primaryDocument: recent.primaryDocument?.[i] || null,
  }));

  const cutoff90 = Date.now() - 90 * 86400000;
  const cutoff365 = Date.now() - 365 * 86400000;

  const catalysts = [];
  for (const row of rows) {
    if (row.form !== "8-K" || !row.filingDate) continue;
    const filedMs = Date.parse(row.filingDate);
    if (!Number.isFinite(filedMs) || filedMs < cutoff90) continue;
    for (const item of row.items) {
      const meaning = ITEM_CATALYST_MEANING[item];
      if (!meaning) continue;
      catalysts.push({
        description: `8-K Item ${item}: ${meaning.description}`,
        sourceType: "SEC_FILING",
        sourceUrl: filingUrl(submissions, row),
        sourceDate: row.filingDate,
        timing: { type: "DATE", date: row.filingDate, label: "Already disclosed" },
        whyItMatters: meaning.description,
        materiality: meaning.materiality,
      });
    }
  }

  const capitalRaiseCount12m = rows.filter((r) => {
    const filedMs = Date.parse(r.filingDate || "");
    return Number.isFinite(filedMs) && filedMs >= cutoff365 &&
      (r.form === "424B5" || r.form === "424B3" || (r.form === "8-K" && r.items.includes("3.02")));
  }).length;

  const atmFacilityActive = rows.some((r) => {
    const filedMs = Date.parse(r.filingDate || "");
    return r.form === "424B5" && Number.isFinite(filedMs) && filedMs >= cutoff365;
  });

  const exchangeComplianceIssue = rows.some((r) => r.form === "8-K" && r.items.includes("3.01") && Date.parse(r.filingDate || "") >= cutoff365);
  const delistingRisk = exchangeComplianceIssue;
  const auditorProblem = rows.some((r) => r.form === "8-K" && r.items.includes("4.01") && Date.parse(r.filingDate || "") >= cutoff365);
  const reverseSplitLikely = rows.some((r) => r.form === "8-K" && r.items.includes("5.03") && Date.parse(r.filingDate || "") >= (Date.now() - 3 * 365 * 86400000));

  return {
    catalysts,
    redFlagInputs: {
      capitalRaiseCount12m,
      atmFacilityActive,
      exchangeComplianceIssue,
      delistingRisk,
      auditorProblem,
      // Best-effort only: an 8-K Item 5.03 amendment is a NECESSARY but not
      // SUFFICIENT signal of a reverse split (many 5.03 filings are unrelated
      // charter amendments), so this is a lead to verify, not a confirmed fact.
      reverseSplitDates: reverseSplitLikely ? rows.filter((r) => r.form === "8-K" && r.items.includes("5.03")).map((r) => r.filingDate) : [],
    },
    latestFilings: rows.slice(0, 20),
  };
}

function filingUrl(submissions, row) {
  const cik = submissions?.cik ? String(Number(submissions.cik)) : null;
  if (!cik || !row.accessionNumber) return null;
  const accession = row.accessionNumber.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${accession}/${row.primaryDocument || ""}`;
}

function round(value, decimals = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(decimals)) : null;
}
