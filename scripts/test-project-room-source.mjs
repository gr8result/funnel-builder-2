import assert from 'node:assert/strict';
import { projectLocations, projectRoomFromTakeoff, takeoffProjectRooms } from '../lib/builders/projectLocations.js';
import { paintableRoomNames } from '../lib/builders/internalPaintColours.js';

// The ONE project room source for Client Selections (lib/builders/projectLocations.js): rooms the
// job actually has - the Selections Book's rooms, the cabinetry locations and every room AI Plan
// Takeoff recorded - and never a module's own list.
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-project-room-source.mjs
const pass = message => console.log(`PASS ${message}`);
const opening = (roomKey, roomLabel, openingType = 'window') => ({ id: `${roomKey}-${roomLabel}-${openingType}`, openingType, roomKey, roomLabel, location: roomLabel });

// A takeoff shaped like a real job: rooms live on the placed windows and doors, and there is no
// plan-analysis room list at all. This is the case that used to yield no takeoff rooms.
const takeoff = { placedOpenings: [
  opening('entry', 'Entry / Foyer', 'door'), opening('laundry', 'Laundry'), opening('garage', 'Garage', 'door'), opening('other', 'Store', 'door'),
  opening('pantry', 'Pantry'), opening('powder-room', 'Powder Room'), opening('media-theatre', 'Media / Theatre', 'door'), opening('media-theatre', 'Media / Theatre'),
  opening('dining', 'Dining'), opening('family', 'Family'), opening('kitchen', 'Kitchen'), opening('other', 'Study'), { id: 'unassigned', openingType: 'door', location: '' },
  opening('bed-1', 'Bed 1'), opening('bed-3', 'Bed 3'), opening('bed-2', 'Bed 2'), opening('bed-4', 'Bed 4'), opening('wir', 'WIR / Walk-in Robe'),
  opening('bathroom', 'Bathroom'), opening('other', 'B2 Ensuite'), opening('ensuite', 'Ensuite'), opening('wc', 'WC'), opening('rumpus', 'Rumpus'), opening('hallway', 'Hallway / Passage'),
  opening('exterior', 'Exterior', 'door'),
], completedFloorplans: [{ type: 'Footprint' }, { type: 'Alfresco' }, { type: 'Patio' }, { type: 'Garage' }, { type: 'Footprint' }, { type: 'Balcony' }] };
const rooms = takeoffProjectRooms({ aiPlanTakeoffJob: takeoff });
assert.deepEqual(rooms.map(room => `${room.roomKey}:${room.name}`).filter((item, index, list) => list.indexOf(item) === index), [
  'entry:Entry', 'laundry:Laundry', 'garage:Garage', 'other:Store', 'pantry:Pantry', 'powder-room:Powder Room', 'media-theatre:Media Room', 'dining:Dining', 'family:Family',
  'kitchen:Kitchen', 'other:Study', 'bed-1:Bedroom 1', 'bed-3:Bedroom 3', 'bed-2:Bedroom 2', 'bed-4:Bedroom 4', 'wir:Walk-in Robe', 'bathroom:Bathroom', 'other:B2 Ensuite',
  'ensuite:Ensuite', 'wc:WC', 'rumpus:Rumpus', 'hallway:Hallway', 'alfresco:Alfresco', 'patio:Patio', 'balcony:Balcony']);
assert.deepEqual(takeoffProjectRooms({ takeoffEngine: { aiPlanTakeoffJob: takeoff } }).length, rooms.length, 'a takeoff held under takeoffEngine is read the same way');
assert.deepEqual(takeoffProjectRooms({}), []); assert.deepEqual(takeoffProjectRooms({ aiPlanTakeoffJob: {} }), []);
pass('rooms recorded on placed windows and doors, and measured floorplan areas, are project rooms');

// Plan lettering is normalised to one display name; the canonical room key is kept; different rooms stay different.
assert.deepEqual(projectRoomFromTakeoff({ location: 'BED 4' }), { roomKey: 'bed-4', name: 'Bedroom 4' });
assert.deepEqual(projectRoomFromTakeoff({ location: 'Bedroom 4' }), { roomKey: 'bed-4', name: 'Bedroom 4' });
assert.deepEqual(projectRoomFromTakeoff({ location: 'MEDIA' }), { roomKey: 'media-theatre', name: 'Media Room' });
assert.deepEqual(projectRoomFromTakeoff({ location: 'Media Room' }), { roomKey: 'media-theatre', name: 'Media Room' });
assert.deepEqual(projectRoomFromTakeoff({ location: 'THEATRE' }), { roomKey: 'media-theatre', name: 'Media Room' });
assert.deepEqual(projectRoomFromTakeoff({ location: 'BUTLERS' }), { roomKey: 'butlers-pantry', name: "Butler's Pantry" });
assert.deepEqual(projectRoomFromTakeoff({ location: "Butler's Pantry" }), { roomKey: 'butlers-pantry', name: "Butler's Pantry" });
assert.deepEqual(projectRoomFromTakeoff({ location: 'Pantry' }), { roomKey: 'pantry', name: 'Pantry' }, "a Pantry is not a Butler's Pantry");
assert.deepEqual(projectRoomFromTakeoff({ location: 'GAMES ROOM' }), { roomKey: 'other', name: 'Games Room' }, 'an unrecognised room keeps its own name');
assert.deepEqual(projectRoomFromTakeoff({ location: 'Guest Bedroom' }), { roomKey: 'other', name: 'Guest Bedroom' });
assert.equal(projectRoomFromTakeoff({ location: '' }), null); assert.equal(projectRoomFromTakeoff({ roomKey: 'exterior', roomLabel: 'Exterior' }), null);
pass('plan names are normalised without merging different rooms');

// The shared list: the book's rooms first, then cabinetry, then the takeoff - one entry per room.
const book = { rooms: [{ id: 'r-garage', name: 'Garage' }, { id: 'r-kitchen', name: 'Kitchen' }, { id: 'r-laundry', name: 'Laundry' }, { id: 'r-bed1', name: 'Bedroom 1' },
  { id: 'r-bed2', name: 'Bedroom 2' }, { id: 'r-bed3', name: 'Bedroom 3' }, { id: 'r-living', name: 'Living' }, { id: 'guided-plumbing', name: 'Plumbing Fixtures' }] };
const locations = projectLocations({ book, cabinetryLocations: [{ id: 'c-bp', location: "Butler's Pantry" }, { id: 'c-kitchen', location: 'Kitchen' }], workbook: { aiPlanTakeoffJob: takeoff } });
const names = locations.map(location => location.name);
assert.equal(new Set(names).size, names.length, 'no room is listed twice');
for (const room of ['Media Room', 'Bedroom 4', 'Study', 'Rumpus', 'Family', 'Dining', 'Walk-in Robe', 'Store', 'WC']) assert(names.includes(room), `${room} comes through from the takeoff`);
assert(!names.includes('Bed 4') && !names.includes('Media / Theatre') && !names.includes('Plumbing Fixtures') && !names.includes('Footprint') && !names.includes('Exterior'));
const bedroom1 = locations.find(location => location.name === 'Bedroom 1');
assert.deepEqual([bedroom1.id, bedroom1.source, bedroom1.roomKey], ['r-bed1', 'selections-book', 'bed-1'], 'a room already in the Selections Book keeps its id and gains the takeoff room key');
assert.deepEqual([locations.find(location => location.name === 'Bedroom 4').source, locations.find(location => location.name === 'Bedroom 4').roomKey], ['takeoff', 'bed-4']);
assert.equal(locations.find(location => location.name === 'Media Room').roomKey, 'media-theatre');
// Nothing is invented: a job whose takeoff has no Bedroom 4 or Media Room does not get one.
const smaller = projectLocations({ book, workbook: { aiPlanTakeoffJob: { placedOpenings: [opening('bed-1', 'Bed 1'), opening('family', 'Family')] } } }).map(location => location.name);
assert(!smaller.includes('Bedroom 4') && !smaller.includes('Media Room') && !smaller.includes('Bedroom 5'));
assert.deepEqual(smaller, ['Bedroom 1', 'Family']);
// The Selections Book's template rooms are document pages, not project rooms: with nothing else to
// confirm them they are not listed. A room the builder added to the book is.
assert.deepEqual(projectLocations({ book }).map(location => location.name), []);
assert.deepEqual(projectLocations({ book: { rooms: [...book.rooms, { id: 'r-gym', name: 'Home Gym' }] } }).map(location => location.name), ['Home Gym']);
assert(!names.includes('Living'), 'Living is in the book template but not in this takeoff');
pass('one deduplicated project room list; rooms appear only when the job has them');

// A module filters the shared list. Internal paint: every paintable room, no outdoor areas.
const paintable = paintableRoomNames(names);
for (const room of ['Media Room', 'Bedroom 4', 'Garage', 'Kitchen', 'Study', 'Hallway', 'Entry', 'Walk-in Robe']) assert(paintable.includes(room), `${room} can be overridden`);
for (const room of ['Alfresco', 'Patio', 'Balcony']) assert(!paintable.includes(room), `${room} is not an internal paint room`);
pass('Internal Paint Colours filters the shared list to paintable rooms');
console.log('\nProject room source: all checks passed');
