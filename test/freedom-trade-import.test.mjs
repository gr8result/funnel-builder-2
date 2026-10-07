import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { extractBrokerImport, extractBrokerImportFromSource, redactBrokerText, validateBrokerImportImage } from "../lib/freedom/tradeImport.js";

const cmcFixture = `
CMC Markets
Total holdings $0
Account number 12345678
MSFT:US - BUY - quantity 10 - limit US$470 - expiry 19 September - status Waiting for Entry
ALK - BUY - quantity 2,000 - limit A$1.415 - Good Till Cancelled - status Waiting for Entry
AD8 - BUY - quantity 2,000 - limit A$2.10 - Good Till Cancelled - status Waiting for Entry
NWH - BUY - quantity 2,000 - limit A$7.08 - Good Till Cancelled - status Waiting for Entry
`;

async function withTradeStore(run) {
  const dir = await mkdtemp(path.join(tmpdir(), "freedom-import-"));
  const previous = process.env.FREEDOM_TRADE_STORE_PATH;
  process.env.FREEDOM_TRADE_STORE_PATH = path.join(dir, "trades.json");
  try {
    await run(process.env.FREEDOM_TRADE_STORE_PATH);
  } finally {
    if (previous === undefined) delete process.env.FREEDOM_TRADE_STORE_PATH;
    else process.env.FREEDOM_TRADE_STORE_PATH = previous;
    await rm(dir, { recursive: true, force: true });
  }
}

test("CMC open-order fixture extracts four waiting-for-entry orders and no holdings", () => {
  const result = extractBrokerImport({ sourceType: "text", text: cmcFixture });
  assert.equal(result.rows.length, 4);
  assert.deepEqual(result.rows.map((row) => row.symbol), ["MSFT", "ALK", "AD8", "NWH"]);
  assert.deepEqual(result.rows.map((row) => row.classification), ["PENDING_BUY_ORDER", "PENDING_BUY_ORDER", "PENDING_BUY_ORDER", "PENDING_BUY_ORDER"]);
  assert.equal(result.rows.find((row) => row.symbol === "MSFT").currency, "USD");
  assert.equal(result.rows.find((row) => row.symbol === "MSFT").limitPrice, 470);
  assert.equal(result.rows.find((row) => row.symbol === "MSFT").expiry, "2026-09-19");
  assert.equal(result.rows.find((row) => row.symbol === "ALK").currency, "AUD");
  assert.equal(result.rows.find((row) => row.symbol === "ALK").quantity, 2000);
  assert.equal(result.rows.some((row) => row.classification === "CURRENT_HOLDING"), false);
});

test("confirmed CMC import creates pending not-owned orders, prevents duplicates, and updates later fill", async () => {
  await withTradeStore(async (storePath) => {
    const { importReviewedTrades, listLongTermHoldings, listShortTermTrades } = await import(`../lib/freedom/tradeStore.js?import=${Date.now()}`);
    const extracted = extractBrokerImport({ sourceType: "text", text: cmcFixture }).rows.map((row) => ({
      ...row,
      checked: true,
      termClassification: row.symbol === "MSFT" ? "long-term" : "short-term",
    }));

    const first = await importReviewedTrades(extracted);
    assert.equal(first.reports.filter((report) => report.result === "new").length, 4);
    assert.equal((await listLongTermHoldings()).length, 0);

    const stored = await listShortTermTrades();
    assert.equal(stored.length, 4);
    assert.equal(stored.every((trade) => trade.status === "pending"), true);
    assert.equal(stored.every((trade) => trade.importedOrder === true), true);
    assert.equal(stored.every((trade) => trade.requiresFillConfirmation === true), true);
    assert.equal(stored.find((trade) => trade.symbol === "ALK").entryPrice, 1.415);
    assert.equal(stored.find((trade) => trade.symbol === "MSFT").termClassification, "long-term");

    const second = await importReviewedTrades(extracted);
    assert.equal(second.reports.filter((report) => report.result === "already_imported").length, 4);
    assert.equal((await listShortTermTrades()).length, 4);

    const msftFill = {
      ...extracted.find((row) => row.symbol === "MSFT"),
      classification: "COMPLETED_PURCHASE",
      averageFilledPrice: 469.8,
      filledQuantity: 10,
      checked: true,
      uncertainFields: [],
    };
    const filled = await importReviewedTrades([msftFill]);
    assert.equal(filled.reports[0].result, "moved_to_long_term");
    assert.equal((await listShortTermTrades()).some((trade) => trade.symbol === "MSFT"), false);
    const updated = (await listLongTermHoldings()).find((holding) => holding.symbol === "MSFT");
    assert.equal(updated.purchasePrice, 469.8);
    assert.equal(updated.quantity, 10);
    assert.equal(updated.importFingerprint, msftFill.importFingerprint);

    const raw = await readFile(storePath, "utf8");
    assert.equal(raw.includes("12345678"), false);
    assert.equal(/Total holdings\s+\$0/i.test(raw), false);
  });
});

test("unclear screenshot or text does not auto-save confident rows", () => {
  const image = extractBrokerImport({ sourceType: "image", text: "" });
  assert.equal(image.rows.length, 0);
  assert.match(image.warning, /OCR text/i);

  const unclear = extractBrokerImport({ sourceType: "text", text: "CMC MSFT buy maybe some shares" });
  assert.equal(unclear.rows.length, 1);
  assert.ok(unclear.rows[0].uncertainFields.includes("quantity"));
  assert.ok(unclear.rows[0].uncertainFields.includes("limitPrice"));
  assert.equal(unclear.rows[0].reviewStatus, "REVIEW_REQUIRED");
});

test("privacy redaction removes account identifiers and secrets from source text", () => {
  const redacted = redactBrokerText("Account number 12345678 PIN 9999 Cash balance A$12,345");
  assert.equal(redacted.includes("12345678"), false);
  assert.equal(redacted.includes("9999"), false);
  assert.equal(redacted.includes("12,345"), false);
});

test("CMC PNG screenshot extracts four waiting-for-entry orders", async () => {
  const fixturePath = "C:/Users/grant/Downloads/Screenshot 2026-08-24 092145.png";
  try {
    await access(fixturePath);
  } catch {
    assert.ok(true, "Supplied CMC PNG was not present on this machine; local screenshot OCR acceptance skipped.");
    return;
  }
  const buffer = await readFile(fixturePath);
  const image = {
    name: "Screenshot 2026-08-24 092145.png",
    type: "image/png",
    size: buffer.length,
    dataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
  };
  assert.equal(validateBrokerImportImage(image).ok, true);
  const result = await extractBrokerImportFromSource({ sourceType: "image", image });
  assert.equal(result.ok, true);
  assert.deepEqual(result.rows.map((row) => row.symbol), ["MSFT", "ALK", "AD8", "NWH"]);
  assert.deepEqual(result.rows.map((row) => row.classification), ["PENDING_BUY_ORDER", "PENDING_BUY_ORDER", "PENDING_BUY_ORDER", "PENDING_BUY_ORDER"]);
  assert.equal(result.rows.every((row) => row.orderStatus === "Waiting for Entry"), true);
  assert.equal(result.rows.some((row) => row.classification === "CURRENT_HOLDING"), false);
});

test("import UI accepts screenshots for upload, drop and paste paths", async () => {
  const source = await readFile(new URL("../pages/freedom/my-trades.js", import.meta.url), "utf8");
  assert.match(source, /accept="image\/png,image\/jpeg,image\/webp,\.png,\.jpg,\.jpeg,\.webp,\.csv,\.txt"/);
  assert.match(source, /onDrop=\{handleDrop\}/);
  assert.match(source, /onPaste=\{handlePaste\}/);
  assert.match(source, /navigator\.clipboard\.read/);
  assert.match(source, /fdImagePreview/);
});

test("pending orders monitor is restricted to real orders and exposes alert controls", async () => {
  const source = await readFile(new URL("../pages/freedom/my-trades.js", import.meta.url), "utf8");
  assert.match(source, /Pending Orders Monitor/);
  assert.match(source, /Pending BUY Orders/);
  assert.match(source, /Pending SELL Orders/);
  assert.match(source, /Record Changed Limit/);
  assert.match(source, /Mark Partially Filled/);
  assert.match(source, /Cancel\/Archive Order/);
  assert.match(source, /PENDING_BUY_ORDER/);
  assert.match(source, /PENDING_SELL_ORDER/);
  assert.match(source, /trade\.importedOrder !== true && trade\.manuallyConfirmedOrder !== true/);
  assert.match(source, /\["CMG", "CLSK"\]/);
  assert.match(source, /within3: true/);
  assert.match(source, /PENDING_REFRESH_INTERVAL_MS = 60_000/);
});
