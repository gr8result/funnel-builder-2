import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-trader-unlocked";
const PLANNER_STORAGE_KEY = "freedom-trader-visual-levels";
const SCANNER_WATCHLIST_KEY = "freedom-trader-scanner-watchlist";

const WATCHLISTS = {
  "High Volatility": ["TSLA", "NVDA", "AMD", "COIN", "MSTR", "SMCI"],
  Momentum: ["NVDA", "AVGO", "META", "PLTR", "AMZN"],
  Breakouts: ["NVDA", "AMD", "PLTR", "AVGO", "SMCI"],
  Oversold: ["TSLA", "AMZN", "META", "COIN"],
  "High Volume": ["NVDA", "AMD", "TSLA", "AMZN", "PLTR"],
  "Earnings Plays": ["NVDA", "AMD", "AMZN", "META", "AVGO"],
};

const LEFT_NAV_ITEMS = [
  { label: "Dashboard", href: "#dashboard" },
  { label: "Watchlist", href: "#watchlist" },
  { label: "Trade Setups", href: "#trade-setups" },
  { label: "Market Opportunities", href: "/freedom-trader/market-opportunities" },
  { label: "Open Positions", href: "/freedom-trader/positions" },
  { label: "Closed Trades", href: "#closed-trades" },
  { label: "Performance", href: "#performance" },
  { label: "Alerts", href: "/freedom-trader/alerts" },
  { label: "Settings", href: "/freedom-trader/settings" },
];

const TRADING_UNIVERSE = [
  { symbol: "NVDA", companyName: "NVIDIA", sector: "Semiconductors" },
  { symbol: "AMD", companyName: "Advanced Micro Devices", sector: "Semiconductors" },
  { symbol: "TSLA", companyName: "Tesla", sector: "EV & Energy" },
  { symbol: "PLTR", companyName: "Palantir", sector: "AI Software" },
  { symbol: "AVGO", companyName: "Broadcom", sector: "Semiconductors" },
  { symbol: "AMZN", companyName: "Amazon", sector: "Cloud & E-commerce" },
  { symbol: "META", companyName: "Meta Platforms", sector: "Digital Advertising & AI" },
  { symbol: "COIN", companyName: "Coinbase", sector: "Crypto Infrastructure" },
  { symbol: "MSTR", companyName: "MicroStrategy", sector: "Bitcoin Treasury" },
  { symbol: "SMCI", companyName: "Super Micro Computer", sector: "AI Infrastructure" },
];

const TIMEFRAMES = [
  { label: "1D", range: "1d", days: 1 },
  { label: "5D", range: "5d", days: 5 },
  { label: "1M", range: "1mo", days: 31 },
  { label: "3M", range: "3mo", days: 93 },
  { label: "6M", range: "6mo", days: 186 },
  { label: "1Y", range: "1y", days: 370 },
  { label: "3Y", range: "3y", days: 1110 },
  { label: "5Y", range: "5y", days: 1850 },
];

const CHART_INTERVALS = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "30m", value: "30m" },
  { label: "1h", value: "1h" },
  { label: "1D", value: "1d" },
];

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

function roundPrice(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
}

function formatDistanceText(currentPrice, plannedEntry) {
  if (!Number.isFinite(currentPrice) || !Number.isFinite(plannedEntry)) return "--";
  const distance = currentPrice - plannedEntry;
  if (Math.abs(distance) < 0.005) return "At planned entry";
  return `${formatCurrency(Math.abs(distance))} ${distance > 0 ? "above" : "below"} entry`;
}

function formatDistancePercent(currentPrice, plannedEntry) {
  if (!Number.isFinite(currentPrice) || !Number.isFinite(plannedEntry) || plannedEntry === 0) return "--";
  const distance = currentPrice - plannedEntry;
  if (Math.abs(distance) < 0.005) return "At planned entry";
  return `${((Math.abs(distance) / plannedEntry) * 100).toFixed(1)}% ${distance > 0 ? "above" : "below"} entry`;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

async function browserHashPassword(password) {
  const bytes = new TextEncoder().encode(`${PASSWORD_SALT}:${password}`);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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

function calculateRsi(closes, period = 14) {
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

function calculateRsiSeries(closes, period = 14) {
  return closes.map((_, index) => {
    if (index < period) return null;
    return calculateRsi(closes.slice(0, index + 1), period);
  });
}

function calculateMacd(closes) {
  if (closes.length < 35) return { macd: null, signal: null, histogram: null };
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = closes.map((_, index) => ema12[index] - ema26[index]);
  const signalLine = ema(macdLine, 9);
  const latest = macdLine.length - 1;
  return {
    macd: macdLine[latest],
    signal: signalLine[latest],
    histogram: macdLine[latest] - signalLine[latest],
    macdLine,
    signalLine,
  };
}

function average(values) {
  const clean = values.filter(Number.isFinite);
  return clean.length ? clean.reduce((total, value) => total + value, 0) / clean.length : null;
}

function classifyTrend(currentPrice, closes, ma20, ma50, ma200) {
  const last20 = ma20[ma20.length - 1];
  const last50 = ma50[ma50.length - 1];
  const last200 = ma200[ma200.length - 1];
  const prior = closes[Math.max(0, closes.length - 21)];
  const oneMonthReturn = prior ? ((currentPrice - prior) / prior) * 100 : 0;
  if (currentPrice > last20 && currentPrice > last50 && currentPrice > last200 && last20 > last50 && last50 > last200) return "Strong Uptrend";
  if (currentPrice > last50 && oneMonthReturn > 0) return "Uptrend";
  if (currentPrice < last20 && currentPrice < last50 && currentPrice < last200 && last20 < last50 && last50 < last200) return "Strong Downtrend";
  if (currentPrice < last50 && oneMonthReturn < 0) return "Downtrend";
  return "Sideways";
}

function signalFromScore(score, trend, rsi, currentPrice, stopLoss) {
  if (Number.isFinite(stopLoss) && currentPrice <= stopLoss) return "NO TRADE";
  if (score >= 90 && !trend.toLowerCase().includes("down") && rsi < 72) return "STRONG SETUP";
  if (score >= 80 && rsi < 76) return "BUY SETUP";
  if (score >= 70) return "WATCH";
  if (score >= 60) return "WAIT";
  return "NO TRADE";
}

function displayPlannedEntry(row) {
  if (row?.symbol === "AVGO") return 363.95;
  return Number.isFinite(row?.entry) ? row.entry : null;
}

function recommendedLevelsFor(row) {
  const entry = displayPlannedEntry(row);
  return {
    entry: Number.isFinite(entry) ? roundPrice(entry) : null,
    target: Number.isFinite(row?.target) ? roundPrice(row.target) : null,
    stop: Number.isFinite(row?.stopLoss) ? roundPrice(row.stopLoss) : null,
  };
}

function levelsComplete(levels) {
  return Number.isFinite(levels?.entry) && Number.isFinite(levels?.target) && Number.isFinite(levels?.stop);
}

function calculateVisualPlannerMetrics(levels) {
  const totalPortfolio = 100000;
  const maxRisk = totalPortfolio * 0.01;
  if (!levelsComplete(levels)) {
    return {
      totalPortfolio,
      maxRisk,
      riskPerShare: null,
      rewardPerShare: null,
      riskReward: null,
      percentageReturn: null,
      expectedProfit: null,
      maximumLoss: null,
      positionSize: 0,
      positionValue: null,
    };
  }
  const riskPerShare = levels.entry - levels.stop;
  const rewardPerShare = levels.target - levels.entry;
  const sharesByRisk = riskPerShare > 0 ? Math.floor(maxRisk / riskPerShare) : 0;
  const sharesByAllocation = levels.entry > 0 ? Math.floor((totalPortfolio * 0.1) / levels.entry) : 0;
  const positionSize = Math.max(0, Math.min(sharesByRisk, sharesByAllocation));
  return {
    totalPortfolio,
    maxRisk,
    riskPerShare,
    rewardPerShare,
    riskReward: riskPerShare > 0 ? rewardPerShare / riskPerShare : null,
    percentageReturn: levels.entry > 0 ? (rewardPerShare / levels.entry) * 100 : null,
    expectedProfit: rewardPerShare * positionSize,
    maximumLoss: riskPerShare * positionSize,
    positionSize,
    positionValue: levels.entry * positionSize,
  };
}

function isStrongSetup(row) {
  const status = String(row?.status || "").toUpperCase();
  return status === "STRONG SETUP" || status === "BUY SETUP";
}

function actionSignal(row) {
  const status = String(row?.status || "").toUpperCase();
  const plannedEntry = displayPlannedEntry(row);
  const currentPrice = Number(row?.currentPrice);
  if (status === "NO TRADE") return "NO TRADE";
  if (row?.symbol === "AVGO" && Number.isFinite(currentPrice) && Number.isFinite(plannedEntry)) {
    return currentPrice <= plannedEntry ? "BUY NOW" : `WAIT FOR ENTRY — ${formatCurrency(plannedEntry)}`;
  }
  if (isStrongSetup(row)) {
    if (Number.isFinite(currentPrice) && Number.isFinite(plannedEntry)) {
      return currentPrice <= plannedEntry ? "BUY NOW" : `WAIT FOR ENTRY — ${formatCurrency(plannedEntry)}`;
    }
    return "WATCH";
  }
  if (status === "WATCH" || status === "WAIT" || status === "INFO") return "WATCH";
  return "NO TRADE";
}

function resultLabel(value, strong = 80, developing = 60) {
  if (!Number.isFinite(value)) return "Not enough data";
  if (value >= strong) return `Strong (${formatNumber(value)}/100)`;
  if (value >= developing) return `Developing (${formatNumber(value)}/100)`;
  return `Weak (${formatNumber(value)}/100)`;
}

function finalActionText(row) {
  if (row?.symbol === "AVGO") return "Wait for the price to pull back to the approved entry zone before buying.";
  const signal = actionSignal(row);
  if (signal === "BUY NOW") return "Price is inside the approved entry zone; review the trade plan before buying.";
  if (signal.startsWith("WAIT FOR ENTRY")) return "Wait for the price to pull back to the approved entry zone before buying.";
  if (signal === "WATCH") return "Keep watching until the setup reaches the rules for an approved entry.";
  return "Do not place a trade unless the setup returns inside the rules.";
}

function analyzeTrade(base, quote = {}, candles = []) {
  const cleanCandles = candles.filter((candle) =>
    ["open", "high", "low", "close"].every((key) => Number.isFinite(candle[key]))
  );
  const closes = cleanCandles.map((candle) => candle.close);
  const highs = cleanCandles.map((candle) => candle.high);
  const lows = cleanCandles.map((candle) => candle.low);
  const volumes = cleanCandles.map((candle) => candle.volume || 0);
  const latestCandle = cleanCandles[cleanCandles.length - 1] || {};
  const currentPrice = Number.isFinite(quote.currentPrice) ? quote.currentPrice : latestCandle.close;
  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);
  const ma200 = sma(closes, 200);
  const last20 = ma20[ma20.length - 1];
  const last50 = ma50[ma50.length - 1];
  const last200 = ma200[ma200.length - 1];
  const rsi = calculateRsi(closes);
  const macd = calculateMacd(closes);
  const recent = cleanCandles.slice(-30);
  const support = recent.length ? Math.min(...recent.map((candle) => candle.low)) : null;
  const resistance = recent.length ? Math.max(...recent.map((candle) => candle.high)) : null;
  const volatility = average(cleanCandles.slice(-20).map((candle) => ((candle.high - candle.low) / candle.close) * 100));
  const volumeAverage = average(volumes.slice(-20));
  const latestVolume = volumes[volumes.length - 1];
  const volumeRatio = volumeAverage ? latestVolume / volumeAverage : null;
  const trend = Number.isFinite(currentPrice) && closes.length ? classifyTrend(currentPrice, closes, ma20, ma50, ma200) : "Unknown";
  const oneMonthAgo = closes[Math.max(0, closes.length - 21)];
  const momentumReturn = oneMonthAgo ? ((currentPrice - oneMonthAgo) / oneMonthAgo) * 100 : 0;
  const distanceToSupport = support ? ((currentPrice - support) / currentPrice) * 100 : null;
  const distanceToResistance = resistance ? ((resistance - currentPrice) / currentPrice) * 100 : null;

  const trendScore = clamp(
    (currentPrice > last20 ? 25 : 5) +
      (currentPrice > last50 ? 35 : 8) +
      (currentPrice > last200 ? 25 : 8) +
      (last20 > last50 ? 15 : 0)
  );
  const momentumScore = clamp(50 + momentumReturn * 3 + (macd.histogram || 0) * 12);
  const volumeScore = clamp(volumeRatio ? 45 + volumeRatio * 25 : 45);
  const volatilityScore = clamp(volatility ? 100 - Math.abs(volatility - 4.2) * 14 : 45);
  const supportScore = clamp(distanceToSupport && distanceToResistance ? 80 - distanceToSupport * 2 + distanceToResistance * 1.6 : 45);
  const technicalScore = clamp((rsi ? 100 - Math.abs(rsi - 55) * 2.1 : 45) + (macd.histogram > 0 ? 12 : -6));
  const tradingScore = Math.round(
    trendScore * 0.2 +
      momentumScore * 0.2 +
      volumeScore * 0.15 +
      volatilityScore * 0.15 +
      supportScore * 0.15 +
      technicalScore * 0.15
  );

  const entry = Number.isFinite(currentPrice) ? currentPrice : null;
  const stopLoss = support && entry ? Math.min(entry * 0.97, support * 0.985) : entry ? entry * 0.94 : null;
  const rawRisk = entry && stopLoss ? entry - stopLoss : null;
  const targetFromResistance = resistance && resistance > entry ? resistance * 0.995 : null;
  const target = entry && rawRisk ? Math.max(targetFromResistance || 0, entry + rawRisk * 2.4) : null;
  const reward = target && entry ? target - entry : null;
  const riskReward = rawRisk && reward ? reward / rawRisk : null;
  const expectedSwing = entry && target ? ((target - entry) / entry) * 100 : null;
  const probability = clamp(42 + tradingScore * 0.55 + (riskReward || 0) * 4 - (rsi > 75 ? 8 : 0));
  const expectedHoldingTime = tradingScore >= 85 ? "2 days - 1 week" : tradingScore >= 72 ? "1 - 2 weeks" : "2 weeks - 1 month";
  const status = signalFromScore(tradingScore, trend, rsi || 50, currentPrice, stopLoss);
  const gap = Number.isFinite(quote.open) && Number.isFinite(quote.previousClose) ? ((quote.open - quote.previousClose) / quote.previousClose) * 100 : null;

  return {
    ...base,
    ...quote,
    candles: cleanCandles,
    currentPrice,
    tradingScore,
    trend,
    support,
    resistance,
    volatility,
    rsi,
    macd: macd.histogram,
    volume: latestVolume,
    volumeRatio,
    expectedSwing,
    entry,
    stopLoss,
    target,
    risk: rawRisk,
    reward,
    riskReward,
    status,
    probability,
    expectedHoldingTime,
    gap,
    ma20: last20,
    ma50: last50,
    ma200: last200,
    components: { trendScore, momentumScore, volumeScore, volatilityScore, supportScore, technicalScore },
  };
}

function mapApiAnalysisToRow(item) {
  return {
    symbol: item.symbol,
    companyName: item.companyName,
    sector: item.sector,
    currentPrice: item.currentPrice,
    previousClose: item.previousClose,
    change: item.change,
    changePercent: item.changePercent,
    tradingScore: item.tradingScore,
    trend: item.trend || item.dataStatus?.status || "Waiting for scanner",
    support: item.indicators?.support ?? null,
    resistance: item.indicators?.resistance ?? null,
    volatility: item.indicators?.volatility20 ?? null,
    rsi: item.indicators?.rsi14 ?? null,
    macd: item.indicators?.macdHistogram ?? null,
    macdSignal: item.indicators?.macdSignal ?? null,
    volume: item.volume,
    volumeRatio: item.indicators?.relativeVolume ?? null,
    expectedSwing: Number.isFinite(item.setup?.plannedEntry) && Number.isFinite(item.setup?.target)
      ? ((item.setup.target - item.setup.plannedEntry) / item.setup.plannedEntry) * 100
      : null,
    entry: item.setup?.plannedEntry ?? null,
    stopLoss: item.setup?.stop ?? null,
    target: item.setup?.target ?? null,
    risk: item.setup?.riskPerShare ?? null,
    reward: item.setup?.rewardPerShare ?? null,
    riskReward: item.setup?.riskRewardRatio ?? null,
    status: item.status || "INFO",
    probability: item.confidence,
    expectedHoldingTime: item.setup?.expectedHoldingPeriod || item.dataStatus?.status || "Waiting for scanner",
    gap: null,
    ma20: item.indicators?.ma20 ?? null,
    ma50: item.indicators?.ma50 ?? null,
    ma200: item.indicators?.ma200 ?? null,
    components: {
      trendScore: item.scoreExplanation?.trendStrength?.score ?? null,
      momentumScore: item.scoreExplanation?.momentum?.score ?? null,
      volumeScore: item.scoreExplanation?.volumeConfirmation?.score ?? null,
      volatilityScore: item.scoreExplanation?.volatilitySuitability?.score ?? null,
      supportScore: item.scoreExplanation?.supportResistanceSetup?.score ?? null,
      technicalScore: item.scoreExplanation?.technicalIndicators?.score ?? null,
    },
    setupReasoning: item.setup?.setupReasoning,
    marketData: item.marketData,
    dataStatus: item.dataStatus,
    error: item.error,
  };
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
        <title>Freedom Trader</title>
      </Head>
      <form className="gate" onSubmit={unlock}>
        <span>Private Trading Workspace</span>
        <h1>Freedom Trader</h1>
        <p>Private swing-trading and trade-alert platform.</p>
        <input onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" value={password} />
        {passwordError ? <small>{passwordError}</small> : null}
        <button type="submit">Unlock Trader</button>
      </form>
      <style jsx>{`
        .gateScreen {
          align-items: center;
          background: #05080b;
          color: #f6f8f9;
          display: flex;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          justify-content: center;
          min-height: 100vh;
          padding: 24px;
        }
        .gate {
          background: rgba(8, 14, 17, 0.95);
          border: 1px solid rgba(255, 153, 0, 0.24);
          border-radius: 8px;
          box-shadow: 0 30px 100px rgba(0, 0, 0, 0.45);
          max-width: 460px;
          padding: 34px;
          width: 100%;
        }
        span {
          color: #5ebdff;
          display: block;
          font-size: 12px;
          font-weight: 950;
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
          background: #ff9900;
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

export async function getServerSideProps() {
  const { createHash } = await import("crypto");
  const password = process.env.FREEDOM_TERMINAL_PASSWORD || "freedom123";
  const passwordHash = createHash("sha256").update(`${PASSWORD_SALT}:${password}`).digest("hex");
  return { props: { passwordHash } };
}

export default function FreedomTrader({ passwordHash }) {
  const chartNodeRef = useRef(null);
  const chartRef = useRef(null);
  const [unlocked, setUnlocked] = useState(false);
  const [checkingStorage, setCheckingStorage] = useState(true);
  const [activeWatchlist, setActiveWatchlist] = useState("Momentum");
  const [selectedSymbol, setSelectedSymbol] = useState("AVGO");
  const [rows, setRows] = useState(TRADING_UNIVERSE.map((item) => analyzeTrade(item)));
  const [chartCandles, setChartCandles] = useState([]);
  const [timeframe, setTimeframe] = useState("1D");
  const [chartInterval, setChartInterval] = useState("1m");
  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState("");
  const [chartError, setChartError] = useState("");
  const [chartMeta, setChartMeta] = useState(null);
  const [showVolume, setShowVolume] = useState(true);
  const [showAverages, setShowAverages] = useState(true);
  const [updatedAt, setUpdatedAt] = useState("");
  const [positions, setPositions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [entryAlertSaving, setEntryAlertSaving] = useState(false);
  const [entryAlertMessage, setEntryAlertMessage] = useState("");
  const [savedPlannerLevels, setSavedPlannerLevels] = useState({});
  const [visualLevels, setVisualLevels] = useState({ entry: null, target: null, stop: null });
  const [linePixels, setLinePixels] = useState({ entry: null, target: null, stop: null });
  const [draggingLevel, setDraggingLevel] = useState(null);
  const [activateSaving, setActivateSaving] = useState(false);
  const [tradePlannerMessage, setTradePlannerMessage] = useState("");
  const [scannerWatchlist, setScannerWatchlist] = useState([]);

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true");
    setCheckingStorage(false);
  }, []);

  useEffect(() => {
    try {
      const scannerItems = JSON.parse(window.localStorage.getItem(SCANNER_WATCHLIST_KEY) || "[]");
      setScannerWatchlist(Array.isArray(scannerItems) ? scannerItems : []);
    } catch {
      setScannerWatchlist([]);
    }
  }, []);

  const tradingUniverse = useMemo(() => {
    const map = new Map(TRADING_UNIVERSE.map((item) => [item.symbol, item]));
    scannerWatchlist.forEach((item) => {
      if (item?.symbol && !map.has(item.symbol)) {
        map.set(item.symbol, {
          symbol: item.symbol,
          companyName: item.companyName || item.symbol,
          sector: item.sector || "Scanner Find",
        });
      }
    });
    return Array.from(map.values());
  }, [scannerWatchlist]);

  const watchlists = useMemo(() => {
    const scannerSymbols = scannerWatchlist.map((item) => item.symbol).filter(Boolean);
    return scannerSymbols.length ? { ...WATCHLISTS, "Scanner Finds": scannerSymbols } : WATCHLISTS;
  }, [scannerWatchlist]);

  const visibleRows = useMemo(
    () => {
      const visibleSymbols = watchlists[activeWatchlist] || [];
      return rows.filter((row) => visibleSymbols.includes(row.symbol)).sort((a, b) => (b.tradingScore || 0) - (a.tradingScore || 0));
    },
    [activeWatchlist, rows, watchlists]
  );
  const selected = rows.find((row) => row.symbol === selectedSymbol) || rows[0];
  const visualMetrics = useMemo(() => calculateVisualPlannerMetrics(visualLevels), [visualLevels]);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(PLANNER_STORAGE_KEY) || "{}");
      setSavedPlannerLevels(stored && typeof stored === "object" ? stored : {});
    } catch {
      setSavedPlannerLevels({});
    }
  }, []);

  useEffect(() => {
    const saved = savedPlannerLevels[selectedSymbol];
    const recommended = recommendedLevelsFor(selected);
    setVisualLevels(levelsComplete(saved) ? saved : recommended);
    setTradePlannerMessage("");
    setEntryAlertMessage("");
  }, [savedPlannerLevels, selected, selectedSymbol]);

  const saveVisualLevelsForSymbol = useCallback((symbol, levels) => {
    if (!symbol || !levelsComplete(levels)) return;
    setSavedPlannerLevels((current) => {
      const next = { ...current, [symbol]: levels };
      try {
        window.localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const updateVisualLevel = useCallback((key, value) => {
    const nextValue = roundPrice(value);
    if (!Number.isFinite(nextValue)) return;
    setVisualLevels((current) => {
      const next = { ...current, [key]: nextValue };
      saveVisualLevelsForSymbol(selectedSymbol, next);
      return next;
    });
  }, [saveVisualLevelsForSymbol, selectedSymbol]);

  function resetVisualLevels() {
    const recommended = recommendedLevelsFor(selected);
    setVisualLevels(recommended);
    saveVisualLevelsForSymbol(selectedSymbol, recommended);
    setTradePlannerMessage("Recommended entry, target and stop restored.");
  }

  async function loadTradingData() {
    try {
      setLoading(true);
      setError("");
      const symbols = selectedSymbol;
      const response = await fetch(`/api/freedom-trader/analysis?symbols=${symbols}`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.analysis) throw new Error(data?.error || "Trading analysis is temporarily unavailable.");
      const analysedRows = data.analysis.map(mapApiAnalysisToRow);
      const returned = new Set(analysedRows.map((row) => row.symbol));
      const missingRows = tradingUniverse.filter((item) => !returned.has(item.symbol)).map((item) => ({
        ...item,
        tradingScore: null,
        trend: "Waiting for scanner",
        status: "INFO",
        dataStatus: { status: "Waiting for scanner", actualCandleCount: 0 },
        error: "Waiting for scanner",
      }));
      setRows([...analysedRows, ...missingRows]);
      const [positionsResponse, alertsResponse] = await Promise.all([
        fetch("/api/freedom-trader/positions"),
        fetch("/api/freedom-trader/alerts"),
      ]);
      const positionsData = await positionsResponse.json().catch(() => null);
      const alertsData = await alertsResponse.json().catch(() => null);
      setPositions(positionsData?.positions || []);
      setAlerts(alertsData?.alerts || []);
      setUpdatedAt(new Date().toISOString());
    } catch (err) {
      console.error("Freedom Trader load failed:", err);
      setError(err.message || "Trading data is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  async function loadChart(symbol, frameLabel, intervalValue) {
    if (typeof document !== "undefined" && document.hidden) return;
    const frame = TIMEFRAMES.find((item) => item.label === frameLabel) || TIMEFRAMES[4];
    try {
      setChartLoading(true);
      setChartError("");
      setChartMeta(null);
      const response = await fetch(`/api/freedom-trader/history?symbol=${symbol}&range=${frame.range}&interval=${intervalValue || "1d"}`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Historical data temporarily unavailable.");
      setChartCandles(data.candles || []);
      setChartMeta(data);
    } catch (err) {
      console.error("Freedom Trader chart load failed:", err);
      setChartCandles([]);
      setChartMeta(null);
      setChartError(err.message || "Historical data temporarily unavailable.");
    } finally {
      setChartLoading(false);
    }
  }

  useEffect(() => {
    if (unlocked) loadTradingData();
  }, [unlocked, selectedSymbol, tradingUniverse]);

  useEffect(() => {
    if (unlocked && selectedSymbol) loadChart(selectedSymbol, timeframe, chartInterval);
  }, [unlocked, selectedSymbol, timeframe, chartInterval]);

  useEffect(() => {
    if (!unlocked || !selectedSymbol) return undefined;
    function handleVisibilityChange() {
      if (!document.hidden) loadChart(selectedSymbol, timeframe, chartInterval);
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [unlocked, selectedSymbol, timeframe, chartInterval]);

  const chartData = useMemo(() => {
    const closes = chartCandles.map((candle) => candle.close);
    const futureSlots = Math.max(16, Math.min(80, Math.ceil(chartCandles.length * 0.16)));
    const futureDates = Array.from({ length: futureSlots }, (_, index) => `Future ${index + 1}`);
    const dates = [...chartCandles.map((candle) => candle.date), ...futureDates];
    return {
      dates,
      candles: [...chartCandles.map((candle) => [candle.date, candle.open, candle.close, candle.low, candle.high]), ...futureDates.map((date) => [date, "-", "-", "-", "-"])],
      volume: [...chartCandles.map((candle) => [candle.date, candle.volume || 0, candle.close >= candle.open ? 1 : -1]), ...futureDates.map((date) => [date, "-", 0])],
      ma20: sma(closes, 20).map((value, index) => [chartCandles[index]?.date, value]).filter((item) => Number.isFinite(item[1])),
      ma50: sma(closes, 50).map((value, index) => [chartCandles[index]?.date, value]).filter((item) => Number.isFinite(item[1])),
      ma200: sma(closes, 200).map((value, index) => [chartCandles[index]?.date, value]).filter((item) => Number.isFinite(item[1])),
      rsi: calculateRsiSeries(closes).map((value, index) => [chartCandles[index]?.date, value]).filter((item) => Number.isFinite(item[1])),
    };
  }, [chartCandles]);

  const dashboard = useMemo(() => {
    const sorted = [...rows].sort((a, b) => (b.tradingScore || 0) - (a.tradingScore || 0));
    const byGain = [...rows].filter((row) => Number.isFinite(row.changePercent)).sort((a, b) => b.changePercent - a.changePercent);
    const byVolume = [...rows].filter((row) => Number.isFinite(row.volumeRatio)).sort((a, b) => b.volumeRatio - a.volumeRatio);
    const breakouts = rows
      .filter((row) => Number.isFinite(row.currentPrice) && Number.isFinite(row.resistance) && row.currentPrice >= row.resistance * 0.995)
      .sort((a, b) => (b.volumeRatio || 0) - (a.volumeRatio || 0));
    return {
      opportunities: rows.filter((row) => actionSignal(row) === "BUY NOW" || actionSignal(row).startsWith("WAIT FOR ENTRY")).length,
      bestSetups: sorted.filter((row) => ["BUY NOW", "WATCH"].includes(actionSignal(row)) || actionSignal(row).startsWith("WAIT FOR ENTRY")).slice(0, 5),
      top10: sorted.slice(0, 10),
      highestScore: sorted[0],
      highestVolatility: [...rows].filter((row) => Number.isFinite(row.volatility)).sort((a, b) => b.volatility - a.volatility)[0],
      topGainers: byGain.slice(0, 5),
      topLosers: byGain.slice().reverse().slice(0, 5),
      oversold: [...rows].filter((row) => Number.isFinite(row.rsi)).sort((a, b) => a.rsi - b.rsi)[0],
      overbought: [...rows].filter((row) => Number.isFinite(row.rsi)).sort((a, b) => b.rsi - a.rsi)[0],
      highestVolume: [...rows].filter((row) => Number.isFinite(row.volumeRatio)).sort((a, b) => b.volumeRatio - a.volumeRatio)[0],
      highestRelativeVolume: byVolume.slice(0, 5),
      breakouts: breakouts.length ? breakouts.slice(0, 5) : sorted.slice(0, 3),
      oversoldStocks: [...rows].filter((row) => Number.isFinite(row.rsi)).sort((a, b) => a.rsi - b.rsi).slice(0, 5),
      overboughtStocks: [...rows].filter((row) => Number.isFinite(row.rsi)).sort((a, b) => b.rsi - a.rsi).slice(0, 5),
      largestGap: [...rows].filter((row) => Number.isFinite(row.gap)).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0],
      tradeAlerts: [
        { label: "Entry reached", value: rows.filter((row) => Number.isFinite(row.currentPrice) && Number.isFinite(row.entry) && Math.abs(row.currentPrice - row.entry) / row.entry < 0.01).length },
        { label: "Breakouts", value: breakouts.length },
        { label: "RSI oversold", value: rows.filter((row) => Number.isFinite(row.rsi) && row.rsi < 30).length },
        { label: "High relative volume", value: rows.filter((row) => Number.isFinite(row.volumeRatio) && row.volumeRatio >= 2).length },
      ],
      openPositions: positions.filter((position) => position.status === "open"),
      closedPositions: positions.filter((position) => position.status === "closed"),
      activeAlerts: alerts.filter((alert) => alert.status === "active"),
      triggeredToday: alerts.filter((alert) => alert.status === "triggered" && alert.triggeredAt && new Date(alert.triggeredAt).toDateString() === new Date().toDateString()),
      unrealisedProfit: positions.filter((position) => position.status === "open").reduce((total, position) => total + (Number(position.unrealisedProfit) || 0), 0),
      realisedProfit: positions.filter((position) => position.status === "closed").reduce((total, position) => total + (Number(position.realisedProfit) || 0), 0),
    };
  }, [alerts, positions, rows]);

  const performance = useMemo(() => {
    const closed = dashboard.closedPositions || [];
    const open = dashboard.openPositions || [];
    const wins = closed.map((position) => Number(position.realisedProfit)).filter((value) => value > 0);
    const losses = closed.map((position) => Number(position.realisedProfit)).filter((value) => value < 0);
    const startingCapital = 50000;
    const realised = dashboard.realisedProfit || 0;
    const unrealised = dashboard.unrealisedProfit || 0;
    return {
      closedTrades: closed.length,
      winRate: closed.length ? (wins.length / closed.length) * 100 : null,
      averageGain: wins.length ? wins.reduce((total, value) => total + value, 0) / wins.length : null,
      averageLoss: losses.length ? losses.reduce((total, value) => total + value, 0) / losses.length : null,
      largestWin: wins.length ? Math.max(...wins) : null,
      largestLoss: losses.length ? Math.min(...losses) : null,
      currentCapital: startingCapital + realised + unrealised,
      portfolioReturn: startingCapital ? ((realised + unrealised) / startingCapital) * 100 : null,
      riskStatistics: `${open.length} open / ${closed.length} closed`,
    };
  }, [dashboard]);

  async function createEntryAlert() {
    const entryPrice = visualLevels.entry;
    if (!selected?.symbol || !Number.isFinite(entryPrice) || entryAlertSaving) return;
    const payload = {
      symbol: selected.symbol,
      alertType: "ENTRY",
      triggerPrice: entryPrice,
      direction: "below",
      priority: "high",
      message: `Entry alert for ${selected.symbol} at ${formatCurrency(entryPrice)}. Alert only; no trade is placed automatically.`,
    };

    try {
      setEntryAlertSaving(true);
      setEntryAlertMessage("");
      const response = await fetch("/api/freedom-trader/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok === false) {
        const message = data?.error || `Unable to create alert (${response.status}).`;
        console.error("Freedom Trader alert failed", { status: response.status, data, payload });
        setEntryAlertMessage(message);
        return false;
      }
      if (data?.alert) setAlerts((current) => [data.alert, ...current]);
      setEntryAlertMessage(`Entry alert created at ${formatCurrency(entryPrice)}. No trade was placed.`);
      return true;
    } catch (error) {
      console.error("Freedom Trader create alert failed", error);
      setEntryAlertMessage(error instanceof Error ? error.message : "Unable to save alert right now.");
      return false;
    } finally {
      setEntryAlertSaving(false);
    }
  }

  async function activateTradeSetup() {
    if (!selected?.symbol || !levelsComplete(visualLevels) || activateSaving) return;
    if (visualLevels.target <= visualLevels.entry || visualLevels.stop >= visualLevels.entry || visualMetrics.positionSize < 1) {
      setTradePlannerMessage("Entry, target and stop must form a valid setup before activation.");
      return;
    }
    const payload = {
      symbol: selected.symbol,
      alertType: "ENTRY",
      triggerPrice: visualLevels.entry,
      direction: "below",
      priority: "high",
      message: `Activated trade setup for ${selected.symbol}. Entry ${formatCurrency(visualLevels.entry)}, target ${formatCurrency(visualLevels.target)}, stop ${formatCurrency(visualLevels.stop)}, size ${visualMetrics.positionSize} shares. Alert only; no broker trade is placed automatically.`,
    };

    try {
      setActivateSaving(true);
      setTradePlannerMessage("");
      saveVisualLevelsForSymbol(selected.symbol, visualLevels);
      const response = await fetch("/api/freedom-trader/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok === false) {
        const message = data?.error || `Unable to create alert (${response.status}).`;
        console.error("Freedom Trader alert failed", { status: response.status, data, payload });
        setTradePlannerMessage(message);
        return false;
      }
      if (data?.alert) setAlerts((current) => [data.alert, ...current]);
      setTradePlannerMessage("Trade setup activated for monitoring. Entry alert created; no broker trade was placed.");
      return true;
    } catch (error) {
      console.error("Freedom Trader create alert failed", error);
      setTradePlannerMessage(error instanceof Error ? error.message : "Unable to save alert right now.");
      return false;
    } finally {
      setActivateSaving(false);
    }
  }

  const attentionItems = useMemo(() => {
    const items = [];
    positions.filter((position) => position.status === "open").forEach((position) => {
      if (Number.isFinite(position.distanceToTarget) && position.distanceToTarget <= 2) items.push({ symbol: position.symbol, reason: "Within 2% of target", tone: "target" });
      if (Number.isFinite(position.distanceToStop) && position.distanceToStop <= 2) items.push({ symbol: position.symbol, reason: "Within 2% of stop", tone: "stop" });
      if (Number(position.daysHeld) > 30) items.push({ symbol: position.symbol, reason: "Open longer than expected", tone: "time" });
    });
    alerts.filter((alert) => alert.status === "triggered").forEach((alert) => {
      items.push({ symbol: alert.symbol, reason: `${alert.alertType} triggered`, tone: "alert" });
    });
    return items.slice(0, 6);
  }, [alerts, positions]);

  const refreshPlannerPixels = useCallback(() => {
    const chart = chartRef.current;
    if (!chart || !levelsComplete(visualLevels)) {
      setLinePixels({ entry: null, target: null, stop: null });
      return;
    }
    const xValue = chartCandles[chartCandles.length - 1]?.date;
    const toPixel = (price) => {
      const value = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [xValue, price]);
      return Array.isArray(value) ? value[1] : value;
    };
    const next = {
      entry: toPixel(visualLevels.entry),
      target: toPixel(visualLevels.target),
      stop: toPixel(visualLevels.stop),
    };
    if (Object.values(next).every(Number.isFinite)) setLinePixels(next);
  }, [chartCandles, visualLevels]);

  useEffect(() => {
    refreshPlannerPixels();
  }, [refreshPlannerPixels]);

  useEffect(() => {
    if (!draggingLevel) return undefined;
    const handleMove = (event) => {
      const chart = chartRef.current;
      const node = chartNodeRef.current;
      if (!chart || !node) return;
      const rect = node.getBoundingClientRect();
      const localY = event.clientY - rect.top;
      const raw = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [rect.width / 2, localY]);
      const price = Array.isArray(raw) ? raw[1] : raw;
      if (Number.isFinite(price) && price > 0) updateVisualLevel(draggingLevel, price);
    };
    const handleUp = () => setDraggingLevel(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [draggingLevel, updateVisualLevel]);

  useEffect(() => {
    let disposed = false;
    async function renderChart() {
      if (!chartNodeRef.current || !chartData.candles.length) return;
      const echarts = await import("echarts");
      if (disposed) return;
      if (!chartRef.current) chartRef.current = echarts.init(chartNodeRef.current, null, { renderer: "canvas" });
      const lows = chartCandles.map((candle) => candle.low).filter(Number.isFinite);
      const highs = chartCandles.map((candle) => candle.high).filter(Number.isFinite);
      const support = lows.length ? Math.min(...lows.slice(-60)) : selected?.support;
      const resistance = highs.length ? Math.max(...highs.slice(-60)) : selected?.resistance;
      const yearHigh = highs.length ? Math.max(...highs) : null;
      const yearLow = lows.length ? Math.min(...lows) : null;
      chartRef.current.setOption({
        backgroundColor: "transparent",
        animation: false,
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "cross", lineStyle: { color: "#8aa4b4" } },
          backgroundColor: "rgba(5, 8, 11, 0.96)",
          borderColor: "rgba(94, 189, 255, 0.35)",
          textStyle: { color: "#f6f8f9" },
        },
        axisPointer: { link: [{ xAxisIndex: "all" }] },
        grid: [
          { left: 62, right: 28, top: 26, height: showVolume ? "48%" : "60%" },
          { left: 62, right: 28, top: showVolume ? "58%" : "64%", height: showVolume ? "10%" : "0%" },
          { left: 62, right: 28, top: "72%", height: "9%" },
          { left: 62, right: 28, top: "86%", height: "8%" },
        ],
        dataZoom: [
          { type: "inside", xAxisIndex: [0, 1, 2, 3], start: 58, end: 100, zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: false },
          { type: "slider", xAxisIndex: [0, 1, 2, 3], bottom: 0, height: 20, borderColor: "rgba(255,255,255,0.1)", textStyle: { color: "#aebdc4" } },
        ],
        xAxis: [
          { type: "category", data: chartData.dates, axisLine: { lineStyle: { color: "#23313a" } }, axisLabel: { color: "#aebdc4" } },
          { type: "category", data: chartData.dates, gridIndex: 1, axisLabel: { show: false }, axisLine: { lineStyle: { color: "#23313a" } } },
          { type: "category", data: chartData.dates, gridIndex: 2, axisLabel: { show: false }, axisLine: { lineStyle: { color: "#23313a" } } },
          { type: "category", data: chartData.dates, gridIndex: 3, axisLabel: { show: false }, axisLine: { lineStyle: { color: "#23313a" } } },
        ],
        yAxis: [
          { scale: true, splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } }, axisLabel: { color: "#aebdc4" } },
          { scale: true, gridIndex: 1, splitLine: { show: false }, axisLabel: { color: "#aebdc4" } },
          { min: 0, max: 100, gridIndex: 2, splitLine: { show: false }, axisLabel: { color: "#aebdc4" } },
          { scale: true, gridIndex: 3, splitLine: { show: false }, axisLabel: { color: "#aebdc4" } },
        ],
        series: [
          {
            name: selected?.symbol || "Candles",
            type: "candlestick",
            data: chartData.candles.map((item) => item.slice(1)),
            itemStyle: { color: "#23d18b", color0: "#ff5c5c", borderColor: "#23d18b", borderColor0: "#ff5c5c" },
            markLine: {
              symbol: "none",
              label: { color: "#d8e5ea" },
              lineStyle: { type: "dashed", width: 1.2 },
              data: [
                Number.isFinite(support) ? { name: "Support", yAxis: support, lineStyle: { color: "#22c55e" } } : null,
                Number.isFinite(resistance) ? { name: "Resistance", yAxis: resistance, lineStyle: { color: "#f97316" } } : null,
                Number.isFinite(yearHigh) ? { name: "52W High", yAxis: yearHigh, lineStyle: { color: "#5ebdff" } } : null,
                Number.isFinite(yearLow) ? { name: "52W Low", yAxis: yearLow, lineStyle: { color: "#a855f7" } } : null,
              ].filter(Boolean),
            },
          },
          showAverages ? { name: "MA20", type: "line", data: chartData.ma20, smooth: true, showSymbol: false, lineStyle: { color: "#00e5ff", width: 2 } } : null,
          showAverages ? { name: "MA50", type: "line", data: chartData.ma50, smooth: true, showSymbol: false, lineStyle: { color: "#facc15", width: 2 } } : null,
          showAverages ? { name: "MA200", type: "line", data: chartData.ma200, smooth: true, showSymbol: false, lineStyle: { color: "#a855f7", width: 2 } } : null,
          showVolume
            ? {
                name: "Volume",
                type: "bar",
                xAxisIndex: 1,
                yAxisIndex: 1,
                data: chartData.volume.map((item) => item[1]),
                itemStyle: {
                  color: (params) => (chartData.volume[params.dataIndex]?.[2] >= 0 ? "rgba(35,209,139,0.55)" : "rgba(255,92,92,0.55)"),
                },
              }
            : null,
          {
            name: "RSI",
            type: "line",
            xAxisIndex: 2,
            yAxisIndex: 2,
            data: chartData.rsi,
            smooth: true,
            showSymbol: false,
            lineStyle: { color: "#5ebdff", width: 1.8 },
            markLine: {
              symbol: "none",
              label: { color: "#aebdc4" },
              lineStyle: { type: "dashed", color: "rgba(250, 204, 21, 0.55)" },
              data: [{ yAxis: 70, name: "Overbought" }, { yAxis: 30, name: "Oversold" }],
            },
          },
          {
            name: "MACD",
            type: "bar",
            xAxisIndex: 3,
            yAxisIndex: 3,
            data: chartCandles.map((_, index) => {
              const closes = chartCandles.slice(0, index + 1).map((candle) => candle.close);
              return calculateMacd(closes).histogram || 0;
            }),
            itemStyle: { color: (params) => (params.value >= 0 ? "#23d18b" : "#ff5c5c") },
          },
        ].filter(Boolean),
      });
      window.setTimeout(() => {
        refreshPlannerPixels();
      }, 0);
    }
    renderChart();
    const resize = () => {
      chartRef.current?.resize();
      window.setTimeout(() => {
        refreshPlannerPixels();
      }, 0);
    };
    window.addEventListener("resize", resize);
    chartRef.current?.on?.("datazoom", refreshPlannerPixels);
    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      chartRef.current?.off?.("datazoom", refreshPlannerPixels);
    };
  }, [chartData, chartCandles, refreshPlannerPixels, selected, showAverages, showVolume]);

  const visualOverlayReady = levelsComplete(visualLevels) && Object.values(linePixels).every(Number.isFinite);
  const chartPlotTop = 26;
  const chartPlotBottom = showVolume ? 26 + 620 * 0.48 : 26 + 620 * 0.6;
  const clampZone = (a, b) => {
    const top = clamp(Math.min(a, b), chartPlotTop, chartPlotBottom);
    const bottom = clamp(Math.max(a, b), chartPlotTop, chartPlotBottom);
    return { top, height: Math.max(0, bottom - top) };
  };
  const profitZone = visualOverlayReady ? clampZone(linePixels.target, linePixels.entry) : { top: 0, height: 0 };
  const riskZone = visualOverlayReady ? clampZone(linePixels.entry, linePixels.stop) : { top: 0, height: 0 };

  if (checkingStorage) {
    return <div className="boot">Opening Freedom Trader...</div>;
  }

  if (!unlocked) return <PasswordGate passwordHash={passwordHash} onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="page">
      <Head>
        <title>Freedom Trader</title>
      </Head>

      <section className="platformBanner" aria-label="Current Freedom workspace">
        <strong><span className="platformIcon" aria-hidden="true">{"\u{1F4CA}"}</span>Freedom Trader</strong>
        <span>Active Trading & Market Opportunities</span>
      </section>

      <header className="hero">
        <div>
          <nav className="platformSwitch" aria-label="Freedom platform switch">
            <Link href="/freedom">Freedom Investment</Link>
            <Link className="active" href="/freedom-trader">Freedom Trader</Link>
          </nav>
          <span className="eyebrow">Independent Swing Trading Workspace</span>
          <h1>Freedom Trader</h1>
          <p>Active Trading & Market Opportunities</p>
        </div>
        <div className="heroStats">
          <article>
            <span>Today's Opportunities</span>
            <strong>{dashboard.opportunities}</strong>
          </article>
          <article>
            <span>Highest Score</span>
            <strong>{dashboard.highestScore?.symbol || "--"}</strong>
          </article>
          <article>
            <span>Updated</span>
            <strong>{updatedAt ? new Date(updatedAt).toLocaleTimeString() : "--"}</strong>
          </article>
          <nav className="traderNav" aria-label="Freedom Trader sections">
            <Link href="/freedom-trader/positions">Positions</Link>
            <Link href="/freedom-trader/alerts">Alerts</Link>
            <Link href="/freedom-trader/market-opportunities">Market Opportunities</Link>
            <Link href="/freedom-trader/settings">Settings</Link>
          </nav>
          <button type="button" onClick={loadTradingData} disabled={loading}>
            {loading ? "Scanning..." : "Refresh Scan"}
          </button>
        </div>
      </header>

      {error ? <section className="alert">{error}</section> : null}

      <section className="summary" id="dashboard">
        <article>
          <span>Trading Watchlist Count</span>
          <strong>{tradingUniverse.length}</strong>
          <small>Separate swing-trading list</small>
        </article>
        <article>
          <span>Strongest Setup</span>
          <strong>{dashboard.bestSetups[0]?.symbol || "--"}</strong>
          <small>{dashboard.bestSetups[0] ? `${actionSignal(dashboard.bestSetups[0])} / ${dashboard.bestSetups[0].tradingScore}` : "No setup yet"}</small>
        </article>
        <article>
          <span>Highest Volatility</span>
          <strong>{dashboard.highestVolatility?.symbol || "--"}</strong>
          <small>{formatPercent(dashboard.highestVolatility?.volatility)}</small>
        </article>
        <article>
          <span>Most Oversold</span>
          <strong>{dashboard.oversold?.symbol || "--"}</strong>
          <small>RSI {formatNumber(dashboard.oversold?.rsi)}</small>
        </article>
        <article>
          <span>Active Alerts</span>
          <strong>{dashboard.activeAlerts.length}</strong>
          <small>Trader-only alert checks</small>
        </article>
        <article>
          <span>Open Positions</span>
          <strong>{dashboard.openPositions.length}</strong>
          <small>Trader-only position ledger</small>
        </article>
        <article>
          <span>Triggered Today</span>
          <strong>{dashboard.triggeredToday.length}</strong>
          <small>Alerts requiring review</small>
        </article>
        <article>
          <span>Current Unrealised P/L</span>
          <strong className={dashboard.unrealisedProfit >= 0 ? "profitText" : "lossText"}>{formatCurrency(dashboard.unrealisedProfit)}</strong>
          <small>Open positions only</small>
        </article>
      </section>

      <section className="workspace">
        <aside className="sidebar">
          <div className="sideHeader">
            <h2>Freedom Trader</h2>
            <p>Independent from Freedom Investment.</p>
          </div>
          <nav className="leftNav" aria-label="Freedom Trader navigation">
            {LEFT_NAV_ITEMS.map((item) =>
              item.href.startsWith("/") ? (
                <Link key={item.label} href={item.href}>{item.label}</Link>
              ) : (
                <a key={item.label} href={item.href}>{item.label}</a>
              )
            )}
          </nav>
          <div className="watchlistFilters">
            <h3>Trading Watchlists</h3>
          {Object.keys(watchlists).map((name) => (
            <button className={activeWatchlist === name ? "active" : ""} key={name} type="button" onClick={() => setActiveWatchlist(name)}>
              {name}
              <span>{watchlists[name].length}</span>
            </button>
          ))}
          </div>
          <div className="rules">
            <h3>Risk Rules</h3>
            <p>Maximum allocation: 10%</p>
            <p>Maximum single-trade risk: 1%</p>
            <p>Every trade requires entry, target, and stop.</p>
          </div>
        </aside>

        <main className="main">
          <section className="insightGrid">
            <InsightList title="Top Gainers" rows={dashboard.topGainers} metric={(row) => formatPercent(row.changePercent)} />
            <InsightList title="Top Losers" rows={dashboard.topLosers} metric={(row) => formatPercent(row.changePercent)} />
            <InsightList title="Highest Relative Volume" rows={dashboard.highestRelativeVolume} metric={(row) => `${formatNumber(row.volumeRatio)}x`} />
            <InsightList title="Breakouts" rows={dashboard.breakouts} metric={(row) => actionSignal(row)} />
            <InsightList title="Oversold Stocks" rows={dashboard.oversoldStocks} metric={(row) => `RSI ${formatNumber(row.rsi)}`} />
            <InsightList title="Overbought Stocks" rows={dashboard.overboughtStocks} metric={(row) => `RSI ${formatNumber(row.rsi)}`} />
            <article className="insightCard tradeAlerts" id="alerts">
              <div className="insightHeader">
                <h2>Trade Alerts</h2>
                <Link href="/freedom-trader/alerts">Open Alerts</Link>
              </div>
              {dashboard.tradeAlerts.map((alert) => (
                <div className="alertRow" key={alert.label}>
                  <span>{alert.label}</span>
                  <strong>{alert.value}</strong>
                </div>
              ))}
            </article>
          </section>

          <section className="tablePanel" id="trade-setups">
            <div className="panelHeader">
              <div>
                <h2>Today's Best Trade Setups</h2>
                <p>Weighted score: trend, momentum, volume, volatility, support/resistance, indicators.</p>
              </div>
              <span>{loading ? "Loading live scan..." : `${visibleRows.length} symbols`}</span>
            </div>
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Ticker</th>
                    <th>Current Price</th>
                    <th>Daily Change %</th>
                    <th>Trading Score</th>
                    <th>Data Status</th>
                    <th>Trend</th>
                    <th>RSI</th>
                    <th>Relative Volume</th>
                    <th>Support</th>
                    <th>Resistance</th>
                    <th>Planned Entry</th>
                    <th>Target</th>
                    <th>Stop</th>
                    <th>Risk Reward</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr className={selectedSymbol === row.symbol ? "selected" : ""} key={row.symbol} onClick={() => setSelectedSymbol(row.symbol)}>
                      <td>{row.companyName}</td>
                      <td><button className="tickerButton" type="button">{row.symbol}</button></td>
                      <td>{formatCurrency(row.currentPrice)}</td>
                      <td>{formatPercent(row.changePercent)}</td>
                      <td><Score value={row.tradingScore} /></td>
                      <td>{row.dataStatus?.status || row.error || "Waiting for scanner"}</td>
                      <td>{row.trend}</td>
                      <td>{formatNumber(row.rsi)}</td>
                      <td>{formatNumber(row.volumeRatio)}x</td>
                      <td>{formatCurrency(row.support)}</td>
                      <td>{formatCurrency(row.resistance)}</td>
                      <td>{formatCurrency(displayPlannedEntry(row))}</td>
                      <td>{formatCurrency(row.target)}</td>
                      <td>{formatCurrency(row.stopLoss)}</td>
                      <td>{formatNumber(row.riskReward)}</td>
                      <td><SignalBadge signal={actionSignal(row)} /></td>
                      <td>
                        <Link className="actionLink" href={`/freedom-trader/company/${row.symbol}`}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selected?.marketData && !selected.marketData.validated ? (
                <div className="dataWarning">
                  <strong>Market price not validated</strong>
                  <span>{selected.marketData.issues?.join(" ") || "Live market data could not be confirmed. Trade recommendations are disabled."}</span>
                </div>
              ) : null}
            </div>
          </section>

          <section className="split">
            <article className="planner">
              <div className="panelHeader compact">
                <div>
                  <h2>Trade Planner</h2>
                  <p>{selected?.companyName} / {selected?.symbol}</p>
                </div>
                <SignalBadge signal={actionSignal(selected)} />
              </div>
              <div className="plannerGrid">
                <Metric label="Current Price" value={formatCurrency(selected?.currentPrice)} />
                <Metric label="Planned Entry" value={formatCurrency(visualLevels.entry)} />
                <Metric label="Dollar Distance to Entry" value={formatDistanceText(selected?.currentPrice, visualLevels.entry)} />
                <Metric label="Percentage Distance to Entry" value={formatDistancePercent(selected?.currentPrice, visualLevels.entry)} />
                <Metric label="Suggested Position Size" value={`${visualMetrics.positionSize} shares`} />
                <Metric label="Target Price" value={formatCurrency(visualLevels.target)} />
                <Metric label="Stop Loss" value={formatCurrency(visualLevels.stop)} />
                <Metric label="Risk" value={formatCurrency(visualMetrics.maximumLoss)} />
                <Metric label="Reward" value={formatCurrency(visualMetrics.expectedProfit)} />
                <Metric label="Risk Reward Ratio" value={formatNumber(visualMetrics.riskReward)} />
                <Metric label="Expected Holding Time" value={selected?.expectedHoldingTime || "--"} />
                <Metric label="Probability" value={`${formatNumber(selected?.probability)}%`} />
              </div>
              <div className="plannerActions">
                <button type="button" onClick={resetVisualLevels} disabled={!levelsComplete(recommendedLevelsFor(selected))}>
                  Reset to Recommended Levels
                </button>
                <button type="button" onClick={createEntryAlert} disabled={entryAlertSaving || !selected?.marketData?.validated || !Number.isFinite(visualLevels.entry)}>
                  {entryAlertSaving ? "Creating Alert..." : "Alert Me at Entry"}
                </button>
                <button type="button" onClick={activateTradeSetup} disabled={activateSaving || !selected?.marketData?.validated || !levelsComplete(visualLevels)}>
                  {activateSaving ? "Activating..." : "Activate Trade Setup"}
                </button>
                <span>This only creates an alert. It does not place a trade.</span>
                <span>Activation saves the adjusted setup and starts entry monitoring.</span>
                {entryAlertMessage ? <small>{entryAlertMessage}</small> : null}
                {tradePlannerMessage ? <small>{tradePlannerMessage}</small> : null}
              </div>
            </article>

            <article className="planner whyPanel">
              <div className="panelHeader compact">
                <div>
                  <h2>Why this is the top setup</h2>
                  <p>{selected?.companyName} / {selected?.symbol}</p>
                </div>
              </div>
              <div className="whyGrid">
                <Metric label="Highest trading score today" value={dashboard.highestScore?.symbol === selected?.symbol ? `${selected?.symbol} leads with ${formatNumber(selected?.tradingScore)}` : `${dashboard.highestScore?.symbol || "--"} leads; ${selected?.symbol || "--"} is ${formatNumber(selected?.tradingScore)}`} />
                <Metric label="Momentum result" value={resultLabel(selected?.components?.momentumScore)} />
                <Metric label="Relative volume result" value={Number.isFinite(selected?.volumeRatio) ? `${formatNumber(selected.volumeRatio)}x relative volume` : "Not enough data"} />
                <Metric label="Support quality" value={resultLabel(selected?.components?.supportScore)} />
                <Metric label="Risk/reward ratio" value={formatNumber(selected?.riskReward)} />
                <Metric label="Final action required" value={finalActionText(selected)} />
              </div>
            </article>
          </section>

          <section className="split">
            <article className="planner" id="watchlist">
              <div className="panelHeader compact">
                <div>
                  <h2>Trading Watchlist</h2>
                  <p>Separate from the investment watchlist.</p>
                </div>
              </div>
              <div className="watchlistChips">
                {tradingUniverse.map((item) => (
                  <Link key={item.symbol} href={`/freedom-trader/company/${item.symbol}`}>
                    <strong>{item.symbol}</strong>
                    <span>{item.companyName}</span>
                  </Link>
                ))}
              </div>
            </article>
          </section>

          <section className="split">
            <article className="planner" id="open-positions">
              <div className="panelHeader compact">
                <div>
                  <h2>Open Positions</h2>
                  <p>Position tracking workspace</p>
                </div>
                <Link className="panelLink" href="/freedom-trader/positions">Open Positions</Link>
              </div>
              <div className="positions">
                {dashboard.openPositions.length ? dashboard.openPositions.slice(0, 5).map((position) => (
                  <div className="positionMini" key={position.id}>
                    <strong>{position.symbol}</strong>
                    <span className={position.unrealisedProfit >= 0 ? "profitText" : "lossText"}>{formatCurrency(position.unrealisedProfit)}</span>
                    <small>{position.daysHeld ?? "--"} days held</small>
                  </div>
                )) : <p className="empty">No open swing positions recorded yet.</p>}
              </div>
            </article>
            <article className="planner" id="performance">
              <span className="anchorTarget" id="closed-trades" />
              <div className="panelHeader compact">
                <div>
                  <h2>Performance</h2>
                  <p>Closed trades and performance tracking.</p>
                </div>
              </div>
              <div className="performanceGrid">
                <Metric label="Win %" value={Number.isFinite(performance.winRate) ? `${performance.winRate.toFixed(1)}%` : "--"} />
                <Metric label="Average Gain" value={formatCurrency(performance.averageGain)} />
                <Metric label="Average Loss" value={formatCurrency(performance.averageLoss)} />
                <Metric label="Largest Win" value={formatCurrency(performance.largestWin)} />
                <Metric label="Largest Loss" value={formatCurrency(performance.largestLoss)} />
                <Metric label="Current Capital" value={formatCurrency(performance.currentCapital)} />
                <Metric label="Portfolio Return" value={formatPercent(performance.portfolioReturn)} />
                <Metric label="Risk Statistics" value={performance.riskStatistics} />
              </div>
            </article>
          </section>

          <section className="split">
            <article className="planner">
              <div className="panelHeader compact">
                <div>
                  <h2>Recent Alerts</h2>
                  <p>Latest trader alert states.</p>
                </div>
                <Link className="panelLink" href="/freedom-trader/alerts">Open Alerts</Link>
              </div>
              <div className="attentionList">
                {alerts.slice(0, 6).map((alert) => (
                  <div className={`attentionItem ${alert.status}`} key={alert.id}>
                    <strong>{alert.symbol}</strong>
                    <span>{alert.alertType}</span>
                    <small>{alert.status}</small>
                  </div>
                ))}
                {!alerts.length ? <p className="empty">No alerts saved yet.</p> : null}
              </div>
            </article>
            <article className="planner">
              <div className="panelHeader compact">
                <div>
                  <h2>Trades Requiring Attention</h2>
                  <p>Near targets, stops, triggered alerts or stale holds.</p>
                </div>
              </div>
              <div className="attentionList">
                {attentionItems.length ? attentionItems.map((item, index) => (
                  <div className={`attentionItem ${item.tone}`} key={`${item.symbol}-${item.reason}-${index}`}>
                    <strong>{item.symbol}</strong>
                    <span>{item.reason}</span>
                  </div>
                )) : <p className="empty">No trades require attention right now.</p>}
              </div>
            </article>
          </section>

          <section className="chartPanel">
            <div className="panelHeader">
              <div>
                <h2>{selected?.symbol} Trading Chart</h2>
                <p>Candles, volume, MA20, MA50, MA200, MACD, support, resistance, 52-week high and low.</p>
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
                <button className={showVolume ? "active" : ""} type="button" onClick={() => setShowVolume((value) => !value)}>Volume</button>
                <button className={showAverages ? "active" : ""} type="button" onClick={() => setShowAverages((value) => !value)}>Moving Averages</button>
                <button type="button" onClick={() => chartRef.current?.dispatchAction({ type: "dataZoom", start: 58, end: 100 })}>Reset Zoom</button>
                <button type="button" onClick={() => chartNodeRef.current?.requestFullscreen?.()}>Fullscreen</button>
              </div>
            </div>
            <div className="chartShell">
              {chartLoading ? <div className="chartState">Loading historical data...</div> : null}
              {chartError ? <div className="chartState warning">{chartError}</div> : null}
              {chartMeta?.dataLabel ? <div className="dataLabel">{chartMeta.dataLabel}</div> : null}
              <div ref={chartNodeRef} className="chart" />
              {visualOverlayReady ? (
                <div className="visualPlannerOverlay" aria-label="Visual trade planner">
                  <div className="zone profitZone" style={{ top: profitZone.top, height: profitZone.height }} />
                  <div className="zone riskZone" style={{ top: riskZone.top, height: riskZone.height }} />
                  {[
                    { key: "target", label: "Target", value: visualLevels.target, y: linePixels.target, className: "targetLine" },
                    { key: "entry", label: "Planned Entry", value: visualLevels.entry, y: linePixels.entry, className: "entryLine" },
                    { key: "stop", label: "Stop Loss", value: visualLevels.stop, y: linePixels.stop, className: "stopLine" },
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
              <div>
                <span>Risk/Reward</span>
                <strong>{formatNumber(visualMetrics.riskReward)}</strong>
              </div>
              <div>
                <span>Percentage Return</span>
                <strong>{formatPercent(visualMetrics.percentageReturn)}</strong>
              </div>
              <div>
                <span>Expected Profit</span>
                <strong>{formatCurrency(visualMetrics.expectedProfit)}</strong>
              </div>
              <div>
                <span>Maximum Loss</span>
                <strong>{formatCurrency(visualMetrics.maximumLoss)}</strong>
              </div>
              <div>
                <span>Position Size</span>
                <strong>{visualMetrics.positionSize} shares</strong>
              </div>
              <div className="visualPlannerButtons">
                <button type="button" onClick={resetVisualLevels} disabled={!levelsComplete(recommendedLevelsFor(selected))}>Reset to Recommended Levels</button>
                <button type="button" onClick={createEntryAlert} disabled={entryAlertSaving || !Number.isFinite(visualLevels.entry)}>{entryAlertSaving ? "Creating Alert..." : "Alert Me at Entry"}</button>
                <button type="button" onClick={activateTradeSetup} disabled={activateSaving || !levelsComplete(visualLevels)}>{activateSaving ? "Activating..." : "Activate Trade Setup"}</button>
              </div>
              <p>Drag the horizontal levels on the chart. Adjusted levels are saved for {selected?.symbol} and restored automatically.</p>
            </div>
          </section>

          <section className="split">
            <article className="planner">
              <div className="panelHeader compact">
                <h2>Alert Rules</h2>
              </div>
              <div className="alerts">
                {["Price reaches Entry", "Price reaches Target", "Price hits Stop", "Breakout", "Gap", "Large Volume", "RSI Overbought", "RSI Oversold"].map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            </article>
            <article className="planner">
              <div className="panelHeader compact">
                <h2>Score Components</h2>
              </div>
              <div className="components">
                <ComponentBar label="Trend Strength" weight="20%" value={selected?.components?.trendScore} />
                <ComponentBar label="Momentum" weight="20%" value={selected?.components?.momentumScore} />
                <ComponentBar label="Volume" weight="15%" value={selected?.components?.volumeScore} />
                <ComponentBar label="Volatility" weight="15%" value={selected?.components?.volatilityScore} />
                <ComponentBar label="Support / Resistance" weight="15%" value={selected?.components?.supportScore} />
                <ComponentBar label="Technical Indicators" weight="15%" value={selected?.components?.technicalScore} />
              </div>
            </article>
          </section>
        </main>
      </section>

      <footer>Freedom Trader is separate from Freedom Investment. Trading research only. Not financial advice.</footer>

      <style jsx>{`
        .boot,
        .page {
          background: #05080b;
          color: #f5f7f8;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          min-height: 100vh;
        }
        .boot {
          align-items: center;
          display: flex;
          font-weight: 900;
          justify-content: center;
        }
        .page {
          padding: 96px 28px 28px;
        }
        .hero,
        .summary,
        .workspace,
        footer,
        .alert,
        .dataWarning {
          margin-left: auto;
          margin-right: auto;
          max-width: 1840px;
        }
        .platformBanner {
          align-items: center;
          background: #0057d9;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.32);
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
          color: #ff9900;
          font-size: 0.9em;
          line-height: 1;
        }
        .hero {
          align-items: flex-end;
          background: #07111f;
          border: 1px solid rgba(29, 155, 255, 0.34);
          border-radius: 8px;
          box-shadow: 0 24px 90px rgba(29, 155, 255, 0.12);
          display: flex;
          gap: 28px;
          justify-content: space-between;
          min-height: 220px;
          padding: 34px;
        }
        .platformSwitch {
          display: inline-flex;
          gap: 8px;
          margin-bottom: 20px;
        }
        .platformSwitch a {
          background: #00843d;
          border: 1px solid #00843d;
          border-radius: 999px;
          color: #fff;
          font-size: 14px;
          font-weight: 950;
          padding: 10px 14px;
          text-decoration: none;
        }
        .platformSwitch a.active {
          background: #0057d9;
          border-color: #0057d9;
          color: #fff;
        }
        .eyebrow {
          color: #ffbf69;
          display: block;
          font-size: 12px;
          font-weight: 950;
          margin-bottom: 12px;
          text-transform: uppercase;
        }
        h1,
        h2,
        h3,
        p {
          margin: 0;
        }
        h1 {
          color: #fff;
          font-size: clamp(48px, 5vw, 82px);
          letter-spacing: 0;
          line-height: 0.95;
        }
        .hero p,
        .panelHeader p,
        .sideHeader p,
        footer {
          color: #aebdc4;
        }
        .hero p {
          font-size: 18px;
          margin-top: 16px;
        }
        .heroStats {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(2, minmax(150px, 1fr));
          min-width: 360px;
        }
        .heroStats article,
        .summary article,
        .sidebar,
        .tablePanel,
        .planner,
        .chartPanel {
          background: rgba(8, 14, 17, 0.92);
          border: 1px solid rgba(179, 199, 207, 0.13);
          border-radius: 8px;
        }
        .heroStats article {
          padding: 14px;
        }
        .heroStats span,
        .summary span,
        .summary small,
        :global(.metric span) {
          color: #aebdc4;
          display: block;
          font-size: 12px;
          font-weight: 850;
          text-transform: uppercase;
        }
        .heroStats strong,
        .summary strong {
          color: #fff;
          display: block;
          font-size: 25px;
          margin-top: 7px;
        }
        button {
          background: #ff9900;
          border: 0;
          border-radius: 7px;
          color: #eaf7ff;
          cursor: pointer;
          font-weight: 950;
          min-height: 40px;
          padding: 0 14px;
        }
        .traderNav {
          display: grid;
          gap: 8px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .traderNav a {
          align-items: center;
          background: rgba(29, 155, 255, 0.12);
          border: 1px solid rgba(29, 155, 255, 0.3);
          border-radius: 7px;
          color: #d7efff;
          display: inline-flex;
          font-size: 13px;
          font-weight: 950;
          justify-content: center;
          min-height: 40px;
          text-decoration: none;
        }
        button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }
        .alert {
          background: rgba(255, 92, 92, 0.14);
          border: 1px solid rgba(255, 92, 92, 0.28);
          border-radius: 8px;
          color: #ffd8d3;
          font-weight: 850;
          margin-top: 18px;
          padding: 14px 16px;
        }
        .dataWarning {
          background: rgba(255, 153, 0, 0.12);
          border: 1px solid rgba(255, 153, 0, 0.34);
          border-radius: 8px;
          color: #ffd7a1;
          display: grid;
          gap: 4px;
          margin-top: 12px;
          padding: 12px 14px;
        }
        .dataWarning strong {
          color: #fff;
          font-size: 13px;
        }
        .dataWarning span {
          color: #ffd7a1;
          font-size: 13px;
          line-height: 1.45;
        }
        .summary {
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 18px;
        }
        .summary article {
          min-height: 112px;
          padding: 18px;
        }
        .summary strong {
          font-size: 34px;
          margin: 12px 0 8px;
        }
        .workspace {
          display: grid;
          gap: 18px;
          grid-template-columns: 280px minmax(0, 1fr);
          margin-top: 18px;
        }
        .sidebar {
          align-self: start;
          display: grid;
          gap: 10px;
          padding: 18px;
          position: sticky;
          top: 18px;
        }
        .leftNav,
        .watchlistFilters {
          display: grid;
          gap: 8px;
        }
        .leftNav {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 14px;
        }
        .leftNav a {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 7px;
          color: #d8e5ea;
          font-size: 14px;
          font-weight: 900;
          padding: 11px 12px;
          text-decoration: none;
        }
        .leftNav a:hover {
          background: rgba(29, 155, 255, 0.12);
          border-color: rgba(29, 155, 255, 0.32);
          color: #fff;
        }
        .watchlistFilters {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          margin-top: 6px;
          padding-top: 14px;
        }
        .watchlistFilters h3 {
          color: #aebdc4;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
        }
        .sidebar button {
          align-items: center;
          background: rgba(255, 255, 255, 0.055);
          border: 1px solid rgba(255, 255, 255, 0.09);
          color: #e7eef2;
          display: flex;
          justify-content: space-between;
        }
        .sidebar button.active,
        .chartControls button.active {
          background: rgba(255, 153, 0, 0.18);
          border-color: rgba(255, 153, 0, 0.45);
          color: #fff;
        }
        .rules {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          margin-top: 10px;
          padding-top: 16px;
        }
        .rules h3 {
          font-size: 15px;
          margin-bottom: 10px;
        }
        .rules p {
          color: #c2d0d7;
          font-size: 13px;
          line-height: 1.5;
          margin-top: 7px;
        }
        .main {
          display: grid;
          gap: 18px;
          min-width: 0;
        }
        .insightGrid {
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .insightCard {
          background: rgba(8, 14, 17, 0.92);
          border: 1px solid rgba(179, 199, 207, 0.13);
          border-radius: 8px;
          min-height: 220px;
          padding: 16px;
        }
        .insightHeader {
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          gap: 12px;
          justify-content: space-between;
          margin-bottom: 10px;
          padding-bottom: 12px;
        }
        .insightHeader h2 {
          font-size: 17px;
        }
        .insightHeader a {
          color: #5ebdff;
          font-size: 12px;
          font-weight: 950;
          text-decoration: none;
        }
        .insightRow,
        .alertRow {
          align-items: center;
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr auto;
          padding: 9px 0;
        }
        .insightRow + .insightRow,
        .alertRow + .alertRow {
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        .insightRow strong,
        .alertRow strong {
          color: #fff;
        }
        .insightRow span,
        .alertRow span {
          color: #aebdc4;
          font-size: 13px;
        }
        .tradeAlerts {
          background: linear-gradient(135deg, rgba(255, 153, 0, 0.12), rgba(29, 155, 255, 0.09)), rgba(8, 14, 17, 0.92);
        }
        .panelHeader {
          align-items: center;
          border-bottom: 1px solid rgba(179, 199, 207, 0.1);
          display: flex;
          gap: 18px;
          justify-content: space-between;
          padding: 18px 20px;
        }
        .panelHeader.compact {
          padding: 16px;
        }
        .panelHeader h2 {
          font-size: 20px;
        }
        .tableWrap {
          overflow-x: auto;
        }
        table {
          border-collapse: collapse;
          min-width: 1920px;
          table-layout: fixed;
          width: 100%;
        }
        th,
        td {
          border-bottom: 1px solid rgba(179, 199, 207, 0.09);
          padding: 13px 14px;
          text-align: left;
          vertical-align: middle;
        }
        th {
          background: rgba(255, 255, 255, 0.04);
          color: #aebdc4;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          white-space: nowrap;
        }
        td {
          color: #e7eef2;
          font-size: 13px;
        }
        tr {
          cursor: pointer;
        }
        tr:hover td,
        tr.selected td {
          background: rgba(29, 155, 255, 0.1);
        }
        .tickerButton {
          background: rgba(255, 153, 0, 0.13);
          border: 1px solid rgba(255, 153, 0, 0.44);
          color: #fff;
          min-height: 32px;
          min-width: 58px;
        }
        :global(.score) {
          display: grid;
          gap: 6px;
          min-width: 96px;
        }
        :global(.score strong) {
          color: #fff;
        }
        :global(.scoreBar),
        :global(.componentBar) {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          height: 8px;
          overflow: hidden;
        }
        :global(.scoreBar i),
        :global(.componentBar i) {
          background: linear-gradient(90deg, #ff9900, #1d9bff);
          border-radius: inherit;
          display: block;
          height: 100%;
        }
        :global(.signal) {
          border-radius: 999px;
          display: inline-flex;
          font-size: 11px;
          font-weight: 950;
          justify-content: center;
          min-width: 88px;
          padding: 7px 10px;
        }
        :global(.signal.strong),
        :global(.signal.buy) {
          background: rgba(35, 209, 139, 0.14);
          border: 1px solid rgba(35, 209, 139, 0.38);
          color: #b8f4e6;
        }
        :global(.signal.strong) {
          background: rgba(34, 255, 163, 0.18);
          border-color: rgba(34, 255, 163, 0.55);
          color: #c8ffe8;
        }
        :global(.signal.watch) {
          background: rgba(250, 204, 21, 0.14);
          border: 1px solid rgba(250, 204, 21, 0.34);
          color: #ffe98a;
        }
        :global(.signal.wait) {
          background: rgba(255, 153, 0, 0.14);
          border: 1px solid rgba(255, 153, 0, 0.38);
          color: #ffd7a1;
        }
        .actionLink {
          background: rgba(29, 155, 255, 0.12);
          border: 1px solid rgba(29, 155, 255, 0.34);
          border-radius: 999px;
          color: #d7efff;
          display: inline-flex;
          font-size: 12px;
          font-weight: 950;
          padding: 7px 12px;
          text-decoration: none;
        }
        :global(.signal.sell),
        :global(.signal.exit),
        :global(.signal.noTrade) {
          background: rgba(255, 92, 92, 0.14);
          border: 1px solid rgba(255, 92, 92, 0.38);
          color: #ffc8c8;
        }
        :global(.signal.info) {
          background: rgba(29, 155, 255, 0.14);
          border: 1px solid rgba(29, 155, 255, 0.38);
          color: #d7efff;
        }
        .split {
          display: grid;
          gap: 18px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .plannerGrid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          padding: 16px;
        }
        .plannerActions {
          align-items: center;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          padding: 0 16px 16px;
        }
        .plannerActions button {
          background: #ff9900;
          min-height: 40px;
        }
        .plannerActions span,
        .plannerActions small {
          color: #aebdc4;
          font-size: 12px;
          font-weight: 850;
        }
        .plannerActions small {
          color: #b8f4e6;
          width: 100%;
        }
        .whyGrid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          padding: 16px;
        }
        .whyPanel :global(.metric:last-child) {
          grid-column: 1 / -1;
        }
        :global(.metric) {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 14px;
        }
        :global(.metric strong) {
          color: #fff;
          display: block;
          font-size: 20px;
          margin-top: 8px;
        }
        .positions {
          padding: 16px;
        }
        .positionMini,
        .attentionItem {
          align-items: center;
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          display: grid;
          gap: 8px;
          grid-template-columns: auto 1fr auto;
          margin-bottom: 8px;
          padding: 12px;
        }
        .positionMini strong,
        .attentionItem strong {
          color: #fff;
        }
        .positionMini span,
        .attentionItem span,
        .positionMini small,
        .attentionItem small {
          color: #aebdc4;
        }
        .attentionList {
          padding: 16px;
        }
        .attentionItem.target {
          border-color: rgba(35, 209, 139, 0.38);
          box-shadow: 0 0 24px rgba(35, 209, 139, 0.08);
        }
        .attentionItem.stop {
          border-color: rgba(255, 92, 92, 0.42);
          box-shadow: 0 0 24px rgba(255, 92, 92, 0.08);
        }
        .attentionItem.alert,
        .attentionItem.triggered {
          border-color: rgba(255, 153, 0, 0.42);
          box-shadow: 0 0 24px rgba(255, 153, 0, 0.09);
        }
        .attentionItem.acknowledged {
          opacity: 0.72;
        }
        .profitText {
          color: #8ff0c3 !important;
        }
        .lossText {
          color: #ff9a9a !important;
        }
        .watchlistChips,
        .performanceGrid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          padding: 16px;
        }
        .watchlistChips a {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          color: #fff;
          display: grid;
          gap: 5px;
          padding: 12px;
          text-decoration: none;
        }
        .watchlistChips span {
          color: #aebdc4;
          font-size: 12px;
        }
        .panelLink {
          background: rgba(29, 155, 255, 0.12);
          border: 1px solid rgba(29, 155, 255, 0.34);
          border-radius: 999px;
          color: #d7efff;
          font-size: 12px;
          font-weight: 950;
          padding: 8px 12px;
          text-decoration: none;
        }
        .positionHeader {
          color: #aebdc4;
          display: grid;
          font-size: 12px;
          font-weight: 950;
          gap: 10px;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          text-transform: uppercase;
        }
        .empty {
          background: rgba(255, 255, 255, 0.045);
          border: 1px dashed rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          color: #aebdc4;
          margin-top: 14px;
          padding: 22px;
          text-align: center;
        }
        .chartControls {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }
        .chartControls button {
          background: rgba(255, 255, 255, 0.055);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #d8e5ea;
          min-height: 34px;
        }
        .chartControls span {
          align-items: center;
          color: #aebdc4;
          display: inline-flex;
          font-size: 12px;
          font-weight: 950;
          min-height: 34px;
          text-transform: uppercase;
        }
        .chartShell {
          height: 620px;
          overflow: hidden;
          position: relative;
        }
        .chart {
          height: 100%;
          width: 100%;
        }
        .visualPlannerOverlay {
          inset: 0;
          pointer-events: none;
          position: absolute;
          z-index: 3;
        }
        .zone {
          left: 62px;
          pointer-events: none;
          position: absolute;
          right: 28px;
        }
        .profitZone {
          background: linear-gradient(180deg, rgba(35, 209, 139, 0.18), rgba(35, 209, 139, 0.04));
          border-top: 1px solid rgba(35, 209, 139, 0.24);
          border-bottom: 1px solid rgba(35, 209, 139, 0.16);
        }
        .riskZone {
          background: linear-gradient(180deg, rgba(255, 92, 92, 0.05), rgba(255, 92, 92, 0.2));
          border-top: 1px solid rgba(255, 92, 92, 0.16);
          border-bottom: 1px solid rgba(255, 92, 92, 0.28);
        }
        .plannerLine {
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
          left: 62px;
          margin: 0;
          min-height: 28px;
          padding: 0;
          pointer-events: auto;
          position: absolute;
          right: 28px;
          transform: translateY(-50%);
          width: auto;
          z-index: 4;
        }
        .plannerLine:before {
          content: "";
          height: 2px;
          left: 0;
          position: absolute;
          right: 0;
          top: 13px;
        }
        .plannerLine span,
        .plannerLine strong {
          border-radius: 999px;
          box-shadow: 0 8px 22px rgba(0, 0, 0, 0.28);
          position: relative;
          z-index: 1;
        }
        .plannerLine span {
          padding: 6px 10px;
        }
        .plannerLine strong {
          padding: 6px 10px;
        }
        .targetLine:before,
        .targetLine span,
        .targetLine strong {
          background: rgba(35, 209, 139, 0.92);
          color: #03130d;
        }
        .entryLine:before,
        .entryLine span,
        .entryLine strong {
          background: rgba(94, 189, 255, 0.94);
          color: #03111d;
        }
        .stopLine:before,
        .stopLine span,
        .stopLine strong {
          background: rgba(255, 92, 92, 0.94);
          color: #210606;
        }
        .plannerLine.dragging span,
        .plannerLine.dragging strong {
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.18), 0 12px 30px rgba(0, 0, 0, 0.35);
        }
        .visualPlannerPanel {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(5, minmax(0, 1fr)) minmax(280px, 1.4fr);
          padding: 16px;
        }
        .visualPlannerPanel > div:not(.visualPlannerButtons) {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 12px;
        }
        .visualPlannerPanel span {
          color: #aebdc4;
          display: block;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 7px;
          text-transform: uppercase;
        }
        .visualPlannerPanel strong {
          color: #fff;
          font-size: 18px;
        }
        .visualPlannerButtons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .visualPlannerButtons button {
          flex: 1 1 150px;
          min-height: 38px;
          padding: 0 12px;
        }
        .visualPlannerPanel p {
          color: #aebdc4;
          font-size: 12px;
          font-weight: 800;
          grid-column: 1 / -1;
          line-height: 1.5;
          margin: 0;
        }
        .chartState {
          align-items: center;
          background: rgba(5, 8, 11, 0.78);
          color: #d8e5ea;
          display: flex;
          font-weight: 900;
          inset: 0;
          justify-content: center;
          position: absolute;
          z-index: 2;
        }
        .chartState.warning {
          color: #ffe98a;
        }
        .dataLabel {
          background: rgba(5, 8, 11, 0.82);
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 999px;
          color: #d7efff;
          font-size: 12px;
          font-weight: 950;
          padding: 7px 10px;
          position: absolute;
          right: 14px;
          top: 12px;
          z-index: 4;
        }
        .alerts,
        .components {
          display: grid;
          gap: 10px;
          padding: 16px;
        }
        .alerts {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .alerts span {
          background: rgba(29, 155, 255, 0.1);
          border: 1px solid rgba(29, 155, 255, 0.22);
          border-radius: 999px;
          color: #d7efff;
          font-size: 13px;
          font-weight: 850;
          padding: 10px 12px;
        }
        :global(.component) {
          display: grid;
          gap: 7px;
        }
        :global(.componentHeader) {
          align-items: center;
          color: #d8e5ea;
          display: flex;
          font-size: 13px;
          font-weight: 850;
          justify-content: space-between;
        }
        footer {
          color: #aebdc4;
          font-size: 13px;
          margin-top: 20px;
          padding-bottom: 12px;
        }
        @media (max-width: 1200px) {
          .hero,
          .workspace,
          .split {
            grid-template-columns: 1fr;
          }
          .hero {
            align-items: stretch;
            flex-direction: column;
          }
          .heroStats,
          .summary,
          .insightGrid,
          .plannerGrid,
          .whyGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .sidebar {
            position: static;
          }
          .visualPlannerPanel {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .visualPlannerButtons {
            grid-column: 1 / -1;
          }
        }
        @media (max-width: 760px) {
          .page {
            padding: 88px 16px 16px;
          }
          .heroStats,
          .summary,
          .insightGrid,
          .plannerGrid,
          .whyGrid,
          .alerts {
            grid-template-columns: 1fr;
          }
          .chartShell {
            height: 520px;
          }
          .visualPlannerPanel {
            grid-template-columns: 1fr;
          }
          .plannerLine {
            left: 42px;
            right: 12px;
          }
          .zone {
            left: 42px;
            right: 12px;
          }
        }
      `}</style>
    </div>
  );
}

function Score({ value }) {
  return (
    <div className="score">
      <strong>{Number.isFinite(value) ? value : "--"}</strong>
      <div className="scoreBar"><i style={{ width: `${clamp(value || 0)}%` }} /></div>
    </div>
  );
}

function InsightList({ title, rows, metric }) {
  return (
    <article className="insightCard">
      <div className="insightHeader">
        <h2>{title}</h2>
      </div>
      {rows?.length ? rows.map((row) => (
        <Link className="insightRow" href={`/freedom-trader/company/${row.symbol}`} key={`${title}-${row.symbol}`}>
          <span>{row.symbol}</span>
          <strong>{metric(row)}</strong>
        </Link>
      )) : (
        <div className="insightRow">
          <span>No matches yet</span>
          <strong>--</strong>
        </div>
      )}
    </article>
  );
}

function SignalBadge({ signal }) {
  const normalized = String(signal || "WATCH").toUpperCase();
  const className = normalized.includes("STRONG")
    ? "strong"
    : normalized.includes("BUY")
      ? "buy"
      : normalized.startsWith("WAIT")
        ? "wait"
          : normalized === "NO TRADE"
            ? "noTrade"
            : normalized === "INFO"
              ? "info"
          : normalized === "SELL"
            ? "sell"
            : normalized === "EXIT"
              ? "exit"
              : "watch";
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

function ComponentBar({ label, weight, value }) {
  return (
    <div className="component">
      <div className="componentHeader">
        <span>{label} ({weight})</span>
        <strong>{formatNumber(value)}</strong>
      </div>
      <div className="componentBar"><i style={{ width: `${clamp(value || 0)}%` }} /></div>
    </div>
  );
}

FreedomTrader.getLayout = function getLayout(page) {
  return page;
};

FreedomTrader.disableLayout = true;
