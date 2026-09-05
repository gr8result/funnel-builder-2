import { supabase } from "../../lib/supabaseClient";
import { portfolioHeaders } from "../../lib/freedom/portfolioClient.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CHART_RANGES,
  DEFAULT_CHART_RANGE,
  chartStatusFor,
  computePriceScale,
  movingAverage,
  relativeStrengthIndex,
} from "../../lib/freedom/chartAnalysis.js";
import { formatMoney, formatTimestamp } from "./FreedomShell.js";
import FreedomVolatilityPanel, { volatilityFromCandles } from "./FreedomVolatilityPanel.js";

/**
 * Large historical candlestick chart for one opportunity.
 *
 * Renders real OHLCV candles with a volume panel, the trade levels marked, optional
 * indicators, and zoom/pan. Draws nothing when data is missing - an explicit error is
 * shown instead, so sample data can never be mistaken for live market history.
 *
 * Marker colours are fixed by the brief:
 *   blue  - buy trigger
 *   red   - Safety Exit
 *   green - targets
 *   amber - support and resistance
 */

const COLOURS = {
  entry: "#2b6ce0",
  safety: "#d93a3a",
  target: "#18a058",
  level: "#d08700",
  current: "#ffffff",
  up: "#18a058",
  down: "#d93a3a",
  ma20: "#8ab4ff",
  ma50: "#d08700",
  ma200: "#c78bff",
};

const VIEW_WIDTH = 1000;
const PRICE_HEIGHT = 380;
const VOLUME_HEIGHT = 90;
const RSI_HEIGHT = 90;
const AXIS_WIDTH = 62;

function niceTicks(min, max, count = 5) {
  if (!(max > min)) return [];
  const rawStep = (max - min) / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) || magnitude * 10;
  const ticks = [];
  for (let value = Math.ceil(min / step) * step; value <= max; value += step) ticks.push(value);
  return ticks;
}

function formatVolume(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  if (number >= 1e9) return (number / 1e9).toFixed(1) + "B";
  if (number >= 1e6) return (number / 1e6).toFixed(1) + "M";
  if (number >= 1e3) return (number / 1e3).toFixed(0) + "K";
  return String(number);
}

export default function FreedomChartModal({ opportunity, onClose }) {
  const [range, setRange] = useState(DEFAULT_CHART_RANGE);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [indicators, setIndicators] = useState({ ma20: false, ma50: false, ma200: false, rsi: false, volume: true });
  // view is the visible slice of the candle array; panning and zooming move it.
  const [view, setView] = useState(null);
  const dragRef = useRef(null);
  const dialogRef = useRef(null);

  const symbol = opportunity?.symbol;

  // Escape closes the modal, and focus is moved into it on open.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previouslyFocused = document.activeElement;
    dialogRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (!symbol) return undefined;
    let cancelled = false;
    setLoading(true);
    setData(null);
    setView(null);
    const params = new URLSearchParams({
      symbol,
      range,
      exchange: opportunity?.exchange || "",
      currency: opportunity?.currency || "",
      companyName: opportunity?.companyName || "",
    });
    portfolioHeaders(supabase.auth)
      .then(headers => fetch("/api/freedom/chart?" + params.toString(), { headers }))
      .then((response) => response.json())
      .then((payload) => { if (!cancelled) setData(payload); })
      .catch((error) => {
        if (!cancelled) setData({ ok: false, error: "Could not load historical data: " + (error?.message || "network error"), candles: [] });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, range, opportunity?.exchange, opportunity?.currency, opportunity?.companyName]);

  const allCandles = data?.ok ? data.candles : [];

  useEffect(() => {
    if (allCandles.length) setView({ start: 0, end: allCandles.length });
  }, [allCandles.length]);

  const visible = useMemo(() => {
    if (!allCandles.length) return [];
    const start = Math.max(0, Math.floor(view?.start ?? 0));
    const end = Math.min(allCandles.length, Math.ceil(view?.end ?? allCandles.length));
    return allCandles.slice(start, Math.max(start + 2, end));
  }, [allCandles, view]);

  // Indicators are computed over the full series so values are correct at the left edge
  // of the visible window, then sliced to match.
  const indicatorSeries = useMemo(() => {
    if (!allCandles.length) return null;
    const start = Math.max(0, Math.floor(view?.start ?? 0));
    const end = Math.min(allCandles.length, Math.ceil(view?.end ?? allCandles.length));
    const slice = (series) => series.slice(start, Math.max(start + 2, end));
    return {
      ma20: slice(movingAverage(allCandles, 20)),
      ma50: slice(movingAverage(allCandles, 50)),
      ma200: slice(movingAverage(allCandles, 200)),
      rsi: slice(relativeStrengthIndex(allCandles, 14)),
    };
  }, [allCandles, view]);

  const entryRange = opportunity?.entryRange;
  const markers = useMemo(() => {
    const list = [];
    if (entryRange) {
      list.push({ label: "Buy trigger", value: entryRange.preferred, colour: COLOURS.entry });
      list.push({ label: "Entry low", value: entryRange.low, colour: COLOURS.entry, band: true });
      list.push({ label: "Entry high", value: entryRange.high, colour: COLOURS.entry, band: true });
    }
    if (opportunity?.safetyExit != null) list.push({ label: "Safety Exit", value: opportunity.safetyExit, colour: COLOURS.safety });
    (opportunity?.targets || []).forEach((value, index) => {
      list.push({ label: "Target " + (index + 1), value, colour: COLOURS.target });
    });
    if (data?.support?.value != null) list.push({ label: "Support", value: data.support.value, colour: COLOURS.level, dashed: true });
    if (data?.resistance?.value != null) list.push({ label: "Resistance", value: data.resistance.value, colour: COLOURS.level, dashed: true });
    if (data?.currentPrice != null) list.push({ label: "Current", value: data.currentPrice, colour: COLOURS.current, solid: true });
    return list;
  }, [entryRange, opportunity, data]);

  const scale = useMemo(() => {
    if (!visible.length) return null;
    const withIndicators = indicators.ma200 && indicatorSeries
      ? [...visible, ...indicatorSeries.ma200.filter((v) => v != null).map((v) => ({ high: v, low: v }))]
      : visible;
    return computePriceScale(withIndicators, markers);
  }, [visible, markers, indicators.ma200, indicatorSeries]);

  const status = useMemo(() => chartStatusFor({
    action: opportunity?.action,
    currentPrice: data?.currentPrice ?? opportunity?.currentPrice,
    entryLow: entryRange?.low,
    entryHigh: entryRange?.high,
    safetyExit: opportunity?.safetyExit,
  }), [opportunity, data, entryRange]);

  // ---- zoom & pan -------------------------------------------------------
  const zoomBy = useCallback((factor, anchorFraction = 0.5) => {
    setView((current) => {
      const total = allCandles.length;
      if (!total) return current;
      const start = current?.start ?? 0;
      const end = current?.end ?? total;
      const width = end - start;
      const anchor = start + width * anchorFraction;
      const nextWidth = Math.max(10, Math.min(total, width * factor));
      let nextStart = anchor - nextWidth * anchorFraction;
      let nextEnd = nextStart + nextWidth;
      if (nextStart < 0) { nextStart = 0; nextEnd = nextWidth; }
      if (nextEnd > total) { nextEnd = total; nextStart = total - nextWidth; }
      return { start: Math.max(0, nextStart), end: nextEnd };
    });
  }, [allCandles.length]);

  const onWheel = useCallback((event) => {
    if (!allCandles.length) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    zoomBy(event.deltaY > 0 ? 1.18 : 0.85, fraction);
  }, [zoomBy, allCandles.length]);

  const onPointerDown = useCallback((event) => {
    if (!allCandles.length) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    dragRef.current = { x: event.clientX, width: bounds.width, start: view?.start ?? 0, end: view?.end ?? allCandles.length };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [view, allCandles.length]);

  const onPointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const span = drag.end - drag.start;
    const deltaCandles = ((event.clientX - drag.x) / drag.width) * span;
    let start = drag.start - deltaCandles;
    let end = drag.end - deltaCandles;
    if (start < 0) { start = 0; end = span; }
    if (end > allCandles.length) { end = allCandles.length; start = end - span; }
    setView({ start: Math.max(0, start), end });
  }, [allCandles.length]);

  const endDrag = useCallback(() => { dragRef.current = null; }, []);

  const resetView = useCallback(() => {
    if (allCandles.length) setView({ start: 0, end: allCandles.length });
  }, [allCandles.length]);

  // ---- geometry ---------------------------------------------------------
  const plotWidth = VIEW_WIDTH - AXIS_WIDTH;
  const slot = visible.length ? plotWidth / visible.length : 0;
  const bodyWidth = Math.max(1, Math.min(14, slot * 0.68));
  const priceY = (value) => {
    if (!scale) return 0;
    return PRICE_HEIGHT - ((Number(value) - scale.min) / (scale.max - scale.min)) * PRICE_HEIGHT;
  };
  const maxVolume = visible.length ? Math.max(...visible.map((c) => Number(c.volume) || 0)) : 0;
  const currency = data?.currency || opportunity?.currency || "USD";

  const linePath = (series) => {
    if (!series) return "";
    let path = "";
    let started = false;
    series.forEach((value, index) => {
      if (value == null) { started = false; return; }
      const x = index * slot + slot / 2;
      const y = priceY(value);
      path += (started ? " L" : " M") + x.toFixed(1) + " " + y.toFixed(1);
      started = true;
    });
    return path.trim();
  };

  const showRsi = indicators.rsi;
  const showVolume = indicators.volume;
  const volatility = useMemo(() => (
    visible.length ? volatilityFromCandles(visible) : data?.volatility || opportunity?.volatility || null
  ), [visible, data, opportunity]);

  return (
    <div className="fdChartOverlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="fdChartDialog"
        role="dialog"
        aria-modal="true"
        aria-label={"Historical chart for " + (opportunity?.symbol || "")}
        ref={dialogRef}
        tabIndex={-1}
      >
        <header className="fdChartHeader">
          <div className="fdChartIdentity">
            <h2>{opportunity?.symbol}</h2>
            <p className="fdChartCompany">{opportunity?.companyName || "Unknown company"}</p>
            <p className="fdChartVenue">
              {data?.exchange || opportunity?.exchange || "Unknown exchange"} &middot; {currency}
              {data?.provider ? " · " + data.provider : ""}
            </p>
            <p className="fdChartStamp">
              Market data as at {formatTimestamp(data?.dataTimestamp || opportunity?.dataTimestamp)}
            </p>
          </div>
          <button type="button" className="fdButton secondary fdChartClose" onClick={onClose} aria-label="Close chart">
            Close
          </button>
        </header>

        <div className={"fdChartStatus fdTone-" + status.tone} role="status">{status.label}</div>

        <div className="fdChartControls">
          <div className="fdRangeGroup" role="group" aria-label="Chart timeframe">
            {CHART_RANGES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={"fdRangeButton" + (range === option.id ? " active" : "")}
                onClick={() => setRange(option.id)}
                aria-pressed={range === option.id}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="fdZoomGroup">
            <button type="button" className="fdRangeButton" onClick={() => zoomBy(0.8)} aria-label="Zoom in">Zoom +</button>
            <button type="button" className="fdRangeButton" onClick={() => zoomBy(1.25)} aria-label="Zoom out">Zoom -</button>
            <button type="button" className="fdRangeButton" onClick={resetView}>Reset</button>
          </div>
        </div>

        <details className="fdIndicators" open={indicatorsOpen} onToggle={(e) => setIndicatorsOpen(e.currentTarget.open)}>
          <summary>Indicators</summary>
          <div className="fdIndicatorBody">
            {[
              ["ma20", "Moving average 20"],
              ["ma50", "Moving average 50"],
              ["ma200", "Moving average 200"],
              ["rsi", "RSI (14)"],
              ["volume", "Volume"],
            ].map(([key, label]) => (
              <label key={key} className="fdIndicatorToggle">
                <input
                  type="checkbox"
                  checked={indicators[key]}
                  onChange={(event) => setIndicators({ ...indicators, [key]: event.target.checked })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </details>

        {loading ? <div className="fdChartMessage">Loading historical data...</div> : null}

        {!loading && data && !data.ok ? (
          <div className={"fdChartError" + (data.stale ? " stale" : "")}>
            <strong>{data.stale ? "Historical data is stale" : "Historical data unavailable"}</strong>
            <p>{data.error}</p>
            <p className="fdChartErrorNote">No chart is drawn. Freedom does not display sample or estimated candles.</p>
          </div>
        ) : null}

        {!loading && data?.ok && scale ? (
          <>
            <FreedomVolatilityPanel volatility={volatility} />

            <div
              className="fdChartCanvas"
              onWheel={onWheel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerLeave={endDrag}
            >
              <svg viewBox={"0 0 " + VIEW_WIDTH + " " + (PRICE_HEIGHT + (showVolume ? VOLUME_HEIGHT : 0) + (showRsi ? RSI_HEIGHT : 0))} className="fdChartSvg">
                {/* price grid + axis */}
                {niceTicks(scale.min, scale.max, 5).map((tick) => (
                  <g key={"t" + tick}>
                    <line x1="0" x2={plotWidth} y1={priceY(tick)} y2={priceY(tick)} stroke="rgba(180,200,210,0.14)" strokeWidth="1" />
                    <text x={plotWidth + 6} y={priceY(tick) + 4} fill="#a5b3bc" fontSize="11">{tick.toFixed(2)}</text>
                  </g>
                ))}

                {/* candles */}
                {visible.map((candle, index) => {
                  const open = Number(candle.open);
                  const close = Number(candle.close);
                  const rising = close >= open;
                  const colour = rising ? COLOURS.up : COLOURS.down;
                  const x = index * slot + slot / 2;
                  const top = priceY(Math.max(open, close));
                  const bottom = priceY(Math.min(open, close));
                  return (
                    <g key={candle.date || index}>
                      <line x1={x} x2={x} y1={priceY(candle.high)} y2={priceY(candle.low)} stroke={colour} strokeWidth={Math.max(1, bodyWidth * 0.16)} />
                      <rect x={x - bodyWidth / 2} y={top} width={bodyWidth} height={Math.max(1, bottom - top)} fill={colour} />
                    </g>
                  );
                })}

                {Number.isFinite(Number(volatility?.averageDailyRange)) && Number.isFinite(Number(volatility?.averageDailyMovementPercent)) ? (
                  <text x={plotWidth - 8} y="18" textAnchor="end" fill="#a5b3bc" fontSize="12" fontWeight="800">
                    Avg daily high-low range {formatMoney(volatility.averageDailyRange, currency)} / {Number(volatility.averageDailyMovementPercent).toFixed(2)}%
                  </text>
                ) : null}

                {/* moving averages */}
                {indicators.ma20 && indicatorSeries ? <path d={linePath(indicatorSeries.ma20)} fill="none" stroke={COLOURS.ma20} strokeWidth="1.6" /> : null}
                {indicators.ma50 && indicatorSeries ? <path d={linePath(indicatorSeries.ma50)} fill="none" stroke={COLOURS.ma50} strokeWidth="1.6" /> : null}
                {indicators.ma200 && indicatorSeries ? <path d={linePath(indicatorSeries.ma200)} fill="none" stroke={COLOURS.ma200} strokeWidth="1.6" /> : null}

                {/* entry band */}
                {entryRange && entryRange.low >= scale.min && entryRange.high <= scale.max ? (
                  <rect
                    x="0"
                    y={priceY(entryRange.high)}
                    width={plotWidth}
                    height={Math.max(1, priceY(entryRange.low) - priceY(entryRange.high))}
                    fill="rgba(43,108,224,0.16)"
                  />
                ) : null}

                {/* marker lines */}
                {markers.filter((m) => !m.band).map((marker) => {
                  const value = Number(marker.value);
                  if (!Number.isFinite(value) || value < scale.min || value > scale.max) return null;
                  const y = priceY(value);
                  return (
                    <g key={marker.label}>
                      <line
                        x1="0" x2={plotWidth} y1={y} y2={y}
                        stroke={marker.colour}
                        strokeWidth={marker.solid ? 1.8 : 1.3}
                        strokeDasharray={marker.solid ? undefined : marker.dashed ? "3 5" : "7 5"}
                        opacity={marker.solid ? 1 : 0.9}
                      />
                      <text x="6" y={y - 4} fill={marker.colour} fontSize="12" fontWeight="800">
                        {marker.label} {value.toFixed(2)}
                      </text>
                    </g>
                  );
                })}

                {/* clamped markers pinned to the edge so the scale stays readable */}
                {(scale.clamped || []).map((marker) => {
                  const y = marker.side === "above" ? 12 : PRICE_HEIGHT - 6;
                  return (
                    <text key={"clamped" + marker.label} x={plotWidth - 8} y={y} textAnchor="end" fill="#d08700" fontSize="11" fontWeight="800">
                      {marker.label} {Number(marker.value).toFixed(2)} {marker.side === "above" ? "▲ off scale" : "▼ off scale"}
                    </text>
                  );
                })}

                {/* volume */}
                {showVolume ? (
                  <g transform={"translate(0," + PRICE_HEIGHT + ")"}>
                    <line x1="0" x2={plotWidth} y1="0" y2="0" stroke="rgba(180,200,210,0.2)" strokeWidth="1" />
                    <text x={plotWidth + 6} y="12" fill="#a5b3bc" fontSize="11">Vol</text>
                    <text x={plotWidth + 6} y={VOLUME_HEIGHT - 4} fill="#a5b3bc" fontSize="10">{formatVolume(maxVolume)}</text>
                    {visible.map((candle, index) => {
                      const volume = Number(candle.volume) || 0;
                      const barHeight = maxVolume ? (volume / maxVolume) * (VOLUME_HEIGHT - 12) : 0;
                      const rising = Number(candle.close) >= Number(candle.open);
                      return (
                        <rect
                          key={"v" + (candle.date || index)}
                          x={index * slot + slot / 2 - bodyWidth / 2}
                          y={VOLUME_HEIGHT - barHeight}
                          width={bodyWidth}
                          height={Math.max(0.5, barHeight)}
                          fill={rising ? COLOURS.up : COLOURS.down}
                          opacity="0.55"
                        />
                      );
                    })}
                  </g>
                ) : null}

                {/* RSI */}
                {showRsi && indicatorSeries ? (
                  <g transform={"translate(0," + (PRICE_HEIGHT + (showVolume ? VOLUME_HEIGHT : 0)) + ")"}>
                    <line x1="0" x2={plotWidth} y1="0" y2="0" stroke="rgba(180,200,210,0.2)" strokeWidth="1" />
                    {[30, 70].map((level) => (
                      <g key={"rsi" + level}>
                        <line x1="0" x2={plotWidth} y1={RSI_HEIGHT - (level / 100) * RSI_HEIGHT} y2={RSI_HEIGHT - (level / 100) * RSI_HEIGHT} stroke="rgba(208,135,0,0.45)" strokeDasharray="3 4" strokeWidth="1" />
                        <text x={plotWidth + 6} y={RSI_HEIGHT - (level / 100) * RSI_HEIGHT + 4} fill="#a5b3bc" fontSize="10">{level}</text>
                      </g>
                    ))}
                    <path
                      d={indicatorSeries.rsi.reduce((path, value, index) => {
                        if (value == null) return path;
                        const x = index * slot + slot / 2;
                        const y = RSI_HEIGHT - (value / 100) * RSI_HEIGHT;
                        return path + (path ? " L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
                      }, "")}
                      fill="none"
                      stroke="#c78bff"
                      strokeWidth="1.6"
                    />
                    <text x="6" y="12" fill="#c78bff" fontSize="11" fontWeight="800">RSI (14)</text>
                  </g>
                ) : null}
              </svg>
            </div>

            <div className="fdChartFooter">
              <div className="fdLegend">
                <span><i style={{ background: COLOURS.entry }} /> Buy trigger</span>
                <span><i style={{ background: COLOURS.safety }} /> Safety Exit</span>
                <span><i style={{ background: COLOURS.target }} /> Targets</span>
                <span><i style={{ background: COLOURS.level }} /> Support / resistance</span>
                <span><i style={{ background: COLOURS.current }} /> Current price</span>
              </div>
              <dl className="fdChartLevels">
                <div><dt>Current</dt><dd>{formatMoney(data.currentPrice, currency)}</dd></div>
                <div><dt>Buy Trigger</dt><dd>{entryRange ? formatMoney(entryRange.low, currency) + " - " + formatMoney(entryRange.high, currency) : "--"}</dd></div>
                <div><dt>Safety Exit</dt><dd>{formatMoney(opportunity?.safetyExit, currency)}</dd></div>
                {(opportunity?.targets || []).map((target, index) => (
                  <div key={"target" + index}><dt>{index === 0 ? "Target 1" : "Final target"}</dt><dd>{formatMoney(target, currency)}</dd></div>
                ))}
                <div><dt>Support</dt><dd>{data.support ? formatMoney(data.support.value, currency) : "None found"}</dd></div>
                <div><dt>Resistance</dt><dd>{data.resistance ? formatMoney(data.resistance.value, currency) : "None found"}</dd></div>
                <div><dt>Candles</dt><dd>{data.candleCount} ({visible.length} shown)</dd></div>
                <div><dt>Avg daily range</dt><dd>{volatility ? formatMoney(volatility.averageDailyRange, currency) : "--"}</dd></div>
              </dl>
              <p className="fdChartHint">Scroll to zoom, drag to pan. Latest candle {data.latestCandleDate}.</p>
            </div>
          </>
        ) : null}
      </div>

      <style jsx>{`
        .fdChartOverlay {
          align-items: flex-start;
          background: rgba(3, 7, 10, 0.86);
          bottom: 0;
          display: flex;
          justify-content: center;
          left: 0;
          overflow-y: auto;
          padding: 28px 18px;
          position: fixed;
          right: 0;
          top: 0;
          z-index: 80;
        }
        .fdChartDialog {
          background: var(--fd-panel);
          border: 1px solid var(--fd-line);
          border-radius: 16px;
          max-width: 1320px;
          padding: 24px 26px 26px;
          width: 100%;
        }
        .fdChartDialog:focus { outline: none; }
        .fdChartHeader {
          align-items: flex-start;
          display: flex;
          gap: 20px;
          justify-content: space-between;
        }
        .fdChartIdentity h2 { font-size: 40px; font-weight: 900; line-height: 1; margin: 0; }
        .fdChartCompany { color: var(--fd-ink); font-size: 18px; margin: 8px 0 0; }
        .fdChartVenue { color: var(--fd-ink-dim); font-size: 14px; margin: 5px 0 0; }
        .fdChartStamp { color: var(--fd-ink-dim); font-size: 13px; margin: 5px 0 0; }
        .fdChartClose { min-width: 110px; }
        .fdChartStatus {
          background: var(--tone-soft);
          border: 2px solid var(--tone);
          border-radius: 10px;
          color: var(--tone);
          font-size: 19px;
          font-weight: 900;
          letter-spacing: 0.3px;
          margin: 18px 0 0;
          padding: 14px 18px;
          text-align: center;
        }
        .fdChartControls {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          justify-content: space-between;
          margin: 18px 0 0;
        }
        .fdRangeGroup, .fdZoomGroup { display: flex; flex-wrap: wrap; gap: 8px; }
        .fdChartCanvas {
          background: #0a1216;
          border: 1px solid var(--fd-line);
          border-radius: 12px;
          cursor: grab;
          margin-top: 16px;
          overflow: hidden;
          touch-action: none;
        }
        .fdChartCanvas:active { cursor: grabbing; }
        .fdChartSvg { display: block; width: 100%; }
        .fdChartMessage {
          color: var(--fd-ink-dim);
          font-size: 17px;
          padding: 60px 0;
          text-align: center;
        }
        .fdChartError {
          background: var(--fd-red-soft);
          border: 2px solid var(--fd-red);
          border-radius: 12px;
          margin-top: 18px;
          padding: 22px 24px;
        }
        .fdChartError.stale {
          background: var(--fd-amber-soft);
          border-color: var(--fd-amber);
        }
        .fdChartError strong { display: block; font-size: 21px; font-weight: 900; margin-bottom: 8px; }
        .fdChartError p { font-size: 16px; line-height: 1.5; margin: 0; }
        .fdChartErrorNote { color: var(--fd-ink-dim); font-size: 14px !important; margin-top: 10px !important; }
        .fdChartFooter { margin-top: 16px; }
        .fdLegend { display: flex; flex-wrap: wrap; gap: 16px; }
        .fdLegend span {
          align-items: center;
          color: var(--fd-ink-dim);
          display: inline-flex;
          font-size: 13px;
          font-weight: 700;
          gap: 7px;
        }
        .fdLegend i { border-radius: 2px; display: inline-block; height: 4px; width: 20px; }
        .fdChartLevels {
          display: grid;
          gap: 12px 18px;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          margin: 18px 0 0;
        }
        .fdChartLevels dt {
          color: var(--fd-ink-dim);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.4px;
          text-transform: uppercase;
        }
        .fdChartLevels dd { font-size: 17px; font-weight: 800; margin: 4px 0 0; }
        .fdChartHint { color: var(--fd-ink-dim); font-size: 13px; margin: 14px 0 0; }
        @media (max-width: 900px) {
          .fdChartIdentity h2 { font-size: 30px; }
          .fdChartStatus { font-size: 16px; }
        }
      `}</style>
      <style jsx global>{`
        .fdRangeButton {
          background: var(--fd-panel-2);
          border: 1px solid var(--fd-line);
          border-radius: 8px;
          color: var(--fd-ink-dim);
          cursor: pointer;
          font-size: 14px;
          font-weight: 800;
          min-height: 42px;
          padding: 0 16px;
        }
        .fdRangeButton:hover { background: #1d2d36; color: var(--fd-ink); }
        .fdRangeButton.active {
          background: var(--fd-blue);
          border-color: #6aa4ff;
          color: #fff;
        }
        .fdIndicators {
          background: var(--fd-panel-2);
          border: 1px solid var(--fd-line);
          border-radius: 10px;
          margin-top: 14px;
          padding: 12px 16px;
        }
        .fdIndicators summary {
          cursor: pointer;
          font-size: 15px;
          font-weight: 800;
          padding: 4px 0;
        }
        .fdIndicatorBody { display: flex; flex-wrap: wrap; gap: 16px; padding-top: 12px; }
        .fdIndicatorToggle {
          align-items: center;
          cursor: pointer;
          display: inline-flex;
          font-size: 14px;
          font-weight: 700;
          gap: 8px;
        }
        .fdIndicatorToggle input { height: 18px; width: 18px; }
      `}</style>
    </div>
  );
}
