import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { buildFreedomChartInput, auditChronology, summarizeOhlc } from "../lib/freedom-trader/chartSeriesIntegrity.js";
import { normalizeTwelveDataInterval } from "../lib/freedom-trader/twelveData.js";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const baseUrl = process.env.FREEDOM_BASE_URL || "http://localhost:3000";
const outDir = path.join(process.cwd(), "diagnostics", "freedom-market-data", "TJGC");
const symbol = "TJGC";
const range = "1d";
const interval = "1m";
const providerInterval = normalizeTwelveDataInterval(interval, range);
const outputsize = 520;
const provider = "Twelve Data";
const endpoint = "https://api.twelvedata.com/time_series";
const freedomProviderParams = { symbol, interval: providerInterval, outputsize, order: "DESC" };

function apiKey() {
  return process.env.TWELVE_DATA_API_KEY?.trim() || process.env.TWELVEDATA_API_KEY?.trim() || "";
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsvRows(rows, headers) {
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
}

function rawRows(payload) {
  return (Array.isArray(payload?.values) ? payload.values : [])
    .map((row) => ({
      timestamp: row.datetime,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
    }))
    .reverse();
}

function normalizedRows(history) {
  return (history?.candles || []).map((row) => ({
    timestamp: row.date,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
  }));
}

function chartRows(history) {
  const chart = buildFreedomChartInput(history?.candles || [], { chartType: "line" });
  return chart.timestamps.slice(0, chart.realCount).map((timestamp, index) => ({
    timestamp,
    chartPrice: chart.chartPrice[index],
    volume: chart.volume[index],
  }));
}

function compareRows(raw, normalized, chart) {
  const mismatches = [];
  const count = Math.max(raw.length, normalized.length, chart.length);
  for (let index = 0; index < count; index += 1) {
    const rawRow = raw[index] || {};
    const normalizedRow = normalized[index] || {};
    const chartRow = chart[index] || {};
    for (const field of ["timestamp", "open", "high", "low", "close", "volume"]) {
      const rawValue = rawRow[field];
      const normalizedValue = normalizedRow[field];
      const differs = field === "timestamp"
        ? String(rawValue ?? "") !== String(normalizedValue ?? "")
        : Number(rawValue) !== Number(normalizedValue);
      if (differs) {
        mismatches.push({ stage: "raw_vs_normalized", index, field, raw: rawValue ?? null, normalized: normalizedValue ?? null });
        break;
      }
    }
    if (String(normalizedRow.timestamp ?? "") !== String(chartRow.timestamp ?? "") || Number(normalizedRow.close) !== Number(chartRow.chartPrice) || Number(normalizedRow.volume) !== Number(chartRow.volume)) {
      mismatches.push({ stage: "normalized_vs_chart", index, field: "timestamp/close/volume", normalized: normalizedRow, chart: chartRow });
    }
  }
  return mismatches;
}

function latestSessionRows(rows) {
  const latestTimestamp = rows[rows.length - 1]?.timestamp;
  const latestSession = String(latestTimestamp || "").slice(0, 10);
  return latestSession ? rows.filter((row) => String(row.timestamp || "").slice(0, 10) === latestSession) : rows;
}

async function fetchProvider(params) {
  const url = new URL(endpoint);
  Object.entries({ ...params, apikey: apiKey() }).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 Freedom Trader Diagnostic" } });
  const payload = await response.json();
  return {
    url: url.toString().replace(apiKey(), "REDACTED"),
    status: response.status,
    headers: {
      creditsUsed: response.headers.get("api-credits-used"),
      creditsLeft: response.headers.get("api-credits-left"),
    },
    payload,
  };
}

async function fetchFreedomHistory(rangeValue, intervalValue) {
  const url = `${baseUrl}/api/freedom-trader/history?symbol=${symbol}&range=${encodeURIComponent(rangeValue)}&interval=${encodeURIComponent(intervalValue)}`;
  const response = await fetch(url);
  return {
    url,
    status: response.status,
    payload: await response.json(),
  };
}

await fs.mkdir(outDir, { recursive: true });
if (!apiKey()) throw new Error("TWELVE_DATA_API_KEY/TWELVEDATA_API_KEY is required for the raw provider capture.");

const providerCapture = await fetchProvider(freedomProviderParams);
const historyCapture = await fetchFreedomHistory(range, interval);
const raw = rawRows(providerCapture.payload);
const normalized = normalizedRows(historyCapture.payload);
const chart = chartRows(historyCapture.payload);
const rawLatestSession = latestSessionRows(raw);
const fullRawMismatches = compareRows(raw, normalized, chart);
const sessionMismatches = compareRows(rawLatestSession, normalized, chart);
const matrixInputs = [
  ["1D / 1m", "1d", "1m"],
  ["1D / 5m", "1d", "5m"],
  ["5D / 5m", "5d", "5m"],
  ["1M / 1D", "1mo", "1d"],
  ["1M / 30m", "1mo", "30m"],
  ["3M / 1D", "3mo", "1d"],
  ["1Y / 1D", "1y", "1d"],
];
const matrix = [];
for (const [label, rangeValue, intervalValue] of matrixInputs) {
  const providerIntervalValue = normalizeTwelveDataInterval(intervalValue, rangeValue);
  const capture = await fetchFreedomHistory(rangeValue, intervalValue);
  const rows = normalizedRows(capture.payload);
  const chartSeries = chartRows(capture.payload);
  matrix.push({
    label,
    uiRange: rangeValue,
    uiInterval: intervalValue,
    providerParams: { symbol, interval: capture.payload?.interval || providerIntervalValue, outputsize: "RANGE_TO_OUTPUT_SIZE", order: "DESC", rangeSentToProvider: false },
    providerBarsReceived: capture.payload?.candleCount || rows.length,
    normalizedBars: rows.length,
    chartPoints: chartSeries.length,
    firstTimestamp: rows[0]?.timestamp || null,
    lastTimestamp: rows[rows.length - 1]?.timestamp || null,
    minimum: rows.length ? Math.min(...rows.map((row) => Number(row.low)).filter(Number.isFinite)) : null,
    maximum: rows.length ? Math.max(...rows.map((row) => Number(row.high)).filter(Number.isFinite)) : null,
    ok: capture.payload?.ok,
    error: capture.payload?.error || null,
  });
}

const rawPath = path.join(outDir, "TJGC-1D-1m-raw-provider.csv");
const normalizedPath = path.join(outDir, "TJGC-1D-1m-normalized.csv");
const chartPath = path.join(outDir, "TJGC-1D-1m-chart-input.csv");
await fs.writeFile(rawPath, writeCsvRows(raw, ["timestamp", "open", "high", "low", "close", "volume"]));
await fs.writeFile(normalizedPath, writeCsvRows(normalized, ["timestamp", "open", "high", "low", "close", "volume"]));
await fs.writeFile(chartPath, writeCsvRows(chart, ["timestamp", "chartPrice", "volume"]));
await fs.writeFile(path.join(outDir, "TJGC-1D-1m-provider-response.json"), JSON.stringify(providerCapture, null, 2));

const summary = {
  provider,
  endpoint,
  symbolRequested: symbol,
  exchange: providerCapture.payload?.meta?.exchange || historyCapture.payload?.exchange || null,
  timezone: providerCapture.payload?.meta?.exchange_timezone || historyCapture.payload?.exchangeTimezone || null,
  requestRange: range,
  requestInterval: interval,
  providerInterval,
  providerParamsActuallySentByFreedom: freedomProviderParams,
  responseTimestamp: new Date().toISOString(),
  rawCount: raw.length,
  rawLatestSessionCount: rawLatestSession.length,
  normalizedCount: normalized.length,
  chartPointCount: chart.length,
  rawSummary: summarizeOhlc(raw.map((row) => ({ ...row, open: Number(row.open), high: Number(row.high), low: Number(row.low), close: Number(row.close), volume: Number(row.volume) }))),
  normalizedSummary: summarizeOhlc(normalized),
  rawChronology: auditChronology(raw, "timestamp"),
  normalizedChronology: auditChronology(normalized, "timestamp"),
  chartChronology: auditChronology(chart, "timestamp"),
  first20RawCloses: raw.slice(0, 20).map((row) => ({ timestamp: row.timestamp, close: row.close })),
  first20RawLatestSessionCloses: rawLatestSession.slice(0, 20).map((row) => ({ timestamp: row.timestamp, close: row.close })),
  first20ChartPoints: chart.slice(0, 20).map((row) => ({ timestamp: row.timestamp, chartPrice: row.chartPrice })),
  firstFullRawVsNormalizedMismatch: fullRawMismatches[0] || null,
  fullRawMismatchCount: fullRawMismatches.length,
  firstLatestSessionMismatch: sessionMismatches[0] || null,
  latestSessionMismatchCount: sessionMismatches.length,
  latestSessionMismatches: sessionMismatches.slice(0, 200),
  matrix,
  files: { rawPath, normalizedPath, chartPath },
};
await fs.writeFile(path.join(outDir, "TJGC-audit-summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
