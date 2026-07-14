import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-terminal-unlocked";
const CHART_MODE_STORAGE_KEY = "freedom-terminal-chart-mode";
const CHART_RANGE_STORAGE_KEY = "freedom-terminal-chart-range";
const CHART_MA_STORAGE_KEY = "freedom-terminal-chart-ma";
const CHART_MODES = ["Candles", "Line", "Area"];
const CHART_RANGES = ["1M", "3M", "6M", "1Y", "3Y", "5Y", "MAX"];

const COMPANY_STYLES = {
  MSFT: { companyName: "Microsoft", logoText: "MS", primaryColor: "#00A4EF", secondaryColor: "#7FBA00", accentColor: "#FFB900" },
  NVDA: { companyName: "NVIDIA", logoText: "NV", primaryColor: "#76B900", secondaryColor: "#0B3D02", accentColor: "#B7FF4A" },
  V: { companyName: "Visa", logoText: "V", primaryColor: "#1A1F71", secondaryColor: "#F7B600", accentColor: "#4D8DFF" },
  AMZN: { companyName: "Amazon", logoText: "A", primaryColor: "#FF9900", secondaryColor: "#232F3E", accentColor: "#FFD15C" },
  COST: { companyName: "Costco", logoText: "C", primaryColor: "#E31837", secondaryColor: "#005DAA", accentColor: "#FFFFFF" },
  GOOGL: { companyName: "Alphabet", logoText: "G", primaryColor: "#4285F4", secondaryColor: "#EA4335", accentColor: "#FBBC05" },
  AVGO: { companyName: "Broadcom", logoText: "B", primaryColor: "#CC092F", secondaryColor: "#7A0019", accentColor: "#FF6B6B" },
  MA: { companyName: "Mastercard", logoText: "M", primaryColor: "#EB001B", secondaryColor: "#F79E1B", accentColor: "#FFCA4D" },
  ASML: { companyName: "ASML", logoText: "AS", primaryColor: "#0073CF", secondaryColor: "#00A3E0", accentColor: "#9BE7FF" },
  TSM: { companyName: "Taiwan Semiconductor", logoText: "TS", primaryColor: "#D71920", secondaryColor: "#1B2A57", accentColor: "#64B5F6" },
};

const FALLBACK_STYLE = {
  companyName: "Company",
  logoText: "--",
  primaryColor: "#79D9C5",
  secondaryColor: "#334155",
  accentColor: "#E4B85D",
};

const WATCHLIST = {
  MSFT: { companyName: "Microsoft", symbol: "MSFT", sector: "Software", qualityScore: 96 },
  NVDA: { companyName: "NVIDIA", symbol: "NVDA", sector: "Semiconductors", qualityScore: 94 },
  V: { companyName: "Visa", symbol: "V", sector: "Payments", qualityScore: 95 },
  AMZN: { companyName: "Amazon", symbol: "AMZN", sector: "Cloud & E-commerce", qualityScore: 93 },
  COST: { companyName: "Costco", symbol: "COST", sector: "Consumer Defensive", qualityScore: 92 },
  GOOGL: { companyName: "Alphabet", symbol: "GOOGL", sector: "Digital Advertising & AI", qualityScore: 93 },
  AVGO: { companyName: "Broadcom", symbol: "AVGO", sector: "Semiconductors", qualityScore: 92 },
  MA: { companyName: "Mastercard", symbol: "MA", sector: "Payments", qualityScore: 94 },
  ASML: { companyName: "ASML", symbol: "ASML", sector: "Semiconductor Equipment", qualityScore: 91 },
  TSM: { companyName: "Taiwan Semiconductor", symbol: "TSM", sector: "Semiconductors", qualityScore: 92 },
};

const DEFAULT_ASSUMPTIONS = {
  currentEPS: "",
  expectedEPSGrowth: "",
  terminalPE: "",
  requiredReturn: "10",
  marginOfSafetyTarget: "15",
};

const MICROSOFT_HEALTH_SCORE = {
  overallScore: 96,
  categories: [
    { label: "Financial Health", score: 98, explanation: "Massive free cash flow, strong balance sheet and high profitability." },
    { label: "Growth", score: 95, explanation: "Azure, Microsoft 365 and Copilot provide long-term growth drivers." },
    { label: "Competitive Moat", score: 99, explanation: "Deep enterprise lock-in across Office, Windows, Azure, Teams and GitHub." },
    { label: "Management", score: 92, explanation: "Strong execution under Satya Nadella with disciplined capital allocation." },
    { label: "Innovation", score: 97, explanation: "Leading position in cloud, AI, developer tools and enterprise software." },
    { label: "Valuation", score: 72, explanation: "Premium-quality company, but not obviously cheap at current assumptions." },
    { label: "Risk", score: 88, explanation: "Low business risk, moderate valuation and AI capex risk." },
  ],
};

const FALLBACK_COMMITTEE = {
  symbol: "MSFT",
  overallDecision: "WATCH",
  committeeScore: 88,
  confidence: 86,
  healthScore: MICROSOFT_HEALTH_SCORE,
  analysts: [
    {
      role: "Value Investor",
      score: 78,
      decision: "WATCH",
      summary:
        "Microsoft is an exceptional business, but the current price only offers a modest margin of safety based on the EPS growth model.",
    },
    {
      role: "Growth Investor",
      score: 94,
      decision: "BUY",
      summary:
        "Azure, Microsoft 365 and Copilot give Microsoft multiple long-term growth engines with strong recurring revenue.",
    },
    {
      role: "Risk Analyst",
      score: 82,
      decision: "WATCH",
      summary:
        "Business risk is low, but valuation risk and AI infrastructure spending remain important concerns.",
    },
    {
      role: "Industry Expert",
      score: 95,
      decision: "BUY",
      summary:
        "Cloud, enterprise software and AI infrastructure remain among the strongest sectors for the next decade.",
    },
    {
      role: "Portfolio Manager",
      score: 88,
      decision: "WATCH",
      summary:
        "Microsoft belongs in the portfolio, but position sizing should be controlled because technology exposure can become concentrated.",
    },
  ],
  finalSummary:
    "The committee agrees Microsoft is a world-class business. The current decision remains WATCH until fair value and buy-below levels provide a stronger margin of safety.",
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function getCompanyStyle(symbol) {
  return COMPANY_STYLES[symbol] || { ...FALLBACK_STYLE, logoText: String(symbol || "--").slice(0, 2) };
}

function styleVars(style) {
  return {
    "--company-primary": style.primaryColor,
    "--company-secondary": style.secondaryColor,
    "--company-accent": style.accentColor,
  };
}

function round(value, decimals = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(decimals)) : null;
}

function average(values) {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return null;
  return clean.reduce((total, value) => total + value, 0) / clean.length;
}

function simpleMovingAverage(candles, days, endIndex = candles.length - 1) {
  const startIndex = endIndex - days + 1;
  if (startIndex < 0) return null;
  return round(average(candles.slice(startIndex, endIndex + 1).map((candle) => candle.close)));
}

function movingAverageSeries(candles, days) {
  return candles.map((candle, index) => ({
    timestamp: candle.timestamp,
    value: simpleMovingAverage(candles, days, index),
  }));
}

function formatCurrency(value) {
  return Number.isFinite(value) ? money.format(value) : "--";
}

function formatPercent(value, signed = false) {
  if (!Number.isFinite(value)) return "--";
  return `${signed && value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatVolume(value) {
  return Number.isFinite(value) ? compactNumber.format(value) : "--";
}

function formatVsAverage(price, averageValue) {
  if (!Number.isFinite(price) || !Number.isFinite(averageValue) || averageValue === 0) return "Not enough data";
  const diff = price - averageValue;
  const percent = (diff / averageValue) * 100;
  return `${diff >= 0 ? "Above" : "Below"} by ${formatCurrency(Math.abs(diff))} (${formatPercent(Math.abs(percent))})`;
}

function getRating(qualityScore, percentOffHigh) {
  if (qualityScore >= 95 && percentOffHigh <= -15) return "STRONG BUY";
  if (qualityScore >= 90 && percentOffHigh <= -10) return "BUY";
  if (qualityScore >= 90) return "WATCH";
  if (qualityScore >= 80) return "HOLD OFF";
  return "AVOID";
}

function investmentStatus(rating) {
  const normalized = String(rating || "").trim().toUpperCase();
  if (normalized.includes("STRONG BUY")) return "strongBuy";
  if (normalized === "BUY" || normalized === "BUY WATCH") return "buy";
  if (normalized === "WATCH" || normalized === "FAIR VALUE") return "watch";
  if (normalized === "HOLD" || normalized === "HOLD OFF" || normalized === "WAIT" || normalized === "EXPENSIVE") return "holdOff";
  if (normalized === "SELL") return "sell";
  if (normalized === "AVOID") return "avoid";
  return "info";
}

function ratingLabel(rating) {
  return {
    strongBuy: "STRONG BUY",
    buy: "BUY",
    watch: "WATCH",
    holdOff: "HOLD OFF",
    avoid: "AVOID",
    sell: "SELL",
    info: "INFO",
  }[investmentStatus(rating)];
}

function ratingClass(rating) {
  return investmentStatus(rating);
}

function buyScoreClass(score) {
  if (score >= 95) return "strongBuy";
  if (score >= 85) return "buy";
  if (score >= 70) return "watch";
  if (score >= 60) return "holdOff";
  return "avoid";
}

function getHealthScore(symbol, committee) {
  if (committee?.healthScore?.overallScore) return committee.healthScore;
  return null;
}

function normalizeLoadedNote(symbol, note) {
  return {
    fairValue: note?.fairValue === null || note?.fairValue === undefined ? "" : String(note.fairValue),
    buyBelow: note?.buyBelow === null || note?.buyBelow === undefined ? "" : String(note.buyBelow),
    decision: note?.decision || "",
    thesis: note?.thesis || "",
    whyWeLikeIt: note?.whyWeLikeIt || "",
    keyRisks: note?.keyRisks || "",
    businessSummary: note?.businessSummary || "",
    competitiveAdvantage: note?.competitiveAdvantage || "",
    bullCase: note?.bullCase || "",
    bearCase: note?.bearCase || "",
    researchStatus: note?.researchStatus || "not_started",
    sourceNotes: note?.sourceNotes || "",
    updatedAt: note?.updatedAt || null,
  };
}

async function browserHashPassword(password) {
  const bytes = new TextEncoder().encode(`${PASSWORD_SALT}:${password}`);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function visibleCandlesForRange(candles, range) {
  const indexedCandles = candles.map((candle, index) => ({ ...candle, sourceIndex: index }));
  const days = {
    "1M": 31,
    "3M": 92,
    "6M": 183,
    "1Y": 370,
    "3Y": 365 * 3 + 10,
    "5Y": 365 * 5 + 15,
  }[range];
  if (range === "MAX" || !days) return indexedCandles;
  const newest = candles[candles.length - 1]?.timestamp;
  if (!newest) return [];
  const cutoff = newest - days * 24 * 60 * 60;
  return indexedCandles.filter((candle) => candle.timestamp >= cutoff);
}

function classifyTrend(analysis) {
  const { latestClose, percentChange, ma20, ma50, ma200 } = analysis;
  const hasAllAverages = [latestClose, ma20, ma50, ma200].every(Number.isFinite);

  if (hasAllAverages && latestClose > ma20 && latestClose > ma50 && latestClose > ma200 && ma20 > ma50 && ma50 > ma200) {
    return "STRONG UPTREND";
  }

  if (hasAllAverages && latestClose < ma20 && latestClose < ma50 && latestClose < ma200 && ma20 < ma50 && ma50 < ma200) {
    return "STRONG DOWNTREND";
  }

  const availableAverages = [ma20, ma50, ma200].filter(Number.isFinite);
  const averageSpread =
    availableAverages.length >= 2
      ? ((Math.max(...availableAverages) - Math.min(...availableAverages)) / latestClose) * 100
      : null;

  if (Number.isFinite(percentChange) && percentChange >= -5 && percentChange <= 5 && (!Number.isFinite(averageSpread) || averageSpread <= 5)) {
    return "SIDEWAYS";
  }

  if (Number.isFinite(ma50) && latestClose > ma50 && percentChange > 0) return "UPTREND";
  if (Number.isFinite(ma50) && latestClose < ma50 && percentChange < 0) return "DOWNTREND";
  if (percentChange > 0) return "UPTREND";
  if (percentChange < 0) return "DOWNTREND";
  return "SIDEWAYS";
}

function trendTone(classification) {
  if (classification.includes("UPTREND")) return "positive";
  if (classification.includes("DOWNTREND")) return "negative";
  return "sideways";
}

function trendExplanation(analysis) {
  const direction = analysis.dollarChange >= 0 ? "rose" : "fell";
  const ma50Text = Number.isFinite(analysis.ma50)
    ? `The latest close is ${formatVsAverage(analysis.latestClose, analysis.ma50).toLowerCase()} versus the 50-day average.`
    : "There is not enough selected-period history to calculate a 50-day average.";
  const maStack =
    Number.isFinite(analysis.ma20) && Number.isFinite(analysis.ma50)
      ? `The 20-day average is ${analysis.ma20 >= analysis.ma50 ? "above" : "below"} the 50-day average.`
      : "The short-term average stack is not complete for this range.";

  return `Over the selected ${analysis.range} period, the close ${direction} ${formatCurrency(
    Math.abs(analysis.dollarChange)
  )} (${formatPercent(Math.abs(analysis.percentChange))}). ${ma50Text} ${maStack}`;
}

function buildTrendAnalysis(candles, range) {
  if (!candles.length) return null;

  const first = candles[0];
  const latest = candles[candles.length - 1];
  const startingPrice = first.close;
  const latestClose = latest.close;
  const dollarChange = latestClose - startingPrice;
  const percentChange = startingPrice ? (dollarChange / startingPrice) * 100 : null;
  const highs = candles.map((candle) => candle.high).filter(Number.isFinite);
  const lows = candles.map((candle) => candle.low).filter(Number.isFinite);
  const closes = candles.map((candle) => candle.close).filter(Number.isFinite);
  let risingDays = 0;
  let fallingDays = 0;

  candles.slice(1).forEach((candle, index) => {
    const prior = candles[index];
    if (candle.close > prior.close) risingDays += 1;
    if (candle.close < prior.close) fallingDays += 1;
  });

  if (range === "1Y" && candles.length < 50) {
    return {
      range,
      incomplete: true,
      candleCount: candles.length,
      startingPrice,
      latestClose,
      dollarChange,
      percentChange,
      risingDays,
      fallingDays,
      explanation: "Historical dataset incomplete",
    };
  }

  const periodHigh = Math.max(...highs);
  const periodLow = Math.min(...lows);
  const highestClose = Math.max(...closes);
  const lowestClose = Math.min(...closes);
  const ma20 = simpleMovingAverage(candles, 20);
  const ma50 = simpleMovingAverage(candles, 50);
  const ma200 = simpleMovingAverage(candles, 200);
  const analysis = {
    range,
    startingPrice,
    latestClose,
    dollarChange,
    percentChange,
    periodHigh,
    periodLow,
    risingDays,
    fallingDays,
    distanceFromHigh: periodHigh ? ((latestClose - periodHigh) / periodHigh) * 100 : null,
    distanceFromLow: periodLow ? ((latestClose - periodLow) / periodLow) * 100 : null,
    ma20,
    ma50,
    ma200,
    ma20Comparison: formatVsAverage(latestClose, ma20),
    ma50Comparison: formatVsAverage(latestClose, ma50),
    ma200Comparison: formatVsAverage(latestClose, ma200),
    highestClose,
    lowestClose,
  };
  analysis.classification = classifyTrend(analysis);
  analysis.tone = trendTone(analysis.classification);
  analysis.explanation = trendExplanation(analysis);

  return analysis;
}

function PriceTrendAnalysis({ analysis }) {
  if (!analysis) {
    return (
      <section className="trendPanel">
        <div className="trendEmpty">Historical data unavailable</div>
        <style jsx>{trendStyles}</style>
      </section>
    );
  }

  if (analysis.incomplete) {
    return (
      <section className="trendPanel">
        <div className="trendHero">
          <div>
            <span>Price Trend Analysis</span>
            <strong>Historical dataset incomplete</strong>
            <p>The selected 1Y period returned only {analysis.candleCount} candles, so the trend is not classified.</p>
          </div>
          <div className="returnBox">
            <span>{analysis.range} Return</span>
            <strong>{formatPercent(analysis.percentChange, true)}</strong>
          </div>
        </div>
        <div className="trendMetrics">
          <article><span>Starting Price</span><strong>{formatCurrency(analysis.startingPrice)}</strong></article>
          <article><span>Latest Close</span><strong>{formatCurrency(analysis.latestClose)}</strong></article>
          <article><span>Rising Days</span><strong>{analysis.risingDays}</strong></article>
          <article><span>Falling Days</span><strong>{analysis.fallingDays}</strong></article>
        </div>
        <style jsx>{trendStyles}</style>
      </section>
    );
  }

  const metrics = [
    ["Starting Price", formatCurrency(analysis.startingPrice)],
    ["Latest Close", formatCurrency(analysis.latestClose)],
    ["Dollar Change", `${analysis.dollarChange >= 0 ? "+" : "-"}${formatCurrency(Math.abs(analysis.dollarChange))}`],
    ["Percentage Change", formatPercent(analysis.percentChange, true)],
    ["Period High", formatCurrency(analysis.periodHigh)],
    ["Period Low", formatCurrency(analysis.periodLow)],
    ["Rising Days", analysis.risingDays],
    ["Falling Days", analysis.fallingDays],
    ["Distance From High", formatPercent(analysis.distanceFromHigh)],
    ["Distance From Low", formatPercent(analysis.distanceFromLow, true)],
    ["Highest Close", formatCurrency(analysis.highestClose)],
    ["Lowest Close", formatCurrency(analysis.lowestClose)],
  ];
  const averages = [
    ["20-Day MA", analysis.ma20, analysis.ma20Comparison],
    ["50-Day MA", analysis.ma50, analysis.ma50Comparison],
    ["200-Day MA", analysis.ma200, analysis.ma200Comparison],
  ];

  return (
    <section className={`trendPanel ${analysis.tone}`}>
      <div className="trendHero">
        <div>
          <span>Price Trend Analysis</span>
          <strong>{analysis.classification}</strong>
          <p>{analysis.explanation}</p>
        </div>
        <div className="returnBox">
          <span>{analysis.range} Return</span>
          <strong>{formatPercent(analysis.percentChange, true)}</strong>
        </div>
      </div>

      <div className="trendMetrics">
        {metrics.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      <div className="averageGrid">
        {averages.map(([label, value, comparison]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{Number.isFinite(value) ? formatCurrency(value) : "Not enough data"}</strong>
            <small>{comparison}</small>
          </article>
        ))}
      </div>

      <p className="trendNote">
        Price trend describes recent market behaviour. It does not determine the underlying quality or fair value of the business.
      </p>
      <style jsx>{trendStyles}</style>
    </section>
  );
}

const trendStyles = `
  .trendPanel {
    background: rgba(8, 14, 17, 0.92);
    border: 1px solid rgba(179, 199, 207, 0.13);
    border-radius: 8px;
    padding: 18px;
  }
  .trendPanel.positive {
    border-color: rgba(43, 216, 159, 0.28);
  }
  .trendPanel.sideways {
    border-color: rgba(228, 184, 93, 0.3);
  }
  .trendPanel.negative {
    border-color: rgba(255, 95, 87, 0.3);
  }
  .trendHero {
    align-items: stretch;
    display: grid;
    gap: 16px;
    grid-template-columns: minmax(0, 1fr) 220px;
  }
  .trendHero span,
  .returnBox span,
  .trendMetrics span,
  .averageGrid span {
    color: #aebdc4;
    display: block;
    font-size: 12px;
    font-weight: 900;
    margin-bottom: 8px;
    text-transform: uppercase;
  }
  .trendHero > div:first-child {
    background: rgba(255, 255, 255, 0.045);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 16px;
  }
  .trendHero strong {
    color: #fff;
    display: block;
    font-size: clamp(28px, 3vw, 42px);
    font-weight: 950;
  }
  .positive .trendHero strong,
  .positive .returnBox strong {
    color: #2bd89f;
  }
  .sideways .trendHero strong,
  .sideways .returnBox strong {
    color: #e4b85d;
  }
  .negative .trendHero strong,
  .negative .returnBox strong {
    color: #ff5f57;
  }
  .trendHero p,
  .trendNote,
  .averageGrid small {
    color: #dfe7eb;
    line-height: 1.55;
  }
  .trendHero p {
    margin-top: 10px;
  }
  .returnBox {
    align-items: flex-start;
    background: rgba(255, 255, 255, 0.045);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 16px;
  }
  .returnBox strong {
    font-size: 36px;
    font-weight: 950;
  }
  .trendMetrics,
  .averageGrid {
    display: grid;
    gap: 12px;
    margin-top: 14px;
  }
  .trendMetrics {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
  .averageGrid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .trendMetrics article,
  .averageGrid article {
    background: rgba(255, 255, 255, 0.045);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 14px;
  }
  .trendMetrics strong,
  .averageGrid strong {
    color: #fff;
    display: block;
    font-size: 18px;
    font-weight: 900;
    overflow-wrap: anywhere;
  }
  .averageGrid small {
    display: block;
    font-size: 12px;
    margin-top: 8px;
  }
  .trendNote {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    margin: 14px 0 0;
    padding-top: 14px;
  }
  .trendEmpty {
    align-items: center;
    color: #aebdc4;
    display: flex;
    font-weight: 900;
    justify-content: center;
    min-height: 120px;
  }
  @media (max-width: 1200px) {
    .trendMetrics {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  @media (max-width: 720px) {
    .trendHero,
    .trendMetrics,
    .averageGrid {
      grid-template-columns: 1fr;
    }
  }
`;

function movingAverageValues(candles, days) {
  return candles.map((_, index) => simpleMovingAverage(candles, days, index));
}

function mapDailyAverageToDisplayCandles(displayCandles, dailyAverages) {
  return displayCandles.map((candle) => {
    const sourceIndex = Number.isInteger(candle.sourceEndIndex) ? candle.sourceEndIndex : null;
    return sourceIndex === null ? null : dailyAverages[sourceIndex] ?? null;
  });
}

function getOverlayLevels(allCandles, visibleCandles) {
  const highs = visibleCandles.map((candle) => candle.high).filter(Number.isFinite);
  const lows = visibleCandles.map((candle) => candle.low).filter(Number.isFinite);
  const newest = allCandles[allCandles.length - 1]?.timestamp;
  const oneYearCutoff = newest ? newest - 370 * 24 * 60 * 60 : null;
  const oneYearCandles = oneYearCutoff ? allCandles.filter((candle) => candle.timestamp >= oneYearCutoff) : allCandles;
  const yearHighs = oneYearCandles.map((candle) => candle.high).filter(Number.isFinite);
  const yearLows = oneYearCandles.map((candle) => candle.low).filter(Number.isFinite);

  return {
    support: lows.length ? round(Math.min(...lows)) : null,
    resistance: highs.length ? round(Math.max(...highs)) : null,
    yearHigh: yearHighs.length ? round(Math.max(...yearHighs)) : null,
    yearLow: yearLows.length ? round(Math.min(...yearLows)) : null,
  };
}

function buildTrendLineData(candles) {
  if (candles.length < 2) return candles.map(() => null);
  const first = candles[0].close;
  const last = candles[candles.length - 1].close;
  const steps = candles.length - 1;
  return candles.map((_, index) => round(first + ((last - first) * index) / steps));
}

function loadStoredChartMode() {
  if (typeof window === "undefined") return "Candles";
  const stored = window.localStorage.getItem(CHART_MODE_STORAGE_KEY);
  return CHART_MODES.includes(stored) ? stored : "Candles";
}

function loadStoredChartRange() {
  return "1Y";
}

function loadStoredMaVisibility() {
  if (typeof window === "undefined") return { ma20: true, ma50: true, ma200: true };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CHART_MA_STORAGE_KEY) || "{}");
    return {
      ma20: typeof parsed.ma20 === "boolean" ? parsed.ma20 : true,
      ma50: typeof parsed.ma50 === "boolean" ? parsed.ma50 : true,
      ma200: typeof parsed.ma200 === "boolean" ? parsed.ma200 : true,
    };
  } catch {
    return { ma20: true, ma50: true, ma200: true };
  }
}

function chartTooltipFormatter(params, candles, ma20, ma50, ma200) {
  const firstParam = Array.isArray(params) ? params[0] : params;
  const index = firstParam?.dataIndex;
  const candle = candles[index];
  if (!candle) return "";

  return [
    `<div class="ftTooltip">`,
    `<strong>${candle.date}</strong>`,
    `<span>Open <b>${formatCurrency(candle.open)}</b></span>`,
    `<span>High <b>${formatCurrency(candle.high)}</b></span>`,
    `<span>Low <b>${formatCurrency(candle.low)}</b></span>`,
    `<span>Close <b>${formatCurrency(candle.close)}</b></span>`,
    `<span>Volume <b>${formatVolume(candle.volume)}</b></span>`,
    `<span>MA20 <b>${Number.isFinite(ma20[index]) ? formatCurrency(ma20[index]) : "--"}</b></span>`,
    `<span>MA50 <b>${Number.isFinite(ma50[index]) ? formatCurrency(ma50[index]) : "--"}</b></span>`,
    `<span>MA200 <b>${Number.isFinite(ma200[index]) ? formatCurrency(ma200[index]) : "--"}</b></span>`,
    `</div>`,
  ].join("");
}

function MarketChart({ candles, range, setRange, mode, setMode, notice, maVisibility, setMaVisibility }) {
  const chartNodeRef = useRef(null);
  const chartRef = useRef(null);
  const [echartsReady, setEchartsReady] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dailyVisible = useMemo(() => visibleCandlesForRange(candles, range), [candles, range]);
  const visible = dailyVisible;
  const dailyMa20 = useMemo(() => movingAverageValues(candles, 20), [candles]);
  const dailyMa50 = useMemo(() => movingAverageValues(candles, 50), [candles]);
  const dailyMa200 = useMemo(() => movingAverageValues(candles, 200), [candles]);
  const ma20 = useMemo(() => mapDailyAverageToDisplayCandles(visible, dailyMa20), [dailyMa20, visible]);
  const ma50 = useMemo(() => mapDailyAverageToDisplayCandles(visible, dailyMa50), [dailyMa50, visible]);
  const ma200 = useMemo(() => mapDailyAverageToDisplayCandles(visible, dailyMa200), [dailyMa200, visible]);
  const hasMa200 = candles.length >= 200 && ma200.some(Number.isFinite);
  const overlayLevels = useMemo(() => getOverlayLevels(candles, dailyVisible), [candles, dailyVisible]);
  const trendLineData = useMemo(() => buildTrendLineData(visible), [visible]);
  const startPrice = dailyVisible[0]?.close;
  const endPrice = dailyVisible[dailyVisible.length - 1]?.close;
  const canMountChart = visible.length > 0;

  useEffect(() => {
    let cancelled = false;
    let resizeObserver = null;
    let resizeHandler = null;

    async function mountChart() {
      if (!chartNodeRef.current || !canMountChart) return;
      const echarts = await import("echarts");
      if (cancelled || !chartNodeRef.current) return;
      chartRef.current?.dispose();
      chartRef.current = null;
      chartRef.current = echarts.init(chartNodeRef.current, null, { renderer: "canvas" });
      setEchartsReady(true);

      function updateSize() {
        if (!chartNodeRef.current) return;
        chartRef.current?.resize();
      }

      resizeHandler = updateSize;
      window.addEventListener("resize", resizeHandler);
      resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(chartNodeRef.current);
      updateSize();
    }

    mountChart();

    return () => {
      cancelled = true;
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      resizeObserver?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
      setEchartsReady(false);
    };
  }, [canMountChart]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
      setTimeout(() => chartRef.current?.resize(), 80);
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!chartRef.current || !chartNodeRef.current || !echartsReady || !visible.length) return;

    const dates = visible.map((candle) => candle.date);
    const candleValues = visible.map((candle) => [candle.open, candle.close, candle.low, candle.high]);
    const closeValues = visible.map((candle) => candle.close);
    const chartStyles = getComputedStyle(chartNodeRef.current);
    const accentColor = chartStyles.getPropertyValue("--company-accent").trim() || "#E4B85D";
    const volumeValues = visible.map((candle) => ({
      value: candle.volume || 0,
      itemStyle: { color: candle.close >= candle.open ? "#2BD89F" : "#FF5F57" },
    }));
    const upColor = "#2BD89F";
    const downColor = "#FF5F57";
    const priceSeries =
      mode === "Candles"
        ? {
            type: "candlestick",
            name: "OHLC",
            data: candleValues,
            barMaxWidth: range === "1M" || range === "3M" ? 18 : 14,
            barMinWidth: 4,
            itemStyle: {
              color: upColor,
              color0: downColor,
              borderColor: upColor,
              borderColor0: downColor,
              borderWidth: 1.6,
            },
            markLine: {
              animation: false,
              symbol: ["none", "none"],
              label: { color: "#DDE8EC", fontWeight: 800, formatter: "{b}" },
              lineStyle: { type: "dashed", width: 1.4 },
              data: [
                Number.isFinite(overlayLevels.resistance)
                  ? { name: "Resistance", yAxis: overlayLevels.resistance, lineStyle: { color: "#F97316" } }
                  : null,
                Number.isFinite(overlayLevels.support)
                  ? { name: "Support", yAxis: overlayLevels.support, lineStyle: { color: "#22C55E" } }
                  : null,
                Number.isFinite(overlayLevels.yearHigh)
                  ? { name: "52W High", yAxis: overlayLevels.yearHigh, lineStyle: { color: "#60A5FA" } }
                  : null,
                Number.isFinite(overlayLevels.yearLow)
                  ? { name: "52W Low", yAxis: overlayLevels.yearLow, lineStyle: { color: "#A78BFA" } }
                  : null,
              ].filter(Boolean),
            },
          }
        : {
            type: "line",
            name: mode,
            data: closeValues,
            showSymbol: false,
            smooth: true,
            sampling: "lttb",
            lineStyle: { color: accentColor, width: 2.6 },
            areaStyle:
              mode === "Area"
                ? {
                    color: {
                      type: "linear",
                      x: 0,
                      y: 0,
                      x2: 0,
                      y2: 1,
                      colorStops: [
                        { offset: 0, color: `${accentColor}44` },
                        { offset: 1, color: `${accentColor}05` },
                      ],
                    },
                  }
                : undefined,
          };

    const option = {
      animation: false,
      backgroundColor: "transparent",
      color: ["#22D3EE", "#E4B85D", "#A855F7"],
      axisPointer: {
        link: [{ xAxisIndex: "all" }],
        label: { backgroundColor: "#111827" },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross", crossStyle: { color: "rgba(255,255,255,0.5)" } },
        backgroundColor: "rgba(5, 8, 11, 0.96)",
        borderColor: "rgba(121, 217, 197, 0.45)",
        borderWidth: 1,
        className: "freedomChartTooltip",
        confine: true,
        formatter: (params) => chartTooltipFormatter(params, visible, ma20, ma50, ma200),
      },
      legend: {
        top: 3,
        right: 16,
        textStyle: { color: "#C9D5DB", fontWeight: 800 },
        inactiveColor: "#53636B",
        data: ["OHLC", "MA20", "MA50", "MA200", "Trend Line", "Volume"],
      },
      grid: [
        {
          left: 64,
          right: 72,
          top: 42,
          height: showVolume ? "62%" : "76%",
        },
        {
          left: 64,
          right: 72,
          bottom: 52,
          height: showVolume ? 90 : 0,
        },
      ],
      xAxis: [
        {
          type: "category",
          data: dates,
          boundaryGap: true,
          axisLine: { lineStyle: { color: "rgba(255,255,255,0.14)" } },
          axisLabel: { color: "#AEBCC4", hideOverlap: true },
          axisTick: { show: false },
          splitLine: { show: false },
        },
        {
          type: "category",
          gridIndex: 1,
          data: dates,
          boundaryGap: true,
          axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
          axisLabel: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
        },
      ],
      yAxis: [
        {
          scale: true,
          position: "right",
          axisLine: { show: false },
          axisLabel: { color: "#AEBCC4", formatter: (value) => `$${Number(value).toFixed(0)}` },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.075)" } },
        },
        {
          scale: true,
          gridIndex: 1,
          position: "right",
          axisLine: { show: false },
          axisLabel: { color: "#71818A", formatter: (value) => compactNumber.format(value) },
          splitLine: { show: false },
        },
      ],
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: [0, 1],
          zoomOnMouseWheel: true,
          moveOnMouseWheel: false,
          moveOnMouseMove: true,
          preventDefaultMouseMove: true,
          throttle: 30,
        },
        {
          type: "slider",
          xAxisIndex: [0, 1],
          bottom: 12,
          height: 22,
          borderColor: "rgba(255,255,255,0.12)",
          fillerColor: "rgba(121,217,197,0.18)",
          handleStyle: { color: "#79D9C5" },
          textStyle: { color: "#AEBCC4" },
          brushSelect: true,
        },
      ],
      series: [
        priceSeries,
        maVisibility.ma20
          ? {
              name: "MA20",
              type: "line",
              data: ma20,
              showSymbol: false,
              smooth: true,
              sampling: "lttb",
              lineStyle: { color: "#22D3EE", width: 2, opacity: 0.82 },
              z: 1,
              connectNulls: false,
            }
          : null,
        maVisibility.ma50
          ? {
              name: "MA50",
              type: "line",
              data: ma50,
              showSymbol: false,
              smooth: true,
              sampling: "lttb",
              lineStyle: { color: "#E4B85D", width: 2, opacity: 0.82 },
              z: 1,
              connectNulls: false,
            }
          : null,
        maVisibility.ma200 && hasMa200
          ? {
              name: "MA200",
              type: "line",
              data: ma200,
              showSymbol: false,
              smooth: true,
              sampling: "lttb",
              lineStyle: { color: "#A855F7", width: 2, opacity: 0.78 },
              z: 1,
              connectNulls: false,
            }
          : null,
        {
          name: "Trend Line",
          type: "line",
          data: trendLineData,
          showSymbol: false,
          silent: true,
          lineStyle: { color: "rgba(255,255,255,0.58)", width: 1.6, type: "dotted" },
        },
        showVolume
          ? {
              name: "Volume",
              type: "bar",
              xAxisIndex: 1,
              yAxisIndex: 1,
              data: volumeValues,
              barMaxWidth: 12,
              large: true,
            }
          : null,
      ].filter(Boolean),
    };

    chartRef.current.setOption(option, true);
    chartRef.current.resize();
  }, [echartsReady, visible, ma20, ma50, ma200, maVisibility, mode, overlayLevels, range, showVolume, trendLineData, hasMa200]);

  function resetZoom() {
    chartRef.current?.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
  }

  async function toggleFullscreen() {
    if (!chartNodeRef.current) return;
    const wrapper = chartNodeRef.current.closest(".chartShell");
    if (!document.fullscreenElement) {
      await wrapper?.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
    setTimeout(() => chartRef.current?.resize(), 120);
  }

  return (
    <section className="chartCard">
      <div className="chartHeader">
        <div>
          <span>Historical data: Yahoo Finance</span>
          <strong>Live quote: Finnhub</strong>
          <small>Selected range: {range}</small>
        </div>
        <div className="chartControls">
          <div className="segmented wide">
            {CHART_RANGES.map((item) => (
              <button className={range === item ? "active" : ""} key={item} onClick={() => setRange(item)} type="button">
                {item}
              </button>
            ))}
          </div>
          <div className="segmented">
            {CHART_MODES.map((item) => (
              <button className={mode === item ? "active" : ""} key={item} onClick={() => setMode(item)} type="button">
                {item}
              </button>
            ))}
          </div>
          <div className="maToggles">
            <label>
              <input checked={showVolume} onChange={(event) => setShowVolume(event.target.checked)} type="checkbox" />
              Volume
            </label>
            {[
              ["ma20", "MA20", false],
              ["ma50", "MA50", false],
              ["ma200", "MA200", !hasMa200],
            ].map(([key, label]) => (
              <label key={key}>
                <input
                  checked={maVisibility[key]}
                  disabled={key === "ma200" && !hasMa200}
                  onChange={(event) => setMaVisibility((current) => ({ ...current, [key]: event.target.checked }))}
                  type="checkbox"
                />
                {label}
              </label>
            ))}
          </div>
          <div className="segmented">
            <button onClick={resetZoom} type="button">Reset Zoom</button>
            <button className={isFullscreen ? "active" : ""} onClick={toggleFullscreen} type="button">Fullscreen</button>
          </div>
        </div>
      </div>

      {notice ? <div className="chartNotice">{notice}</div> : null}

      {visible.length ? (
        <>
          <div className="chartShell">
            <div
              ref={chartNodeRef}
              className="echartsCanvas"
              aria-label="Interactive professional OHLC chart"
              style={{ width: "100%", height: 560, minHeight: 560, position: "relative", display: "block" }}
            />
          </div>
          <div className="chartFooter">
            <span>Start: {formatCurrency(startPrice)}</span>
            <span>End: {formatCurrency(endPrice)}</span>
            <span>Wheel to zoom. Drag to pan. Crosshair for OHLC details.</span>
          </div>
        </>
      ) : (
        <div className="emptyChart">Historical candlestick data unavailable.</div>
      )}
      <style jsx>{chartStyles}</style>
      <style jsx global>{`
        .freedomChartTooltip .ftTooltip {
          display: grid;
          gap: 5px;
          min-width: 190px;
        }
        .freedomChartTooltip .ftTooltip strong {
          color: #fff;
          font-size: 13px;
          margin-bottom: 3px;
        }
        .freedomChartTooltip .ftTooltip span {
          color: #dfe7eb;
          display: flex;
          font-size: 12px;
          justify-content: space-between;
          gap: 18px;
        }
        .freedomChartTooltip .ftTooltip b {
          color: #fff;
        }
      `}</style>
    </section>
  );
}

const chartStyles = `
  .chartCard {
    background: rgba(8, 14, 17, 0.92);
    border: 1px solid color-mix(in srgb, var(--company-primary) 28%, rgba(179, 199, 207, 0.13));
    border-radius: 8px;
    box-shadow: 0 24px 90px color-mix(in srgb, var(--company-primary) 10%, transparent);
    margin: 18px auto 0;
    max-width: 1760px;
    padding: 18px;
    width: 100%;
  }
  .chartHeader {
    align-items: flex-start;
    display: flex;
    gap: 16px;
    justify-content: space-between;
    margin-bottom: 14px;
  }
  .chartHeader span,
  .chartHeader strong,
  .chartHeader small {
    display: block;
  }
  .chartHeader span {
    color: #aebdc4;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
  }
  .chartHeader strong {
    color: #fff;
    font-size: 14px;
    margin-top: 5px;
  }
  .chartHeader small {
    color: var(--company-accent);
    font-size: 12px;
    font-weight: 900;
    margin-top: 6px;
    text-transform: uppercase;
  }
  .chartControls {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: flex-end;
  }
  .segmented,
  .maToggles {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 7px;
    display: inline-flex;
    padding: 3px;
  }
  .segmented button {
    background: transparent;
    border: 0;
    border-radius: 5px;
    color: #c9d5db;
    cursor: pointer;
    font-size: 12px;
    font-weight: 900;
    min-height: 30px;
    padding: 0 10px;
  }
  .segmented button.active {
    background: linear-gradient(135deg, var(--company-primary), var(--company-accent));
    color: #061014;
  }
  .segmented.wide {
    max-width: 100%;
    overflow-x: auto;
  }
  .maToggles {
    gap: 8px;
    padding: 5px 8px;
  }
  .maToggles label {
    align-items: center;
    color: #c9d5db;
    display: inline-flex;
    flex-direction: row;
    font-size: 12px;
    font-weight: 900;
    gap: 5px;
    text-transform: none;
  }
  .maToggles label:has(input:disabled) {
    opacity: 0.48;
  }
  .maToggles input {
    accent-color: var(--company-accent);
    height: 14px;
    width: 14px;
  }
  .chartNotice {
    background: rgba(255, 255, 255, 0.055);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 7px;
    color: #cfd9dd;
    font-size: 13px;
    margin-bottom: 12px;
    padding: 10px 12px;
  }
  .chartShell {
    background:
      radial-gradient(circle at 12% 10%, color-mix(in srgb, var(--company-primary) 12%, transparent), transparent 34%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.025), rgba(255, 255, 255, 0.01));
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    display: block;
    height: 560px;
    min-height: 560px;
    overflow: hidden;
    position: relative;
    width: 100%;
  }
  .chartShell:fullscreen {
    background: #05090d;
    padding: 18px;
  }
  .echartsCanvas,
  .emptyChart {
    display: block;
    height: 560px;
    min-height: 560px;
    position: relative;
    width: 100%;
  }
  .chartShell:fullscreen .echartsCanvas {
    height: calc(100vh - 36px);
  }
  .emptyChart {
    align-items: center;
    color: #aebdc4;
    display: flex;
    font-weight: 900;
    justify-content: center;
  }
  .chartFooter {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    color: #dfe7eb;
    display: flex;
    font-size: 13px;
    font-weight: 900;
    gap: 18px;
    justify-content: space-between;
    padding-top: 12px;
  }
  @media (max-width: 720px) {
    .chartHeader {
      align-items: flex-start;
      flex-direction: column;
    }
    .chartControls {
      justify-content: flex-start;
    }
    .chartFooter {
      flex-direction: column;
      gap: 6px;
    }
  }
`;

export async function getServerSideProps(context) {
  const { createHash } = await import("crypto");
  const symbol = String(context.params?.symbol || "").trim().toUpperCase();
  const password = process.env.FREEDOM_TERMINAL_PASSWORD || "freedom123";
  const passwordHash = createHash("sha256").update(`${PASSWORD_SALT}:${password}`).digest("hex");

  return { props: { passwordHash, symbol } };
}

function PasswordGate({ passwordHash, onUnlock }) {
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  async function unlock(event) {
    event.preventDefault();
    const candidateHash = await browserHashPassword(password);
    if (candidateHash !== passwordHash) {
      setPasswordError("Incorrect password.");
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, "true");
    onUnlock();
  }

  return (
    <div className="gateScreen">
      <Head>
        <title>Freedom Terminal</title>
      </Head>
      <form className="gate" onSubmit={unlock}>
        <span>Private Research</span>
        <h1>Freedom Terminal</h1>
        <p>Enter the temporary password to open the company research page.</p>
        <input onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" value={password} />
        {passwordError ? <small>{passwordError}</small> : null}
        <button type="submit">Unlock Terminal</button>
      </form>
      <style jsx>{`
        .gateScreen {
          align-items: center;
          background: radial-gradient(circle at 18% 8%, rgba(0, 164, 239, 0.22), transparent 34rem), #05080b;
          color: #f6f8f9;
          display: flex;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          justify-content: center;
          min-height: 100vh;
          padding: 24px;
        }
        .gate {
          background: rgba(8, 14, 17, 0.94);
          border: 1px solid rgba(178, 198, 207, 0.16);
          border-radius: 8px;
          max-width: 460px;
          padding: 34px;
          width: 100%;
        }
        span {
          color: #79d9c5;
          display: block;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        h1,
        p {
          margin: 0;
        }
        h1 {
          font-size: 42px;
        }
        p {
          color: #aab8be;
          line-height: 1.55;
          margin-top: 10px;
        }
        input {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 7px;
          color: #fff;
          font-size: 16px;
          height: 48px;
          margin-top: 24px;
          padding: 0 14px;
          width: 100%;
        }
        small {
          color: #ffb1a5;
          display: block;
          font-weight: 750;
          margin-top: 10px;
        }
        button {
          background: linear-gradient(135deg, #00a4ef, #ffb900);
          border: 0;
          border-radius: 7px;
          color: #061014;
          cursor: pointer;
          font-size: 15px;
          font-weight: 950;
          height: 48px;
          margin-top: 18px;
          width: 100%;
        }
      `}</style>
    </div>
  );
}

function FreedomCompany({ passwordHash, symbol }) {
  const companyStyle = useMemo(() => getCompanyStyle(symbol), [symbol]);
  const fallback = useMemo(
    () => WATCHLIST[symbol] || { companyName: companyStyle.companyName || symbol, symbol, sector: "Unknown", qualityScore: 0 },
    [companyStyle.companyName, symbol]
  );
  const [unlocked, setUnlocked] = useState(false);
  const [checkingStorage, setCheckingStorage] = useState(true);
  const [quote, setQuote] = useState({ ...fallback, rating: getRating(fallback.qualityScore, null) });
  const [candles, setCandles] = useState([]);
  const [chartRange, setChartRange] = useState("1Y");
  const [chartMode, setChartMode] = useState("Candles");
  const [maVisibility, setMaVisibility] = useState({ ma20: true, ma50: true, ma200: true });
  const [historyNotice, setHistoryNotice] = useState("");
  const [research, setResearch] = useState(() => normalizeLoadedNote(symbol, null));
  const [valuation, setValuation] = useState(null);
  const [committee, setCommittee] = useState(null);
  const [assumptions, setAssumptions] = useState(DEFAULT_ASSUMPTIONS);
  const [diagnostics, setDiagnostics] = useState(null);
  const [analysisStatus, setAnalysisStatus] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [loading, setLoading] = useState(false);
  const [valuationLoading, setValuationLoading] = useState(false);
  const [savingResearch, setSavingResearch] = useState(false);
  const [error, setError] = useState("");
  const [researchStatus, setResearchStatus] = useState("");
  const [valuationError, setValuationError] = useState("");
  const [committeeError, setCommitteeError] = useState("");

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true");
    setChartRange(loadStoredChartRange());
    setChartMode(loadStoredChartMode());
    setMaVisibility(loadStoredMaVisibility());
    setCheckingStorage(false);
  }, []);

  useEffect(() => {
    if (checkingStorage) return;
    window.localStorage.setItem(CHART_RANGE_STORAGE_KEY, chartRange);
  }, [chartRange, checkingStorage]);

  useEffect(() => {
    if (checkingStorage) return;
    window.localStorage.setItem(CHART_MODE_STORAGE_KEY, chartMode);
  }, [chartMode, checkingStorage]);

  useEffect(() => {
    if (checkingStorage) return;
    window.localStorage.setItem(CHART_MA_STORAGE_KEY, JSON.stringify(maVisibility));
  }, [maVisibility, checkingStorage]);

  const loadValuation = useCallback(
    async (nextAssumptions) => {
      try {
        setValuationLoading(true);
        setValuationError("");
        const params = new URLSearchParams({ symbol });
        Object.entries(nextAssumptions).forEach(([key, value]) => params.set(key, value));
        const response = await fetch(`/api/freedom/valuation?${params.toString()}`);
        const data = await response.json().catch(() => null);

        if (!response.ok || (!data?.ok && data?.error)) setValuationError(data?.error || "Unable to load valuation.");
        setValuation(data || null);

        if (data?.assumptions) {
          setAssumptions({
            currentEPS: data.assumptions.currentEPS === null || data.assumptions.currentEPS === undefined ? "" : String(data.assumptions.currentEPS),
            expectedEPSGrowth: data.assumptions.expectedEPSGrowth === null || data.assumptions.expectedEPSGrowth === undefined ? "" : String(data.assumptions.expectedEPSGrowth),
            terminalPE: data.assumptions.terminalPE === null || data.assumptions.terminalPE === undefined ? "" : String(data.assumptions.terminalPE),
            requiredReturn: data.assumptions.requiredReturn === null || data.assumptions.requiredReturn === undefined ? "10" : String(data.assumptions.requiredReturn),
            marginOfSafetyTarget: data.assumptions.marginOfSafetyTarget === null || data.assumptions.marginOfSafetyTarget === undefined ? "15" : String(data.assumptions.marginOfSafetyTarget),
          });
        }
      } catch (err) {
        console.error("Freedom Terminal valuation load error:", err);
        setValuationError(err.message || "Unable to calculate valuation.");
      } finally {
        setValuationLoading(false);
      }
    },
    [symbol]
  );

  const loadCommittee = useCallback(async () => {
    try {
      setCommitteeError("");
      const response = await fetch(`/api/freedom/committee?symbol=${symbol}`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        setCommittee(null);
        setCommitteeError(data?.error || "Committee analysis is temporarily unavailable.");
        return;
      }
      setCommittee(data);
    } catch (err) {
      console.error("Freedom Terminal committee load error:", err);
      setCommittee(null);
      setCommitteeError("Committee analysis is temporarily unavailable.");
    }
  }, [symbol]);

  const refreshAnalysis = useCallback(async () => {
    try {
      setAnalysisLoading(true);
      setAnalysisError("");
      setResearchStatus("");
      const response = await fetch("/api/freedom/analyse-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Unable to refresh analysis.");
      setAnalysisStatus({
        lastUpdated: data.completedAt,
        researchStatus: data.research?.researchStatus || "completed",
        sourceStatus: data.sourceStatus || {},
      });
      await Promise.all([loadValuation(DEFAULT_ASSUMPTIONS), loadCommittee()]);
      const researchResponse = await fetch(`/api/freedom/research?symbol=${symbol}`);
      const researchData = await researchResponse.json().catch(() => null);
      if (researchData?.note) setResearch(normalizeLoadedNote(symbol, researchData.note));
      setResearchStatus("Analysis refreshed.");
    } catch (err) {
      console.error("Freedom Terminal analysis refresh error:", err);
      setAnalysisError(err.message || "Unable to refresh analysis.");
    } finally {
      setAnalysisLoading(false);
    }
  }, [loadCommittee, loadValuation, symbol]);

  const loadCompany = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setHistoryNotice("");
      setResearchStatus("");

      const [quoteResponse, historyResponse, researchResponse] = await Promise.allSettled([
        fetch(`/api/freedom/quotes?symbol=${symbol}`),
        fetch(`/api/freedom/history?symbol=${symbol}&range=5y&interval=1d`),
        fetch(`/api/freedom/research?symbol=${symbol}`),
      ]);

      const quoteData =
        quoteResponse.status === "fulfilled" ? await quoteResponse.value.json().catch(() => null) : null;
      const historyData =
        historyResponse.status === "fulfilled" ? await historyResponse.value.json().catch(() => null) : null;
      const researchData =
        researchResponse.status === "fulfilled" ? await researchResponse.value.json().catch(() => null) : null;

      const historyCandles = historyData?.ok ? historyData.candles || [] : [];
      setCandles(historyCandles);

      const nextQuote = quoteData?.quotes?.[0] || fallback;
      const historyHigh = Number.isFinite(historyData?.yearHigh) ? historyData.yearHigh : null;
      const historyLow = Number.isFinite(historyData?.yearLow) ? historyData.yearLow : null;
      const percentOffHigh =
        Number.isFinite(nextQuote.currentPrice) && Number.isFinite(historyHigh)
          ? ((nextQuote.currentPrice - historyHigh) / historyHigh) * 100
          : null;
      setQuote({
        ...nextQuote,
        yearHigh: historyHigh,
        yearLow: historyLow,
        percentOffHigh,
        rating: nextQuote.rating || getRating(nextQuote.qualityScore, percentOffHigh),
      });

      setDiagnostics({
        quote: quoteData?.diagnostics || null,
        historySource: historyData?.source || "Yahoo Finance",
        historyCount: historyCandles.length,
        quoteError: quoteData?.error || null,
        historyError: historyData?.error || null,
      });

      if (researchData?.note) {
        const note = normalizeLoadedNote(symbol, researchData.note);
        setResearch(note);
        setAnalysisStatus({
          lastUpdated: note.updatedAt,
          researchStatus: note.researchStatus,
          sourceStatus: researchData?.analysis
            ? {
                profile: Boolean(researchData.analysis.company),
                financials: Boolean(researchData.analysis.scores),
                valuation: Boolean(researchData.analysis.valuation),
                committee: Boolean(researchData.analysis.committee),
              }
            : {},
        });
      }
      if (!quoteData?.ok) setError(quoteData?.error || "Live market data unavailable. Showing fallback data where available.");
      if (!historyData?.ok) setHistoryNotice("Historical candlestick data unavailable.");

      await Promise.all([loadValuation(DEFAULT_ASSUMPTIONS), loadCommittee()]);
    } catch (err) {
      console.error("Freedom Terminal company load error:", err);
      setError(err.message || "Unable to load company data.");
    } finally {
      setLoading(false);
    }
  }, [fallback, loadCommittee, loadValuation, symbol]);

  useEffect(() => {
    if (unlocked) loadCompany();
  }, [loadCompany, unlocked]);

  function updateResearch(field, value) {
    setResearchStatus("");
    setResearch((current) => ({ ...current, [field]: value }));
  }

  function updateAssumption(field, value) {
    setValuationError("");
    setAssumptions((current) => ({ ...current, [field]: value }));
  }

  async function saveResearch(event) {
    event.preventDefault();
    try {
      setSavingResearch(true);
      setResearchStatus("");
      const response = await fetch("/api/freedom/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, ...research }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Unable to save research notes.");
      setResearch(normalizeLoadedNote(symbol, data?.note || null));
      setResearchStatus("Research saved.");
    } catch (err) {
      console.error("Freedom Terminal research save error:", err);
      setResearchStatus(err.message || "Unable to save research notes.");
    } finally {
      setSavingResearch(false);
    }
  }

  async function recalculateValuation(event) {
    event.preventDefault();
    await loadValuation(assumptions);
  }

  const healthScore = getHealthScore(symbol, committee);
  const selectedCandles = useMemo(() => visibleCandlesForRange(candles, chartRange), [candles, chartRange]);
  const trendAnalysis = useMemo(() => buildTrendAnalysis(selectedCandles, chartRange), [selectedCandles, chartRange]);
  const companyName = quote.companyName || companyStyle.companyName || symbol;
  const cards = [
    ["Current Price", formatCurrency(quote.currentPrice)],
    ["Daily Change %", formatPercent(quote.changePercent, true)],
    ["52W High", formatCurrency(quote.yearHigh)],
    ["52W Low", formatCurrency(quote.yearLow)],
    ["% Off High", formatPercent(quote.percentOffHigh)],
    ["Quality Score", quote.qualityScore ?? "--"],
    ["Rating", ratingLabel(quote.rating)],
  ];
  const valuationCards = [
    ["Fair Value", formatCurrency(valuation?.fairValue)],
    ["Buy Below", formatCurrency(valuation?.buyBelow)],
    ["Strong Buy Below", formatCurrency(valuation?.strongBuyBelow)],
    ["Expensive Above", formatCurrency(valuation?.expensiveAbove)],
    ["Margin of Safety", formatPercent(valuation?.marginOfSafety)],
    ["Expected 5-Year Return", formatPercent(valuation?.expectedFiveYearReturn)],
    ["Valuation Rating", valuation?.valuationRating || "--"],
  ];

  if (checkingStorage) {
    return (
      <div className="center">
        Opening company research...
        <style jsx>{`
          .center {
            align-items: center;
            background: #05080b;
            color: #aab8be;
            display: flex;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-weight: 800;
            justify-content: center;
            min-height: 100vh;
          }
        `}</style>
      </div>
    );
  }

  if (!unlocked) return <PasswordGate passwordHash={passwordHash} onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="page" style={styleVars(companyStyle)}>
      <Head>
        <title>{companyName} | Freedom Terminal</title>
      </Head>

      <header className="companyBanner">
        <Link className="back" href="/freedom">
          Back to Freedom Terminal
        </Link>
        <div className="bannerMain">
          <div className="logoBadge">{companyStyle.logoText}</div>
          <div className="bannerCopy">
            <span className="eyebrow">{quote.sector}</span>
            <h1>{companyName}</h1>
            <p>
              {quote.symbol} - {quote.sector} - {formatCurrency(quote.currentPrice)}
              <span className={Number.isFinite(quote.changePercent) && quote.changePercent >= 0 ? "up" : "down"}>
                {formatPercent(quote.changePercent, true)}
              </span>
            </p>
          </div>
          <span className={`rating statusPill large ${ratingClass(quote.rating)}`}>{ratingLabel(quote.rating)}</span>
        </div>
      </header>

      <section className="analysisBar">
        <div>
          <span>Analysis Status</span>
          <strong>{analysisStatus?.lastUpdated ? `Last analysed ${new Date(analysisStatus.lastUpdated).toLocaleString()}` : "Analysis not yet stored"}</strong>
        </div>
        <div className="analysisBadges">
          <span className={`freshness ${analysisStatus?.lastUpdated ? "fresh" : "stale"}`}>
            {analysisStatus?.lastUpdated ? "Stored analysis" : "Needs analysis"}
          </span>
          <span className={`freshness ${analysisStatus?.researchStatus === "completed" ? "fresh" : "stale"}`}>
            {analysisStatus?.researchStatus || "not_started"}
          </span>
          <span className={`freshness ${analysisStatus?.sourceStatus?.financials || analysisStatus?.sourceStatus?.valuation ? "fresh" : "stale"}`}>
            {analysisStatus?.sourceStatus?.financials || analysisStatus?.sourceStatus?.valuation ? "Sources loaded" : "Source status pending"}
          </span>
        </div>
        <button type="button" onClick={refreshAnalysis} disabled={analysisLoading}>
          {analysisLoading ? "Refreshing Analysis..." : "Refresh Analysis"}
        </button>
      </section>

      {analysisError ? (
        <section className="alert" role="alert">
          <strong>Analysis notice</strong>
          <span>{analysisError}</span>
        </section>
      ) : null}

      {error ? (
        <section className="alert" role="alert">
          <strong>Market data notice</strong>
          <span>{error}</span>
        </section>
      ) : null}

      <section className="diagnostics">
        <span>Temporary API Diagnostics</span>
        <div>
          <strong>API key detected:</strong> {diagnostics?.quote?.apiKeyDetected ? "yes" : "no"}
        </div>
        <div>
          <strong>Finnhub quote status:</strong> {diagnostics?.quote?.finnhubQuoteStatus || "not requested"}
        </div>
        <div>
          <strong>Historical source:</strong> {diagnostics?.historySource || "Yahoo Finance"}
        </div>
        <div>
          <strong>Returned symbol:</strong> {diagnostics?.quote?.returnedSymbol || symbol}
        </div>
        <div>
          <strong>Historical candles:</strong> {diagnostics?.historyCount ?? candles.length}
        </div>
        <div>
          <strong>Friendly error:</strong> {diagnostics?.quote?.friendlyErrorMessage || "none"}
        </div>
      </section>

      <section className="stats">
        {cards.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{loading ? "Loading..." : value}</strong>
          </article>
        ))}
      </section>

      <section className="healthSection">
        <div className="sectionHeader">
          <div>
            <span>Company Health Score</span>
            <h2>Business Quality Review</h2>
          </div>
          <div className="overallScore">
            <strong className={Number.isFinite(healthScore?.overallScore) ? buyScoreClass(healthScore.overallScore) : ""}>{healthScore?.overallScore ?? "--"}</strong>
            <span>/100</span>
          </div>
        </div>
        {healthScore ? (
          <div className="healthGrid">
            {healthScore.categories.map((category) => (
              <article className="healthCard" key={category.label}>
                <div className="healthCardTop">
                  <strong>{category.label}</strong>
                  <span>{category.score}</span>
                </div>
                <div className="healthBar">
                  <i style={{ width: `${Math.max(0, Math.min(category.score, 100))}%` }} />
                </div>
                <p>{category.explanation}</p>
              </article>
            ))}
          </div>
        ) : <div className="sourceNotice">Health scores unavailable until the analysis source has completed successfully.</div>}
      </section>

      <section className="valuationEngine">
        <div className="sectionHeader">
          <div>
            <span>Valuation Engine</span>
            <h2>EPS Multiple Model</h2>
            <p>Estimate only. Not financial advice.</p>
          </div>
          <span className={`rating statusPill large ${ratingClass(valuation?.valuationRating)}`}>
            {valuationLoading ? "INFO" : ratingLabel(valuation?.valuationRating)}
          </span>
        </div>
        <>
            {valuationError ? <div className="valuationError">{valuationError}</div> : null}
            <div className="valuationCards">
              {valuationCards.map(([label, value]) => (
                <article key={label}>
                  <span>{label}</span>
                  <strong className={label === "Valuation Rating" ? `statusPill ${ratingClass(valuation?.valuationRating)}` : ""}>
                    {valuationLoading ? "Loading..." : label === "Valuation Rating" ? ratingLabel(valuation?.valuationRating) : value}
                  </strong>
                </article>
              ))}
            </div>
            <form className="assumptionGrid" onSubmit={recalculateValuation}>
              <label>
                Current EPS
                <input inputMode="decimal" onChange={(event) => updateAssumption("currentEPS", event.target.value)} value={assumptions.currentEPS} />
              </label>
              <label>
                Expected EPS Growth %
                <input inputMode="decimal" onChange={(event) => updateAssumption("expectedEPSGrowth", event.target.value)} value={assumptions.expectedEPSGrowth} />
              </label>
              <label>
                Terminal PE
                <input inputMode="decimal" onChange={(event) => updateAssumption("terminalPE", event.target.value)} value={assumptions.terminalPE} />
              </label>
              <label>
                Required Return %
                <input inputMode="decimal" onChange={(event) => updateAssumption("requiredReturn", event.target.value)} value={assumptions.requiredReturn} />
              </label>
              <label>
                Margin of Safety Target %
                <input inputMode="decimal" onChange={(event) => updateAssumption("marginOfSafetyTarget", event.target.value)} value={assumptions.marginOfSafetyTarget} />
              </label>
              <button type="submit" disabled={valuationLoading}>
                {valuationLoading ? "Recalculating..." : "Recalculate"}
              </button>
            </form>
        </>
      </section>

      <section className="committeeSection">
        <div className="sectionHeader">
          <div>
            <span>AI Investment Committee</span>
            <h2>Professional Review Board</h2>
          </div>
          <span className={`rating statusPill large ${ratingClass(committee?.overallDecision)}`}>{ratingLabel(committee?.overallDecision)}</span>
        </div>
        {committeeError ? <div className="committeeNotice">{committeeError}</div> : null}
        <div className="committeeSummary">
          <article>
            <span>Overall Committee Decision</span>
            <strong className={`statusPill ${ratingClass(committee?.overallDecision)}`}>{ratingLabel(committee?.overallDecision)}</strong>
          </article>
          <article>
            <span>Committee Score</span>
            <strong>{committee?.committeeScore ?? "--"}</strong>
          </article>
          <article>
            <span>Confidence</span>
            <strong>{committee?.confidence ?? "--"}</strong>
          </article>
          <article className="finalSummary">
            <span>Final Summary</span>
            <p>{committee?.finalSummary || "Committee review unavailable until the analysis source has completed successfully."}</p>
          </article>
        </div>
        <div className="analystGrid">
          {(committee?.analysts || []).map((analyst) => (
            <article className="analystCard" key={analyst.role}>
              <div className="analystTop">
                <span>{analyst.role}</span>
                <strong>{analyst.score}</strong>
              </div>
              <span className={`decisionBadge statusPill ${ratingClass(analyst.decision)}`}>{ratingLabel(analyst.decision)}</span>
              <p>{analyst.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mainGrid">
        <div className="chartStack">
          <PriceTrendAnalysis analysis={trendAnalysis} />
        </div>
        <form className="researchEditor" onSubmit={saveResearch}>
          <div className="sectionHeader">
            <div>
              <span>Persistent Research</span>
              <h2>Research Notes</h2>
            </div>
            <button type="submit" disabled={savingResearch}>
              {savingResearch ? "Saving..." : "Save Research"}
            </button>
          </div>
          {researchStatus ? (
            <div className={researchStatus === "Research saved." ? "saveStatus success" : "saveStatus error"}>
              {researchStatus}
            </div>
          ) : null}
          <div className="numberGrid">
            <label>
              Fair Value
              <input inputMode="decimal" onChange={(event) => updateResearch("fairValue", event.target.value)} placeholder="Run analysis" value={research.fairValue} />
            </label>
            <label>
              Buy Below Price
              <input inputMode="decimal" onChange={(event) => updateResearch("buyBelow", event.target.value)} placeholder="Run analysis" value={research.buyBelow} />
            </label>
            <label>
              Decision
              <input onChange={(event) => updateResearch("decision", event.target.value)} placeholder="WATCH" value={research.decision} />
            </label>
          </div>
          <label>
            Investment Thesis
            <textarea onChange={(event) => updateResearch("thesis", event.target.value)} rows={5} value={research.thesis} />
          </label>
          <label>
            Why We Like It
            <textarea onChange={(event) => updateResearch("whyWeLikeIt", event.target.value)} rows={4} value={research.whyWeLikeIt} />
          </label>
          <label>
            Key Risks
            <textarea onChange={(event) => updateResearch("keyRisks", event.target.value)} rows={4} value={research.keyRisks} />
          </label>
        </form>
      </section>

      <MarketChart
        candles={candles}
        maVisibility={maVisibility}
        mode={chartMode}
        notice={historyNotice}
        range={chartRange}
        setMaVisibility={setMaVisibility}
        setMode={setChartMode}
        setRange={setChartRange}
      />

      <footer>Private research tool. Not financial advice.</footer>

      <style jsx>{`
        .page {
          background:
            radial-gradient(circle at 14% 0%, color-mix(in srgb, var(--company-primary) 20%, transparent), transparent 34rem),
            radial-gradient(circle at 86% 8%, color-mix(in srgb, var(--company-accent) 12%, transparent), transparent 30rem),
            #05080b;
          color: #f5f7f8;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          min-height: 100vh;
          padding: 28px;
        }
        .companyBanner,
        .alert,
        .analysisBar,
        .diagnostics,
        .stats,
        .healthSection,
        .valuationEngine,
        .committeeSection,
        .mainGrid,
        footer {
          margin-left: auto;
          margin-right: auto;
          max-width: 1760px;
        }
        .companyBanner {
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--company-primary) 36%, #05080b), color-mix(in srgb, var(--company-secondary) 32%, #05080b) 54%, color-mix(in srgb, var(--company-accent) 24%, #05080b)),
            rgba(8, 14, 17, 0.96);
          border: 1px solid color-mix(in srgb, var(--company-primary) 48%, rgba(255, 255, 255, 0.12));
          border-radius: 8px;
          box-shadow: 0 28px 100px color-mix(in srgb, var(--company-primary) 18%, transparent);
          overflow: hidden;
          padding: 28px 34px 34px;
          position: relative;
        }
        .companyBanner:after {
          background: radial-gradient(circle, color-mix(in srgb, var(--company-accent) 26%, transparent), transparent 62%);
          content: "";
          height: 280px;
          position: absolute;
          right: -80px;
          top: -110px;
          width: 280px;
        }
        .back {
          color: #fff;
          display: inline-flex;
          font-size: 18px;
          font-weight: 900;
          margin-bottom: 26px;
          position: relative;
          text-decoration: none;
          z-index: 1;
        }
        .bannerMain {
          align-items: center;
          display: grid;
          gap: 22px;
          grid-template-columns: 92px minmax(0, 1fr) auto;
          position: relative;
          z-index: 1;
        }
        .logoBadge {
          align-items: center;
          background: linear-gradient(135deg, var(--company-primary), var(--company-secondary));
          border: 2px solid var(--company-accent);
          border-radius: 999px;
          box-shadow: 0 0 42px color-mix(in srgb, var(--company-primary) 46%, transparent);
          color: #fff;
          display: flex;
          font-size: 24px;
          font-weight: 950;
          height: 92px;
          justify-content: center;
          width: 92px;
        }
        .eyebrow,
        .stats span,
        .sectionHeader span,
        .valuationCards span,
        .committeeSummary span,
        .analystTop span,
        .diagnostics span {
          color: #aebdc4;
          display: block;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        h1,
        h2,
        p {
          margin: 0;
        }
        h1 {
          color: #fff;
          font-size: 48px;
          font-weight: 950;
          letter-spacing: 0;
          line-height: 1;
          text-shadow: 0 0 28px color-mix(in srgb, var(--company-primary) 28%, transparent);
        }
        h2 {
          color: #fff;
          font-size: 22px;
        }
        .bannerCopy p {
          align-items: center;
          color: #eef6f8;
          display: flex;
          flex-wrap: wrap;
          font-size: 18px;
          gap: 12px;
          margin-top: 12px;
        }
        .alert,
        .valuationError,
        .committeeNotice {
          background: rgba(178, 73, 73, 0.16);
          border: 1px solid rgba(255, 137, 124, 0.28);
          border-radius: 8px;
          color: #ffd8d3;
          display: flex;
          gap: 12px;
          margin-top: 18px;
          padding: 14px 16px;
        }
        .analysisBar {
          align-items: center;
          background: rgba(8, 14, 17, 0.92);
          border: 1px solid rgba(179, 199, 207, 0.13);
          border-radius: 8px;
          display: grid;
          gap: 14px;
          grid-template-columns: minmax(0, 1fr) auto auto;
          margin-top: 18px;
          padding: 16px 18px;
        }
        .analysisBar span,
        .analysisBar strong {
          display: block;
        }
        .analysisBar > div:first-child span {
          color: #aebdc4;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
          text-transform: uppercase;
        }
        .analysisBar strong {
          color: #fff;
          font-size: 15px;
        }
        .analysisBadges {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }
        .freshness {
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          padding: 8px 10px;
          text-transform: uppercase;
        }
        .freshness.fresh {
          background: rgba(121, 217, 197, 0.15);
          color: #b8f4e6;
        }
        .freshness.stale {
          background: rgba(228, 184, 93, 0.15);
          color: #ffe3a4;
        }
        .diagnostics {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(179, 199, 207, 0.12);
          border-radius: 8px;
          color: #dfe7eb;
          display: grid;
          gap: 8px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin-top: 18px;
          padding: 16px;
        }
        .diagnostics span {
          grid-column: 1 / -1;
          margin-bottom: 0;
        }
        .diagnostics div {
          font-size: 13px;
        }
        .diagnostics strong {
          color: #fff;
        }
        .stats {
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          margin-top: 18px;
        }
        .stats article,
        .healthSection,
        .valuationEngine,
        .committeeSection,
        .researchEditor {
          background: rgba(8, 14, 17, 0.92);
          border: 1px solid rgba(179, 199, 207, 0.13);
          border-radius: 8px;
          padding: 18px;
        }
        .stats article {
          box-shadow: inset 0 2px 0 color-mix(in srgb, var(--company-primary) 44%, transparent);
        }
        .stats strong,
        .valuationCards strong,
        .committeeSummary strong,
        .analystTop strong {
          color: #fff;
          display: block;
          font-size: clamp(18px, 1.8vw, 28px);
          font-weight: 900;
          overflow-wrap: anywhere;
        }
        .sectionHeader {
          align-items: center;
          display: flex;
          justify-content: space-between;
          gap: 16px;
        }
        .healthSection,
        .valuationEngine,
        .committeeSection {
          margin-top: 18px;
        }
        .healthSection {
          background: linear-gradient(135deg, rgba(8, 17, 21, 0.96), color-mix(in srgb, var(--company-primary) 10%, rgba(10, 22, 22, 0.94)));
          border-color: color-mix(in srgb, var(--company-primary) 26%, rgba(179, 199, 207, 0.13));
        }
        .overallScore {
          align-items: baseline;
          background: color-mix(in srgb, var(--company-primary) 16%, transparent);
          border: 1px solid color-mix(in srgb, var(--company-primary) 36%, transparent);
          border-radius: 8px;
          display: flex;
          gap: 4px;
          min-width: 150px;
          padding: 14px 18px;
        }
        .overallScore strong {
          border-radius: 8px;
          color: #fff;
          font-size: 42px;
          font-weight: 950;
          line-height: 1;
          min-width: 70px;
          padding: 8px 10px;
          text-align: center;
        }
        .overallScore span {
          color: #aebdc4;
          font-size: 16px;
          font-weight: 900;
          margin: 0;
        }
        .healthGrid,
        .valuationCards,
        .committeeSummary,
        .analystGrid {
          display: grid;
          gap: 14px;
          margin-top: 18px;
        }
        .healthGrid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .valuationCards {
          grid-template-columns: repeat(7, minmax(0, 1fr));
        }
        .committeeSummary {
          grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(340px, 2fr);
        }
        .analystGrid {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }
        .healthCard,
        .valuationCards article,
        .committeeSummary article,
        .analystCard,
        .placeholderPanel,
        .sourceNotice {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 16px;
        }
        .healthCardTop,
        .analystTop {
          align-items: center;
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }
        .healthCardTop strong {
          color: #fff;
          font-size: 15px;
        }
        .healthCardTop span {
          color: var(--company-accent);
          font-size: 22px;
          font-weight: 950;
        }
        .healthBar {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          height: 9px;
          margin: 14px 0;
          overflow: hidden;
        }
        .healthBar i {
          background: linear-gradient(90deg, var(--company-primary), var(--company-accent));
          border-radius: inherit;
          display: block;
          height: 100%;
        }
        .healthCard p,
        .finalSummary p,
        .analystCard p,
        .placeholderPanel,
        .sourceNotice,
        .sectionHeader p {
          color: #dfe7eb;
          line-height: 1.55;
        }
        .valuationEngine {
          background: linear-gradient(135deg, rgba(9, 19, 23, 0.96), color-mix(in srgb, var(--company-accent) 9%, rgba(20, 17, 10, 0.94)));
          border-color: color-mix(in srgb, var(--company-accent) 28%, rgba(228, 184, 93, 0.24));
        }
        .committeeSection {
          background: linear-gradient(135deg, rgba(8, 17, 21, 0.96), color-mix(in srgb, var(--company-secondary) 12%, rgba(12, 18, 24, 0.94)));
          border-color: color-mix(in srgb, var(--company-primary) 24%, rgba(121, 217, 197, 0.2));
        }
        .decisionBadge,
        .rating,
        .statusPill {
          border-radius: 999px;
          color: #fff;
          display: inline-flex;
          font-size: 12px;
          font-weight: 950;
          justify-content: center;
          min-width: 112px;
          padding: 9px 12px;
          text-transform: uppercase;
        }
        .rating.large,
        .statusPill.large {
          font-size: 13px;
          min-width: 138px;
          padding: 12px 16px;
        }
        .decisionBadge {
          margin-bottom: 12px;
        }
        .assumptionGrid,
        .numberGrid {
          display: grid;
          gap: 12px;
        }
        .assumptionGrid {
          grid-template-columns: repeat(6, minmax(0, 1fr));
          margin-top: 18px;
        }
        .numberGrid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .placeholderPanel {
          margin-top: 18px;
        }
        .sourceNotice {
          margin-top: 18px;
        }
        .mainGrid {
          display: grid;
          gap: 18px;
          grid-template-columns: minmax(0, 1.2fr) minmax(420px, 0.8fr);
          margin-top: 18px;
        }
        .chartStack {
          display: grid;
          gap: 18px;
        }
        .researchEditor {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        label {
          color: #aebdc4;
          display: flex;
          flex-direction: column;
          font-size: 12px;
          font-weight: 900;
          gap: 8px;
          text-transform: uppercase;
        }
        input,
        textarea {
          background: rgba(255, 255, 255, 0.055);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 7px;
          color: #f5f7f8;
          font: inherit;
          font-size: 14px;
          font-weight: 500;
          outline: none;
          padding: 12px;
          resize: vertical;
          text-transform: none;
        }
        input:focus,
        textarea:focus {
          border-color: var(--company-primary);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--company-primary) 16%, transparent);
        }
        button {
          background: linear-gradient(135deg, var(--company-primary), var(--company-accent));
          border: 0;
          border-radius: 7px;
          color: #061014;
          cursor: pointer;
          font-weight: 950;
          min-height: 42px;
          padding: 0 18px;
        }
        button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }
        .saveStatus {
          border-radius: 7px;
          font-size: 13px;
          font-weight: 800;
          padding: 10px 12px;
        }
        .saveStatus.success {
          background: rgba(121, 217, 197, 0.12);
          color: #b8f4e6;
        }
        .saveStatus.error {
          background: rgba(178, 73, 73, 0.16);
          color: #ffd8d3;
        }
        .up {
          color: #87dfc2;
          font-weight: 850;
        }
        .down {
          color: #ffb15d;
          font-weight: 850;
        }
        .strongBuy {
          background: #0f8f4e;
          box-shadow: inset 0 0 0 1px #2ecc71;
          color: #fff;
        }
        .buy {
          background: #1e8449;
          color: #fff;
        }
        .watch {
          background: #d4ac0d;
          color: #111;
        }
        .holdOff {
          background: #e67e22;
          color: #111;
        }
        .avoid {
          background: #c0392b;
          color: #fff;
        }
        .sell {
          background: #922b21;
          color: #fff;
        }
        .info {
          background: #2471a3;
          color: #fff;
        }
        footer {
          color: #aebdc4;
          font-size: 13px;
          margin-top: 18px;
        }
        @media (max-width: 1320px) {
          .stats,
          .valuationCards,
          .diagnostics,
          .analystGrid,
          .healthGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .committeeSummary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .assumptionGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .mainGrid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 720px) {
          .page {
            padding: 16px;
          }
          .companyBanner {
            padding: 22px;
          }
          .bannerMain,
          .analysisBar,
          .sectionHeader {
            align-items: flex-start;
            display: flex;
            flex-direction: column;
          }
          .logoBadge {
            height: 76px;
            width: 76px;
          }
          h1 {
            font-size: 42px;
          }
          .stats,
          .healthGrid,
          .valuationCards,
          .committeeSummary,
          .analystGrid,
          .assumptionGrid,
          .numberGrid,
          .analysisBadges,
          .diagnostics {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

FreedomCompany.disableLayout = true;

export default FreedomCompany;
