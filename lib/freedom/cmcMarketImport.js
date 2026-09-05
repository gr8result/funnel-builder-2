import { extractImageText, validateBrokerImportImage } from "./tradeImport.js";

function cleanText(value) {
  return String(value || "")
    .replace(/[â€”â€“]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function numberValue(value) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const cleaned = String(value).replace(/[$,%+,]/g, "").replace(/^A/i, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function round(value, decimals = 4) {
  const number = numberValue(value);
  return number === null ? null : Number(number.toFixed(decimals));
}

function normalizeSymbol(value) {
  const symbol = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (symbol === "ADS") return "AD8";
  return symbol;
}

function parseTimestamp(text = "") {
  const cleaned = cleanText(text);
  const explicit = cleaned.match(/\b(?:as at|at)\s+(\d{1,2}\s+[A-Za-z]{3,9}(?:\s+\d{4})?\s+\d{1,2}:\d{2}\s*(?:am|pm)?)\b/i)?.[1];
  const candidate = explicit || cleaned.match(/\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{1,2}:\d{2}\s*(?:am|pm)?)\b/i)?.[1];
  if (!candidate) return null;
  const withYear = /\b20\d{2}\b/.test(candidate) ? candidate : `${candidate} ${new Date().getFullYear()}`;
  const parsed = Date.parse(withYear);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : candidate;
}

function splitCsvLine(line = "") {
  const cells = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === "\"") quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, ""));
}

function normalizeCandidate(input = {}, defaults = {}) {
  const symbol = normalizeSymbol(input.symbol || input.ticker || input.code);
  if (!/^[A-Z0-9]{2,6}$/.test(symbol)) return null;
  const sourceTimestamp = input.sourceTimestamp || defaults.sourceTimestamp || null;
  const candidate = {
    symbol,
    ticker: symbol,
    companyName: cleanText(input.companyName || input.company || input.name || ""),
    exchange: "ASX",
    currency: "AUD",
    cmcPrice: round(input.price ?? input.last ?? input.value),
    cmcMove: round(input.move ?? input.change),
    cmcMovePercent: round(input.movePercent ?? input.percentChange ?? input.percent),
    volume: round(input.volume),
    turnover: round(input.turnover ?? input.valueTraded),
    importedRating: cleanText(input.rating || input.morningstarRating || input.thescreenerRating || ""),
    importedValuation: cleanText(input.valuation || input.morningstarValuation || ""),
    sourceSection: cleanText(input.sourceSection || defaults.sourceSection || "CMC imported candidates"),
    sourceTimestamp,
    source: "CMC import",
    raw: cleanText(input.raw || ""),
    reviewStatus: "READY",
  };
  candidate.uncertainFields = ["companyName", "cmcPrice"].filter((key) => !candidate[key]);
  if (candidate.uncertainFields.length) candidate.reviewStatus = "REVIEW_REQUIRED";
  return candidate;
}

function parseDelimited(text = "", defaults = {}) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2 || !/[,\t]/.test(lines[0])) return [];
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const split = delimiter === "\t" ? (line) => line.split("\t").map((cell) => cell.trim()) : splitCsvLine;
  const headers = split(lines[0]).map((header) => header.toLowerCase().replace(/[^a-z0-9]+/g, ""));
  const at = (...names) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0);
  const indexes = {
    symbol: at("code", "symbol", "ticker"),
    companyName: at("company", "companyname", "name", "security", "instrument"),
    price: at("last", "price", "value"),
    move: at("change", "move"),
    movePercent: at("percent", "percentchange", "gain", "loss"),
    volume: at("volume"),
    turnover: at("turnover", "marketvalue", "value"),
    rating: at("rating", "starrating", "thescreener"),
    valuation: at("valuation", "morningstarvaluation"),
  };
  if (indexes.symbol === undefined) return [];
  return lines.slice(1).map((line) => {
    const cells = split(line);
    const get = (key) => indexes[key] === undefined ? "" : cells[indexes[key]];
    return normalizeCandidate({
      symbol: get("symbol"),
      companyName: get("companyName"),
      price: get("price"),
      move: get("move"),
      movePercent: get("movePercent"),
      volume: get("volume"),
      turnover: get("turnover"),
      rating: get("rating"),
      valuation: get("valuation"),
      raw: line,
    }, defaults);
  }).filter(Boolean);
}

function parseLooseRows(text = "", defaults = {}) {
  return text.split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter(Boolean)
    .map((line) => {
      const named = line.match(/^([A-Z][A-Z0-9]{1,5})\s+(.+?)\s+([+-]?\d[\d,.]*)(?:\s+([+\-]?\d+(?:\.\d+)?))?(?:\s+([+\-]?\d+(?:\.\d+)?)%?)?(?:\s+([\d,]{4,}))?$/);
      if (named && /[A-Za-z]/.test(named[2])) {
        const [, symbol, companyName, price, move, movePercent, volume] = named;
        return normalizeCandidate({ symbol, companyName, price, move, movePercent, volume, raw: line }, defaults);
      }
      const match = line.match(/^([A-Z][A-Z0-9]{1,5})\s+(?:[↑↓+\-]\s*)?([\d,.]+)(?:\s+([+\-]?\d+(?:\.\d+)?))?(?:\s+([+\-]?\d+(?:\.\d+)?)%?)?(?:\s+([\d,]{4,}))?\s*(.*)$/);
      if (!match) return null;
      const [, symbol, price, move, movePercent, volume, tail] = match;
      const companyName = tail && !/dividend|becoming|notice|application|undervalued|overvalued/i.test(tail) ? tail : "";
      return normalizeCandidate({ symbol, price, move, movePercent, volume, companyName, raw: line }, defaults);
    })
    .filter(Boolean);
}

export function extractCmcMarketCandidates(input = {}) {
  const sourceType = input.sourceType || "text";
  const text = cleanText(input.text || input.csv || "");
  const sourceTimestamp = input.sourceTimestamp || parseTimestamp(text);
  const sourceSection = input.sourceSection || (/\btheScreener\b/i.test(text) ? "theScreener" : /\bGainers|Losers\b/i.test(text) ? "Movers" : "CMC Market Summary");
  const defaults = { sourceTimestamp, sourceSection };
  const rows = [...parseDelimited(text, defaults), ...parseLooseRows(text, defaults)];
  const unique = new Map();
  rows.forEach((row) => {
    if (!unique.has(row.symbol)) unique.set(row.symbol, row);
  });
  return {
    ok: true,
    sourceType,
    candidates: Array.from(unique.values()),
    expectedUniverseSize: unique.size,
    sourceTimestamp,
    sourceSection,
    warning: unique.size ? null : "No ASX market candidates were extracted. Paste table rows or upload a clearer screenshot/CSV.",
    privacy: {
      authenticatedCmcScraped: false,
      importedRowsAreCandidatesOnly: true,
      brokerActionTaken: false,
    },
  };
}

export async function extractCmcMarketCandidatesFromSource(input = {}) {
  if (input.sourceType !== "image") return extractCmcMarketCandidates(input);
  const validation = validateBrokerImportImage(input.image || {});
  if (!validation.ok) return { ok: false, error: validation.error, candidates: [] };
  const suppliedText = input.imageText || input.ocrText || "";
  const ocr = suppliedText ? { ok: true, text: suppliedText, engine: "supplied-text" } : await extractImageText(input.image);
  if (!ocr.ok) return { ok: false, error: ocr.error || "CMC screenshot extraction failed.", candidates: [] };
  const result = extractCmcMarketCandidates({ ...input, sourceType: "image", text: [input.text || "", ocr.text || ""].filter(Boolean).join("\n") });
  return { ...result, ocr: { engine: ocr.engine, textAvailable: Boolean(ocr.text) } };
}
