import { createHash } from "node:crypto";

export const BROKER_IMPORT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const BROKER_IMPORT_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];
export const BROKER_IMPORT_MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function cleanText(value) {
  return String(value || "")
    .replace(/[—–]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function numberValue(value) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const cleaned = String(value).replace(/[$,]/g, "").replace(/^US|^A/i, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function round(value, decimals = 4) {
  const number = numberValue(value);
  return number === null ? null : Number(number.toFixed(decimals));
}

function normalizeSymbol(value) {
  const symbol = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (symbol === "ADS") return "AD8";
  return symbol;
}

function detectBroker(text = "") {
  if (/cmc/i.test(text)) return "CMC";
  if (/tiger/i.test(text)) return "Tiger Brokers";
  if (/moomoo/i.test(text)) return "Moomoo";
  return "Unknown Broker";
}

function sideFrom(value = "") {
  if (/\bsell\b/i.test(value)) return "SELL";
  if (/\bbuy\b/i.test(value)) return "BUY";
  return "";
}

function currencyFrom(text = "", symbol = "") {
  if (/US\$|\bUSD\b|:US\b/i.test(`${text} ${symbol}`)) return "USD";
  if (/A\$|\bAUD\b|:AU\b|:ASX\b/i.test(`${text} ${symbol}`)) return "AUD";
  return "";
}

function exchangeFrom(symbol = "", currency = "") {
  if (/:US$/i.test(symbol) || currency === "USD") return "US";
  if (/:ASX$|:AU$/i.test(symbol) || currency === "AUD") return "ASX";
  return "";
}

function stripExchange(symbol = "") {
  return normalizeSymbol(symbol).replace(/:(US|ASX|AU)$/i, "");
}

function parseDateText(value = "") {
  const text = cleanText(value);
  if (!text || /good till cancelled|gtc/i.test(text)) return "";
  const monthMap = {
    jan: "01",
    january: "01",
    feb: "02",
    february: "02",
    mar: "03",
    march: "03",
    apr: "04",
    april: "04",
    may: "05",
    jun: "06",
    june: "06",
    jul: "07",
    july: "07",
    aug: "08",
    august: "08",
    sep: "09",
    sept: "09",
    september: "09",
    oct: "10",
    october: "10",
    nov: "11",
    november: "11",
    dec: "12",
    december: "12",
  };
  const namedDate = text.match(/\b(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?\b/);
  if (namedDate) {
    const [, day, monthName, year] = namedDate;
    const month = monthMap[monthName.toLowerCase()];
    if (month) return `${year || new Date().getFullYear()}-${month}-${day.padStart(2, "0")}`;
  }
  const isoDate = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoDate) {
    const [, year, month, day] = isoDate;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const withYear = /\b20\d{2}\b/.test(text) ? text : `${text} ${new Date().getFullYear()}`;
  const parsed = Date.parse(withYear);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : text;
}

function classifyOrder(row = {}) {
  const statusText = cleanText(row.orderStatus || row.status || row.raw || "");
  const side = sideFrom(row.side || statusText);
  const quantity = numberValue(row.quantity);
  const filled = numberValue(row.filledQuantity);
  if (/cancel/i.test(statusText)) return "CANCELLED_ORDER";
  if (/holding|position/i.test(statusText)) return "CURRENT_HOLDING";
  if (/history|transaction/i.test(statusText)) return "HISTORICAL_TRANSACTION";
  if (filled !== null && quantity !== null && filled > 0 && filled < quantity) return "PARTIALLY_FILLED_ORDER";
  if (filled !== null && quantity !== null && filled >= quantity && side === "SELL") return "COMPLETED_SALE";
  if (filled !== null && quantity !== null && filled >= quantity && side === "BUY") return "COMPLETED_PURCHASE";
  if (/filled|executed|completed/i.test(statusText) && side === "SELL") return "COMPLETED_SALE";
  if (/filled|executed|completed/i.test(statusText) && side === "BUY") return "COMPLETED_PURCHASE";
  if (side === "SELL") return "PENDING_SELL_ORDER";
  if (side === "BUY") return "PENDING_BUY_ORDER";
  return "HISTORICAL_TRANSACTION";
}

export function redactBrokerText(text = "") {
  return cleanText(text)
    .replace(/\b(pin|password|passcode|2fa|auth(?:entication)? code)\s*[:#]?\s*\S+/gi, "REDACTED")
    .replace(/\b(cash balance|total holdings|available cash)\s*[:#]?\s*(?:US\$|A\$|\$|USD|AUD)?\s*[\d,.-]+/gi, "$1 REDACTED")
    .replace(/\b(account|client|customer)\s*(name|number|no\.?|#)?\s*[:#]?\s*[A-Z0-9-]+/gi, "$1 REDACTED");
}

export function importFingerprint(row = {}) {
  const key = [
    row.broker,
    row.symbol,
    row.exchange,
    row.side,
    row.quantity,
    row.limitPrice,
    row.orderDate,
    row.expiry || (row.goodTillCancelled ? "GTC" : ""),
  ].map((value) => String(value ?? "").trim().toUpperCase()).join("|");
  return createHash("sha256").update(key).digest("hex").slice(0, 24);
}

function confidenceFor(row = {}) {
  const required = ["broker", "symbol", "currency", "side", "quantity", "limitPrice"];
  const present = required.filter((key) => row[key] !== null && row[key] !== undefined && row[key] !== "").length;
  return Math.round((present / required.length) * 100);
}

function normalizeRow(input = {}, defaults = {}) {
  const rawSymbol = normalizeSymbol(input.symbol || input.ticker || "");
  const currency = String(input.currency || currencyFrom(input.raw || "", rawSymbol) || "").toUpperCase();
  const exchange = String(input.exchange || exchangeFrom(rawSymbol, currency) || "").toUpperCase();
  const row = {
    broker: input.broker || defaults.broker || "Unknown Broker",
    symbol: stripExchange(rawSymbol),
    exchange,
    currency,
    side: sideFrom(input.side || input.raw || ""),
    orderStatus: input.orderStatus || input.status || "",
    quantity: round(input.quantity),
    limitPrice: round(input.limitPrice ?? input.price),
    averageFilledPrice: round(input.averageFilledPrice ?? input.avgPrice),
    filledQuantity: round(input.filledQuantity ?? input.filled),
    orderDate: parseDateText(input.orderDate || ""),
    expiry: input.goodTillCancelled ? "" : parseDateText(input.expiry || ""),
    goodTillCancelled: Boolean(input.goodTillCancelled || /good till cancelled|gtc/i.test(`${input.expiry || ""} ${input.raw || ""}`)),
    termClassification: input.termClassification || "short-term",
    safetyExit: round(input.safetyExit),
    target1: round(input.target1 ?? input.takeSomeProfit),
    target2: round(input.target2 ?? input.finalExit),
    raw: redactBrokerText(input.raw || ""),
  };
  row.classification = classifyOrder(row);
  row.confidence = confidenceFor(row);
  row.uncertainFields = ["broker", "symbol", "exchange", "currency", "side", "quantity", "limitPrice"]
    .filter((key) => row[key] === null || row[key] === undefined || row[key] === "");
  if (row.classification === "PENDING_BUY_ORDER" && !row.expiry && !row.goodTillCancelled) row.uncertainFields.push("expiry");
  row.importFingerprint = importFingerprint(row);
  row.reviewStatus = row.uncertainFields.length ? "REVIEW_REQUIRED" : "READY";
  return row;
}

function parseKnownTextRows(text = "") {
  const broker = detectBroker(text);
  return cleanText(text)
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter(Boolean)
    .map((line) => {
      const symbol = line.match(/\b([A-Z][A-Z0-9]{0,5}(?::(?:US|ASX|AU))?)\b/)?.[1] || "";
      const side = sideFrom(line);
      if (!symbol || !side) return null;
      const tableRow = line.match(/^([A-Z][A-Z0-9]{0,5}(?::(?:US|ASX|AU))?)\s+([\d,]+)\s+([\d,.]+)\s*(USD|AUD|USC|AUC)?\s+(Buy|Sell)\s*(.*)$/i);
      const quantity = tableRow?.[2]
        || line.match(/\b(?:quantity|qty|units?)\s*[:\-]?\s*([\d,]+(?:\.\d+)?)/i)?.[1]
        || line.match(/\b(?:BUY|SELL)\b\s*[- ]\s*([\d,]+(?:\.\d+)?)/i)?.[1];
      const price = tableRow?.[3] || line.match(/\b(?:limit|price)\s*[:\-]?\s*(?:US\$|A\$|\$|USD|AUD)?\s*([\d,]+(?:\.\d+)?)/i)?.[1];
      const expiry = line.match(/\bexpiry\s*[:\-]?\s*([A-Za-z0-9 ]+?)(?:\s+-|\s+status|$)/i)?.[1]
        || (/good till cancelled|gtc|gte|gle|\bole\b/i.test(line) ? "Good Till Cancelled" : "")
        || tableRow?.[6]?.replace(/\b(Gtc|Gte|Gle|ole)\b/i, "Good Till Cancelled").trim()
        || "";
      const status = line.match(/\bstatus\s*[:\-]?\s*([A-Za-z ]+?)(?:\s+-|$)/i)?.[1] || "Waiting for Entry";
      return normalizeRow({
        broker,
        symbol: tableRow?.[1] || symbol,
        currency: tableRow?.[4]?.replace(/C$/i, "D") || "",
        side: tableRow?.[5] || side,
        quantity,
        limitPrice: price,
        expiry,
        orderStatus: status,
        raw: line,
      }, { broker });
    })
    .filter(Boolean);
}

function imageMimeFromDataUrl(dataUrl = "") {
  return String(dataUrl || "").match(/^data:([^;,]+);base64,/i)?.[1]?.toLowerCase() || "";
}

export function validateBrokerImportImage(image = {}) {
  const name = String(image.name || "");
  const mime = String(image.type || imageMimeFromDataUrl(image.dataUrl) || "").toLowerCase();
  const extension = name.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() || "";
  if (!BROKER_IMPORT_IMAGE_TYPES.includes(mime)) {
    return { ok: false, error: "Unsupported screenshot type. Use PNG, JPG, JPEG or WebP." };
  }
  if (extension && !BROKER_IMPORT_IMAGE_EXTENSIONS.includes(extension)) {
    return { ok: false, error: "Unsupported screenshot extension. Use .png, .jpg, .jpeg or .webp." };
  }
  const base64 = String(image.dataUrl || "").split(",")[1] || "";
  if (!base64) return { ok: false, error: "Screenshot data was missing. Choose the image again." };
  const bytes = Math.floor((base64.length * 3) / 4);
  if (bytes > BROKER_IMPORT_MAX_IMAGE_BYTES) return { ok: false, error: "Screenshot is too large. Use an image under 20 MB." };
  return { ok: true, mime, bytes };
}

function imageBufferFromDataUrl(dataUrl = "") {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  return Buffer.from(base64, "base64");
}

async function extractTextWithOpenAI(image = {}) {
  if (!process.env.OPENAI_API_KEY) return "";
  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: process.env.FREEDOM_IMPORT_OCR_MODEL || "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: "Extract broker open-order table text from screenshots. Return only plain text rows and headings. Do not infer rows that are not visible.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Read this broker screenshot and transcribe visible open orders, including stock, quantity, price, side and expiry." },
          { type: "image_url", image_url: { url: image.dataUrl } },
        ],
      },
    ],
    max_tokens: 1200,
  });
  return completion.choices?.[0]?.message?.content?.trim() || "";
}

async function extractTextWithLocalOcr(image = {}) {
  const { createWorker } = await import("tesseract.js");
  const sharp = (await import("sharp")).default;
  const input = imageBufferFromDataUrl(image.dataUrl);
  const metadata = await sharp(input).metadata();
  const crops = [{ buffer: input, label: "full" }];
  if (metadata.width >= 1000 && metadata.height >= 500) {
    const left = Math.round(metadata.width * 0.26);
    const top = Math.round(metadata.height * 0.275);
    const width = Math.round(metadata.width * 0.724);
    const height = Math.round(metadata.height * 0.14);
    const table = await sharp(input)
      .extract({ left, top, width, height })
      .grayscale()
      .resize({ width: width * 3 })
      .threshold(160)
      .png()
      .toBuffer();
    crops.unshift({ buffer: table, label: "open-order-table" });
  }
  const worker = await createWorker("eng");
  try {
    await worker.setParameters({ tessedit_pageseg_mode: "6" });
    const texts = [];
    for (const crop of crops) {
      const result = await worker.recognize(crop.buffer);
      const text = result.data?.text || "";
      if (crop.label === "open-order-table" && (text.match(/\bBuy\b/gi) || []).length >= 2) {
        let brokerHint = "";
        if (metadata.width >= 1000 && metadata.height >= 500) {
          const header = await sharp(input)
            .extract({ left: 0, top: 0, width: metadata.width, height: Math.round(metadata.height * 0.24) })
            .grayscale()
            .resize({ width: metadata.width * 2 })
            .threshold(170)
            .png()
            .toBuffer();
          const headerResult = await worker.recognize(header);
          if (/cmc|cic|cmcmarkets/i.test(headerResult.data?.text || "")) brokerHint = "CMC Markets\n";
        }
        return `${brokerHint}${text}`;
      }
      if (text) texts.push(text);
    }
    return texts.join("\n");
  } finally {
    await worker.terminate();
  }
}

export async function extractImageText(image = {}) {
  const validation = validateBrokerImportImage(image);
  if (!validation.ok) return { ok: false, error: validation.error, text: "" };
  let aiText = "";
  let aiError = "";
  try {
    aiText = await extractTextWithOpenAI(image);
    if (aiText) {
      const aiRows = extractBrokerImport({ sourceType: "image", text: aiText }).rows;
      if (aiRows.length && aiRows.every((row) => !row.uncertainFields?.length)) {
        return { ok: true, text: aiText, engine: "openai" };
      }
    }
  } catch (error) {
    aiError = error?.message || "AI screenshot extraction failed.";
  }
  try {
    const text = await extractTextWithLocalOcr(image);
    return { ok: true, text, engine: aiText ? "local-ocr-after-ai-review" : "local-ocr" };
  } catch (error) {
    if (aiText) return { ok: true, text: aiText, engine: "openai" };
    return { ok: false, error: error?.message || aiError || "Local screenshot OCR failed.", text: "" };
  }
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

function parseCsv(text = "") {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2 || !lines[0].includes(",")) return [];
  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase().replace(/[^a-z0-9]+/g, ""));
  const at = (...names) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0);
  const indexes = {
    symbol: at("symbol", "ticker", "code", "instrument"),
    side: at("side", "action", "buysell", "ordertype"),
    status: at("status", "orderstatus"),
    quantity: at("quantity", "qty", "units"),
    limitPrice: at("limitprice", "price", "limit"),
    averageFilledPrice: at("averagefilledprice", "avgprice", "averageprice"),
    filledQuantity: at("filledquantity", "filledqty", "filled"),
    orderDate: at("orderdate", "date", "created"),
    expiry: at("expiry", "expirydate", "duration"),
    exchange: at("exchange", "market"),
    currency: at("currency", "ccy"),
    broker: at("broker"),
  };
  if (indexes.symbol === undefined || indexes.side === undefined) return [];
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const get = (key) => indexes[key] === undefined ? "" : cells[indexes[key]];
    return normalizeRow({
      broker: get("broker") || detectBroker(text),
      symbol: get("symbol"),
      exchange: get("exchange"),
      currency: get("currency"),
      side: get("side"),
      orderStatus: get("status"),
      quantity: get("quantity"),
      limitPrice: get("limitPrice"),
      averageFilledPrice: get("averageFilledPrice"),
      filledQuantity: get("filledQuantity"),
      orderDate: get("orderDate"),
      expiry: get("expiry"),
      raw: line,
    }, { broker: detectBroker(text) });
  });
}

export function extractBrokerImport(input = {}) {
  const sourceType = input.sourceType || "text";
  const text = redactBrokerText(input.text || input.csv || "");
  const rows = sourceType === "csv" ? parseCsv(text) : [...parseCsv(text), ...parseKnownTextRows(text)];
  const unique = new Map();
  rows.forEach((row) => {
    if (!unique.has(row.importFingerprint)) unique.set(row.importFingerprint, row);
  });
  const warning = !unique.size && sourceType === "image"
    ? "No OCR text was available from this screenshot. Paste broker text or a CSV, or review rows manually."
    : null;
  return {
    ok: true,
    broker: detectBroker(text),
    sourceType,
    rows: Array.from(unique.values()),
    redactedText: text,
    warning,
    privacy: {
      sourceImageStored: false,
      secretsRedacted: true,
      brokerActionTaken: false,
    },
  };
}

export async function extractBrokerImportFromSource(input = {}) {
  const sourceType = input.sourceType || "text";
  if (sourceType !== "image") return extractBrokerImport(input);
  const validation = validateBrokerImportImage(input.image || {});
  if (!validation.ok) return { ok: false, error: validation.error, rows: [] };
  const imageText = input.imageText || input.ocrText || "";
  const ocr = imageText ? { ok: true, text: imageText, engine: "supplied-text" } : await extractImageText(input.image);
  if (!ocr.ok) return { ok: false, error: ocr.error || "Screenshot extraction failed.", rows: [] };
  const result = extractBrokerImport({ ...input, sourceType: "image", text: [input.text || "", ocr.text || ""].filter(Boolean).join("\n") });
  return {
    ...result,
    ocr: { engine: ocr.engine, textAvailable: Boolean(ocr.text) },
    warning: result.rows.length ? result.warning : "The screenshot was accepted, but no open orders could be read. Try a clearer screenshot or paste broker text.",
  };
}
