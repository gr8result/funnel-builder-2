// Real-job audit: does every product chosen in Client Selections reach the Quotation Builder?
// Runs the same connectors as the Client Selections save (runSelectionConnectors) on a read-only
// copy of a .gr8job, then checks every product identity in the selections book against the
// resulting quotation rows. Writes artifacts/test-artifacts/client-selections-audit/transfer.json.
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/audit-client-selections-quotation-transfer.mjs [--job=<file.gr8job>]
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";
const { __quotationPersistenceTestUtils: persistence } = await import("../hooks/estimate-builder/useEstimateBuilderWorkbook.js");
const { runSelectionConnectors, planSelectionReconciliation } = await import("../lib/builders/selectionReconciliation.js");
const { calculateEstimateBuilderWorkbook } = await import("../lib/construction-estimation/estimateBuilderWorkbookCalculations.js");

const arg = process.argv.find((item) => item.startsWith("--job="))?.slice(6);
const file = path.resolve(arg || process.env.CLIENT_SELECTIONS_JOB_FILE || "E:/dev/quotation-recovery-20261108/restored/New Job 03 09 LATEST VERSION 11-11.gr8job");
assert(fs.existsSync(file), `job file not found: ${file}`);
const bytes = fs.readFileSync(file);
const sourceHash = crypto.createHash("sha256").update(bytes).digest("hex");
const zip = await JSZip.loadAsync(bytes);
const workbook = JSON.parse(await zip.file("estimate.json").async("string")).workbook;
const book = workbook.clientSelectionsBook || workbook.selectionsBook;
assert(book?.rooms?.length, "job has a selections book");

// Every product identity a guided selection holds, with where it was found.
function productRefs(value, trail = [], out = []) {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) { value.forEach((item, index) => productRefs(item, [...trail, index], out)); return out; }
  for (const [key, child] of Object.entries(value)) {
    if (/^(productId|selectedProductId|activeProductId)$/.test(key) && typeof child === "string" && child) out.push({ productId: child, path: [...trail, key].join("."), name: value.productName || value.name || value.label || "", quantity: value.quantity ?? null });
    else if (child && typeof child === "object" && !/^(history|previous|rejectionHistory|alternatives|options|candidates|catalogue)$/i.test(key)) productRefs(child, [...trail, key], out);
  }
  return out;
}

const productById = persistence.productByIdForWorkbook(workbook);
const before = JSON.stringify(workbook.quotation);
const synced = runSelectionConnectors(structuredClone(workbook), book, { productById });
const quoteRows = Object.entries(synced.quotation || {}).flatMap(([section, group]) => (group?.rows || []).map((row) => ({ section, row, text: JSON.stringify(row) })));

const rows = book.rooms.flatMap((room) => (room.rows || []).map((row) => ({ room: room.name, row })));
const results = [];
for (const { room, row } of rows) {
  const guided = row.guidedSelection;
  if (!guided) continue;
  const refs = [...new Map(productRefs(guided).map((ref) => [ref.productId, ref])).values()];
  if (!refs.length) continue;
  const confirmed = guided.confirmed === true || ["selected", "approved"].includes(row.status);
  for (const ref of refs) {
    const hits = quoteRows.filter((entry) => entry.text.includes(JSON.stringify(ref.productId)));
    results.push({
      room, requirementKey: guided.requirementKey || "", requirementLabel: guided.requirementLabel || row.item || "",
      status: row.status || "", confirmed, productId: ref.productId, productName: ref.name, foundAt: ref.path,
      quoteRows: hits.map(({ section, row: quote }) => ({ section, id: quote.id, item: quote.item, qty: quote.qty ?? quote.quantity, unit: quote.unit, priceStatus: quote.priceStatus || "" })),
    });
  }
}

const missing = results.filter((result) => result.confirmed && !result.quoteRows.length);
const byRequirement = Object.values(results.reduce((acc, result) => {
  const key = result.requirementKey || result.requirementLabel;
  acc[key] ||= { requirementKey: key, products: 0, confirmed: 0, transferred: 0, missingConfirmed: [] };
  acc[key].products += 1;
  if (result.confirmed) acc[key].confirmed += 1;
  if (result.quoteRows.length) acc[key].transferred += 1;
  else if (result.confirmed) acc[key].missingConfirmed.push(`${result.room}: ${result.productName || result.productId} (${result.foundAt})`);
  return acc;
}, {}));
const benchtopSections = Object.entries(synced.quotation || {}).filter(([name]) => /BENCHTOP/i.test(name))
  .map(([name, group]) => ({ section: name, rowsWithQuantity: (group.rows || []).filter((row) => Number(row.qty ?? row.quantity) > 0).map((row) => `${row.item} x ${row.qty ?? row.quantity}`) }));

// The full Reconcile Selections plan: connectors, then the target resolver, which binds single-product
// selections (doors, handles, skirting, cladding, ...) to the builder's own quote rows.
// Same as the app (useEstimateBuilderWorkbook previewSelectionReconciliation): the calculated quotation is evidence,
// because Takeoff-generated rows (internal doors, door furniture) exist only in the calculation, never in saved rows.
const quotationEvidence = calculateEstimateBuilderWorkbook(structuredClone(workbook)).quotation;
const plan = planSelectionReconciliation({ workbook: structuredClone(workbook), book, productById, productByCode: productById.byCode, quotationEvidence });
const componentsOf = (d) => (plan.canonicalAudit?.entries || []).filter((entry) => (d.componentDecisionIds || []).includes(entry.identityKey))
  .map((entry) => ({ outcome: entry.outcome, decision: entry.reconciliationDecision, quoteRowIds: entry.quoteRowIds, procurementIssue: entry.procurementIssue || "", targetReason: entry.targetReason || "" }));
const decisions = (plan.selectionDecisions || []).map((d) => ({ requirementKey: d.requirementKey, productName: d.productName, location: d.location, status: d.status, decision: d.reconciliationDecision, section: d.section, rowIds: d.rowIds, blockers: d.blockers, reason: d.reason, components: componentsOf(d) }));
const out = path.resolve("artifacts/test-artifacts/client-selections-audit"); fs.mkdirSync(out, { recursive: true });
const report = { ranAt: new Date().toISOString(), file, sourceHash, sourceUnchanged: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") === sourceHash, savedQuotationUntouched: JSON.stringify(workbook.quotation) === before, totals: { productRefs: results.length, confirmed: results.filter((r) => r.confirmed).length, transferred: results.filter((r) => r.quoteRows.length).length, missingConfirmed: missing.length }, byRequirement, benchtopSections, decisions, results };
console.log("RECONCILIATION DECISIONS");
for (const d of decisions) console.log(`  ${d.requirementKey} | ${d.productName || ""} | ${d.location || ""} | ${d.status} | ${d.decision} | ${d.section || "-"} ${d.rowIds?.length ? `[${d.rowIds.slice(0, 3).join(", ")}]` : ""}${d.reason ? ` | ${String(d.reason).slice(0, 120)}` : ""}`);
fs.writeFileSync(path.join(out, "transfer.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ totals: report.totals, sourceUnchanged: report.sourceUnchanged, benchtopSections: benchtopSections.map((s) => `${s.section}: ${s.rowsWithQuantity.length} rows`), byRequirement: byRequirement.map((r) => `${r.requirementKey}: ${r.transferred}/${r.products} transferred, ${r.confirmed} confirmed${r.missingConfirmed.length ? `; MISSING ${r.missingConfirmed.join(" | ")}` : ""}`) }, null, 1));
assert(report.sourceUnchanged, "source job file changed");
if (missing.length) process.exitCode = 1;
