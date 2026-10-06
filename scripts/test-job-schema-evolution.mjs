// Job schema evolution: an older saved job must keep loading and saving when the application
// gains, or retires, optional sections - and a genuinely corrupt job must still be refused.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-job-schema-evolution.mjs [--job=path/to/estimate.json]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { persistCompleteJob, restoreCompleteWorkbook, normalizeJobForCurrentSchema, validateJobWorkbook,
  JOB_SCHEMA_VERSION, CORE_JOB_SECTIONS, PROTECTED_JOB_SECTIONS, RETIRED_JOB_SECTIONS } from '../lib/construction-estimation/jobPersistence.js';
import { createEstimateBuilderWorkbookDefaults } from '../lib/construction-estimation/estimateBuilderWorkbookDefaults.js';
import { FINAL_CABINETRY, reconcileCabinetryQuotation } from '../lib/construction-estimation/finalCabinetryQuotation.js';

// Minimal in-memory IndexedDB: enough for the real persistCompleteJob transaction, including abort.
globalThis.IDBKeyRange = { bound: (lower, upper) => ({ lower, upper }) };
function memoryDatabase(records = new Map()) {
  const open = async () => ({ close() {}, transaction() {
    const before = new Map(records);
    const transaction = { oncomplete: null, onerror: null, onabort: null, error: null };
    let pending = 0, done = false;
    const settle = () => queueMicrotask(() => { if (!done && pending === 0) { done = true; transaction.oncomplete?.(); } });
    const request = (run) => {
      const handle = { onsuccess: null, onerror: null, result: undefined };
      pending += 1;
      queueMicrotask(() => {
        if (done) return;
        try { handle.result = run(); pending -= 1; handle.onsuccess?.(); settle(); }
        catch (error) { transaction.error = error; transaction.abort(); }
      });
      return handle;
    };
    transaction.abort = () => { if (done) return; done = true; records.clear(); before.forEach((value, key) => records.set(key, value)); queueMicrotask(() => transaction.onabort?.()); };
    transaction.objectStore = () => ({
      get: (key) => request(() => structuredClone(records.get(key))),
      put: (value, key) => request(() => { records.set(key, structuredClone(value)); }),
      add: (value, key) => request(() => { if (records.has(key)) throw new Error('Key already exists.'); records.set(key, structuredClone(value)); }),
      delete: (key) => request(() => { records.delete(key); }),
      getAllKeys: (range) => request(() => [...records.keys()].filter((key) => key >= range.lower && key <= range.upper)),
    });
    return transaction;
  } });
  return { open, records };
}
const save = (database, workbook, savedAt) => persistCompleteJob({ openDatabase: database.open, storeName: 'jobs', key: `job:${workbook.jobId}`,
  workbook, name: 'Schema test', savedAt, activePointer: (record) => ({ key: record.key }) });
// The two calls normalizeWorkbook (useEstimateBuilderWorkbook.js) makes for every load path.
const owner = FINAL_CABINETRY.workspaceId;
const defaults = () => createEstimateBuilderWorkbookDefaults({}, { workspaceId: owner });
// Defaults stamp the moment they were created; that is not job content.
const timeless = (value) => JSON.parse(JSON.stringify(value, (key, item) => /At$/.test(key) && typeof item === 'string' ? undefined : item));
const load = (saved) => reconcileCabinetryQuotation(restoreCompleteWorkbook(defaults(), normalizeJobForCurrentSchema(saved)), owner);
const seedLegacy = (database, workbook) => database.records.set(`job:${workbook.jobId}`, { type: 'job', key: `job:${workbook.jobId}`, jobId: workbook.jobId, schemaVersion: 1, revision: 4, savedAt: '2026-10-01T00:00:00.000Z', workbook: structuredClone(workbook) });
const results = {};
const test = async (name, run) => { try { await run(); results[name] = 'PASS'; } catch (error) { results[name] = 'FAIL'; console.error(`FAIL ${name}:`, String(error.message).slice(0, 600)); } };

// A job as an older version wrote it: real work in every project section, no schema version,
// plus the retired cabinetry reports that triggered "missing saved section cabinetryCatalogueAudit".
function oldJob() {
  const book = { ...defaults(), jobId: 'old-job-1', projectId: 'old-job-1', workspaceId: owner, templateType: 'job' };
  delete book.jobSchemaVersion;
  book.data = { ...book.data, projectName: 'Existing project', carpetFloorFinishM2: 86.35 };
  book.quotation = { ...book.quotation, CABINETRY: { ...book.quotation.CABINETRY, rows: book.quotation.CABINETRY.rows.map((row, index) => index === 5 ? { ...row, quantity: 4 } : row) },
    'CUSTOM SECTION': { rows: [{ id: 'custom-1', item: 'Estimator line', quantity: 3, manualRate: 125.5, notes: 'keep me' }], sortOrder: 99 } };
  book.clientSelectionsBook = { rooms: [{ id: 'kitchen', name: 'Kitchen', rows: [{ id: 'sink', guidedSelection: { requirementKey: 'kitchen_sink', productId: 'p-1' } }] }], metadata: { selectionRevision: 'r1' } };
  book.aiPlanTakeoffJob = { projectId: 'old-job-1', aiAnalysis: { rooms: [{ name: 'Bedroom 4', confidence: 0.9 }, { name: 'Media Room', confidence: 0.9 }] }, walls: [{ id: 'w1', lengthMm: 4200 }] };
  book.takeoffEngine = { aiPlanTakeoffJob: { projectId: 'old-job-1' } };
  book.productLibrary = { products: [{ productCode: 'keep-1', category: 'ELECTRICAL' }] };
  book.procurement = { items: [{ id: 'po-1', qty: 2 }] };
  book.projectEstimateBuilder = { pages: [{ id: 'page-1', blocks: [{ text: 'Proposal' }] }] };
  book.registeredJob = { jobId: 'old-job-1', jobNumber: '03/09' };
  book.cabinetryCatalogueAudit = { audited: 412, unmatched: ['Old cupboard'] };
  book.cabinetryQuoteMigration = { revision: 'retired' };
  return book;
}
const projectData = (book) => Object.fromEntries(Object.entries(book).filter(([key]) => !(key in RETIRED_JOB_SECTIONS) && !['jobSchemaVersion', 'savedAt', 'cabinetryDatasetRevision', 'quotationSectionOrder'].includes(key)));

// Classification is coherent, and a new job is born on the current schema.
assert.equal(new Set([...CORE_JOB_SECTIONS, ...PROTECTED_JOB_SECTIONS, ...Object.keys(RETIRED_JOB_SECTIONS)]).size, CORE_JOB_SECTIONS.length + PROTECTED_JOB_SECTIONS.length + Object.keys(RETIRED_JOB_SECTIONS).length, 'a section has one class');
assert(Object.keys(RETIRED_JOB_SECTIONS).every((key) => !Object.hasOwn(defaults(), key)), 'no retired section is still created');
assert(CORE_JOB_SECTIONS.every((key) => key === 'jobId' || defaults()[key]), 'defaults carry every core section');

await test('A current job', async () => {
  const database = memoryDatabase();
  const job = load({ ...defaults(), jobId: 'new-job-1', workspaceId: owner });
  assert.equal(job.jobSchemaVersion, JOB_SCHEMA_VERSION);
  const first = await save(database, job, '2026-10-05T01:00:00.000Z');
  assert.equal(first.jobSchemaVersion, JOB_SCHEMA_VERSION); assert.equal(first.revision, 1);
  const reloaded = load(database.records.get('job:new-job-1').workbook);
  assert.deepEqual(projectData(reloaded), projectData(job));
  assert.equal(normalizeJobForCurrentSchema(reloaded), reloaded, 'a current job is not rewritten');
  assert.equal((await save(database, reloaded, '2026-10-05T01:01:00.000Z')).revision, 2);
});

await test('B old job missing cabinetryCatalogueAudit', async () => {
  // Stored by the older version WITH the section; the running application no longer produces it.
  const database = memoryDatabase(); const stored = oldJob(); seedLegacy(database, stored);
  const opened = load(structuredClone(stored));
  assert(!Object.hasOwn(opened, 'cabinetryCatalogueAudit'));
  const record = await save(database, opened, '2026-10-05T02:00:00.000Z');
  assert.equal(record.revision, 5); assert.equal(record.workbook.jobSchemaVersion, JOB_SCHEMA_VERSION);
  // The reverse: a job that never had it, saved over a record that does, and a raw legacy workbook saved as-is.
  const never = oldJob(); delete never.cabinetryCatalogueAudit; delete never.cabinetryQuoteMigration;
  assert.doesNotThrow(() => validateJobWorkbook(never, { jobId: stored.jobId, workbook: stored }));
  const raw = memoryDatabase(); seedLegacy(raw, stored);
  const direct = await save(raw, stored, '2026-10-05T02:01:00.000Z');
  assert(!Object.hasOwn(direct.workbook, 'cabinetryCatalogueAudit'), 'retired sections are removed at the save boundary');
  assert.deepEqual(projectData(direct.workbook), projectData(stored));
  // The previous revision keeps the old copy untouched.
  assert.deepEqual(raw.records.get('job:old-job-1:snapshot:revision-4-2026-10-01T00:00:00.000Z').workbook.cabinetryCatalogueAudit, stored.cabinetryCatalogueAudit);
});

await test('C old job missing multiple new optional sections', async () => {
  const stored = oldJob();
  const optional = ['estimateInclusions', 'standardInclusions', 'summaryAdjustments', 'formulaNotes', 'cashflowPayments', 'windowsDoors', 'formulaRows'].filter((key) => Object.hasOwn(stored, key));
  assert(optional.length >= 4);
  const older = structuredClone(stored); for (const key of optional) delete older[key];
  // The stored record also carries sections this version does not know or no longer writes.
  const previous = { ...structuredClone(older), futureModule: { rows: [1] }, importAudit: { imported: 3 }, uiState: { collapsed: true }, cabinetryReconciliation: { entries: [] } };
  const database = memoryDatabase(); seedLegacy(database, previous);
  const opened = load(structuredClone(older));
  for (const key of optional) assert.deepEqual(timeless(opened[key]), timeless(defaults()[key]), `${key} initialised from current defaults`);
  for (const key of Object.keys(projectData(older)).filter((key) => key !== 'quotation')) assert.deepEqual(opened[key], older[key], `${key} untouched`);
  assert.deepEqual(opened.quotation['CUSTOM SECTION'], older.quotation['CUSTOM SECTION']);
  assert.equal(opened.quotation.CABINETRY.rows[5].quantity, 4);
  assert.equal((await save(database, opened, '2026-10-05T03:00:00.000Z')).revision, 5);
  // The shared normaliser fills only what is missing and never replaces a present section.
  const current = defaults();
  const filled = normalizeJobForCurrentSchema(older, current);
  for (const key of optional) assert.equal(filled[key], current[key]);
  for (const key of Object.keys(older)) if (!(key in RETIRED_JOB_SECTIONS)) assert.equal(filled[key], older[key], `${key} kept by reference`);
});

await test('D genuinely corrupt core job', async () => {
  const stored = oldJob(); const database = memoryDatabase(); seedLegacy(database, stored);
  const before = structuredClone(database.records.get('job:old-job-1'));
  const { jobId, ...noIdentity } = load(structuredClone(stored));
  await assert.rejects(persistCompleteJob({ openDatabase: database.open, storeName: 'jobs', key: 'job:old-job-1', workbook: noIdentity, activePointer: () => ({}) }), /no stable jobId/);
  const good = load(structuredClone(stored));
  for (const key of ['data', 'quotation', 'formulas', 'clientPage', 'cashflowPayments']) {
    const { [key]: removed, ...broken } = good;
    await assert.rejects(save(database, broken, '2026-10-05T04:00:00.000Z'), new RegExp(`Incomplete job: missing ${key}\\.`));
  }
  await assert.rejects(save(database, { ...good, quotation: {} }, '2026-10-05T04:00:00.000Z'), /Refusing to replace saved quotation with an empty payload/);
  await assert.rejects(persistCompleteJob({ openDatabase: database.open, storeName: 'jobs', key: 'job:old-job-1', workbook: { ...good, jobId: 'another-job' }, activePointer: () => ({}) }), /Storage key does not match/);
  // Project work that was saved cannot silently vanish from a later save.
  for (const key of ['clientSelectionsBook', 'aiPlanTakeoffJob', 'productLibrary', 'projectEstimateBuilder']) {
    const { [key]: removed, ...partial } = good;
    await assert.rejects(save(database, partial, '2026-10-05T04:00:00.000Z'), new RegExp(`missing saved section ${key}`));
  }
  assert.deepEqual(database.records.get('job:old-job-1'), before, 'a refused save leaves the stored job exactly as it was');
});

await test('E round trip', async () => {
  // OLD .gr8job -> load -> migrate -> save -> reopen -> save -> reopen.
  const original = oldJob();
  const file = JSON.parse(JSON.stringify({ type: 'gr8-master-job-package', schemaVersion: 'gr8job.package.v1', workbook: original }));
  const database = memoryDatabase();
  const opened = load(file.workbook);
  await save(database, opened, '2026-10-05T05:00:00.000Z');
  const reopened = load(JSON.parse(JSON.stringify(database.records.get('job:old-job-1').workbook)));
  const second = await save(database, reopened, '2026-10-05T05:01:00.000Z');
  const final = load(JSON.parse(JSON.stringify({ workbook: second.workbook })).workbook);
  assert.equal(final.jobSchemaVersion, JOB_SCHEMA_VERSION); validateJobWorkbook(final);
  for (const key of Object.keys(projectData(original)).filter((key) => key !== 'quotation')) assert.deepEqual(final[key], original[key], `${key} retained`);
  assert.equal(final.data.carpetFloorFinishM2, 86.35);
  assert.deepEqual(final.quotation['CUSTOM SECTION'], original.quotation['CUSTOM SECTION']);
  assert.deepEqual(Object.keys(final.quotation), Object.keys(original.quotation));
  assert.deepEqual(final.quotation.CABINETRY.rows.map((row) => [row.id, row.quantity]), original.quotation.CABINETRY.rows.map((row) => [row.id, row.quantity]));
  assert.deepEqual(projectData(final), projectData(reopened), 'a second cycle changes nothing');
});

// Optional: the same round trip on a real job workbook (large; pass --job=path).
const realPath = process.argv.find((arg) => arg.startsWith('--job='))?.slice(6);
if (realPath) await test('REAL JOB round trip', async () => {
  const parsed = JSON.parse(fs.readFileSync(realPath, 'utf8'));
  const original = parsed.workbook || parsed;
  const withRetired = { ...original, jobId: original.jobId || 'real-job', cabinetryCatalogueAudit: { audited: 1 } };
  const database = memoryDatabase(); seedLegacy(database, withRetired);
  const normalised = normalizeJobForCurrentSchema(withRetired);
  const record = await save(database, normalised, '2026-10-05T06:00:00.000Z');
  assert.equal(record.workbook.jobSchemaVersion, JOB_SCHEMA_VERSION);
  const keys = Object.keys(original).filter((key) => !['savedAt', 'jobSchemaVersion'].includes(key));
  for (const key of keys) assert.deepEqual(record.workbook[key], original[key], `${key} retained`);
  console.log(`real job: ${keys.length} sections retained byte-for-byte, carpet ${JSON.stringify(Object.entries(original.data || {}).filter(([key]) => /carpet/i.test(key)).slice(0, 4))}`);
});

for (const [name, outcome] of Object.entries(results)) console.log(`TEST ${name}: ${outcome}`);
if (Object.values(results).some((outcome) => outcome !== 'PASS')) process.exit(1);
