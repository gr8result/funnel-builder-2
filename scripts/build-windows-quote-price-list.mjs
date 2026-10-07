// Converts the supplied Section 53 WINDOWS price list (lib/construction-estimation/catalogues/data/
// windowsQuotePriceList.csv, kept exactly as supplied) into the JSON the app bundles
// (windowsQuotePriceList.json), the same CSV -> JSON pattern windowDoorScreenCatalogue.js uses.
// Run: node scripts/build-windows-quote-price-list.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "lib/construction-estimation/catalogues/data");
const csv = fs.readFileSync(path.join(dataDir, "windowsQuotePriceList.csv"), "utf8");
const lines = Papa.parse(csv.trim(), { skipEmptyLines: false }).data;

function money(text) {
  const value = Number(String(text || "").replace(/[$,\s]/g, ""));
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}
function size(text) {
  const match = String(text || "").match(/(\d+)\s*H\s*x\s*(\d+)\s*W/i);
  return match ? { heightMm: Number(match[1]), widthMm: Number(match[2]) } : null;
}

// The flyscreen list's own type name -> the window/door product type it belongs to.
const FLYSCREEN_FOR_PRODUCT_TYPE = {
  "Glass Sliding Door": "Glass Sliding Door - Single Opening Panel",
  "GSD - Centre Opening": "Glass Sliding Door - Centre Opening",
};

let list = "windows";
const windows = [];
const flyscreens = [];
for (const cells of lines) {
  const first = String(cells[0] || "").trim();
  if (!first || first === "Description") continue;
  if (first === "FLYSCREENS") { list = "flyscreens"; continue; }
  const dims = size(cells[5]);
  const price = money(cells[3]);
  const match = first.match(/^(\d+)\s+(.+)$/);
  if (!dims || price === null || !match) throw new Error(`Unreadable price list row: ${cells.join(",")}`);
  const entry = { sourceCode: match[1], productType: match[2].trim(), ...dims, sizeDescription: `${dims.heightMm}H x ${dims.widthMm}W`, unit: String(cells[2] || "EACH").trim() || "EACH", price };
  if (list === "windows") windows.push({ ...entry, code: entry.sourceCode });
  else flyscreens.push(entry);
}

// The window/door list is used exactly as supplied - those sizes and no others. A flyscreen is kept
// only when the list has a window/door of the same product type and size (flyscreen sizes follow
// the windows), and it takes that window's number. Fixed glass windows never get a flyscreen.
// Windows with no flyscreen price in the supplied list simply have no flyscreen row - no price is made up.
const windowByTypeAndSize = new Map(windows.map((w) => [`${w.productType}|${w.heightMm}x${w.widthMm}`, w]));
const keptFlyscreens = [];
const droppedFlyscreens = [];
for (const screen of flyscreens) {
  const baseType = screen.productType.replace(/\s+Flyscreen$/i, "");
  screen.forProductType = FLYSCREEN_FOR_PRODUCT_TYPE[baseType] || baseType;
  const window = screen.forProductType === "Fixed Glass" ? null : windowByTypeAndSize.get(`${screen.forProductType}|${screen.heightMm}x${screen.widthMm}`);
  if (!window) { droppedFlyscreens.push(screen); continue; }
  screen.code = window.code;
  keptFlyscreens.push(screen);
}
// A window size the supplied flyscreen list skips (it has no 1500H awning flyscreens, although the
// window list has 1500H awnings) takes the supplied price of the same type's flyscreen with the
// same two dimensions the other way round (1500H x 600W <- 600H x 1500W), else one of the same
// screen area - the supplied list prices every flyscreen type by area, so those are the same price.
// Still never a made-up number: with no such supplied flyscreen the window keeps no flyscreen row.
const flyscreenKeys = new Set(keptFlyscreens.map((s) => `${s.forProductType}|${s.heightMm}x${s.widthMm}`));
const derivedFlyscreens = [];
for (const w of windows) {
  if (w.productType === "Fixed Glass" || flyscreenKeys.has(`${w.productType}|${w.heightMm}x${w.widthMm}`)) continue;
  const sameType = flyscreens.filter((s) => s.forProductType === w.productType);
  const source = sameType.find((s) => s.heightMm === w.widthMm && s.widthMm === w.heightMm)
    || sameType.find((s) => s.heightMm * s.widthMm === w.heightMm * w.widthMm);
  if (!source) continue;
  derivedFlyscreens.push({ ...source, heightMm: w.heightMm, widthMm: w.widthMm, sizeDescription: w.sizeDescription, code: w.code, derivedFromSize: source.sizeDescription });
  flyscreenKeys.add(`${w.productType}|${w.heightMm}x${w.widthMm}`);
}
// Each derived flyscreen sits with its own product type, in window size order.
for (const screen of derivedFlyscreens) {
  const after = keptFlyscreens.findLastIndex((s) => s.forProductType === screen.forProductType && (s.heightMm < screen.heightMm || (s.heightMm === screen.heightMm && s.widthMm < screen.widthMm)));
  keptFlyscreens.splice(after + 1, 0, screen);
}
const windowsWithoutFlyscreen = windows.filter((w) => w.productType !== "Fixed Glass" && !flyscreenKeys.has(`${w.productType}|${w.heightMm}x${w.widthMm}`));

const out = { source: "windowsQuotePriceList.csv", windows, flyscreens: keptFlyscreens };
fs.writeFileSync(path.join(dataDir, "windowsQuotePriceList.json"), `${JSON.stringify(out, null, 1)}\n`);
console.log(`windows/doors: ${windows.length}, flyscreens kept: ${keptFlyscreens.length} (renumbered to their window: ${keptFlyscreens.filter((s) => s.code !== s.sourceCode).length}), flyscreens with no matching window dropped: ${droppedFlyscreens.length}`);
console.log(`flyscreens priced from the same type's equal-size supplied flyscreen: ${derivedFlyscreens.length}${derivedFlyscreens.length ? ` - ${derivedFlyscreens.map((s) => `${s.code} ${s.productType} ${s.sizeDescription} (from ${s.derivedFromSize}, $${s.price})`).join(", ")}` : ""}`);
console.log(`windows (not fixed glass) with no flyscreen price in the list: ${windowsWithoutFlyscreen.length}${windowsWithoutFlyscreen.length ? ` - ${windowsWithoutFlyscreen.map((w) => `${w.code} ${w.productType} ${w.sizeDescription}`).join(", ")}` : ""}`);
