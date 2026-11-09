// Inspects the rendered Client Selections V1 PDF (accept-client-selections-v1-pdf.mjs output):
// page text from the PDF itself, overflow / clipping on every printed page, product imagery, rooms,
// bulkhead decision, Builder Review Required entries, Variation summary and estimated vs confirmed
// amounts, O.Novo duplicates, and that no unapproved variation is presented as final.
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/inspect-client-selections-v1-pdf.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createProjectInclusionsSnapshot, renderFinalInclusionsScheduleHtml } from "../lib/builders/finalInclusionsSchedule.js";

const out = path.resolve("artifacts", "test-artifacts", "client-selections-v1-pdf");
const body = JSON.parse(fs.readFileSync(path.join(out, "captured-generate-request.json"), "utf8"));
const report = { checks: {} };
const check = (name, ok, detail = "") => { report.checks[name] = ok ? "PASS" : `FAIL ${detail}`; };

// 1. The PDF itself.
const pdf = await getDocument({ data: new Uint8Array(fs.readFileSync(path.join(out, "client-selections-v1-draft.pdf"))), useSystemFonts: true }).promise;
const pages = [];
for (let number = 1; number <= pdf.numPages; number++) {
  const content = await (await pdf.getPage(number)).getTextContent();
  pages.push(content.items.map((item) => item.str).join(" ").replace(/\s+/g, " "));
}
const all = pages.join("\n");
report.pageCount = pdf.numPages;
const variationPages = pages.map((text, index) => ({ text, number: index + 1 })).filter((page) => /VARIATION SUMMARY/i.test(page.text));
report.variationPages = variationPages.map((page) => page.number);
check("variation summary printed", variationPages.length > 0);
const variationText = variationPages.map((page) => page.text).join("\n");
check("bulkhead removal printed", /Cabinetry bulkheads/.test(variationText) && /Remove bulkheads/.test(variationText));
check("confirmed bulkhead credit -$831.60", /-\$831\.60 inc GST/.test(variationText) && /Confirmed by builder/.test(variationText));
check("client acceptance recorded", /Accepted/.test(variationText));
check("Builder Review Required entries", (variationText.match(/Builder Review Required/g) || []).length >= 1);
check("auto-estimates labelled", /Auto-estimated . subject to builder confirmation/i.test(variationText));
check("estimated prices shown with allowance caveat, outside totals", /inc GST \(price\)/.test(variationText) && /allowance not recorded/i.test(variationText) && /Auto-estimated prices, allowance to confirm/i.test(variationText));
check("estimates labelled subject to approval", /(Estimate|Auto-estimated) . subject to builder (approval|confirmation)/i.test(variationText));
check("no unresolved price shown as $0", !/[+-]?\$0\.00 inc GST/.test(variationText));
check("summary not presented as final", /DRAFT\s*.\s*NOT A FINAL VARIATION/i.test(variationText) && !/CONFIRMED VARIATIONS/i.test(variationText.replace(/Confirmed by builder/gi, "")));
check("estimated and confirmed totals kept apart", /Estimated \(subject to builder approval\):/.test(variationText) && /Confirmed:/.test(variationText));
for (const room of ["Kitchen", "Butler", "Main Bathroom", "Ensuite", "Powder Room", "Laundry"]) check(`room ${room} in schedule`, all.includes(room));
check("no phantom Other / Bathroom alias cabinetry room", !/Cabinetry & Benchtops — Other\b/.test(all) && !/Cabinetry & Benchtops — Bathroom:/.test(all));
// O.Novo: one Bath & Shower Mixer line per room, never repeated.
const onovo = (all.match(/O\.Novo[^\n]{0,80}/g) || []);
report.onovoMentions = onovo.length;
const scheduleRows = (body.previewSchedule.pages || []).flatMap((page) => (page.blocks || []).map((block) => block.row).filter(Boolean));
const onovoRows = scheduleRows.filter((row) => /O\.Novo/i.test(`${row.product} ${row.details}`));
const onovoKeys = onovoRows.map((row) => `${row.item}|${row.product}|${row.qtyLocation}`);
check("no duplicate O.Novo rows", new Set(onovoKeys).size === onovoKeys.length, JSON.stringify(onovoKeys));
report.onovoRows = onovoRows.map((row) => ({ item: row.item, product: row.product, qty: row.qtyLocation }));
// Standard inclusions vs upgrades.
report.statusCounts = scheduleRows.reduce((counts, row) => ({ ...counts, [row.status || "none"]: (counts[row.status || "none"] || 0) + 1 }), {});
check("standard inclusions and selections both printed", (report.statusCounts.Included || 0) + (report.statusCounts.INCLUDED || 0) > 0 && Object.keys(report.statusCounts).length > 1, JSON.stringify(report.statusCounts));
// Imagery: every product row that requires an image has one (the app's own list of missing images).
report.missingImages = body.previewSchedule.missingImages || [];
check("no missing product imagery", report.missingImages.length === 0, JSON.stringify(report.missingImages.slice(0, 5)));

// 2. Layout: render the same HTML the PDF is printed from and measure every page body.
const snapshot = createProjectInclusionsSnapshot({ project: { id: "captured", workspace_id: "captured", project_name: body.projectDetails?.projectName, metadata: {} }, workspaceId: "captured", selections: [], session: { id: "", project_id: "captured", snapshot_id: "", status: "ready" },
  estimateSnapshot: { id: "" }, generatedBy: "inspection", documentStatus: body.documentStatus || "draft", previousDocuments: [], cover: body.previewSchedule.cover || {}, schedulePages: body.previewSchedule.pages,
  scheduleOutstandingDecisions: body.previewSchedule.outstandingDecisions || [], scheduleVariationSummary: body.previewSchedule.variationSummary || null, builderProfile: body.builderProfile || {}, preparedBy: "inspection", reviewedBy: "", approval: {}, contractReference: "", revisionReason: "",
  masterTemplate: { id: "client-selections-schedule", version: "standalone", pageCount: 0 }, masterPdfRef: null, closingPdfRef: null });
// Local images are embedded exactly as finalInclusionsPdfExecution.js does before printing.
let html = renderFinalInclusionsScheduleHtml(snapshot);
for (const asset of new Set([...html.matchAll(/src="(\/[^"?]+\.(?:jpg|jpeg|png|webp|svg))"/g)].map((match) => match[1]))) {
  const file = path.resolve("public", `.${decodeURIComponent(asset)}`);
  if (!fs.existsSync(file)) continue;
  const type = /\.png$/i.test(asset) ? "png" : /\.webp$/i.test(asset) ? "webp" : /\.svg$/i.test(asset) ? "svg+xml" : "jpeg";
  html = html.replaceAll(`src="${asset}"`, `src="data:image/${type};base64,${fs.readFileSync(file).toString("base64")}"`);
}
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1123, height: 794 });
  await page.setContent(html, { waitUntil: "load", timeout: 180000 });
  await page.emulateMediaType("print");
  const layout = await page.$$eval(".ssPage", (nodes) => nodes.map((node) => {
    const body = node.querySelector(".ssBody");
    const table = body?.querySelector("table");
    const clippedCells = [...node.querySelectorAll("td")].filter((cell) => cell.scrollWidth > cell.clientWidth + 2).length;
    return { page: node.dataset.schedulePage, section: node.dataset.scheduleSection, overflowPx: table && body ? Math.max(0, table.offsetHeight - (body.clientHeight - 2)) : 0, clippedCells,
      brokenImages: [...node.querySelectorAll("img")].filter((img) => !img.complete || img.naturalWidth === 0).length };
  }));
  report.layout = layout.filter((entry) => entry.overflowPx > 0 || entry.clippedCells || entry.brokenImages);
  check("no page body overflow", layout.every((entry) => entry.overflowPx === 0), JSON.stringify(report.layout));
  check("no clipped cells", layout.every((entry) => !entry.clippedCells), JSON.stringify(report.layout));
  check("no broken images", layout.every((entry) => !entry.brokenImages), JSON.stringify(report.layout));
  const sections = await page.$$(".ssVariationPage");
  for (let index = 0; index < sections.length; index++) await sections[index].screenshot({ path: path.join(out, `variation-page-${index + 1}.png`) });
  const cabinetryPage = await page.$$(".ssPage");
  if (cabinetryPage[1]) await cabinetryPage[1].screenshot({ path: path.join(out, "schedule-page-2.png") });
} finally { await browser.close(); }

fs.writeFileSync(path.join(out, "inspection.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.checks, null, 1));
const failed = Object.entries(report.checks).filter(([, value]) => value !== "PASS");
assert.deepEqual(failed, [], "PDF inspection");
console.log(`PDF inspection PASS: ${report.pageCount} pages, variation pages ${report.variationPages.join(", ")}`);
