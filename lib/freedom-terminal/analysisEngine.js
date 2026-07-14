import { normalizeTicker, round, supabaseAdmin } from "./core.js";

const WATCHLIST_META = {
  MSFT: { companyName: "Microsoft", sector: "Software", primaryColour: "#00A4EF", secondaryColour: "#7FBA00", accentColour: "#FFB900" },
  NVDA: { companyName: "NVIDIA", sector: "Semiconductors", primaryColour: "#76B900", secondaryColour: "#0B3D02", accentColour: "#B7FF4A" },
  V: { companyName: "Visa", sector: "Payments", primaryColour: "#1A1F71", secondaryColour: "#F7B600", accentColour: "#4D8DFF" },
  AMZN: { companyName: "Amazon", sector: "Cloud & E-commerce", primaryColour: "#FF9900", secondaryColour: "#232F3E", accentColour: "#FFD15C" },
  COST: { companyName: "Costco", sector: "Consumer Defensive", primaryColour: "#E31837", secondaryColour: "#005DAA", accentColour: "#FFFFFF" },
  GOOGL: { companyName: "Alphabet", sector: "Digital Advertising & AI", primaryColour: "#4285F4", secondaryColour: "#EA4335", accentColour: "#FBBC05" },
  AVGO: { companyName: "Broadcom", sector: "Semiconductors", primaryColour: "#CC092F", secondaryColour: "#7A0019", accentColour: "#FF6B6B" },
  MA: { companyName: "Mastercard", sector: "Payments", primaryColour: "#EB001B", secondaryColour: "#F79E1B", accentColour: "#FFCA4D" },
  ASML: { companyName: "ASML", sector: "Semiconductor Equipment", primaryColour: "#0073CF", secondaryColour: "#00A3E0", accentColour: "#9BE7FF" },
  TSM: { companyName: "Taiwan Semiconductor", sector: "Semiconductors", primaryColour: "#D71920", secondaryColour: "#1B2A57", accentColour: "#64B5F6" },
};

const SECTOR_DEFAULTS = {
  Software: { growth: 0.11, pe: 28, moat: 90, innovation: 88, risk: 78 },
  Semiconductors: { growth: 0.14, pe: 30, moat: 86, innovation: 92, risk: 70 },
  Payments: { growth: 0.1, pe: 27, moat: 91, innovation: 78, risk: 82 },
  "Cloud & E-commerce": { growth: 0.13, pe: 32, moat: 84, innovation: 88, risk: 72 },
  "Consumer Defensive": { growth: 0.08, pe: 28, moat: 86, innovation: 70, risk: 86 },
  "Digital Advertising & AI": { growth: 0.11, pe: 26, moat: 88, innovation: 90, risk: 76 },
  "Semiconductor Equipment": { growth: 0.12, pe: 30, moat: 89, innovation: 91, risk: 70 },
};

const ANALYST_ROLES = [
  ["valueInvestor", "Value Investor"],
  ["growthInvestor", "Growth Investor"],
  ["riskAnalyst", "Risk Analyst"],
  ["industryExpert", "Industry Expert"],
  ["portfolioManager", "Portfolio Manager"],
];

export const ANALYSIS_STAGES = [
  "validating",
  "loading_profile",
  "loading_financials",
  "calculating_scores",
  "calculating_valuation",
  "generating_research",
  "generating_committee",
  "saving",
  "completed",
];

function finnhubKey() {
  return process.env.FINNHUB_API_KEY?.trim() || "";
}

function validSymbol(symbol) {
  return /^[A-Z0-9.\-]{1,12}$/.test(symbol);
}

function score(value) {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Freedom Terminal Company Analysis",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error || `Request failed with status ${response.status}.`);
    error.statusCode = response.status;
    throw error;
  }
  return data;
}

async function fetchFinnhub(path, params) {
  const apiKey = finnhubKey();
  if (!apiKey) throw new Error("FINNHUB_API_KEY is missing on the server.");
  const url = new URL(`https://finnhub.io/api/v1/${path}`);
  Object.entries({ ...params, token: apiKey }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  return fetchJson(url.toString());
}

async function fetchYahooCandles(symbol, range = "5y") {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d&events=history&includePrePost=false`;
  const payload = await fetchJson(url);
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  return timestamps
    .map((timestamp, index) => {
      const open = round(quote.open?.[index]);
      const high = round(quote.high?.[index]);
      const low = round(quote.low?.[index]);
      const close = round(quote.close?.[index]);
      const volume = number(quote.volume?.[index]);
      if (![timestamp, open, high, low, close, volume].every(Number.isFinite)) return null;
      return { timestamp, date: new Date(timestamp * 1000).toISOString().slice(0, 10), open, high, low, close, volume };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function getSectorDefaults(meta, profile) {
  const sector = meta?.sector || profile?.finnhubIndustry || "Software";
  return SECTOR_DEFAULTS[sector] || SECTOR_DEFAULTS[profile?.finnhubIndustry] || { growth: 0.09, pe: 24, moat: 75, innovation: 72, risk: 70 };
}

function scoreExplanation(label, value, reason) {
  return { label, score: value, explanation: reason };
}

function calculateScores({ profile, metrics, valuation, meta, candles }) {
  const defaults = getSectorDefaults(meta, profile);
  const grossMargin = number(metrics.grossMarginTTM);
  const operatingMargin = number(metrics.operatingMarginTTM);
  const netMargin = number(metrics.netProfitMarginTTM);
  const roe = number(metrics.roeTTM);
  const debtToEquity = number(metrics["totalDebt/totalEquityQuarterly"]);
  const revenueGrowth = number(metrics.revenueGrowthTTMYoy);
  const epsGrowth = number(metrics.epsGrowthTTMYoy);
  const fcf = number(metrics.freeCashFlowPerShareTTM);
  const candles1y = candles.slice(-260);
  const latest = candles1y[candles1y.length - 1]?.close;
  const high = candles1y.length ? Math.max(...candles1y.map((candle) => candle.high)) : null;
  const drawdown = Number.isFinite(latest) && Number.isFinite(high) && high > 0 ? ((latest - high) / high) * 100 : null;

  const financialHealth = score(
    52 +
      (Number.isFinite(grossMargin) ? Math.min(grossMargin, 80) * 0.22 : 0) +
      (Number.isFinite(operatingMargin) ? Math.min(operatingMargin, 55) * 0.24 : 0) +
      (Number.isFinite(netMargin) ? Math.min(netMargin, 45) * 0.22 : 0) +
      (Number.isFinite(roe) ? Math.min(roe, 60) * 0.12 : 0) -
      (Number.isFinite(debtToEquity) ? Math.min(debtToEquity, 250) * 0.05 : 0) +
      (Number.isFinite(fcf) && fcf > 0 ? 6 : 0)
  );
  const growth = score(58 + (Number.isFinite(revenueGrowth) ? revenueGrowth * 0.55 : defaults.growth * 100 * 0.45) + (Number.isFinite(epsGrowth) ? epsGrowth * 0.35 : 0));
  const competitiveMoat = score(defaults.moat + (profile?.marketCapitalization > 100000 ? 4 : 0));
  const management = score(72 + (Number.isFinite(roe) ? Math.min(roe, 50) * 0.24 : 0) - (Number.isFinite(debtToEquity) ? Math.min(debtToEquity, 200) * 0.035 : 0));
  const innovation = score(defaults.innovation);
  const valuationScore = score(50 + (Number.isFinite(valuation.marginOfSafety) ? valuation.marginOfSafety * 0.85 : 0) + (Number.isFinite(valuation.expectedFiveYearReturn) ? valuation.expectedFiveYearReturn * 0.55 : 0));
  const risk = score(defaults.risk - (Number.isFinite(drawdown) ? Math.min(Math.abs(drawdown), 50) * 0.16 : 0) - (Number.isFinite(debtToEquity) ? Math.min(debtToEquity, 200) * 0.04 : 0));
  const industryOutlook = score(76 + defaults.growth * 100 * 0.7);
  const confidenceInputs = [profile?.name, metrics?.epsTTM, latest].filter((item) => item !== undefined && item !== null).length;
  const confidence = score(55 + confidenceInputs * 13);
  const overallScore = score(
    financialHealth * 0.18 +
      growth * 0.14 +
      competitiveMoat * 0.17 +
      management * 0.1 +
      innovation * 0.1 +
      valuationScore * 0.12 +
      risk * 0.11 +
      industryOutlook * 0.08
  );

  const scoreExplanations = {
    financialHealth: scoreExplanation("Financial Health", financialHealth, "Based on Finnhub profitability, margin, free-cash-flow and debt metrics where available."),
    growth: scoreExplanation("Growth", growth, "Based on available revenue and EPS growth metrics, with sector estimates used only when Finnhub does not provide a metric."),
    competitiveMoat: scoreExplanation("Competitive Moat", competitiveMoat, "Based on market position indicators from profile data and sector characteristics."),
    management: scoreExplanation("Management", management, "Based on execution proxies including returns, profitability and balance-sheet discipline."),
    innovation: scoreExplanation("Innovation", innovation, "Based on the company industry profile and product-market expansion characteristics."),
    valuation: scoreExplanation("Valuation", valuationScore, "Based on current price compared with the EPS multiple fair-value estimate."),
    risk: scoreExplanation("Risk", risk, "Higher scores indicate lower observed business and financial risk using debt, cyclicality and recent drawdown indicators."),
    industryOutlook: scoreExplanation("Industry Outlook", industryOutlook, "Based on the long-term demand profile of the reported industry."),
  };

  return { overallScore, financialHealth, growth, competitiveMoat, management, innovation, valuation: valuationScore, risk, industryOutlook, confidence, scoreExplanations };
}

function calculateValuation({ metrics, quote, profile, meta }) {
  const defaults = getSectorDefaults(meta, profile);
  const currentPrice = round(quote?.c);
  const currentEPS = round(metrics?.epsTTM ?? metrics?.epsExclExtraItemsTTM ?? metrics?.epsBasicExclExtraItemsTTM);
  const expectedEPSGrowth = round(number(metrics?.epsGrowth5Y) ?? number(metrics?.epsGrowthTTMYoy) ?? defaults.growth * 100);
  const terminalPE = round(number(metrics?.peNormalizedAnnual) || number(metrics?.peTTM) || defaults.pe);
  const requiredReturn = 10;
  const usableEPS = Number.isFinite(currentEPS) && currentEPS > 0 ? currentEPS : null;
  const growthRate = Math.max(-0.05, Math.min((expectedEPSGrowth || defaults.growth * 100) / 100, 0.3));
  const terminalMultiple = Math.max(8, Math.min(terminalPE || defaults.pe, 45));

  if (!usableEPS) {
    return {
      valuationMethod: "EPS multiple",
      currentEPS: null,
      expectedEPSGrowth: round(growthRate * 100),
      terminalPE: terminalMultiple,
      requiredReturn,
      fairValue: null,
      buyBelow: null,
      strongBuyBelow: null,
      expensiveAbove: null,
      expectedFiveYearReturn: null,
      marginOfSafety: null,
      valuationRating: "WATCH",
      assumptionsSource: "Estimate incomplete: Finnhub EPS unavailable.",
    };
  }

  const futureEPS = usableEPS * Math.pow(1 + growthRate, 5);
  const futurePrice = futureEPS * terminalMultiple;
  const fairValue = futurePrice / Math.pow(1 + requiredReturn / 100, 5);
  const buyBelow = fairValue * 0.85;
  const strongBuyBelow = fairValue * 0.75;
  const expensiveAbove = fairValue * 1.2;
  const marginOfSafety = Number.isFinite(currentPrice) ? ((fairValue - currentPrice) / fairValue) * 100 : null;
  const expectedFiveYearReturn = Number.isFinite(currentPrice) && currentPrice > 0 ? (Math.pow(futurePrice / currentPrice, 1 / 5) - 1) * 100 : null;
  let valuationRating = "WATCH";
  if (Number.isFinite(currentPrice)) {
    if (currentPrice <= strongBuyBelow) valuationRating = "STRONG BUY";
    else if (currentPrice <= buyBelow) valuationRating = "BUY";
    else if (currentPrice <= fairValue) valuationRating = "WATCH";
    else if (currentPrice > expensiveAbove) valuationRating = "HOLD OFF";
  }

  return {
    valuationMethod: "EPS multiple",
    currentEPS: usableEPS,
    expectedEPSGrowth: round(growthRate * 100),
    terminalPE: terminalMultiple,
    requiredReturn,
    fairValue: round(fairValue),
    buyBelow: round(buyBelow),
    strongBuyBelow: round(strongBuyBelow),
    expensiveAbove: round(expensiveAbove),
    expectedFiveYearReturn: round(expectedFiveYearReturn),
    marginOfSafety: round(marginOfSafety),
    valuationRating,
    assumptionsSource: "Estimates derived from Finnhub metrics plus sector-normalised defaults where a metric is unavailable.",
  };
}

function buildResearch({ symbol, profile, metrics, meta, scores, valuation, warnings }) {
  const name = profile?.name || meta?.companyName || symbol;
  const industry = profile?.finnhubIndustry || meta?.sector || "its reported industry";
  const marketCap = number(profile?.marketCapitalization);
  const margin = number(metrics?.operatingMarginTTM);
  const epsGrowth = number(metrics?.epsGrowthTTMYoy);
  const status = warnings.length ? "stale_partial" : "completed";
  const metricText = [
    Number.isFinite(marketCap) ? `Finnhub reports market capitalisation of about ${round(marketCap / 1000, 1)}B in profile currency units` : null,
    Number.isFinite(margin) ? `operating margin of ${round(margin, 1)}%` : null,
    Number.isFinite(epsGrowth) ? `EPS growth of ${round(epsGrowth, 1)}%` : null,
  ].filter(Boolean);

  return {
    businessSummary: `${name} is a listed company in ${industry}. ${metricText.length ? metricText.join(", ") + "." : "The available profile data is limited, so this summary is restricted to verified provider fields."}`,
    investmentThesis: `${name} earns a quality score of ${scores.overallScore}/100 using the Freedom Terminal rules. The thesis is based on business quality, available profitability/growth metrics, industry outlook and the current EPS-multiple valuation estimate.`,
    whyWeLikeIt: `The strongest measured factors are ${bestScoreLabels(scores).join(", ")}. These are calculated from provider metrics and sector characteristics, not from scraped third-party commentary.`,
    competitiveAdvantage: `Competitive advantage score is ${scores.competitiveMoat}/100. The score reflects the company's reported industry, scale indicators and the durability characteristics normally associated with that business model.`,
    keyRisks: `Key risks include valuation sensitivity, competition, execution risk, macro conditions and any company-specific source gaps noted in this analysis. ${warnings.length ? `Source gaps: ${warnings.join(" ")}` : ""}`.trim(),
    bullCase: `The bull case requires sustained earnings growth near the stored assumption of ${valuation.expectedEPSGrowth}% and a terminal multiple near ${valuation.terminalPE}x.`,
    bearCase: `The bear case is that growth slows, margins compress, or the market assigns a lower multiple than the current EPS model assumes.`,
    researchStatus: status,
    sourceNotes: `Sources: Finnhub profile, quote and metrics; Yahoo Finance historical OHLC. ${valuation.assumptionsSource}`,
  };
}

function bestScoreLabels(scores) {
  return [
    ["financial health", scores.financialHealth],
    ["growth", scores.growth],
    ["competitive moat", scores.competitiveMoat],
    ["management", scores.management],
    ["innovation", scores.innovation],
    ["industry outlook", scores.industryOutlook],
  ]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => label);
}

function makeAnalyst(role, baseScore, decision, reasoning) {
  return { role, score: score(baseScore), decision, summary: reasoning };
}

function buildCommittee({ profile, meta, scores, valuation, research }) {
  const name = profile?.name || meta?.companyName || "The company";
  const valueScore = score((scores.valuation + scores.financialHealth) / 2);
  const growthScore = score((scores.growth + scores.innovation + scores.industryOutlook) / 3);
  const riskScore = score(scores.risk);
  const industryScore = score((scores.competitiveMoat + scores.industryOutlook) / 2);
  const portfolioScore = score(scores.overallScore * 0.7 + scores.risk * 0.3);
  const committeeScore = score((valueScore + growthScore + riskScore + industryScore + portfolioScore) / 5);
  let overallDecision = "WATCH";
  if (valuation.valuationRating === "STRONG BUY" && committeeScore >= 82) overallDecision = "STRONG BUY";
  else if (valuation.valuationRating === "BUY" && committeeScore >= 78) overallDecision = "BUY";
  else if (valuation.valuationRating === "WATCH") overallDecision = "WATCH";
  else if (valuation.valuationRating === "HOLD OFF") overallDecision = committeeScore >= 82 ? "WATCH" : "HOLD OFF";
  else if (committeeScore < 55) overallDecision = "AVOID";

  const valueInvestor = makeAnalyst("Value Investor", valueScore, valuation.valuationRating || "WATCH", `Fair value is estimated at ${moneyOrDash(valuation.fairValue)} using the EPS multiple model. The value view depends on margin of safety, not price momentum.`);
  const growthInvestor = makeAnalyst("Growth Investor", growthScore, growthScore >= 82 ? "BUY" : "WATCH", `${name} scores ${scores.growth}/100 for growth and ${scores.innovation}/100 for innovation based on available metrics and industry profile.`);
  const riskAnalyst = makeAnalyst("Risk Analyst", riskScore, riskScore >= 80 ? "WATCH" : "HOLD OFF", `Risk score is ${scores.risk}/100. This review considers financial risk, competition, cyclicality and source completeness.`);
  const industryExpert = makeAnalyst("Industry Expert", industryScore, industryScore >= 82 ? "BUY" : "WATCH", `Industry outlook is ${scores.industryOutlook}/100 and competitive moat is ${scores.competitiveMoat}/100.`);
  const portfolioManager = makeAnalyst("Portfolio Manager", portfolioScore, overallDecision, `Portfolio view reconciles business quality, valuation, risk and concentration. ${research.bullCase}`);

  return {
    overallDecision,
    committeeScore,
    confidence: scores.confidence,
    valueInvestor,
    growthInvestor,
    riskAnalyst,
    industryExpert,
    portfolioManager,
    finalSummary: `${name} is classified as ${overallDecision}. The decision reconciles quality score ${scores.overallScore}/100, valuation rating ${valuation.valuationRating}, risk score ${scores.risk}/100 and the available source quality.`,
  };
}

function moneyOrDash(value) {
  return Number.isFinite(value) ? `$${value.toFixed(2)}` : "not available";
}

async function upsertFreedomCompany({ symbol, profile, meta }) {
  const payload = {
    symbol,
    company_name: profile?.name || meta?.companyName || symbol,
    exchange: profile?.exchange || null,
    sector: meta?.sector || profile?.finnhubIndustry || null,
    industry: profile?.finnhubIndustry || meta?.sector || null,
    currency: profile?.currency || "USD",
    country: profile?.country || null,
    website: profile?.weburl || null,
    description: profile?.description || null,
    logo_url: profile?.logo || null,
    primary_colour: meta?.primaryColour || null,
    secondary_colour: meta?.secondaryColour || null,
    accent_colour: meta?.accentColour || null,
    raw_profile: profile || {},
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseAdmin.from("freedom_companies").upsert(payload, { onConflict: "symbol" }).select("*").maybeSingle();
  if (error) throw error;
  return data;
}

async function upsertAnalysisRows(companyId, { research, scores, valuation, committee }) {
  const now = new Date().toISOString();
  const operations = [
    supabaseAdmin.from("freedom_research").upsert({
      company_id: companyId,
      business_summary: research.businessSummary,
      investment_thesis: research.investmentThesis,
      why_we_like_it: research.whyWeLikeIt,
      competitive_advantage: research.competitiveAdvantage,
      key_risks: research.keyRisks,
      bull_case: research.bullCase,
      bear_case: research.bearCase,
      research_status: research.researchStatus,
      source_notes: research.sourceNotes,
      last_updated: now,
    }, { onConflict: "company_id" }),
    supabaseAdmin.from("freedom_scores").upsert({
      company_id: companyId,
      overall_score: scores.overallScore,
      financial_health: scores.financialHealth,
      growth: scores.growth,
      competitive_moat: scores.competitiveMoat,
      management: scores.management,
      innovation: scores.innovation,
      valuation: scores.valuation,
      risk: scores.risk,
      industry_outlook: scores.industryOutlook,
      confidence: scores.confidence,
      score_explanations: scores.scoreExplanations,
      last_updated: now,
    }, { onConflict: "company_id" }),
    supabaseAdmin.from("freedom_valuations").upsert({
      company_id: companyId,
      valuation_method: valuation.valuationMethod,
      current_eps: valuation.currentEPS,
      expected_eps_growth: valuation.expectedEPSGrowth,
      terminal_pe: valuation.terminalPE,
      required_return: valuation.requiredReturn,
      fair_value: valuation.fairValue,
      buy_below: valuation.buyBelow,
      strong_buy_below: valuation.strongBuyBelow,
      expensive_above: valuation.expensiveAbove,
      expected_five_year_return: valuation.expectedFiveYearReturn,
      margin_of_safety: valuation.marginOfSafety,
      valuation_rating: valuation.valuationRating,
      assumptions_source: valuation.assumptionsSource,
      last_updated: now,
    }, { onConflict: "company_id" }),
    supabaseAdmin.from("freedom_committee_reviews").upsert({
      company_id: companyId,
      overall_decision: committee.overallDecision,
      committee_score: committee.committeeScore,
      confidence: committee.confidence,
      value_investor: committee.valueInvestor,
      growth_investor: committee.growthInvestor,
      risk_analyst: committee.riskAnalyst,
      industry_expert: committee.industryExpert,
      portfolio_manager: committee.portfolioManager,
      final_summary: committee.finalSummary,
      last_updated: now,
    }, { onConflict: "company_id" }),
  ];
  const results = await Promise.all(operations);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

export async function analyseCompany(symbolInput) {
  const symbol = normalizeTicker(symbolInput);
  const progress = ["validating"];
  if (!validSymbol(symbol)) {
    const error = new Error("Provide a valid ticker, such as AMZN.");
    error.statusCode = 400;
    throw error;
  }

  const meta = WATCHLIST_META[symbol] || { companyName: symbol, sector: null };
  const warnings = [];
  progress.push("loading_profile");
  const profile = await fetchFinnhub("stock/profile2", { symbol }).catch((error) => {
    warnings.push(`Profile unavailable: ${error.message}`);
    return {};
  });
  const quote = await fetchFinnhub("quote", { symbol }).catch((error) => {
    warnings.push(`Quote unavailable: ${error.message}`);
    return {};
  });
  progress.push("loading_financials");
  const metricPayload = await fetchFinnhub("stock/metric", { symbol, metric: "all" }).catch((error) => {
    warnings.push(`Financial metrics unavailable: ${error.message}`);
    return {};
  });
  const metrics = metricPayload?.metric || {};
  const candles = await fetchYahooCandles(symbol, "5y").catch((error) => {
    warnings.push(`Historical prices unavailable: ${error.message}`);
    return [];
  });

  progress.push("calculating_scores");
  const valuation = calculateValuation({ metrics, quote, profile, meta });
  const scores = calculateScores({ profile, metrics, valuation, meta, candles });
  progress.push("calculating_valuation");
  progress.push("generating_research");
  const research = buildResearch({ symbol, profile, metrics, meta, scores, valuation, warnings });
  progress.push("generating_committee");
  const committee = buildCommittee({ profile, meta, scores, valuation, research });
  progress.push("saving");
  const company = await upsertFreedomCompany({ symbol, profile, meta });
  await upsertAnalysisRows(company.id, { research, scores, valuation, committee });
  progress.push("completed");

  return {
    ok: true,
    symbol,
    stages: progress,
    company,
    research,
    scores,
    valuation,
    committee,
    sourceStatus: {
      profile: Boolean(profile?.name),
      quote: Number.isFinite(number(quote?.c)),
      financials: Object.keys(metrics).length > 0,
      history: candles.length > 0,
    },
    warnings,
    completedAt: new Date().toISOString(),
  };
}

export async function loadStoredAnalysis(symbolInput) {
  const symbol = normalizeTicker(symbolInput);
  if (!validSymbol(symbol)) return null;
  const { data: company, error: companyError } = await supabaseAdmin.from("freedom_companies").select("*").eq("symbol", symbol).maybeSingle();
  if (companyError) throw companyError;
  if (!company?.id) return null;

  const [researchResult, scoresResult, valuationResult, committeeResult] = await Promise.all([
    supabaseAdmin.from("freedom_research").select("*").eq("company_id", company.id).maybeSingle(),
    supabaseAdmin.from("freedom_scores").select("*").eq("company_id", company.id).maybeSingle(),
    supabaseAdmin.from("freedom_valuations").select("*").eq("company_id", company.id).maybeSingle(),
    supabaseAdmin.from("freedom_committee_reviews").select("*").eq("company_id", company.id).maybeSingle(),
  ]);

  for (const result of [researchResult, scoresResult, valuationResult, committeeResult]) {
    if (result.error) throw result.error;
  }

  return {
    company,
    research: researchResult.data || null,
    scores: scoresResult.data || null,
    valuation: valuationResult.data || null,
    committee: committeeResult.data || null,
  };
}

export function serializeStoredResearch(symbol, analysis) {
  const research = analysis?.research;
  const valuation = analysis?.valuation;
  return {
    id: research?.id || null,
    companyId: analysis?.company?.id || null,
    symbol,
    ticker: symbol,
    fairValue: valuation?.fair_value ?? "",
    buyBelow: valuation?.buy_below ?? "",
    decision: valuation?.valuation_rating || analysis?.committee?.overall_decision || "",
    thesis: research?.investment_thesis || "",
    whyWeLikeIt: research?.why_we_like_it || "",
    keyRisks: research?.key_risks || "",
    businessSummary: research?.business_summary || "",
    competitiveAdvantage: research?.competitive_advantage || "",
    bullCase: research?.bull_case || "",
    bearCase: research?.bear_case || "",
    researchStatus: research?.research_status || "not_started",
    sourceNotes: research?.source_notes || "",
    updatedAt: research?.last_updated || valuation?.last_updated || null,
  };
}

export function serializeStoredValuation(symbol, analysis) {
  const row = analysis?.valuation;
  if (!row) return null;
  return {
    ok: true,
    symbol,
    fairValue: row.fair_value,
    buyBelow: row.buy_below,
    strongBuyBelow: row.strong_buy_below,
    expensiveAbove: row.expensive_above,
    marginOfSafety: row.margin_of_safety,
    expectedFiveYearReturn: row.expected_five_year_return,
    valuationRating: row.valuation_rating,
    assumptions: {
      currentEPS: row.current_eps,
      expectedEPSGrowth: row.expected_eps_growth,
      terminalPE: row.terminal_pe,
      requiredReturn: row.required_return,
      marginOfSafetyTarget: 15,
    },
    assumptionsSource: row.assumptions_source,
    lastUpdated: row.last_updated,
    error: null,
  };
}

export function serializeStoredCommittee(symbol, analysis) {
  const row = analysis?.committee;
  const scores = analysis?.scores;
  if (!row) return null;
  const categories = scores?.score_explanations
    ? Object.values(scores.score_explanations).map((item) => ({
        label: item.label,
        score: item.score,
        explanation: item.explanation,
      }))
    : [];

  return {
    symbol,
    overallDecision: row.overall_decision,
    committeeScore: row.committee_score,
    confidence: row.confidence,
    healthScore: scores
      ? {
          overallScore: scores.overall_score,
          categories,
        }
      : null,
    analysts: ANALYST_ROLES.map(([key]) => row[camelToSnake(key)]).filter(Boolean),
    finalSummary: row.final_summary,
    lastUpdated: row.last_updated,
  };
}

function camelToSnake(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
