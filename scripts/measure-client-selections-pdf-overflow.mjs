// Measures every printed schedule page of a captured Generate PDF request and lists the pages whose rows
// do not fit (the same condition finalInclusionsPdfExecution.js refuses to print).
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/measure-client-selections-pdf-overflow.mjs <captured-generate-request.json>
import fs from "node:fs";
import puppeteer from "puppeteer";
import { createProjectInclusionsSnapshot, renderFinalInclusionsScheduleHtml } from "../lib/builders/finalInclusionsSchedule.js";

const body = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const snapshot = createProjectInclusionsSnapshot({ project: { id: "captured", workspace_id: "captured", project_name: body.projectDetails?.projectName, metadata: {} }, workspaceId: "captured", selections: [], session: { id: "", project_id: "captured", snapshot_id: "", status: "ready" },
  estimateSnapshot: { id: "" }, generatedBy: "measure", documentStatus: body.documentStatus || "draft", previousDocuments: [], cover: body.previewSchedule.cover || {}, schedulePages: body.previewSchedule.pages,
  scheduleOutstandingDecisions: body.previewSchedule.outstandingDecisions || [], scheduleVariationSummary: body.previewSchedule.variationSummary || null, builderProfile: body.builderProfile || {}, preparedBy: "measure", reviewedBy: "", approval: {}, contractReference: "", revisionReason: "",
  masterTemplate: { id: "client-selections-schedule", version: "standalone", pageCount: 0 }, masterPdfRef: null, closingPdfRef: null });
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1123, height: 794 });
  await page.setContent(renderFinalInclusionsScheduleHtml(snapshot), { waitUntil: "load", timeout: 180000 });
  await page.emulateMediaType("print");
  const pages = await page.$$eval(".ssPage", (nodes) => nodes.map((node) => {
    const body = node.querySelector(".ssBody");
    const table = body?.querySelector("table");
    return { page: node.dataset.schedulePage, section: node.dataset.scheduleSection, rows: node.querySelectorAll("tbody tr").length, overflowPx: table && body ? Math.round(Math.max(0, table.offsetHeight - (body.clientHeight - 2))) : 0 };
  }));
  console.log(JSON.stringify({ pages: pages.length, overflowing: pages.filter((entry) => entry.overflowPx > 0) }, null, 1));
} finally { await browser.close(); }
