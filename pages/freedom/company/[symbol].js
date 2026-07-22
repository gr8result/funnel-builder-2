import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FreedomModuleNav from "../../../components/freedom/FreedomModuleNav";
import { buildHeikinAshiCandles, chartTypeLabel, FreedomChartTypeSelector, FREEDOM_CHART_MODE_LABELS, normalizeChartType } from "../../../components/freedom/FreedomSharedChart";
import { calculateAdaptiveScores } from "../../../lib/freedom-terminal/adaptiveBuyScore";
import { calculateInvestmentSignal } from "../../../lib/freedom/signalEngine";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-terminal-unlocked";
const CHART_MODE_STORAGE_KEY = "freedom-terminal-chart-mode";
const CHART_RANGE_STORAGE_KEY = "freedom-terminal-chart-range";
const CHART_MA_STORAGE_KEY = "freedom-terminal-chart-ma";
const COMPANY_TAB_STORAGE_KEY = "freedom-terminal-company-tabs";
const COMPANY_CHART_STATE_KEY = "freedom-terminal-company-chart-state";
const CHART_INTERVAL_STORAGE_KEY = "freedom-terminal-chart-interval";
const CHART_PANEL_LAYOUT_STORAGE_KEY = "freedom-terminal-chart-panel-layout";
const CHART_MODES = FREEDOM_CHART_MODE_LABELS;
const CHART_RANGES = ["1D", "5D", "1M", "3M", "6M", "1Y", "3Y", "5Y", "MAX"];
const CHART_INTERVALS = ["1m", "5m", "15m", "30m", "1h", "4h", "1D", "1W"];
const DEFAULT_INTERVAL_BY_RANGE = {
  "1D": "5m",
  "5D": "15m",
  "1M": "1h",
  "3M": "1D",
  "6M": "1D",
  "1Y": "1D",
  "3Y": "1W",
  "5Y": "1W",
  "MAX": "1W",
};
const API_RANGE_BY_LABEL = {
  "1D": "1d",
  "5D": "5d",
  "1M": "1mo",
  "3M": "3mo",
  "6M": "6mo",
  "1Y": "1y",
  "3Y": "3y",
  "5Y": "5y",
  "MAX": "max",
};
const API_INTERVAL_BY_LABEL = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "4h": "4h",
  "1D": "1d",
  "1W": "1w",
};
const COMPANY_TABS = ["Overview", "Business Quality", "Valuation", "Analyst Review", "Price Trend", "Trade Setup", "Charts"];

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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

function formatChartCurrency(value, currency = "USD") {
  return Number.isFinite(value)
    ? new Intl.NumberFormat(currency === "AUD" ? "en-AU" : "en-US", {
        style: "currency",
        currency: currency || "USD",
        maximumFractionDigits: value >= 100 ? 2 : 4,
      }).format(value)
    : "--";
}

function formatChartTimestamp(value, timeZone = "America/New_York") {
  const timestamp = typeof value === "number" ? value * 1000 : Date.parse(String(value || "").replace(" ", "T"));
  if (!Number.isFinite(timestamp)) return "--";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(timestamp));
}

function intervalIsIntraday(interval) {
  return ["1m", "5m", "15m", "30m", "1h", "4h"].includes(interval);
}

function supportedIntervalsForRange(range) {
  if (range === "1D") return ["1m", "5m", "15m", "30m", "1h"];
  if (range === "5D") return ["5m", "15m", "30m", "1h"];
  if (range === "1M") return ["30m", "1h", "1D"];
  if (["3M", "6M", "1Y"].includes(range)) return ["1D"];
  return ["1D", "1W"];
}

function normalizeStoredInterval(value, range) {
  const interval = CHART_INTERVALS.includes(value) ? value : DEFAULT_INTERVAL_BY_RANGE[range] || "1D";
  const supported = supportedIntervalsForRange(range);
  return supported.includes(interval) ? interval : DEFAULT_INTERVAL_BY_RANGE[range] || supported[0] || "1D";
}

function labelForAxisDate(value, range, interval, timeZone = "America/New_York") {
  const timestamp = Date.parse(String(value || "").replace(" ", "T"));
  if (!Number.isFinite(timestamp)) return value;
  if (intervalIsIntraday(interval) || range === "1D" || range === "5D") {
    return new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(timestamp));
  }
  if (["1M", "3M", "6M", "1Y"].includes(range)) {
    return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", timeZone }).format(new Date(timestamp));
  }
  return new Intl.DateTimeFormat("en-AU", { month: "short", year: "2-digit", timeZone }).format(new Date(timestamp));
}

function buildDataQuality({ symbol, candles, range, interval, metadata }) {
  const first = metadata?.firstTimestamp || candles[0]?.date || candles[0]?.timestamp;
  const latest = metadata?.latestTimestamp || candles[candles.length - 1]?.date || candles[candles.length - 1]?.timestamp;
  return {
    symbol,
    exchange: metadata?.exchange || "--",
    currency: metadata?.currency || "USD",
    provider: metadata?.provider || metadata?.source || "Twelve Data",
    range,
    interval,
    first,
    latest,
    candleCount: metadata?.candleCount ?? candles.length,
    dataLabel: metadata?.dataLabel || (intervalIsIntraday(interval) ? "Delayed 15 minutes" : "End-of-day"),
    timezone: metadata?.exchangeTimezone || "America/New_York",
    error: metadata?.error || "",
  };
}

function priceScaleFromCandles(candles) {
  const highs = candles.map((candle) => candle.high).filter(Number.isFinite);
  const lows = candles.map((candle) => candle.low).filter(Number.isFinite);
  if (!highs.length || !lows.length) return null;
  const high = Math.max(...highs);
  const low = Math.min(...lows);
  const span = Math.max(0.01, high - low);
  const padding = span * 0.1;
  return { min: round(low - padding, 4), max: round(high + padding, 4), low, high };
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

function exponentialMovingAverage(values, period) {
  const multiplier = 2 / (period + 1);
  let previous = null;
  return values.map((value) => {
    if (!Number.isFinite(value)) return previous;
    if (previous === null) {
      previous = value;
      return value;
    }
    previous = value * multiplier + previous * (1 - multiplier);
    return previous;
  });
}

function rsiSeriesFromCloses(closes, period = 14) {
  return closes.map((_, index) => {
    if (index < period) return null;
    let gains = 0;
    let losses = 0;
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const change = closes[cursor] - closes[cursor - 1];
      if (change >= 0) gains += change;
      else losses += Math.abs(change);
    }
    if (!losses) return 100;
    const relativeStrength = gains / period / (losses / period);
    return round(100 - 100 / (1 + relativeStrength));
  });
}

function macdHistogramSeries(closes) {
  if (closes.length < 35) return closes.map(() => null);
  const ema12 = exponentialMovingAverage(closes, 12);
  const ema26 = exponentialMovingAverage(closes, 26);
  const macdLine = closes.map((_, index) => (Number.isFinite(ema12[index]) && Number.isFinite(ema26[index]) ? ema12[index] - ema26[index] : null));
  const signalLine = exponentialMovingAverage(macdLine, 9);
  return macdLine.map((value, index) => (Number.isFinite(value) && Number.isFinite(signalLine[index]) ? round(value - signalLine[index], 4) : null));
}

function detectFibAnchors(candles) {
  const clean = candles.filter((candle) => Number.isFinite(candle.low) && Number.isFinite(candle.high));
  if (clean.length < 12) return null;
  const recent = clean.slice(-100);
  const lowIndex = recent.reduce((best, candle, index) => (candle.low < recent[best].low ? index : best), 0);
  const afterLow = recent.slice(lowIndex);
  const highIndex = lowIndex + afterLow.reduce((best, candle, index) => (candle.high > afterLow[best].high ? index : best), 0);
  if (highIndex > lowIndex && recent[highIndex].high > recent[lowIndex].low) {
    return {
      low: { date: recent[lowIndex].date, price: round(recent[lowIndex].low) },
      high: { date: recent[highIndex].date, price: round(recent[highIndex].high) },
    };
  }
  const highFirstIndex = recent.reduce((best, candle, index) => (candle.high > recent[best].high ? index : best), 0);
  const afterHigh = recent.slice(highFirstIndex);
  const lowAfterHighIndex = highFirstIndex + afterHigh.reduce((best, candle, index) => (candle.low < afterHigh[best].low ? index : best), 0);
  if (lowAfterHighIndex > highFirstIndex && recent[highFirstIndex].high > recent[lowAfterHighIndex].low) {
    return {
      low: { date: recent[lowAfterHighIndex].date, price: round(recent[lowAfterHighIndex].low) },
      high: { date: recent[highFirstIndex].date, price: round(recent[highFirstIndex].high) },
    };
  }
  return null;
}

function fibLevelsForAnchors(anchors) {
  if (!Number.isFinite(anchors?.low?.price) || !Number.isFinite(anchors?.high?.price)) return [];
  const low = Math.min(anchors.low.price, anchors.high.price);
  const high = Math.max(anchors.low.price, anchors.high.price);
  const range = high - low;
  if (range <= 0) return [];
  return [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map((ratio) => ({
    ratio,
    label: `${Math.round(ratio * 1000) / 10}%`,
    price: round(high - range * ratio),
  }));
}

function confluenceLabels(level, overlayLevels, tradeLevels) {
  if (!Number.isFinite(level?.price)) return [];
  return [
    { label: "support", value: overlayLevels?.support },
    { label: "resistance", value: overlayLevels?.resistance },
    { label: "entry", value: tradeLevels?.entry },
    { label: "target", value: tradeLevels?.target },
    { label: "stop", value: tradeLevels?.stop },
  ].filter((item) => Number.isFinite(item.value) && Math.abs(item.value - level.price) / level.price <= 0.006).map((item) => item.label);
}

function recommendedTradeLevels({ quote, valuation, research, overlayLevels }) {
  const currentPrice = Number(quote?.currentPrice);
  const researchBuyBelow = Number(research?.buyBelow);
  const entry = Number.isFinite(valuation?.buyBelow) ? valuation.buyBelow : Number.isFinite(researchBuyBelow) ? researchBuyBelow : currentPrice;
  const fairValue = Number(valuation?.fairValue);
  const target = Number.isFinite(fairValue) && fairValue > entry ? fairValue : Number.isFinite(entry) ? entry * 1.18 : null;
  const supportStop = Number.isFinite(overlayLevels?.support) && Number.isFinite(entry) && overlayLevels.support < entry ? overlayLevels.support * 0.985 : null;
  const stop = Number.isFinite(supportStop) ? supportStop : Number.isFinite(entry) ? entry * 0.92 : null;
  return { entry: round(entry), target: round(target), stop: round(stop) };
}

function tradeMetrics(levels) {
  const portfolio = 100000;
  const maxRiskBudget = portfolio * 0.01;
  if (![levels?.entry, levels?.target, levels?.stop].every(Number.isFinite)) {
    return { percentageGain: null, maximumLoss: null, dollarProfit: null, dollarRisk: null, riskReward: null, positionSize: 0 };
  }
  const risk = levels.entry - levels.stop;
  const reward = levels.target - levels.entry;
  const positionSize = risk > 0 ? Math.max(0, Math.floor(maxRiskBudget / risk)) : 0;
  return {
    percentageGain: levels.entry > 0 ? (reward / levels.entry) * 100 : null,
    maximumLoss: positionSize * risk,
    dollarProfit: positionSize * reward,
    dollarRisk: positionSize * risk,
    riskReward: risk > 0 ? reward / risk : null,
    positionSize,
  };
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
  if (typeof window === "undefined") return "Standard candlesticks";
  const stored = window.localStorage.getItem(CHART_MODE_STORAGE_KEY);
  if (stored === "Candles") return "Standard candlesticks";
  if (stored === "Area") return "Area/fill";
  return CHART_MODES.includes(stored) ? stored : "Standard candlesticks";
}

function loadStoredChartRange() {
  if (typeof window === "undefined") return "1Y";
  const stored = window.localStorage.getItem(CHART_RANGE_STORAGE_KEY);
  return CHART_RANGES.includes(stored) ? stored : "1Y";
}

function loadStoredChartInterval(range = "1Y") {
  if (typeof window === "undefined") return DEFAULT_INTERVAL_BY_RANGE[range] || "1D";
  return normalizeStoredInterval(window.localStorage.getItem(CHART_INTERVAL_STORAGE_KEY), range);
}

function loadStoredPanelLayout() {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CHART_PANEL_LAYOUT_STORAGE_KEY) || "null");
    if (!parsed) return null;
    return {
      price: Number.isFinite(parsed.price) ? parsed.price : 68,
      volume: Number.isFinite(parsed.volume) ? parsed.volume : 12,
      rsi: Number.isFinite(parsed.rsi) ? parsed.rsi : 10,
      macd: Number.isFinite(parsed.macd) ? parsed.macd : 10,
    };
  } catch {
    return null;
  }
}

function persistPanelLayout(layout) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHART_PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {}
}

function readCompanyChartState(symbol) {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(COMPANY_CHART_STATE_KEY) || "{}");
    return parsed?.[symbol] || {};
  } catch {
    return {};
  }
}

function writeCompanyChartState(symbol, patch) {
  if (typeof window === "undefined" || !symbol) return;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(COMPANY_CHART_STATE_KEY) || "{}");
    const next = { ...parsed, [symbol]: { ...(parsed?.[symbol] || {}), ...patch } };
    window.localStorage.setItem(COMPANY_CHART_STATE_KEY, JSON.stringify(next));
  } catch {}
}

function readCompanyTab(symbol) {
  if (typeof window === "undefined") return "Overview";
  try {
    const parsed = JSON.parse(window.localStorage.getItem(COMPANY_TAB_STORAGE_KEY) || "{}");
    return COMPANY_TABS.includes(parsed?.[symbol]) ? parsed[symbol] : "Overview";
  } catch {
    return "Overview";
  }
}

function writeCompanyTab(symbol, tab) {
  if (typeof window === "undefined" || !symbol || !COMPANY_TABS.includes(tab)) return;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(COMPANY_TAB_STORAGE_KEY) || "{}");
    window.localStorage.setItem(COMPANY_TAB_STORAGE_KEY, JSON.stringify({ ...parsed, [symbol]: tab }));
  } catch {}
}

function loadStoredMaVisibility() {
  if (typeof window === "undefined") return { ma20: false, ma50: false, ma200: false };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CHART_MA_STORAGE_KEY) || "{}");
    return {
      ma20: typeof parsed.ma20 === "boolean" ? parsed.ma20 : false,
      ma50: typeof parsed.ma50 === "boolean" ? parsed.ma50 : false,
      ma200: typeof parsed.ma200 === "boolean" ? parsed.ma200 : false,
    };
  } catch {
    return { ma20: false, ma50: false, ma200: false };
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

function MarketChart({ candles, range, setRange, interval, setInterval, metadata, mode, setMode, notice, maVisibility, setMaVisibility, symbol, quote, valuation, research, tradeMode = false, onBackToResearch = null }) {
  const chartNodeRef = useRef(null);
  const chartRef = useRef(null);
  const initializedSymbolRef = useRef("");
  const zoomRef = useRef({ start: 45, end: 100 });
  const drawingModeRef = useRef("pan");
  const drawingFibRef = useRef(false);
  const refreshOverlayPixelsRef = useRef(() => {});
  const recommendedLevelsRef = useRef({ entry: null, target: null, stop: null });
  const [echartsReady, setEchartsReady] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showRsi, setShowRsi] = useState(false);
  const [showMacd, setShowMacd] = useState(false);
  const [zoomState, setZoomState] = useState({ start: 45, end: 100 });
  const [drawingMode, setDrawingMode] = useState("pan");
  const [tradeLevels, setTradeLevels] = useState({ entry: null, target: null, stop: null });
  const [linePixels, setLinePixels] = useState({ entry: null, target: null, stop: null });
  const [currentPricePixel, setCurrentPricePixel] = useState(null);
  const [draggingTradeLine, setDraggingTradeLine] = useState(null);
  const [fibAnchors, setFibAnchors] = useState(null);
  const [fibVisible, setFibVisible] = useState(true);
  const [fibPixels, setFibPixels] = useState({ levels: [], low: null, high: null });
  const [draggingFibAnchor, setDraggingFibAnchor] = useState(null);
  const [movingFib, setMovingFib] = useState(null);
  const [drawingFib, setDrawingFib] = useState(false);
  const [priceScale, setPriceScale] = useState(null);
  const [draggingPriceScale, setDraggingPriceScale] = useState(null);
  const [includeOverlaysInScale, setIncludeOverlaysInScale] = useState(false);
  const [panelLayout, setPanelLayout] = useState(() => loadStoredPanelLayout() || { price: 68, volume: 12, rsi: 10, macd: 10 });
  const [draggingPanel, setDraggingPanel] = useState(null);
  const [tradeMessage, setTradeMessage] = useState("");
  const [tradeActionSaving, setTradeActionSaving] = useState(false);
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
  const closeValues = useMemo(() => visible.map((candle) => candle.close), [visible]);
  const rsiValues = useMemo(() => rsiSeriesFromCloses(closeValues), [closeValues]);
  const macdValues = useMemo(() => macdHistogramSeries(closeValues), [closeValues]);
  const recommendedLevels = useMemo(() => recommendedTradeLevels({ quote, valuation, research, overlayLevels }), [overlayLevels, quote, research, valuation]);
  const plannerMetrics = useMemo(() => tradeMetrics(tradeLevels), [tradeLevels]);
  const effectiveMode = tradeMode ? "Standard candlesticks" : mode;
  const effectiveShowVolume = tradeMode || showVolume;
  const effectiveShowRsi = !tradeMode && showRsi;
  const effectiveShowMacd = !tradeMode && showMacd;
  const effectiveMaVisibility = useMemo(
    () => (tradeMode ? { ma20: false, ma50: false, ma200: false } : maVisibility),
    [maVisibility, tradeMode]
  );
  const startPrice = dailyVisible[0]?.close;
  const endPrice = dailyVisible[dailyVisible.length - 1]?.close;
  const tradeOverlayReady = tradeMode && [linePixels.entry, linePixels.target, linePixels.stop].every(Number.isFinite);
  const dataQuality = useMemo(() => buildDataQuality({ symbol, candles: visible, range, interval, metadata }), [interval, metadata, range, symbol, visible]);
  const activePanelLayout = useMemo(() => {
    const visiblePanels = ["price"];
    if (effectiveShowVolume) visiblePanels.push("volume");
    if (effectiveShowRsi) visiblePanels.push("rsi");
    if (effectiveShowMacd) visiblePanels.push("macd");
    const base = { price: panelLayout.price, volume: panelLayout.volume, rsi: panelLayout.rsi, macd: panelLayout.macd };
    const hiddenSpace = ["volume", "rsi", "macd"].filter((key) => !visiblePanels.includes(key)).reduce((total, key) => total + base[key], 0);
    base.price += hiddenSpace;
    const total = visiblePanels.reduce((sum, key) => sum + base[key], 0) || 100;
    return visiblePanels.reduce((next, key) => ({ ...next, [key]: (base[key] / total) * 100 }), {});
  }, [effectiveShowMacd, effectiveShowRsi, effectiveShowVolume, panelLayout]);

  useEffect(() => {
    recommendedLevelsRef.current = recommendedLevels;
    writeCompanyChartState(symbol, { recommendedLevels });
  }, [recommendedLevels, symbol]);

  useEffect(() => {
    const stored = readCompanyChartState(symbol);
    if (CHART_RANGES.includes(stored.range)) setRange(stored.range);
    if (stored.zoom && Number.isFinite(stored.zoom.start) && Number.isFinite(stored.zoom.end)) {
      zoomRef.current = stored.zoom;
      setZoomState(stored.zoom);
    }
    if (stored.tradeLevels && [stored.tradeLevels.entry, stored.tradeLevels.target, stored.tradeLevels.stop].every(Number.isFinite)) {
      setTradeLevels(stored.tradeLevels);
    } else {
      setTradeLevels(recommendedLevelsRef.current);
    }
    if (stored.fibAnchors) setFibAnchors(stored.fibAnchors);
    if (typeof stored.fibVisible === "boolean") setFibVisible(stored.fibVisible);
    initializedSymbolRef.current = symbol;
  }, [setRange, symbol]);

  useEffect(() => {
    drawingModeRef.current = drawingMode;
    if (drawingMode !== "fib") {
      drawingFibRef.current = false;
      setDrawingFib(false);
    }
  }, [drawingMode]);

  useEffect(() => {
    writeCompanyChartState(symbol, { range });
  }, [range, symbol]);

  const saveTradeLevels = useCallback((next) => {
    setTradeLevels(next);
    writeCompanyChartState(symbol, { tradeLevels: next });
  }, [symbol]);

  const updateTradeLine = useCallback((key, value) => {
    const nextValue = round(value);
    if (!Number.isFinite(nextValue)) return;
    setTradeLevels((current) => {
      const next = { ...current, [key]: nextValue };
      writeCompanyChartState(symbol, { tradeLevels: next });
      return next;
    });
  }, [symbol]);

  const saveFib = useCallback((next, visibleState = fibVisible) => {
    setFibAnchors(next);
    setFibVisible(visibleState);
    writeCompanyChartState(symbol, { fibAnchors: next, fibVisible: visibleState });
  }, [fibVisible, symbol]);

  function autoFib() {
    const detected = detectFibAnchors(visible);
    if (detected) saveFib(detected, true);
  }

  function resetPlanner() {
    saveTradeLevels(recommendedLevels);
  }

  function selectRange(nextRange) {
    const nextInterval = normalizeStoredInterval(DEFAULT_INTERVAL_BY_RANGE[nextRange], nextRange);
    setRange(nextRange);
    setInterval(nextInterval);
    setPriceScale(null);
    resetZoomState();
    writeCompanyChartState(symbol, { range: nextRange, interval: nextInterval, zoom: { start: 0, end: 100 } });
  }

  function selectInterval(nextInterval) {
    const normalized = normalizeStoredInterval(nextInterval, range);
    setInterval(normalized);
    setPriceScale(null);
    resetZoomState();
    writeCompanyChartState(symbol, { interval: normalized, zoom: { start: 0, end: 100 } });
  }

  function resetZoomState() {
    const nextZoom = { start: 0, end: 100 };
    zoomRef.current = nextZoom;
    setZoomState(nextZoom);
    chartRef.current?.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
  }

  async function createTradeAlert(alertType, triggerPrice, direction) {
    if (!Number.isFinite(triggerPrice)) throw new Error(`${alertType} price is not available.`);
    const response = await fetch("/api/freedom-trader/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol,
        alertType,
        triggerPrice,
        direction,
        priority: alertType.includes("STOP") ? "high" : "normal",
        message: `${alertType} alert for ${symbol} at ${formatCurrency(triggerPrice)}. Alert only; no trade is placed automatically.`,
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false) throw new Error(data?.error || `Unable to create ${alertType} alert.`);
    return data;
  }

  async function runTradeAction(action) {
    try {
      setTradeActionSaving(true);
      setTradeMessage("");
      if (action === "entry") {
        await createTradeAlert("ENTRY", tradeLevels.entry, "below");
        setTradeMessage(`Entry alert created at ${formatCurrency(tradeLevels.entry)}.`);
      }
      if (action === "all") {
        await Promise.all([
          createTradeAlert("ENTRY", tradeLevels.entry, "below"),
          createTradeAlert("STOP LOSS", tradeLevels.stop, "below"),
          createTradeAlert("TARGET", tradeLevels.target, "above"),
        ]);
        setTradeMessage("Entry, stop loss and target alerts created.");
      }
      if (action === "activate") {
        saveTradeLevels(tradeLevels);
        await createTradeAlert("ACTIVE TRADE SETUP", tradeLevels.entry, "below");
        setTradeMessage("Trade setup activated for monitoring. No trade was placed.");
      }
    } catch (error) {
      setTradeMessage(error.message || "Unable to create alert.");
    } finally {
      setTradeActionSaving(false);
    }
  }

  const dateIndex = useCallback((date) => {
    return visible.findIndex((candle) => candle.date === date);
  }, [visible]);

  const shiftedDate = useCallback((date, deltaIndex) => {
    const index = dateIndex(date);
    if (index < 0) return date;
    return visible[clamp(index + deltaIndex, 0, visible.length - 1)]?.date || date;
  }, [dateIndex, visible]);

  function selectDrawingMode(modeName) {
    setDrawingMode(modeName);
    setDraggingTradeLine(null);
    setDraggingFibAnchor(null);
    setMovingFib(null);
    setDrawingFib(false);
  }

  const currentPriceScale = useCallback(() => {
    if (Number.isFinite(priceScale?.min) && Number.isFinite(priceScale?.max)) return priceScale;
    const scaleCandles = normalizeChartType(effectiveMode) === "heikin" ? buildHeikinAshiCandles(visible) : visible;
    const base = priceScaleFromCandles(scaleCandles);
    if (!base) return null;
    if (!includeOverlaysInScale) return base;
    const overlayPrices = [quote?.currentPrice, tradeLevels.entry, tradeLevels.target, tradeLevels.stop]
      .concat(fibVisible && fibAnchors ? [fibAnchors.low?.price, fibAnchors.high?.price] : [])
      .filter(Number.isFinite);
    if (!overlayPrices.length) return base;
    const min = Math.min(base.low, ...overlayPrices);
    const max = Math.max(base.high, ...overlayPrices);
    const padding = Math.max(0.01, max - min) * 0.1;
    return { min: round(min - padding, 4), max: round(max + padding, 4), low: min, high: max };
  }, [effectiveMode, fibAnchors, fibVisible, includeOverlaysInScale, priceScale, quote?.currentPrice, tradeLevels.entry, tradeLevels.stop, tradeLevels.target, visible]);

  const chartPointFromPointer = useCallback((event) => {
    const node = chartNodeRef.current;
    if (!node || !visible.length) return null;
    const rect = node.getBoundingClientRect();
    const plotLeft = 64;
    const plotRight = 72;
    const plotTop = 42;
    const plotHeight = effectiveShowVolume ? rect.height * (tradeMode ? 0.7 : 0.48) : rect.height * 0.78;
    const plotWidth = Math.max(1, rect.width - plotLeft - plotRight);
    const xRatio = clamp((event.clientX - rect.left - plotLeft) / plotWidth, 0, 1);
    const yRatio = clamp((event.clientY - rect.top - plotTop) / Math.max(1, plotHeight), 0, 1);
    const zoom = zoomRef.current || { start: 0, end: 100 };
    const startIndex = Math.floor(((zoom.start ?? 0) / 100) * Math.max(visible.length - 1, 0));
    const endIndex = Math.ceil(((zoom.end ?? 100) / 100) * Math.max(visible.length - 1, 0));
    const index = clamp(Math.round(startIndex + xRatio * Math.max(1, endIndex - startIndex)), 0, visible.length - 1);
    const scale = currentPriceScale();
    if (!scale) return null;
    const price = scale.max - yRatio * (scale.max - scale.min);
    const date = visible[index]?.date;
    return date && Number.isFinite(price) && price > 0 ? { date, price: round(price) } : null;
  }, [currentPriceScale, effectiveShowVolume, tradeMode, visible]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
      setTimeout(() => chartRef.current?.resize(), 80);
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const refreshOverlayPixels = useCallback(() => {
    const chart = chartRef.current;
    const node = chartNodeRef.current;
    if (!visible.length || !node) return;
    const fallbackDate = visible[visible.length - 1]?.date;
    const rect = node.getBoundingClientRect();
    const plotLeft = 64;
    const plotRight = 72;
    const plotTop = 42;
    const plotHeight = effectiveShowVolume ? rect.height * (tradeMode ? 0.7 : 0.48) : rect.height * 0.78;
    const plotWidth = Math.max(1, rect.width - plotLeft - plotRight);
    const visibleScale = currentPriceScale();
    const fallbackPointToPixel = (date, price) => {
      if (!visibleScale || !Number.isFinite(price)) return null;
      const zoom = zoomRef.current || { start: 0, end: 100 };
      const startIndex = Math.floor(((zoom.start ?? 0) / 100) * Math.max(visible.length - 1, 0));
      const endIndex = Math.ceil(((zoom.end ?? 100) / 100) * Math.max(visible.length - 1, 0));
      const index = Math.max(startIndex, visible.findIndex((candle) => candle.date === date));
      const span = Math.max(1, endIndex - startIndex);
      const x = plotLeft + clamp((index - startIndex) / span, 0, 1) * plotWidth;
      const y = plotTop + clamp((visibleScale.max - price) / Math.max(0.0001, visibleScale.max - visibleScale.min), 0, 1) * plotHeight;
      return { x, y };
    };
    const pointToPixel = (date, price) => {
      if (chart) {
        try {
          const point = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [date || fallbackDate, price]);
          if (Array.isArray(point) && point.every(Number.isFinite)) return { x: point[0], y: point[1] };
          if (Number.isFinite(point)) return { x: plotLeft + plotWidth, y: point };
        } catch {}
      }
      return fallbackPointToPixel(date || fallbackDate, price);
    };
    if ([tradeLevels.entry, tradeLevels.target, tradeLevels.stop].every(Number.isFinite)) {
      const next = {
        entry: pointToPixel(fallbackDate, tradeLevels.entry)?.y,
        target: pointToPixel(fallbackDate, tradeLevels.target)?.y,
        stop: pointToPixel(fallbackDate, tradeLevels.stop)?.y,
      };
      if (Object.values(next).every(Number.isFinite)) setLinePixels(next);
    }
    if (Number.isFinite(quote?.currentPrice)) {
      const currentPriceY = pointToPixel(fallbackDate, quote.currentPrice)?.y;
      setCurrentPricePixel(Number.isFinite(currentPriceY) ? currentPriceY : null);
    } else {
      setCurrentPricePixel(null);
    }
    if (fibVisible && fibAnchors) {
      setFibPixels({
        levels: fibLevelsForAnchors(fibAnchors).map((level) => {
          const point = pointToPixel(fallbackDate, level.price);
          return point ? { ...level, y: point.y, confluence: confluenceLabels(level, overlayLevels, tradeLevels) } : null;
        }).filter(Boolean),
        low: pointToPixel(fibAnchors.low?.date, fibAnchors.low?.price),
        high: pointToPixel(fibAnchors.high?.date, fibAnchors.high?.price),
      });
    } else {
      setFibPixels({ levels: [], low: null, high: null });
    }
  }, [currentPriceScale, effectiveShowVolume, fibAnchors, fibVisible, overlayLevels, quote?.currentPrice, tradeLevels, tradeMode, visible]);

  useEffect(() => {
    refreshOverlayPixelsRef.current = refreshOverlayPixels;
  }, [refreshOverlayPixels]);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver = null;
    let resizeHandler = null;
    let chartInstance = null;

    async function mountChart() {
      if (!chartNodeRef.current) return;
      const echarts = await import("echarts");
      if (cancelled || !chartNodeRef.current) return;
      chartInstance = echarts.init(chartNodeRef.current, null, { renderer: "canvas" });
      chartRef.current = chartInstance;
      setEchartsReady(true);

      const updateSize = () => {
        chartInstance?.resize();
        window.requestAnimationFrame(() => refreshOverlayPixelsRef.current());
      };

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
      chartInstance?.dispose();
      if (chartRef.current === chartInstance) chartRef.current = null;
      setEchartsReady(false);
    };
  }, []);

  useEffect(() => {
    refreshOverlayPixels();
  }, [refreshOverlayPixels]);

  useEffect(() => {
    const activeDrag = draggingTradeLine || draggingFibAnchor || movingFib || drawingFib;
    if (!activeDrag) return undefined;
    const handleMove = (event) => {
      const point = chartPointFromPointer(event);
      if (!point) return;
      if (draggingTradeLine) updateTradeLine(draggingTradeLine, point.price);
      if (draggingFibAnchor && fibAnchors) saveFib({ ...fibAnchors, [draggingFibAnchor]: point }, true);
      if (movingFib?.anchors && movingFib?.startPoint) {
        const deltaIndex = dateIndex(point.date) - dateIndex(movingFib.startPoint.date);
        const deltaPrice = point.price - movingFib.startPoint.price;
        saveFib({
          low: {
            date: shiftedDate(movingFib.anchors.low.date, deltaIndex),
            price: round(movingFib.anchors.low.price + deltaPrice),
          },
          high: {
            date: shiftedDate(movingFib.anchors.high.date, deltaIndex),
            price: round(movingFib.anchors.high.price + deltaPrice),
          },
        }, true);
      }
      if (drawingFib || drawingFibRef.current) {
        setFibAnchors((current) => {
          const base = current?.low ? current : { low: point, high: point };
          return { ...base, high: point };
        });
      }
    };
    const handleUp = (event) => {
      const point = chartPointFromPointer(event);
      if ((drawingFib || drawingFibRef.current) && point) {
        setFibAnchors((current) => {
          const next = { low: current?.low || point, high: point };
          writeCompanyChartState(symbol, { fibAnchors: next, fibVisible: true });
          return next;
        });
        setFibVisible(true);
      }
      setDraggingTradeLine(null);
      setDraggingFibAnchor(null);
      setMovingFib(null);
      drawingFibRef.current = false;
      setDrawingFib(false);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [chartPointFromPointer, dateIndex, drawingFib, draggingFibAnchor, draggingTradeLine, fibAnchors, movingFib, saveFib, shiftedDate, symbol, updateTradeLine]);

  useEffect(() => {
    if (!draggingPriceScale) return undefined;
    const handleMove = (event) => {
      const deltaY = event.clientY - draggingPriceScale.startY;
      const span = draggingPriceScale.max - draggingPriceScale.min;
      const factor = Math.max(0.25, Math.min(4, 1 + deltaY / 260));
      const mid = (draggingPriceScale.max + draggingPriceScale.min) / 2;
      const nextSpan = span * factor;
      setPriceScale({ min: round(mid - nextSpan / 2), max: round(mid + nextSpan / 2) });
    };
    const handleUp = () => setDraggingPriceScale(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [draggingPriceScale]);

  useEffect(() => {
    if (!draggingPanel) return undefined;
    const handleMove = (event) => {
      const delta = ((event.clientY - draggingPanel.startY) / Math.max(1, draggingPanel.height)) * 100;
      setPanelLayout(() => {
        const next = { ...draggingPanel.layout };
        const topKey = draggingPanel.topKey;
        const bottomKey = draggingPanel.bottomKey;
        const top = clamp(draggingPanel.layout[topKey] + delta, topKey === "price" ? 45 : 6, 82);
        const bottom = clamp(draggingPanel.layout[bottomKey] - delta, 6, 35);
        next[topKey] = top;
        next[bottomKey] = bottom;
        persistPanelLayout(next);
        return next;
      });
    };
    const handleUp = () => setDraggingPanel(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [draggingPanel]);

  useEffect(() => {
    if (!chartRef.current || !chartNodeRef.current || !echartsReady || !visible.length) return;

    const chartVisible = normalizeChartType(effectiveMode) === "heikin" ? buildHeikinAshiCandles(visible) : visible;
    const dates = chartVisible.map((candle) => candle.date);
    const candleValues = chartVisible.map((candle) => [candle.open, candle.close, candle.low, candle.high]);
    const closeValues = chartVisible.map((candle) => candle.close);
    const chartStyles = getComputedStyle(chartNodeRef.current);
    const accentColor = chartStyles.getPropertyValue("--company-accent").trim() || "#E4B85D";
    const volumeValues = visible.map((candle) => ({
      value: candle.volume || 0,
      itemStyle: { color: candle.close >= candle.open ? "#2BD89F" : "#FF5F57" },
    }));
    const upColor = "#2BD89F";
    const downColor = "#FF5F57";
    const activePriceScale = currentPriceScale();
    const panelKeys = ["price"]
      .concat(effectiveShowVolume ? ["volume"] : [])
      .concat(effectiveShowRsi ? ["rsi"] : [])
      .concat(effectiveShowMacd ? ["macd"] : []);
    const panelGap = panelKeys.length > 1 ? 2 : 0;
    const usableHeight = 80 - panelGap * (panelKeys.length - 1);
    let panelCursor = 8;
    const panelGrids = {};
    panelKeys.forEach((key) => {
      const height = Math.max(key === "price" ? 45 : 6, (activePanelLayout[key] || 0) * usableHeight / 100);
      panelGrids[key] = { top: `${panelCursor}%`, height: `${height}%` };
      panelCursor += height + panelGap;
    });
    const priceSeries =
      ["candles", "hollow", "ohlc", "heikin"].includes(normalizeChartType(effectiveMode))
        ? {
            type: "candlestick",
            name: "OHLC",
            data: candleValues,
            barMaxWidth: normalizeChartType(effectiveMode) === "ohlc" ? 8 : range === "1M" || range === "3M" ? 18 : 14,
            barMinWidth: normalizeChartType(effectiveMode) === "ohlc" ? 2 : 4,
            itemStyle: {
              color: normalizeChartType(effectiveMode) === "hollow" ? "transparent" : upColor,
              color0: downColor,
              borderColor: upColor,
              borderColor0: downColor,
              borderWidth: normalizeChartType(effectiveMode) === "ohlc" ? 2 : 1.6,
            },
          }
        : {
            type: "line",
            name: effectiveMode,
            data: closeValues,
            showSymbol: false,
            smooth: true,
            sampling: "lttb",
            lineStyle: { color: accentColor, width: 2.6 },
            areaStyle:
              normalizeChartType(effectiveMode) === "area"
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
        show: false,
        top: 3,
        right: 16,
        textStyle: { color: "#C9D5DB", fontWeight: 800 },
        inactiveColor: "#53636B",
        data: ["OHLC", "MA20", "MA50", "MA200", "Trend Line", "Volume", "RSI", "MACD"],
      },
      grid: [
        {
          left: 64,
          right: 72,
          top: panelGrids.price?.top || "8%",
          height: panelGrids.price?.height || "72%",
        },
        {
          left: 64,
          right: 72,
          top: panelGrids.volume?.top || "86%",
          height: effectiveShowVolume ? panelGrids.volume?.height || "10%" : 0,
        },
        {
          left: 64,
          right: 72,
          top: panelGrids.rsi?.top || "86%",
          height: effectiveShowRsi ? panelGrids.rsi?.height || "12%" : 0,
        },
        {
          left: 64,
          right: 72,
          top: panelGrids.macd?.top || "86%",
          height: effectiveShowMacd ? panelGrids.macd?.height || "15%" : 0,
        },
      ],
      xAxis: [
        {
          type: "category",
          data: dates,
          boundaryGap: true,
          axisLine: { lineStyle: { color: "rgba(255,255,255,0.14)" } },
          axisLabel: { color: "#AEBCC4", hideOverlap: true, formatter: (value) => labelForAxisDate(value, range, interval, dataQuality.timezone) },
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
        {
          type: "category",
          gridIndex: 2,
          data: dates,
          boundaryGap: true,
          axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
          axisLabel: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
        },
        {
          type: "category",
          gridIndex: 3,
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
          axisLabel: { color: "#AEBCC4", formatter: (value) => formatChartCurrency(Number(value), dataQuality.currency) },
          min: Number.isFinite(activePriceScale?.min) ? activePriceScale.min : undefined,
          max: Number.isFinite(activePriceScale?.max) ? activePriceScale.max : undefined,
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.045)" } },
        },
        {
          scale: true,
          gridIndex: 1,
          position: "right",
          axisLine: { show: false },
          axisLabel: { color: "#71818A", formatter: (value) => formatVolume(Number(value)) },
          splitLine: { show: false },
        },
        {
          min: 0,
          max: 100,
          gridIndex: 2,
          position: "right",
          axisLine: { show: false },
          axisLabel: { color: "#71818A" },
          splitLine: { show: false },
          markLine: undefined,
        },
        {
          scale: true,
          gridIndex: 3,
          position: "right",
          axisLine: { show: false },
          axisLabel: { color: "#71818A" },
          splitLine: { show: false },
        },
      ],
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: [0, 1, 2, 3],
          start: zoomRef.current.start,
          end: zoomRef.current.end,
          zoomOnMouseWheel: true,
          moveOnMouseWheel: false,
          moveOnMouseMove: drawingModeRef.current === "pan",
          preventDefaultMouseMove: true,
          throttle: 30,
        },
        {
          type: "slider",
          xAxisIndex: [0, 1, 2, 3],
          start: zoomRef.current.start,
          end: zoomRef.current.end,
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
        effectiveMaVisibility.ma20
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
        effectiveMaVisibility.ma50
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
        effectiveMaVisibility.ma200 && hasMa200
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
        !tradeMode
          ? {
          name: "Trend Line",
          type: "line",
          data: trendLineData,
          showSymbol: false,
          silent: true,
          lineStyle: { color: "rgba(255,255,255,0.58)", width: 1.6, type: "dotted" },
        }
          : null,
          effectiveShowVolume
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
        effectiveShowRsi
          ? {
              name: "RSI",
              type: "line",
              xAxisIndex: 2,
              yAxisIndex: 2,
              data: rsiValues,
              smooth: true,
              showSymbol: false,
              lineStyle: { color: "#60A5FA", width: 1.8 },
              markLine: {
                symbol: "none",
                label: { color: "#AEBCC4" },
                lineStyle: { color: "rgba(228,184,93,0.6)", type: "dashed" },
                data: [{ yAxis: 70, name: "70" }, { yAxis: 30, name: "30" }],
              },
            }
          : null,
        effectiveShowMacd
          ? {
              name: "MACD",
              type: "bar",
              xAxisIndex: 3,
              yAxisIndex: 3,
              data: macdValues,
              itemStyle: { color: (params) => (params.value >= 0 ? "rgba(43,216,159,0.72)" : "rgba(255,95,87,0.72)") },
              barMaxWidth: 10,
            }
          : null,
      ].filter(Boolean),
    };

    chartRef.current.setOption(option, {
      lazyUpdate: true,
      notMerge: false,
      replaceMerge: ["series", "xAxis", "yAxis", "grid"],
    });
    chartRef.current.resize();
    window.requestAnimationFrame(refreshOverlayPixels);
    const handleZoom = (event) => {
      const batch = event?.batch?.[0] || event;
      if (Number.isFinite(batch?.start) && Number.isFinite(batch?.end)) {
        const nextZoom = { start: batch.start, end: batch.end };
        zoomRef.current = nextZoom;
        setZoomState(nextZoom);
        writeCompanyChartState(symbol, { zoom: nextZoom });
      }
      window.requestAnimationFrame(refreshOverlayPixels);
    };
    chartRef.current.off?.("datazoom");
    chartRef.current.on?.("datazoom", handleZoom);
  }, [activePanelLayout, currentPriceScale, dataQuality.currency, dataQuality.timezone, drawingMode, echartsReady, interval, visible, ma20, ma50, ma200, effectiveMaVisibility, effectiveMode, range, effectiveShowVolume, effectiveShowRsi, effectiveShowMacd, rsiValues, macdValues, trendLineData, hasMa200, priceScale, refreshOverlayPixels, symbol, tradeMode]);

  function resetZoom() {
    setPriceScale(null);
    resetZoomState();
    writeCompanyChartState(symbol, { zoom: { start: 0, end: 100 } });
  }

  function fitData() {
    setPriceScale(null);
    resetZoomState();
    chartRef.current?.resize();
    window.requestAnimationFrame(refreshOverlayPixels);
  }

  function resetPanelLayout() {
    const next = { price: 68, volume: 12, rsi: 10, macd: 10 };
    setPanelLayout(next);
    persistPanelLayout(next);
    setTimeout(() => chartRef.current?.resize(), 40);
  }

  function startPanelDrag(event, topKey, bottomKey) {
    const rect = event.currentTarget.closest(".chartShell")?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    setDraggingPanel({ startY: event.clientY, height: rect.height, topKey, bottomKey, layout: panelLayout });
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
    <section className={`chartCard ${tradeMode ? "tradeModeChart" : ""}`}>
      <div className="chartHeader">
        <div>
          <span>{tradeMode ? "Trade Mode" : "Historical chart"}</span>
          <strong>{symbol} {dataQuality.exchange !== "--" ? `· ${dataQuality.exchange}` : ""} · {dataQuality.currency}</strong>
          <small>Range: {range} · Interval: {interval} · {dataQuality.provider}</small>
        </div>
        <div className="chartControls">
          <div className="segmented wide" aria-label="Visible range">
            {CHART_RANGES.map((item) => (
              <button className={range === item ? "active" : ""} key={item} onClick={() => selectRange(item)} type="button">
                {item}
              </button>
            ))}
          </div>
          <label className="chartTypeSelect">
            Candle Interval
            <select value={interval} onChange={(event) => selectInterval(event.target.value)}>
              {CHART_INTERVALS.map((item) => (
                <option disabled={!supportedIntervalsForRange(range).includes(item)} key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          {!tradeMode ? (
            <FreedomChartTypeSelector
              value={normalizeChartType(mode)}
              onChange={(value) => setMode(chartTypeLabel(value))}
            />
          ) : null}
          {!tradeMode ? <div className="maToggles">
            <label>
              <input checked={showVolume} onChange={(event) => setShowVolume(event.target.checked)} type="checkbox" />
              Volume
            </label>
            <label>
              <input checked={showRsi} onChange={(event) => setShowRsi(event.target.checked)} type="checkbox" />
              RSI
            </label>
            <label>
              <input checked={showMacd} onChange={(event) => setShowMacd(event.target.checked)} type="checkbox" />
              MACD
            </label>
            <label>
              <input checked={includeOverlaysInScale} onChange={(event) => setIncludeOverlaysInScale(event.target.checked)} type="checkbox" />
              Include overlays in price scale
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
          </div> : null}
          <div className="segmented">
            <button onClick={fitData} type="button">Fit Data</button>
            <button onClick={resetZoom} type="button">Reset Zoom</button>
            <button onClick={resetPanelLayout} type="button">Reset Panel Layout</button>
            <button className={isFullscreen ? "active" : ""} onClick={toggleFullscreen} type="button">Fullscreen</button>
          </div>
          {tradeMode ? <div className="segmented drawingToolbar">
            {[
              ["cursor", "Cursor"],
              ["pan", "Pan"],
              ["fib", "Fib Retracement"],
              ["trade", "Entry / Target / Stop"],
              ["delete", "Delete Drawing"],
            ].map(([modeKey, label]) => (
              <button className={drawingMode === modeKey ? "active" : ""} key={modeKey} onClick={() => selectDrawingMode(modeKey)} type="button">
                {label}
              </button>
            ))}
          </div> : null}
          {tradeMode ? <div className="segmented">
            <button onClick={autoFib} type="button">Auto Fib</button>
            <button onClick={() => {
              setFibVisible((current) => {
                writeCompanyChartState(symbol, { fibVisible: !current });
                return !current;
              });
            }} type="button">{fibVisible ? "Hide Fib" : "Show Fib"}</button>
            <button onClick={() => {
              const detected = detectFibAnchors(visible);
              if (detected) saveFib(detected, true);
            }} type="button">Reset Fib</button>
          </div> : null}
          {tradeMode && onBackToResearch ? <button className="backResearchButton" type="button" onClick={onBackToResearch}>Back to Research</button> : null}
        </div>
      </div>

      {notice ? <div className="chartNotice">{notice}</div> : null}
      {range === "1D" && intervalIsIntraday(interval) && !metadata?.ok ? (
        <div className="chartNotice warning">INTRADAY DATA UNAVAILABLE FROM CURRENT PROVIDER. {metadata?.error || "The provider did not return intraday candles."}</div>
      ) : null}
      {visible.length && ((range === "1D" && visible.length < 20) || (range === "1M" && visible.length < 20)) ? (
        <div className="chartNotice warning">Only {visible.length} candles were returned for the selected {range} range and {interval} interval.</div>
      ) : null}

      {visible.length ? (
        <>
          <div
            className="chartShell"
            onDoubleClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              if (event.clientX >= rect.right - 84) setPriceScale(null);
            }}
            onPointerDownCapture={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              if (event.clientX >= rect.right - 84) {
                const scale = currentPriceScale();
                if (!scale) return;
                event.preventDefault();
                setDraggingPriceScale({ startY: event.clientY, ...scale });
                return;
              }
              if (tradeMode && drawingMode === "fib") {
                const point = chartPointFromPointer(event);
                if (point) {
                  event.preventDefault();
                  setFibAnchors({ low: point, high: point });
                  setFibVisible(true);
                  drawingFibRef.current = true;
                  setDrawingFib(true);
                }
              }
            }}
            onMouseDownCapture={(event) => {
              if (!tradeMode || drawingMode !== "fib") return;
              const rect = event.currentTarget.getBoundingClientRect();
              if (event.clientX >= rect.right - 84) return;
              const point = chartPointFromPointer(event);
              if (point) {
                event.preventDefault();
                setFibAnchors({ low: point, high: point });
                setFibVisible(true);
                drawingFibRef.current = true;
                setDrawingFib(true);
              }
            }}
          >
            <div
              ref={chartNodeRef}
              className="echartsCanvas"
              aria-label="Interactive professional OHLC chart"
              style={{ width: "100%", height: "100%", minHeight: 720, position: "relative", display: "block" }}
            />
            <div className="dataQualityBadge">
              <strong>{dataQuality.symbol} · {dataQuality.exchange} · {dataQuality.currency}</strong>
              <span>Range: {dataQuality.range} · Interval: {dataQuality.interval}</span>
              <span>{dataQuality.candleCount} candles · {dataQuality.dataLabel}</span>
              <span>Provider: {dataQuality.provider}</span>
              <span>{formatChartTimestamp(dataQuality.first, dataQuality.timezone)} - {formatChartTimestamp(dataQuality.latest, dataQuality.timezone)}</span>
            </div>
            {effectiveShowVolume ? (
              <button
                aria-label="Resize price and volume panels"
                className="panelDivider"
                onPointerDown={(event) => startPanelDrag(event, "price", "volume")}
                style={{ top: `${8 + (activePanelLayout.price || 68) * 0.8}%` }}
                type="button"
              />
            ) : null}
            {effectiveShowVolume && effectiveShowRsi ? (
              <button
                aria-label="Resize volume and RSI panels"
                className="panelDivider"
                onPointerDown={(event) => startPanelDrag(event, "volume", "rsi")}
                style={{ top: `${8 + ((activePanelLayout.price || 68) + (activePanelLayout.volume || 12)) * 0.8}%` }}
                type="button"
              />
            ) : null}
            {effectiveShowRsi && effectiveShowMacd ? (
              <button
                aria-label="Resize RSI and MACD panels"
                className="panelDivider"
                onPointerDown={(event) => startPanelDrag(event, "rsi", "macd")}
                style={{ top: `${8 + ((activePanelLayout.price || 68) + (activePanelLayout.volume || 0) + (activePanelLayout.rsi || 10)) * 0.8}%` }}
                type="button"
              />
            ) : null}
            {tradeOverlayReady ? <div className="rewardZone" style={{ top: Math.min(linePixels.target, linePixels.entry), height: Math.abs(linePixels.entry - linePixels.target) }} /> : null}
            {tradeOverlayReady ? <div className="riskZone" style={{ top: Math.min(linePixels.entry, linePixels.stop), height: Math.abs(linePixels.stop - linePixels.entry) }} /> : null}
            {Number.isFinite(currentPricePixel) ? (
              <div className="currentPriceLine" style={{ top: currentPricePixel }}>
                <span>Current</span>
                <strong>{formatCurrency(quote?.currentPrice)}</strong>
              </div>
            ) : null}
            {tradeMode && fibVisible && fibPixels.levels.map((level) => (
              <div
                className={`fibLevel ${level.confluence.length ? "confluence" : ""} ${drawingMode === "fib" || drawingMode === "delete" ? "movable" : ""}`}
                key={level.ratio}
                onPointerDown={(event) => {
                  if (drawingMode === "delete") {
                    event.preventDefault();
                    saveFib(null, false);
                    return;
                  }
                  if (drawingMode !== "fib" || !fibAnchors) return;
                  const point = chartPointFromPointer(event);
                  if (!point) return;
                  event.preventDefault();
                  setMovingFib({ startPoint: point, anchors: fibAnchors });
                }}
                style={{ top: level.y }}
              >
                <span>{level.label}</span>
                <strong>{formatCurrency(level.price)}</strong>
                {level.confluence.length ? <em>{level.confluence.join(" / ")}</em> : null}
              </div>
            ))}
            {tradeMode && fibVisible && fibPixels.low && fibPixels.high ? [
              { key: "low", label: "Swing Low", point: fibPixels.low, value: fibAnchors?.low?.price },
              { key: "high", label: "Swing High", point: fibPixels.high, value: fibAnchors?.high?.price },
            ].map((anchor) => (
              <button
                className={`fibAnchor ${drawingMode === "fib" || drawingMode === "delete" ? "interactive" : ""} ${draggingFibAnchor === anchor.key ? "dragging" : ""}`}
                key={anchor.key}
                onPointerDown={(event) => {
                  if (drawingMode === "delete") {
                    event.preventDefault();
                    saveFib(null, false);
                    return;
                  }
                  if (drawingMode !== "fib") return;
                  event.preventDefault();
                  setDraggingFibAnchor(anchor.key);
                }}
                style={{ left: anchor.point.x, top: anchor.point.y }}
                type="button"
              >
                <span>{anchor.label}</span>
                <strong>{formatCurrency(anchor.value)}</strong>
              </button>
            )) : null}
            {tradeMode && [
              { key: "target", label: "Target", value: tradeLevels.target, y: linePixels.target, className: "targetLine" },
              { key: "entry", label: "Entry", value: tradeLevels.entry, y: linePixels.entry, className: "entryLine" },
              { key: "stop", label: "Stop", value: tradeLevels.stop, y: linePixels.stop, className: "stopLine" },
            ].filter((line) => Number.isFinite(line.y)).map((line) => (
              <button
                className={`tradeLine ${line.className} ${drawingMode === "trade" || drawingMode === "delete" ? "interactive" : ""} ${draggingTradeLine === line.key ? "dragging" : ""}`}
                key={line.key}
                onPointerDown={(event) => {
                  if (drawingMode === "delete") {
                    event.preventDefault();
                    saveTradeLevels({ entry: null, target: null, stop: null });
                    return;
                  }
                  if (drawingMode !== "trade") return;
                  event.preventDefault();
                  setDraggingTradeLine(line.key);
                }}
                style={{ top: line.y }}
                type="button"
              >
                <span>{line.label}</span>
                <strong>{formatCurrency(line.value)}</strong>
              </button>
            ))}
          </div>
          {tradeMode ? <div className="plannerStrip tradePlannerLive">
            <article><span>Percentage Return</span><strong>{formatPercent(plannerMetrics.percentageGain, true)}</strong></article>
            <article><span>Maximum Loss</span><strong>{formatCurrency(plannerMetrics.maximumLoss)}</strong></article>
            <article><span>Dollar Profit</span><strong>{formatCurrency(plannerMetrics.dollarProfit)}</strong></article>
            <article><span>Dollar Risk</span><strong>{formatCurrency(plannerMetrics.dollarRisk)}</strong></article>
            <article><span>Risk/Reward</span><strong>{Number.isFinite(plannerMetrics.riskReward) ? plannerMetrics.riskReward.toFixed(2) : "--"}</strong></article>
            <article><span>Position Size</span><strong>{plannerMetrics.positionSize} shares</strong></article>
          </div> : null}
          {tradeMode ? (
            <>
              <div className="tradeSummary">
                <article><span>BUY / ENTRY</span><strong>{formatCurrency(tradeLevels.entry)}</strong></article>
                <article><span>STOP LOSS</span><strong>{formatCurrency(tradeLevels.stop)}</strong></article>
                <article><span>TARGET</span><strong>{formatCurrency(tradeLevels.target)}</strong></article>
                <article><span>RISK/REWARD</span><strong>{Number.isFinite(plannerMetrics.riskReward) ? plannerMetrics.riskReward.toFixed(2) : "--"}</strong></article>
                <article><span>EXPECTED PROFIT</span><strong>{formatCurrency(plannerMetrics.dollarProfit)}</strong></article>
              </div>
              <div className="tradeActions">
                <button type="button" onClick={resetPlanner}>Reset to Recommended Levels</button>
                <button type="button" disabled={tradeActionSaving} onClick={() => runTradeAction("entry")}>Alert Me at Entry</button>
                <button type="button" disabled={tradeActionSaving} onClick={() => runTradeAction("all")}>Create All Alerts</button>
                <button type="button" disabled={tradeActionSaving} onClick={() => runTradeAction("activate")}>Activate Trade Setup</button>
                {onBackToResearch ? <button type="button" onClick={onBackToResearch}>Back to Research</button> : null}
              </div>
              {tradeMessage ? <div className="tradeMessage">{tradeMessage}</div> : null}
            </>
          ) : null}
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
    max-width: none;
    padding: 18px;
    width: 100%;
  }
  .tradeModeChart {
    background: rgba(5, 9, 13, 0.98);
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: none;
    margin-top: 0;
    padding: 14px;
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
  .chartTypeSelect {
    align-items: center;
    color: #c9d5db;
    display: inline-flex;
    font-size: 12px;
    font-weight: 900;
    gap: 8px;
    text-transform: none;
  }
  .chartTypeSelect select {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 7px;
    color: #fff;
    font-weight: 900;
    height: 38px;
    padding: 0 10px;
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
  .chartNotice.warning {
    background: rgba(255, 153, 0, 0.12);
    border-color: rgba(255, 153, 0, 0.34);
    color: #ffd7a1;
    font-weight: 850;
  }
  .chartShell {
    background: #05090d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    display: block;
    height: min(78vh, 840px);
    min-height: 720px;
    overflow: hidden;
    position: relative;
    width: 100%;
  }
  .dataQualityBadge {
    background: rgba(5, 8, 11, 0.78);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 7px;
    display: grid;
    gap: 3px;
    left: 74px;
    max-width: min(420px, calc(100% - 160px));
    padding: 9px 11px;
    pointer-events: none;
    position: absolute;
    top: 14px;
    z-index: 7;
  }
  .dataQualityBadge strong,
  .dataQualityBadge span {
    display: block;
  }
  .dataQualityBadge strong {
    color: #fff;
    font-size: 12px;
    font-weight: 950;
  }
  .dataQualityBadge span {
    color: #c9d5db;
    font-size: 11px;
    font-weight: 800;
  }
  .panelDivider {
    background: rgba(255, 255, 255, 0.08);
    border: 0;
    border-radius: 0;
    cursor: ns-resize;
    height: 6px;
    left: 64px;
    margin: 0;
    min-height: 6px;
    padding: 0;
    position: absolute;
    right: 72px;
    transform: translateY(-50%);
    z-index: 6;
  }
  .panelDivider:hover,
  .panelDivider:focus-visible {
    background: var(--company-accent);
    outline: none;
  }
  .tradeModeChart .chartShell {
    height: min(80vh, 900px);
    min-height: 760px;
  }
  .chartShell:fullscreen {
    background: #05090d;
    padding: 18px;
  }
  .echartsCanvas,
  .emptyChart {
    display: block;
    height: 100%;
    min-height: 720px;
    position: relative;
    width: 100%;
  }
  .chartShell:fullscreen .echartsCanvas {
    height: calc(100vh - 36px);
  }
  .rewardZone,
  .riskZone {
    left: 64px;
    pointer-events: none;
    position: absolute;
    right: 72px;
    z-index: 2;
  }
  .rewardZone {
    background: linear-gradient(180deg, rgba(43, 216, 159, 0.18), rgba(43, 216, 159, 0.04));
    border-bottom: 1px solid rgba(43, 216, 159, 0.16);
    border-top: 1px solid rgba(43, 216, 159, 0.24);
  }
  .riskZone {
    background: linear-gradient(180deg, rgba(255, 95, 87, 0.05), rgba(255, 95, 87, 0.18));
    border-bottom: 1px solid rgba(255, 95, 87, 0.28);
    border-top: 1px solid rgba(255, 95, 87, 0.16);
  }
  .tradeLine {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 0;
    color: #fff;
    cursor: ns-resize;
    display: flex;
    font-size: 12px;
    font-weight: 950;
    height: 28px;
    justify-content: space-between;
    left: 64px;
    margin: 0;
    min-height: 28px;
    padding: 0;
    pointer-events: none;
    position: absolute;
    right: 72px;
    transform: translateY(-50%);
    width: auto;
    z-index: 8;
  }
  .tradeLine:before {
    content: "";
    height: 3px;
    left: 0;
    position: absolute;
    right: 0;
    top: 13px;
  }
  .tradeLine span,
  .tradeLine strong {
    border-radius: 999px;
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.28);
    padding: 7px 12px;
    position: relative;
    z-index: 1;
  }
  .targetLine:before,
  .targetLine span,
  .targetLine strong {
    background: rgba(43, 216, 159, 0.94);
    color: #03130d;
  }
  .entryLine:before,
  .entryLine span,
  .entryLine strong {
    background: rgba(96, 165, 250, 0.96);
    color: #06111f;
  }
  .stopLine:before,
  .stopLine span,
  .stopLine strong {
    background: rgba(255, 95, 87, 0.95);
    color: #210606;
  }
  .tradeLine.dragging span,
  .tradeLine.dragging strong {
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.18), 0 12px 30px rgba(0, 0, 0, 0.35);
  }
  .tradeLine.interactive {
    pointer-events: auto;
  }
  .fibLevel {
    align-items: center;
    border-top: 1px dashed rgba(228, 184, 93, 0.34);
    color: #d8e5ea;
    display: flex;
    gap: 8px;
    left: 64px;
    min-height: 20px;
    pointer-events: none;
    position: absolute;
    right: 72px;
    transform: translateY(-50%);
    opacity: 0.72;
    z-index: 3;
  }
  .fibLevel.movable {
    cursor: move;
    pointer-events: auto;
  }
  .fibLevel span,
  .fibLevel strong,
  .fibLevel em {
    background: rgba(5, 8, 11, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    font-size: 11px;
    font-style: normal;
    font-weight: 950;
    padding: 4px 7px;
  }
  .fibLevel.confluence {
    border-top-color: rgba(228, 184, 93, 0.86);
    opacity: 0.95;
  }
  .fibLevel.confluence em {
    background: rgba(228, 184, 93, 0.92);
    color: #1f1200;
  }
  .fibAnchor {
    background: rgba(228, 184, 93, 0.96);
    border: 1px solid rgba(255, 255, 255, 0.42);
    border-radius: 999px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.34);
    color: #1f1200;
    cursor: grab;
    display: grid;
    font-size: 11px;
    font-weight: 950;
    gap: 1px;
    line-height: 1.1;
    margin: 0;
    min-height: 0;
    min-width: 84px;
    padding: 6px 8px;
    pointer-events: none;
    position: absolute;
    transform: translate(-50%, -50%);
    z-index: 6;
  }
  .fibAnchor.dragging {
    cursor: grabbing;
    box-shadow: 0 0 0 3px rgba(228, 184, 93, 0.25), 0 12px 30px rgba(0, 0, 0, 0.42);
  }
  .fibAnchor.interactive {
    pointer-events: auto;
  }
  .currentPriceLine {
    align-items: center;
    border-top: 1px solid rgba(255, 255, 255, 0.68);
    color: #fff;
    display: flex;
    gap: 8px;
    left: 64px;
    pointer-events: none;
    position: absolute;
    right: 72px;
    transform: translateY(-50%);
    z-index: 7;
  }
  .currentPriceLine span,
  .currentPriceLine strong {
    background: rgba(255, 255, 255, 0.94);
    border-radius: 999px;
    color: #071014;
    font-size: 11px;
    font-weight: 950;
    padding: 5px 8px;
  }
  .plannerStrip {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(6, minmax(0, 1fr)) minmax(180px, 0.8fr);
    margin-top: 12px;
  }
  .plannerStrip article {
    background: rgba(255, 255, 255, 0.045);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 12px;
  }
  .plannerStrip span {
    color: #aebdc4;
    display: block;
    font-size: 11px;
    font-weight: 900;
    margin-bottom: 6px;
    text-transform: uppercase;
  }
  .plannerStrip strong {
    color: #fff;
    font-size: 17px;
    font-weight: 950;
  }
  .tradePlannerLive {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
  .tradeSummary {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    margin-top: 12px;
  }
  .tradeSummary article {
    background: rgba(255, 255, 255, 0.055);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 14px;
  }
  .tradeSummary span {
    color: #aebdc4;
    display: block;
    font-size: 11px;
    font-weight: 950;
    margin-bottom: 7px;
  }
  .tradeSummary strong {
    color: #fff;
    display: block;
    font-size: 20px;
    font-weight: 950;
  }
  .tradeActions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 12px;
  }
  .tradeActions button,
  .backResearchButton {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.13);
    border-radius: 7px;
    color: #fff;
    cursor: pointer;
    font-size: 13px;
    font-weight: 950;
    min-height: 38px;
    padding: 0 14px;
  }
  .tradeActions button:first-child,
  .tradeActions button:nth-child(4) {
    background: linear-gradient(135deg, #2bd89f, #e4b85d);
    border-color: transparent;
    color: #061014;
  }
  .tradeActions button:disabled {
    cursor: wait;
    opacity: 0.56;
  }
  .tradeMessage {
    background: rgba(43, 216, 159, 0.1);
    border: 1px solid rgba(43, 216, 159, 0.22);
    border-radius: 8px;
    color: #dffbf1;
    font-size: 13px;
    font-weight: 850;
    margin-top: 12px;
    padding: 12px;
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
    .plannerStrip,
    .tradePlannerLive,
    .tradeSummary {
      grid-template-columns: 1fr;
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
        <title>Freedom Investment</title>
      </Head>
      <form className="gate" onSubmit={unlock}>
        <span>Private Research</span>
        <h1>Freedom Investment</h1>
        <p>Enter the temporary password to open the company research page.</p>
        <input onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" value={password} />
        {passwordError ? <small>{passwordError}</small> : null}
        <button type="submit">Unlock Investment</button>
      </form>
      <style jsx>{`
        .gateScreen {
          align-items: center;
          background: #06110d;
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
          background: #d4af37;
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
  const [historyMetadata, setHistoryMetadata] = useState(null);
  const [experienceMode, setExperienceMode] = useState("research");
  const [activeTab, setActiveTab] = useState("Overview");
  const [chartRange, setChartRange] = useState("1Y");
  const [chartInterval, setChartInterval] = useState("1D");
  const [chartMode, setChartMode] = useState("Standard candlesticks");
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
  const storedScoreKeyRef = useRef("");

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true");
    setActiveTab(readCompanyTab(symbol));
    const storedRange = loadStoredChartRange();
    setChartRange(storedRange);
    setChartInterval(loadStoredChartInterval(storedRange));
    setChartMode(loadStoredChartMode());
    setMaVisibility(loadStoredMaVisibility());
    setExperienceMode("research");
    setCheckingStorage(false);
  }, [symbol]);

  function selectTab(tab) {
    setActiveTab(tab);
    writeCompanyTab(symbol, tab);
  }

  useEffect(() => {
    if (checkingStorage) return;
    window.localStorage.setItem(CHART_RANGE_STORAGE_KEY, chartRange);
  }, [chartRange, checkingStorage]);

  useEffect(() => {
    if (checkingStorage) return;
    const normalized = normalizeStoredInterval(chartInterval, chartRange);
    if (normalized !== chartInterval) {
      setChartInterval(normalized);
      return;
    }
    window.localStorage.setItem(CHART_INTERVAL_STORAGE_KEY, normalized);
  }, [chartInterval, chartRange, checkingStorage]);

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
        fetch(`/api/freedom/history?symbol=${symbol}&range=${API_RANGE_BY_LABEL[chartRange] || "1y"}&interval=${API_INTERVAL_BY_LABEL[chartInterval] || "1d"}`),
        fetch(`/api/freedom/research?symbol=${symbol}`),
      ]);

      const quoteData =
        quoteResponse.status === "fulfilled" ? await quoteResponse.value.json().catch(() => null) : null;
      const historyData =
        historyResponse.status === "fulfilled" ? await historyResponse.value.json().catch(() => null) : null;
      const researchData =
        researchResponse.status === "fulfilled" ? await researchResponse.value.json().catch(() => null) : null;

      const historyCandles = historyData?.ok ? historyData.candles || [] : [];
      const nextQuote = quoteData?.quotes?.[0] || fallback;
      setCandles(historyCandles);
      setHistoryMetadata({
        ok: Boolean(historyData?.ok),
        provider: historyData?.provider || historyData?.source || "Twelve Data",
        source: historyData?.source || historyData?.provider || "Twelve Data",
        dataLabel: historyData?.dataLabel || null,
        exchange: historyData?.exchange || null,
        currency: historyData?.currency || nextQuote?.currency || "USD",
        exchangeTimezone: historyData?.exchangeTimezone || null,
        candleCount: historyData?.candleCount ?? historyCandles.length,
        firstTimestamp: historyData?.firstTimestamp || historyCandles[0]?.date || null,
        latestTimestamp: historyData?.latestTimestamp || historyCandles[historyCandles.length - 1]?.date || null,
        interval: historyData?.interval || chartInterval,
        range: historyData?.range || chartRange,
        error: historyData?.error || null,
      });

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
      if (!historyData?.ok) setHistoryNotice(historyData?.error || "Historical candlestick data unavailable.");

      await Promise.all([loadValuation(DEFAULT_ASSUMPTIONS), loadCommittee()]);
    } catch (err) {
      console.error("Freedom Terminal company load error:", err);
      setError(err.message || "Unable to load company data.");
    } finally {
      setLoading(false);
    }
  }, [chartInterval, chartRange, fallback, loadCommittee, loadValuation, symbol]);

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
  const adaptiveScore = useMemo(
    () => calculateAdaptiveScores({ symbol, quote, valuation, committee, history: candles }),
    [candles, committee, quote, symbol, valuation]
  );
  const investmentSignal = useMemo(
    () => calculateInvestmentSignal({
      ticker: symbol,
      exchange: quote.exchange || "NASDAQ",
      currency: quote.currency || "USD",
      timeframe: "1D",
      decision: adaptiveScore.decision,
      confidence: adaptiveScore.confidence,
      buyScore: adaptiveScore.buyScore,
      quote,
      valuation,
    }),
    [adaptiveScore, quote, symbol, valuation]
  );
  const companyName = quote.companyName || companyStyle.companyName || symbol;
  const cards = [
    ["Current Price", formatCurrency(quote.currentPrice)],
    ["Daily Change %", formatPercent(quote.changePercent, true)],
    ["52W High", formatCurrency(quote.yearHigh)],
    ["52W Low", formatCurrency(quote.yearLow)],
    ["% Off High", formatPercent(quote.percentOffHigh)],
    ["Buy Score", adaptiveScore.buyScore ?? "--"],
    ["Decision", `${investmentSignal.overallSignal} (${investmentSignal.timeframe})`],
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

  useEffect(() => {
    if (!unlocked || !Number.isFinite(Number(quote.currentPrice)) || !Number.isFinite(Number(adaptiveScore.buyScore))) return;
    const storeKey = `${symbol}:${adaptiveScore.buyScore}:${adaptiveScore.convictionScore}:${adaptiveScore.decision}:${round(quote.currentPrice, 2)}:${round(valuation?.fairValue, 2)}`;
    if (storedScoreKeyRef.current === storeKey) return;
    storedScoreKeyRef.current = storeKey;

    fetch("/api/freedom/score-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol,
        company: companyName,
        buyScore: adaptiveScore.buyScore,
        convictionScore: adaptiveScore.convictionScore,
        decision: adaptiveScore.decision,
        currentPrice: quote.currentPrice,
        fairValue: valuation?.fairValue,
        reason: adaptiveScore.reason,
        scoreDetails: adaptiveScore,
      }),
    }).catch((err) => {
      console.error("Freedom score history save skipped:", err);
    });
  }, [adaptiveScore, companyName, quote.currentPrice, symbol, unlocked, valuation?.fairValue]);

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
        <title>{companyName} | Freedom Investment</title>
      </Head>

      <section className="platformBanner" aria-label="Current Freedom workspace">
        <strong><span className="platformIcon" aria-hidden="true">{"\u{1F4C8}"}</span>Freedom Investment</strong>
      </section>
      <FreedomModuleNav module="investment" />

      <header className="companyBanner">
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
          <div className="bannerActions">
            <span className={`rating statusPill large ${ratingClass(investmentSignal.overallSignal)}`}>
              {investmentSignal.overallSignal} ({investmentSignal.timeframe})
            </span>
            <button className="headerTradeButton" type="button" onClick={() => setExperienceMode("trade")}>
              Create Trade Setup
            </button>
            <Link className="headerTraderLink" href={`/freedom-trader/company/${encodeURIComponent(symbol)}`}>
              Open in Freedom Trader
            </Link>
          </div>
        </div>
      </header>

      {experienceMode === "trade" ? (
        <main className="tradeModeWorkspace">
          <section className="tradeModeIntro">
            <div>
              <span>Trade Mode</span>
              <h2>{companyName} Visual Trade Planner</h2>
              <p>Entry, stop loss and target are the primary controls. Fibonacci remains secondary for confluence.</p>
            </div>
            <button type="button" onClick={() => setExperienceMode("research")}>Back to Research</button>
          </section>
          <MarketChart
            candles={candles}
            maVisibility={maVisibility}
            metadata={historyMetadata}
            mode={chartMode}
            notice={historyNotice}
            onBackToResearch={() => setExperienceMode("research")}
            quote={quote}
            range={chartRange}
            interval={chartInterval}
            research={research}
            setMaVisibility={setMaVisibility}
            setInterval={setChartInterval}
            setMode={setChartMode}
            setRange={setChartRange}
            symbol={symbol}
            tradeMode
            valuation={valuation}
          />
        </main>
      ) : (
      <>
      <nav className="companyTabs" aria-label="Company analysis tabs">
        {COMPANY_TABS.map((tab) => (
          <button className={activeTab === tab ? "active" : ""} key={tab} onClick={() => selectTab(tab)} type="button">
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === "Overview" ? (
        <section className="overviewTab">
          <article className="overviewHero">
            <span>Main Recommendation</span>
            <strong className={`statusPill large ${ratingClass(investmentSignal.overallSignal)}`}>
              {investmentSignal.overallSignal} ({investmentSignal.timeframe})
            </strong>
            <p>{adaptiveScore.reason}</p>
            <button type="button" onClick={() => setExperienceMode("trade")}>Create Trade Setup</button>
          </article>
          <div className="overviewMetrics">
            <article><span>Overall Score</span><strong>{adaptiveScore.buyScore ?? "--"}/100</strong></article>
            <article><span>Confidence</span><strong>{adaptiveScore.confidence ?? "--"}%</strong></article>
            <article><span>Current Price</span><strong>{formatCurrency(quote.currentPrice)}</strong></article>
            <article><span>Fair Value</span><strong>{formatCurrency(valuation?.fairValue)}</strong></article>
          </div>
          <div className="overviewLists">
            <article>
              <h2>Top Reasons</h2>
              {(adaptiveScore.topPositives || []).map((item) => <p key={item}>{item}</p>)}
            </article>
            <article>
              <h2>Key Risks</h2>
              {(adaptiveScore.topNegatives || []).map((item) => <p key={item}>{item}</p>)}
            </article>
          </div>
        </section>
      ) : null}

      {activeTab === "Business Quality" ? (
      <>
      <section className="adaptiveScoreSection">
        <div className="scoreGaugePanel">
          <article className="scoreGaugeCard">
            <div className={`scoreGauge ${buyScoreClass(adaptiveScore.buyScore)}`} style={{ "--score": adaptiveScore.buyScore }}>
              <div>
                <strong>{adaptiveScore.buyScore}</strong>
                <span>/100</span>
              </div>
            </div>
            <span>Buy Score</span>
            <p>{adaptiveScore.whyBuyScore}</p>
          </article>
          <article className="scoreGaugeCard conviction">
            <div className={`scoreGauge ${buyScoreClass(adaptiveScore.convictionScore)}`} style={{ "--score": adaptiveScore.convictionScore }}>
              <div>
                <strong>{adaptiveScore.convictionScore}</strong>
                <span>/100</span>
              </div>
            </div>
            <span>Conviction Score</span>
            <p>{adaptiveScore.whyConviction}</p>
          </article>
        </div>

        <div className="decisionMatrix">
          <div className="sectionHeader">
            <div>
              <span>Adaptive Buy Score Engine</span>
              <h2>Decision Matrix</h2>
            </div>
            <span className={`rating statusPill large ${ratingClass(adaptiveScore.decision)}`}>{ratingLabel(adaptiveScore.decision)}</span>
          </div>
          <div className="decisionGrid">
            <article>
              <span>Decision</span>
              <strong>{ratingLabel(adaptiveScore.decision)}</strong>
            </article>
            <article>
              <span>Confidence</span>
              <strong>{adaptiveScore.confidence}%</strong>
            </article>
            <article>
              <span>Conviction</span>
              <strong>{adaptiveScore.convictionLabel}</strong>
            </article>
            <article>
              <span>Largest Contributor</span>
              <strong>{adaptiveScore.largestContributor?.label || "--"}</strong>
            </article>
            <article>
              <span>Largest Deduction</span>
              <strong>{adaptiveScore.largestDeduction?.label || "--"}</strong>
            </article>
          </div>
          <p className="scoreReason">{adaptiveScore.reason}</p>
          <div className="scoreLists">
            <div>
              <h3>Top Positives</h3>
              {adaptiveScore.topPositives.map((item) => <p key={item}>{item}</p>)}
            </div>
            <div>
              <h3>Top Risks</h3>
              {adaptiveScore.topNegatives.map((item) => <p key={item}>{item}</p>)}
            </div>
          </div>
        </div>

        <div className="scoreBreakdown">
          <div className="sectionHeader">
            <div>
              <span>Every Point Explained</span>
              <h2>Buy Score Breakdown</h2>
            </div>
          </div>
          <div className="breakdownGrid">
            {adaptiveScore.components.map((component) => (
              <article key={component.key}>
                <div className="breakdownTop">
                  <strong>{component.label}</strong>
                  <span>{component.points}/{component.max}</span>
                </div>
                <div className="healthBar">
                  <i style={{ width: `${Math.max(0, Math.min((component.points / component.max) * 100, 100))}%` }} />
                </div>
                <p>{component.why}</p>
                <small>Deduction: {component.deduction} points</small>
              </article>
            ))}
          </div>
          <div className="convictionGrid">
            {adaptiveScore.convictionFactors.map((factor) => (
              <article key={factor.label}>
                <strong>{factor.label}</strong>
                <span>{factor.score}/100</span>
                <p>{factor.why}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      </>
      ) : null}

      {activeTab === "Analyst Review" ? (
      <>
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
      </>
      ) : null}

      {activeTab === "Price Trend" ? (
      <>
      <section className="stats">
        {cards.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{loading ? "Loading..." : value}</strong>
          </article>
        ))}
      </section>
      </>
      ) : null}

      {activeTab === "Business Quality" ? (
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
      ) : null}

      {activeTab === "Valuation" ? (
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
      ) : null}

      {activeTab === "Analyst Review" ? (
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
      ) : null}

      {activeTab === "Price Trend" ? (
      <section className="mainGrid singlePanel">
        <div className="chartStack">
          <PriceTrendAnalysis analysis={trendAnalysis} />
        </div>
      </section>
      ) : null}

      {activeTab === "Trade Setup" ? (
      <section className="mainGrid singlePanel">
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
      ) : null}

      {activeTab === "Charts" ? (
      <MarketChart
        candles={candles}
        maVisibility={maVisibility}
        metadata={historyMetadata}
        mode={chartMode}
        notice={historyNotice}
        quote={quote}
        range={chartRange}
        interval={chartInterval}
        research={research}
        setMaVisibility={setMaVisibility}
        setInterval={setChartInterval}
        setMode={setChartMode}
        setRange={setChartRange}
        symbol={symbol}
        valuation={valuation}
      />
      ) : null}

      <footer>Private research tool. Not financial advice.</footer>
      </>
      )}

      <style jsx>{`
        .page {
          background: #06110d;
          color: #f5f7f8;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          min-height: 100vh;
          padding: 96px 28px 28px;
        }
        .companyBanner,
        .companyTabs,
        .tradeModeWorkspace,
        .overviewTab,
        .alert,
        .adaptiveScoreSection,
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
        .platformBanner {
          align-items: center;
          background: #00843d;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
          display: flex;
          gap: 14px;
          justify-content: space-between;
          left: 0;
          padding: 14px 28px;
          position: fixed;
          right: 0;
          top: 0;
          z-index: 100;
        }
        .platformBanner strong {
          align-items: center;
          color: #fff;
          display: inline-flex;
          gap: 10px;
          font-size: clamp(24px, 2.6vw, 34px);
          font-weight: 950;
        }
        .platformBanner span {
          color: #fff;
          font-size: clamp(14px, 1.4vw, 18px);
          font-weight: 900;
        }
        .platformBanner .platformIcon {
          color: #d4af37;
          font-size: 0.9em;
          line-height: 1;
        }
        .platformSwitch {
          display: inline-flex;
          gap: 8px;
        }
        .platformSwitch a {
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 999px;
          color: #fff;
          font-size: 14px;
          font-weight: 950;
          padding: 10px 14px;
          text-decoration: none;
        }
        .platformSwitch a.active {
          background: #00843d;
          border-color: rgba(255, 255, 255, 0.36);
        }
        .platformSwitch a:not(.active) {
          background: #0057d9;
          border-color: #0057d9;
        }
        .tradeModeWorkspace {
          margin-top: 18px;
        }
        .companyBanner {
          background: #082118;
          border: 1px solid rgba(16, 185, 129, 0.34);
          border-radius: 8px;
          box-shadow: 0 28px 100px color-mix(in srgb, var(--company-primary) 18%, transparent);
          overflow: hidden;
          padding: 28px 34px 34px;
          position: relative;
        }
        .companyBanner:after {
          content: "";
          display: none;
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
        .bannerActions {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          justify-content: flex-end;
          position: relative;
          z-index: 1;
        }
        .headerTradeButton,
        .tradeModeIntro button {
          background: #d4af37;
          border: 0;
          border-radius: 7px;
          color: #061014;
          cursor: pointer;
          font-size: 14px;
          font-weight: 950;
          min-height: 44px;
          padding: 0 18px;
        }
        .headerTraderLink {
          align-items: center;
          background: #0057d9;
          border: 1px solid #0057d9;
          border-radius: 7px;
          color: #fff;
          display: inline-flex;
          font-size: 14px;
          font-weight: 950;
          min-height: 44px;
          padding: 0 18px;
          text-decoration: none;
        }
        .tradeModeIntro {
          align-items: center;
          background: rgba(8, 14, 17, 0.9);
          border: 1px solid rgba(179, 199, 207, 0.13);
          border-radius: 8px;
          display: flex;
          gap: 18px;
          justify-content: space-between;
          margin-bottom: 12px;
          padding: 16px 18px;
        }
        .tradeModeIntro span {
          color: #79d9c5;
          display: block;
          font-size: 12px;
          font-weight: 950;
          margin-bottom: 6px;
          text-transform: uppercase;
        }
        .tradeModeIntro h2,
        .tradeModeIntro p {
          margin: 0;
        }
        .tradeModeIntro h2 {
          color: #fff;
          font-size: 24px;
        }
        .tradeModeIntro p {
          color: #cbd7dc;
          line-height: 1.45;
          margin-top: 5px;
        }
        .companyTabs {
          background: rgba(8, 14, 17, 0.92);
          border: 1px solid rgba(179, 199, 207, 0.13);
          border-radius: 8px;
          display: flex;
          gap: 6px;
          margin-top: 18px;
          overflow-x: auto;
          padding: 8px;
        }
        .companyTabs button {
          background: transparent;
          border: 1px solid transparent;
          color: #cbd7dc;
          flex: 0 0 auto;
          min-height: 40px;
          padding: 0 14px;
        }
        .companyTabs button.active {
          background: #0b8f55;
          border-color: rgba(255, 255, 255, 0.16);
          color: #061014;
        }
        .overviewTab {
          display: grid;
          gap: 18px;
          grid-template-columns: minmax(320px, 0.85fr) minmax(0, 1.15fr);
          margin-top: 18px;
        }
        .overviewHero,
        .overviewMetrics article,
        .overviewLists article {
          background: rgba(8, 14, 17, 0.92);
          border: 1px solid rgba(179, 199, 207, 0.13);
          border-radius: 8px;
          padding: 18px;
        }
        .overviewHero {
          display: grid;
          gap: 14px;
        }
        .overviewHero > span,
        .overviewMetrics span {
          color: #aebdc4;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .overviewHero p,
        .overviewLists p {
          color: #dfe7eb;
          line-height: 1.55;
        }
        .overviewMetrics {
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .overviewMetrics strong {
          color: #fff;
          display: block;
          font-size: 28px;
          font-weight: 950;
          margin-top: 8px;
        }
        .overviewLists {
          display: grid;
          gap: 14px;
          grid-column: 1 / -1;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .overviewLists p {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          margin-top: 10px;
          padding: 12px;
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
        .adaptiveScoreSection {
          display: grid;
          gap: 18px;
          grid-template-columns: 420px minmax(0, 1fr);
          margin-top: 18px;
        }
        .scoreGaugePanel,
        .decisionMatrix,
        .scoreBreakdown {
          background: rgba(8, 14, 17, 0.94);
          border: 1px solid color-mix(in srgb, var(--company-primary) 24%, rgba(179, 199, 207, 0.13));
          border-radius: 8px;
          box-shadow: 0 20px 70px color-mix(in srgb, var(--company-primary) 10%, transparent);
          padding: 18px;
        }
        .scoreGaugePanel {
          display: grid;
          gap: 14px;
          grid-row: span 2;
        }
        .scoreGaugeCard {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.055), color-mix(in srgb, var(--company-primary) 8%, transparent));
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          display: grid;
          gap: 12px;
          justify-items: center;
          padding: 18px;
          text-align: center;
        }
        .scoreGaugeCard.conviction {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.055), color-mix(in srgb, var(--company-accent) 8%, transparent));
        }
        .scoreGaugeCard > span {
          color: #fff;
          font-size: 16px;
          font-weight: 950;
          text-transform: uppercase;
        }
        .scoreGaugeCard p,
        .scoreReason,
        .scoreLists p,
        .breakdownGrid p,
        .convictionGrid p {
          color: #dfe7eb;
          line-height: 1.55;
          margin: 0;
        }
        .scoreGauge {
          --score: 0;
          align-items: center;
          background:
            radial-gradient(circle at center, #081014 0 56%, transparent 57%),
            conic-gradient(var(--company-primary) calc(var(--score) * 1%), rgba(255, 255, 255, 0.1) 0);
          border-radius: 999px;
          display: flex;
          height: 154px;
          justify-content: center;
          width: 154px;
        }
        .scoreGauge.buy,
        .scoreGauge.strongBuy {
          background:
            radial-gradient(circle at center, #081014 0 56%, transparent 57%),
            conic-gradient(#79d9c5 calc(var(--score) * 1%), rgba(255, 255, 255, 0.1) 0);
        }
        .scoreGauge.watch {
          background:
            radial-gradient(circle at center, #081014 0 56%, transparent 57%),
            conic-gradient(#e4b85d calc(var(--score) * 1%), rgba(255, 255, 255, 0.1) 0);
        }
        .scoreGauge.holdOff,
        .scoreGauge.avoid {
          background:
            radial-gradient(circle at center, #081014 0 56%, transparent 57%),
            conic-gradient(#ff8a62 calc(var(--score) * 1%), rgba(255, 255, 255, 0.1) 0);
        }
        .scoreGauge div {
          align-items: baseline;
          display: flex;
          gap: 4px;
        }
        .scoreGauge strong {
          color: #fff;
          font-size: 42px;
          font-weight: 950;
        }
        .scoreGauge span {
          color: #aebdc4;
          font-size: 15px;
          font-weight: 900;
        }
        .decisionGrid,
        .breakdownGrid,
        .convictionGrid,
        .scoreLists {
          display: grid;
          gap: 14px;
          margin-top: 18px;
        }
        .decisionGrid {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }
        .decisionGrid article,
        .breakdownGrid article,
        .convictionGrid article,
        .scoreLists > div {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 16px;
        }
        .decisionGrid span,
        .breakdownGrid small {
          color: #aebdc4;
          display: block;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        .decisionGrid strong {
          color: #fff;
          display: block;
          font-size: 22px;
          font-weight: 950;
          overflow-wrap: anywhere;
        }
        .scoreReason {
          background: color-mix(in srgb, var(--company-primary) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--company-primary) 24%, transparent);
          border-radius: 8px;
          margin-top: 18px;
          padding: 14px 16px;
        }
        .scoreLists {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        h3 {
          color: #fff;
          font-size: 15px;
          margin: 0 0 12px;
          text-transform: uppercase;
        }
        .breakdownGrid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .convictionGrid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .breakdownTop {
          align-items: center;
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }
        .breakdownTop strong,
        .convictionGrid strong {
          color: #fff;
          font-size: 15px;
          font-weight: 950;
        }
        .breakdownTop span,
        .convictionGrid span {
          color: var(--company-accent);
          font-size: 18px;
          font-weight: 950;
        }
        .convictionGrid p {
          margin-top: 10px;
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
        .mainGrid.singlePanel {
          display: block;
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
          .healthGrid,
          .breakdownGrid,
          .convictionGrid,
          .decisionGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .adaptiveScoreSection {
            grid-template-columns: 1fr;
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
            padding: 88px 16px 16px;
          }
          .companyBanner {
            padding: 22px;
          }
          .bannerMain,
          .bannerActions,
          .analysisBar,
          .tradeModeIntro,
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
          .overviewTab,
          .overviewLists,
          .healthGrid,
          .valuationCards,
          .committeeSummary,
          .analystGrid,
          .adaptiveScoreSection,
          .decisionGrid,
          .breakdownGrid,
          .convictionGrid,
          .scoreLists,
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
