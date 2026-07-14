import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";

const PASSWORD_SALT = "freedom-terminal-v1";
const STORAGE_KEY = "freedom-trader-unlocked";

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
        .gateScreen { align-items: center; background: radial-gradient(circle at 18% 8%, rgba(255, 153, 0, 0.24), transparent 34rem), #05080b; color: #f6f8f9; display: flex; font-family: Inter, ui-sans-serif, system-ui; justify-content: center; min-height: 100vh; padding: 24px; }
        .gate { background: rgba(8, 14, 17, 0.95); border: 1px solid rgba(255, 153, 0, 0.24); border-radius: 8px; max-width: 460px; padding: 34px; width: 100%; }
        span { color: #5ebdff; display: block; font-size: 12px; font-weight: 950; margin-bottom: 10px; text-transform: uppercase; }
        h1, p { margin: 0; }
        h1 { font-size: 42px; }
        p { color: #aab8be; margin-top: 10px; }
        input { background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 7px; color: #fff; font-size: 16px; height: 48px; margin-top: 24px; padding: 0 14px; width: 100%; }
        small { color: #ffb1a5; display: block; margin-top: 10px; }
        button { background: linear-gradient(135deg, #ff9900, #1d9bff); border: 0; border-radius: 7px; color: #061014; cursor: pointer; font-weight: 950; height: 48px; margin-top: 18px; width: 100%; }
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
  const [unlocked, setUnlocked] = useState(false);
  const [checkingStorage, setCheckingStorage] = useState(true);
  const [quote, setQuote] = useState(null);
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setUnlocked(window.localStorage.getItem(STORAGE_KEY) === "true");
    setCheckingStorage(false);
  }, []);

  useEffect(() => {
    async function load() {
      if (!unlocked || !symbol) return;
      try {
        setLoading(true);
        setError("");
        const [quoteResponse, historyResponse] = await Promise.all([
          fetch(`/api/freedom/quotes?symbol=${symbol}`),
          fetch(`/api/freedom/history?symbol=${symbol}&range=1y&interval=1d`),
        ]);
        const quoteData = await quoteResponse.json().catch(() => null);
        const historyData = await historyResponse.json().catch(() => null);
        if (!quoteResponse.ok || !quoteData?.quotes?.[0]) throw new Error(quoteData?.error || "Live quote unavailable.");
        if (!historyResponse.ok || !historyData?.ok) throw new Error(historyData?.error || "Historical data temporarily unavailable.");
        setQuote(quoteData.quotes[0]);
        setCandles(historyData.candles || []);
      } catch (err) {
        console.error("Freedom Trader company load failed:", err);
        setError(err.message || "Trading data temporarily unavailable.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [symbol, unlocked]);

  const setup = useMemo(() => analyseSetup(symbol, quote || {}, candles), [symbol, quote, candles]);
  const closes = candles.map((candle) => candle.close);
  const chartData = useMemo(() => ({
    dates: candles.map((candle) => candle.date),
    candles: candles.map((candle) => [candle.open, candle.close, candle.low, candle.high]),
    volume: candles.map((candle) => candle.volume || 0),
    ma20: sma(closes, 20),
    ma50: sma(closes, 50),
    ma200: sma(closes, 200),
    rsi: closes.map((_, index) => rsi(closes.slice(0, index + 1))),
    macd: closes.map((_, index) => macd(closes.slice(0, index + 1)).histogram || 0),
  }), [candles, closes]);

  useEffect(() => {
    let disposed = false;
    async function renderChart() {
      if (!chartNodeRef.current || !chartData.candles.length) return;
      const echarts = await import("echarts");
      if (disposed) return;
      if (!chartRef.current) chartRef.current = echarts.init(chartNodeRef.current, null, { renderer: "canvas" });
      chartRef.current.setOption({
        backgroundColor: "transparent",
        animation: false,
        tooltip: { trigger: "axis", axisPointer: { type: "cross" }, backgroundColor: "rgba(5,8,11,0.96)", borderColor: "rgba(94,189,255,0.35)", textStyle: { color: "#f6f8f9" } },
        axisPointer: { link: [{ xAxisIndex: "all" }] },
        grid: [
          { left: 62, right: 26, top: 22, height: "48%" },
          { left: 62, right: 26, top: "58%", height: "10%" },
          { left: 62, right: 26, top: "72%", height: "9%" },
          { left: 62, right: 26, top: "86%", height: "8%" },
        ],
        dataZoom: [
          { type: "inside", xAxisIndex: [0, 1, 2, 3], start: 45, end: 100 },
          { type: "slider", xAxisIndex: [0, 1, 2, 3], bottom: 0, height: 20, textStyle: { color: "#aebdc4" } },
        ],
        xAxis: [0, 1, 2, 3].map((gridIndex) => ({ type: "category", gridIndex, data: chartData.dates, axisLabel: { color: "#aebdc4", show: gridIndex === 0 }, axisLine: { lineStyle: { color: "#23313a" } } })),
        yAxis: [
          { scale: true, axisLabel: { color: "#aebdc4" }, splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } } },
          { scale: true, gridIndex: 1, axisLabel: { color: "#aebdc4" }, splitLine: { show: false } },
          { min: 0, max: 100, gridIndex: 2, axisLabel: { color: "#aebdc4" }, splitLine: { show: false } },
          { scale: true, gridIndex: 3, axisLabel: { color: "#aebdc4" }, splitLine: { show: false } },
        ],
        series: [
          { name: symbol, type: "candlestick", data: chartData.candles, itemStyle: { color: "#23d18b", color0: "#ff5c5c", borderColor: "#23d18b", borderColor0: "#ff5c5c" },
            markLine: { symbol: "none", label: { color: "#d8e5ea" }, lineStyle: { type: "dashed" }, data: [
              Number.isFinite(setup.support) ? { name: "Support", yAxis: setup.support, lineStyle: { color: "#22c55e" } } : null,
              Number.isFinite(setup.resistance) ? { name: "Resistance", yAxis: setup.resistance, lineStyle: { color: "#f97316" } } : null,
            ].filter(Boolean) } },
          { name: "MA20", type: "line", data: chartData.ma20, smooth: true, showSymbol: false, lineStyle: { color: "#00e5ff", width: 2 } },
          { name: "MA50", type: "line", data: chartData.ma50, smooth: true, showSymbol: false, lineStyle: { color: "#facc15", width: 2 } },
          { name: "MA200", type: "line", data: chartData.ma200, smooth: true, showSymbol: false, lineStyle: { color: "#a855f7", width: 2 } },
          { name: "Volume", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: chartData.volume, itemStyle: { color: "rgba(29,155,255,0.45)" } },
          { name: "RSI", type: "line", xAxisIndex: 2, yAxisIndex: 2, data: chartData.rsi, smooth: true, showSymbol: false, lineStyle: { color: "#5ebdff", width: 1.8 } },
          { name: "MACD", type: "bar", xAxisIndex: 3, yAxisIndex: 3, data: chartData.macd, itemStyle: { color: (params) => (params.value >= 0 ? "#23d18b" : "#ff5c5c") } },
        ],
      });
    }
    renderChart();
    const resize = () => chartRef.current?.resize();
    window.addEventListener("resize", resize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
    };
  }, [chartData, setup, symbol]);

  if (checkingStorage) return <div className="boot">Opening Freedom Trader...</div>;
  if (!unlocked) return <PasswordGate passwordHash={passwordHash} onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="page" style={{ "--company-primary": company.primaryColor, "--company-secondary": company.secondaryColor }}>
      <Head><title>{symbol} | Freedom Trader</title></Head>
      <header className="hero">
        <Link className="back" href="/freedom-trader">Back to Freedom Trader</Link>
        <div className="heroMain">
          <span className="logo">{company.logoText}</span>
          <div>
            <h1>{company.companyName}</h1>
            <p>{symbol} / {company.sector} / {formatCurrency(setup.currentPrice)}</p>
          </div>
          <SignalBadge signal={setup.status} />
        </div>
      </header>

      {error ? <section className="alert">{error}</section> : null}
      {loading ? <section className="notice">Loading trading data...</section> : null}

      <section className="cards">
        <Metric label="Trading Score" value={`${setup.tradingScore || "--"}/100`} />
        <Metric label="Live Price" value={formatCurrency(setup.currentPrice)} />
        <Metric label="Daily Change" value={formatPercent(setup.changePercent)} />
        <Metric label="RSI 14" value={formatNumber(setup.rsi)} />
        <Metric label="MACD Signal" value={formatNumber(setup.macdSignal)} />
        <Metric label="Relative Volume" value={`${formatNumber(setup.relativeVolume)}x`} />
      </section>

      <section className="chartPanel">
        <div className="panelHeader">
          <div>
            <h2>Professional Trading Chart</h2>
            <p>Candles, volume, MA20, MA50, MA200, RSI, MACD, support and resistance.</p>
          </div>
        </div>
        <div ref={chartNodeRef} className="chart" />
      </section>

      <section className="split">
        <article className="panel">
          <h2>Trade Setup</h2>
          <div className="grid">
            <Metric label="Entry" value={formatCurrency(setup.entry)} />
            <Metric label="Target" value={formatCurrency(setup.target)} />
            <Metric label="Stop" value={formatCurrency(setup.stop)} />
            <Metric label="Risk / Share" value={formatCurrency(setup.risk)} />
            <Metric label="Reward / Share" value={formatCurrency(setup.reward)} />
            <Metric label="Risk/Reward" value={formatNumber(setup.riskReward)} />
            <Metric label="Suggested Qty" value={`${setup.suggestedQuantity || 1} shares`} />
            <Metric label="Max Dollar Risk" value={formatCurrency(setup.maximumRisk)} />
            <Metric label="Expected Hold" value={setup.expectedHoldingPeriod} />
            <Metric label="Setup Expiry" value={new Date(setup.expiresAt).toLocaleDateString()} />
          </div>
          <p className="reason">{setup.reasoning}</p>
        </article>
        <article className="panel">
          <h2>Alert Controls</h2>
          <div className="alerts">
            {["ENTRY REACHED", "TARGET REACHED", "STOP REACHED", "BREAKOUT", "BREAKDOWN", "VOLUME SPIKE", "RSI OVERSOLD", "RSI OVERBOUGHT", "SETUP EXPIRED"].map((alert) => (
              <button type="button" key={alert}>{alert}</button>
            ))}
          </div>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Trade notes" />
        </article>
      </section>

      <footer>Freedom Trader is separate from Freedom Investment. Trading research only. Not financial advice.</footer>

      <style jsx>{`
        .boot, .page { background: radial-gradient(circle at 10% 0%, rgba(255,153,0,.2), transparent 34rem), radial-gradient(circle at 86% 8%, rgba(29,155,255,.16), transparent 30rem), #05080b; color: #f5f7f8; font-family: Inter, ui-sans-serif, system-ui; min-height: 100vh; }
        .boot { align-items: center; display: flex; font-weight: 900; justify-content: center; }
        .page { padding: 28px; }
        .hero, .cards, .chartPanel, .split, footer, .alert, .notice { margin-left: auto; margin-right: auto; max-width: 1760px; }
        .hero { background: linear-gradient(135deg, color-mix(in srgb, var(--company-primary) 30%, transparent), rgba(29,155,255,.18)), rgba(8,14,17,.96); border: 1px solid color-mix(in srgb, var(--company-primary) 42%, transparent); border-radius: 8px; padding: 28px; }
        .back { color: #d7efff; font-size: 18px; font-weight: 900; text-decoration: none; }
        .heroMain { align-items: center; display: flex; gap: 18px; margin-top: 24px; }
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
        .panelHeader { border-bottom: 1px solid rgba(179,199,207,.1); padding: 18px 20px; }
        .chart { height: 660px; width: 100%; }
        .split { display: grid; gap: 18px; grid-template-columns: 1.25fr .75fr; }
        .panel { padding: 18px; }
        .grid { display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 16px; }
        .reason { line-height: 1.6; margin-top: 16px; }
        .alerts { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 16px; }
        button { background: rgba(29,155,255,.12); border: 1px solid rgba(29,155,255,.3); border-radius: 7px; color: #d7efff; cursor: pointer; font-weight: 900; min-height: 38px; }
        textarea { background: rgba(255,255,255,.055); border: 1px solid rgba(255,255,255,.12); border-radius: 8px; color: #fff; min-height: 130px; margin-top: 16px; padding: 12px; resize: vertical; width: 100%; }
        .alert, .notice { border-radius: 8px; font-weight: 850; margin-top: 18px; padding: 14px 16px; }
        .alert { background: rgba(255,92,92,.14); border: 1px solid rgba(255,92,92,.28); color: #ffd8d3; }
        .notice { background: rgba(29,155,255,.12); border: 1px solid rgba(29,155,255,.24); color: #d7efff; }
        footer { font-size: 13px; margin-top: 20px; padding-bottom: 12px; }
        :global(.signal) { border-radius: 999px; display: inline-flex; font-size: 12px; font-weight: 950; padding: 8px 12px; }
        :global(.signal.strong), :global(.signal.buy) { background: rgba(35,209,139,.14); border: 1px solid rgba(35,209,139,.38); color: #b8f4e6; }
        :global(.signal.watch) { background: rgba(250,204,21,.14); border: 1px solid rgba(250,204,21,.34); color: #ffe98a; }
        :global(.signal.wait) { background: rgba(148,163,184,.14); border: 1px solid rgba(148,163,184,.34); color: #dbe4ea; }
        :global(.signal.noTrade) { background: rgba(255,92,92,.14); border: 1px solid rgba(255,92,92,.38); color: #ffc8c8; }
        @media (max-width: 1100px) { .cards, .split, .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 760px) { .page { padding: 16px; } .cards, .split, .grid, .alerts { grid-template-columns: 1fr; } .heroMain { align-items: flex-start; flex-direction: column; } .chart { height: 520px; } }
      `}</style>
    </div>
  );
}

function SignalBadge({ signal }) {
  const normalized = String(signal || "WATCH").toUpperCase();
  const className = normalized.includes("STRONG") ? "strong" : normalized.includes("BUY") ? "buy" : normalized === "WAIT" ? "wait" : normalized === "NO TRADE" ? "noTrade" : "watch";
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
