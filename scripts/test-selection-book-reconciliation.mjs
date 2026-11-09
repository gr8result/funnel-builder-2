import assert from 'node:assert/strict';
import { reconcileSelectionBookSources, bookHasSelections, staleDraftReason, staleClientSelectionsSave } from '../lib/builders/selectionBookSource.js';

// Which Selections Book a job opens with: its own book, this browser's draft, or the cloud book.
const room = (rows) => ({ id: 'room-1', name: 'Kitchen', rows });
const populated = (revision) => ({ id: 'book-job', rooms: [room([{ id: 'r1', selectedProduct: 'Sink A', guidedSelection: { requirementKey: 'sink', productId: 'sink-a' } }])], metadata: { selectionRevision: revision } });
const electricalOnly = { id: 'book-e', rooms: [room([{ id: 'r2', guidedSelection: { electricalSchedule: { rooms: [{ room: 'Kitchen', points: { 'double-gpo': 6 } }] } } }])], metadata: {} };
// A real template row: pre-filled standard inclusion / default product, no guided selection.
const template = { id: 'book-template', rooms: [room([{ id: 't1', item: 'Sink', selectedProduct: 'Oliveri Diaz Sink', selectedOptionId: 'oliveri-oliveri-diaz-sink-dz153', status: 'approved' }, { id: 't2', selectedProduct: 'Brickwork Included Selection', selectedOptionId: 'builder-standard-brickwork-included-selection-standard', selectedCost: 0 }])], metadata: {} };
const cleared = { id: 'book-job', rooms: [room([{ id: 't1', selectedProduct: '' }])], metadata: { selectionsClearedAt: '2026-10-30T01:00:00Z' } };

assert(bookHasSelections(electricalOnly), 'an Electrical schedule (no product) is a recorded selection');
assert(!bookHasSelections(template));

// The production case: a cloud template saved at 10:06 +10:00 (00:06Z) vs the job saved at 00:08Z.
let result = reconcileSelectionBookSources([
  { source: 'job', book: populated('rev-1'), savedAt: '2026-10-30T00:08:30.000Z' },
  null,
  { source: 'cloud', book: template, savedAt: '2026-10-30T10:06:33.179+10:00' },
]);
assert.equal(result.chosen.source, 'job');
console.log('PASS an older cloud row with a later-sorting timezone string does not win');

result = reconcileSelectionBookSources([
  { source: 'job', book: populated('rev-1'), savedAt: '2026-10-30T00:08:30Z' },
  null,
  { source: 'cloud', book: template, savedAt: '2026-10-30T05:00:00Z' },
]);
assert.equal(result.chosen.source, 'job');
assert.equal(result.skipped[0].source, 'cloud');
console.log('PASS a newer cloud book with no selections never replaces the populated job book');

result = reconcileSelectionBookSources([
  { source: 'job', book: populated('rev-1'), savedAt: '2026-10-30T00:08:30Z' },
  null,
  { source: 'cloud', book: cleared, savedAt: '2026-10-30T01:00:00Z' },
]);
assert.equal(result.chosen.source, 'cloud');
console.log('PASS a confirmed clearing (newer) is respected');

result = reconcileSelectionBookSources([
  { source: 'job', book: populated('rev-2'), savedAt: '2026-10-30T02:00:00Z' },
  null,
  { source: 'cloud', book: cleared, savedAt: '2026-10-30T01:00:00Z' },
]);
assert.equal(result.chosen.source, 'job');
console.log('PASS selections made after a clearing win');

const fewer = { ...populated('rev-3'), rooms: [room([{ id: 'r1', selectedProduct: 'Sink B', guidedSelection: { requirementKey: 'sink', productId: 'sink-b' } }])] };
// A draft made from another saved revision of the job is stale, however new its write time: the
// page re-stamps a draft each time it writes it (2026-11-04: a September book replaced a corrected job).
result = reconcileSelectionBookSources([
  { source: 'job', book: populated('rev-1'), savedAt: '2026-10-30T00:00:00Z' },
  { source: 'browser-draft', book: fewer, savedAt: '2026-10-30T00:05:00Z' },
  null,
]);
assert.equal(result.chosen.source, 'job');
assert.equal(result.skipped[0].source, 'browser-draft');
assert.equal(result.skipped[0].stale, true);
console.log('PASS a draft of a different saved revision never replaces the job');

// A job with no recorded revision keeps the old rule: a newer populated change wins.
const unrevised = { ...populated('rev-1'), metadata: {} };
result = reconcileSelectionBookSources([
  { source: 'job', book: unrevised, savedAt: '2026-10-30T00:00:00Z' },
  { source: 'browser-draft', book: fewer, savedAt: '2026-10-30T00:05:00Z' },
  null,
]);
assert.equal(result.chosen.source, 'browser-draft');
console.log('PASS without a recorded job revision, a newer populated change (e.g. a replaced product) wins');

result = reconcileSelectionBookSources([
  { source: 'job', book: populated('rev-9'), savedAt: '2026-10-30T00:00:00Z' },
  { source: 'browser-draft', book: populated('rev-9'), savedAt: '2026-10-30T00:00:05Z' },
  { source: 'cloud', book: populated('rev-9'), savedAt: '2026-10-30T00:00:09Z' },
]);
assert.equal(result.chosen.source, 'job');
console.log('PASS the same selection revision opens from the job');

result = reconcileSelectionBookSources([
  { source: 'job', book: electricalOnly, savedAt: '2026-10-30T00:00:00Z' },
  { source: 'browser-draft', book: template, savedAt: '2026-10-30T00:09:00Z' },
  null,
]);
assert.equal(result.chosen.source, 'job');
console.log('PASS an Electrical-only job book is not replaced by a newer empty draft');

result = reconcileSelectionBookSources([null, { source: 'browser-draft', book: template, savedAt: 'x' }, { source: 'cloud', book: template, savedAt: '2026-10-30T00:00:00Z' }]);
assert.equal(result.chosen.source, 'cloud');
assert.equal(reconcileSelectionBookSources([null, null, null]).chosen, null);
console.log('PASS with nothing recorded anywhere, the newest book opens; with no book, none');
// --- 2026-11-04 recurrence: the obsolete O.Novo allocation ----------------------------------------
// The job holds the corrected book (revision 2026-11-03); this browser's draft holds the 2 November
// book with O.Novo x5 under Shower Rail / Rose, re-written (re-stamped) at 15:14 on 4 November.
const showerRow = (lines) => ({ id: 'row-shower', guidedRequirementKey: 'shower-fixtures', selectedProduct: lines.join('; '), guidedSelection: { requirementKey: 'shower-fixtures', productName: lines.join('; '), plumbingAllocation: { lines: lines.map((name) => ({ productName: name })) } } });
const correctedJob = { id: 'book', rooms: [room([showerRow(['Vivid Slimline Single Shower on Rail'])])], metadata: { selectionRevision: 'client-selections:2026-11-03T02:02:14.348Z', savedAt: '2026-11-03T02:02:14.348Z' }, updatedAt: '2026-11-03T02:02:14.348Z' };
const novemberDraft = { id: 'book', rooms: [room([showerRow(['O.Novo Style Shower/Bath Mixer', 'Vivid Slimline Single Shower on Rail'])])], metadata: { selectionRevision: 'client-selections:2026-11-02T04:48:21.445Z' }, updatedAt: '2026-11-02T22:37:30.080Z' };
const hasNovo = (book) => JSON.stringify(book).includes('O.Novo');
for (const draftOf of [undefined, 'client-selections:2026-11-02T04:48:21.445Z']) {
  result = reconcileSelectionBookSources([
    { source: 'job', book: correctedJob, savedAt: '2026-11-03T02:02:14.348Z' },
    { source: 'browser-draft', book: novemberDraft, savedAt: '2026-11-04T05:14:00.000Z', draftOf },
    null,
  ]);
  assert.equal(result.chosen.source, 'job', `a re-stamped draft (draftOf ${draftOf || 'legacy'}) must not replace the corrected job`);
  assert(!hasNovo(result.chosen.book), 'the obsolete O.Novo allocation does not come back');
}
console.log('PASS the re-stamped 2 November draft does not bring the obsolete O.Novo row back over the corrected job');

// A draft of the job's CURRENT revision is still a candidate (same revision: the job copy opens).
result = reconcileSelectionBookSources([
  { source: 'job', book: correctedJob, savedAt: '2026-11-03T02:02:14.348Z' },
  { source: 'browser-draft', book: { ...correctedJob }, savedAt: '2026-11-04T05:14:00.000Z', draftOf: correctedJob.metadata.selectionRevision },
  null,
]);
assert.equal(result.chosen.source, 'job');
assert.equal(result.skipped.length, 0);
assert.equal(staleDraftReason({ draftOf: 'a', book: {} }, { book: { metadata: { selectionRevision: 'b' } } }) !== '', true);
assert.equal(staleDraftReason({ draftOf: 'a', book: {} }, { book: { metadata: {} } }), '');
console.log('PASS a draft of the current revision is not reported stale');

// The job-side guard: a save made from another revision is refused unless this tab wrote the newer one.
const jobAt = (revision) => ({ clientSelectionsBook: { metadata: { selectionRevision: revision } } });
assert.deepEqual(staleClientSelectionsSave('rev-old', jobAt('rev-file')), { baseRevision: 'rev-old', jobRevision: 'rev-file' });
assert.equal(staleClientSelectionsSave('rev-1', jobAt('rev-1')), null);
assert.equal(staleClientSelectionsSave('rev-1', jobAt('rev-2'), new Set(['rev-2'])), null, 'a save queued behind this tab\'s own save');
assert.equal(staleClientSelectionsSave('', jobAt('rev-2')), null, 'callers without a base keep working');
assert.equal(staleClientSelectionsSave('rev-1', {}), null, 'a job without a recorded revision');
console.log('PASS a Client Selections save from an older revision is refused by the job');
console.log('Selection book reconciliation: all checks passed.');
