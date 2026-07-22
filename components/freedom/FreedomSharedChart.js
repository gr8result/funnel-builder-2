export const FREEDOM_CHART_TYPES = [
  { label: "Standard candlesticks", value: "candles" },
  { label: "Hollow candlesticks", value: "hollow" },
  { label: "OHLC bars", value: "ohlc" },
  { label: "Line", value: "line" },
  { label: "Area/fill", value: "area" },
  { label: "Heikin-Ashi", value: "heikin" },
];

export const FREEDOM_CHART_MODE_LABELS = FREEDOM_CHART_TYPES.map((item) => item.label);

export const FREEDOM_DISPLAY_TOGGLES = [
  ["tradePlan", "Show trade plan"],
  ["completedTrades", "Show completed trades"],
  ["openPositions", "Show open positions"],
  ["alerts", "Show alerts"],
  ["fibonacci", "Show Fibonacci"],
  ["volume", "Show volume"],
];

function roundPrice(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
}

export function normalizeChartType(value) {
  const normalized = String(value || "").trim();
  if (normalized === "Candles" || normalized === "Standard candlesticks") return "candles";
  if (normalized === "Hollow candlesticks") return "hollow";
  if (normalized === "OHLC bars") return "ohlc";
  if (normalized === "Line") return "line";
  if (normalized === "Area" || normalized === "Area/fill") return "area";
  if (normalized === "Heikin-Ashi") return "heikin";
  return FREEDOM_CHART_TYPES.some((item) => item.value === normalized) ? normalized : "candles";
}

export function chartTypeLabel(value) {
  return FREEDOM_CHART_TYPES.find((item) => item.value === normalizeChartType(value))?.label || "Standard candlesticks";
}

export function buildHeikinAshiCandles(candles) {
  let previousOpen = null;
  let previousClose = null;
  return (candles || []).map((candle) => {
    const close = roundPrice((Number(candle.open) + Number(candle.high) + Number(candle.low) + Number(candle.close)) / 4);
    const open = roundPrice(previousOpen === null || previousClose === null ? (Number(candle.open) + Number(candle.close)) / 2 : (previousOpen + previousClose) / 2);
    const high = roundPrice(Math.max(Number(candle.high), open, close));
    const low = roundPrice(Math.min(Number(candle.low), open, close));
    previousOpen = open;
    previousClose = close;
    return { ...candle, open, high, low, close };
  });
}

export function FreedomChartTypeSelector({ className = "chartTypeSelect", value, onChange }) {
  return (
    <label className={className}>
      Chart Type
      <select value={normalizeChartType(value)} onChange={(event) => onChange?.(event.target.value)}>
        {FREEDOM_CHART_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </label>
  );
}

export function FreedomChartDisplayToggles({ className = "displayToggles", toggles, onChange }) {
  return (
    <div className={className} aria-label="Chart display toggles">
      {FREEDOM_DISPLAY_TOGGLES.map(([key, label]) => (
        <label key={key}>
          <input
            checked={Boolean(toggles?.[key])}
            onChange={(event) => onChange?.({ ...(toggles || {}), [key]: event.target.checked })}
            type="checkbox"
          />
          {label}
        </label>
      ))}
    </div>
  );
}
