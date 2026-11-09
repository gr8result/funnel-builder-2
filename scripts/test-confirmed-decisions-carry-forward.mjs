import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyConfirmedClientSelectionCorrections, carryForwardConfirmedDecisions, mergeCorrectionLedgers } from '../lib/builders/clientSelectionCorrections.js';

// Confirmed builder decisions survive an older copy of the job (job file, draft or cloud book).
//   node ... scripts/test-confirmed-decisions-carry-forward.mjs <live-record.json> <job-with-corrections.gr8job>
const [livePath, savedPath] = process.argv.slice(2);
const lines = (book, key) => (book.rooms || []).flatMap((room) => room.rows || []).filter((row) => (row.guidedRequirementKey || row.guidedSelection?.requirementKey) === key).flatMap((row) => row.guidedSelection?.plumbingAllocation?.lines || []);
const products = (book, key) => lines(book, key).map((line) => `${line.productName.split(' ').slice(0, 2).join(' ')}×${line.quantity}`).sort();

if (livePath && savedPath) {
  const older = JSON.parse(fs.readFileSync(livePath, 'utf8')).workbook.clientSelectionsBook;           // the file opened on 2026-10-30 (no ledger)
  const savedFile = JSON.parse(fs.readFileSync(savedPath, 'utf8'));
  const saved = (savedFile.workbook || savedFile);
  assert.equal(older.clientSelectionCorrections, undefined);
  assert(products(older, 'toilet-suite').some((name) => /Origin/.test(name)), 'the older copy has the Origin toilets');
  const { book, carried } = carryForwardConfirmedDecisions(older, [saved.clientSelectionsBook, { projectRoomModel: saved.projectRoomModel }]);
  assert.deepEqual(carried, { ledger: true, roomModel: true });
  const corrected = applyConfirmedClientSelectionCorrections(book);
  assert.deepEqual(products(corrected, 'toilet-suite'), ['ICON Close×4']);
  assert.deepEqual(products(corrected, 'ceiling-fan'), ['Ventair -×2']);
  assert(lines(corrected, 'ceiling-fan')[0].productName.includes('SPYDA'));
  assert.deepEqual(products(corrected, 'bath'), ['Riviere 1700mm×1']);
  assert.equal(corrected.projectRoomModel.confirmedAt, saved.projectRoomModel.confirmedAt);
  assert(!corrected.projectRoomModel.rooms.some((room) => room.name === 'Pantry' && !room.removed), 'Pantry is merged into Butler’s Pantry');
  console.log('PASS the 2026-10-30 incident: opening the older file keeps ICON ×4, SPYDA ×2, Riviere ×1 and the confirmed 25-room list');
}

// Rules on small books.
const ledgerA = { version: 1, confirmedAt: '2026-10-25T23:00:00Z', removeProducts: [{ requirementKey: 'toilet-suite', productId: 'OR001' }], removeFloorAllocations: [], mergeRooms: [] };
const ledgerB = { version: 1, confirmedAt: '2026-10-28T01:00:00Z', removeProducts: [{ requirementKey: 'ceiling-fan', productId: 'STA' }], removeFloorAllocations: [], mergeRooms: [{ from: 'Pantry', to: "Butler's Pantry" }] };
const merged = mergeCorrectionLedgers([ledgerA, ledgerB]);
assert.equal(merged.confirmedAt, ledgerB.confirmedAt);
assert.equal(merged.removeProducts.length, 2, 'no confirmed instruction is lost');
assert.equal(mergeCorrectionLedgers([ledgerA, ledgerA]).removeProducts.length, 1, 'no duplicates');
console.log('PASS ledgers merge as a union, stamped with the latest confirmation');

const confirmedOld = { confirmedAt: '2026-10-20T00:00:00Z', rooms: [{ id: 'a', name: 'Kitchen' }] };
const confirmedNew = { confirmedAt: '2026-10-25T00:00:00Z', rooms: [{ id: 'a', name: 'Kitchen' }, { id: 'b', name: 'Study' }] };
const unconfirmed = { rooms: [{ id: 'a', name: 'Kitchen' }] };
assert.equal(carryForwardConfirmedDecisions({ rooms: [], projectRoomModel: unconfirmed }, [{ projectRoomModel: confirmedNew }]).book.projectRoomModel, confirmedNew);
assert.equal(carryForwardConfirmedDecisions({ rooms: [], projectRoomModel: confirmedNew }, [{ projectRoomModel: confirmedOld }]).book.projectRoomModel, confirmedNew, 'an older confirmed list never replaces a newer one');
const same = { rooms: [], clientSelectionCorrections: ledgerB, projectRoomModel: confirmedNew };
const noop = carryForwardConfirmedDecisions(same, [{ projectRoomModel: confirmedOld }, { clientSelectionCorrections: ledgerB }]);
assert.equal(noop.book, same, 'nothing to carry: the same book is returned');
console.log('PASS the newest confirmed room list wins; an unconfirmed list never replaces a confirmed one; no-op returns the same book');
const rolledBack = { rooms: [], clientSelectionRollback: { at: '2026-10-31T00:00:00Z', discardedCorrectionsConfirmedAt: ledgerB.confirmedAt, discardedRoomListConfirmedAt: confirmedNew.confirmedAt } };
const afterRollback = carryForwardConfirmedDecisions(rolledBack, [{ clientSelectionCorrections: ledgerB, projectRoomModel: confirmedNew }]);
assert.equal(afterRollback.book, rolledBack, 'a deliberate rollback is never undone by an older copy’s decisions');
const laterLedger = { ...ledgerB, confirmedAt: '2026-11-02T00:00:00Z', removeProducts: [{ requirementKey: 'bath', productId: 'X' }] };
assert.equal(carryForwardConfirmedDecisions(rolledBack, [{ clientSelectionCorrections: laterLedger }]).book.clientSelectionCorrections.removeProducts[0].productId, 'X', 'a correction confirmed after the rollback still applies');
console.log('PASS a deliberate rollback is honoured; corrections confirmed after it still carry forward');
console.log('Confirmed decisions carry-forward: all checks passed.');
