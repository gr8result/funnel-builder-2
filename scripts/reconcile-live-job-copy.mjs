import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { applyConfirmedClientSelectionCorrections } from '../lib/builders/clientSelectionCorrections.js';
import { canonicaliseSelectionAllocations } from '../lib/builders/selectionAllocationRooms.js';
import { crossCategoryDuplicates } from '../lib/builders/selectionAttention.js';
import { projectRoomModel } from '../lib/builders/projectRoomModel.js';

// Reconciles an ISOLATED COPY of the live job. Never touches the browser's storage or production.
//   node scripts/reconcile-live-job-copy.mjs <live-record.json> <job-with-corrections.gr8job> <out.gr8job>
// - live record: the decoded IndexedDB job record (read-only copy of the user's browser data);
// - corrections source: an earlier job file that carries the builder's confirmed corrections ledger
//   (book.clientSelectionCorrections) and the proposal artwork the live job references by content id;
// - output: a .gr8job with the ledger carried forward and applied, room aliases resolved, and every
//   removed line kept in book.clientSelectionAudit.
const [livePath, sourcePath, outPath] = process.argv.slice(2);
const liveRecord = JSON.parse(fs.readFileSync(livePath, 'utf8'));
const sourceFile = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const source = sourceFile.workbook || sourceFile;
const live = structuredClone(liveRecord.workbook);

// 1. Proposal artwork: the live job holds content-addressed references; restore them from the images
//    of the source file whose sha256 matches (exact content, verified).
const images = new Map();
(function walk(value) {
  if (typeof value === 'string' && value.startsWith('data:')) { images.set(crypto.createHash('sha256').update(Buffer.from(value, 'utf8')).digest('hex'), value); return; }
  if (value && typeof value === 'object') for (const key of Object.keys(value)) walk(value[key]);
})(source.projectEstimateBuilder);
let restored = 0, unresolved = 0;
const materialise = (value) => {
  if (Array.isArray(value)) return value.map(materialise);
  if (!value || typeof value !== 'object') return value;
  if (typeof value.__gr8StoredDataUrl === 'string' && Object.keys(value).length === 1) {
    const image = images.get(value.__gr8StoredDataUrl);
    if (image) { restored += 1; return image; }
    unresolved += 1; return value;
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, materialise(child)]));
};
live.projectEstimateBuilder = materialise(live.projectEstimateBuilder);

// 2. The builder's confirmed corrections (a job-level instruction), carried forward and applied.
const ledgerSource = source.clientSelectionsBook?.clientSelectionCorrections;
if (!ledgerSource) throw new Error('The corrections source carries no clientSelectionCorrections ledger.');
const book = live.clientSelectionsBook;
const ledger = book.clientSelectionCorrections || { ...ledgerSource, carriedForward: { from: path.basename(sourcePath), at: new Date().toISOString(), reason: 'Live job was replaced on 2026-10-30 by a job file saved before these corrections were confirmed (2026-10-25T23:09Z).' } };
const lineKey = (row, line) => `${row.guidedRequirementKey || row.guidedSelection?.requirementKey}|${line.productId || line.productName}`;
const linesOf = (value) => new Map((value.rooms || []).flatMap((room) => (room.rows || []).flatMap((row) => (row.guidedSelection?.plumbingAllocation?.lines || []).map((line) => [lineKey(row, line), { room: room.name, row, line }]))));
// The builder's confirmed room list travels with the ledger: the live job's room model is an older,
// unconfirmed state brought back by the same older file (it still has Pantry unmerged).
const liveModel = book.projectRoomModel || live.projectRoomModel || null;
const confirmedModel = source.projectRoomModel?.confirmedAt ? source.projectRoomModel : source.clientSelectionsBook?.projectRoomModel;
const carryModel = confirmedModel?.confirmedAt && !liveModel?.confirmedAt;
const replacedModel = carryModel ? liveModel : null;
if (carryModel) { book.projectRoomModel = { ...confirmedModel, carriedForward: { from: path.basename(sourcePath), at: new Date().toISOString() } }; live.projectRoomModel = book.projectRoomModel; }
const before = linesOf(book);
let corrected = applyConfirmedClientSelectionCorrections({ ...book, clientSelectionCorrections: ledger });
const model = projectRoomModel(corrected, live);
const { book: canonical, changes: roomChanges } = canonicaliseSelectionAllocations(corrected, model);
corrected = canonical;
const after = linesOf(corrected);

// 3. Audit: every removed line and every removed allocation, kept on the book (not an active selection).
const removed = [];
for (const [key, entry] of before) {
  const now = after.get(key);
  const allocations = (entry.line.allocations || []).map((item) => `${item.location}×${item.quantity}`);
  if (!now) removed.push({ requirementKey: key.split('|')[0], productId: entry.line.productId || '', productName: entry.line.productName, quantity: entry.line.quantity, allocations, outcome: 'removed by confirmed correction' });
  else if (Number(now.line.quantity) !== Number(entry.line.quantity)) removed.push({ requirementKey: key.split('|')[0], productId: entry.line.productId || '', productName: entry.line.productName, quantity: Number(entry.line.quantity) - Number(now.line.quantity), allocations, outcome: 'allocations removed by confirmed correction' });
}
corrected.clientSelectionAudit = { ...(book.clientSelectionAudit || {}), reconciledAt: new Date().toISOString(), replacedRoomModel: replacedModel, removedLines: [...(book.clientSelectionAudit?.removedLines || []), ...removed], roomAliases: roomChanges.map((change) => ({ ...change })) };
const reconciledAt = corrected.clientSelectionAudit.reconciledAt;
corrected.metadata = { ...(corrected.metadata || {}), selectionRevision: `client-selections:${reconciledAt}`, savedAt: reconciledAt };
corrected.updatedAt = reconciledAt;
for (const alias of ['clientSelectionsBook', 'selectionsBook', 'selectionSchedule', 'selectionSchedules']) live[alias] = corrected;
if (corrected.projectRoomModel) live.projectRoomModel = corrected.projectRoomModel;
live.savedAt = reconciledAt;

// 4. Report.
const rows = (corrected.rooms || []).flatMap((room) => room.rows || []);
const linesFor = (key) => rows.filter((row) => (row.guidedRequirementKey || row.guidedSelection?.requirementKey) === key).flatMap((row) => row.guidedSelection?.plumbingAllocation?.lines || []);
const describe = (key) => linesFor(key).map((line) => `${line.productName} ×${line.quantity} [${(line.allocations || []).map((item) => `${item.location}${item.fixture ? ` (${item.fixture})` : ''}×${item.quantity}`).join(', ')}]`);
const levelAllocations = rows.flatMap((row) => (row.guidedSelection?.plumbingAllocation?.lines || []).flatMap((line) => (line.allocations || []).filter((item) => /^(upstairs|downstairs|ground floor|first floor|level \d)$/i.test(String(item.location || '').trim())).map((item) => `${row.guidedRequirementKey}: ${line.productName} @ ${item.location}`)));
const roomNames = new Set((model.rooms || []).filter((room) => !room.removed).map((room) => room.name));
const nonRooms = [...new Set(rows.flatMap((row) => (row.guidedSelection?.plumbingAllocation?.lines || []).flatMap((line) => (line.allocations || []).map((item) => item.location))).filter((location) => !roomNames.has(location)))];
const mergedAliases = rows.flatMap((row) => (row.guidedSelection?.plumbingAllocation?.lines || []).flatMap((line) => (line.allocations || []).filter((item) => Array.isArray(item.sourceLocations) && item.sourceLocations.length > 1).map((item) => ({ requirementKey: row.guidedRequirementKey, product: line.productName, room: item.location, quantity: item.quantity, fromNames: item.sourceLocations }))));
const report = {
  live: { revision: liveRecord.revision, savedAt: liveRecord.savedAt },
  artwork: { restored, unresolved },
  ledger: { carriedForward: Boolean(ledger.carriedForward), confirmedAt: ledger.confirmedAt },
  roomModel: { carriedForward: carryModel, rooms: (model.rooms || []).filter((room) => !room.removed).length, confirmedAt: model.confirmedAt || '' },
  toilets: describe('toilet-suite'),
  fans: describe('ceiling-fan'),
  bath: describe('bath'),
  levelAllocations,
  nonRoomLocations: nonRooms,
  aliasMergesToReview: mergedAliases,
  crossCategory: crossCategoryDuplicates(corrected).map((entry) => `${entry.product} @ ${entry.room}: ${entry.owners.map((owner) => `${owner.label} ×${owner.quantity}`).join(' + ')}`),
  removed,
};
const wrapper = { ...sourceFile, jobId: live.jobId, lastModified: reconciledAt, workbook: live };
fs.writeFileSync(outPath, JSON.stringify(wrapper));
fs.writeFileSync(outPath.replace(/\.gr8job$/, '.report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
