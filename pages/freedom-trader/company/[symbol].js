import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-trader-unlocked";
const PLANNER_STORAGE_KEY = "freedom-trader-visual-levels";
const CHART_RANGE_STORAGE_KEY = "freedom-trader-chart-ranges";
const FIB_STORAGE_KEY = "freedom-trader-fib-retracements";

const FIB_LEVELS = [
  { key: "0", ratio: 0, label: "0%" },
  { key: "236", ratio: 0.236, label: "23.6%" },
  { key: "382", ratio: 0.382, label: "38.2%" },
  { key: "500", ratio: 0.5, label: "50%" },
  { key: "618", ratio: 0.618, label: "61.8%" },
  { key: "786", ratio: 0.786, label: "78.6%" },
  { key: "1000", ratio: 1, label: "100%" },
];

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
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function formatCurrency(value) {
  return Number.isFinite(value) ? money.format(value) : "--";
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
  };
}

function fibPriceForRatio(drawing, ratio) {
  if (!drawing) return null;
  const low = Number(drawing.anchor1?.price);
  const high = Number(drawing.anchor2?.price);
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  return roundPrice(high - (high - low) * ratio);
}

function levelsComplete(levels) {
  return Number.isFinite(levels?.entry) && Number.isFinite(levels?.target) && Number.isFinite(levels?.stop);
}

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
    confidence: analysis.confidence,
    entry: analysis.setup?.plannedEntry ?? null,
    target: analysis.setup?.target ?? null,
    stop: analysis.setup?.stop ?? null,
    risk: analysis.setup?.riskPerShare ?? null,
    reward: analysis.setup?.rewardPerShare ?? null,
    riskReward: analysis.setup?.riskRewardRatio ?? null,
    suggestedQuantity: analysis.setup?.riskPerShare ? Math.max(1, Math.floor(1000 / analysis.setup.riskPerShare)) : 1,
    maximumRisk: 1000,
    expectedHoldingPeriod: analysis.setup?.expectedHoldingPeriod || analysis.dataStatus?.status || "Waiting for scanner",
    expiresAt: analysis.setup?.setupExpiryDate,
    reasoning: analysis.setup?.setupReasoning || analysis.dataStatus?.status || "Waiting for complete setup inputs.",
    scoreExplanation: analysis.scoreExplanation || {},
    marketData: analysis.marketData,
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

export async function getServerSideProps() {
  const { createHash } = await import("crypto");
  const password = process.env.FREEDOM_TERMINAL_PASSWORD || "freedom123";
  const passwordHash = createHash("sha256").update(`${PASSWORD_SALT}:${password}`).digest("hex");
  return { props: { passwordHash } };
}

export default function TraderCompany({ passwordHash }) {
  const router = useRouter();
  const symbol = String(router.query.symbol || "NVDA").toUpperCase();
  const company = COMPANIES[symbol] || { companyName: symbol, sector: "Trading Watchlist", logoText: symbol.slice(0, 2), primaryColor: "#ff9900", secondaryColor: "#1d9bff" };
  const chartRef = useRef(null);
  const chartNodeRef = useRef(null);
  const chartRangeRef = useRef(null);
  const chartPanRef = useRef({ active: false, startX: 0, startRange: null });
  const visualLevelsRef = useRef({ entry: null, target: null, stop: null });
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
  const [chartError, setChartError] = useState("");
  const [chartMeta, setChartMeta] = useState(null);
  const [openPosition, setOpenPosition] = useState(null);
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [buyForm, setBuyForm] = useState({});
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeDraft, setTradeDraft] = useState(null);
  const [manualBuyForm, setManualBuyForm] = useState(null);
  const [tradeActionSaving, setTradeActionSaving] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [visualLevels, setVisualLevels] = useState({ entry: null, target: null, stop: null });
  const [linePixels, setLinePixels] = useState({ entry: null, target: null, stop: null });
  const [draggingLevel, setDraggingLevel] = useState(null);
  const [chartMode, setChartMode] = useState("pan");
  const [fibDrawing, setFibDrawing] = useState(null);
  const [fibGeometry, setFibGeometry] = useState({ levels: [], bands: [], anchor1: null, anchor2: null, center: null, body: null });
  const [draftFibAnchor, setDraftFibAnchor] = useState(null);
  const [draggingFib, setDraggingFib] = useState(null);
  const [selectedFibLevelKey, setSelectedFibLevelKey] = useState("");

  useEffect(() => {
    visualLevelsRef.current = visualLevels;
  }, [visualLevels]);

  useEffect(() => {
    fibDrawingRef.current = fibDrawing;
  }, [fibDrawing]);

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true");
    setCheckingStorage(false);
  }, []);

  useEffect(() => {
    async function load() {
      if (!unlocked || !symbol) return;
      const tabHidden = typeof document !== "undefined" && document.hidden;
      try {
        setLoading(true);
        setError("");
        setChartError("");
        setChartMeta(null);
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
  const visualMetrics = useMemo(() => {
    if (!levelsComplete(visualLevels)) return { riskReward: null, percentageReturn: null, expectedProfit: null, maximumLoss: null, capitalRequired: null, positionSize: 0, riskLimit: null };
    const riskPerShare = visualLevels.entry - visualLevels.stop;
    const rewardPerShare = visualLevels.target - visualLevels.entry;
    const riskLimit = (Number(portfolioValue) || 0) * ((Number(maxRiskPercent) || 0) / 100);
    const riskSizedShares = riskPerShare > 0 ? Math.max(0, Math.floor(riskLimit / riskPerShare)) : 0;
    const capitalSizedShares = visualLevels.entry > 0 ? Math.max(0, Math.floor((Number(tradingCapital) || 0) / visualLevels.entry)) : 0;
    const positionSize = Math.min(riskSizedShares, capitalSizedShares);
    return {
      riskReward: riskPerShare > 0 ? rewardPerShare / riskPerShare : null,
      percentageReturn: visualLevels.entry > 0 ? (rewardPerShare / visualLevels.entry) * 100 : null,
      expectedProfit: positionSize * rewardPerShare,
      maximumLoss: positionSize * riskPerShare,
      capitalRequired: positionSize * visualLevels.entry,
      positionSize,
      riskLimit,
    };
  }, [maxRiskPercent, portfolioValue, tradingCapital, visualLevels]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(PLANNER_STORAGE_KEY) || "{}");
      const stored = saved?.[symbol];
      setVisualLevels(levelsComplete(stored) ? stored : {
        entry: roundPrice(setup.entry),
        target: roundPrice(setup.target),
        stop: roundPrice(setup.stop),
      });
    } catch {
      setVisualLevels({ entry: roundPrice(setup.entry), target: roundPrice(setup.target), stop: roundPrice(setup.stop) });
    }
  }, [setup.entry, setup.stop, setup.target, symbol]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(FIB_STORAGE_KEY) || "{}");
      setFibDrawing(normalizeFibDrawing(saved?.[fibRangeKey(symbol, timeframe, chartInterval)]));
    } catch {
      setFibDrawing(null);
    }
    setDraftFibAnchor(null);
    setDraggingFib(null);
    setSelectedFibLevelKey("");
  }, [chartInterval, symbol, timeframe]);

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

  function openBuyModal() {
    setSaveMessage("");
    setBuyForm({
      symbol,
      currentPrice: setup.currentPrice || "",
      quantityMode: "1",
      customQuantity: "",
      entryPrice: setup.entry || setup.currentPrice || "",
      targetPrice: setup.target || "",
      stopPrice: setup.stop || "",
      brokerage: 0,
      notes: "",
    });
    setBuyModalOpen(true);
  }

  function buyQuantity() {
    return buyForm.quantityMode === "custom" ? Number(buyForm.customQuantity) : Number(buyForm.quantityMode || 1);
  }

  function buyRiskReward() {
    const entry = Number(buyForm.entryPrice);
    const target = Number(buyForm.targetPrice);
    const stop = Number(buyForm.stopPrice);
    const risk = entry - stop;
    const reward = target - entry;
    return risk > 0 ? reward / risk : null;
  }

  async function recordBuy() {
    const quantity = Math.floor(buyQuantity());
    const entryPrice = Number(buyForm.entryPrice);
    const targetPrice = Number(buyForm.targetPrice);
    const stopPrice = Number(buyForm.stopPrice);
    const rr = buyRiskReward();
    if (quantity < 1 || !entryPrice || entryPrice <= 0 || !targetPrice || targetPrice <= entryPrice || !stopPrice || stopPrice >= entryPrice) {
      setSaveMessage("Enter quantity >= 1, positive entry, target above entry and stop below entry.");
      return;
    }
    if (Number.isFinite(rr) && rr < 2) {
      const confirmed = window.confirm("Risk/reward is below 2:1. Confirm you deliberately want to save this trade anyway.");
      if (!confirmed) return;
    }
    try {
      const response = await fetch("/api/freedom-trader/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          companyName: company.companyName,
          quantity,
          entryPrice,
          targetPrice,
          stopPrice,
          brokerage: Number(buyForm.brokerage || 0),
          notes: buyForm.notes,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Unable to save trade.");
      setSaveMessage("Trade recorded. Target and stop alerts created.");
      window.location.href = "/freedom-trader/positions";
    } catch (err) {
      console.error("Freedom Trader record buy failed:", err);
      setSaveMessage(err.message || "Unable to save trade.");
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
    });
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
      setSaveMessage("Manual buy recorded. Opening positions...");
      window.location.href = "/freedom-trader/positions";
    } catch (error) {
      console.error("Freedom Trader record chart buy failed:", error);
      setSaveMessage(error instanceof Error ? error.message : "Unable to record manual buy right now.");
    } finally {
      setTradeActionSaving("");
    }
  }

  const saveVisualLevels = useCallback((levels) => {
    if (!levelsComplete(levels)) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(PLANNER_STORAGE_KEY) || "{}");
      window.localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify({ ...saved, [symbol]: levels }));
    } catch {}
  }, [symbol]);

  const updateVisualLevel = useCallback((key, value) => {
    const nextValue = roundPrice(value);
    if (!Number.isFinite(nextValue)) return;
    setVisualLevels((current) => {
      const next = { ...current, [key]: nextValue };
      saveVisualLevels(next);
      return next;
    });
  }, [saveVisualLevels]);

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
    return {
      dates: [...candles.map((candle) => candle.date), ...futureDates],
      candles: [
        ...candles.map((candle) => [candle.open, candle.close, candle.low, candle.high]),
        ...futureDates.map(() => ["-", "-", "-", "-"]),
      ],
      volume: [...candles.map((candle) => candle.volume || 0), ...futureDates.map(() => "-")],
      realCount: candles.length,
      futureCount: futureDates.length,
    };
  }, [candles, chartInterval]);

  const chartPointFromEvent = useCallback((event) => {
    const chart = chartRef.current;
    const node = chartNodeRef.current;
    if (!chart || !node || !chartData.dates.length) return null;
    const rect = node.getBoundingClientRect();
    const raw = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [event.clientX - rect.left, event.clientY - rect.top]);
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
      const value = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [date || fallbackDate, price]);
      return Array.isArray(value) ? { x: value[0], y: value[1] } : null;
    };
    const currentVisualLevels = visualLevelsRef.current;
    if (levelsComplete(currentVisualLevels)) {
      const toY = (price) => {
        const value = toPoint(fallbackDate, price);
        return value?.y;
      };
      const next = { entry: toY(currentVisualLevels.entry), target: toY(currentVisualLevels.target), stop: toY(currentVisualLevels.stop) };
      if (Object.values(next).every(Number.isFinite)) setLinePixels(next);
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
    const rawLevels = FIB_LEVELS.map((level) => {
      const price = fibPriceForRatio(drawing, level.ratio);
      const point = toPoint(drawing.anchor2.date, price);
      return point && Number.isFinite(point.y) ? { ...level, price, y: point.y, labelY: point.y } : null;
    }).filter(Boolean);
    const sorted = [...rawLevels].sort((a, b) => a.y - b.y);
    const minGap = 24;
    sorted.forEach((level, index) => {
      if (index > 0) level.labelY = Math.max(level.labelY, sorted[index - 1].labelY + minGap);
    });
    for (let index = sorted.length - 2; index >= 0; index -= 1) {
      sorted[index].labelY = Math.min(sorted[index].labelY, sorted[index + 1].labelY - minGap);
    }
    const bands = FIB_LEVELS.slice(0, -1).map((level, index) => {
      const from = rawLevels.find((item) => item.key === level.key);
      const to = rawLevels.find((item) => item.key === FIB_LEVELS[index + 1].key);
      if (!from || !to) return null;
      return {
        key: `${level.key}-${FIB_LEVELS[index + 1].key}`,
        top: Math.min(from.y, to.y),
        height: Math.max(2, Math.abs(from.y - to.y)),
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
    });
    if (next && (next.anchor1.date !== next.anchor2.date || next.anchor1.price !== next.anchor2.price)) {
      saveFibDrawing(next);
      setFibDrawing(next);
    } else {
      setFibDrawing(null);
    }
    setDraftFibAnchor(null);
    setChartMode("select");
  }, [chartMode, chartPointFromEvent, draftFibAnchor, saveFibDrawing]);

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

  const setTradeLineFromFib = useCallback((lineKey, levelKey) => {
    const level = fibGeometry.levels.find((item) => item.key === levelKey);
    if (!level || !Number.isFinite(level.price)) return;
    updateVisualLevel(lineKey, level.price);
    setSelectedFibLevelKey("");
  }, [fibGeometry.levels, updateVisualLevel]);

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
      if (!chartNodeRef.current || !chartData.realCount) return;
      const echarts = await import("echarts");
      if (disposed) return;
      if (!chartRef.current) chartRef.current = echarts.init(chartNodeRef.current, null, { renderer: "canvas" });
      const totalCount = chartData.dates.length;
      const realCount = chartData.realCount;
      const rangeKey = chartRangeKey(symbol, timeframe, chartInterval);
      if (chartRangeRef.current?.key !== rangeKey) {
        chartRangeRef.current = { key: rangeKey, ...loadSavedChartRange(totalCount, realCount) };
      }
      const visibleRange = clampLogicalRange(chartRangeRef.current, totalCount, realCount, chartInterval);
      chartRangeRef.current = { key: rangeKey, ...visibleRange };
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
          { name: symbol, type: "candlestick", data: chartData.candles, itemStyle: { color: "#23d18b", color0: "#ff5c5c", borderColor: "#23d18b", borderColor0: "#ff5c5c" },
            markLine: { symbol: "none", label: { color: "#d8e5ea" }, lineStyle: { type: "dashed" }, data: [
              Number.isFinite(setup.currentPrice) ? { name: "Current", yAxis: setup.currentPrice, lineStyle: { color: "#eaf2ff", width: 1 } } : null,
            ].filter(Boolean) } },
          { name: "Volume", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: chartData.volume, itemStyle: { color: "rgba(29,155,255,0.45)" } },
        ],
      }, { notMerge: false, lazyUpdate: true });
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
    };
  }, [chartData, chartInterval, loadSavedChartRange, refreshOverlayPixels, setup, symbol, timeframe]);

  const visualOverlayReady = levelsComplete(visualLevels) && Object.values(linePixels).every(Number.isFinite);
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
  const currentBlockers = tradeBlockers();
  const fibVisible = fibDrawing?.visible !== false;
  const fibOverlayReady = fibVisible && fibGeometry.anchor1 && fibGeometry.anchor2 && fibGeometry.body && fibGeometry.levels.length;
  const selectedFibLevel = fibGeometry.levels.find((level) => level.key === selectedFibLevelKey);

  if (checkingStorage) return <div className="boot">Opening Freedom Trader...</div>;
  if (!unlocked) return <PasswordGate passwordHash={passwordHash} onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="page" style={{ "--company-primary": company.primaryColor, "--company-secondary": company.secondaryColor }}>
      <Head><title>{symbol} | Freedom Trader</title></Head>
      <section className="platformBanner" aria-label="Current Freedom workspace">
        <strong><span className="platformIcon" aria-hidden="true">{"\u{1F4CA}"}</span>Freedom Trader</strong>
        <span>Active Trading & Market Opportunities</span>
      </section>
      <header className="hero">
        <nav className="platformSwitch" aria-label="Freedom platform switch">
          <Link href="/freedom">Freedom Investment</Link>
          <Link className="active" href="/freedom-trader">Freedom Trader</Link>
        </nav>
        <Link className="back" href="/freedom-trader">Back to Freedom Trader</Link>
        <div className="heroMain">
          <span className="logo">{company.logoText}</span>
          <div>
            <h1>{company.companyName}</h1>
            <p>{symbol} / {company.sector} / {formatCurrency(setup.currentPrice)}</p>
          </div>
          <SignalBadge signal={tradeStatus} />
        </div>
        <div className="heroActions">
          <button className="primaryAction" type="button" onClick={openTradeConfirmation}>Validate & Create Trade</button>
        </div>
      </header>

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
            <p>Candles, volume, Fibonacci, current price, entry, stop and target.</p>
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
            <span>Drawing</span>
            <button className={chartMode === "pan" ? "active" : ""} type="button" onClick={() => setChartMode("pan")}>Pan</button>
            <button className={chartMode === "fib" ? "active" : ""} type="button" onClick={() => setChartMode("fib")}>Fib Retracement</button>
            <button className={chartMode === "select" ? "active" : ""} type="button" onClick={() => setChartMode("select")}>Select</button>
            <button type="button" onClick={deleteFibDrawing} disabled={!fibDrawing}>Delete</button>
            <button type="button" onClick={() => setFibVisibility(false)} disabled={!fibDrawing || !fibVisible}>Hide Fib</button>
            <button type="button" onClick={() => setFibVisibility(true)} disabled={!fibDrawing || fibVisible}>Show Fib</button>
          </div>
        </div>
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
          {fibOverlayReady ? (
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
                  aria-label={`${level.label} Fibonacci level ${formatCurrency(level.price)}`}
                  className={`fibLevel ${selectedFibLevelKey === level.key ? "selected" : ""}`}
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
                    {level.label} {formatCurrency(level.price)}
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
                  <button type="button" onClick={() => setTradeLineFromFib("entry", selectedFibLevel.key)}>Set as Buy</button>
                  <button type="button" onClick={() => setTradeLineFromFib("stop", selectedFibLevel.key)}>Set as Stop Loss</button>
                  <button type="button" onClick={() => setTradeLineFromFib("target", selectedFibLevel.key)}>Set as Sell</button>
                </div>
              ) : null}
            </div>
          ) : null}
          {chartMode === "fib" ? (
            <div
              className="fibDraftLayer"
              onPointerDown={startFibDraft}
              onPointerMove={moveFibDraft}
              onPointerUp={finishFibDraft}
            />
          ) : null}
          {visualOverlayReady ? (
            <div className="visualPlannerOverlay" aria-label="Visual trade planner">
              <div className="zone profitZone" style={{ top: profitZone.top, height: profitZone.height }} />
              <div className="zone riskZone" style={{ top: riskZone.top, height: riskZone.height }} />
              {[
                { key: "target", label: "SELL", value: visualLevels.target, y: linePixels.target, className: "targetLine" },
                { key: "entry", label: "BUY", value: visualLevels.entry, y: linePixels.entry, className: "entryLine" },
                { key: "stop", label: "STOP LOSS", value: visualLevels.stop, y: linePixels.stop, className: "stopLine" },
              ].map((line) => (
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
          <Metric label="Status" value={tradeStatus} />
          <Metric label="BUY" value={formatCurrency(visualLevels.entry)} />
          <Metric label="STOP LOSS" value={formatCurrency(visualLevels.stop)} />
          <Metric label="SELL" value={formatCurrency(visualLevels.target)} />
          <Metric label="Risk/Reward" value={formatNumber(visualMetrics.riskReward)} />
          <Metric label="Expected Profit" value={formatCurrency(visualMetrics.expectedProfit)} />
          <button type="button" onClick={() => {
            const recommended = { entry: roundPrice(setup.entry), target: roundPrice(setup.target), stop: roundPrice(setup.stop) };
            setVisualLevels(recommended);
            saveVisualLevels(recommended);
          }}>Reset to Recommended Levels</button>
          <button className="primaryAction" type="button" onClick={openTradeConfirmation}>Validate & Create Trade</button>
          {saveMessage ? <p className="inlineNotice">{saveMessage}</p> : null}
        </div>
      </section>

      <footer>Freedom Trader is separate from Freedom Investment. Trading research only. Not financial advice.</footer>

      {tradeModalOpen && tradeDraft ? (
        <div className="modalBackdrop">
          <section className="modal">
            <h2>Validate & Create Trade</h2>
            {tradeDraft.blockers?.length ? (
              <div className="modalWarning">
                <strong>Setup blocked</strong>
                {tradeDraft.blockers.map((blocker) => <span key={blocker}>{blocker}</span>)}
              </div>
            ) : null}
            <div className="confirmationGrid">
              <Metric label="Company" value={tradeDraft.companyName} />
              <Metric label="Order Type" value={tradeDraft.orderType} />
              <Metric label="Current Verified Price" value={formatCurrency(tradeDraft.currentPrice)} />
              <Metric label="Entry Price" value={formatCurrency(tradeDraft.entryPrice)} />
              <Metric label="Stop Loss" value={formatCurrency(tradeDraft.stopPrice)} />
              <Metric label="Target" value={formatCurrency(tradeDraft.targetPrice)} />
              <Metric label="Distance to Entry" value={`${formatCurrency(Math.abs(tradeDraft.distanceToEntry))} / ${formatPercent(Math.abs(tradeDraft.distanceToEntryPercent))}`} />
              <Metric label="Shares" value={`${tradeDraft.quantity || 0}`} />
              <Metric label="Capital" value={formatCurrency(tradeDraft.capitalRequired)} />
              <Metric label="Maximum Loss" value={formatCurrency(tradeDraft.maximumLoss)} />
              <Metric label="Expected Profit" value={formatCurrency(tradeDraft.expectedProfit)} />
              <Metric label="Percentage Return" value={formatPercent(tradeDraft.percentageReturn)} />
              <Metric label="Risk/Reward Ratio" value={formatNumber(tradeDraft.riskRewardRatio)} />
              <Metric label="Holding Time" value={tradeDraft.holdingTime} />
              <Metric label="Status" value={tradeDraft.status} />
            </div>
            <div className="confirmationMessage">
              <strong>{tradeDraft.status}</strong>
              <span>
                Current price is {formatCurrency(tradeDraft.currentPrice)}. Your planned entry is {formatCurrency(tradeDraft.entryPrice)}.
                {" "}The price is {formatCurrency(Math.abs(tradeDraft.distanceToEntry))} {tradeDraft.distanceToEntry > 0 ? "above" : "below"} entry.
                {" "}{tradeDraft.status === "BUY NOW" ? "The chart setup is at or below the planned entry." : "Wait for the pullback before buying."}
              </span>
            </div>
            <p className="brokerNotice">Freedom Trader does not execute broker orders. Record Buy is only available after you manually confirm the broker order was placed.</p>
            {manualBuyForm ? (
              <div className="manualTradeForm">
                <label>Actual purchase price<input value={manualBuyForm.actualPurchasePrice} onChange={(event) => setManualBuyForm((current) => ({ ...current, actualPurchasePrice: event.target.value }))} type="number" /></label>
                <label>Shares purchased<input value={manualBuyForm.sharesPurchased} onChange={(event) => setManualBuyForm((current) => ({ ...current, sharesPurchased: event.target.value }))} type="number" /></label>
                <label>Brokerage cost<input value={manualBuyForm.brokerageCost} onChange={(event) => setManualBuyForm((current) => ({ ...current, brokerageCost: event.target.value }))} type="number" /></label>
                <label>Purchase date and time<input value={manualBuyForm.purchaseDateTime} onChange={(event) => setManualBuyForm((current) => ({ ...current, purchaseDateTime: event.target.value }))} type="datetime-local" /></label>
              </div>
            ) : null}
            <div className="modalActions">
              <button type="button" onClick={() => saveTradeSetup()} disabled={tradeActionSaving || tradeDraft.blockers?.length}>{tradeActionSaving === "setup" ? "Saving..." : "Save Trade Setup"}</button>
              <button type="button" onClick={() => createAllAlerts()} disabled={tradeActionSaving || tradeDraft.blockers?.length}>{tradeActionSaving === "alerts" ? "Creating..." : "Create All Alerts"}</button>
              <button className="primaryAction" type="button" onClick={manualBuyForm ? recordTradeDraftBuy : startManualBuy} disabled={tradeActionSaving || tradeDraft.blockers?.length}>{tradeActionSaving === "buy" ? "Recording..." : "Record Manual Buy"}</button>
              <button type="button" onClick={() => setTradeModalOpen(false)}>Cancel</button>
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
        .heroActions button { background: rgba(29,155,255,.14); border: 1px solid rgba(29,155,255,.34); color: #d7efff; padding: 0 13px; }
        .heroActions .primaryAction, .primaryAction { background: #ff9900; border-color: #ff9900; color: #061014; }
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
        .fibLabel { background: rgba(5,8,11,.9); border: 1px solid rgba(255,255,255,.18); border-radius: 6px; color: #f8fbff; font-size: 12px; font-weight: 950; left: 0; line-height: 1; padding: 5px 7px; position: absolute; transform: translate(-100%, -50%); white-space: nowrap; }
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
        .plannerLine.dragging span, .plannerLine.dragging strong { box-shadow: 0 0 0 3px rgba(255,255,255,.18), 0 12px 30px rgba(0,0,0,.35); }
        .visualPlannerPanel { border-top: 1px solid rgba(255,255,255,.08); display: grid; gap: 12px; grid-template-columns: repeat(5,minmax(0,1fr)) repeat(3,minmax(120px,.65fr)); padding: 16px; }
        .visualPlannerPanel button { min-height: 44px; padding: 0 12px; }
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
        .modal { background: #081013; border: 1px solid rgba(255,153,0,.24); border-radius: 8px; box-shadow: 0 30px 120px rgba(0,0,0,.62); display: grid; gap: 14px; max-height: calc(100vh - 48px); max-width: 720px; overflow: auto; padding: 22px; width: 100%; }
        .modalGrid, .confirmationGrid { display: grid; gap: 12px; grid-template-columns: repeat(2,minmax(0,1fr)); }
        .manualTradeForm { display: grid; gap: 12px; grid-template-columns: repeat(2,minmax(0,1fr)); }
        .confirmationMessage { background: rgba(255,153,0,.1); border: 1px solid rgba(255,153,0,.24); border-radius: 8px; color: #ffd7a1; display: grid; gap: 6px; line-height: 1.45; padding: 12px; }
        .confirmationMessage strong { color: #fff; }
        .modalWarning { background: rgba(255,92,92,.14); border: 1px solid rgba(255,92,92,.3); border-radius: 8px; color: #ffd8d3; display: grid; gap: 5px; padding: 12px; }
        .modalWarning strong { color: #fff; }
        .brokerNotice { background: rgba(255,153,0,.1); border: 1px solid rgba(255,153,0,.24); border-radius: 8px; color: #ffd7a1; font-weight: 850; line-height: 1.45; padding: 12px; }
        .riskPreview { background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.08); border-radius: 8px; padding: 14px; }
        .riskPreview span { color: #aebdc4; display: block; font-size: 12px; font-weight: 900; text-transform: uppercase; }
        .riskPreview strong { color: #fff; display: block; font-size: 24px; margin-top: 6px; }
        .riskPreview small { color: #ffd7a1; display: block; margin-top: 6px; }
        .modalActions { display: flex; gap: 10px; }
        :global(.signal) { border-radius: 999px; display: inline-flex; font-size: 12px; font-weight: 950; padding: 8px 12px; }
        :global(.signal.strong), :global(.signal.buy) { background: rgba(35,209,139,.14); border: 1px solid rgba(35,209,139,.38); color: #b8f4e6; }
        :global(.signal.strong) { background: rgba(34,255,163,.18); border-color: rgba(34,255,163,.55); color: #c8ffe8; }
        :global(.signal.watch) { background: rgba(250,204,21,.14); border: 1px solid rgba(250,204,21,.34); color: #ffe98a; }
        :global(.signal.wait) { background: rgba(255,153,0,.14); border: 1px solid rgba(255,153,0,.38); color: #ffd7a1; }
        :global(.signal.noTrade) { background: rgba(255,92,92,.14); border: 1px solid rgba(255,92,92,.38); color: #ffc8c8; }
        :global(.signal.info) { background: rgba(29,155,255,.14); border: 1px solid rgba(29,155,255,.38); color: #d7efff; }
        @media (max-width: 1100px) { .cards, .split, .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 760px) { .page { padding: 88px 16px 16px; } .cards, .split, .grid, .alerts { grid-template-columns: 1fr; } .heroMain { align-items: flex-start; flex-direction: column; } .chart { height: 520px; } }
      `}</style>
    </div>
  );
}

function SignalBadge({ signal }) {
  const normalized = String(signal || "WATCH").toUpperCase();
  const className = normalized.includes("TARGET") ? "strong" : normalized.includes("ACTIVE") ? "buy" : normalized.includes("BUY") ? "buy" : normalized.includes("WAIT") ? "wait" : normalized.includes("STOP") || normalized === "NO TRADE" ? "noTrade" : normalized === "INFO" ? "info" : "watch";
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

TraderCompany.disableLayout = true;
