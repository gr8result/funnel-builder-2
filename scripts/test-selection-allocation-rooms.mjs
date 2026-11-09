import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canonicaliseSelectionAllocations } from '../lib/builders/selectionAllocationRooms.js';

// Allocation room aliases resolve to project rooms only when the room model verifies the identity.
const job = JSON.parse(fs.readFileSync(process.argv[2] || 'artifacts/recovered-03-09-123-profile.gr8job', 'utf8'));
const wb = job.workbook || job;
const model = wb.projectRoomModel || wb.clientSelectionsBook.projectRoomModel;
const lines = (book) => (book.rooms || []).flatMap((room) => (room.rows || []).flatMap((row) => (row.guidedSelection?.plumbingAllocation?.lines || []).map((line) => ({ key: row.guidedRequirementKey || row.guidedSelection?.requirementKey, line }))));
const before = lines(wb.clientSelectionsBook);
const { book, changes } = canonicaliseSelectionAllocations(wb.clientSelectionsBook, model);
const after = lines(book);
const roomNames = new Set(model.rooms.filter((room) => !room.removed).map((room) => room.name));
const where = after.flatMap(({ key, line }) => line.allocations.map((allocation) => ({ key, product: line.productName, location: allocation.location, fixture: allocation.fixture || '', quantity: allocation.quantity })));
const unresolved = [...new Set(where.map((item) => item.location).filter((location) => !roomNames.has(location)))];
assert.deepEqual(unresolved.sort(), ['Outside', 'Staircase'], `only supported non-room locations remain outside the room list: ${unresolved}`);
before.forEach(({ line }, index) => {
  const sum = (items) => items.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
  assert.equal(sum(after[index].line.allocations), sum(line.allocations), `${line.productName}: total unchanged`);
  assert.equal(after[index].line.quantity, line.quantity);
});
assert(where.some((item) => item.key === 'bath-mixer' && item.location === 'Main Bathroom' && item.fixture === 'Shower' && item.quantity === 2));
assert(where.some((item) => item.key === 'toilet-suite' && item.location === 'B2 Ensuite'));
const fans = where.filter((item) => item.key === 'ceiling-fan');
assert.deepEqual(fans.map((item) => `${item.location}:${item.quantity}`).sort(), ['Alfresco:1', 'Balcony:1'], 'fan allocations preserved');
assert.equal(canonicaliseSelectionAllocations(book, model).changes.length, 0, 'idempotent');
const flat = (book.rooms || []).flatMap((room) => room.rows || []).flatMap((row) => [...(row.guidedSelection?.locationAllocations || []), ...(row.guidedSelection?.plumbingAllocation?.locationSchedule || [])]).map((entry) => entry.location);
assert(!flat.some((location) => /2nd bedroom ensuite|bed 2 ensuite/i.test(location || '')), `flat room lists renamed too: ${[...new Set(flat)]}`);
const { book: same } = canonicaliseSelectionAllocations({ rooms: [{ rows: [{ guidedSelection: { plumbingAllocation: { lines: [{ quantity: 1, allocations: [{ location: 'Sunroom', quantity: 1 }] }] } } }] }] }, model);
assert.equal(same.rooms[0].rows[0].guidedSelection.plumbingAllocation.lines[0].allocations[0].location, 'Sunroom', 'an unverified name is never guessed');
console.log(`PASS ${changes.length} allocations re-pointed to verified project rooms (${[...new Set(changes.map((c) => `${c.from} -> ${c.to}${c.fixture ? ` (${c.fixture})` : ''}`))].join('; ')}); totals and fans unchanged; Staircase/Outside kept; idempotent`);
