export const SCORE_WEIGHTS = {
  businessQuality: 30,
  valuation: 30,
  financialStrength: 15,
  technicalTrend: 10,
  industryOutlook: 10,
  macroEnvironment: 5,
};

export const DEFAULT_CALIBRATION = {
  businessQuality: 30,
  valuation: 30,
  financialStrength: 15,
  technicalTrend: 10,
  industryOutlook: 10,
  macroEnvironment: 5,
};

const CONVICTION_PROFILES = {
  MSFT: {
    competitiveMoat: 99,
    managementQuality: 94,
    cashGeneration: 99,
    recurringRevenue: 98,
    industryLeadership: 98,
    financialDurability: 99,
    innovation: 97,
    marketPosition: 99,
  },
  NVDA: { competitiveMoat: 95, managementQuality: 92, cashGeneration: 94, recurringRevenue: 82, industryLeadership: 99, financialDurability: 92, innovation: 99, marketPosition: 98 },
  V: { competitiveMoat: 97, managementQuality: 92, cashGeneration: 97, recurringRevenue: 94, industryLeadership: 96, financialDurability: 97, innovation: 86, marketPosition: 97 },
  AMZN: { competitiveMoat: 94, managementQuality: 91, cashGeneration: 91, recurringRevenue: 88, industryLeadership: 96, financialDurability: 90, innovation: 96, marketPosition: 97 },
  COST: { competitiveMoat: 92, managementQuality: 91, cashGeneration: 90, recurringRevenue: 86, industryLeadership: 92, financialDurability: 94, innovation: 80, marketPosition: 92 },
  GOOGL: { competitiveMoat: 96, managementQuality: 88, cashGeneration: 98, recurringRevenue: 84, industryLeadership: 96, financialDurability: 98, innovation: 96, marketPosition: 96 },
  AVGO: { competitiveMoat: 91, managementQuality: 90, cashGeneration: 95, recurringRevenue: 88, industryLeadership: 91, financialDurability: 90, innovation: 89, marketPosition: 91 },
  MA: { competitiveMoat: 96, managementQuality: 92, cashGeneration: 96, recurringRevenue: 94, industryLeadership: 95, financialDurability: 97, innovation: 86, marketPosition: 96 },
  ASML: { competitiveMoat: 98, managementQuality: 89, cashGeneration: 90, recurringRevenue: 78, industryLeadership: 99, financialDurability: 89, innovation: 95, marketPosition: 99 },
  TSM: { competitiveMoat: 94, managementQuality: 88, cashGeneration: 91, recurringRevenue: 76, industryLeadership: 97, financialDurability: 88, innovation: 92, marketPosition: 97 },
};

const INDUSTRY_OUTLOOK = [
  { pattern: /software|cloud|ai|digital/i, score: 93, reason: "Cloud software and AI demand remain structurally attractive." },
  { pattern: /semiconductor|equipment/i, score: 91, reason: "Semiconductors remain strategically important, with cyclical risk." },
  { pattern: /payment/i, score: 89, reason: "Global card networks benefit from durable cash-to-card conversion." },
  { pattern: /consumer defensive/i, score: 82, reason: "Defensive retail is resilient but typically grows more slowly." },
  { pattern: /e-commerce/i, score: 88, reason: "E-commerce and cloud infrastructure provide multiple growth drivers." },
];

function clamp(value, min = 0, max = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function round(value, decimals = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(decimals)) : null;
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return null;
  return clean.reduce((total, value) => total + value, 0) / clean.length;
}

function scoreToPoints(rawScore, maxPoints) {
  return round((clamp(rawScore) / 100) * maxPoints, 1);
}

function component({ key, label, max, rawScore, why }) {
  const points = scoreToPoints(rawScore, max);
  return {
    key,
    label,
    max,
    points,
    deduction: round(max - points, 1),
    rawScore: round(clamp(rawScore), 1),
    why,
  };
}

function findHealthCategory(committee, label) {
  const categories = committee?.healthScore?.categories || [];
  return categories.find((category) => String(category.label || "").toLowerCase() === label.toLowerCase())?.score;
}

function valuationRawScore({ quote, valuation }) {
  const currentPrice = Number(quote?.currentPrice);
  const fairValue = Number(valuation?.fairValue ?? quote?.fairValue);
  const explicitMargin = Number(valuation?.marginOfSafety);
  const marginOfSafety =
    Number.isFinite(explicitMargin)
      ? explicitMargin
      : Number.isFinite(currentPrice) && Number.isFinite(fairValue) && fairValue > 0
        ? ((fairValue - currentPrice) / fairValue) * 100
        : null;

  if (!Number.isFinite(marginOfSafety)) {
    const offHigh = Number(quote?.percentOffHigh);
    if (Number.isFinite(offHigh)) return clamp(76 + Math.abs(Math.min(offHigh, 0)) * 0.55, 35, 92);
    return 68;
  }

  if (marginOfSafety >= 30) return 98;
  if (marginOfSafety >= 20) return 92;
  if (marginOfSafety >= 10) return 84;
  if (marginOfSafety >= 0) return 74;
  if (marginOfSafety >= -10) return 58;
  if (marginOfSafety >= -25) return 42;
  return 25;
}

function technicalTrendScore({ quote, history }) {
  const candles = Array.isArray(history) ? history.filter((candle) => Number.isFinite(Number(candle.close))) : [];
  if (candles.length >= 50) {
    const latest = Number(candles[candles.length - 1].close);
    const ma20 = average(candles.slice(-20).map((candle) => Number(candle.close)));
    const ma50 = average(candles.slice(-50).map((candle) => Number(candle.close)));
    const ma200 = candles.length >= 200 ? average(candles.slice(-200).map((candle) => Number(candle.close))) : null;
    let raw = 50;
    if (Number.isFinite(ma20) && latest > ma20) raw += 12;
    if (Number.isFinite(ma50) && latest > ma50) raw += 18;
    if (Number.isFinite(ma200) && latest > ma200) raw += 14;
    if (Number.isFinite(ma20) && Number.isFinite(ma50) && ma20 > ma50) raw += 8;
    if (Number.isFinite(ma50) && Number.isFinite(ma200) && ma50 > ma200) raw += 8;
    if (Number.isFinite(ma50) && latest < ma50) raw -= 18;
    return clamp(raw, 15, 98);
  }

  const dailyChange = Number(quote?.changePercent);
  const offHigh = Number(quote?.percentOffHigh);
  return clamp(70 + (Number.isFinite(dailyChange) ? dailyChange * 2 : 0) + (Number.isFinite(offHigh) ? Math.max(offHigh, -40) * 0.08 : 0), 35, 82);
}

function industryScore(sector) {
  const match = INDUSTRY_OUTLOOK.find((item) => item.pattern.test(String(sector || "")));
  return match || { score: 78, reason: "Industry outlook is acceptable but needs deeper research." };
}

function decisionFromBuyScore(score) {
  if (score >= 95) return "STRONG BUY";
  if (score >= 90) return "BUY";
  if (score >= 80) return "WATCH";
  if (score >= 70) return "HOLD OFF";
  return "AVOID";
}

function convictionLabel(score) {
  if (score >= 95) return "Exceptional Business";
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Strong";
  if (score >= 70) return "Good";
  return "Weak";
}

function confidenceScore({ quote, valuation, committee, history }) {
  let confidence = 58;
  if (Number.isFinite(Number(quote?.currentPrice))) confidence += 10;
  if (Number.isFinite(Number(quote?.yearHigh)) && Number.isFinite(Number(quote?.yearLow))) confidence += 7;
  if (Number.isFinite(Number(valuation?.fairValue))) confidence += 10;
  if (committee?.committeeScore) confidence += 8;
  if (Array.isArray(history) && history.length >= 200) confidence += 7;
  return clamp(confidence, 35, 96);
}

function estimatedUpside({ quote, valuation }) {
  const currentPrice = Number(quote?.currentPrice);
  const fairValue = Number(valuation?.fairValue ?? quote?.fairValue);
  if (!Number.isFinite(currentPrice) || !Number.isFinite(fairValue) || currentPrice <= 0) return null;
  return round(((fairValue - currentPrice) / currentPrice) * 100, 1);
}

function discountToFairValue({ quote, valuation }) {
  const currentPrice = Number(quote?.currentPrice);
  const fairValue = Number(valuation?.fairValue ?? quote?.fairValue);
  if (!Number.isFinite(currentPrice) || !Number.isFinite(fairValue) || fairValue <= 0) return null;
  return round(((fairValue - currentPrice) / fairValue) * 100, 1);
}

function buildConvictionFactors(symbol, quote, committee) {
  const profile = CONVICTION_PROFILES[symbol] || null;
  const fallback = Number.isFinite(Number(quote?.qualityScore)) ? Number(quote.qualityScore) : 75;
  const moat = findHealthCategory(committee, "Competitive Moat");
  const management = findHealthCategory(committee, "Management");
  const innovation = findHealthCategory(committee, "Innovation");
  const durability = findHealthCategory(committee, "Financial Health");

  const factors = [
    ["Competitive moat", moat ?? profile?.competitiveMoat ?? fallback, "Durability of advantages against competitors."],
    ["Management quality", management ?? profile?.managementQuality ?? fallback - 2, "Execution quality and capital allocation."],
    ["Cash generation", durability ?? profile?.cashGeneration ?? fallback, "Ability to turn revenue into durable free cash flow."],
    ["Recurring revenue", profile?.recurringRevenue ?? fallback - 4, "Visibility and repeatability of revenue."],
    ["Industry leadership", profile?.industryLeadership ?? fallback, "Strength of category leadership and scale."],
    ["Financial durability", durability ?? profile?.financialDurability ?? fallback, "Balance sheet resilience through cycles."],
    ["Innovation", innovation ?? profile?.innovation ?? fallback - 3, "Ability to compound through new products and platforms."],
    ["Market position", profile?.marketPosition ?? fallback, "Long-term relevance in the customer ecosystem."],
  ];

  return factors.map(([label, score, why]) => ({ label, score: round(clamp(score), 1), why }));
}

export function calculateAdaptiveScores({ symbol, quote = {}, valuation = null, committee = null, history = [] } = {}) {
  const normalizedSymbol = String(symbol || quote?.symbol || "").toUpperCase();
  const qualityScore = Number(quote?.qualityScore);
  const healthOverall = Number(committee?.healthScore?.overallScore);
  const committeeScore = Number(committee?.committeeScore);
  const sector = quote?.sector || "";
  const industry = industryScore(sector);
  const valuationRaw = valuationRawScore({ quote, valuation });
  const technicalRaw = technicalTrendScore({ quote, history });
  const financialRaw = average([
    Number(findHealthCategory(committee, "Financial Health")),
    Number(findHealthCategory(committee, "Risk")),
    Number.isFinite(qualityScore) ? qualityScore : null,
  ]) ?? (Number.isFinite(qualityScore) ? qualityScore : 76);
  const businessRaw = average([
    Number.isFinite(qualityScore) ? qualityScore : null,
    Number.isFinite(healthOverall) ? healthOverall : null,
    Number.isFinite(committeeScore) ? committeeScore : null,
  ]) ?? 74;

  const components = [
    component({
      key: "businessQuality",
      label: "Business Quality",
      max: SCORE_WEIGHTS.businessQuality,
      rawScore: businessRaw,
      why: "Built from quality score, health score, and committee review where available.",
    }),
    component({
      key: "valuation",
      label: "Valuation",
      max: SCORE_WEIGHTS.valuation,
      rawScore: valuationRaw,
      why: "Rewards margin of safety to fair value and penalizes overvaluation.",
    }),
    component({
      key: "financialStrength",
      label: "Financial Strength",
      max: SCORE_WEIGHTS.financialStrength,
      rawScore: financialRaw,
      why: "Uses financial health, risk profile, and quality score as available.",
    }),
    component({
      key: "technicalTrend",
      label: "Technical Trend",
      max: SCORE_WEIGHTS.technicalTrend,
      rawScore: technicalRaw,
      why: "Uses real price history and moving averages when available.",
    }),
    component({
      key: "industryOutlook",
      label: "Industry Outlook",
      max: SCORE_WEIGHTS.industryOutlook,
      rawScore: industry.score,
      why: industry.reason,
    }),
    component({
      key: "macroEnvironment",
      label: "Macro Environment",
      max: SCORE_WEIGHTS.macroEnvironment,
      rawScore: 72,
      why: "Neutral-positive default until macro calibration has enough history.",
    }),
  ];

  const buyScore = round(components.reduce((total, item) => total + item.points, 0), 0);
  const convictionFactors = buildConvictionFactors(normalizedSymbol, quote, committee);
  const convictionScore = round(average(convictionFactors.map((factor) => factor.score)) ?? 0, 0);
  const decision = decisionFromBuyScore(buyScore);
  const confidence = round(confidenceScore({ quote, valuation, committee, history }), 0);
  const largestContributor = components.slice().sort((a, b) => b.points - a.points)[0] || null;
  const largestDeduction = components.slice().sort((a, b) => b.deduction - a.deduction)[0] || null;
  const topPositives = components
    .filter((item) => item.rawScore >= 82)
    .sort((a, b) => b.rawScore - a.rawScore)
    .slice(0, 4)
    .map((item) => `${item.label}: ${item.why}`);
  const topNegatives = components
    .filter((item) => item.rawScore < 78 || item.deduction >= item.max * 0.25)
    .sort((a, b) => b.deduction - a.deduction)
    .slice(0, 4)
    .map((item) => `${item.label}: deducted ${item.deduction} of ${item.max} points.`);
  const convictionWhy = convictionFactors
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((factor) => `${factor.label} (${factor.score}/100)`);
  const upside = estimatedUpside({ quote, valuation });
  const discount = discountToFairValue({ quote, valuation });

  return {
    symbol: normalizedSymbol,
    buyScore,
    convictionScore,
    convictionLabel: convictionLabel(convictionScore),
    decision,
    confidence,
    components,
    convictionFactors,
    estimatedUpside: upside,
    discountToFairValue: discount,
    reason: `${decision} because the evidence-based Buy Score is ${buyScore}/100 and long-term conviction is ${convictionScore}/100 (${convictionLabel(convictionScore)}).`,
    whyBuyScore: `The Buy Score combines business quality, valuation, financial strength, technical trend, industry outlook and macro environment for a total of ${buyScore}/100.`,
    whyConviction: `Conviction changes slowly and reflects ${convictionWhy.join(", ")}.`,
    topPositives: topPositives.length ? topPositives : ["No dominant positive has enough evidence yet."],
    topNegatives: topNegatives.length ? topNegatives : ["No major deduction is currently dominating the score."],
    largestContributor,
    largestDeduction,
  };
}

export function buildCalibrationSummary(historyRows = []) {
  const rows = Array.isArray(historyRows) ? historyRows : [];
  const reviewed = rows.filter((row) => Number.isFinite(Number(row.one_year_return)) || Number.isFinite(Number(row.six_month_return)));
  const winners = reviewed.filter((row) => Number(row.one_year_return ?? row.six_month_return) > 0);
  const averageReturn = reviewed.length
    ? reviewed.reduce((total, row) => total + Number(row.one_year_return ?? row.six_month_return ?? 0), 0) / reviewed.length
    : null;
  const winRate = reviewed.length ? (winners.length / reviewed.length) * 100 : null;

  return {
    recommendationCount: rows.length,
    reviewedCount: reviewed.length,
    accuracy: reviewed.length ? round(winRate, 1) : null,
    averageReturn: Number.isFinite(averageReturn) ? round(averageReturn, 1) : null,
    winRate: Number.isFinite(winRate) ? round(winRate, 1) : null,
    predictedWinners: reviewed.length ? "Not enough category-level attribution yet." : "Needs six months of score history before review.",
    overestimated: reviewed.filter((row) => Number(row.buy_score) >= 90 && Number(row.one_year_return ?? row.six_month_return) < 0).slice(0, 5),
    underestimated: reviewed.filter((row) => Number(row.buy_score) < 80 && Number(row.one_year_return ?? row.six_month_return) > 10).slice(0, 5),
  };
}
