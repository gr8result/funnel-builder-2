import assert from 'node:assert/strict';
import fs from 'node:fs';
import { adjacentCabinetryRoom, cabinetryLocationMissingRequirements, cabinetryRoomProgress, cabinetryRoomSequence, normaliseCabinetrySelection } from '../lib/builders/cabinetryWorkflow.js';
import { SIX_CABINETRY_ROOMS, readyCabinetryLocation, readyCabinetrySelection } from './cabinetry-room-fixture.mjs';

// Cabinetry is one continuous multi-room workflow: the project's configured locations in one fixed
// order drive Next, Previous, room progress and the summary.
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-cabinetry-room-navigation.mjs
const pass = message => console.log(`PASS ${message}`);
const names = list => list.map(location => location.location);
const room = (location, extra = {}) => ({ location, status: 'in_progress', confirmedAt: '', ...extra });

// One ordered list, from the configured locations only.
const configured = ['Laundry', 'Mudroom', 'Kitchen', 'Powder Room', "Butler's Pantry", 'Study', 'Ensuite', 'Bathroom'].map(name => room(name));
assert.deepEqual(names(cabinetryRoomSequence(configured)), ['Kitchen', "Butler's Pantry", 'Bathroom', 'Ensuite', 'Powder Room', 'Laundry', 'Mudroom', 'Study'], 'standard rooms in the standard order, custom locations after them in the order added');
assert.deepEqual(names(cabinetryRoomSequence([room('Laundry'), room('Kitchen')])), ['Kitchen', 'Laundry'], 'only configured locations appear');
assert.deepEqual(cabinetryRoomSequence([]), []); assert.deepEqual(cabinetryRoomSequence([{}, null, room('')]), []);
pass('room sequence comes from the configured locations in one stable order');

// Next / Previous walk that list end to end, complete or not.
const six = SIX_CABINETRY_ROOMS.map(name => room(name));
const forward = []; for (let current = cabinetryRoomSequence(six)[0]; current; current = adjacentCabinetryRoom(six, current.location, 1)) forward.push(current.location);
assert.deepEqual(forward, ['Kitchen', "Butler's Pantry", 'Bathroom', 'Ensuite', 'Powder Room', 'Laundry']);
const backward = []; for (let current = cabinetryRoomSequence(six).at(-1); current; current = adjacentCabinetryRoom(six, current.location, -1)) backward.push(current.location);
assert.deepEqual(backward, [...forward].reverse());
assert.equal(adjacentCabinetryRoom(six, 'Kitchen', 1).location, "Butler's Pantry");
assert.equal(adjacentCabinetryRoom(six, 'Laundry', 1), null, 'after the last room there is no next room: Finish Cabinetry');
assert.equal(adjacentCabinetryRoom(six, 'Kitchen', -1), null, 'before the first room is the summary');
assert.equal(adjacentCabinetryRoom(six, "Butler's Pantry", -1).location, 'Kitchen');
// Rooms already complete are not skipped, and an unconfigured Butler's Pantry is never invented.
const someDone = six.map(item => (['Butler\'s Pantry', 'Bathroom'].includes(item.location) ? { ...item, status: 'complete', confirmedAt: '2026-10-05T00:00:00.000Z' } : item));
assert.equal(adjacentCabinetryRoom(someDone, 'Kitchen', 1).location, "Butler's Pantry", 'a completed room is still the next room');
assert.equal(adjacentCabinetryRoom([room('Kitchen'), room('Laundry')], 'Kitchen', 1).location, 'Laundry', "Butler's Pantry is not offered when it is not configured");
assert.equal(adjacentCabinetryRoom(six, 'Garage', 1), null);
pass('Next and Previous follow the sequence in both directions and stop only at its ends');

// Progress counts rooms; it does not depend on where the user is.
assert.deepEqual(cabinetryRoomProgress(six), { complete: 0, total: 6, label: '0 of 6 locations complete', rooms: forward.map(location => ({ location, complete: false })) });
assert.equal(cabinetryRoomProgress(someDone).label, '2 of 6 locations complete');
assert.equal(cabinetryRoomProgress(six.map(item => ({ ...item, status: 'complete' }))).label, '6 of 6 locations complete');
assert.equal(cabinetryRoomProgress([]).label, 'No cabinetry locations configured');
pass('room progress reads the same list');

// Confirming rooms one after another: each stays complete, the whole is complete only at the end.
let selection = readyCabinetrySelection();
assert.deepEqual(names(selection.locations), SIX_CABINETRY_ROOMS);
for (const location of selection.locations) assert.deepEqual(cabinetryLocationMissingRequirements(location), [], `${location.location} has every required choice`);
assert.equal(selection.summary.complete, false);
const before = JSON.stringify(selection.locations.find(location => location.location === 'Kitchen').areaSelections);
for (const [index, name] of forward.entries()) {
  selection = normaliseCabinetrySelection({ ...selection, locations: selection.locations.map(location => (location.location === name ? { ...location, status: 'complete', confirmedAt: `2026-10-05T00:0${index}:00.000Z` } : location)) });
  assert.equal(cabinetryRoomProgress(selection.locations).complete, index + 1, `${index + 1} of 6 after ${name}`);
  assert.equal(selection.summary.complete, index === forward.length - 1, 'Cabinetry is complete only when every location is');
}
assert.equal(JSON.stringify(selection.locations.find(location => location.location === 'Kitchen').areaSelections), before, 'Kitchen data is untouched by confirming the other rooms');
assert.deepEqual(readyCabinetryLocation('Kitchen').handles.base.productName, 'Test handle');
pass('rooms stay complete as the workflow moves on; Cabinetry completes with the last room');

// The page uses the sequence and never lets a save navigate.
const page = fs.readFileSync('pages/modules/builders/selections-book.js', 'utf8');
assert(!page.includes('nextIncompleteCabinetryRoomAfter'), 'Next no longer looks for the next incomplete room');
assert(/const \{ commitRequirement = true, stayOnScreen = true \} = options;/.test(page), 'a cabinetry save stays on screen unless told otherwise');
assert(page.includes('onSelectProduct(requirement, next, { stayOnScreen: true });'));
assert(page.includes('adjacentCabinetryRoom(next.locations, confirmedRoomName, 1)') && page.includes('goToCabinetryRoom(previousRoom.location, CABINETRY_WORKFLOW_STAGES.length - 1)'));
pass('the workflow navigates by the room sequence and saves never move the user');
console.log('\nCabinetry room navigation: all checks passed');
