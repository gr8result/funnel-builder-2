// Quotation section / line order must survive save, reopen, template save/load, export/import and
// every regeneration. Compares stable row ids and the persisted sortOrder fields.
//   node --max-old-space-size=8192 --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-quotation-order-persistence.mjs
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://offline.invalid";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "offline";
import assert from "node:assert/strict";
import fs from "node:fs";
const { __quotationPersistenceTestUtils: utils } = await import("../hooks/estimate-builder/useEstimateBuilderWorkbook.js");
const { createEstimateBuilderWorkbookDefaults } = await import("../lib/construction-estimation/estimateBuilderWorkbookDefaults.js");
const { applyPersistedQuotationOrder, applyPersistedRowOrder, persistedSectionOrder, quotationOrderSnapshot, stampQuotationOrder } = await import("../lib/construction-estimation/quotationOrder.js");
const { supersededRevisionKeys, jobContentSignature } = await import("../lib/construction-estimation/jobPersistence.js");
const { connectAllocatedSelectionsToQuotation } = await import("../lib/builders/allocatedSelectionQuotation.js");

const results = [];
assert.deepEqual(applyPersistedRowOrder([
  { id: 'second', sortOrder: 2, sortSection: 'INSULATION (82)' },
  { id: 'first', sortOrder: 1, sortSection: 'INSULATION (82)' },
], 'INSULATION').map(row => row.id), ['first', 'second'], 'display renumbering cannot discard saved row order');
const check = (name, run) => { run(); results.push(name); console.log("PASS", name); };
const roundTrip = (value) => JSON.parse(JSON.stringify(value));
const ids = (workbook) => quotationOrderSnapshot(workbook.quotation, utils.orderedQuoteSections(workbook.quotation, workbook.quotationSectionOrder || []));
// Same operations the UI performs (moveQuoteLine / saveQuoteSectionOrder in the workbook hook).
function moveLine(workbook, fromSection, id, toSection, targetId, position = "after") {
  const quotation = { ...workbook.quotation };
  const moving = quotation[fromSection].rows.find((row) => row.id === id);
  assert(moving, `${fromSection} has ${id}`);
  quotation[fromSection] = { ...quotation[fromSection], rows: quotation[fromSection].rows.filter((row) => row.id !== id) };
  const target = quotation[toSection].rows;
  const index = target.findIndex((row) => row.id === targetId);
  const at = index >= 0 ? index + (position === "before" ? 0 : 1) : target.length;
  quotation[toSection] = { ...quotation[toSection], rows: [...target.slice(0, at), moving, ...target.slice(at)] };
  return { ...workbook, quotation: stampQuotationOrder(quotation, utils.orderedQuoteSections(quotation, workbook.quotationSectionOrder || [])) };
}
function moveSection(workbook, name, afterName) {
  const order = utils.orderedQuoteSections(workbook.quotation, workbook.quotationSectionOrder || []).filter((item) => item !== name);
  order.splice(order.indexOf(afterName) + 1, 0, name);
  return { ...workbook, quotationSectionOrder: order, quotation: stampQuotationOrder(workbook.quotation, order) };
}
const saveJob = (workbook) => roundTrip(utils.withPersistedQuotationOrder({ ...workbook, savedAt: new Date().toISOString() }));
const openJob = (stored) => utils.normalizeWorkbook(stored);

let job = utils.normalizeWorkbook({ ...createEstimateBuilderWorkbookDefaults(), jobId: "order-test", templateType: "job" });
const original = ids(job);
const big = Object.entries(job.quotation).filter(([, section]) => (section.rows || []).length >= 6).map(([name]) => name);
assert(big.length >= 4, "enough sections with lines to move");
const [sectionA, sectionB, sectionC, sectionD] = big;

check("every section and line carries a persisted order after normalisation", () => {
  const names = utils.orderedQuoteSections(job.quotation, job.quotationSectionOrder || []);
  names.forEach((name, index) => {
    assert.equal(job.quotation[name].sortOrder, index + 1, name);
    (job.quotation[name].rows || []).forEach((row, rowIndex) => { assert.equal(row.sortOrder, rowIndex + 1); assert.equal(row.sortSection, name); });
  });
});

// Move 6 lines to obviously different positions (within a section and across sections) and 2 sections.
const rowsOf = (name) => job.quotation[name].rows.map((row) => row.id);
const moves = [];
{ const r = rowsOf(sectionA); job = moveLine(job, sectionA, r[0], sectionA, r.at(-1)); moves.push([sectionA, r[0]]); }
{ const r = rowsOf(sectionA); job = moveLine(job, sectionA, r.at(-2), sectionA, r[0], "before"); moves.push([sectionA, r.at(-2)]); }
{ const r = rowsOf(sectionB); job = moveLine(job, sectionB, r[1], sectionB, r[4]); moves.push([sectionB, r[1]]); }
{ const r = rowsOf(sectionB); job = moveLine(job, sectionB, r.at(-1), sectionB, r[0]); moves.push([sectionB, r.at(-1)]); }
{ const r = rowsOf(sectionC); job = moveLine(job, sectionC, r[2], sectionD, rowsOf(sectionD)[1]); moves.push([sectionD, r[2]]); }
{ const r = rowsOf(sectionC); job = moveLine(job, sectionC, r[0], sectionC, r[3]); moves.push([sectionC, r[0]]); }
const namesBefore = utils.orderedQuoteSections(job.quotation, job.quotationSectionOrder || []);
job = moveSection(job, namesBefore[2], namesBefore[10]);
job = moveSection(job, namesBefore[20], namesBefore[4]);
const arranged = ids(job);

check("moves changed the order and were recorded on the lines", () => {
  assert.notDeepEqual(arranged.rows[sectionA], original.rows[sectionA]);
  assert.notDeepEqual(arranged.sections, original.sections);
  for (const [name, id] of moves) {
    const index = job.quotation[name].rows.findIndex((row) => row.id === id);
    assert(index >= 0, `${id} in ${name}`);
    assert.equal(job.quotation[name].rows[index].sortOrder, index + 1);
    assert.equal(job.quotation[name].rows[index].sortSection, name);
  }
  assert.notEqual(jobContentSignature(job), jobContentSignature(utils.normalizeWorkbook({ ...createEstimateBuilderWorkbookDefaults(), jobId: "order-test", templateType: "job" })), "a move makes the job dirty");
});

let stored;
check("Save Job -> reopen restores the exact order (ids and sortOrder)", () => {
  stored = saveJob(job);
  const reopened = openJob(stored);
  assert.deepEqual(ids(reopened), arranged);
  assert.deepEqual(ids(openJob(saveJob(reopened))), arranged, "second save / reopen cycle");
  for (const [name, section] of Object.entries(reopened.quotation)) (section.rows || []).forEach((row, index) => assert.equal(row.sortOrder, index + 1, `${name} ${row.id}`));
});

check("regeneration cannot move saved lines: shuffled arrays are restored, new lines keep sensible positions", () => {
  const disturbed = roundTrip(stored);
  // What a rebuild does: default order, client-selection rows re-appended at the end, sections re-keyed.
  for (const name of [sectionA, sectionB, sectionC, sectionD]) disturbed.quotation[name].rows.sort((left, right) => String(left.id).localeCompare(String(right.id), undefined, { numeric: true }));
  const afterRow = arranged.rows[sectionB][2];
  const index = disturbed.quotation[sectionB].rows.findIndex((row) => row.id === afterRow);
  disturbed.quotation[sectionB].rows.splice(index + 1, 0, { id: "new-generated-line", item: "Newly generated line", unit: "EACH" });
  disturbed.quotation = Object.fromEntries(Object.entries(disturbed.quotation).reverse());
  const reopened = openJob(disturbed);
  const expectedB = [...arranged.rows[sectionB]];
  expectedB.splice(expectedB.indexOf(afterRow) + 1, 0, "new-generated-line");
  assert.deepEqual(ids(reopened).rows[sectionB], expectedB, "new line sits after the line it was inserted after");
  for (const name of [sectionA, sectionC, sectionD]) assert.deepEqual(ids(reopened).rows[name], arranged.rows[name], name);
  assert.deepEqual(ids(reopened).sections, arranged.sections, "section order survives re-keyed object");
  // Section order is recoverable from section.sortOrder alone.
  const withoutList = roundTrip(stored); delete withoutList.quotationSectionOrder;
  assert.deepEqual(persistedSectionOrder(withoutList.quotation), arranged.sections);
  assert.deepEqual(ids(openJob(withoutList)).sections, arranged.sections);
});

check("Client Selections sync does not push manually placed lines to the end", () => {
  const sectionName = "SHOWER SCREENS & MIRRORS - CLIENT SELECTIONS";
  const line = (lineId, productName) => ({ lineId, productId: lineId, productName, supplier: "Test", unit: "EACH", unitPrice: 100, unitAllowance: 0, allocations: [{ locationKey: "ensuite", location: "Ensuite", quantity: 1 }] });
  const book = (lines) => ({ rooms: [{ rows: [{ guidedSelection: { requirementKey: "shower-screen", requirementLabel: "Shower Screens", plumbingAllocation: { lines } } }] }] });
  let workbook = connectAllocatedSelectionsToQuotation({ quotation: { [sectionName]: { rows: [{ id: "manual-1", item: "Manual line 1" }, { id: "manual-2", item: "Manual line 2" }] } } }, book([line("a", "Screen A"), line("b", "Screen B")]));
  workbook = { ...workbook, quotation: stampQuotationOrder(workbook.quotation) };
  // The estimator drags Screen B to the top, above the manual lines.
  const rows = workbook.quotation[sectionName].rows;
  const moved = [rows.find((row) => row.productName === "Screen B"), ...rows.filter((row) => row.productName !== "Screen B")];
  workbook = { ...workbook, quotation: stampQuotationOrder({ ...workbook.quotation, [sectionName]: { ...workbook.quotation[sectionName], rows: moved } }) };
  const arrangedIds = workbook.quotation[sectionName].rows.map((row) => row.id);
  const synced = connectAllocatedSelectionsToQuotation(workbook, book([line("a", "Screen A"), line("b", "Screen B"), line("c", "Screen C")]));
  assert.notDeepEqual(synced.quotation[sectionName].rows.map((row) => row.id).slice(0, 4), arrangedIds, "the raw sync does rebuild the array");
  const restored = applyPersistedQuotationOrder(synced.quotation)[sectionName].rows.map((row) => row.id);
  assert.deepEqual(restored.filter((id) => !id.endsWith(":c")), arrangedIds, "saved lines keep their saved positions");
  assert.equal(restored.length, 5, "the new selection is added, not dropped");
});

check("Master Template save / update -> load restores the exact order", () => {
  const template = roundTrip(utils.sanitizeWorkbookForTemplate(job, { name: "Master Estimate Template", key: "template:master-estimate-template", templateType: "master_base_template" }));
  assert.equal(template.jobId, "");
  const loaded = utils.normalizeWorkbook({ ...template, page: "projectDashboard" });
  assert.deepEqual(ids(loaded), arranged);
  // A job created from the template starts in the template's order.
  const created = utils.normalizeWorkbook({ ...template, templateType: "job", jobId: "from-template" });
  assert.deepEqual(ids(created), arranged);
  // Updating the template again after another move.
  const r = created.quotation[sectionA].rows.map((row) => row.id);
  const edited = moveLine(created, sectionA, r[3], sectionA, r[0], "before");
  const updated = roundTrip(utils.sanitizeWorkbookForTemplate(edited, { name: "Master Estimate Template", key: "template:master-estimate-template", templateType: "master_base_template" }));
  assert.deepEqual(ids(utils.normalizeWorkbook(updated)), ids(edited));
});

check("Export .gr8job -> import restores the exact order", () => {
  const exported = roundTrip({ type: "gr8-master-job-package", workbook: { ...job, quotation: stampQuotationOrder(applyPersistedQuotationOrder(job.quotation), job.quotationSectionOrder) }, quotation: { quotation: job.quotation } });
  const imported = utils.normalizeWorkbook(utils.withPersistedQuotationOrder(utils.normalizeWorkbook({ ...exported.workbook, openedFileName: "exported.gr8job" })));
  assert.deepEqual(ids(imported), arranged);
  assert.deepEqual(imported.quotationSectionOrder, job.quotationSectionOrder.filter((name) => imported.quotation[name]));
});

check("row order helper keeps unstamped rows beside their predecessor", () => {
  const rows = [{ id: "c", sortOrder: 3, sortSection: "S" }, { id: "x" }, { id: "a", sortOrder: 1, sortSection: "S" }, { id: "b", sortOrder: 2, sortSection: "S" }, { id: "other", sortOrder: 1, sortSection: "Elsewhere" }];
  assert.deepEqual(applyPersistedRowOrder(rows, "S").map((row) => row.id), ["a", "b", "other", "c", "x"]);
  const untouched = [{ id: "a" }, { id: "b" }];
  assert.equal(applyPersistedRowOrder(untouched, "S"), untouched);
});

check("old job revisions are pruned so browser storage cannot grow without limit", () => {
  const key = "job:abc";
  const keys = [key, "active-job", ...[1, 2, 3, 4, 5, 6].map((revision) => `${key}:snapshot:revision-${revision}-2026-10-0${revision}T00:00:00.000Z`), `${key}:snapshot:recovery-original`, "job:other:snapshot:revision-1-x"];
  assert.deepEqual(supersededRevisionKeys(keys, key, 6), [1, 2, 3].map((revision) => `${key}:snapshot:revision-${revision}-2026-10-0${revision}T00:00:00.000Z`));
  assert.deepEqual(supersededRevisionKeys(keys, key, 2), []);
});

const recovered = "recovery/quotation-order-2026-10-02/extracted/estimate.json";
if (fs.existsSync(recovered)) {
  check("the recovered 06:54 job file reopens in exactly its saved (reordered) order", () => {
    const workbook = JSON.parse(fs.readFileSync(recovered, "utf8")).workbook;
    const savedRows = Object.fromEntries(Object.entries(workbook.quotation).map(([name, section]) => [name, (section.rows || []).map((row) => row.id)]));
    const reopened = openJob(workbook);
    assert.deepEqual(Object.fromEntries(Object.entries(reopened.quotation).map(([name, section]) => [name, (section.rows || []).map((row) => row.id)])), savedRows);
    // The displayed section order is exactly what the saved file displays.
    assert.deepEqual(ids(reopened).sections, utils.orderedQuoteSections(workbook.quotation, workbook.quotationSectionOrder));
    const again = openJob(saveJob(reopened));
    assert.deepEqual(ids(again), ids(reopened), "save -> reopen of the recovered job");
    const movedIds = new Set(workbook.quoteHistory.filter((item) => item.field === "moved").map((item) => `${item.section}|${item.id}`));
    assert(movedIds.size >= 5);
    for (const entry of movedIds) { const [name, id] = entry.split("|"); if (!workbook.quotation[name]) continue; const before = savedRows[name].indexOf(id); if (before < 0) continue; assert.equal(again.quotation[name].rows.findIndex((row) => row.id === id), before, entry); }
  });
}
console.log(`\n${results.length} checks passed`);
