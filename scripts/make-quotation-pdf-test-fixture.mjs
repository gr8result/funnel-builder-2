// Builds an ISOLATED, fully priced TEST copy of a real quotation for customer-PDF acceptance.
// The real job and the builder's price book are never changed: input is read, output is a new file.
// Every test price is labelled ACCEPTANCE-TEST-ONLY so it can never be mistaken for a real price.
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs \
//     scripts/make-quotation-pdf-test-fixture.mjs <source job-copy.json> <output job-copy.json>
import fs from "node:fs";
import { calculateEstimateBuilderWorkbook } from "../lib/construction-estimation/estimateBuilderWorkbookCalculations.js";
import { quotationRateReviewRows, isQuotationRateUnresolved } from "../lib/builders/quotationRateReview.js";
import { quotationIssueCheck } from "../lib/construction-estimation/quotationIssueGate.js";

const [source, output] = process.argv.slice(2);
if (!source || !output || source === output) throw new Error("usage: <source json> <output json> (different files)");
const saved = JSON.parse(fs.readFileSync(source, "utf8"));
const workbook = structuredClone(saved.workbook || saved);
const TEST_REF = "ACCEPTANCE-TEST-ONLY";
const quiet = (fn) => { const log = console.log; console.log = () => {}; try { return fn(); } finally { console.log = log; } };

// 1. No client selections: the test quotation is the builder's own priced trade quotation.
workbook.clientSelectionsBook = { ...(workbook.clientSelectionsBook || {}), rooms: [] };
workbook.procurement = { ...(workbook.procurement || {}), items: [] };

// 1b. Use the generated Project Estimate (template pages incl. Pricing and Acceptance), not an uploaded
//     static PDF, so the customer PDF is produced from this quotation.
const docs = workbook.projectEstimateBuilder?.importedDocuments || {};
for (const key of ["projectEstimate", "projectEstimatePdf"]) if (docs[key]) docs[key] = { ...docs[key], active: false, status: "inactive" };
if (Array.isArray(workbook.projectEstimateBuilder?.pages)) {
  workbook.projectEstimateBuilder.pages = workbook.projectEstimateBuilder.pages.filter((page) => page?.importedDocument?.sourceType !== "project_estimate_pdf");
}

// 1c. The job's own Estimate Summary notice has paragraph breaks that push its card past the printable
//     page (the app correctly refuses: "does not fit inside the printable page area"). In this TEST copy
//     the paragraphs are joined, as in the builder's earlier issued document.
for (const page of workbook.projectEstimateBuilder?.pages || []) for (const block of page.blocks || []) {
  if (block.id === "estimateSummary-notice-body" && typeof block.content?.text === "string") block.content = { ...block.content, text: block.content.text.replace(/\s*[\r\n]+\s*/g, " ") };
}

// 2. Price every line the app still treats as unpriced, with a labelled test rate.
const priced = [];
for (let pass = 0; pass < 3; pass += 1) {
  const calc = quiet(() => calculateEstimateBuilderWorkbook(structuredClone(workbook)));
  const review = quotationRateReviewRows(calc.quotation);
  const issue = quotationIssueCheck(calc.quotation).blockers;
  const targets = new Map();
  for (const row of review) targets.set(`${row.section}\u0000${row.id || row.rowId}`, { section: row.section, id: row.id || row.rowId });
  for (const b of issue) targets.set(`${b.sectionKey}\u0000${b.rowId}`, { section: b.sectionKey, id: b.rowId });
  if (!targets.size) break;
  for (const { section, id } of targets.values()) {
    let row = workbook.quotation?.[section]?.rows?.find((r) => (r.id || r.rowId) === id);
    if (!row) {
      // Generated lines (takeoff doors) are not saved; the app prices them by saving a copy of the
      // calculated line with the builder's rate (useEstimateBuilderWorkbook workbookWithCommercialPriceProposal).
      const evidence = calc.quotation?.[section]?.rows?.find((r) => (r.id || r.rowId) === id);
      if (!evidence) continue;
      row = { ...evidence, quantity: "", importedQuantity: "" };
      workbook.quotation[section] = { ...(workbook.quotation[section] || {}), rows: [...(workbook.quotation[section]?.rows || []), row] };
    }
    Object.assign(row, { manualRate: "$250.00", supplierQuote: "250", quoteReference: TEST_REF, quoteRequired: false, priceStatus: "Supplier quote received (test)" });
    if (!(Number(row.qty ?? row.quantity) > 0) && !row.quantityKey) Object.assign(row, { qty: 1, quantity: 1 });
    Object.assign(row, { manualRateApproved: true, manualRateSource: "acceptance-test" });
    priced.push(`${section}: ${row.item || row.description || id}`);
  }
}

// 3. Saved rows the app re-derives on load (selection connectors) can carry an unresolved status that
//    the plain calculation does not surface (e.g. "Rate required - several quotation rates match").
const flagged = new Set(quotationRateReviewRows(workbook.quotation || {}).map((row) => `${row.section}\u0000${row.id}`));
for (const [section, group] of Object.entries(workbook.quotation || {})) {
  for (const row of group?.rows || []) {
    if (!flagged.has(`${section}\u0000${row.id}`) || !isQuotationRateUnresolved(row)) continue;
    Object.assign(row, { manualRate: "$250.00", supplierQuote: "250", quoteReference: TEST_REF, quoteRequired: false, priceStatus: "Supplier quote received (test)", manualRateApproved: true, manualRateSource: "acceptance-test" });
    priced.push(`${section}: ${row.item || row.id} (saved status)`);
  }
}

const final = quiet(() => calculateEstimateBuilderWorkbook(structuredClone(workbook)));
const remaining = { review: quotationRateReviewRows(final.quotation).length, issue: quotationIssueCheck(final.quotation).blockers.length };
const projectId = `local-quotation-pdf-fixture-${Date.now()}`;
Object.assign(workbook, { projectId, registeredJobId: projectId, jobId: projectId, page: "quotation",
  registeredJob: { ...(workbook.registeredJob || {}), jobId: projectId, jobName: "PDF TEST COPY - not a real quotation" },
  jobFileMeta: { ...(workbook.jobFileMeta || {}), projectId, jobName: "PDF TEST COPY - not a real quotation" } });
fs.writeFileSync(output, JSON.stringify({ projectId, jobName: "PDF TEST COPY - not a real quotation", workbook }));
console.log(JSON.stringify({ output, testPricedLines: priced.length, examples: priced.slice(0, 8), remaining, finalQuoteTotal: final.summary.finalQuoteTotal, gst: final.summary.gst, sections: Object.keys(final.quotation).length }, null, 1));
