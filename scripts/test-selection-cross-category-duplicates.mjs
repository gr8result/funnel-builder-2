import assert from 'node:assert/strict';
import fs from 'node:fs';
import { crossCategoryDuplicates, selectionAttention } from '../lib/builders/selectionAttention.js';
import { canonicaliseSelectionAllocations } from '../lib/builders/selectionAllocationRooms.js';

// The same product in the same room under two categories is flagged for the builder (never changed).
const job = JSON.parse(fs.readFileSync(process.argv[2] || 'artifacts/recovered-03-09-123-profile.gr8job', 'utf8'));
const wb = job.workbook || job;
const model = wb.projectRoomModel || wb.clientSelectionsBook.projectRoomModel;
const { book } = canonicaliseSelectionAllocations(wb.clientSelectionsBook, model);
const found = crossCategoryDuplicates(book);
const text = found.map((entry) => `${entry.product} @ ${entry.room}: ${entry.owners.map((owner) => `${owner.label} x${owner.quantity}${owner.fixture ? ` (${owner.fixture})` : ''}`).join(' + ')}`);
console.log(text.join('\n'));
assert(found.length >= 1 && found.every((entry) => /O\.Novo/i.test(entry.product)), 'only the O.Novo mixer overlaps');
assert.deepEqual(found.map((entry) => entry.room).sort(), ['B2 Ensuite', 'Ensuite', 'Main Bathroom']);
const attention = selectionAttention({ book, rooms: model.rooms, model });
const items = attention.groups.flatMap((group) => group.items).filter((item) => /counted twice/.test(item.detail));
assert.equal(items.length, 3, 'one attention item per room');
assert(items.every((item) => item.blocking), 'blocks issuing the final contract until the builder confirms');
const untouched = JSON.stringify(book);
crossCategoryDuplicates(book); selectionAttention({ book, rooms: model.rooms, model });
assert.equal(JSON.stringify(book), untouched, 'detection never changes selections');
console.log('PASS O.Novo shower/bath mixer flagged in Main Bathroom, Ensuite and B2 Ensuite (Shower Fixtures + Bath & Shower Mixer); nothing changed');
