export const INVESTMENT_STATUSES = ["ATTRACTIVE", "FAIR VALUE", "WATCH", "EXPENSIVE", "AVOID", "DATA INSUFFICIENT"];

function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, decimals = 1) {
  const number = num(value);
  return number === null ? null : Number(number.toFixed(decimals));
}

function clamp(value, min = 0, max = 100) {
  const number = num(value);
  if (number === null) return null;
  return Math.max(min, Math.min(max, number));
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length ? clean.reduce((total, value) => total + value, 0) / clean.length : null;
}

function metric(metrics = {}, ...names) {
  for (const name of names) {
    const value = num(metrics[name]);
    if (value !== null) return value;
  }
  return null;
}

function scoreMargin(value, excellent, weak) {
  if (!Number.isFinite(value)) return null;
  return clamp(((value - weak) / (excellent - weak)) * 70 + 25);
}

function scoreGrowth(value) {
  if (!Number.isFinite(value)) return null;
  if (value >= 20) return 95;
  if (value >= 12) return 84;
  if (value >= 6) return 72;
  if (value >= 0) return 58;
  if (value >= -8) return 38;
  return 18;
}

function labelByScore(score, labels) {
  const value = num(score);
  if (value === null) return labels.insufficient;
  if (value >= 85) return labels.top;
  if (value >= 72) return labels.strong;
  if (value >= 55) return labels.acceptable;
  if (value >= 38) return labels.weak;
  return labels.bottom;
}

export function assessFinancialStrength(metrics = {}) {
  const grossMargin = metric(metrics, "grossMarginTTM");
  const operatingMargin = metric(metrics, "operatingMarginTTM");
  const netMargin = metric(metrics, "netProfitMarginTTM", "netMarginTTM");
  const roe = metric(metrics, "roeTTM");
  const debtToEquity = metric(metrics, "totalDebt/totalEquityQuarterly", "totalDebt/totalEquityAnnual");
  const currentRatio = metric(metrics, "currentRatioQuarterly", "currentRatioAnnual");
  const interestCoverage = metric(metrics, "interestCoverageTTM", "interestCoverageAnnual");
  const fcfPerShare = metric(metrics, "freeCashFlowPerShareTTM", "fcfPerShareTTM");

  const inputs = [
    scoreMargin(grossMargin, 70, 15),
    scoreMargin(operatingMargin, 35, 3),
    scoreMargin(netMargin, 28, 0),
    scoreMargin(roe, 32, 2),
    debtToEquity === null ? null : clamp(92 - Math.max(0, debtToEquity - 35) * 0.35),
    currentRatio === null ? null : clamp(45 + Math.min(currentRatio, 3) * 18),
    interestCoverage === null ? null : clamp(45 + Math.min(interestCoverage, 20) * 2.4),
    fcfPerShare === null ? null : fcfPerShare > 0 ? 78 : 28,
  ];
  const score = round(average(inputs), 0);
  const availableInputs = inputs.filter(Number.isFinite).length;
  const classification = availableInputs < 3
    ? "DATA INSUFFICIENT"
    : labelByScore(score, { top: "EXCELLENT", strong: "STRONG", acceptable: "ACCEPTABLE", weak: "WEAK", bottom: "HIGH RISK", insufficient: "DATA INSUFFICIENT" });
  const reasons = [];
  if (fcfPerShare !== null) reasons.push(fcfPerShare > 0 ? "generates positive free cash flow" : "does not show positive free cash flow");
  if (debtToEquity !== null) reasons.push(debtToEquity <= 80 ? "debt appears manageable" : "debt is elevated");
  if (netMargin !== null) reasons.push(netMargin > 10 ? "profit margins are healthy" : "profit margins are thin");
  return {
    score,
    classification,
    explanation: availableInputs < 3
      ? "There is not enough reliable financial data to assess balance-sheet strength."
      : `The company ${reasons.length ? reasons.join(", ") : "has mixed but usable financial strength data"}.`,
    inputs: { grossMargin, operatingMargin, netMargin, roe, debtToEquity, currentRatio, interestCoverage, fcfPerShare },
  };
}

export function assessGrowth(metrics = {}) {
  const revenueGrowth = metric(metrics, "revenueGrowthTTMYoy", "revenueGrowth5Y");
  const epsGrowth = metric(metrics, "epsGrowthTTMYoy", "epsGrowth5Y");
  const fcfGrowth = metric(metrics, "freeCashFlowGrowth5Y", "fcfGrowth5Y");
  const growthInputs = [scoreGrowth(revenueGrowth), scoreGrowth(epsGrowth), scoreGrowth(fcfGrowth)];
  const score = round(average(growthInputs), 0);
  const availableInputs = growthInputs.filter(Number.isFinite).length;
  let classification = "INSUFFICIENT DATA";
  if (availableInputs >= 2) {
    if (score >= 82) classification = "STRONG GROWTH";
    else if (score >= 65) classification = "MODERATE GROWTH";
    else if (score >= 48) classification = "STABLE";
    else classification = "DECLINING";
  }
  return {
    score,
    classification,
    explanation: availableInputs < 2
      ? "There is not enough multi-metric history to classify long-term growth."
      : `Growth classification uses revenue, earnings and cash-flow trends where available, not a single quarter.`,
    inputs: { revenueGrowth, epsGrowth, fcfGrowth },
  };
}

export function assessBusinessQuality(metrics = {}, profile = {}) {
  const financial = assessFinancialStrength(metrics);
  const growth = assessGrowth(metrics);
  const grossMargin = metric(metrics, "grossMarginTTM");
  const operatingMargin = metric(metrics, "operatingMarginTTM");
  const roe = metric(metrics, "roeTTM");
  const marketCap = num(profile.marketCapitalization);
  const qualityInputs = [
    financial.score,
    growth.score,
    scoreMargin(grossMargin, 70, 15),
    scoreMargin(operatingMargin, 35, 3),
    scoreMargin(roe, 32, 2),
  ];
  const availableQualityInputs = qualityInputs.filter(Number.isFinite).length;
  const durability = average([
    financial.score,
    scoreMargin(grossMargin, 70, 15),
    scoreMargin(operatingMargin, 35, 3),
    scoreMargin(roe, 32, 2),
    marketCap === null ? null : clamp(52 + Math.log10(Math.max(marketCap, 1)) * 7, 45, 92),
  ]);
  const score = availableQualityInputs < 3 ? null : round(average([durability, financial.score, growth.score]), 0);
  return {
    score,
    label: score === null ? "DATA INSUFFICIENT" : score >= 85 ? "EXCELLENT" : score >= 72 ? "STRONG" : score >= 58 ? "ACCEPTABLE" : score >= 42 ? "WEAK" : "HIGH RISK",
    explanation: score === null
      ? "Business quality cannot be scored without reliable profitability, growth or financial strength inputs."
      : "Business quality combines profitability, cash generation, financial strength, growth and business scale.",
    components: { financialStrength: financial.score, growth: growth.score, durability: round(durability, 0) },
  };
}

export function assessValuation({ metrics = {}, quote = {}, growth = null } = {}) {
  const currentPrice = num(quote.currentPrice);
  const pe = metric(metrics, "peTTM", "peNormalizedAnnual");
  const forwardPe = metric(metrics, "forwardPE", "forwardPe");
  const priceToSales = metric(metrics, "psTTM", "priceToSalesTTM");
  const evToEbitda = metric(metrics, "evToEbitdaTTM", "evToEbitda");
  const fcfPerShare = metric(metrics, "freeCashFlowPerShareTTM", "fcfPerShareTTM");
  const eps = metric(metrics, "epsTTM", "epsExclExtraItemsTTM", "epsBasicExclExtraItemsTTM");
  const growthRate = clamp((num(growth?.inputs?.epsGrowth) ?? num(growth?.inputs?.revenueGrowth) ?? 6) / 100, -0.05, 0.22);
  const terminalPe = pe !== null ? clamp(pe, 8, 34) : null;
  const fairValue = currentPrice !== null && eps !== null && eps > 0 && terminalPe !== null
    ? (eps * Math.pow(1 + growthRate, 5) * terminalPe) / Math.pow(1.1, 5)
    : null;
  const priceToFcf = currentPrice !== null && fcfPerShare !== null && fcfPerShare > 0 ? currentPrice / fcfPerShare : null;
  const valuationInputs = [
    pe === null ? null : pe <= 18 ? 86 : pe <= 28 ? 70 : pe <= 42 ? 48 : 25,
    forwardPe === null ? null : forwardPe <= 18 ? 88 : forwardPe <= 28 ? 70 : forwardPe <= 42 ? 48 : 25,
    priceToFcf === null ? null : priceToFcf <= 20 ? 86 : priceToFcf <= 32 ? 66 : priceToFcf <= 48 ? 42 : 22,
    evToEbitda === null ? null : evToEbitda <= 14 ? 82 : evToEbitda <= 22 ? 62 : evToEbitda <= 34 ? 42 : 22,
    priceToSales === null ? null : priceToSales <= 4 ? 78 : priceToSales <= 9 ? 55 : priceToSales <= 16 ? 35 : 18,
    fairValue === null || currentPrice === null ? null : clamp(65 + ((fairValue - currentPrice) / fairValue) * 100 * 1.3),
  ];
  const score = round(average(valuationInputs), 0);
  const availableInputs = valuationInputs.filter(Number.isFinite).length;
  let classification = "DATA INSUFFICIENT";
  if (availableInputs >= 2) {
    if (score >= 78) classification = "ATTRACTIVE";
    else if (score >= 58) classification = "FAIR";
    else if (score >= 38) classification = "EXPENSIVE";
    else classification = "VERY EXPENSIVE";
  }
  return {
    score,
    classification,
    explanation: availableInputs < 2
      ? "No reliable valuation range available."
      : `Valuation uses available earnings, cash-flow, sales and enterprise-value ratios. No single method is treated as perfect.`,
    currentPrice,
    fairValue,
    attractiveZone: fairValue === null ? null : { low: round(fairValue * 0.78, 2), high: round(fairValue * 0.9, 2) },
    fairValueRange: fairValue === null ? null : { low: round(fairValue * 0.9, 2), high: round(fairValue * 1.08, 2) },
    overvaluedAbove: fairValue === null ? null : round(fairValue * 1.18, 2),
    inputs: { pe, forwardPe, priceToFcf: round(priceToFcf), evToEbitda, priceToSales, eps, fcfPerShare },
  };
}

export function assessDividend(metrics = {}) {
  const dividendYield = metric(metrics, "dividendYieldIndicatedAnnual", "currentDividendYieldTTM", "dividendYield5Y");
  const payoutRatio = metric(metrics, "payoutRatioTTM", "payoutRatioAnnual");
  return {
    dividendYield,
    payoutRatio,
    classification: dividendYield === null ? "No reliable dividend data" : dividendYield > 0 ? "Dividend payer" : "No dividend indicated",
    explanation: dividendYield === null
      ? "Dividend data is not reliable enough to assess."
      : payoutRatio === null
        ? `Dividend yield is approximately ${round(dividendYield, 2)}%, with no reliable payout ratio.`
        : `Dividend yield is approximately ${round(dividendYield, 2)}% and payout ratio is approximately ${round(payoutRatio, 1)}%.`,
  };
}

export function keyRisks({ financialStrength, growth, valuation, metrics = {} } = {}) {
  const risks = [];
  const debtToEquity = metric(metrics, "totalDebt/totalEquityQuarterly", "totalDebt/totalEquityAnnual");
  const netMargin = metric(metrics, "netProfitMarginTTM", "netMarginTTM");
  if (financialStrength?.classification === "WEAK" || financialStrength?.classification === "HIGH RISK") risks.push("Financial strength is weak based on available debt, cash-flow or profitability metrics.");
  if (debtToEquity !== null && debtToEquity > 120) risks.push("Debt appears elevated relative to equity.");
  if (growth?.classification === "DECLINING") risks.push("Revenue, earnings or cash-flow trends are declining.");
  if (valuation?.classification === "VERY EXPENSIVE") risks.push("Valuation is very expensive relative to available earnings, cash-flow or sales metrics.");
  if (netMargin !== null && netMargin < 3) risks.push("Profit margins are thin.");
  return risks;
}

export function analyseInvestmentCandidate({ symbol, companyName, sector, country, currency = "USD", quote = {}, metrics = {}, profile = {} } = {}) {
  const currentPrice = num(quote.currentPrice ?? quote.c);
  const financialStrength = assessFinancialStrength(metrics);
  const growth = assessGrowth(metrics);
  const businessQuality = assessBusinessQuality(metrics, profile);
  const valuation = assessValuation({ metrics, quote: { currentPrice }, growth });
  const dividend = assessDividend(metrics);
  const risks = keyRisks({ financialStrength, growth, valuation, metrics });
  const dataInputs = [
    currentPrice,
    businessQuality.score,
    financialStrength.score,
    growth.score,
    valuation.score,
  ].filter(Number.isFinite).length;
  const investmentScore = dataInputs < 4 ? null : round(
    businessQuality.score * 0.32 +
    financialStrength.score * 0.18 +
    growth.score * 0.18 +
    valuation.score * 0.22 +
    Math.max(0, 100 - risks.length * 12) * 0.1,
    0
  );
  let status = "DATA INSUFFICIENT";
  if (investmentScore !== null) {
    if (businessQuality.score < 45 || financialStrength.classification === "HIGH RISK") status = "AVOID";
    else if (investmentScore >= 82 && ["ATTRACTIVE", "FAIR"].includes(valuation.classification) && businessQuality.score >= 72) status = "ATTRACTIVE";
    else if (investmentScore >= 72 && valuation.classification === "FAIR") status = "FAIR VALUE";
    else if (businessQuality.score >= 75 && ["EXPENSIVE", "VERY EXPENSIVE"].includes(valuation.classification)) status = "EXPENSIVE";
    else if (businessQuality.score >= 68) status = "WATCH";
    else status = "AVOID";
  }
  const reason = status === "DATA INSUFFICIENT"
    ? "Freedom does not have enough reliable fundamental and valuation data to rank this company."
    : `${businessQuality.label.toLowerCase()} business quality, ${growth.classification.toLowerCase()} growth, ${financialStrength.classification.toLowerCase()} financial strength and ${valuation.classification.toLowerCase()} valuation.`;
  return {
    symbol,
    ticker: symbol,
    companyName: companyName || profile.name || symbol,
    sector: sector || profile.finnhubIndustry || "Unknown",
    country: country || profile.country || null,
    currency,
    currentPrice,
    investmentScore,
    businessQuality,
    financialStrength,
    growth,
    valuation,
    dividend,
    keyRisks: risks,
    status,
    reason,
    whyFreedomLikesIt: businessQuality.score >= 72 ? businessQuality.explanation : "Freedom does not yet see enough business quality evidence.",
    whyFreedomMightWait: valuation.classification === "EXPENSIVE" || valuation.classification === "VERY EXPENSIVE"
      ? "The company may be good, but the current valuation is demanding."
      : risks.length ? risks[0] : "Freedom may wait for more complete financial data or a better valuation range.",
  };
}

export function rankInvestmentOpportunities(rows = []) {
  return rows
    .slice()
    .sort((a, b) => {
      const statusWeight = { ATTRACTIVE: 500, "FAIR VALUE": 360, WATCH: 260, EXPENSIVE: 120, AVOID: 20, "DATA INSUFFICIENT": 0 };
      return (statusWeight[b.status] || 0) - (statusWeight[a.status] || 0) ||
        (Number(b.investmentScore) || 0) - (Number(a.investmentScore) || 0) ||
        String(a.symbol).localeCompare(String(b.symbol));
    });
}

export function prepareInvestment(candidate = {}, settings = {}) {
  if (candidate.status !== "ATTRACTIVE") return null;
  const portfolioValue = num(settings.portfolioValue) ?? 100000;
  const maximumPositionPercent = num(settings.maximumPositionPercent) ?? 8;
  const initialStagePercent = num(settings.initialStagePercent) ?? 25;
  const currentPrice = num(candidate.currentPrice);
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return null;
  const maximumAllocation = portfolioValue * (maximumPositionPercent / 100);
  const initialInvestment = maximumAllocation * (initialStagePercent / 100);
  return {
    symbol: candidate.symbol,
    companyName: candidate.companyName,
    currentPrice,
    suggestedMaximumAllocation: round(maximumAllocation, 2),
    suggestedInitialInvestmentAmount: round(initialInvestment, 2),
    approximateShares: Math.floor(initialInvestment / currentPrice),
    currency: candidate.currency || "USD",
    reason: `Initial purchase is ${initialStagePercent}% of the planned maximum allocation. Add only if quality remains strong and valuation remains attractive.`,
  };
}

export function portfolioSummary(holdings = [], latest = []) {
  const bySymbol = new Map(latest.map((row) => [row.symbol, row]));
  const rows = holdings.map((holding) => {
    const candidate = bySymbol.get(holding.symbol) || {};
    const shares = num(holding.shares) ?? 0;
    const averageCost = num(holding.averageCost) ?? null;
    const currentPrice = num(candidate.currentPrice);
    const currentValue = currentPrice === null ? null : currentPrice * shares;
    const cost = averageCost === null ? null : averageCost * shares;
    return {
      ...holding,
      currentPrice,
      currentValue: round(currentValue, 2),
      gainLoss: currentValue !== null && cost !== null ? round(currentValue - cost, 2) : null,
      investmentScore: candidate.investmentScore ?? null,
      currentStatus: candidate.status || "DATA INSUFFICIENT",
      sector: candidate.sector || holding.sector || "Unknown",
    };
  });
  const totalValue = rows.reduce((total, row) => total + (num(row.currentValue) || 0), 0);
  rows.forEach((row) => {
    row.portfolioWeight = totalValue > 0 && row.currentValue !== null ? round((row.currentValue / totalValue) * 100, 2) : null;
  });
  const concentrationWarnings = rows
    .filter((row) => Number(row.portfolioWeight) > 15)
    .map((row) => `${row.symbol} is ${row.portfolioWeight}% of the portfolio.`);
  const sectors = {};
  rows.forEach((row) => {
    sectors[row.sector] = round((sectors[row.sector] || 0) + (row.portfolioWeight || 0), 2);
  });
  return { holdings: rows, totalValue: round(totalValue, 2), concentrationWarnings, diversification: { sectors } };
}
