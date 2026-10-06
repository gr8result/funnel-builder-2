import assert from 'node:assert/strict';
import fs from 'node:fs';
import { houseRooms, projectLocations, takeoffRoomCounts } from '../lib/builders/projectLocations.js';
import {
  addProjectRoom, mergeProjectRooms, projectRoomModel, projectRoomUsage, removeProjectRoom, removeRoomRecords, removedProjectRooms, renameProjectRoom, renameRoomRecords, restoreProjectRoom, updateProjectRoom,
} from '../lib/builders/projectRoomModel.js';
import { ELECTRICAL_ROOM_STATUS, connectElectricalScheduleToQuotation, electricalPointsForRoom, electricalSelectionPatch, normaliseElectricalSchedule } from '../lib/builders/electricalSchedule.js';
import { ALL_GUIDED_REQUIREMENTS } from '../lib/builders/clientSelectionWorkflow.js';
import { paintableRoomNames } from '../lib/builders/internalPaintColours.js';
import { plumbingLocationsForRequirement } from '../lib/builders/plumbingFixtureAllocation.js';

// Manage Rooms: add / rename / remove / merge on the project's ONE room list
// (lib/builders/projectRoomModel.js over projectLocations.js), with stable room ids and the records
// each module holds against a room carried along.
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-project-room-model.mjs
const pass = message => console.log(`PASS ${message}`);
const opening = (roomKey, roomLabel) => ({ id: `${roomKey}-${roomLabel}`, openingType: 'window', roomKey, roomLabel, location: roomLabel });
const requirement = ALL_GUIDED_REQUIREMENTS.find(item => item.requirementKey === 'electrical-schedule');
const workbook = { aiPlanTakeoffJob: { placedOpenings: [opening('kitchen', 'Kitchen'), opening('pantry', 'Pantry'), opening('pantry', 'Pantry'), opening('media-theatre', 'Media / Theatre'), opening('bed-4', 'Bed 4'), opening('family', 'Family')] } };
const cabinetry = [{ id: 'cabinetry-kitchen', location: 'Kitchen' }, { id: 'cabinetry-butler-s-pantry', location: "Butler's Pantry" }];
const guided = (key, selection) => ({ id: `row-${key}`, guidedRequirementKey: key, guidedSelection: { requirementKey: key, ...selection } });
const allocation = (key, location, quantity = 1) => ({ locationKey: key, location, quantity });
const line = (lineId, allocations) => ({ lineId, productId: lineId, productName: lineId, unit: 'EACH', unitPrice: 100, unitAllowance: 100, allocations, quantity: allocations.reduce((n, a) => n + a.quantity, 0) });
let book = { rooms: [
  ...['Kitchen', 'Living', 'Main Bathroom', 'Bedroom 1', 'Electrical', 'Paint'].map((name, index) => ({ id: `r${index}`, name, rows: [{ id: `t${index}`, item: 'Wall Paint', selectedProduct: 'Included Selection' }] })),
  { id: 'guided-plumbing-fixtures', name: 'Plumbing Fixtures', rows: [
    guided('sink', { plumbingAllocation: { lines: [line('sink-a', [allocation('kitchen', 'Kitchen'), allocation('pantry', 'Pantry'), allocation('butlers-pantry', "Butler's Pantry")])] } }),
    guided('ceiling-fan', { plumbingAllocation: { lines: [line('fan-a', [allocation('pantry', 'Pantry', 2)])] } }),
    guided('cabinetry', { cabinetrySelection: { locations: cabinetry } }),
    guided('interior-paint', { paintScheme: { defaults: {}, overrides: [{ surface: 'walls', location: 'Pantry', choice: { colourName: 'Grey' } }, { surface: 'walls', location: "Butler's Pantry", choice: { colourName: 'White' } }, { surface: 'trims', location: 'Pantry', choice: { colourName: 'Black' } }], featureWalls: [{ id: 'f1', location: 'Media Room', wall: 'Screen wall' }] } }),
    guided('tiling-rooms', { tilingRooms: [{ id: 'tiling-room-pantry', name: 'Pantry', type: 'other' }] }),
  ] },
] };
const list = (b = book) => projectLocations({ book: b, cabinetryLocations: b.rooms.flatMap(room => room.rows).find(row => row.guidedSelection?.cabinetrySelection)?.guidedSelection.cabinetrySelection.locations || [], workbook });
const names = (b = book) => houseRooms(list(b)).map(room => room.name);
const room = (name, b = book) => list(b).find(item => item.name === name);
const find = (b, key) => b.rooms.flatMap(item => item.rows).find(row => row.guidedRequirementKey === key)?.guidedSelection;
// One change as the app makes it: the model and the modules' records move together.
function change(kind, location, payload) {
  const rooms = list();
  const model = projectRoomModel(book, workbook);
  let result; let records = book;
  if (kind === 'add') result = addProjectRoom(model, rooms, payload);
  if (kind === 'update') result = updateProjectRoom(model, location, payload);
  if (kind === 'restore') result = restoreProjectRoom(model, payload.id);
  if (kind === 'rename') { result = renameProjectRoom(model, rooms, location, payload); if (!result.error) records = renameRoomRecords(book, location, { id: location.id, name: payload }, { rooms }); }
  if (kind === 'merge') { result = mergeProjectRooms(model, location, payload); if (!result.error) records = renameRoomRecords(book, location, payload, { rooms, merge: true }); }
  if (kind === 'remove') { result = removeProjectRoom(model, location); records = removeRoomRecords(book, location); }
  if (result.error) return result;
  book = JSON.parse(JSON.stringify({ ...records, projectRoomModel: result.model })); // as saved and reloaded
  return result;
}

// ---- No static fallback: a template room needs something real behind it ------------------------
assert.deepEqual(names(), ['Kitchen', "Butler's Pantry", 'Pantry', 'Media Room', 'Bedroom 4', 'Family']);
assert(!names().includes('Living') && !names().includes('Bedroom 1') && !names().includes('Main Bathroom'), 'Selections Book template rooms are not listed on their own');
assert.equal(room('Pantry').source, 'takeoff'); assert.equal(room("Butler's Pantry").source, 'cabinetry'); assert.equal(room('Kitchen').source, 'selections-book');
const withRecord = { ...book, rooms: [...book.rooms, { id: 'guided-x', name: 'Bathroom Accessories', rows: [guided('towel-rail', { plumbingAllocation: { lines: [line('rail', [allocation('main-bathroom', 'Main Bathroom')])] } })] }] };
assert(names(withRecord).includes('Main Bathroom'), 'a template room with selections against it is a real room');
pass('template rooms (Living, Bedroom 1) are not project rooms; Pantry is from the takeoff, Butler\'s Pantry from cabinetry');

// ---- Electrical quantities on the rooms, to follow through each change -------------------------
const saveElectrical = (edit) => {
  const schedule = edit(normaliseElectricalSchedule(find(book, 'electrical-schedule')?.electricalSchedule || null, houseRooms(list())));
  const patch = electricalSelectionPatch(requirement, schedule);
  const rows = book.rooms.find(item => item.id === 'guided-plumbing-fixtures').rows.filter(row => row.guidedRequirementKey !== 'electrical-schedule');
  book = { ...book, rooms: book.rooms.map(item => (item.id === 'guided-plumbing-fixtures' ? { ...item, rows: [...rows, { id: 'row-electrical', guidedRequirementKey: 'electrical-schedule', ...patch }] } : item)) };
};
const setPoints = (schedule, name, points, extra = {}) => ({ ...schedule, rooms: schedule.rooms.map(item => (item.room === name ? { ...item, points, status: ELECTRICAL_ROOM_STATUS.confirmed, ...extra } : item)) });
saveElectrical(schedule => setPoints(setPoints(setPoints(schedule, 'Pantry', { 'double-gpo': 2, data: 1 }, { notes: 'Bench height' }), "Butler's Pantry", { 'double-gpo': 4 }), 'Media Room', { 'double-gpo': 6, tv: 1 }));
const quotation = { 'ELECTRICAL (84)': { rows: [{ id: 'q1', item: 'DOUBLE POWER POINT', unit: 'ITEM', excelRate: '$50.00' }] } };
let quoted = connectElectricalScheduleToQuotation({ quotation }, book);
const quoteRows = w => w.quotation['ELECTRICAL - CLIENT SELECTIONS'].rows;
const mediaRowId = quoteRows(quoted).find(row => row.location === 'Media Room' && row.electricalPointKey === 'double-gpo').id;
quoted = { ...quoted, quotation: { ...quoted.quotation, 'ELECTRICAL - CLIENT SELECTIONS': { rows: quoteRows(quoted).map(row => (row.id === mediaRowId ? { ...row, manualRate: '$65.00' } : row)) } } };

// ---- RENAME: same room, same id, every record follows ------------------------------------------
const mediaId = room('Media Room').id;
assert.equal(renameProjectRoom(projectRoomModel(book), list(), room('Media Room'), 'Kitchen').error, 'Kitchen is already a room in this project. Use Merge to combine the two.');
change('rename', room('Media Room'), 'Home Theatre');
assert.equal(room('Home Theatre').id, mediaId, 'renaming keeps the stable room id');
assert(!names().includes('Media Room'), 'the takeoff still says Media / Theatre, and it is the same room');
assert.equal(names().length, 6);
assert.equal(find(book, 'interior-paint').paintScheme.featureWalls[0].location, 'Home Theatre');
const renamedSchedule = normaliseElectricalSchedule(find(book, 'electrical-schedule').electricalSchedule, houseRooms(list()));
assert.deepEqual(renamedSchedule.rooms.find(item => item.room === 'Home Theatre').points, { 'double-gpo': 6, tv: 1 });
assert.equal(renamedSchedule.rooms.find(item => item.room === 'Home Theatre').status, ELECTRICAL_ROOM_STATUS.confirmed);
quoted = connectElectricalScheduleToQuotation(quoted, book);
const renamedRow = quoteRows(quoted).find(row => row.location === 'Home Theatre' && row.electricalPointKey === 'double-gpo');
assert.deepEqual([renamedRow.id, renamedRow.quantity, renamedRow.manualRate, renamedRow.item], [mediaRowId, 6, '$65.00', 'Double Powerpoint - Home Theatre'], 'the same quotation line, renamed');
assert.equal(quoteRows(quoted).filter(row => /Media Room/.test(row.item)).length, 0);
pass('rename: Media Room -> Home Theatre keeps the room id, its selections and its quotation lines');

// ---- Room type separate from display name -------------------------------------------------------
change('rename', room('Family'), "Jack's Room");
change('update', room("Jack's Room"), { roomType: 'kitchen' });
assert.equal(room("Jack's Room").roomType, 'kitchen');
const typed = normaliseElectricalSchedule(null, houseRooms(list())).rooms.find(item => item.room === "Jack's Room");
assert(electricalPointsForRoom(typed).shown.some(type => type.key === 'dishwasher'), 'a module reads the room type, not the display name');
change('update', room("Jack's Room"), { roomType: 'family' });
change('rename', room("Jack's Room"), 'Family');
pass('display name and room type are separate');

// ---- ADD: a real project room for every module --------------------------------------------------
assert.equal(change('add', null, { name: 'kitchen' }).error, 'kitchen is already in the project.');
change('add', null, { name: 'Study', level: 'Ground Floor', roomType: 'other' });
const study = room('Study');
assert.deepEqual([study.source, study.level, study.roomType, study.id.startsWith('project-room-')], ['manual', 'Ground Floor', 'other', true]);
const allNames = list().map(item => item.name);
assert(paintableRoomNames(allNames).includes('Study'), 'Paint offers the added room');
assert(plumbingLocationsForRequirement('ceiling-fan', allNames).some(item => item.label === 'Study'), 'Lighting & Ceiling Fans offers the added room');
assert(normaliseElectricalSchedule(null, houseRooms(list())).rooms.some(item => item.room === 'Study'), 'Electrical lists the added room');
pass('add: a manual room is a project room in Electrical, Lighting and Paint');

// ---- REMOVE: warn when data is attached; never silently destroy it -----------------------------
const context = () => ({ rooms: list(), takeoff: takeoffRoomCounts(workbook) });
assert.deepEqual(projectRoomUsage(book, room('Study'), context()), [], 'nothing attached: normal removal');
assert.deepEqual(projectRoomUsage(book, room('Pantry'), context()), ['Plumbing Fixtures & Tapware', 'Lighting & Ceiling Fans', 'Paint', 'Tiles & Stone', 'Electrical', 'Takeoff (2 windows / doors or measured areas)']);
assert.deepEqual(projectRoomUsage(book, room('Kitchen'), context()), ['Plumbing Fixtures & Tapware', 'Cabinetry', 'Takeoff (1 window / door or measured area)']);
change('remove', room('Study'));
assert(!names().includes('Study'));
change('remove', room('Bedroom 4'));
assert(!names().includes('Bedroom 4'), 'a removed takeoff room stays out although the takeoff still lists it');
assert.deepEqual(removedProjectRooms(projectRoomModel(book)).map(entry => entry.name), ['Study', 'Bedroom 4']);
assert.equal(workbook.aiPlanTakeoffJob.placedOpenings.filter(item => item.roomKey === 'bed-4').length, 1, 'the takeoff itself is never edited');
change('restore', null, removedProjectRooms(projectRoomModel(book)).find(entry => entry.name === 'Bedroom 4'));
assert(names().includes('Bedroom 4'));
pass('remove: usage is reported first; a removed room stays removed and can be restored');

// ---- MERGE: Pantry is the Butler's Pantry -------------------------------------------------------
const butlersId = room("Butler's Pantry").id;
change('merge', room('Pantry'), room("Butler's Pantry"));
assert(!names().includes('Pantry') && names().includes("Butler's Pantry"));
assert.equal(room("Butler's Pantry").id, butlersId, "Butler's Pantry stays the room");
assert.equal(room("Butler's Pantry").roomKey, 'pantry', 'and now owns the takeoff openings recorded as Pantry');
// The sink was counted in both names: one sink, not two. The fan only in Pantry: it moves.
assert.deepEqual(find(book, 'sink').plumbingAllocation.lines[0].allocations.map(item => `${item.location}:${item.quantity}`), ['Kitchen:1', "Butler's Pantry:1"]);
assert.equal(find(book, 'sink').plumbingAllocation.lines[0].quantity, 2);
assert.deepEqual(find(book, 'ceiling-fan').plumbingAllocation.lines[0].allocations, [{ locationKey: 'butlers-pantry', location: "Butler's Pantry", quantity: 2 }]);
// Paint: the kept room's wall colour stands; the trim override it did not have moves across.
assert.deepEqual(find(book, 'interior-paint').paintScheme.overrides.map(item => `${item.location}/${item.surface}/${item.choice.colourName}`), ["Butler's Pantry/walls/White", "Butler's Pantry/trims/Black"]);
assert.equal(find(book, 'tiling-rooms').tilingRooms[0].name, "Butler's Pantry");
// Electrical: no duplicate quantities - the kept room's 4 double powerpoints stand, the data point moves.
const merged = normaliseElectricalSchedule(find(book, 'electrical-schedule').electricalSchedule, houseRooms(list()));
assert.deepEqual(merged.rooms.find(item => item.room === "Butler's Pantry").points, { 'double-gpo': 4, data: 1 });
assert.equal(merged.rooms.find(item => item.room === "Butler's Pantry").notes, 'Bench height');
assert(!merged.rooms.some(item => item.room === 'Pantry'));
quoted = connectElectricalScheduleToQuotation(quoted, book);
assert.deepEqual(quoteRows(quoted).filter(row => /Pantry/.test(row.item)).map(row => `${row.item}:${row.quantity}`), ["Double Powerpoint - Butler's Pantry:4", "Data Point - Butler's Pantry:1"]);
assert.deepEqual(projectRoomUsage(book, { id: 'x', key: 'pantry', name: 'Pantry' }, { rooms: list(), takeoff: {} }), [], 'nothing is left attached to Pantry');
pass("merge: Pantry into Butler's Pantry moves its records, counts nothing twice, and Pantry is gone");

// ---- The current project (recovered copy of the live job), when it is on this machine -----------
const jobCopy = 'recovery/quotation-changes-2026-10-03/browser-1-01-1f7.json';
if (fs.existsSync(jobCopy)) {
  const raw = JSON.parse(fs.readFileSync(jobCopy, 'utf8'));
  const job = raw.workbook || raw;
  const jobCabinetry = b => b.rooms.flatMap(item => item.rows || []).find(row => row.guidedSelection?.cabinetrySelection)?.guidedSelection.cabinetrySelection.locations || [];
  const jobList = b => projectLocations({ book: b, cabinetryLocations: jobCabinetry(b), workbook: job });
  let jobBook = job.clientSelectionsBook;
  const before = houseRooms(jobList(jobBook));
  const usage = name => projectRoomUsage(jobBook, before.find(item => item.name === name), { rooms: jobList(jobBook), takeoff: takeoffRoomCounts(job) });
  console.log(`\nCurrent project "${job.jobName || job.projectName}" - ${before.length} rooms:`);
  before.forEach(item => console.log(`  ${item.name.padEnd(18)} ${item.source.padEnd(16)} ${usage(item.name).join(', ') || '-'}`));
  assert(!before.some(item => item.name === 'Living'), 'Living came only from the Selections Book template and is no longer listed');
  assert(job.clientSelectionsBook.rooms.some(item => item.name === 'Living'), 'the document page itself is untouched');
  assert.equal(before.find(item => item.name === 'Pantry').source, 'takeoff', 'Pantry was recorded by AI Plan Takeoff');
  assert.equal(before.find(item => item.name === "Butler's Pantry").source, 'cabinetry');
  for (const name of ['Media Room', 'Bedroom 4', "Butler's Pantry"]) assert(before.some(item => item.name === name), name);
  // The user's correction: Pantry is the Butler's Pantry.
  const from = before.find(item => item.name === 'Pantry'); const into = before.find(item => item.name === "Butler's Pantry");
  const result = mergeProjectRooms(projectRoomModel(jobBook, job), from, into);
  jobBook = { ...renameRoomRecords(jobBook, from, into, { rooms: jobList(jobBook), merge: true }), projectRoomModel: result.model };
  const after = houseRooms(jobList(jobBook)).map(item => item.name);
  assert(!after.includes('Pantry') && !after.includes('Living') && after.includes("Butler's Pantry") && after.includes('Media Room') && after.includes('Bedroom 4'));
  assert.equal(after.length, before.length - 1);
  console.log(`  After merging Pantry into Butler's Pantry (${after.length}): ${after.join(', ')}`);
  pass("current project: Living gone (template only); Pantry merges into Butler's Pantry; Media Room and Bedroom 4 stay");
} else console.log('SKIP current-project check (recovered job copy not on this machine)');

console.log('\nProject room model: all checks passed');
