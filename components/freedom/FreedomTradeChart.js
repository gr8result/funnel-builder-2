import { useMemo } from "react";
import FreedomVolatilityPanel, { volatilityFromCandles } from "./FreedomVolatilityPanel.js";

/**
 * Compact candlestick chart with the trade levels drawn on it.
 *
 * Inline SVG rather than a charting dependency: the three Freedom pages only need price
 * candles plus horizontal marker lines, and this keeps the grid of charts fast.
 * Renders nothing but an explicit "no data" panel when candles are missing - it never
 * draws an empty axis that could be mistaken for a flat market.
 */

const TONE_COLOURS = {
  entry: "#2b6ce0",
  current: "#e8eef2",
  safety: "#d93a3a",
  target: "#18a058",
};

function isKnownPrice(value) {
  return value !== null && value !== undefined && value !== "" && typeof value !== "boolean" && Number.isFinite(Number(value));
}

function niceBounds(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return null;
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (min === max) {
    min -= min * 0.02 || 1;
    max += max * 0.02 || 1;
  }
  const padding = (max - min) * 0.08;
  return { min: min - padding, max: max + padding };
}

export default function FreedomTradeChart({
  candles = [],
  entryPrice = null,
  currentPrice = null,
  safetyExit = null,
  targets = [],
  height = 220,
  ariaLabel = "Price chart",
  volatility = null,
}) {
  const model = useMemo(() => {
    const rows = (candles || []).filter(
      (candle) => Number.isFinite(Number(candle?.high)) && Number.isFinite(Number(candle?.low)),
    );
    if (rows.length < 2) return null;

    const markers = [entryPrice, currentPrice, safetyExit, ...(targets || [])].filter(isKnownPrice).map(Number);
    const bounds = niceBounds([
      ...rows.map((candle) => Number(candle.high)),
      ...rows.map((candle) => Number(candle.low)),
      ...markers,
    ]);
    if (!bounds) return null;
    return { rows, bounds, volatility: volatility || volatilityFromCandles(rows) };
  }, [candles, entryPrice, currentPrice, safetyExit, targets, volatility]);

  if (!model) {
    return (
      <div className="fdChartEmpty" role="img" aria-label={ariaLabel + ": no chart data available"}>
        <span>No chart data</span>
        <style jsx>{`
          .fdChartEmpty {
            align-items: center;
            background: rgba(123, 135, 143, 0.12);
            border: 1px dashed rgba(123, 135, 143, 0.5);
            border-radius: 10px;
            color: #7b878f;
            display: flex;
            font-size: 15px;
            font-weight: 800;
            height: ${height}px;
            justify-content: center;
          }
        `}</style>
      </div>
    );
  }

  const { rows, bounds, volatility: summary } = model;
  const width = 600;
  const padRight = 8;
  const plotWidth = width - padRight;
  const span = bounds.max - bounds.min;
  const y = (price) => height - ((Number(price) - bounds.min) / span) * height;
  const slot = plotWidth / rows.length;
  const bodyWidth = Math.max(1.4, slot * 0.62);

  const markerLines = [
    { value: safetyExit, colour: TONE_COLOURS.safety, label: "Safety Exit", dash: "6 4" },
    { value: entryPrice, colour: TONE_COLOURS.entry, label: "Entry", dash: "6 4" },
    ...(targets || []).filter(isKnownPrice).map((value, index) => ({
      value, colour: TONE_COLOURS.target, label: "Target " + (index + 1), dash: "4 4",
    })),
    { value: currentPrice, colour: TONE_COLOURS.current, label: "Now", dash: null },
  ].filter((line) => isKnownPrice(line.value));

  return (
    <div className="fdChartWrap">
      <FreedomVolatilityPanel volatility={summary} compact />
      <svg
        className="fdChart"
        viewBox={"0 0 " + width + " " + height}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
      >
      {rows.map((candle, index) => {
        const open = Number(candle.open);
        const close = Number(candle.close);
        const rising = close >= open;
        const colour = rising ? "#18a058" : "#d93a3a";
        const x = index * slot + slot / 2;
        const bodyTop = y(Math.max(open, close));
        const bodyBottom = y(Math.min(open, close));
        return (
          <g key={candle.date || index}>
            <line x1={x} x2={x} y1={y(Number(candle.high))} y2={y(Number(candle.low))} stroke={colour} strokeWidth="1" />
            <rect
              x={x - bodyWidth / 2}
              y={bodyTop}
              width={bodyWidth}
              height={Math.max(1, bodyBottom - bodyTop)}
              fill={colour}
            />
          </g>
        );
      })}

      {markerLines.map((line) => {
        const lineY = y(Number(line.value));
        return (
          <g key={line.label}>
            <line
              x1="0"
              x2={plotWidth}
              y1={lineY}
              y2={lineY}
              stroke={line.colour}
              strokeWidth={line.label === "Now" ? 1.6 : 1.2}
              strokeDasharray={line.dash || undefined}
              opacity={line.label === "Now" ? 0.95 : 0.8}
            />
            <text x="4" y={lineY - 3} fill={line.colour} fontSize="11" fontWeight="700">
              {line.label} {Number(line.value).toFixed(3)}
            </text>
          </g>
        );
      })}

        {Number.isFinite(Number(summary?.averageDailyRange)) && Number.isFinite(Number(summary?.averageDailyMovementPercent)) ? (
          <text x={plotWidth - 6} y="16" textAnchor="end" fill="#a5b3bc" fontSize="11" fontWeight="800">
            Avg daily range {Number(summary.averageDailyRange).toFixed(2)} / {Number(summary.averageDailyMovementPercent).toFixed(2)}%
          </text>
        ) : null}

        <style jsx>{`
          .fdChart {
            display: block;
            height: ${height}px;
            width: 100%;
          }
        `}</style>
      </svg>
    </div>
  );
}
