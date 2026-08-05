import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FreedomModuleNav from "../../../components/freedom/FreedomModuleNav";
import supabase from "../../../lib/supabaseClient";
import { buildHeikinAshiCandles, FreedomChartDisplayToggles, FreedomChartTypeSelector, FREEDOM_CHART_TYPES, normalizeChartType } from "../../../components/freedom/FreedomSharedChart";
import { canonicalCompanyTicker, companyMeta } from "../../../lib/freedom/companyRoutes";
import { normalizeSignalLabel, signalClassName } from "../../../lib/freedom/signalEngine";
import {
  calculatePositionMetrics,
  computeFibLevels,
  DEFAULT_MINIMUM_RISK_REWARD,
  DEFAULT_SAFETY_BUFFER_PERCENT,
  detectDirectionFromTrend,
  generateFibTradePlan,
  validateLevelOrder,
} from "../../../lib/freedom-trader/fibTradePlan";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-trader-unlocked";
const PLANNER_STORAGE_KEY = "freedom-trader-visual-levels";
const CHART_RANGE_STORAGE_KEY = "freedom-trader-chart-ranges";
const CHART_TYPE_STORAGE_KEY = "freedom-trader-chart-type";
const FIB_STORAGE_KEY = "freedom-trader-fib-retracements";

const LEVEL_ASSIGNMENT_LABELS = { entry: "ENTRY", stop: "STOP", target: "TARGET 1", target2: "TARGET 2" };

const FIB_BAND_COLORS = [
  "rgba(255, 76, 76, 0.18)",
  "rgba(255, 153, 0, 0.18)",
  "rgba(255, 226, 92, 0.18)",
  "rgba(35, 209, 139, 0.17)",
  "rgba(35, 220, 220, 0.17)",
  "rgba(94, 189, 255, 0.18)",
];

const TIMEFRAMES = [
  { label: "1D", range: "1d" },
  { label: "5D", range: "5d" },
  { label: "1M", range: "1mo" },
  { label: "3M", range: "3mo" },
  { label: "6M", range: "6mo" },
  { label: "1Y", range: "1y" },
  { label: "3Y", range: "3y" },
  { label: "5Y", range: "5y" },
];

const CHART_INTERVALS = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "30m", value: "30m" },
  { label: "1h", value: "1h" },
  { label: "1D", value: "1d" },
];

const COMPANIES = {
  AAPL: { companyName: "Apple", sector: "Technology", logoText: "AP", primaryColor: "#A2AAAD", secondaryColor: "#111827" },
  MSFT: { companyName: "Microsoft", sector: "Software", logoText: "MS", primaryColor: "#00A4EF", secondaryColor: "#7FBA00" },
  NVDA: { companyName: "NVIDIA", sector: "Semiconductors", logoText: "NV", primaryColor: "#76B900", secondaryColor: "#0B3D02" },
  AMD: { companyName: "Advanced Micro Devices", sector: "Semiconductors", logoText: "AM", primaryColor: "#ED1C24", secondaryColor: "#111827" },
  TSLA: { companyName: "Tesla", sector: "EV & Energy", logoText: "TS", primaryColor: "#E82127", secondaryColor: "#151515" },
  PLTR: { companyName: "Palantir", sector: "AI Software", logoText: "PL", primaryColor: "#6B7280", secondaryColor: "#111827" },
  AVGO: { companyName: "Broadcom", sector: "Semiconductors", logoText: "AV", primaryColor: "#CC092F", secondaryColor: "#7A0019" },
  AMZN: { companyName: "Amazon", sector: "Cloud & E-commerce", logoText: "AZ", primaryColor: "#FF9900", secondaryColor: "#232F3E" },
  META: { companyName: "Meta Platforms", sector: "Digital Advertising & AI", logoText: "ME", primaryColor: "#0866FF", secondaryColor: "#0B1220" },
  COIN: { companyName: "Coinbase", sector: "Crypto Infrastructure", logoText: "CO", primaryColor: "#0052FF", secondaryColor: "#08111F" },
  MSTR: { companyName: "MicroStrategy", sector: "Bitcoin Treasury", logoText: "MS", primaryColor: "#D9232E", secondaryColor: "#111827" },
  SMCI: { companyName: "Super Micro Computer", sector: "AI Infrastructure", logoText: "SM", primaryColor: "#2AA7DF", secondaryColor: "#101828" },
  "CBA.AX": { companyName: "Commonwealth Bank", sector: "Financials", logoText: "CB", primaryColor: "#FFCC00", secondaryColor: "#111827" },
  "BHP.AX": { companyName: "BHP Group", sector: "Materials", logoText: "BH", primaryColor: "#E35205", secondaryColor: "#111827" },
  "CSL.AX": { companyName: "CSL", sector: "Healthcare", logoText: "CS", primaryColor: "#E1261C", secondaryColor: "#111827" },
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function formatCurrency(value) {
  return Number.isFinite(value) ? money.format(value) : "--";
}

function formatCalculatedCurrency(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? money.format(Number(value)) : "Not calculated";
}

function formatCalculatedNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? number.format(Number(value)) : "Not calculated";
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${value > 0 ? "+" : ""}${value.toFixed(2)}%` : "--";
}

function formatNumber(value) {
  return Number.isFinite(value) ? number.format(value) : "--";
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function chartRangeKey(symbol, timeframe, interval) {
  return `${symbol || "UNKNOWN"}:${timeframe || "1D"}:${interval || "1m"}`;
}

function fibRangeKey(symbol, timeframe, interval) {
  return chartRangeKey(symbol, timeframe, interval);
}

function isDailyInterval(interval) {
  return String(interval || "").toLowerCase() === "1d";
}

function futureSlotCount(interval) {
  return isDailyInterval(interval) ? 60 : 120;
}

function intervalMinutes(interval) {
  return { "1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60 }[String(interval || "").toLowerCase()] || 1;
}

function addTradingDays(date, count) {
  const next = new Date(date);
  let added = 0;
  while (added < count) {
    next.setDate(next.getDate() + 1);
    const day = next.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return next;
}

function futureTimeSlots(candles, interval) {
  if (!candles.length) return [];
  const count = futureSlotCount(interval);
  const lastDate = candles[candles.length - 1]?.date;
  const lastTime = lastDate ? new Date(lastDate) : null;
  const validDate = lastTime && Number.isFinite(lastTime.getTime());

  return Array.from({ length: count }, (_, index) => {
    if (!validDate) return `Future ${index + 1}`;
    if (isDailyInterval(interval)) return addTradingDays(lastTime, index + 1).toISOString().slice(0, 10);
    return new Date(lastTime.getTime() + intervalMinutes(interval) * 60_000 * (index + 1)).toISOString();
  });
}

function emptyOhlcPoint() {
  return [null, null, null, null];
}

function loadStoredChartType() {
  if (typeof window === "undefined") return "candles";
  const stored = window.localStorage.getItem(CHART_TYPE_STORAGE_KEY);
  return FREEDOM_CHART_TYPES.some((item) => item.value === stored) ? stored : "candles";
}

function clampLogicalRange(range, totalCount, realCount, interval) {
  if (!totalCount) return null;
  const visibleCount = Math.max(20, Math.min(totalCount, Math.ceil(realCount * 0.72)));
  const defaultEnd = Math.max(0, realCount - 1);
  const defaultStart = Math.max(0, defaultEnd - visibleCount + 1);
  const startValue = Number.isFinite(range?.startValue) ? Math.round(range.startValue) : defaultStart;
  const endValue = Number.isFinite(range?.endValue) ? Math.round(range.endValue) : defaultEnd;
  const start = clamp(startValue, 0, totalCount - 1);
  const end = clamp(Math.max(endValue, start + 1), start, totalCount - 1);
  return { startValue: start, endValue: end };
}

function roundPrice(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
}

function normalizeFibPoint(point) {
  const price = roundPrice(point?.price);
  if (!point?.date || !Number.isFinite(price)) return null;
  return { date: point.date, price };
}

function normalizeFibDrawing(drawing) {
  const anchor1 = normalizeFibPoint(drawing?.anchor1);
  const anchor2 = normalizeFibPoint(drawing?.anchor2);
  if (!anchor1 || !anchor2) return null;
  return {
    id: drawing?.id || "primary-fib",
    anchor1,
    anchor2,
    visible: drawing?.visible !== false,
    direction: drawing?.direction === "bearish" ? "bearish" : "bullish",
    showExtensions: Boolean(drawing?.showExtensions),
    safetyBufferPercent: Number.isFinite(Number(drawing?.safetyBufferPercent)) ? Number(drawing.safetyBufferPercent) : DEFAULT_SAFETY_BUFFER_PERCENT,
  };
}

function levelsComplete(levels) {
  return Number.isFinite(levels?.entry) && Number.isFinite(levels?.target) && Number.isFinite(levels?.stop);
}

const DEFAULT_LEVEL_SOURCES = { entry: "analysis", stop: "analysis", target: "analysis", target2: null };

function sma(values, period) {
  return values.map((_, index) => {
    if (index + 1 < period) return null;
    const slice = values.slice(index + 1 - period, index + 1);
    return slice.reduce((total, value) => total + value, 0) / period;
  });
}

function ema(values, period) {
  const multiplier = 2 / (period + 1);
  let previous = null;
  return values.map((value, index) => {
    if (index === 0) {
      previous = value;
      return value;
    }
    previous = value * multiplier + previous * (1 - multiplier);
    return previous;
  });
}

function rsi(closes, period = 14) {
  if (closes.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let index = closes.length - period; index < closes.length; index += 1) {
    const change = closes[index] - closes[index - 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }
  if (!losses) return 100;
  const relativeStrength = gains / period / (losses / period);
  return 100 - 100 / (1 + relativeStrength);
}

function macd(closes) {
  if (closes.length < 35) return { macd: null, signal: null, histogram: null, macdLine: [], signalLine: [] };
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = closes.map((_, index) => ema12[index] - ema26[index]);
  const signalLine = ema(macdLine, 9);
  const last = macdLine.length - 1;
  return { macd: macdLine[last], signal: signalLine[last], histogram: macdLine[last] - signalLine[last], macdLine, signalLine };
}

function average(values) {
  const clean = values.filter(Number.isFinite);
  return clean.length ? clean.reduce((total, value) => total + value, 0) / clean.length : null;
}

function analyseSetup(symbol, quote, candles) {
  const clean = candles.filter((candle) => ["open", "high", "low", "close"].every((key) => Number.isFinite(candle[key])));
  const closes = clean.map((candle) => candle.close);
  const highs = clean.map((candle) => candle.high);
  const lows = clean.map((candle) => candle.low);
  const volumes = clean.map((candle) => candle.volume || 0);
  const latest = clean[clean.length - 1] || {};
  const currentPrice = Number.isFinite(quote?.currentPrice) ? quote.currentPrice : latest.close;
  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);
  const ma200 = sma(closes, 200);
  const last20 = ma20[ma20.length - 1];
  const last50 = ma50[ma50.length - 1];
  const last200 = ma200[ma200.length - 1];
  const latestRsi = rsi(closes);
  const latestMacd = macd(closes);
  const recent = clean.slice(-30);
  const support = recent.length ? Math.min(...recent.map((candle) => candle.low)) : null;
  const resistance = recent.length ? Math.max(...recent.map((candle) => candle.high)) : null;
  const avgVolume = average(volumes.slice(-20));
  const relativeVolume = avgVolume ? volumes[volumes.length - 1] / avgVolume : null;
  const volatility = average(clean.slice(-20).map((candle) => ((candle.high - candle.low) / candle.close) * 100));
  const atr = average(clean.slice(-14).map((candle) => candle.high - candle.low));
  const prior = closes[Math.max(0, closes.length - 21)];
  const momentum = prior ? ((currentPrice - prior) / prior) * 100 : 0;
  const trend = currentPrice > last20 && currentPrice > last50 && currentPrice > last200 ? "Uptrend" : currentPrice < last50 ? "Downtrend" : "Sideways";
  const trendScore = clamp((currentPrice > last20 ? 28 : 8) + (currentPrice > last50 ? 34 : 8) + (currentPrice > last200 ? 24 : 8) + (last20 > last50 ? 14 : 0));
  const momentumScore = clamp(50 + momentum * 3 + (latestMacd.histogram || 0) * 12);
  const volumeScore = clamp(relativeVolume ? 45 + relativeVolume * 25 : 45);
  const volatilityScore = clamp(volatility ? 100 - Math.abs(volatility - 4.2) * 14 : 45);
  const supportScore = clamp(support && resistance ? 80 - ((currentPrice - support) / currentPrice) * 200 + ((resistance - currentPrice) / currentPrice) * 160 : 45);
  const technicalScore = clamp((latestRsi ? 100 - Math.abs(latestRsi - 55) * 2.1 : 45) + (latestMacd.histogram > 0 ? 12 : -6));
  const tradingScore = Math.round(trendScore * 0.2 + momentumScore * 0.2 + volumeScore * 0.15 + volatilityScore * 0.15 + supportScore * 0.15 + technicalScore * 0.15);
  const status = tradingScore >= 90 ? "STRONG SETUP" : tradingScore >= 80 ? "BUY SETUP" : tradingScore >= 70 ? "WATCH" : tradingScore >= 60 ? "WAIT" : "NO TRADE";
  const entry = currentPrice;
  const stop = support && entry ? Math.min(entry * 0.97, support * 0.985) : entry ? entry * 0.94 : null;
  const risk = entry && stop ? entry - stop : null;
  const target = entry && risk ? Math.max(resistance || 0, entry + risk * 2.4) : null;
  const reward = target && entry ? target - entry : null;
  const riskReward = reward && risk ? reward / risk : null;
  const expiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  return {
    symbol,
    currentPrice,
    changePercent: quote?.changePercent,
    ma20: last20,
    ma50: last50,
    ma200: last200,
    rsi: latestRsi,
    macd: latestMacd.histogram,
    macdSignal: latestMacd.signal,
    averageVolume: avgVolume,
    relativeVolume,
    atr,
    volatility,
    support,
    resistance,
    distanceToSupport: support && currentPrice ? ((currentPrice - support) / currentPrice) * 100 : null,
    distanceToResistance: resistance && currentPrice ? ((resistance - currentPrice) / currentPrice) * 100 : null,
    tradingScore,
    trend,
    status,
    entry,
    target,
    stop,
    risk,
    reward,
    riskReward,
    suggestedQuantity: risk ? Math.max(1, Math.floor(1000 / risk)) : 1,
    maximumRisk: 1000,
    expectedHoldingPeriod: tradingScore >= 85 ? "2 days to 1 week" : "1 to 6 weeks",
    expiresAt: expiry,
    reasoning: `${symbol} is rated ${status} from trader-only technical evidence: ${trend.toLowerCase()}, ${formatNumber(relativeVolume)}x relative volume, RSI ${formatNumber(latestRsi)}, and ${formatNumber(riskReward)} risk/reward. Review manually before any trade.`,
  };
}

function mapServerAnalysisToSetup(symbol, analysis, fallbackSetup) {
  if (!analysis) return fallbackSetup;
  const opportunity = analysis.opportunity || {};
  return {
    symbol,
    currentPrice: analysis.currentPrice,
    changePercent: analysis.changePercent,
    ma20: analysis.indicators?.ma20 ?? null,
    ma50: analysis.indicators?.ma50 ?? null,
    ma200: analysis.indicators?.ma200 ?? null,
    rsi: analysis.indicators?.rsi14 ?? null,
    macd: analysis.indicators?.macdHistogram ?? null,
    macdSignal: analysis.indicators?.macdSignal ?? null,
    averageVolume: analysis.indicators?.averageVolume20 ?? null,
    relativeVolume: analysis.indicators?.relativeVolume ?? null,
    atr: analysis.indicators?.atr14 ?? null,
    volatility: analysis.indicators?.volatility20 ?? null,
    support: analysis.indicators?.support ?? null,
    resistance: analysis.indicators?.resistance ?? null,
    distanceToSupport: analysis.indicators?.distanceFromSupport ?? null,
    distanceToResistance: analysis.indicators?.distanceFromResistance ?? null,
    tradingScore: analysis.tradingScore,
    trend: analysis.trend,
    status: analysis.status,
    signalResult: analysis.signalResult,
    opportunity,
    legacySetupStatus: analysis.legacySetupStatus,
    confidence: analysis.confidence,
    entry: opportunity.proposedEntryLow ?? analysis.setup?.plannedEntry ?? null,
    entryHigh: opportunity.proposedEntryHigh ?? analysis.setup?.plannedEntry ?? null,
    target: opportunity.target1 ?? analysis.setup?.target ?? null,
    target2: opportunity.target2 ?? null,
    stop: opportunity.stopLoss ?? analysis.setup?.stop ?? null,
    risk: opportunity.riskPerShare ?? analysis.setup?.riskPerShare ?? null,
    reward: opportunity.rewardPerShare ?? analysis.setup?.rewardPerShare ?? null,
    riskReward: opportunity.riskReward ?? analysis.setup?.riskRewardRatio ?? null,
    suggestedQuantity: opportunity.riskPerShare ? Math.max(1, Math.floor(1000 / opportunity.riskPerShare)) : analysis.setup?.riskPerShare ? Math.max(1, Math.floor(1000 / analysis.setup.riskPerShare)) : 1,
    maximumRisk: 1000,
    expectedHoldingPeriod: analysis.setup?.expectedHoldingPeriod || analysis.dataStatus?.status || "Waiting for scanner",
    expiresAt: analysis.setup?.setupExpiryDate,
    reasoning: opportunity.reasonsFor?.join(", ") || analysis.setup?.setupReasoning || analysis.dataStatus?.status || "Waiting for complete setup inputs.",
    scoreExplanation: analysis.scoreExplanation || {},
    marketData: analysis.marketData,
    dataStatus: analysis.dataStatus,
  };
}

async function browserHashPassword(password) {
  const bytes = new TextEncoder().encode(`${PASSWORD_SALT}:${password}`);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
      <Head><title>Freedom Trader</title></Head>
      <form className="gate" onSubmit={unlock}>
        <span>Private Trading Workspace</span>
        <h1>Freedom Trader</h1>
        <p>Enter the private Freedom password.</p>
        <input onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" value={password} />
        {passwordError ? <small>{passwordError}</small> : null}
        <button type="submit">Unlock Trader</button>
      </form>
      <style jsx>{`
        .gateScreen { align-items: center; background: #05080b; color: #f6f8f9; display: flex; font-family: Inter, ui-sans-serif, system-ui; justify-content: center; min-height: 100vh; padding: 24px; }
        .gate { background: rgba(8, 14, 17, 0.95); border: 1px solid rgba(255, 153, 0, 0.24); border-radius: 8px; max-width: 460px; padding: 34px; width: 100%; }
        span { color: #5ebdff; display: block; font-size: 12px; font-weight: 950; margin-bottom: 10px; text-transform: uppercase; }
        h1, p { margin: 0; }
        h1 { font-size: 42px; }
        p { color: #aab8be; margin-top: 10px; }
        input { background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 7px; color: #fff; font-size: 16px; height: 48px; margin-top: 24px; padding: 0 14px; width: 100%; }
        small { color: #ffb1a5; display: block; margin-top: 10px; }
        button { background: #ff9900; border: 0; border-radius: 7px; color: #061014; cursor: pointer; font-weight: 950; height: 48px; margin-top: 18px; width: 100%; }
      `}</style>
    </div>
  );
}

export async function getServerSideProps(context) {
  const { createHash } = await import("crypto");
  const password = process.env.FREEDOM_TERMINAL_PASSWORD || "freedom123";
  const passwordHash = createHash("sha256").update(`${PASSWORD_SALT}:${password}`).digest("hex");
  return { props: { passwordHash, initialSymbol: canonicalCompanyTicker(context.params?.symbol || "NVDA") } };
}

export default function TraderCompany({ passwordHash, initialSymbol }) {
  const router = useRouter();
  const symbol = canonicalCompanyTicker(router.query.symbol || initialSymbol || "NVDA");
  const company = COMPANIES[symbol] || { ...companyMeta(symbol), logoText: symbol.slice(0, 2), primaryColor: "#ff9900", secondaryColor: "#1d9bff" };
  const chartRef = useRef(null);
  const chartNodeRef = useRef(null);
  const chartRangeRef = useRef(null);
  const chartPanRef = useRef({ active: false, startX: 0, startRange: null });
  const visualLevelsRef = useRef({ entry: null, target: null, target2: null, stop: null });
  const fibDrawingRef = useRef(null);
  const [unlocked, setUnlocked] = useState(false);
  const [checkingStorage, setCheckingStorage] = useState(true);
  const [quote, setQuote] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [tradingCapital, setTradingCapital] = useState(5000);
  const [portfolioValue, setPortfolioValue] = useState(50000);
  const [maxRiskPercent, setMaxRiskPercent] = useState(1);
  const [shareOverride, setShareOverride] = useState("");
  const [timeframe, setTimeframe] = useState("1D");
  const [chartInterval, setChartInterval] = useState("1m");
  const [chartType, setChartType] = useState("candles");
  const [chartError, setChartError] = useState("");
  const [chartMeta, setChartMeta] = useState(null);
  const [openPosition, setOpenPosition] = useState(null);
  const [selectedTradeMarker, setSelectedTradeMarker] = useState(null);
  const [displayToggles, setDisplayToggles] = useState({
    tradePlan: true,
    completedTrades: true,
    openPositions: true,
    alerts: true,
    fibonacci: true,
    volume: true,
  });
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeDraft, setTradeDraft] = useState(null);
  const [manualBuyForm, setManualBuyForm] = useState(null);
  const [tradeActionSaving, setTradeActionSaving] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [visualLevels, setVisualLevels] = useState({ entry: null, target: null, target2: null, stop: null });
  const [levelSources, setLevelSources] = useState(DEFAULT_LEVEL_SOURCES);
  const [linePixels, setLinePixels] = useState({ entry: null, target: null, target2: null, stop: null });
  const [draggingLevel, setDraggingLevel] = useState(null);
  const [chartMode, setChartMode] = useState("pan");
  const [fibDrawing, setFibDrawing] = useState(null);
  const [fibGeometry, setFibGeometry] = useState({ levels: [], bands: [], anchor1: null, anchor2: null, center: null, body: null });
  const [draftFibAnchor, setDraftFibAnchor] = useState(null);
  const [draggingFib, setDraggingFib] = useState(null);
  const [selectedFibLevelKey, setSelectedFibLevelKey] = useState("");
  const [session, setSession] = useState(null);
  const [fibPlanReady, setFibPlanReady] = useState(false);
  const [fibPlanSaveStatus, setFibPlanSaveStatus] = useState("idle");
  const [fibPlanRecord, setFibPlanRecord] = useState(null);
  const [staleBannerDismissed, setStaleBannerDismissed] = useState(false);
  const fibPlanSaveTimerRef = useRef(null);
  const fibPlanSkipNextSaveRef = useRef(false);

  useEffect(() => {
    let subscription;
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session || null);
      ({ data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession || null)));
    })();
    return () => subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    visualLevelsRef.current = visualLevels;
  }, [visualLevels]);

  useEffect(() => {
    fibDrawingRef.current = fibDrawing;
  }, [fibDrawing]);

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true");
    setChartType(loadStoredChartType());
    setCheckingStorage(false);
  }, []);

  useEffect(() => {
    if (!checkingStorage) window.localStorage.setItem(CHART_TYPE_STORAGE_KEY, normalizeChartType(chartType));
  }, [chartType, checkingStorage]);

  useEffect(() => {
    async function load() {
      if (!unlocked || !symbol) return;
      const tabHidden = typeof document !== "undefined" && document.hidden;
      try {
        setLoading(true);
        setError("");
        setChartError("");
        setChartMeta(null);
        setCandles([]);
        const [analysisResponse, historyResponse] = await Promise.all([
          fetch(`/api/freedom-trader/analysis?symbol=${symbol}`),
          tabHidden
            ? Promise.resolve(null)
            : fetch(`/api/freedom-trader/history?symbol=${symbol}&range=${TIMEFRAMES.find((item) => item.label === timeframe)?.range || "1d"}&interval=${chartInterval}`),
        ]);
        const analysisData = await analysisResponse.json().catch(() => null);
        const historyData = historyResponse ? await historyResponse.json().catch(() => null) : null;
        if (!analysisResponse.ok || !analysisData?.analysis?.[0]) throw new Error(analysisData?.error || "Trading analysis temporarily unavailable.");
        setAnalysis(analysisData.analysis[0]);
        setQuote({
          currentPrice: analysisData.analysis[0].currentPrice,
          changePercent: analysisData.analysis[0].changePercent,
        });
        if (historyResponse?.ok && historyData?.ok) {
          setCandles(historyData.candles || []);
          setChartMeta(historyData);
        } else if (historyResponse) {
          setCandles([]);
          setChartError(historyData?.error || "Historical data temporarily unavailable.");
        }
        const positionsResponse = await fetch("/api/freedom-trader/positions");
        const positionsData = await positionsResponse.json().catch(() => null);
        const existingPosition = positionsData?.positions?.find((position) => position.symbol === symbol && position.status === "open");
        setOpenPosition(existingPosition || null);
      } catch (err) {
        console.error("Freedom Trader company load failed:", err);
        setError(err.message || "Trading data temporarily unavailable.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [symbol, timeframe, chartInterval, unlocked]);

  const fallbackSetup = useMemo(() => analyseSetup(symbol, quote || {}, candles), [symbol, quote, candles]);
  const setup = useMemo(() => mapServerAnalysisToSetup(symbol, analysis, fallbackSetup), [symbol, analysis, fallbackSetup]);
  const closes = useMemo(() => candles.map((candle) => candle.close), [candles]);
  const tradeDirection = fibDrawing?.direction === "bearish" ? "bearish" : "bullish";
  const levelOrderCheck = useMemo(() => (levelsComplete(visualLevels) ? validateLevelOrder(tradeDirection, visualLevels) : { valid: true, reason: null }), [tradeDirection, visualLevels]);
  const visualMetrics = useMemo(() => {
    if (!levelsComplete(visualLevels)) return { riskReward: null, riskRewardTarget2: null, percentageReturn: null, expectedProfit: null, expectedProfitTarget2: null, maximumLoss: null, capitalRequired: null, positionSize: 0, riskLimit: null };
    return calculatePositionMetrics({
      direction: tradeDirection,
      entry: visualLevels.entry,
      stop: visualLevels.stop,
      target: visualLevels.target,
      target2: visualLevels.target2,
      portfolioValue,
      maxRiskPercent,
      tradingCapital,
    });
  }, [maxRiskPercent, portfolioValue, tradeDirection, tradingCapital, visualLevels]);

  // --- Fib trade-plan persistence (Supabase, symbol + user scoped) ---
  // localStorage (PLANNER_STORAGE_KEY / FIB_STORAGE_KEY) is kept only as an
  // offline cache and as a one-time migration source for pre-existing data;
  // once a signed-in user has a server record, the server is authoritative.
  const analysisDataTimestamp = setup.dataStatus?.latestTimestamp || setup.opportunity?.priceTimestamp || null;

  function readLocalFibDrawing() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(FIB_STORAGE_KEY) || "{}");
      const preferredKey = fibRangeKey(symbol, timeframe, chartInterval);
      const anyKeyForSymbol = Object.keys(saved).find((key) => key.startsWith(`${symbol}:`));
      return normalizeFibDrawing(saved?.[preferredKey] || (anyKeyForSymbol ? saved[anyKeyForSymbol] : null));
    } catch {
      return null;
    }
  }

  function readLocalVisualLevels() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(PLANNER_STORAGE_KEY) || "{}");
      const stored = saved?.[symbol];
      if (!levelsComplete(stored)) return null;
      return { entry: stored.entry, target: stored.target, target2: stored.target2 ?? null, stop: stored.stop, sources: { ...DEFAULT_LEVEL_SOURCES, ...(stored.sources || {}) } };
    } catch {
      return null;
    }
  }

  function applyLocalFallback(localFib, localLevels) {
    setFibDrawing(localFib || null);
    if (localLevels) {
      setVisualLevels({ entry: localLevels.entry, target: localLevels.target, target2: localLevels.target2, stop: localLevels.stop });
      setLevelSources(localLevels.sources);
    } else {
      setVisualLevels({ entry: roundPrice(setup.entry), target: roundPrice(setup.target), target2: roundPrice(setup.target2), stop: roundPrice(setup.stop) });
      setLevelSources(DEFAULT_LEVEL_SOURCES);
    }
  }

  function applyServerPlan(plan) {
    const anchorsUsable = Number.isFinite(plan.anchors?.start?.price) && Number.isFinite(plan.anchors?.end?.price);
    setFibDrawing(anchorsUsable ? normalizeFibDrawing({
      id: "primary-fib",
      anchor1: { date: plan.anchors.start.timestamp, price: plan.anchors.start.price },
      anchor2: { date: plan.anchors.end.timestamp, price: plan.anchors.end.price },
      visible: true,
      direction: plan.direction,
      showExtensions: plan.showExtensions,
      safetyBufferPercent: DEFAULT_SAFETY_BUFFER_PERCENT,
    }) : null);
    const a = plan.assignments || {};
    const nextLevels = {
      entry: a.entry?.price ?? null,
      stop: a.stopLoss?.price ?? null,
      target: a.target1?.price ?? null,
      target2: a.target2?.price ?? null,
    };
    if (levelsComplete(nextLevels)) {
      setVisualLevels(nextLevels);
      setLevelSources({ entry: a.entry?.source || "custom", stop: a.stopLoss?.source || "custom", target: a.target1?.source || "custom", target2: a.target2?.source || null });
    } else {
      setVisualLevels({ entry: roundPrice(setup.entry), target: roundPrice(setup.target), target2: roundPrice(setup.target2), stop: roundPrice(setup.stop) });
      setLevelSources(DEFAULT_LEVEL_SOURCES);
    }
  }

  function buildCurrentPlanPayload() {
    return {
      opportunityId: analysis?.opportunity?.id || null,
      direction: tradeDirection,
      anchors: fibDrawing ? {
        start: { timestamp: fibDrawing.anchor1.date, price: fibDrawing.anchor1.price },
        end: { timestamp: fibDrawing.anchor2.date, price: fibDrawing.anchor2.price },
      } : { start: { timestamp: null, price: null }, end: { timestamp: null, price: null } },
      showExtensions: Boolean(fibDrawing?.showExtensions),
      assignments: {
        entry: Number.isFinite(visualLevels.entry) ? { price: visualLevels.entry, source: levelSources.entry || "custom" } : null,
        stopLoss: Number.isFinite(visualLevels.stop) ? { price: visualLevels.stop, source: levelSources.stop || "custom" } : null,
        target1: Number.isFinite(visualLevels.target) ? { price: visualLevels.target, source: levelSources.target || "custom" } : null,
        target2: Number.isFinite(visualLevels.target2) ? { price: visualLevels.target2, source: levelSources.target2 || "custom" } : null,
      },
      minimumRiskReward: DEFAULT_MINIMUM_RISK_REWARD,
      calculatedRiskReward: Number.isFinite(visualMetrics.riskReward) ? visualMetrics.riskReward : null,
      analysisGeneratedAt: setup.opportunity?.priceTimestamp || null,
      marketDataTimestamp: analysisDataTimestamp,
      analysisVersion: setup.opportunity?.engineVersion || null,
    };
  }

  async function persistPlanNow(plan, extra = {}) {
    const token = session?.access_token;
    if (!token) return null;
    setFibPlanSaveStatus("saving");
    try {
      const response = await fetch("/api/freedom-trader/fib-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ symbol, plan: { ...plan, ...extra } }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        console.warn("Freedom Trader fib-plan save failed:", data?.error || response.statusText || "Save failed.");
        setFibPlanSaveStatus("error");
        return null;
      }
      setFibPlanSaveStatus("saved");
      return data.plan;
    } catch (error) {
      console.warn("Freedom Trader fib-plan save failed:", error);
      setFibPlanSaveStatus("error");
      return null;
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setFibPlanReady(false);
      setStaleBannerDismissed(false);
      setDraftFibAnchor(null);
      setDraggingFib(null);
      setSelectedFibLevelKey("");
      fibPlanSkipNextSaveRef.current = true;

      const token = session?.access_token;
      let serverPlan = null;
      let dbUnavailable = true;
      if (token) {
        try {
          const response = await fetch(`/api/freedom-trader/fib-plan?symbol=${encodeURIComponent(symbol)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await response.json().catch(() => null);
          if (response.ok && data?.ok) {
            serverPlan = data.plan;
            dbUnavailable = Boolean(data.databaseUnavailable);
          }
        } catch (error) {
          console.error("Freedom Trader fib-plan load failed:", error);
        }
      }
      if (cancelled) return;

      if (serverPlan) {
        applyServerPlan(serverPlan);
        setFibPlanRecord(serverPlan);
        setFibPlanReady(true);
        return;
      }

      const localFib = readLocalFibDrawing();
      const localLevels = readLocalVisualLevels();
      if (token && !dbUnavailable && (localFib || localLevels)) {
        const migratedPlan = {
          opportunityId: null,
          direction: localFib?.direction || "bullish",
          anchors: localFib ? { start: { timestamp: localFib.anchor1.date, price: localFib.anchor1.price }, end: { timestamp: localFib.anchor2.date, price: localFib.anchor2.price } } : { start: { timestamp: null, price: null }, end: { timestamp: null, price: null } },
          showExtensions: Boolean(localFib?.showExtensions),
          assignments: {
            entry: localLevels && Number.isFinite(localLevels.entry) ? { price: localLevels.entry, source: localLevels.sources?.entry || "custom" } : null,
            stopLoss: localLevels && Number.isFinite(localLevels.stop) ? { price: localLevels.stop, source: localLevels.sources?.stop || "custom" } : null,
            target1: localLevels && Number.isFinite(localLevels.target) ? { price: localLevels.target, source: localLevels.sources?.target || "custom" } : null,
            target2: localLevels && Number.isFinite(localLevels.target2) ? { price: localLevels.target2, source: localLevels.sources?.target2 || "custom" } : null,
          },
          minimumRiskReward: DEFAULT_MINIMUM_RISK_REWARD,
          calculatedRiskReward: null,
          analysisGeneratedAt: null,
          marketDataTimestamp: null,
          analysisVersion: null,
        };
        applyLocalFallback(localFib, localLevels);
        const saved = await persistPlanNow(migratedPlan, { migratedFromLocalStorage: true });
        if (!cancelled && saved) {
          setFibPlanRecord(saved);
          setFibPlanReady(true);
          return;
        }
      }

      if (cancelled) return;
      applyLocalFallback(localFib, localLevels);
      setFibPlanRecord(null);
      setFibPlanSaveStatus("idle");
      setFibPlanReady(true);
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, session?.access_token]);

  // Debounced auto-save: fires once user interaction settles (covers Fib
  // assignment, drag-end, custom price entry, direction/extension changes
  // and both reset actions -- they all mutate visualLevels/fibDrawing).
  useEffect(() => {
    if (!fibPlanReady) return undefined;
    if (fibPlanSkipNextSaveRef.current) {
      fibPlanSkipNextSaveRef.current = false;
      return undefined;
    }
    if (!session?.access_token) return undefined;
    if (fibPlanSaveTimerRef.current) clearTimeout(fibPlanSaveTimerRef.current);
    fibPlanSaveTimerRef.current = setTimeout(async () => {
      const saved = await persistPlanNow(buildCurrentPlanPayload());
      if (saved) setFibPlanRecord(saved);
    }, 800);
    return () => clearTimeout(fibPlanSaveTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fibPlanReady, fibDrawing, visualLevels, levelSources]);

  const clearFibPlan = useCallback(async () => {
    deleteFibDrawing();
    const resetLevels = { entry: roundPrice(setup.entry), target: roundPrice(setup.target), target2: roundPrice(setup.target2), stop: roundPrice(setup.stop) };
    setVisualLevels(resetLevels);
    setLevelSources(DEFAULT_LEVEL_SOURCES);
    setFibPlanRecord(null);
    const token = session?.access_token;
    if (!token) return;
    setFibPlanSaveStatus("saving");
    try {
      const response = await fetch(`/api/freedom-trader/fib-plan?symbol=${encodeURIComponent(symbol)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Clear failed.");
      setFibPlanSaveStatus("saved");
    } catch (error) {
      console.error("Freedom Trader fib-plan clear failed:", error);
      setFibPlanSaveStatus("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, setup.entry, setup.stop, setup.target, setup.target2, symbol]);

  useEffect(() => {
    setDraftFibAnchor(null);
    setDraggingFib(null);
    setSelectedFibLevelKey("");
  }, [chartInterval, timeframe]);

  const planIsStale = Boolean(
    fibPlanRecord?.marketDataTimestamp
    && analysisDataTimestamp
    && Date.parse(analysisDataTimestamp) > Date.parse(fibPlanRecord.marketDataTimestamp)
  );

  const positionSize = useMemo(() => {
    const maxDollarRisk = (Number(portfolioValue) || 0) * ((Number(maxRiskPercent) || 0) / 100);
    const riskPerShare = Number(setup.risk);
    const entry = Number(setup.entry);
    const calculatedShares = riskPerShare > 0 ? Math.floor(maxDollarRisk / riskPerShare) : 0;
    const cappedByCapital = entry > 0 ? Math.floor((Number(tradingCapital) || 0) / entry) : 0;
    const suggestedShares = Math.max(0, Math.min(calculatedShares, cappedByCapital));
    const overrideShares = shareOverride ? Number(shareOverride) : null;
    const shares = overrideShares === 1 || overrideShares === 2 ? overrideShares : suggestedShares;
    return {
      shares,
      cost: entry > 0 ? shares * entry : null,
      dollarRisk: riskPerShare > 0 ? shares * riskPerShare : null,
      potentialProfit: Number(setup.reward) > 0 ? shares * Number(setup.reward) : null,
      cashRemaining: entry > 0 ? (Number(tradingCapital) || 0) - shares * entry : null,
    };
  }, [portfolioValue, maxRiskPercent, setup.entry, setup.reward, setup.risk, shareOverride, tradingCapital]);

  const autoPrepareRequested = router.query.prepare === "1";
  useEffect(() => {
    if (!autoPrepareRequested || loading || tradeModalOpen || !unlocked) return;
    openTradeConfirmation();
  }, [autoPrepareRequested, loading, tradeModalOpen, unlocked]);

  useEffect(() => {
    if (!tradeModalOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeTradeModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tradeModalOpen]);

  function addToWatchlist() {
    try {
      const key = "freedom-trader-scanner-watchlist";
      const current = JSON.parse(window.localStorage.getItem(key) || "[]");
      const bySymbol = new Map(current.map((item) => [item.symbol, item]));
      bySymbol.set(symbol, {
        symbol,
        companyName: company.companyName,
        sector: company.sector,
        addedAt: new Date().toISOString(),
        reason: `${centralSignal.overallSignal} trade-plan watchlist add`,
      });
      window.localStorage.setItem(key, JSON.stringify(Array.from(bySymbol.values()).slice(-80)));
      setSaveMessage(`${symbol} added to the Freedom Trader watchlist.`);
    } catch {
      setSaveMessage("Unable to update the local watchlist.");
    }
  }

  async function createAlert(alertType, triggerPrice, direction) {
    const payload = {
      symbol,
      alertType,
      triggerPrice,
      direction,
      priority: alertType.includes("STOP") ? "high" : "normal",
      message: `${alertType} alert for ${symbol}. Review manually; no trade is executed automatically.`,
    };

    try {
      const response = await fetch("/api/freedom-trader/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        const message =
          data?.error ||
          `Unable to create alert (${response.status}).`;

        console.error("Freedom Trader alert failed", {
          status: response.status,
          data,
          payload,
        });

        setSaveMessage(message);
        return false;
      }

      setSaveMessage(`${alertType} alert created.`);
      return true;
    } catch (error) {
      console.error("Freedom Trader create alert failed", error);
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "Unable to save alert right now."
      );
      return false;
    }
  }

  function currentTradeStatus(levels = visualLevels) {
    const currentPrice = Number(setup.currentPrice);
    if (openPosition) {
      if (Number.isFinite(openPosition.targetPrice) && Number.isFinite(currentPrice) && currentPrice >= openPosition.targetPrice) return "TARGET HIT";
      if (Number.isFinite(openPosition.stopPrice) && Number.isFinite(currentPrice) && currentPrice <= openPosition.stopPrice) return "STOP HIT";
      return "TRADE ACTIVE";
    }
    if (!Number.isFinite(currentPrice) || !Number.isFinite(levels?.entry)) return "WAIT FOR ENTRY";
    return currentPrice <= levels.entry ? "BUY NOW" : "WAIT FOR ENTRY";
  }

  function tradeBlockers(levels = visualLevels, metrics = visualMetrics) {
    const blockers = [];
    const currentPrice = Number(setup.currentPrice);
    const atr = Number(setup.atr);
    const minimumRiskReward = 2;
    if (!setup.marketData?.validated || !Number.isFinite(currentPrice)) blockers.push("Market price is stale or unverified.");
    if (chartMeta?.dataLabel === "Unavailable") blockers.push("Market price is stale or unverified.");
    if (!chartMeta?.ok || !candles.length || chartError) blockers.push(chartError || "Chart data is unavailable.");
    if (tradeDirection === "bearish") blockers.push("This is a bearish Fib plan for reference only. Freedom Trader can currently only record long (buy) positions -- switch the Fib direction to bullish before preparing a buy order.");
    if (!levelsComplete(levels)) blockers.push("Entry, stop loss and target must all be placed on the chart.");
    if (levelsComplete(levels) && levels.stop >= levels.entry) blockers.push("Stop loss must be below entry for a long trade.");
    if (levelsComplete(levels) && levels.target <= levels.entry) blockers.push("Target must be above entry.");
    if (levelsComplete(levels) && Number.isFinite(metrics.riskReward) && metrics.riskReward < minimumRiskReward) blockers.push(`Risk/reward must be at least ${minimumRiskReward}:1.`);
    if (!Number.isFinite(metrics.positionSize) || metrics.positionSize < 1) blockers.push("Position size exceeds configured capital or risk limits.");
    if (Number.isFinite(metrics.maximumLoss) && Number.isFinite(metrics.riskLimit) && metrics.maximumLoss > metrics.riskLimit) blockers.push("Maximum dollar loss exceeds configured portfolio risk.");
    if (levelsComplete(levels) && Number.isFinite(atr) && atr > 0) {
      const entryDistance = Math.abs(currentPrice - levels.entry);
      const stopDistance = Math.abs(levels.entry - levels.stop);
      if (entryDistance > atr * 2.5) blockers.push("Entry is too far from the current price compared with ATR.");
      if (stopDistance > atr * 3) blockers.push("Stop distance is too wide compared with ATR.");
    }
    return blockers;
  }

  function buildTradeDraft() {
    const levels = {
      entry: roundPrice(visualLevels.entry),
      stop: roundPrice(visualLevels.stop),
      target: roundPrice(visualLevels.target),
      target2: roundPrice(visualLevels.target2),
    };
    const metrics = visualMetrics;
    const currentPrice = Number(setup.currentPrice);
    const entryDistance = Number.isFinite(currentPrice) && Number.isFinite(levels.entry) ? currentPrice - levels.entry : null;
    const status = currentTradeStatus(levels);
    return {
      symbol,
      companyName: company.companyName,
      currentPrice: roundPrice(setup.currentPrice),
      entryPrice: levels.entry,
      stopPrice: levels.stop,
      targetPrice: levels.target,
      targetPrice2: levels.target2,
      expectedProfitTarget2: roundPrice(metrics.expectedProfitTarget2),
      quantity: metrics.positionSize,
      capitalRequired: roundPrice(metrics.capitalRequired),
      maximumLoss: roundPrice(metrics.maximumLoss),
      expectedProfit: roundPrice(metrics.expectedProfit),
      percentageReturn: metrics.percentageReturn,
      riskRewardRatio: metrics.riskReward,
      distanceToEntry: roundPrice(entryDistance),
      distanceToEntryPercent: Number.isFinite(entryDistance) && Number.isFinite(levels.entry) && levels.entry > 0 ? (entryDistance / levels.entry) * 100 : null,
      status,
      orderType: "BUY LIMIT",
      holdingTime: setup.expectedHoldingPeriod || "1 to 6 weeks",
      riskRating: Number.isFinite(metrics.riskReward) && metrics.riskReward >= 2 && Number.isFinite(metrics.maximumLoss) && metrics.maximumLoss <= (metrics.riskLimit || 0) ? "Controlled" : "Review",
      blockers: tradeBlockers(levels, metrics),
    };
  }

  function openTradeConfirmation() {
    const draft = buildTradeDraft();
    setSaveMessage("");
    setManualBuyForm(null);
    setTradeDraft(draft);
    setTradeModalOpen(true);
  }

  function startManualBuy() {
    if (!tradeDraft) return;
    setManualBuyForm({
      actualPurchasePrice: tradeDraft.entryPrice || "",
      sharesPurchased: tradeDraft.quantity || 1,
      brokerageCost: 0,
      purchaseDateTime: new Date().toISOString().slice(0, 16),
      brokerReference: "",
      notes: "",
    });
  }

  function openBroker() {
    window.open("https://www.cmcmarketsstockbroking.com.au/", "_blank", "noopener,noreferrer");
  }

  function closeTradeModal() {
    setManualBuyForm(null);
    setTradeModalOpen(false);
  }

  function closeTradeModalFromBackdrop(event) {
    if (manualBuyForm || event.target !== event.currentTarget) return;
    closeTradeModal();
  }

  function cancelSetup() {
    setSaveMessage(`${symbol} setup cancelled. No trade was placed.`);
    closeTradeModal();
  }

  async function createAllAlerts(draft = tradeDraft) {
    if (!draft) return false;
    if (draft.blockers?.length) {
      setSaveMessage(draft.blockers[0]);
      return false;
    }
    setTradeActionSaving("alerts");
    const payload = {
      symbol,
      companyName: company.companyName,
      alerts: [
        { symbol, companyName: company.companyName, alertType: "ENTRY REACHED", triggerPrice: draft.entryPrice, direction: setup.currentPrice > draft.entryPrice ? "below" : "above", priority: "high", message: `${symbol} reached the chart entry ${formatCurrency(draft.entryPrice)}. Review manually; no trade is executed automatically.` },
        { symbol, companyName: company.companyName, alertType: "STOP REACHED", triggerPrice: draft.stopPrice, direction: "below", priority: "high", message: `${symbol} reached the chart stop ${formatCurrency(draft.stopPrice)}. Review manually; no trade is executed automatically.` },
        { symbol, companyName: company.companyName, alertType: "TARGET REACHED", triggerPrice: draft.targetPrice, direction: "above", priority: "high", message: `${symbol} reached the chart target ${formatCurrency(draft.targetPrice)}. Review manually; no trade is executed automatically.` },
      ],
    };
    try {
      const response = await fetch("/api/freedom-trader/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Unable to create alerts.");
      setSaveMessage("Entry, stop and target alerts created. No broker trade was placed.");
      return true;
    } catch (error) {
      console.error("Freedom Trader create all alerts failed:", error);
      setSaveMessage(error instanceof Error ? error.message : "Unable to create alerts right now.");
      return false;
    } finally {
      setTradeActionSaving("");
    }
  }

  async function saveTradeSetup(draft = tradeDraft) {
    if (!draft) return false;
    if (draft.blockers?.length) {
      setSaveMessage(draft.blockers[0]);
      return false;
    }
    setTradeActionSaving("setup");
    try {
      const response = await fetch("/api/freedom-trader/setups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          companyName: company.companyName,
          setupType: "Chart trade setup",
          tradingScore: setup.tradingScore,
          trend: setup.trend,
          entryPrice: draft.entryPrice,
          targetPrice: draft.targetPrice,
          stopPrice: draft.stopPrice,
          supportPrice: setup.support,
          resistancePrice: setup.resistance,
          riskRewardRatio: draft.riskRewardRatio,
          confidence: setup.confidence,
          status: draft.status,
          reasoning: "Saved from exact chart Entry, Stop Loss and Target lines. No broker trade was placed.",
          expiresAt: setup.expiresAt,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Unable to save trade setup.");
      setSaveMessage("Trade setup saved from chart levels. No broker trade was placed.");
      return true;
    } catch (error) {
      console.error("Freedom Trader save setup failed:", error);
      setSaveMessage(error instanceof Error ? error.message : "Unable to save trade setup right now.");
      return false;
    } finally {
      setTradeActionSaving("");
    }
  }

  async function recordTradeDraftBuy() {
    const draft = tradeDraft;
    if (!draft) return;
    if (draft.blockers?.length) {
      setSaveMessage(draft.blockers[0]);
      return;
    }
    const actualPurchasePrice = Number(manualBuyForm?.actualPurchasePrice);
    const sharesPurchased = Math.floor(Number(manualBuyForm?.sharesPurchased));
    const brokerageCost = Number(manualBuyForm?.brokerageCost || 0);
    const purchaseDateTime = manualBuyForm?.purchaseDateTime;
    if (!Number.isFinite(actualPurchasePrice) || actualPurchasePrice <= 0 || sharesPurchased < 1 || !purchaseDateTime || !Number.isFinite(brokerageCost) || brokerageCost < 0) {
      setSaveMessage("Enter the actual purchase price, shares purchased, brokerage cost and purchase date/time.");
      return;
    }
    const confirmed = window.confirm("Confirm you manually placed this buy order with your broker. Freedom Trader will only record the purchase; it will not execute a broker trade.");
    if (!confirmed) return;
    setTradeActionSaving("buy");
    try {
      const response = await fetch("/api/freedom-trader/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          companyName: company.companyName,
          quantity: sharesPurchased,
          entryPrice: actualPurchasePrice,
          targetPrice: draft.targetPrice,
          stopPrice: draft.stopPrice,
          brokerage: brokerageCost,
          entryDate: new Date(purchaseDateTime).toISOString(),
          notes: "Manual broker buy recorded from Freedom Trader chart.",
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Unable to record manual buy.");
      try {
        await fetch("/api/freedom-trader/trade-journal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticker: symbol,
            company: company.companyName,
            exchange: analysis?.exchange || "NASDAQ",
            currency: setup.currentPrice && String(symbol).endsWith(".AX") ? "AUD" : "USD",
            side: "buy",
            tradeDateTime: new Date(purchaseDateTime).toISOString(),
            quantity: sharesPurchased,
            actualFillPrice: actualPurchasePrice,
            brokerageFees: brokerageCost,
            stopLoss: draft.stopPrice,
            target: draft.targetPrice,
            status: "open",
            documentReference: manualBuyForm?.brokerReference || "",
            notes: manualBuyForm?.notes || "Manual broker buy recorded from Freedom Trader chart.",
            openPositionId: data.position?.id || null,
          }),
        });
      } catch (journalError) {
        console.error("Freedom Trader journal log for buy failed:", journalError);
      }
      setSaveMessage("Manual buy recorded. Opening positions...");
      window.location.href = "/freedom-trader/positions";
    } catch (error) {
      console.error("Freedom Trader record chart buy failed:", error);
      setSaveMessage(error instanceof Error ? error.message : "Unable to record manual buy right now.");
    } finally {
      setTradeActionSaving("");
    }
  }

  const saveVisualLevels = useCallback((levels, sources) => {
    if (!levelsComplete(levels)) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(PLANNER_STORAGE_KEY) || "{}");
      window.localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify({ ...saved, [symbol]: { ...levels, sources: sources || DEFAULT_LEVEL_SOURCES } }));
    } catch {}
  }, [symbol]);

  const updateVisualLevel = useCallback((key, value, source = "custom") => {
    const nextValue = roundPrice(value);
    if (!Number.isFinite(nextValue)) return;
    setVisualLevels((current) => {
      const next = { ...current, [key]: nextValue };
      setLevelSources((currentSources) => {
        const nextSources = { ...currentSources, [key]: source };
        saveVisualLevels(next, nextSources);
        return nextSources;
      });
      return next;
    });
  }, [saveVisualLevels]);

  const clearVisualLevel = useCallback((key) => {
    setVisualLevels((current) => {
      const next = { ...current, [key]: null };
      setLevelSources((currentSources) => {
        const nextSources = { ...currentSources, [key]: null };
        saveVisualLevels(next, nextSources);
        return nextSources;
      });
      return next;
    });
  }, [saveVisualLevels]);

  const resetLevelsToAnalysis = useCallback(() => {
    const next = { entry: roundPrice(setup.entry), target: roundPrice(setup.target), target2: roundPrice(setup.target2), stop: roundPrice(setup.stop) };
    const sources = { entry: "analysis", stop: "analysis", target: "analysis", target2: setup.target2 != null ? "analysis" : null };
    setVisualLevels(next);
    setLevelSources(sources);
    saveVisualLevels(next, sources);
    setSaveMessage("Trade levels reset to the analysis recommendation.");
  }, [saveVisualLevels, setup.entry, setup.stop, setup.target, setup.target2]);

  const saveFibDrawing = useCallback((drawing) => {
    const normalized = normalizeFibDrawing(drawing);
    try {
      const saved = JSON.parse(window.localStorage.getItem(FIB_STORAGE_KEY) || "{}");
      const key = fibRangeKey(symbol, timeframe, chartInterval);
      if (normalized) {
        window.localStorage.setItem(FIB_STORAGE_KEY, JSON.stringify({ ...saved, [key]: normalized }));
      } else {
        const next = { ...saved };
        delete next[key];
        window.localStorage.setItem(FIB_STORAGE_KEY, JSON.stringify(next));
      }
    } catch {}
    return normalized;
  }, [chartInterval, symbol, timeframe]);

  const commitFibDrawing = useCallback((updater) => {
    setFibDrawing((current) => {
      const nextDraft = typeof updater === "function" ? updater(current) : updater;
      const normalized = saveFibDrawing(nextDraft);
      return normalized;
    });
  }, [saveFibDrawing]);

  const deleteFibDrawing = useCallback(() => {
    setSelectedFibLevelKey("");
    setDraftFibAnchor(null);
    setDraggingFib(null);
    setFibGeometry({ levels: [], bands: [], anchor1: null, anchor2: null, center: null, body: null });
    saveFibDrawing(null);
    setFibDrawing(null);
  }, [saveFibDrawing]);

  const setFibVisibility = useCallback((visible) => {
    commitFibDrawing((current) => current ? { ...current, visible } : current);
  }, [commitFibDrawing]);

  const loadSavedChartRange = useCallback((totalCount, realCount) => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(CHART_RANGE_STORAGE_KEY) || "{}");
      return clampLogicalRange(saved?.[chartRangeKey(symbol, timeframe, chartInterval)], totalCount, realCount, chartInterval);
    } catch {
      return clampLogicalRange(null, totalCount, realCount, chartInterval);
    }
  }, [chartInterval, symbol, timeframe]);

  const saveChartRange = useCallback((range, totalCount, realCount) => {
    const nextRange = clampLogicalRange(range, totalCount, realCount, chartInterval);
    if (!nextRange) return null;
    chartRangeRef.current = { key: chartRangeKey(symbol, timeframe, chartInterval), ...nextRange };
    try {
      const saved = JSON.parse(window.localStorage.getItem(CHART_RANGE_STORAGE_KEY) || "{}");
      window.localStorage.setItem(CHART_RANGE_STORAGE_KEY, JSON.stringify({
        ...saved,
        [chartRangeKey(symbol, timeframe, chartInterval)]: nextRange,
      }));
    } catch {}
    return nextRange;
  }, [chartInterval, symbol, timeframe]);

  const chartData = useMemo(() => {
    const futureDates = futureTimeSlots(candles, chartInterval);
    const selectedChartType = normalizeChartType(chartType);
    const displayCandles = selectedChartType === "heikin" ? buildHeikinAshiCandles(candles) : candles;
    const dates = [...candles.map((candle) => candle.date), ...futureDates];
    const closestDate = (timestamp) => {
      if (!timestamp || !dates.length) return dates[dates.length - 1];
      const target = new Date(timestamp).getTime();
      if (!Number.isFinite(target)) return dates[dates.length - 1];
      return dates.reduce((best, date) => {
        const bestDiff = Math.abs(new Date(best).getTime() - target);
        const nextDiff = Math.abs(new Date(date).getTime() - target);
        return nextDiff < bestDiff ? date : best;
      }, dates[0]);
    };
    const tradeMarkers = [];
    const orderMarkers = [];
    return {
      dates,
      candles: [
        ...displayCandles.map((candle) => [candle.open, candle.close, candle.low, candle.high]),
        ...futureDates.map(emptyOhlcPoint),
      ],
      closeLine: [...displayCandles.map((candle) => candle.close), ...futureDates.map(() => null)],
      ohlcBars: [...displayCandles.map((candle) => [candle.open, candle.close, candle.low, candle.high]), ...futureDates.map(emptyOhlcPoint)],
      volume: [...candles.map((candle) => candle.volume || 0), ...futureDates.map(() => null)],
      tradeMarkers,
      orderMarkers,
      realCount: candles.length,
      futureCount: futureDates.length,
    };
  }, [candles, chartInterval, chartType]);

  const chartPointFromEvent = useCallback((event) => {
    const chart = chartRef.current;
    const node = chartNodeRef.current;
    if (!chart || !node || !chartData.dates.length) return null;
    const rect = node.getBoundingClientRect();
    let raw;
    try {
      raw = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [event.clientX - rect.left, event.clientY - rect.top]);
    } catch {
      return null;
    }
    if (!Array.isArray(raw)) return null;
    const rawIndex = typeof raw[0] === "number" ? raw[0] : chartData.dates.indexOf(raw[0]);
    const index = clamp(Math.round(rawIndex), 0, chartData.dates.length - 1);
    const price = roundPrice(raw[1]);
    if (!chartData.dates[index] || !Number.isFinite(price) || price <= 0) return null;
    return { date: chartData.dates[index], price, index };
  }, [chartData.dates]);

  const refreshOverlayPixels = useCallback(() => {
    const chart = chartRef.current;
    if (!chart || !candles.length) return;
    const fallbackDate = candles[candles.length - 1]?.date;
    const toPoint = (date, price) => {
      let value;
      try {
        value = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [date || fallbackDate, price]);
      } catch {
        return null;
      }
      return Array.isArray(value) ? { x: value[0], y: value[1] } : null;
    };
    const currentVisualLevels = visualLevelsRef.current;
    if (levelsComplete(currentVisualLevels)) {
      const toY = (price) => {
        const value = toPoint(fallbackDate, price);
        return value?.y;
      };
      const next = { entry: toY(currentVisualLevels.entry), target: toY(currentVisualLevels.target), target2: Number.isFinite(currentVisualLevels.target2) ? toY(currentVisualLevels.target2) : null, stop: toY(currentVisualLevels.stop) };
      if ([next.entry, next.target, next.stop].every(Number.isFinite)) setLinePixels(next);
    }
    const drawing = normalizeFibDrawing(fibDrawingRef.current);
    if (!drawing || drawing.visible === false) {
      setFibGeometry({ levels: [], bands: [], anchor1: null, anchor2: null, center: null, body: null });
      return;
    }
    const anchor1 = toPoint(drawing.anchor1.date, drawing.anchor1.price);
    const anchor2 = toPoint(drawing.anchor2.date, drawing.anchor2.price);
    if (!anchor1 || !anchor2 || ![anchor1.x, anchor1.y, anchor2.x, anchor2.y].every(Number.isFinite)) {
      setFibGeometry({ levels: [], bands: [], anchor1: null, anchor2: null, center: null, body: null });
      return;
    }
    const left = Math.min(anchor1.x, anchor2.x);
    const right = Math.max(anchor1.x, anchor2.x);
    const width = Math.max(80, right - left);
    const bodyLeft = right - left < 80 ? left - (80 - (right - left)) / 2 : left;
    const bodyRight = bodyLeft + width;
    const assignmentFor = (price) => {
      if (!Number.isFinite(price)) return null;
      const match = ["entry", "stop", "target", "target2"].find((key) => Number.isFinite(currentVisualLevels[key]) && Math.abs(currentVisualLevels[key] - price) < 0.005);
      return match || null;
    };
    const computedLevels = computeFibLevels({ anchor1Price: drawing.anchor1.price, anchor2Price: drawing.anchor2.price, direction: drawing.direction, includeExtensions: drawing.showExtensions });
    const rawLevels = computedLevels.map((level) => {
      const point = toPoint(drawing.anchor2.date, level.price);
      return point && Number.isFinite(point.y) ? { ...level, y: point.y, labelY: point.y, assignment: assignmentFor(level.price) } : null;
    }).filter(Boolean);
    const sorted = [...rawLevels].sort((a, b) => a.y - b.y);
    const minGap = 24;
    sorted.forEach((level, index) => {
      if (index > 0) level.labelY = Math.max(level.labelY, sorted[index - 1].labelY + minGap);
    });
    for (let index = sorted.length - 2; index >= 0; index -= 1) {
      sorted[index].labelY = Math.min(sorted[index].labelY, sorted[index + 1].labelY - minGap);
    }
    const baseLevels = rawLevels.filter((level) => !level.extension);
    const bands = baseLevels.slice(0, -1).map((level, index) => {
      const to = baseLevels[index + 1];
      if (!level || !to) return null;
      return {
        key: `${level.key}-${to.key}`,
        top: Math.min(level.y, to.y),
        height: Math.max(2, Math.abs(level.y - to.y)),
        color: FIB_BAND_COLORS[index],
      };
    }).filter(Boolean);
    setFibGeometry({
      levels: rawLevels,
      bands,
      anchor1,
      anchor2,
      center: { x: (anchor1.x + anchor2.x) / 2, y: (anchor1.y + anchor2.y) / 2 },
      body: {
        left: bodyLeft,
        right: bodyRight,
        top: Math.min(anchor1.y, anchor2.y),
        height: Math.max(28, Math.abs(anchor1.y - anchor2.y)),
        width,
      },
    });
  }, [candles]);

  const currentChartRange = useCallback(() => {
    const key = chartRangeKey(symbol, timeframe, chartInterval);
    if (chartRangeRef.current?.key === key) return chartRangeRef.current;
    return { key, ...loadSavedChartRange(chartData.dates.length, chartData.realCount) };
  }, [chartData.dates.length, chartData.realCount, chartInterval, loadSavedChartRange, symbol, timeframe]);

  const applyChartPanRange = useCallback((range) => {
    const nextRange = saveChartRange(range, chartData.dates.length, chartData.realCount);
    if (!nextRange || !chartRef.current) return;
    chartRef.current.dispatchAction({
      type: "dataZoom",
      dataZoomIndex: 0,
      startValue: nextRange.startValue,
      endValue: nextRange.endValue,
    });
    refreshOverlayPixels();
  }, [chartData.dates.length, chartData.realCount, refreshOverlayPixels, saveChartRange]);

  const beginChartPan = useCallback((event) => {
    if (chartMode !== "pan" || event.button !== 0 || draggingLevel || draggingFib || !chartRef.current || !chartData.realCount) return;
    if (event.target?.closest?.(".plannerLine, .fibDrawingLayer, .fibDraftLayer")) return;
    chartPanRef.current = { active: true, startX: event.clientX, startRange: currentChartRange() };
  }, [chartData.realCount, chartMode, currentChartRange, draggingFib, draggingLevel]);

  const moveChartPan = useCallback((event) => {
    const panState = chartPanRef.current;
    if (!panState.active || !panState.startRange) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const width = Math.max(1, panState.startRange.endValue - panState.startRange.startValue);
    const plotWidth = Math.max(1, rect.width - 88);
    const indexDelta = Math.round((panState.startX - event.clientX) / (plotWidth / width));
    if (!indexDelta) return;
    applyChartPanRange({
      startValue: panState.startRange.startValue + indexDelta,
      endValue: panState.startRange.endValue + indexDelta,
    });
  }, [applyChartPanRange]);

  const endChartPan = useCallback(() => {
    chartPanRef.current = { active: false, startX: 0, startRange: null };
  }, []);

  const startFibDraft = useCallback((event) => {
    if (chartMode !== "fib" || event.button !== 0) return;
    const point = chartPointFromEvent(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    const next = normalizeFibDrawing({
      id: "primary-fib",
      anchor1: { date: point.date, price: point.price },
      anchor2: { date: point.date, price: point.price },
      visible: true,
    });
    setSelectedFibLevelKey("");
    setDraftFibAnchor(next.anchor1);
    setFibDrawing(next);
  }, [chartMode, chartPointFromEvent]);

  const moveFibDraft = useCallback((event) => {
    if (chartMode !== "fib" || !draftFibAnchor) return;
    const point = chartPointFromEvent(event);
    if (!point) return;
    event.preventDefault();
    setFibDrawing(normalizeFibDrawing({
      id: "primary-fib",
      anchor1: draftFibAnchor,
      anchor2: { date: point.date, price: point.price },
      visible: true,
    }));
  }, [chartMode, chartPointFromEvent, draftFibAnchor]);

  const finishFibDraft = useCallback((event) => {
    if (chartMode !== "fib" || !draftFibAnchor) return;
    const point = chartPointFromEvent(event);
    event.preventDefault();
    const next = normalizeFibDrawing({
      id: "primary-fib",
      anchor1: draftFibAnchor,
      anchor2: point ? { date: point.date, price: point.price } : draftFibAnchor,
      visible: true,
      direction: detectDirectionFromTrend(setup.trend),
    });
    if (next && (next.anchor1.date !== next.anchor2.date || next.anchor1.price !== next.anchor2.price)) {
      saveFibDrawing(next);
      setFibDrawing(next);
    } else {
      setFibDrawing(null);
    }
    setDraftFibAnchor(null);
    setChartMode("select");
  }, [chartMode, chartPointFromEvent, draftFibAnchor, saveFibDrawing, setup.trend]);

  const startFibDrag = useCallback((event, type, anchorKey = null) => {
    if (chartMode !== "select" || !fibDrawing) return;
    const point = chartPointFromEvent(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedFibLevelKey("");
    setDraggingFib({
      type,
      anchorKey,
      startPoint: point,
      startDrawing: normalizeFibDrawing(fibDrawing),
    });
  }, [chartMode, chartPointFromEvent, fibDrawing]);

  const assignFibLevel = useCallback((lineKey, levelKey) => {
    const level = fibGeometry.levels.find((item) => item.key === levelKey);
    if (!level || !Number.isFinite(level.price)) return;
    updateVisualLevel(lineKey, level.price, "fib-manual");
    setSelectedFibLevelKey("");
  }, [fibGeometry.levels, updateVisualLevel]);

  const clearFibAssignment = useCallback((levelKey) => {
    const level = fibGeometry.levels.find((item) => item.key === levelKey);
    if (level?.assignment) clearVisualLevel(level.assignment);
    setSelectedFibLevelKey("");
  }, [clearVisualLevel, fibGeometry.levels]);

  const setFibDirection = useCallback((direction) => {
    commitFibDrawing((current) => current ? { ...current, direction: direction === "bearish" ? "bearish" : "bullish" } : current);
  }, [commitFibDrawing]);

  const setFibShowExtensions = useCallback((showExtensions) => {
    commitFibDrawing((current) => current ? { ...current, showExtensions: Boolean(showExtensions) } : current);
  }, [commitFibDrawing]);

  const setFibSafetyBuffer = useCallback((percent) => {
    const value = Number(percent);
    commitFibDrawing((current) => current ? { ...current, safetyBufferPercent: Number.isFinite(value) ? value : DEFAULT_SAFETY_BUFFER_PERCENT } : current);
  }, [commitFibDrawing]);

  const applyGeneratedFibPlan = useCallback(() => {
    if (!fibDrawing) {
      setSaveMessage("Draw a Fibonacci retracement on the chart first.");
      return;
    }
    const plan = generateFibTradePlan({
      anchor1Price: fibDrawing.anchor1.price,
      anchor2Price: fibDrawing.anchor2.price,
      direction: fibDrawing.direction,
      analysisEntry: setup.entry,
      analysisTarget: setup.target,
      analysisSupport: setup.support,
      analysisResistance: setup.resistance,
      safetyBufferPercent: fibDrawing.safetyBufferPercent,
      minimumRiskReward: DEFAULT_MINIMUM_RISK_REWARD,
    });
    if (!plan.valid) {
      setSaveMessage(`Use Fib for Trade Plan: ${plan.reason}`);
      return;
    }
    const next = { entry: plan.entry, stop: plan.stop, target: plan.target, target2: plan.target2 };
    const sources = { entry: "fib-auto", stop: "fib-auto", target: "fib-auto", target2: plan.target2 != null ? "fib-auto" : null };
    setVisualLevels(next);
    setLevelSources(sources);
    saveVisualLevels(next, sources);
    setSaveMessage(`Fib trade plan applied (entry near ${plan.entryFibLabel || "the retracement zone"}, risk/reward ${plan.riskReward.toFixed(2)}:1).`);
  }, [fibDrawing, saveVisualLevels, setup.entry, setup.resistance, setup.support, setup.target]);

  const resetLevelsToFib = useCallback(() => {
    applyGeneratedFibPlan();
  }, [applyGeneratedFibPlan]);

  useEffect(() => {
    refreshOverlayPixels();
  }, [refreshOverlayPixels]);

  useEffect(() => {
    refreshOverlayPixels();
  }, [fibDrawing, refreshOverlayPixels, visualLevels]);

  useEffect(() => {
    if (!draggingLevel && !draggingFib) return undefined;
    const handleMove = (event) => {
      const point = chartPointFromEvent(event);
      if (!point) return;
      if (draggingLevel) {
        updateVisualLevel(draggingLevel, point.price);
        return;
      }
      if (!draggingFib?.startDrawing) return;
      if (draggingFib.type === "anchor") {
        commitFibDrawing((current) => normalizeFibDrawing({
          ...(current || draggingFib.startDrawing),
          [draggingFib.anchorKey]: { date: point.date, price: point.price },
          visible: true,
        }));
        return;
      }
      const startIndex = chartData.dates.indexOf(draggingFib.startPoint.date);
      const nextIndex = point.index;
      if (startIndex < 0 || nextIndex < 0) return;
      const indexDelta = nextIndex - startIndex;
      const priceDelta = point.price - draggingFib.startPoint.price;
      const moveAnchor = (anchor) => {
        const anchorIndex = chartData.dates.indexOf(anchor.date);
        const nextAnchorIndex = clamp(anchorIndex + indexDelta, 0, chartData.dates.length - 1);
        return { date: chartData.dates[nextAnchorIndex], price: roundPrice(anchor.price + priceDelta) };
      };
      commitFibDrawing({
        ...draggingFib.startDrawing,
        anchor1: moveAnchor(draggingFib.startDrawing.anchor1),
        anchor2: moveAnchor(draggingFib.startDrawing.anchor2),
        visible: true,
      });
    };
    const handleUp = () => {
      setDraggingLevel(null);
      setDraggingFib(null);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [chartData.dates, chartPointFromEvent, commitFibDrawing, draggingFib, draggingLevel, updateVisualLevel]);

  useEffect(() => {
    let disposed = false;
    async function renderChart() {
      if (!chartNodeRef.current) return;
      const echarts = await import("echarts");
      if (disposed) return;
      if (!chartRef.current) chartRef.current = echarts.init(chartNodeRef.current, null, { renderer: "canvas" });
      if (!chartData.realCount) {
        chartRef.current.clear();
        return;
      }
      const totalCount = chartData.dates.length;
      const realCount = chartData.realCount;
      const rangeKey = chartRangeKey(symbol, timeframe, chartInterval);
      if (chartRangeRef.current?.key !== rangeKey) {
        chartRangeRef.current = { key: rangeKey, ...loadSavedChartRange(totalCount, realCount) };
      }
      const visibleRange = clampLogicalRange(chartRangeRef.current, totalCount, realCount, chartInterval);
      chartRangeRef.current = { key: rangeKey, ...visibleRange };
      const priceMarkLine = {
        symbol: "none",
        label: { color: "#d8e5ea" },
        lineStyle: { type: "dashed" },
        data: [
          Number.isFinite(setup.currentPrice) ? { name: "Current", yAxis: setup.currentPrice, lineStyle: { color: "#eaf2ff", width: 1 } } : null,
        ].filter(Boolean),
      };
      const basePriceSeries = {
        id: "freedom-price",
        name: symbol,
        data: normalizeChartType(chartType) === "line" || normalizeChartType(chartType) === "area" ? chartData.closeLine : chartData.candles,
        markLine: priceMarkLine,
      };
      const selectedChartType = normalizeChartType(chartType);
      const priceSeries =
        selectedChartType === "line" || selectedChartType === "area"
          ? {
              ...basePriceSeries,
              type: "line",
              showSymbol: false,
              smooth: true,
              lineStyle: { color: "#5ebdff", width: 2.4 },
              areaStyle: selectedChartType === "area" ? { color: "rgba(94,189,255,0.18)" } : undefined,
            }
          : {
              ...basePriceSeries,
              type: "candlestick",
              barMinWidth: selectedChartType === "ohlc" ? 2 : 4,
              barMaxWidth: selectedChartType === "ohlc" ? 8 : 18,
              itemStyle: {
                color: selectedChartType === "hollow" ? "transparent" : "#23d18b",
                color0: "#ff5c5c",
                borderColor: "#23d18b",
                borderColor0: "#ff5c5c",
                borderWidth: selectedChartType === "ohlc" ? 2 : 1.4,
              },
            };
      chartRef.current.setOption({
        backgroundColor: "transparent",
        animation: false,
        tooltip: { trigger: "axis", axisPointer: { type: "cross" }, backgroundColor: "rgba(5,8,11,0.96)", borderColor: "rgba(94,189,255,0.35)", textStyle: { color: "#f6f8f9" } },
        axisPointer: { link: [{ xAxisIndex: "all" }] },
        grid: [
          { left: 62, right: 26, top: 22, height: "66%" },
          { left: 62, right: 26, top: "76%", height: "13%" },
        ],
        dataZoom: [
          {
            type: "inside",
            xAxisIndex: [0, 1],
            startValue: visibleRange.startValue,
            endValue: visibleRange.endValue,
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
            moveOnMouseWheel: false,
          },
          {
            type: "slider",
            xAxisIndex: [0, 1],
            bottom: 0,
            height: 20,
            startValue: visibleRange.startValue,
            endValue: visibleRange.endValue,
            textStyle: { color: "#aebdc4" },
          },
        ],
        xAxis: [0, 1].map((gridIndex) => ({ type: "category", gridIndex, data: chartData.dates, axisLabel: { color: "#aebdc4", show: gridIndex === 0 }, axisLine: { lineStyle: { color: "#23313a" } } })),
        yAxis: [
          { scale: true, axisLabel: { color: "#aebdc4" }, splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } } },
          { scale: true, gridIndex: 1, axisLabel: { color: "#aebdc4" }, splitLine: { show: false } },
        ],
        series: [
          priceSeries,
          displayToggles.volume ? { id: "freedom-volume", name: "Volume", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: chartData.volume, itemStyle: { color: "rgba(29,155,255,0.45)" } } : null,
          displayToggles.completedTrades ? {
            id: "freedom-completed-trades",
            name: "Completed Trades",
            type: "scatter",
            data: chartData.tradeMarkers,
            label: { show: true, color: "#f6f8f9", fontSize: 11, fontWeight: 900, position: "top", backgroundColor: "rgba(5,8,11,.78)", borderRadius: 4, padding: [4, 6] },
            z: 8,
          } : null,
          displayToggles.openPositions ? {
            id: "freedom-pending-orders",
            name: "Pending Orders",
            type: "scatter",
            data: chartData.orderMarkers,
            label: { show: true, color: "#fff3b0", fontSize: 11, fontWeight: 900, position: "bottom", backgroundColor: "rgba(5,8,11,.78)", borderRadius: 4, padding: [4, 6] },
            z: 8,
          } : null,
        ].filter(Boolean),
      }, { replaceMerge: ["series", "xAxis", "yAxis", "dataZoom"], lazyUpdate: true });
      const handleDataZoom = () => {
        const option = chartRef.current?.getOption?.();
        const zoom = Array.isArray(option?.dataZoom) ? option.dataZoom[0] : null;
        const rawStart = Number(zoom?.startValue);
        const rawEnd = Number(zoom?.endValue);
        const startValue = Number.isFinite(rawStart)
          ? rawStart
          : Math.round(((Number(zoom?.start) || 0) / 100) * Math.max(0, totalCount - 1));
        const endValue = Number.isFinite(rawEnd)
          ? rawEnd
          : Math.round(((Number(zoom?.end) || 100) / 100) * Math.max(0, totalCount - 1));
        saveChartRange({ startValue, endValue }, totalCount, realCount);
        refreshOverlayPixels();
      };
      chartRef.current.off("datazoom");
      chartRef.current.on("datazoom", handleDataZoom);
      chartRef.current.off("click");
      chartRef.current.on("click", (params) => {
        if (params?.data?.markerDetail) setSelectedTradeMarker(params.data.markerDetail);
      });
      window.setTimeout(refreshOverlayPixels, 0);
    }
    renderChart();
    const resize = () => {
      chartRef.current?.resize();
      window.setTimeout(refreshOverlayPixels, 0);
    };
    window.addEventListener("resize", resize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      chartRef.current?.off?.("datazoom");
      chartRef.current?.off?.("click");
    };
  }, [chartData, chartInterval, chartType, displayToggles.completedTrades, displayToggles.openPositions, displayToggles.volume, loadSavedChartRange, refreshOverlayPixels, saveChartRange, setup, symbol, timeframe]);

  const visualOverlayReady = levelsComplete(visualLevels) && [linePixels.entry, linePixels.target, linePixels.stop].every(Number.isFinite);
  const chartPlotTop = 22;
  const chartPlotBottom = 22 + 660 * 0.66;
  const clampChartZone = (a, b) => {
    const top = clamp(Math.min(a, b), chartPlotTop, chartPlotBottom);
    const bottom = clamp(Math.max(a, b), chartPlotTop, chartPlotBottom);
    return { top, height: Math.max(0, bottom - top) };
  };
  const profitZone = visualOverlayReady ? clampChartZone(linePixels.target, linePixels.entry) : { top: 0, height: 0 };
  const riskZone = visualOverlayReady ? clampChartZone(linePixels.entry, linePixels.stop) : { top: 0, height: 0 };
  const tradeStatus = currentTradeStatus();
  const centralSignal = setup.signalResult || {
    overallSignal: normalizeSignalLabel(setup.status),
    timeframe: "1D",
    confidence: setup.confidence,
    dataProvider: setup.marketData?.historySource || chartMeta?.source || "Unknown",
    marketDataTimestamp: setup.marketData?.latestCandleDate || chartMeta?.latestTimestamp || null,
    reasons: [setup.reasoning].filter(Boolean),
  };
  const currentBlockers = tradeBlockers();
  const fibVisible = displayToggles.fibonacci && fibDrawing?.visible !== false;
  const fibOverlayReady = fibVisible && fibGeometry.anchor1 && fibGeometry.anchor2 && fibGeometry.body && fibGeometry.levels.length;
  const selectedFibLevel = fibGeometry.levels.find((level) => level.key === selectedFibLevelKey);
  const modalCanBuy = Boolean(tradeDraft && tradeDraft.status === "BUY NOW" && !tradeDraft.blockers?.length);
  const modalWhy = tradeDraft?.blockers?.[0]
    || (modalCanBuy
      ? "The price has reached your planned buy price and the risk is within your rules."
      : Number.isFinite(Number(tradeDraft?.entryPrice)) && Number(tradeDraft.entryPrice) > 0
        ? "The setup is not ready because the price has not reached your planned buy price yet."
        : "Freedom cannot calculate a safe buy price from the current chart levels.");
  const waitForPriceText = Number.isFinite(Number(tradeDraft?.entryPrice)) && Number(tradeDraft.entryPrice) > 0
    ? formatCalculatedCurrency(tradeDraft.entryPrice)
    : "Not calculated";

  if (checkingStorage) return <div className="boot">Opening Freedom Trader...</div>;
  if (!unlocked) return <PasswordGate passwordHash={passwordHash} onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="page" style={{ "--company-primary": company.primaryColor, "--company-secondary": company.secondaryColor }}>
      <Head><title>{symbol} | Freedom Trader</title></Head>
      <section className="platformBanner" aria-label="Current Freedom workspace">
        <strong><span className="platformIcon" aria-hidden="true">{"\u{1F4CA}"}</span>Freedom Trader</strong>
        <span>Active Trading & Market Opportunities</span>
      </section>
      <FreedomModuleNav module="trader" />
      <header className="hero">
        <div className="heroMain">
          <span className="logo">{company.logoText}</span>
          <div>
            <h1>{company.companyName}</h1>
            <p>
              {symbol} / {analysis?.exchange || "NASDAQ"} / USD / {formatCurrency(setup.currentPrice)}
              <span>{chartMeta?.dataLabel || setup.marketData?.historySource || "Data provider pending"}</span>
            </p>
          </div>
          <div className="analysisSignalBox">
            <span>Analysis Signal</span>
            <SignalBadge signal={`${centralSignal.overallSignal} (${centralSignal.timeframe || "1D"})`} />
            <small>{Number.isFinite(centralSignal.confidence) ? `${centralSignal.confidence}% confidence` : "Confidence pending"}</small>
          </div>
        </div>
        <div className="heroActions">
          <button type="button" onClick={() => createAlert("PRICE WATCH", setup.currentPrice, "above")}>CREATE ALERT</button>
          <button type="button" onClick={addToWatchlist}>ADD TO WATCHLIST</button>
          <Link className="primaryAction" href={`/freedom-trader/trade-journal?symbol=${encodeURIComponent(symbol)}`}>RECORD BROKER TRADE</Link>
          <button className="primaryAction" type="button" onClick={openTradeConfirmation}>VIEW TRADE PLAN</button>
        </div>
      </header>
      <section className="planOnlyWarning">TRADE PLAN ONLY - PLACE AND CONFIRM THE ORDER THROUGH YOUR BROKER</section>

      <section className="decisionPanel">
        <div>
          <span>Current Decision</span>
          <SignalBadge signal={`${centralSignal.overallSignal} (${centralSignal.timeframe || "1D"})`} />
          <p>{setup.opportunity?.reasonsFor?.[0] || setup.reasoning}</p>
        </div>
        <Metric label="Score" value={setup.opportunity?.score ?? setup.tradingScore ?? "--"} />
        <Metric label="Confidence" value={Number.isFinite(setup.confidence) ? `${setup.confidence}%` : setup.opportunity?.confidence || "--"} />
        <Metric label="Verified Price" value={formatCurrency(setup.currentPrice)} />
        <Metric label="Last Updated" value={setup.opportunity?.priceTimestamp || setup.dataStatus?.latestTimestamp || "--"} />
        <Metric label="Exchange" value={analysis?.exchange || setup.opportunity?.exchange || "--"} />
        <Metric label="Currency" value={setup.opportunity?.currency || "USD"} />
        <Metric label="Provider" value={setup.opportunity?.dataProvider || setup.marketData?.historySource || "--"} />
      </section>

      <section className="decisionGrid">
        <article>
          <h2>Why It Qualifies</h2>
          {(setup.opportunity?.reasonsFor?.length ? setup.opportunity.reasonsFor : [setup.reasoning]).map((reason) => <p key={reason}>{reason}</p>)}
        </article>
        <article>
          <h2>Why It May Fail</h2>
          {(setup.opportunity?.reasonsAgainst?.length ? setup.opportunity.reasonsAgainst : setup.opportunity?.failedConditions?.length ? setup.opportunity.failedConditions : ["No opposing signal loaded yet."]).map((reason) => <p key={reason}>{reason}</p>)}
        </article>
        <article>
          <h2>Trade Plan ({tradeDirection === "bearish" ? "Bearish" : "Bullish"})</h2>
          <p>Entry ({levelSources.entry || "custom"}): {formatCurrency(visualLevels.entry)}</p>
          <p>Stop-loss ({levelSources.stop || "custom"}): {formatCurrency(visualLevels.stop)}</p>
          <p>Target 1 ({levelSources.target || "custom"}): {formatCurrency(visualLevels.target)}</p>
          {Number.isFinite(visualLevels.target2) ? <p>Target 2 ({levelSources.target2 || "custom"}): {formatCurrency(visualLevels.target2)}</p> : null}
          <p>Risk per share: {formatCurrency(levelsComplete(visualLevels) ? Math.abs(visualLevels.entry - visualLevels.stop) : null)}</p>
          <p>Reward per share (Target 1): {formatCurrency(levelsComplete(visualLevels) ? Math.abs(visualLevels.target - visualLevels.entry) : null)}</p>
          <p>Risk/reward (Target 1): {formatNumber(visualMetrics.riskReward)}</p>
          {Number.isFinite(visualMetrics.riskRewardTarget2) ? <p>Risk/reward (Target 2): {formatNumber(visualMetrics.riskRewardTarget2)}</p> : null}
          <p>This chart, this card and the position size below always use the same active levels shown here.</p>
          {!levelOrderCheck.valid ? <p className="fibInvalidNotice">Invalid: {levelOrderCheck.reason}</p> : null}
        </article>
      </section>

      {planIsStale && !staleBannerDismissed ? (
        <section className="staleBanner">
          <strong>This trade plan was created using older market data.</strong>
          <span>Review the levels before using it.</span>
          <div className="staleBannerActions">
            <button type="button" onClick={() => setStaleBannerDismissed(true)}>Keep Saved Plan</button>
            <button type="button" onClick={() => { resetLevelsToAnalysis(); setStaleBannerDismissed(true); }}>Reset to Latest Analysis</button>
            <button type="button" onClick={() => { deleteFibDrawing(); setChartMode("fib"); setStaleBannerDismissed(true); }}>Generate New Fib Plan</button>
          </div>
        </section>
      ) : null}

      {error ? <section className="alert">{error}</section> : null}
      {setup.marketData && !setup.marketData.validated ? (
        <section className="dataWarning">
          <strong>Market price not validated</strong>
          <span>{setup.marketData.issues?.join(" ") || "Live market data could not be confirmed. Trade recommendations are disabled."}</span>
        </section>
      ) : null}
      {loading ? <section className="notice">Loading trading data...</section> : null}
      {saveMessage ? <section className="notice">{saveMessage}</section> : null}
      {currentBlockers.length ? <section className="dataWarning"><strong>Trade setup blocked</strong><span>{currentBlockers[0]}</span></section> : null}

      {openPosition ? (
        <section className="positionBand">
          <div>
            <span>Open Position</span>
            <strong>{openPosition.quantity} shares @ {formatCurrency(openPosition.entryPrice)}</strong>
          </div>
          <div>
            <span>Current P/L</span>
            <strong className={openPosition.unrealisedProfit >= 0 ? "profit" : "loss"}>{formatCurrency(openPosition.unrealisedProfit)}</strong>
          </div>
          <div>
            <span>Target / Stop</span>
            <strong>{formatCurrency(openPosition.targetPrice)} / {formatCurrency(openPosition.stopPrice)}</strong>
          </div>
          <div>
            <span>Days Held</span>
            <strong>{openPosition.daysHeld ?? "--"}</strong>
          </div>
          <Link href="/freedom-trader/positions">Open Position</Link>
        </section>
      ) : null}

      <section className="chartPanel">
        <div className="panelHeader">
          <div>
            <h2>Trade Chart</h2>
            <p>ANALYSIS SIGNAL: {centralSignal.overallSignal} ({centralSignal.timeframe || "1D"}). PROPOSED TRADE PLAN - NOT YET EXECUTED.</p>
          </div>
          <div className="chartControls">
            <span>Range</span>
            {TIMEFRAMES.map((item) => (
              <button className={timeframe === item.label ? "active" : ""} key={item.label} type="button" onClick={() => setTimeframe(item.label)}>
                {item.label}
              </button>
            ))}
            <span>Interval</span>
            {CHART_INTERVALS.map((item) => (
              <button className={chartInterval === item.value ? "active" : ""} key={item.value} type="button" onClick={() => setChartInterval(item.value)}>
                {item.label}
              </button>
            ))}
            <FreedomChartTypeSelector value={chartType} onChange={setChartType} />
            <span>Drawing</span>
            <button className={chartMode === "pan" ? "active" : ""} type="button" onClick={() => setChartMode("pan")}>Pan</button>
            <button className={chartMode === "fib" ? "active" : ""} type="button" onClick={() => setChartMode("fib")}>Fib Retracement</button>
            <button className={chartMode === "select" ? "active" : ""} type="button" onClick={() => setChartMode("select")}>Select</button>
            <button type="button" onClick={deleteFibDrawing} disabled={!fibDrawing}>Delete</button>
            <button type="button" onClick={() => setFibVisibility(false)} disabled={!fibDrawing || !fibVisible}>Hide Fib</button>
            <button type="button" onClick={() => setFibVisibility(true)} disabled={!fibDrawing || fibVisible}>Show Fib</button>
          </div>
          {fibDrawing ? (
            <div className="fibConfigRow">
              <span>Fib direction</span>
              <button className={tradeDirection === "bullish" ? "active" : ""} type="button" onClick={() => setFibDirection("bullish")}>Bullish</button>
              <button className={tradeDirection === "bearish" ? "active" : ""} type="button" onClick={() => setFibDirection("bearish")}>Bearish</button>
              <label className="fibExtensionToggle">
                <input type="checkbox" checked={Boolean(fibDrawing.showExtensions)} onChange={(event) => setFibShowExtensions(event.target.checked)} />
                Show extensions (127.2/138.2/161.8/200%)
              </label>
              <label className="fibBufferInput">
                Stop buffer %
                <input type="number" min="0" max="10" step="0.1" value={fibDrawing.safetyBufferPercent} onChange={(event) => setFibSafetyBuffer(event.target.value)} />
              </label>
              <button className="primaryAction" type="button" onClick={applyGeneratedFibPlan}>Use Fib for Trade Plan</button>
              <button type="button" onClick={resetLevelsToAnalysis}>Reset to Analysis</button>
              <button type="button" onClick={clearFibPlan}>Clear Fib Plan</button>
            </div>
          ) : null}
          <div className="fibSaveStatusRow">
            <FibPlanSaveStatus status={fibPlanSaveStatus} signedIn={Boolean(session?.access_token)} />
          </div>
        </div>
        <FreedomChartDisplayToggles toggles={displayToggles} onChange={setDisplayToggles} />
        <div
          className="chartShell"
          onMouseLeave={endChartPan}
          onMouseMoveCapture={moveChartPan}
          onMouseUpCapture={endChartPan}
          onPointerCancelCapture={endChartPan}
          onPointerDownCapture={beginChartPan}
          onPointerMoveCapture={moveChartPan}
          onPointerUpCapture={endChartPan}
        >
          {chartError ? <div className="chartState warning">{chartError}</div> : null}
          {chartMeta?.dataLabel ? <div className="dataLabel">{chartMeta.dataLabel}</div> : null}
          <div ref={chartNodeRef} className="chart" />
          {displayToggles.fibonacci && fibOverlayReady ? (
            <div className="fibDrawingLayer" aria-label="Fibonacci retracement drawing">
              {fibGeometry.bands.map((band) => (
                <div
                  className="fibBand"
                  key={band.key}
                  style={{
                    background: band.color,
                    height: band.height,
                    left: fibGeometry.body.left,
                    top: band.top,
                    width: fibGeometry.body.width,
                  }}
                />
              ))}
              <button
                aria-label="Drag Fibonacci drawing"
                className={`fibBodyHandle ${draggingFib?.type === "body" ? "dragging" : ""}`}
                onPointerDown={(event) => startFibDrag(event, "body")}
                style={{
                  height: fibGeometry.body.height,
                  left: fibGeometry.body.left,
                  top: fibGeometry.body.top,
                  width: fibGeometry.body.width,
                }}
                type="button"
              />
              {fibGeometry.levels.map((level) => (
                <button
                  aria-label={`${level.label} Fibonacci level ${formatCurrency(level.price)}${level.assignment ? `, assigned as ${LEVEL_ASSIGNMENT_LABELS[level.assignment]}` : ""}`}
                  className={`fibLevel ${selectedFibLevelKey === level.key ? "selected" : ""} ${level.extension ? "extension" : ""} ${level.assignment ? `assigned assigned-${level.assignment}` : ""}`}
                  key={level.key}
                  onClick={() => setSelectedFibLevelKey(level.key)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setSelectedFibLevelKey(level.key);
                  }}
                  style={{
                    left: fibGeometry.body.left,
                    top: level.y,
                    width: fibGeometry.body.width,
                  }}
                  type="button"
                >
                  <span className="fibLabel" style={{ top: level.labelY - level.y }}>
                    {level.label} {level.assignment ? `— ${LEVEL_ASSIGNMENT_LABELS[level.assignment]} —` : ""} {formatCurrency(level.price)}
                  </span>
                </button>
              ))}
              <button
                aria-label="Drag Fibonacci anchor 1"
                className={`fibAnchor fibAnchorOne ${draggingFib?.anchorKey === "anchor1" ? "dragging" : ""}`}
                onPointerDown={(event) => startFibDrag(event, "anchor", "anchor1")}
                style={{ left: fibGeometry.anchor1.x, top: fibGeometry.anchor1.y }}
                type="button"
              />
              <button
                aria-label="Drag Fibonacci anchor 2"
                className={`fibAnchor fibAnchorTwo ${draggingFib?.anchorKey === "anchor2" ? "dragging" : ""}`}
                onPointerDown={(event) => startFibDrag(event, "anchor", "anchor2")}
                style={{ left: fibGeometry.anchor2.x, top: fibGeometry.anchor2.y }}
                type="button"
              />
              <button
                aria-label="Move Fibonacci drawing"
                className="fibMoveHandle"
                onPointerDown={(event) => startFibDrag(event, "body")}
                style={{ left: fibGeometry.center.x, top: fibGeometry.center.y }}
                type="button"
              />
              {selectedFibLevel ? (
                <div className="fibLevelMenu" style={{ left: fibGeometry.body.left + 10, top: selectedFibLevel.labelY + 14 }}>
                  <button type="button" onClick={() => assignFibLevel("entry", selectedFibLevel.key)}>Set as Entry</button>
                  <button type="button" onClick={() => assignFibLevel("stop", selectedFibLevel.key)}>Set as Stop-loss</button>
                  <button type="button" onClick={() => assignFibLevel("target", selectedFibLevel.key)}>Set as Target 1</button>
                  <button type="button" onClick={() => assignFibLevel("target2", selectedFibLevel.key)}>Set as Target 2</button>
                  {selectedFibLevel.assignment ? <button type="button" onClick={() => clearFibAssignment(selectedFibLevel.key)}>Clear assignment</button> : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {displayToggles.fibonacci && chartMode === "fib" ? (
            <div
              className="fibDraftLayer"
              onPointerDown={startFibDraft}
              onPointerMove={moveFibDraft}
              onPointerUp={finishFibDraft}
            />
          ) : null}
          {displayToggles.tradePlan && visualOverlayReady ? (
            <div className="visualPlannerOverlay" aria-label="Visual trade planner">
              <div className="zone profitZone" style={{ top: profitZone.top, height: profitZone.height }} />
              <div className="zone riskZone" style={{ top: riskZone.top, height: riskZone.height }} />
              {[
                Number.isFinite(linePixels.target2) ? { key: "target2", label: "TARGET 2", value: visualLevels.target2, y: linePixels.target2, className: "target2Line" } : null,
                { key: "target", label: "TARGET 1", value: visualLevels.target, y: linePixels.target, className: "targetLine" },
                { key: "entry", label: "ENTRY", value: visualLevels.entry, y: linePixels.entry, className: "entryLine" },
                { key: "stop", label: "STOP", value: visualLevels.stop, y: linePixels.stop, className: "stopLine" },
              ].filter(Boolean).map((line) => (
                <button
                  aria-label={`Drag ${line.label}`}
                  className={`plannerLine ${line.className} ${draggingLevel === line.key ? "dragging" : ""}`}
                  key={line.key}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setDraggingLevel(line.key);
                  }}
                  style={{ top: line.y }}
                  type="button"
                >
                  <span>{line.label}</span>
                  <strong>{formatCurrency(line.value)}</strong>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="visualPlannerPanel">
          <Metric label="Analysis Signal" value={`${centralSignal.overallSignal} (${centralSignal.timeframe || "1D"})`} />
          <Metric label="Journal Position" value={openPosition ? tradeStatus : "No journal position"} />
          {[
            { key: "entry", label: "ENTRY" },
            { key: "stop", label: "STOP" },
            { key: "target", label: "TARGET 1" },
            { key: "target2", label: "TARGET 2" },
          ].map((field) => (
            <label className="manualLevelInput" key={field.key}>
              {field.label} ({levelSources[field.key] || "custom"})
              <span>
                <input
                  type="number"
                  step="0.01"
                  value={visualLevels[field.key] ?? ""}
                  onChange={(event) => (event.target.value === "" ? clearVisualLevel(field.key) : updateVisualLevel(field.key, event.target.value, "custom"))}
                />
                {Number.isFinite(visualLevels[field.key]) ? <button type="button" onClick={() => clearVisualLevel(field.key)} aria-label={`Clear ${field.label}`}>&times;</button> : null}
              </span>
            </label>
          ))}
          <Metric label="Risk/Reward (Target 1)" value={formatNumber(visualMetrics.riskReward)} />
          {Number.isFinite(visualMetrics.riskRewardTarget2) ? <Metric label="Risk/Reward (Target 2)" value={formatNumber(visualMetrics.riskRewardTarget2)} /> : null}
          <Metric label="Expected Profit (Target 1)" value={formatCurrency(visualMetrics.expectedProfit)} />
          {Number.isFinite(visualMetrics.expectedProfitTarget2) ? <Metric label="Expected Profit (Target 2)" value={formatCurrency(visualMetrics.expectedProfitTarget2)} /> : null}
          <button type="button" onClick={resetLevelsToAnalysis}>Reset to Analysis</button>
          {fibDrawing ? <button type="button" onClick={resetLevelsToFib}>Reset to Fib Recommendation</button> : null}
          <button type="button" onClick={addToWatchlist}>Add to Watchlist</button>
          <button className="primaryAction" type="button" onClick={openTradeConfirmation}>View Trade Plan</button>
          {saveMessage ? <p className="inlineNotice">{saveMessage}</p> : null}
        </div>
        {selectedTradeMarker ? (
          <div className="tradeMarkerDetails">
            <strong>{selectedTradeMarker.type}</strong>
            <span>Date and time: {selectedTradeMarker.dateTime || "--"}</span>
            <span>Quantity: {selectedTradeMarker.quantity ?? "--"}</span>
            <span>Fill price: {formatCurrency(selectedTradeMarker.fillPrice)}</span>
            <span>Fees: {formatCurrency(selectedTradeMarker.fees)}</span>
            <span>Order type: {selectedTradeMarker.orderType || "--"}</span>
            <span>Realised profit/loss: {formatCurrency(selectedTradeMarker.realisedProfitLoss)}</span>
            <span>Exit reason: {selectedTradeMarker.exitReason || "--"}</span>
            <button type="button" onClick={() => setSelectedTradeMarker(null)}>Close</button>
          </div>
        ) : null}
      </section>

      <footer>Freedom Trader is separate from Freedom Investment. Trading research only. Not financial advice.</footer>

      {tradeModalOpen && tradeDraft ? (
        <div className="modalBackdrop" onMouseDown={closeTradeModalFromBackdrop}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="trade-plan-title">
            <div className="modalHeader">
              <div>
                <span>Recommendation</span>
                <h2 id="trade-plan-title">Should I buy?</h2>
              </div>
              <button className="modalClose" type="button" onClick={closeTradeModal} aria-label="Close trade plan">Close</button>
            </div>
            <div className={`recommendationCard ${modalCanBuy ? "yes" : "no"}`}>
              <strong>{modalCanBuy ? "YES" : "NO"}</strong>
              <p>{modalWhy}</p>
            </div>
            {tradeDraft.blockers?.length ? (
              <div className="modalWarning">
                <strong>Do not buy yet</strong>
                {tradeDraft.blockers.map((blocker) => <span key={blocker}>{blocker}</span>)}
              </div>
            ) : null}
            <div className="plainPlanGrid">
              <Metric label="Company" value={tradeDraft.companyName} />
              {!modalCanBuy ? <Metric label="Wait for this buy price" value={waitForPriceText} /> : null}
              {modalCanBuy ? <Metric label="How much could I lose?" value={formatCalculatedCurrency(tradeDraft.maximumLoss)} /> : null}
              {modalCanBuy ? <Metric label="How much could I make?" value={formatCalculatedCurrency(tradeDraft.expectedProfit)} /> : null}
              <Metric label="Shares to buy" value={formatCalculatedNumber(tradeDraft.quantity)} />
            </div>
            <section className="cmcInstructions">
              <h3>Enter this in CMC</h3>
              <ol>
                <li>Open CMC Invest.</li>
                <li>Search for {symbol}.</li>
                <li>Select Buy.</li>
                <li>Choose a Limit or conditional order.</li>
                <li>Enter {formatCalculatedNumber(tradeDraft.quantity)} whole shares.</li>
                <li>Enter the buy-trigger price of {formatCalculatedCurrency(tradeDraft.entryPrice)}.</li>
                <li>Review and submit the order in CMC.</li>
                <li>Add the Safety Exit and profit instructions supported by the CMC order workflow.</li>
                <li>Return to Freedom and record the actual filled price only after CMC confirms execution.</li>
              </ol>
            </section>
            <p className="brokerNotice">Freedom has not placed this order. Enter and confirm the order manually through CMC.</p>
            <details className="technicalDetails">
              <summary>Show Technical Details</summary>
              <div className="confirmationGrid">
                <Metric label="Current Price" value={formatCalculatedCurrency(tradeDraft.currentPrice)} />
                <Metric label="Buy Price" value={formatCalculatedCurrency(tradeDraft.entryPrice)} />
                <Metric label="Safety Exit" value={formatCalculatedCurrency(tradeDraft.stopPrice)} />
                <Metric label="Take Some Profit" value={formatCalculatedCurrency(tradeDraft.targetPrice)} />
                <Metric label="Final Exit" value={formatCalculatedCurrency(tradeDraft.targetPrice2)} />
                <Metric label="Target 2 Profit" value={formatCalculatedCurrency(tradeDraft.expectedProfitTarget2)} />
                <Metric label="Distance to Buy Price" value={Number.isFinite(Number(tradeDraft.distanceToEntry)) ? `${formatCalculatedCurrency(Math.abs(tradeDraft.distanceToEntry))} / ${formatPercent(Math.abs(tradeDraft.distanceToEntryPercent))}` : "Not calculated"} />
                <Metric label="Capital Required" value={formatCalculatedCurrency(tradeDraft.capitalRequired)} />
                <Metric label="Expected Profit" value={formatCalculatedCurrency(tradeDraft.expectedProfit)} />
                <Metric label="Percentage Return" value={formatPercent(tradeDraft.percentageReturn)} />
                <Metric label="Reward For Risk" value={formatCalculatedNumber(tradeDraft.riskRewardRatio)} />
                <Metric label="Estimated Holding Time" value={tradeDraft.holdingTime || "Not calculated"} />
                <Metric label="Plan Status" value={modalCanBuy ? "Ready to buy" : "Wait"} />
              </div>
            </details>
            {manualBuyForm ? (
              <div className="manualTradeForm">
                <label>Actual purchase price<input value={manualBuyForm.actualPurchasePrice} onChange={(event) => setManualBuyForm((current) => ({ ...current, actualPurchasePrice: event.target.value }))} type="number" /></label>
                <label>Shares purchased<input value={manualBuyForm.sharesPurchased} onChange={(event) => setManualBuyForm((current) => ({ ...current, sharesPurchased: event.target.value }))} type="number" /></label>
                <label>Brokerage cost<input value={manualBuyForm.brokerageCost} onChange={(event) => setManualBuyForm((current) => ({ ...current, brokerageCost: event.target.value }))} type="number" /></label>
                <label>Purchase date and time<input value={manualBuyForm.purchaseDateTime} onChange={(event) => setManualBuyForm((current) => ({ ...current, purchaseDateTime: event.target.value }))} type="datetime-local" /></label>
                <label>Broker order/reference number (optional)<input value={manualBuyForm.brokerReference} onChange={(event) => setManualBuyForm((current) => ({ ...current, brokerReference: event.target.value }))} type="text" /></label>
                <label>Notes (optional)<input value={manualBuyForm.notes} onChange={(event) => setManualBuyForm((current) => ({ ...current, notes: event.target.value }))} type="text" /></label>
                <p className="brokerNotice">This is a rules-based trading plan, not a guarantee of profit. Confirm prices and place the order through your broker.</p>
                <button type="button" className="primaryAction" onClick={recordTradeDraftBuy} disabled={tradeActionSaving === "buy"}>{tradeActionSaving === "buy" ? "Recording..." : "Confirm Purchase"}</button>
              </div>
            ) : null}
            <div className="modalActions">
              <button type="button" onClick={openBroker}>Open CMC</button>
              <button type="button" onClick={() => createAllAlerts()} disabled={tradeActionSaving || tradeDraft.blockers?.length}>{tradeActionSaving === "alerts" ? "Creating..." : "Create Alert"}</button>
              <button type="button" onClick={addToWatchlist}>Add to Watchlist</button>
              {!manualBuyForm ? <button type="button" className="primaryAction" onClick={startManualBuy} disabled={tradeDraft.blockers?.length}>Mark as Purchased</button> : null}
              <Link className="primaryAction" href={`/freedom-trader/trade-journal?symbol=${encodeURIComponent(symbol)}`}>Record Broker Trade</Link>
              <button type="button" onClick={cancelSetup}>Cancel Setup</button>
            </div>
          </section>
        </div>
      ) : null}

      <style jsx>{`
        .boot, .page { background: #05080b; color: #f5f7f8; font-family: Inter, ui-sans-serif, system-ui; min-height: 100vh; }
        .boot { align-items: center; display: flex; font-weight: 900; justify-content: center; }
        .page { padding: 96px 28px 28px; }
        .hero, .cards, .chartPanel, .split, footer, .alert, .notice, .dataWarning { margin-left: auto; margin-right: auto; max-width: 1760px; }
        .platformBanner { align-items: center; background: #0057d9; box-shadow: 0 10px 28px rgba(0,0,0,.32); display: flex; gap: 14px; justify-content: space-between; left: 0; padding: 14px 28px; position: fixed; right: 0; top: 0; z-index: 100; }
        .platformBanner strong { align-items: center; color: #fff; display: inline-flex; gap: 10px; font-size: clamp(24px,2.6vw,34px); font-weight: 950; }
        .platformBanner span { color: #fff; font-size: clamp(14px,1.4vw,18px); font-weight: 900; }
        .platformBanner .platformIcon { color: #ff9900; font-size: .9em; line-height: 1; }
        .hero { background: #07111f; border: 1px solid rgba(29,155,255,.34); border-radius: 8px; padding: 28px; }
        .platformSwitch { display: inline-flex; gap: 8px; margin-bottom: 16px; }
        .platformSwitch a { background: #00843d; border: 1px solid #00843d; border-radius: 999px; color: #fff; font-size: 14px; font-weight: 950; padding: 10px 14px; text-decoration: none; }
        .platformSwitch a.active { background: #0057d9; border-color: #0057d9; color: #fff; }
        .back { color: #d7efff; font-size: 18px; font-weight: 900; text-decoration: none; }
        .heroMain { align-items: center; display: flex; gap: 18px; margin-top: 24px; }
        .heroActions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
        .heroActions a, .modalActions a { align-items: center; border-radius: 7px; display: inline-flex; font-weight: 950; min-height: 38px; padding: 0 13px; text-decoration: none; }
        .analysisSignalBox { align-items: flex-end; display: grid; gap: 5px; justify-items: end; margin-left: auto; }
        .analysisSignalBox > span, .analysisSignalBox small { color: #aab8be; font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
        .editPositionLink { align-items: center; background: rgba(29,155,255,.12); border: 1px solid rgba(29,155,255,.34); border-radius: 7px; color: #d7efff; display: inline-flex; font-weight: 950; min-height: 38px; padding: 0 12px; text-decoration: none; }
        .heroActions button { background: rgba(29,155,255,.14); border: 1px solid rgba(29,155,255,.34); color: #d7efff; padding: 0 13px; }
        .heroActions .primaryAction, .primaryAction { background: #ff9900; border-color: #ff9900; color: #061014; }
        .planOnlyWarning { background: rgba(255,153,0,.12); border: 1px solid rgba(255,153,0,.34); border-radius: 8px; color: #ffd7a1; font-weight: 950; letter-spacing: .03em; margin-top: 18px; padding: 14px 16px; text-align: center; }
        .decisionPanel, .decisionGrid { display: grid; gap: 14px; margin-top: 18px; }
        .decisionPanel { background: rgba(8,14,17,.92); border: 1px solid rgba(29,155,255,.2); border-radius: 8px; grid-template-columns: 2fr repeat(7, minmax(0,1fr)); padding: 18px; }
        .decisionPanel > div:first-child { display: grid; gap: 8px; }
        .decisionPanel span { color: #aebdc4; font-size: 12px; font-weight: 900; text-transform: uppercase; }
        .decisionGrid { grid-template-columns: repeat(3, minmax(0,1fr)); }
        .decisionGrid article { background: rgba(8,14,17,.92); border: 1px solid rgba(179,199,207,.13); border-radius: 8px; padding: 18px; }
        .decisionGrid p { color: #d8e5ea; line-height: 1.5; margin-top: 9px; }
        .logo { align-items: center; background: linear-gradient(135deg, var(--company-primary), var(--company-secondary)); border-radius: 999px; display: inline-flex; font-size: 20px; font-weight: 950; height: 74px; justify-content: center; width: 74px; }
        h1, h2, p { margin: 0; }
        h1 { font-size: 48px; line-height: 1; }
        .hero p, footer, .panelHeader p, .reason { color: #aebdc4; }
        .cards { display: grid; gap: 14px; grid-template-columns: repeat(6, minmax(0, 1fr)); margin-top: 18px; }
        .chartPanel, .panel, :global(.metric) { background: rgba(8,14,17,.92); border: 1px solid rgba(179,199,207,.13); border-radius: 8px; }
        :global(.metric) { padding: 16px; }
        :global(.metric span) { color: #aebdc4; display: block; font-size: 12px; font-weight: 900; text-transform: uppercase; }
        :global(.metric strong) { color: #fff; display: block; font-size: 22px; margin-top: 8px; }
        .chartPanel, .split { margin-top: 18px; }
        .panelHeader { align-items: center; border-bottom: 1px solid rgba(179,199,207,.1); display: flex; gap: 16px; justify-content: space-between; padding: 18px 20px; }
        .chartControls { display: flex; flex-wrap: wrap; gap: 8px; }
        .chartControls button.active { background: rgba(255,153,0,.2); border-color: rgba(255,153,0,.52); color: #fff; }
        .chartControls button:disabled { cursor: not-allowed; opacity: .42; }
        .chartControls span { align-items: center; color: #aebdc4; display: inline-flex; font-size: 12px; font-weight: 950; min-height: 38px; text-transform: uppercase; }
        .chartTypeSelect { align-items: center; color: #aab8be; display: inline-flex; font-size: 11px; font-weight: 900; gap: 6px; text-transform: uppercase; }
        .chartTypeSelect select { background: #091117; border: 1px solid rgba(255,255,255,.16); border-radius: 7px; color: #f6f8f9; font-weight: 850; height: 34px; padding: 0 8px; }
        .displayToggles { align-items: center; border-bottom: 1px solid rgba(255,255,255,.08); display: flex; flex-wrap: wrap; gap: 12px; padding: 10px 20px; }
        .displayToggles label { align-items: center; display: inline-flex; flex-direction: row; gap: 7px; text-transform: none; }
        .displayToggles input { height: auto; width: auto; }
        .chartShell { height: 660px; overflow: hidden; position: relative; }
        .chart { height: 100%; width: 100%; }
        .chartState { align-items: center; background: rgba(5,8,11,.78); color: #d8e5ea; display: flex; font-weight: 900; inset: 0; justify-content: center; padding: 20px; position: absolute; text-align: center; z-index: 5; }
        .chartState.warning { color: #ffe98a; }
        .dataLabel { background: rgba(5,8,11,.82); border: 1px solid rgba(255,255,255,.16); border-radius: 999px; color: #d7efff; font-size: 12px; font-weight: 950; padding: 7px 10px; position: absolute; right: 14px; top: 12px; z-index: 4; }
        .fibDrawingLayer { inset: 0; pointer-events: none; position: absolute; z-index: 6; }
        .fibDraftLayer { cursor: crosshair; inset: 0; position: absolute; z-index: 7; }
        .fibBand { border-left: 1px solid rgba(255,255,255,.18); border-right: 1px solid rgba(255,255,255,.18); pointer-events: none; position: absolute; }
        .fibBodyHandle { background: transparent; border: 1px dashed transparent; border-radius: 0; cursor: move; margin: 0; min-height: 0; padding: 0; pointer-events: auto; position: absolute; z-index: 2; }
        .fibBodyHandle:hover, .fibBodyHandle.dragging { border-color: rgba(255,255,255,.24); }
        .fibLevel { background: transparent; border: 0; border-radius: 0; cursor: pointer; height: 18px; margin: -9px 0 0; min-height: 18px; padding: 0; pointer-events: auto; position: absolute; z-index: 3; }
        .fibLevel:before { background: rgba(255,255,255,.74); content: ""; height: 1px; left: 0; position: absolute; right: 0; top: 9px; }
        .fibLevel.selected:before, .fibLevel:hover:before { background: #fff; height: 2px; }
        .fibLevel.extension:before { background: rgba(255,153,0,.6); border-top: 1px dashed rgba(255,153,0,.8); }
        .fibLevel.assigned:before { height: 2px; }
        .fibLevel.assigned-entry:before { background: rgba(94,189,255,.94); }
        .fibLevel.assigned-stop:before { background: rgba(255,92,92,.94); }
        .fibLevel.assigned-target:before, .fibLevel.assigned-target2:before { background: rgba(35,209,139,.92); }
        .fibLabel { background: rgba(5,8,11,.9); border: 1px solid rgba(255,255,255,.18); border-radius: 6px; color: #f8fbff; font-size: 12px; font-weight: 950; left: 0; line-height: 1; padding: 5px 7px; position: absolute; transform: translate(-100%, -50%); white-space: nowrap; }
        .fibConfigRow { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
        .fibConfigRow > span { color: #aebdc4; font-size: 11px; font-weight: 900; text-transform: uppercase; }
        .fibExtensionToggle, .fibBufferInput { align-items: center; color: #d8e5ea; display: inline-flex; font-size: 12px; font-weight: 800; gap: 6px; }
        .fibBufferInput input { width: 64px; }
        .fibSaveStatusRow { margin-top: 8px; }
        .fibSaveStatus { border-radius: 999px; display: inline-flex; font-size: 11px; font-weight: 900; padding: 5px 10px; text-transform: uppercase; }
        .fibSaveStatus.saving { background: rgba(94,189,255,.14); color: #bfe3ff; }
        .fibSaveStatus.saved { background: rgba(35,209,139,.14); color: #b8f4e6; }
        .fibSaveStatus.error { background: rgba(255,92,92,.16); color: #ffc8c8; text-transform: none; }
        .fibSaveStatus.offline { background: rgba(255,255,255,.06); color: #aebdc4; text-transform: none; }
        .staleBanner { align-items: center; background: rgba(255,153,0,.12); border: 1px solid rgba(255,153,0,.36); border-radius: 8px; display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 18px auto 0; max-width: 1760px; padding: 14px 16px; }
        .staleBanner strong { color: #ffd7a1; }
        .staleBanner span { color: #ffe4bd; }
        .staleBannerActions { display: flex; flex-wrap: wrap; gap: 8px; margin-left: auto; }
        .fibAnchor, .fibMoveHandle { align-items: center; background: #061014; border: 3px solid #fff; border-radius: 999px; box-shadow: 0 7px 20px rgba(0,0,0,.5); cursor: grab; display: inline-flex; justify-content: center; min-height: 0; padding: 0; pointer-events: auto; position: absolute; transform: translate(-50%, -50%); z-index: 5; }
        .fibAnchor { height: 22px; width: 22px; }
        .fibAnchorOne { border-color: #ffe25c; }
        .fibAnchorTwo { border-color: #5ebdff; }
        .fibAnchor.dragging, .fibMoveHandle:active { cursor: grabbing; }
        .fibMoveHandle { border-color: #fff; height: 18px; width: 18px; }
        .fibMoveHandle:before { background: #fff; border-radius: 999px; content: ""; height: 6px; width: 6px; }
        .fibLevelMenu { background: rgba(5,8,11,.96); border: 1px solid rgba(255,255,255,.2); border-radius: 8px; box-shadow: 0 18px 48px rgba(0,0,0,.5); display: flex; gap: 6px; padding: 7px; pointer-events: auto; position: absolute; z-index: 8; }
        .fibLevelMenu button { font-size: 12px; min-height: 32px; padding: 0 9px; white-space: nowrap; }
        .visualPlannerOverlay { inset: 0; pointer-events: none; position: absolute; z-index: 3; }
        .zone { left: 62px; pointer-events: none; position: absolute; right: 26px; }
        .profitZone { background: linear-gradient(180deg, rgba(35,209,139,.18), rgba(35,209,139,.04)); border-bottom: 1px solid rgba(35,209,139,.16); border-top: 1px solid rgba(35,209,139,.24); }
        .riskZone { background: linear-gradient(180deg, rgba(255,92,92,.05), rgba(255,92,92,.2)); border-bottom: 1px solid rgba(255,92,92,.28); border-top: 1px solid rgba(255,92,92,.16); }
        .plannerLine { align-items: center; background: transparent; border: 0; border-radius: 0; color: #fff; cursor: ns-resize; display: flex; font-size: 12px; font-weight: 950; height: 28px; justify-content: space-between; left: 62px; margin: 0; min-height: 28px; padding: 0; pointer-events: auto; position: absolute; right: 26px; transform: translateY(-50%); width: auto; z-index: 4; }
        .plannerLine:before { content: ""; height: 4px; left: 0; position: absolute; right: 0; top: 12px; }
        .plannerLine span, .plannerLine strong { border-radius: 999px; box-shadow: 0 10px 26px rgba(0,0,0,.36); font-size: 13px; padding: 7px 12px; position: relative; z-index: 1; }
        .targetLine:before, .targetLine span, .targetLine strong { background: rgba(35,209,139,.92); color: #03130d; }
        .entryLine:before, .entryLine span, .entryLine strong { background: rgba(94,189,255,.94); color: #03111d; }
        .stopLine:before, .stopLine span, .stopLine strong { background: rgba(255,92,92,.94); color: #210606; }
        .target2Line:before, .target2Line span, .target2Line strong { background: rgba(94,220,190,.85); color: #03130d; }
        .plannerLine.dragging span, .plannerLine.dragging strong { box-shadow: 0 0 0 3px rgba(255,255,255,.18), 0 12px 30px rgba(0,0,0,.35); }
        .visualPlannerPanel { border-top: 1px solid rgba(255,255,255,.08); display: grid; gap: 12px; grid-template-columns: repeat(5,minmax(0,1fr)) repeat(3,minmax(120px,.65fr)); padding: 16px; }
        .visualPlannerPanel button { min-height: 44px; padding: 0 12px; }
        .manualLevelInput { color: #aebdc4; display: grid; font-size: 11px; font-weight: 900; gap: 6px; text-transform: uppercase; }
        .manualLevelInput span { align-items: center; display: flex; gap: 4px; }
        .manualLevelInput input { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.16); border-radius: 6px; color: #fff; font-size: 15px; font-weight: 900; height: 36px; padding: 0 8px; text-transform: none; width: 100%; }
        .manualLevelInput button { background: rgba(255,92,92,.18); border: 1px solid rgba(255,92,92,.4); border-radius: 6px; color: #ffc8c8; cursor: pointer; font-weight: 950; height: 30px; min-height: 30px; padding: 0 8px; }
        .fibInvalidNotice { color: #ff9b9b; font-weight: 900; }
        .tradeMarkerDetails { background: rgba(5,8,11,.94); border-top: 1px solid rgba(255,255,255,.1); display: grid; gap: 7px; grid-template-columns: repeat(4,minmax(0,1fr)) auto; padding: 14px 16px; }
        .tradeMarkerDetails strong { color: #fff; text-transform: uppercase; }
        .tradeMarkerDetails span { color: #d8e5ea; font-size: 13px; }
        .tradeMarkerDetails button { min-height: 34px; }
        .inlineNotice { color: #b8f4e6; font-size: 12px; font-weight: 850; grid-column: 1 / -1; margin: 0; }
        .split { display: grid; gap: 18px; grid-template-columns: 1.25fr .75fr; }
        .panel { padding: 18px; }
        .grid { display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 16px; }
        .compactGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .calculator { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 16px; }
        label { color: #aebdc4; display: grid; font-size: 12px; font-weight: 900; gap: 8px; text-transform: uppercase; }
        input, select { background: rgba(255,255,255,.055); border: 1px solid rgba(255,255,255,.14); border-radius: 7px; color: #fff; height: 42px; padding: 0 10px; }
        .scoreGrid { display: grid; gap: 10px; margin-top: 16px; }
        .scoreLine { align-items: center; background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.08); border-radius: 8px; display: flex; justify-content: space-between; padding: 12px; }
        .scoreLine span { color: #aebdc4; text-transform: capitalize; }
        .scoreLine strong { color: #fff; }
        .reason { line-height: 1.6; margin-top: 16px; }
        .alerts { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 16px; }
        button { background: rgba(29,155,255,.12); border: 1px solid rgba(29,155,255,.3); border-radius: 7px; color: #d7efff; cursor: pointer; font-weight: 900; min-height: 38px; }
        textarea { background: rgba(255,255,255,.055); border: 1px solid rgba(255,255,255,.12); border-radius: 8px; color: #fff; min-height: 130px; margin-top: 16px; padding: 12px; resize: vertical; width: 100%; }
        .alert, .notice { border-radius: 8px; font-weight: 850; margin-top: 18px; padding: 14px 16px; }
        .alert { background: rgba(255,92,92,.14); border: 1px solid rgba(255,92,92,.28); color: #ffd8d3; }
        .notice { background: rgba(29,155,255,.12); border: 1px solid rgba(29,155,255,.24); color: #d7efff; }
        .dataWarning { background: rgba(255,153,0,.12); border: 1px solid rgba(255,153,0,.34); border-radius: 8px; color: #ffd7a1; display: grid; gap: 4px; margin-top: 18px; padding: 12px 14px; }
        .dataWarning strong { color: #fff; font-size: 13px; }
        .dataWarning span { color: #ffd7a1; font-size: 13px; line-height: 1.45; }
        .positionBand { align-items: center; background: rgba(8,14,17,.92); border: 1px solid rgba(35,209,139,.22); border-radius: 8px; display: grid; gap: 14px; grid-template-columns: repeat(4,minmax(0,1fr)) auto; margin: 18px auto 0; max-width: 1760px; padding: 16px; }
        .positionBand span { color: #aebdc4; display: block; font-size: 12px; font-weight: 900; text-transform: uppercase; }
        .positionBand strong { color: #fff; display: block; margin-top: 6px; }
        .positionBand a { background: rgba(35,209,139,.12); border: 1px solid rgba(35,209,139,.3); border-radius: 999px; color: #b8f4e6; font-weight: 950; padding: 9px 12px; text-decoration: none; }
        .profit { color: #8ff0c3!important; }
        .loss { color: #ff9a9a!important; }
        footer { font-size: 13px; margin-top: 20px; padding-bottom: 12px; }
        .modalBackdrop { align-items: center; background: rgba(0,0,0,.72); display: flex; inset: 0; justify-content: center; padding: 24px; position: fixed; z-index: 50; }
        .modal { background: #081013; border: 1px solid rgba(255,153,0,.24); border-radius: 8px; box-shadow: 0 30px 120px rgba(0,0,0,.62); display: grid; gap: 16px; max-height: calc(100vh - 48px); max-width: 1000px; overflow: auto; padding: 24px; width: min(100%, 1000px); }
        .modalHeader { align-items: flex-start; display: flex; gap: 18px; justify-content: space-between; }
        .modalHeader span { color: #ffcc8a; display: block; font-size: 12px; font-weight: 950; letter-spacing: .08em; margin-bottom: 5px; text-transform: uppercase; }
        .modalHeader h2 { font-size: 34px; line-height: 1; }
        .modalClose { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.18); color: #fff; min-width: 76px; }
        .recommendationCard { border-radius: 8px; display: grid; gap: 8px; padding: 18px; }
        .recommendationCard strong { color: #fff; font-size: 54px; line-height: 1; }
        .recommendationCard p { color: #f5f7f8; font-size: 18px; font-weight: 850; line-height: 1.35; }
        .recommendationCard.yes { background: rgba(35,209,139,.16); border: 1px solid rgba(35,209,139,.42); }
        .recommendationCard.no { background: rgba(255,153,0,.14); border: 1px solid rgba(255,153,0,.38); }
        .plainPlanGrid { display: grid; gap: 12px; grid-template-columns: repeat(4,minmax(0,1fr)); }
        .technicalDetails { border-top: 1px solid rgba(255,255,255,.1); padding-top: 4px; }
        .technicalDetails summary { color: #d7efff; cursor: pointer; font-weight: 950; min-height: 34px; padding-top: 8px; }
        .technicalDetails[open] summary { margin-bottom: 12px; }
        .modalGrid, .confirmationGrid { display: grid; gap: 12px; grid-template-columns: repeat(3,minmax(0,1fr)); }
        .manualTradeForm { display: grid; gap: 12px; grid-template-columns: repeat(2,minmax(0,1fr)); }
        .confirmationMessage { background: rgba(255,153,0,.1); border: 1px solid rgba(255,153,0,.24); border-radius: 8px; color: #ffd7a1; display: grid; gap: 6px; line-height: 1.45; padding: 12px; }
        .confirmationMessage strong { color: #fff; }
        .modalWarning { background: rgba(255,92,92,.14); border: 1px solid rgba(255,92,92,.3); border-radius: 8px; color: #ffd8d3; display: grid; gap: 5px; padding: 12px; }
        .modalWarning strong { color: #fff; }
        .brokerNotice { background: rgba(255,153,0,.1); border: 1px solid rgba(255,153,0,.24); border-radius: 8px; color: #ffd7a1; font-weight: 850; line-height: 1.45; padding: 12px; }
        .cmcInstructions { background: rgba(29,155,255,.1); border: 1px solid rgba(29,155,255,.26); border-radius: 8px; display: grid; gap: 10px; padding: 14px 16px; }
        .cmcInstructions h3 { margin: 0; }
        .cmcInstructions ol { color: #dcebf2; display: grid; gap: 6px; line-height: 1.45; margin: 0; padding-left: 22px; }
        .riskPreview { background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.08); border-radius: 8px; padding: 14px; }
        .riskPreview span { color: #aebdc4; display: block; font-size: 12px; font-weight: 900; text-transform: uppercase; }
        .riskPreview strong { color: #fff; display: block; font-size: 24px; margin-top: 6px; }
        .riskPreview small { color: #ffd7a1; display: block; margin-top: 6px; }
        .modalActions { display: flex; flex-wrap: wrap; gap: 10px; }
        :global(.signal) { border-radius: 999px; display: inline-flex; font-size: 12px; font-weight: 950; padding: 8px 12px; }
        :global(.signal.strong), :global(.signal.strongBuy), :global(.signal.buy) { background: rgba(35,209,139,.14); border: 1px solid rgba(35,209,139,.38); color: #b8f4e6; }
        :global(.signal.strong), :global(.signal.strongBuy) { background: rgba(34,255,163,.18); border-color: rgba(34,255,163,.55); color: #c8ffe8; }
        :global(.signal.watch) { background: rgba(250,204,21,.14); border: 1px solid rgba(250,204,21,.34); color: #ffe98a; }
        :global(.signal.wait), :global(.signal.holdOff) { background: rgba(255,153,0,.14); border: 1px solid rgba(255,153,0,.38); color: #ffd7a1; }
        :global(.signal.sell), :global(.signal.strongSell) { background: rgba(255,92,92,.14); border: 1px solid rgba(255,92,92,.38); color: #ffc8c8; }
        :global(.signal.noTrade) { background: rgba(255,92,92,.14); border: 1px solid rgba(255,92,92,.38); color: #ffc8c8; }
        :global(.signal.info) { background: rgba(29,155,255,.14); border: 1px solid rgba(29,155,255,.38); color: #d7efff; }
        @media (max-width: 1100px) { .cards, .split, .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 1100px) { .plainPlanGrid, .confirmationGrid { grid-template-columns: repeat(2,minmax(0,1fr)); } }
        @media (max-width: 760px) { .page { padding: 88px 16px 16px; } .cards, .split, .grid, .alerts, .plainPlanGrid, .confirmationGrid { grid-template-columns: 1fr; } .heroMain { align-items: flex-start; flex-direction: column; } .chart { height: 520px; } .modalBackdrop { padding: 12px; } .modal { max-height: calc(100vh - 24px); padding: 18px; } .modalHeader h2 { font-size: 28px; } .recommendationCard strong { font-size: 44px; } }
      `}</style>
    </div>
  );
}

function SignalBadge({ signal }) {
  const normalized = String(signal || "WATCH").toUpperCase();
  const className = normalized.includes("TARGET") ? "strong" : normalized.includes("ACTIVE") ? "buy" : signalClassName(normalized);
  return <span className={`signal ${className}`}>{normalized}</span>;
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FibPlanSaveStatus({ status, signedIn }) {
  if (!signedIn) return <span className="fibSaveStatus offline">Not signed in -- Fib plan is saved to this browser only.</span>;
  if (status === "saving") return <span className="fibSaveStatus saving">Saving...</span>;
  if (status === "saved") return <span className="fibSaveStatus saved">Saved</span>;
  if (status === "error") return <span className="fibSaveStatus error">Save failed -- your changes are kept on screen. Retry by adjusting a level again.</span>;
  return null;
}

TraderCompany.disableLayout = true;
